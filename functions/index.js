// Firebase Authentication lifecycle functions. These run independently of the
// portal UI, so direct deletions from Firebase Console cannot leave a stale
// Portal profile in Firestore.
const functions = require('firebase-functions/v1');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

exports.cleanupDeletedAuthenticationUser = functions.auth.user().onDelete(async (user) => {
    await getFirestore().collection('users').doc(user.uid).delete();
    console.info('Removed Firestore portal profile after Authentication deletion.', { uid: user.uid });
});
