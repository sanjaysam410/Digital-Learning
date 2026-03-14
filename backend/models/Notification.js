const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['lesson', 'quiz', 'announcement', 'general'], default: 'general' },
    // Reference to the related resource (lesson or quiz ID)
    referenceId: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, default: '' },
    // Target audience: 'all', 'students', 'teachers', 'admins'
    targetRole: { type: String, default: 'all' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
