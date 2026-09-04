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
// change) and api/set-portal-lock.js, so the two can never disagree about what a
// locked account is allowed to carry.
async function buildPortalClaims(db, { role, email, accessLocked }) {
    if (accessLocked === true) return {};

    const claims = { role };
    if (role === 'Client' && email) {
        // Primary contact match first, then fall back to additionalClientEmails —
        // lets a client company authorize more than one login (e.g. their finance
        // contact) against the same customers/{clientDirectoryId} record.
        let custSnap = await db.collection('customers')
            .where('clientEmail', '==', email).limit(1).get();
        if (custSnap.empty) {
            custSnap = await db.collection('customers')
                .where('additionalClientEmails', 'array-contains', email).limit(1).get();
        }
        if (!custSnap.empty) claims.clientDirectoryId = custSnap.docs[0].id;
    }
    return claims;
}

module.exports = { buildPortalClaims };
