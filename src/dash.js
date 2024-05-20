// Dashboard controller module - dash.js

const expressAsyncHandler = require("express-async-handler");
const jwt = require('jsonwebtoken');

const { checkAuth } = require('./auth')
const { connectMongo, User, Post, Chat } = require('./mongo')

// GET new notifications
exports.new_notes = expressAsyncHandler(async (req, res) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo();

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let notes = [];

        const postComments = await Post.find({
            userId,
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
        console.log('Notes array:', postComments, likedPosts, newFollowers);

        res.render('notes', { title: 'Notification', postComments: postComments, likedPosts: likedPosts, follows: newFollowers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST note as read
exports.read_note = expressAsyncHandler(async (req, res) => {

    res.setHeader('Cache-Control', 'no-store');

    // get username and (post/like id, if included) from req body
    const { username, commentId, likeId } = req.body;
    console.log('Read notification:', username, commentId, likeId)
    

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        // get authedUser
        const user = await User.findById(userId).populate({
            path: 'followers.user',
            select: 'username new',
          });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // get targetUser
        const targetUser = await User.findOne({ username });

        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        const targetFollower = user.followers.find(follower => follower.user.username === targetUser.username);
        
        if (targetFollower) {
            targetFollower.new = false;
            await user.save();
        }

        if (commentId) {
            // Find the post containing the comment
            const post = await Post.findOne({ 'comments._id': commentId });

            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            const comment = post.comments.id(commentId);

            if (!comment) {
                return res.status(404).json({ message: 'Comment not found' });
            }

            // Mark the comment as read
            if (comment.new) {
                comment.new = false;
                await post.save();
            }
        }

        // If a like id was received:
        if (likeId) {
            // Find the post containing the like
            const post = await Post.findOne({ 'likes._id': likeId });

            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Find and update the like
            const like = post.likes.id(likeId);

            if (!like) {
                return res.status(404).json({ message: 'Like not found' });
            }

            // Mark the like as read
            if (like.new) {
                like.new = false;
                await post.save();
            }
        }

        res.redirect('/notes')
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET user profile
exports.get_profile = expressAsyncHandler(async (req, res) => {
    
    
    const username = req.params.username;

    try {
        const user = await User.findOne({ username }).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const posts = await Post.find({ 'author': user._id })
        .populate({
            path: 'author',
            select: 'username'
        })
        .populate({
            path: 'comments.user',
            select: 'username'
        });

        res.render('profile', { title: user.username, user, posts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});


// POST link request (friend)
exports.new_follow = expressAsyncHandler(async (req, res) => {
    
    // Get recipient from request parameters
    const { username } = req.params;

    try {

        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }   

        // get sender from request token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const senderId = decodedToken.userId;

        connectMongo()

        const sender = await User.findById( senderId ).exec();

        if (!sender) {
            return res.status(404).json({ message: 'Sender not found' });
        }

        const recipient = await User.findOne({ username }).exec();
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        console.log('Checking users...', sender, 'and', recipient)   
        console.log('Checking follow status...', sender._id, 'and', recipient._id)

        // Check if sender trying to follow themselves - error
        if (senderId.toString() === recipient._id.toString()) {
            return res.redirect('/follows');
        }

        // Check if sender already in follows of recipient - error
        const existingFollow = recipient.followers.some(follow => follow.user.equals(senderId));
        if (existingFollow) {
            return res.redirect('/follows');
        }

        // Add sender to follows of recipient
        recipient.followers.push({ user: senderId, followedOn: new Date(), new: true });
        await recipient.save();

        // Add recipient to sender's following array
        sender.following.push({ user: recipient._id, followedOn: new Date() });
        await sender.save();

        const sentFollow = recipient.followers;

        console.log('adding followr', sentFollow)   

        return res.redirect('/follows');
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET followers page
exports.all_follows = expressAsyncHandler(async (req, res) => {
    const token = req.cookies.token;

    try {

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        const user = await User.findById(userId)
        .populate('followers.user', 'username')
        .populate('following.user', 'username')
        .exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const allUsers = await User.find({})

        if (!allUsers) {
            return res.status(404).json({ message: 'Unable to fetch user directoy' });
        }


        // render the follower page with user object
        res.render('directory', { title: 'Directory', user, allUsers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST user unfollow
exports.un_follow = expressAsyncHandler(async (req, res) => {
    const token = req.cookies.token;

    const { username } = req.params;

    try {

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const followerId = decodedToken.userId;

        const follower = await User.findById(followerId)
        .populate('followers.user', 'username')
        .populate('following.user', 'username')
        .exec();

        if (!follower) {
            return res.status(404).json({ message: 'Followed user not found' });
        }

        const followed = await User.findOne({ username }).exec();

        if (!followed) {
            return res.status(404).json({ message: 'followed not found' });
        }

        const followedId = followed._id;

        await User.updateOne(
            { _id: followerId },
            { $pull: { following: { user: followedId } } }
        );

        await User.updateOne(
            { username },
            { $pull: { followers: { user: followerId } } }
        );

        // render the follower page with updated user objects
        res.redirect('/follows');
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

