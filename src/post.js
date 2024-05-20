// Post controller module - post.js

const expressAsyncHandler = require("express-async-handler");
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary');
const fs = require('fs');


// const { io } = require('./socket')

const { checkAuth } = require('./auth')
const { connectMongo, User, Post, Chat } = require('./mongo')

// GET posts for feed
exports.all_posts = expressAsyncHandler(async (req, res) => {

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get all posts
        const posts = await Post.find({ public: true })
            .populate({
                path: 'author',
                select: 'username'
            })
            .populate({
                path: 'comments.user',
                select: 'username'
            });

        return res.status(201).json({ message: 'Posts retreived', posts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

exports.following_posts = expressAsyncHandler(async (req, res) => {

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get all posts
        const posts = await Post.find({ 'author': { $in: user.following.map(f => f.user) } })
        .populate({
            path: 'author',
            select: 'username'
        })
        .populate({
            path: 'comments.user',
            select: 'username'
        });
        
        return res.status(201).json({ message: 'Posts retreived', posts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});
// GET user's posts
exports.user_posts = expressAsyncHandler(async (req, res) => {
    const username = req.params.username;
    // get user object and pass to profile on render

    try {
        const user = await User.findOne({ username }).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // get all Posts from DB that are authored by user
        const posts = await Post.find({ author: user._id })
        .populate({
            path: 'author',
            select: 'username'
        })
        .populate({
            path: 'comments.user',
            select: 'username'
        });

        return res.status(200).json({ message: 'Posts retrieved', posts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET spec post
exports.spec_post = expressAsyncHandler(async (req, res) => {
    const { username, id } = req.params;

    try {

        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        const authedUser = await User.findById(userId).exec();

        console.log(userId, 'is getting post', id);
        
        const user = await User.findOne({ username }).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const post = await Post.findById(id)
        .populate({
            path: 'author',
            select: 'username'
        })
        .populate({
            path: 'comments.user',
            select: 'username'
        });

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        console.log('Authed user, Post & user:', authedUser, post, user)
        res.render('post', { message: 'Post retrieved', user, post, authedUser });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST a new post
exports.new_post = expressAsyncHandler(async (req, res) => {

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ errorMessage: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ errorMessage: 'User not found' });
        }
        
        let imageUrl = '';

        if (req.body.text || req.file) { 
            if (req.file) {
                const uploadResult = await cloudinary.uploader.upload(req.file.path);
                console.log('Cloudinary upload result:', uploadResult); 
                
                if (!uploadResult || uploadResult.error) {
                    throw new Error('Error uploading file to Cloudinary');
                }

                imageUrl = uploadResult.secure_url;

                fs.unlinkSync(req.file.path);
            }

        const { text, tags, privacy } = req.body;

        const newPost = new Post({
            author: user._id,
            timestamp: new Date().toISOString(),
            content: [{ text: text, imageUrl: imageUrl }],
            tags: tags,
            public: privacy,
            likes: [],
            comments: []
        });

        console.log(('Saving post:', newPost))
        await newPost.save();


        res.redirect('/dashboard');
        } else {
            throw new Error('No text content or file uploaded');
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ errorMessage: 'Error: Please make sure you are including an image or text content and select visibilty in order to post.' });
    }
});

// GET post editor
exports.edit_post = expressAsyncHandler(async (req, res) => {
    const { username, id } = req.params;

    try {
        console.log('Trying to find post', id);
        
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.username !== username) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        const post = await Post.findById(id).populate('author', 'username');
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        console.log('Post & user:', post, user)
        res.render('edit-post', { title: 'Edit Post', user, post });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST edits to post
exports.update_post  = expressAsyncHandler(async (req, res) => {
    const { username, id } = req.params;
    let { text, imageUrl, tags } = req.body;

    try {
        const token = req.cookies.token;

        console.log('logging post edit', req.body.content, req.body.tags)
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const postId = req.params.id;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: You are not allowed to edit this post' });
        }

        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path);
            console.log('Cloudinary upload result:', uploadResult);

            if (!uploadResult || uploadResult.error) {
                throw new Error('Error uploading file to Cloudinary');
            }

            const updatedImageUrl = uploadResult.secure_url;

            fs.unlinkSync(req.file.path);

            // Update imageUrl in the database
            await Post.findByIdAndUpdate(
                postId,
                { 'content.0.imageUrl': updatedImageUrl },
                { new: true }
            );
        }
        
        // Update other fields in the database if necessary
        if (text || tags) {
            await Post.findByIdAndUpdate(
                postId,
                {
                    'content.0.text': text || post.content[0].text,
                    tags: tags ? tags.split(',').map(tag => tag.trim()) : post.tags
                },
                { new: true }
            );
        }
        
        // send user back to the post after saving changes
        return res.redirect(`/${user.username}/${postId}`);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST delete post
exports.delete_post  = expressAsyncHandler(async (req, res) => {

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const postId = req.params.id;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (post.author.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: You are not allowed to delete this post' });
          }

        await Post.findOneAndDelete({ _id: postId });
    
        // send user back to profile after saving changes
        return res.redirect(`/${user.username}`);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST like to post
exports.add_like  = expressAsyncHandler(async (req, res) => {

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const postId = req.params.id;

        const post = await Post.findById(postId)
        .populate({
            path: 'author',
            select: 'username'
        });

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const existingLikeIndex = post.likes.findIndex(like => like.user.toString() === userId);
        if (existingLikeIndex !== -1) {
            // Remove the existing like from the array
            post.likes.splice(existingLikeIndex, 1);
            await post.save();
            console.log('Like removed:', userId);
            return res.redirect(`/${post.author.username}/${postId}`)
        }

        post.likes.push({ user: userId, new: true });
        await post.save();
        console.log(('Saving like:', userId))

        res.redirect(`/${post.author.username}/${postId}`)
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST comment to post
exports.post_comment  = expressAsyncHandler(async (req, res) => {

    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        connectMongo()

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const postId = req.params.id;

        const post = await Post.findById(postId)
        .populate({
            path: 'author',
            select: 'username'
        });

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const { comment } = req.body;
       
        const newComment = {
            user: user._id,
            content: comment,
            createdAt: new Date().toISOString()
        };

        post.comments.push(newComment);
        await post.save();
        console.log(('Saving comment:', newComment))
        
        // io.emit('newComment', newComment)

        return res.redirect(`/${post.author.username}/${postId}`) 
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});
