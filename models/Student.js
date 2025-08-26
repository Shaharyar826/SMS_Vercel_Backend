const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Please add a roll number'],
    unique: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Please add date of birth']
  },
  gender: {
    type: String,
    required: [true, 'Please add gender'],
    enum: ['male', 'female', 'other']
  },
  class: {
    type: String,
    required: [true, 'Please add class']
  },
  section: {
    type: String,
    required: [true, 'Please add section']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  parentInfo: {
    fatherName: {
      type: String,
      required: [true, "Please add father's name"]
    },
    motherName: {
      type: String,
      required: [true, "Please add mother's name"]
    },
    guardianName: String,
    contactNumber: {
      type: String,
      required: [true, 'Please add a contact number']
    },
    email: String,
    occupation: String
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  monthlyFee: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for attendance records
StudentSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'userId',
  justOne: false,
  match: { userType: 'student', userModel: 'Student' }
});

// Virtual for fee records
StudentSchema.virtual('feeRecords', {
  ref: 'Fee',
  localField: '_id',
  foreignField: 'student',
  justOne: false
});

module.exports = mongoose.model('Student', StudentSchema);
