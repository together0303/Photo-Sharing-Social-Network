import React, { Fragment, useRef, useState, useEffect } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { formatDateDistance } from '../../utils/timeUtils';

import Icon from '../Icon/Icon';

import { showModal } from '../../redux/modal/modalActions';

import {
  voteComment,
  getCommentReplies,
  deleteComment,
} from '../../services/commentService';

import Avatar from '../Avatar/Avatar';
import PulsatingIcon from '../Icon/PulsatingIcon/PulsatingIcon';
import CommentReply from './CommentReply/CommentReply';

const Comment = ({
  comment,
  caption,
  post,
  token,
  currentUser,
  dialogDispatch,
  profileDispatch,
  showModal,
}) => {
  const commentRef = useRef();
  const [commentPostTime, setCommentPostTime] = useState(() =>
    formatDateDistance(caption ? post.date : comment.date)
  );
  const [toggleCommentReplies, setToggleCommentReplies] = useState(false);
  const author = caption ? comment : comment.author;

  const commentReplies =
    post.commentReplies
      .filter((commentReply) => commentReply.parentComment === comment._id)
      .sort((a, b) => {
        return new Date(a) - new Date(b);
      }) || [];

  useEffect(() => {
    const commentPostTimeInterval = setInterval(() => {
      setCommentPostTime(
        formatDateDistance(caption ? post.date : comment.date)
      );
    }, 60000);
    return () => clearInterval(commentPostTimeInterval);
  }, [setCommentPostTime, caption, comment, post]);

  // useEffect(() => {
  //   // Show the comment replies when the comment state changes f.ex if a user replies to this comment
  //   !toggleCommentReplies && setToggleCommentReplies(true);
  // }, [commentReplies]);

  const handleVote = async () => {
    try {
      dialogDispatch({
        type: 'VOTE_COMMENT',
        payload: { commentId: comment._id, currentUser },
      });
      await voteComment(comment._id, token);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleGetCommentReplies = async () => {
    if (commentReplies.length === comment.commentReplies) {
      setToggleCommentReplies((previous) => !previous);
    } else {
      try {
        const replies = await getCommentReplies(
          comment._id,
          commentReplies.length > 0 ? commentReplies.length : 0
        );
        dialogDispatch({
          type: 'ADD_COMMENT_REPLY',
          payload: { comment: replies, parentCommentId: comment._id },
        });
        !toggleCommentReplies && setToggleCommentReplies(true);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleDeleteComment = async () => {
    try {
      dialogDispatch({ type: 'REMOVE_COMMENT', payload: comment._id });
      profileDispatch({
        type: 'DECREMENT_POST_COMMENTS_COUNT',
        payload: {
          decrementCount: comment.commentReplies
            ? 1 + comment.commentReplies
            : 1,
          postId: post._id,
        },
      });
      await deleteComment(comment._id, token);
    } catch (err) {
      console.warn(err);
    }
  };

  const renderToggleRepliesButtonText = () => {
    if (commentReplies.length === comment.commentReplies) {
      if (toggleCommentReplies) {
        return 'Hide replies';
      }
      return `View replies (${comment.commentReplies})`;
    } else if (commentReplies.length < comment.commentReplies) {
      return `View replies (${comment.commentReplies - commentReplies.length})`;
    }
  };

  return (
    <Fragment>
      <div className="comment" ref={commentRef}>
        <Avatar imageSrc={author.avatar} className="avatar--small" />
        <div className="comment__content">
          <p className="heading-4">
            <b>{author.username}</b> {comment.message}
          </p>
          {!caption && author.username === currentUser.username ? (
            <div
              onClick={() =>
                showModal(
                  {
                    options: [
                      {
                        warning: true,
                        text: 'Delete',
                        onClick: () => handleDeleteComment(),
                      },
                    ],
                  },
                  'OptionsDialog'
                )
              }
              className="comment__menu-dots"
              style={{ marginRight: '0' }}
            >
              <Icon
                className="icon--small icon--button color-grey"
                icon="ellipsis-horizontal"
                style={{ height: '3rem' }}
              />
            </div>
          ) : null}
          <div className="comment__stats">
            <p className="heading-5 color-light">{commentPostTime}</p>
            {!caption && (
              <Fragment>
                {comment.commentVotes.length > 0 && (
                  <p className="heading-5 color-light">
                    {comment.commentVotes.length}{' '}
                    {comment.commentVotes.length === 1 ? 'like' : 'likes'}
                  </p>
                )}
                <button
                  onClick={() =>
                    // Telling the PostDialogCommentForm that we want to reply to this comment
                    dialogDispatch({
                      type: 'SET_REPLYING',
                      payload: {
                        username: comment.author.username,
                        commentId: comment._id,
                      },
                    })
                  }
                  className="heading-5 heading--button color-light"
                >
                  reply
                </button>
              </Fragment>
            )}
          </div>
          {!caption && comment.commentReplies > 0 ? (
            <p
              onClick={() => handleGetCommentReplies()}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '1rem',
              }}
              className="heading-5 heading--button color-light"
            >
              <span className="dash mr-lg" />
              {/* Check if all the comments available are fetched */}
              {renderToggleRepliesButtonText()}
            </p>
          ) : null}
        </div>
        {!caption && (
          <div className="comment__like">
            <PulsatingIcon
              toggle={
                !!comment.commentVotes.find(
                  (vote) => vote.author === currentUser._id
                )
              }
              constantProps={{
                onClick: () => handleVote(),
              }}
              toggledProps={[
                { icon: 'heart', className: 'icon--tiny color-red' },
                { icon: 'heart-outline', className: 'icon--tiny' },
              ]}
              elementRef={commentRef}
            />
          </div>
        )}
      </div>
      {/* Render any comment replies */}
      {toggleCommentReplies
        ? commentReplies.map((commentReply, idx) => (
            <CommentReply
              comment={commentReply}
              parentComment={comment}
              post={post}
              token={token}
              currentUser={currentUser}
              dialogDispatch={dialogDispatch}
              profileDispatch={profileDispatch}
              showModal={showModal}
              key={idx}
            />
          ))
        : null}
    </Fragment>
  );
};

const mapDispatchToProps = (dispatch) => ({
  showModal: (props, component) => dispatch(showModal(props, component)),
});

Comment.propTypes = {
  comment: PropTypes.shape({
    message: PropTypes.string.isRequired,
    avatar: PropTypes.string,
    username: PropTypes.isRequired,
    commentVotes: PropTypes.array,
    _id: PropTypes.string,
    date: PropTypes.string,
  }).isRequired,
  caption: PropTypes.bool,
  post: PropTypes.object.isRequired,
  token: PropTypes.string.isRequired,
  currentUser: PropTypes.object.isRequired,
  showModal: PropTypes.func.isRequired,
};

export default connect(null, mapDispatchToProps)(Comment);
