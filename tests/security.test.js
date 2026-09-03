const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { generateOtp, hashOtp, hashResetToken, isAllowedPortalUrl, normalizeEmail, isApprovedStaffEmail, isSeedAdminEmail } = require('../api/_security');
const { getClientIp, parseUserAgent } = require('../api/_auditMetadata');
const { normalizeRetention, retentionDurationMs } = require('../api/_auditRetention');
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

test('ordinary sign-in does not request OTP, while password reset does', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const requestOtpSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'request-login-otp.js'), 'utf8');
    const verifyOtpSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'verify-login-otp.js'), 'utf8');

    const loginStart = appSource.indexOf('async handleLogin()');
  const loginEnd = appSource.indexOf('async requestLoginOtp()', loginStart);
    const login = appSource.slice(loginStart, loginEnd);
    assert.match(login, /await this\.completeLogin\(loginContext\)/);
    assert.doesNotMatch(login, /startLoginOtp|requestLoginOtp|loginOtp\.show/);
    assert.match(appSource, /async startPasswordResetOtp\(\)/);
    assert.match(appSource, /purpose: 'password-reset'/);
    assert.match(appSource, /this\.timeoutPromise\(15000, 'Sending the verification code is taking too long/);
    assert.match(requestOtpSource, /purpose !== 'password-reset'/);
    assert.match(verifyOtpSource, /purpose !== 'password-reset'/);
});

test('starting the password reset OTP actually dispatches the request', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    const start = appSource.indexOf('async startPasswordResetOtp()');
    const body = appSource.slice(start, appSource.indexOf('startLoginOtpCooldown(seconds)', start));

    // requestLoginOtp() bails out early while `sending` is already set, so the
    // starter must leave that flag false or the request never leaves the browser.
    assert.match(body, /sending: false/);
    assert.doesNotMatch(body, /sending: true/);
    assert.match(body, /await this\.requestLoginOtp\(\)/);
});

test('password reset renders its OTP field inline and not behind a separate popup', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(html, /id="password-reset-otp-code" name="passwordResetOtpCode"/);
    assert.match(html, /<template v-if="loginOtp\.show">/);
    assert.doesNotMatch(html, /EMAIL OTP FOR PASSWORD RESET ONLY/);
});

test('every workspace module page renders inside the scrollable main region', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    const mainStart = html.indexOf('<main id="main-content"');
    const mainEnd = html.indexOf('</main>', mainStart);
    assert.ok(mainStart > -1 && mainEnd > mainStart);

    // A module page placed outside <main> is stacked below the full-height
    // workspace by the #app column, so the tab looks blank until the user
    // scrolls past the viewport.
    for (const tab of ['dashboard', 'client-directory', 'doc-generator', 'payslip-generator', 'claims']) {
        const marker = `v-show="currentTab === '${tab}'"`;
        const at = html.indexOf(marker);
        if (at === -1) continue;
        assert.ok(at > mainStart && at < mainEnd, `${tab} module page must live inside <main id="main-content">`);
    }
});

test('every colour utility the markup uses exists in the built stylesheet', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'tailwind.css'), 'utf8');

    // tailwind.css is a committed build, not generated per request, so a utility
    // absent when it was built silently resolves to nothing: the element keeps its
    // light-mode colour, or loses its background entirely. Both have shipped
    // before, and neither surfaces as an error anywhere.
    //
    // Whole class tokens only, variant prefix included. Testing a bare
    // `bg-blue-950` would wrongly flag `dark:bg-blue-950/40`, which is built and
    // shipped under its own escaped selector.
    const COLOURS = 'slate|emerald|red|amber|orange|rose|blue|teal|violet|brand';
    const UTILITY = new RegExp('^(?:[a-z-]+:)*(?:text|bg)-(?:' + COLOURS + ')-[a-z0-9]+(?:$|\\/)');

    const tokens = new Set();
    for (const attr of html.match(/(?::)?class="[^"]*"/g) || []) {
        for (const token of attr.split(/[\s'"`{}\[\],()?]+/)) {
            if (UTILITY.test(token)) tokens.add(token);
        }
    }

    // Tailwind escapes :, / and . in generated selectors.
    const escapeClass = cls => cls.replace(/([:/.])/g, '\\$1');
    const missing = [...tokens].filter(cls => !css.includes('.' + escapeClass(cls))).sort();

    assert.deepEqual(missing, [], 'Not in tailwind.css: ' + missing.join(', ') + '. Rebuild with npm run build:css, or use a shade already present.');
});

test('portal URL validation rejects lookalike and insecure domains', () => {
    // The portal now lives at www.hrconnect.zenqor.com.my. The two addresses it
    // answered on before are still accepted so links already sent stay valid.
    assert.equal(isAllowedPortalUrl('https://www.hrconnect.zenqor.com.my/path'), true);
    assert.equal(isAllowedPortalUrl('https://www.hrconnect.zenqor.com.my'), true);
    assert.equal(isAllowedPortalUrl('https://www.hrct.zenq0r.com/path'), true);
    assert.equal(isAllowedPortalUrl('https://www.hrct.portal.zenqor.com.my/path'), true);
    // Everything else still fails, on either hostname: no bare host, no suffix
    // trickery, no prefix trickery, no plaintext.
    assert.equal(isAllowedPortalUrl('https://hrct.portal.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('https://hrct.zenq0r.com'), false);
    // No bare host, no suffix or prefix trickery on the new address either.
    assert.equal(isAllowedPortalUrl('https://hrconnect.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('https://www.hrconnect.zenqor.com.my.evil.test'), false);
    assert.equal(isAllowedPortalUrl('https://evilwww.hrconnect.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('http://www.hrconnect.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('https://www.hrct.portal.zenqor.com.my.evil.test'), false);
    assert.equal(isAllowedPortalUrl('https://www.hrct.zenq0r.com.evil.test'), false);
    assert.equal(isAllowedPortalUrl('https://evilwww.hrct.portal.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('https://evilwww.hrct.zenq0r.com'), false);
    assert.equal(isAllowedPortalUrl('http://www.hrct.portal.zenqor.com.my'), false);
    assert.equal(isAllowedPortalUrl('http://www.hrct.zenq0r.com'), false);
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

test('Firebase Admin v14 uses modular app, Auth, and Firestore services', () => {
    const modulePath = path.join(__dirname, '..', 'api', '_firebaseAdmin.js');
    const script = `
        const Module = require('node:module');
        const originalLoad = Module._load;
        let initialized = false;
        const app = { name: 'portal-admin' };
        const timestamp = { fromMillis: value => ({ value }) };
        Module._load = (request, parent, isMain) => {
            if (request === 'firebase-admin/app') return {
                cert: serviceAccount => ({ serviceAccount }),
                getApps: () => initialized ? [app] : [],
                getApp: () => app,
                initializeApp: () => { initialized = true; return app; }
            };
            if (request === 'firebase-admin/auth') return { getAuth: receivedApp => ({ app: receivedApp }) };
            if (request === 'firebase-admin/firestore') return { getFirestore: receivedApp => ({ app: receivedApp }), Timestamp: timestamp };
            return originalLoad(request, parent, isMain);
        };
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'test-project' });
        const helper = require(${JSON.stringify(modulePath)});
        if (helper.getAdminApp() !== app || helper.getAdminAuth().app !== app || helper.getAdminFirestore().app !== app || helper.Timestamp !== timestamp) process.exit(1);
    `;
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const helperSource = fs.readFileSync(modulePath, 'utf8');
    const cleanupSource = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    assert.doesNotMatch(helperSource, /admin\.(credential|auth|firestore|apps|initializeApp)/);
    assert.doesNotMatch(cleanupSource, /admin\.(auth|firestore|apps|initializeApp)/);
});

test('Firebase Admin CommonJS runtime pins the compatible jose dependency', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const functionManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'functions', 'package.json'), 'utf8'));
    assert.equal(manifest.overrides['jwks-rsa'].jose, '4.15.9');
    assert.equal(functionManifest.overrides['jwks-rsa'].jose, '4.15.9');
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

test('RBAC sign-in has no trusted-device bypass', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const otpSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'verify-login-otp.js'), 'utf8');
    assert.doesNotMatch(appSource, /checkTrustedDevice|trustDevice|revokeTrustedDeviceAccess|forgetTrustedDevice/);
    assert.doesNotMatch(otpSource, /trusted_login_devices|trustedUntil|trustDevice/);
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'api', '_trustedDevice.js')), false);
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
    assert.match(rulesSource, /allow read: if isApprovedStaffSession\(\) \|\| \(isClient\(\) && request\.auth\.uid == userId\)/);
});

test('staff identity requires an exact approved Authentication email domain', () => {
    assert.equal(isApprovedStaffEmail('person@zenq0r.com'), true);
    assert.equal(isApprovedStaffEmail('PERSON@ZENQOR.COM.MY'), true);
    assert.equal(isApprovedStaffEmail('person@client.zenq0r.com'), false);
    assert.equal(isApprovedStaffEmail('person@zenq0r.com.evil.test'), false);
    assert.equal(isApprovedStaffEmail('person@fakezenqor.com.my'), false);
    assert.equal(isApprovedStaffEmail('person@other.test'), false);
});

test('Staff domains are enforced while registered Client email access remains available', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    assert.match(appSource, /allowedStaffDomains:\s*\['zenq0r\.com', 'zenqor\.com\.my'\]/);
    assert.match(appSource, /this\.allowedStaffDomains\.includes\(emailDomain\)/);
    assert.match(appSource, /this\.authView === 'staff' && !this\.isStaffEmail\(this\.loginForm\.email\)/);
    assert.match(appSource, /this\.userModal\.form\.role !== 'Client' && !this\.isStaffEmail\(this\.userModal\.form\.email\)/);
    assert.match(appSource, /return role === 'Client' \|\| this\.isStaffEmail\(email\)/);
    assert.match(appSource, /isSeedAdminEmail\(email\)/);
    assert.match(appSource, /if \(this\.isSeedAdminEmail\(normalizedEmail\)\)/);
    assert.match(appSource, /!this\.isPortalEmailAllowed\(this\.userProfile\.email, currentUser\.role\) && !this\.isSeedAdminEmail\(this\.userProfile\.email\)/);
    assert.match(appSource, /error\?\.code === 'permission-denied' && !this\.isSeedAdminEmail\(this\.userProfile\.email\)/);
    assert.match(appSource, /async revokeCurrentPortalAccess\(/);
    // A missing profile or a denied listener still ends the session — but only
    // after a server round-trip on a freshly minted token confirms it, so a
    // cached snapshot or a token invalidated by a password change cannot lock
    // out a valid account. See the dedicated test below.
    assert.match(appSource, /if \(!snapshot\.exists\(\)\) \{\s*(\/\/[^\n]*\n\s*)*this\.revokePortalAccessIfConfirmed\(/);
    assert.match(appSource, /error\?\.code === 'permission-denied'\) this\.revokePortalAccessIfConfirmed\(/);
    assert.match(rulesSource, /function hasApprovedCompanyEmail\(email\)/);
    assert.match(rulesSource, /function isApprovedStaffSession\(\)/);
    assert.match(rulesSource, /data\.role == 'Client'/);
    assert.match(rulesSource, /email\.matches\('\^\[\^@\]\+@zenq0r\[\.\]com\$'\)/);
    assert.match(rulesSource, /email\.matches\('\^\[\^@\]\+@zenqor\[\.\]com\[\.\]my\$'\)/);
    const claimsSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'sync-user-claims.js'), 'utf8');
    // The seed administrator is no longer a string copied into five files; it is
    // one set in api/_security.js that every caller shares. Assert the behaviour
    // rather than the spelling: both the new address and the legacy one count
    // while the account moves, and nothing else does.
    assert.match(claimsSource, /isSeedAdminEmail\(decoded\.email\)/);
    assert.equal(isSeedAdminEmail('info@zenqor.com.my'), true);
    assert.equal(isSeedAdminEmail('admin@zenq0r.com'), true);
    assert.equal(isSeedAdminEmail('  INFO@Zenqor.Com.My  '), true, 'must normalise case and spacing');
    assert.equal(isSeedAdminEmail('annas@zenqor.com.my'), false);
    assert.equal(isSeedAdminEmail('info@zenqor.com.my.evil.test'), false);
    assert.equal(isSeedAdminEmail(''), false);
    assert.equal(isSeedAdminEmail(null), false);
    // A profile restored for the seed admin must carry the address that actually
    // signed in, not the constant — or a legacy seed admin is handed a record
    // bearing the other account's email.
    assert.match(claimsSource, /email: String\(decoded\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(claimsSource, /role !== 'Client' && !isApprovedStaffEmail\(email\)/);
    assert.match(claimsSource, /restoredAt: new Date\(\)\.toISOString\(\)/);
});

test('every account runs on its role alone, with no per-user permission override', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    // Custom page access was removed. It could hide a page but could not truly
    // grant one: neither the data subscriptions nor firestore.rules ever read
    // the override, so a granted page opened empty and the admin was told
    // nothing. Permission now comes from the role in one place.
    for (const source of [appSource, html, rulesSource]) {
        assert.doesNotMatch(source, /customAccess/, 'no per-user override may return');
    }
    assert.doesNotMatch(appSource, /accessModules|toggleAccessModule/);
    assert.match(appSource, /const allowedModules = RBAC_ROLES\[this\.userProfile\.role\]/);
    assert.match(rulesSource, /'mustChangePassword', 'updatedAt'/);
    assert.match(html, /<label for="temporary-password" class="zq-label">Current Password<\/label>/);
    assert.match(html, /Enter the password used for this sign-in/);
});

test('Authentication deletion cascades to the matching Firestore portal profile', () => {
    const functionsSource = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
    const firebaseConfig = fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8');
    assert.match(functionsSource, /functions\.auth\.user\(\)\.onDelete/);
    assert.match(functionsSource, /collection\('users'\)\.doc\(user\.uid\)\.delete\(\)/);
    assert.match(firebaseConfig, /"source": "functions"/);
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
    assert.match(source, /currentTab === 'dashboard' && userProfile\.role !== 'Client'/);
    assert.match(source, /zq-client-workspace/);
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
    assert.match(html, /Only this project's Person In Charge, Director or Superadmin — or a staff member with an activity assigned to them here — can view Activity Type and Assigned To\. An assignee can complete their own activity; only the Person In Charge, Director or Superadmin can schedule, edit or delete them/);
});

test('only Directors and Superadmins can view all Project Activities', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(rules, /isProjectManager\(\) \|\| \(\s*isApprovedStaffSession\(\) &&\s*resource\.data\.ownerEmail is string/);
    assert.match(app, /const mustUseAssignedScope = this\.userProfile\.role !== 'Client' && !this\.canManageProjects/);
    assert.match(app, /where\('ownerEmail', '==', String\(this\.userProfile\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)/);
    // Opening a Client Task only FILTERS the board, which is itself still scoped
    // per role — so the click is gated on Project Activities access, not on being
    // a manager. The old Director-only block is gone.
    assert.doesNotMatch(app, /Only Director or Superadmin can open Project Activities from Client Task/);
    assert.match(app, /canOpenClientTaskBoard\(\) \{ return this\.hasAccess\('project-activities'\); \}/);
    assert.match(app, /if \(!this\.canOpenClientTaskBoard\) \{/);
    assert.match(html, /:tabindex="canOpenClientTaskBoard \? 0 : -1"/);
    // Staff cannot read the Client Directory, so their Client Task cards are
    // rebuilt from the projects they already hold rather than from customers.
    assert.match(app, /clientTaskSource\(\) \{\s*if \(this\.canReadClientDirectory\) return this\.customers\.filter/);
    assert.match(app, /this\.clientTaskSource\.forEach\(cust => \{/);
    assert.match(html, /v-if="canManageProjects && userProfile\.role !== 'Client'"/);
    assert.match(html, /My Assigned Project Activities/);
    // The non-manager scope is PIC assignments PLUS projects holding an activity
    // assigned to this employee — never the whole board.
    assert.match(app, /this\.assignedActivityProjectIds\.has\(project\.id\)/);
    assert.match(html, /Click a company to open its Project Activities\. You see the projects you run as Person In Charge and those with an activity assigned to you/);
});

test('a staff activity assignee can open the project activities they are assigned to', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    // The assignee reads their own activity, and the project card it opens from
    // via the denormalized activityAssigneeEmails index on the project.
    assert.match(rules, /resource\.data\.assignedEmail == request\.auth\.token\.email/);
    assert.match(rules, /resource\.data\.get\('activityAssigneeEmails', \[\]\)\.hasAny\(\[request\.auth\.token\.email\]\)/);
    // Only the PIC or a Project Manager may maintain that index, and only that
    // one key plus the audit timestamp — never the stage, client or owner.
    assert.match(rules, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\[\s*'activityAssigneeEmails', 'updatedAt'\s*\]\)/);

    // Both grants are subscribed as separate queries and merged by doc id, since
    // Firestore cannot OR across two different fields.
    assert.match(app, /where\('activityAssigneeEmails', 'array-contains', String\(this\.userProfile\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)/);
    assert.match(app, /where\('assignedEmail', '==', String\(this\.userProfile\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\)\)/);
    assert.match(app, /subscribeMergedWithReadySignal\(projectsSources/);
    assert.match(app, /subscribeMergedWithReadySignal\(projectActivitiesSources/);

    // An assignee closes out their own row — and nothing else. The rule pins the
    // write to the four completion fields, so Assigned To and both access indexes
    // cannot move on this path.
    assert.match(rules, /resource\.data\.assignedEmail == request\.auth\.token\.email &&\s*request\.resource\.data\.status == 'Done'/);
    assert.match(app, /canCompleteProjectActivity\(activity\) \{[\s\S]*?String\(activity\?\.assignedEmail \|\| ''\)\.trim\(\)\.toLowerCase\(\) === email/);
    assert.match(html, /v-if="canCompleteProjectActivity\(activity\)"[^>]*markProjectActivityDone\(activity\)/);

    // The index can only ever be recomputed by someone who can see every activity
    // in the project, otherwise a partial view would evict the other assignees.
    assert.match(app, /if \(!project \|\| !this\.canManageProjectActivities\(project\)\) return null;/);

    // Scheduling, editing and deleting stay with the PIC and the Project Managers.
    assert.match(app, /canViewProjectActivityDetails\(project\) \{\s*return this\.canManageProjectActivities\(project\) \|\| this\.isAssignedToProjectActivity\(project\);/);
    assert.match(app, /canManageProjectActivities\(project\) \{\s*return this\.canManageProjects \|\| this\.isProjectOwner\(project\);/);
    assert.match(app, /canDeleteProjectActivity\(\) \{ return this\.canManageProjects; \}/);

    // An assignee sees only their own rows in a project they do not run.
    assert.match(app, /visibleProjectActivitiesFor\(projectId\)/);
    assert.match(html, /v-for="activity in visibleProjectActivitiesFor\(projectPreview\.project\.id\)"/);
});

test('Staff and IT keep their project board without read access to the Client Directory', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    // customers stays closed to Staff/IT, so this.customers is empty for them and
    // the Client Task parent gate has to be skipped rather than hiding every
    // project — including the ones where they are the PIC.
    assert.match(rules, /match \/customers\/\{customerId\} \{\s*allow read: if isAdmin\(\) \|\| isHR\(\) \|\| isAccount\(\)/);
    assert.match(app, /canReadClientDirectory\(\) \{ return this\.hasAccess\('client-directory'\) \|\| this\.hasAccess\('doc-generator'\); \}/);
    assert.match(app, /if \(!this\.canReadClientDirectory\) return true;/);

    // The client file repository stays closed to Staff, so the project preview must
    // not subscribe to it and then paint a permission error over their own project.
    assert.match(rules, /match \/client_documents\/\{documentId\} \{\s*allow read: if isAuthenticated\(\) &&\s*\(\s*isAdmin\(\) \|\| isHR\(\) \|\| isAccount\(\) \|\| isIT\(\)/);
    assert.match(app, /canViewClientDocuments\(\) \{ return \['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Client'\]\.includes\(this\.userProfile\.role\); \}/);
    assert.match(app, /if \(this\.canViewClientDocuments\) this\.loadClientDocuments\(/);
});

test('a valid portal session is never revoked on an unconfirmed signal', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    // updatePassword() bumps the account's validSince, invalidating every token
    // issued before it. Both password-change paths must re-mint before touching
    // Firestore or opening listeners, or a brand-new client is thrown out of the
    // sign-in it just completed.
    const firstLogin = app.slice(app.indexOf("if (flow.mode === 'firstLogin')"), app.indexOf('} else if (flow.source ==='));
    assert.match(firstLogin, /await updatePassword\(context\.firebaseUser, flow\.newPassword\);\s*(\/\/[^\n]*\n\s*)*await context\.firebaseUser\.getIdToken\(true\)/);
    const changePassword = app.slice(app.indexOf('async handleChangePassword()'), app.indexOf('async saveMyProfile()'));
    assert.match(changePassword, /await updatePassword\(user, newPassword\);\s*(\/\/[^\n]*\n\s*)*await user\.getIdToken\(true\)/);

    // No listener path may announce a revocation directly; each must confirm
    // against the server first.
    assert.match(app, /async isPortalAccessTrulyRevoked\(reason\)/);
    assert.match(app, /async revokePortalAccessIfConfirmed\(reason\)/);
    assert.match(app, /await user\.getIdToken\(true\);(\s*\/\/[^\n]*)*\s*const snapshot = await getDocFromServer\(doc\(db, 'users', user\.uid\)\);/);
    // A transient failure keeps the session; only a freshly-minted token that is
    // still refused counts as a real revocation.
    assert.match(app, /if \(error\?\.code === 'permission-denied'\) return !this\.isSeedAdminEmail\(user\.email\);/);

    const listeners = app.slice(app.indexOf('const userSubscription = canReadUserDirectory'), app.indexOf('const initialLoads = ['));
    assert.doesNotMatch(listeners, /this\.revokeCurrentPortalAccess\(/);
    assert.match(listeners, /this\.revokePortalAccessIfConfirmed\(/);
});

test('an unreachable Firestore is never reported as removed portal access', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const config = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');

    // getDoc() answers from the local cache once Firestore's transport is down, and
    // a document that was never cached comes back missing rather than as an error.
    // Both callers of this loader turn a null return into a sign-out that tells the
    // account an administrator revoked it, so the users/{uid} read that decides it
    // has to be server-confirmed.
    const loader = app.slice(app.indexOf('async loadOrMigrateUserMetadata(firebaseUser)'), app.indexOf('sendWelcomeEmail(userForm)'));
    assert.ok(loader.length > 0, 'loadOrMigrateUserMetadata not found in app.js');
    assert.match(loader, /const userSnapshot = await getDocFromServer\(userRef\);/);
    assert.doesNotMatch(loader, /getDoc\(userRef\)/);

    // That accusing message stays reserved for an answer the server actually gave.
    const provisioningRefusals = app.match(/not provisioned or your access has been revoked/g) || [];
    assert.equal(provisioningRefusals.length, 2);
    assert.equal((app.match(/if \(!userData && !isSeedAdmin\)/g) || []).length, 2);

    // Credentials were already accepted by the time the loader runs, so a failure
    // there is a connection problem — never a wrong password the user should retype.
    assert.match(app, /const isCredentialFailure = String\(error\?\.code \|\| ''\)\.startsWith\('auth\/'\);/);
    assert.match(app, /isCredentialFailure\s*\?\s*'Invalid email or password credentials[^']*'\s*:\s*'We could not reach the portal/);

    // One copy of the SDK for the whole portal. Every symbol comes through
    // firebase-config.js, which pins the version in a single place; a second copy
    // pulled straight from the CDN would be handed a DocumentReference it does not
    // recognise, and it would fail on exactly the reads that decide whether a
    // session ends.
    assert.match(app, /import \{[\s\S]{0,1200}?\s+getDocFromServer,[\s\S]{0,1200}?\} from "\.\/firebase-config\.js";/);
    assert.doesNotMatch(app, /await import\("https:\/\/www\.gstatic\.com\/firebasejs\//);
    assert.match(config, /import \{[\s\S]{0,1200}?\s+getDocFromServer,[\s\S]{0,1200}?\} from "https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-firestore\.js";/);
    assert.equal((config.match(/^\s+getDocFromServer,\s*$/gm) || []).length, 2);
});

test('a normal logout cannot be labelled as removed portal access', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const normalLogout = app.slice(app.indexOf('async handleLogout()'), app.indexOf('stayOnPortal()'));
    const authObserver = app.indexOf('onAuthStateChanged(auth');
    const signedOutStart = app.indexOf('            } else {', authObserver);
    const signedOutObserver = app.slice(signedOutStart, app.indexOf('            this.authLoading = false;', signedOutStart));

    // The intent is set before Firebase signs the user out, and the stale error
    // is cleared before the login screen is displayed. A genuine revocation
    // explicitly clears that intent before it sets its own error.
    assert.match(normalLogout, /this\.intentionalLogoutInProgress = true;\s*this\.loginError = '';/);
    assert.match(signedOutObserver, /if \(this\.intentionalLogoutInProgress\) this\.loginError = '';/);
    assert.match(app, /async revokeCurrentPortalAccess\([\s\S]{0,240}?this\.intentionalLogoutInProgress = false;\s*this\.loginError = message;/);
});

// Lifts a method body straight out of app.js so this exercises the code that
// actually ships, rather than a copy that can drift from it.
function liftAppMethod(appSource, name) {
    const start = appSource.indexOf(`\n        ${name}(`);
    assert.ok(start >= 0, `method ${name} not found in app.js`);
    const end = appSource.indexOf('\n        },', start);
    assert.ok(end > start, `could not delimit ${name} in app.js`);
    const body = appSource.slice(start + 9, end + '\n        }'.length).trim();
    return eval('(' + body.replace(new RegExp('^' + name), 'function') + ')');
}

test('website content shows the newest work first, whatever shape its dates are in', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    const ctx = {};
    ctx.toComparableIsoDate = liftAppMethod(app, 'toComparableIsoDate');
    ctx.websiteContentDateKey = liftAppMethod(app, 'websiteContentDateKey').bind(ctx);
    ctx.sortGalleryItemsNewestFirst = liftAppMethod(app, 'sortGalleryItemsNewestFirst').bind(ctx);

    // createdAt is a Firestore Timestamp on the older records in this collection
    // and an ISO string on the newer ones. Both must normalise, or the fallback
    // sorts nowhere near a real date.
    assert.equal(ctx.toComparableIsoDate('2026-08-26T18:20:12.101Z'), '2026-08-26T18:20:12.101Z');
    assert.equal(ctx.toComparableIsoDate({ toDate: () => new Date('2026-08-19T10:02:00Z') }).slice(0, 10), '2026-08-19');
    assert.equal(ctx.toComparableIsoDate({ seconds: Date.UTC(2026, 7, 19) / 1000 }).slice(0, 10), '2026-08-19');
    assert.equal(ctx.toComparableIsoDate(null), '');

    // The card shows eventDate, so eventDate is what orders the list — not the
    // moment the record happened to be typed into the portal.
    const ts = (iso) => ({ toDate: () => new Date(iso) });
    const items = [
        { title: 'huaRui', eventDate: '2026-07-10', createdAt: ts('2026-08-19T10:02:00Z') },
        { title: 'fateFloor', eventDate: '2026-07-21', createdAt: ts('2026-08-19T10:01:00Z') },
        { title: 'moguWash', eventDate: '2026-07-13', createdAt: '2026-08-26T18:20:12.101Z' },
        { title: 'monsta', eventDate: '2026-08-08', createdAt: ts('2026-08-19T10:03:00Z') },
        { title: 'legacy', createdAt: ts('2026-07-15T09:00:00Z') }
    ];
    const sorted = ctx.sortGalleryItemsNewestFirst(items);

    assert.deepEqual(sorted.map(i => i.title), ['monsta', 'fateFloor', 'legacy', 'moguWash', 'huaRui']);
    // A record saved before eventDate existed falls back to createdAt and keeps
    // its place in the run rather than pinning to either end or disappearing.
    assert.equal(sorted.length, items.length);
    assert.equal(ctx.sortGalleryItemsNewestFirst(items) !== items, true, 'must not sort the source array in place');

    const keys = sorted.map(i => ctx.websiteContentDateKey(i).slice(0, 10));
    assert.deepEqual(keys, [...keys].sort().reverse());

    // Both gallery collections go through the shared sorter.
    assert.match(app, /this\.websiteContent\.portfolio_web = this\.sortGalleryItemsNewestFirst\(/);
    assert.match(app, /this\.websiteContent\.portfolio_gaming = this\.sortGalleryItemsNewestFirst\(/);
    // Services deliberately keeps its curated ascending order — its cards carry
    // no date, so date-sorting them would just scramble the public page.
    assert.match(app, /this\.websiteContent\.services = snapshot\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\)\.sort\(\(a, b\) => String\(a\.createdAt \|\| ''\)/);
});

test('the public licensing page orders by event date without dropping older records', (t) => {
    // The public site lives in a sibling checkout. Skip rather than fail when it
    // is not beside this one — a portal-only clone is a perfectly valid checkout,
    // and this assertion is about the other repo's file, not this one's.
    const page = (() => {
        const p = path.join(__dirname, '..', '..', 'zenqor', 'licensing_permit.html');
        return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    })();
    if (page === null) { t.skip('sibling zenqor checkout not present'); return; }

    // A Firestore orderBy silently excludes documents missing the field, so
    // ordering by eventDate server-side would erase every pre-eventDate record
    // from the public page. Fetch by createdAt, order in the browser.
    assert.match(page, /orderBy\("createdAt", "desc"\)/);
    // Scoped to the query call: the prose above legitimately names the trap.
    assert.doesNotMatch(page, /query\([^)]*orderBy\("eventDate"/);
    assert.match(page, /const dateKey = \(item\) => String\(item\?\.eventDate \|\| isoOf\(item\?\.createdAt\) \|\| ''\)/);
    assert.match(page, /items\.sort\(\(a, b\) => dateKey\(b\)\.localeCompare\(dateKey\(a\)\)/);
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
    // \r?\n: the checked-out file may use either line ending on Windows, and the
    // assertion is about these selectors being grouped, not about newline style.
    assert.match(theme.slice(printGuard), /\.text-slate-500,\r?\n    html\.dark #app \.print-container \.text-slate-600/);
    assert.match(theme.slice(printGuard), /\.print-table th,\r?\n    html\.dark #app \.print-container \.print-total-box/);
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

test('workspace navigation stays hidden throughout sign-in and session restoration', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.match(html, /<aside v-show="isLoggedIn && !authLoading && !loginLoading"/);
    assert.match(app, /async handleLogin\(\) \{[\s\S]{0,500}?this\.desktopSidebarOpen = false;/);
    assert.match(app, /onAuthStateChanged\(auth, async \(firebaseUser\) => \{[\s\S]{0,300}?this\.desktopSidebarOpen = false;/);
    assert.match(app, /async handleLogout\(\) \{[\s\S]{0,1400}?this\.desktopSidebarOpen = false;/);
});

test('Firebase email action URLs are handled safely alongside legacy reset links', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const config = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const resetApi = fs.readFileSync(path.join(__dirname, '..', 'api', 'request-password-reset.js'), 'utf8');

    assert.match(config, /verifyPasswordResetCode/);
    assert.match(config, /confirmPasswordReset/);
    assert.match(config, /checkActionCode/);
    assert.match(config, /applyActionCode/);
    assert.match(app, /const firebaseMode = params\.get\('mode'\)/);
    assert.match(app, /const firebaseOobCode = params\.get\('oobCode'\)/);
    assert.match(app, /await verifyPasswordResetCode\(auth, firebaseOobCode\)/);
    assert.match(app, /await confirmPasswordReset\(auth, this\.passwordResetFlow\.oobCode/);
    assert.match(app, /await checkActionCode\(auth, firebaseOobCode\)/);
    assert.match(app, /await applyActionCode\(auth, this\.passwordResetFlow\.oobCode\)/);
    assert.match(app, /window\.history\.replaceState\(\{\}, '', window\.location\.pathname\)/);
    assert.match(html, /passwordResetFlow\.mode === 'verifyEmail'/);
    assert.match(html, /passwordResetFlow\.mode === 'recoverEmail'/);
    // The leading slash now comes from PORTAL_URL, which ends in one.
    assert.match(resetApi, /\$\{PORTAL_URL\}auth\/action\?resetToken=/);
});

test('Firebase email action route is served by the portal application', () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
    const actionPage = fs.readFileSync(path.join(__dirname, '..', 'auth', 'action.html'), 'utf8');

    assert.deepEqual(
        config.rewrites.find((rule) => rule.source === '/auth/action'),
        { source: '/auth/action', destination: '/index.html' }
    );
    assert.match(actionPage, /portal\.search = window\.location\.search/);
    assert.match(actionPage, /window\.location\.replace\(portal\.toString\(\)\)/);
});

test('every outbound email sends from one address, and it is not the retired mailbox', () => {
    const { MAIL_FROM } = require('../api/_security');
    // support@zenqor.com.my is no longer read by anyone, so a reply to a
    // password-reset or notification email would have gone nowhere.
    assert.match(MAIL_FROM, /<info@zenqor\.com\.my>$/);
    assert.doesNotMatch(MAIL_FROM, /support@/);

    const senders = ['notify.js', 'request-login-otp.js', '_resetEmail.js'];
    for (const file of senders) {
        const source = fs.readFileSync(path.join(__dirname, '..', 'api', file), 'utf8');
        assert.match(source, /from: MAIL_FROM,/, `${file} must send from the shared constant`);
        assert.match(source, /MAIL_FROM.*=\s*require\('\.\/_security'\)|MAIL_FROM \} = require\('\.\/_security'\)/, `${file} must import it`);
        // A literal address here is how the old value survived in three places.
        assert.doesNotMatch(source, /from: '[^']*@/, `${file} must not hardcode a sender`);
    }
});

test('every link the portal emails out points at the live host', () => {
    const { PORTAL_URL, isAllowedPortalUrl } = require('../api/_security');
    assert.equal(PORTAL_URL, 'https://www.hrconnect.zenqor.com.my/');
    // A link must satisfy the same allowlist the server checks on the way back.
    assert.equal(isAllowedPortalUrl(`${PORTAL_URL}auth/action?resetToken=x`), true);

    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.match(appSource, /const PORTAL_URL = 'https:\/\/www\.hrconnect\.zenqor\.com\.my\/';/);

    // The retired hosts stay in the allowlist so links already sent keep
    // working, but nothing may build a new link with them — that gap is how
    // the reset email kept pointing at a dead address after the portal moved.
    for (const file of ['request-password-reset.js', 'notify.js', '_resetEmail.js']) {
        const source = fs.readFileSync(path.join(__dirname, '..', 'api', file), 'utf8');
        assert.doesNotMatch(source, /hrct\.portal\.zenqor|hrct\.zenq0r/, `${file} must not build a retired-host link`);
    }
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'api', 'request-password-reset.js'), 'utf8'),
        /const resetLink = `\$\{PORTAL_URL\}auth\/action\?resetToken=\$\{token\}`;/);
});
