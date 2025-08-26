const express = require('express');
const {
  getFeeRecords,
  getFeeRecord,
  createFeeRecord,
  updateFeeRecord,
  deleteFeeRecord,
  getFeeById,
  getStudentArrears,
  cleanupOrphanedFees
} = require('../controllers/fee.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getFeeRecords)
  .post(protect, authorize('admin', 'principal'), createFeeRecord);

// Route to cleanup orphaned fee records - MUST come before /:id route
router.route('/cleanup-orphaned').delete(protect, authorize('admin', 'principal'), cleanupOrphanedFees);

// Route to get arrears for a student
router.route('/arrears/:studentId').get(protect, getStudentArrears);

router
  .route('/:id')
  .get(protect, getFeeRecord)
  .put(protect, authorize('admin', 'principal'), updateFeeRecord)
  .delete(protect, authorize('admin', 'principal'), deleteFeeRecord);

module.exports = router;
