// Malaysian statutory payroll contributions (EPF, SOCSO, EIS) from the
// published schedules, and the postcode table that fills in city/state.
export const MALAYSIA_POSTCODE_PREFIXES = [
    ['463', 'Petaling Jaya', 'Selangor'], ['460', 'Petaling Jaya', 'Selangor'], ['461', 'Petaling Jaya', 'Selangor'], ['462', 'Petaling Jaya', 'Selangor'],
    ['430', 'Kajang', 'Selangor'], ['432', 'Cheras', 'Selangor'], ['433', 'Seri Kembangan', 'Selangor'], ['435', 'Semenyih', 'Selangor'],
    ['400', 'Shah Alam', 'Selangor'], ['401', 'Shah Alam', 'Selangor'], ['402', 'Shah Alam', 'Selangor'], ['403', 'Shah Alam', 'Selangor'], ['404', 'Shah Alam', 'Selangor'],
    ['410', 'Klang', 'Selangor'], ['411', 'Klang', 'Selangor'], ['412', 'Klang', 'Selangor'], ['420', 'Pelabuhan Klang', 'Selangor'],
    ['470', 'Sungai Buloh', 'Selangor'], ['471', 'Puchong', 'Selangor'], ['475', 'Subang Jaya', 'Selangor'], ['476', 'Subang Jaya', 'Selangor'], ['478', 'Petaling Jaya', 'Selangor'],
    ['500', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['501', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['502', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['503', 'Kuala Lumpur', 'W.P. Kuala Lumpur'],
    ['504', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['505', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['506', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['507', 'Kuala Lumpur', 'W.P. Kuala Lumpur'],
    ['510', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['511', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['512', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['520', 'Kuala Lumpur', 'W.P. Kuala Lumpur'],
    ['530', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['531', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['532', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['533', 'Kuala Lumpur', 'W.P. Kuala Lumpur'],
    ['551', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['560', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['561', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['570', 'Kuala Lumpur', 'W.P. Kuala Lumpur'],
    ['580', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['590', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['600', 'Kuala Lumpur', 'W.P. Kuala Lumpur'], ['620', 'Putrajaya', 'W.P. Putrajaya'], ['621', 'Putrajaya', 'W.P. Putrajaya'], ['622', 'Putrajaya', 'W.P. Putrajaya'],
    ['800', 'Johor Bahru', 'Johor'], ['801', 'Johor Bahru', 'Johor'], ['802', 'Johor Bahru', 'Johor'], ['803', 'Johor Bahru', 'Johor'], ['811', 'Johor Bahru', 'Johor'],
    ['750', 'Melaka', 'Melaka'], ['751', 'Melaka', 'Melaka'], ['752', 'Melaka', 'Melaka'], ['753', 'Melaka', 'Melaka'], ['754', 'Melaka', 'Melaka'],
    ['700', 'Seremban', 'Negeri Sembilan'], ['701', 'Seremban', 'Negeri Sembilan'], ['702', 'Seremban', 'Negeri Sembilan'], ['703', 'Seremban', 'Negeri Sembilan'],
    ['300', 'Ipoh', 'Perak'], ['301', 'Ipoh', 'Perak'], ['302', 'Ipoh', 'Perak'], ['303', 'Ipoh', 'Perak'], ['304', 'Ipoh', 'Perak'], ['314', 'Ipoh', 'Perak'],
    ['100', 'George Town', 'Pulau Pinang'], ['101', 'George Town', 'Pulau Pinang'], ['102', 'George Town', 'Pulau Pinang'], ['103', 'George Town', 'Pulau Pinang'], ['104', 'George Town', 'Pulau Pinang'], ['116', 'Jelutong', 'Pulau Pinang'],
    ['050', 'Alor Setar', 'Kedah'], ['051', 'Alor Setar', 'Kedah'], ['052', 'Alor Setar', 'Kedah'], ['053', 'Alor Setar', 'Kedah'], ['054', 'Alor Setar', 'Kedah'],
    ['150', 'Kota Bharu', 'Kelantan'], ['151', 'Kota Bharu', 'Kelantan'], ['152', 'Kota Bharu', 'Kelantan'], ['153', 'Kota Bharu', 'Kelantan'],
    ['200', 'Kuala Terengganu', 'Terengganu'], ['201', 'Kuala Terengganu', 'Terengganu'], ['202', 'Kuala Terengganu', 'Terengganu'], ['203', 'Kuala Terengganu', 'Terengganu'],
    ['250', 'Kuantan', 'Pahang'], ['251', 'Kuantan', 'Pahang'], ['252', 'Kuantan', 'Pahang'], ['253', 'Kuantan', 'Pahang'], ['930', 'Kuching', 'Sarawak'], ['931', 'Kuching', 'Sarawak'], ['932', 'Kuching', 'Sarawak'], ['933', 'Kuching', 'Sarawak'], ['934', 'Kuching', 'Sarawak'],
    ['880', 'Kota Kinabalu', 'Sabah'], ['881', 'Kota Kinabalu', 'Sabah'], ['882', 'Kota Kinabalu', 'Sabah'], ['883', 'Kota Kinabalu', 'Sabah'], ['884', 'Kota Kinabalu', 'Sabah'], ['870', 'Labuan', 'W.P. Labuan']
];

export function lookupMalaysiaPostcode(value) {
    const postcode = String(value || '').replace(/\D/g, '').slice(0, 5);
    if (postcode.length !== 5) return { postcode, city: '', state: '' };
    const exact = MALAYSIA_POSTCODE_PREFIXES.find(([prefix]) => postcode.startsWith(prefix));
    if (exact) return { postcode, city: exact[1], state: exact[2] };
    const code = Number(postcode.slice(0, 2));
    const ranges = [
        [1, 2, 'Perlis'], [5, 9, 'Kedah'], [10, 14, 'Pulau Pinang'], [15, 18, 'Kelantan'], [20, 24, 'Terengganu'],
        [25, 28, 'Pahang'], [30, 36, 'Perak'], [39, 39, 'Pahang'], [40, 48, 'Selangor'], [49, 49, 'Pahang'],
        [50, 60, 'W.P. Kuala Lumpur'], [62, 62, 'W.P. Putrajaya'], [63, 68, 'Selangor'], [69, 69, 'Pahang'],
        [70, 73, 'Negeri Sembilan'], [75, 78, 'Melaka'], [79, 86, 'Johor'], [87, 87, 'W.P. Labuan'], [88, 91, 'Sabah'], [93, 98, 'Sarawak']
    ];
    const stateRange = ranges.find(([from, to]) => code >= from && code <= to);
    return { postcode, city: '', state: stateRange?.[2] || '' };
}

// ---- Statutory contributions ----------------------------------------------
//
// Taken from the published schedules, not from their headline percentages.
// Each fund works in wage bands and rounds within them, so "11% of wages" and
// "the EPF contribution" differ by a ringgit or two on most salaries, and the
// SOCSO and EIS figures do not follow any single rounding rule at all. A
// payslip that disagrees with the schedule disagrees with what is actually
// remitted to KWSP and PERKESO.
//
//   EPF:   Employees Provident Fund Act 1991, Third Schedule — Part A
//          (Malaysian citizens and PRs below 60) and Part E (Malaysian
//          citizens aged 60 and above).
//   SOCSO: Employees' Social Security Act 1969 (Act 4) — First and Second
//          Categories, including the Non-Employment Injury Scheme
//          (SKBBK / LINDUNG 24 Jam) from 1 June 2026.
//   EIS:   Employment Insurance System Act 2017 (Act 800).
//
// firestore.rules re-derives the employee shares from the same tables
// (payslipStatutoryCorrect), and tests/money-enforcement.test.js checks that the
// two copies agree row for row.

// Wages in whole sen, so band edges are compared exactly rather than through
// floating-point sums such as 1500.1 + 200.2.
export function wagesInSen(value) {
    return Math.round((Number(value) || 0) * 100);
}

// EPF bands run RM20 wide up to RM5,000 and RM100 wide up to RM20,000; each
// share is the rate applied to the band's upper limit, rounded up to the next
// ringgit. Above RM20,000 the rate applies to the actual wages, also rounded up.
export function epfBandUpperInSen(sen) {
    if (sen <= 500000) return Math.ceil(sen / 2000) * 2000;
    if (sen <= 2000000) return Math.ceil(sen / 10000) * 10000;
    return sen;
}

// baseWages are the wages without bonus. The schedule's note keeps the
// employer at 13% when it is only a bonus that lifts a RM5,000-or-less wage
// over RM5,000; that share is 13% of the actual wages, rounded up.
export function epfContribution(wages, { senior = false, baseWages = wages } = {}) {
    const sen = wagesInSen(wages);
    if (sen <= 1000) return { employee: 0, employer: 0 };
    const upper = epfBandUpperInSen(sen);
    const share = (percent, base = upper) => Math.ceil((base * percent) / 10000);
    if (senior) return { employee: 0, employer: share(4) };
    const bonusLifted = sen > 500000 && wagesInSen(baseWages) <= 500000;
    return {
        employee: share(11),
        employer: bonusLifted ? share(13, sen) : share(sen <= 500000 ? 13 : 12),
    };
}

// PERKESO and EIS share one set of bands: to RM30, RM50, RM70, RM100, RM140,
// RM200, then RM100 wide up to RM6,000; wages above RM6,000 contribute as
// RM6,000 does (the wage ceiling from 1 October 2024).
export function perkesoBandIndex(sen) {
    if (sen <= 3000) return 0;
    if (sen <= 5000) return 1;
    if (sen <= 7000) return 2;
    if (sen <= 10000) return 3;
    if (sen <= 14000) return 4;
    if (sen <= 20000) return 5;
    if (sen > 600000) return 64;
    return 5 + Math.ceil((sen - 20000) / 10000);
}

// Act 4, by band: [employer, First Category; employee, Invalidity Scheme;
// employee, Non-Employment Injury Scheme (LINDUNG 24 Jam, first phase 0.75%);
// employer, Second Category]. Employers pay nothing towards LINDUNG 24 Jam.
export const SOCSO_TABLE = [
    [0.40, 0.10, 0.20, 0.30], [0.70, 0.20, 0.30, 0.50], [1.10, 0.30, 0.50, 0.80], [1.50, 0.40, 0.65, 1.10],
    [2.10, 0.60, 0.90, 1.50], [2.95, 0.85, 1.25, 2.10], [4.35, 1.25, 1.85, 3.10], [6.15, 1.75, 2.65, 4.40],
    [7.85, 2.25, 3.35, 5.60], [9.65, 2.75, 4.15, 6.90], [11.35, 3.25, 4.85, 8.10], [13.15, 3.75, 5.65, 9.40],
    [14.85, 4.25, 6.35, 10.60], [16.65, 4.75, 7.15, 11.90], [18.35, 5.25, 7.85, 13.10], [20.15, 5.75, 8.65, 14.40],
    [21.85, 6.25, 9.35, 15.60], [23.65, 6.75, 10.15, 16.90], [25.35, 7.25, 10.85, 18.10], [27.15, 7.75, 11.65, 19.40],
    [28.85, 8.25, 12.35, 20.60], [30.65, 8.75, 13.15, 21.90], [32.35, 9.25, 13.85, 23.10], [34.15, 9.75, 14.65, 24.40],
    [35.85, 10.25, 15.35, 25.60], [37.65, 10.75, 16.15, 26.90], [39.35, 11.25, 16.85, 28.10], [41.15, 11.75, 17.65, 29.40],
    [42.85, 12.25, 18.35, 30.60], [44.65, 12.75, 19.15, 31.90], [46.35, 13.25, 19.85, 33.10], [48.15, 13.75, 20.65, 34.40],
    [49.85, 14.25, 21.35, 35.60], [51.65, 14.75, 22.15, 36.90], [53.35, 15.25, 22.85, 38.10], [55.15, 15.75, 23.65, 39.40],
    [56.85, 16.25, 24.35, 40.60], [58.65, 16.75, 25.15, 41.90], [60.35, 17.25, 25.85, 43.10], [62.15, 17.75, 26.65, 44.40],
    [63.85, 18.25, 27.35, 45.60], [65.65, 18.75, 28.15, 46.90], [67.35, 19.25, 28.85, 48.10], [69.15, 19.75, 29.65, 49.40],
    [70.85, 20.25, 30.35, 50.60], [72.65, 20.75, 31.15, 51.90], [74.35, 21.25, 31.85, 53.10], [76.15, 21.75, 32.65, 54.40],
    [77.85, 22.25, 33.35, 55.60], [79.65, 22.75, 34.15, 56.90], [81.35, 23.25, 34.85, 58.10], [83.15, 23.75, 35.65, 59.40],
    [84.85, 24.25, 36.35, 60.60], [86.65, 24.75, 37.15, 61.90], [88.35, 25.25, 37.85, 63.10], [90.15, 25.75, 38.65, 64.40],
    [91.85, 26.25, 39.35, 65.60], [93.65, 26.75, 40.15, 66.90], [95.35, 27.25, 40.85, 68.10], [97.15, 27.75, 41.65, 69.40],
    [98.85, 28.25, 42.35, 70.60], [100.65, 28.75, 43.15, 71.90], [102.35, 29.25, 43.85, 73.10], [104.15, 29.75, 44.65, 74.40],
    [104.15, 29.75, 44.65, 74.40],
];

// Act 800, by band: the employer and the employee each pay this amount.
export const EIS_TABLE = [
    0.05, 0.10, 0.15, 0.20, 0.25, 0.35, 0.50, 0.70, 0.90, 1.10, 1.30, 1.50, 1.70, 1.90, 2.10, 2.30,
    2.50, 2.70, 2.90, 3.10, 3.30, 3.50, 3.70, 3.90, 4.10, 4.30, 4.50, 4.70, 4.90, 5.10, 5.30, 5.50,
    5.70, 5.90, 6.10, 6.30, 6.50, 6.70, 6.90, 7.10, 7.30, 7.50, 7.70, 7.90, 8.10, 8.30, 8.50, 8.70,
    8.90, 9.10, 9.30, 9.50, 9.70, 9.90, 10.10, 10.30, 10.50, 10.70, 10.90, 11.10, 11.30, 11.50, 11.70,
    11.90, 11.90,
];

// LINDUNG 24 Jam: from the June 2026 contribution month, and voluntary for
// local employees since 8 July 2026 (an employee who opted out through
// PERKESO's Lindung Faedah portal pays nothing). Only the first-phase table is
// published; from June 2028 the rate rises to 1.00%, and a payslip for those
// months has to be entered by hand until that table is added here.
export const SKBBK_FIRST_MONTH = '2026-06';
export const SKBBK_PHASE_ONE_LAST_MONTH = '2028-05';

export function skbbkTableCovers(month) {
    return !month || String(month) <= SKBBK_PHASE_ONE_LAST_MONTH;
}

export function socsoContribution(wages, { senior = false, month = '', skbbkOptedOut = false } = {}) {
    const sen = wagesInSen(wages);
    if (sen <= 0) return { employer: 0, invalidity: 0, skbbk: 0 };
    const [employerFirst, invalidity, skbbk, employerSecond] = SOCSO_TABLE[perkesoBandIndex(sen)];
    const inSkbbk = !skbbkOptedOut && String(month) >= SKBBK_FIRST_MONTH && String(month) <= SKBBK_PHASE_ONE_LAST_MONTH;
    // Aged 60 and above: Second Category — employment injury only, which the
    // employer pays; LINDUNG 24 Jam has no age limit.
    return {
        employer: senior ? employerSecond : employerFirst,
        invalidity: senior ? 0 : invalidity,
        skbbk: inSkbbk ? skbbk : 0,
    };
}

// EIS does not cover employees aged 60 and above.
export function eisContribution(wages, { senior = false } = {}) {
    const sen = wagesInSen(wages);
    if (senior || sen <= 0) return { employer: 0, employee: 0 };
    const amount = EIS_TABLE[perkesoBandIndex(sen)];
    return { employer: amount, employee: amount };
}
