const { hashResetToken, normalizeEmail } = require('./_security');

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDgoE8ckbVWqc1j6bHq1u1685_xJp0y09Y';

function resetError(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

async function resolveFirebaseResetEmail(token) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode: token })
    });
    if (!response.ok) throw resetError('This reset link is invalid or has expired. Please request a new one.');

    const result = await response.json();
    if (result.requestType && result.requestType !== 'PASSWORD_RESET') {
        throw resetError('This link cannot be used to reset a password.');
    }
    const email = normalizeEmail(result.email);
    if (!email) throw resetError('This reset link is invalid or has expired. Please request a new one.');
    return email;
}

async function resolvePasswordResetContext(admin, { resetSource, resetToken } = {}) {
    if (!resetToken || typeof resetToken !== 'string') {
        throw resetError('This reset link is invalid or has expired. Please request a new one.');
    }

    if (resetSource === 'firebase') {
        const email = await resolveFirebaseResetEmail(resetToken);
        return {
            email,
            source: 'firebase',
            fingerprint: hashResetToken(`firebase:${resetToken}`)
        };
    }

    const db = admin.firestore();
    let tokenDoc = await db.collection('password_reset_tokens').doc(hashResetToken(resetToken)).get();
    // Supports reset links issued before token hashing was introduced.
    if (!tokenDoc.exists) tokenDoc = await db.collection('password_reset_tokens').doc(resetToken).get();
    if (!tokenDoc.exists) throw resetError('This reset link is invalid or has expired. Please request a new one.');

    const record = tokenDoc.data();
    if (record.used || record.processing || new Date(record.expiresAt).getTime() < Date.now()) {
        throw resetError('This reset link is invalid or has expired. Please request a new one.');
    }
    const email = normalizeEmail(record.email);
    if (!email) throw resetError('This reset link is invalid or has expired. Please request a new one.');

    return {
        email,
        source: 'legacy',
        fingerprint: hashResetToken(`legacy:${resetToken}`)
    };
}

module.exports = { resolvePasswordResetContext };
