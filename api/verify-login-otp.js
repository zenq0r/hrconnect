// Confirms an email OTP: the one required before a new password may be set,
// and the one a privileged role must clear before the portal opens. Also
// verifies a trusted-device token as an alternative to the emailed code for
// a sign-in, and issues a new one when the code path succeeds with "trust
// this device" checked — kept in this same file/route rather than a new
// serverless function (see trusted_devices in firestore.rules).
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const crypto = require('crypto');
const { hashOtp, hashResetToken } = require('./_security');
const { resolvePasswordResetContext, resolveSignInContext } = require('./_passwordResetOtp');
const { enforceRateLimit } = require('./_rateLimit');
const { parseUserAgent } = require('./_auditMetadata');

const MAX_ATTEMPTS = 5;
const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

        const { code, trustedDeviceToken, trustDevice } = req.body || {};
        const db = getAdminFirestore();

        // A trusted device skips the emailed code entirely, for a sign-in only —
        // resetting a password always requires the code, trusted device or not.
        // resolveSignInContext independently re-verifies the caller's idToken, so
        // the uid this checks against is never taken from the request body.
        if (purpose === 'sign-in' && trustedDeviceToken && typeof trustedDeviceToken === 'string') {
            const signInContext = await resolveSignInContext(getAdminAuth(), req.body);
            const rate = await enforceRateLimit(db, { scope: 'trusted-device-verify', key: signInContext.uid, limit: 10, windowMs: 5 * 60 * 1000 });
            if (!rate.allowed) { res.setHeader('Retry-After', String(rate.retryAfterSeconds)); res.status(429).json({ valid: false, error: 'Too many attempts. Please try again shortly.' }); return; }
            const deviceRef = db.collection('trusted_devices').doc(hashResetToken(trustedDeviceToken));
            const deviceSnap = await deviceRef.get();
            const device = deviceSnap.exists ? deviceSnap.data() : null;
            if (!device || device.uid !== signInContext.uid || device.revoked || new Date(device.expiresAt).getTime() < Date.now()) {
                res.status(400).json({ valid: false, error: 'This device is no longer trusted. Enter the code from your email instead.' }); return;
            }
            await deviceRef.update({ lastUsedAt: new Date().toISOString() });
            const adminAuth = getAdminAuth();
            const current = (await adminAuth.getUser(signInContext.uid)).customClaims || {};
            await adminAuth.setCustomUserClaims(signInContext.uid, { ...current, sfa: signInContext.authTime });
            res.status(200).json({ valid: true });
            return;
        }

        if (!code || typeof code !== 'string') { res.status(400).json({ valid: false, error: 'Enter the code from your email.' }); return; }

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

        // What firestore.rules and storage.rules actually check: the sign-in
        // this code confirmed. Until the session's token carries it, the roles
        // that need a code get nothing from the database.
        let trustedDevicePayload = {};
        if (purpose === 'sign-in') {
            const adminAuth = getAdminAuth();
            const current = (await adminAuth.getUser(reset.uid)).customClaims || {};
            await adminAuth.setCustomUserClaims(reset.uid, { ...current, sfa: reset.authTime });

            if (trustDevice === true) {
                const rawToken = crypto.randomBytes(32).toString('hex');
                const { browser, os } = parseUserAgent(req.headers['user-agent']);
                const now = new Date();
                const expiresAt = new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS).toISOString();
                await db.collection('trusted_devices').doc(hashResetToken(rawToken)).set({
                    uid: reset.uid,
                    label: `${browser} on ${os}`,
                    createdAt: now.toISOString(),
                    expiresAt,
                    lastUsedAt: now.toISOString(),
                    revoked: false
                });
                // The raw token is returned exactly once — only its hash is ever
                // stored, the same way an OTP code and a reset token already are.
                trustedDevicePayload = { trustedDeviceToken: rawToken, trustedDeviceExpiresAt: expiresAt };
            }
        }

        res.status(200).json({ valid: true, ...trustedDevicePayload });
    } catch (error) {
        console.error('verify-login-otp error:', error);
        res.status(error.statusCode || 500).json({ valid: false, error: error.statusCode ? error.message : 'Unable to verify the code right now. Please try again.' });
    }
};
