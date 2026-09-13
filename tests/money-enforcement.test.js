const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readSource, methodSource } = require('./helpers/sources');

const rules = () => readSource('firestore.rules');

// The browser works out SST, EPF, SOCSO and EIS, and firestore.rules re-derives
// every one of them before the write is allowed to land. These tests pin the
// portal's copy to the published schedules; tests/rules/payroll.rules.test.js
// sends a payslip in every band to the rules engine to pin the rules' copy.

const statutory = () => import(pathToFileURL(path.join(__dirname, '..', 'app', 'constants', 'statutory.js')).href);

async function payroll(input) {
    const tables = await statutory();
    const self = { payForm: { month: '2026-09', ...input }, payCalc: {} };
    const methods = new Function('epfContribution', 'socsoContribution', 'eisContribution', 'skbbkTableCovers',
        `return { ${methodSource('autoCalculatePayroll')} };`)(tables.epfContribution, tables.socsoContribution, tables.eisContribution, tables.skbbkTableCovers);
    methods.autoCalculatePayroll.call(self);
    return { form: self.payForm, calc: self.payCalc };
}

test('the contribution tables are the published schedules', async () => {
    const { epfContribution, socsoContribution, eisContribution, SOCSO_TABLE, EIS_TABLE } = await statutory();

    // EPF Third Schedule, Part A (below 60) — a row from each stretch of the table.
    for (const [wages, employer, employee] of [
        [15, 3, 3], [100, 13, 11], [210, 29, 25], [1010, 133, 113], [3000, 390, 330],
        [3010, 393, 333], [5000, 650, 550], [5050, 612, 561], [5950, 720, 660], [20000, 2400, 2200],
    ]) {
        assert.deepEqual(epfContribution(wages), { employer, employee }, `EPF Part A at RM${wages}`);
    }
    // Part E (Malaysian citizens aged 60 and above): employer 4%, employee nothing.
    for (const [wages, employer] of [[15, 1], [100, 4], [210, 9], [3010, 121], [5050, 204], [20000, 800]]) {
        assert.deepEqual(epfContribution(wages, { senior: true }), { employer, employee: 0 }, `EPF Part E at RM${wages}`);
    }
    // A bonus lifting a RM5,000-or-less wage over RM5,000 keeps the 13% employer rate.
    assert.equal(epfContribution(5500, { baseWages: 4800 }).employer, 715);

    // PERKESO Act 4 including LINDUNG 24 Jam: 65 bands, the last two the same.
    assert.equal(SOCSO_TABLE.length, 65);
    assert.deepEqual(SOCSO_TABLE[34], [53.35, 15.25, 22.85, 38.10], 'RM3,000.01-RM3,100.00');
    assert.deepEqual(SOCSO_TABLE[63], SOCSO_TABLE[64], 'above RM6,000 contributes as RM6,000');
    assert.deepEqual(socsoContribution(3010, { month: '2026-09' }), { employer: 53.35, invalidity: 15.25, skbbk: 22.85 });
    assert.deepEqual(socsoContribution(3010, { month: '2026-05' }), { employer: 53.35, invalidity: 15.25, skbbk: 0 }, 'before June 2026');
    assert.deepEqual(socsoContribution(3010, { month: '2026-09', skbbkOptedOut: true }).skbbk, 0, 'opted out');
    assert.deepEqual(socsoContribution(7000, { month: '2026-09', senior: true }), { employer: 74.40, invalidity: 0, skbbk: 44.65 }, 'Second Category');

    // EIS Act 800: 65 bands, nothing from 60.
    assert.equal(EIS_TABLE.length, 65);
    assert.deepEqual(eisContribution(3010), { employer: 6.10, employee: 6.10 });
    assert.deepEqual(eisContribution(9000), { employer: 11.90, employee: 11.90 });
    assert.deepEqual(eisContribution(3010, { senior: true }), { employer: 0, employee: 0 });

    // From band 7 the published amounts follow each rate on the band midpoint;
    // that is what the rules compute, so every row here is held to it.
    for (let band = 6; band < 64; band++) {
        const mid = 250 + 100 * (band - 6);
        const [, invalidity, skbbk] = SOCSO_TABLE[band];
        assert.equal(Math.round(invalidity * 100), mid / 2, `invalidity, band ${band}`);
        assert.equal(Math.round(skbbk * 100), Math.floor((mid * 75) / 1000) * 10 + 5, `LINDUNG 24 Jam, band ${band}`);
        assert.equal(Math.round(EIS_TABLE[band] * 100), mid / 5, `EIS, band ${band}`);
    }
    // And the first six bands the rules list outright.
    const source = rules();
    assert.match(source, /\[10, 20, 30, 40, 60, 85\]\[band\]/);
    assert.match(source, /\[20, 30, 50, 65, 90, 125\]\[band\]/);
    assert.match(source, /\[5, 10, 15, 20, 25, 35\]\[band\]/);
    assert.deepEqual(SOCSO_TABLE.slice(0, 6).map(row => Math.round(row[1] * 100)), [10, 20, 30, 40, 60, 85]);
    assert.deepEqual(SOCSO_TABLE.slice(0, 6).map(row => Math.round(row[2] * 100)), [20, 30, 50, 65, 90, 125]);
    assert.deepEqual(EIS_TABLE.slice(0, 6).map(value => Math.round(value * 100)), [5, 10, 15, 20, 25, 35]);

    // SST is 8% in the browser and 8% in the rules.
    assert.match(readSource('app/computed/billing.js'), /docSST\(\) \{ return this\.docSubtotal \* 0\.08; \}/);
    assert.match(source, /figure\(data, 'subtotal'\) \* 0\.08/);
});

test('a payslip the portal produces carries the schedule figures', async () => {
    const cases = [
        { basic: 4000, ot: 0, phone: 100, transport: 200, meal: 0, bonus: 0, isSenior: false, dedPcb: 120, dedAdvance: 0, dedOther: 0 },
        { basic: 9000, ot: 500, phone: 0, transport: 0, meal: 0, bonus: 2000, isSenior: false, dedPcb: 900, dedAdvance: 100, dedOther: 50 },
        { basic: 1500, ot: 0, phone: 0, transport: 0, meal: 0, bonus: 0, isSenior: false, dedPcb: 0, dedAdvance: 0, dedOther: 0 },
        { basic: 6200, ot: 300, phone: 0, transport: 0, meal: 0, bonus: 0, isSenior: true, dedPcb: 0, dedAdvance: 0, dedOther: 0 },
    ];
    const { epfContribution, socsoContribution, eisContribution } = await statutory();
    const cents = (value) => Math.round(value * 100);

    for (const input of cases) {
        const { form, calc } = await payroll(input);
        const epfWages = input.basic + input.phone + input.transport + input.meal + input.bonus;
        const gross = epfWages + input.ot;
        assert.equal(form.dedEpf, epfContribution(epfWages, { senior: input.isSenior }).employee, `EPF for ${JSON.stringify(input)}`);
        const socso = socsoContribution(gross, { senior: input.isSenior, month: '2026-09' });
        assert.equal(form.dedSocso, socso.invalidity, 'SOCSO');
        assert.equal(form.dedSkbbk, socso.skbbk, 'LINDUNG 24 Jam');
        assert.equal(form.dedEis, eisContribution(gross, { senior: input.isSenior }).employee, 'EIS');

        const deductions = form.dedEpf + form.dedSocso + form.dedSkbbk + form.dedEis + form.dedPcb + form.dedAdvance + form.dedOther;
        assert.equal(cents(calc.net), cents(gross - deductions), 'net pay');
    }

    // Figures entered by hand are kept as typed.
    const { form } = await payroll({ basic: 3010, statutoryOverride: true, dedEpf: 400, dedSocso: 15.25, dedSkbbk: 0, dedEis: 6.1 });
    assert.equal(form.dedEpf, 400);
});

test('a payslip is saved from the inputs, not from whatever was last calculated', () => {
    // payCalc is what gets filed as the amount. Recomputing at save time is what
    // makes the stored figures provably the ones the wages produce — which is
    // exactly what the rule then re-checks.
    const save = methodSource('savePayslipRecord');
    const calcAt = save.indexOf('this.autoCalculatePayroll()');
    const payloadAt = save.indexOf('const payload =');
    assert.ok(calcAt > -1 && calcAt < payloadAt, 'savePayslipRecord must recalculate before it builds the payload');
});

test('a refused figure is explained before the rule refuses it', () => {
    // A rule can only answer "denied", and the portal reports that as a
    // permission error — which says nothing about a discount larger than the
    // subtotal it is taken off. The same conditions are checked in the form.
    const save = methodSource('saveDocRecord');
    assert.match(save, /if \(this\.docSubtotal < 0\)/);
    assert.match(save, /if \(discount < 0\)/);
    assert.match(save, /if \(discount > this\.docSubtotal\)/);

    // And the inputs themselves do not invite a negative number.
    const form = readSource('views/tab-documents.html');
    assert.match(form, /v-model="item\.price" step="0\.01" min="0"/);
    assert.match(form, /v-model="docForm\.discount" step="0\.01" min="0"/);
});

test('a billing document files the figures its total is made of', () => {
    // The rule can only check subtotal - discount + SST against the total if the
    // document carries all three. Before this, only the total was stored, and a
    // total on its own can say anything.
    const save = methodSource('saveDocRecord');
    assert.match(save, /subtotal: this\.docSubtotal/);
    assert.match(save, /sst: this\.docSST/);
    assert.match(save, /discount: Number\(this\.docForm\.discount\) \|\| 0/);
});

test('the money rules are actually wired to the collections they protect', () => {
    const source = rules();

    const docs = source.slice(source.indexOf('match /docs/{docId}'), source.indexOf('match /billing_events/'));
    assert.match(docs, /allow create: if \(isSuperadmin\(\) \|\| isDirector\(\) \|\| isHR\(\) \|\| isAccount\(\)\) &&\s*billingTotalsConsistent\(request\.resource\.data\);/);
    assert.match(docs, /billingTotalsAccepted\(\)/);

    const payslips = source.slice(source.indexOf('match /payslips/'), source.indexOf('match /claims/'));
    assert.match(payslips, /payslipFiguresConsistent\(request\.resource\.data\)/);
    assert.match(payslips, /payslipFiguresAccepted\(\)/);

    // An approver moves a claim along; they do not get to change the sum on the
    // way. Both pipelines (claims and payment vouchers) have three transitions.
    const claims = source.slice(source.indexOf('match /claims/'), source.indexOf('match /projects/'));
    assert.equal((claims.match(/isClaimDecision\(\[/g) || []).length, 6);
});

test('a legacy record keeps working, but its figures cannot move unchecked', () => {
    const source = rules();
    // Documents and payslips filed before these rules carry no subtotal and no
    // recomputable set. Their workflow must keep moving — refusing a status
    // change on every historical invoice would be its own outage — but the
    // money on them is pinned.
    assert.match(source, /'subtotal' in request\.resource\.data\s*\?\s*billingTotalsConsistent\(request\.resource\.data\)\s*:\s*request\.resource\.data\.amount == resource\.data\.amount/);
    assert.match(source, /payslipFiguresConsistent\(request\.resource\.data\) \|\|\s*\(resource != null && request\.resource\.data\.amount == resource\.data\.amount\)/);
});

test('the line-item sum is checked where rules cannot reach', () => {
    const trigger = readSource('functions/index.js');
    // Rules have no way to add up a list, so a self-consistent set of totals can
    // still have nothing to do with the lines printed on the document.
    assert.match(trigger, /exports\.verifyBillingDocumentTotals/);
    assert.match(trigger, /\.document\('docs\/\{docId\}'\)/);
    // Next to the database it watches, not in the default us-central1.
    assert.match(trigger, /const FIRESTORE_REGION = 'asia-southeast1';/);
    assert.match(trigger, /exports\.verifyBillingDocumentTotals = functions\.region\(FIRESTORE_REGION\)\.firestore/);
    assert.match(trigger, /items\.reduce\(\(sum, item\) => sum \+ \(Number\(item\?\.qty\) \|\| 0\) \* \(Number\(item\?\.price\) \|\| 0\), 0\)/);
    // It corrects, and it says so in the audit log — in the same commit.
    assert.match(trigger, /batch\.set\(db\.collection\('docs'\)\.doc\(docId\)/);
    assert.match(trigger, /batch\.set\(db\.collection\('audit_logs'\)\.doc\(id\)/);
    assert.match(trigger, /await batch\.commit\(\);/);
    // And it stops: the corrected document agrees on the next pass.
    assert.match(trigger, /if \(agrees\) return null;/);
    // History is not rewritten.
    assert.match(trigger, /if \(typeof data\.subtotal !== 'number'\) return null;/);
});
