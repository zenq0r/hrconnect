const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readSource } = require('./helpers/sources');

const config = () => readSource('firebase-config.js');

test('Firestore falls back to long polling only where the stream actually fails', () => {
    const src = config();
    // ERR_QUIC_PROTOCOL_ERROR: the WebChannel stream dies behind a broken QUIC
    // path or a buffering proxy, and listeners stall until they retry.
    assert.match(src, /initializeFirestore\(app, \{ experimentalAutoDetectLongPolling: true \}\)/);
    // Forcing it would slow every healthy client down to fix the few that break.
    // Match it as a setting, not as a word — the comment above the call names it.
    assert.doesNotMatch(src, /experimentalForceLongPolling\s*:/);
});

test('settings are applied at initialization, not bolted on afterwards', () => {
    const src = config();
    // getFirestore(app) takes no settings, and once it has run the instance is
    // fixed — initializeFirestore has to be the first call.
    assert.doesNotMatch(src, /^\s*const db = getFirestore\(app\)/m);
    assert.doesNotMatch(src, /^\s*getFirestore,$/m, 'the unused import must be gone');

    const initAt = src.indexOf('initializeFirestore(app,');
    const authAt = src.indexOf('getAuth(app)');
    const storageAt = src.indexOf('getStorage(app)');
    assert.ok(initAt > -1 && initAt < authAt && initAt < storageAt,
        'Firestore must be initialized before the other services are taken');
});
