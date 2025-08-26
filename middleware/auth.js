const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    console.log('Authentication failed: No token provided');
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in.'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user
    const user = await User.findById(decoded.id);

    // Check if user exists
    if (!user) {
      console.log(`Authentication failed: User with ID ${decoded.id} not found`);
      return res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.'
      });
    }

    // Check if user is approved and active
    if (!user.isApproved && !user.isSystemAccount) {
      console.log(`Authentication failed: User ${user._id} is not approved`);
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please contact an administrator.'
      });
    }

    if (user.status === 'inactive') {
      console.log(`Authentication failed: User ${user._id} is inactive`);
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact an administrator.'
      });
    }

    // Set user in request
    req.user = user;

    next();
  } catch (err) {
    console.error('Authentication error:', err.message);

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.'
      });
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in again.'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user object exists
    if (!req.user) {
      console.log('Authorization failed: No user object in request');
      return res.status(500).json({
        success: false,
        message: 'Server error: User not authenticated properly'
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      console.log(`Authorization failed: User ${req.user._id} with role ${req.user.role} attempted to access route restricted to ${roles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: `Access denied. This route requires ${roles.length > 1 ? 'one of these roles' : 'the role'}: ${roles.join(', ')}`
      });
    }

    // User has required role, proceed
    console.log(`User ${req.user._id} with role ${req.user.role} authorized to access route`);
    next();
  };
};
