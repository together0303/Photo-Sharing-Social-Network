import React, { useReducer, useEffect, Fragment } from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import { useParams, useHistory, Link } from 'react-router-dom';

import { selectCurrentUser, selectToken } from '../../redux/user/userSelectors';

import { INITIAL_STATE, profileReducer } from './ProfilePageReducer';
import { showModal } from '../../redux/modal/modalActions';

import { getUserProfile, followUser } from '../../services/profileService';
import { getPosts } from '../../services/postService';

import useScrollPositionThrottled from '../../hooks/useScrollPositionThrottled';

import ProfileCategory from '../../components/ProfileCategory/ProfileCategory';
import Icon from '../../components/Icon/Icon';
import ProfileImage from '../../components/ProfileImage/ProfileImage';
import Loader from '../../components/Loader/Loader';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import MobileHeader from '../../components/Header/MobileHeader/MobileHeader';
import ProfileHeader from './ProfileHeader';

const ProfilePage = ({ currentUser, token, showModal }) => {
  const { username } = useParams();
  const history = useHistory();
  const [state, dispatch] = useReducer(profileReducer, INITIAL_STATE);

  const follow = async () => {
    try {
      dispatch({ type: 'FOLLOW_USER_START' });
      const response = await followUser(state.data.user._id, token);
      dispatch({
        type: 'FOLLOW_USER_SUCCESS',
        payload: response.operation,
      });
    } catch (err) {
      dispatch({
        type: 'FOLLOW_USER_FAILURE',
        payload: err,
      });
    }
  };

  useScrollPositionThrottled(async () => {
    if (
      window.innerHeight + document.documentElement.scrollTop ===
        document.documentElement.offsetHeight &&
      state.data.posts.length < state.data.postCount &&
      !state.fetchingAdditionalPosts
    ) {
      try {
        dispatch({ type: 'FETCH_ADDITIONAL_POSTS_START' });
        const posts = await getPosts(username, state.data.posts.length);
        dispatch({ type: 'FETCH_ADDITIONAL_POSTS_SUCCESS' });
        dispatch({ type: 'ADD_POSTS', payload: posts });
      } catch (err) {
        dispatch({ type: 'FETCH_ADDITIONAL_POSTS_FAILURE', payload: err });
      }
    }
  }, null);

  useEffect(() => {
    document.title = `@${username} • Instaclone photos`;
    (async function () {
      try {
        dispatch({ type: 'FETCH_PROFILE_START' });
        const profile = await getUserProfile(username, token);
        dispatch({ type: 'FETCH_PROFILE_SUCCESS', payload: profile });
      } catch (err) {
        dispatch({ type: 'FETCH_PROFILE_FAILURE', payload: err });
      }
    })();
  }, [username]);

  const handleClick = (postId) => {
    if (window.outerWidth <= 600) {
      history.push(`/post/${postId}`);
    } else {
      showModal(
        {
          postId,
          avatar: state.data.avatar,
          profileDispatch: dispatch,
        },
        'PostDialog/PostDialog'
      );
    }
  };

  const renderProfile = () => {
    if (state.fetching) {
      return <Loader />;
    } else if (state.error) {
      return <h1 className="heading-1">This page does not exist</h1>;
    }
    if (!state.fetching && state.data) {
      return (
        <Fragment>
          <ProfileHeader
            currentUser={currentUser}
            data={state.data}
            showModal={showModal}
            token={token}
            follow={follow}
            loading={state.following}
          />
          <ProfileCategory category="POSTS" icon="apps-outline" />
          <div className="profile-images">
            {state.data.posts.map((post, idx) => {
              return (
                <ProfileImage
                  onClick={() => handleClick(post._id)}
                  image={post.image}
                  likes={post.postVotes}
                  comments={post.comments}
                  filter={post.filter}
                  key={idx}
                />
              );
            })}
            {state.fetchingAdditionalPosts && (
              <Fragment>
                <div>
                  <SkeletonLoader animated />
                </div>
                <div>
                  <SkeletonLoader animated />
                </div>
                <div>
                  <SkeletonLoader animated />
                </div>
              </Fragment>
            )}
          </div>
        </Fragment>
      );
    }
  };

  return (
    <Fragment>
      {currentUser && currentUser.username === username ? (
        <MobileHeader>
          <Icon icon="aperture-outline" />
          <h3 className="heading-3">{username}</h3>
          <div></div>
        </MobileHeader>
      ) : (
        <MobileHeader backArrow>
          <h3 className="heading-3">{username}</h3>
          <div></div>
        </MobileHeader>
      )}
      <div className="profile-page grid">{renderProfile()}</div>
    </Fragment>
  );
};

const mapStateToProps = createStructuredSelector({
  currentUser: selectCurrentUser,
  token: selectToken,
});

const mapDispatchToProps = (dispatch) => ({
  showModal: (props, component) => dispatch(showModal(props, component)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ProfilePage);
