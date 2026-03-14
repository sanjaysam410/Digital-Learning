const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    grade: { type: String, default: '8' },
    language: {
        type: String,
        enum: ['English', 'Punjabi', 'Hindi'],
        default: 'English',
    },
    description: { type: String, default: '' },
    contentUrl: { type: String, default: '' },
    pdfUrl: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    compressionStatus: {
        type: String,
        enum: ['none', 'processing', 'done', 'error'],
        default: 'none',
    },
    compressedContentUrl: { type: String, default: '' },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    tags: [String],
    isPublished: { type: Boolean, default: false },
    isDownloadable: { type: Boolean, default: true },
    schoolRef: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Lesson', lessonSchema);
