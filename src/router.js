// router.js

const expressAsyncHandler = require("express-async-handler");
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const markdownIt = require('markdown-it')();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { connectMongo, User, Post, Chat } = require('./mongo')
const authControl = require('./auth')
const dashControl = require('./dash')
const postControl = require('./post')
const chatControl = require('./chat')

/* GET home page. */
router.get('/', authControl.checkAuth, function(req, res, next) {
  console.log('redirect root to dashboard...')
  res.redirect(301, '/dashboard');
});

/* GET dashboard with public posts*/
router.get('/dashboard', authControl.checkAuth, async function(req, res, next) {
  try {
      // Get the token from the request headers
      const token = req.cookies.token;

      // Decode the token to extract the user ID
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decodedToken.userId;

      // Fetch the user object from the database using the user ID
      connectMongo()
      const user = await User.findById(userId);

      const posts = await Post.find({ public: true })
      .populate({
          path: 'author',
          select: 'username'
      })
      .populate({
          path: 'comments.user',
          select: 'username'
      });

      const inbox = await Chat.find({ partyMembers: userId })
      .populate({
          path: 'partyMembers',
          select: 'username',
          model: 'User'
      })
      .exec();

      let notes = [];

      const postComments = await Post.find({
          author: userId,
          'comments.new': true
      }).populate('author', 'username');
          
      notes.push(...postComments);

      const likedPosts = await Post.find({
          author: userId,
          'likes.new': true
      }).populate('author', 'username');

      notes.push(...likedPosts);

      const newFollowers = user.followers.filter(follower => follower.new);

      await User.populate(newFollowers, { path: 'user', select: 'username' });

      notes.push(...newFollowers);

      // Render the dashboard with the user object
      res.render('index', { title: user.username, token, user, inbox, posts, notes });  
  } catch (error) {
    console.error('Error in fetching user data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/* GET dashboard with followed posts*/
router.get('/dashboard/follows', authControl.checkAuth, async function(req, res, next) {
  try {
    // Get the token from the request headers
    const token = req.cookies.token;

    // Decode the token to extract the user ID
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.userId;

    // Fetch the user object from the database using the user ID
    connectMongo()
    const user = await User.findById(userId);

    const posts = await Post.find({ 'author': { $in: user.following.map(f => f.user) } })
    .populate('author', 'username')
    .populate('comments.user', 'username');
    
    // Render the dashboard with the user object
    res.render('index', { title: user.username, token, user, posts });
  } catch (error) {
    console.error('Error in fetching user data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET log in form
router.get('/auth', authControl.auth_form);

// POST user log in
router.post('/auth', authControl.auth_post);

// GET sign up form
router.get('/auth/new', authControl.signup_form);

// POST user sign up
router.post('/auth/new', authControl.signup_post);

// POST user log out
router.post('/auth/out', authControl.auth_out)

// GET user data
router.get('/user', authControl.user_data);

// GET user settings
router.get('/settings', authControl.checkAuth, authControl.user_account)

// GET user settings
router.post('/settings', authControl.checkAuth, authControl.post_account)

// POST new post
router.post('/post', authControl.checkAuth, postControl.new_post)

// GET all posts for feed
router.get('/feed', authControl.checkAuth, postControl.all_posts)

// POST link (friend) request
router.post('/follow/:username', authControl.checkAuth, dashControl.new_follow)

// GET all followers/followings
router.get('/follows', authControl.checkAuth, dashControl.all_follows)

// POST user unfollow
router.post('/unfollow/:username', authControl.checkAuth, dashControl.un_follow)

// POST new chat
router.post('/chat/new/:username', authControl.checkAuth, chatControl.new_chat)

// GET all posts by user
router.get('/:username/feed', authControl.checkAuth, postControl.user_posts)

// POST comment to post
router.post('/:username/:id/comment', authControl.checkAuth, postControl.post_comment)

// POST comment to post
router.post('/:username/:id/like', authControl.checkAuth, postControl.add_like)

// POST delete to post
router.post('/:username/:id/delete', authControl.checkAuth, postControl.delete_post)

// GET post editor
router.get('/:username/:id/edit', authControl.checkAuth, postControl.edit_post)

// POST post edits
router.post('/:username/:id/edit', authControl.checkAuth, postControl.update_post)

// GET chat by id
router.get('/thread/:chatId', authControl.checkAuth, chatControl.get_chat)

// POST new message to chat
router.post('/thread/:chatId', authControl.checkAuth, chatControl.chat_post);

// GET spec post
router.get('/:username/:id', authControl.checkAuth, postControl.spec_post)

// GET user inbox
router.get('/inbox', authControl.checkAuth, chatControl.get_inbox)

// GET notification page
router.get('/notes', authControl.checkAuth, dashControl.new_notes)

// GET notification page
router.post('/notes/read', authControl.checkAuth, dashControl.read_note)

/* GET docs */
router.get('/docs', function(req, res, next) {

  const readmePath = path.join(__dirname, '../README.md');

  fs.readFile(readmePath, 'utf8', (err, data) => {
    if (err) {
      next(err);
    } else {
      const markdownContent = markdownIt.render(data);
      res.render('docs', { title: 'README.md', markdownContent });
    }
  });
});

// GET API health
router.get('/health', async function(req, res, next) {
  try {
    // Test local/host server
    const serverHealth = 'OK';

    // Ensure MongoDB connection
    await connectMongo();

    // Test mongoDB connection
    const mongoHealth = mongoose.connection.readyState === 1 ? 'OK' : 'Not connected';

    // Check if socket.io is initialized
    const socketHealth = await testSocketIo();

    console.log('Server:', serverHealth);
    console.log('Database:', mongoHealth);

    // Check overall health
    if (serverHealth === 'OK' && mongoHealth === 'OK' && socketHealth === 'OK') {
      console.log('Health check: GOOD');
      res.status(200).json({ status: 'GOOD', details: { server: serverHealth, mongoDB: mongoHealth, socketIO: socketHealth } });
    } else {
      // Handle health check failures
      console.error('Health check: BAD');
      res.status(503).json({ status: 'ISSUE', details: { server: serverHealth, mongoDB: mongoHealth, socketIO: socketHealth } });
    }
    } catch (error) {
    console.error('Error:', error); 
    res.status(500).json({ status: 'ISSUE', details: { error: error.message } });
    }
});

// DO NOT MOVE: Any routes below
// OR ELSE: Search functions will break :(

// GET user profile
router.get('/:username', authControl.checkAuth, dashControl.get_profile)

// Helper functions and routing middleware

async function testSocketIo() {
  return new Promise((resolve, reject) => {
    const testSocket = require('socket.io-client')('http://localhost:3000'); 

    testSocket.on('connect', () => {
      console.log('Socket: OK');
      testSocket.disconnect();
      resolve('OK');
    });

    testSocket.on('connect_error', (error) => {
      console.error('Error testing socket:', error);
      testSocket.disconnect();
      resolve('Not initialized');
    });
  });
}

module.exports = router;
