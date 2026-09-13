const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource } = require('./helpers/sources');

// The TIN rules come from LHDN's published format, not from anything the
// codebase can derive, so they are pinned here: an entity-type prefix, then
// digits, 11-12 characters in total. Lift the real methods out of app.js so
// this exercises the shipped validator rather than a copy of it.
function loadTinHelpers() {
    return new Function(`return { ${methodSource('normalizeTin', 'tinFormatState')} };`)();
}

test('documented LHDN TIN examples are accepted', () => {
    const helpers = loadTinHelpers();
    // Examples published alongside the format description.
    assert.equal(helpers.tinFormatState('C20880050010'), 'valid');
    assert.equal(helpers.tinFormatState('C22889955522'), 'valid');
    assert.equal(helpers.tinFormatState('IG845462070'), 'valid');
});

test('every published entity prefix is recognised', () => {
    const helpers = loadTinHelpers();
    const prefixes = ['C', 'CS', 'D', 'E', 'F', 'FA', 'PT', 'TA', 'TC', 'TN', 'TR', 'TP', 'J', 'LE', 'IG'];
    for (const prefix of prefixes) {
        const tin = `${prefix}${'1'.repeat(12 - prefix.length)}`;
        assert.equal(helpers.tinFormatState(tin), 'valid', `${prefix} should be a known prefix`);
    }
});

test('a two-letter prefix is not read as its one-letter prefix', () => {
    const helpers = loadTinHelpers();
    // CS must match as "CS" + digits, never "C" followed by a stray letter.
    assert.equal(helpers.tinFormatState('CS1234567890'), 'valid');
    assert.equal(helpers.tinFormatState('C1234567890'), 'valid');
});

test('a TIN is normalised before it is judged or stored', () => {
    const helpers = loadTinHelpers();
    assert.equal(helpers.normalizeTin('  c 2088 0050-010 '), 'C20880050010');
    assert.equal(helpers.tinFormatState('c 2088 0050-010'), 'valid');
});

test('the field stays optional', () => {
    const helpers = loadTinHelpers();
    assert.equal(helpers.tinFormatState(''), 'empty');
    assert.equal(helpers.tinFormatState(null), 'empty');
    assert.equal(helpers.tinFormatState(undefined), 'empty');
});

test('malformed numbers are reported, including a business registration number pasted by mistake', () => {
    const helpers = loadTinHelpers();
    const rejected = {
        '202603157897': 'a 12-digit BRN carries no prefix',
        'C2088005': 'too short',
        'C208800500101': 'too long',
        'X20880050010': 'unknown prefix',
        'C2088005001A': 'a letter among the digits',
        'EI00000000010': 'a general e-invoice code, not an entity TIN'
    };
    for (const [tin, reason] of Object.entries(rejected)) {
        assert.equal(helpers.tinFormatState(tin), 'invalid', `${tin} should be rejected: ${reason}`);
    }
});

test('company TIN reaches storage and the official document header', () => {
    const appSource = readSource('app.js');
    const pageSource = readSource('index.html');
    // Part of the company profile, so saveSettings persists it with the rest.
    assert.match(appSource, /company:\s*\{[\s\S]*?\btin:\s*""/);
    assert.match(pageSource, /id="setting-comp-tin"/);
    // Printed only once entered, so an unfilled TIN never shows an empty line.
    assert.match(pageSource, /<p v-if="company\.tin"[^>]*>TIN: \{\{ company\.tin \}\}<\/p>/);
});
