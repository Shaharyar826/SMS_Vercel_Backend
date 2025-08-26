const Fee = require('../models/Fee');
const Student = require('../models/Student');

// Helper function to calculate arrears for a student
// This will calculate the total unpaid fees from previous months
exports.calculateStudentArrears = async (studentId) => {
  try {
    if (!studentId) {
      console.error('Missing student ID for arrears calculation');
      return 0;
    }

    // Get current date
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // If current month is May 2025 (month index 4), return 0 as it's the starting month
    // This is a specific solution for May 2025 being the starting month of fee management
    if (currentMonth === 4 && currentYear === 2025) {
      console.log(`May 2025 is the starting month - no arrears for student ${studentId}`);
      return 0;
    }

    // Calculate the start of the current month
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);

    // Find all unpaid/partial/overdue fees for this student from previous months
    const previousFees = await Fee.find({
      student: studentId,
      dueDate: { $lt: startOfCurrentMonth },
      status: { $in: ['unpaid', 'partial', 'overdue'] }
    });

    // Calculate total arrears
    let totalArrears = 0;

    previousFees.forEach(fee => {
      // For partial payments, only count the remaining amount
      if (fee.status === 'partial') {
        totalArrears += fee.remainingAmount;
      } else {
        // For unpaid or overdue, count the full amount
        totalArrears += fee.amount;
      }
    });

    console.log(`Calculated arrears for student ${studentId}: ${totalArrears}`);
    return totalArrears;
  } catch (error) {
    console.error('Error calculating student arrears:', error);
    return 0;
  }
};

// Helper function to create initial fee record for a student
// This will be used when a new student is created (either manually or via bulk upload)
exports.createInitialFeeRecord = async (studentId, recordedById, monthlyFeeAmount) => {
  try {
    // Validate inputs
    if (!studentId || !recordedById) {
      console.error('Missing required parameters for createInitialFeeRecord');
      return null;
    }

    // Set default amount if not provided
    const amount = monthlyFeeAmount || 0;

    // Get current date for the fee record
    const currentDate = new Date();
    const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day of current month

    // Calculate arrears from previous months
    const arrears = await exports.calculateStudentArrears(studentId);

    // Create fee data
    const feeData = {
      student: studentId,
      feeType: 'tuition',
      amount: amount,
      dueDate: dueDate,
      status: 'unpaid',
      recordedBy: recordedById,
      arrears: arrears,
      description: `Monthly tuition fee for ${currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`
    };

    // Check if a fee record already exists for this month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const existingFee = await Fee.findOne({
      student: studentId,
      feeType: 'tuition',
      dueDate: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });

    // If fee already exists, update it, otherwise create a new one
    let fee;
    if (existingFee) {
      fee = await Fee.findByIdAndUpdate(
        existingFee._id,
        feeData,
        { new: true, runValidators: true }
      );
      console.log(`Updated existing tuition fee for student ${studentId}`);
    } else {
      fee = await Fee.create(feeData);
      console.log(`Created initial tuition fee record for student ${studentId}`);
    }

    return fee;
  } catch (error) {
    console.error('Error creating initial fee record:', error);
    return null;
  }
};

// @desc    Clean up orphaned fee records (fees without valid students)
// @route   DELETE /api/fees/cleanup-orphaned
// @access  Private/Admin,Principal
exports.cleanupOrphanedFees = async (req, res) => {
  try {
    // Check if user has permission
    if (req.user.role !== 'admin' && req.user.role !== 'principal') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to perform this action'
      });
    }

    // Find all fee records
    const allFees = await Fee.find({}).populate('student');

    // Identify orphaned fees (fees where student is null or student.isActive is false)
    const orphanedFees = allFees.filter(fee =>
      !fee.student || fee.student.isActive === false
    );

    console.log(`Found ${orphanedFees.length} orphaned fee records`);

    // Delete orphaned fee records
    const orphanedFeeIds = orphanedFees.map(fee => fee._id);

    if (orphanedFeeIds.length > 0) {
      const deleteResult = await Fee.deleteMany({
        _id: { $in: orphanedFeeIds }
      });

      console.log(`Deleted ${deleteResult.deletedCount} orphaned fee records`);

      res.status(200).json({
        success: true,
        message: `Successfully cleaned up ${deleteResult.deletedCount} orphaned fee records`,
        data: {
          deletedCount: deleteResult.deletedCount,
          orphanedFeeIds: orphanedFeeIds
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'No orphaned fee records found',
        data: {
          deletedCount: 0,
          orphanedFeeIds: []
        }
      });
    }

  } catch (err) {
    console.error('Error cleaning up orphaned fees:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get all fee records
// @route   GET /api/fees
// @access  Private
exports.getFeeRecords = async (req, res) => {
  try {
    // Build query
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Handle month and year filtering
    if (req.query.month && req.query.year) {
      const month = parseInt(req.query.month);
      const year = parseInt(req.query.year);

      // Calculate start and end dates for the selected month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999); // last ms of month

      // Add date range to query
      reqQuery.dueDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit', 'month', 'year', 'studentId', '_t'];
    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Handle student filtering using the new studentId parameter
    if (req.query.studentId) {
      const studentIds = Array.isArray(req.query.studentId)
        ? req.query.studentId
        : [req.query.studentId];

      console.log('Processing studentId parameters:', studentIds);

      // Create a simple OR query for multiple student IDs
      if (studentIds.length > 1) {
        reqQuery.$or = studentIds.map(id => ({ student: id }));
        console.log('Using $or query for multiple students');
      } else {
        // Just one student ID
        reqQuery.student = studentIds[0];
      }

      console.log('Student filter applied:', reqQuery.student || reqQuery.$or);
    }
    // For backward compatibility - handle student parameter if provided
    else if (req.query.student) {
      reqQuery.student = req.query.student;
      console.log('Using legacy student filter:', reqQuery.student);
    }

    // For students, only show their own fee records
    if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const student = await Student.findOne({ user: req.user.id });
      if (student) {
        reqQuery.student = student._id;
        console.log('Student filter applied for student role:', reqQuery.student);
      } else {
        return res.status(404).json({
          success: false,
          message: 'Student profile not found'
        });
      }
    }

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    // Log the query for debugging
    console.log('Fee query before parsing:', queryStr);

    // Parse the query string back to an object
    const parsedQuery = JSON.parse(queryStr);

    // Log the parsed query for debugging
    console.log('Fee query after parsing:', parsedQuery);

    // Finding resource
    query = Fee.find(JSON.parse(queryStr))
      .populate({
        path: 'student',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

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
      query = query.sort('-dueDate');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Fee.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const feeRecords = await query;

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
      count: feeRecords.length,
      pagination,
      data: feeRecords
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single fee record
// @route   GET /api/fees/:id
// @access  Private
exports.getFeeRecord = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate({
        path: 'student',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: `No fee record found with id ${req.params.id}`
      });
    }

    // For students, only allow access to their own fee records
    if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const student = await Student.findOne({ user: req.user.id });
      if (!student || fee.student._id.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own fee records.'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: fee
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create fee record
// @route   POST /api/fees
// @access  Private
exports.createFeeRecord = async (req, res) => {
  try {
    // Add user to req.body
    req.body.recordedBy = req.user.id;

    // Log the incoming request for debugging
    console.log('Creating fee record with data:', req.body);

    // Check if student exists
    const student = await Student.findById(req.body.student);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No student found with id ${req.body.student}`
      });
    }

    // If arrears are not provided in the request, calculate them
    if (!req.body.arrears && req.body.arrears !== 0) {
      // Calculate arrears from previous months
      const arrears = await exports.calculateStudentArrears(req.body.student);
      // Add arrears to the request body
      req.body.arrears = arrears;
    } else {
      console.log(`Using provided arrears value: ${req.body.arrears}`);
    }

    // Handle "all" fee type
    if (req.body.feeType === 'all') {
      // Create multiple fee records for different fee types
      const feeTypes = ['tuition', 'exam'];
      const createdFees = [];

      for (const feeType of feeTypes) {
        const feeData = {
          ...req.body,
          feeType
        };

        // Check if a fee of this type already exists for this student in this month
        const dueDate = new Date(req.body.dueDate);
        const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
        const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);

        const existingFee = await Fee.findOne({
          student: req.body.student,
          feeType,
          dueDate: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        });

        let fee;

        if (existingFee) {
          // Update existing fee
          fee = await Fee.findByIdAndUpdate(
            existingFee._id,
            { ...feeData },
            { new: true, runValidators: true }
          );
          console.log(`Updated existing ${feeType} fee for student ${student._id}`);
        } else {
          // Create new fee
          fee = await Fee.create(feeData);
          console.log(`Created new ${feeType} fee for student ${student._id}`);
        }

        createdFees.push(fee);
      }

      return res.status(201).json({
        success: true,
        message: `Created/Updated ${createdFees.length} fee records`,
        data: createdFees
      });
    }

    // Regular single fee type
    // Check if a fee of this type already exists for this student in this month
    const dueDate = new Date(req.body.dueDate);
    const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
    const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);

    const existingFee = await Fee.findOne({
      student: req.body.student,
      feeType: req.body.feeType,
      dueDate: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });

    let fee;

    if (existingFee) {
      // Update existing fee
      fee = await Fee.findByIdAndUpdate(
        existingFee._id,
        { ...req.body },
        { new: true, runValidators: true }
      );
      console.log(`Updated existing ${req.body.feeType} fee for student ${student._id}`);
    } else {
      // Create new fee
      fee = await Fee.create(req.body);
      console.log(`Created new ${req.body.feeType} fee for student ${student._id}`);
    }

    res.status(201).json({
      success: true,
      data: fee
    });
  } catch (err) {
    console.error('Error creating/updating fee record:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update fee record
// @route   PUT /api/fees/:id
// @access  Private
exports.updateFeeRecord = async (req, res) => {
  try {
    let fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: `No fee record found with id ${req.params.id}`
      });
    }

    // Make sure user is the record creator or an admin/principal
    if (
      fee.recordedBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this fee record`
      });
    }

    // Instead of using findByIdAndUpdate, we'll find the document first,
    // update its properties, and then save it to ensure the pre-save hook runs
    fee = await Fee.findById(req.params.id);

    // Log the incoming update data for debugging
    console.log('Updating fee record with data:', req.body);

    // Update the fee properties
    Object.keys(req.body).forEach(key => {
      fee[key] = req.body[key];
    });

    // Save the fee to trigger the pre-save hook
    await fee.save();

    // Log the updated fee for debugging
    console.log('Updated fee record:', fee);

    res.status(200).json({
      success: true,
      data: fee
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete fee record
// @route   DELETE /api/fees/:id
// @access  Private
exports.deleteFeeRecord = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: `No fee record found with id ${req.params.id}`
      });
    }

    // Make sure user is the record creator or an admin/principal
    if (
      fee.recordedBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this fee record`
      });
    }

    await fee.deleteOne();

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

// @desc    Get fee record by ID
// @route   GET /api/fees/:id
// @access  Private
exports.getFeeById = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate({
        path: 'student',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: `No fee record found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: fee
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get arrears for a student
// @route   GET /api/fees/arrears/:studentId
// @access  Private
exports.getStudentArrears = async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Check if student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No student found with id ${studentId}`
      });
    }

    // Calculate arrears
    const arrears = await exports.calculateStudentArrears(studentId);

    res.status(200).json({
      success: true,
      arrears: arrears
    });
  } catch (err) {
    console.error('Error getting student arrears:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};