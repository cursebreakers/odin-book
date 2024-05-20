// Chat controller module - chat.js

const expressAsyncHandler = require("express-async-handler");
const jwt = require('jsonwebtoken');

const { checkAuth } = require('./auth')
const { connectMongo, User, Post, Chat } = require('./mongo')

// GET inbox
exports.get_inbox = expressAsyncHandler(async (req, res) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }   

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedToken.userId;

        console.log('Getting user inbox...', token, userId)        

        const user = await User.findById(userId).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const inbox = await Chat.find({ partyMembers: userId })
            .populate({
                path: 'partyMembers',
                select: 'username',
                model: 'User'
            })
            .exec();

        res.render('inbox', { title: 'Inbox', user, inbox });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST new chat thread
exports.new_chat = expressAsyncHandler(async (req, res) => {
    const { username } = req.params;
    const recipient = req.params.username;

    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }   

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const senderId = decodedToken.userId;

        connectMongo()

        // Find sender in database
        const sender = await User.findById(senderId).exec();

        if (!sender) {
            return res.status(404).json({ message: 'Sender not found' });
        }

        console.log('Creating chat with:', sender, 'and', recipient);

        // Find recipient in database
        const recipientUser = await User.findOne({ username: recipient }).exec();

        if (!recipientUser) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        // Check if existing chat between users already exists
        const existingChat = await Chat.findOne({
            partyMembers: { $all: [senderId, recipientUser._id] }
        }).exec();

        if (existingChat) {
            return res.redirect(`/thread/${existingChat._id}`);
        }


        // Create a new chat with both user IDs for party members
        const newChat = await Chat.create({
            partyMembers: [senderId, recipientUser._id],
            messageThread: []
        });

        console.log('Chat created:', newChat);

        // Render the chat view with appropriate data
        res.render('chat', { title: recipientUser.username, specChat: newChat, thisUser: sender, recipient: recipientUser });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET exisiting chat
exports.get_chat = expressAsyncHandler(async (req, res) => {
    // get userId from token username and chat ID from req parameters
    const { chatId } = req.params;

    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }   

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const thisUserId = decodedToken.userId;

        console.log('Getting chat id', chatId);        
        
        connectMongo()

        const specChat = await Chat.findById(chatId).populate({
            path: 'messageThread.user',
            select: 'username' 
        }).exec();

        if (!specChat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        console.log('Chat found:', specChat);

        // Check if thisUserId matches with any partyMember ID in the chat
        const thisUserIndex = specChat.partyMembers.findIndex(memberId => memberId.equals(thisUserId));
        if (thisUserIndex === -1) {
            return res.status(400).json({ message: 'You are not a member of this chat' });
        }

        // Determine the other partyMember ID
        const otherUserId = specChat.partyMembers[thisUserIndex === 0 ? 1 : 0];

        const thisUser = await User.findById(thisUserId).exec();
        const recipient = await User.findById(otherUserId).exec();;

        console.log('Users found:', thisUser, recipient);

        res.render('chat', { title: recipient.username, specChat, thisUser, recipient });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST new message to chat
exports.chat_post = expressAsyncHandler(async (req, res) => {
    // get userId from token username and chat ID from req parameters
    const { chatId } = req.params;
    const { message } = req.body;
    
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }   

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        const thisUserId = decodedToken.userId;

        console.log('Getting chat id', chatId);        
        
        connectMongo()

        const specChat = await Chat.findById(chatId).exec();

        if (!specChat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        console.log('Chat found:', specChat);

        // Check if thisUserId matches with any partyMember ID in the chat
        const thisUserIndex = specChat.partyMembers.findIndex(memberId => memberId.equals(thisUserId));
        if (thisUserIndex === -1) {
            return res.status(400).json({ message: 'You are not a member of this chat' });
        }

        // Determine the other partyMember ID
        const otherUserId = specChat.partyMembers[thisUserIndex === 0 ? 1 : 0];
        const thisUser = await User.findById(thisUserId).exec();
        const recipient = await User.findById(otherUserId).exec();

        // Check if message is present
        if (!message) {
            return res.status(400).json({ message: 'Message text is required' });
        }

        specChat.messageThread.push({ user: thisUserId, message });

        await specChat.save();

        res.redirect(`/thread/${specChat._id}`);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});
