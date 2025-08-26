const User = require('../models/User');
const Teacher = require('../models/Teacher');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { firstName, middleName, lastName, email, password, role, subjects, classes, profileImage } = req.body;

  // Check if profile image is provided
  if (!profileImage) {
    return res.status(400).json({
      success: false,
      message: 'Profile picture is required'
    });
  }

  // Check if role is admin or principal
  if (role === 'admin' || role === 'principal') {
    return res.status(403).json({
      success: false,
      message: 'Cannot register with admin or principal role directly'
    });
  }

  // For teachers, generate the email in the required format
  if (role === 'teacher') {
    // Generate teacher email
    const cleanFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let generatedEmail = `tch${cleanFirstName}${cleanLastName}@schoolms.com`;

    // Check if the email already exists
    const existingUser = await User.findOne({ email: generatedEmail });
    if (existingUser) {
      // If email exists, modify it to make it unique by adding a number
      let counter = 1;
      let newEmail = generatedEmail;

      // Extract the base part of the email (before @)
      const emailParts = generatedEmail.split('@');
      const basePart = emailParts[0];
      const domainPart = emailParts[1];

      // Try adding numbers until we find a unique email
      while (await User.findOne({ email: newEmail })) {
        newEmail = `${basePart}${counter}@${domainPart}`;
        counter++;
      }

      generatedEmail = newEmail;
    }

    // Override the provided email with the generated one
    email = generatedEmail;
  }

  // For students, generate the email in the required format
  if (role === 'student') {
    // Generate student email
    const cleanFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let generatedEmail = `std${cleanFirstName}${cleanLastName}@schoolms.com`;

    // Check if the email already exists
    const existingUser = await User.findOne({ email: generatedEmail });
    if (existingUser) {
      // If email exists, modify it to make it unique by adding a number
      let counter = 1;
      let newEmail = generatedEmail;

      // Extract the base part of the email (before @)
      const emailParts = generatedEmail.split('@');
      const basePart = emailParts[0];
      const domainPart = emailParts[1];

      // Try adding numbers until we find a unique email
      while (await User.findOne({ email: newEmail })) {
        newEmail = `${basePart}${counter}@${domainPart}`;
        counter++;
      }

      generatedEmail = newEmail;
    }

    // Override the provided email with the generated one
    email = generatedEmail;
  }

  // Create user with Cloudinary profile image if provided
  const userData = {
    firstName,
    middleName,
    lastName,
    email,
    password,
    role,
    status: 'active',
    isApproved: true,
    approvedAt: Date.now()
  };

  if (req.cloudinaryUrl) {
    userData.profileImage = {
      url: req.cloudinaryUrl,
      metadata: {
        ...req.cloudinaryMetadata,
        publicId: req.cloudinaryPublicId
      }
    };
  }

  const user = await User.create(userData);

  // If role is teacher, create a preliminary teacher profile with subjects and classes
  if (role === 'teacher' && subjects && classes && subjects.length > 0 && classes.length > 0) {
    // Generate a unique employee ID
    const teacherCount = await Teacher.countDocuments();
    const currentYear = new Date().getFullYear().toString().substr(-2); // Get last 2 digits of year
    const employeeId = `TCH${currentYear}${(teacherCount + 1).toString().padStart(4, '0')}`;

    // Create a basic teacher profile with the provided subjects and classes
    await Teacher.create({
      user: user._id,
      subjects,
      classes,
      // Set auto-generated ID and temporary values for required fields that will be updated later
      employeeId,
      dateOfBirth: new Date(),
      gender: 'other',
      phoneNumber: 'Not provided',
      qualification: 'Not provided',
      experience: 0,
      salary: 0,
      isActive: false
    });
  }

  // Return success with token since account is automatically approved
  const token = user.getSignedJwtToken();

  res.status(201).json({
    success: true,
    message: 'Registration successful! Your account has been automatically approved.',
    token,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if account is approved
  if (!user.isApproved && !user.isSystemAccount) {
    return next(new ErrorResponse('Your account is on hold. Awaiting approval from Admin/Principal.', 403));
  }

  // Check if account is active
  if (user.status === 'inactive') {
    return next(new ErrorResponse('Your account has been deactivated. Please contact the administrator.', 403));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    // User not found
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if user is approved and active
  if (!user.isApproved && !user.isSystemAccount) {
    // User is not approved
    return res.status(403).json({
      success: false,
      message: 'Your account is pending approval. Please contact an administrator.'
    });
  }

  if (user.status === 'inactive') {
    // User is inactive
    return res.status(403).json({
      success: false,
      message: 'Your account is inactive. Please contact an administrator.'
    });
  }

  // Successfully retrieved user profile
  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get pending account approvals
// @route   GET /api/auth/pending-approvals
// @access  Private/Admin,Principal
exports.getPendingApprovals = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      isApproved: false,
      status: 'on hold',
      isSystemAccount: { $ne: true }
    });

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Approve user account
// @route   PUT /api/auth/approve/:id
// @access  Private/Admin,Principal
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'User is already approved'
      });
    }

    user.isApproved = true;
    user.status = 'active';
    user.approvedBy = req.user.id;
    user.approvedAt = Date.now();

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User account approved successfully',
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Reject user account
// @route   PUT /api/auth/reject/:id
// @access  Private/Admin,Principal
exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.status = 'inactive';

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User account rejected',
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    firstName: req.body.firstName,
    middleName: req.body.middleName,
    lastName: req.body.lastName,
    email: req.body.email
  };

  // If there's a new image uploaded via Cloudinary
  if (req.cloudinaryUrl) {
    fieldsToUpdate.profileImage = {
      url: req.cloudinaryUrl,
      metadata: {
        ...req.cloudinaryMetadata,
        publicId: req.cloudinaryPublicId
      }
    };
  }

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// Password reset functionality has been moved to passwordReset.controller.js

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token
    });
};
