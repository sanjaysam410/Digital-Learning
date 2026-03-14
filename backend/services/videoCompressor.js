const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Queue = require('better-queue');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

let io = null;

const queue = new Queue(function (job, done) {
    const { inputPath, outputPath, filename, teacherSocketId, onStart, onDone, onError } = job;

    if (onStart) onStart();

    ffmpeg(inputPath)
        .outputOptions([
            '-c:v libx264',
            '-crf 28',
            '-vf scale=-2:480',
            '-c:a aac',
            '-b:a 64k',
            '-movflags +faststart',
        ])
        .on('start', () => {
            console.log(`[videoCompressor] Compressing: ${filename}`);
        })
        .on('end', () => {
            console.log(`[videoCompressor] Compressed: ${filename}, uploading to Cloudinary...`);

            // Upload compressed file to Cloudinary
            cloudinary.uploader.upload(outputPath, {
                resource_type: 'video',
                folder: 'vidya-setu/lessons',
                public_id: filename.replace(/\.[^.]+$/, ''), // strip extension
                overwrite: true,
            }, (err, result) => {
                // Delete both local files regardless of upload result
                fs.unlink(inputPath, () => {});
                fs.unlink(outputPath, () => {});

                if (err) {
                    console.error(`[videoCompressor] Cloudinary upload failed:`, err.message);
                    if (onError) onError();
                    if (io && teacherSocketId) {
                        io.to(teacherSocketId).emit('video:compression_error', {
                            filename,
                            error: 'Cloud upload failed: ' + err.message,
                        });
                    }
                    return done(err);
                }

                const cloudinaryUrl = result.secure_url;
                console.log(`[videoCompressor] Uploaded to Cloudinary: ${cloudinaryUrl}`);

                if (onDone) onDone(cloudinaryUrl);
                if (io && teacherSocketId) {
                    io.to(teacherSocketId).emit('video:compressed', {
                        filename,
                        compressedUrl: cloudinaryUrl,
                    });
                }
                done(null);
            });
        })
        .on('error', (err) => {
            console.error(`[videoCompressor] FFmpeg error on ${filename}:`, err.message);
            // Delete raw file on error
            fs.unlink(inputPath, () => {});
            if (onError) onError();
            if (io && teacherSocketId) {
                io.to(teacherSocketId).emit('video:compression_error', {
                    filename,
                    error: err.message,
                });
            }
            done(err);
        })
        .save(outputPath);
}, { concurrent: 1 });

function addCompressionJob(jobData) {
    queue.push(jobData);
}

function setIO(ioInstance) {
    io = ioInstance;
}

module.exports = { addCompressionJob, setIO };
