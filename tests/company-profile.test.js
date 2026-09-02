const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('every session loads the company profile, not only the roles that may edit it', () => {
    const appSource = read('app.js');
    const start = appSource.indexOf('const initialLoads = [');
    assert.ok(start > -1, 'initialLoads must remain in loadPortalData');
    const initialLoads = appSource.slice(start, appSource.indexOf('];', start));
    assert.match(initialLoads, /subscribeWithReadySignal\(doc\(db, "settings", "company_profile"\)/);
    // Gating the read on the edit permission is what left clients and
    // non-admin staff rendering build-time defaults instead of saved values.
    assert.doesNotMatch(initialLoads, /canManageCompanySettings\s*\n?\s*\?\s*subscribeWithReadySignal\(doc\(db, "settings", "company_profile"\)/);
});

test('the company profile is readable by any session while the rest of settings is not', () => {
    const lines = read('firestore.rules').split(/\r?\n/);
    const start = lines.findIndex(line => line.includes('match /settings/{docId}'));
    assert.ok(start > -1, 'the settings rule must remain identifiable');
    // The block is the match line plus its allow statements, up to the brace
    // that closes it — slicing on the first "}" would stop inside "{docId}".
    const settings = lines.slice(start, start + 4).join('\n');
    // Readable by a signed-in client, but only that one document.
    assert.match(settings, /allow read:.*docId == 'company_profile'/);
    // audit_retention and anything else added later stay with Admin and IT.
    assert.doesNotMatch(settings, /allow read: if isAuthenticated\(\);/);
    assert.match(settings, /allow write: if isAdmin\(\) \|\| isIT\(\);/);
});

test('company-facing copy reads the name from settings rather than hardcoding it', () => {
    const page = read('index.html');
    const lines = page.split(/\r?\n/);
    // The splash screen paints while loginLoading is true, before any session
    // exists to read a profile with, so its literals are the one exemption.
    const splashStart = lines.findIndex(line => line.includes('class="login-splash'));
    assert.ok(splashStart > -1, 'splash screen must remain identifiable');
    const splashEnd = splashStart + lines.slice(splashStart).findIndex(line => line.includes('Preparing your secure workspace'));
    const offenders = lines
        .map((line, i) => ({ line, no: i + 1 }))
        .filter(({ line }) => /ZENQOR TECHNOLOGIES|ZENQOR Technologies/.test(line))
        // The company name is allowed beside a settings-backed fallback.
        .filter(({ line }) => !line.includes('company.name'))
        .filter(({ no }) => no - 1 < splashStart || no - 1 > splashEnd)
        .map(({ no, line }) => `${no}: ${line.trim().slice(0, 80)}`);
    assert.deepEqual(offenders, [], `hardcoded company name outside the splash screen:\n${offenders.join('\n')}`);
});
