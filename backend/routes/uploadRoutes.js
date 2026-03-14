const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { addCompressionJob, getCompressionStatus } = require('../services/videoCompressor');

const router = express.Router();

// Create separate directories for raw and compressed uploads
const rawDir = path.join(__dirname, '../public/uploads/raw');
const compressedDir = path.join(__dirname, '../public/uploads/compressed');
[rawDir, compressedDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Also keep legacy uploads dir for non-video files
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination(req, file, cb) {
        // Videos go to raw/, everything else to uploads/
        if (file.mimetype && file.mimetype.startsWith('video/')) {
            cb(null, rawDir);
        } else {
            cb(null, uploadsDir);
        }
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

function checkFileType(file, cb) {
    const filetypes = /mp4|pdf|jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Also accommodate application/pdf, video/mp4, image/jpeg, etc.
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

// POST / — Upload a file, auto-compress videos in the background
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');

    if (isVideo) {
        // Serve the raw file immediately so the lesson can be saved
        const rawUrl = `http://localhost:${process.env.PORT || 5001}/uploads/raw/${req.file.filename}`;

        // Queue background compression
        addCompressionJob({
            inputPath: req.file.path,
            filename: req.file.filename,
            uploaderId: req.body.uploaderId || null,
        });

        res.json({
            message: 'Video uploaded! Compression in progress...',
            fileUrl: rawUrl,
            status: 'processing',
            filename: req.file.filename,
        });
    } else {
        // Non-video files — return immediately
        const fileUrl = `http://localhost:${process.env.PORT || 5001}/uploads/${req.file.filename}`;
        res.json({ message: 'File Uploaded', fileUrl });
    }
});

// GET /status/:filename — Check compression status of a video
router.get('/status/:filename', (req, res) => {
    const status = getCompressionStatus(req.params.filename);
    if (!status) {
        return res.status(404).json({ message: 'No compression job found for this file' });
    }

    const result = { ...status };
    if (status.status === 'done') {
        result.compressedUrl = `http://localhost:${process.env.PORT || 5001}/uploads/compressed/${req.params.filename}`;
    }
    res.json(result);
});

module.exports = router;
