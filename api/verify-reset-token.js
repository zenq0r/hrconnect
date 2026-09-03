const { getAdminFirestore } = require('./_firebaseAdmin');
const { hashResetToken } = require('./_security');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const { token } = req.body || {};
        if (!token || typeof token !== 'string') {
            res.status(200).json({ valid: false, reason: 'This reset link is invalid. Please request a new one.' });
            return;
        }

        const db = getAdminFirestore();
        let doc = await db.collection('password_reset_tokens').doc(hashResetToken(token)).get();
        // Transitional fallback for reset links issued before token hashing shipped.
        if (!doc.exists) doc = await db.collection('password_reset_tokens').doc(token).get();

        if (!doc.exists) {
            res.status(200).json({ valid: false, reason: 'This reset link is invalid. Please request a new one.' });
            return;
        }

        const data = doc.data();
        if (data.used) {
            res.status(200).json({ valid: false, reason: 'This reset link has already been used. Please request a new one.' });
            return;
        }
        if (new Date(data.expiresAt).getTime() < Date.now()) {
            res.status(200).json({ valid: false, reason: 'This reset link has expired. Please request a new one.' });
            return;
        }

        const profileSnapshot = data.uid ? await db.collection('users').doc(data.uid).get() : null;
        const profile = profileSnapshot?.exists ? profileSnapshot.data() : {};
        const fallbackName = String(data.email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) || 'Zenqor Portal User';
        res.status(200).json({
            valid: true,
            email: data.email,
            displayName: profile.name || profile.displayName || fallbackName,
            companyName: profile.companyName || profile.company || profile.clientCompany || 'Zenqor Technologies'
        });
    } catch (error) {
        console.error('verify-reset-token error:', error);
        res.status(500).json({ valid: false, reason: 'Unable to verify this link right now. Please try again shortly.' });
    }
};
