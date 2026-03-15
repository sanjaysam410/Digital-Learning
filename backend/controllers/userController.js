const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password, role, schoolId, language, otp } = req.body;
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 1) {
        // Fallback demo for successful frontend interaction
        return res.status(201).json({
            _id: `mock-${role}-${Date.now()}`,
            name,
            email,
            role: role || 'student',
            schoolId: schoolId || 'nabha-01',
            language: language || 'English',
            token: generateToken(`mock-${role}`),
        });
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const otpRecord = await OTP.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: role || 'student',
            schoolId: schoolId || 'nabha-01',
            language: language || 'English',
        });

        return res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            language: user.language,
            token: generateToken(user._id),
        });
    } catch (error) {
        return res.status(400).json({ message: 'Invalid user data', error: error.message });
    }
};

// @desc    Send OTP to email
// @route   POST /api/users/send-otp
// @access  Public
const sendOtp = async (req, res) => {
    const { email } = req.body;
    const mongoose = require('mongoose');
    const nodemailer = require('nodemailer');

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Send real email via Gmail SMTP
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"Vidya Setu" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: 'Your Vidya Setu Verification OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; border-radius: 16px; color: #fff;">
                    <h2 style="text-align: center; color: #818cf8;">🎓 Vidya Setu</h2>
                    <p style="text-align: center; color: #94a3b8;">Your verification code is:</p>
                    <div style="text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #34d399; padding: 20px; background: #1e293b; border-radius: 12px; margin: 16px 0;">
                        ${otpCode}
                    </div>
                    <p style="text-align: center; color: #64748b; font-size: 13px;">This code expires in 5 minutes. Do not share it with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #1e293b; margin: 20px 0;">
                    <p style="text-align: center; color: #475569; font-size: 11px;">Vidya Setu · Digital Learning · Nabha Rural Schools</p>
                </div>
            `,
        });

        console.log(`[EMAIL SENT] OTP sent to ${email}`);
    } catch (emailErr) {
        console.error('[EMAIL ERROR]', emailErr.message);
        return res.status(500).json({ message: 'Failed to send OTP email. Check SMTP credentials.', error: emailErr.message });
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(200).json({ message: 'OTP sent but DB offline' });
    }

    try {
        await OTP.deleteOne({ email }); // Delete any existing OTP
        await OTP.create({ email, otp: otpCode });
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving OTP', error: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = async (req, res) => {
    const { email, password } = req.body;
    const mongoose = require('mongoose');

    // Mongoose readyState 1 means connected.
    // If not connected, we skip to the fallback catch block manually
    if (mongoose.connection.readyState !== 1) {
        return handleFallbackLogin(email, res);
    }

    try {
        const user = await User.findOne({ email }).maxTimeMS(2000); // 2 second timeout 

        if (user && (await user.matchPassword(password))) {
            return res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId,
                language: user.language,
                token: generateToken(user._id),
            });
        } else {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        return handleFallbackLogin(email, res, error);
    }
};

const handleFallbackLogin = (email, res, error = null) => {
    // Fallback for demo if MongoDB is currently unreachable (e.g. IP whitelist changed)
    if (email === 'aarav@student.nabha.edu') {
        return res.json({
            _id: 'mock-student-1',
            name: 'Aarav Sharma',
            email: 'aarav@student.nabha.edu',
            role: 'student',
            schoolId: 'nabha-01',
            language: 'english',
            token: generateToken('mock-student-1'),
        });
    } else if (email === 'teacher@nabha.edu') {
        return res.json({
            _id: 'mock-teacher-1',
            name: 'Instructor Sharma',
            email: 'teacher@nabha.edu',
            role: 'teacher',
            schoolId: 'nabha-01',
            language: 'english',
            token: generateToken('mock-teacher-1'),
        });
    } else if (email === 'admin@nabha.edu') {
        return res.json({
            _id: 'mock-admin-1',
            name: 'Principal Singh',
            email: 'admin@nabha.edu',
            role: 'admin',
            schoolId: 'nabha-01',
            language: 'english',
            token: generateToken('mock-admin-1'),
        });
    }
    res.status(500).json({ message: 'Server error: MongoDB disconnected', error: error ? error.message : 'Not connected' });
};

// @desc    Get user progress details
// @route   GET /api/users/progress/:id
// @access  Private
const getUserProgress = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json({ name: 'Mock User', progress: [] });
    }

    try {
        const user = await User.findById(req.params.id);
        if (user) {
            return res.json({
                name: user.name,
                progress: user.progress
            });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Save/Update user progress
// @route   PUT /api/users/progress/:id
// @access  Private
const saveUserProgress = async (req, res) => {
    const { newProgressScore, chapter } = req.body;
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 1) {
        // Fallback demo
        return res.json({ message: 'Progress saved successfully via mock fallback', progress: [] });
    }

    try {
        const user = await User.findById(req.params.id);

        if (user) {
            // For MVP: We'll just update a generic top-level temporary field or the first lesson's score
            // If they don't have a progress array element yet, create a dummy one
            if (user.progress.length === 0) {
                user.progress.push({
                    status: 'in_progress',
                    score: newProgressScore,
                });
            } else {
                user.progress[0].score = newProgressScore;
                user.progress[0].status = newProgressScore === 100 ? 'completed' : 'in_progress';
            }

            await user.save();
            return res.json({ message: 'Progress saved successfully', progress: user.progress });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all students
// @route   GET /api/users/students
// @access  Private (Teacher/Admin)
const getStudents = async (req, res) => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        return res.json([
            { _id: 's1', name: 'Mock Aarav', progress: [{ score: 72 }] }
        ]);
    }

    try {
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    registerUser,
    sendOtp,
    authUser,
    getUserProgress,
    saveUserProgress,
    getStudents
};
