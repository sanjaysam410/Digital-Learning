const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { addCompressionJob } = require('../services/videoCompressor');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ensure temp directories exist (files are deleted after Cloudinary upload)
const rawDir = path.join(__dirname, '../public/uploads/raw');
const compressedDir = path.join(__dirname, '../public/uploads/compressed');
[rawDir, compressedDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Track compression status: filename -> { status, cloudinaryUrl }
const compressionStatus = {};

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, rawDir);
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

function checkFileType(file, cb) {
    const filetypes = /mp4|pdf|jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
        return cb(null, true);
    } else {
        cb('Files of this type are not supported!');
    }
}

const upload = multer({
    storage,
    limits: { fileSize: 500000000 }, // 500MB max
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const filename = req.file.filename;

    // If it's a video, queue compression + Cloudinary upload
    if (req.file.mimetype.startsWith('video/')) {
        const inputPath = path.join(rawDir, filename);
        const outputPath = path.join(compressedDir, filename);
        const teacherSocketId = req.headers['x-socket-id'] || null;

        compressionStatus[filename] = { status: 'queued', cloudinaryUrl: null };

        addCompressionJob({
            inputPath,
            outputPath,
            filename,
            teacherSocketId,
            onStart: () => { compressionStatus[filename].status = 'processing'; },
            onDone: (cloudinaryUrl) => {
                compressionStatus[filename].status = 'done';
                compressionStatus[filename].cloudinaryUrl = cloudinaryUrl;
            },
            onError: () => { compressionStatus[filename].status = 'error'; },
        });

        return res.json({
            message: 'Video uploaded, compression & cloud upload queued',
            status: 'processing',
            filename,
        });
    }

    // Non-video files (PDF, images): upload directly to Cloudinary
    try {
        const localPath = path.join(rawDir, filename);
        const result = await cloudinary.uploader.upload(localPath, {
            resource_type: 'auto',
            folder: 'vidya-setu/files',
        });
        // Delete local file after cloud upload
        fs.unlink(localPath, () => {});
        res.json({ message: 'File Uploaded', fileUrl: result.secure_url });
    } catch (err) {
        // Fallback: serve locally if Cloudinary fails
        res.json({ message: 'File Uploaded (local)', fileUrl: `/uploads/raw/${filename}` });
    }
});

// GET /api/upload/status/:filename
router.get('/status/:filename', (req, res) => {
    const { filename } = req.params;
    const info = compressionStatus[filename] || { status: 'unknown', cloudinaryUrl: null };
    res.json({ filename, status: info.status, compressedUrl: info.cloudinaryUrl });
});

module.exports = router;
