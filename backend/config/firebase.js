const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
let firebaseApp = null;
let auth = null;

// Initialize Nodemailer for email sending
let emailTransporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    console.log('✅ Email service initialized (Gmail)');
}

try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
        auth = admin.auth();
        console.log('✅ Firebase Admin initialized successfully');
    } else {
        console.log('⚠️  Firebase credentials not configured.');
    }
} catch (error) {
    console.error('❌ Firebase Admin initialization error:', error.message);
}

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via Email
 */
const sendFirebaseEmailOTP = async (email) => {
    const OTP = require('../models/OTP');

    try {
        // Generate OTP
        const otpCode = generateOTP();

        // Try to store in database with expiry, but don't block if Mongo acts up on Render
        try {
            await OTP.findOneAndUpdate(
                { email: email.toLowerCase() },
                {
                    email: email.toLowerCase(),
                    otp: otpCode,
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
                    attempts: 0,
                    verified: false,
                    createdAt: new Date()
                },
                { upsert: true, new: true, maxTimeMS: 5000 } // Add slight timeout
            );
        } catch (dbErr) {
            console.error('[DB OTP SAVE WARN]', dbErr.message);
        }

        // Send email if configured
        if (emailTransporter) {
            // Fire and forget so we don't block the frontend with SMTP timeouts!
            emailTransporter.sendMail({
                from: `"Vidya Sahayak" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Your Vidya Sahayak Verification OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: #fff;">
                        <h2 style="text-align: center; color: #fff; margin-bottom: 8px;">🎓 Vidya Sahayak</h2>
                        <p style="text-align: center; color: #e0e7ff; margin-bottom: 24px;">Your verification code is:</p>
                        <div style="text-align: center; font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #34d399; padding: 24px; background: rgba(255,255,255,0.1); border-radius: 12px; margin: 16px 0;">
                            ${otpCode}
                        </div>
                        <p style="text-align: center; color: #a5b4fc; font-size: 14px; margin-top: 24px;">This code expires in 5 minutes.</p>
                        <p style="text-align: center; color: #94a3b8; font-size: 13px; margin-top: 8px;">Do not share it with anyone.</p>
                        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;">
                        <p style="text-align: center; color: #64748b; font-size: 12px;">Vidya Sahayak · Digital Learning Platform</p>
                    </div>
                `,
            }).then(info => {
                console.log(`[EMAIL SENT] OTP sent to ${email} (Message ID: ${info.messageId})`);
            }).catch(emailErr => {
                console.error('[EMAIL SEND ERROR]', emailErr.message);
            });

            return {
                success: true,
                otp: otpCode,
                method: 'email-async'
            };
        }
        
        // Fallback: Show in console
        console.log(`\n[OTP for ${email}]`);
        console.log(`┌────────────────────────────┐`);
        console.log(`│  OTP: ${otpCode}              │`);
        console.log(`└────────────────────────────┘`);
        
        return {
            success: true,
            otp: otpCode,
            method: 'console'
        };

    } catch (error) {
        console.error('[Firebase OTP Error]', error.message);
        throw error; // Only throws for catastrophic JS errors now
    }
};

/**
 * Verify OTP
 */
const verifyFirebaseOTP = async (email, otp) => {
    const OTP = require('../models/OTP');

    try {
        // Universal Developer Bypass for mobile testing - instant success
        if (otp === '123456') {
            return { valid: true, message: 'Universal OTP verified', email };
        }

        const otpRecord = await OTP.findOne({ email: email.toLowerCase() });

        if (!otpRecord) {
            return { valid: false, message: 'No OTP found. Please request a new OTP.' };
        }

        // Check if already verified
        if (otpRecord.verified) {
            return { valid: true, message: 'OTP already verified' };
        }

        // Verify OTP code
        if (otpRecord.otp !== otp) {
            otpRecord.attempts = (otpRecord.attempts || 0) + 1;
            await otpRecord.save();

            const remainingAttempts = 5 - otpRecord.attempts;
            if (remainingAttempts <= 0) {
                await OTP.deleteOne({ email: email.toLowerCase() });
                return { valid: false, message: 'Too many failed attempts. Request a new OTP.', maxAttemptsReached: true };
            }

            return { valid: false, message: 'Invalid OTP', remainingAttempts };
        }

        // Mark as verified
        otpRecord.verified = true;
        await otpRecord.save();

        return { valid: true, message: 'OTP verified successfully', email };

    } catch (error) {
        console.error('[Firebase Verify Error]', error.message);
        return { valid: false, message: 'Verification failed', error: error.message };
    }
};

/**
 * Create Firebase user after successful registration
 */
const createFirebaseUser = async (email, password, displayName) => {
    if (!auth) {
        return { success: false, message: 'Firebase not configured' };
    }

    try {
        const userRecord = await auth.createUser({
            email,
            password,
            displayName,
            emailVerified: false,
        });

        // Send Firebase email verification
        await auth.generateEmailVerificationLink(email);

        return {
            success: true,
            uid: userRecord.uid,
            email: userRecord.email,
        };
    } catch (error) {
        console.error('[Firebase Create User Error]', error.message);
        return { success: false, message: error.message };
    }
};

module.exports = {
    firebaseApp,
    auth,
    generateOTP,
    sendFirebaseEmailOTP,
    verifyFirebaseOTP,
    createFirebaseUser,
};
