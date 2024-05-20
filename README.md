# Odin-book

v0.0.9 (cloudmin9)

Live @[Glitch.com](/)

[GitHub Repo](/)

## Overview

*Social Media Platform*
- Browse, create and comment on posts
- Link with other users to send messages and post/comment privately

---

### How it works:

*Sign up & Authentication*

Go [home](/).

[Log in](/auth) or [make an account](/auth/new) if you are a new user.

*Edit Profile:*

Go to [settings](/settings).

Edit your info, post a new status or upload a new avatar.

Click "save" to confirm your changes.

*Messages:*

Go to the [profile](/esau) of the user you'd like to message.

Click "message" to begin a conversation thread.

Go to [inbox](/inbox) to see all fo your conversations.

*Feed, Posts & Comments:*

Go to [feed](/dashboard).

Type your post and/or upload an image.
- Add hashtags
- Select visibility:
  - Public: Will be seen in the public feed.
  - Followers: Only visible in the Following feed, if users follow you.
- Click "post".

Click ["Following"](/dashboard/follows) to see posts from only users that you follow.

*Follow users:*

Go to the [profile](/esau) of the user you'd like to follow.

Click "follow" to see the user's posts in your "Following" feed.

You may also follow users from the [directory](/follows).

### Future Updates:

**v0.1.0+**

*Features:*

MMS/image attachments for messaging.

Socket implementations: *(live page updates)*
- Comments
- Notes and tickers

*Fixes:*

Messenger:
- incoming messages should not delete what a user is typing when they load.

Post Creator:
- renders 500 error page - fix to render errors in-app.

Post Editor:
- Users should be able to update post visibility

Directory:
- Follows/unfollow status properly reflected in directory controls

Notifications:
  - Render as groups instead of individual items.
  - Do not report new comments/replies on posts belonging to other users. 
  - Do not always report new likes or comments.

*Bugs and errors are intended to be resolved ASAP.*

*To contribute to this project:*
- [Send an email](mailto:hello@cursebreakers.net)

## Credits & Acknowledgements

### Built with:

- [Node.js](https://nodejs.org/en)
- [NPM](https://www.npmjs.com/)
- [Express](https://expressjs.com/)
- [Socket.io](https://socket.io/)
- [MongoDB](https://www.mongodb.com/)
- [Glitch.com](https://glitch.com)

### Author

- Esau [@Cursebreakers LLC](https://cursebreakers.net/)

### Coursework

- The Odin Project - [Full Stack JavaScript](https://www.theodinproject.com/lessons/nodejs-odin-book)