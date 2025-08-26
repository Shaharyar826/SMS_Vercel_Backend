const Student = require('../models/Student');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const { createInitialFeeRecord } = require('./fee.controller');

// @desc    Get all students
// @route   GET /api/students
// @access  Private
exports.getStudents = async (req, res) => {
  try {
    console.log('Student query params:', req.query);

    // Build query
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string first
    let queryStr = JSON.stringify(reqQuery);
    console.log('Student query string before parsing:', queryStr);

    // Create operators ($gt, $gte, etc) - but avoid double conversion
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    console.log('Student query string after parsing:', queryStr);

    // Parse the query
    let parsedQuery = JSON.parse(queryStr);

    // For teachers, restrict to their assigned classes
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        // Filter out 'Not assigned' from teacher's classes
        const validClasses = teacher.classes.filter(cls => cls !== 'Not assigned');
        if (validClasses.length > 0) {
          parsedQuery.class = { $in: validClasses };
        } else {
          // If teacher has no valid classes, return empty result
          return res.status(200).json({
            success: true,
            count: 0,
            pagination: {},
            data: []
          });
        }
      } else {
        // If teacher has no classes assigned, return empty result
        return res.status(200).json({
          success: true,
          count: 0,
          pagination: {},
          data: []
        });
      }
    }

    // For students, only show their own profile
    if (req.user.role === 'student') {
      parsedQuery.user = req.user.id;
    }

    // Finding resource
    query = Student.find(parsedQuery)
      .populate({
        path: 'user',
        select: 'name email role profileImage isApproved status'
      })
      .populate('feeRecords');

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Student.countDocuments(parsedQuery);

    query = query.skip(startIndex).limit(limit);

    console.log(`Pagination: page=${page}, limit=${limit}, startIndex=${startIndex}, endIndex=${endIndex}, total=${total}`);

    // Executing query
    let students = await query;
    console.log(`Found ${students.length} students initially`);

    // Filter out students whose users are not approved or inactive
    students = students.filter(student =>
      student.user && student.user.isApproved && student.user.status === 'active'
    );
    console.log(`After filtering, ${students.length} active students remain`);

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: students.length,
      pagination,
      data: students
    });
  } catch (err) {
    console.error('Error in getStudents:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error fetching students'
    });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email role profileImage'
      })
      .populate('attendanceRecords')
      .populate('feeRecords');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No student found with id ${req.params.id}`
      });
    }

    // For teachers, check if they can access this student
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        if (!teacher.classes.includes(student.class)) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to view this student'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'No classes assigned to you'
        });
      }
    }

    // For students, only allow access to their own profile
    if (req.user.role === 'student') {
      if (student.user._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own profile'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create student
// @route   POST /api/students
// @access  Private/Admin
exports.createStudent = async (req, res) => {
  try {
    const { userData, studentData } = req.body;

    // Profile image will be uploaded separately after user creation
    // if (!userData.profileImage) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Profile picture is required'
    //   });
    // }

    // Ensure email follows the required format for students
    if (!userData.email.startsWith('std') || !userData.email.endsWith('@schoolms.com')) {
      // Generate a proper email if it doesn't match the format
      const cleanFirstName = userData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanLastName = userData.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
      userData.email = `std${cleanFirstName}${cleanLastName}@schoolms.com`;
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

    // First create a user with role student and auto-approve
    userData.role = 'student';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await User.create(userData);

    // Then create student profile with user reference
    studentData.user = user._id;
    const student = await Student.create(studentData);

    // Create initial fee record for the student
    if (student && student.monthlyFee > 0) {
      try {
        const feeRecord = await createInitialFeeRecord(
          student._id,
          req.user.id,
          student.monthlyFee
        );
        console.log('Created initial fee record for new student:', feeRecord ? feeRecord._id : 'Failed');
      } catch (feeError) {
        console.error('Error creating initial fee record:', feeError);
        // Don't fail the student creation if fee record creation fails
      }
    } else {
      console.log('Skipping initial fee record creation - student has no monthly fee set');
    }

    res.status(201).json({
      success: true,
      data: {
        student,
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

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private/Admin
exports.updateStudent = async (req, res) => {
  try {
    const { userData, studentData } = req.body;
    let updatedData = {};

    // Check if student exists first
    const existingStudent = await Student.findById(req.params.id);
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: `No student found with id ${req.params.id}`
      });
    }

    // For students, only allow them to update their own profile
    if (req.user.role === 'student') {
      if (existingStudent.user.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own profile'
        });
      }

      // Students can only update limited fields
      const allowedStudentFields = ['address', 'parentInfo'];
      if (studentData) {
        const filteredStudentData = {};
        allowedStudentFields.forEach(field => {
          if (studentData[field] !== undefined) {
            filteredStudentData[field] = studentData[field];
          }
        });

        if (Object.keys(filteredStudentData).length > 0) {
          const student = await Student.findByIdAndUpdate(
            req.params.id,
            filteredStudentData,
            {
              new: true,
              runValidators: true
            }
          );
          updatedData.student = student;
        }
      }
    } else {
      // Update student data if provided (for admin/principal/teacher)
      if (studentData) {
        const student = await Student.findByIdAndUpdate(
          req.params.id,
          studentData,
          {
            new: true,
            runValidators: true
          }
        );
        updatedData.student = student;
      }
    }

    // Update user data if provided
    if (userData) {
      const student = await Student.findById(req.params.id);

      if (!student) {
        return res.status(404).json({
          success: false,
          message: `No student found with id ${req.params.id}`
        });
      }

      const user = await User.findByIdAndUpdate(
        student.user,
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

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No student found with id ${req.params.id}`
      });
    }

    // Get user ID before deleting student
    const userId = student.user;

    // Delete student
    await student.deleteOne();

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
