const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const { hashResetToken, normalizeEmail, passwordPolicyError } = require('./_security');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const { token, newPassword } = req.body || {};
        if (!token || typeof token !== 'string') {
            res.status(400).json({ error: 'This reset link is invalid. Please request a new one.' });
            return;
        }
        const policyError = typeof newPassword === 'string' ? passwordPolicyError(newPassword) : 'A new password is required.';
        if (policyError) {
            res.status(400).json({ error: policyError });
            return;
        }

        const auth = getAdminAuth();
        const db = getAdminFirestore();
        let docRef = db.collection('password_reset_tokens').doc(hashResetToken(token));
        if (!(await docRef.get()).exists) docRef = db.collection('password_reset_tokens').doc(token);
        const otpRef = db.collection('password_reset_otp_codes').doc(hashResetToken(`legacy:${token}`));
        const claim = await db.runTransaction(async transaction => {
            const [doc, otpDoc] = await Promise.all([transaction.get(docRef), transaction.get(otpRef)]);
            if (!doc.exists) return { error: 'This reset link is invalid. Please request a new one.' };
            const data = doc.data();
            if (data.used || data.processing) return { error: 'This reset link has already been used. Please request a new one.' };
            if (new Date(data.expiresAt).getTime() < Date.now()) return { error: 'This reset link has expired. Please request a new one.' };
            const otp = otpDoc.exists ? otpDoc.data() : null;
            if (!otp || !otp.used || otp.resetSource !== 'legacy' || otp.email !== normalizeEmail(data.email)) {
                return { error: 'Verify the code sent to your email before setting a new password.' };
            }
            transaction.update(docRef, { processing: true, processingAt: new Date().toISOString() });
            return { uid: data.uid };
        });
        if (claim.error) { res.status(400).json({ error: claim.error }); return; }

        try {
            await auth.updateUser(claim.uid, { password: newPassword });
            await db.collection('users').doc(claim.uid).set({ mustChangePassword: false, updatedAt: new Date().toISOString() }, { merge: true });
            await docRef.update({ used: true, processing: false, usedAt: new Date().toISOString() });
        } catch (updateError) {
            await docRef.update({ processing: false }).catch(() => {});
            throw updateError;
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('confirm-password-reset error:', error);
        res.status(500).json({ error: 'Unable to reset your password right now. Please try again shortly.' });
    }
};
