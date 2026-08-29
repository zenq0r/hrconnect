// Verifies the second-factor email OTP required for every provisioned RBAC role.
// One-time use, 5-minute expiry, tied to the requesting user's own UID via
// their Firebase ID token — a code can't be used to verify a different account.
const { getAdminApp } = require('./_firebaseAdmin');
const crypto = require('crypto');
const { hashOtp } = require('./_security');

const MAX_ATTEMPTS = 5;

function safeEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) { res.status(401).json({ valid: false, error: 'Missing authorization token.' }); return; }

        const admin = getAdminApp();
        const decoded = await admin.auth().verifyIdToken(idToken);

        const { code } = req.body || {};
        const purpose = req.body?.purpose === 'password-change' ? 'password-change' : 'sign-in';
        if (!code || typeof code !== 'string') { res.status(400).json({ valid: false, error: 'Enter the code from your email.' }); return; }

        const docRef = admin.firestore().collection('login_otp_codes').doc(decoded.uid);
        const result = await admin.firestore().runTransaction(async transaction => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) return { error: 'No verification code was requested. Please sign in again.' };
            const data = doc.data();
            if (data.used) return { error: 'This code has already been used. Please sign in again.' };
            if (new Date(data.expiresAt).getTime() < Date.now()) return { error: 'This code has expired. Please sign in again.' };
            if (data.purpose && data.purpose !== purpose) return { error: 'This verification code is for a different account action. Request a new code.' };
            const attempts = Number(data.attempts || 0);
            if (attempts >= MAX_ATTEMPTS) return { error: 'Too many incorrect attempts. Please sign in again.' };
            const submittedHash = hashOtp(code.trim());
            const storedHash = data.codeHash || (data.code ? hashOtp(data.code) : '');
            if (!storedHash || !safeEqual(storedHash, submittedHash)) {
                transaction.update(docRef, { attempts: attempts + 1 });
                return { error: attempts + 1 >= MAX_ATTEMPTS ? 'Too many incorrect attempts. Please sign in again.' : 'Incorrect code. Please try again.' };
            }
            transaction.update(docRef, { used: true, usedAt: new Date().toISOString() });
            return { valid: true };
        });
        if (!result.valid) { res.status(400).json({ valid: false, error: result.error }); return; }

        res.status(200).json({ valid: true });
    } catch (error) {
        console.error('verify-login-otp error:', error);
        res.status(500).json({ valid: false, error: 'Unable to verify the code right now. Please try again.' });
    }
};
