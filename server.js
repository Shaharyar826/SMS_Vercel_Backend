const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Environment variables loaded
console.log('Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 5000);

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet()); // Set security headers
app.use(compression()); // Compress responses

// Rate limiting - more lenient in development
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Much higher limit in development
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    if (process.env.NODE_ENV !== 'production' &&
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.includes('localhost'))) {
      return true;
    }
    return false;
  }
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Explicitly allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'https://schoollms.loca.lt',
      'https://schoolpro-chi.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow Vercel preview deployments for this project
    if (/^https:\/\/schoolpro-chi-.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // Allow ngrok and localtunnel domains during testing
    if (
      origin.includes('ngrok-free.app') ||
      origin.includes('ngrok.io') ||
      origin.includes('loca.lt')
    ) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In non-production, allow all origins to ease local development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Otherwise, reject
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'ngrok-skip-browser-warning'
  ]
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Standard middleware
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));

// Note: Local uploads directory creation removed - using Cloudinary for all image storage

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const teacherRoutes = require('./routes/teacher.routes');
const studentRoutes = require('./routes/student.routes');
const supportStaffRoutes = require('./routes/supportStaff.routes');
const adminStaffRoutes = require('./routes/adminStaff.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const feeRoutes = require('./routes/fee.routes');
const feeReceiptRoutes = require('./routes/fee-receipt.routes');
const salaryRoutes = require('./routes/salary.routes');
const noticeRoutes = require('./routes/notice.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const filterRoutes = require('./routes/filter.routes');
const systemRoutes = require('./routes/system.routes');
const uploadRoutes = require('./routes/upload.routes');
const profileImageRoutes = require('./routes/profileImage.routes');
const passwordResetRoutes = require('./routes/passwordReset.routes');
const meetingRoutes = require('./routes/meeting.routes');
const notificationRoutes = require('./routes/notification.routes');
const historyRoutes = require('./routes/history.routes');
const publicRoutes = require('./routes/public.routes');
const schoolSettingsRoutes = require('./routes/schoolSettings.routes');
const landingPageRoutes = require('./routes/landingPage.routes');
const contactRoutes = require('./routes/contact.routes');
const pageContentRoutes = require('./routes/pageContent.routes');
const galleryRoutes = require('./routes/gallery.routes');
const eventsPageContentRoutes = require('./routes/eventsPageContent.routes');

// Define API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/support-staff', supportStaffRoutes);
app.use('/api/admin-staff', adminStaffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/fee-receipts', feeReceiptRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/events-notices', noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/profile-image', profileImageRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/school-settings', schoolSettingsRoutes);
app.use('/api/landing-page', landingPageRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/page-content', pageContentRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/events-page-content', eventsPageContentRoutes);


// Health check endpoint to verify DB connectivity
app.get('/api/health', (_req, res) => {
  const state = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
  res.json({ ok: true, dbConnected: state === 1, dbState: state });
});

// Note: Static file serving for uploads removed - all images now served from Cloudinary

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));

  // Add a proper catchall route for SPA
  app.use((req, res, next) => {
    // Skip API routes
    if (req.url.startsWith('/api')) {
      return next();
    }
    // Send the React app's index.html for all other routes
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Error handling middleware
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// MongoDB connection with caching for serverless environments
let isDbConnected = false;
const connectDB = async () => {
  try {
    // Already connected
    if (isDbConnected || mongoose.connection.readyState === 1) return;

    // If already connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve, reject) => {
        mongoose.connection.once('connected', () => {
          isDbConnected = true;
          resolve();
        });
        mongoose.connection.once('error', reject);
      });
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      family: 4
    });

    isDbConnected = true;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

// Import seeder
const { createDefaultAccounts } = require('./utils/seeder');

// Connect to database once per cold start
connectDB()
  .then(() => createDefaultAccounts())
  .catch((e) => {
    console.error('Initial DB connection failed:', e.message);
  });

// Export the Express app for serverless platforms (e.g., Vercel)
module.exports = app;

// Start the server only when this file is executed directly (not when imported)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.error('=== UNHANDLED PROMISE REJECTION ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    console.error('Promise:', promise);
    console.error('NODE_ENV:', process.env.NODE_ENV);

    // In development, don't exit the process to allow for debugging
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      console.error('Server continuing in development mode...');
      return;
    }

    // In production, gracefully close server and exit
    console.error('Shutting down server due to unhandled promise rejection...');
    server.close(() => {
      console.error('Server closed. Exiting process...');
      process.exit(1);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('=== UNCAUGHT EXCEPTION ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    console.error('NODE_ENV:', process.env.NODE_ENV);

    // In development, don't exit the process
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      console.error('Server continuing in development mode...');
      return;
    }

    // In production, exit immediately
    console.error('Shutting down server due to uncaught exception...');
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('=== SIGTERM RECEIVED ===');
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('=== SIGINT RECEIVED ===');
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
}
