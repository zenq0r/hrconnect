const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource, constantSource } = require('./helpers/sources');

const rules = () => readSource('firestore.rules');

// The browser works out SST, EPF, SOCSO and EIS, and firestore.rules re-derives
// every one of them before the write is allowed to land. Two copies of the same
// arithmetic is the price of enforcing it server-side — these tests exist so the
// copies cannot drift apart silently. A rate changed in one place and not the
// other would not look like a bug: the portal would simply refuse to save a
// payslip, with no explanation of why.

function statutory() {
    return new Function(`${constantSource('STATUTORY_RATES')} return STATUTORY_RATES;`)();
}

function payroll(input) {
    const calc = new Function(`
        ${constantSource('STATUTORY_RATES')}
        const self = { payForm: ${JSON.stringify(input)}, payCalc: {} };
        const methods = { ${methodSource('autoCalculatePayroll')} };
        methods.autoCalculatePayroll.call(self);
        return { form: self.payForm, calc: self.payCalc };
    `)();
    return calc;
}

test('the statutory rates in the rules are the statutory rates in the portal', () => {
    const source = rules();
    const rates = statutory().regular;

    // Each of these appears in payslipStatutoryCorrect() as the multiplier the
    // stored deduction is checked against.
    assert.match(source, new RegExp(`: ${rates.epf.employeePct}\\)\\)`), `EPF must be checked at ${rates.epf.employeePct}`);
    assert.match(source, new RegExp(`: ${rates.socso.employeePct}\\)\\)`), `SOCSO must be checked at ${rates.socso.employeePct}`);
    assert.match(source, new RegExp(`: ${rates.eis.employeePct}\\)\\)`), `EIS must be checked at ${rates.eis.employeePct}`);
    // One ceiling covers both SOCSO and EIS.
    assert.equal(rates.socso.wageCap, rates.eis.wageCap);
    assert.match(source, new RegExp(`> ${rates.socso.wageCap} \\? ${rates.socso.wageCap}`), 'the wage ceiling must match');

    // SST is 8% in the browser and 8% in the rules.
    assert.match(readSource('app/computed/billing.js'), /docSST\(\) \{ return this\.docSubtotal \* 0\.08; \}/);
    assert.match(source, /figure\(data, 'subtotal'\) \* 0\.08/);
});

test('a payslip the portal produces satisfies the rule that guards it', () => {
    const cases = [
        { basic: 4000, ot: 0, phone: 100, transport: 200, meal: 0, bonus: 0, isSenior: false, dedPcb: 120, dedAdvance: 0, dedOther: 0 },
        { basic: 9000, ot: 500, phone: 0, transport: 0, meal: 0, bonus: 2000, isSenior: false, dedPcb: 900, dedAdvance: 100, dedOther: 50 },
        { basic: 1500, ot: 0, phone: 0, transport: 0, meal: 0, bonus: 0, isSenior: false, dedPcb: 0, dedAdvance: 0, dedOther: 0 },
        { basic: 6200, ot: 300, phone: 0, transport: 0, meal: 0, bonus: 0, isSenior: true, dedPcb: 0, dedAdvance: 0, dedOther: 0 },
    ];
    const rates = statutory();
    const cents = (value) => Math.round(value * 100);

    for (const input of cases) {
        const { form, calc } = payroll(input);
        const rate = input.isSenior ? rates.senior : rates.regular;

        // Exactly what payslipStatutoryCorrect() recomputes, written out the way
        // the rules write it rather than the way autoCalculatePayroll does.
        const epfWages = form.basic + form.phone + form.transport + form.meal + form.bonus;
        const gross = epfWages + form.ot;
        const capped = gross > rate.socso.wageCap ? rate.socso.wageCap : gross;

        assert.equal(cents(form.dedEpf), cents(Math.round(epfWages * rate.epf.employeePct)), `EPF for ${JSON.stringify(input)}`);
        assert.ok(Math.abs(cents(form.dedSocso) - cents(capped * rate.socso.employeePct)) <= 1, 'SOCSO');
        assert.ok(Math.abs(cents(form.dedEis) - cents(capped * rate.eis.employeePct)) <= 1, 'EIS');

        // And the net figure the payslip is filed under.
        const deductions = form.dedEpf + form.dedSocso + form.dedEis + form.dedPcb + form.dedAdvance + form.dedOther;
        assert.ok(Math.abs(cents(calc.net) - cents(gross - deductions)) <= 1, 'net pay');
    }
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
    assert.equal((claims.match(/claimAmountUnchanged\(\)/g) || []).length, 6);
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
    assert.match(trigger, /items\.reduce\(\(sum, item\) => sum \+ \(Number\(item\?\.qty\) \|\| 0\) \* \(Number\(item\?\.price\) \|\| 0\), 0\)/);
    // It corrects, and it says so in the audit log.
    assert.match(trigger, /collection\('audit_logs'\)/);
    // And it stops: the corrected document agrees on the next pass.
    assert.match(trigger, /if \(agrees\) return null;/);
    // History is not rewritten.
    assert.match(trigger, /if \(typeof data\.subtotal !== 'number'\) return null;/);
});
