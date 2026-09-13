// Syncs a user's Firebase Auth custom claims (role, and clientDirectoryId for
// Client-role users) from their Firestore users/{uid} record. Storage Rules read
// these claims directly (request.auth.token.role / .clientDirectoryId) instead of
// calling firestore.get() cross-service, which does not work in this Firebase
// project (confirmed by direct testing — even firestore.exists() with a hardcoded
// path fails there). This is the standard, supported alternative for exactly this
// kind of role/ownership check in Storage Rules.
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const { isApprovedStaffEmail, normalizeEmail, isSeedAdminEmail } = require('./_security');
const { buildPortalClaims, setPortalClaims, secondFactorSatisfied } = require('./_portalClaims');


module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) { res.status(401).json({ error: 'Missing authorization token.' }); return; }

        const auth = getAdminAuth();
        const db = getAdminFirestore();
        const decoded = await auth.verifyIdToken(idToken);

        const { uid } = req.body || {};
        const targetUid = (typeof uid === 'string' && uid) ? uid : decoded.uid;

        // Self-sync always allowed (mirrors the caller's own Firestore record — no
        // privilege escalation risk since the role itself comes from Firestore, not
        // from anything the client supplies). Syncing someone ELSE's claims requires
        // being Superadmin/Director.
        if (targetUid !== decoded.uid) {
            const callerDoc = await db.collection('users').doc(decoded.uid).get();
            const callerRole = callerDoc.exists ? callerDoc.data().role : null;
            if (!['Superadmin', 'Director'].includes(callerRole) || !secondFactorSatisfied(decoded, callerRole)) {
                res.status(403).json({ error: "Only Superadmin or Director may sync another user's access claims." });
                return;
            }
        }

        const users = db.collection('users');
        let targetDoc = await users.doc(targetUid).get();
        // The protected bootstrap administrator is created in Firebase Auth first.
        // Restore its missing portal profile on its own authenticated login so this
        // account cannot be locked out by a deleted/missing users/{uid} document.
        if (!targetDoc.exists && targetUid === decoded.uid && isSeedAdminEmail(decoded.email)) {
            await users.doc(targetUid).set({
                // Restore under the address this account actually signs in with,
                // not the constant — otherwise a legacy seed admin gets a profile
                // carrying someone else's email.
                email: String(decoded.email || '').trim().toLowerCase(),
                name: decoded.name || 'System Administrator',
                photo: '',
                role: 'Superadmin',
                customAccess: {},
                mustChangePassword: false,
                restoredAt: new Date().toISOString()
            }, { merge: true });
            targetDoc = await users.doc(targetUid).get();
        }
        if (!targetDoc.exists) { res.status(404).json({ error: 'User record not found.' }); return; }
        const role = targetDoc.data().role || 'Staff';
        const targetAuthUser = targetUid === decoded.uid ? decoded : await auth.getUser(targetUid);
        const email = normalizeEmail(targetAuthUser.email) || '';

        // The Authentication record is the source of truth for sign-in identity.
        // Staff/management claims are issued only when its domain is an exact
        // approved match. Client claims intentionally remain email-domain neutral.
        if (role !== 'Client' && !isApprovedStaffEmail(email)) {
            res.status(403).json({ error: 'Staff and Management accounts require an approved company email domain.' });
            return;
        }
        // The mirror of the rule above. A Client is somebody outside the company,
        // so a company address is not a valid Client identity — refusing the
        // claims here means such an account could not reach Storage even if one
        // were created straight in the Firebase console, past the portal's forms.
        if (role === 'Client' && isApprovedStaffEmail(email)) {
            res.status(403).json({ error: 'Client accounts cannot use a company email domain.' });
            return;
        }

        // A locked account is issued no claims at all, so a re-sync can never
        // hand a locked session its Storage access back — see _portalClaims.js.
        const claims = await buildPortalClaims(db, { role, email, accessLocked: targetDoc.data().accessLocked });

        const issued = await setPortalClaims(auth, targetUid, claims);
        res.status(200).json({ success: true, claims: issued });
    } catch (error) {
        console.error('sync-user-claims error:', error);
        if (error?.code === 'client/email-ambiguous') {
            res.status(409).json({ error: error.message, errorCode: error.code });
            return;
        }
        if (error?.code === 'client/email-not-registered') {
            res.status(404).json({ error: error.message, errorCode: error.code });
            return;
        }
        res.status(500).json({ error: 'Unable to sync access claims right now. Please try again shortly.' });
    }
};
