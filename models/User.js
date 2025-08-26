const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const cloudinaryImageSchema = {
  url: String,
  metadata: {
    folder: String,
    format: String,
    resourceType: String,
    publicId: String,
    createdAt: Date
  }
};

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
    trim: true,
    maxlength: [30, 'First name cannot be more than 30 characters']
  },
  middleName: {
    type: String,
    trim: true,
    maxlength: [30, 'Middle name cannot be more than 30 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
    trim: true,
    maxlength: [30, 'Last name cannot be more than 30 characters']
  },
  name: {
    type: String,
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'principal', 'vice-principal', 'teacher', 'student', 'accountant'],
    default: 'student'
  },
  status: {
    type: String,
    enum: ['active', 'on hold', 'inactive'],
    default: 'on hold'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  profileImage: cloudinaryImageSchema,
  createdAt: {
    type: Date,
    default: Date.now
  },
  isSystemAccount: {
    type: Boolean,
    default: false
  },
  passwordResetRequired: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
});

// Generate full name from first, middle, and last name
UserSchema.pre('save', function(next) {
  // Always ensure name is set correctly, even if firstName/lastName haven't been modified
  // This ensures bulk uploads and other creation methods always have a proper name field
  let fullName = this.firstName || '';

  if (this.middleName && this.middleName.trim() !== '') {
    fullName += ' ' + this.middleName;
  }

  if (this.lastName) {
    fullName += ' ' + this.lastName;
  }

  // Trim any extra spaces and set the name
  this.name = fullName.trim();

  next();
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Delete Cloudinary profile image before removing user
UserSchema.pre('remove', async function(next) {
  try {
    if (this.profileImage?.metadata?.publicId) {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(this.profileImage.metadata.publicId);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to reset a user's password
UserSchema.statics.resetPassword = async function(userId, newPassword) {
  try {
    // Find the user
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password directly in the database to bypass pre-save hooks
    // Also set the passwordResetRequired flag to true
    await this.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordResetRequired: true
    });

    return { success: true, message: 'Password reset successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);
