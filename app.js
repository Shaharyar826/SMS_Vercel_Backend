const express = require('express');
const app = express();
const uploadRoutes = require('./routes/upload.routes');
const eventsPageContentRoutes = require('./routes/eventsPageContent.routes');

// Mount routes
app.use('/api/upload', uploadRoutes);
app.use('/api/events-page-content', eventsPageContentRoutes);

// ... existing code ... 