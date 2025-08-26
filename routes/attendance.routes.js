const express = require('express');
const {
  getAttendanceRecords,
  getAttendanceRecord,
  createAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  createTestAttendanceRecord,
  createBatchAttendanceRecords
} = require('../controllers/attendance.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getAttendanceRecords)
  .post(protect, authorize('admin', 'principal', 'vice-principal', 'teacher'), createAttendanceRecord);

router
  .route('/batch')
  .post(protect, authorize('admin', 'principal', 'vice-principal', 'teacher'), createBatchAttendanceRecords);

router
  .route('/create-test')
  .get(protect, createTestAttendanceRecord);

router
  .route('/:id')
  .get(protect, getAttendanceRecord)
  .put(protect, authorize('admin', 'principal', 'vice-principal', 'teacher'), updateAttendanceRecord)
  .delete(protect, authorize('admin', 'principal'), deleteAttendanceRecord);

module.exports = router;
