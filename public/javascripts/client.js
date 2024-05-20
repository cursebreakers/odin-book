// Client side script engine

// get API health
async function pingApi() {
    try {
        const response = await fetch('/health');
        const apiHealth = await response.json();

        const apiHealthElement = document.getElementById('apiHealth');

       if (apiHealthElement) {
            apiHealthElement.innerHTML = `
                <p>server: ${apiHealth.details.server}</p>
                <p>database: ${apiHealth.details.mongoDB}</p>
                <p>socket.io: ${apiHealth.details.socketIO}</p>`;
        }

        console.log('API:', apiHealth.status);
        return apiHealth.status === 'GOOD';
    } catch (error) {
        console.error('Error checking API health:', error);
        return false;
    }
}

// get userData
async function getUserData() {
    try {
        const response = await fetch('/user', {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        return userData;
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

// get client data and emit to server
async function sendClientData(socket) {
    try {
        const userData = await getUserData();
        console.log('User data:', userData);
        
        // Trace client w/ cloudflare
        const clientResponse = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const clientData = await clientResponse.text();

        // Emit the client and user data to server
        socket.emit('userClient', { clientData, userData });
    } catch (error) {
        console.error('Error sending client data:', error);
    }
}

// function to get feed json
async function feedCommentListener() {
    console.log('Comment expansion enabled on feed...')

    try {
        
        const feedContainer = document.getElementById('feedTray');


        feedContainer.addEventListener('click', (event) => {
            const clickedElement = event.target;
            if (clickedElement.classList.contains('commenter')) {
                event.preventDefault();
                const feedPost = clickedElement.closest('.feedPost');
                const commentContainer = feedPost.querySelector('.commentContainer');             
                commentContainer.classList.toggle('expanded');
            }
        });

        console.log('attached successfully')

    } catch (error) {
        console.error('Error rendering feed:', error);
    }
}

async function profileListener() {
    console.log('Getting profile posts...')
    try {
       
        const feedContainer = document.getElementById('profileFeed');

        feedContainer.addEventListener('click', (event) => {
            const clickedElement = event.target;
            if (clickedElement.classList.contains('commenter')) {
                event.preventDefault();
                const feedPost = clickedElement.closest('.feedPost');
                const commentContainer = feedPost.querySelector('.commentContainer');
                commentContainer.classList.toggle('expanded');
            }
        });

        console.log('attached successfully')

    } catch (error) {
        console.error('Error fetching posts:', error);
    }
}

// attach comment listener single post view
async function postCommentListener() {
    console.log('Attaching post viewer listeners...')
    try {
        const feedContainer = document.getElementById('singlePost');
        const feedPosts = feedContainer.querySelectorAll('.feedPost');

        feedPosts.forEach(feedPost => {
            const commentContainer = feedPost.querySelector('.commentContainer');
            commentContainer.classList.add('expanded');
        });

        console.log('Comments expanded successfully');

    } catch (error) {
        console.error('Error expanding comments', error);
    }
}

async function noteListener() {
// Listen for page load of notifications
    console.log('Notifications loaded')
}

async function chatListener(threadId, socket) {

    const userData = await getUserData();

    const senderName = userData.username;

    try {
        console.log('Chat loaded by', senderName, 'Listening for thread:', threadId);

        // Join the room corresponding to the thread ID
        socket.emit('chatRoom', threadId);

        // Listen for new messages in the specific thread room
        socket.on('newMessage', (message, senderName) => {
            console.log('New message in thread:', message);
            console.log('Refreshing chat...');
            window.location.reload();
            
        });

        // Add event listener for sending messages via the chat form
        const chatForm = document.querySelector('#chatForm');
        const messageInput = document.querySelector('#messageInput');


        chatForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const message = messageInput.value.trim();
            if (message) {
                // Send the message via API POST request
                try {
                    const response = await fetch(`/thread/${threadId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message }),
                    });

                    console.log('message posted to API')
                    sendMessage(socket, message, senderName)

                    if (!response.ok) {
                        throw new Error('Failed to send message');
                    }

                } catch (error) {
                    console.error('Error sending message via API:', error);
                }
            }
        });

        console.log('Chat listener attached successfully');
    } catch (error) {
        console.error('Error attaching chat listener:', error);
    }
}

async function sendMessage(socket, message, senderName) {
    const chatForm = document.querySelector('#chatForm');
    const messageInput = document.querySelector('#messageInput');

    try {

        socket.emit('sendMessage', message, senderName);
        messageInput.value = '';

    } catch (error) {
        console.error('Error sending message:', error);
    }
}


// DOM content loaded:
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Optional API health check
        const apiCheck = await pingApi()

        const socket = io();

        // Event listener for 'connect' event
        socket.on('connect', () => {
            console.log('Connected to Socket.IO');
            sendClientData(socket);
        });

        // Create event listener for 'broadcast' events
        socket.on('broadcast', (data) => {
            console.log('Received broadcast:', data);

            const userTicker = document.getElementById('userTicker')

            if (userTicker) {

            userTicker.innerHTML = `
                <p>Online: ${data.activeSockets}</p>
                <div id="activeUsersListDiv"></div>
            `;
            
            const activeUsersListDiv = document.getElementById('activeUsersListDiv');
            activeUsersListDiv.innerHTML = '';

            const ul = document.createElement('ul');
            data.activeUsers.forEach(user => {
                const li = document.createElement('li');
                li.textContent = user;
                ul.appendChild(li);
            });

            activeUsersListDiv.appendChild(ul);

            }

        });

        // attach listeners to comment sections (based on page type)
        if (window.location.pathname === '/dashboard') {

            // Comment expansion on feed
            feedCommentListener()
        }

        if (window.location.pathname === '/dashboard/follows') {

            // Comment expansion on feed/follows
            feedCommentListener()
        }
        
        if (document.getElementById('profileDiv')) {

            // Comment expansion on profile
            profileListener();
        }

        if (document.getElementById('singlePost')) {

            // Comment expansion on single post
            postCommentListener();
        }

        if (document.getElementById('noteTray')) {

            // Comment expansion on single post
            noteListener();
        }

        const chatContainer = document.getElementById('chat');

        if (chatContainer) {
            const chatTray = document.getElementById('chatTray');
            const threadId = window.location.pathname.split('/').pop();
            
            chatListener(threadId, socket);

            window.scrollTo(0, document.body.scrollHeight);

        }
        // Return socket for use in dashboard
        return { socket };
    } catch (error) {
        console.error('Error during initialization:', error);
        // Handle error or fallback behavior
    }
});