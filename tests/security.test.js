const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { generateOtp, hashOtp, hashResetToken, isAllowedPortalUrl, normalizeEmail, requiresOtpRole } = require('../api/_security');
const { getClientIp, parseUserAgent } = require('../api/_auditMetadata');
const { normalizeRetention, retentionDurationMs } = require('../api/_auditRetention');
const { clearTrustedCookie, hashToken, parseCookie, trustedCookie, trustedDurationMs } = require('../api/_trustedDevice');
const { rateLimitId } = require('../api/_rateLimit');

test('OTP is always a six-digit string', () => {
    for (let i = 0; i < 100; i += 1) assert.match(generateOtp(), /^\d{6}$/);
});

test('OTP codes are hashed before server-side storage', () => {
    const code = '123456';
    assert.equal(hashOtp(code).length, 64);
    assert.equal(hashOtp(code), hashOtp(code));
    assert.equal(hashOtp(code).includes(code), false);
});

test('password reset tokens are not stored using the raw link secret', () => {
    const token = 'raw-password-reset-secret';
    assert.equal(hashResetToken(token).length, 64);
    assert.equal(hashResetToken(token).includes(token), false);
});

test('OTP is mandatory for every provisioned RBAC role', () => {
    ['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Staff', 'Client'].forEach(role => assert.equal(requiresOtpRole(role), true));
    assert.equal(requiresOtpRole('Unknown'), false);
});

test('portal URL validation rejects lookalike and insecure domains', () => {
    assert.equal(isAllowedPortalUrl('https://www.hrct.portal.zenqor.com.my/path'), true);
    assert.equal(isAllowedPortalUrl('https://www.hrct.portal.zenqor.com.my'), true);
    assert.equal(isAllowedPortalUrl('https://hrct.portal.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('https://www.hrct.portal.zenqor.com.my.evil.test'), false);
    assert.equal(isAllowedPortalUrl('https://evilwww.hrct.portal.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('http://www.hrct.portal.zenqor.com.my'), false);
});

test('email normalization trims, lowercases, and rejects malformed input', () => {
    assert.equal(normalizeEmail(' User@Example.COM '), 'user@example.com');
    assert.equal(normalizeEmail('not-an-email'), null);
    assert.equal(normalizeEmail(null), null);
});

test('Firebase Admin initialization fails clearly when credentials are absent', () => {
    const modulePath = path.join(__dirname, '..', 'api', '_firebaseAdmin.js');
    const script = `delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY; require(${JSON.stringify(modulePath)}).getAdminApp()`;
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set/);
    assert.doesNotMatch(result.stderr, /reading 'length'/);
});

test('audit metadata extracts the trusted client IP and readable browser details', () => {
    assert.equal(getClientIp({ 'x-vercel-forwarded-for': '203.0.113.8, 10.0.0.1' }), '203.0.113.8');
    const metadata = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36');
    assert.equal(metadata.browser, 'Google Chrome 140.0.0.0');
    assert.equal(metadata.os, 'Windows 10/11');
    assert.equal(metadata.device, 'Desktop');
});

test('audit retention validates supported units and calculates expiry duration', () => {
    assert.equal(normalizeRetention(2, 'hour').durationMs, 2 * 60 * 60 * 1000);
    assert.equal(retentionDurationMs({ value: 3, unit: 'week' }), 21 * 24 * 60 * 60 * 1000);
    assert.equal(normalizeRetention(0, 'day'), null);
    assert.equal(normalizeRetention(1, 'minute'), null);
});

test('trusted-device duration is shorter for sensitive roles', () => {
    const day = 24 * 60 * 60 * 1000;
    ['Superadmin', 'Director', 'HR', 'Account', 'IT'].forEach(role => assert.equal(trustedDurationMs(role), 7 * day));
    ['Staff', 'Client'].forEach(role => assert.equal(trustedDurationMs(role), 30 * day));
});

test('trusted-device tokens are hashed and cookies use strict security flags', () => {
    const rawToken = 'secret-device-token';
    assert.equal(hashToken(rawToken).length, 64);
    assert.equal(hashToken(rawToken).includes(rawToken), false);
    const cookie = trustedCookie(rawToken, 3600);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(parseCookie(`other=x; ${cookie}`), rawToken);
    assert.match(clearTrustedCookie(), /Max-Age=0/);
});

test('API rate-limit identifiers are deterministic and do not expose user identifiers', () => {
    const id = rateLimitId('notify', 'client-uid-123');
    assert.equal(id.length, 64);
    assert.equal(id, rateLimitId('notify', 'client-uid-123'));
    assert.notEqual(id, rateLimitId('audit-log', 'client-uid-123'));
    assert.equal(id.includes('client-uid-123'), false);
});

test('Client accounts cannot subscribe to or read the internal user directory', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.match(appSource, /const canReadUserDirectory = role !== 'Client'/);
    assert.match(rulesSource, /allow read: if isAuthenticated\(\) && \(!isClient\(\) \|\| request\.auth\.uid == userId\)/);
});

test('removing a Client Task never deletes its Client Directory record', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const taskMenuStart = appSource.indexOf('clientTaskMenuItems(cust)');
    const taskMenu = appSource.slice(taskMenuStart, appSource.indexOf('// Shared by the board card', taskMenuStart));
    const removeTaskStart = appSource.indexOf('async deleteClientTask(cust)');
    const removeTask = appSource.slice(removeTaskStart, appSource.indexOf('// Generic context menu', removeTaskStart));
    assert.match(taskMenu, /requestDeleteClientTask\(cust\)/);
    assert.match(removeTask, /clientTaskCreatedAt:\s*deleteField\(\)/);
    assert.match(removeTask, /updateDoc\(doc\(db, 'customers', cust\.id\)/);
    assert.doesNotMatch(removeTask, /deleteDoc\(/);
});

test('Client Portal does not render obsolete dashboard layers or overlapping hero grid', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(source, /<div v-if="currentTab === 'dashboard'"/);
    assert.doesNotMatch(source, /portal-hero-dot-/);
    assert.match(source, /relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between/);
});
