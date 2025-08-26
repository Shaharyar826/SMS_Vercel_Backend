const AdminStaff = require('../models/AdminStaff');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get all admin staff
// @route   GET /api/admin-staff
// @access  Private
exports.getAdminStaff = async (req, res) => {
  try {
    let adminStaff = await AdminStaff.find().populate({
      path: 'user',
      select: 'name email role profileImage isApproved status'
    });

    // Filter out admin staff whose users are not approved or inactive
    adminStaff = adminStaff.filter(staff =>
      staff.user && staff.user.isApproved && staff.user.status === 'active'
    );

    res.status(200).json({
      success: true,
      count: adminStaff.length,
      data: adminStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single admin staff
// @route   GET /api/admin-staff/:id
// @access  Private
exports.getAdminStaffMember = async (req, res) => {
  try {
    const adminStaff = await AdminStaff.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email role profileImage'
      })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    if (!adminStaff) {
      return res.status(404).json({
        success: false,
        message: `No admin staff found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: adminStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create admin staff
// @route   POST /api/admin-staff
// @access  Private/Admin
exports.createAdminStaff = async (req, res) => {
  try {
    const { userData, adminStaffData } = req.body;

    // Check if profile image is provided
    if (!userData.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture is required'
      });
    }

    // First create a user with appropriate role and auto-approve
    // Use the provided role or default to 'admin'
    userData.role = userData.role || 'admin';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await User.create(userData);

    // Then create admin staff profile with user reference
    adminStaffData.user = user._id;
    const adminStaff = await AdminStaff.create(adminStaffData);

    res.status(201).json({
      success: true,
      data: {
        adminStaff,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update admin staff
// @route   PUT /api/admin-staff/:id
// @access  Private/Admin
exports.updateAdminStaff = async (req, res) => {
  try {
    const { userData, adminStaffData } = req.body;
    let updatedData = {};

    // Update admin staff data if provided
    if (adminStaffData) {
      const adminStaff = await AdminStaff.findByIdAndUpdate(
        req.params.id,
        adminStaffData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!adminStaff) {
        return res.status(404).json({
          success: false,
          message: `No admin staff found with id ${req.params.id}`
        });
      }

      updatedData.adminStaff = adminStaff;
    }

    // Update user data if provided
    if (userData) {
      const adminStaff = await AdminStaff.findById(req.params.id);

      if (!adminStaff) {
        return res.status(404).json({
          success: false,
          message: `No admin staff found with id ${req.params.id}`
        });
      }

      const user = await User.findByIdAndUpdate(
        adminStaff.user,
        userData,
        {
          new: true,
          runValidators: true
        }
      );

      updatedData.user = user;
    }

    res.status(200).json({
      success: true,
      data: updatedData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete admin staff
// @route   DELETE /api/admin-staff/:id
// @access  Private/Admin
exports.deleteAdminStaff = async (req, res) => {
  try {
    const adminStaff = await AdminStaff.findById(req.params.id);

    if (!adminStaff) {
      return res.status(404).json({
        success: false,
        message: `No admin staff found with id ${req.params.id}`
      });
    }

    // Get user ID before deleting admin staff
    const userId = adminStaff.user;

    // Delete admin staff
    await adminStaff.deleteOne();

    // Delete associated user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get admin staff profile for logged in user
// @route   GET /api/admin-staff/profile
// @access  Private/Admin,Principal
exports.getAdminStaffProfile = async (req, res) => {
  try {
    // Find admin staff profile for the logged in user
    const adminStaff = await AdminStaff.findOne({ user: req.user.id })
      .populate({
        path: 'user',
        select: 'firstName middleName lastName name email role profileImage'
      });

    if (!adminStaff) {
      return res.status(404).json({
        success: false,
        message: 'No admin staff profile found for this user'
      });
    }

    res.status(200).json({
      success: true,
      data: adminStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update admin staff profile for logged in user
// @route   PUT /api/admin-staff/profile
// @access  Private/Admin,Principal
exports.updateAdminStaffProfile = async (req, res) => {
  try {
    const { userData, adminStaffData } = req.body;
    let updatedData = {};

    // Find admin staff profile for the logged in user
    let adminStaff = await AdminStaff.findOne({ user: req.user.id });

    // If admin staff profile doesn't exist, create one
    if (!adminStaff) {
      // Create a new admin staff profile
      adminStaffData.user = req.user.id;
      adminStaff = await AdminStaff.create(adminStaffData);
      updatedData.adminStaff = adminStaff;
    } else {
      // Update existing admin staff profile
      adminStaff = await AdminStaff.findByIdAndUpdate(
        adminStaff._id,
        adminStaffData,
        {
          new: true,
          runValidators: true
        }
      );
      updatedData.adminStaff = adminStaff;
    }

    // Update user data if provided
    if (userData) {
      // Prevent updating role or other sensitive fields
      const allowedFields = ['firstName', 'middleName', 'lastName', 'email', 'profileImage'];

      const filteredUserData = {};

      // Only include allowed fields
      Object.keys(userData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUserData[key] = userData[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user.id,
        filteredUserData,
        {
          new: true,
          runValidators: true
        }
      );

      updatedData.user = user;
    }

    res.status(200).json({
      success: true,
      data: updatedData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
