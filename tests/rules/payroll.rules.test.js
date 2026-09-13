// Payslips against the deployed rules: what the portal calculates from the
// published schedules is accepted, and anything else is refused.
const { test, before, after, beforeEach } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { start, stop, reset, as, assertFails, assertSucceeds } = require('./harness');

let statutory;
before(async () => {
    statutory = await import(pathToFileURL(path.join(__dirname, '..', '..', 'app', 'constants', 'statutory.js')).href);
    await start();
});
after(stop);
beforeEach(reset);

// The same arithmetic as autoCalculatePayroll() in app/methods/billing.js.
function payslip({ basic, ot = 0, bonus = 0, senior = false, month = '2026-09', optedOut = false, pcb = 0 }) {
    const baseWages = basic;
    const epfWages = baseWages + bonus;
    const gross = epfWages + ot;
    const epf = statutory.epfContribution(epfWages, { senior, baseWages });
    const socso = statutory.socsoContribution(gross, { senior, month, skbbkOptedOut: optedOut });
    const eis = statutory.eisContribution(gross, { senior });
    const raw = {
        empNo: 'E1', name: 'PIC STAFF', empEmail: 'staff@zenqor.com.my', month, payDate: `${month}-25`,
        basic, ot, phone: 0, transport: 0, meal: 0, bonus, isSenior: senior, skbbkOptedOut: optedOut,
        dedEpf: epf.employee, dedSocso: socso.invalidity, dedSkbbk: socso.skbbk, dedEis: eis.employee,
        dedPcb: pcb, dedAdvance: 0, dedOther: 0, statutoryOverride: false, statutoryOverrideReason: '',
    };
    const deductions = raw.dedEpf + raw.dedSocso + raw.dedSkbbk + raw.dedEis + pcb;
    return { type: 'Payslip', docNo: `PS-${month.replace('-', '')}-E1`, name: raw.name, amount: Math.round((gross - deductions) * 100) / 100, raw };
}

test('every payslip the portal calculates is accepted', async () => {
    const { db } = as('hr');
    const wages = [1700, 2500.5, 3010, 4999.99, 5000, 5000.01, 5950, 6000, 6000.01, 12000, 25000.37];
    let id = 0;
    for (const basic of wages) {
        for (const senior of [false, true]) {
            for (const month of ['2026-05', '2026-09']) {
                for (const optedOut of [false, true]) {
                    const record = payslip({ basic, ot: 150, senior, month, optedOut, pcb: 42.5 });
                    await assertSucceeds(db.doc(`payslips/P${id++}`).set(record));
                }
            }
        }
    }
    // A bonus that lifts a RM5,000 wage over RM5,000 keeps the 13% employer rate
    // on the portal's side; the employee share the rules check is unchanged.
    await assertSucceeds(db.doc('payslips/BONUS').set(payslip({ basic: 4800, bonus: 700 })));
});

// The rules list the first six PERKESO/EIS bands and work out the rest; the
// portal holds every row of the published tables. One payslip per band, both
// age categories, proves the two agree on all 65 rows.
test('the rules and the published tables agree in every band', async () => {
    const { db } = as('hr');
    const representative = [20, 40, 60, 90, 120, 180];
    for (let band = 6; band < 64; band++) representative.push(250 + 100 * (band - 6));
    representative.push(7000);
    let id = 0;
    for (const basic of representative) {
        for (const senior of [false, true]) {
            await assertSucceeds(db.doc(`payslips/B${id++}`).set(payslip({ basic, senior, month: '2026-09' })));
        }
    }
    // The band edges themselves: RM200.00 is band 6, RM200.01 band 7; RM5,900.00
    // and RM5,900.01 either side of the last band.
    for (const basic of [200, 200.01, 5900, 5900.01, 6000, 6000.01]) {
        await assertSucceeds(db.doc(`payslips/E${id++}`).set(payslip({ basic })));
    }
});

test('the flat percentages are not the schedule, and are refused', async () => {
    const { db } = as('hr');
    const record = payslip({ basic: 3010 });
    // 11% of RM3,010 rounded to the nearest ringgit is RM331; the schedule says RM333.
    record.raw.dedEpf = 331;
    record.amount += 2;
    await assertFails(db.doc('payslips/FLAT').set(record));
});

test('LINDUNG 24 Jam is charged from June 2026, and not to someone who opted out', async () => {
    const { db } = as('hr');
    const withSkbbk = payslip({ basic: 3010, month: '2026-09' });
    const withoutIt = { ...withSkbbk, raw: { ...withSkbbk.raw, dedSkbbk: 0 }, amount: withSkbbk.amount + withSkbbk.raw.dedSkbbk };
    await assertFails(db.doc('payslips/MISSING').set(withoutIt));
    await assertSucceeds(db.doc('payslips/OPTED').set(payslip({ basic: 3010, month: '2026-09', optedOut: true })));
    await assertSucceeds(db.doc('payslips/BEFORE').set(payslip({ basic: 3010, month: '2026-05' })));
});

test('figures entered by hand need a reason, and a month the tables do not cover needs them', async () => {
    const { db } = as('hr');
    const manual = payslip({ basic: 3010 });
    manual.raw.statutoryOverride = true;
    manual.raw.dedEpf = 400; // e.g. an employee who elected a higher rate
    manual.amount -= 67;
    await assertFails(db.doc('payslips/NOREASON').set(manual));
    manual.raw.statutoryOverrideReason = 'EMPLOYEE ELECTED 13% EPF';
    await assertSucceeds(db.doc('payslips/REASON').set(manual));

    // June 2028 onwards: the 1.00% LINDUNG 24 Jam table is not in the portal.
    await assertFails(db.doc('payslips/PHASE2').set(payslip({ basic: 3010, month: '2028-06' })));
});

test('net pay must still be gross less every deduction', async () => {
    const { db } = as('hr');
    const record = payslip({ basic: 3010 });
    record.amount += 10;
    await assertFails(db.doc('payslips/NET').set(record));
});
