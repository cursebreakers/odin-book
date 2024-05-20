// mongo.js - MongoDB Controller Module + Schemas/Models

const mongoose = require('mongoose');

// MongoDB connection function
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
}

// Define a User schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  followers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    followedOn: { type: Date, default: Date.now },
    new: {type: Boolean, default: true }
  }],
  following: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    followedOn: { type: Date, default: Date.now },
  }],
  status: { type: String },
  avatar: { type: String },
  bio: {type: String },
  joinedOn: { type: Date, default: Date.now }
});

// Virtual for profile URL
userSchema.virtual('profileUrl').get(function() {
  return `/${this.username}`;
});

const User = mongoose.model('User', userSchema, 'users');

// Define a Post schema
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: {type: String, required: true },
  content: [{
    text: {type: String},
    imageUrl: {type: String}
  }],
  tags: [{ type: String }],
  public: { type: Boolean },
  likes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    new: { type: Boolean, default: true }
  }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    new: {type: Boolean, default: true }
  }]
});

// Virtual for post URL
postSchema.virtual('postUrl').get(function() {
  return `/${this.author.username}/${this._id}`;
});

const Post = mongoose.model('Post', postSchema, 'posts');

// Define a Chat schema
const chatSchema = new mongoose.Schema({
  partyMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messageThread: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    new: {type: Boolean, default: true }
  }]
});

// Virtual for chat URL
chatSchema.virtual('chatUrl').get(function() {
  return `/thread/${this._id}`;
});

const Chat = mongoose.model('Chat', chatSchema, 'chats');


module.exports = { connectMongo, User, Post, Chat };

