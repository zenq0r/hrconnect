// The Firebase Auth custom claims a portal account carries.
//
// storage.rules reads `role` (and `clientDirectoryId` for a Client) straight off
// the ID token rather than calling firestore.get(), because that cross-service
// lookup does not work in this project. The claims are therefore the only thing
// standing between a signed-in session and the file bytes in Storage — which is
// why a LOCKED account is issued no claims at all: userRole() then matches
// nothing in any of storage.rules' role lists and every branch there denies.
// Without this a Staff Portal lock would close Firestore and leave Storage open.
//
// Shared by api/sync-user-claims.js (called after every sign-in and after a role
// change) and api/portal-account.js, so the two can never disagree about what a
// locked account is allowed to carry.
async function buildPortalClaims(db, { role, email, accessLocked }) {
    if (accessLocked === true) return {};

    const claims = { role };
    if (role === 'Client' && email) {
        // Query both fields and reject an ambiguous address. Picking the first
        // document would make the same login point at a different customer
        // depending on Firestore's result order.
        const primarySnap = await db.collection('customers')
            .where('clientEmail', '==', email).get();
        const additionalSnap = await db.collection('customers')
            .where('additionalClientEmails', 'array-contains', email).get();
        const matches = [...primarySnap.docs, ...additionalSnap.docs]
            .filter((doc, index, docs) => docs.findIndex(candidate => candidate.id === doc.id) === index);
        if (matches.length > 1) {
            const error = new Error('This email is registered to more than one Client Directory record. Ask an administrator to keep it on one record only.');
            error.code = 'client/email-ambiguous';
            throw error;
        }
        if (matches.length === 1) {
            claims.clientDirectoryId = matches[0].id;
        } else {
            const error = new Error('This email is not registered in the Client Directory. Ask an administrator to add it to the correct client record.');
            error.code = 'client/email-not-registered';
            throw error;
        }
    }
    return claims;
}

// The roles whose sessions count only once the emailed sign-in code has been
// confirmed. Mirrors SECOND_FACTOR_ROLES in app/constants/rbac.js and
// secondFactorCleared() in firestore.rules and storage.rules.
const SECOND_FACTOR_ROLES = new Set(['Superadmin', 'Director', 'Account']);

// sfa holds the auth_time of the sign-in whose code was confirmed. A later
// password sign-in has a later auth_time, so an old stamp does not match it.
function secondFactorSatisfied(decodedToken, role) {
    if (!SECOND_FACTOR_ROLES.has(role)) return true;
    const stamp = Number(decodedToken?.sfa);
    return stamp > 0 && stamp === Number(decodedToken?.auth_time);
}

// Replaces an account's portal claims without dropping the second-factor
// stamp. setCustomUserClaims() overwrites the whole set, so a role sync after
// the code was confirmed would otherwise sign the session back out of every
// rule that asks for it. A locked account keeps nothing, stamp included.
async function setPortalClaims(adminAuth, uid, claims) {
    const current = (await adminAuth.getUser(uid)).customClaims || {};
    const next = { ...claims };
    if (Object.keys(claims).length && current.sfa) next.sfa = current.sfa;
    await adminAuth.setCustomUserClaims(uid, next);
    return next;
}

module.exports = { buildPortalClaims, setPortalClaims, secondFactorSatisfied, SECOND_FACTOR_ROLES };
