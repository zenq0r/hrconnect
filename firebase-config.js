// ============================================================
// ZENQOR TECHNOLOGIES - firebase-config.js (SAFE AUTH & DB v2.9 - FIRESTORE ATTACHMENTS)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
// Analytics is loaded lazily (see below) so its bundle is not downloaded on every
// page load while Analytics is disabled.
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    onSnapshot,
    getDocs,
    writeBatch,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    verifyPasswordResetCode,
    confirmPasswordReset,
    checkActionCode,
    applyActionCode
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
// Imported statically rather than lazily: App Check has to be initialized
// before the first Firestore/Storage call, and a dynamic import would race it.
import {
    initializeAppCheck,
    ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";

// These values are not secrets — the Firebase web config is shipped to every browser
// by design, and access is enforced by Auth + Firestore/Storage Rules, not by hiding
// them. Restrict the API key by HTTP referrer in the Google Cloud console instead.
// (`measurementId` is intentionally empty: Analytics is not enabled for this project.)
const firebaseConfig = {
    apiKey: "AIzaSyDgoE8ckbVWqc1j6bHq1u1685_xJp0y09Y",
    authDomain: "zenqor-portal-a3b2d.firebaseapp.com",
    projectId: "zenqor-portal-a3b2d",
    storageBucket: "zenqor-portal-a3b2d.firebasestorage.app",
    messagingSenderId: "1065187936514",
    appId: "1:1065187936514:web:d05089d6668c58bf3e9a1b",
    measurementId: ""
};

const app = initializeApp(firebaseConfig);

// ---- App Check --------------------------------------------------------
// The reCAPTCHA Enterprise site key is public, like the config above: it is
// bound to the domains registered with it, and the attestation happens on
// Google's side. Paste the key from Firebase Console > App Check > Apps here.
//
// Empty means App Check stays off. That is deliberate — a browser that sends
// no token is fine while App Check is in Monitoring, but the moment anyone
// turns on Enforcement, every unattested Firestore and Storage call is
// refused. So: set the key, deploy, watch Verified climb off 0%, and only
// then enforce. Never enforce first.
//
// Server-side API routes are unaffected either way; the Admin SDK bypasses
// App Check entirely.
const RECAPTCHA_ENTERPRISE_SITE_KEY = '6LdmuqUtAAAAABC7d64yMX3yATeCUMgst0HLh3cn';

if (RECAPTCHA_ENTERPRISE_SITE_KEY) {
    // localhost and CI are always scored as invalid, so a debug token is the
    // only way to work locally once enforcement is on. This prints one to the
    // console; register it under App Check > Apps > Manage debug tokens.
    if (['localhost', '127.0.0.1'].includes(self.location.hostname)) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    try {
        initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
            isTokenAutoRefreshEnabled: true
        });
    } catch (error) {
        // A bad key must not take the portal down while App Check is still in
        // Monitoring — without enforcement the requests go through regardless.
        console.error('App Check failed to initialize:', error?.message || error);
    }
}

// Analytics is optional. Without a measurementId, getAnalytics() still fires an
// internal dynamic-config fetch that rejects (403) and surfaces as an "Uncaught
// (in promise)" FirebaseError on every page load, so only start it when a
// measurementId is actually configured. getAnalytics() throws synchronously on a
// bad config and rejects asynchronously on a blocked fetch — catch both.
if (firebaseConfig.measurementId) {
    // A blocked/failed dynamic-config fetch rejects inside the SDK rather than on the
    // promise returned here, so keep a guard to stop it becoming an unhandled rejection.
    window.addEventListener('unhandledrejection', (event) => {
        if (String(event.reason?.code || '').startsWith('analytics/')) event.preventDefault();
    });
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js")
        .then(async ({ getAnalytics, isSupported }) => {
            if (await isSupported()) getAnalytics(app);
        })
        .catch((error) => console.warn('Analytics disabled:', error?.message || error));
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export {
    db,
    auth,
    storage,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    onSnapshot,
    getDocs,
    writeBatch,
    query,
    where,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    verifyPasswordResetCode,
    confirmPasswordReset,
    checkActionCode,
    applyActionCode,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
};
