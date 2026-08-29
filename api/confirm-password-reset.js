const { getAdminApp } = require('./_firebaseAdmin');
const { hashResetToken } = require('./_security');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const { token, newPassword } = req.body || {};
        if (!token || typeof token !== 'string') {
            res.status(400).json({ error: 'This reset link is invalid. Please request a new one.' });
            return;
        }
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters long.' });
            return;
        }

        const admin = getAdminApp();
        const db = admin.firestore();
        let docRef = db.collection('password_reset_tokens').doc(hashResetToken(token));
        if (!(await docRef.get()).exists) docRef = db.collection('password_reset_tokens').doc(token);
        const claim = await db.runTransaction(async transaction => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) return { error: 'This reset link is invalid. Please request a new one.' };
            const data = doc.data();
            if (data.used || data.processing) return { error: 'This reset link has already been used. Please request a new one.' };
            if (new Date(data.expiresAt).getTime() < Date.now()) return { error: 'This reset link has expired. Please request a new one.' };
            transaction.update(docRef, { processing: true, processingAt: new Date().toISOString() });
            return { uid: data.uid };
        });
        if (claim.error) { res.status(400).json({ error: claim.error }); return; }

        try {
            await admin.auth().updateUser(claim.uid, { password: newPassword });
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
