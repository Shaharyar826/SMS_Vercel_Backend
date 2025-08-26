const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth');
const multer = require('multer');
const { uploadImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Configure multer for handling file uploads
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

// Public routes
router.post('/register', uploadMulter.single('profileImage'), (req, res, next) => {
  req.body.imageType = 'profile';
  next();
}, uploadImage, register);

router.post('/login', login);
router.get('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, uploadMulter.single('profileImage'), (req, res, next) => {
  if (req.file) {
    req.body.imageType = 'profile';
    next();
  } else {
    next();
  }
}, uploadImage, updateDetails);
router.put('/updatepassword', protect, updatePassword);

module.exports = router;
