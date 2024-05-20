// Authentication and userbase management module - auth.js

const expressAsyncHandler = require("express-async-handler");
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const validator = require('validator');
const cloudinary = require('cloudinary');
const fs = require('fs');

const { connectMongo, User, Post } = require('./mongo')

const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
};
  
const jwtStrategy = new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);
      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err, false);
    }
});

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '4h' });
};

exports.checkAuth = (req, res, next) => {
    const token = req.cookies.token;
  
    if (!token) {
        return res.redirect('/auth');
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next(); 
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.redirect('/auth');
        } else {
            console.error(err);
            return res.status(500).json({ message: 'Internal Server Error' });
        }
    }
};
  
// GET login form
exports.auth_form = expressAsyncHandler( async (req, res) => {
    console.log('getting login form...')
    res.render('auth', { title: 'Log In' });
});

// POST user login
exports.auth_post = expressAsyncHandler( async (req, res) => {
    console.log('posting user authentication...')

    try {
        const { username, password } = req.body;

        if (req.user) {
            return res.status(400).json({ message: 'User is already authenticated.' });
        }

        // Server-side checks and validations (production)

        // Find the user in the database by username
        connectMongo()

        const user = await User.findOne({ username });

        // Check if the user exists and if the password matches
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('auth', { title: 'Log In', errors: [{ message: 'Invalid username or password.' }] });
        }

        // Generate JWT token
        const token = generateToken(user._id);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict', 
        });

        // Return status, token, and user object in json response
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error in auth_post:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET signup form
exports.signup_form = expressAsyncHandler( async (req, res) => {
    console.log('getting signup form...')
    res.render('signup', { title: 'Sign Up' });
});

// POST new user signup and log in
exports.signup_post = expressAsyncHandler( async (req, res) => {
    console.log('posting user signup...')

    try {
        const errors = [];

        connectMongo()
        // Check if username is valid (only letters and numbers allowed)
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(req.body.username)) {
            errors.push({ message: 'Username can only contain letters and numbers.' });
        }
        // check databse to make sure username does not already exist
        const existingUser = await User.findOne({ username: req.body.username });
        if (existingUser) {
            errors.push({ message: 'Username already exists. Please choose a different username.' });
        }
        // Check if password is at least 8 characters long
        if (!req.body.password || req.body.password.length < 8) {
            errors.push({ message: 'Password must be at least 8 characters long.' });
        }
        // Check if passwords match
        if (req.body.password !== req.body.confirmPassword) {
            errors.push({ message: 'Passwords do not match.' });
        }
        // If there are errors, return 400 status with error messages
        if (errors.length > 0) {
            res.render('signup', { title: 'Sign up', errors });
        }
        // Hash and salt password for security
        const hashedPassword = await bcrypt.hash(req.body.password, 12);

        // Create the new user and save to DB
        const newUser = new User({
            username: req.body.username,
            password: hashedPassword,
            status: "Hello, World!",
            avatar: "./images/bit-brkr.png",
        });
        
        await newUser.save();

        // Log the user in by creating a JWT token
        const token = generateToken(newUser._id);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict', 
        });

        // Render dashboard with user data
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error in signup_post:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST user log out
exports.auth_out = (req, res) => {
    res.clearCookie('token', { httpOnly: true });
    res.render('out', { title: 'Logged out.'})
};

// GET user data
exports.user_data = expressAsyncHandler(async (req, res) => {

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

        res.status(200).json({ user });        
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET user settings
exports.user_account = expressAsyncHandler(async (req, res) => {

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

        res.render('settings', {title: user.username, user})        

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST updates to account
exports.post_account = expressAsyncHandler(async (req, res) => {

    const { status, bio } = req.body;

    try {

        console.log('req.file:', req.file);

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

        if (status) {
            user.status = status;
        }
        if (bio) {
            user.bio = bio;
        }

        if (req.file) { // Check if avatar is uploaded as a file
    
            // Upload avatar image to Cloudinary
            const uploadResult = await cloudinary.uploader.upload(req.file.path);
            console.log('Cloudinary upload result:', uploadResult); 
      
            // Save the avatar URL to the user object
            user.avatar = uploadResult.secure_url;
      
            // Delete the temporary file from the server
            fs.unlinkSync(req.file.path);
        }  

        // Save the updated user object in the database
        await user.save();

        // re-renders the settings page with changes
        res.redirect('/settings',)        
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});