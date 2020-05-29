import React, { useReducer, useEffect, Fragment } from 'react';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import { useParams, useHistory, Link } from 'react-router-dom';

import { selectCurrentUser, selectToken } from '../redux/user/userSelectors';

import { INITIAL_STATE, profileReducer } from './ProfilePageReducer';
import { showModal } from '../redux/modal/modalActions';

import { getUserProfile, followUser } from '../services/profileService';
import { getPosts } from '../services/postService';

import useScrollPositionThrottled from '../hooks/useScrollPositionThrottled';

import Avatar from '../components/Avatar/Avatar';
import ChangeAvatarButton from '../components/ChangeAvatarButton/ChangeAvatarButton';
import Button from '../components/Button/Button';
import ProfileCategory from '../components/ProfileCategory/ProfileCategory';
import Icon from '../components/Icon/Icon';
import ProfileImage from '../components/ProfileImage/ProfileImage';
import Loader from '../components/Loader/Loader';
import SkeletonLoader from '../components/SkeletonLoader/SkeletonLoader';
import UsersList from '../components/UsersList/UsersList';
import UnfollowPrompt from '../components/UnfollowPrompt/UnfollowPrompt';
import MobileHeader from '../components/Header/MobileHeader/MobileHeader';

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

  const showFollowersModal = (followers) => {
    token &&
      showModal(
        {
          options: [],
          title: 'Followers',
          cancelButton: false,
          children: (
            <UsersList
              userId={state.data.user._id}
              token={token}
              followersCount={followers}
              followers
            />
          ),
        },
        'OptionsDialog/OptionsDialog'
      );
  };

  const showFollowingModal = (following) => {
    token &&
      showModal(
        {
          options: [],
          title: 'Following',
          cancelButton: false,
          children: (
            <UsersList
              userId={state.data.user._id}
              token={token}
              followingCount={following}
              following
            />
          ),
        },
        'OptionsDialog/OptionsDialog'
      );
  };

  const renderButton = () => {
    if (currentUser) {
      if (currentUser.username === username) {
        return (
          <Fragment>
            <Link to="/settings/edit">
              <Button inverted>Edit Profile</Button>
            </Link>
            <div className="icon">
              <Icon icon="aperture-outline" />
            </div>
          </Fragment>
        );
      } else if (state.data.isFollowing) {
        return (
          <Button
            loading={state.following}
            onClick={() =>
              showModal(
                {
                  options: [
                    {
                      warning: true,
                      text: 'Unfollow',
                      onClick: () => follow(),
                    },
                  ],
                  children: (
                    <UnfollowPrompt
                      avatar={state.data.user.avatar}
                      username={state.data.user.username}
                    />
                  ),
                },
                'OptionsDialog/OptionsDialog'
              )
            }
            inverted
          >
            Following
          </Button>
        );
      }
    }
    return (
      <Button
        loading={state.following}
        onClick={() => follow(state.data.user._id, token)}
      >
        Follow
      </Button>
    );
  };

  const renderProfile = () => {
    if (state.fetching) {
      return <Loader />;
    } else if (state.error) {
      return <h1 className="heading-1">This page does not exist</h1>;
    }
    if (!state.fetching && state.data) {
      const {
        followers,
        following,
        user: { avatar, username, bio, website, fullName },
        posts,
        postCount,
      } = state.data;
      return (
        <Fragment>
          <header className="profile-header">
            {currentUser && currentUser.username === username ? (
              <ChangeAvatarButton>
                <Avatar
                  className="profile-header__avatar"
                  imageSrc={currentUser.avatar}
                />
              </ChangeAvatarButton>
            ) : (
              <Avatar className="profile-header__avatar" imageSrc={avatar} />
            )}

            <div className="profile-header__info">
              <div className="profile-buttons">
                <h1 className="heading-1 font-thin">{username}</h1>
                {renderButton()}
              </div>
              <div className="profile-stats">
                <p className="heading-3">
                  <b>{postCount}</b> {postCount === 1 ? 'post' : 'posts'}
                </p>
                <p
                  onClick={() => showFollowersModal(followers)}
                  style={{ cursor: 'pointer' }}
                  className="heading-3"
                >
                  <b>{followers}</b>{' '}
                  {followers > 1 || followers === 0 ? 'followers' : 'follower'}
                </p>
                <p
                  onClick={() => showFollowingModal(following)}
                  style={{ cursor: 'pointer' }}
                  className="heading-3"
                >
                  <b>{following}</b> following
                </p>
              </div>
              <div>
                {fullName && (
                  <h3 className="heading-3">
                    <b>{fullName}</b>
                  </h3>
                )}
                <p className="heading-3" style={{ whiteSpace: 'pre' }}>
                  {bio}
                </p>
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="heading-3 link font-bold"
                  >
                    {website}
                  </a>
                )}
              </div>
            </div>
            <div className="profile-header__mobile-user-details">
              <div>
                {fullName && (
                  <p className="heading-3">
                    <b>{fullName}</b>
                  </p>
                )}
                <h3
                  className="heading-3 font-medium"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {bio}
                </h3>
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="heading-3 link font-bold"
                  >
                    {website}
                  </a>
                )}
              </div>
              <div className="profile-stats">
                <h3 className="heading-3">
                  <b>{postCount}</b>
                  <span className="font-medium color-grey">
                    {postCount === 1 ? 'post' : 'posts'}
                  </span>
                </h3>
                <h3
                  onClick={() => showFollowersModal(followers)}
                  style={{ cursor: 'pointer' }}
                  className="heading-3"
                >
                  <b>{followers}</b>{' '}
                  <span className="font-medium color-grey">
                    {followers > 1 || followers === 0
                      ? 'followers'
                      : 'follower'}
                  </span>
                </h3>
                <h3
                  onClick={() => showFollowingModal(following)}
                  style={{ cursor: 'pointer' }}
                  className="heading-3"
                >
                  <b>{following}</b>
                  <span className="font-medium color-grey">following</span>
                </h3>
              </div>
            </div>
          </header>
          <ProfileCategory category="POSTS" icon="apps-outline" />
          <div className="profile-images">
            {posts.map((post, idx) => {
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
