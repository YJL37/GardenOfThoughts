# Little Garden 🌱🌸 — MongoDB edition

## What is included
- Existing cute public/private notes interface
- Node.js + Express backend and MongoDB Atlas storage
- Signup/login with bcrypt password hashes
- HTTP-only session cookies stored in MongoDB
- Server-side admin role, replies, and delete action
- Private-note access checked by the server

## Setup
1. Install Node.js 20 or newer.
2. Create a MongoDB Atlas cluster and database user. Allow your IP in Atlas Network Access.
3. Open a terminal in this folder and run `npm install`.
4. Copy `.env.example` to `.env`.
5. Replace `MONGODB_URI` with your Atlas connection string. URL-encode special characters in the database password.
6. Generate a session secret:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   Paste it into `SESSION_SECRET`.
7. Generate an admin password hash (replace the example password with your own):
   `node -e "require('bcryptjs').hash('your-strong-password',12).then(console.log)"`
   Paste the resulting hash into `ADMIN_PASSWORD_HASH`. Set `ADMIN_USERNAME` as desired.
8. Run `npm start`, then open `http://localhost:3000`.

## Important
- Admin is seeded on server startup. The admin password is the password you hashed for `ADMIN_PASSWORD_HASH`.
- Ordinary signups cannot assign themselves the admin role.
- Never publish `.env` or put MongoDB credentials in frontend JavaScript.
- For production, use HTTPS and set `NODE_ENV=production`; the session cookie will then be secure-only.
- This is a starter project, not a security audit. Test permissions before using real or sensitive messages. Add a privacy notice, backups, abuse controls and retention policies before public launch.
# GardenOfThoughts
