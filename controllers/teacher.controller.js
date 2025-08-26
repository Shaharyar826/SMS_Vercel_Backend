const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private
exports.getTeachers = async (req, res) => {
  try {
    let teachers;

    // If user is a teacher, only return their own profile
    if (req.user.role === 'teacher') {
      teachers = await Teacher.find({ user: req.user.id }).populate({
        path: 'user',
        select: 'name email role profileImage isApproved status'
      });
    } else {
      // For admin, principal, and other roles, return only approved teachers
      teachers = await Teacher.find().populate({
        path: 'user',
        select: 'name email role profileImage isApproved status'
      });

      // Filter out teachers whose users are not approved or inactive
      teachers = teachers.filter(teacher =>
        teacher.user && teacher.user.isApproved && teacher.user.status === 'active'
      );
    }

    res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single teacher
// @route   GET /api/teachers/:id
// @access  Private
exports.getTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email role profileImage'
      })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: `No teacher found with id ${req.params.id}`
      });
    }

    // If user is a teacher, they can only view their own profile
    if (req.user.role === 'teacher' && teacher.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this teacher profile'
      });
    }

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get logged in teacher profile
// @route   GET /api/teachers/profile
// @access  Private/Teacher
exports.getTeacherProfile = async (req, res) => {
  try {
    // Log the request for debugging
    console.log(`Fetching teacher profile for user ID: ${req.user.id}, role: ${req.user.role}`);

    // Verify user role is teacher
    if (req.user.role !== 'teacher') {
      console.log(`User with ID ${req.user.id} has role ${req.user.role}, not 'teacher'`);
      return res.status(403).json({
        success: false,
        message: 'Only teachers can access this endpoint'
      });
    }

    // Find teacher profile for the logged in user
    let teacher = await Teacher.findOne({ user: req.user.id })
      .populate({
        path: 'user',
        select: 'name email role profileImage'
      })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    // If no teacher profile exists, create a default one
    if (!teacher) {
      console.log(`No teacher profile found for user ID: ${req.user.id}. Creating a default profile.`);

      try {
        // Generate a unique employee ID
        const teacherCount = await Teacher.countDocuments();
        const currentYear = new Date().getFullYear().toString().substr(-2); // Get last 2 digits of year
        const employeeId = `TCH${currentYear}${(teacherCount + 1).toString().padStart(4, '0')}`;

        // Create a default teacher profile
        const defaultTeacher = {
          user: req.user.id,
          employeeId, // Use the auto-generated ID
          dateOfBirth: new Date(),
          gender: 'other',
          phoneNumber: 'Not provided',
          qualification: 'Not provided',
          experience: 0,
          subjects: ['Not assigned'],
          classes: ['Not assigned'],
          salary: 0,
          isActive: true,
          address: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: ''
          }
        };

        // Create the teacher profile
        teacher = await Teacher.create(defaultTeacher);

        // Populate the user field
        teacher = await Teacher.findById(teacher._id)
          .populate({
            path: 'user',
            select: 'name email role profileImage'
          });

        console.log(`Created default teacher profile for user ID: ${req.user.id}`);
      } catch (createErr) {
        console.error(`Error creating default teacher profile: ${createErr.message}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to create teacher profile. Please contact an administrator.'
        });
      }
    }

    console.log(`Successfully retrieved teacher profile for user ID: ${req.user.id}`);
    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (err) {
    console.error(`Error fetching teacher profile: ${err.message}`);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create teacher
// @route   POST /api/teachers
// @access  Private/Admin
exports.createTeacher = async (req, res) => {
  try {
    const { userData, teacherData } = req.body;

    // Check if profile image is provided
    if (!userData.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture is required'
      });
    }

    // Ensure email follows the required format for teachers
    if (!userData.email.startsWith('tch') || !userData.email.endsWith('@schoolms.com')) {
      // Generate a proper email if it doesn't match the format
      const cleanFirstName = userData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanLastName = userData.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      userData.email = `tch${cleanFirstName}${cleanLastName}@schoolms.com`;
    }

    // Check if the email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      // If email exists, modify it to make it unique by adding a number
      let counter = 1;
      let newEmail = userData.email;

      // Extract the base part of the email (before @)
      const emailParts = userData.email.split('@');
      const basePart = emailParts[0];
      const domainPart = emailParts[1];

      // Try adding numbers until we find a unique email
      while (await User.findOne({ email: newEmail })) {
        newEmail = `${basePart}${counter}@${domainPart}`;
        counter++;
      }

      userData.email = newEmail;
    }

    // First create a user with role teacher and auto-approve
    userData.role = 'teacher';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await User.create(userData);

    // Generate a unique employee ID
    const teacherCount = await Teacher.countDocuments();
    const currentYear = new Date().getFullYear().toString().substr(-2); // Get last 2 digits of year
    const employeeId = `TCH${currentYear}${(teacherCount + 1).toString().padStart(4, '0')}`;

    // Then create teacher profile with user reference and auto-generated ID
    teacherData.user = user._id;
    teacherData.employeeId = employeeId; // Set the auto-generated ID
    const teacher = await Teacher.create(teacherData);

    res.status(201).json({
      success: true,
      data: {
        teacher,
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

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private/Admin
exports.updateTeacher = async (req, res) => {
  try {
    const { userData, teacherData } = req.body;
    let updatedData = {};

    // Check if trying to update employeeId
    if (teacherData && teacherData.employeeId) {
      const existingTeacher = await Teacher.findById(req.params.id);
      if (existingTeacher && teacherData.employeeId !== existingTeacher.employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID cannot be modified'
        });
      }
    }

    // Update teacher data if provided
    if (teacherData) {
      // Remove employeeId from update data to ensure it's not modified
      const { employeeId, ...teacherUpdateData } = teacherData;

      const teacher = await Teacher.findByIdAndUpdate(
        req.params.id,
        teacherUpdateData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: `No teacher found with id ${req.params.id}`
        });
      }

      updatedData.teacher = teacher;
    }

    // Update user data if provided
    if (userData) {
      const teacher = await Teacher.findById(req.params.id);

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message: `No teacher found with id ${req.params.id}`
        });
      }

      const user = await User.findByIdAndUpdate(
        teacher.user,
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

// @desc    Update own teacher profile
// @route   PUT /api/teachers/profile
// @access  Private/Teacher
exports.updateOwnProfile = async (req, res) => {
  try {
    console.log(`Updating teacher profile for user ID: ${req.user.id}`);
    const { userData, teacherData } = req.body;
    let updatedData = {};

    // Find the teacher profile for the logged in user
    const teacher = await Teacher.findOne({ user: req.user.id });

    if (!teacher) {
      console.log(`No teacher profile found for user ID: ${req.user.id}`);
      return res.status(404).json({
        success: false,
        message: 'No teacher profile found for this user'
      });
    }

    // Update teacher data if provided
    if (teacherData) {
      // Prevent teacher from updating sensitive fields
      const allowedFields = [
        'phoneNumber',
        'qualification',
        'subjects',
        'classes',
        'experience',
        'dateOfBirth',
        'gender',
        'address'
      ];

      const filteredTeacherData = {};

      // Only include allowed fields
      Object.keys(teacherData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredTeacherData[key] = teacherData[key];
        }
      });

      // Ensure employeeId is never modified
      if (teacherData.employeeId && teacherData.employeeId !== teacher.employeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID cannot be modified'
        });
      }

      // Log the classes being updated
      console.log('Original classes:', teacher.classes);
      console.log('Updated classes:', filteredTeacherData.classes);

      // Ensure classes is not empty
      if (filteredTeacherData.classes && filteredTeacherData.classes.length === 0) {
        filteredTeacherData.classes = ['Not assigned'];
      }

      // Ensure subjects is not empty
      if (filteredTeacherData.subjects && filteredTeacherData.subjects.length === 0) {
        filteredTeacherData.subjects = ['Not assigned'];
      }

      const updatedTeacher = await Teacher.findByIdAndUpdate(
        teacher._id,
        filteredTeacherData,
        {
          new: true,
          runValidators: true
        }
      );

      console.log('Teacher profile updated successfully');
      updatedData.teacher = updatedTeacher;
    }

    // Update user data if provided
    if (userData) {
      // Prevent teacher from updating role or other sensitive fields
      const allowedFields = ['name', 'email', 'profileImage'];

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

      console.log('User data updated successfully');
      updatedData.user = user;
    }

    res.status(200).json({
      success: true,
      data: updatedData
    });
  } catch (err) {
    console.error(`Error updating teacher profile: ${err.message}`);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private/Admin/Principal
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: `No teacher found with id ${req.params.id}`
      });
    }

    // Get user ID before deleting teacher
    const userId = teacher.user;

    // Delete teacher
    await teacher.deleteOne();

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
