const express = require('express');
const {
  getTeachers,
  getTeacher,
  getTeacherProfile,
  createTeacher,
  updateTeacher,
  updateOwnProfile,
  deleteTeacher
} = require('../controllers/teacher.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getTeachers)
  .post(protect, authorize('admin', 'principal'), createTeacher);

router
  .route('/profile')
  .get(protect, authorize('teacher'), getTeacherProfile)
  .put(protect, authorize('teacher'), updateOwnProfile);

router
  .route('/:id')
  .get(protect, getTeacher)
  .put(protect, authorize('admin', 'principal'), updateTeacher)
  .delete(protect, authorize('admin', 'principal'), deleteTeacher);

module.exports = router;
