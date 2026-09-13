const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource } = require('./helpers/sources');

const appSource = () => readSource('app.js');

// Lift the real helpers out of app.js. These are regex-heavy, and a stripped
// backslash turns \d into a literal d without breaking the syntax — a fault
// that is invisible until someone types a real registration number.
function loadHelpers() {
    const src = appSource();
    const start = src.indexOf('        brnNewFormatState(value) {');
    const end = src.indexOf('        tinFormatState(value) {', start);
    assert.ok(start > -1 && end > start, 'the registration-number helpers must remain in app.js');
    return new Function(`return { ${src.slice(start, end)} };`)();
}

test('the new SSM format is exactly twelve digits', () => {
    const h = loadHelpers();
    // Since 11 Oct 2019: 4-digit year, 2-digit entity code, 6-digit sequence.
    assert.equal(h.brnNewFormatState('200901029271'), 'valid');
    assert.equal(h.brnNewFormatState('199301012242'), 'valid');
    assert.equal(h.brnNewFormatState('20090102927'), 'invalid', 'eleven digits is not a BRN');
    assert.equal(h.brnNewFormatState('2009010292711'), 'invalid', 'thirteen digits is not a BRN');
    assert.equal(h.brnNewFormatState('872376-W'), 'invalid', 'the old format belongs in the other field');
    assert.equal(h.brnNewFormatState(''), 'empty', 'the field is optional');
});

test('the old SSM format keeps its check letter, and a state prefix is allowed', () => {
    const h = loadHelpers();
    assert.equal(h.brnOldFormatState('872376-W'), 'valid');
    assert.equal(h.brnOldFormatState('266980-X'), 'valid');
    // Enterprises registered in a state carry a prefix, e.g. Johor.
    assert.equal(h.brnOldFormatState('JM1045730-D'), 'valid');
    assert.equal(h.brnOldFormatState('872376'), 'invalid', 'the check letter is part of the number');
    assert.equal(h.brnOldFormatState('200901029271'), 'invalid', 'the new format belongs in the other field');
    assert.equal(h.brnOldFormatState(''), 'empty');
});

test('the two numbers compose into the printed form and split back out', () => {
    const h = loadHelpers();
    // 36 places read clientSSM, so the stored shape must not change.
    assert.equal(h.composeClientSSM('200901029271', '872376-W'), '200901029271 (872376-W)');
    assert.equal(h.composeClientSSM('202401234567', ''), '202401234567');
    assert.equal(h.composeClientSSM('', 'JM1045730-D'), 'JM1045730-D');

    for (const [a, b] of [['200901029271', '872376-W'], ['202401234567', ''], ['', 'JM1045730-D']]) {
        const back = h.splitClientSSM(h.composeClientSSM(a, b));
        assert.equal(back.newBrn, a);
        assert.equal(back.oldBrn, b);
    }
});

test('an existing record opens with its number already split apart', () => {
    const h = loadHelpers();
    // Records predating these fields carry only the combined string.
    assert.deepEqual(h.splitClientSSM('200901029271 (872376-W)'), { newBrn: '200901029271', oldBrn: '872376-W' });
    assert.deepEqual(h.splitClientSSM('872376-W'), { newBrn: '', oldBrn: '872376-W' });
    assert.deepEqual(h.splitClientSSM(''), { newBrn: '', oldBrn: '' });
});

test('the Client ID still derives from the composed number', () => {
    const src = appSource();
    // clientSSM is no longer bound to an input, so deriving from it would have
    // silently produced a sequential fallback ID for every new client.
    assert.match(src, /const composedSSM = this\.composeClientSSM\(form\.clientBrnNew, form\.clientBrnOld\);/);
    assert.match(src, /this\.generateClientId\(composedSSM\)/);
    assert.doesNotMatch(src, /this\.generateClientId\(form\.clientSSM\)/);
});

test('the client TIN is stored separately from the registration number', () => {
    const src = appSource();
    assert.match(src, /clientTin: this\.normalizeTin\(form\.clientTin\)/);
    const page = readSource('index.html');
    for (const id of ['client-info-brn-new', 'client-info-brn-old', 'client-info-tin']) {
        assert.ok(page.includes(`id="${id}"`), `${id} must exist on the form`);
    }
    // The one combined box conflated three different identifiers.
    assert.ok(!page.includes('id="client-info-ssm"'), 'the combined field must be gone');
});
