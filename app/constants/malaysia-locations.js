// ---- Malaysian state -> Local Authority (PBT) lookup -----------------------
// Used only for a GOV-type project (State -> Local Authority -> Application
// Type, see GOV_APPLICATION_TYPES in app/constants/project-types.js). Covers
// every Majlis Bandaraya/Dewan Bandaraya (city) and Majlis Perbandaran
// (municipal) council per state/federal territory, compiled from the Malay
// Wikipedia list of local governments. Malaysia has ~150 local authorities in
// total once every Majlis Daerah (district council) is counted, and getting
// every one of those exactly right from a general reference is not something
// to claim with confidence — so every state ends with an "Other / Lain-lain
// PBT" entry rather than silently omitting a smaller district and blocking
// whoever needs it.
export const MALAYSIA_STATES = [
    { state: 'Johor', authorities: ['Majlis Bandaraya Johor Bahru', 'Majlis Bandaraya Iskandar Puteri', 'Majlis Bandaraya Pasir Gudang', 'Majlis Perbandaran Batu Pahat', 'Majlis Perbandaran Kluang', 'Majlis Perbandaran Muar', 'Majlis Perbandaran Kulai', 'Majlis Perbandaran Segamat', 'Majlis Perbandaran Pengerang', 'Majlis Perbandaran Pontian', 'Other / Lain-lain PBT'] },
    { state: 'Kedah', authorities: ['Majlis Bandaraya Alor Setar', 'Majlis Perbandaran Sungai Petani', 'Majlis Perbandaran Langkawi Bandaraya Pelancongan', 'Majlis Perbandaran Kulim', 'Majlis Perbandaran Kubang Pasu', 'Other / Lain-lain PBT'] },
    { state: 'Kelantan', authorities: ['Majlis Perbandaran Kota Bharu Bandaraya Islam', 'Other / Lain-lain PBT'] },
    { state: 'Melaka', authorities: ['Majlis Bandaraya Melaka Bersejarah', 'Majlis Perbandaran Alor Gajah', 'Majlis Perbandaran Jasin', 'Majlis Perbandaran Hang Tuah Jaya', 'Other / Lain-lain PBT'] },
    { state: 'Negeri Sembilan', authorities: ['Majlis Bandaraya Seremban', 'Majlis Perbandaran Port Dickson', 'Majlis Perbandaran Jempol', 'Other / Lain-lain PBT'] },
    { state: 'Pahang', authorities: ['Majlis Bandaraya Kuantan', 'Majlis Perbandaran Temerloh', 'Majlis Perbandaran Bentong', 'Majlis Perbandaran Pekan', 'Other / Lain-lain PBT'] },
    { state: 'Perak', authorities: ['Majlis Bandaraya Ipoh (MBI)', 'Majlis Perbandaran Manjung', 'Majlis Perbandaran Taiping', 'Majlis Perbandaran Kuala Kangsar', 'Majlis Perbandaran Teluk Intan', 'Other / Lain-lain PBT'] },
    { state: 'Perlis', authorities: ['Majlis Perbandaran Kangar', 'Other / Lain-lain PBT'] },
    { state: 'Pulau Pinang', authorities: ['Majlis Bandaraya Pulau Pinang', 'Majlis Bandaraya Seberang Perai', 'Other / Lain-lain PBT'] },
    { state: 'Sabah', authorities: ['Dewan Bandaraya Kota Kinabalu', 'Majlis Perbandaran Sandakan', 'Majlis Perbandaran Tawau', 'Majlis Perbandaran Penampang', 'Other / Lain-lain PBT'] },
    { state: 'Sarawak', authorities: ['Dewan Bandaraya Kuching Utara', 'Majlis Bandaraya Kuching Selatan', 'Majlis Bandaraya Miri', 'Lembaga Kemajuan Bintulu', 'Majlis Perbandaran Sibu', 'Majlis Perbandaran Padawan', 'Majlis Perbandaran Kota Samarahan', 'Other / Lain-lain PBT'] },
    { state: 'Selangor', authorities: ['Majlis Bandaraya Shah Alam', 'Majlis Bandaraya Petaling Jaya', 'Majlis Bandaraya Subang Jaya', 'Majlis Bandaraya Diraja Klang', 'Majlis Perbandaran Ampang Jaya', 'Majlis Perbandaran Kajang', 'Majlis Perbandaran Selayang', 'Majlis Perbandaran Sepang', 'Majlis Perbandaran Kuala Langat', 'Majlis Perbandaran Kuala Selangor', 'Majlis Perbandaran Hulu Selangor', 'Other / Lain-lain PBT'] },
    { state: 'Terengganu', authorities: ['Majlis Bandaraya Kuala Terengganu', 'Majlis Perbandaran Kemaman', 'Majlis Perbandaran Dungun', 'Other / Lain-lain PBT'] },
    { state: 'Wilayah Persekutuan Kuala Lumpur', authorities: ['Dewan Bandaraya Kuala Lumpur (DBKL)'] },
    { state: 'Wilayah Persekutuan Labuan', authorities: ['Perbadanan Labuan (Labuan Corporation)'] },
    { state: 'Wilayah Persekutuan Putrajaya', authorities: ['Perbadanan Putrajaya (PPj)'] }
];

// Local Authority options for one state, in list order. An unrecognised or
// empty state returns no options — the form leaves the Local Authority
// select empty rather than guessing.
export function localAuthoritiesFor(stateName) {
    return MALAYSIA_STATES.find(entry => entry.state === stateName)?.authorities || [];
}
