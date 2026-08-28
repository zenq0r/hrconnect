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

test('deleting a Client Task cascades its projects but preserves its Client Directory record', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const taskMenuStart = appSource.indexOf('clientTaskMenuItems(cust)');
    const taskMenu = appSource.slice(taskMenuStart, appSource.indexOf('// Shared by the board card', taskMenuStart));
    const removeTaskStart = appSource.indexOf('async deleteClientTask(cust)');
    const removeTask = appSource.slice(removeTaskStart, appSource.indexOf('// Generic context menu', removeTaskStart));
    assert.match(taskMenu, /requestDeleteClientTask\(cust\)/);
    assert.match(taskMenu, /Delete Client Task and Projects/);
    assert.match(removeTask, /linkedProjects/);
    assert.match(removeTask, /project_activities/);
    assert.match(removeTask, /project_client_updates/);
    assert.match(removeTask, /childDeletes\.forEach\(item => batch\.delete\(doc\(db, item\.collection, item\.id\)\)/);
    assert.match(removeTask, /clientTaskCreatedAt:\s*deleteField\(\)/);
    assert.match(removeTask, /batch\.update\(customerRef/);
    assert.doesNotMatch(removeTask, /deleteDoc\(doc\(db, 'customers'/);
});

test('each new project creates or uses a mandatory Client Task parent atomically', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.match(appSource, /creationBatch\.set\(doc\(db, 'customers', payload\.clientDirectoryId\)/);
    assert.match(appSource, /creationBatch\.set\(doc\(db, 'projects', projectId\), payload\)/);
    assert.match(appSource, /ensureClientTasksForExistingProjects/);
    assert.match(rulesSource, /function hasClientTaskParent\(clientDirectoryId\)/);
    assert.match(rulesSource, /hasClientTaskParent\(request\.resource\.data\.clientDirectoryId\)/);
});

test('Project Activities only display projects under a registered Client Task', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const filterStart = appSource.indexOf('registeredClientTaskIds()');
    const filterEnd = appSource.indexOf('projectClientAccessUsers()', filterStart);
    const projectFilter = appSource.slice(filterStart, filterEnd);
    const groupingStart = appSource.indexOf('getClientGroupsByStage(stage)');
    const groupingEnd = appSource.indexOf('toggleClientGroup(groupKey)', groupingStart);
    const projectGrouping = appSource.slice(groupingStart, groupingEnd);

    assert.match(projectFilter, /customer\.clientTaskCreatedAt/);
    assert.match(projectFilter, /isProjectLinkedToRegisteredClientTask\(project\)/);
    assert.match(projectFilter, /\.filter\(project => this\.isProjectLinkedToRegisteredClientTask\(project\)\)/);
    assert.match(projectGrouping, /if \(!this\.isProjectLinkedToRegisteredClientTask\(project\)\) return;/);
    assert.doesNotMatch(projectGrouping, /unlinked-/);
});

test('legacy Project Activities can only be re-linked to one matching registered Client Task', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const repairStart = appSource.indexOf('async repairLegacyProjectClientLinks()');
    const repairEnd = appSource.indexOf('async saveClientTask()', repairStart);
    const repair = appSource.slice(repairStart, repairEnd);

    assert.match(repair, /this\.customers\.filter\(customer => customer\?\.id && customer\.clientTaskCreatedAt\)/);
    assert.match(repair, /normalizeClientKey\(customer\.clientSSM\) === projectSSM/);
    assert.match(repair, /normalizeClientKey\(customer\.clientName\) === projectName/);
    assert.match(repair, /if \(candidates\.length === 1\)/);
    assert.match(repair, /batch\.update\(doc\(db, 'projects', project\.id\)/);
    assert.doesNotMatch(repair, /deleteDoc|batch\.delete/);
});

test('Client Portal does not render obsolete dashboard layers or overlapping hero grid', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(source, /<div v-if="currentTab === 'dashboard'"/);
    assert.doesNotMatch(source, /portal-hero-dot-/);
    assert.match(source, /relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between/);
});

test('incoming portal notifications are recipient-scoped and protected from client-side creation', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const notifier = fs.readFileSync(path.join(__dirname, '..', 'api', 'notify.js'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    assert.match(rules, /match \/portal_notifications\/\{notificationId\}/);
    assert.match(rules, /resource\.data\.recipientUid == request\.auth\.uid/);
    assert.match(rules, /allow create, delete: if false/);
    assert.match(notifier, /createWebsiteNotifications/);
    assert.match(notifier, /expandAuthorizedClientRecipients/);
    assert.match(app, /portalNotificationsSource/);
});

test('only the current project PIC can load or manage project activity details', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(rules, /resource\.data\.projectOwnerEmail == request\.auth\.token\.email/);
    assert.match(rules, /request\.resource\.data\.projectOwnerEmail == get\(\/databases\/\$\(database\)\/documents\/projects\/\$\(request\.resource\.data\.projectId\)\)\.data\.ownerEmail/);
    assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/projects\/\$\(resource\.data\.projectId\)\)\.data\.ownerEmail/);
    assert.match(app, /where\('projectOwnerEmail', '==', String\(this\.userProfile\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)/);
    assert.match(app, /canViewProjectActivityDetails\(project\)/);
    assert.match(app, /projectOwnerEmail: String\(project\.ownerEmail \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(html, /v-if="canViewProjectActivityDetails\(projectPreview\.project\)"/);
    assert.match(html, /Only this project's Person In Charge, Director or Superadmin can view or change Activity Type and Assigned To/);
});

test('only Directors and Superadmins can view all Project Activities', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(rules, /isProjectManager\(\) \|\| \(\s*!isClient\(\) &&\s*resource\.data\.ownerEmail is string/);
    assert.match(app, /const mustUseAssignedScope = this\.userProfile\.role !== 'Client' && !this\.canManageProjects/);
    assert.match(app, /where\('ownerEmail', '==', String\(this\.userProfile\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)/);
    assert.match(app, /Only Director or Superadmin can open Project Activities from Client Task/);
    assert.match(app, /this\.canManageProjects \? \{ label: 'View Board'/);
    assert.match(html, /v-if="canManageProjects && userProfile\.role !== 'Client'"/);
    assert.match(html, /My Assigned Project Activities/);
    assert.match(html, /Project Activities are visible only to the assigned Person In Charge/);
});

test('audit retention form fields have stable identifiers for browser autofill', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(html, /id="audit-retention-value" name="auditRetentionValue"/);
    assert.match(html, /id="audit-retention-unit" name="auditRetentionUnit"/);
});

test('dynamic status colors include their dark-mode counterparts in the built stylesheet', () => {
    const config = fs.readFileSync(path.join(__dirname, '..', 'tailwind.config.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'tailwind.css'), 'utf8');
    const theme = fs.readFileSync(path.join(__dirname, '..', 'custom.css'), 'utf8');

    assert.match(config, /'\.\/app\.js'/);
    ['.dark\\:bg-blue-900\\/50', '.dark\\:bg-amber-900\\/50', '.dark\\:bg-emerald-900\\/50', '.dark\\:bg-purple-900\\/50'].forEach(selector => {
        assert.equal(css.includes(selector), true, `Missing compiled selector: ${selector}`);
    });
    assert.match(theme, /Theme compatibility layer/);
    assert.match(theme, /text-brand-blue:not\(\[class\*="dark:text-"\]\)/);
});

test('quotation and invoice workspace uses explicit paired light and dark theme surfaces', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const theme = fs.readFileSync(path.join(__dirname, '..', 'custom.css'), 'utf8');

    ['zq-document-editor', 'zq-party-selector', 'zq-party-selector-summary', 'zq-payment-details', 'zq-document-section-heading'].forEach(className => {
        assert.match(html, new RegExp(className));
    });
    assert.match(theme, /\.dark #app \.zq-document-editor/);
    assert.match(theme, /\.dark #app \.zq-party-selector,/);
    assert.match(theme, /\.dark #app \.zq-party-selector-summary/);
});

test('dark mode cannot override the light print palette', () => {
    const theme = fs.readFileSync(path.join(__dirname, '..', 'custom.css'), 'utf8');
    const printGuard = theme.lastIndexOf('Print is always a light document');
    const darkCompatibility = theme.indexOf('Theme compatibility layer');

    assert.ok(printGuard > darkCompatibility, 'print palette must be declared after dark compatibility rules');
    assert.match(theme.slice(printGuard), /html\.dark #app \.print-container/);
    assert.match(theme.slice(printGuard), /\.text-slate-500,\n    html\.dark #app \.print-container \.text-slate-600/);
    assert.match(theme.slice(printGuard), /\.print-table th,\n    html\.dark #app \.print-container \.print-total-box/);
});

test('every portal button has a safe right-click and long-press quick-action menu', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(app, /installUniversalButtonContextMenu\(\)/);
    assert.match(app, /closest\('button, \[role="button"\]'\)/);
    assert.match(app, /addEventListener\('contextmenu', this\.buttonContextHandlers\.contextmenu, true\)/);
    assert.match(app, /addEventListener\('touchstart', this\.buttonContextHandlers\.touchstart, true\)/);
    assert.match(app, /Use: \$\{label\}/);
    assert.match(app, /Copy action name/);
    assert.match(app, /removeUniversalButtonContextMenu\(\)/);
    assert.match(html, /zq-context-menu/);
});
