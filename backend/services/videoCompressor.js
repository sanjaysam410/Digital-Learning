const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const Queue = require('better-queue');

// Store a reference to Socket.IO instance
let io = null;

// Track job statuses: { filename: { status, progress, error } }
const jobStatuses = {};

// Ensure compressed output directory exists
const compressedDir = path.join(__dirname, '../public/uploads/compressed');
if (!fs.existsSync(compressedDir)) {
    fs.mkdirSync(compressedDir, { recursive: true });
}

/**
 * Compression worker function — called by better-queue for each job.
 * Settings are optimized for rural students on low-end mobile devices:
 *   - 480p resolution, H.264, CRF 28, AAC 64k, faststart for streaming
 */
function compressVideo(job, done) {
    const { inputPath, filename, uploaderId } = job;
    const outputPath = path.join(compressedDir, filename);

    console.log(`[VideoCompressor] Starting compression: ${filename}`);
    jobStatuses[filename] = { status: 'processing', progress: 0, error: null };

    // Notify uploader via Socket.IO
    if (io) {
        io.emit('video:compression_started', { filename, status: 'processing' });
    }

    ffmpeg(inputPath)
        .outputOptions([
            '-c:v libx264',          // H.264 codec — universal mobile support
            '-crf 28',               // Quality (23=default, 28=smaller file, good for lectures)
            '-preset fast',          // Encoding speed vs compression tradeoff
            '-vf', 'scale=-2:480',   // Downscale to 480p (great for low-end phones)
            '-c:a aac',              // AAC audio codec
            '-b:a 64k',              // Low audio bitrate (speech-quality, perfect for lectures)
            '-movflags', '+faststart' // Enable streaming before full download
        ])
        .output(outputPath)
        .on('progress', (progress) => {
            const percent = Math.round(progress.percent || 0);
            jobStatuses[filename] = { status: 'processing', progress: percent, error: null };

            if (io) {
                io.emit('video:compression_progress', { filename, progress: percent });
            }
        })
        .on('end', () => {
            console.log(`[VideoCompressor] ✅ Compression done: ${filename}`);
            jobStatuses[filename] = { status: 'done', progress: 100, error: null };

            // Build compressed URL
            const compressedUrl = `http://localhost:${process.env.PORT || 5001}/uploads/compressed/${filename}`;

            if (io) {
                io.emit('video:compressed', { filename, compressedUrl, status: 'done' });
            }

            done(null, { compressedUrl });
        })
        .on('error', (err) => {
            console.error(`[VideoCompressor] ❌ Compression failed: ${filename}`, err.message);
            jobStatuses[filename] = { status: 'error', progress: 0, error: err.message };

            if (io) {
                io.emit('video:compression_error', { filename, error: err.message });
            }

            // Don't fail the queue — the raw file is still usable
            done(null, { error: err.message });
        })
        .run();
}

// Create the job queue (processes one video at a time to avoid CPU overload)
const compressionQueue = new Queue(compressVideo, {
    concurrent: 1,       // Process one video at a time
    maxRetries: 1,       // Retry once on failure
    retryDelay: 5000,    // Wait 5s before retry
});

compressionQueue.on('task_finish', (taskId, result) => {
    console.log(`[VideoCompressor] Queue task finished: ${taskId}`);
});

compressionQueue.on('task_failed', (taskId, err) => {
    console.error(`[VideoCompressor] Queue task failed: ${taskId}`, err);
});

/**
 * Add a video compression job to the queue.
 * @param {{ inputPath: string, filename: string, uploaderId?: string }} jobData
 */
function addCompressionJob(jobData) {
    const { filename } = jobData;
    jobStatuses[filename] = { status: 'queued', progress: 0, error: null };
    compressionQueue.push(jobData);
    console.log(`[VideoCompressor] Job queued: ${filename}`);
}

/**
 * Get the compression status of a file.
 * @param {string} filename
 * @returns {{ status: string, progress: number, error: string|null } | null}
 */
function getCompressionStatus(filename) {
    return jobStatuses[filename] || null;
}

/**
 * Pass the Socket.IO instance so the compressor can emit real-time events.
 * @param {import('socket.io').Server} ioInstance
 */
function setIO(ioInstance) {
    io = ioInstance;
}

module.exports = { addCompressionJob, getCompressionStatus, setIO };
