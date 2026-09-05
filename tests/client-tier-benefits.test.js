const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const appSource = () => read('app.js');
const markup = () => read('index.html');
const rules = () => read('firestore.rules');
const styles = () => read('custom.css');

// Pull the tier constants out of app.js and evaluate them, so these tests move
// with the shipped list instead of a copy that can drift away from it.
function tierModel() {
    const src = appSource();
    const start = src.indexOf('const CLIENT_TIER_ORDER =');
    const end = src.indexOf('const CLIENT_PANELS =');
    assert.ok(start > -1 && end > start, 'the client tier constants must remain in app.js');
    return new Function(`${src.slice(start, end)}
        return { CLIENT_TIER_ORDER, CLIENT_TIER_FEATURES, CLIENT_SUPPORT_CHANNELS };`)();
}

// Rebuild the real gate with a stub `this`, the same way the presence tests do.
function buildGate(clientTier) {
    const src = appSource();
    const constStart = src.indexOf('const CLIENT_TIER_ORDER =');
    const constEnd = src.indexOf('const CLIENT_PANELS =');
    const gateStart = src.indexOf('        clientTierAllows(featureKey) {');
    const gateEnd = src.indexOf('        canReplyAsClient(project) {');
    assert.ok(gateStart > -1 && gateEnd > gateStart, 'clientTierAllows must remain in app.js');

    const gate = new Function(`${src.slice(constStart, constEnd)}
        return { ${src.slice(gateStart, gateEnd)} };`)();
    gate.clientPortalIdentity = { clientTier };
    return gate;
}

// --- the model itself ------------------------------------------------------

test('every tier feature names a tier that exists', () => {
    const { CLIENT_TIER_ORDER, CLIENT_TIER_FEATURES } = tierModel();
    assert.deepEqual(CLIENT_TIER_ORDER, ['Standard', 'Premium', 'Priority']);
    for (const feature of CLIENT_TIER_FEATURES) {
        assert.ok(
            Number.isInteger(feature.minTier) && feature.minTier >= 0 && feature.minTier < CLIENT_TIER_ORDER.length,
            `${feature.key} points at tier index ${feature.minTier}, which is not a real tier`
        );
        assert.ok(feature.label && feature.detail, `${feature.key} must carry a label and a detail line`);
    }
});

test('feature keys are unique — a duplicate would silently shadow a gate', () => {
    const keys = tierModel().CLIENT_TIER_FEATURES.map(f => f.key);
    assert.equal(new Set(keys).size, keys.length);
});

test('each tier opens strictly more than the one below it', () => {
    const { CLIENT_TIER_ORDER, CLIENT_TIER_FEATURES } = tierModel();
    const counts = CLIENT_TIER_ORDER.map((_, index) => CLIENT_TIER_FEATURES.filter(f => f.minTier <= index).length);
    for (let i = 1; i < counts.length; i++) {
        assert.ok(counts[i] > counts[i - 1], `${CLIENT_TIER_ORDER[i]} must open more than ${CLIENT_TIER_ORDER[i - 1]}`);
    }
    // Standard is not an empty shell: the basics stay ungated for everyone.
    assert.ok(counts[0] >= 3, 'Standard must keep the core portal functions');
    assert.equal(counts[counts.length - 1], CLIENT_TIER_FEATURES.length, 'the top tier opens everything');
});

test('there is one support channel per tier', () => {
    const { CLIENT_TIER_ORDER, CLIENT_SUPPORT_CHANNELS } = tierModel();
    assert.equal(CLIENT_SUPPORT_CHANNELS.length, CLIENT_TIER_ORDER.length);
    for (const channel of CLIENT_SUPPORT_CHANNELS) assert.ok(channel.name && channel.promise);
});

// --- the gate --------------------------------------------------------------

test('the gate opens exactly the features the tier reaches', () => {
    const { CLIENT_TIER_ORDER, CLIENT_TIER_FEATURES } = tierModel();
    CLIENT_TIER_ORDER.forEach((tier, tierIndex) => {
        const gate = buildGate(tier);
        for (const feature of CLIENT_TIER_FEATURES) {
            assert.equal(
                gate.clientTierAllows(feature.key),
                tierIndex >= feature.minTier,
                `${tier} and ${feature.key}: expected ${tierIndex >= feature.minTier}`
            );
        }
    });
});

test('an unknown or missing tier is treated as the lowest, never the highest', () => {
    // Case variants are NOT unknown — see the stored-case tests below.
    for (const tier of ['', null, undefined, 'Platinum', 'Gold', 'tier-2', '  ']) {
        const gate = buildGate(tier);
        assert.equal(gate.clientTierAllows('project-tracking'), true, 'the basics stay open');
        assert.equal(gate.clientTierAllows('client-reply'), false, `"${tier}" must not open Premium features`);
        assert.equal(gate.clientTierAllows('expiry-alerts'), false, `"${tier}" must not open Priority features`);
    }
});

test('an unrecognised feature key is ungated rather than silently locked', () => {
    assert.equal(buildGate('Standard').clientTierAllows('a-feature-nobody-defined'), true);
});

// --- enforcement, not decoration -------------------------------------------

test('the statement export and the reply path both check the gate themselves', () => {
    const src = appSource();
    for (const [method, key] of [['exportClientStatement', 'account-statement'], ['sendClientReply', 'client-reply']]) {
        const start = src.indexOf(`${method}(`);
        assert.ok(start > -1, `${method} must exist`);
        const body = src.slice(start, start + 900);
        assert.match(
            body,
            new RegExp(`clientTierAllows\\('${key}'\\)`),
            `${method} must refuse on its own, not rely on its button being hidden`
        );
    }
});

test('canReplyAsClient is gated, so every caller inherits the check', () => {
    const src = appSource();
    const start = src.indexOf('        canReplyAsClient(project) {');
    const body = src.slice(start, src.indexOf('        clientProjectStatusBadgeClass(', start));
    assert.match(body, /clientTierAllows\('client-reply'\)/);
});

test('firestore.rules enforces the reply tier server-side and fails closed', () => {
    const source = rules();
    assert.match(source, /function callerTierAllowsReply\(\)/);
    assert.match(source, /clientTier\.upper\(\) == 'PREMIUM'/);
    // A missing customer record must deny, not fall through to allow.
    assert.match(source, /exists\(\/databases\/\$\(database\)\/documents\/customers\/\$\(request\.auth\.token\.clientDirectoryId\)\)/);
    // And it has to actually be wired into the client's create branch.
    const createBranch = source.slice(source.indexOf('match /project_client_updates/'), source.indexOf('allow update:', source.indexOf('match /project_client_updates/')));
    assert.match(createBranch, /isClient\(\) &&\s*callerTierAllowsReply\(\)/);
});

test('a registered client sees their complete history — no tier withholds records', () => {
    const src = appSource();
    const start = src.indexOf('        myClientDocs() {');
    const body = src.slice(start, src.indexOf('        myClientRecord() {', start));

    // Every record ever filed against the Client ID, on every tier. A date
    // window here would hide a client's own documents from them.
    assert.doesNotMatch(body, /clientRetentionCutoff|ARCHIVE_WINDOW/, 'no retention window may filter a client from their own records');
    assert.equal(appSource().includes('CLIENT_ARCHIVE_WINDOW_MONTHS'), false);
    assert.equal(tierModel().CLIENT_TIER_FEATURES.some(f => f.key === 'full-archive'), false);

    // clientPortalDocs must not re-derive its own client list, or the two can disagree.
    const portalStart = src.indexOf('        clientPortalDocs() {');
    const portalBody = src.slice(portalStart, src.indexOf('        filteredClientPortalDocs() {', portalStart));
    assert.match(portalBody, /role === 'Client'\) return this\.myClientDocs/);
});

test('a client is matched to its record by Client ID or any authorized email', () => {
    const src = appSource();
    const start = src.indexOf('        myClientDocs() {');
    const body = src.slice(start, src.indexOf('        myClientRecord() {', start));

    // A secondary authorized contact's own email never appears on the records,
    // so the customerId match is what carries them; the email match is the
    // compatibility path for records filed before Client ID linking. Losing
    // either one silently empties an authorized client's document centre.
    assert.match(body, /customerId \|\| ''\)\.trim\(\) === clientDirectoryId/);
    assert.match(body, /clientEmail \|\| ''\)\.trim\(\)\.toLowerCase\(\) === clientEmail/);
});

test('sign-in resolves the directory record from Additional Authorized Emails', () => {
    const claims = fs.readFileSync(path.join(__dirname, '..', 'api', '_portalClaims.js'), 'utf8');

    // Staff add a contact under Additional Authorized Emails; that address must
    // then reach the same customers/{id} the primary contact reaches, or the
    // account signs in to an empty portal.
    assert.match(claims, /where\('clientEmail', '==', email\)/);
    assert.match(claims, /where\('additionalClientEmails', 'array-contains', email\)/);
    assert.match(claims, /claims\.clientDirectoryId = custSnap\.docs\[0\]\.id/);
});

test('the portal prints the registered Client ID, never the Firestore document key', () => {
    const html = markup();
    const src = appSource();

    // clientDirectoryId is the document key — often a legacy slug such as
    // "zenqor_technologies". The Client ID the Client Directory issues lives in
    // customers/{id}.clientId as ZCT-<6 digits>-<letter>.
    const page = html.slice(html.indexOf('CLIENT PORTAL MODULE'), html.indexOf('WEBSITE CONTENT MODULE'));
    assert.doesNotMatch(page, /userProfile\.clientDirectoryId/, 'the client-facing page must not show the document key');
    assert.equal((page.match(/myClientId/g) || []).length >= 2, true, 'the cover and the account panel both print it');
    assert.match(src, /myClientId\(\) \{ return String\(this\.clientPortalIdentity\?\.clientId/);
});

test('Client IDs are minted on save and disappear with the record', () => {
    const src = appSource();

    // Auto-generated on every client save, reusing the existing ID when there
    // is one so an update never reissues it.
    assert.match(src, /const clientId = existingCust\?\.clientId \|\| form\.clientId \|\| this\.generateClientId\(/);
    // Deterministic from the BRN, not random — the same client always resolves
    // to the same ID.
    assert.match(src, /return `ZCT-\$\{sixDigits\}-\$\{letter\}`/);
    // Deleting the client deletes the document the ID lives on, so nothing is
    // left behind to collide with or resurrect.
    assert.match(src, /deleteDoc\(doc\(db, "customers", client\.id\)\)/);
});

// --- one page, one palette --------------------------------------------------

test('the client portal is a single route — the old tabs are gone from the markup', () => {
    const html = markup();
    for (const tab of ['client-documents', 'client-updates', 'client-support']) {
        assert.equal(
            html.includes(`currentTab === '${tab}'`),
            false,
            `${tab} must no longer render as its own page`
        );
    }
    // All six panels are present on the one page.
    for (const panel of ['ov', 'dc', 'up', 'tb', 'sp', 'ac']) {
        assert.ok(html.includes(`clientPanel === '${panel}'`), `panel ${panel} must render`);
    }
});

test('a stray call to a retired client tab still lands on its panel', () => {
    const src = appSource();
    assert.match(src, /const CLIENT_LEGACY_TABS = \{/);
    const start = src.indexOf('        switchTab(tabName) {');
    const body = src.slice(start, start + 700);
    assert.match(body, /CLIENT_LEGACY_TABS\[tabName\]/, 'switchTab must redirect the retired tabs');
    assert.ok(
        body.indexOf('CLIENT_LEGACY_TABS[tabName]') < body.indexOf('hasAccess(tabName)'),
        'the redirect must run before the access check, or it would notify Access Denied first'
    );
});

test('the client palette carries no hue at all', () => {
    const css = styles();
    const start = css.indexOf('CLIENT WORKSPACE');
    assert.ok(start > -1, 'the client workspace stylesheet block must exist');
    const block = css.slice(start);
    const offenders = [];
    for (const match of block.matchAll(/#([0-9A-Fa-f]{6})\b/g)) {
        const [r, g, b] = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16));
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        // A neutral grey has near-identical channels; anything wider is a hue.
        if (spread > 14) offenders.push(`#${match[1]} (spread ${spread})`);
    }
    assert.deepEqual(offenders, [], 'smoke grey and black-grey only — no blue, yellow or gold');
});

test('every client token is defined in the light block, not only under .dark', () => {
    const css = styles();
    const lightBlock = css.slice(css.indexOf('.zq-cp {'), css.indexOf('.dark .zq-cp {'));
    const darkBlock = css.slice(css.indexOf('.dark .zq-cp {'), css.indexOf('.zq-cp { display: flex'));
    const names = block => new Set([...block.matchAll(/(--cp-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
    const light = names(lightBlock);
    for (const token of names(darkBlock)) {
        assert.ok(light.has(token), `${token} is only defined under .dark, so light mode would fall back to nothing`);
    }
});

// --- stored case ------------------------------------------------------------

// normalizeOfficialRecord() uppercases clientTier on write, so this is the
// case every record on file actually carries. Exact-case comparison read them
// all as Standard: the portal showed STANDARD for a PRIORITY client, the staff
// Priority Clients panel sat empty, and the deployed rule denied every reply.
test('a tier stored in any case resolves to the right tier', () => {
    const { CLIENT_TIER_ORDER, CLIENT_TIER_FEATURES } = tierModel();
    const priorityOnly = CLIENT_TIER_FEATURES.find(f => f.minTier === 2);
    const premiumOnly = CLIENT_TIER_FEATURES.find(f => f.minTier === 1);

    for (const stored of ['PRIORITY', 'Priority', 'priority', '  priority  ']) {
        const gate = buildGate(stored);
        assert.equal(gate.clientTierAllows(priorityOnly.key), true, `stored as "${stored}" must open Priority`);
    }
    for (const stored of ['PREMIUM', 'Premium', 'premium']) {
        const gate = buildGate(stored);
        assert.equal(gate.clientTierAllows(premiumOnly.key), true, `stored as "${stored}" must open Premium`);
        assert.equal(gate.clientTierAllows(priorityOnly.key), false, `stored as "${stored}" must stop below Priority`);
    }
    assert.equal(CLIENT_TIER_ORDER.length, 3);
});

test('every read of a stored tier goes through the canonicaliser', () => {
    const src = appSource();
    assert.match(src, /function canonicalClientTier\(value\)/);

    // Any survivor of the old exact-case comparison is the same bug again.
    const offenders = [...src.matchAll(/clientTier\s*===\s*'(Standard|Premium|Priority)'/g)].map(m => m[0]);
    assert.deepEqual(offenders, [], 'compare through canonicalClientTier, not exact case');

    // Each method body runs to its own closing brace at method indentation.
    const nlEnd = '\n        },';
    for (const reader of ['myClientTier', 'clientTierMeta', 'clientTierForId', 'priorityClients']) {
        const start = src.indexOf(`        ${reader}(`);
        assert.ok(start > -1, `${reader} must exist`);
        const body = src.slice(start, src.indexOf(nlEnd, start));
        assert.match(body, /canonicalClientTier/, `${reader} must canonicalise the stored value`);
    }
});

test('firestore.rules compares the tier case-insensitively', () => {
    const source = rules();
    const start = source.indexOf('function tierAllowsReply(');
    const body = source.slice(start, source.indexOf('}', source.indexOf('return', start)));

    // Records on file store 'PREMIUM'/'PRIORITY'; the form offers title case.
    // A case-sensitive rule here denies both.
    assert.match(body, /clientTier\.upper\(\) == 'PREMIUM'/);
    assert.match(body, /clientTier\.upper\(\) == 'PRIORITY'/);
    assert.match(body, /clientTier is string/, 'upper() on a missing field would error the rule');
});
