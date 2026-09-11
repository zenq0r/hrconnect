// Malaysian statutory payroll rates (EPF/SOCSO/EIS/PCB) and the postcode
// table that fills in city/state from a five-digit postcode.
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

export const STATUTORY_RATES = {
    regular: {
        epf: { employeePct: 0.11, employerPctBelow5k: 0.13, employerPctAbove5k: 0.12, threshold: 5000 },
        socso: { wageCap: 6000, employeePct: 0.005, employerPct: 0.0175 },
        eis: { wageCap: 6000, employeePct: 0.002, employerPct: 0.002 }
    },
    senior: {
        epf: { employeePct: 0.0, employerPctBelow5k: 0.04, employerPctAbove5k: 0.04, threshold: 5000 },
        socso: { wageCap: 6000, employeePct: 0.0, employerPct: 0.0125 },
        eis: { wageCap: 6000, employeePct: 0.0, employerPct: 0.0 }
    }
};
