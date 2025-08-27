// Vercel serverless entry point: export the Express app
// We import the app from server.js (which only starts a server when run directly)
const app = require('./server');
module.exports = app;