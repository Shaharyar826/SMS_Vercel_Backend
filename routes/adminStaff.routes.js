const express = require('express');
const {
  getAdminStaff,
  getAdminStaffMember,
  createAdminStaff,
  updateAdminStaff,
  deleteAdminStaff,
  getAdminStaffProfile,
  updateAdminStaffProfile
} = require('../controllers/adminStaff.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(protect, getAdminStaff)
  .post(protect, authorize('admin', 'principal'), createAdminStaff);

router
  .route('/profile')
  .get(protect, authorize('admin', 'principal'), getAdminStaffProfile)
  .put(protect, authorize('admin', 'principal'), updateAdminStaffProfile);

router
  .route('/:id')
  .get(protect, getAdminStaffMember)
  .put(protect, authorize('admin', 'principal'), updateAdminStaff)
  .delete(protect, authorize('admin'), deleteAdminStaff);

module.exports = router;
