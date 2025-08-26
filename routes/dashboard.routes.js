const express = require('express');
const {
  getDashboardMetrics,
  getAdminDashboardMetrics,
  getTeacherDashboardMetrics
} = require('../controllers/dashboard.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/metrics', protect, getDashboardMetrics);
router.get('/admin-metrics', protect, authorize('admin', 'principal'), getAdminDashboardMetrics);
router.get('/teacher-metrics', protect, authorize('teacher'), getTeacherDashboardMetrics);

module.exports = router;
