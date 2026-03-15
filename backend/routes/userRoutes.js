const express = require('express');
const router = express.Router();
const { registerUser, sendOtp, authUser, getUserProgress, saveUserProgress, getStudents } = require('../controllers/userController');

// Define specific routes mapping to controller logic
router.post('/send-otp', sendOtp);
router.post('/', registerUser);
router.post('/login', authUser);
router.get('/students', getStudents);
router.get('/progress/:id', getUserProgress);
router.put('/progress/:id', saveUserProgress);

module.exports = router;
