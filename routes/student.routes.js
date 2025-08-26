const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/student.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getStudents)
  .post(protect, authorize('admin', 'principal'), createStudent);

router
  .route('/:id')
  .get(protect, getStudent)
  .put(protect, authorize('admin', 'principal', 'teacher', 'student'), updateStudent)
  .delete(protect, authorize('admin', 'principal'), deleteStudent);

module.exports = router;
