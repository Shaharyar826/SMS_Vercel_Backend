const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeType: {
    type: String,
    required: [true, 'Please add fee type'],
    enum: ['tuition', 'exam', 'transport', 'library', 'laboratory', 'other']
  },
  amount: {
    type: Number,
    required: [true, 'Please add amount']
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add due date']
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'online', 'bank transfer', 'other']
  },
  transactionId: {
    type: String
  },
  status: {
    type: String,
    required: [true, 'Please add payment status'],
    enum: ['paid', 'unpaid', 'partial', 'overdue'],
    default: 'unpaid'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: function() {
      return this.amount;
    }
  },
  arrears: {
    type: Number,
    default: 0
  },
  receiptNumber: {
    type: String
  },
  remarks: {
    type: String
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Update remaining amount when paid amount changes
FeeSchema.pre('save', function(next) {
  // If status is explicitly set to 'paid', ensure paidAmount is set to full amount
  if (this.isModified('status') && this.status === 'paid') {
    this.paidAmount = this.amount;
    this.remainingAmount = 0;
    this.paymentDate = this.paymentDate || Date.now();
  }

  // Update remaining amount and status when paidAmount changes
  if (this.isModified('paidAmount')) {
    this.remainingAmount = this.amount - this.paidAmount;

    // Update status based on payment
    if (this.paidAmount === 0) {
      this.status = 'unpaid';
    } else if (this.paidAmount < this.amount) {
      this.status = 'partial';
    } else if (this.paidAmount >= this.amount) {
      this.status = 'paid';
      this.paymentDate = this.paymentDate || Date.now();
    }
  }

  // Check if overdue (but don't override paid status)
  if (this.status !== 'paid' && this.dueDate < new Date() && this.status !== 'overdue') {
    this.status = 'overdue';
  }

  // Log the updated fee status for debugging
  console.log(`Fee ${this._id} status updated to ${this.status} with paidAmount ${this.paidAmount}/${this.amount}`);

  next();
});

module.exports = mongoose.model('Fee', FeeSchema);
