const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ObjectId = require('mongoose').Types.ObjectId;
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const linkify = require('linkifyjs');
require('linkifyjs/plugins/mention')(linkify);
const fs = require('fs');

const notificationHandler = require('../handlers/notificationHandler');

/**
 * Retrieves a post's comments with a specified offset
 * @function retrieveComments
 * @param {string} postId The id of the post to retrieve comments from
 * @param {number} offset The amount of comments to skip
 * @returns {array} Array of comments
 */
module.exports.retrieveComments = async (postId, offset, exclude = 0) => {
  try {
    const commentsAggregation = await Comment.aggregate([
      {
        $facet: {
          comments: [
            { $match: { post: ObjectId(postId) } },
            // Sort the newest comments to the top
            { $sort: { date: -1 } },
            // Skip the comments we do not want
            // This is desireable in the even that a comment has been created
            // and stored locally, we'd not want duplicate comments
            { $skip: Number(exclude) },
            // Re-sort the comments to an ascending order
            { $sort: { date: 1 } },
            { $skip: Number(offset) },
            { $limit: 10 },
            {
              $lookup: {
                from: 'commentreplies',
                localField: '_id',
                foreignField: 'parentComment',
                as: 'commentReplies',
              },
            },
            {
              $lookup: {
                from: 'commentvotes',
                localField: '_id',
                foreignField: 'comment',
                as: 'commentVotes',
              },
            },
            { $unwind: '$commentVotes' },
            {
              $lookup: {
                from: 'users',
                localField: 'author',
                foreignField: '_id',
                as: 'author',
              },
            },
            { $unwind: '$author' },
            {
              $addFields: {
                commentReplies: { $size: '$commentReplies' },
                commentVotes: '$commentVotes.votes',
              },
            },
            {
              $unset: [
                'author.password',
                'author.email',
                'author.private',
                'author.bio',
                'author.bookmarks',
              ],
            },
          ],
          commentCount: [
            {
              $match: { post: ObjectId(postId) },
            },
            { $group: { _id: null, count: { $sum: 1 } } },
          ],
        },
      },
      {
        $unwind: '$commentCount',
      },
      {
        $addFields: {
          commentCount: '$commentCount.count',
        },
      },
    ]);
    return commentsAggregation[0];
  } catch (err) {
    throw new Error(err);
  }
};

/**
 * @function sendEmail
 * @param {string} to The destination email address to send an email to
 * @param {string} subject The subject of the email
 * @param {html} template Html to include in the email
 */
module.exports.sendEmail = async (to, subject, template) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  await transporter.sendMail({
    from: '"Instaclone Support" <support@instaclone.net>',
    to,
    subject,
    html: template,
  });
};

/**
 * Sends a confirmation email to an email address
 * @function sendConfirmationEmail
 * @param {string} username The username of the user to send the email to
 * @param {string} email The email of the user to send the email to
 * @param {string} confirmationToken The token to use to confirm the email
 */
module.exports.sendConfirmationEmail = async (
  username,
  email,
  confirmationToken
) => {
  if (process.env.NODE_ENV === 'production') {
    try {
      const source = fs.readFileSync(
        'templates/confirmationEmail.html',
        'utf8'
      );
      template = handlebars.compile(source);
      const html = template({
        username: username,
        confirmationUrl: `${process.env.HOME_URL}/confirm/${confirmationToken}`,
        url: process.env.HOME_URL,
      });
      await this.sendEmail(email, 'Confirm your instaclone account', html);
    } catch (err) {
      console.log(err);
    }
  }
};

/**
 * Formats a cloudinary thumbnail url with a specified size
 * @function formatCloudinaryUrl
 * @param {string} url The url to format
 * @param {size} number Desired size of the image
 * @return {string} Formatted url
 */
module.exports.formatCloudinaryUrl = (url, size) => {
  const splitUrl = url.split('upload/');
  splitUrl[0] += `upload/w_${size},h_${size},c_thumb/`;
  const formattedUrl = splitUrl[0] + splitUrl[1];
  return formattedUrl;
};

/**
 * Sends a notification when a user has commented on your post
 * @function sendCommentNotification
 * @param {object} req The request object
 * @param {object} sender User who triggered the notification
 * @param {string} receiver Id of the user to receive the notification
 * @param {string} image Image of the post that was commented on
 * @param {string} message The message sent by the user
 * @param {string} postId The id of the post that was commented on
 */
module.exports.sendCommentNotification = async (
  req,
  sender,
  receiver,
  image,
  message,
  postId
) => {
  try {
    if (String(sender._id) !== String(receiver)) {
      console.log(String(sender._id), String(receiver));
      const notification = new Notification({
        sender: sender._id,
        receiver,
        notificationType: 'comment',
        date: Date.now(),
        notificationData: {
          postId,
          image,
          message,
        },
      });
      await notification.save();
      notificationHandler.sendNotification(req, {
        ...notification.toObject(),
        sender: {
          _id: sender._id,
          username: sender.username,
          avatar: sender.avatar,
        },
      });
    }
  } catch (err) {
    throw new Error(err.message);
  }
};

/**
 * Sends a notification to the user when the user is mentioned
 * @function sendMentionNotification
 * @param {object} req The request object
 * @param {string} message The message sent by the user
 * @param {string} image Image of the post that was commented on
 * @param {object} post The post that was commented on
 * @param {object} user User who commented on the post
 */
module.exports.sendMentionNotification = (req, message, image, post, user) => {
  const mentionedUsers = new Set();
  // Looping through every mention and sending a notification when necessary
  linkify.find(message).forEach(async (item) => {
    // Making sure a mention notification is not sent to the sender or the poster
    if (
      item.type === 'mention' &&
      item.value !== `@${user.username}` &&
      item.value !== `@${post.author.username}` &&
      // Making sure a mentioned user only gets one notification regardless
      // of how many times they are mentioned in one comment
      !mentionedUsers.has(item.value)
    ) {
      mentionedUsers.add(item.value);
      // Finding the receiving user's id
      const receiverDocument = await User.findOne({
        username: item.value.split('@')[1],
      });
      if (receiverDocument) {
        const notification = new Notification({
          sender: user._id,
          receiver: receiverDocument._id,
          notificationType: 'mention',
          date: Date.now(),
          notificationData: {
            postId: post._id,
            image,
            message,
          },
        });
        await notification.save();
        notificationHandler.sendNotification(req, {
          ...notification.toObject(),
          sender: {
            _id: user._id,
            username: user.username,
            author: user.author,
          },
        });
      }
    }
  });
};