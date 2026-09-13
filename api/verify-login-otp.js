// Confirms an email OTP: the one required before a new password may be set,
// and the one a privileged role must clear before the portal opens.
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const crypto = require('crypto');
const { hashOtp } = require('./_security');
const { resolvePasswordResetContext, resolveSignInContext } = require('./_passwordResetOtp');

const MAX_ATTEMPTS = 5;

function safeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const purpose = req.body?.purpose;
        if (purpose !== 'password-reset' && purpose !== 'sign-in') {
            res.status(400).json({ valid: false, error: 'Verification codes are available only for signing in and for password resets.' });
            return;
        }

        const { code } = req.body || {};
        if (!code || typeof code !== 'string') { res.status(400).json({ valid: false, error: 'Enter the code from your email.' }); return; }

        const db = getAdminFirestore();
        const reset = purpose === 'sign-in'
            ? await resolveSignInContext(getAdminAuth(), req.body)
            : await resolvePasswordResetContext(db, req.body);
        const docRef = db.collection('password_reset_otp_codes').doc(reset.fingerprint);
        const result = await db.runTransaction(async transaction => {
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
            const usedAt = new Date().toISOString();
            transaction.update(docRef, { used: true, usedAt });
            // A cleared second factor is recorded against the account in the
            // same write that spends the code, so the audit trail can show that
            // this session passed one and when.
            if (purpose === 'sign-in') {
                transaction.set(db.collection('users').doc(reset.uid), { lastSecondFactorAt: usedAt }, { merge: true });
            }
            return { valid: true };
        });

        if (!result.valid) { res.status(400).json({ valid: false, error: result.error }); return; }

        res.status(200).json({ valid: true });
    } catch (error) {
        console.error('verify-login-otp error:', error);
        res.status(error.statusCode || 500).json({ valid: false, error: error.statusCode ? error.message : 'Unable to verify the code right now. Please try again.' });
    }
};
