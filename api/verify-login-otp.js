// Confirms the email OTP required before a user can set a new password.
const { getAdminApp } = require('./_firebaseAdmin');
const crypto = require('crypto');
const { hashOtp } = require('./_security');
const { resolvePasswordResetContext } = require('./_passwordResetOtp');

const MAX_ATTEMPTS = 5;

function safeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        if (req.body?.purpose !== 'password-reset') {
            res.status(400).json({ valid: false, error: 'Verification codes are available only for password resets.' });
            return;
        }

        const { code } = req.body || {};
        if (!code || typeof code !== 'string') { res.status(400).json({ valid: false, error: 'Enter the code from your email.' }); return; }

        const admin = getAdminApp();
        const reset = await resolvePasswordResetContext(admin, req.body);
        const docRef = admin.firestore().collection('password_reset_otp_codes').doc(reset.fingerprint);
        const result = await admin.firestore().runTransaction(async transaction => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) return { error: 'No verification code was requested. Request a new code.' };
            const data = doc.data();
            if (data.used) return { error: 'This code has already been used. Request a new code.' };
            if (new Date(data.expiresAt).getTime() < Date.now()) return { error: 'This code has expired. Request a new code.' };
            if (data.email !== reset.email || data.resetSource !== reset.source) return { error: 'This verification code is no longer valid. Request a new code.' };
            const attempts = Number(data.attempts || 0);
            if (attempts >= MAX_ATTEMPTS) return { error: 'Too many incorrect attempts. Request a new code.' };
            if (!safeEqual(data.codeHash || '', hashOtp(code.trim()))) {
                transaction.update(docRef, { attempts: attempts + 1 });
                return { error: attempts + 1 >= MAX_ATTEMPTS ? 'Too many incorrect attempts. Request a new code.' : 'Incorrect code. Please try again.' };
            }
            transaction.update(docRef, { used: true, usedAt: new Date().toISOString() });
            return { valid: true };
        });

        if (!result.valid) { res.status(400).json({ valid: false, error: result.error }); return; }
        res.status(200).json({ valid: true });
    } catch (error) {
        console.error('verify-login-otp error:', error);
        res.status(error.statusCode || 500).json({ valid: false, error: error.statusCode ? error.message : 'Unable to verify the code right now. Please try again.' });
    }
};
