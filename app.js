// ============================================================
// ZENQOR TECHNOLOGIES - app.js (ENTERPRISE FINAL BUILD v8.7)
// ============================================================

import {
    db,
    auth,
    storage,
    initializeApp,
    deleteApp,
    getAuth,
    collection,
    doc,
    getDoc,
    getDocFromServer,
    setDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    onSnapshot,
    getDocs,
    writeBatch,
    query,
    where,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    verifyPasswordResetCode,
    confirmPasswordReset,
    checkActionCode,
    applyActionCode,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "./firebase-config.js";

// Vercel Web Analytics
import { inject } from "https://unpkg.com/@vercel/analytics@2.0.1/dist/index.mjs";
inject();

const { createApp } = Vue;

// Where this portal lives. Written once so a domain move is one edit, not a hunt
// through email bodies — it was hardcoded in two separate places before, and the
// server-side allowlist in api/_security.js is a third that has to agree with it.
const PORTAL_URL = 'https://www.hrconnect.zenqor.com.my/';

// Mirrors SEED_ADMIN_EMAILS in api/_security.js — see the note there. Both
// addresses count while the seed administrator moves to zenqor.com.my.
const SEED_ADMIN_EMAILS = new Set(['info@zenqor.com.my', 'admin@zenq0r.com']);
// Where account and support correspondence comes from, and the fallback shown
// when no company email is configured.
const SUPPORT_EMAIL = 'info@zenqor.com.my';

// A fresh state object is required whenever a Firebase (or legacy) action link
// is opened so no password, code, or success state leaks between attempts.
const createEmailActionFlow = (overrides = {}) => ({
    active: false,
    source: '',
    mode: '',
    oobCode: '',
    email: '',
    displayName: '',
    companyName: '',
    previousEmail: '',
    temporaryPassword: '',
    verifying: true,
    valid: false,
    otpVerified: false,
    error: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    success: false,
    successTitle: '',
    successDescription: '',
    ...overrides
});

const MALAYSIA_POSTCODE_PREFIXES = [
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

function lookupMalaysiaPostcode(value) {
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

const STATUTORY_RATES = {
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

// Every translatable data-i18n key on zenqor-tech (mirrors translations.en in
// zenqor-tech/script.js) — lets the Website Content > Page Text editor override any
// piece of copy on any zenqor-tech page by writing content/site_text.{key} = {en, ms}.
// Labels are auto-derived from the key name, not hand-curated, so keep this list and
// script.js's translations.en in sync manually if a new key is added there.
const SITE_TEXT_KEYS = [
    { key: 'nav_home', label: 'Nav Home', group: 'Navigation' },
    { key: 'nav_services', label: 'Nav Services', group: 'Navigation' },
    { key: 'nav_portfolio', label: 'Nav Portfolio', group: 'Navigation' },
    { key: 'nav_about', label: 'Nav About', group: 'Navigation' },
    { key: 'nav_faq', label: 'Nav Faq', group: 'Navigation' },
    { key: 'nav_contact', label: 'Nav Contact', group: 'Navigation' },
    { key: 'nav_port_gaming', label: 'Nav Port Gaming', group: 'Navigation' },
    { key: 'nav_port_web', label: 'Nav Port Web', group: 'Navigation' },
    { key: 'nav_return', label: 'Nav Return', group: 'Navigation' },
    { key: 'nav_legal', label: 'Nav Legal', group: 'Navigation' },
    { key: 'nav_data', label: 'Nav Data', group: 'Navigation' },
    { key: 'hero_badge', label: 'Hero Badge', group: 'Home - Hero & Stats' },
    { key: 'hero_title', label: 'Hero Title', group: 'Home - Hero & Stats' },
    { key: 'hero_sub', label: 'Hero - Subtitle', group: 'Home - Hero & Stats' },
    { key: 'btn_portfolio', label: 'Btn Portfolio', group: 'Home - Hero & Stats' },
    { key: 'btn_contact', label: 'Btn Contact', group: 'Home - Hero & Stats' },
    { key: 'stat_1', label: 'Stat 1', group: 'Home - Hero & Stats' },
    { key: 'stat_2', label: 'Stat 2', group: 'Home - Hero & Stats' },
    { key: 'stat_3', label: 'Stat 3', group: 'Home - Hero & Stats' },
    { key: 'stat_gov', label: 'Stat Gov', group: 'Home - Hero & Stats' },
    { key: 'stat_4', label: 'Stat 4', group: 'Home - Hero & Stats' },
    { key: 'trust_badge_1', label: 'Trust Badge 1', group: 'Home - Hero & Stats' },
    { key: 'trust_badge_2', label: 'Trust Badge 2', group: 'Home - Hero & Stats' },
    { key: 'trust_badge_3', label: 'Trust Badge 3', group: 'Home - Hero & Stats' },
    { key: 'trust_badge_4', label: 'Trust Badge 4', group: 'Home - Hero & Stats' },
    { key: 'testimonials_title', label: 'Testimonials Title', group: 'Home - Testimonials' },
    { key: 'testimonials_sub', label: 'Testimonials - Subtitle', group: 'Home - Testimonials' },
    { key: 'process_title', label: 'Process Title', group: 'Home - How We Work' },
    { key: 'process_sub', label: 'Process - Subtitle', group: 'Home - How We Work' },
    { key: 'process_1_t', label: 'Process 1 - Title', group: 'Home - How We Work' },
    { key: 'process_1_d', label: 'Process 1 - Description', group: 'Home - How We Work' },
    { key: 'process_2_t', label: 'Process 2 - Title', group: 'Home - How We Work' },
    { key: 'process_2_d', label: 'Process 2 - Description', group: 'Home - How We Work' },
    { key: 'process_3_t', label: 'Process 3 - Title', group: 'Home - How We Work' },
    { key: 'process_3_d', label: 'Process 3 - Description', group: 'Home - How We Work' },
    { key: 'process_4_t', label: 'Process 4 - Title', group: 'Home - How We Work' },
    { key: 'process_4_d', label: 'Process 4 - Description', group: 'Home - How We Work' },
    { key: 'process_note', label: 'Process Note', group: 'Home - How We Work' },
    { key: 'cookie_text', label: 'Cookie Text', group: 'Cookie Banner' },
    { key: 'cookie_accept', label: 'Cookie Accept', group: 'Cookie Banner' },
    { key: 'cookie_decline', label: 'Cookie Decline', group: 'Cookie Banner' },
    { key: 'about_title', label: 'About Title', group: 'About Page' },
    { key: 'about_sub', label: 'About - Subtitle', group: 'About Page' },
    { key: 'tech_1', label: 'Tech 1', group: 'About Page' },
    { key: 'tech_2', label: 'Tech 2', group: 'About Page' },
    { key: 'tech_3', label: 'Tech 3', group: 'About Page' },
    { key: 'tech_4', label: 'Tech 4', group: 'About Page' },
    { key: 'tech_1_li1', label: 'Tech 1 - List Item 1', group: 'About Page' },
    { key: 'tech_1_li2', label: 'Tech 1 - List Item 2', group: 'About Page' },
    { key: 'tech_1_li3', label: 'Tech 1 - List Item 3', group: 'About Page' },
    { key: 'tech_2_li1', label: 'Tech 2 - List Item 1', group: 'About Page' },
    { key: 'tech_2_li2', label: 'Tech 2 - List Item 2', group: 'About Page' },
    { key: 'tech_2_li3', label: 'Tech 2 - List Item 3', group: 'About Page' },
    { key: 'tech_3_li1', label: 'Tech 3 - List Item 1', group: 'About Page' },
    { key: 'tech_3_li2', label: 'Tech 3 - List Item 2', group: 'About Page' },
    { key: 'tech_3_li3', label: 'Tech 3 - List Item 3', group: 'About Page' },
    { key: 'tech_4_li1', label: 'Tech 4 - List Item 1', group: 'About Page' },
    { key: 'tech_4_li2', label: 'Tech 4 - List Item 2', group: 'About Page' },
    { key: 'tech_4_li3', label: 'Tech 4 - List Item 3', group: 'About Page' },
    { key: 'agencies_title', label: 'Agencies Title', group: 'About Page' },
    { key: 'agencies_sub', label: 'Agencies - Subtitle', group: 'About Page' },
    { key: 'srv_main_title', label: 'Srv Main Title', group: 'Services Page' },
    { key: 'srv_main_sub', label: 'Srv Main - Subtitle', group: 'Services Page' },
    { key: 'srv_1_t', label: 'Srv 1 - Title', group: 'Services Page' },
    { key: 'srv_1_d', label: 'Srv 1 - Description', group: 'Services Page' },
    { key: 'srv_2_t', label: 'Srv 2 - Title', group: 'Services Page' },
    { key: 'srv_2_d', label: 'Srv 2 - Description', group: 'Services Page' },
    { key: 'srv_3_t', label: 'Srv 3 - Title', group: 'Services Page' },
    { key: 'srv_3_d', label: 'Srv 3 - Description', group: 'Services Page' },
    { key: 'srv_4_t', label: 'Srv 4 - Title', group: 'Services Page' },
    { key: 'srv_4_d', label: 'Srv 4 - Description', group: 'Services Page' },
    { key: 'srv_5_t', label: 'Srv 5 - Title', group: 'Services Page' },
    { key: 'srv_5_d', label: 'Srv 5 - Description', group: 'Services Page' },
    { key: 'srv_6_t', label: 'Srv 6 - Title', group: 'Services Page' },
    { key: 'srv_6_d', label: 'Srv 6 - Description', group: 'Services Page' },
    { key: 'con_title', label: 'Con Title', group: 'Contact Page' },
    { key: 'con_sub', label: 'Con - Subtitle', group: 'Contact Page' },
    { key: 'hq_title', label: 'Hq Title', group: 'Contact Page' },
    { key: 'hq_addr', label: 'Hq Addr', group: 'Contact Page' },
    { key: 'email_caption', label: 'Email Caption', group: 'Contact Page' },
    { key: 'ph_name', label: 'Ph Name', group: 'Contact Page' },
    { key: 'ph_email', label: 'Ph Email', group: 'Contact Page' },
    { key: 'ph_msg', label: 'Ph Msg', group: 'Contact Page' },
    { key: 'ph_phone', label: 'Ph Phone', group: 'Contact Page' },
    { key: 'ph_company', label: 'Ph Company', group: 'Contact Page' },
    { key: 'opt_def', label: 'Opt Def', group: 'Contact Page' },
    { key: 'opt_1', label: 'Opt 1', group: 'Contact Page' },
    { key: 'opt_2', label: 'Opt 2', group: 'Contact Page' },
    { key: 'opt_3', label: 'Opt 3', group: 'Contact Page' },
    { key: 'opt_4', label: 'Opt 4', group: 'Contact Page' },
    { key: 'btn_submit', label: 'Btn Submit', group: 'Contact Page' },
    { key: 'btn_processing', label: 'Btn Processing', group: 'Contact Page' },
    { key: 'biz_hours_title', label: 'Biz Hours Title', group: 'Contact Page' },
    { key: 'biz_hours_weekday', label: 'Biz Hours Weekday', group: 'Contact Page' },
    { key: 'biz_hours_weekend', label: 'Biz Hours Weekend', group: 'Contact Page' },
    { key: 'loading_services', label: 'Loading Services', group: 'Loading / Error Messages' },
    { key: 'loading_portfolio', label: 'Loading Portfolio', group: 'Loading / Error Messages' },
    { key: 'error_db', label: 'Error Db', group: 'Loading / Error Messages' },
    { key: 'faq_page_title', label: 'Faq Page Title', group: 'FAQ Page' },
    { key: 'faq_sub', label: 'Faq - Subtitle', group: 'FAQ Page' },
    { key: 'faq_1_q', label: 'Faq 1 - Question', group: 'FAQ Page' },
    { key: 'faq_1_a', label: 'Faq 1 - Answer', group: 'FAQ Page' },
    { key: 'faq_2_q', label: 'Faq 2 - Question', group: 'FAQ Page' },
    { key: 'faq_2_a', label: 'Faq 2 - Answer', group: 'FAQ Page' },
    { key: 'faq_3_q', label: 'Faq 3 - Question', group: 'FAQ Page' },
    { key: 'faq_3_a', label: 'Faq 3 - Answer', group: 'FAQ Page' },
    { key: 'pg_hero_title', label: 'Pg Hero Title', group: 'Licensing & Permits Page (Hero)' },
    { key: 'pg_hero_sub', label: 'Pg Hero - Subtitle', group: 'Licensing & Permits Page (Hero)' },
    { key: 'tos_content', label: 'Tos Content', group: 'Legal Notices' },
    { key: 'rp_content', label: 'Rp Content', group: 'Return & Refund Policy' },
    { key: 'dp_title', label: 'Dp Title', group: 'Data Policy' },
    { key: 'dp_desc1', label: 'Dp Desc1', group: 'Data Policy' },
    { key: 'dp_desc2', label: 'Dp Desc2', group: 'Data Policy' },
    { key: 'footer_copy', label: 'Footer Copy', group: 'Footer' },
    { key: 'why_badge', label: 'Why Badge', group: 'Home - Why Choose Us' },
    { key: 'why_title', label: 'Why Title', group: 'Home - Why Choose Us' },
    { key: 'why_sub', label: 'Why Sub', group: 'Home - Why Choose Us' },
    { key: 'why_1_t', label: 'Why 1 - Title', group: 'Home - Why Choose Us' },
    { key: 'why_1_d', label: 'Why 1 - Description', group: 'Home - Why Choose Us' },
    { key: 'why_1_li1', label: 'Why 1 - List Item 1', group: 'Home - Why Choose Us' },
    { key: 'why_1_li2', label: 'Why 1 - List Item 2', group: 'Home - Why Choose Us' },
    { key: 'why_1_li3', label: 'Why 1 - List Item 3', group: 'Home - Why Choose Us' },
    { key: 'why_2_t', label: 'Why 2 - Title', group: 'Home - Why Choose Us' },
    { key: 'why_2_d', label: 'Why 2 - Description', group: 'Home - Why Choose Us' },
    { key: 'why_2_note', label: 'Why 2 - Note', group: 'Home - Why Choose Us' },
    { key: 'why_2_li1', label: 'Why 2 - List Item 1', group: 'Home - Why Choose Us' },
    { key: 'why_2_li2', label: 'Why 2 - List Item 2', group: 'Home - Why Choose Us' },
    { key: 'why_2_li3', label: 'Why 2 - List Item 3', group: 'Home - Why Choose Us' },
    { key: 'why_3_t', label: 'Why 3 - Title', group: 'Home - Why Choose Us' },
    { key: 'why_3_d', label: 'Why 3 - Description', group: 'Home - Why Choose Us' },
    { key: 'why_3_tag1', label: 'Why 3 - Tag 1', group: 'Home - Why Choose Us' },
    { key: 'why_3_tag2', label: 'Why 3 - Tag 2', group: 'Home - Why Choose Us' },
    { key: 'why_3_tag3', label: 'Why 3 - Tag 3', group: 'Home - Why Choose Us' },
    { key: 'why_3_tag4', label: 'Why 3 - Tag 4', group: 'Home - Why Choose Us' },
    { key: 'why_3_note', label: 'Why 3 - Note', group: 'Home - Why Choose Us' },
    { key: 'why_3_li1', label: 'Why 3 - List Item 1', group: 'Home - Why Choose Us' },
    { key: 'why_3_li2', label: 'Why 3 - List Item 2', group: 'Home - Why Choose Us' },
    { key: 'why_3_li3', label: 'Why 3 - List Item 3', group: 'Home - Why Choose Us' },
    { key: 'why_4_t', label: 'Why 4 - Title', group: 'Home - Why Choose Us' },
    { key: 'why_4_d', label: 'Why 4 - Description', group: 'Home - Why Choose Us' },
    { key: 'why_4_li1', label: 'Why 4 - List Item 1', group: 'Home - Why Choose Us' },
    { key: 'why_4_li2', label: 'Why 4 - List Item 2', group: 'Home - Why Choose Us' },
    { key: 'why_4_li3', label: 'Why 4 - List Item 3', group: 'Home - Why Choose Us' },
];

const RBAC_ROLES = {
    // 'website-content' manages the public zenqor-tech site's Firestore-backed
    // Portfolio galleries (portfolio_web = Digital Systems, portfolio_gaming =
    // Licensing & Permits), the Services page, and page-text overrides
    // (content/site_text). Restricted to Superadmin/Director/IT only — see
    // isContentAdmin() in firestore.rules, which grants write on exactly these
    // collections to that same set of roles (not the full isAdmin() surface).
    'Director': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'website-content', 'audit-logs', 'settings', 'profile'],
    'Superadmin': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'website-content', 'audit-logs', 'settings', 'profile'],
    'HR': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'profile'],
    'Account': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'reports', 'profile'],
    'IT': ['dashboard', 'project-activities', 'website-content', 'audit-logs', 'settings', 'profile'],
    'Client': ['project-activities', 'client-portal', 'client-documents', 'client-updates', 'client-support', 'profile'],
    'Staff': ['dashboard', 'project-activities', 'claims', 'profile']
};

// Human names for the RBAC modules above. The sidebar writes its own labels
// inline; the Staff Portal's Access panel needs them as data so it can print
// one row per module of whichever role it is describing.
const MODULE_LABELS = {
    'dashboard': 'Dashboard',
    'client-task': 'Client Task',
    'project-activities': 'Project Activities',
    'doc-generator': 'Quotation & Invoice',
    'payslip-generator': 'Payroll Management',
    'claims': 'Claims & Vouchers',
    'client-directory': 'Client Registration',
    'hr-employees': 'HR Employees',
    'reports': 'Reports & Analytics',
    'website-content': 'Website Management',
    'audit-logs': 'Audit & Security Log',
    'settings': 'Global Company Settings',
    'profile': 'Profile & Portal Access',
    'client-portal': 'Client Workspace',
    'client-documents': 'Client Documents',
    'client-updates': 'Project Updates',
    'client-support': 'Help & Support'
};

// The two roles that hold every module with every interaction on it, and the
// only two that may press a Staff Portal button that writes. Named once here
// because six separate places used to repeat the pair inline.
const FULL_ACCESS_ROLES = ['Superadmin', 'Director'];

// IT already reaches Settings and the Audit & Security Log, and support work
// regularly needs to answer "what access does this account actually hold?".
// They are admitted to the Staff Portal as observers: the three read-only
// interactions and nothing that changes an account. Adding a role here grants
// look-but-do-not-touch only — every writing action stays with FULL_ACCESS_ROLES.
const STAFF_PORTAL_OBSERVER_ROLES = ['IT'];

// Every interaction the Staff Portal offers on a portal account. The row
// buttons, the right-click menu and the permission check are all built from
// this one list, so an action can never appear on one surface while missing
// from another. `write: true` means the action changes the account and is
// therefore reserved for FULL_ACCESS_ROLES.
const STAFF_PORTAL_ACTIONS = [
    { key: 'view', label: 'View', icon: 'fa-eye', variant: 'zq-btn-neutral', write: false, title: 'View account details' },
    { key: 'read', label: 'Read', icon: 'fa-file-lines', variant: 'zq-btn-neutral', write: false, title: 'Read this account’s activity trail' },
    { key: 'access', label: 'Access', icon: 'fa-shield-halved', variant: 'zq-btn-neutral', write: false, title: 'Access rights held by this account' },
    { key: 'edit', label: 'Edit', icon: 'fa-pen', variant: 'zq-btn-info', write: true, title: 'Edit name and role' },
    { key: 'lock', label: 'Lock', icon: 'fa-lock', variant: 'zq-btn-warning', write: true, title: 'Lock this account out of the portal' },
    { key: 'reset', label: 'Reset', icon: 'fa-key', variant: 'zq-btn-warning', write: true, title: 'Require a new password at next sign-in' },
    { key: 'delete', label: 'Delete', icon: 'fa-trash', variant: 'zq-btn-destructive', write: true, title: 'Delete portal access' }
];

// The decision pair on a pending access request. Both write, so both are
// FULL_ACCESS_ROLES-only; they are kept apart from STAFF_PORTAL_ACTIONS
// because they act on a request, not on an existing account.
const STAFF_PORTAL_REQUEST_ACTIONS = [
    { key: 'accept', label: 'Accept', icon: 'fa-circle-check', variant: 'zq-btn-success', title: 'Approve and apply the requested role' },
    { key: 'reject', label: 'Reject', icon: 'fa-circle-xmark', variant: 'zq-btn-destructive', title: 'Decline the request' }
];

// Sign-in greeting timing. HOLD covers the fade in plus the pause that follows;
// FADE must stay >= the CSS transition on .zq-welcome-greeting or the overlay
// would unmount mid-fade and vanish instead of easing away.
const WELCOME_GREETING_HOLD_MS = 2200;
const WELCOME_GREETING_FADE_MS = 800;

// Bump the top entry's `version` (and add a new entry above it) whenever a meaningful feature ships.
// The list is the release history shown under Settings; nothing here interrupts a sign-in.
const APP_CHANGELOG = [
    {
        version: '2026.09.04-presence-and-approvals',
        title: 'An Online Light You Can Trust',
        notes: [
            'The Directory now shows an account as online only when the email it signs in with is stored on a Staff ID or a Client ID. Super Admin is the one exception, since it is not tied to either.',
            'An account that appears in neither directory now reads Offline rather than Online — add its employee or client record to bring the indicator back.',
            'Super Admin can now Approve and Reject a claim or payment voucher from the record preview. The permission was always there; the buttons were not.',
            'The approve button is now labelled by the stage of the record rather than by who is reading it, so a final approval never reads as "Approve & Forward".'
        ]
    },
    {
        version: '2026.09.04-staff-portal',
        title: 'The Staff Portal Gets Its Buttons',
        notes: [
            'Portal Access Management is now the Staff Portal, with View, Read, Access, Edit, Lock, Reset and Delete on every account.',
            'Locking an account keeps its record and role but refuses the sign-in, ends the open session, and is recorded in the audit log.',
            'Staff can request a role change from their own Profile page; Super Admin and Director accept or reject it in the Staff Portal.',
            'Full access stays with Super Admin and Director. IT observes the Staff Portal read-only for support work.'
        ]
    },
    {
        version: '2026.08.18-client-pages',
        title: 'A Better Client Workspace',
        notes: [
            'The redesigned Client Portal is now the main Dashboard for every Client account.',
            'The old Client dashboard has been retired to remove duplicate information.',
            'Documents, updates, account security and support now open as independent pages with browser Back support.'
        ]
    },
    {
        version: '2026.08.14',
        title: "What's New in ZENQOR Portal",
        notes: [
            'Client Portal now has its own distinct look, separate from the internal staff system.',
            'Clients can reply directly to project updates — Client Activity History is now a two-way conversation.',
            'New "My Projects" quick filter for staff, and document filters for clients.',
            'Dark mode, a notification center, and project client tagging (Standard/Premium/Priority) added.'
        ]
    }
];

// Mobile/tablet equivalent of a desktop right-click. Rich records/cards bind
// their own context menu explicitly; every portal button also receives the
// same interaction through the delegated handlers installed after mount.
const LONGPRESS_THRESHOLD_MS = 600;
const LONGPRESS_MOVE_TOLERANCE_PX = 10;
const longpressDirective = {
    mounted(el, binding) {
        el.__longpressHandler = binding.value;
        const state = { timer: null, startX: 0, startY: 0 };
        const clearTimer = () => { if (state.timer) { clearTimeout(state.timer); state.timer = null; } };
        const onTouchStart = (event) => {
            if (!event.touches || event.touches.length !== 1) { clearTimer(); return; }
            const touch = event.touches[0];
            state.startX = touch.clientX;
            state.startY = touch.clientY;
            clearTimer();
            state.timer = setTimeout(() => {
                state.timer = null;
                // A long-press fired — the browser will still synthesize a
                // `click` right after touchend. Swallow exactly that one click
                // so the card's own primary @click never also fires (no
                // accidental primary action, no double action).
                const suppressClick = (clickEvent) => { clickEvent.preventDefault(); clickEvent.stopImmediatePropagation(); };
                el.addEventListener('click', suppressClick, { capture: true, once: true });
                setTimeout(() => el.removeEventListener('click', suppressClick, { capture: true }), 500);
                if (el.__longpressHandler) el.__longpressHandler(touch);
            }, LONGPRESS_THRESHOLD_MS);
        };
        // Any real movement means the user is scrolling, not holding — cancel
        // the timer and let the scroll continue completely untouched (no
        // preventDefault anywhere in this directive, so normal scrolling is
        // never blocked).
        const onTouchMove = (event) => {
            if (!state.timer) return;
            const touch = event.touches && event.touches[0];
            if (!touch) return;
            if (Math.abs(touch.clientX - state.startX) > LONGPRESS_MOVE_TOLERANCE_PX || Math.abs(touch.clientY - state.startY) > LONGPRESS_MOVE_TOLERANCE_PX) clearTimer();
        };
        const onTouchEnd = () => clearTimer();
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchEnd, { passive: true });
        el.__longpressCleanup = () => {
            clearTimer();
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    },
    // The bound function is a fresh closure per v-for item (captures that row's
    // own `cust`/`project`) — Vue reuses the DOM node across re-renders, so the
    // handler reference must be refreshed here rather than only read once at mount.
    updated(el, binding) { el.__longpressHandler = binding.value; },
    unmounted(el) { if (el.__longpressCleanup) el.__longpressCleanup(); }
};

createApp({
    data() {
        return {
            isLoggedIn: false,
            authLoading: true,
            loginLoading: false,
            interactiveLoginInProgress: false,
            logoutConfirm: false,
            postLogoutChoice: false,
            passwordResetFlow: createEmailActionFlow(),
            forgotPasswordFlow: { active: false, email: '', loading: false, sent: false, error: '' },
            browserBackHandler: null,
            appUpdateCheckInterval: null,
            appVisibilityHandler: null,
            notificationsSyncTimer: null,
            idleWarningTimer: null,
            idleLogoutTimer: null,
            idleWarningVisible: false,
            idleActivityHandler: null,
            showPassword: false,
            authView: 'landing',
            loginForm: {
                email: '',
                password: ''
            },
            loginError: '',
            // OTP is used exclusively to verify a password-reset request.
            loginOtp: { show: false, code: '', error: '', sending: false, verifying: false, email: '', purpose: '', cooldownSeconds: 0 },
            loginOtpCooldownTimer: null,
            pendingLoginContext: null,
            currentTab: 'dashboard',
            mobileMenuOpen: false,
            // The navigation stays hidden until the user opens it deliberately
            // from the single menu control, on desktop as well as on mobile.
            desktopSidebarOpen: false,
            chartTimeFilter: 'monthly',
            // Which month the executive KPI strip reads. Empty always means
            // the live month, so a session left open overnight rolls over
            // with the calendar instead of freezing on a stale key.
            dashboardPeriodKey: '',
            sortOption: 'latest',
            recentActivityFilter: 'all',
            recentActivityAttentionOnly: false,
            searchQuery: '',
            currentPage: 1,
            itemsPerPage: 5,
            
            // PAGINATION & SORTING UNTUK CLAIMS
            claimsSortOption: 'latest',
            claimsCurrentPage: 1,
            claimsItemsPerPage: 10,

            // PAGINATION & SORTING UNTUK PAYMENT VOUCHERS
            vouchersSortOption: 'latest',
            vouchersCurrentPage: 1,
            vouchersItemsPerPage: 10,

            notification: { show: false, message: '', tone: 'success' },
            notificationsLog: [],
            portalNotifications: [],
            portalNotificationsLoaded: false,
            notificationsPanelOpen: false,
            staffDirectoryPanelOpen: false,
            staffDirectoryTab: 'staff',
            darkMode: false,
            appUpdateAvailable: false,
            appVersionMarker: '',
            // A sign-in greeting, not a dialog: 'show' keeps it mounted while
            // 'visible' drives the fade, so both directions can be animated.
            welcomeGreeting: { show: false, visible: false, name: '' },
            welcomeGreetingTimers: [],
            showUpdateHistory: false,

            activePrintModule: null,
            claimPrint: null,
            recordPreview: { show: false, html: '' },
            claimPreview: { show: false, claim: null, directorApprovalAttachment: '', directorApprovalAttachmentName: '', directorApprovalOriginalBytes: 0 },
            attachmentPreview: { show: false, url: '', label: '' },
            attachmentUploadState: { payment: false, receipt: false, director: false },
            unsubscribers: [],
            portalDataReady: false,
            // Closed monthly packages (Firestore `monthly_archives`, doc id = YYYY-MM).
            monthlyArchives: [],
            monthlyArchiveRunning: false,
            // '' = every record; otherwise a YYYY-MM key scoping the Reports exports.
            reportPeriod: '',
            portalDataReadyPromise: null,
            revenueChartInstance: null,
            statusChartInstance: null,
            claimsChartInstance: null,
            chartRenderTimer: null,
            chartRenderFrameOne: null,
            chartRenderFrameTwo: null,
            chartRenderAttempts: 0,
            presenceHeartbeatTimer: null,
            presenceClockTimer: null,
            clientStatusClockTimer: null,
            clientStatusNow: Date.now(),
            lastProjectPresenceSyncAt: 0,
            presenceNow: Date.now(),
            presencePageHideHandler: null,
            presencePageShowHandler: null,
            presenceVisibilityHandler: null,
            presenceNotificationsReady: false,
            portalUserOnlineStates: {},
            legacyClaimMigrationRunning: false,
            activityOwnerSyncRunning: false,
            activityAssigneeSyncRunning: false,

            changePasswordModal: {
                show: false,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
                error: '',
                loading: false,
                required: false
            },

            company: {
                name: "ZENQOR TECHNOLOGIES",
                ssm: "202603157897 (JM1045730-D)",
                // LHDN Tax Identification Number. Left blank deliberately —
                // it is a real government identifier and must be entered from
                // the company's own LHDN record, never guessed from the BRN.
                tin: "",
                address: "SURIA RESIDENCE (BLOK A), JALAN RESIDENCE SEK 3\nBANDAR MAHKOTA CHERAS, 43200 CHERAS, SELANGOR",
                address1: 'SURIA RESIDENCE (BLOK A)',
                address2: 'JALAN RESIDENCE SEK 3',
                address3: 'BANDAR MAHKOTA CHERAS',
                postcode: '43200',
                city: 'Cheras',
                state: 'Selangor',
                country: 'Malaysia',
                phone: "+60 11-6501 2569",
                email: SUPPORT_EMAIL,
                website: "www.zenqor.com.my",
                bankName: "MAYBANK ISLAMIC BERHAD",
                bankAccount: "5629 8205 7309"
            },
            userProfile: {
                name: '',
                email: '',
                role: '',
                photo: ''
            },
            profilePhotoUpload: { loading: false, error: '' },

            docHistory: [],
            payslipHistory: [],
            claimsHistory: [],
            paymentVouchers: [],
            projects: [],
            // Prevent duplicate automatic Client Task repairs while Firestore's
            // live customer/project listeners settle after sign-in.
            clientTaskRepairRunning: false,
            legacyProjectLinkRepairRunning: false,
            projectActivities: [],
            projectActivitiesLoaded: false,
            projectClientUpdates: [],
            projectClientUpdatesLoaded: false,
            activityTypes: ['To-Do', 'Document Request', 'Client Follow-Up', 'Government Submission', 'Review', 'Meeting', 'Payment Follow-Up', 'Other'],
            activityModal: { show: false, isEdit: false, activityId: '', project: null, form: { activityType: 'To-Do', summary: '', dueDate: '', assignedEmpNo: '', assignedName: '', assignedEmail: '', assignedPosition: '', details: '' } },
            clientUpdateTypes: ['Progress Update', 'Document Update', 'Government Update', 'Client Action Required', 'Milestone Completed', 'General Notice'],
            clientUpdateModal: { show: false, isEdit: false, updateId: '', original: null, project: null, form: { updateType: 'Progress Update', updateDate: '', message: '' } },
            clientReplyMessage: '',
            // Which invoice row is mid-upload, so only that row shows a spinner.
            paymentProofUploadingFor: '',
            bulkPrintPreparing: false,
            editingReplyId: '',
            editingReplyMessage: '',
            projectViewMode: 'board',
            projectScopeFilter: 'all',
            clientPortalFilter: { type: 'all', status: 'all' },
            expandedClientGroups: new Set(),
            draggingProject: null,
            dragOverStage: '',
            // Set by viewClientBoard() when drilling into one client's board from
            // the Client Tier page; consumed by filteredProjects (app-wide) and the
            // board template (switches from grouped-by-client to a flat per-project
            // list, since only one client is in view). Cleared when the sidebar's
            // own Project Activities button is clicked directly.
            boardClientFilter: null,
            clientTaskModal: { show: false, clientDirectoryId: '', saving: false },
            // Shared by every row/card that has secondary actions — right-click
            // (desktop) and long-press (mobile/tablet, via the v-longpress
            // directive) both call openContextMenu(event, items), where items is
            // built inline at the call site from that row's own existing
            // action methods/permission checks. Never a new authorization
            // surface — just a second way to reach what a visible button
            // already reaches.
            contextMenu: { show: false, x: 0, y: 0, items: [] },
            buttonContextLongPress: { timer: null, startX: 0, startY: 0, button: null },
            buttonContextHandlers: { contextmenu: null, touchstart: null, touchmove: null, touchend: null },
            projectPreview: { show: false, project: null, detailsReady: false },
            clientDocuments: { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' },
            clientDocumentsUnsubscribe: null,

            // Public-site content management: Firestore-backed content consumed directly by
            // zenqor-tech — Portfolio galleries (portfolio_web = Digital Systems,
            // portfolio_gaming = Licensing & Permits), the Services page, and page-text
            // overrides (content/site_text, any data-i18n key on any page). Once any doc
            // exists in a portfolio_web/portfolio_gaming/services collection, the matching
            // public page shows ONLY Firestore items — fallback content stops showing.
            websiteContentTab: 'portfolio_gaming',
            websiteContent: { portfolio_web: [], portfolio_gaming: [], services: [] },
            websiteContentModal: {
                show: false,
                isEdit: false,
                collectionName: 'portfolio_web',
                id: '',
                form: { tag: '', title: '', desc: '', imgUrl: '', imgStoragePath: '', icon: '', name: '' },
                // Selected-but-not-yet-uploaded image file, plus a local object URL for
                // instant preview and orientation detection before the actual upload happens
                // on save (so cancelling the modal never leaves an orphaned Storage file).
                imageFile: null,
                imagePreviewUrl: '',
                imageOrientation: '',
                uploading: false
            },
            siteTextOverrides: {},
            siteTextFilter: { group: 'all', search: '' },
            siteTextModal: { show: false, key: '', label: '', form: { en: '', ms: '' } },
            projectStages: ['Project Planning', 'Pending Documentation', 'In Progress', 'Pending By Government', 'Completed & Done'],
            projectModal: {
                show: false,
                isEdit: false,
                form: { id: '', projectRef: '', title: '', clientDirectoryId: '', clientPortalUid: '', clientName: '', clientEmail: '', clientSSM: '', clientTier: 'Standard', ownerEmpNo: '', ownerName: '', ownerEmail: '', ownerPhoto: '', ownerPosition: '', ownerDepartment: '', ownerAssignedAt: '', ownerPresenceStatus: 'Offline', ownerPresenceUpdatedAt: '', ownerLastSeen: '', status: 'Project Planning', startDate: '', targetDate: '', description: '' }
            },
            // confirmStep: null (picker) -> 'handover' or 'complete' (confirmation sub-view)
            markProjectDoneModal: { show: false, project: null, newOwnerEmpNo: '', confirmStep: null, saving: false },
            employees: [],
            customers: [],
            users: [],
            auditLogs: [],
            auditRetention: { value: 30, unit: 'day', loading: false, saving: false, message: '', error: '' },

            editingDocId: null,
            clientSavedForDocument: false,
            editingPayId: null,
            editingClaimId: null,
            editingVoucherId: null,
            selectedClaimIds: [],
            selectedVoucherIds: [],
            selectedPayEmployeeId: '',
            selectedClaimEmployeeId: '',
            selectedVoucherEmployeeId: '',
            claimFormMode: 'Claim',

            employeeModal: {
                show: false,
                isEdit: false,
                originalSensitive: {},
                form: {
                    empNo: 'ZEN-', name: '', email: '', ic: '', dept: '', position: '', status: 'Aktif',
                    epfNo: '', socsoNo: '', eisNo: '', taxNo: '', bankAcc: '', isSenior: false,
                    joinDate: '', basicSalary: 0, allowance: 0, deduction: 0
                }
            },
            employeeView: { show: false, employee: {} },
            employeeActionConfirm: { show: false, action: '', employee: null },
            clientView: { show: false, client: {} },
            // This is intentionally separate from docForm. A client can be registered
            // before any quotation or invoice is created, and legacy records are only
            // extended when a staff member explicitly saves that individual record.
            clientInformationModal: {
                show: false,
                isEdit: false,
                saving: false,
                form: {
                    id: '', clientId: '', clientName: '', clientSSM: '', clientBrnNew: '', clientBrnOld: '', clientTin: '', companyType: '', industry: '', clientTier: 'Standard',
                    clientContactPerson: '', clientPosition: '', clientEmail: '', clientPhone: '', additionalClientEmailsText: '',
                    clientAddress1: '', clientAddress2: '', clientAddress3: '', clientCity: '', clientState: '', clientPostcode: '',
                    clientCountry: 'Malaysia', clientNotes: '', createdAt: ''
                }
            },
            clientActionConfirm: { show: false, action: '', client: null },
            appConfirm: { show: false, title: '', message: '', confirmLabel: 'Yes, Continue', danger: false, noteLabel: '', notePlaceholder: '', note: '', onConfirm: null, onResolve: null },

            // Staff and management accounts are limited to Zenqor's approved
            // company domains. Client accounts use the email registered for them.
            allowedStaffDomains: ['zenq0r.com', 'zenqor.com.my'],
            portalAccessRevocationInProgress: false,
            portalLockCheckInProgress: false,
            // A normal sign-out (including the idle-session timeout) is never a
            // revocation. Keep that intent until Firebase notifies us that the
            // session has ended, so the signed-out screen cannot retain an old
            // "access removed" message and confuse the next sign-in attempt.
            intentionalLogoutInProgress: false,

            userModal: {
                show: false,
                isEdit: false,
                form: { uid: '', name: '', email: '', password: '', role: 'Staff' }
            },

            // Staff Portal — the account roster's interaction surface. One
            // drawer serves View, Read and Access; `tab` is which of the three
            // opened it. `busyUid` disables that row's buttons while a write is
            // in flight so a second click cannot fire the same action twice.
            staffPortalAccount: { show: false, tab: 'overview', account: null },
            staffPortalBusyUid: '',
            // Portal access requests raised by staff from their own Profile page
            // and decided (Accept/Reject) by Superadmin/Director in the Staff
            // Portal. Requests stay listed after a decision as the record of it.
            accessRequests: [],
            accessRequestModal: { show: false, saving: false, requestedRole: '', reason: '', error: '' },

            claimSubCategories: {
                'Medical': [
                    'Clinic / Hospital Treatment',
                    'Prescription Medication',
                    'Dental and Eye Care',
                    'Physiotherapy / Specialist Treatment',
                    'Vaccination',
                    'Medical Equipment'
                ],
                'Travel and Transportation': [
                    'Mileage Claim',
                    'Tolls and Parking',
                    'Ride-Hailing / Taxi',
                    'Hotel Accommodation',
                    'Flight / Train / Bus Ticket',
                    'Vehicle Rental',
                    'Fuel',
                    'Visa / Travel Insurance'
                ],
                'Entertainment and Client Relations': [
                    'Client Meal',
                    'Department / Company Event',
                    'Client Gift / Souvenir',
                    'Corporate / Networking Event'
                ],
                'Training and Development': [
                    'Course / Seminar / Workshop',
                    'Professional Certification Fee',
                    'Books / Reference Materials',
                    'Learning Platform Subscription'
                ],
                'Operations and Projects': [
                    'Project Equipment / Supplies',
                    'Software / SaaS Subscription',
                    'Emergency Operations Purchase',
                    'Equipment Maintenance'
                ],
                'Remuneration and Services': [
                    'Casual Wages / Daily Pay',
                    'Freelance / Professional Fee',
                    'Contractor Payment',
                    'Allowance / Honorarium',
                    'Vendor / Supplier Payment',
                    'Temporary Staff Payment'
                ],
                'Communications and Utilities': [
                    'Mobile Phone',
                    'Internet / Data',
                    'Video Meeting / Communications',
                    'Printing / Photocopying'
                ],
                'Miscellaneous': [
                    'Stationery and Office Supplies',
                    'Communication Allowance',
                    'Courier and Postage',
                    'Other Parking / Toll',
                    'Other (Specify in Description)'
                ]
            },

            voucherSubCategories: {
                'Vendor and Supplier': [
                    'Supplier Invoice Payment',
                    'Vendor Service Payment',
                    'Utility Bill Payment',
                    'Rental / Lease Payment',
                    'Equipment / Asset Purchase',
                    'Maintenance and Repair Service'
                ],
                'Wages and Contractor': [
                    'Casual Wages / Daily Pay',
                    'Freelance / Professional Fee',
                    'Contractor Payment',
                    'Temporary Staff Payment'
                ],
                'Allowance and Honorarium': [
                    'Staff Allowance',
                    'Honorarium',
                    'Meeting / Committee Allowance',
                    'Travel and Accommodation Claim'
                ],
                'Operations and Projects': [
                    'Project Equipment Purchase',
                    'Software / SaaS Subscription',
                    'Emergency Operations Purchase',
                    'Logistics / Courier Service'
                ],
                'Travel and Accommodation': [
                    'Flight / Train / Bus Ticket',
                    'Hotel Accommodation',
                    'Vehicle Rental',
                    'Fuel and Toll',
                    'Visa / Travel Insurance'
                ],
                'Marketing and Business Development': [
                    'Advertising and Promotion',
                    'Sponsorship',
                    'Printing and Marketing Materials',
                    'Event / Exhibition Cost'
                ],
                'Statutory and Government Payment': [
                    'SSM / License Renewal Fee',
                    'Government Stamp Duty',
                    'Income Tax Installment',
                    'EPF / SOCSO / EIS Late Payment Penalty'
                ],
                'Insurance and Legal': [
                    'Insurance Premium',
                    'Legal / Professional Fee',
                    'Audit and Accounting Fee'
                ],
                'Corporate and Client Relations': [
                    'Client Entertainment',
                    'Corporate Gift / Souvenir',
                    'Donation / CSR Contribution'
                ],
                'Miscellaneous': [
                    'Bank Charges / Fees',
                    'Refund to Client / Customer',
                    'Other (Specify in Description)'
                ]
            },

            docForm: {
                type: 'Invoice',
                docNo: `INV-${new Date().getFullYear()}-01001`,
                status: 'Unpaid',
                paymentMethod: 'Bank Transfer (EFT)',
                paymentBank: '',
                paymentReceiver: '',
                paymentRefNo: '',
                paymentAttachment: '',
                date: new Date().toISOString().substr(0, 10),
                dueDate: new Date(Date.now() + 5*24*60*60*1000).toISOString().substr(0, 10),
                clientName: '',
                clientPhone: '',
                clientSSM: '',
                clientAddress: '',
                clientAddress1: '',
                clientAddress2: '',
                clientAddress3: '',
                clientCity: '',
                clientState: '',
                clientPostcode: '',
                clientCountry: 'Malaysia',
                clientEmail: '',
                clientContactPerson: '',
                clientPosition: '',
                customerId: '',
                projectId: '',
                projectRef: '',
                projectTitle: '',
                sourceQuotationId: '',
                sourceQuotationNo: '',
                additionalClientEmailsText: '',
                items: [{ desc: '', qty: 1, price: 0 }],
                discount: 0
            },

            payForm: {
                name: '', ic: '', empNo: '', empEmail: '', position: '', dept: '',
                isSenior: false, joinDate: '', bankAcc: '', epfSocso: '',
                month: new Date().toISOString().slice(0, 7),
                payDate: new Date().toISOString().slice(0, 10),
                basic: 0, ot: 0, phone: 0, transport: 0, meal: 0, bonus: 0,
                dedEpf: 0, dedSocso: 0, dedEis: 0, dedPcb: 0, dedAdvance: 0, dedOther: 0
            },

            claimForm: {
                documentType: 'Claim', name: '', empNo: '', empEmail: '', position: '', dept: '',
                expenseDate: new Date().toISOString().substr(0, 10),
                category: 'Medical', subCategory: 'Clinic / Hospital Treatment',
                payeeName: '', payeeType: 'Individual', payeeReference: '', paymentPurpose: '',
                amount: 0, receiptNo: '', description: '', receiptAttachment: '', receiptAttachmentName: '', receiptAttachmentOriginalBytes: 0, status: 'Pending HR',
                assignedToUid: '', assignedToName: '', assignedToEmail: '', assignedToRole: 'HR'
            },

            voucherForm: {
                documentType: 'Payment Voucher', name: '', empNo: '', empEmail: '', position: '', dept: '',
                paymentDate: new Date().toISOString().substr(0, 10),
                category: 'Vendor and Supplier', subCategory: 'Supplier Invoice Payment',
                payeeName: '', payeeType: 'Vendor / Supplier', payeeReference: '', paymentPurpose: '',
                amount: 0, voucherNo: '', description: '', receiptAttachment: '', receiptAttachmentName: '', receiptAttachmentOriginalBytes: 0, status: 'Pending HR',
                assignedToUid: '', assignedToName: '', assignedToEmail: '', assignedToRole: 'HR'
            },

            payCalc: { gross: 0, deduct: 0, net: 0, epfEmpr: 0, socsoEmpr: 0, eisEmpr: 0 }
        };
    },
    computed: {
        canManageSensitiveData() { return ['Superadmin', 'Director', 'HR'].includes(this.userProfile.role); },
        // Identity/banking numbers (IC/Passport, Bank Account, EPF/SOCSO) may be
        // entered ONCE when an employee record is first created by anyone with HR
        // Employees access (canManageEmployees), but once that record already
        // exists, changing these specific fields is restricted to Superadmin/
        // Director only — narrower than canManageSensitiveData above, which still
        // includes HR for everything else on the employee record.
        canEditLockedIdentityFields() { return ['Superadmin', 'Director'].includes(this.userProfile.role); },
        canManageEmployees() { return this.hasModulePermission('hr-employees', 'edit'); },
        canManageClients() { return this.hasModulePermission('client-directory', 'edit'); },
        // Was Director-only. Superadmin now holds it too: an account that can
        // delete a Client Task could not create one, which is not a coherent
        // boundary for a role meant to reach everything.
        canCreateClientTask() { return this.isFullAccessRole; },
        canManageDocuments() { return this.hasModulePermission('doc-generator', 'edit'); },
        // Clients may upload to their OWN client_documents folder (but not the
        // doc-generator/billing tools canManageDocuments otherwise gates) — the
        // Firestore/Storage rules independently re-verify clientDirectoryId ownership,
        // this is just the UI-level show/hide for the upload button.
        canUploadClientDocuments() { return this.canManageDocuments || this.userProfile.role === 'Client'; },
        // Must mirror the client_documents read rule. Staff sit outside it: they run
        // projects but are not trusted with the client's file repository. Without
        // this check the panel subscribes anyway and paints a red permission error
        // on every project a Staff PIC or activity assignee opens.
        canViewClientDocuments() { return ['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Client'].includes(this.userProfile.role); },
        canManagePayroll() { return this.hasModulePermission('payslip-generator', 'edit'); },
        canDeleteEmployees() { return this.hasModulePermission('hr-employees', 'delete'); },
        canDeleteClients() { return this.hasModulePermission('client-directory', 'delete'); },
        // Finance is stored as the Account role. It may delete only official
        // billing documents; all other delete capabilities remain unchanged.
        canDeleteBillingDocuments() { return ['Superadmin', 'Director', 'Account'].includes(this.userProfile.role); },
        canDeleteDocuments() { return this.canDeleteBillingDocuments; },
        canDeletePayroll() { return this.hasModulePermission('payslip-generator', 'delete'); },
        // Superadmin and Director hold every module their role lists, with edit
        // and delete on each, and no per-user override may subtract from that.
        // Anything narrower would let an admin lock another admin out of a page.
        isFullAccessRole() { return FULL_ACCESS_ROLES.includes(this.userProfile.role); },
        canDelete() { return this.isFullAccessRole; },
        canManageRBAC() { return this.isFullAccessRole; },
        // Staff Portal. Managing it is the full-access pair and nobody else:
        // every interaction that writes an account — Edit, Lock, Reset, Delete,
        // Accept, Reject — is gated on this. Observing it additionally admits
        // STAFF_PORTAL_OBSERVER_ROLES, who get View, Read and Access only.
        canManageStaffPortal() { return this.isFullAccessRole; },
        canObserveStaffPortal() { return this.isFullAccessRole || STAFF_PORTAL_OBSERVER_ROLES.includes(this.userProfile.role); },
        // A locked account keeps its record and its role — it simply may not
        // sign in or write anything until an administrator unlocks it. This is
        // the viewer's own state, used to end a session the moment it is locked.
        isCurrentAccountLocked() {
            const currentUser = this.users.find(user => user.id === this.userProfile.uid);
            return this.isAccountLocked(currentUser);
        },
        sortedAccessRequests() {
            return [...this.accessRequests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        },
        pendingAccessRequests() {
            return this.sortedAccessRequests.filter(request => (request.status || 'Pending') === 'Pending');
        },
        decidedAccessRequests() {
            return this.sortedAccessRequests.filter(request => (request.status || 'Pending') !== 'Pending');
        },
        myAccessRequests() {
            return this.sortedAccessRequests.filter(request => request.requesterUid === this.userProfile.uid);
        },
        // One open request at a time per person. A second one would leave two
        // Accept buttons pointing at the same account with different roles.
        myPendingAccessRequest() {
            return this.myAccessRequests.find(request => (request.status || 'Pending') === 'Pending') || null;
        },
        // Roles a staff member may ask to be moved to: every staff role except
        // the one they already hold. Client is not requestable — a Client
        // account belongs to a customer record, not to an internal request.
        requestableRoles() {
            return Object.keys(RBAC_ROLES).filter(role => role !== 'Client' && role !== this.userProfile.role);
        },
        // The Profile page offers the request form to staff who are not already
        // full access. Superadmin and Director would be asking themselves.
        canRequestAccessChange() {
            return !this.isFullAccessRole && this.userProfile.role !== 'Client' && Boolean(this.userProfile.uid);
        },
        canManageCompanySettings() { return ['Director', 'Superadmin', 'IT'].includes(this.userProfile.role); },
        canManageProjects() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        // Must mirror the customers subscription condition in loadPortalData(), or
        // any gate built on this.customers silently evaluates against an empty list
        // for Staff/IT — who deliberately cannot read the Client Directory.
        canReadClientDirectory() { return this.hasAccess('client-directory') || this.hasAccess('doc-generator'); },
        // Exposed to the template so the support-email fallback is not a second
        // hardcoded copy of the address in the markup.
        supportEmail() { return SUPPORT_EMAIL; },
        // Clicking a Client Task only filters the Project Activities board to that
        // client — it reveals nothing the board would not already show, because
        // filteredProjects still scopes a non-manager to their own PIC and assigned
        // projects. So the gate is "can you open Project Activities at all", not
        // "are you a Director": a PIC who can see the Client Task page must be able
        // to open it, which is the whole point of the page.
        canOpenClientTaskBoard() { return this.hasAccess('project-activities'); },
        canBackupDatabase() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        // Closing a period writes a company-wide financial summary, so it sits with
        // the other whole-company actions rather than with per-module edit rights.
        canCloseAccountingPeriod() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        // Header staff-roster button: every employee regardless of online status,
        // online staff surfaced first (then alphabetical) so Director/Superadmin
        // gets an at-a-glance headcount-style view, not a presence filter.
        companyTinState() { return this.tinFormatState(this.company.tin); },
        // Every email that a directory record vouches for: the HR employee
        // directory plus every authorized address on a client company record
        // (the primary contact and any additionalClientEmails). Built once per
        // data change rather than rescanned per row - isPresenceAnchored() is
        // called from list sorting and from every rendered row, so a linear
        // scan there would be quadratic on a large staff list.
        presenceAnchorEmails() {
            const anchored = new Set();
            this.employees.forEach(emp => {
                const email = String(emp.email || '').trim().toLowerCase();
                if (email) anchored.add(email);
            });
            this.customers.forEach(customer => {
                [customer.clientEmail, ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])]
                    .map(address => String(address || '').trim().toLowerCase())
                    .filter(Boolean)
                    .forEach(address => anchored.add(address));
            });
            return anchored;
        },
        canViewStaffDirectory() { return this.canManageRBAC; },
        // HR employee records plus every non-Client portal login that has no
        // employee record of its own — the seed administrator above all, who
        // was signed in and running the system while absent from its directory.
        // Keyed by email so anyone holding both records appears once, as their
        // employee entry, which carries the real position and department.
        // Portal docs store the same presence fields, so the presence helpers
        // read a synthesized row exactly as they read an employee.
        staffDirectoryList() {
            const employeeEmails = new Set(
                this.employees.map(emp => String(emp.email || '').trim().toLowerCase()).filter(Boolean)
            );
            const portalOnly = this.users
                .filter(user => user.role && user.role !== 'Client')
                .filter(user => {
                    const email = String(user.email || '').trim().toLowerCase();
                    return email && !employeeEmails.has(email);
                })
                .map(user => ({
                    ...user,
                    // Namespaced so it can never collide with a real empNo.
                    empNo: `portal:${String(user.email).trim().toLowerCase()}`,
                    position: this.getRoleDisplayName(user.role),
                    dept: ''
                }));
            return [...this.employees, ...portalOnly].sort((a, b) => {
                const onlineDiff = (this.isEmployeeOnline(b) ? 1 : 0) - (this.isEmployeeOnline(a) ? 1 : 0);
                if (onlineDiff !== 0) return onlineDiff;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });
        },
        // Same header dropdown, second tab: every Client-role portal login
        // (this.users, already a live onSnapshot subscription — no extra reads),
        // tagged with its linked customer/company name via the same
        // clientEmail/additionalClientEmails matching isClientOnline() uses.
        clientDirectoryList() {
            return this.users
                .filter(user => user.role === 'Client' && String(user.email || '').trim())
                .map(user => {
                    const email = String(user.email || '').trim().toLowerCase();
                    const customer = this.customers.find(item => {
                        const authorizedEmails = new Set([
                            item.clientEmail,
                            ...(Array.isArray(item.additionalClientEmails) ? item.additionalClientEmails : [])
                        ].map(addr => String(addr || '').trim().toLowerCase()).filter(Boolean));
                        return authorizedEmails.has(email);
                    });
                    return { ...user, companyName: customer?.clientName || '' };
                })
                .sort((a, b) => {
                    const onlineDiff = (this.isPortalUserOnline(b) ? 1 : 0) - (this.isPortalUserOnline(a) ? 1 : 0);
                    if (onlineDiff !== 0) return onlineDiff;
                    return String(a.name || a.email).localeCompare(String(b.name || b.email));
                });
        },
        notificationsForDisplay() {
            const local = this.notificationsLog.map(notification => ({ ...notification, source: 'local' }));
            const realtime = this.portalNotifications.filter(notification => !notification.hiddenAt).map(notification => ({ ...notification, timestamp: notification.createdAt, source: 'portal' }));
            return [...realtime, ...local]
                .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
                .slice(0, 50);
        },
        unreadNotificationsCount() { return this.notificationsForDisplay.filter(n => !n.read).length; },
        appChangelog() { return APP_CHANGELOG; },
        priorityClients() { return this.customers.filter(c => c.clientTier === 'Priority'); },
        // Client Task board: every client bucketed by the LIVE status of their
        // own projects (clientTaskStatus) — not the manual clientTier tag, which
        // stays a separate, untouched feature (Dashboard's Priority Clients
        // widget, Client Directory badges, the drawer's Set Tier pills).
        // Staff and IT cannot read the Client Directory (see the customers rule),
        // so this.customers is empty for them and the board below would render as
        // three empty columns. Their own project documents already carry the
        // client fields the card shows, and a project only exists under a Client
        // Task parent, so the parent can be reconstructed from the projects they
        // are already authorized to hold — no extra client data is exposed.
        clientTaskSource() {
            if (this.canReadClientDirectory) return this.customers.filter(cust => cust.clientTaskCreatedAt);
            const byId = new Map();
            this.projects.forEach(project => {
                const id = String(project.clientDirectoryId || '').trim();
                if (!id || byId.has(id)) return;
                byId.set(id, {
                    id,
                    clientName: project.clientName || '',
                    clientEmail: project.clientEmail || '',
                    clientSSM: project.clientSSM || '',
                    clientTier: project.clientTier || 'Standard',
                    // The project could not exist without its parent, so the card's
                    // membership marker is implied. viewClientBoard checks it.
                    clientTaskCreatedAt: project.createdAt || project.updatedAt || 'derived'
                });
            });
            return [...byId.values()];
        },
        clientTaskGroups() {
            const buckets = { Consult: [], 'In-Progress': [], Complete: [] };
            // Membership gate — a client appears once it has a Client Task
            // parent. A Client Directory registration alone stays separate;
            // creating the first project adds this parent automatically.
            this.clientTaskSource.forEach(cust => {
                buckets[this.clientTaskStatus(cust.id)].push(cust);
            });
            return [
                { key: 'Consult', clients: buckets.Consult },
                { key: 'In-Progress', clients: buckets['In-Progress'] },
                { key: 'Complete', clients: buckets.Complete }
            ].map(group => ({
                ...group,
                clients: [...group.clients].sort((a, b) => String(a.clientName || '').localeCompare(String(b.clientName || '')))
            }));
        },
        claimsPipelineStats() {
            const stages = [
                { key: 'Pending HR', label: 'Pending HR', color: '#F59E0B' },
                { key: 'Pending Account', label: 'Pending Account', color: '#3B82F6' },
                { key: 'Pending Director', label: 'Pending Director', color: '#8B5CF6' },
                { key: 'Approved', label: 'Approved', color: '#10B981' },
                { key: 'Rejected', label: 'Rejected', color: '#EF4444' }
            ];
            const combined = [...this.claimsHistory, ...this.paymentVouchers];
            const total = combined.length;
            return stages.map(stage => {
                const count = combined.filter(c => c.status === stage.key).length;
                return { ...stage, count, pct: total ? Math.round((count / total) * 100) : 0 };
            });
        },
        claimsPipelineTotal() { return this.claimsHistory.length + this.paymentVouchers.length; },
        legacyPaymentVouchersCount() { return this.claimsHistory.filter(c => (c.documentType || c.type) === 'Payment Voucher').length; },
        currentYear() { return new Date().getFullYear(); },
        payslipYtdMultiplier() {
            const month = Number(String(this.payForm.month || '').split('-')[1]);
            return month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
        },
        employeeViewLiveRecord() {
            return this.employees.find(emp => emp.empNo === this.employeeView.employee.empNo) || this.employeeView.employee;
        },

        myPayslips() { return this.payslipHistory.filter(p => p.raw && (p.raw.empEmail === this.userProfile.email || p.name === this.userProfile.name)); },
        myLatestNetSalary() {
            if (this.myPayslips.length === 0) return 0;
            const sorted = [...this.myPayslips].sort((a, b) => new Date(b.date) - new Date(a.date));
            return Number(sorted[0].amount) || 0;
        },
        myClaims() { return this.claimsHistory.filter(c => c.empEmail === this.userProfile.email || c.name === this.userProfile.name); },
        myPaymentVouchers() { return this.paymentVouchers.filter(v => v.empEmail === this.userProfile.email || v.name === this.userProfile.name); },
        myPendingClaimsCount() { return [...this.myClaims, ...this.myPaymentVouchers].filter(c => c.status && c.status.includes('Pending')).length; },
        myApprovedClaimsAmount() { return [...this.myClaims, ...this.myPaymentVouchers].filter(c => c.status === 'Approved').reduce((sum, c) => sum + (Number(c.amount) || 0), 0); },

        // A secondary authorized contact's own email never matches raw.clientEmail
        // (always the primary contact's), so prefer matching by the shared
        // clientDirectoryId claim — same linkage the docs query itself now uses.
        myClientDocs() {
            const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
            const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
            // Keep the original email path as a narrow compatibility path for
            // billing records created before Client ID linking was mandatory.
            // It is an OR, rather than a fallback: a linked client can therefore
            // still retrieve its own historic records while all new records are
            // isolated by the immutable Client Directory ID.
            return this.docHistory.filter(d => d.raw && (
                (clientDirectoryId && String(d.raw.customerId || '').trim() === clientDirectoryId) ||
                (clientEmail && String(d.raw.clientEmail || '').trim().toLowerCase() === clientEmail)
            ));
        },
        myClientRecord() {
            if (this.userProfile.clientDirectoryId) {
                return this.customers.find(c => c.id === this.userProfile.clientDirectoryId) || null;
            }
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            if (!email) return null;
            return this.customers.find(c => String(c.clientEmail || '').trim().toLowerCase() === email) || null;
        },
        clientPortalIdentity() {
            if (this.myClientRecord) return this.myClientRecord;
            const linkedProject = this.projects.find(project => project.clientDirectoryId || project.clientName) || null;
            return {
                clientName: linkedProject?.clientName || this.userProfile.name || 'Client Account',
                clientSSM: linkedProject?.clientSSM || '',
                // Projects retain a tier snapshot for the portal fallback. The
                // authoritative value still comes from customers/{id} when it is
                // available (for example, after staff retag a client).
                clientTier: linkedProject?.clientTier || 'Standard',
                clientEmail: linkedProject?.clientEmail || this.userProfile.email || ''
            };
        },
        myClientPaidCount() { return this.clientPortalDocs.filter(d => d.type === 'Invoice' && d.status === 'Paid').length; },
        myClientUnpaidCount() { return this.clientPortalDocs.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },
        clientActiveProjectsCount() { return this.projects.filter(project => project.status !== 'Completed & Done').length; },
        clientUpdatesTimeline() {
            // This is the Client Portal conversation feed, not a general activity log.
            // A client sees only safe project-status events and conversation messages
            // belonging to their own current projects. Internal Activity Type, PIC and
            // work notes are intentionally never copied to this collection.
            const visibleProjectIds = new Set(this.projects.map(project => String(project.id || '')).filter(Boolean));
            const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
            const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
            const allowedTypes = new Set([...this.clientUpdateTypes, 'Client Reply', 'Project Activity Update', 'Project Status']);
            const persistedUpdates = this.projectClientUpdates
                .filter(update => visibleProjectIds.has(String(update?.projectId || '')) ||
                    (clientDirectoryId && String(update?.clientDirectoryId || '') === clientDirectoryId) ||
                    (clientEmail && String(update?.clientEmail || '').trim().toLowerCase() === clientEmail))
                .filter(update => allowedTypes.has(String(update?.updateType || '')))
                .map(update => ({ ...update, isStatusSnapshot: false }));

            // Existing projects may predate the Client Portal update feed. Until an
            // activity/status event is recorded, show one live, safe status snapshot so
            // the client never receives an empty feed despite having an active project.
            const projectsWithPersistedUpdate = new Set(persistedUpdates.map(update => String(update.projectId || '')));
            const statusSnapshots = this.projects
                .filter(project => project?.id && !projectsWithPersistedUpdate.has(String(project.id)))
                .map(project => ({
                    id: `STATUS-SNAPSHOT-${project.id}-${project.updatedAt || project.createdAt || 'CURRENT'}`,
                    projectId: project.id,
                    projectRef: project.projectRef,
                    projectTitle: project.title,
                    updateType: 'Project Status',
                    updateDate: String(project.updatedAt || project.createdAt || this.getLocalDateKey()).slice(0, 10),
                    message: `Current project status: ${project.status || 'Project Planning'}.`,
                    senderRole: 'System',
                    senderName: 'ZENQOR Project Team',
                    createdAt: project.updatedAt || project.createdAt || '',
                    isStatusSnapshot: true
                }));

            return [...persistedUpdates, ...statusSnapshots]
                .sort((a, b) => String(b.createdAt || b.updateDate || '').localeCompare(String(a.createdAt || a.updateDate || '')));
        },
        clientProjectStatusCards() {
            return this.projects
                .filter(project => project?.id)
                .map(project => {
                    const latestProjectEvent = this.clientUpdatesTimeline
                        .filter(update => String(update.projectId || '') === String(project.id) &&
                            (update.isStatusSnapshot || update.systemGenerated || update.updateType === 'Project Status'))
                        .sort((a, b) => String(b.createdAt || b.updateDate || '').localeCompare(String(a.createdAt || a.updateDate || '')))[0] || null;
                    return { ...project, latestProjectEvent };
                })
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        },
        clientConversationHistory() {
            // Human-written messages only. System activity/status events live in
            // Current Project Status above, keeping the conversation easy to scan.
            return this.clientUpdatesTimeline.filter(update => !update.isStatusSnapshot && !update.systemGenerated && update.updateType !== 'Project Status');
        },
        clientRecentUpdates() {
            return this.clientConversationHistory.slice(0, 4);
        },
        clientRecentDocuments() {
            return [...this.myClientDocs].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5);
        },
        clientProfileCompletion() {
            const values = [this.userProfile.name, this.userProfile.email, this.userProfile.photo];
            return Math.round((values.filter(Boolean).length / values.length) * 100);
        },
        myUnpaidInvoicesCount() { return this.myClientDocs.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },
        myUnpaidInvoicesAmount() { return this.myClientDocs.filter(d => d.type === 'Invoice' && d.status !== 'Paid').reduce((sum, d) => sum + (Number(d.amount) || 0), 0); },
        myPaidInvoicesAmount() { return this.myClientDocs.filter(d => d.type === 'Invoice' && d.status === 'Paid').reduce((sum, d) => sum + (Number(d.amount) || 0), 0); },

        docSubtotal() { return this.docForm.items.reduce((s, i) => s + (i.qty * i.price), 0); },
        docSST() { return this.docSubtotal * 0.08; },
        docGrandTotal() { return this.docSubtotal - this.docForm.discount + this.docSST; },

        // ---- Monthly accounting period ----------------------------------
        // Dashboard money figures are per-period so each month opens at zero.
        // Only FLOW figures reset (issued, collected, paid out); BALANCE figures
        // such as pending receivables stay cumulative — last month's unpaid
        // invoice is still owed on the 1st, and zeroing it would hide real debt.
        currentPeriod() { return this.periodKeyOf(new Date().toISOString()); },
        currentPeriodLabel() { return this.periodLabel(this.currentPeriod); },

        // The KPI strip can be stepped back through closed months. Everything
        // below reads dashboardPeriod, never currentPeriod, so one control
        // moves the whole strip; the Reports tab keeps its own live period.
        dashboardPeriod() { return this.dashboardPeriodKey || this.currentPeriod; },
        dashboardPeriodLabel() { return this.periodLabel(this.dashboardPeriod); },
        isCurrentDashboardPeriod() { return this.dashboardPeriod === this.currentPeriod; },
        // Twelve months of history is as far back as the strip reaches.
        dashboardPeriodFloor() {
            const now = new Date();
            const floor = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            return `${floor.getFullYear()}-${String(floor.getMonth() + 1).padStart(2, '0')}`;
        },
        canViewOlderDashboardPeriod() { return this.dashboardPeriod > this.dashboardPeriodFloor; },

        periodDocs() { return this.docHistory.filter(d => this.periodKeyOf(d.date) === this.dashboardPeriod); },
        periodPayslips() { return this.payslipHistory.filter(p => this.periodKeyOf(p.date) === this.dashboardPeriod); },
        periodClaims() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => this.periodKeyOf(this.claimDateOf(c)) === this.dashboardPeriod); },

        periodQuotationCount() { return this.periodDocs.filter(d => d.type === 'Quotation').length; },
        periodInvoiceCount() { return this.periodDocs.filter(d => d.type === 'Invoice').length; },
        periodRevenuePaid() { return this.periodDocs.filter(d => d.type === 'Invoice' && d.status === 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0); },
        periodPayrollNet() { return this.periodPayslips.reduce((s, p) => s + (Number(p.amount) || 0), 0); },
        periodApprovedClaimsAmount() { return this.periodClaims.filter(c => c.status === 'Approved').reduce((s, c) => s + (Number(c.amount) || 0), 0); },

        // Newest first, so the Reports list reads as a statement history.
        monthlyArchivesSorted() { return [...this.monthlyArchives].sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''))); },
        // Every period that has at least one record, for the export scope picker.
        availablePeriods() {
            const keys = new Set();
            this.docHistory.forEach(d => { const k = this.periodKeyOf(d.date); if (k) keys.add(k); });
            this.payslipHistory.forEach(p => { const k = this.periodKeyOf(p.date); if (k) keys.add(k); });
            [...this.claimsHistory, ...this.paymentVouchers].forEach(c => { const k = this.periodKeyOf(this.claimDateOf(c)); if (k) keys.add(k); });
            return [...keys].sort().reverse();
        },

        totalQuotations() { return this.docHistory.filter(d => d.type === 'Quotation').length; },
        totalQuotationValue() { return this.docHistory.filter(d => d.type === 'Quotation').reduce((s, d) => s + (Number(d.amount) || 0), 0); },
        paidInvoicesCount() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status === 'Paid').length; },
        unpaidInvoicesCount() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },

        totalRevenuePending() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status !== 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0); },

        activeEmployeesCount() { return this.employees.filter(e => e.status === 'Aktif').length; },

        // CROSS-SYSTEM INSIGHT: staff workload measured across BOTH HR project assignments and client
        // activity assignments — only possible because HR and Client data live in the same system.
        employeeWorkload() {
            return this.employees
                .map(emp => {
                    const projectAssignments = this.employeeActiveProjectAssignments(emp.empNo);
                    const activityAssignments = this.employeeActiveActivityAssignments(emp.empNo);
                    const clientNames = [...new Set(projectAssignments.map(p => p.clientName).filter(Boolean))];
                    return { emp, projectCount: projectAssignments.length, activityCount: activityAssignments.length, clientCount: clientNames.length, total: projectAssignments.length + activityAssignments.length };
                })
                .filter(w => w.total > 0)
                .sort((a, b) => b.total - a.total);
        },
        overloadedEmployeeCount() { return this.employeeWorkload.filter(w => w.total >= 4).length; },

        // CROSS-SYSTEM INSIGHT: revenue attributed per client, ranked — combines Client Directory with Billing data.
        revenuePerClientTop() {
            const byClient = {};
            this.docHistory.filter(d => d.type === 'Invoice' && d.status === 'Paid').forEach(d => {
                const key = d.name || 'Unknown';
                byClient[key] = (byClient[key] || 0) + (Number(d.amount) || 0);
            });
            return Object.entries(byClient).map(([clientName, revenue]) => ({ clientName, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
        },
        // CROSS-SYSTEM INSIGHT: distinct HR staff engaged per client, ranked.
        staffPerClientTop() {
            const byClient = {};
            this.projects.forEach(p => {
                if (!p.clientName) return;
                if (!byClient[p.clientName]) byClient[p.clientName] = new Set();
                if (p.ownerEmpNo) byClient[p.clientName].add(p.ownerEmpNo);
            });
            return Object.entries(byClient).map(([clientName, staffSet]) => ({ clientName, staffCount: staffSet.size })).filter(c => c.staffCount > 0).sort((a, b) => b.staffCount - a.staffCount).slice(0, 6);
        },
        avgActiveProjectAgeDays() {
            const active = this.projects.filter(p => p.status !== 'Completed & Done' && p.createdAt);
            if (!active.length) return 0;
            const totalDays = active.reduce((s, p) => s + Math.max(0, (Date.now() - Date.parse(p.createdAt)) / 86400000), 0);
            return Math.round(totalDays / active.length);
        },

        pendingClaimsCount() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => c.status && c.status.includes('Pending')).length; },
        financePendingClaims() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => c.status === 'Pending Account'); },

        clientPortalDocs() {
            if (this.userProfile.role === 'Client' || this.userProfile.role === 'Staff') {
                const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
                const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
                return this.docHistory.filter(d => d.raw && (
                    (clientDirectoryId && String(d.raw.customerId || '').trim() === clientDirectoryId) ||
                    (clientEmail && String(d.raw.clientEmail || '').trim().toLowerCase() === clientEmail)
                ));
            }
            return this.docHistory;
        },
        filteredClientPortalDocs() {
            return this.clientPortalDocs.filter(d => {
                const typeOk = this.clientPortalFilter.type === 'all' || d.type === this.clientPortalFilter.type;
                const statusOk = this.clientPortalFilter.status === 'all' || (d.status || 'Unpaid') === this.clientPortalFilter.status;
                return typeOk && statusOk;
            });
        },
        documentProjectsForSelectedClient() {
            const customerId = String(this.docForm.customerId || '');
            if (!customerId) return [];
            return this.projects
                .filter(project => project.clientDirectoryId === customerId)
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        },
        // Client Billing Workflow is not a general staff module. A current PIC,
        // HR/Account, Director or Superadmin is admitted; everyone else receives
        // no billing queue at all.
        billingPicProjectIds() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return new Set(this.projects
                .filter(project => String(project.ownerEmail || '').trim().toLowerCase() === email)
                .map(project => String(project.id || ''))
                .filter(Boolean));
        },
        isBillingProjectPic() { return this.billingPicProjectIds.size > 0; },
        canViewBillingWorkflow() { return this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role) || this.isBillingProjectPic; },
        canManageBillingWorkflow() { return this.isFullAccessRole; },
        canVerifyPaymentProof() { return this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role) || this.isBillingProjectPic; },
        billingWorkflowQueue() {
            if (!this.canViewBillingWorkflow) return [];
            const isCentralReviewer = this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role);
            const submittedProofs = this.docHistory
                .filter(item => item.type === 'Invoice' && item.status !== 'Draft' && item.paymentProofUrl)
                .filter(item => isCentralReviewer || this.billingPicProjectIds.has(String(item.raw?.projectId || '')))
                .map(item => ({ ...item, workflowAction: 'review-proof', workflowLabel: item.paymentProofReviewStatus === 'Verified' ? 'Payment verified' : item.paymentProofReviewStatus === 'Rejected' ? 'Review replacement proof' : 'Verify payment proof' }));
            if (!this.canManageBillingWorkflow) return submittedProofs
                .sort((a, b) => String(b.paymentProofAt || b.date || '').localeCompare(String(a.paymentProofAt || a.date || '')));
            const linkedInvoiceQuoteIds = new Set(this.docHistory
                .filter(item => item.type === 'Invoice' && item.raw?.sourceQuotationId)
                .map(item => item.raw.sourceQuotationId));
            const acceptedQuotes = this.docHistory
                .filter(item => item.type === 'Quotation' && item.status === 'Accepted' && !linkedInvoiceQuoteIds.has(item.id))
                .map(item => ({ ...item, workflowAction: 'issue-invoice', workflowLabel: 'Prepare invoice' }));
            const invoiceDrafts = this.docHistory
                .filter(item => item.type === 'Invoice' && item.status === 'Draft')
                .map(item => ({ ...item, workflowAction: 'edit-draft', workflowLabel: 'Finance draft' }));
            return [...acceptedQuotes, ...invoiceDrafts, ...submittedProofs]
                .sort((a, b) => String(b.billingWorkflowUpdatedAt || b.paymentProofAt || b.clientDecisionAt || b.date || '').localeCompare(String(a.billingWorkflowUpdatedAt || a.paymentProofAt || a.clientDecisionAt || a.date || '')));
        },

        // PAGINATION & SORTING UNTUK CLAIMS MODULE
        filteredSortedClaims() {
            let list = [...this.claimsHistory];
            
            list.sort((a, b) => {
                if (this.claimsSortOption === 'latest') return new Date(b.expenseDate) - new Date(a.expenseDate);
                if (this.claimsSortOption === 'oldest') return new Date(a.expenseDate) - new Date(b.expenseDate);
                if (this.claimsSortOption === 'category') return (a.category || '').localeCompare(b.category || '');
                if (this.claimsSortOption === 'amount_high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (this.claimsSortOption === 'amount_low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return new Date(b.expenseDate) - new Date(a.expenseDate);
            });

            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(c => 
                    (c.receiptNo && c.receiptNo.toLowerCase().includes(q)) ||
                    (c.name && c.name.toLowerCase().includes(q)) ||
                    (c.empNo && c.empNo.toLowerCase().includes(q)) ||
                    (c.category && c.category.toLowerCase().includes(q))
                );
            }
            return list;
        },
        claimsTotalPages() { return Math.ceil(this.filteredSortedClaims.length / this.claimsItemsPerPage) || 1; },
        paginatedClaims() {
            const start = (this.claimsCurrentPage - 1) * this.claimsItemsPerPage;
            return this.filteredSortedClaims.slice(start, start + this.claimsItemsPerPage);
        },

        // PAGINATION & SORTING UNTUK PAYMENT VOUCHER MODULE
        filteredSortedVouchers() {
            let list = [...this.paymentVouchers];

            list.sort((a, b) => {
                if (this.vouchersSortOption === 'latest') return new Date(b.paymentDate || b.expenseDate) - new Date(a.paymentDate || a.expenseDate);
                if (this.vouchersSortOption === 'oldest') return new Date(a.paymentDate || a.expenseDate) - new Date(b.paymentDate || b.expenseDate);
                if (this.vouchersSortOption === 'category') return (a.category || '').localeCompare(b.category || '');
                if (this.vouchersSortOption === 'amount_high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (this.vouchersSortOption === 'amount_low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return new Date(b.paymentDate || b.expenseDate) - new Date(a.paymentDate || a.expenseDate);
            });

            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(v =>
                    (v.voucherNo && v.voucherNo.toLowerCase().includes(q)) ||
                    (v.payeeName && v.payeeName.toLowerCase().includes(q)) ||
                    (v.name && v.name.toLowerCase().includes(q)) ||
                    (v.empNo && v.empNo.toLowerCase().includes(q)) ||
                    (v.category && v.category.toLowerCase().includes(q))
                );
            }
            return list;
        },
        vouchersTotalPages() { return Math.ceil(this.filteredSortedVouchers.length / this.vouchersItemsPerPage) || 1; },
        paginatedVouchers() {
            const start = (this.vouchersCurrentPage - 1) * this.vouchersItemsPerPage;
            return this.filteredSortedVouchers.slice(start, start + this.vouchersItemsPerPage);
        },

        filteredRecentActivities() {
            const combined = [
                ...this.docHistory.map(d => ({ ...d, tagClass: d.type === 'Invoice' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', isDoc: true })),
                ...this.payslipHistory.map(p => ({ ...p, tagClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', isPay: true })),
                ...this.claimsHistory.map(c => ({ ...c, tagClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200', isClaim: true, docNo: c.receiptNo, amount: c.amount, date: c.expenseDate, name: c.name })),
                ...this.paymentVouchers.map(v => ({ ...v, tagClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', isVoucher: true, type: 'Payment Voucher', docNo: v.voucherNo, amount: v.amount, date: v.paymentDate, name: v.payeeName || v.name }))
            ];
            const typePriority = { 'Payslip': 1, 'Quotation': 2, 'Invoice': 3, 'Claim': 4, 'Payment Voucher': 5 };
            let list = combined.sort((a, b) => {
                if (this.sortOption === 'latest') return new Date(b.date) - new Date(a.date);
                if (this.sortOption === 'oldest') return new Date(a.date) - new Date(b.date);
                if (this.sortOption === 'module') {
                    const priorityA = typePriority[a.type] || 99;
                    const priorityB = typePriority[b.type] || 99;
                    if (priorityA !== priorityB) return priorityA - priorityB;
                    return new Date(b.date) - new Date(a.date);
                }
                if (this.sortOption === 'amount_high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (this.sortOption === 'amount_low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return new Date(b.date) - new Date(a.date);
            });
            if (this.recentActivityFilter !== 'all') {
                list = list.filter(c => (c.documentType || c.type) === this.recentActivityFilter);
            }
            if (this.recentActivityAttentionOnly) {
                list = list.filter(c => (c.type === 'Invoice' && c.status !== 'Paid') || ((c.isClaim || c.isVoucher) && String(c.status || '').startsWith('Pending')));
            }
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(c => (c.docNo && c.docNo.toLowerCase().includes(q)) || (c.name && c.name.toLowerCase().includes(q)) || (c.type && c.type.toLowerCase().includes(q)) || (c.raw && c.raw.clientSSM && c.raw.clientSSM.toLowerCase().includes(q)) || (c.raw && c.raw.ic && c.raw.ic.toLowerCase().includes(q)));
            }
            return list;
        },
        totalPages() { return Math.ceil(this.filteredRecentActivities.length / this.itemsPerPage) || 1; },
        paginatedActivities() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            return this.filteredRecentActivities.slice(start, start + this.itemsPerPage);
        },
        // A Project Activity is only valid for the board when its Client Directory
        // record is an active Client Task parent. This single gate is used by both
        // the board and list views so an orphaned/legacy record can never appear
        // under an unrelated company's Client Task group.
        registeredClientTaskIds() {
            return new Set(this.customers
                .filter(customer => customer?.id && customer.clientTaskCreatedAt)
                .map(customer => String(customer.id)));
        },
        // Projects in which the signed-in staff member is the assignee of at least
        // one Project Activity. They are not the PIC, so ownerEmail never matches —
        // this is what lets them open the project and read their own scheduled work
        // (see the activityAssigneeEmails branch in the projects rule).
        assignedActivityProjectIds() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            if (!email || this.userProfile.role === 'Client') return new Set();
            return new Set(this.projectActivities
                .filter(activity => String(activity.assignedEmail || '').trim().toLowerCase() === email)
                .map(activity => String(activity.projectId || ''))
                .filter(Boolean));
        },
        filteredProjects() {
            const queryText = this.searchQuery.trim().toLowerCase();
            let records = this.projects
                .filter(project => this.isProjectLinkedToRegisteredClientTask(project))
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
            // Director and Superadmin supervise every Client Task and Project
            // Activity. Every other internal role is deliberately limited to the
            // projects for which they are the assigned PIC; this mirrors the
            // Firestore query/rule below, so changing the visual scope cannot
            // reveal another employee's work.
            const mustUseAssignedScope = this.userProfile.role !== 'Client' && !this.canManageProjects;
            if ((mustUseAssignedScope || this.projectScopeFilter === 'mine') && this.userProfile.role !== 'Client') {
                const email = String(this.userProfile.email || '').trim().toLowerCase();
                // "Mine" is both PIC assignments and projects holding an activity
                // assigned to this employee — the same two sets Firestore returns
                // for a non-manager, so the visual scope can never widen access.
                records = records.filter(project =>
                    String(project.ownerEmail || '').trim().toLowerCase() === email ||
                    this.assignedActivityProjectIds.has(project.id));
            }
            if (this.boardClientFilter) records = records.filter(project => project.clientDirectoryId === this.boardClientFilter.id);
            if (!queryText) return records;
            return records.filter(project => [project.projectRef, project.title, project.clientName, project.ownerName, project.status, project.description].some(value => String(value || '').toLowerCase().includes(queryText)));
        },
        projectClientAccessUsers() {
            const clientUsers = this.users.filter(user => user.role === 'Client' && String(user.email || '').trim());
            const customer = this.customers.find(item => item.id === this.projectModal.form.clientDirectoryId);
            if (!customer) return clientUsers.sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
            const authorizedEmails = new Set([
                customer.clientEmail,
                ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])
            ].map(email => String(email || '').trim().toLowerCase()).filter(Boolean));
            return clientUsers
                .filter(user => authorizedEmails.has(String(user.email || '').trim().toLowerCase()))
                .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
        },
        unlinkedProjectClientEmails() {
            const customer = this.customers.find(item => item.id === this.projectModal.form.clientDirectoryId);
            if (!customer) return [];
            const portalEmails = new Set(this.users
                .filter(user => user.role === 'Client')
                .map(user => String(user.email || '').trim().toLowerCase())
                .filter(Boolean));
            return [...new Set([
                customer.clientEmail,
                ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])
            ].map(email => String(email || '').trim().toLowerCase()).filter(Boolean))]
                .filter(email => !portalEmails.has(email));
        },
        // Among unlinkedProjectClientEmails, flag the ones that can NEVER become a
        // Client Portal account under that exact address because a non-Client
        // (staff) account already owns it — staff accounts must use one of the
        // approved company domains. createUserWithEmailAndPassword always hits
        // auth/email-already-in-use for these, and the pending_access fallback
        // (savePortalUser) never activates because that uid's users/{uid} doc
        // already exists (loadOrMigrateUserMetadata returns early for it) — so
        // without this warning the "awaiting Client Portal account" message below
        // is misleading: it reads as "not yet granted" when it's really
        // "cannot be granted under this email at all".
        blockedProjectClientEmails() {
            const staffRoleByEmail = new Map(this.users
                .filter(user => user.role && user.role !== 'Client')
                .map(user => [String(user.email || '').trim().toLowerCase(), user.role]));
            return this.unlinkedProjectClientEmails
                .filter(email => staffRoleByEmail.has(email))
                .map(email => ({ email, role: staffRoleByEmail.get(email) }));
        },
        // The rest of unlinkedProjectClientEmails: saved on the client's Bill To
        // record, not colliding with any staff account, and genuinely doesn't
        // have a Client Portal login yet. Client access uses the email registered
        // by staff in Client Information, including an external domain.
        awaitingProjectClientEmails() {
            const blocked = new Set(this.blockedProjectClientEmails.map(b => b.email));
            return this.unlinkedProjectClientEmails.filter(email => !blocked.has(email));
        },
        projectStaffOptions() {
            // A Project PIC may schedule work for any provisioned colleague, but
            // Staff/IT users deliberately cannot read the full employees collection
            // (which contains payroll and identity data). Build the safe assignment
            // list from the already-authorized portal directory, then enrich it with
            // HR details only when those are available to the current role.
            const byEmail = new Map();
            this.users
                .filter(user => user.role !== 'Client' && String(user.email || '').trim())
                .forEach(user => {
                    const email = String(user.email || '').trim().toLowerCase();
                    byEmail.set(email, {
                        empNo: user.empNo || `PORTAL-${user.id}`,
                        name: user.name || email,
                        email,
                        position: user.position || user.role || 'STAFF'
                    });
                });
            this.employees
                .filter(employee => employee.email && employee.empNo)
                .forEach(employee => {
                    const email = String(employee.email || '').trim().toLowerCase();
                    byEmail.set(email, { ...byEmail.get(email), ...employee, email });
                });
            return [...byEmail.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        },
        myPendingProjectActivities() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.projectActivities.filter(activity => activity.status !== 'Done' && String(activity.assignedEmail || '').trim().toLowerCase() === email).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
        },
        // Drives the global body-scroll lock (see the matching watch below) — every
        // modal/drawer/dropdown/context-menu overlay in the app, OR'd together, so
        // locking/restoring scroll needs exactly one implementation instead of
        // per-modal wiring. Kept in the same order as globalEscapeHandler for easy
        // cross-checking; add new overlays to both together.
        anyOverlayOpen() {
            return this.markProjectDoneModal.show || this.appConfirm.show || this.employeeView.show ||
                this.clientView.show ||
                (this.clientUpdateModal.show && this.clientUpdateModal.project) ||
                this.websiteContentModal.show || this.siteTextModal.show ||
                (this.activityModal.show && this.activityModal.project) ||
                (this.projectPreview.show && this.projectPreview.project) ||
                this.projectModal.show ||
                this.logoutConfirm || this.postLogoutChoice ||
                this.clientActionConfirm.show || this.employeeActionConfirm.show ||
                this.contextMenu.show || this.clientTaskModal.show ||
                this.idleWarningVisible || this.employeeModal.show || this.userModal.show ||
                this.staffPortalAccount.show || this.accessRequestModal.show ||
                this.changePasswordModal.show ||
                this.claimPreview.show || this.attachmentPreview.show || this.recordPreview.show ||
                this.notificationsPanelOpen || this.staffDirectoryPanelOpen;
        }
    },
    watch: {
        currentTab(nextTab, previousTab) {
            if (previousTab === 'dashboard' && nextTab !== 'dashboard') this.destroyDashboardCharts();
            if (nextTab === 'dashboard' && previousTab !== 'dashboard') this.refreshDashboardCharts();
            if (nextTab === 'audit-logs' && previousTab !== 'audit-logs') this.loadAuditRetention();
        },
        recentActivityFilter() { this.currentPage = 1; },
        recentActivityAttentionOnly() { this.currentPage = 1; },
        sortOption() { this.currentPage = 1; },
        searchQuery() { this.currentPage = 1; },
        // Global scroll lock: locks the page behind whatever overlay is open, and
        // restores exactly whatever inline style was there before (usually '',
        // but this avoids clobbering anything unexpected) once every overlay in
        // anyOverlayOpen has closed.
        anyOverlayOpen(isOpen) {
            if (isOpen) {
                if (this._scrollLockPrevOverflow === undefined) this._scrollLockPrevOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
            } else if (this._scrollLockPrevOverflow !== undefined) {
                document.body.style.overflow = this._scrollLockPrevOverflow;
                this._scrollLockPrevOverflow = undefined;
            }
        }
    },
    methods: {
        // This needs to be a method (rather than a computed value) because each
        // project is checked individually. The registered task IDs themselves
        // remain computed above, so the result still refreshes live with Client
        // Task changes without causing a Vue render error.
        isProjectLinkedToRegisteredClientTask(project) {
            const clientDirectoryId = String(project?.clientDirectoryId || '').trim();
            if (!clientDirectoryId) return false;
            // Staff and IT cannot read the Client Directory (see the customers rule),
            // so this.customers is empty for them and the parent-task check below
            // would hide every project — including the ones where they are the PIC.
            // Their project list is already scoped by Firestore to exactly what they
            // may see, so the client-side integrity gate only applies to the roles
            // that can actually evaluate it.
            if (!this.canReadClientDirectory) return true;
            return this.registeredClientTaskIds.has(clientDirectoryId);
        },
        projectWithLiveClientData(project) {
            const customer = this.customers.find(item => item.id === project.clientDirectoryId);
            if (!customer) return project;
            return {
                ...project,
                clientName: customer.clientName || project.clientName || '',
                clientEmail: String(customer.clientEmail || project.clientEmail || '').trim().toLowerCase(),
                clientSSM: customer.clientSSM || project.clientSSM || '',
                clientTier: customer.clientTier || project.clientTier || 'Standard'
            };
        },
        toOfficialUppercase(value) {
            return typeof value === 'string' ? value.trim().toLocaleUpperCase('en-MY') : value;
        },
        normalizeOfficialRecord(value, key = '') {
            if (Array.isArray(value)) return value.map(item => this.normalizeOfficialRecord(item, key));
            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, this.normalizeOfficialRecord(childValue, childKey)]));
            }
            if (typeof value !== 'string') return value;
            const protectedKey = /(id$|email|password|photo|attachment|status|role|type|category|date|method|url|website)/i.test(key);
            const protectedValue = /^(data:|https?:\/\/)/i.test(value.trim());
            return protectedKey || protectedValue ? value.trim() : this.toOfficialUppercase(value);
        },
        // LHDN issues a TIN as an entity-type prefix followed by digits. The
        // prefix set below is the published list; longer prefixes are matched
        // first so "CS" is never read as "C" with a stray letter after it.
        // Non-individual numbers run 11-12 characters, individuals (IG) the
        // same, after the trailing zero LHDN appended to existing numbers in
        // January 2023.
        normalizeTin(value) {
            return String(value || '').toUpperCase().replace(/[\s-]/g, '');
        },
        // SSM has used two registration formats. Since 11 October 2019 every
        // entity carries a 12-digit number — 4-digit year of incorporation, a
        // 2-digit entity code, then a 6-digit sequence. Records from before then
        // also keep the older sequence-and-check-letter number, and both are
        // printed together during the transition, e.g. 199301012242 (266980-X).
        // Enterprises registered in a state carry a state prefix on the old one,
        // such as JM1045730-D, so the prefix is optional rather than absent.
        brnNewFormatState(value) {
            const v = String(value || '').replace(/\s/g, '');
            if (!v) return 'empty';
            return /^\d{12}$/.test(v) ? 'valid' : 'invalid';
        },
        brnOldFormatState(value) {
            const v = String(value || '').replace(/\s/g, '').toUpperCase();
            if (!v) return 'empty';
            return /^[A-Z]{0,3}\d{4,10}-[A-Z]{1,2}$/.test(v) ? 'valid' : 'invalid';
        },
        // clientSSM stays the stored, printed and searched value — 36 places read
        // it — so the parts are composed back into the shape everything expects.
        composeClientSSM(newBrn, oldBrn) {
            const a = String(newBrn || '').trim();
            const b = String(oldBrn || '').trim().toUpperCase();
            if (a && b) return `${a} (${b})`;
            return a || b;
        },
        // Existing records only have the combined string, so opening one splits
        // it back apart rather than making staff retype what is already there.
        splitClientSSM(value) {
            const raw = String(value || '').trim();
            const paired = raw.match(/^(\d{12})\s*\(([^)]+)\)$/);
            if (paired) return { newBrn: paired[1], oldBrn: paired[2].trim().toUpperCase() };
            if (/^\d{12}$/.test(raw)) return { newBrn: raw, oldBrn: '' };
            return { newBrn: '', oldBrn: raw.toUpperCase() };
        },
        tinFormatState(value) {
            const tin = this.normalizeTin(value);
            if (!tin) return 'empty';
            const shape = /^(CS|FA|PT|TA|TC|TN|TR|TP|LE|IG|C|D|E|F|J)\d{8,11}$/;
            if (!shape.test(tin)) return 'invalid';
            if (tin.length < 11 || tin.length > 12) return 'invalid';
            return 'valid';
        },
        getRoleDisplayName(code) {
            const roles = {
                'Director': 'Director',
                'Superadmin': 'Super Admin',
                'HR': 'Human Resource Management',
                'Account': 'Finance Account Management',
                'IT': 'Intelligence Team Management',
                'Staff': 'Operation Team Management',
                'Client': 'Client Users System Terminal'
            };
            return roles[code] || code;
        },
        getProjectsByStage(stage) {
            return this.filteredProjects.filter(project => project.status === stage);
        },
        getClientGroupsByStage(stage) {
            const groups = [];
            const indexByKey = new Map();
            this.getProjectsByStage(stage).forEach(project => {
                // filteredProjects already rejects unlinked projects. Keeping the
                // explicit guard here protects this grouping if it is reused.
                if (!this.isProjectLinkedToRegisteredClientTask(project)) return;
                const key = project.clientDirectoryId;
                if (!indexByKey.has(key)) {
                    indexByKey.set(key, groups.length);
                    groups.push({ key, clientDirectoryId: project.clientDirectoryId, clientName: project.clientName || 'Unknown Client', projects: [] });
                }
                groups[indexByKey.get(key)].projects.push(project);
            });
            return groups;
        },
        toggleClientGroup(groupKey) {
            if (this.expandedClientGroups.has(groupKey)) this.expandedClientGroups.delete(groupKey);
            else this.expandedClientGroups.add(groupKey);
        },
        isClientGroupExpanded(groupKey) {
            return this.expandedClientGroups.has(groupKey);
        },
        openProjectDetails(project) {
            const projectSnapshot = JSON.parse(JSON.stringify(project));
            // Open the essential project summary first so the click can paint promptly.
            // The document/activity timelines can be expensive on large client accounts,
            // therefore they mount on the following frame without changing their data.
            this.projectPreview = { show: true, project: projectSnapshot, detailsReady: false };
            const defer = typeof window.requestAnimationFrame === 'function'
                ? window.requestAnimationFrame.bind(window)
                : (callback) => window.setTimeout(callback, 0);
            defer(() => defer(() => {
                if (!this.projectPreview.show || this.projectPreview.project?.id !== projectSnapshot.id) return;
                this.projectPreview.detailsReady = true;
                if (this.canViewClientDocuments) this.loadClientDocuments(projectSnapshot.clientDirectoryId, projectSnapshot.clientName, projectSnapshot.clientEmail);
            }));
        },
        closeProjectDetails() {
            this.projectPreview = { show: false, project: null, detailsReady: false };
            this.clientReplyMessage = '';
            this.editingReplyId = '';
            this.editingReplyMessage = '';
            this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' };
        },
        editProjectFromPreview() {
            const project = this.projectPreview.project ? JSON.parse(JSON.stringify(this.projectPreview.project)) : null;
            this.closeProjectDetails();
            if (project) this.openProjectModal(project);
        },
        projectActivitiesFor(projectId) {
            return this.projectActivities.filter(activity => activity.projectId === projectId).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
        },
        // What the CURRENT viewer may see in the Activity Issues list. A PIC or
        // Project Manager sees the whole schedule; anyone else sees only the
        // activities assigned to them, matching the project_activities read rule
        // (their listener never receives the rest in the first place).
        visibleProjectActivitiesFor(projectId) {
            const project = this.projects.find(item => item.id === projectId);
            if (this.canManageProjectActivities(project)) return this.projectActivitiesFor(projectId);
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.projectActivitiesFor(projectId)
                .filter(activity => String(activity.assignedEmail || '').trim().toLowerCase() === email);
        },
        // Recomputes the project's activityAssigneeEmails access index from the
        // activity list the caller is about to end up with. Only a PIC or Project
        // Manager ever calls this, and both read every activity of that project, so
        // the list is complete. Returns null when the stored index is already
        // correct, so no redundant project write is queued.
        nextActivityAssigneeIndex(projectId, activities) {
            const project = this.projects.find(item => item.id === projectId);
            // Only a PIC or Project Manager receives EVERY activity of a project.
            // Anyone else holds just their own rows, so recomputing from their view
            // would silently drop the other assignees out of the index — refuse
            // rather than write a truncated one.
            if (!project || !this.canManageProjectActivities(project)) return null;
            const normalize = list => [...new Set(list
                .map(value => String(value || '').trim().toLowerCase())
                .filter(Boolean))].sort();
            const next = normalize(activities.map(activity => activity?.assignedEmail));
            const current = normalize(Array.isArray(project.activityAssigneeEmails) ? project.activityAssigneeEmails : []);
            const unchanged = next.length === current.length && next.every((email, index) => email === current[index]);
            return unchanged ? null : next;
        },
        async syncProjectActivityOwners() {
            // Existing activities predate projectOwnerEmail. A Director or
            // Superadmin repairs only that safe access index after deployment;
            // no activity content, status, assignee, or audit fields are changed.
            if (!this.canManageProjects || this.activityOwnerSyncRunning || !this.projects.length || !this.projectActivities.length) return;
            const projectOwnerById = new Map(this.projects.map(project => [project.id, String(project.ownerEmail || '').trim().toLowerCase()]));
            const pending = this.projectActivities.filter(activity => {
                const ownerEmail = projectOwnerById.get(activity.projectId);
                return ownerEmail && String(activity.projectOwnerEmail || '').trim().toLowerCase() !== ownerEmail;
            });
            if (!pending.length) return;
            this.activityOwnerSyncRunning = true;
            try {
                for (let start = 0; start < pending.length; start += 450) {
                    const batch = writeBatch(db);
                    pending.slice(start, start + 450).forEach(activity => {
                        batch.update(doc(db, 'project_activities', activity.id), {
                            projectOwnerEmail: projectOwnerById.get(activity.projectId)
                        });
                    });
                    await batch.commit();
                }
            } catch (error) {
                console.error('Unable to synchronize project activity access:', error);
            } finally {
                this.activityOwnerSyncRunning = false;
            }
        },
        async syncProjectActivityAssignees() {
            // Projects created before activityAssigneeEmails existed carry no index,
            // so their activity assignees would still be locked out. Every PIC repairs
            // their OWN projects (and a Project Manager repairs all of them), so the
            // backfill does not sit waiting for a Director to sign in. Only that one
            // access field is touched — no project stage, client, owner or audit
            // field. It converges after one pass because nextActivityAssigneeIndex
            // returns null once the stored index already matches, and returns null
            // outright for projects this user does not manage.
            if (this.userProfile.role === 'Client' || this.activityAssigneeSyncRunning || !this.projects.length || !this.projectActivitiesLoaded) return;
            const pending = this.projects
                .map(project => ({ project, index: this.nextActivityAssigneeIndex(project.id, this.projectActivitiesFor(project.id)) }))
                .filter(entry => entry.index);
            if (!pending.length) return;
            this.activityAssigneeSyncRunning = true;
            try {
                const now = new Date().toISOString();
                for (let start = 0; start < pending.length; start += 450) {
                    const batch = writeBatch(db);
                    pending.slice(start, start + 450).forEach(entry => {
                        batch.update(doc(db, 'projects', entry.project.id), {
                            activityAssigneeEmails: entry.index,
                            updatedAt: now
                        });
                    });
                    await batch.commit();
                }
            } catch (error) {
                console.error('Unable to synchronize project activity assignee access:', error);
            } finally {
                this.activityAssigneeSyncRunning = false;
            }
        },
        clientUpdatesFor(projectId) {
            return this.projectClientUpdates.filter(update => update.projectId === projectId).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
        },
        canSendClientUpdate(project) {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.canManageProjects || (this.userProfile.role !== 'Client' && String(project?.ownerEmail || '').trim().toLowerCase() === email);
        },
        canReplyAsClient(project) {
            // A secondary authorized contact's uid never matches the project's single
            // clientPortalUid (always the primary contact's), so authorize by the shared
            // clientDirectoryId claim instead of comparing uids directly.
            return this.userProfile.role === 'Client' && Boolean(this.userProfile.clientDirectoryId) && String(project?.clientDirectoryId || '') === String(this.userProfile.clientDirectoryId || '');
        },
        clientProjectStatusBadgeClass(status) {
            const statusClasses = {
                'Project Planning': 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
                'Pending Documentation': 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
                'In Progress': 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
                'Pending By Government': 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
                'Completed & Done': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
            };
            return statusClasses[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
        },
        canEditClientUpdate(update) {
            return this.canManageProjects || String(update?.senderUid || '') === String(this.userProfile.uid || '');
        },
        canDeleteClientUpdate(update) {
            return this.canManageProjects || (this.userProfile.role === 'Client' && update?.senderRole === 'Client' && String(update?.senderUid || '') === String(this.userProfile.uid || ''));
        },
        openClientUpdateModal(project, update = null) {
            if (update ? !this.canEditClientUpdate(update) : !this.canSendClientUpdate(project)) { this.showNotify('Only the assigned PIC, original sender, Director or Superadmin may manage this Client update.'); return; }
            this.clientUpdateModal = {
                show: true,
                isEdit: Boolean(update),
                updateId: update?.id || '',
                original: update ? JSON.parse(JSON.stringify(update)) : null,
                project: JSON.parse(JSON.stringify(project)),
                form: { updateType: update?.updateType || 'Progress Update', updateDate: update?.updateDate || this.getLocalDateKey(), message: update?.message || '' }
            };
        },
        closeClientUpdateModal() {
            this.clientUpdateModal = { show: false, isEdit: false, updateId: '', original: null, project: null, form: { updateType: 'Progress Update', updateDate: '', message: '' } };
        },
        // Converts an internal project action into a deliberately minimal update for
        // the Client Portal. Never pass activity type, task summary, assignee or any
        // staff-only notes here: clients receive project progress only.
        async publishClientProjectEvent(project, message, updateType = 'Project Activity Update') {
            if (!project?.id || !project?.clientDirectoryId || !project?.clientPortalUid || !project?.clientEmail) return false;
            const updateId = `SYS-UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                clientDirectoryId: project.clientDirectoryId,
                clientPortalUid: project.clientPortalUid,
                clientEmail: String(project.clientEmail || '').trim().toLowerCase(),
                updateType,
                updateDate: this.getLocalDateKey(),
                message,
                senderUid: this.userProfile.uid,
                senderName: 'ZENQOR Project Team',
                senderEmail: this.userProfile.email,
                senderPosition: 'Project Team',
                senderRole: this.userProfile.role,
                systemGenerated: true,
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'project_client_updates', updateId), payload);
                return true;
            } catch (error) {
                // Do not roll back the completed internal action. The activity/project
                // remains correct; log the separate feed failure for follow-up.
                console.error('Client project event publish failed:', error);
                return false;
            }
        },
        async saveClientUpdate() {
            const project = this.clientUpdateModal.project;
            const form = this.clientUpdateModal.form;
            const isEdit = this.clientUpdateModal.isEdit;
            const original = this.clientUpdateModal.original;
            if (!project || (isEdit ? !this.canEditClientUpdate(original) : !this.canSendClientUpdate(project))) { this.showNotify('You do not have permission to save this Client update.'); return; }
            if (!form.updateType || !form.updateDate || !form.message?.trim()) { this.showNotify('Complete Update Type, Update Date and Client Message.'); return; }
            if (isEdit) {
                try {
                    await setDoc(doc(db, 'project_client_updates', this.clientUpdateModal.updateId), this.normalizeOfficialRecord({ updateType: form.updateType, updateDate: form.updateDate, message: form.message, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid }), { merge: true });
                    this.logAudit('UPDATE', `Updated Client activity history for ${project.projectRef}`);
                    this.closeClientUpdateModal();
                    this.showNotify('Client activity history updated.');
                } catch (error) {
                    console.error('Client project update edit failed:', error);
                    this.showNotify(this.getFirestoreWriteError(error, 'update the Client activity history'));
                }
                return;
            }
            const currentEmployee = this.employees.find(employee => String(employee.email || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase());
            const updateId = `UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                clientDirectoryId: project.clientDirectoryId,
                clientPortalUid: project.clientPortalUid,
                clientEmail: project.clientEmail,
                updateType: form.updateType,
                updateDate: form.updateDate,
                message: form.message,
                senderUid: this.userProfile.uid,
                senderName: this.userProfile.name,
                senderEmail: this.userProfile.email,
                senderPosition: currentEmployee?.position || this.getRoleDisplayName(this.userProfile.role),
                senderRole: this.userProfile.role,
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'project_client_updates', updateId), payload);
                this.logAudit('CREATE', `Client update sent for ${payload.projectRef}`);
                this.closeClientUpdateModal();
                this.showNotify('Client update sent and added to Client Activity History.');
                this.notifyByEmail({
                    to: payload.clientEmail,
                    subject: `New Update on Your Project — ${payload.projectRef}`,
                    heading: 'New Update From Your Project Team',
                    message: `${payload.senderName} posted a "${payload.updateType}" update on "${payload.projectTitle}" (${payload.projectRef}):\n\n"${payload.message}"`
                });
            } catch (error) {
                console.error('Client project update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'send the Client project update'));
            }
        },
        // A client may answer their own quotation while it is still Open. The
        // Firestore rule enforces the same three conditions independently — this
        // only decides whether the buttons are worth showing.
        canDecideQuotation(d) {
            if (this.userProfile.role !== 'Client') return false;
            if (!d || d.type !== 'Quotation' || (d.status || 'Open') !== 'Open') return false;
            return this.clientPortalDocs.some(own => own.id === d.id);
        },
        async runBillingWorkflow(action, documentId, extra = {}) {
            if (!auth.currentUser?.uid) throw new Error('Your session has ended. Please sign in again.');
            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch('/api/billing-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ action, documentId, ...extra })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'The billing workflow could not be updated.');
            return data;
        },
        async decideQuotation(d, decision) {
            if (!this.canDecideQuotation(d)) { this.showNotify('This quotation can no longer be answered.', 'error'); return; }
            const accepting = decision === 'Accepted';
            const { confirmed, note } = await this.askConfirmWithNote({
                title: accepting ? 'Accept this quotation?' : 'Decline this quotation?',
                message: accepting
                    ? `Accepting ${d.docNo} confirms the scope and pricing shown. Our team will be notified and will proceed to invoicing.`
                    : `Declining ${d.docNo} tells our team you do not wish to proceed. You can ask for a revised quotation at any time.`,
                confirmLabel: accepting ? 'Yes, Accept' : 'Yes, Decline',
                danger: !accepting,
                noteLabel: accepting ? 'Note for our team (optional)' : 'Reason for declining (optional)',
                notePlaceholder: accepting ? 'Anything we should know before invoicing' : 'What would need to change'
            });
            if (!confirmed) return;
            try {
                await updateDoc(doc(db, 'docs', d.id), {
                    status: decision,
                    clientDecisionAt: new Date().toISOString(),
                    clientDecisionByUid: this.userProfile.uid,
                    clientDecisionByName: this.userProfile.name || this.userProfile.email,
                    clientDecisionNote: note
                });
                this.logAudit('UPDATE', `Client ${accepting ? 'accepted' : 'declined'} quotation ${d.docNo}`);
                if (accepting) {
                    // The server derives the PIC, Finance and Director recipients
                    // from protected records. Client-side code never chooses them.
                    await this.runBillingWorkflow('quotation-accepted', d.id);
                }
                this.showNotify(accepting
                    ? 'Quotation accepted. PIC, Finance and Director have been notified.'
                    : 'Quotation declined. Our team has been notified.');
                if (!accepting) this.notifyByEmail({
                    to: this.company.email || this.supportEmail,
                    subject: `Quotation Declined — ${d.docNo}`,
                    heading: 'Quotation Declined',
                    message: `${this.userProfile.name || this.userProfile.email} declined quotation ${d.docNo} (${this.formatCurrency(d.amount)}).${note ? `\n\nNote: "${note}"` : ''}`
                });
            } catch (error) {
                console.error('Quotation decision failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'record your decision'), 'error');
            }
        },
        // Proof may be attached to an unpaid invoice of the client's own. It
        // records evidence; it never settles the invoice — staff mark Paid.
        canAttachPaymentProof(d) {
            if (this.userProfile.role !== 'Client') return false;
            if (!d || d.type !== 'Invoice' || d.status === 'Paid') return false;
            return this.clientPortalDocs.some(own => own.id === d.id);
        },
        clientBillingStatus(d) {
            if (d?.type !== 'Invoice') return d?.status || 'Open';
            if (d.paymentProofReviewStatus === 'Verified' || d.status === 'Paid') return 'Paid';
            if (d.paymentProofReviewStatus === 'Submitted') return 'Payment Under Review';
            if (d.paymentProofReviewStatus === 'Rejected') return 'Proof Needs Attention';
            return d.status || 'Unpaid';
        },
        async handlePaymentProofUpload(event, d) {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            if (!this.canAttachPaymentProof(d)) { this.showNotify('Proof cannot be attached to this invoice.', 'error'); return; }
            const clientDirectoryId = this.userProfile.clientDirectoryId || d.raw?.customerId || '';
            if (!clientDirectoryId) { this.showNotify('Your account is not linked to a client record yet.', 'error'); return; }
            this.paymentProofUploadingFor = d.id;
            try {
                const contentType = await this.validateClientDocumentFile(file);
                const safeName = String(file.name || 'payment-proof').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                const storageFileName = `${Date.now()}_${safeName}`;
                const storagePath = `client_documents/${clientDirectoryId}/${storageFileName}`;
                const fileRef = storageRef(storage, storagePath);
                await uploadBytes(fileRef, file, { contentType });
                const downloadURL = await getDownloadURL(fileRef);
                // Also filed in the client's document repository, so the proof is
                // findable later on its own rather than only through the invoice.
                await setDoc(doc(db, 'client_documents', `${clientDirectoryId}_${Date.now()}`), {
                    clientDirectoryId,
                    clientName: this.clientPortalIdentity.clientName || '',
                    clientEmail: this.userProfile.email,
                    fileName: file.name,
                    fileType: contentType,
                    fileSize: file.size,
                    storagePath,
                    storageFileName,
                    downloadURL,
                    purpose: 'Payment Proof',
                    linkedDocId: d.id,
                    linkedDocNo: d.docNo || '',
                    uploadedByUid: this.userProfile.uid,
                    uploadedByName: this.userProfile.name,
                    uploadedByEmail: this.userProfile.email,
                    uploadedAt: new Date().toISOString()
                });
                await updateDoc(doc(db, 'docs', d.id), {
                    paymentProofUrl: downloadURL,
                    paymentProofName: file.name,
                    paymentProofAt: new Date().toISOString(),
                    paymentProofByUid: this.userProfile.uid,
                    paymentProofByName: this.userProfile.name || this.userProfile.email
                });
                this.logAudit('UPDATE', `Client attached payment proof to ${d.docNo}`);
                await this.runBillingWorkflow('payment-proof-submitted', d.id);
                this.showNotify('Payment proof submitted. Finance, Director and your PIC will review it.');
            } catch (error) {
                console.error('Payment proof upload failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'submit your payment proof'), 'error');
            } finally {
                this.paymentProofUploadingFor = '';
            }
        },
        async sendClientReply() {
            const project = this.projectPreview.project;
            if (!project || !this.canReplyAsClient(project)) { this.showNotify('You do not have permission to reply on this project.'); return; }
            const message = this.clientReplyMessage.trim();
            if (!message) { this.showNotify('Write a message before sending.'); return; }
            const updateId = `UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                clientDirectoryId: project.clientDirectoryId,
                clientPortalUid: this.userProfile.uid,
                clientEmail: project.clientEmail,
                updateType: 'Client Reply',
                updateDate: this.getLocalDateKey(),
                message,
                senderUid: this.userProfile.uid,
                senderName: this.userProfile.name,
                senderEmail: this.userProfile.email,
                senderPosition: 'Client',
                senderRole: 'Client',
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'project_client_updates', updateId), payload);
                this.logAudit('CREATE', `Client reply sent for ${payload.projectRef}`);
                this.clientReplyMessage = '';
                this.showNotify('Your reply has been sent.');
                this.notifyByEmail({
                    to: project.ownerEmail,
                    subject: `New Client Reply — ${payload.projectRef}`,
                    heading: 'New Reply From Your Client',
                    message: `${payload.senderName} replied on "${payload.projectTitle}" (${payload.projectRef}):\n\n"${message}"`
                });
            } catch (error) {
                console.error('Client reply failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'send your reply'));
            }
        },
        startEditReply(update) {
            this.editingReplyId = update.id;
            this.editingReplyMessage = update.message;
        },
        cancelEditReply() {
            this.editingReplyId = '';
            this.editingReplyMessage = '';
        },
        async saveReplyEdit(update) {
            const message = this.editingReplyMessage.trim();
            if (!message) { this.showNotify('Message cannot be empty.'); return; }
            try {
                await setDoc(doc(db, 'project_client_updates', update.id), this.normalizeOfficialRecord({ message, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid }), { merge: true });
                this.logAudit('UPDATE', `Edited client reply for ${update.projectRef}`);
                this.cancelEditReply();
                this.showNotify('Reply updated.');
            } catch (error) {
                console.error('Reply edit failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update your reply'));
            }
        },
        async deleteClientUpdate(update) {
            if (!this.canDeleteClientUpdate(update)) { this.showNotify('Only Director, Superadmin, or the original sender may delete this Client activity history entry.'); return; }
            if (!await this.askConfirm({
                title: 'Delete client update?',
                message: `Client update dated ${update.updateDate || '-'} will be removed. This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Update',
                danger: true
            })) return;
            try {
                await deleteDoc(doc(db, 'project_client_updates', update.id));
                this.logAudit('DELETE', `Deleted Client activity history ${update.id}`);
                this.showNotify('Client activity history deleted.');
            } catch (error) {
                console.error('Client activity history deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete the Client activity history'));
            }
        },
        projectActivityDueState(activity) {
            if (activity.status === 'Done') return { label: 'Done', className: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200', borderClass: 'border-l-slate-400 dark:border-l-slate-600', dotClass: 'bg-slate-400', daysRemaining: null };
            const today = this.getLocalDateKey();
            const dueDate = String(activity.dueDate || '');
            const daysRemaining = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
            if (!Number.isFinite(daysRemaining)) return { label: 'No Due Date', className: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200', borderClass: 'border-l-slate-400 dark:border-l-slate-600', dotClass: 'bg-slate-400', daysRemaining: null };
            if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)} Day${Math.abs(daysRemaining) === 1 ? '' : 's'} Overdue`, className: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300', borderClass: 'border-l-red-500', dotClass: 'bg-red-500', daysRemaining };
            if (daysRemaining === 0) return { label: 'Due Today', className: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', borderClass: 'border-l-amber-400', dotClass: 'bg-amber-400', daysRemaining };
            if (daysRemaining <= 3) return { label: `Due In ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}`, className: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300', borderClass: 'border-l-emerald-500', dotClass: 'bg-emerald-500', daysRemaining };
            return { label: `Scheduled · ${daysRemaining} Days`, className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', borderClass: 'border-l-blue-500', dotClass: 'bg-blue-500', daysRemaining };
        },
        projectTargetDateState(project) {
            if (project.status === 'Completed & Done') return { label: 'Completed', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', borderClass: 'border-l-emerald-500', daysRemaining: null };
            const today = this.getLocalDateKey();
            const targetDate = String(project.targetDate || '');
            const daysRemaining = Math.round((Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
            if (!Number.isFinite(daysRemaining)) return { label: 'No Target', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', borderClass: 'border-l-slate-300 dark:border-l-slate-600', daysRemaining: null };
            if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)}d Overdue`, className: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300', borderClass: 'border-l-red-500', daysRemaining };
            if (daysRemaining === 0) return { label: 'Due Today', className: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', borderClass: 'border-l-amber-400', daysRemaining };
            if (daysRemaining <= 3) return { label: `Due In ${daysRemaining}d`, className: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', borderClass: 'border-l-amber-400', daysRemaining };
            if (daysRemaining <= 7) return { label: `Due In ${daysRemaining}d`, className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', borderClass: 'border-l-blue-500', daysRemaining };
            return { label: `On Track · ${daysRemaining}d`, className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', borderClass: 'border-l-emerald-500', daysRemaining };
        },
        getInitials(name) {
            const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
            if (!parts.length) return '?';
            return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
        },
        projectOwnerPhoto(project) {
            if (project?.ownerPhoto) return project.ownerPhoto;
            const email = String(project?.ownerEmail || '').trim().toLowerCase();
            if (!email) return '';
            const matchedUser = this.users.find(u => String(u.email || '').trim().toLowerCase() === email);
            return matchedUser?.photo || '';
        },
        employeePhotoByEmail(email) {
            const normalized = String(email || '').trim().toLowerCase();
            if (!normalized) return '';
            const matchedUser = this.users.find(u => String(u.email || '').trim().toLowerCase() === normalized);
            return matchedUser?.photo || '';
        },
        payEmployeePhoto() { return this.employeePhotoByEmail(this.payForm?.empEmail); },
        claimEmployeePhoto() { return this.employeePhotoByEmail(this.claimForm?.empEmail); },
        voucherEmployeePhoto() { return this.employeePhotoByEmail(this.voucherForm?.empEmail); },
        isProjectOwner(project) {
            if (!project) return false;
            return this.userProfile.role !== 'Client' && String(project.ownerEmail || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase();
        },
        canEditProject(project) {
            return this.canManageProjects || this.isProjectOwner(project);
        },
        canManageProjectActivities(project) {
            return this.canManageProjects || this.isProjectOwner(project);
        },
        // Assignment is what grants sight of the Activity Issues panel: the PIC and
        // Project Managers see the whole schedule, and a staff member with at least
        // one activity assigned to them in this project sees their own rows (see
        // visibleProjectActivitiesFor). Scheduling, editing and completing remain
        // with the PIC — this is a read grant only, exactly as the rules allow.
        isAssignedToProjectActivity(project) {
            return Boolean(project?.id) && this.assignedActivityProjectIds.has(project.id);
        },
        canViewProjectActivityDetails(project) {
            return this.canManageProjectActivities(project) || this.isAssignedToProjectActivity(project);
        },
        // Editing an activity (retargeting it, changing its type) stays with the
        // PIC, but COMPLETING one belongs to whoever the work was scheduled for —
        // which is what the dashboard's "My Assigned Project Activities" card has
        // always offered. Mirrors the assignee branch of the update rule.
        canCompleteProjectActivity(activity) {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.canEditProjectActivity(activity) || (
                this.userProfile.role !== 'Client' &&
                Boolean(email) &&
                String(activity?.assignedEmail || '').trim().toLowerCase() === email
            );
        },
        canEditProjectActivity(activity) {
            const project = this.projects.find(p => p.id === activity?.projectId);
            return this.canManageProjectActivities(project);
        },
        canDeleteProjectActivity() { return this.canManageProjects; },
        openActivityModal(project, activity = null) {
            if (!this.canManageProjectActivities(project)) { this.showNotify('Only Director, Superadmin, or this project\'s Person In Charge may schedule activities.'); return; }
            this.activityModal = { show: true, isEdit: Boolean(activity), activityId: activity?.id || '', project: JSON.parse(JSON.stringify(project)), form: { activityType: activity?.activityType || 'To-Do', summary: activity?.summary || '', dueDate: activity?.dueDate || this.getLocalDateKey(), assignedEmpNo: activity?.assignedEmpNo || '', assignedName: activity?.assignedName || '', assignedEmail: activity?.assignedEmail || '', assignedPosition: activity?.assignedPosition || '', details: activity?.details || '' } };
        },
        closeActivityModal() {
            this.activityModal = { show: false, isEdit: false, activityId: '', project: null, form: { activityType: 'To-Do', summary: '', dueDate: '', assignedEmpNo: '', assignedName: '', assignedEmail: '', assignedPosition: '', details: '' } };
        },
        selectActivityAssignee(event) {
            const employee = this.projectStaffOptions.find(item => item.empNo === event.target.value);
            this.activityModal.form.assignedEmpNo = employee?.empNo || '';
            this.activityModal.form.assignedName = employee?.name || '';
            this.activityModal.form.assignedEmail = String(employee?.email || '').trim().toLowerCase();
            this.activityModal.form.assignedPosition = employee?.position || '';
        },
        async saveProjectActivity() {
            if (!this.activityModal.project || !this.canManageProjectActivities(this.activityModal.project)) { this.showNotify('You do not have permission to schedule this activity.'); return; }
            const form = this.activityModal.form;
            if (!form.activityType || !form.summary?.trim() || !form.dueDate || !form.assignedEmpNo || !form.assignedEmail) { this.showNotify('Complete Activity Type, Summary, Due Date and Assigned To.'); return; }
            const project = this.activityModal.project;
            if (this.activityModal.isEdit) {
                try {
                    const editedAt = new Date().toISOString();
                    const editedAssignee = String(form.assignedEmail || '').trim().toLowerCase();
                    // Reassigning an activity moves project access with it: the new
                    // assignee is added to the index and the previous one drops out
                    // of it in the same atomic write as the activity itself.
                    const nextIndex = this.nextActivityAssigneeIndex(project.id, this.projectActivitiesFor(project.id)
                        .map(activity => activity.id === this.activityModal.activityId
                            ? { ...activity, assignedEmail: editedAssignee }
                            : activity));
                    const editBatch = writeBatch(db);
                    editBatch.set(doc(db, 'project_activities', this.activityModal.activityId), this.normalizeOfficialRecord({ activityType: form.activityType, summary: form.summary, dueDate: form.dueDate, assignedEmpNo: form.assignedEmpNo, assignedName: form.assignedName, assignedEmail: form.assignedEmail, assignedPosition: form.assignedPosition, details: form.details, updatedAt: editedAt, updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email }), { merge: true });
                    if (nextIndex) editBatch.update(doc(db, 'projects', project.id), { activityAssigneeEmails: nextIndex, updatedAt: editedAt });
                    await editBatch.commit();
                    await this.publishClientProjectEvent(project, 'A scheduled project activity has been updated. Our project team will continue the required work.');
                    this.logAudit('UPDATE', `Updated project activity for ${project.projectRef}`);
                    this.closeActivityModal();
                    this.showNotify('Project activity updated.');
                } catch (error) {
                    console.error('Project activity update failed:', error);
                    this.showNotify(this.getFirestoreWriteError(error, 'update the project activity'));
                }
                return;
            }
            const activityId = `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                // This is a non-sensitive access index. It lets Firestore return
                // activity details only to the current project PIC without giving
                // every staff account a readable copy of every activity.
                projectOwnerEmail: String(project.ownerEmail || '').trim().toLowerCase(),
                clientPortalUid: project.clientPortalUid,
                clientEmail: project.clientEmail,
                activityType: form.activityType,
                summary: form.summary,
                dueDate: form.dueDate,
                assignedEmpNo: form.assignedEmpNo,
                assignedName: form.assignedName,
                assignedEmail: form.assignedEmail,
                assignedPosition: form.assignedPosition,
                details: form.details,
                status: 'Scheduled',
                createdAt: new Date().toISOString(),
                createdByUid: this.userProfile.uid,
                createdByEmail: this.userProfile.email
            });
            try {
                // The assignee needs the project card too, or the activity has
                // nowhere to open from — index and activity are written together.
                const nextIndex = this.nextActivityAssigneeIndex(project.id, [...this.projectActivitiesFor(project.id), payload]);
                const createBatch = writeBatch(db);
                createBatch.set(doc(db, 'project_activities', activityId), payload);
                if (nextIndex) createBatch.update(doc(db, 'projects', project.id), { activityAssigneeEmails: nextIndex, updatedAt: payload.createdAt });
                await createBatch.commit();
                await this.publishClientProjectEvent(project, 'A new project activity has been scheduled. Our project team will continue the required work.');
                this.logAudit('CREATE', `Scheduled ${payload.activityType} for ${payload.projectRef} and assigned to ${payload.assignedName}`);
                this.closeActivityModal();
                this.showNotify('Project activity scheduled. The assigned employee will receive an in-portal alert.');
            } catch (error) {
                console.error('Project activity scheduling failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'schedule the project activity'));
            }
        },
        async markProjectActivityDone(activity) {
            if (!this.canCompleteProjectActivity(activity)) { this.showNotify('Only the assigned employee, this project\'s Person In Charge, Director or Superadmin may complete this activity.'); return; }
            try {
                await updateDoc(doc(db, 'project_activities', activity.id), { status: 'Done', completedAt: new Date().toISOString(), completedByUid: this.userProfile.uid, completedByEmail: this.userProfile.email });
                const project = this.projects.find(item => item.id === activity.projectId);
                // The client-facing conversation feed stays the PIC's voice: an
                // assignee completing their own row is an internal event, and
                // attempting the write here would only be denied by the rules.
                if (project && this.canSendClientUpdate(project)) await this.publishClientProjectEvent(project, 'A scheduled project activity has been completed. Our project team will continue with the next step.');
                this.logAudit('UPDATE', `Completed project activity ${activity.summary}`);
                this.showNotify('Project activity marked as done.');
            } catch (error) {
                console.error('Project activity completion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'complete the project activity'));
            }
        },
        async deleteProjectActivity(activity) {
            if (!this.canDeleteProjectActivity(activity)) { this.showNotify('Only Director and Superadmin may delete project activities.'); return; }
            if (!await this.askConfirm({
                title: 'Delete activity?',
                message: `"${activity.summary || activity.id}" will be removed. This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Activity',
                danger: true
            })) return;
            try {
                // Deleting someone's last activity in a project also withdraws their
                // read access to it, in the same atomic write.
                const deletedAt = new Date().toISOString();
                const nextIndex = this.nextActivityAssigneeIndex(activity.projectId, this.projectActivitiesFor(activity.projectId)
                    .filter(item => item.id !== activity.id));
                const deleteBatch = writeBatch(db);
                deleteBatch.delete(doc(db, 'project_activities', activity.id));
                if (nextIndex) deleteBatch.update(doc(db, 'projects', activity.projectId), { activityAssigneeEmails: nextIndex, updatedAt: deletedAt });
                await deleteBatch.commit();
                this.logAudit('DELETE', `Deleted project activity ${activity.id}`);
                this.showNotify('Project activity deleted.');
            } catch (error) {
                console.error('Project activity deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete the project activity'));
            }
        },
        selectProjectClientDirectory(event) {
            const customer = this.customers.find(item => item.id === event.target.value);
            if (!customer) {
                this.projectModal.form.clientDirectoryId = '';
                this.projectModal.form.clientPortalUid = '';
                this.projectModal.form.clientName = '';
                this.projectModal.form.clientEmail = '';
                this.projectModal.form.clientSSM = '';
                this.projectModal.form.clientTier = 'Standard';
                return;
            }
            this.projectModal.form.clientDirectoryId = customer.id;
            this.projectModal.form.clientName = customer.clientName || '';
            this.projectModal.form.clientSSM = customer.clientSSM || '';
            this.projectModal.form.clientTier = customer.clientTier || 'Standard';
            // projectClientAccessUsers is already filtered down to exactly this
            // customer's authorized emails (it re-derives the same authorizedEmails
            // set from projectModal.form.clientDirectoryId, which was just set
            // above), so this find() only ever searches an already-authorized pool
            // by email — there is deliberately no name-based fallback here. A
            // company name is not unique or stable enough to safely stand in for a
            // real portal-account match (see the docs/customerId fix).
            const matchingAccess = this.projectClientAccessUsers.find(user => String(user.email || '').trim());
            this.projectModal.form.clientPortalUid = matchingAccess?.id || '';
            this.projectModal.form.clientEmail = matchingAccess?.email || '';
        },
        selectProjectClientAccess(event) {
            const user = this.projectClientAccessUsers.find(item => item.id === event.target.value);
            this.projectModal.form.clientPortalUid = user?.id || '';
            this.projectModal.form.clientEmail = user?.email || '';
        },
        selectProjectOwner(event) {
            const employee = this.projectStaffOptions.find(item => item.empNo === event.target.value);
            if (!employee) return;
            const previousOwner = this.projectModal.form.ownerEmpNo;
            this.projectModal.form.ownerEmpNo = employee.empNo;
            this.projectModal.form.ownerName = employee.name || '';
            this.projectModal.form.ownerEmail = String(employee.email || '').trim().toLowerCase();
            this.projectModal.form.ownerPhoto = this.employeePhotoByEmail(employee.email);
            this.projectModal.form.ownerPosition = employee.position || '';
            this.projectModal.form.ownerDepartment = employee.dept || '';
            this.projectModal.form.ownerPresenceStatus = this.employeePresenceLabel(employee);
            this.projectModal.form.ownerPresenceUpdatedAt = employee.presenceUpdatedAt || '';
            this.projectModal.form.ownerLastSeen = employee.lastSeen || '';
            if (previousOwner !== employee.empNo || !this.projectModal.form.ownerAssignedAt) this.projectModal.form.ownerAssignedAt = new Date().toISOString();
        },
        isProjectPicOnline(project) {
            const lastUpdate = this.getPresenceTime(project.ownerPresenceUpdatedAt || project.ownerLastSeen);
            return project.ownerPresenceStatus === 'Online' && lastUpdate > 0 && (this.presenceNow - lastUpdate) < 90000;
        },
        projectPicPresenceDetail(project) {
            if (this.isProjectPicOnline(project)) return 'Online now';
            return project.ownerLastSeen ? `Last seen ${this.formatDateTime(project.ownerLastSeen)}` : 'Offline — no recent activity';
        },
        openProjectModal(project = null) {
            if (project ? !this.canEditProject(project) : !this.canManageProjects) { this.showNotify(project ? 'Only Director, Superadmin, or this project\'s Person In Charge may edit this project.' : 'Only Director and Superadmin may create new projects.'); return; }
            const emptyForm = { id: '', projectRef: `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, title: '', clientDirectoryId: '', clientPortalUid: '', clientName: '', clientEmail: '', clientSSM: '', clientTier: 'Standard', ownerEmpNo: '', ownerName: '', ownerEmail: '', ownerPhoto: '', ownerPosition: '', ownerDepartment: '', ownerAssignedAt: '', ownerPresenceStatus: 'Offline', ownerPresenceUpdatedAt: '', ownerLastSeen: '', status: 'Project Planning', startDate: '', targetDate: '', description: '' };
            this.projectModal = { show: true, isEdit: Boolean(project), form: project ? JSON.parse(JSON.stringify(project)) : emptyForm };
        },
        closeProjectModal() {
            this.projectModal.show = false;
        },
        async saveProject() {
            const source = this.projectModal.form;
            const isEdit = this.projectModal.isEdit;
            const original = isEdit ? this.projects.find(p => p.id === source.id) : null;
            if (isEdit && !original) { this.showNotify('This project no longer exists. It may have been deleted.'); this.closeProjectModal(); return; }
            const isAdminEditor = this.canManageProjects;
            const authorized = isEdit ? (isAdminEditor || this.isProjectOwner(original)) : isAdminEditor;
            if (!authorized) { this.showNotify('You do not have permission to save this project.'); return; }
            if (!source.status || !this.projectStages.includes(source.status)) { this.showNotify('Invalid project stage.'); return; }
            const now = new Date().toISOString();

            if (isEdit && !isAdminEditor) {
                const payload = this.normalizeOfficialRecord({
                    status: source.status,
                    startDate: source.startDate,
                    targetDate: source.targetDate,
                    description: source.description,
                    updatedAt: now,
                    updatedByUid: this.userProfile.uid,
                    updatedByEmail: this.userProfile.email
                });
                try {
                    await setDoc(doc(db, 'projects', source.id), payload, { merge: true });
                    if (source.status !== original.status) await this.publishClientProjectEvent(original, `Project status changed to ${source.status}.`, 'Project Status');
                    this.logAudit('UPDATE', `Project progress updated for ${original.projectRef}`);
                    this.closeProjectModal();
                    this.showNotify('Project progress updated successfully.');
                    if (source.status !== original.status) this.notifyByEmail({
                        to: original.clientEmail,
                        subject: `Project Update — ${original.projectRef}: ${source.status}`,
                        heading: 'Your Project Has Been Updated',
                        message: `Your project "${original.title}" (${original.projectRef}) has moved to the "${source.status}" stage.`
                    });
                } catch (error) {
                    console.error('Project save failed:', error);
                    this.showNotify(this.getFirestoreWriteError(error, 'update the project'));
                }
                return;
            }

            if (!source.projectRef?.trim() || !source.title?.trim()) { this.showNotify('Project reference and title are required.'); return; }
            if (!source.clientDirectoryId || !source.clientPortalUid || !source.clientEmail) { this.showNotify('Select a Client Directory record and its matching Client Portal Access account.'); return; }
            const authorizedClientAccount = this.projectClientAccessUsers.find(user => user.id === source.clientPortalUid && String(user.email || '').trim().toLowerCase() === String(source.clientEmail || '').trim().toLowerCase());
            if (!authorizedClientAccount) { this.showNotify('The selected Client Portal account is not authorized in this Client Directory. Save its email under Client Portal Access first.'); return; }
            if (!source.ownerEmpNo || !source.ownerEmail) { this.showNotify('Select a Person In Charge from HR Employee Management.'); return; }
            const projectId = source.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const payload = this.normalizeOfficialRecord({
                projectRef: isEdit ? original.projectRef : source.projectRef,
                title: source.title,
                clientDirectoryId: source.clientDirectoryId,
                clientPortalUid: source.clientPortalUid,
                clientName: source.clientName,
                clientEmail: String(source.clientEmail || '').trim().toLowerCase(),
                // Keep a tier snapshot on the project. Client accounts cannot read
                // the full customer directory, so this remains a safe fallback if
                // their individual customer record has not loaded yet.
                clientTier: this.clientTierForId(source.clientDirectoryId, source.clientTier),
                ownerEmpNo: source.ownerEmpNo,
                ownerName: source.ownerName,
                ownerEmail: String(source.ownerEmail || '').trim().toLowerCase(),
                // This is the PIC's public project avatar only. It lets a client
                // see their assigned PIC without read access to every staff profile.
                ownerPhoto: source.ownerPhoto || this.employeePhotoByEmail(source.ownerEmail),
                ownerPosition: source.ownerPosition,
                ownerDepartment: source.ownerDepartment,
                ownerAssignedAt: source.ownerAssignedAt || now,
                ownerPresenceStatus: source.ownerPresenceStatus || 'Offline',
                ownerPresenceUpdatedAt: source.ownerPresenceUpdatedAt || '',
                ownerLastSeen: source.ownerLastSeen || '',
                status: source.status,
                startDate: source.startDate,
                targetDate: source.targetDate,
                description: source.description,
                updatedAt: now,
                updatedByUid: this.userProfile.uid,
                updatedByEmail: this.userProfile.email,
                ...(isEdit ? {} : { createdAt: now, createdByUid: this.userProfile.uid, createdByEmail: this.userProfile.email })
            });
            try {
                const ownerChanged = isEdit && String(original?.ownerEmail || '').trim().toLowerCase() !== payload.ownerEmail;
                if (!isEdit && !this.customers.find(customer => customer.id === payload.clientDirectoryId)?.clientTaskCreatedAt) {
                    // A Client Task is the mandatory parent of every Project
                    // Activity. Create the missing parent in the same batch as
                    // the project: a project can never be committed by this UI
                    // without its Client Task.
                    const creationBatch = writeBatch(db);
                    creationBatch.set(doc(db, 'customers', payload.clientDirectoryId), {
                        clientTaskCreatedAt: now,
                        updatedAt: now,
                        updatedByUid: this.userProfile.uid
                    }, { merge: true });
                    creationBatch.set(doc(db, 'projects', projectId), payload);
                    await creationBatch.commit();
                } else if (ownerChanged) {
                    // Director/Superadmin may change the PIC from the project form.
                    // Update all linked access indexes atomically so the old PIC
                    // cannot retain activity access after the transfer.
                    const ownerChangeBatch = writeBatch(db);
                    ownerChangeBatch.set(doc(db, 'projects', projectId), payload, { merge: true });
                    this.projectActivitiesFor(projectId).forEach(activity => {
                        ownerChangeBatch.update(doc(db, 'project_activities', activity.id), { projectOwnerEmail: payload.ownerEmail });
                    });
                    await ownerChangeBatch.commit();
                } else {
                    await setDoc(doc(db, 'projects', projectId), payload, { merge: isEdit });
                }
                this.logAudit(isEdit ? 'UPDATE' : 'CREATE', `Project activity ${payload.projectRef}`);
                if (isEdit && original && source.status !== original.status) await this.publishClientProjectEvent(payload, `Project status changed to ${source.status}.`, 'Project Status');
                this.closeProjectModal();
                this.showNotify('Project activity saved successfully.');
                if (isEdit && original && source.status !== original.status) this.notifyByEmail({
                    to: payload.clientEmail,
                    subject: `Project Update — ${payload.projectRef}: ${source.status}`,
                    heading: 'Your Project Has Been Updated',
                    message: `Your project "${payload.title}" (${payload.projectRef}) has moved to the "${source.status}" stage.`
                });
            } catch (error) {
                console.error('Project save failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'save the project activity'));
            }
        },
        async moveProject(project, direction) {
            const currentIndex = this.projectStages.indexOf(project.status);
            const nextIndex = currentIndex + direction;
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.projectStages.length) return;
            const moved = await this.moveProjectToStage(project, this.projectStages[nextIndex]);
            if (moved) this.showNotify(`Project moved to ${this.projectStages[nextIndex]}.`);
        },
        // Shared by the arrow buttons (moveProject, always ±1 stage) and the
        // board's drag-and-drop (any stage, dropped directly). Returns whether
        // the write actually happened.
        async moveProjectToStage(project, targetStage) {
            if (!this.canEditProject(project)) { this.showNotify('You do not have permission to update this project stage.'); return false; }
            if (project.status === targetStage) return false;
            try {
                await updateDoc(doc(db, 'projects', project.id), { status: targetStage, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email });
                await this.publishClientProjectEvent(project, `Project status changed to ${targetStage}.`, 'Project Status');
                this.logAudit('UPDATE', `Project ${project.projectRef} moved to ${targetStage}`);
                this.notifyByEmail({
                    to: project.clientEmail,
                    subject: `Project Update — ${project.projectRef}: ${targetStage}`,
                    heading: 'Your Project Has Been Updated',
                    message: `Your project "${project.title}" (${project.projectRef}) has moved to the "${targetStage}" stage.`
                });
                return true;
            } catch (error) {
                console.error('Project stage update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the project stage'));
                return false;
            }
        },
        // Board drag-and-drop — always drags exactly ONE project, never a whole
        // client group, so a company with several projects in the same stage
        // can never be bulk-moved by accident. The collapsed client-group card
        // is only draggable when that group has exactly one project (dragging
        // it is then unambiguous); a group with more than one project must be
        // expanded first and dragged via its individual project row instead.
        canDragClientGroup(group) {
            return group.projects.length === 1 && this.canEditProject(group.projects[0]);
        },
        startGroupDrag(event, group, stage) {
            if (!this.canDragClientGroup(group)) { event.preventDefault(); return; }
            this.startProjectDrag(event, group.projects[0], stage);
        },
        startProjectDrag(event, project, stage) {
            if (!this.canEditProject(project)) { event.preventDefault(); return; }
            this.draggingProject = { project, sourceStage: stage };
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', project.id);
            }
        },
        endDrag() {
            this.draggingProject = null;
            this.dragOverStage = '';
        },
        onStageDragOver(stage) {
            if (!this.draggingProject || this.draggingProject.sourceStage === stage) return;
            this.dragOverStage = stage;
        },
        onStageDragLeave(stage) {
            if (this.dragOverStage === stage) this.dragOverStage = '';
        },
        async onStageDrop(targetStage) {
            const drag = this.draggingProject;
            this.draggingProject = null;
            this.dragOverStage = '';
            if (!drag || drag.sourceStage === targetStage) return;
            const moved = await this.moveProjectToStage(drag.project, targetStage);
            if (moved) this.showNotify(`Project moved to ${targetStage}.`);
        },
        openMarkProjectDoneModal(project) {
            if (!this.canEditProject(project)) { this.showNotify('You do not have permission to update this project.'); return; }
            this.markProjectDoneModal = { show: true, project, newOwnerEmpNo: '', confirmStep: null, saving: false };
        },
        closeMarkProjectDoneModal() {
            this.markProjectDoneModal = { show: false, project: null, newOwnerEmpNo: '', confirmStep: null, saving: false };
        },
        requestMarkProjectDone() {
            this.markProjectDoneModal.confirmStep = this.markProjectDoneModal.newOwnerEmpNo ? 'handover' : 'complete';
        },
        async confirmMarkProjectDone() {
            const modal = this.markProjectDoneModal;
            const project = modal.project;
            if (!project || !this.canEditProject(project)) { this.showNotify('You do not have permission to update this project.'); return; }
            modal.saving = true;
            const nowIso = new Date().toISOString();
            try {
                if (modal.newOwnerEmpNo) {
                    const newOwner = this.projectStaffOptions.find(emp => emp.empNo === modal.newOwnerEmpNo);
                    if (!newOwner) { this.showNotify('Selected staff member could not be found.'); modal.saving = false; return; }
                    const newOwnerEmail = String(newOwner.email || '').trim().toLowerCase();
                    const existingHistory = Array.isArray(project.handoverHistory) ? project.handoverHistory : [];
                    const handoverHistory = [
                        ...existingHistory,
                        {
                            fromEmpNo: project.ownerEmpNo || '', fromName: project.ownerName || '', fromEmail: project.ownerEmail || '',
                            toEmpNo: newOwner.empNo, toName: newOwner.name || '', toEmail: newOwnerEmail,
                            handedOverByUid: this.userProfile.uid, handedOverByEmail: this.userProfile.email, handedOverAt: nowIso
                        }
                    ];
                    // Keep the activity access index in the same atomic write as
                    // the handover. The incoming PIC can therefore open Activity
                    // Type and Assigned To immediately; the outgoing PIC loses
                    // access at the same time.
                    const handoverBatch = writeBatch(db);
                    handoverBatch.update(doc(db, 'projects', project.id), {
                        ownerEmpNo: newOwner.empNo,
                        ownerName: newOwner.name || '',
                        ownerEmail: newOwnerEmail,
                        ownerPhoto: this.employeePhotoByEmail(newOwner.email) || '',
                        ownerPosition: newOwner.position || '',
                        ownerDepartment: newOwner.dept || '',
                        ownerAssignedAt: nowIso,
                        ownerPresenceStatus: newOwner.presenceStatus || 'Offline',
                        ownerPresenceUpdatedAt: newOwner.presenceUpdatedAt || '',
                        ownerLastSeen: newOwner.lastSeen || '',
                        handoverHistory,
                        updatedAt: nowIso, updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email
                    });
                    this.projectActivitiesFor(project.id).forEach(activity => {
                        handoverBatch.update(doc(db, 'project_activities', activity.id), { projectOwnerEmail: newOwnerEmail });
                    });
                    await handoverBatch.commit();
                    this.logAudit('UPDATE', `Handed over project ${project.projectRef} from ${project.ownerName || 'Unassigned'} to ${newOwner.name}`);
                    this.showNotify(`Project handed over to ${newOwner.name}.`);
                    if (newOwnerEmail) this.notifyByEmail({
                        to: newOwnerEmail,
                        subject: `Project Handed Over To You — ${project.projectRef}`,
                        heading: 'A Project Has Been Assigned To You',
                        message: `${this.userProfile.name} has handed over "${project.title}" (${project.projectRef}) to you. Sign in to the portal to continue this project.`
                    });
                } else {
                    await updateDoc(doc(db, 'projects', project.id), {
                        status: 'Completed & Done',
                        completedAt: nowIso, completedByUid: this.userProfile.uid, completedByEmail: this.userProfile.email,
                        updatedAt: nowIso, updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email
                    });
                    await this.publishClientProjectEvent(project, 'Project status changed to Completed & Done.', 'Project Status');
                    this.logAudit('UPDATE', `Marked project ${project.projectRef} as Completed & Done`);
                    this.showNotify('Project marked as Done.');
                    if (project.clientEmail) this.notifyByEmail({
                        to: project.clientEmail,
                        subject: `Project Update — ${project.projectRef}: Completed & Done`,
                        heading: 'Your Project Has Been Updated',
                        message: `Your project "${project.title}" (${project.projectRef}) has moved to the "Completed & Done" stage.`
                    });
                }
                this.closeMarkProjectDoneModal();
            } catch (error) {
                console.error('Mark project done failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the project'));
                modal.saving = false;
            }
        },
        async deleteProject(project) {
            if (!this.canManageProjects) { this.showNotify('You do not have permission to delete project activities.'); return false; }
            const linkedActivities = this.projectActivitiesFor(project.id);
            const linkedUpdates = this.clientUpdatesFor(project.id);
            const cascadeWarning = (linkedActivities.length || linkedUpdates.length)
                ? ` This will also permanently delete ${linkedActivities.length} activity issue(s) and ${linkedUpdates.length} client update(s) linked to this project.`
                : '';
            if (!await this.askConfirm({
                title: `Delete project ${project.projectRef}?`,
                message: `${cascadeWarning.trim() || 'This project will be permanently removed.'} This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Project',
                danger: true
            })) return false;
            try {
                const batch = writeBatch(db);
                linkedActivities.forEach(activity => batch.delete(doc(db, 'project_activities', activity.id)));
                linkedUpdates.forEach(update => batch.delete(doc(db, 'project_client_updates', update.id)));
                batch.delete(doc(db, 'projects', project.id));
                await batch.commit();
                this.logAudit('DELETE', `Project activity ${project.projectRef} (with ${linkedActivities.length} activity issue(s) and ${linkedUpdates.length} client update(s))`);
                this.showNotify('Project and all linked records deleted.');
                return true;
            } catch (error) {
                console.error('Project deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete the project activity'));
                return false;
            }
        },
        async deleteProjectFromPreview() {
            const project = this.projectPreview.project;
            if (!project) return;
            if (await this.deleteProject(project)) this.closeProjectDetails();
        },
        async deleteProjectFromModal() {
            const project = this.projectModal.form;
            if (!project?.id) return;
            if (await this.deleteProject(project)) this.closeProjectModal();
        },
        async syncAssignedProjectPresence(employee, isOnline, timestamp) {
            if (!auth.currentUser || !employee?.empNo || !employee?.email) return;
            try {
                const snapshot = await getDocs(query(collection(db, 'projects'), where('ownerEmpNo', '==', employee.empNo), where('ownerEmail', '==', String(employee.email).trim().toLowerCase())));
                if (snapshot.empty) return;
                const batch = writeBatch(db);
                snapshot.docs.forEach(projectDoc => batch.update(projectDoc.ref, {
                    ownerPresenceStatus: isOnline ? 'Online' : 'Offline',
                    ownerPresenceUpdatedAt: timestamp,
                    ownerLastSeen: timestamp
                }));
                await batch.commit();
            } catch (error) {
                console.error('Unable to synchronize assigned project presence:', error);
            }
        },
        getActivityStatus(item) {
            if (item.type === 'Invoice') {
                return item.status === 'Paid'
                    ? { label: 'PAID', detail: 'Payment received', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' }
                    : { label: 'UNPAID', detail: 'Payment not received', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
            }
            if (item.isClaim || ['Claim', 'Payment Voucher'].includes(item.documentType || item.type)) {
                const isPaymentVoucher = (item.documentType || item.type) === 'Payment Voucher';
                const statuses = {
                    'Pending HR': { label: 'PENDING HR', detail: 'Awaiting HR approval', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
                    'Pending Account': { label: 'PENDING FINANCE', detail: 'HR approved — Finance action required', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
                    'Pending Director': { label: 'PENDING DIRECTOR', detail: 'Finance approved — Director action required', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
                    'Approved': { label: 'APPROVED', detail: isPaymentVoucher ? 'Payment fully paid' : 'Claim fully approved', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
                    'Rejected': { label: 'REJECTED', detail: isPaymentVoucher ? 'Payment voucher rejected' : 'Claim rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' }
                };
                return statuses[item.status] || { label: 'PENDING', detail: 'Awaiting action', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
            }
            return { label: 'RECORDED', detail: 'Record created', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' };
        },
        normalizeClaimRecord(record) {
            const documentType = record.documentType || (record.type === 'Payment Voucher' || /^PV-/i.test(record.receiptNo || '') ? 'Payment Voucher' : 'Claim');
            if (record.status !== 'Approved') return { ...record, documentType, type: documentType };
            const isPaymentVoucher = documentType === 'Payment Voucher';
            return {
                ...record,
                documentType,
                type: documentType,
                finalDecision: true,
                settlementStatus: isPaymentVoucher ? 'Paid' : 'Approved',
                statusDetail: isPaymentVoucher ? 'Payment fully paid' : 'Claim fully approved',
                assignedToUid: record.approvedByUid || record.assignedToUid || '',
                assignedToName: record.approvedByName || record.assignedToName || 'Director',
                assignedToEmail: record.approvedByEmail || '',
                assignedToRole: 'Director',
                approvalPath: record.approvalPath || (record.approvedByRole === 'Director' ? 'Director Direct Approval' : 'Director Final Approval')
            };
        },
        async synchronizeLegacyApprovedClaims(snapshotDocs) {
            if (this.legacyClaimMigrationRunning || !['Director', 'Superadmin'].includes(this.userProfile.role)) return;
            const migrations = [];
            snapshotDocs.forEach(snapshotDoc => {
                const existing = snapshotDoc.data();
                if (existing.status !== 'Approved') return;
                const normalized = this.normalizeClaimRecord(existing);
                const patch = {};
                ['documentType', 'type', 'finalDecision', 'settlementStatus', 'statusDetail', 'assignedToUid', 'assignedToName', 'assignedToEmail', 'assignedToRole', 'approvalPath'].forEach(field => {
                    if (existing[field] !== normalized[field]) patch[field] = normalized[field];
                });
                if (Object.keys(patch).length) migrations.push({ ref: snapshotDoc.ref, patch });
            });
            if (!migrations.length) return;
            this.legacyClaimMigrationRunning = true;
            try {
                for (let start = 0; start < migrations.length; start += 450) {
                    const batch = writeBatch(db);
                    migrations.slice(start, start + 450).forEach(item => batch.update(item.ref, item.patch));
                    await batch.commit();
                }
                this.showNotify(`${migrations.length} approved legacy record(s) synchronized.`);
            } catch (error) {
                console.error('Legacy approved record synchronization failed:', error);
            } finally {
                this.legacyClaimMigrationRunning = false;
            }
        },
        // ---- Monthly period helpers -------------------------------------
        // Records carry a plain YYYY-MM-DD string, so slicing beats Date parsing:
        // it cannot drift across timezones the way new Date(...) can near midnight.
        periodKeyOf(value) {
            const raw = String(value || '').trim();
            if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
            const parsed = new Date(raw);
            if (isNaN(parsed.getTime())) return '';
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
        },
        // Step the executive KPI strip one month at a time. The live month is
        // stored as an empty key so the strip follows the calendar forward.
        shiftDashboardPeriod(delta) {
            const [year, month] = this.dashboardPeriod.split('-').map(Number);
            const moved = new Date(year, (month - 1) + delta, 1);
            const key = `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
            if (key > this.currentPeriod) return;
            if (key < this.dashboardPeriodFloor) return;
            this.dashboardPeriodKey = key === this.currentPeriod ? '' : key;
        },
        resetDashboardPeriod() { this.dashboardPeriodKey = ''; },
        // Claims and vouchers each carry their own date field name.
        claimDateOf(record) { return record?.date || record?.expenseDate || record?.paymentDate || record?.createdAt || ''; },
        periodLabel(key) {
            const raw = String(key || '');
            if (!/^\d{4}-\d{2}$/.test(raw)) return raw || 'All periods';
            const [year, month] = raw.split('-');
            const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return `${names[Number(month) - 1] || month} ${year}`;
        },
        // Records belonging to one period, grouped the same way every caller needs them.
        recordsForPeriod(period) {
            const docs = this.docHistory.filter(d => !period || this.periodKeyOf(d.date) === period);
            const payslips = this.payslipHistory.filter(p => !period || this.periodKeyOf(p.date) === period);
            const claims = [...this.claimsHistory, ...this.paymentVouchers].filter(c => !period || this.periodKeyOf(this.claimDateOf(c)) === period);
            return { docs, payslips, claims };
        },
        // Frozen totals for one closed month. Money is rounded to sen here so the
        // stored package matches what was exported, rather than re-deriving later.
        buildPeriodSummary(period) {
            const { docs, payslips, claims } = this.recordsForPeriod(period);
            const sum = (list, filter) => Number(list.filter(filter).reduce((s, r) => s + (Number(r.amount) || 0), 0).toFixed(2));
            const quotations = docs.filter(d => d.type === 'Quotation');
            const invoices = docs.filter(d => d.type === 'Invoice');
            const vouchers = claims.filter(c => (c.documentType || c.type) === 'Payment Voucher');
            const expenseClaims = claims.filter(c => (c.documentType || c.type) !== 'Payment Voucher');
            return {
                period,
                label: this.periodLabel(period),
                quotationCount: quotations.length,
                quotationValue: sum(quotations, () => true),
                invoiceCount: invoices.length,
                invoicePaidCount: invoices.filter(d => d.status === 'Paid').length,
                revenueCollected: sum(invoices, d => d.status === 'Paid'),
                revenueOutstanding: sum(invoices, d => d.status !== 'Paid'),
                payslipCount: payslips.length,
                payrollNet: sum(payslips, () => true),
                claimCount: expenseClaims.length,
                claimApprovedTotal: sum(expenseClaims, c => c.status === 'Approved'),
                voucherCount: vouchers.length,
                voucherApprovedTotal: sum(vouchers, c => c.status === 'Approved'),
                recordCount: docs.length + payslips.length + claims.length
            };
        },

        // Freezes every completed month that has records but no package yet.
        // Runs on load rather than on a schedule: the portal is a static site with
        // no cron, so the first sign-in on or after the 1st performs the close.
        async ensureMonthlyArchives() {
            if (this.monthlyArchiveRunning) return;
            // Closing writes company-wide financial summaries; a Client or Staff
            // session must never author them.
            if (!this.canCloseAccountingPeriod) return;
            this.monthlyArchiveRunning = true;
            try {
                const current = this.currentPeriod;
                const archived = new Set(this.monthlyArchives.map(a => a.period || a.id));
                // Only months strictly before the current one are final.
                const pending = this.availablePeriods.filter(p => p && p < current && !archived.has(p));
                if (!pending.length) return;
                let closed = 0;
                for (const period of pending) {
                    const summary = this.buildPeriodSummary(period);
                    if (!summary.recordCount) continue;
                    await setDoc(doc(db, 'monthly_archives', period), {
                        ...summary,
                        closedAt: new Date().toISOString(),
                        closedByUid: this.userProfile.uid || '',
                        closedByName: this.userProfile.name || ''
                    }, { merge: true });
                    this.logAudit('ARCHIVE', `Closed accounting period ${summary.label}`);
                    closed += 1;
                }
                if (closed) this.showNotify(`${closed} completed month${closed > 1 ? 's' : ''} packaged into Reports & Data Export.`);
            } catch (error) {
                // A failed close is not worth blocking the workspace over — the next
                // sign-in retries, and no records are altered either way.
                console.error('Monthly archive failed:', error);
            } finally {
                this.monthlyArchiveRunning = false;
            }
        },
        // Re-freeze one month on demand, for a period edited after it closed.
        async rebuildMonthlyArchive(period) {
            if (!this.canCloseAccountingPeriod) { this.showNotify('You do not have permission to close accounting periods.'); return; }
            const summary = this.buildPeriodSummary(period);
            if (!await this.askConfirm({
                title: `Rebuild ${summary.label}?`,
                message: `The stored package for ${summary.label} will be replaced with the ${summary.recordCount} record(s) currently in the system. No records are changed.`,
                confirmLabel: 'Yes, Rebuild'
            })) return;
            try {
                await setDoc(doc(db, 'monthly_archives', period), {
                    ...summary,
                    closedAt: new Date().toISOString(),
                    closedByUid: this.userProfile.uid || '',
                    closedByName: this.userProfile.name || ''
                }, { merge: true });
                this.logAudit('ARCHIVE', `Rebuilt accounting period ${summary.label}`);
                this.showNotify(`${summary.label} package rebuilt.`);
            } catch (error) {
                console.error('Monthly archive rebuild failed:', error);
                this.showNotify('Unable to rebuild this period package.');
            }
        },
        // One CSV covering a whole month: the frozen summary, then every record
        // behind it, so the file stands alone as that period's statement.
        exportPeriodSummary(period) {
            const summary = this.buildPeriodSummary(period);
            const { docs, payslips, claims } = this.recordsForPeriod(period);
            const money = value => Number(value || 0).toFixed(2);
            const rows = [
                ['ZENQOR HRMS/CDTS - MONTHLY STATEMENT'],
                ['Period', summary.label],
                ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ')],
                [],
                ['SUMMARY', 'Count', 'Amount (MYR)'],
                ['Quotations issued', summary.quotationCount, money(summary.quotationValue)],
                ['Invoices issued', summary.invoiceCount, ''],
                ['Invoices paid', summary.invoicePaidCount, money(summary.revenueCollected)],
                ['Invoices outstanding', summary.invoiceCount - summary.invoicePaidCount, money(summary.revenueOutstanding)],
                ['Payslips paid', summary.payslipCount, money(summary.payrollNet)],
                ['Claims approved', summary.claimCount, money(summary.claimApprovedTotal)],
                ['Vouchers approved', summary.voucherCount, money(summary.voucherApprovedTotal)],
                [],
                ['INVOICES & QUOTATIONS', 'Type', 'Date', 'Client', 'Status', 'Amount (MYR)'],
                ...docs.map(d => [d.docNo || '', d.type || '', d.date || '', d.name || '', d.status || '', money(d.amount)]),
                [],
                ['PAYROLL', 'Date', 'Employee', 'Net Pay (MYR)'],
                ...payslips.map(p => [p.docNo || '', p.date || '', p.name || '', money(p.amount)]),
                [],
                ['CLAIMS & VOUCHERS', 'Type', 'Date', 'Claimant', 'Status', 'Amount (MYR)'],
                ...claims.map(c => [c.receiptNo || c.voucherNo || '', c.documentType || c.type || '', this.claimDateOf(c), c.name || '', c.status || '', money(c.amount)])
            ];
            this.downloadCSV(rows, `Penyata_Bulanan_ZENQOR_${period}.csv`);
            this.logAudit('EXPORT', `Exported monthly statement for ${summary.label}`);
            this.showNotify(`${summary.label} statement downloaded.`);
        },
        // Shared by every CSV export so quoting, the BOM and the download path
        // stay consistent. A Blob rather than a data: URI - encodeURI() throws on
        // a lone % and silently mangles #, both of which appear in client names.
        downloadCSV(rows, filename) {
            const NEWLINE = String.fromCharCode(10);
            const BOM = String.fromCharCode(0xFEFF);
            const body = rows.map(row => (row || []).map(cell => this.csvSafeCell(cell)).join(',')).join(NEWLINE);
            const blob = new Blob([BOM + body], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        csvSafeCell(value) {
            let str = String(value);
            if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
            return `"${str.replace(/"/g, '""')}"`;
        },
        // `period` is a YYYY-MM key, or '' for every record. Defaults to whatever
        // scope the Reports tab is showing so the file matches the figures on screen.
        exportCSV(type, period = this.reportPeriod) {
            let filename = '';
            let rows = [];
            const todayStr = new Date().toISOString().slice(0, 10);
            // Employees is a directory, not a ledger — it has no period to slice by.
            const scope = type === 'employees' ? '' : period;
            const { docs, payslips, claims } = this.recordsForPeriod(scope);
            const suffix = scope ? scope : todayStr;

            if (type === 'payroll') {
                filename = `Laporan_Payroll_ZENQOR_${suffix}.csv`;
                rows = [['Payslip No', 'Tarikh Bayaran', 'Nama Pekerja', 'Gaji Bersih (MYR)'], ...payslips.map(p => [p.docNo || '', p.date || '', p.name || '', Number(p.amount || 0).toFixed(2)])];
            } else if (type === 'employees') {
                filename = `Direktori_Pekerja_ZENQOR_${suffix}.csv`;
                rows = [['ID Pekerja', 'Nama Lengkap', 'Jawatan', 'Jabatan', 'Status', 'Gaji Asas (MYR)'], ...this.employees.map(e => [e.empNo || '', e.name || '', e.position || '', e.dept || '', e.status || 'Aktif', Number(e.basicSalary || 0).toFixed(2)])];
            } else if (type === 'docs') {
                filename = `Laporan_Invois_SebutHarga_ZENQOR_${suffix}.csv`;
                rows = [['No Dokumen', 'Jenis', 'Tarikh Issue', 'Nama Pelanggan', 'Status', 'Jumlah (MYR)'], ...docs.map(d => [d.docNo || '', d.type || '', d.date || '', d.name || '', d.status || '', Number(d.amount || 0).toFixed(2)])];
            } else if (type === 'claims') {
                filename = `Laporan_Claims_Vouchers_ZENQOR_${suffix}.csv`;
                rows = [
                    ['No Rujukan', 'Jenis', 'Tarikh', 'Nama Pemohon', 'No Pekerja', 'Jabatan', 'Kategori', 'Status', 'Jumlah (MYR)'],
                    ...claims.map(c => [
                        c.receiptNo || c.voucherNo || '', c.documentType || c.type || '', c.date || c.expenseDate || c.paymentDate || '',
                        c.name || '', c.empNo || '', c.dept || '', c.category || '', c.status || '', Number(c.amount || 0).toFixed(2)
                    ])
                ];
            }

            if (rows.length === 0) { this.showNotify("Tiada rekod data untuk dieksport."); return; }

            this.downloadCSV(rows, filename);
            
            const scopeLabel = scope ? this.periodLabel(scope) : 'all periods';
            this.logAudit('EXPORT', `Mengeksport fail CSV bagi modul: ${type.toUpperCase()} (${scopeLabel})`);
            this.showNotify(`Laporan CSV (${type} — ${scopeLabel}) berjaya dimuat turun.`);
        },
        exportComplianceReport() {
            const todayStr = new Date().toISOString().slice(0, 10);
            const filename = `Compliance_Audit_Report_ZENQOR_${todayStr}.csv`;
            const rows = [
                ['ZENQOR HRMS/CDTS - PDPA Compliance & Security Audit Report'],
                [`Generated: ${new Date().toLocaleString('en-US')}`],
                [`Generated By: ${this.userProfile.name} (${this.userProfile.email})`],
                [`Total Logged Events: ${this.auditLogs.length}`],
                [],
                ['Timestamp (ISO)', 'User Name', 'User Email', 'UID', 'Role', 'Action', 'Module', 'Activity / Target', 'IP Address', 'Browser', 'Operating System', 'Device', 'Full User Agent'],
                ...this.auditLogs.map(log => [
                    log.timestamp || '', log.userName || '', log.user || '', log.uid || '', log.role || '',
                    log.action || '', log.module || '', log.details || '', log.ip || 'Unavailable',
                    log.browser || '', log.os || '', log.device || '', log.userAgent || log.browser || ''
                ])
            ];
            const csvContent = "data:text/csv;charset=utf-8,﻿" + rows.map(row => row.map(cell => this.csvSafeCell(cell)).join(",")).join("\n");
            const link = document.createElement("a");
            link.setAttribute("href", encodeURI(csvContent));
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.logAudit('EXPORT', 'Exported PDPA compliance & security audit report.');
            this.showNotify('Compliance report downloaded.');
        },
        generateRandomPassword(length = 8) {
            const allChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
            let pwd = "";
            for (let i = 0; i < length; i++) pwd += allChars.charAt(Math.floor(Math.random() * allChars.length));
            return pwd;
        },

        resetAllForms() {
            this.selectedPayEmployeeId = '';
            this.selectedClaimEmployeeId = '';
            this.selectedVoucherEmployeeId = '';
            this.docForm = {
                type: 'Invoice', docNo: '', status: 'Unpaid', paymentMethod: 'Bank Transfer (EFT)', paymentBank: '', paymentReceiver: '', paymentRefNo: '', paymentAttachment: '',
                date: new Date().toISOString().substr(0, 10), dueDate: new Date(Date.now() + 5*24*60*60*1000).toISOString().substr(0, 10),
                customerId: '', projectId: '', projectRef: '', projectTitle: '', sourceQuotationId: '', sourceQuotationNo: '', clientName: '', clientPhone: '', clientSSM: '', clientAddress: '', clientAddress1: '', clientAddress2: '', clientAddress3: '', clientCity: '', clientState: '', clientPostcode: '', clientCountry: 'Malaysia', clientEmail: '', clientContactPerson: '', clientPosition: '', additionalClientEmailsText: '',
                items: [{ desc: '', qty: 1, price: 0 }], discount: 0
            };
            this.payForm = {
                name: '', ic: '', empNo: '', empEmail: '', position: '', dept: '', isSenior: false, joinDate: '', bankAcc: '', epfSocso: '',
                month: new Date().toISOString().slice(0, 7), payDate: new Date().toISOString().slice(0, 10),
                basic: 0, ot: 0, phone: 0, transport: 0, meal: 0, bonus: 0, dedEpf: 0, dedSocso: 0, dedEis: 0, dedPcb: 0, dedAdvance: 0, dedOther: 0
            };
            this.claimForm = {
                documentType: 'Claim', name: '', empNo: '', empEmail: '', position: '', dept: '', expenseDate: new Date().toISOString().substr(0, 10), category: 'Medical', subCategory: 'Clinic / Hospital Treatment',
                payeeName: '', payeeType: 'Individual', payeeReference: '', paymentPurpose: '',
                amount: 0, receiptNo: '', description: '', receiptAttachment: '', receiptAttachmentName: '', receiptAttachmentOriginalBytes: 0, status: 'Pending HR',
                assignedToUid: '', assignedToName: '', assignedToEmail: '', assignedToRole: 'HR'
            };
            this.voucherForm = {
                documentType: 'Payment Voucher', name: '', empNo: '', empEmail: '', position: '', dept: '', paymentDate: new Date().toISOString().substr(0, 10), category: 'Vendor and Supplier', subCategory: 'Supplier Invoice Payment',
                payeeName: '', payeeType: 'Vendor / Supplier', payeeReference: '', paymentPurpose: '',
                amount: 0, voucherNo: '', description: '', receiptAttachment: '', receiptAttachmentName: '', receiptAttachmentOriginalBytes: 0, status: 'Pending HR',
                assignedToUid: '', assignedToName: '', assignedToEmail: '', assignedToRole: 'HR'
            };
            this.clientSavedForDocument = false;
            this.editingDocId = null; this.editingPayId = null; this.editingClaimId = null; this.editingVoucherId = null;
            this.autoCalculatePayroll();
            this.generateDocNo();
        },

        isStaffEmail(email) {
            if (!email) return false;
            const normalizedEmail = email.toLowerCase().trim();
            if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) return false;
            const emailDomain = normalizedEmail.split('@')[1];
            return this.allowedStaffDomains.includes(emailDomain);
        },
        isSeedAdminEmail(email) {
            return SEED_ADMIN_EMAILS.has(String(email || '').trim().toLowerCase());
        },
        approvedStaffDomainsLabel() {
            return this.allowedStaffDomains.map(domain => `@${domain}`).join(' or ');
        },
        // The two directions of one rule: a staff or management login must be on
        // an approved company domain, and a Client login must NOT be. Client
        // access used to be domain-neutral, which let a company address be
        // registered as an external customer's login - never a security hole,
        // since the role still decides which portal admits it, but a confusing
        // thing to find in the directory and an easy way to mis-provision
        // somebody. A Client is by definition somebody outside the company, so
        // their sign-in address is too.
        isPortalEmailAllowed(email, role) {
            return role === 'Client' ? !this.isStaffEmail(email) : this.isStaffEmail(email);
        },
        // Why a given address was refused, phrased for the side it failed on.
        // Telling a Client that "Staff sign-in requires @zenqor.com.my" would
        // read as an instruction to go and get one.
        portalEmailRejectionMessage(role) {
            return role === 'Client'
                ? `Client access cannot use a company address (${this.approvedStaffDomainsLabel()}). Register the client's own email instead.`
                : `Staff and Management sign-in requires ${this.approvedStaffDomainsLabel()}.`;
        },
        // A locked account keeps a valid Firebase credential and a valid portal
        // record - the lock is this portal's own gate, so all three entry points
        // have to honour it: the interactive sign-in, the restored session, and
        // the live directory listener for a session locked while it is open.
        // Returns the message to show, or '' when the account is not locked.
        // The seed administrator is exempt: it is the account that unlocks
        // everybody else, and locking it out would strand the whole portal.
        accountLockedSignInMessage(userData, email) {
            if (this.isSeedAdminEmail(email)) return '';
            if (userData?.accessLocked !== true) return '';
            const reason = String(userData?.accessLockReason || '').trim();
            return `Your portal access is locked. Please contact your administrator.${reason ? ` Reason: ${reason}` : ''}`;
        },
        // A realtime listener is NOT proof that access was revoked. Firestore
        // delivers a cached snapshot before the server round-trip, and a listener
        // is denied whenever the ID token it was opened with has gone stale —
        // which happens on every password change, because updatePassword() bumps
        // the account's validSince and invalidates previously issued tokens. A
        // rules deployment propagating does the same thing for a few seconds.
        // Signing the user out and telling them their access "has been removed"
        // on any of those signals locks out perfectly valid accounts, and it is
        // exactly what a brand-new client hits: sign in with the temporary
        // password, change it as required, and get thrown out claiming an admin
        // removed them. So confirm against the server before revoking.
        //
        // Returns true only when the account genuinely has no portal access:
        // either its users/{uid} record is gone, or its role no longer permits
        // sign-in. A FRESH token that is still refused is itself conclusive —
        // that is what a real revocation looks like once the doc is deleted,
        // because the read rule can no longer resolve the account's role.
        async isPortalAccessTrulyRevoked(reason) {
            const user = auth.currentUser;
            if (!user) return false;
            try {
                // Re-mint the token first: the listener that raised this may have
                // been holding the pre-password-change one.
                await user.getIdToken(true);
                // A listener can first emit its local cache while the freshly
                // minted token is still settling. A cached miss is not evidence
                // that an administrator removed the account, so this decisive
                // check must go to Firestore's server rather than falling back
                // to persistence. Network failures are handled below as
                // transient and keep the valid session open.
                const snapshot = await getDocFromServer(doc(db, 'users', user.uid));
                if (!snapshot.exists()) return !this.isSeedAdminEmail(user.email);
                return !this.isPortalEmailAllowed(user.email, snapshot.data()?.role || '');
            } catch (error) {
                // Denied again holding a token minted seconds ago — the rules
                // really do refuse this account now.
                if (error?.code === 'permission-denied') return !this.isSeedAdminEmail(user.email);
                // Anything else (offline, timeout, backend hiccup) is transient and
                // must never end a valid session.
                console.warn(`Could not confirm portal access (${reason}); keeping the session:`, error);
                return false;
            }
        },
        async revokePortalAccessIfConfirmed(reason) {
            if (await this.isPortalAccessTrulyRevoked(reason)) this.revokeCurrentPortalAccess();
        },
        // A Staff Portal LOCK ends the session the same disciplined way a
        // revocation does. The listener's snapshot may be the cached one, so the
        // lock is re-read from the server on a freshly minted token before the
        // session is ended - an account unlocked seconds ago must not be thrown
        // out by a stale copy that still reads locked, and a network failure
        // must never end a valid session at all. Returns the message to show,
        // or '' when the account is not (or no longer) locked.
        async isPortalAccessTrulyLocked() {
            const user = auth.currentUser;
            if (!user || this.isSeedAdminEmail(user.email)) return '';
            try {
                await user.getIdToken(true);
                const snapshot = await getDocFromServer(doc(db, 'users', user.uid));
                // A missing record is a revocation, not a lock. Leave that call
                // to isPortalAccessTrulyRevoked(), which the listener path that
                // detects a missing record already makes.
                if (!snapshot.exists()) return '';
                return this.accountLockedSignInMessage(snapshot.data(), user.email);
            } catch (error) {
                console.warn('Could not confirm a portal access lock; keeping the session:', error);
                return '';
            }
        },
        async revokePortalAccessIfLocked() {
            // The listener re-fires on every snapshot; without this the confirming
            // read would be issued once per snapshot while the sign-out settles.
            if (this.portalLockCheckInProgress || this.portalAccessRevocationInProgress) return;
            this.portalLockCheckInProgress = true;
            try {
                const message = await this.isPortalAccessTrulyLocked();
                if (message) this.revokeCurrentPortalAccess(message);
            } finally {
                this.portalLockCheckInProgress = false;
            }
        },
        async revokeCurrentPortalAccess(message = 'Your portal access has been removed. Please contact your administrator.') {
            if (this.portalAccessRevocationInProgress) return;
            this.portalAccessRevocationInProgress = true;
            this.intentionalLogoutInProgress = false;
            this.loginError = message;
            this.stopPresenceTracking();
            this.stopClientStatusClock();
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Unable to end a revoked portal session:', error);
            } finally {
                this.portalAccessRevocationInProgress = false;
            }
        },
        detectClientInformationPostcode() {
            const form = this.clientInformationModal.form;
            const result = lookupMalaysiaPostcode(form.clientPostcode);
            form.clientPostcode = result.postcode;
            if (result.city) form.clientCity = result.city;
            if (result.state) form.clientState = result.state;
            if (result.postcode.length === 5) form.clientCountry = 'Malaysia';
        },
        detectCompanyPostcode() {
            const result = lookupMalaysiaPostcode(this.company.postcode);
            this.company.postcode = result.postcode;
            if (result.city) this.company.city = result.city;
            if (result.state) this.company.state = result.state;
            if (result.postcode.length === 5) this.company.country = 'Malaysia';
        },
        addressLines(record, prefix = 'client') {
            const key = name => prefix === 'company' ? name : `client${name.charAt(0).toUpperCase()}${name.slice(1)}`;
            const legacy = String(record?.[key('address')] || '').trim();
            const line1 = String(record?.[key('address1')] || legacy).trim();
            const cityLine = [record?.[key('postcode')], record?.[key('city')]].map(value => String(value || '').trim()).filter(value => value && value !== '-').join(' ');
            return [line1, record?.[key('address2')], record?.[key('address3')], cityLine, record?.[key('state')], record?.[key('country')]]
                .map(value => String(value || '').trim()).filter(value => value && value !== '-')
                .reduce((lines, value) => {
                    const existing = lines.join(' ').toLowerCase();
                    if (!existing.includes(value.toLowerCase())) lines.push(value);
                    return lines;
                }, []);
        },
        formattedClientAddress(record = this.docForm) {
            return this.addressLines(record, 'client').join('\n');
        },
        formattedCompanyAddress() {
            return this.addressLines(this.company, 'company').join('\n') || String(this.company.address || '').trim();
        },
        hydrateCompanyAddress(data) {
            const company = { ...data };
            const legacyLines = String(company.address || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            company.address1 = company.address1 || legacyLines[0] || '';
            company.address2 = company.address2 || legacyLines[1] || '';
            company.address3 = company.address3 || legacyLines[2] || '';
            company.postcode = String(company.postcode || '').replace(/\D/g, '').slice(0, 5);
            company.city = company.city || '';
            company.state = company.state || '';
            company.country = company.country || 'Malaysia';
            return company;
        },
        async validateImageFile(file) {
            if (!file) throw new Error('No image file was selected.');
            if (file.size <= 0) throw new Error('The selected image file is empty.');
            if (file.size > 2 * 1024 * 1024) throw new Error('Image size must not exceed 2 MB.');

            const extension = String(file.name || '').split('.').pop().toLowerCase();
            const contentType = extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' : '';
            if (!contentType) throw new Error('Only PNG, JPG and JPEG files are allowed.');

            const declaredType = String(file.type || '').toLowerCase();
            const compatibleTypes = contentType === 'image/png' ? ['image/png', 'image/x-png'] : ['image/jpeg', 'image/jpg', 'image/pjpeg'];
            if (declaredType && !compatibleTypes.includes(declaredType)) throw new Error('The file extension does not match its image type.');

            const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
            const isPng = signature.length >= 8 && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47 && signature[4] === 0x0D && signature[5] === 0x0A && signature[6] === 0x1A && signature[7] === 0x0A;
            const isJpeg = signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;
            if ((contentType === 'image/png' && !isPng) || (contentType === 'image/jpeg' && !isJpeg)) throw new Error('The selected file is not a valid PNG, JPG or JPEG image.');
            return contentType;
        },
        getUploadErrorMessage(error) {
            return error?.message || 'Unable to process the image. Please select another PNG, JPG or JPEG file.';
        },
        formatFileSize(bytes) {
            const value = Number(bytes) || 0;
            return value < 1024 * 1024 ? `${(value / 1024).toFixed(0)} KB` : `${(value / (1024 * 1024)).toFixed(2)} MB`;
        },
        getFirestoreWriteError(error, action = 'save this record') {
            const code = String(error?.code || '').toLowerCase();
            if (code.includes('permission-denied')) return `Permission denied while trying to ${action}. Deploy the latest firestore.rules and sign in again.`;
            // Every branch here reports a write that did not happen, so each
            // one says so outright. Two of them used to open with neutral
            // prose and reached the operator wearing a success tick.
            if (code.includes('resource-exhausted') || code.includes('invalid-argument')) return `Unable to ${action} — the record is too large. Select smaller images.`;
            if (code.includes('unavailable') || code.includes('deadline-exceeded')) return `Unable to ${action} — Firestore is temporarily unavailable. Check the network and try again.`;
            return `Unable to ${action}. ${error?.message || 'Please try again.'}`;
        },
        getSerializedSize(value) {
            return new Blob([JSON.stringify(value)]).size;
        },
        getDataUrlSize(dataUrl) {
            if (!dataUrl || !String(dataUrl).startsWith('data:')) return 0;
            const value = String(dataUrl);
            return Math.ceil((value.length - value.indexOf(',') - 1) * 3 / 4);
        },
        async prepareImageAttachment(file, maxDataUrlBytes = 220 * 1024, maxDimension = 1600) {
            await this.validateImageFile(file);
            const imageUrl = URL.createObjectURL(file);
            try {
                const image = await new Promise((resolve, reject) => {
                    const element = new Image();
                    element.onload = () => resolve(element);
                    element.onerror = () => reject(new Error('The selected image cannot be decoded.'));
                    element.src = imageUrl;
                });
                let width = image.naturalWidth;
                let height = image.naturalHeight;
                if (!width || !height) throw new Error('The selected image has invalid dimensions.');
                const initialScale = Math.min(1, maxDimension / Math.max(width, height));
                width = Math.max(1, Math.round(width * initialScale));
                height = Math.max(1, Math.round(height * initialScale));

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { alpha: false });
                if (!context) throw new Error('This browser cannot process the selected image.');
                let quality = 0.9;
                let dataUrl = '';
                for (let attempt = 0; attempt < 14; attempt++) {
                    canvas.width = width;
                    canvas.height = height;
                    context.fillStyle = '#FFFFFF';
                    context.fillRect(0, 0, width, height);
                    context.drawImage(image, 0, 0, width, height);
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const encodedBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
                    if (encodedBytes <= maxDataUrlBytes) return dataUrl;
                    if (quality > 0.5) quality -= 0.1;
                    else {
                        const currentMax = Math.max(width, height);
                        const nextMax = Math.max(480, Math.round(currentMax * 0.82));
                        const resizeScale = nextMax / currentMax;
                        width = Math.max(1, Math.round(width * resizeScale));
                        height = Math.max(1, Math.round(height * resizeScale));
                        quality = 0.72;
                    }
                }
                throw new Error('The image could not be reduced to a safe Firestore size. Please use a smaller image.');
            } finally {
                URL.revokeObjectURL(imageUrl);
            }
        },
        async handleAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            this.attachmentUploadState.payment = true;
            try {
                this.docForm.paymentAttachment = await this.prepareImageAttachment(file);
                this.showNotify('Payment attachment is ready to be saved.');
            } catch (error) {
                console.error('Payment attachment upload failed:', error);
                this.docForm.paymentAttachment = '';
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.payment = false; e.target.value = ''; }
        },
        async handleClaimAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            this.attachmentUploadState.receipt = true;
            try {
                this.claimForm.receiptAttachment = await this.prepareImageAttachment(file);
                this.claimForm.receiptAttachmentName = file.name;
                this.claimForm.receiptAttachmentOriginalBytes = file.size;
                this.showNotify('Receipt attachment is ready to be saved.');
            } catch (error) {
                console.error('Receipt attachment upload failed:', error);
                this.claimForm.receiptAttachment = '';
                this.claimForm.receiptAttachmentName = '';
                this.claimForm.receiptAttachmentOriginalBytes = 0;
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.receipt = false; e.target.value = ''; }
        },
        async handleVoucherAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            this.attachmentUploadState.receipt = true;
            try {
                this.voucherForm.receiptAttachment = await this.prepareImageAttachment(file);
                this.voucherForm.receiptAttachmentName = file.name;
                this.voucherForm.receiptAttachmentOriginalBytes = file.size;
                this.showNotify('Supporting document is ready to be saved.');
            } catch (error) {
                console.error('Voucher attachment upload failed:', error);
                this.voucherForm.receiptAttachment = '';
                this.voucherForm.receiptAttachmentName = '';
                this.voucherForm.receiptAttachmentOriginalBytes = 0;
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.receipt = false; e.target.value = ''; }
        },
        async handleDirectorApprovalAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const receiptOriginalBytes = Number(this.claimPreview.claim?.receiptAttachmentOriginalBytes || 0);
            if (receiptOriginalBytes + file.size > 2 * 1024 * 1024) {
                this.showNotify('The total original attachments for one claim must not exceed 2 MB. Select a smaller Director document.');
                e.target.value = '';
                return;
            }
            this.attachmentUploadState.director = true;
            try {
                this.claimPreview.directorApprovalAttachment = await this.prepareImageAttachment(file);
                this.claimPreview.directorApprovalAttachmentName = file.name;
                this.claimPreview.directorApprovalOriginalBytes = file.size;
                this.showNotify('Director approval document is ready to be saved.');
            } catch (error) {
                console.error('Director attachment upload failed:', error);
                this.claimPreview.directorApprovalAttachment = '';
                this.claimPreview.directorApprovalAttachmentName = '';
                this.claimPreview.directorApprovalOriginalBytes = 0;
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.director = false; e.target.value = ''; }
        },
        async validateClientDocumentFile(file) {
            if (!file) throw new Error('No file was selected.');
            if (file.size <= 0) throw new Error('The selected file is empty.');
            if (file.size > 10 * 1024 * 1024) throw new Error('File size must not exceed 10 MB.');

            const extension = String(file.name || '').split('.').pop().toLowerCase();
            const extensionTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
            const contentType = extensionTypeMap[extension];
            if (!contentType) throw new Error('Only JPG, JPEG, PNG and PDF files are allowed.');

            const declaredType = String(file.type || '').toLowerCase();
            const compatibleTypesMap = {
                'image/png': ['image/png', 'image/x-png'],
                'image/jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
                'application/pdf': ['application/pdf']
            };
            if (declaredType && !compatibleTypesMap[contentType].includes(declaredType)) throw new Error('The file extension does not match its actual file type.');

            const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
            const isPng = signature.length >= 8 && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47 && signature[4] === 0x0D && signature[5] === 0x0A && signature[6] === 0x1A && signature[7] === 0x0A;
            const isJpeg = signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;
            const isPdf = signature.length >= 4 && signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46;
            if ((contentType === 'image/png' && !isPng) || (contentType === 'image/jpeg' && !isJpeg) || (contentType === 'application/pdf' && !isPdf)) {
                throw new Error('The selected file is not a valid JPG, PNG or PDF — its content does not match its extension.');
            }
            return contentType;
        },
        loadClientDocuments(clientDirectoryId, clientName = '', clientEmail = '') {
            if (this.clientDocumentsUnsubscribe) { this.clientDocumentsUnsubscribe(); this.clientDocumentsUnsubscribe = null; }
            if (!clientDirectoryId) { this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' }; return; }
            this.clientDocuments.clientDirectoryId = clientDirectoryId;
            this.clientDocuments.clientName = clientName;
            this.clientDocuments.clientEmail = clientEmail;
            this.clientDocuments.loading = true;
            this.clientDocuments.error = '';
            // Firestore Rules independently re-verify access via customerEmailMatches()
            // against the linked customers record, so this query only needs to scope
            // by clientDirectoryId — filtering on the primary contact's own clientEmail
            // here would incorrectly hide these documents from an authorized secondary
            // client contact (see customers/{id}.additionalClientEmails).
            const q = query(collection(db, 'client_documents'), where('clientDirectoryId', '==', clientDirectoryId));
            // Live subscription (not a one-time getDocs): whoever else — staff or the
            // client — has this same client's document list open sees an upload/delete
            // from the other side appear immediately, no tab switch/refresh needed.
            this.clientDocumentsUnsubscribe = onSnapshot(q, (snapshot) => {
                if (this.clientDocuments.clientDirectoryId !== clientDirectoryId) return;
                this.clientDocuments.items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
                this.clientDocuments.loading = false;
            }, (error) => {
                console.error('Load client documents failed:', error);
                if (this.clientDocuments.clientDirectoryId !== clientDirectoryId) return;
                this.clientDocuments.error = error && error.code === 'permission-denied'
                    ? "You don't have access to view these documents. If this looks wrong, please contact our team."
                    : 'Could not load documents right now — check your internet connection and try again.';
                this.clientDocuments.loading = false;
            });
        },
        clientDocumentIcon(fileType) {
            return fileType === 'application/pdf' ? 'fa-file-pdf text-red-500' : 'fa-file-image text-blue-500';
        },
        async handleClientDocumentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!this.canUploadClientDocuments) { this.showNotify('You do not have permission to upload client documents.'); e.target.value = ''; return; }
            const clientDirectoryId = this.clientDocuments.clientDirectoryId;
            if (!clientDirectoryId) { this.showNotify('No client selected for this document.'); e.target.value = ''; return; }
            this.clientDocuments.uploading = true;
            try {
                const contentType = await this.validateClientDocumentFile(file);
                const safeName = String(file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                const storageFileName = `${Date.now()}_${safeName}`;
                const storagePath = `client_documents/${clientDirectoryId}/${storageFileName}`;
                const fileRef = storageRef(storage, storagePath);
                await uploadBytes(fileRef, file, { contentType });
                const downloadURL = await getDownloadURL(fileRef);
                const docId = `${clientDirectoryId}_${Date.now()}`;
                await setDoc(doc(db, 'client_documents', docId), {
                    clientDirectoryId,
                    clientName: this.clientDocuments.clientName,
                    clientEmail: this.clientDocuments.clientEmail,
                    fileName: file.name,
                    fileType: contentType,
                    fileSize: file.size,
                    storagePath,
                    storageFileName,
                    downloadURL,
                    uploadedByUid: this.userProfile.uid,
                    uploadedByName: this.userProfile.name,
                    uploadedByEmail: this.userProfile.email,
                    uploadedAt: new Date().toISOString()
                });
                this.logAudit('UPLOAD_DOCUMENT', `Uploaded "${file.name}" for client ${this.clientDocuments.clientName}`);
                this.showNotify('Document uploaded successfully.');
                if (this.userProfile.role === 'Client') this.notifyByEmail({
                    to: [...this.emailsForRole('Superadmin'), ...this.emailsForRole('Director'), ...this.emailsForRole('HR'), ...this.emailsForRole('Account')],
                    subject: `New Document Uploaded by ${this.clientDocuments.clientName}`,
                    heading: 'Client Uploaded a New Document',
                    message: `${this.userProfile.name} from ${this.clientDocuments.clientName} uploaded "${file.name}" to the Client Documents repository.`
                }); else this.notifyByEmail({
                    to: this.clientDocuments.clientEmail,
                    subject: `New Document Shared — ${this.clientDocuments.clientName}`,
                    heading: 'New Document Shared With You',
                    message: `${this.userProfile.name} shared a new document, "${file.name}", in your Client Documents repository. Sign in to view or download it.`
                });
                // No manual reload — the live subscription set up by loadClientDocuments()
                // already reflects this upload as soon as it commits.
            } catch (error) {
                console.error('Client document upload failed:', error);
                this.showNotify(error?.message || 'Unable to upload the document. Please try again.');
            } finally {
                this.clientDocuments.uploading = false;
                e.target.value = '';
            }
        },
        viewClientDocument(item) {
            window.open(item.downloadURL, '_blank', 'noopener');
        },
        async downloadClientDocument(item) {
            try {
                const response = await fetch(item.downloadURL);
                if (!response.ok) throw new Error('Download failed.');
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = item.fileName || 'document';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error('Client document download failed:', error);
                this.showNotify('Unable to download this document. Please try again.');
            }
        },
        requestDeleteClientDocument(item) {
            if (!this.canManageDocuments) { this.showNotify('You do not have permission to remove client documents.'); return; }
            this.requestConfirm({
                title: 'Remove this document?',
                message: `"${item.fileName}" will be permanently removed from ${this.clientDocuments.clientName}'s document repository. This cannot be undone.`,
                confirmLabel: 'Yes, Remove Document',
                danger: true,
                onConfirm: () => this.deleteClientDocument(item)
            });
        },
        async deleteClientDocument(item) {
            try {
                // The stored file may already be gone (legacy rows predating storagePath, or a
                // file removed straight from the bucket). Losing the bytes must not block removing
                // the metadata row, otherwise the entry is orphaned in the UI forever.
                if (item.storagePath) {
                    try {
                        await deleteObject(storageRef(storage, item.storagePath));
                    } catch (storageError) {
                        if (storageError?.code !== 'storage/object-not-found') throw storageError;
                    }
                }
                await deleteDoc(doc(db, 'client_documents', item.id));
                // No manual list splice — the live subscription drops this item for every
                // viewer (staff and client alike) the moment the delete commits.
                this.logAudit('DELETE_DOCUMENT', `Removed "${item.fileName}" from client ${this.clientDocuments.clientName}`);
                this.showNotify('Document removed.');
            } catch (error) {
                console.error('Client document delete failed:', error);
                this.showNotify('Unable to remove this document. Please try again.');
            }
        },
        // noteLabel turns on a free-text field inside the dialog — used where a
        // decision is worth recording a reason for, not just a yes or no.
        requestConfirm({ title, message, confirmLabel = 'Yes, Continue', danger = false, noteLabel = '', notePlaceholder = '', onConfirm = null, onResolve = null }) {
            this.appConfirm = { show: true, title, message, confirmLabel, danger, noteLabel, notePlaceholder, note: '', onConfirm, onResolve };
        },
        // Promise-returning form of requestConfirm, for `if (!await this.askConfirm(…)) return;`.
        // The native confirm() this replaces blocks the main thread for as long as the
        // dialog stays open, and Chrome bills that whole stretch to the originating
        // click, so a destructive action measured over a second of INP.
        askConfirm(options) {
            return new Promise(resolve => this.requestConfirm({ ...options, onResolve: resolve }));
        },
        // Same dialog, but hands back what was typed alongside the answer.
        askConfirmWithNote(options) {
            return new Promise(resolve => this.requestConfirm({
                ...options,
                onResolve: (confirmed, note) => resolve({ confirmed, note })
            }));
        },
        resolveAppConfirm(confirmed) {
            const { onConfirm, onResolve, note } = this.appConfirm;
            this.appConfirm = { show: false, title: '', message: '', confirmLabel: 'Yes, Continue', danger: false, noteLabel: '', notePlaceholder: '', note: '', onConfirm: null, onResolve: null };
            if (confirmed && typeof onConfirm === 'function') onConfirm();
            // Always settle a pending askConfirm — cancelling, dismissing the overlay
            // and the Escape handler all route here, and an unsettled promise would
            // strand the caller mid-action.
            if (typeof onResolve === 'function') onResolve(confirmed, String(note || '').trim());
        },
        clearAllDocItems() {
            this.requestConfirm({
                title: 'Clear all items?',
                message: 'This removes every product/service line from this document.',
                confirmLabel: 'Yes, Clear Items',
                danger: true,
                onConfirm: () => { this.docForm.items = [{ desc: '', qty: 1, price: 0 }]; this.showNotify("All items cleared."); }
            });
        },
        resetDocForm() {
            this.requestConfirm({
                title: 'Clear the entire form?',
                message: 'This removes all client information and items entered so far.',
                confirmLabel: 'Yes, Clear Form',
                danger: true,
                onConfirm: () => { this.resetAllForms(); this.showNotify("Form cleared."); }
            });
        },
        resetPayForm() {
            this.requestConfirm({
                title: 'Clear the entire payslip form?',
                message: 'This removes all payslip details entered so far.',
                confirmLabel: 'Yes, Clear Form',
                danger: true,
                onConfirm: () => { this.editingPayId = null; this.resetAllForms(); this.showNotify("Form cleared."); }
            });
        },
        resetClaimForm() {
            this.editingClaimId = null; this.resetAllForms();
        },
        resetVoucherForm() {
            this.editingVoucherId = null; this.resetAllForms();
        },

        maskSensitive(val) {
            if (!val) return '-';
            const digits = String(val).replace(/\D/g, '');
            const lastFour = (digits || String(val).trim()).slice(-4);
            return `XXXXX${lastFour}`;
        },
        maskIC(val) { return this.maskSensitive(val); },
        maskBank(val) { return this.maskSensitive(val); },
        maskEpfSocso(val) {
            if (!val) return '-';
            return String(val).replace(/(KWSP|EPF|PERKESO|SOCSO)\s*:\s*([^|]+)/gi, (match, label, number) => `${label}: ${this.maskSensitive(number)}`);
        },

        hasAccess(moduleName) {
            // Quotation and Invoice are dedicated workspaces backed by the
            // existing document permission. They intentionally do not create
            // an additional RBAC surface or loosen document access.
            const permissionModule = {
                'document-quotations': 'doc-generator',
                'document-invoices': 'doc-generator'
            }[moduleName] || moduleName;
            const allowedModules = RBAC_ROLES[this.userProfile.role] || ['dashboard'];
            return allowedModules.includes(permissionModule);
        },
        // Per-module permission derived from the role alone. 'edit' follows page
        // visibility; 'delete' is Superadmin/Director only, except Finance may
        // delete billing documents and IT may delete website content.
        hasModulePermission(moduleName, action) {
            // website-content grants IT full edit+delete (firestore.rules' isContentAdmin()
            // covers IT for these public-site collections too), unlike every other module
            // where 'delete' defaults to Superadmin/Director only.
            if (action === 'delete' && moduleName === 'website-content') return this.hasAccess(moduleName);
            if (action === 'delete' && moduleName === 'doc-generator') return ['Superadmin', 'Director', 'Account'].includes(this.userProfile.role);
            if (action === 'delete') return ['Superadmin', 'Director'].includes(this.userProfile.role);
            return this.hasAccess(moduleName);
        },
        formatCurrency(val) {
            return new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(val || 0);
        },
        formatDateTime(val) {
            return val ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(val)) : '-';
        },
        formatDateWithDay(val) {
            if (!val) return '-';
            const raw = typeof val === 'string' && val.length === 10 ? `${val}T00:00:00` : val;
            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) return '-';
            return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
        },
        formatDateTimeWithDay(val) {
            if (!val) return '-';
            const parsed = new Date(val);
            if (Number.isNaN(parsed.getTime())) return '-';
            return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
        },
        getLocalDateKey(value = new Date()) {
            const date = value instanceof Date ? value : new Date(value);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        getPresenceTime(value) {
            if (!value) return 0;
            if (typeof value.toDate === 'function') return value.toDate().getTime();
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
        },
        // An account is "anchored" when the email it signs in with is the email
        // stored on a real directory record: employees/{empNo} for staff, or a
        // customers/{id} clientEmail/additionalClientEmails entry for a Client.
        // Presence is only honoured for anchored accounts, because an ONLINE
        // light on an account that appears in neither directory is a claim
        // nobody can check against anything.
        //
        // Superadmin alone is exempt: it is the system account that runs the
        // portal and is deliberately not tied to a Staff ID or a Client ID. The
        // protected seed administrator is exempt for the same reason - it was
        // signed in and running the system while absent from the HR directory.
        // Director is NOT exempt: a Director is a person on the staff, so their
        // portal login is expected to sit on an employee record like anyone
        // else's, and an unanchored one is worth seeing as offline.
        isPresenceAnchored(user) {
            const email = String(user?.email || '').trim().toLowerCase();
            if (!email) return false;
            if (user?.role === 'Superadmin' || this.isSeedAdminEmail(email)) return true;
            return this.presenceAnchorEmails.has(email);
        },
        isEmployeeOnline(emp) {
            if (!this.isPresenceAnchored(emp)) return false;
            const lastUpdate = this.getPresenceTime(emp.presenceUpdatedAt || emp.lastSeen);
            return emp.presenceStatus === 'Online' && lastUpdate > 0 && (this.presenceNow - lastUpdate) < 90000;
        },
        isPortalUserOnline(user) {
            if (!this.isPresenceAnchored(user)) return false;
            const lastUpdate = this.getPresenceTime(user?.presenceUpdatedAt || user?.lastSeen);
            return user?.presenceStatus === 'Online' && lastUpdate > 0 && (this.presenceNow - lastUpdate) < 90000;
        },
        // A client "company" (customers collection) can have several authorized
        // portal logins (clientEmail + additionalClientEmails, same matching used
        // by projectClientAccessUsers) — online means any one of them is active.
        isClientOnline(clientDirectoryId) {
            const customer = this.customers.find(item => item.id === clientDirectoryId);
            if (!customer) return false;
            const authorizedEmails = new Set([
                customer.clientEmail,
                ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])
            ].map(email => String(email || '').trim().toLowerCase()).filter(Boolean));
            if (!authorizedEmails.size) return false;
            return this.users.some(user => user.role === 'Client' && authorizedEmails.has(String(user.email || '').trim().toLowerCase()) && this.isPortalUserOnline(user));
        },
        clientPresenceDetail(clientDirectoryId) {
            return this.isClientOnline(clientDirectoryId) ? 'Client online now' : 'Client offline';
        },
        processPortalPresenceNotifications(users) {
            const nextStates = {};
            users.forEach(user => {
                const userId = String(user?.id || '');
                if (!userId) return;
                const isOnline = this.isPortalUserOnline(user);
                nextStates[userId] = isOnline;
                // The initial directory snapshot establishes the baseline only. It
                // must not flood every staff member with alerts for people already
                // online when they sign in themselves.
                if (this.presenceNotificationsReady && this.userProfile.role !== 'Client' && userId !== this.userProfile.uid && isOnline && !this.portalUserOnlineStates[userId]) {
                    const type = user.role === 'Client' ? 'Client' : 'Staff';
                    this.showNotify(`${user.name || user.email || type} (${type}) is now online.`);
                }
            });
            this.portalUserOnlineStates = nextStates;
            this.presenceNotificationsReady = true;
        },
        async setCurrentPortalPresence(isOnline) {
            if (!auth.currentUser || !this.userProfile.uid) return false;
            const timestamp = new Date().toISOString();
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid), {
                    presenceStatus: isOnline ? 'Online' : 'Offline',
                    isOnline: !!isOnline,
                    presenceUpdatedAt: timestamp,
                    lastSeen: timestamp
                }, { merge: true });
                return true;
            } catch (error) {
                console.error('Unable to update portal presence:', error);
                return false;
            }
        },
        async setCurrentPresence(isOnline) {
            await this.setCurrentPortalPresence(isOnline);
            if (this.userProfile.role !== 'Client') return this.setCurrentEmployeePresence(isOnline);
            return true;
        },
        async syncCurrentOwnerPhoto() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            const photo = this.userProfile.photo || '';
            if (this.userProfile.role === 'Client' || !email || !photo) return;
            try {
                const snapshot = await getDocs(query(collection(db, 'projects'), where('ownerEmail', '==', email)));
                const pending = snapshot.docs.filter(projectDoc => projectDoc.data().ownerPhoto !== photo);
                for (let start = 0; start < pending.length; start += 450) {
                    const batch = writeBatch(db);
                    pending.slice(start, start + 450).forEach(projectDoc => batch.update(projectDoc.ref, { ownerPhoto: photo }));
                    await batch.commit();
                }
            } catch (error) {
                console.error('Unable to synchronize PIC photo to projects:', error);
            }
        },
        employeePresenceLabel(emp) {
            return this.isEmployeeOnline(emp) ? 'Online' : 'Offline';
        },
        employeeLastSeen(emp) {
            if (this.isEmployeeOnline(emp)) return 'Active now';
            return emp.lastSeen ? `Last seen ${this.formatDateTime(emp.lastSeen)}` : 'No login activity';
        },
        portalUserPresenceLabel(user) {
            return this.isPortalUserOnline(user) ? 'Online' : 'Offline';
        },
        portalUserLastSeen(user) {
            if (this.isPortalUserOnline(user)) return 'Active now';
            return user.lastSeen ? `Last seen ${this.formatDateTime(user.lastSeen)}` : 'No login activity';
        },
        async setCurrentEmployeePresence(isOnline) {
            if (!auth.currentUser || !this.userProfile.email || !this.employees.length) return false;
            const email = this.userProfile.email.trim().toLowerCase();
            // Matched on the email alone. This used to try presenceUid first and
            // fall back to the email, which sounds harmless and is not: the uid
            // branch never checked the email, so once a record carried somebody
            // else's presenceUid it kept collecting their heartbeats forever,
            // and could not recover on its own because the uid branch always won.
            // That is exactly what happened - a finance employee record held the
            // Super Admin's uid and showed ONLINE for as long as the Super Admin
            // was signed in, while the Super Admin's own presence went nowhere.
            //
            // The email is the real link between a portal login and a Staff ID,
            // and it is what firestore.rules requires anyway on the self-presence
            // path (resource.data.email == request.auth.token.email). The uid
            // branch could therefore only ever "work" for an admin, whose write
            // is admitted by isAdmin() instead - and when it worked, it was wrong.
            // presenceUid is still written below, since the rules check it; it is
            // simply no longer trusted to identify which record to write to.
            const employee = this.employees.find(emp => String(emp.email || '').trim().toLowerCase() === email);
            if (!employee) return false;
            const timestamp = new Date().toISOString();
            const presenceChanged = this.isEmployeeOnline(employee) !== Boolean(isOnline);
            const shouldSyncProjectPresence = presenceChanged || (isOnline && Date.now() - this.lastProjectPresenceSyncAt >= 60000);
            try {
                await updateDoc(doc(db, 'employees', employee.id || employee.empNo), {
                    presenceStatus: isOnline ? 'Online' : 'Offline',
                    isOnline: !!isOnline,
                    presenceUid: auth.currentUser.uid,
                    presenceUpdatedAt: timestamp,
                    lastSeen: timestamp
                });
                if (shouldSyncProjectPresence) {
                    await this.syncAssignedProjectPresence(employee, isOnline, timestamp);
                    this.lastProjectPresenceSyncAt = Date.now();
                }
                return true;
            } catch (error) {
                console.error('Unable to update employee presence:', error);
                return false;
            }
        },
        async startPresenceTracking() {
            this.stopPresenceTracking();
            this.presenceNow = Date.now();
            await this.setCurrentPresence(true);
            await this.syncCurrentOwnerPhoto();
            this.presenceHeartbeatTimer = setInterval(() => {
                this.presenceNow = Date.now();
                this.setCurrentPresence(true);
            }, 30000);
            this.presenceClockTimer = setInterval(() => { this.presenceNow = Date.now(); }, 15000);
            this.presencePageHideHandler = () => { this.setCurrentPresence(false); };
            this.presencePageShowHandler = () => { if (this.isLoggedIn) this.setCurrentPresence(true); };
            this.presenceVisibilityHandler = () => { if (!document.hidden && this.isLoggedIn) this.setCurrentPresence(true); };
            window.addEventListener('pagehide', this.presencePageHideHandler);
            window.addEventListener('pageshow', this.presencePageShowHandler);
            document.addEventListener('visibilitychange', this.presenceVisibilityHandler);
        },
        stopPresenceTracking() {
            if (this.presenceHeartbeatTimer) clearInterval(this.presenceHeartbeatTimer);
            if (this.presenceClockTimer) clearInterval(this.presenceClockTimer);
            this.presenceHeartbeatTimer = null;
            this.presenceClockTimer = null;
            this.lastProjectPresenceSyncAt = 0;
            if (this.presencePageHideHandler) window.removeEventListener('pagehide', this.presencePageHideHandler);
            if (this.presencePageShowHandler) window.removeEventListener('pageshow', this.presencePageShowHandler);
            if (this.presenceVisibilityHandler) document.removeEventListener('visibilitychange', this.presenceVisibilityHandler);
            this.presencePageHideHandler = null;
            this.presencePageShowHandler = null;
            this.presenceVisibilityHandler = null;
            this.presenceNotificationsReady = false;
            this.portalUserOnlineStates = {};
        },
        // Every toast used to render a success tick, so "Unable to delete this
        // account" arrived wearing the same green check as a completed save.
        // Callers may state the tone; when they don't, clear failure wording is
        // read as a failure rather than assumed to be good news.
        notificationTone(msg) {
            // "Only X may …" is how this codebase words a refusal — all 21 of
            // them are denials, and no success message opens that way.
            return /^(unable|access denied|failed|only|error)\b|\b(cannot|could not|couldn't|failed|error|denied|not permitted|no permission|do not have (permission|access)|does not permit|refused|rejected)\b/i.test(String(msg || ''))
                ? 'error'
                : 'success';
        },
        showNotify(msg, tone = '') {
            this.notification = { show: true, message: msg, tone: tone || this.notificationTone(msg) };
            setTimeout(() => { this.notification.show = false; }, 3500);
            this.notificationsLog.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, message: msg, read: false, timestamp: new Date().toISOString() });
            if (this.notificationsLog.length > 30) this.notificationsLog.length = 30;
            this.scheduleNotificationsSync();
        },
        scheduleNotificationsSync() {
            if (!this.userProfile.uid) return;
            if (this.notificationsSyncTimer) clearTimeout(this.notificationsSyncTimer);
            this.notificationsSyncTimer = setTimeout(() => this.syncNotificationsLog(), 2500);
        },
        async syncNotificationsLog() {
            if (!this.userProfile.uid) return;
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid), { notificationsLog: this.notificationsLog }, { merge: true });
            } catch (error) {
                console.error('Unable to sync notifications log:', error);
            }
        },
        toggleNotificationsPanel() {
            this.notificationsPanelOpen = !this.notificationsPanelOpen;
        },
        toggleStaffDirectoryPanel() {
            this.staffDirectoryPanelOpen = !this.staffDirectoryPanelOpen;
        },
        async markAllNotificationsRead() {
            this.notificationsLog.forEach(n => { n.read = true; });
            this.syncNotificationsLog();
            const unreadPortal = this.portalNotifications.filter(notification => !notification.read && !notification.hiddenAt);
            await Promise.all(unreadPortal.map(notification => updateDoc(doc(db, 'portal_notifications', notification.id), { read: true, readAt: new Date().toISOString() }).catch(error => console.warn('Unable to mark website notification as read:', error))));
        },
        async clearNotificationsLog() {
            this.notificationsLog = [];
            this.notificationsPanelOpen = false;
            this.syncNotificationsLog();
            const visiblePortal = this.portalNotifications.filter(notification => !notification.hiddenAt);
            await Promise.all(visiblePortal.map(notification => updateDoc(doc(db, 'portal_notifications', notification.id), { hiddenAt: new Date().toISOString() }).catch(error => console.warn('Unable to hide website notification:', error))));
        },

        isSupportedImageAttachment(attachment) {
            return typeof attachment === 'string' && (
                /^data:image\/(png|jpeg);base64,/i.test(attachment) ||
                /^https:\/\/firebasestorage\.googleapis\.com\//i.test(attachment)
            );
        },
        openAttachment(attachment, label = 'Attachment') {
            const isSupportedImage = this.isSupportedImageAttachment(attachment);
            if (!isSupportedImage) {
                this.showNotify(`${label} is unavailable. Only PNG and JPEG/JPG attachments are supported.`);
                return;
            }

            this.attachmentPreview = { show: true, url: attachment, label };
        },

        toggleSidebar() {
            if (window.innerWidth < 768) this.mobileMenuOpen = !this.mobileMenuOpen;
            else this.desktopSidebarOpen = !this.desktopSidebarOpen;
        },
        handleSidebarWheel(event) {
            // The portal shell intentionally locks the outer page. Route a
            // mouse-wheel gesture from any part of the sidebar to its menu so
            // navigation remains reliably scrollable over buttons and labels.
            if (event.ctrlKey || !event.deltaY) return;
            const nav = event.currentTarget?.querySelector('.zq-sidebar-nav');
            if (!nav) return;
            const previousTop = nav.scrollTop;
            nav.scrollTop += event.deltaY;
            if (nav.scrollTop !== previousTop) event.preventDefault();
        },
        applyDarkModePreference() {
            this.darkMode = this.userProfile.themePreference === 'dark';
            document.documentElement.classList.toggle('dark', this.darkMode);
        },
        async toggleDarkMode() {
            this.darkMode = !this.darkMode;
            document.documentElement.classList.toggle('dark', this.darkMode);
            this.userProfile.themePreference = this.darkMode ? 'dark' : 'light';
            if (!this.userProfile.uid) return;
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid), { themePreference: this.userProfile.themePreference }, { merge: true });
            } catch (error) {
                console.error('Unable to save theme preference:', error);
            }
        },
        async checkForAppUpdate() {
            try {
                // Watches every file a deploy can change on its own: the page,
                // the application logic, and the stylesheet. Any one of them
                // shipping alone is a real release, and a check that missed it
                // left the banner silent for that release.
                const [pageResponse, scriptResponse, styleResponse] = await Promise.all([
                    fetch(`${window.location.pathname}?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }),
                    fetch(`/app.js?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }),
                    fetch(`/custom.css?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
                ]);
                const markerOf = response => response.headers.get('etag') || response.headers.get('last-modified') || '';
                const pageMarker = markerOf(pageResponse);
                const scriptMarker = markerOf(scriptResponse);
                const styleMarker = markerOf(styleResponse);
                if (!pageMarker && !scriptMarker && !styleMarker) return;
                const marker = `${pageMarker}|${scriptMarker}|${styleMarker}`;
                if (!this.appVersionMarker) { this.appVersionMarker = marker; return; }
                if (marker !== this.appVersionMarker) this.appUpdateAvailable = true;
            } catch (error) { /* offline or blocked request, ignore and retry next interval */ }
        },
        async refreshApp() {
            // The Client Workspace uses the same app shell as Staff. Ask the
            // browser to check the service worker first, then reload so a
            // manual Client refresh cannot keep an older app shell open.
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    await registration?.update();
                } catch (error) { /* reload still gives the network-first shell a chance to update */ }
            }
            window.location.reload();
        },
        startIdleTimeoutWatch() {
            this.stopIdleTimeoutWatch();
            const IDLE_EVENTS = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
            const armTimers = () => {
                this.idleWarningVisible = false;
                clearTimeout(this.idleWarningTimer);
                clearTimeout(this.idleLogoutTimer);
                this.idleWarningTimer = setTimeout(() => { this.idleWarningVisible = true; }, 29 * 60 * 1000);
                this.idleLogoutTimer = setTimeout(() => {
                    if (this.isLoggedIn) { this.showNotify('You were signed out after 30 minutes of inactivity.'); this.handleLogout(); }
                }, 30 * 60 * 1000);
            };
            this.idleActivityHandler = armTimers;
            IDLE_EVENTS.forEach(evt => window.addEventListener(evt, this.idleActivityHandler, { passive: true }));
            armTimers();
        },
        stopIdleTimeoutWatch() {
            clearTimeout(this.idleWarningTimer);
            clearTimeout(this.idleLogoutTimer);
            this.idleWarningTimer = null;
            this.idleLogoutTimer = null;
            this.idleWarningVisible = false;
            if (this.idleActivityHandler) {
                ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'].forEach(evt => window.removeEventListener(evt, this.idleActivityHandler));
                this.idleActivityHandler = null;
            }
        },
        staySignedIn() {
            if (this.idleActivityHandler) this.idleActivityHandler();
        },
        // A greeting on every sign-in, timed rather than dismissed. Mount it
        // hidden and flip the class on a later frame: without a painted start
        // value the browser jumps straight to the end and there is no fade in.
        playWelcomeGreeting() {
            this.clearWelcomeGreetingTimers();
            this.welcomeGreeting = { show: true, visible: false, name: this.userProfile.name || '' };
            // nextTick puts the node in the DOM, the paired frames let it paint
            // once at opacity 0 before the class flips.
            this.$nextTick(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { if (this.welcomeGreeting.show) this.welcomeGreeting.visible = true; });
                });
            });
            // Hold, fade back out, then unmount once the transition has run.
            this.welcomeGreetingTimers.push(setTimeout(() => { this.welcomeGreeting.visible = false; }, WELCOME_GREETING_HOLD_MS));
            this.welcomeGreetingTimers.push(setTimeout(() => { this.welcomeGreeting.show = false; }, WELCOME_GREETING_HOLD_MS + WELCOME_GREETING_FADE_MS));
        },
        clearWelcomeGreetingTimers() {
            this.welcomeGreetingTimers.forEach(id => clearTimeout(id));
            this.welcomeGreetingTimers = [];
        },
        switchTab(tabName) {
            if (!this.hasAccess(tabName)) { this.showNotify('Access Denied: Your role does not permit access to this module.'); return; }
            if (this.currentTab === tabName) {
                this.mobileMenuOpen = false;
                this.desktopSidebarOpen = false;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            window.history.pushState({ zenqorPortal: true, tab: tabName }, '', window.location.href);
            this.currentTab = tabName;
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        startClientStatusClock() {
            if (this.clientStatusClockTimer) clearInterval(this.clientStatusClockTimer);
            this.clientStatusNow = Date.now();
            // The New tag is time-derived rather than saved state. Refreshing this
            // clock makes it disappear at the 24-hour boundary on every open portal.
            this.clientStatusClockTimer = setInterval(() => { this.clientStatusNow = Date.now(); }, 1000);
        },
        stopClientStatusClock() {
            if (this.clientStatusClockTimer) clearInterval(this.clientStatusClockTimer);
            this.clientStatusClockTimer = null;
        },
        openDocumentWorkspace() {
            if (!this.hasAccess('document-quotations')) { this.showNotify('Access Denied: Your role does not permit access to documents.'); return; }
            this.switchTab('document-quotations');
        },
        returnToDashboard() {
            if (this.userProfile.role === 'Client') this.switchTab('client-portal');
            else this.switchTab('dashboard');
        },
        restoreTabFromHistory(tabName) {
            const homeTab = this.userProfile.role === 'Client' ? 'client-portal' : 'dashboard';
            const resolvedTab = tabName === 'document-invoices' ? 'document-quotations' : tabName;
            const safeTab = typeof resolvedTab === 'string' && this.hasAccess(resolvedTab) ? resolvedTab : homeTab;
            this.currentTab = safeTab;
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.scrollTo({ top: 0, behavior: 'auto' });
        },
        refreshDashboardCharts(attempt = 0) {
            if (!this.isLoggedIn || !this.portalDataReady || this.currentTab !== 'dashboard' || ['Staff', 'Client'].includes(this.userProfile.role)) return;
            if (this.chartRenderTimer) { clearTimeout(this.chartRenderTimer); this.chartRenderTimer = null; }
            if (this.chartRenderFrameOne) cancelAnimationFrame(this.chartRenderFrameOne);
            if (this.chartRenderFrameTwo) cancelAnimationFrame(this.chartRenderFrameTwo);
            this.chartRenderFrameOne = null;
            this.chartRenderFrameTwo = null;
            this.chartRenderAttempts = attempt;
            this.$nextTick(() => {
                if (!this.isLoggedIn || this.currentTab !== 'dashboard') return;
                this.chartRenderFrameOne = requestAnimationFrame(() => {
                    this.chartRenderFrameOne = null;
                    this.chartRenderFrameTwo = requestAnimationFrame(() => {
                        this.chartRenderFrameTwo = null;
                        if (!this.isLoggedIn || !this.portalDataReady || this.currentTab !== 'dashboard') return;
                        const revenueCanvas = document.getElementById('revenueChart');
                        const statusCanvas = document.getElementById('statusChart');
                        const claimsCanvas = document.getElementById('claimsChart');
                        if (typeof Chart === 'undefined' || !revenueCanvas?.isConnected || !statusCanvas?.isConnected || !claimsCanvas?.isConnected) {
                            if (attempt < 150) this.chartRenderTimer = setTimeout(() => this.refreshDashboardCharts(attempt + 1), 200);
                            return;
                        }
                        this.chartRenderAttempts = 0;
                        this.renderCharts();
                    });
                });
            });
        },
        destroyDashboardCharts() {
            if (this.chartRenderTimer) clearTimeout(this.chartRenderTimer);
            if (this.chartRenderFrameOne) cancelAnimationFrame(this.chartRenderFrameOne);
            if (this.chartRenderFrameTwo) cancelAnimationFrame(this.chartRenderFrameTwo);
            this.chartRenderTimer = null;
            this.chartRenderFrameOne = null;
            this.chartRenderFrameTwo = null;
            this.chartRenderAttempts = 0;
            if (this.revenueChartInstance) { try { this.revenueChartInstance.destroy(); } catch (error) { console.warn('Revenue chart cleanup skipped:', error); } }
            if (this.statusChartInstance) { try { this.statusChartInstance.destroy(); } catch (error) { console.warn('Status chart cleanup skipped:', error); } }
            if (this.claimsChartInstance) { try { this.claimsChartInstance.destroy(); } catch (error) { console.warn('Claims chart cleanup skipped:', error); } }
            this.revenueChartInstance = null;
            this.statusChartInstance = null;
            this.claimsChartInstance = null;
        },
        requestLogout() {
            this.logoutConfirm = true;
        },
        selectAuthView(view) {
            this.authView = view;
            this.loginError = '';
        },
        setChartFilter(timeframe) {
            this.chartTimeFilter = timeframe; this.refreshDashboardCharts();
            this.showNotify(`Chart view changed to: ${timeframe.toUpperCase()}`);
        },
        async logAudit(action, details) {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;
                const idToken = await firebaseUser.getIdToken();
                const response = await fetch('/api/audit-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ action, details, module: this.currentTab })
                });
                if (!response.ok) throw new Error(`Audit API returned ${response.status}`);
            } catch (error) {
                console.error('Unable to record audit event:', error);
            }
        },
        async loadAuditRetention() {
            if (!['Superadmin', 'Director', 'IT'].includes(this.userProfile.role)) return;
            this.auditRetention.loading = true;
            this.auditRetention.error = '';
            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/api/audit-retention', { headers: { 'Authorization': `Bearer ${idToken}` } });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Unable to load retention settings.');
                this.auditRetention.value = data.value;
                this.auditRetention.unit = data.unit;
            } catch (error) {
                this.auditRetention.error = error.message || 'Unable to load retention settings.';
            } finally {
                this.auditRetention.loading = false;
            }
        },
        async saveAuditRetention() {
            this.auditRetention.saving = true;
            this.auditRetention.message = '';
            this.auditRetention.error = '';
            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/api/audit-retention', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ value: Number(this.auditRetention.value), unit: this.auditRetention.unit })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Unable to save retention settings.');
                this.auditRetention.message = `Retention saved. ${data.updatedRecords} existing audit record(s) scheduled for automatic cleanup.`;
                this.logAudit('UPDATE', `Audit retention set to ${data.value} ${data.unit}(s)`);
            } catch (error) {
                this.auditRetention.error = error.message || 'Unable to save retention settings.';
            } finally {
                this.auditRetention.saving = false;
            }
        },
        openForgotPasswordFlow() {
            this.forgotPasswordFlow = { active: true, email: this.loginForm.email || '', loading: false, sent: false, error: '' };
        },
        exitForgotPasswordFlow() {
            this.forgotPasswordFlow = { active: false, email: '', loading: false, sent: false, error: '' };
        },
        async submitForgotPasswordRequest() {
            this.forgotPasswordFlow.error = '';
            if (!this.forgotPasswordFlow.email) { this.forgotPasswordFlow.error = 'Please enter your email address.'; return; }
            this.forgotPasswordFlow.loading = true;
            try {
                const response = await fetch('/api/request-password-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.forgotPasswordFlow.email })
                });
                if (!response.ok) throw new Error('request-failed');
                this.forgotPasswordFlow.sent = true;
            } catch (error) {
                console.error('Password reset request failed:', error);
                this.forgotPasswordFlow.error = 'Failed to send password reset email. Please try again shortly.';
            } finally {
                this.forgotPasswordFlow.loading = false;
            }
        },
        async checkPasswordResetLink() {
            const params = new URLSearchParams(window.location.search);
            const firebaseMode = params.get('mode');
            const firebaseOobCode = params.get('oobCode');
            const legacyToken = params.get('resetToken');
            if (!firebaseOobCode && !legacyToken) return;

            // Firebase sends mode + oobCode to every custom action URL. Retain
            // the code only in Vue state, then remove it from the browser address
            // bar so it cannot be copied into history, screenshots, or referrers.
            const isFirebaseAction = Boolean(firebaseMode && firebaseOobCode);
            this.passwordResetFlow = createEmailActionFlow({
                active: true,
                source: isFirebaseAction ? 'firebase' : 'legacy',
                mode: isFirebaseAction ? firebaseMode : 'resetPassword',
                oobCode: isFirebaseAction ? firebaseOobCode : legacyToken
            });
            window.history.replaceState({}, '', window.location.pathname);

            try {
                if (isFirebaseAction) {
                    if (firebaseMode === 'resetPassword') {
                        this.passwordResetFlow.email = await verifyPasswordResetCode(auth, firebaseOobCode);
                        this.passwordResetFlow.displayName = this.accountDisplayName(this.passwordResetFlow.email);
                        this.passwordResetFlow.companyName = this.company?.name || 'Zenqor Technologies';
                        this.passwordResetFlow.valid = true;
                        await this.startPasswordResetOtp();
                        return;
                    }

                    if (firebaseMode === 'verifyEmail' || firebaseMode === 'recoverEmail') {
                        const actionInfo = await checkActionCode(auth, firebaseOobCode);
                        this.passwordResetFlow.email = actionInfo?.data?.email || '';
                        this.passwordResetFlow.previousEmail = actionInfo?.data?.previousEmail || '';
                        this.passwordResetFlow.valid = true;
                        return;
                    }

                    this.passwordResetFlow.error = 'This account action is not supported by the Zenqor Portal.';
                    return;
                }

                const response = await fetch('/api/verify-reset-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: legacyToken })
                });
                const data = await response.json();
                this.passwordResetFlow.valid = Boolean(data.valid);
                if (data.valid) {
                    this.passwordResetFlow.email = data.email;
                    this.passwordResetFlow.displayName = data.displayName || this.accountDisplayName(data.email);
                    this.passwordResetFlow.companyName = data.companyName || this.company?.name || 'Zenqor Technologies';
                    await this.startPasswordResetOtp();
                }
                else this.passwordResetFlow.error = data.reason || 'This reset link is invalid. Please request a new one.';
            } catch (error) {
                console.error('Email action link verification failed:', error);
                this.passwordResetFlow.valid = false;
                this.passwordResetFlow.error = 'This link is invalid or has expired. Please request a new one.';
            } finally {
                this.passwordResetFlow.verifying = false;
            }
        },
        async submitPasswordReset() {
            const flow = this.passwordResetFlow;
            flow.error = '';
            if (flow.mode === 'resetPassword' && !flow.otpVerified) { flow.error = 'Verify the 6-digit code sent to your email before setting a new password.'; return; }
            if (flow.mode === 'firstLogin' && !flow.temporaryPassword) { flow.error = 'Enter the password used for this sign-in to continue.'; return; }
            if (flow.newPassword.length < 8) { flow.error = 'New password must be at least 8 characters long.'; return; }
            if (flow.newPassword !== flow.confirmPassword) { flow.error = 'Passwords do not match.'; return; }
            flow.loading = true;
            try {
                if (flow.mode === 'firstLogin') {
                    const context = this.pendingLoginContext;
                    if (!context?.firebaseUser?.email) throw new Error('Your temporary sign-in session has expired. Please sign in again.');
                    const credential = EmailAuthProvider.credential(context.firebaseUser.email, flow.temporaryPassword);
                    await reauthenticateWithCredential(context.firebaseUser, credential);
                    await updatePassword(context.firebaseUser, flow.newPassword);
                    // updatePassword() bumps validSince, so every token issued
                    // before this instant is now rejected. Mint a new one before
                    // the write below and before completeLogin() opens listeners,
                    // or this first sign-in ends in a false "access removed".
                    await context.firebaseUser.getIdToken(true).catch(() => {});
                    await setDoc(doc(db, 'users', context.firebaseUser.uid), {
                        mustChangePassword: false,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                    context.userData = { ...(context.userData || {}), mustChangePassword: false };
                    context.mustChangePassword = false;
                    flow.email = context.firebaseUser.email;
                    flow.displayName = context.name || flow.displayName;
                    flow.companyName = this.company?.name || flow.companyName || 'Zenqor Technologies';
                    flow.newPassword = '';
                    flow.confirmPassword = '';
                    flow.temporaryPassword = '';
                    this.passwordResetFlow = createEmailActionFlow();
                    this.pendingLoginContext = null;
                    window.history.replaceState({}, '', '/');
                    await this.completeLogin(context);
                } else if (flow.source === 'firebase') {
                    await confirmPasswordReset(auth, this.passwordResetFlow.oobCode, flow.newPassword);
                    flow.success = true;
                    flow.successTitle = 'Password updated';
                    flow.successDescription = 'Your password has been updated. Please sign in with your new password.';
                } else {
                    const response = await fetch('/api/confirm-password-reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: flow.oobCode, newPassword: flow.newPassword })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Unable to reset your password.');
                    flow.success = true;
                    flow.successTitle = 'Password updated';
                    flow.successDescription = 'Your password has been updated. Please sign in with your new password.';
                }
                flow.newPassword = '';
                flow.confirmPassword = '';
                flow.temporaryPassword = '';
            } catch (error) {
                console.error('Password reset confirmation failed:', error);
                flow.error = error?.code === 'auth/weak-password'
                    ? 'Please choose a stronger password with at least 8 characters.'
                    : (error.message || 'Unable to reset your password. Please try again.');
            } finally {
                flow.loading = false;
            }
        },
        async completeFirebaseEmailAction() {
            this.passwordResetFlow.error = '';
            this.passwordResetFlow.loading = true;
            try {
                await applyActionCode(auth, this.passwordResetFlow.oobCode);
                this.passwordResetFlow.success = true;
                this.passwordResetFlow.successTitle = this.passwordResetFlow.mode === 'recoverEmail'
                    ? 'Email address restored'
                    : 'Email address verified';
                this.passwordResetFlow.successDescription = this.passwordResetFlow.mode === 'recoverEmail'
                    ? 'Your account email address has been restored. You can now sign in securely.'
                    : 'Your email address is now verified. Thank you for confirming your account.';
            } catch (error) {
                console.error('Firebase email action confirmation failed:', error);
                this.passwordResetFlow.error = 'This link is invalid or has expired. Please request a new one.';
            } finally {
                this.passwordResetFlow.loading = false;
            }
        },
        exitPasswordResetFlow() {
            const firstTimeAccess = this.passwordResetFlow.mode === 'firstLogin';
            this.passwordResetFlow = createEmailActionFlow();
            this.pendingLoginContext = null;
            window.history.replaceState({}, '', '/');
            // A first-time user is already authenticated with a temporary
            // credential. Leaving this screen must not leave that session
            // active without completing the required password step.
            if (firstTimeAccess) signOut(auth).catch(error => console.warn('Unable to close temporary session:', error));
        },
        accountDisplayName(email) {
            const localPart = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
            return localPart ? localPart.replace(/\b\w/g, char => char.toUpperCase()) : 'Zenqor Portal User';
        },
        openFirstTimePasswordFlow(loginContext) {
            this.pendingLoginContext = loginContext;
            this.passwordResetFlow = createEmailActionFlow({
                active: true,
                source: 'first-login',
                mode: 'firstLogin',
                email: loginContext.firebaseUser.email,
                displayName: loginContext.name || this.accountDisplayName(loginContext.firebaseUser.email),
                companyName: this.company?.name || 'Zenqor Technologies',
                verifying: false,
                valid: true
            });
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.history.replaceState({}, '', '/auth/action');
        },
        async startPasswordResetOtp() {
            const flow = this.passwordResetFlow;
            if (!flow?.valid || flow.mode !== 'resetPassword' || !flow.email || !flow.oobCode) {
                flow.error = 'This reset link is no longer valid. Please request a new one.';
                return;
            }
            // Guards against a duplicate auto-trigger — e.g. a corporate email
            // scanner (Safe Links) opening the reset link once before the user's
            // real click — which would otherwise fire two OTP requests back to
            // back and surface a confusing 429 on the second one.
            if (this.loginOtp.sending || this.loginOtp.cooldownSeconds > 0) return;
            flow.error = '';
            // `sending` must start false: requestLoginOtp() owns that flag and
            // bails out early when it is already set. Priming it to true here
            // would trip that in-flight guard and the request would never leave
            // the browser, leaving the button stuck on "Sending…" forever.
            this.loginOtp = { show: true, code: '', error: '', sending: false, verifying: false, email: flow.email, purpose: 'password-reset', cooldownSeconds: 0 };
            await this.$nextTick();
            await this.requestLoginOtp();
        },
        startLoginOtpCooldown(seconds) {
            clearInterval(this.loginOtpCooldownTimer);
            this.loginOtp.cooldownSeconds = seconds;
            this.loginOtpCooldownTimer = setInterval(() => {
                if (this.loginOtp.cooldownSeconds <= 1) {
                    clearInterval(this.loginOtpCooldownTimer);
                    this.loginOtp.cooldownSeconds = 0;
                } else {
                    this.loginOtp.cooldownSeconds -= 1;
                }
            }, 1000);
        },

        async handleLogin() {
            this.loginError = '';
            // A new sign-in is a new session. Do not let a previous successful
            // logout mask a real access error during this attempt.
            this.intentionalLogoutInProgress = false;
            // Never reveal a previous workspace frame while a new sign-in is
            // being validated. The navigation reopens only after the session
            // is fully ready.
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            if (this.authView === 'staff' && !this.isStaffEmail(this.loginForm.email)) {
                this.loginError = `Staff and Management sign-in requires ${this.approvedStaffDomainsLabel()}.`;
                return;
            }
            this.loginLoading = true;
            this.interactiveLoginInProgress = true;
            try {
                const userCredential = await signInWithEmailAndPassword(auth, this.loginForm.email, this.loginForm.password);
                const firebaseUser = userCredential.user;
                const userData = await this.loadOrMigrateUserMetadata(firebaseUser);
                const isSeedAdmin = this.isSeedAdminEmail(firebaseUser.email);

                if (!userData && !isSeedAdmin) {
                    await signOut(auth);
                    this.loginError = 'This account is not provisioned or your access has been revoked. Contact your administrator.';
                    this.loginLoading = false;
                    return;
                }

                const lockedMessage = this.accountLockedSignInMessage(userData, firebaseUser.email);
                if (lockedMessage) {
                    await signOut(auth);
                    this.loginError = lockedMessage;
                    this.loginLoading = false;
                    return;
                }

                let role = userData?.role || 'Staff';
                let name = userData?.name || firebaseUser.displayName || firebaseUser.email;
                let photo = userData?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B1E36&color=D4AF37`;

                const mustChangePassword = userData?.mustChangePassword === true;
                if (isSeedAdmin) role = 'Superadmin';
                if (!this.isPortalEmailAllowed(firebaseUser.email, role)) {
                    await signOut(auth);
                    this.loginError = this.portalEmailRejectionMessage(role);
                    this.loginLoading = false;
                    return;
                }
                if (this.authView === 'client' && role !== 'Client') {
                    await signOut(auth);
                    this.loginError = 'This is a staff account. Please use "Company Staff" sign in instead.';
                    this.loginLoading = false;
                    return;
                }
                if (this.authView === 'staff' && role === 'Client') {
                    await signOut(auth);
                    this.loginError = 'This is a client account. Please use "Client Portal" sign in instead.';
                    this.loginLoading = false;
                    return;
                }

                const loginContext = { firebaseUser, userData, role, name, photo, mustChangePassword };
                if (mustChangePassword) {
                    this.loginLoading = false;
                    this.openFirstTimePasswordFlow(loginContext);
                    return;
                }

                await this.completeLogin(loginContext);
            } catch (error) {
                console.error('Sign-in failed:', error);
                // The credentials were accepted the moment signInWithEmailAndPassword
                // resolved, so a later Firestore failure is a connection problem, not a
                // bad password. Saying "invalid credentials" there sends the user off
                // retyping a password that was never wrong.
                const errorCode = String(error?.code || '');
                const isCredentialFailure = errorCode.startsWith('auth/');
                // A Staff Portal lock disables the Authentication account, so
                // sign-in now fails here rather than at the Firestore check
                // below it. Reporting that as a wrong password would send the
                // person off resetting a password that was never the problem.
                if (errorCode === 'auth/user-disabled') {
                    this.loginError = 'Your portal access is locked. Please contact your administrator.';
                } else {
                    this.loginError = isCredentialFailure
                        ? 'Invalid email or password credentials / System Error.'
                        : 'We could not reach the portal to finish signing you in. Please check your connection and try again.';
                }
                this.loginLoading = false;
            } finally {
                this.interactiveLoginInProgress = false;
            }
        },
        async requestLoginOtp() {
            // Re-entrancy guard: ignore a resend click (or a second automatic
            // trigger) fired while a request is already in flight or while the
            // server-side cooldown is still active — both would otherwise just
            // bounce off the 429 below.
            if (this.loginOtp.sending || this.loginOtp.cooldownSeconds > 0) return;
            this.loginOtp.sending = true;
            this.loginOtp.error = '';
            try {
                const flow = this.passwordResetFlow;
                if (this.loginOtp.purpose !== 'password-reset' || !flow?.valid || !flow.oobCode) {
                    throw new Error('Your password reset session has expired. Please request a new reset link.');
                }
                const resp = await Promise.race([
                    fetch('/api/request-login-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ purpose: 'password-reset', resetSource: flow.source, resetToken: flow.oobCode })
                    }),
                    this.timeoutPromise(15000, 'Sending the verification code is taking too long. Please try again.')
                ]);
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(data.error || 'Failed to send verification code.');
                this.startLoginOtpCooldown(60);
            } catch (error) {
                console.error('Request login OTP failed:', error);
                this.loginOtp.error = error.message || 'Unable to send verification code. Try again.';
                // The server already rejected this as a duplicate — start the same
                // cooldown locally so the button reflects the wait instead of
                // looking clickable again and inviting another 429.
                if (error.message && /wait before requesting/i.test(error.message)) this.startLoginOtpCooldown(60);
            } finally {
                this.loginOtp.sending = false;
            }
        },
        // Rejects after `ms` milliseconds so an await'd call that would otherwise hang
        // forever (a stalled fetch, an offline Firestore read waiting for reconnect) is
        // instead bounded — callers race this against the real work via Promise.race.
        timeoutPromise(ms, message) {
            return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
        },
        async verifyLoginOtp() {
            if (!this.loginOtp.code || this.loginOtp.code.trim().length !== 6) { this.loginOtp.error = 'Enter the 6-digit code from your email.'; return; }
            this.loginOtp.verifying = true;
            this.loginOtp.error = '';
            try {
                const flow = this.passwordResetFlow;
                if (this.loginOtp.purpose !== 'password-reset' || !flow?.valid || !flow.oobCode) {
                    throw new Error('Your password reset session has expired. Please request a new reset link.');
                }
                const resp = await fetch('/api/verify-login-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: this.loginOtp.code.trim(), purpose: 'password-reset', resetSource: flow.source, resetToken: flow.oobCode })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.valid) throw new Error(data.error || 'Invalid or expired code.');
                flow.otpVerified = true;
                flow.error = '';
                clearInterval(this.loginOtpCooldownTimer);
                this.loginOtp = { show: false, code: '', error: '', sending: false, verifying: false, email: '', purpose: '', cooldownSeconds: 0 };
            } catch (error) {
                console.error('Verify login OTP failed:', error);
                this.loginOtp.error = error.message || 'Verification failed.';
                this.loginOtp.verifying = false;
            }
        },
        async cancelLoginOtp() {
            clearInterval(this.loginOtpCooldownTimer);
            this.loginOtp = { show: false, code: '', error: '', sending: false, verifying: false, email: '', purpose: '', cooldownSeconds: 0 };
            if (this.passwordResetFlow?.active && this.passwordResetFlow.mode === 'resetPassword') {
                this.passwordResetFlow.error = 'Verification is required before you can set a new password.';
            }
        },
        async completeLogin({ firebaseUser, userData, role, name, photo, mustChangePassword }) {
            if (mustChangePassword) {
                this.isLoggedIn = false;
                this.mobileMenuOpen = false;
                this.desktopSidebarOpen = false;
                this.openFirstTimePasswordFlow({ firebaseUser, userData, role, name, photo, mustChangePassword });
                this.loginLoading = false;
                return;
            }
            this.userProfile = { name: name, email: firebaseUser.email, role: role, uid: firebaseUser.uid, photo: photo, mustChangePassword, themePreference: userData?.themePreference || 'light' };
            this.applyDarkModePreference();
            this.notificationsLog = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : [];
            this.startIdleTimeoutWatch();
            await this.syncUserClaims();

            this.resetAllForms(); this.isLoggedIn = true; this.desktopSidebarOpen = false; this.mobileMenuOpen = false;
            await this.logAudit('LOGIN', `User logged in with role ${this.getRoleDisplayName(role)}`);
            this.showNotify(`Welcome back (${this.getRoleDisplayName(role)}): ${name}`);
            this.currentTab = role === 'Client' ? 'client-portal' : 'dashboard';
            window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
            this.playWelcomeGreeting();
            this.loginLoading = false;
            this.initFirebaseRealtime().catch(error => {
                console.error('Realtime data initialization failed after login:', error);
                this.portalDataReady = false;
            });
            this.startPresenceTracking().catch(error => console.error('Presence tracking failed after login:', error));
            this.refreshDashboardCharts();
        },

        async handleLogout() {
            this.logoutConfirm = false;
            // Mark this before signOut() so onAuthStateChanged's signed-out
            // branch knows this is user/idle initiated, not an access revocation.
            this.intentionalLogoutInProgress = true;
            this.loginError = '';
            try { await this.logAudit('LOGOUT', 'User logged out'); } catch (error) { console.error('Audit log failed during logout:', error); }
            try { await this.setCurrentPresence(false); } catch (error) { console.error('Presence update failed during logout:', error); }
            this.stopPresenceTracking();
            try {
                await signOut(auth);
            } catch (error) {
                // Firebase did not confirm the logout, so a later auth event
                // must not be mistaken for this user-initiated attempt.
                this.intentionalLogoutInProgress = false;
                console.error('Firebase sign-out failed:', error);
                this.showNotify('Sign-out ran into an issue, but your local session has been cleared. Close this tab if you are on a shared device.');
            } finally {
                this.destroyDashboardCharts();
                this.isLoggedIn = false; this.loginLoading = false; this.mobileMenuOpen = false; this.desktopSidebarOpen = false; this.portalDataReady = false; this.portalDataReadyPromise = null; this.userProfile = { name: '', email: '', role: '', photo: '' };
                this.resetAllForms(); this.currentTab = 'dashboard'; this.loginForm = { email: '', password: '' }; this.searchQuery = ''; this.authView = 'landing';
                this.postLogoutChoice = true;
            }
        },
        stayOnPortal() {
            this.postLogoutChoice = false;
        },
        goToMainSite() {
            this.postLogoutChoice = false;
            window.location.href = 'https://www.zenqor.com.my';
        },

        async handleChangePassword() {
            this.changePasswordModal.error = '';
            const { currentPassword, newPassword, confirmPassword } = this.changePasswordModal;
            if (newPassword !== confirmPassword) { this.changePasswordModal.error = 'New passwords do not match.'; return; }
            if (newPassword.length < 8) { this.changePasswordModal.error = 'New password must be at least 8 characters long.'; return; }
            this.changePasswordModal.loading = true;
            try {
                const user = auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);
                // Same validSince bump as the first-login flow: refresh before the
                // write, so the open listeners keep a token the rules accept.
                await user.getIdToken(true).catch(() => {});
                await setDoc(doc(db, "users", user.uid), { mustChangePassword: false }, { merge: true });
                this.userProfile.mustChangePassword = false;
                this.changePasswordModal.show = false; this.changePasswordModal.required = false; this.changePasswordModal.currentPassword = ''; this.changePasswordModal.newPassword = ''; this.changePasswordModal.confirmPassword = '';
                this.logAudit('UPDATE', 'User changed their password'); this.showNotify('Password updated successfully!');
            } catch (error) { this.changePasswordModal.error = 'Current password is incorrect or System error.'; } finally { this.changePasswordModal.loading = false; }
        },

        async saveMyProfile() {
            try {
                if (!this.userProfile.email) return;
                this.userProfile.name = this.toOfficialUppercase(this.userProfile.name);
                const userRef = doc(db, "users", this.userProfile.uid);
                await setDoc(userRef, { name: this.userProfile.name, email: this.userProfile.email, photo: this.userProfile.photo }, { merge: true });
                this.logAudit('UPDATE', `User updated own profile: ${this.userProfile.email}`); this.showNotify('Your profile has been updated successfully!');
            } catch (error) { this.showNotify('Error updating profile.'); }
        },
        async handleProfilePhotoUpload(event) {
            const file = event.target.files && event.target.files[0];
            this.profilePhotoUpload.error = '';
            if (!file) return;
            if (!this.userProfile.uid) { this.profilePhotoUpload.error = 'Please sign in again before uploading a photo.'; return; }
            this.profilePhotoUpload.loading = true;
            try {
                const photoUrl = await this.prepareImageAttachment(file, 120 * 1024, 720);
                await setDoc(doc(db, 'users', this.userProfile.uid), { photo: photoUrl }, { merge: true });
                this.userProfile.photo = photoUrl;
                await this.syncCurrentOwnerPhoto();
                this.logAudit('UPDATE', 'Uploaded profile photo');
                this.showNotify('Profile photo uploaded and saved successfully.');
            } catch (error) {
                console.error('Profile photo upload failed:', error);
                this.profilePhotoUpload.error = this.getUploadErrorMessage(error);
            } finally {
                this.profilePhotoUpload.loading = false;
                event.target.value = '';
            }
        },

        openUserAccessModal(usr = null) {
            if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
            if (usr) { this.userModal.isEdit = true; this.userModal.form = { uid: usr.uid || usr.id || '', name: usr.name || '', email: usr.email || '', password: '', role: usr.role || 'Staff' }; }
            else { this.userModal.isEdit = false; this.userModal.form = { uid: '', name: '', email: '', password: this.generateRandomPassword(8), role: 'Staff' }; }
            this.userModal.show = true;
        },

        // One-click provisioning for a Client Portal Access account, called from the
        // New/Update Project modal for one of awaitingProjectClientEmails — an email
        // already saved on the client's Bill To record (Client Information form) that
        // has no login account yet. It opens the same Client access form using
        // exactly the email registered by staff in Client Information.
        openClientPortalAccessForEmail(email) {
            if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
            const customer = this.customers.find(item => item.id === this.projectModal.form.clientDirectoryId);
            this.userModal.isEdit = false;
            this.userModal.form = {
                uid: '',
                name: customer?.clientContactPerson || customer?.clientName || '',
                email: String(email || '').trim().toLowerCase(),
                password: this.generateRandomPassword(8),
                role: 'Client',
            };
            this.userModal.show = true;
        },

        isLikelyFirebaseUid(value) {
            return typeof value === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(value);
        },
        // Syncs Firebase Auth custom claims (role, clientDirectoryId for Client role)
        // from the Firestore users/{uid} record via the serverless endpoint, then
        // forces a fresh ID token so Storage Rules see the up-to-date claims in THIS
        // session immediately (custom claims don't appear in an already-issued token
        // until it's refreshed). Called after every login, and after an admin changes
        // someone's role. Failures are non-fatal — the rest of the app still works,
        // only client_documents upload/download would be affected.
        // Fire-and-forget branded email notification for a workflow event (claim
        // submitted/decided, document shared, project stage changed, client
        // message). Never awaited by callers in a way that blocks the underlying
        // action — a failed notification should never stop the real work from
        // completing, so all errors are swallowed here.
        notifyByEmail({ to, subject, heading, message, ctaLabel, ctaUrl }) {
            const recipients = (Array.isArray(to) ? to : [to]).filter(e => typeof e === 'string' && e.includes('@'));
            if (!recipients.length || !auth.currentUser) return;
            auth.currentUser.getIdToken().then(idToken => fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ to: recipients, subject, heading, message, ctaLabel, ctaUrl: ctaUrl || PORTAL_URL })
            })).catch(error => console.warn('Notification email failed (non-fatal):', error));
        },
        emailsForRole(role) {
            return this.users.filter(u => u.role === role).map(u => u.email).filter(Boolean);
        },
        async syncUserClaims(targetUid = null) {
            try {
                if (!auth.currentUser) return;
                const idToken = await auth.currentUser.getIdToken();
                const resp = await fetch('/api/sync-user-claims', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify(targetUid ? { uid: targetUid } : {})
                });
                if (!resp.ok) { console.warn('Claims sync failed:', await resp.text()); return; }
                const data = await resp.json().catch(() => ({}));
                if (!targetUid || targetUid === auth.currentUser.uid) {
                    await auth.currentUser.getIdToken(true);
                    // The API resolves this server-side from the authorized customer
                    // record. Retaining it locally lets a Client subscribe only to
                    // their own customer document, never the entire directory.
                    this.userProfile.clientDirectoryId = data?.claims?.clientDirectoryId || '';
                }
            } catch (error) {
                console.warn('Claims sync error:', error);
            }
        },
        async loadOrMigrateUserMetadata(firebaseUser) {
            if (!firebaseUser?.uid || !firebaseUser?.email) return null;
            const normalizedEmail = firebaseUser.email.trim().toLowerCase();
            // The protected bootstrap administrator is a valid Superadmin even
            // before its Firestore profile has been restored. The server then
            // recreates that profile during syncUserClaims(), avoiding a failed
            // session restore caused by a missing users/{uid} document.
            if (this.isSeedAdminEmail(normalizedEmail)) {
                return {
                    email: normalizedEmail,
                    name: firebaseUser.displayName || 'System Administrator',
                    photo: '',
                    role: 'Superadmin',
                    mustChangePassword: false
                };
            }
            const userRef = doc(db, 'users', firebaseUser.uid);
            // Both callers read a null return as "not provisioned or revoked" and
            // sign the account out saying so. getDoc() falls back to the local
            // cache when Firestore's transport is down, and a document that was
            // never cached comes back as a missing one rather than an error — so
            // a stalled connection would accuse a perfectly valid account of
            // having had its access removed. Confirm against the server: a real
            // outage now throws, and the callers report it as a session that
            // could not be restored.
            const userSnapshot = await getDocFromServer(userRef);
            if (userSnapshot.exists()) return userSnapshot.data();

            const pendingRef = doc(db, 'pending_access', normalizedEmail);
            const pendingSnapshot = await getDoc(pendingRef);
            if (!pendingSnapshot.exists()) return null;

            const pendingData = pendingSnapshot.data();
            const pendingRole = pendingData.role || 'Client';
            const migratedData = {
                email: normalizedEmail,
                name: pendingData.name || firebaseUser.displayName || normalizedEmail,
                photo: pendingData.photo || '',
                role: pendingRole,
                mustChangePassword: pendingData.mustChangePassword === true,
                migratedAt: new Date().toISOString()
            };
            await setDoc(userRef, migratedData);
            await deleteDoc(pendingRef);
            return migratedData;
        },

        sendWelcomeEmail(userForm) {
            const originEmail = SUPPORT_EMAIL;
            const subject = encodeURIComponent(`[ZENQOR ENTERPRISE] Official Account & Portal Access Information (${this.getRoleDisplayName(userForm.role)})`);
                const emailBody = encodeURIComponent(`Greetings ${userForm.name},\n\nYour user account for the ZENQOR TECHNOLOGIES Enterprise Portal v2.0 has been created.\n\nSign-In Email: ${userForm.email}\nTemporary Password: ${userForm.password}\nAssigned Role: ${this.getRoleDisplayName(userForm.role)}\nPortal Link: ${PORTAL_URL}\n\nYou will be required to change this temporary password immediately after your first sign-in.\n\nBest regards,\nSystem Administrator`);
            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(userForm.email)}&su=${subject}&body=${emailBody}`, '_blank');
            this.showNotify(`Google Gmail compose window opened.`);
        },

        async savePortalUser() {
            try {
                if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
                if (!this.userModal.form.name || !this.userModal.form.email || (this.userModal.isEdit === false && !this.userModal.form.password)) { this.showNotify("Please fill out all required fields."); return; }
                // Both directions, checked before the account exists rather than
                // discovered at the first sign-in attempt.
                if (!this.isPortalEmailAllowed(this.userModal.form.email, this.userModal.form.role)) {
                    this.showNotify(this.portalEmailRejectionMessage(this.userModal.form.role));
                    return;
                }

                this.userModal.form.name = this.toOfficialUppercase(this.userModal.form.name);
                const isNewUser = !this.userModal.isEdit;
                const email = this.userModal.form.email.trim().toLowerCase(); const password = this.userModal.form.password.trim();
                this.userModal.form.email = email;
                const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userModal.form.name)}&background=0B1E36&color=D4AF37`;
                const existingRecord = this.users.find(user => (user.email || '').toLowerCase() === email);
                // "Add New" (isNewUser) means the admin intends to create a DISTINCT
                // account. If existingRecord is already found, that email is not free —
                // it already resolves to a real users/{uid} doc (existingRecord.id is a
                // genuine Firebase UID). Without this guard, the code below would still
                // treat existingRecord's id as "the" userId (see possibleUid) and, once
                // createUserWithEmailAndPassword predictably fails with
                // auth/email-already-in-use, fall straight into `setDoc(doc(db, "users",
                // userId), { role: this.userModal.form.role, name: ..., ... })` —
                // silently overwriting that OTHER, real account's role/name/photo with
                // whatever was just typed for this "new" one (and flipping the caller's
                // own session role live if they happened to reuse their own email). Block
                // it here instead: this is almost always a Director/Superadmin trying to
                // grant Client Portal access using a @zenq0r.com email that already
                // belongs to an existing staff account under a different role.
                if (isNewUser && existingRecord) {
                    this.showNotify(`Unable to create a new account: ${email} already belongs to an existing ${existingRecord.role || 'portal'} account (${existingRecord.name || email}). Edit that existing record instead of adding a new one, or use a different email.`);
                    return;
                }
                const possibleUid = this.userModal.form.uid || existingRecord?.uid || existingRecord?.id || '';
                let userId = this.isLikelyFirebaseUid(possibleUid) ? possibleUid : '';
                let existingAuthenticationAccount = false;

                if (isNewUser) {
                    const secondaryApp = initializeApp(auth.app.options, "SecondaryAuthApp-" + Date.now());
                    const secondaryAuth = getAuth(secondaryApp);
                    try {
                        const createdUser = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                        userId = createdUser.user.uid;
                    } catch (authErr) {
                        if (authErr.code === 'auth/email-already-in-use') existingAuthenticationAccount = true;
                        else { this.showNotify("Gagal mendaftar ke Firebase: " + authErr.message); return; }
                    } finally {
                        await signOut(secondaryAuth).catch(() => {});
                        await deleteApp(secondaryApp).catch(() => {});
                    }
                }

                if (!userId) {
                    await setDoc(doc(db, 'pending_access', email), {
                        email,
                        name: this.userModal.form.name,
                        photo: photoUrl,
                        role: this.userModal.form.role,
                        mustChangePassword: false,
                        createdByUid: this.userProfile.uid,
                        createdAt: new Date().toISOString()
                    }, { merge: true });
                    this.userModal.show = false;
                    this.logAudit('CREATE', `Pending UID migration created for ${email}`);
                    // If a users/{uid} doc already exists for this email (existingRecord,
                    // computed above), this pending_access entry will NEVER be consumed:
                    // loadOrMigrateUserMetadata() returns that existing doc immediately on
                    // every future login and never reaches the pending_access migration
                    // path. That's the normal case here — this branch runs precisely
                    // because Firebase Auth already has an account for this email
                    // (auth/email-already-in-use), and almost always that's an existing
                    // staff account (role !== 'Client') on the @zenq0r.com domain. Telling
                    // the admin "access will activate automatically" would be false in
                    // that case, so say so plainly instead of leaving them to discover it
                    // only when a Project's Client Portal Access link stays unresolved.
                    if (existingRecord) {
                        this.showNotify(`Unable to grant Client Portal access: ${email} already belongs to an active ${existingRecord.role || 'staff'} account. One email can only be one portal account — use a different email for this Client.`);
                    } else {
                        this.showNotify(existingAuthenticationAccount ? 'Existing Firebase account found. Access will activate automatically at the next login.' : 'Portal access is pending UID activation.');
                    }
                    return;
                }
                await setDoc(doc(db, "users", userId), { email: email, name: this.userModal.form.name, photo: photoUrl, role: this.userModal.form.role, ...(isNewUser ? { mustChangePassword: true } : {}) }, { merge: true });
                if (userId === this.userProfile.uid) {
                    this.userProfile.role = this.userModal.form.role;
                    this.userProfile.name = this.userModal.form.name;
                    this.userProfile.photo = photoUrl;
                }
                this.userModal.show = false;
                this.logAudit(isNewUser ? 'CREATE' : 'UPDATE', `User role/metadata for ${email}`);
                this.syncUserClaims(userId).catch(() => {});
                if (isNewUser) { this.sendWelcomeEmail(this.userModal.form); this.showNotify('Akaun berjaya dicipta!'); }
                else this.showNotify('User updated successfully!');
            } catch (error) {
                console.error('Portal access save failed:', error);
                this.showNotify("Unable to save portal access. Please ensure the latest Firestore Rules have been published.");
            }
        },

        async deletePortalUser(uid, email) {
            if (!await this.askConfirm({
                title: 'Delete portal access?',
                message: `This permanently removes portal access and the Firebase Authentication account for ${email}.`,
                confirmLabel: 'Yes, Delete Access',
                danger: true
            })) return;
            try {
                // Delete the Firebase Authentication account FIRST (via Admin SDK — the
                // client SDK can only ever delete the currently signed-in user's own
                // account) so access is revoked even if the Firestore cleanup below
                // fails for some reason; a retry then just cleans up the leftover
                // Firestore doc (the endpoint treats an already-deleted Auth account as
                // success, not an error). Without this step, the Auth account
                // (Identifier/Providers/Created/Signed In/User UID in the Firebase
                // Console) would otherwise linger indefinitely after "deleting" someone
                // here, since deleteDoc alone only ever removed the Firestore record.
                if (auth.currentUser) {
                    const idToken = await auth.currentUser.getIdToken();
                    const resp = await fetch('/api/portal-account', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                        body: JSON.stringify({ action: 'delete', uid })
                    });
                    if (!resp.ok) {
                        const errBody = await resp.json().catch(() => ({}));
                        throw new Error(errBody.error || 'Unable to delete the Firebase Authentication account.');
                    }
                }
                await deleteDoc(doc(db, "users", uid));
                this.logAudit('DELETE', `Deleted user metadata for ${email}`);
                this.showNotify('User record and Firebase Authentication account deleted.');
            } catch (error) {
                console.error('Portal user deletion failed:', error);
                // Stated rather than inferred: the server's wording varies with
                // the cause, and two of its messages read as neutral prose.
                this.showNotify(error?.message || 'Unable to delete portal access.', 'error');
            }
        },

        // ============================================================
        // STAFF PORTAL - interaction buttons on a portal account
        // View / Read / Access are read-only and open the same drawer on a
        // different tab. Edit / Lock / Reset / Delete write, and every one of
        // them re-checks canManageStaffPortal here rather than trusting that
        // the button was hidden - the right-click menu, a stale render and the
        // console all reach these methods too. firestore.rules checks again.
        // ============================================================
        isAccountLocked(user) {
            return user?.accessLocked === true;
        },
        staffPortalStatusBadge(usr) {
            if (this.isAccountLocked(usr)) return { label: 'Locked', className: 'zq-badge-error', icon: 'fa-lock' };
            if (usr?.mustChangePassword === true) return { label: 'Password Reset Pending', className: 'zq-badge-warning', icon: 'fa-key' };
            if (this.isPortalUserOnline(usr)) return { label: 'Active - Online', className: 'zq-badge-success', icon: 'fa-circle' };
            return { label: 'Active', className: 'zq-badge-neutral', icon: 'fa-circle-check' };
        },
        // The seed administrator is the non-deletable bootstrap account: locking,
        // resetting or deleting it is how an organisation locks itself out of its
        // own portal, so none of the writing actions are offered on it. Lock and
        // Delete are additionally withheld on the viewer's own row, for the same
        // reason at the individual level.
        isStaffPortalActionAvailable(actionKey, usr) {
            const action = STAFF_PORTAL_ACTIONS.find(item => item.key === actionKey);
            if (!action) return false;
            if (!action.write) return this.canObserveStaffPortal;
            if (!this.canManageStaffPortal) return false;
            if (this.isSeedAdminEmail(usr?.email)) return false;
            if (['lock', 'delete'].includes(actionKey) && usr?.id === this.userProfile.uid) return false;
            return true;
        },
        // The row's buttons, in the fixed order of STAFF_PORTAL_ACTIONS, already
        // filtered to what this viewer may press on this account. Lock is the one
        // entry whose label depends on the row: it reads Unlock once locked.
        staffPortalActionsFor(usr) {
            return STAFF_PORTAL_ACTIONS
                .filter(action => this.isStaffPortalActionAvailable(action.key, usr))
                .map(action => {
                    if (action.key !== 'lock' || !this.isAccountLocked(usr)) return { ...action };
                    return { ...action, label: 'Unlock', icon: 'fa-lock-open', variant: 'zq-btn-success', title: 'Restore portal access for this account' };
                });
        },
        runStaffPortalAction(actionKey, usr) {
            if (!this.isStaffPortalActionAvailable(actionKey, usr)) { this.showNotify('You do not have permission for that Staff Portal action.'); return; }
            const handlers = {
                view: () => this.openStaffPortalAccount(usr, 'overview'),
                read: () => this.openStaffPortalAccount(usr, 'activity'),
                access: () => this.openStaffPortalAccount(usr, 'access'),
                edit: () => this.openUserAccessModal(usr),
                lock: () => this.toggleStaffPortalLock(usr),
                reset: () => this.requireStaffPortalPasswordChange(usr),
                delete: () => this.deletePortalUser(usr.id, usr.email)
            };
            (handlers[actionKey] || (() => {}))();
        },
        openStaffPortalAccount(usr, tab = 'overview') {
            if (!this.canObserveStaffPortal) { this.showNotify('You do not have permission to open the Staff Portal.'); return; }
            this.staffPortalAccount = { show: true, tab, account: usr ? { ...usr } : null };
        },
        closeStaffPortalAccount() {
            this.staffPortalAccount = { show: false, tab: 'overview', account: null };
        },
        // What the role on this account actually unlocks, one row per module, so
        // the Access tab answers "what can this person reach?" out of RBAC_ROLES
        // and the same rule hasModulePermission() applies, not a second
        // hand-maintained list that would drift away from the real gates.
        staffPortalAccessMatrix(role) {
            const modules = RBAC_ROLES[role] || [];
            const isFullAccess = FULL_ACCESS_ROLES.includes(role);
            return modules.map(moduleName => ({
                module: moduleName,
                label: MODULE_LABELS[moduleName] || moduleName,
                view: true,
                edit: true,
                // Mirrors hasModulePermission(): delete is the full-access pair
                // everywhere, plus IT on the public-website collections.
                remove: isFullAccess || (moduleName === 'website-content' && role === 'IT')
            }));
        },
        // The Read tab: this account's own trail out of the audit log that
        // Superadmin/Director/IT already subscribe to. auditLogs arrives sorted
        // newest-first, and the result is capped so a long-serving account does
        // not render thousands of rows into a drawer. Matched on uid where the
        // entry carries one and on the signed-in email otherwise, so events
        // recorded before a UID migration are not silently dropped.
        staffPortalAccountActivity(account) {
            const uid = String(account?.id || '').trim();
            const email = String(account?.email || '').trim().toLowerCase();
            if (!uid && !email) return [];
            return this.auditLogs
                .filter(log => (uid && log.uid === uid) || (email && String(log.user || '').trim().toLowerCase() === email))
                .slice(0, 100);
        },
        async toggleStaffPortalLock(usr) {
            if (!this.isStaffPortalActionAvailable('lock', usr)) { this.showNotify('Only Superadmin and Director can lock a portal account.'); return; }
            const locking = !this.isAccountLocked(usr);
            const answer = await this.askConfirmWithNote({
                title: locking ? 'Lock this portal account?' : 'Unlock this portal account?',
                message: locking
                    ? `${usr.email} keeps their record and role but cannot sign in, and their open session ends. Unlock restores access at any time.`
                    : `${usr.email} will be able to sign in again immediately.`,
                confirmLabel: locking ? 'Yes, Lock Access' : 'Yes, Unlock Access',
                danger: locking,
                noteLabel: locking ? 'Reason recorded on the account' : '',
                notePlaceholder: locking ? 'e.g. On extended leave, pending investigation' : ''
            });
            if (!answer.confirmed) return;
            this.staffPortalBusyUid = usr.id;
            try {
                // Routed through the Admin SDK rather than written from here. A
                // lock has to reach Storage as well, and storage.rules reads the
                // role from the ID token's custom claims, which only the server
                // can clear — a Firestore write alone would close the portal and
                // leave client_documents open. The endpoint also stamps who
                // locked the account from its verified token, so that field
                // cannot be forged. See api/portal-account.js.
                if (!auth.currentUser) throw new Error('Your session has ended. Sign in again, then retry.');
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/api/portal-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ action: locking ? 'lock' : 'unlock', uid: usr.id, reason: answer.note })
                });
                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || 'Unable to change this account’s portal access.');
                }
                this.logAudit(locking ? 'LOCK' : 'UNLOCK', `${locking ? 'Locked' : 'Unlocked'} portal access for ${usr.email}${locking && answer.note ? ` - ${answer.note}` : ''}`);
                this.showNotify(locking ? 'Portal access locked.' : 'Portal access unlocked.');
                this.notifyByEmail({
                    to: usr.email,
                    subject: `[ZENQOR ENTERPRISE] Portal access ${locking ? 'locked' : 'restored'}`,
                    heading: locking ? 'Portal access locked' : 'Portal access restored',
                    message: locking
                        ? 'Your ZENQOR portal access has been locked by an administrator. Please contact your administrator for details.'
                        : 'Your ZENQOR portal access has been restored. You may sign in again.'
                });
            } catch (error) {
                console.error('Staff Portal lock change failed:', error);
                // Stated rather than inferred: the endpoint's wording varies with
                // the cause, and it is the only thing that knows how far the
                // change got across Firestore, Storage claims and Authentication.
                this.showNotify(error?.message || 'Unable to change this account’s portal access.', 'error');
            } finally {
                this.staffPortalBusyUid = '';
            }
        },
        // "Reset" here is the portal-side half only: it flags the account so the
        // next sign-in is forced through the change-password flow. Nothing in
        // this portal can read or set anybody else's password.
        async requireStaffPortalPasswordChange(usr) {
            if (!this.isStaffPortalActionAvailable('reset', usr)) { this.showNotify('Only Superadmin and Director can require a password reset.'); return; }
            if (usr.mustChangePassword === true) { this.showNotify('This account is already required to change its password at the next sign-in.'); return; }
            if (!await this.askConfirm({
                title: 'Require a new password?',
                message: `${usr.email} will be asked to set a new password the next time they sign in. Their current password keeps working until then.`,
                confirmLabel: 'Yes, Require Reset'
            })) return;
            this.staffPortalBusyUid = usr.id;
            try {
                await setDoc(doc(db, 'users', usr.id), { mustChangePassword: true }, { merge: true });
                this.logAudit('UPDATE', `Required a password change at next sign-in for ${usr.email}`);
                this.showNotify('The account will be asked for a new password at its next sign-in.');
                this.notifyByEmail({
                    to: usr.email,
                    subject: '[ZENQOR ENTERPRISE] Password change required',
                    heading: 'Password change required',
                    message: 'Your administrator has asked you to set a new ZENQOR portal password. You will be prompted for one the next time you sign in.'
                });
            } catch (error) {
                console.error('Password reset requirement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'require a password reset'));
            } finally {
                this.staffPortalBusyUid = '';
            }
        },

        // ============================================================
        // STAFF PORTAL - access requests (Accept / Reject)
        // A staff member asks from their own Profile page for a different role;
        // Superadmin/Director decide it in the Staff Portal. Accepting applies
        // the role to users/{uid} and re-syncs the Auth custom claims, exactly
        // what the Edit form does - so an accepted request and a manual role
        // change leave the account in the same state.
        // ============================================================
        openAccessRequestModal() {
            if (!this.canRequestAccessChange) { this.showNotify('Your account cannot raise a portal access request.'); return; }
            if (this.myPendingAccessRequest) { this.showNotify('You already have a request awaiting a decision.'); return; }
            this.accessRequestModal = { show: true, saving: false, requestedRole: this.requestableRoles[0] || '', reason: '', error: '' };
        },
        async submitAccessRequest() {
            if (!this.canRequestAccessChange) { this.showNotify('Your account cannot raise a portal access request.'); return; }
            if (this.myPendingAccessRequest) { this.accessRequestModal.error = 'You already have a request awaiting a decision.'; return; }
            const requestedRole = this.accessRequestModal.requestedRole;
            const reason = String(this.accessRequestModal.reason || '').trim();
            if (!this.requestableRoles.includes(requestedRole)) { this.accessRequestModal.error = 'Choose a role to request.'; return; }
            if (reason.length < 10) { this.accessRequestModal.error = 'Please give the reviewer at least a short reason (10 characters).'; return; }
            this.accessRequestModal.saving = true;
            this.accessRequestModal.error = '';
            try {
                const requestRef = doc(collection(db, 'access_requests'));
                await setDoc(requestRef, {
                    requesterUid: this.userProfile.uid,
                    requesterEmail: String(this.userProfile.email || '').trim().toLowerCase(),
                    requesterName: this.userProfile.name || '',
                    currentRole: this.userProfile.role,
                    requestedRole,
                    reason,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                });
                this.logAudit('CREATE', `Requested a portal access change to ${requestedRole}`);
                this.accessRequestModal = { show: false, saving: false, requestedRole: '', reason: '', error: '' };
                this.showNotify('Your access request has been sent for a decision.');
                this.notifyByEmail({
                    to: [...this.emailsForRole('Superadmin'), ...this.emailsForRole('Director')],
                    subject: '[ZENQOR ENTERPRISE] New portal access request',
                    heading: 'A portal access request is waiting',
                    message: `${this.userProfile.name || this.userProfile.email} asked to move from ${this.getRoleDisplayName(this.userProfile.role)} to ${this.getRoleDisplayName(requestedRole)}.`,
                    ctaLabel: 'Open the Staff Portal'
                });
            } catch (error) {
                console.error('Access request failed:', error);
                this.accessRequestModal.error = this.getFirestoreWriteError(error, 'send this access request');
            } finally {
                this.accessRequestModal.saving = false;
            }
        },
        accessRequestStatusBadge(request) {
            const status = request?.status || 'Pending';
            if (status === 'Accepted') return { label: 'Accepted', className: 'zq-badge-success', icon: 'fa-circle-check' };
            if (status === 'Rejected') return { label: 'Rejected', className: 'zq-badge-error', icon: 'fa-circle-xmark' };
            return { label: 'Pending', className: 'zq-badge-warning', icon: 'fa-hourglass-half' };
        },
        staffPortalRequestActions() {
            return this.canManageStaffPortal ? STAFF_PORTAL_REQUEST_ACTIONS.map(action => ({ ...action })) : [];
        },
        runAccessRequestAction(actionKey, request) {
            if (actionKey === 'accept') return this.decideAccessRequest(request, 'Accepted');
            if (actionKey === 'reject') return this.decideAccessRequest(request, 'Rejected');
        },
        async decideAccessRequest(request, decision) {
            if (!this.canManageStaffPortal) { this.showNotify('Only Superadmin and Director can decide an access request.'); return; }
            if (!request?.id || (request.status || 'Pending') !== 'Pending') { this.showNotify('This request has already been decided.'); return; }
            const accepting = decision === 'Accepted';
            // Accepting writes the requester's role. Refuse rather than guess if
            // the target account has since left the portal directory.
            const target = this.users.find(user => user.id === request.requesterUid);
            if (accepting && !target) { this.showNotify('The requesting account no longer exists in the portal directory.'); return; }
            if (accepting && !this.isPortalEmailAllowed(request.requesterEmail, request.requestedRole)) {
                this.showNotify(`Staff and Management access requires ${this.approvedStaffDomainsLabel()}.`);
                return;
            }
            const answer = await this.askConfirmWithNote({
                title: accepting ? 'Accept this access request?' : 'Reject this access request?',
                message: accepting
                    ? `${request.requesterEmail} becomes ${this.getRoleDisplayName(request.requestedRole)} immediately, replacing ${this.getRoleDisplayName(request.currentRole)}.`
                    : `${request.requesterEmail} keeps ${this.getRoleDisplayName(request.currentRole)} and is told the request was declined.`,
                confirmLabel: accepting ? 'Yes, Accept Request' : 'Yes, Reject Request',
                danger: !accepting,
                noteLabel: 'Decision note (optional)',
                notePlaceholder: accepting ? 'e.g. Approved for the new finance duties' : 'e.g. Raise this again after the handover'
            });
            if (!answer.confirmed) return;
            this.staffPortalBusyUid = request.id;
            try {
                if (accepting) {
                    await setDoc(doc(db, 'users', request.requesterUid), { role: request.requestedRole }, { merge: true });
                    // The same follow-up the Edit form does: Storage Rules read the
                    // role from the Auth custom claims, which do not move on their own.
                    await this.syncUserClaims(request.requesterUid);
                }
                await setDoc(doc(db, 'access_requests', request.id), {
                    status: decision,
                    decidedBy: String(this.userProfile.email || '').trim().toLowerCase(),
                    decidedAt: new Date().toISOString(),
                    decisionNote: answer.note
                }, { merge: true });
                this.logAudit('UPDATE', `${decision} the portal access request from ${request.requesterEmail} for ${request.requestedRole}`);
                this.showNotify(accepting ? 'Access request accepted and the role applied.' : 'Access request rejected.');
                this.notifyByEmail({
                    to: request.requesterEmail,
                    subject: `[ZENQOR ENTERPRISE] Your access request was ${decision.toLowerCase()}`,
                    heading: accepting ? 'Access request accepted' : 'Access request rejected',
                    message: accepting
                        ? `Your portal role is now ${this.getRoleDisplayName(request.requestedRole)}. Sign out and back in to pick it up.`
                        : `Your request to move to ${this.getRoleDisplayName(request.requestedRole)} was declined.${answer.note ? ` Note: ${answer.note}` : ''}`
                });
            } catch (error) {
                console.error('Access request decision failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, accepting ? 'accept this request' : 'reject this request'));
            } finally {
                this.staffPortalBusyUid = '';
            }
        },

        backupDatabase() {
            if (!this.canBackupDatabase) { this.showNotify('Only Superadmin and Director can export a database backup.'); return; }
            const data = { company: this.company, employees: this.employees, customers: this.customers, docHistory: this.docHistory, payslipHistory: this.payslipHistory, claimsHistory: this.claimsHistory, paymentVouchers: this.paymentVouchers, projects: this.projects, projectActivities: this.projectActivities, projectClientUpdates: this.projectClientUpdates, users: this.users.map(u => ({ name: u.name, email: u.email, role: u.role })), exportDate: new Date().toISOString() };
            const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dlAnchorElem = document.createElement('a'); dlAnchorElem.setAttribute("href", jsonStr); dlAnchorElem.setAttribute("download", `zenqor_backup_${new Date().toISOString().substr(0,10)}.json`); dlAnchorElem.click();
            this.logAudit('BACKUP', 'Exported JSON backup'); this.showNotify("Database JSON backup downloaded!");
        },

        async saveSettings() {
            if (!this.canManageCompanySettings) { this.showNotify('You do not have permission to update company settings.'); return; }
            try { this.company.address = this.formattedCompanyAddress(); this.company = this.normalizeOfficialRecord(this.company); this.company.email = String(this.company.email || '').trim().toLowerCase(); await setDoc(doc(db, "settings", "company_profile"), { ...this.company }, { merge: true }); this.logAudit('UPDATE', 'Updated settings'); this.showNotify('Settings updated!'); } catch (error) { this.showNotify('Unable to save company settings.', 'error'); }
        },

        loadCustomerIntoDocument(cust) {
            if (!cust?.id) return;
            const previousCustomerId = this.docForm.customerId || '';
            const switchedCompany = previousCustomerId !== cust.id;
            const clientFields = ['clientId', 'clientName', 'clientPhone', 'clientSSM', 'clientAddress', 'clientAddress1', 'clientAddress2', 'clientAddress3', 'clientCity', 'clientState', 'clientPostcode', 'clientEmail', 'clientContactPerson', 'clientPosition'];

            // Assign every client field explicitly, including empty values. This
            // prevents an optional field from the previous company leaking into the
            // document for the newly selected company.
            clientFields.forEach(field => { this.docForm[field] = cust[field] || ''; });
            this.docForm.clientAddress1 = cust.clientAddress1 || cust.clientAddress || '';
            this.docForm.clientAddress = cust.clientAddress || this.docForm.clientAddress1;
            this.docForm.clientCountry = cust.clientCountry || 'Malaysia';
            this.docForm.customerId = cust.id;
            this.docForm.additionalClientEmailsText = Array.isArray(cust.additionalClientEmails) ? cust.additionalClientEmails.join(', ') : '';
            // A quotation is tied to the delivery project so its acceptance can
            // create a deterministic handover to that project's assigned PIC.
            if (switchedCompany) {
                this.docForm.projectId = '';
                this.docForm.projectRef = '';
                this.docForm.projectTitle = '';
            }
            this.clientSavedForDocument = true;

            // A saved document must never be overwritten just because the user
            // switches to another company to prepare the next one. Keep the entered
            // line items and payment details, but start a fresh document identity.
            if (switchedCompany && this.editingDocId) {
                this.editingDocId = null;
                this.generateDocNo(true);
                this.showNotify('New client loaded. A new document number was prepared; line items were kept.');
                return;
            }
            this.showNotify('Saved client loaded. You can continue with the current document items.');
        },
        selectCustomerForDoc(e) {
            const cust = this.customers.find(c => c.id === e.target.value);
            if (cust) {
                this.loadCustomerIntoDocument(cust);
            } else {
                this.docForm.customerId = '';
                this.docForm.projectId = '';
                this.docForm.projectRef = '';
                this.docForm.projectTitle = '';
                this.docForm.additionalClientEmailsText = '';
                this.clientSavedForDocument = false;
            }
        },
        selectProjectForDoc(e) {
            const project = this.documentProjectsForSelectedClient.find(item => item.id === e.target.value);
            this.docForm.projectId = project?.id || '';
            this.docForm.projectRef = project?.projectRef || '';
            this.docForm.projectTitle = project?.title || '';
        },
        // Human-readable, non-random client reference — same convention as
        // projectRef/docNo/empNo elsewhere in this app, but derived from the
        // client's own registered BRN instead of a counter: the 6 digits are
        // the LAST 6 DIGITS of clientSSM's leading number (the 12-digit new-
        // format Business Registration Number, e.g. "200901029271 (872376-W)"
        // -> "029271") — the same number the Client Directory column labels
        // "REG NO. / TIN". The letter is a deterministic checksum-style digit
        // sum of those 6 digits (never random). Format: ZCT-<6 digits>-<letter>.
        // Falls back to the same "scan existing IDs, +1" sequence generateDocNo
        // uses only when a client has no parseable BRN on file yet.
        generateClientId(clientSSM) {
            const brnMatch = String(clientSSM || '').match(/\d+/);
            let sixDigits;
            if (brnMatch && brnMatch[0].length >= 6) {
                sixDigits = brnMatch[0].slice(-6);
            } else {
                let maxNum = 0;
                this.customers.forEach(cust => {
                    const match = /^ZCT-(\d{6})-[A-Z]$/.exec(String(cust.clientId || ''));
                    if (match) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
                });
                sixDigits = String(maxNum + 1).padStart(6, '0');
            }
            const digitSum = sixDigits.split('').reduce((sum, d) => sum + Number(d), 0);
            const letter = String.fromCharCode(65 + (digitSum % 26));
            return `ZCT-${sixDigits}-${letter}`;
        },
        emptyClientInformationForm() {
            return {
                id: '', clientId: '', clientName: '', clientSSM: '', companyType: '', industry: '', clientTier: 'Standard',
                clientContactPerson: '', clientPosition: '', clientEmail: '', clientPhone: '', additionalClientEmailsText: '',
                clientAddress1: '', clientAddress2: '', clientAddress3: '', clientCity: '', clientState: '', clientPostcode: '',
                clientCountry: 'Malaysia', clientNotes: '', createdAt: ''
            };
        },
        openClientInformation(cust = null) {
            if (!this.canManageClients) { this.showNotify('You do not have permission to manage client records.'); return; }
            const record = cust || {};
            const additionalClientEmails = Array.isArray(record.additionalClientEmails)
                ? record.additionalClientEmails.join(', ')
                : String(record.additionalClientEmailsText || '');
            this.clientInformationModal.isEdit = Boolean(record.id);
            this.clientInformationModal.form = {
                ...this.emptyClientInformationForm(),
                id: record.id || '', clientId: record.clientId || '', clientName: record.clientName || '', clientSSM: record.clientSSM || '',
                clientBrnNew: record.clientBrnNew || this.splitClientSSM(record.clientSSM).newBrn,
                clientBrnOld: record.clientBrnOld || this.splitClientSSM(record.clientSSM).oldBrn,
                clientTin: record.clientTin || '',
                companyType: record.companyType || '', industry: record.industry || '', clientTier: record.clientTier || 'Standard',
                clientContactPerson: record.clientContactPerson || '', clientPosition: record.clientPosition || '',
                clientEmail: record.clientEmail || '', clientPhone: record.clientPhone || '', additionalClientEmailsText: additionalClientEmails,
                clientAddress1: record.clientAddress1 || record.clientAddress || '', clientAddress2: record.clientAddress2 || '', clientAddress3: record.clientAddress3 || '',
                clientCity: record.clientCity || '', clientState: record.clientState || '', clientPostcode: record.clientPostcode || '',
                clientCountry: record.clientCountry || 'Malaysia', clientNotes: record.clientNotes || '', createdAt: record.createdAt || ''
            };
            // Client Information is a full Document Centre page, not a pop-up.
            // The separate page makes long registration records easier to review.
            this.clientInformationModal.show = false;
            this.switchTab('doc-generator');
        },
        closeClientInformation() {
            if (this.clientInformationModal.saving) return;
            this.clientInformationModal.show = false;
            this.clientInformationModal.isEdit = false;
            this.clientInformationModal.form = this.emptyClientInformationForm();
            this.switchTab('client-directory');
        },
        async saveClientInformation() {
            if (!this.canManageClients) { this.showNotify('You do not have permission to save client records.'); return false; }
            const form = this.clientInformationModal.form;
            if (!form.clientName || !form.clientPhone || !form.clientAddress1) return this.showNotify('Enter Client Name, Phone, and Address Line 1.');
            if (!/^\d{5}$/.test(String(form.clientPostcode || '')) || !form.clientCity || !form.clientState) return this.showNotify('Enter a valid 5-digit postcode, City, and State.');
            this.clientInformationModal.saving = true;
            try {
                const isNewRecord = !form.id;
                const docId = form.id || doc(collection(db, 'customers')).id;
                const existingCust = !isNewRecord ? this.customers.find(c => c.id === docId) : null;
                const additionalClientEmails = String(form.additionalClientEmailsText || '')
                    .split(',').map(email => email.trim().toLowerCase()).filter(email => email && email.includes('@'));
                const composedSSM = this.composeClientSSM(form.clientBrnNew, form.clientBrnOld);
                // Client ID is derived from the BRN, so it must read the composed
                // value rather than the now-unbound clientSSM field.
                const clientId = existingCust?.clientId || form.clientId || this.generateClientId(composedSSM);
                const now = new Date().toISOString();
                const clientTier = ['Standard', 'Premium', 'Priority'].includes(form.clientTier) ? form.clientTier : (existingCust?.clientTier || 'Standard');
                const clientRecord = this.normalizeOfficialRecord({
                    clientId,
                    clientName: String(form.clientName).trim(),
                    clientSSM: this.composeClientSSM(form.clientBrnNew, form.clientBrnOld),
                    clientBrnNew: String(form.clientBrnNew || '').replace(/\s/g, ''),
                    clientBrnOld: String(form.clientBrnOld || '').replace(/\s/g, '').toUpperCase(),
                    clientTin: this.normalizeTin(form.clientTin),
                    companyType: String(form.companyType || '').trim(), industry: String(form.industry || '').trim(), clientTier,
                    clientContactPerson: String(form.clientContactPerson || '').trim(), clientPosition: String(form.clientPosition || '').trim(),
                    clientEmail: String(form.clientEmail || '').trim().toLowerCase(), clientPhone: String(form.clientPhone || '').trim(),
                    additionalClientEmails,
                    clientAddress: String(form.clientAddress1).trim(), clientAddress1: String(form.clientAddress1).trim(),
                    clientAddress2: String(form.clientAddress2 || '').trim(), clientAddress3: String(form.clientAddress3 || '').trim(),
                    clientCity: String(form.clientCity).trim(), clientState: String(form.clientState).trim(),
                    clientPostcode: String(form.clientPostcode).trim(), clientCountry: String(form.clientCountry || 'Malaysia').trim(),
                    clientNotes: String(form.clientNotes || '').trim(), updatedAt: now, updatedByUid: this.userProfile.uid || '', updatedByName: this.userProfile.name || ''
                });
                if (isNewRecord) {
                    clientRecord.createdAt = now;
                    clientRecord.createdByUid = this.userProfile.uid || '';
                    clientRecord.createdByName = this.userProfile.name || '';
                    clientRecord.clientTierAssignedAt = now;
                } else if (!existingCust?.clientTierAssignedAt && clientTier) {
                    clientRecord.clientTierAssignedAt = now;
                }
                // merge:true is deliberate: an old client is never migrated or altered
                // in bulk. Only the exact record a staff member opened and saved changes.
                await setDoc(doc(db, 'customers', docId), clientRecord, { merge: true });
                this.logAudit(isNewRecord ? 'CREATE' : 'UPDATE', `${isNewRecord ? 'Registered' : 'Updated'} client ${clientRecord.clientName} (${clientId})`);
                this.showNotify(isNewRecord ? `Client registered. Permanent Client ID: ${clientId}` : `Client information updated. Client ID remains ${clientId}.`);
                // Stay on the full page and show the newly issued permanent ID.
                this.clientInformationModal.form.id = docId;
                this.clientInformationModal.form.clientId = clientId;
                this.clientInformationModal.form.createdAt = clientRecord.createdAt || existingCust?.createdAt || '';
                this.clientInformationModal.isEdit = true;
                return true;
            } catch (error) {
                console.error('Client information save failed:', error);
                this.showNotify('Unable to save client information.');
                return false;
            } finally {
                this.clientInformationModal.saving = false;
            }
        },
        openClientView(cust) {
            this.clientView.client = {
                id: cust.id || '', clientId: cust.clientId || '', clientName: cust.clientName || '-', clientSSM: cust.clientSSM || '-', clientContactPerson: cust.clientContactPerson || '-',
                clientPosition: cust.clientPosition || '-', clientEmail: cust.clientEmail || '-', clientPhone: cust.clientPhone || '-',
                clientAddress: cust.clientAddress || '', clientAddress1: cust.clientAddress1 || cust.clientAddress || '', clientAddress2: cust.clientAddress2 || '', clientAddress3: cust.clientAddress3 || '', clientCity: cust.clientCity || '', clientState: cust.clientState || '',
                clientPostcode: cust.clientPostcode || '', clientCountry: cust.clientCountry || 'Malaysia', clientTier: cust.clientTier || 'Standard', companyType: cust.companyType || '', industry: cust.industry || '', clientNotes: cust.clientNotes || ''
            };
            this.clientView.show = true;
            // Same guard as the project preview: client_documents is closed to
            // Staff, so subscribing here would only paint a permission error.
            if (cust.id && this.canViewClientDocuments) this.loadClientDocuments(cust.id, cust.clientName, cust.clientEmail);
        },
        closeClientView() {
            this.clientView.show = false;
            this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' };
        },
        async openClientQuickViewForProject(project) {
            const cached = this.customers.find(c => c.id === project.clientDirectoryId);
            if (cached) { this.openClientView(cached); return; }
            // Fall back to a direct Firestore read when the local customers cache hasn't
            // synced yet (e.g. a client was just created and this project opened right
            // after) — without this, the modal would show only the sparse project-embedded
            // fields (name/email/SSM) instead of the client's full contact record.
            if (project.clientDirectoryId) {
                try {
                    const snap = await getDoc(doc(db, 'customers', project.clientDirectoryId));
                    if (snap.exists()) { this.openClientView({ id: snap.id, ...snap.data() }); return; }
                } catch (error) {
                    console.error('Client directory lookup failed:', error);
                }
            }
            this.openClientView({ clientName: project.clientName || 'Unknown Client', clientEmail: project.clientEmail || '', clientSSM: project.clientSSM || '', clientTier: project.clientTier || 'Standard' });
        },
        clientTierMeta(tier) {
            const map = {
                Priority: { label: 'Priority', badgeClass: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
                Premium: { label: 'Premium', badgeClass: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
                Standard: { label: 'Standard', badgeClass: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200' }
            };
            return map[tier] || map.Standard;
        },
        clientTierForId(clientDirectoryId, fallbackTier = 'Standard') {
            const customer = this.customers.find(c => c.id === clientDirectoryId);
            return customer?.clientTier || fallbackTier || 'Standard';
        },
        clientSsmForId(clientDirectoryId, fallbackSSM = '') {
            const customer = this.customers.find(c => c.id === clientDirectoryId);
            return customer?.clientSSM || fallbackSSM || '';
        },
        // Mirrors clientTierForId/clientSsmForId — projects.clientName is a snapshot
        // taken when the project was linked, so renaming a client in the Client
        // Directory wouldn't otherwise show up on already-created projects. This
        // resolves live against the current customers record, falling back to the
        // snapshot only if the client record itself is unavailable (deleted, or the
        // customers list hasn't loaded for this role yet).
        clientNameForId(clientDirectoryId, fallbackName = '') {
            const customer = this.customers.find(c => c.id === clientDirectoryId);
            return customer?.clientName || fallbackName || '';
        },
        clientProjectCount(clientDirectoryId) {
            if (!clientDirectoryId) return 0;
            return this.projects.filter(p => p.clientDirectoryId === clientDirectoryId).length;
        },
        // Client Tier card detail: the PIC of this client's most recently
        // touched project — a company can have several projects with different
        // owners, so "most recent" is the closest single answer to "who's
        // handling this client right now."
        clientLatestProjectPic(clientDirectoryId) {
            if (!clientDirectoryId) return '';
            const clientProjects = this.projects.filter(p => p.clientDirectoryId === clientDirectoryId);
            if (!clientProjects.length) return '';
            const latest = [...clientProjects].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0];
            return latest.ownerName || '';
        },
        // Client Tier card detail: prefer the timestamp of when the tier was
        // actually assigned (clientTierAssignedAt, added alongside this page);
        // older customers tagged before that field existed only have createdAt
        // — the client's own registration date — so fall back to that instead
        // of showing nothing.
        clientTaskDateLabel(cust) {
            // Every card shown has already passed the clientTaskCreatedAt gate in
            // clientTaskGroups, so this is always present — the createdAt fallback
            // only guards a stray direct call before that field existed.
            if (cust.clientTaskCreatedAt) return `Registered ${this.formatDateTime(cust.clientTaskCreatedAt)}`;
            if (cust.createdAt) return `Registered ${this.formatDateTime(cust.createdAt)}`;
            return 'No date on record';
        },
        // Consult -> In-Progress -> Complete, derived live from this client's own
        // projects (never a manually-set field, so it can never drift out of sync
        // with the actual Project Activities board):
        //  - no projects, or all still at the first stage (Project Planning) -> Consult
        //  - at least one project has moved past Project Planning, but not every
        //    project is Completed & Done yet -> In-Progress
        //  - every project (at least one) is Completed & Done -> Complete
        clientTaskStatus(clientDirectoryId) {
            const clientProjects = this.projects.filter(p => p.clientDirectoryId === clientDirectoryId);
            if (!clientProjects.length) return 'Consult';
            if (clientProjects.every(p => p.status === 'Completed & Done')) return 'Complete';
            const anyStarted = clientProjects.some(p => p.status !== 'Project Planning');
            return anyStarted ? 'In-Progress' : 'Consult';
        },
        clientTaskStatusMeta(status) {
            const map = {
                'Consult': { label: 'Consult', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200' },
                'In-Progress': { label: 'In-Progress', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                'Complete': { label: 'Complete', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' }
            };
            return map[status] || map.Consult;
        },
        // CROSS-SYSTEM INSIGHT: client health score blends Billing (payment behaviour) with
        // Project Activities (delivery velocity) — a signal only possible with HR + Client data unified.
        clientHealthScore(cust) {
            if (!cust) return { score: 0, label: 'No Data', className: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' };
            // Match by the linked customer record id, not the display name — two distinct
            // clients can share the same clientName, which would otherwise silently
            // conflate their invoice totals.
            const clientInvoices = cust.id
                ? this.docHistory.filter(d => d.type === 'Invoice' && d.raw && d.raw.customerId === cust.id)
                : this.docHistory.filter(d => d.type === 'Invoice' && d.name === cust.clientName);
            const totalInvoiced = clientInvoices.reduce((s, d) => s + (Number(d.amount) || 0), 0);
            const totalPaid = clientInvoices.filter(d => d.status === 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0);
            const paymentScore = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 50) : 35;

            const clientProjects = cust.id ? this.projects.filter(p => p.clientDirectoryId === cust.id) : [];
            const activeProjects = clientProjects.filter(p => p.status !== 'Completed & Done');
            const overdueProjects = activeProjects.filter(p => (this.projectTargetDateState(p).daysRemaining ?? 0) < 0);
            const projectScore = activeProjects.length ? Math.max(0, 30 - overdueProjects.length * 10) : 20;

            const engagementScore = Math.min(20, activeProjects.length * 5);
            const score = Math.min(100, paymentScore + projectScore + engagementScore);

            let label, className;
            if (score >= 80) { label = 'Excellent'; className = 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'; }
            else if (score >= 60) { label = 'Good'; className = 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'; }
            else if (score >= 40) { label = 'Fair'; className = 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'; }
            else { label = 'At Risk'; className = 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'; }
            return { score, label, className };
        },
        // Quotations + Invoices billed to this client — same matching rule as
        // clientHealthScore (linked customer id, falling back to name match for
        // older records saved before raw.customerId existed), reshaped with the
        // same tagClass/isDoc fields filteredRecentActivities already adds so
        // the Recent Activities table row markup can be reused as-is.
        clientDocHistory(cust) {
            if (!cust) return [];
            const items = cust.id
                ? this.docHistory.filter(d => d.raw && d.raw.customerId === cust.id)
                : this.docHistory.filter(d => d.name === cust.clientName);
            return items
                .map(d => ({ ...d, tagClass: d.type === 'Invoice' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', isDoc: true }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        },
        // Billing records must be shown against the project they were issued
        // for, not every project handled by the same PIC or every project for
        // the same Client. This deliberately has no legacy name/client fallback:
        // an unlinked record is safer to leave in the Client Billing history
        // than to display it under the wrong Client task.
        projectBillingDocuments(project) {
            const projectId = String(project?.id || '').trim();
            const customerId = String(project?.clientDirectoryId || '').trim();
            if (!projectId || !customerId) return [];
            return this.docHistory
                .filter(item => ['Invoice', 'Quotation'].includes(item?.type))
                .filter(item => String(item?.raw?.projectId || '').trim() === projectId && String(item?.raw?.customerId || '').trim() === customerId)
                .map(item => ({
                    ...item,
                    isDoc: true,
                    tagClass: item.type === 'Invoice'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                }))
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        },
        isNewClient(clientDirectoryId) {
            if (!clientDirectoryId) return false;
            const customer = typeof clientDirectoryId === 'object'
                ? clientDirectoryId
                : this.customers.find(c => c.id === clientDirectoryId);
            if (!customer?.createdAt) return false;
            const createdMs = Date.parse(customer.createdAt);
            if (!Number.isFinite(createdMs)) return false;
            const ageMs = this.clientStatusNow - createdMs;
            return ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
        },
        clientGroupNewestCreatedAt(group) {
            const timestamps = group.projects.map(p => Date.parse(p.createdAt || '')).filter(Number.isFinite);
            return timestamps.length ? Math.max(...timestamps) : null;
        },
        isNewProjectGroup(group) {
            const newest = this.clientGroupNewestCreatedAt(group);
            if (newest === null) return false;
            const ageMs = Date.now() - newest;
            return ageMs >= 0 && ageMs <= 3 * 24 * 60 * 60 * 1000;
        },

        // ── Website Content (zenqor-tech Portfolio, Services, Page Text) ────────
        // Gallery cards show the WORK's own date (eventDate — when the permit was
        // issued, the submission made), not when someone happened to type the record
        // into the portal. Ordering by createdAt therefore put an older job in front
        // of a newer one whenever they were entered out of order, which is exactly
        // what the Licensing & Permits list was doing. Sort by what the card shows.
        //
        // createdAt is the fallback for records saved before eventDate existed, and
        // the tiebreaker for two items on the same day. Both are ISO-prefixed
        // (YYYY-MM-DD…), so a plain string compare orders them correctly and a
        // date-only eventDate still compares cleanly against a full timestamp.
        // createdAt is NOT uniformly typed in this collection: older records hold a
        // Firestore Timestamp (written via serverTimestamp()), newer ones an ISO
        // string. String(timestamp) yields "Timestamp(seconds=…)", which sorts
        // nowhere near an ISO date — that is why the previous createdAt ordering
        // came out looking arbitrary. Normalise both shapes to ISO before comparing.
        toComparableIsoDate(value) {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (typeof value.toDate === 'function') {
                try { return value.toDate().toISOString(); } catch (error) { return ''; }
            }
            if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
            return '';
        },
        websiteContentDateKey(item) {
            return String(item?.eventDate || this.toComparableIsoDate(item?.createdAt) || '');
        },
        sortGalleryItemsNewestFirst(items) {
            return [...items].sort((a, b) => {
                const byDate = this.websiteContentDateKey(b).localeCompare(this.websiteContentDateKey(a));
                if (byDate !== 0) return byDate;
                return this.toComparableIsoDate(b.createdAt).localeCompare(this.toComparableIsoDate(a.createdAt));
            });
        },
        websiteContentLabel(collectionName) {
            if (collectionName === 'services') return 'Services';
            // portfolio_web is retired; its records are being folded into
            // Licensing & Permits, so both portfolio collections read the same.
            return 'Licensing & Permits';
        },
        openWebsiteContentModal(collectionName, item = null) {
            if (!this.hasModulePermission('website-content', 'edit')) { this.showNotify('You do not have permission to manage website content.'); return; }
            if (this.websiteContentModal.imagePreviewUrl && this.websiteContentModal.imageFile) URL.revokeObjectURL(this.websiteContentModal.imagePreviewUrl);
            (this.websiteContentModal.mediaItems || []).forEach(media => { if (media.file && media.previewUrl) URL.revokeObjectURL(media.previewUrl); });
            const isGallery = (collectionName === 'portfolio_web' || collectionName === 'portfolio_gaming');
            let mediaItems = [];
            if (isGallery) {
                if (Array.isArray(item?.media) && item.media.length) {
                    mediaItems = item.media.map(m => ({ type: m.type === 'video' ? 'video' : 'image', url: m.url || '', storagePath: m.storagePath || '', file: null, previewUrl: m.url || '' }));
                } else if (item?.imgUrl) {
                    // Legacy single-image item saved before the gallery feature existed.
                    mediaItems = [{ type: 'image', url: item.imgUrl, storagePath: item.imgStoragePath || '', file: null, previewUrl: item.imgUrl }];
                }
            }
            this.websiteContentModal = {
                show: true,
                isEdit: Boolean(item),
                collectionName,
                id: item?.id || '',
                form: { tag: item?.tag || '', title: item?.title || '', desc: item?.desc || '', imgUrl: item?.imgUrl || '', imgStoragePath: item?.imgStoragePath || '', icon: item?.icon || '', name: item?.name || '', companyName: item?.companyName || '', eventDate: item?.eventDate || '' },
                imageFile: null,
                imagePreviewUrl: item?.imgUrl || '',
                imageOrientation: '',
                mediaItems,
                removedMediaStoragePaths: [],
                uploading: false
            };
        },
        closeWebsiteContentModal() {
            if (this.websiteContentModal.imagePreviewUrl && this.websiteContentModal.imageFile) URL.revokeObjectURL(this.websiteContentModal.imagePreviewUrl);
            (this.websiteContentModal.mediaItems || []).forEach(media => { if (media.file && media.previewUrl) URL.revokeObjectURL(media.previewUrl); });
            this.websiteContentModal = { show: false, isEdit: false, collectionName: 'portfolio_gaming', id: '', form: { tag: '', title: '', desc: '', imgUrl: '', imgStoragePath: '', icon: '', name: '', companyName: '', eventDate: '' }, imageFile: null, imagePreviewUrl: '', imageOrientation: '', mediaItems: [], removedMediaStoragePaths: [], uploading: false };
        },
        // Only PNG/JPEG — these become public marketing images on zenqor-tech, so no PDFs
        // or other formats. Magic-byte check mirrors validateClientDocumentFile so a
        // renamed .exe or mismatched extension can't slip through the extension check alone.
        async validateWebsiteContentImage(file) {
            if (!file) throw new Error('No file was selected.');
            if (file.size <= 0) throw new Error('The selected file is empty.');
            if (file.size > 8 * 1024 * 1024) throw new Error('Image size must not exceed 8 MB.');

            const extension = String(file.name || '').split('.').pop().toLowerCase();
            const extensionTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
            const contentType = extensionTypeMap[extension];
            if (!contentType) throw new Error('Only JPG, JPEG and PNG images are allowed.');

            const declaredType = String(file.type || '').toLowerCase();
            const compatibleTypesMap = {
                'image/png': ['image/png', 'image/x-png'],
                'image/jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg']
            };
            if (declaredType && !compatibleTypesMap[contentType].includes(declaredType)) throw new Error('The file extension does not match its actual file type.');

            const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
            const isPng = signature.length >= 8 && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47 && signature[4] === 0x0D && signature[5] === 0x0A && signature[6] === 0x1A && signature[7] === 0x0A;
            const isJpeg = signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;
            if ((contentType === 'image/png' && !isPng) || (contentType === 'image/jpeg' && !isJpeg)) {
                throw new Error('The selected file is not a valid JPG or PNG — its content does not match its extension.');
            }
            return contentType;
        },
        // Video companion to validateWebsiteContentImage — MP4 only (what virtually
        // every phone/export tool produces), checked via the ISO-BMFF 'ftyp' box
        // signature at byte offset 4 so a renamed non-video file can't slip through
        // on extension alone. Capped larger than images since video is inherently
        // bigger, but still bounded before it ever reaches Storage.
        async validateWebsiteContentVideo(file) {
            if (!file) throw new Error('No file was selected.');
            if (file.size <= 0) throw new Error('The selected file is empty.');
            if (file.size > 40 * 1024 * 1024) throw new Error('Video size must not exceed 40 MB.');

            const extension = String(file.name || '').split('.').pop().toLowerCase();
            if (extension !== 'mp4') throw new Error('Only MP4 video is allowed.');

            const declaredType = String(file.type || '').toLowerCase();
            if (declaredType && declaredType !== 'video/mp4') throw new Error('The file extension does not match its actual file type.');

            const header = new Uint8Array(await file.slice(4, 8).arrayBuffer());
            const boxType = header.length === 4 ? String.fromCharCode(header[0], header[1], header[2], header[3]) : '';
            if (boxType !== 'ftyp') throw new Error('The selected file is not a valid MP4 — its content does not match its extension.');
            return 'video/mp4';
        },
        // Dispatches to the image or video validator by extension — used by the
        // portfolio gallery multi-media uploader (images + MP4, up to 6 files).
        async validateWebsiteContentMediaFile(file) {
            const extension = String(file?.name || '').split('.').pop().toLowerCase();
            if (extension === 'mp4') return { type: 'video', contentType: await this.validateWebsiteContentVideo(file) };
            return { type: 'image', contentType: await this.validateWebsiteContentImage(file) };
        },
        async handleWebsiteContentMediaSelect(e) {
            const files = Array.from(e.target.files || []);
            e.target.value = ''; // lets the same file be re-selected later if removed
            if (!files.length) return;
            const MAX_MEDIA = 6;
            for (const file of files) {
                if (this.websiteContentModal.mediaItems.length >= MAX_MEDIA) { this.showNotify(`Up to ${MAX_MEDIA} media files per item.`); break; }
                try {
                    const { type } = await this.validateWebsiteContentMediaFile(file);
                    this.websiteContentModal.mediaItems.push({ type, url: '', storagePath: '', file, previewUrl: URL.createObjectURL(file) });
                } catch (error) {
                    this.showNotify(error.message || 'Unable to use this file.');
                }
            }
        },
        removeWebsiteContentMedia(index) {
            const media = this.websiteContentModal.mediaItems[index];
            if (!media) return;
            if (media.file && media.previewUrl) URL.revokeObjectURL(media.previewUrl);
            // Already-uploaded (editing an existing item) — queue its Storage object
            // for cleanup once the save actually goes through, not before, so an
            // admin who removes something and then cancels doesn't lose real files.
            if (!media.file && media.storagePath) this.websiteContentModal.removedMediaStoragePaths.push(media.storagePath);
            this.websiteContentModal.mediaItems.splice(index, 1);
        },
        async saveWebsiteContentItem() {
            if (!this.hasModulePermission('website-content', 'edit')) { this.showNotify('You do not have permission to manage website content.'); return; }
            const collectionName = this.websiteContentModal.collectionName;
            const isServices = collectionName === 'services';
            const isGallery = (collectionName === 'portfolio_web' || collectionName === 'portfolio_gaming');
            const form = this.websiteContentModal.form;
            const desc = form.desc.trim();
            let payload;
            if (isServices) {
                const icon = form.icon.trim();
                const name = form.name.trim();
                if (!icon || !name || !desc) { this.showNotify('Fill in Icon, Name and Description.'); return; }
                if (!/^fa[a-z]?\s+fa-[\w-]+$/i.test(icon)) { this.showNotify('Icon must be a Font Awesome class, e.g. "fas fa-building".'); return; }
                payload = { icon, name, desc };
            } else {
                const tag = form.tag.trim();
                const title = form.title.trim();
                const companyName = form.companyName.trim();
                const eventDate = form.eventDate.trim();
                if (!tag || !companyName || !title || !desc) { this.showNotify('Fill in Tag / Category, Company Name, Activity Title and Description.'); return; }
                if (isGallery) {
                    if (!this.websiteContentModal.mediaItems.length) { this.showNotify('Attach at least one photo or video.'); return; }
                } else if (!this.websiteContentModal.imageFile && !form.imgUrl) {
                    this.showNotify('Upload an image (PNG, JPG or JPEG).'); return;
                }
                payload = { tag, companyName, title, eventDate, desc };
            }
            // Deliberately NOT normalizeOfficialRecord(): that uppercases every
            // string, which suits an invoice's official party details but turns a
            // public marketing paragraph into an unreadable wall of capitals, and
            // left Our Client reading nothing like Licensing & Permits beside it.
            // Every field is already trimmed above; case stays as the editor typed it.
            const label = isServices ? payload.name : payload.title;
            this.websiteContentModal.uploading = isGallery
                ? this.websiteContentModal.mediaItems.some(media => media.file)
                : (!isServices && Boolean(this.websiteContentModal.imageFile));
            try {
                let oldStoragePath = '';
                if (isGallery) {
                    // Upload every NEW file (media.file set) in order, keep already-uploaded
                    // entries (from editing) as-is. media[0] doubles as the legacy
                    // imgUrl/imgStoragePath so the admin list-view thumbnail and any older
                    // reader that only knows about imgUrl keep working unchanged.
                    const finalMedia = [];
                    for (const media of this.websiteContentModal.mediaItems) {
                        if (media.file) {
                            const { contentType } = await this.validateWebsiteContentMediaFile(media.file);
                            const safeName = String(media.file.name || 'media').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                            const storagePath = `website_content/${collectionName}/${Date.now()}_${finalMedia.length}_${safeName}`;
                            const fileRef = storageRef(storage, storagePath);
                            await uploadBytes(fileRef, media.file, { contentType });
                            finalMedia.push({ type: media.type, url: await getDownloadURL(fileRef), storagePath });
                        } else {
                            finalMedia.push({ type: media.type, url: media.url, storagePath: media.storagePath || '' });
                        }
                    }
                    payload.media = finalMedia;
                    payload.imgUrl = finalMedia[0].url;
                    payload.imgStoragePath = finalMedia[0].storagePath || '';
                } else if (!isServices && this.websiteContentModal.imageFile) {
                    const file = this.websiteContentModal.imageFile;
                    const contentType = await this.validateWebsiteContentImage(file);
                    const safeName = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                    const storagePath = `website_content/${collectionName}/${Date.now()}_${safeName}`;
                    const fileRef = storageRef(storage, storagePath);
                    await uploadBytes(fileRef, file, { contentType });
                    payload.imgUrl = await getDownloadURL(fileRef);
                    payload.imgStoragePath = storagePath;
                    oldStoragePath = form.imgStoragePath || '';
                } else if (!isServices) {
                    payload.imgUrl = form.imgUrl;
                    payload.imgStoragePath = form.imgStoragePath || '';
                }
                payload.updatedAt = new Date().toISOString();
                payload.updatedByUid = this.userProfile.uid;
                payload.updatedByEmail = this.userProfile.email;
                if (this.websiteContentModal.isEdit) {
                    await setDoc(doc(db, collectionName, this.websiteContentModal.id), payload, { merge: true });
                    this.logAudit('UPDATE', `Updated ${this.websiteContentLabel(collectionName)} item "${label}"`);
                    this.showNotify('Website content updated.');
                } else {
                    const newId = doc(collection(db, collectionName)).id;
                    await setDoc(doc(db, collectionName, newId), { ...payload, createdAt: new Date().toISOString(), createdByUid: this.userProfile.uid, createdByEmail: this.userProfile.email });
                    this.logAudit('CREATE', `Added ${this.websiteContentLabel(collectionName)} item "${label}"`);
                    this.showNotify('Website content published to the live site.');
                }
                // Only clean up superseded Storage files once the new doc is safely saved,
                // and only for ones we uploaded ourselves (external/seeded URLs have no path).
                if (oldStoragePath && oldStoragePath !== payload.imgStoragePath) {
                    try { await deleteObject(storageRef(storage, oldStoragePath)); } catch (cleanupError) { console.warn('Old website content image cleanup failed:', cleanupError); }
                }
                if (isGallery && this.websiteContentModal.removedMediaStoragePaths.length) {
                    await Promise.all(this.websiteContentModal.removedMediaStoragePaths.map(async (path) => {
                        try { await deleteObject(storageRef(storage, path)); } catch (cleanupError) { console.warn('Removed media cleanup failed:', cleanupError); }
                    }));
                }
                this.closeWebsiteContentModal();
            } catch (error) {
                console.error('Website content save failed:', error);
                this.showNotify(error.message && !error.code ? error.message : this.getFirestoreWriteError(error, 'save this website content item'));
            } finally {
                this.websiteContentModal.uploading = false;
            }
        },
        async deleteWebsiteContentItem(collectionName, item) {
            if (!this.hasModulePermission('website-content', 'delete')) { this.showNotify('You do not have permission to delete website content.'); return; }
            const label = collectionName === 'services' ? item.name : item.title;
            if (!await this.askConfirm({
                title: 'Delete website content?',
                message: `"${label}" will be removed from ${this.websiteContentLabel(collectionName)} and disappear from the live site immediately.`,
                confirmLabel: 'Yes, Delete',
                danger: true
            })) return;
            try {
                await deleteDoc(doc(db, collectionName, item.id));
                // A gallery item (portfolio_web) can own several media files — delete
                // every one of them, not just the cover. imgStoragePath is always
                // media[0]'s own path, so a Set dedupes it automatically.
                const storagePaths = new Set();
                if (item.imgStoragePath) storagePaths.add(item.imgStoragePath);
                if (Array.isArray(item.media)) item.media.forEach(media => { if (media.storagePath) storagePaths.add(media.storagePath); });
                await Promise.all([...storagePaths].map(async (path) => {
                    try { await deleteObject(storageRef(storage, path)); } catch (cleanupError) { console.warn('Website content media cleanup failed:', cleanupError); }
                }));
                this.logAudit('DELETE', `Deleted ${this.websiteContentLabel(collectionName)} item "${label}"`);
                this.showNotify('Website content deleted.');
            } catch (error) {
                console.error('Website content delete failed:', error);
                this.showNotify('Unable to delete website content.');
            }
        },

        // ── Website Content: Page Text overrides (content/site_text) ────────────
        siteTextGroups() {
            return ['all', ...new Set(SITE_TEXT_KEYS.map(row => row.group))];
        },
        filteredSiteTextRows() {
            const search = this.siteTextFilter.search.trim().toLowerCase();
            return SITE_TEXT_KEYS
                .filter(row => this.siteTextFilter.group === 'all' || row.group === this.siteTextFilter.group)
                .filter(row => !search || row.key.toLowerCase().includes(search) || row.label.toLowerCase().includes(search))
                .map(row => ({ ...row, override: this.siteTextOverrides[row.key] || null }));
        },
        openSiteTextModal(row) {
            if (!this.hasModulePermission('website-content', 'edit')) { this.showNotify('You do not have permission to manage website content.'); return; }
            const existing = this.siteTextOverrides[row.key];
            this.siteTextModal = { show: true, key: row.key, label: row.label, form: { en: existing?.en || '', ms: existing?.ms || '' } };
        },
        closeSiteTextModal() {
            this.siteTextModal = { show: false, key: '', label: '', form: { en: '', ms: '' } };
        },
        async saveSiteTextOverride() {
            if (!this.hasModulePermission('website-content', 'edit')) { this.showNotify('You do not have permission to manage website content.'); return; }
            const key = this.siteTextModal.key;
            const en = this.siteTextModal.form.en.trim();
            const ms = this.siteTextModal.form.ms.trim();
            if (!en && !ms) { this.showNotify('Enter English and/or Malay text before saving.'); return; }
            try {
                await setDoc(doc(db, 'content', 'site_text'), { [key]: { en, ms } }, { merge: true });
                this.logAudit('UPDATE', `Updated page text override "${key}"`);
                this.showNotify('Page text updated on the live site.');
                this.closeSiteTextModal();
            } catch (error) {
                console.error('Page text save failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'save this page text override'));
            }
        },
        async resetSiteTextOverride(key) {
            if (!this.hasModulePermission('website-content', 'delete')) { this.showNotify('You do not have permission to manage website content.'); return; }
            if (!await this.askConfirm({
                title: 'Reset to default text?',
                message: `"${key}" returns to the site's built-in wording and your override is removed.`,
                confirmLabel: 'Yes, Reset',
                danger: true
            })) return;
            try {
                await setDoc(doc(db, 'content', 'site_text'), { [key]: deleteField() }, { merge: true });
                this.logAudit('DELETE', `Reset page text override "${key}" to default`);
                this.showNotify('Reverted to the default text.');
            } catch (error) {
                console.error('Page text reset failed:', error);
                this.showNotify('Unable to reset this page text override.');
            }
        },
        async updateClientTier(cust, tier) {
            if (!this.canManageClients) { this.showNotify('You do not have permission to update client tier.'); return false; }
            if (!cust?.id) return false;
            try {
                const now = new Date().toISOString();
                await setDoc(doc(db, 'customers', cust.id), { clientTier: tier, clientTierAssignedAt: now, updatedAt: now, updatedByUid: this.userProfile.uid }, { merge: true });
                this.logAudit('UPDATE', `Set ${tier} tier for client ${cust.clientName}`);
                this.showNotify(`${cust.clientName} tagged as ${tier} Client.`);
                return true;
            } catch (error) {
                console.error('Client tier update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the client tier'));
                return false;
            }
        },
        openClientTaskModal() {
            if (!this.canCreateClientTask) { this.showNotify('Only Director may create a new Client Task.'); return; }
            this.clientTaskModal = { show: true, clientDirectoryId: '', saving: false };
        },
        closeClientTaskModal() {
            this.clientTaskModal.show = false;
        },
        // A Client Directory record stays separate from a Client Task. The task
        // becomes mandatory once a project exists; creating a directory record
        // alone still does not add an empty task to the board.
        async addClientToTask(cust) {
            if (!this.canCreateClientTask) { this.showNotify('Only Director may create a new Client Task.'); return false; }
            if (!cust?.id) return false;
            if (cust.clientTaskCreatedAt) return true;
            try {
                const now = new Date().toISOString();
                await setDoc(doc(db, 'customers', cust.id), { clientTaskCreatedAt: now, updatedAt: now, updatedByUid: this.userProfile.uid }, { merge: true });
                this.logAudit('CREATE', `Added ${cust.clientName} to Client Task`);
                return true;
            } catch (error) {
                console.error('Add to Client Task failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'add this client to Client Task'));
                return false;
            }
        },
        // Repairs projects created before Client Task became the required parent.
        // It only touches customer records which already have at least one
        // project, and never creates or changes a Client Directory record.
        async ensureClientTasksForExistingProjects() {
            if (!this.canManageProjects || this.clientTaskRepairRunning || !this.projects.length || !this.customers.length) return;
            const firstProjectByClientId = new Map();
            this.projects.forEach(project => {
                if (!project.clientDirectoryId || firstProjectByClientId.has(project.clientDirectoryId)) return;
                firstProjectByClientId.set(project.clientDirectoryId, project);
            });
            const missing = this.customers.filter(customer => !customer.clientTaskCreatedAt && firstProjectByClientId.has(customer.id));
            if (!missing.length) return;

            this.clientTaskRepairRunning = true;
            try {
                const repairedAt = new Date().toISOString();
                for (let start = 0; start < missing.length; start += 450) {
                    const batch = writeBatch(db);
                    missing.slice(start, start + 450).forEach(customer => {
                        const firstProject = firstProjectByClientId.get(customer.id);
                        batch.set(doc(db, 'customers', customer.id), {
                            clientTaskCreatedAt: firstProject?.createdAt || repairedAt,
                            clientTaskRestoredAt: repairedAt,
                            updatedAt: repairedAt,
                            updatedByUid: this.userProfile.uid
                        }, { merge: true });
                    });
                    await batch.commit();
                }
                this.logAudit('REPAIR_CLIENT_TASKS', `Restored Client Task parent for ${missing.length} client${missing.length === 1 ? '' : 's'} with existing projects`);
                this.showNotify(`Client Task restored for ${missing.length} client${missing.length === 1 ? '' : 's'} with existing projects.`);
            } catch (error) {
                console.error('Client Task repair failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'restore the missing Client Task'));
            } finally {
                this.clientTaskRepairRunning = false;
            }
        },
        // Some projects saved before Client Task was made mandatory have a valid
        // company name/SSM snapshot but no usable Client Directory id. Repairing
        // those IDs restores the correct board entry without guessing: a project
        // is changed only when exactly one registered Client Task matches its SSM,
        // or (when SSM is absent) its exact company name.
        async repairLegacyProjectClientLinks() {
            if (!this.canManageProjects || this.legacyProjectLinkRepairRunning || !this.projects.length || !this.customers.length) return;

            const normalizeClientKey = value => String(value || '')
                .trim()
                .toLocaleUpperCase('en-MY')
                .replace(/[^A-Z0-9]/g, '');
            const registeredTasks = this.customers.filter(customer => customer?.id && customer.clientTaskCreatedAt);
            if (!registeredTasks.length) return;

            const repairs = this.projects.reduce((list, project) => {
                if (this.isProjectLinkedToRegisteredClientTask(project)) return list;
                const projectSSM = normalizeClientKey(project.clientSSM);
                const projectName = normalizeClientKey(project.clientName);
                const candidates = projectSSM
                    ? registeredTasks.filter(customer => normalizeClientKey(customer.clientSSM) === projectSSM)
                    : projectName
                        ? registeredTasks.filter(customer => normalizeClientKey(customer.clientName) === projectName)
                        : [];
                if (candidates.length === 1) list.push({ project, customer: candidates[0] });
                return list;
            }, []);
            if (!repairs.length) return;

            this.legacyProjectLinkRepairRunning = true;
            try {
                const repairedAt = new Date().toISOString();
                for (let start = 0; start < repairs.length; start += 450) {
                    const batch = writeBatch(db);
                    repairs.slice(start, start + 450).forEach(({ project, customer }) => {
                        batch.update(doc(db, 'projects', project.id), {
                            clientDirectoryId: customer.id,
                            clientName: customer.clientName || project.clientName || '',
                            clientEmail: String(customer.clientEmail || project.clientEmail || '').trim().toLowerCase(),
                            clientSSM: customer.clientSSM || project.clientSSM || '',
                            clientTier: customer.clientTier || project.clientTier || 'Standard',
                            clientTaskLinkRepairedAt: repairedAt,
                            clientTaskLinkRepairedByUid: this.userProfile.uid,
                            updatedAt: repairedAt,
                            updatedByUid: this.userProfile.uid,
                            updatedByEmail: String(this.userProfile.email || '').trim().toLowerCase()
                        });
                    });
                    await batch.commit();
                }
                this.logAudit('REPAIR_PROJECT_CLIENT_TASK_LINKS', `Restored Client Task links for ${repairs.length} project${repairs.length === 1 ? '' : 's'}`);
                this.showNotify(`Restored the Client Task link for ${repairs.length} project${repairs.length === 1 ? '' : 's'}.`);
            } catch (error) {
                console.error('Legacy project Client Task link repair failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'restore the project Client Task link'));
            } finally {
                this.legacyProjectLinkRepairRunning = false;
            }
        },
        async saveClientTask() {
            if (!this.canCreateClientTask) { this.showNotify('Only Director may create a new Client Task.'); return; }
            const modal = this.clientTaskModal;
            const cust = this.customers.find(c => c.id === modal.clientDirectoryId);
            if (!cust) { this.showNotify('Select a client from the list.'); return; }
            modal.saving = true;
            try {
                const ok = await this.addClientToTask(cust);
                if (ok) { this.closeClientTaskModal(); this.viewClientBoard(cust); }
            } finally {
                modal.saving = false;
            }
        },
        requestDeleteClientTask(cust) {
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete a Client Task.'); return; }
            if (!cust?.id) { this.showNotify('Unable to delete this Client Task.'); return; }
            const projectCount = this.projects.filter(project => project.clientDirectoryId === cust.id).length;
            const activityCount = this.projects
                .filter(project => project.clientDirectoryId === cust.id)
                .reduce((count, project) => count + this.projectActivitiesFor(project.id).length, 0);
            const updateCount = this.projects
                .filter(project => project.clientDirectoryId === cust.id)
                .reduce((count, project) => count + this.clientUpdatesFor(project.id).length, 0);
            this.requestConfirm({
                title: 'Delete Client Task and Projects?',
                message: `${cust.clientName || 'This client'} has ${projectCount} project(s), ${activityCount} project activity record(s), and ${updateCount} client update(s). Deleting this Client Task permanently deletes all of them. The Client Directory record, portal access, and documents will be kept.`,
                confirmLabel: 'Yes, Delete Client Task',
                danger: true,
                onConfirm: () => this.deleteClientTask(cust)
            });
        },
        async deleteClientTask(cust) {
            if (!this.canDelete || !cust?.id) return false;
            try {
                const linkedProjects = this.projects.filter(project => project.clientDirectoryId === cust.id);
                const linkedActivities = linkedProjects.flatMap(project => this.projectActivitiesFor(project.id));
                const linkedUpdates = linkedProjects.flatMap(project => this.clientUpdatesFor(project.id));
                const childDeletes = [
                    ...linkedActivities.map(activity => ({ collection: 'project_activities', id: activity.id })),
                    ...linkedUpdates.map(update => ({ collection: 'project_client_updates', id: update.id })),
                    ...linkedProjects.map(project => ({ collection: 'projects', id: project.id }))
                ];
                const customerRef = doc(db, 'customers', cust.id);
                const now = new Date().toISOString();

                // Keep the parent task until every child has been deleted. Most
                // tasks fit in one atomic commit; large historical tasks are
                // safely processed in delete-only chunks before the parent flag
                // is removed, respecting Firestore's 500-write limit.
                if (childDeletes.length < 450) {
                    const batch = writeBatch(db);
                    childDeletes.forEach(item => batch.delete(doc(db, item.collection, item.id)));
                    batch.update(customerRef, {
                        clientTaskCreatedAt: deleteField(),
                        clientTaskRestoredAt: deleteField(),
                        updatedAt: now,
                        updatedByUid: this.userProfile.uid
                    });
                    await batch.commit();
                } else {
                    for (let start = 0; start < childDeletes.length; start += 450) {
                        const batch = writeBatch(db);
                        childDeletes.slice(start, start + 450).forEach(item => batch.delete(doc(db, item.collection, item.id)));
                        await batch.commit();
                    }
                    await updateDoc(customerRef, {
                        clientTaskCreatedAt: deleteField(),
                        clientTaskRestoredAt: deleteField(),
                        updatedAt: now,
                        updatedByUid: this.userProfile.uid
                    });
                }
                if (this.boardClientFilter?.id === cust.id) this.boardClientFilter = null;
                this.logAudit('DELETE_CLIENT_TASK', `Deleted Client Task ${cust.clientName || cust.id} with ${linkedProjects.length} project(s), ${linkedActivities.length} activity record(s), and ${linkedUpdates.length} client update(s)`);
                this.showNotify('Client Task and all linked projects were deleted. Client Directory data was kept.');
                return true;
            } catch (error) {
                console.error('Delete Client Task failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete this Client Task and its projects'));
                return false;
            }
        },
        // Generic context menu — desktop right-click (@contextmenu.prevent) and
        // mobile/tablet long-press (v-longpress directive) both call this with
        // an `items` array of {label, icon, action, danger|undefined} built at
        // the call site; falsy entries (permission-gated out) are dropped here
        // so callers can just write `condition ? {...} : null` inline, matching
        // the exact same v-if the row's visible action buttons already use.
        // `event` may be a real MouseEvent (right-click) or a Touch object
        // (long-press) — both expose clientX/clientY, which is all this needs.
        openContextMenu(event, items) {
            const validItems = (items || []).filter(Boolean);
            if (!validItems.length) return;
            const MENU_WIDTH = 208;
            const ROW_HEIGHT = 44;
            const menuHeight = 40 + validItems.length * ROW_HEIGHT;
            const x = Math.max(8, Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8));
            const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));
            this.contextMenu = { show: true, x, y, items: validItems };
        },
        getButtonContextLabel(button) {
            const rawLabel = button?.getAttribute('aria-label') || button?.getAttribute('title') || button?.innerText || button?.textContent || 'Button';
            const label = String(rawLabel).replace(/\s+/g, ' ').trim();
            return label.length > 46 ? `${label.slice(0, 43)}…` : (label || 'Button');
        },
        isButtonContextEligible(button) {
            return !!(button && this.$el?.contains(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !button.closest('.zq-context-menu'));
        },
        openButtonContextMenu(event, button) {
            if (!this.isButtonContextEligible(button)) return;
            const label = this.getButtonContextLabel(button);
            this.openContextMenu(event, [
                { label: `Use: ${label}`, icon: 'fa-arrow-pointer', action: () => button.click() },
                { label: 'Copy action name', icon: 'fa-copy', action: () => this.copyButtonContextLabel(label) }
            ]);
        },
        async copyButtonContextLabel(label) {
            try {
                await navigator.clipboard.writeText(label);
                this.showNotify(`Copied action: ${label}`);
            } catch (error) {
                this.showNotify(`Action: ${label}`);
            }
        },
        clearButtonContextLongPress() {
            if (this.buttonContextLongPress.timer) clearTimeout(this.buttonContextLongPress.timer);
            this.buttonContextLongPress = { timer: null, startX: 0, startY: 0, button: null };
        },
        installUniversalButtonContextMenu() {
            const findButton = (target) => target instanceof Element ? target.closest('button, [role="button"]') : null;
            this.buttonContextHandlers.contextmenu = (event) => {
                const button = findButton(event.target);
                if (!this.isButtonContextEligible(button)) return;
                event.preventDefault();
                event.stopPropagation();
                this.openButtonContextMenu(event, button);
            };
            this.buttonContextHandlers.touchstart = (event) => {
                const button = findButton(event.target);
                if (!this.isButtonContextEligible(button) || !event.touches || event.touches.length !== 1) return;
                const touch = event.touches[0];
                event.stopPropagation();
                this.clearButtonContextLongPress();
                this.buttonContextLongPress = { timer: null, startX: touch.clientX, startY: touch.clientY, button };
                this.buttonContextLongPress.timer = setTimeout(() => {
                    const heldButton = this.buttonContextLongPress.button;
                    const heldTouch = { clientX: this.buttonContextLongPress.startX, clientY: this.buttonContextLongPress.startY };
                    this.clearButtonContextLongPress();
                    if (!this.isButtonContextEligible(heldButton)) return;
                    const suppressClick = (clickEvent) => { clickEvent.preventDefault(); clickEvent.stopImmediatePropagation(); };
                    heldButton.addEventListener('click', suppressClick, { capture: true, once: true });
                    setTimeout(() => heldButton.removeEventListener('click', suppressClick, { capture: true }), 500);
                    this.openButtonContextMenu(heldTouch, heldButton);
                }, LONGPRESS_THRESHOLD_MS);
            };
            this.buttonContextHandlers.touchmove = (event) => {
                if (!this.buttonContextLongPress.timer) return;
                const touch = event.touches && event.touches[0];
                if (!touch || Math.abs(touch.clientX - this.buttonContextLongPress.startX) > LONGPRESS_MOVE_TOLERANCE_PX || Math.abs(touch.clientY - this.buttonContextLongPress.startY) > LONGPRESS_MOVE_TOLERANCE_PX) this.clearButtonContextLongPress();
            };
            this.buttonContextHandlers.touchend = () => this.clearButtonContextLongPress();
            this.$el.addEventListener('contextmenu', this.buttonContextHandlers.contextmenu, true);
            this.$el.addEventListener('touchstart', this.buttonContextHandlers.touchstart, true);
            this.$el.addEventListener('touchmove', this.buttonContextHandlers.touchmove, true);
            this.$el.addEventListener('touchend', this.buttonContextHandlers.touchend, true);
            this.$el.addEventListener('touchcancel', this.buttonContextHandlers.touchend, true);
        },
        removeUniversalButtonContextMenu() {
            this.clearButtonContextLongPress();
            if (!this.$el) return;
            const handlers = this.buttonContextHandlers;
            if (handlers.contextmenu) this.$el.removeEventListener('contextmenu', handlers.contextmenu, true);
            if (handlers.touchstart) this.$el.removeEventListener('touchstart', handlers.touchstart, true);
            if (handlers.touchmove) this.$el.removeEventListener('touchmove', handlers.touchmove, true);
            if (handlers.touchend) {
                this.$el.removeEventListener('touchend', handlers.touchend, true);
                this.$el.removeEventListener('touchcancel', handlers.touchend, true);
            }
            this.buttonContextHandlers = { contextmenu: null, touchstart: null, touchmove: null, touchend: null };
        },
        closeContextMenu() {
            this.contextMenu.show = false;
        },
        runContextMenuAction(item) {
            this.closeContextMenu();
            if (item && typeof item.action === 'function') item.action();
        },
        viewClientBoard(cust) {
            if (!this.canOpenClientTaskBoard) {
                this.showNotify('You do not have access to Project Activities.');
                return;
            }
            if (!cust?.id || !cust.clientTaskCreatedAt) {
                this.showNotify('Register this client in Client Task before viewing Project Activities.');
                return;
            }
            this.boardClientFilter = { id: cust.id, name: cust.clientName || 'Unknown Client' };
            this.switchTab('project-activities');
        },
        // Shared by the card's @contextmenu.prevent AND v-longpress bindings —
        // one items builder per row type so both desktop and mobile/tablet
        // reach the exact same actions/permissions, defined once.
        clientTaskMenuItems(cust) {
            return [
                this.canOpenClientTaskBoard ? { label: 'View Board', icon: 'fa-table-columns', action: () => this.viewClientBoard(cust) } : null,
                { label: 'View Client Information', icon: 'fa-circle-info', action: () => this.openClientView(cust) },
                this.canDelete ? { label: 'Delete Client Task and Projects', icon: 'fa-trash', danger: true, action: () => this.requestDeleteClientTask(cust) } : null
            ];
        },
        // Shared by the board card (grouped + drilled-down variants) and the
        // list-view row — stageIndex is omitted for the list row, which has no
        // Move actions (no stage columns to move between there).
        projectCardMenuItems(project, stageIndex) {
            const items = [
                { label: 'View Details', icon: 'fa-eye', action: () => this.openProjectDetails(project) }
            ];
            if (this.canEditProject(project)) {
                items.push({ label: 'Edit Project', icon: 'fa-pen', action: () => this.openProjectModal(project) });
                if (typeof stageIndex === 'number') {
                    if (stageIndex > 0) items.push({ label: 'Move to Previous Stage', icon: 'fa-arrow-left', action: () => this.moveProject(project, -1) });
                    if (stageIndex < this.projectStages.length - 1) items.push({ label: 'Move to Next Stage', icon: 'fa-arrow-right', action: () => this.moveProject(project, 1) });
                }
                if (project.status !== 'Completed & Done') items.push({ label: 'Assign / Mark Done', icon: 'fa-check', action: () => this.openMarkProjectDoneModal(project) });
            }
            if (this.canManageProjects) items.push({ label: 'Delete Project', icon: 'fa-trash', danger: true, action: () => this.deleteProject(project) });
            return items;
        },
        // One menu-items builder per remaining row/card type that already exposes
        // 2+ inline actions (Claims, Vouchers, Recent Activity, Client Directory,
        // HR Employees, Client Documents, Website Content x2, Portal Access,
        // Project Activity Issues, Client Activity History) — each mirrors that
        // row's existing buttons/v-if gates exactly, no new actions or permissions.
        claimRowMenuItems(clm) {
            return [
                { label: 'View Claim Record', icon: 'fa-eye', action: () => this.viewClaimRecord(clm) },
                this.canEditClaim(clm) ? { label: 'Edit Claim Record', icon: 'fa-pen', action: () => this.editClaimRecord(clm) } : null
            ];
        },
        voucherRowMenuItems(pv) {
            return [
                { label: 'View Voucher Record', icon: 'fa-eye', action: () => this.viewClaimRecord(pv) },
                this.canEditPaymentVoucher(pv) ? { label: 'Edit Voucher Record', icon: 'fa-pen', action: () => this.editPaymentVoucher(pv) } : null
            ];
        },
        recentActivityMenuItems(item) {
            return [
                { label: 'View Record', icon: 'fa-eye', action: () => (item.isClaim || item.isVoucher) ? this.viewClaimRecord(item) : this.viewRecord(item) },
                ((item.isDoc && this.canManageDocuments) || (item.isPay && this.canManagePayroll)) ? { label: 'Edit Record', icon: 'fa-pen', action: () => this.editRecord(item) } : null,
                ((item.isDoc && this.canDeleteDocuments) || (item.isPay && this.canDeletePayroll)) ? { label: 'Delete Record', icon: 'fa-trash', danger: true, action: () => this.confirmDeleteRecord(item) } : null
            ];
        },
        clientDirectoryRowMenuItems(cust) {
            return [
                { label: 'View Client Information', icon: 'fa-eye', action: () => this.openClientView(cust) },
                this.canManageClients ? { label: 'Edit Client', icon: 'fa-pen', action: () => this.requestClientAction('edit', cust) } : null,
                this.canDeleteClients ? { label: 'Delete Client', icon: 'fa-trash', danger: true, action: () => this.requestClientAction('delete', cust) } : null
            ];
        },
        employeeRowMenuItems(emp) {
            return [
                { label: 'View Employee Information', icon: 'fa-eye', action: () => this.openEmployeeView(emp) },
                this.employeeHasActiveProjectWork(emp.empNo) ? { label: 'View Active Project Assignments', icon: 'fa-diagram-project', action: () => this.viewEmployeeProjectAssignments(emp) } : null,
                this.canManageEmployees ? { label: 'Edit Employee', icon: 'fa-pen', action: () => this.requestEmployeeAction('edit', emp) } : null,
                this.canDeleteEmployees ? { label: 'Delete Employee', icon: 'fa-trash', danger: true, action: () => this.requestEmployeeAction('delete', emp) } : null
            ];
        },
        clientDocumentMenuItems(item) {
            return [
                { label: 'View', icon: 'fa-eye', action: () => this.viewClientDocument(item) },
                { label: 'Download', icon: 'fa-download', action: () => this.downloadClientDocument(item) },
                this.canManageDocuments ? { label: 'Remove', icon: 'fa-trash', danger: true, action: () => this.requestDeleteClientDocument(item) } : null
            ];
        },
        websiteContentMenuItems(item) {
            return [
                this.hasModulePermission('website-content', 'edit') ? { label: 'Edit', icon: 'fa-pen', action: () => this.openWebsiteContentModal(this.websiteContentTab, item) } : null,
                this.hasModulePermission('website-content', 'delete') ? { label: 'Delete', icon: 'fa-trash', danger: true, action: () => this.deleteWebsiteContentItem(this.websiteContentTab, item) } : null
            ];
        },
        siteTextRowMenuItems(row) {
            return [
                this.hasModulePermission('website-content', 'edit') ? { label: 'Edit', icon: 'fa-pen', action: () => this.openSiteTextModal(row) } : null,
                (row.override && this.hasModulePermission('website-content', 'delete')) ? { label: 'Reset to Default', icon: 'fa-rotate-left', danger: true, action: () => this.resetSiteTextOverride(row.key) } : null
            ];
        },
        // Built from the same STAFF_PORTAL_ACTIONS list as the row buttons, so
        // right-clicking a row offers exactly what its buttons offer - never one
        // action more, never one less.
        portalUserRowMenuItems(usr) {
            return this.staffPortalActionsFor(usr).map(action => ({
                label: action.label,
                icon: action.icon,
                danger: action.key === 'delete',
                action: () => this.runStaffPortalAction(action.key, usr)
            }));
        },
        accessRequestRowMenuItems(request) {
            if ((request?.status || 'Pending') !== 'Pending') return [];
            return this.staffPortalRequestActions().map(action => ({
                label: action.label,
                icon: action.icon,
                danger: action.key === 'reject',
                action: () => this.runAccessRequestAction(action.key, request)
            }));
        },
        projectActivityMenuItems(activity) {
            return [
                (activity.status !== 'Done' && this.canCompleteProjectActivity(activity)) ? { label: 'Mark Done', icon: 'fa-check', action: () => this.markProjectActivityDone(activity) } : null,
                this.canEditProjectActivity(activity) ? { label: 'Edit Activity', icon: 'fa-pen', action: () => this.openActivityModal(this.projectPreview.project, activity) } : null,
                this.canDeleteProjectActivity() ? { label: 'Delete Activity', icon: 'fa-trash', danger: true, action: () => this.deleteProjectActivity(activity) } : null
            ];
        },
        clientUpdateMenuItems(update) {
            return [
                (this.canEditClientUpdate(update) && this.editingReplyId !== update.id) ? { label: 'Edit', icon: 'fa-pen', action: () => update.senderRole === 'Client' ? this.startEditReply(update) : this.openClientUpdateModal(this.projectPreview.project, update) } : null,
                this.canDeleteClientUpdate(update) ? { label: 'Delete', icon: 'fa-trash', danger: true, action: () => this.deleteClientUpdate(update) } : null
            ];
        },
        requestClientAction(action, cust) {
            this.clientActionConfirm = { show: true, action, client: cust };
        },
        async confirmClientAction() {
            const { action, client } = this.clientActionConfirm;
            this.clientActionConfirm = { show: false, action: '', client: null };
            if (!client) return;
            if (action === 'edit') this.editCustomer(client);
            if (action === 'delete') await this.deleteCustomer(client, false);
        },
        editCustomer(cust) {
            if (!this.canManageClients) { this.showNotify('You do not have permission to update client records.'); return; }
            this.openClientInformation(cust);
        },
        async deleteCustomer(clientOrName, requiresConfirmation = true) {
            const client = typeof clientOrName === 'string' ? this.customers.find(cust => cust.clientName === clientOrName) : clientOrName;
            if (requiresConfirmation) {
                if (client) this.requestClientAction('delete', client);
                return;
            }
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete client records.'); return; }
            if (!client || !client.id) { this.showNotify('Unable to delete client.'); return; }
            try { await deleteDoc(doc(db, "customers", client.id)); this.showNotify('Client deleted.'); } catch (error) { this.showNotify('Unable to delete client.'); }
        },

        openEmployeeModal(emp = null) {
            if (!this.canManageEmployees) { this.showNotify('You do not have permission to update employee records.'); return; }
            const sensitiveFields = ['ic', 'bankAcc', 'epfNo', 'socsoNo', 'eisNo', 'taxNo'];
            if (emp) {
                this.employeeModal.isEdit = true;
                this.employeeModal.form = JSON.parse(JSON.stringify(emp));
                this.employeeModal.originalSensitive = Object.fromEntries(sensitiveFields.map(field => [field, emp[field] || '']));
                sensitiveFields.forEach(field => { this.employeeModal.form[field] = ''; });
            } else {
                this.employeeModal.isEdit = false;
                this.employeeModal.originalSensitive = {};
                this.employeeModal.form = { empNo: 'ZEN-HR' + String(Math.floor(1000+Math.random()*9000)), name: '', email: '', ic: '', dept: '', position: '', employmentType: 'Probation', status: 'Aktif', epfNo: '', socsoNo: '', eisNo: '', taxNo: '', bankAcc: '', isSenior: false, joinDate: new Date().toISOString().substr(0,10), basicSalary: 0, allowance: 0, deduction: 0 };
            }
            this.employeeModal.show = true;
        },
        async saveEmployee() {
            try {
                if (!this.canManageSensitiveData) { this.showNotify('Only HR, Superadmin and Director can update sensitive employee information.'); return; }
                const form = this.employeeModal.form;
                Object.assign(form, this.normalizeOfficialRecord(form));
                form.email = String(form.email || '').trim().toLowerCase();
                const sensitiveFields = ['ic', 'bankAcc', 'epfNo', 'socsoNo', 'eisNo', 'taxNo'];
                if (!form.empNo || !form.name || !form.dept || !form.joinDate || !form.employmentType) return this.showNotify("Complete the required Basic Information fields.");
                if (!this.employeeModal.isEdit && !form.ic) return this.showNotify("National ID / Passport is required for a new employee.");
                form.email = String(form.email || '').trim().toLowerCase();
                if (sensitiveFields.some(field => /^X{5}/i.test(String(form[field] || '').trim()))) return this.showNotify("Enter the complete sensitive number, not a masked value.");
                // National ID/Passport, Bank Account and EPF/SOCSO can only be set once at
                // creation — once the employee record already exists, changing them is
                // Superadmin/Director only (the inputs are also disabled for anyone else on
                // an existing record; this is the server-side-facing guard in case of a
                // direct API call). Leaving a field blank always means "keep unchanged" and
                // is never blocked, matching the existing masked-placeholder UX.
                const lockedFields = ['ic', 'bankAcc', 'epfNo', 'socsoNo'];
                if (this.employeeModal.isEdit && !this.canEditLockedIdentityFields &&
                    lockedFields.some(field => String(form[field] || '').trim() && String(form[field] || '').trim() !== String(this.employeeModal.originalSensitive[field] || '').trim())) {
                    return this.showNotify('Only Superadmin and Director may change National ID/Passport, Bank Account or EPF/SOCSO on an existing employee record.');
                }
                sensitiveFields.forEach(field => {
                    if (this.employeeModal.isEdit && !String(form[field] || '').trim()) form[field] = this.employeeModal.originalSensitive[field] || '';
                });
                const employeeId = form.empNo.trim();
                const wasEdit = this.employeeModal.isEdit;
                await setDoc(doc(db, "employees", employeeId), { ...form, empNo: employeeId }, { merge: true });
                if (wasEdit) await this.syncEmployeeIdentityReferences({ ...form, empNo: employeeId });
                this.employeeModal.show = false; this.logAudit(wasEdit ? 'UPDATE':'CREATE', `Saved employee ${employeeId}`); this.showNotify(wasEdit ? 'Employee and linked records updated.' : 'Employee data saved!');
            } catch (error) { console.error('Employee save failed:', error); this.showNotify('Unable to save employee information.'); }
        },
        async syncEmployeeIdentityReferences(employee) {
            const employeeId = String(employee.empNo || '').trim();
            if (!employeeId) throw new Error('Employee ID is required to synchronize linked records.');

            // Projects stay live (an active PIC assignment should always show current
            // identity), but claims/vouchers/payslips are point-in-time payroll and
            // audit records: once a claim/voucher is Approved (or a payslip is issued
            // at all — this app has no "draft" payslip state, every payslip record IS
            // the issued document), it must keep showing the employee's name/position/
            // department exactly as they were on that date. Retroactively rewriting an
            // approved claim or an old payslip just because the employee was later
            // promoted or moved departments would falsify the historical record — so
            // only still-pending claims/vouchers are synced, and payslips are never
            // touched by this cascade at all.
            // employees/{empNo} (this HR record) and users/{uid} (the same person's portal
            // login/access record, if they have one) are separate documents — editing the
            // employee's name here does NOT touch users/{uid}.name on its own. That divorce
            // is what left approverNameLive() (Approval Workflow, Approved/Rejected by)
            // showing a stale name after an HR edit: it reads live from `this.users`, which
            // is sourced from users/{uid}, not from employees/{empNo}. Bridge them by email.
            const normalizedEmail = String(employee.email || '').trim().toLowerCase();
            const [claimsSnapshot, vouchersSnapshot, projectsSnapshot, usersSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'claims'), where('empNo', '==', employeeId))),
                getDocs(query(collection(db, 'payment_vouchers'), where('empNo', '==', employeeId))),
                getDocs(query(collection(db, 'projects'), where('ownerEmpNo', '==', employeeId))),
                normalizedEmail ? getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail))) : Promise.resolve(null)
            ]);
            const writes = [];
            claimsSnapshot.forEach(record => {
                if (record.data().status === 'Approved') return;
                writes.push({
                    ref: record.ref,
                    data: {
                        name: employee.name || '',
                        position: employee.position || '',
                        dept: employee.dept || '',
                        empEmail: employee.email || ''
                    }
                });
            });
            vouchersSnapshot.forEach(record => {
                if (record.data().status === 'Approved') return;
                writes.push({
                    ref: record.ref,
                    data: {
                        name: employee.name || '',
                        position: employee.position || '',
                        dept: employee.dept || '',
                        empEmail: employee.email || ''
                    }
                });
            });
            projectsSnapshot.forEach(record => writes.push({
                ref: record.ref,
                data: {
                    ownerName: employee.name || '',
                    ownerEmail: String(employee.email || '').trim().toLowerCase(),
                    ownerPosition: employee.position || '',
                    ownerDepartment: employee.dept || ''
                }
            }));
            // Name only — role and email stay untouched here, and firestore.rules
            // only grants HR write access to exactly this one field on someone else's
            // users/{uid} record (see the users match block), matching this cascade's scope.
            if (employee.name && usersSnapshot) usersSnapshot.forEach(record => writes.push({ ref: record.ref, data: { name: employee.name } }));

            for (let start = 0; start < writes.length; start += 450) {
                const batch = writeBatch(db);
                writes.slice(start, start + 450).forEach(item => batch.update(item.ref, item.data));
                await batch.commit();
            }
        },
        // ONE-TIME ADMIN MIGRATION: move legacy Payment Voucher records that still live inside the
        // shared 'claims' collection into their own dedicated 'payment_vouchers' collection. Each
        // record is copied to its new home and only then deleted from 'claims' inside a single atomic
        // batch, so a mid-way failure (e.g. rules not deployed yet) leaves the original data untouched.
        async migrateLegacyPaymentVouchers() {
            if (!['Superadmin', 'Director'].includes(this.userProfile.role)) { this.showNotify('Only Superadmin and Director can run this migration.'); return; }
            const legacyVouchers = this.claimsHistory.filter(c => (c.documentType || c.type) === 'Payment Voucher');
            if (!legacyVouchers.length) { this.showNotify('No legacy Payment Voucher records found inside the Claims collection.'); return; }
            if (!await this.askConfirm({
                title: 'Migrate legacy payment vouchers?',
                message: `${legacyVouchers.length} Payment Voucher record(s) move out of the Claims collection into the dedicated Payment Vouchers collection. This requires the updated firestore.rules to already be deployed. Each record is copied first, then removed from Claims — if anything fails, no data is lost.`,
                confirmLabel: 'Yes, Migrate'
            })) return;
            try {
                for (let start = 0; start < legacyVouchers.length; start += 400) {
                    const batch = writeBatch(db);
                    legacyVouchers.slice(start, start + 400).forEach(record => {
                        const { id, ...rest } = record;
                        batch.set(doc(db, 'payment_vouchers', id), { ...rest, id, documentType: 'Payment Voucher', type: 'Payment Voucher' }, { merge: true });
                        batch.delete(doc(db, 'claims', id));
                    });
                    await batch.commit();
                }
                this.logAudit('UPDATE', `Migrated ${legacyVouchers.length} legacy Payment Voucher record(s) into the dedicated payment_vouchers collection.`);
                this.showNotify(`${legacyVouchers.length} Payment Voucher record(s) migrated successfully.`);
            } catch (error) {
                console.error('Payment Voucher migration failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'migrate legacy payment vouchers'));
            }
        },
        openEmployeeView(emp) {
            this.employeeView.employee = {
                empNo: emp.empNo || '-', name: emp.name || '-', email: emp.email || '-', position: emp.position || '-', dept: emp.dept || '-',
                employmentType: emp.employmentType || '-', status: emp.status || '-', joinDate: emp.joinDate || '-', isSenior: !!emp.isSenior,
                presenceStatus: this.employeePresenceLabel(emp), presenceDetail: this.employeeLastSeen(emp),
                ic: this.maskSensitive(emp.ic), bankAcc: this.maskSensitive(emp.bankAcc), epfNo: this.maskSensitive(emp.epfNo),
                socsoNo: this.maskSensitive(emp.socsoNo), eisNo: this.maskSensitive(emp.eisNo), taxNo: this.maskSensitive(emp.taxNo),
                basicSalary: this.formatCurrency(emp.basicSalary), allowance: this.formatCurrency(emp.allowance), deduction: this.formatCurrency(emp.deduction)
            };
            this.employeeView.show = true;
        },
        requestEmployeeAction(action, emp) {
            this.employeeActionConfirm = { show: true, action, employee: emp };
        },
        async confirmEmployeeAction() {
            const { action, employee } = this.employeeActionConfirm;
            this.employeeActionConfirm = { show: false, action: '', employee: null };
            if (!employee) return;
            if (action === 'edit') this.openEmployeeModal(employee);
            if (action === 'delete') await this.deleteEmployee(employee.empNo, false);
        },
        employeeActiveProjectAssignments(empNo) {
            return this.projects.filter(project => project.ownerEmpNo === empNo && project.status !== 'Completed & Done');
        },
        employeeActiveActivityAssignments(empNo) {
            return this.projectActivities.filter(activity => activity.assignedEmpNo === empNo && activity.status !== 'Done');
        },
        employeeHasActiveProjectWork(empNo) {
            return this.employeeActiveProjectAssignments(empNo).length > 0 || this.employeeActiveActivityAssignments(empNo).length > 0;
        },
        viewEmployeeProjectAssignments(emp) {
            this.searchQuery = emp.name || emp.empNo;
            this.projectViewMode = 'list';
            this.switchTab('project-activities');
        },
        async deleteEmployee(empNo, requiresConfirmation = true) {
            if (requiresConfirmation) {
                const employee = this.employees.find(emp => emp.empNo === empNo);
                if (employee) this.requestEmployeeAction('delete', employee);
                return;
            }
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete employee records.'); return; }
            const blockingProjects = this.employeeActiveProjectAssignments(empNo);
            const blockingActivities = this.employeeActiveActivityAssignments(empNo);
            if (blockingProjects.length || blockingActivities.length) {
                const parts = [];
                if (blockingProjects.length) parts.push(`Person In Charge on ${blockingProjects.length} active project(s) (${blockingProjects.slice(0, 3).map(p => p.projectRef).join(', ')}${blockingProjects.length > 3 ? '…' : ''})`);
                if (blockingActivities.length) parts.push(`assigned to ${blockingActivities.length} open activity issue(s)`);
                this.showNotify(`Cannot delete: this employee is still ${parts.join(' and ')}. Reassign in Project Activities first.`);
                return;
            }
            try {
                await deleteDoc(doc(db, "employees", empNo));
                this.logAudit('DELETE', `Deleted employee ${empNo}`);
                this.showNotify('Employee deleted.');
            } catch (error) {
                this.showNotify('Unable to delete employee.');
            }
        },
        selectEmployeeFromTable(emp) {
            this.selectedPayEmployeeId = emp.empNo || '';
            this.payForm.empNo = emp.empNo || ''; this.payForm.name = emp.name || ''; this.payForm.empEmail = emp.email || ''; this.payForm.ic = emp.ic || ''; this.payForm.dept = emp.dept || ''; this.payForm.position = emp.position || ''; this.payForm.joinDate = emp.joinDate || ''; this.payForm.bankAcc = emp.bankAcc || ''; this.payForm.isSenior = !!emp.isSenior; this.payForm.epfSocso = `KWSP: ${emp.epfNo || '-'} | PERKESO: ${emp.socsoNo || '-'}`; this.payForm.basic = emp.basicSalary || 0;
            this.autoCalculatePayroll(); this.showNotify(`Employee loaded.`);
        },
        selectEmployeeForPayslip(e) { const emp = this.employees.find(x => x.empNo === e.target.value); if (emp) this.selectEmployeeFromTable(emp); },
        selectEmployeeForClaim(e) { const emp = this.employees.find(x => x.empNo === e.target.value); if (emp) { this.claimForm.name = emp.name||''; this.claimForm.empNo = emp.empNo||''; this.claimForm.empEmail = emp.email||''; this.claimForm.position = emp.position||''; this.claimForm.dept = emp.dept||''; this.showNotify(`Applicant loaded.`); } },
        selectEmployeeForVoucher(e) { const emp = this.employees.find(x => x.empNo === e.target.value); if (emp) { this.voucherForm.name = emp.name||''; this.voucherForm.empNo = emp.empNo||''; this.voucherForm.empEmail = emp.email||''; this.voucherForm.position = emp.position||''; this.voucherForm.dept = emp.dept||''; this.showNotify(`Requested-by staff loaded.`); } },

        // ================================================================
        // EXPENSE CLAIM FLOW — dedicated end-to-end pipeline for 'claims' collection
        // WORKFLOW: Staff/Client -> HR -> Account -> Director (final approval)
        // ================================================================
        canApproveClaim(clm) {
            const role = this.userProfile.role;
            if (this.isFullAccessRole) return typeof clm.status === 'string' && clm.status.startsWith('Pending');
            const expectedStatus = { HR: 'Pending HR', Account: 'Pending Account', Director: 'Pending Director' }[role];
            return !!expectedStatus && clm.status === expectedStatus && (!clm.assignedToEmail || clm.assignedToEmail === this.userProfile.email);
        },
        canEditClaim(clm) {
            return (clm.createdByUid === this.userProfile.uid || clm.empEmail === this.userProfile.email) && clm.status === 'Pending HR';
        },
        claimStageStamp(record, role) {
            if (!Array.isArray(record?.approvalHistory)) return null;
            return [...record.approvalHistory].reverse().find(entry => entry.role === role) || null;
        },
        // approvedByName/rejectedByName (top-level and inside approvalHistory entries) are
        // a name snapshot taken at the moment of that decision — unlike a payslip's
        // frozen payroll figures, "who approved this" is just an identity reference, so
        // if that person's name is later corrected in HR Employees (a typo fix, a legal
        // name change), the approval trail should show their current name rather than
        // whatever was on file that day. Falls back to the snapshot if the approver's
        // account can't be found live (e.g. the account was later deleted).
        approverNameLive(uid, fallbackName) {
            if (!uid) return fallbackName || '';
            const user = this.users.find(u => u.id === uid);
            return user?.name || fallbackName || '';
        },
        // Same idea as approverNameLive, but for "who requested/submitted this claim or
        // voucher" — matched by empNo against the live employees directory (not `users`,
        // since empNo/dept are HR-managed attributes) rather than a name snapshot frozen
        // at submission time. Applies regardless of approval status: unlike the amount,
        // category or dates on a claim (which must stay exactly as approved — a real
        // financial record), the requester's own name is just an identity reference, same
        // reasoning as the approver's name.
        requesterNameLive(empNo, fallbackName) {
            if (!empNo) return fallbackName || '';
            const employee = this.employees.find(e => e.id === empNo || e.empNo === empNo);
            return employee?.name || fallbackName || '';
        },
        requesterDeptLive(empNo, fallbackDept) {
            if (!empNo) return fallbackDept || '';
            const employee = this.employees.find(e => e.id === empNo || e.empNo === empNo);
            return employee?.dept || fallbackDept || '';
        },
        // Bulk approval — HR/Account only. Director decisions always require a
        // per-record supporting document attachment (see approveClaim/
        // approvePaymentVoucher), so bulk-approving isn't offered for Director;
        // each Director decision stays a deliberate, individual action.
        toggleClaimSelection(id) {
            const idx = this.selectedClaimIds.indexOf(id);
            if (idx === -1) this.selectedClaimIds.push(id); else this.selectedClaimIds.splice(idx, 1);
        },
        toggleVoucherSelection(id) {
            const idx = this.selectedVoucherIds.indexOf(id);
            if (idx === -1) this.selectedVoucherIds.push(id); else this.selectedVoucherIds.splice(idx, 1);
        },
        async bulkApproveSelectedClaims() {
            if (this.isFullAccessRole) { this.showNotify('Final approvals require an individual supporting document per claim — please approve one at a time.'); return; }
            const targets = this.claimsHistory.filter(c => this.selectedClaimIds.includes(c.id) && this.canApproveClaim(c));
            if (!targets.length) { this.showNotify('No eligible claims selected.'); return; }
            if (!await this.askConfirm({
                title: 'Approve selected claims?',
                message: `${targets.length} selected claim(s) will be approved and forwarded to the next reviewer.`,
                confirmLabel: 'Yes, Approve'
            })) return;
            let succeeded = 0;
            for (const clm of targets) { if (await this.approveClaim(clm)) succeeded++; }
            this.selectedClaimIds = [];
            this.showNotify(`${succeeded} of ${targets.length} claim(s) approved and forwarded.`);
        },
        async bulkApproveSelectedVouchers() {
            if (this.isFullAccessRole) { this.showNotify('Final approvals require an individual supporting document per voucher — please approve one at a time.'); return; }
            const targets = this.paymentVouchers.filter(v => this.selectedVoucherIds.includes(v.id) && this.canApprovePaymentVoucher(v));
            if (!targets.length) { this.showNotify('No eligible vouchers selected.'); return; }
            if (!await this.askConfirm({
                title: 'Approve selected vouchers?',
                message: `${targets.length} selected voucher(s) will be approved and forwarded to the next reviewer.`,
                confirmLabel: 'Yes, Approve'
            })) return;
            let succeeded = 0;
            for (const pv of targets) { if (await this.approvePaymentVoucher(pv)) succeeded++; }
            this.selectedVoucherIds = [];
            this.showNotify(`${succeeded} of ${targets.length} voucher(s) approved and forwarded.`);
        },
        async approveClaim(clm) {
            if (!this.canApproveClaim(clm)) { this.showNotify('You do not have permission to approve this record at its current workflow stage.'); return false; }
            if (this.attachmentUploadState.director) { this.showNotify('Wait for the Director approval document upload to finish.'); return false; }
            const isDirectorDecision = this.isFullAccessRole;
            const nextRole = isDirectorDecision ? null : { 'Pending HR': 'Account', 'Pending Account': 'Director' }[clm.status];
            const roleNames = { HR: 'Human Resource Management', Account: 'Finance Account Management', Director: 'Director' };
            if (isDirectorDecision && !this.claimPreview.directorApprovalAttachment) { this.showNotify('Director approval requires a supporting document attachment.'); return; }
            const bypassedReviews = clm.status === 'Pending HR' ? ['HR', 'Account'] : clm.status === 'Pending Account' ? ['Account'] : [];
            const nowIso = new Date().toISOString();
            const existingHistory = Array.isArray(clm.approvalHistory) ? clm.approvalHistory : [];
            const bypassEntries = bypassedReviews.map(role => ({ role, roleName: roleNames[role] || role, bypassed: true, note: 'Bypassed by Director direct approval', recordedAt: nowIso }));
            const approvalHistory = [
                ...existingHistory,
                ...bypassEntries,
                { role: this.userProfile.role, roleName: roleNames[this.userProfile.role] || this.userProfile.role, approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedAt: nowIso }
            ];
            const update = nextRole
                ? { status: `Pending ${nextRole}`, assignedToUid: '', assignedToName: roleNames[nextRole], assignedToEmail: '', assignedToRole: nextRole, approvalHistory }
                : { status: 'Approved', finalDecision: true, settlementStatus: 'Approved', statusDetail: 'Claim fully approved', approvalPath: 'Director Direct Approval', approvalPreviousStatus: clm.status, bypassedReviews, assignedToUid: this.userProfile.uid, assignedToName: this.userProfile.name, assignedToEmail: this.userProfile.email, assignedToRole: 'Director', approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedByRole: 'Director', approvedAt: nowIso, directorApprovalAttachment: this.claimPreview.directorApprovalAttachment, directorApprovalAttachmentName: this.claimPreview.directorApprovalAttachmentName, directorApprovalOriginalBytes: Number(this.claimPreview.directorApprovalOriginalBytes || 0), approvalHistory };
            try {
                if (!nextRole && this.getSerializedSize({ ...clm, ...update }) > 800 * 1024) throw Object.assign(new Error('The combined claim record exceeds the safe Firestore size.'), { code: 'resource-exhausted' });
                await updateDoc(doc(db, "claims", clm.id), update);
                this.logAudit('UPDATE', `Claim ${clm.receiptNo} ${nextRole ? `forwarded to ${roleNames[nextRole]}` : `directly and finally approved by Director${bypassedReviews.length ? ` (bypassed ${bypassedReviews.join(' and ')})` : ''}`}`);
                this.showNotify(nextRole ? `Claim assigned to ${roleNames[nextRole]}.` : 'Director approval completed immediately. No further HR or Finance review is required.');
                if (nextRole) this.notifyByEmail({
                    to: this.emailsForRole(nextRole),
                    subject: `Expense Claim Pending Your Review — ${clm.receiptNo}`,
                    heading: 'Expense Claim Forwarded To You',
                    message: `${clm.name}'s expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) was approved by ${roleNames[this.userProfile.role]} and is now pending your review.`
                }); else this.notifyByEmail({
                    to: clm.empEmail,
                    subject: `Your Expense Claim Was Approved — ${clm.receiptNo}`,
                    heading: 'Expense Claim Approved',
                    message: `Your expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) has been fully approved by the Director. No further action is needed on your part.`
                });
                return true;
            } catch (error) {
                console.error('Claim approval failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the claim status'));
                return false;
            }
        },
        async approveClaimFromPreview() {
            const approved = await this.approveClaim(this.claimPreview.claim);
            if (approved) this.claimPreview.show = false;
        },
        async rejectClaim(clm) {
            if (!this.canApproveClaim(clm)) { this.showNotify('You do not have permission to reject this record at its current workflow stage.'); return; }
            if (!await this.askConfirm({
                title: 'Reject this claim?',
                message: `Claim ${clm.receiptNo} for ${this.formatCurrency(clm.amount)} will be rejected and the claimant notified by email.`,
                confirmLabel: 'Yes, Reject Claim',
                danger: true
            })) return;
            try { await updateDoc(doc(db, "claims", clm.id), { status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString() }); this.showNotify("Claim rejected."); this.notifyByEmail({ to: clm.empEmail, subject: `Your Expense Claim Was Rejected — ${clm.receiptNo}`, heading: 'Expense Claim Rejected', message: `Your expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.` }); } catch (error) { this.showNotify('Unable to reject claim.'); }
        },
        async saveExpenseClaim() {
            if (!['Superadmin', 'Director', 'HR', 'Account', 'Staff'].includes(this.userProfile.role)) { this.showNotify('Your role cannot submit expense claims.'); return; }
            if (this.attachmentUploadState.receipt) return this.showNotify('Wait for the receipt upload to finish.');
            Object.assign(this.claimForm, this.normalizeOfficialRecord(this.claimForm));
            this.claimForm.empEmail = String(this.claimForm.empEmail || '').trim().toLowerCase();
            if (!this.claimForm.name || !this.claimForm.empNo || !this.claimForm.amount || !this.claimForm.receiptNo || !this.claimForm.description.trim() || !this.claimForm.receiptAttachment) return this.showNotify("Complete all required claim fields, including Expense Description and Receipt Attachment.");
            try {
                const initialStatus = 'Pending HR';
                const assignee = { id: '', name: 'Human Resource Management', email: '', role: 'HR' };
                const signedInEmail = String(auth.currentUser?.email || this.userProfile.email || '').trim().toLowerCase();
                const canSubmitForOthers = ['Superadmin', 'Director', 'HR', 'Account'].includes(this.userProfile.role);
                const claimOwnerEmail = canSubmitForOthers ? String(this.claimForm.empEmail || signedInEmail).trim().toLowerCase() : signedInEmail;
                if (!auth.currentUser?.uid || !claimOwnerEmail) throw Object.assign(new Error('Your login identity is incomplete. Sign out and sign in again.'), { code: 'permission-denied' });

                const claimId = String(this.editingClaimId || Date.now());
                const payload = { id: claimId, type: 'Claim', documentType: 'Claim', date: this.claimForm.expenseDate, expenseDate: this.claimForm.expenseDate, name: this.claimForm.name, empNo: this.claimForm.empNo, empEmail: claimOwnerEmail, position: this.claimForm.position || '', dept: this.claimForm.dept, category: this.claimForm.category, subCategory: this.claimForm.subCategory, amount: Number(this.claimForm.amount), receiptNo: this.claimForm.receiptNo, description: this.claimForm.description, receiptAttachment: this.claimForm.receiptAttachment, receiptAttachmentName: this.claimForm.receiptAttachmentName || '', receiptAttachmentOriginalBytes: Number(this.claimForm.receiptAttachmentOriginalBytes || 0), createdByUid: this.editingClaimId ? (this.claimForm.createdByUid || auth.currentUser.uid) : auth.currentUser.uid, createdByEmail: this.editingClaimId ? (this.claimForm.createdByEmail || signedInEmail) : signedInEmail, createdAt: this.editingClaimId ? (this.claimForm.createdAt || new Date().toISOString()) : new Date().toISOString(), status: this.editingClaimId ? (this.claimForm.status || initialStatus) : initialStatus, assignedToUid: assignee.id, assignedToName: assignee.name, assignedToEmail: assignee.email, assignedToRole: assignee.role };
                if (this.getSerializedSize(payload) > 800 * 1024) throw Object.assign(new Error('The claim record exceeds the safe Firestore size.'), { code: 'resource-exhausted' });
                await setDoc(doc(db, "claims", claimId), payload, { merge: true });
                if (!this.editingClaimId) this.notifyByEmail({
                    to: this.emailsForRole('HR'),
                    subject: `New Expense Claim Pending Review — ${payload.receiptNo}`,
                    heading: 'New Expense Claim Submitted',
                    message: `${payload.name} (${payload.empNo}) submitted an expense claim of ${this.formatCurrency(payload.amount)} for "${payload.category}". It is now pending your review in Claims & Payment Vouchers.`
                });
                this.editingClaimId = null; this.showNotify(`Expense claim submitted.`); this.resetClaimForm();
            } catch (error) { console.error('Claim save failed:', error); this.showNotify(this.getFirestoreWriteError(error, 'submit the claim')); }
        },
        editClaimRecord(clm) { this.claimFormMode = 'Claim'; this.editingClaimId = clm.id; this.selectedClaimEmployeeId = clm.empNo || ''; this.claimForm = JSON.parse(JSON.stringify(clm)); this.switchTab('claims'); },
        cancelEditClaim() { this.editingClaimId = null; this.resetClaimForm(); },
        async printApprovedClaim(claim) {
            if (!claim || claim.status !== 'Approved') { this.showNotify('Only approved claims can be printed.'); return; }
            this.claimPrint = JSON.parse(JSON.stringify(claim));
            this.activePrintModule = 'CLAIM';
            this.setPrintOrientation('portrait', '15mm');
            await this.$nextTick();
            window.print();
        },

        // ================================================================
        // PAYMENT VOUCHER FLOW — dedicated end-to-end pipeline for 'payment_vouchers' collection
        // WORKFLOW: Staff/Client -> HR -> Account -> Director (final approval), independent of Expense Claims
        // ================================================================
        canApprovePaymentVoucher(pv) {
            const role = this.userProfile.role;
            if (this.isFullAccessRole) return typeof pv.status === 'string' && pv.status.startsWith('Pending');
            const expectedStatus = { HR: 'Pending HR', Account: 'Pending Account', Director: 'Pending Director' }[role];
            return !!expectedStatus && pv.status === expectedStatus && (!pv.assignedToEmail || pv.assignedToEmail === this.userProfile.email);
        },
        canEditPaymentVoucher(pv) {
            return (pv.createdByUid === this.userProfile.uid || pv.empEmail === this.userProfile.email) && pv.status === 'Pending HR';
        },
        async approvePaymentVoucher(pv) {
            if (!this.canApprovePaymentVoucher(pv)) { this.showNotify('You do not have permission to approve this record at its current workflow stage.'); return false; }
            if (this.attachmentUploadState.director) { this.showNotify('Wait for the Director approval document upload to finish.'); return false; }
            const isDirectorDecision = this.isFullAccessRole;
            const nextRole = isDirectorDecision ? null : { 'Pending HR': 'Account', 'Pending Account': 'Director' }[pv.status];
            const roleNames = { HR: 'Human Resource Management', Account: 'Finance Account Management', Director: 'Director' };
            if (isDirectorDecision && !this.claimPreview.directorApprovalAttachment) { this.showNotify('Director approval requires a supporting document attachment.'); return; }
            const bypassedReviews = pv.status === 'Pending HR' ? ['HR', 'Account'] : pv.status === 'Pending Account' ? ['Account'] : [];
            const nowIso = new Date().toISOString();
            const existingHistory = Array.isArray(pv.approvalHistory) ? pv.approvalHistory : [];
            const bypassEntries = bypassedReviews.map(role => ({ role, roleName: roleNames[role] || role, bypassed: true, note: 'Bypassed by Director direct approval', recordedAt: nowIso }));
            const approvalHistory = [
                ...existingHistory,
                ...bypassEntries,
                { role: this.userProfile.role, roleName: roleNames[this.userProfile.role] || this.userProfile.role, approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedAt: nowIso }
            ];
            const update = nextRole
                ? { status: `Pending ${nextRole}`, assignedToUid: '', assignedToName: roleNames[nextRole], assignedToEmail: '', assignedToRole: nextRole, approvalHistory }
                : { status: 'Approved', finalDecision: true, settlementStatus: 'Paid', statusDetail: 'Payment fully paid', approvalPath: 'Director Direct Approval', approvalPreviousStatus: pv.status, bypassedReviews, assignedToUid: this.userProfile.uid, assignedToName: this.userProfile.name, assignedToEmail: this.userProfile.email, assignedToRole: 'Director', approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedByRole: 'Director', approvedAt: nowIso, directorApprovalAttachment: this.claimPreview.directorApprovalAttachment, directorApprovalAttachmentName: this.claimPreview.directorApprovalAttachmentName, directorApprovalOriginalBytes: Number(this.claimPreview.directorApprovalOriginalBytes || 0), approvalHistory };
            try {
                if (!nextRole && this.getSerializedSize({ ...pv, ...update }) > 800 * 1024) throw Object.assign(new Error('The combined voucher record exceeds the safe Firestore size.'), { code: 'resource-exhausted' });
                await updateDoc(doc(db, "payment_vouchers", pv.id), update);
                this.logAudit('UPDATE', `Payment Voucher ${pv.voucherNo} ${nextRole ? `forwarded to ${roleNames[nextRole]}` : `directly and finally approved by Director${bypassedReviews.length ? ` (bypassed ${bypassedReviews.join(' and ')})` : ''}`}`);
                this.showNotify(nextRole ? `Voucher assigned to ${roleNames[nextRole]}.` : 'Director approval completed immediately. No further HR or Finance review is required.');
                if (nextRole) this.notifyByEmail({
                    to: this.emailsForRole(nextRole),
                    subject: `Payment Voucher Pending Your Review — ${pv.voucherNo}`,
                    heading: 'Payment Voucher Forwarded To You',
                    message: `${pv.name}'s payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) payable to "${pv.payeeName}" was approved by ${roleNames[this.userProfile.role]} and is now pending your review.`
                }); else this.notifyByEmail({
                    to: pv.empEmail,
                    subject: `Your Payment Voucher Was Approved — ${pv.voucherNo}`,
                    heading: 'Payment Voucher Approved',
                    message: `Your payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) has been fully approved by the Director. No further action is needed on your part.`
                });
                return true;
            } catch (error) {
                console.error('Voucher approval failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the voucher status'));
                return false;
            }
        },
        async approvePaymentVoucherFromPreview() {
            const approved = await this.approvePaymentVoucher(this.claimPreview.claim);
            if (approved) this.claimPreview.show = false;
        },
        async rejectPaymentVoucher(pv) {
            if (!this.canApprovePaymentVoucher(pv)) { this.showNotify('You do not have permission to reject this record at its current workflow stage.'); return; }
            if (!await this.askConfirm({
                title: 'Reject this payment voucher?',
                message: `Voucher ${pv.voucherNo} for ${this.formatCurrency(pv.amount)} will be rejected and the requester notified by email.`,
                confirmLabel: 'Yes, Reject Voucher',
                danger: true
            })) return;
            try { await updateDoc(doc(db, "payment_vouchers", pv.id), { status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString() }); this.showNotify("Payment voucher rejected."); this.notifyByEmail({ to: pv.empEmail, subject: `Your Payment Voucher Was Rejected — ${pv.voucherNo}`, heading: 'Payment Voucher Rejected', message: `Your payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.` }); } catch (error) { this.showNotify('Unable to reject voucher.'); }
        },
        async savePaymentVoucher() {
            if (!['Superadmin', 'Director', 'HR', 'Account', 'Staff'].includes(this.userProfile.role)) { this.showNotify('Your role cannot submit payment vouchers.'); return; }
            if (this.attachmentUploadState.receipt) return this.showNotify('Wait for the supporting document upload to finish.');
            Object.assign(this.voucherForm, this.normalizeOfficialRecord(this.voucherForm));
            this.voucherForm.empEmail = String(this.voucherForm.empEmail || '').trim().toLowerCase();
            if (!this.voucherForm.name || !this.voucherForm.empNo || !this.voucherForm.amount || !this.voucherForm.description.trim() || !this.voucherForm.receiptAttachment) return this.showNotify("Complete all required voucher fields, including Payment Description and Supporting Document.");
            if (!this.voucherForm.payeeName.trim() || !this.voucherForm.paymentPurpose.trim()) return this.showNotify('Complete the Payee Name and Payment Purpose for this Payment Voucher.');
            try {
                const initialStatus = 'Pending HR';
                const assignee = { id: '', name: 'Human Resource Management', email: '', role: 'HR' };
                const signedInEmail = String(auth.currentUser?.email || this.userProfile.email || '').trim().toLowerCase();
                const canSubmitForOthers = ['Superadmin', 'Director', 'HR', 'Account'].includes(this.userProfile.role);
                const voucherOwnerEmail = canSubmitForOthers ? String(this.voucherForm.empEmail || signedInEmail).trim().toLowerCase() : signedInEmail;
                if (!auth.currentUser?.uid || !voucherOwnerEmail) throw Object.assign(new Error('Your login identity is incomplete. Sign out and sign in again.'), { code: 'permission-denied' });

                const voucherId = String(this.editingVoucherId || Date.now());
                if (!this.voucherForm.voucherNo) this.voucherForm.voucherNo = `PV-${this.currentYear}-${String(Date.now()).slice(-6)}`;
                const payload = { id: voucherId, type: 'Payment Voucher', documentType: 'Payment Voucher', date: this.voucherForm.paymentDate, paymentDate: this.voucherForm.paymentDate, name: this.voucherForm.name, empNo: this.voucherForm.empNo, empEmail: voucherOwnerEmail, position: this.voucherForm.position || '', dept: this.voucherForm.dept, payeeName: this.voucherForm.payeeName, payeeType: this.voucherForm.payeeType || '', payeeReference: this.voucherForm.payeeReference || '', paymentPurpose: this.voucherForm.paymentPurpose, category: this.voucherForm.category, subCategory: this.voucherForm.subCategory, amount: Number(this.voucherForm.amount), voucherNo: this.voucherForm.voucherNo, description: this.voucherForm.description, receiptAttachment: this.voucherForm.receiptAttachment, receiptAttachmentName: this.voucherForm.receiptAttachmentName || '', receiptAttachmentOriginalBytes: Number(this.voucherForm.receiptAttachmentOriginalBytes || 0), createdByUid: this.editingVoucherId ? (this.voucherForm.createdByUid || auth.currentUser.uid) : auth.currentUser.uid, createdByEmail: this.editingVoucherId ? (this.voucherForm.createdByEmail || signedInEmail) : signedInEmail, createdAt: this.editingVoucherId ? (this.voucherForm.createdAt || new Date().toISOString()) : new Date().toISOString(), status: this.editingVoucherId ? (this.voucherForm.status || initialStatus) : initialStatus, assignedToUid: assignee.id, assignedToName: assignee.name, assignedToEmail: assignee.email, assignedToRole: assignee.role };
                if (this.getSerializedSize(payload) > 800 * 1024) throw Object.assign(new Error('The voucher record exceeds the safe Firestore size.'), { code: 'resource-exhausted' });
                await setDoc(doc(db, "payment_vouchers", voucherId), payload, { merge: true });
                if (!this.editingVoucherId) this.notifyByEmail({
                    to: this.emailsForRole('HR'),
                    subject: `New Payment Voucher Pending Review — ${payload.voucherNo}`,
                    heading: 'New Payment Voucher Submitted',
                    message: `${payload.name} (${payload.empNo}) submitted a payment voucher of ${this.formatCurrency(payload.amount)} payable to "${payload.payeeName}". It is now pending your review in Claims & Payment Vouchers.`
                });
                this.editingVoucherId = null; this.showNotify(`Payment voucher submitted.`); this.resetVoucherForm();
            } catch (error) { console.error('Voucher save failed:', error); this.showNotify(this.getFirestoreWriteError(error, 'submit the payment voucher')); }
        },
        editPaymentVoucher(pv) { this.claimFormMode = 'Payment Voucher'; this.editingVoucherId = pv.id; this.selectedVoucherEmployeeId = pv.empNo || ''; this.voucherForm = JSON.parse(JSON.stringify(pv)); this.switchTab('claims'); },
        cancelEditVoucher() { this.editingVoucherId = null; this.resetVoucherForm(); },
        async printApprovedVoucher(voucher) {
            if (!voucher || voucher.status !== 'Approved') { this.showNotify('Only approved payment vouchers can be printed.'); return; }
            this.claimPrint = JSON.parse(JSON.stringify(voucher));
            this.activePrintModule = 'CLAIM';
            this.setPrintOrientation('portrait', '15mm');
            await this.$nextTick();
            window.print();
        },

        setPrintOrientation(orientation, margin) { const styleEl = document.getElementById('dynamic-print-orientation'); if (styleEl) styleEl.innerHTML = `@media print { @page { size: A4 ${orientation}; margin: ${margin} !important; } }`; },
        async printDocumentModule() { if (!this.clientSavedForDocument) return this.showNotify('Select a registered client before previewing or printing this document.'); this.activePrintModule = this.docForm.type === 'Quotation' ? 'QUOTATION' : 'INVOICE'; this.setPrintOrientation('portrait', '15mm'); setTimeout(() => { window.print(); }, 250); },
        async printPayslipModule() { if (!this.payForm.name || !this.payForm.empNo) return this.showNotify('Enter Name and Emp ID.'); this.autoCalculatePayroll(); this.activePrintModule = 'PAYSLIP'; this.setPrintOrientation('landscape', '0mm'); setTimeout(() => { window.print(); }, 250); },
        createInvoiceFromQuotation(quotation) {
            if (!this.canManageBillingWorkflow || quotation?.type !== 'Quotation' || quotation.status !== 'Accepted') {
                this.showNotify('Only a Director or Superadmin can prepare an invoice from an accepted quotation.', 'error'); return;
            }
            const source = JSON.parse(JSON.stringify(quotation.raw || {}));
            this.editingDocId = null;
            this.docForm = {
                ...source,
                type: 'Invoice',
                docNo: '',
                status: 'Draft',
                paymentRefNo: '',
                paymentAttachment: '',
                sourceQuotationId: quotation.id,
                sourceQuotationNo: quotation.docNo || '',
                date: new Date().toISOString().substr(0, 10),
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().substr(0, 10)
            };
            this.clientSavedForDocument = Boolean(this.docForm.customerId);
            this.generateDocNo();
            this.switchTab('document-quotations');
            this.showNotify(`Invoice draft prepared from ${quotation.docNo}. Review it, then Save as Draft or Send to Client.`);
        },
        async reviewPaymentProof(invoice, approved) {
            if (!this.canVerifyPaymentProof || !invoice?.paymentProofUrl) { this.showNotify('Only HR Management or Finance can verify a payment proof.', 'error'); return; }
            const { confirmed, note } = await this.askConfirmWithNote({
                title: approved ? 'Verify this payment?' : 'Reject this payment proof?',
                message: approved
                    ? `${invoice.docNo} will be marked Paid. The client, PIC and Director will be notified.`
                    : `${invoice.docNo} stays Unpaid. The client will be asked to upload a corrected proof.`,
                confirmLabel: approved ? 'Verify and Mark Paid' : 'Reject Proof',
                danger: !approved,
                noteLabel: approved ? 'Verification note (optional)' : 'Reason for rejection',
                notePlaceholder: approved ? 'Reference checked by Finance' : 'Explain what the client needs to correct'
            });
            if (!confirmed) return;
            try {
                await this.runBillingWorkflow('payment-proof-reviewed', invoice.id, { decision: approved ? 'approved' : 'rejected', note });
                this.logAudit('UPDATE', `${approved ? 'Verified' : 'Rejected'} payment proof for ${invoice.docNo}`);
                this.showNotify(approved ? `${invoice.docNo} is marked Paid.` : `Payment proof for ${invoice.docNo} was rejected; client has been notified.`);
            } catch (error) {
                console.error('Payment proof review failed:', error);
                this.showNotify(error.message || 'Unable to review the payment proof.', 'error');
            }
        },
        async discardInvoiceDraft(invoice) {
            if (!this.canDeleteBillingDocument(invoice) || invoice?.type !== 'Invoice' || invoice.status !== 'Draft') {
                this.showNotify('Only Director, Finance or Superadmin can discard an unsent invoice draft.', 'error'); return;
            }
            if (!await this.askConfirm({ title: 'Discard invoice draft?', message: `${invoice.docNo} has not been sent to the client and will be permanently removed.`, confirmLabel: 'Discard Draft', danger: true })) return;
            try {
                await deleteDoc(doc(db, 'docs', invoice.id));
                this.logAudit('DELETE', `Discarded unsent invoice draft ${invoice.docNo}`);
                this.showNotify('Invoice draft discarded.');
            } catch (error) {
                console.error('Invoice draft discard failed:', error);
                this.showNotify('Unable to discard this invoice draft.', 'error');
            }
        },
        async deleteInvoiceFromWorkflow(invoice) {
            if (!this.canDeleteBillingDocument(invoice) || invoice?.type !== 'Invoice') {
                this.showNotify('Only Director, Finance or Superadmin can delete an invoice.', 'error'); return;
            }
            if (!await this.askConfirm({ title: 'Delete invoice?', message: `${invoice.docNo} will be permanently removed. This can affect the Client document history.`, confirmLabel: 'Delete Invoice', danger: true })) return;
            try {
                await deleteDoc(doc(db, 'docs', invoice.id));
                this.logAudit('DELETE', `Deleted invoice ${invoice.docNo} from Client Billing Workflow`);
                this.showNotify('Invoice deleted.');
            } catch (error) {
                console.error('Invoice delete failed:', error);
                this.showNotify('Unable to delete this invoice.', 'error');
            }
        },
        
        async saveDocRecord() {
            try {
                if (this.attachmentUploadState.payment) { this.showNotify('Wait for the payment attachment upload to finish.'); return false; }
                if (!this.canManageDocuments) { this.showNotify('You do not have permission to save documents.'); return false; }
                if (['Paid', 'Partial'].includes(this.docForm.status) && (!this.docForm.paymentRefNo || this.docForm.paymentRefNo.trim() === '')) { this.showNotify("Payment Reference No. is REQUIRED."); return false; }
                const normalizedDocForm = this.normalizeOfficialRecord(this.docForm);
                normalizedDocForm.clientEmail = String(this.docForm.clientEmail || '').trim().toLowerCase();
                Object.assign(this.docForm, normalizedDocForm);
                const docId = String(this.editingDocId || Date.now());
                const linkedProject = this.projects.find(project => String(project.id || '') === String(this.docForm.projectId || ''));
                const payload = { id: docId, type: this.docForm.type, docNo: this.docForm.docNo, status: this.docForm.status || (this.docForm.type === 'Invoice' ? 'Unpaid' : 'Open'), paymentMethod: this.docForm.paymentMethod || 'Bank Transfer', paymentBank: this.docForm.paymentBank || '', paymentReceiver: this.docForm.paymentReceiver || '', paymentRefNo: this.docForm.paymentRefNo || '', paymentAttachment: this.docForm.paymentAttachment || '', date: this.docForm.date, name: this.docForm.clientName, amount: this.docGrandTotal, billingClientId: String(this.docForm.customerId || '').trim(), billingProjectId: String(this.docForm.projectId || '').trim(), billingPicEmail: String(linkedProject?.ownerEmail || '').trim().toLowerCase(), raw: JSON.parse(JSON.stringify(this.docForm)) };
                if (!this.clientSavedForDocument) { this.showNotify('Select a registered client before saving this document.'); return false; }
                // Hard guarantee, not just an implied one: every document must carry
                // its client's real customers/{id}, never just a name snapshot — two
                // clients can share a display name, and a name can be retyped/edited
                // later, but the id never changes. clientSavedForDocument being true
                // should already make this impossible to hit (selectCustomerForDoc
                // always sets docForm.customerId first), so this is a defensive
                // backstop, not the primary mechanism.
                if (!payload.raw.customerId) { this.showNotify('This document is missing its linked client ID — reselect a client from Client Information before saving this document.'); return false; }
                if (['Quotation', 'Invoice'].includes(payload.type) && !payload.raw.projectId) { this.showNotify('Select the exact assigned project/PIC before saving this billing document.'); return false; }
                if (['Quotation', 'Invoice'].includes(payload.type) && String(linkedProject?.clientDirectoryId || '') !== String(payload.raw.customerId || '')) { this.showNotify('The selected project belongs to a different Client ID. Select a project under the current Client before saving.'); return false; }
                const previous = this.docHistory.find(item => item.id === docId);
                const isQuotationBeingIssued = payload.type === 'Quotation' && payload.status === 'Open' && (!previous || !previous.quotationIssuedAt);
                const isInvoiceBeingSent = payload.type === 'Invoice' && payload.status === 'Unpaid' && (!previous || previous.status === 'Draft' || !previous.invoiceSentAt);
                if (isQuotationBeingIssued) {
                    payload.quotationIssuedAt = new Date().toISOString();
                    payload.quotationIssuedByUid = this.userProfile.uid;
                }
                if (isInvoiceBeingSent) {
                    payload.invoiceWorkflowStatus = 'Sending to Client';
                    payload.raw.invoiceWorkflowStatus = 'Sending to Client';
                } else if (payload.type === 'Invoice' && payload.status === 'Draft') {
                    payload.invoiceWorkflowStatus = 'Draft — Finance Review';
                    payload.raw.invoiceWorkflowStatus = 'Draft — Finance Review';
                }
                await setDoc(doc(db, "docs", docId), payload, { merge: true });
                this.editingDocId = docId;
                if (isQuotationBeingIssued) {
                    try { await this.runBillingWorkflow('quotation-issued', docId); }
                    catch (workflowError) { console.error('Quotation notification workflow failed:', workflowError); this.showNotify('Quotation was saved, but its Client ID notification could not be sent. Correct the Client/project link and try again.', 'error'); return false; }
                    this.notifyByEmail({
                        to: payload.raw.clientEmail,
                        subject: `Quotation Ready — ${payload.docNo}`,
                        heading: 'Your Quotation Is Ready',
                        message: `Quotation ${payload.docNo} for ${payload.name || 'your account'} is ready to review in the Client Portal. You can accept or decline it there.`,
                        ctaLabel: 'VIEW QUOTATION'
                    });
                }
                if (isInvoiceBeingSent) {
                    if (payload.raw.sourceQuotationId) await updateDoc(doc(db, 'docs', payload.raw.sourceQuotationId), { status: 'Invoiced', invoiceDocId: docId, invoiceCreatedAt: new Date().toISOString() });
                    try { await this.runBillingWorkflow('invoice-sent', docId); }
                    catch (workflowError) { console.error('Invoice notification workflow failed:', workflowError); this.showNotify('Invoice was saved, but its notification will be retried from the billing queue.', 'error'); return false; }
                    this.notifyByEmail({
                        to: payload.raw.clientEmail,
                        subject: `Invoice Ready — ${payload.docNo}`,
                        heading: 'Your Invoice Is Ready',
                        message: `Invoice ${payload.docNo} for ${payload.name || 'your account'} is ready in the Client Portal. Please review it and upload payment proof once payment is made.`,
                        ctaLabel: 'VIEW INVOICE'
                    });
                    this.showNotify(`Invoice sent to Client and recorded in the billing workflow.`);
                } else {
                    this.showNotify(isQuotationBeingIssued ? 'Quotation sent to Client.' : payload.status === 'Draft' ? 'Invoice draft saved. It is not visible to the Client.' : 'Document saved.');
                }
                return true;
            } catch (error) { console.error('Document save failed:', error); this.showNotify('Unable to save document. Check the attachment size and try again.'); return false; }
        },
        async savePayslipRecord() {
            try {
                if (!this.canManagePayroll) { this.showNotify('You do not have permission to save payslips.'); return; }
                const normalizedPayForm = this.normalizeOfficialRecord(this.payForm);
                normalizedPayForm.empEmail = String(this.payForm.empEmail || '').trim().toLowerCase();
                Object.assign(this.payForm, normalizedPayForm);
                const docId = String(this.editingPayId || Date.now());
                const payload = { id: docId, type: 'Payslip', docNo: `PS-${this.currentYear}-${this.payForm.empNo}`, date: this.payForm.payDate, name: this.payForm.name, amount: this.payCalc.net, raw: JSON.parse(JSON.stringify(this.payForm)) };
                await setDoc(doc(db, "payslips", docId), payload, { merge: true }); this.editingPayId = null; this.showNotify(`Payslip saved.`);
            } catch (error) { console.error('Payslip save failed:', error); this.showNotify('Unable to save payslip.'); }
        },
        addDocItem() { this.docForm.items.push({ desc: '', qty: 1, price: 0 }); },
        removeDocItem(idx) { this.docForm.items.splice(idx, 1); },
        generateDocNo(includeCurrentNumber = false) {
            if (this.editingDocId) return;
            const prefix = this.docForm.type === 'Invoice' ? 'INV' : 'QT';
            const relevantDocs = this.docHistory.filter(d => d.type === this.docForm.type && String(d.docNo || '').includes(`-${this.currentYear}-`));
            let maxNum = 1000;
            relevantDocs.forEach(d => { if (d.docNo) { const num = parseInt(d.docNo.split('-').pop(), 10); if (!isNaN(num) && num > maxNum) maxNum = num; } });
            // The realtime document list can arrive a moment after a save. When a
            // user immediately changes client, also consider the number already in
            // the form so the next document cannot reuse it during that short gap.
            if (includeCurrentNumber) {
                const currentNum = parseInt(String(this.docForm.docNo || '').split('-').pop(), 10);
                if (!isNaN(currentNum) && currentNum > maxNum) maxNum = currentNum;
            }
            this.docForm.docNo = `${prefix}-${this.currentYear}-${String(maxNum + 1).padStart(5, '0')}`;
        },

        autoCalculatePayroll() {
            const rates = this.payForm.isSenior ? STATUTORY_RATES.senior : STATUTORY_RATES.regular;
            let epfWages = (Number(this.payForm.basic)||0) + (Number(this.payForm.phone)||0) + (Number(this.payForm.transport)||0) + (Number(this.payForm.meal)||0) + (Number(this.payForm.bonus)||0);
            let socsoWages = epfWages + (Number(this.payForm.ot)||0);
            let gross = socsoWages;
            let epfEmp = Math.round(epfWages * rates.epf.employeePct);
            let epfEmpr = Math.round(epfWages * (epfWages <= rates.epf.threshold ? rates.epf.employerPctBelow5k : rates.epf.employerPctAbove5k));
            let capSocso = Math.min(socsoWages, rates.socso.wageCap);
            let socsoEmp = Math.round(capSocso * rates.socso.employeePct * 100) / 100;
            let socsoEmpr = Math.round(capSocso * rates.socso.employerPct * 100) / 100;
            let capEis = Math.min(socsoWages, rates.eis.wageCap);
            let eisEmp = Math.round(capEis * rates.eis.employeePct * 100) / 100;
            let eisEmpr = Math.round(capEis * rates.eis.employerPct * 100) / 100;
            this.payForm.dedEpf = epfEmp; this.payForm.dedSocso = socsoEmp; this.payForm.dedEis = eisEmp;
            let deduct = epfEmp + socsoEmp + eisEmp + (Number(this.payForm.dedPcb)||0) + (Number(this.payForm.dedAdvance)||0) + (Number(this.payForm.dedOther)||0);
            let net = gross - deduct;
            this.payCalc = { gross, deduct, net, epfEmpr, socsoEmpr, eisEmpr };
        },
        async viewRecord(item) {
            const previewItem = JSON.parse(JSON.stringify(item));
            if (!previewItem.isDoc && !previewItem.isPay) previewItem.isPay = previewItem.type === 'Payslip';
            if (!previewItem.isDoc && !previewItem.isPay) previewItem.isDoc = true;
            if (!previewItem.raw) { this.showNotify('Record preview is unavailable.'); return; }
            const originalDoc = JSON.parse(JSON.stringify(this.docForm));
            const originalPay = JSON.parse(JSON.stringify(this.payForm));
            const originalModule = this.activePrintModule;
            if (previewItem.isDoc) {
                this.docForm = JSON.parse(JSON.stringify(previewItem.raw));
                this.activePrintModule = previewItem.type === 'Quotation' ? 'QUOTATION' : 'INVOICE';
            } else {
                this.payForm = JSON.parse(JSON.stringify(previewItem.raw));
                this.autoCalculatePayroll();
                this.activePrintModule = 'PAYSLIP';
            }
            await this.$nextTick();
            const templateId = previewItem.isDoc ? (previewItem.type === 'Quotation' ? 'print-template-quotation' : 'print-template-invoice') : 'print-template-payslip';
            const template = document.getElementById(templateId);
            const html = template ? template.outerHTML.replace(/\bprint-only\b/g, '') : '';
            this.docForm = originalDoc;
            this.payForm = originalPay;
            this.activePrintModule = originalModule;
            this.autoCalculatePayroll();
            this.recordPreview = { show: true, html };
        },
        // Both bulk actions work on exactly what the filter chips are showing,
        // so "download what I am looking at" needs no second set of controls.
        async printAllClientDocuments() {
            const items = this.filteredClientPortalDocs;
            if (!items.length) { this.showNotify('There are no documents to print.', 'error'); return; }
            if (!await this.askConfirm({
                title: `Print ${items.length} document${items.length === 1 ? '' : 's'}?`,
                message: 'Every document below is laid out on its own page, so one print produces a single PDF containing all of them.',
                confirmLabel: 'Yes, Prepare Print'
            })) return;
            this.bulkPrintPreparing = true;
            const originalDoc = JSON.parse(JSON.stringify(this.docForm));
            const originalModule = this.activePrintModule;
            try {
                const pages = [];
                for (const item of items) {
                    if (!item.raw) continue;
                    this.docForm = JSON.parse(JSON.stringify(item.raw));
                    this.activePrintModule = item.type === 'Quotation' ? 'QUOTATION' : 'INVOICE';
                    await this.$nextTick();
                    const templateId = item.type === 'Quotation' ? 'print-template-quotation' : 'print-template-invoice';
                    const template = document.getElementById(templateId);
                    if (!template) continue;
                    pages.push(template.outerHTML.replace(/print-only/g, ''));
                }
                if (!pages.length) { this.showNotify('None of these documents could be rendered.', 'error'); return; }
                // A break after each but the last, or the final page prints blank.
                this.recordPreview = {
                    show: true,
                    html: pages.map((page, i) => i < pages.length - 1
                        ? `<div style="page-break-after: always; break-after: page;">${page}</div>`
                        : page).join('')
                };
            } finally {
                this.docForm = originalDoc;
                this.activePrintModule = originalModule;
                this.bulkPrintPreparing = false;
            }
        },
        exportClientStatement() {
            const items = this.filteredClientPortalDocs;
            if (!items.length) { this.showNotify('There are no documents to export.', 'error'); return; }
            const rows = [
                ['ZENQOR HRMS/CDTS - CLIENT DOCUMENT STATEMENT'],
                ['Client', this.clientPortalIdentity.clientName || ''],
                ['Generated', this.formatDateTime(new Date().toISOString())],
                ['Documents', items.length],
                [],
                ['Type', 'Document No.', 'Date', 'Amount (RM)', 'Status', 'Decision / Proof']
            ];
            for (const d of items) {
                const stamp = d.clientDecisionAt
                    ? `${d.status} by ${d.clientDecisionByName || ''} on ${this.formatDateTime(d.clientDecisionAt)}`
                    : d.paymentProofAt
                        ? `Payment proof submitted ${this.formatDateTime(d.paymentProofAt)}`
                        : '';
                rows.push([d.type, d.docNo, d.date, Number(d.amount || 0).toFixed(2), d.status || '', stamp]);
            }
            const total = items.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
            rows.push([], ['Total', '', '', total.toFixed(2), '', '']);
            this.downloadCSV(rows, `zenqor_statement_${this.getLocalDateKey()}.csv`);
            this.showNotify('Statement downloaded.');
        },
        viewClaimRecord(claim) {
            this.claimPreview = { show: true, claim: JSON.parse(JSON.stringify(claim)), directorApprovalAttachment: '', directorApprovalAttachmentName: '', directorApprovalOriginalBytes: 0 };
        },
        editRecord(item) {
            this.mobileMenuOpen = false;
            if (item.isDoc) { this.editingDocId = item.id; if (item.raw) { this.docForm = JSON.parse(JSON.stringify(item.raw)); this.docForm.status = item.status || item.raw.status || (item.type === 'Invoice' ? 'Unpaid' : 'Open'); this.clientSavedForDocument = Boolean(this.docForm.customerId); } this.switchTab('document-quotations'); }
            else if (item.isPay) { this.editingPayId = item.id; if (item.raw) { this.payForm = JSON.parse(JSON.stringify(item.raw)); this.selectedPayEmployeeId = this.payForm.empNo || ''; } this.autoCalculatePayroll(); this.switchTab('payslip-generator'); }
            else if (item.isVoucher) this.editPaymentVoucher(item);
            else if (item.isClaim) this.editClaimRecord(item);
        },
        canDeleteBillingDocument(item) {
            return this.canDeleteBillingDocuments && ['Invoice', 'Quotation'].includes(item?.type);
        },
        async confirmDeleteRecord(item) {
            const canDeleteThisRecord = item?.isDoc ? this.canDeleteBillingDocument(item) : this.canDelete;
            if (!canDeleteThisRecord) { this.showNotify(item?.isDoc ? 'Only Director, Finance or Superadmin can delete invoices and quotations.' : 'Only Superadmin and Director can delete records.'); return; }
            if (!await this.askConfirm({
                title: 'Delete record?',
                message: `${item.docNo || item.fileName || 'This record'} will be permanently deleted. This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Record',
                danger: true
            })) return;
            try { if (item.isDoc) await deleteDoc(doc(db, "docs", item.id)); else if (item.isPay) await deleteDoc(doc(db, "payslips", item.id)); else if (item.isVoucher) await deleteDoc(doc(db, "payment_vouchers", item.id)); else if (item.isClaim) await deleteDoc(doc(db, "claims", item.id)); this.showNotify('Record deleted.'); } catch (error) { console.error('Record deletion failed:', error); this.showNotify('Unable to delete record.'); }
        },

        renderCharts() {
            if (typeof Chart === 'undefined' || !this.portalDataReady || this.currentTab !== 'dashboard' || ['Staff', 'Client'].includes(this.userProfile.role)) return;
            const revCanvas = document.getElementById('revenueChart');
            const statusCanvas = document.getElementById('statusChart');
            const claimsCanvas = document.getElementById('claimsChart');
            if (!revCanvas?.isConnected || !statusCanvas?.isConnected || !claimsCanvas?.isConnected) { this.refreshDashboardCharts(this.chartRenderAttempts + 1); return; }
            const ctxRev = revCanvas.getContext('2d');
            const ctxStatus = statusCanvas.getContext('2d');
            const ctxClaims = claimsCanvas.getContext('2d');
            if (!ctxRev || !ctxStatus || !ctxClaims) return;

            try {
                const gridColor = 'rgba(0,0,0,0.06)';
                const textColor = '#475569';
                const oldRevenueChart = Chart.getChart ? Chart.getChart(revCanvas) : this.revenueChartInstance;
                const oldStatusChart = Chart.getChart ? Chart.getChart(statusCanvas) : this.statusChartInstance;
                const oldClaimsChart = Chart.getChart ? Chart.getChart(claimsCanvas) : this.claimsChartInstance;
                if (oldRevenueChart) oldRevenueChart.destroy();
                if (oldStatusChart) oldStatusChart.destroy();
                if (oldClaimsChart) oldClaimsChart.destroy();

                const revData = this.getFilteredRevenueData();
                const revenueChart = new Chart(ctxRev, {
                    type: 'line', data: { labels: revData.labels, datasets: [{ label: 'Revenue Paid (RM)', data: revData.data, borderColor: '#0F766E', backgroundColor: 'rgba(15, 118, 110, 0.15)', borderWidth: 3, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#E76F51' }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { beginAtZero: true, min: 0, grid: { color: gridColor }, ticks: { color: textColor, callback: function(value) { return 'RM ' + value.toLocaleString(); } } } }, plugins: { legend: { labels: { color: textColor } } } }
                });

                const statusValues = [this.paidInvoicesCount, this.unpaidInvoicesCount, this.totalQuotations];
                const hasStatusData = statusValues.some(value => value > 0);
                const statusChart = new Chart(ctxStatus, {
                    type: 'doughnut', data: { labels: hasStatusData ? ['Paid Invoices', 'Unpaid Invoices', 'Quotations'] : ['No document data yet'], datasets: [{ data: hasStatusData ? statusValues : [1], backgroundColor: hasStatusData ? ['#0F766E', '#E76F51', '#F4A261'] : ['#CBD5E1'], borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
                });

                const claimsStages = this.claimsPipelineStats;
                const hasClaimsData = claimsStages.some(stage => stage.count > 0);
                const claimsChart = new Chart(ctxClaims, {
                    type: 'bar',
                    data: {
                        labels: ['Pipeline'],
                        datasets: hasClaimsData
                            ? claimsStages.filter(stage => stage.count > 0).map(stage => ({ label: stage.label, data: [stage.count], backgroundColor: stage.color, stack: 'total', barThickness: 26, borderRadius: 5, borderSkipped: false, borderWidth: 2, borderColor: '#ffffff' }))
                            : [{ label: 'No claims data yet', data: [1], backgroundColor: '#E2E8F0', stack: 'total', barThickness: 26, borderRadius: 5 }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
                        layout: { padding: 0 },
                        scales: {
                            x: { display: false, stacked: true, grid: { display: false } },
                            y: { display: false, stacked: true, grid: { display: false } }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: hasClaimsData, callbacks: { label: item => ` ${item.dataset.label}: ${item.raw} record(s)` } }
                        }
                    }
                });

                this.revenueChartInstance = Vue.markRaw ? Vue.markRaw(revenueChart) : revenueChart;
                this.statusChartInstance = Vue.markRaw ? Vue.markRaw(statusChart) : statusChart;
                this.claimsChartInstance = Vue.markRaw ? Vue.markRaw(claimsChart) : claimsChart;
            } catch (error) {
                console.error('Dashboard chart rendering failed:', error);
                if (this.chartRenderAttempts < 150) this.chartRenderTimer = setTimeout(() => this.refreshDashboardCharts(this.chartRenderAttempts + 1), 200);
            }
        },

        getFilteredRevenueData() {
            const filter = this.chartTimeFilter; const now = new Date(); let labels = []; let revenueData = [];
            if (filter === 'daily') {
                for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const dateStr = d.toISOString().substr(0, 10); labels.push(d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' })); let total = 0; this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date === dateStr) total += (Number(doc.amount) || 0); }); revenueData.push(total); }
            } else if (filter === 'weekly') {
                for (let i = 3; i >= 0; i--) { labels.push(`Week ${4 - i}`); const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - (i * 7 + 7)); const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - (i * 7)); let total = 0; this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date) { const docDate = new Date(doc.date); if (docDate >= weekStart && docDate <= weekEnd) total += (Number(doc.amount) || 0); } }); revenueData.push(total); }
            } else if (filter === 'monthly') {
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; revenueData = new Array(12).fill(0);
                this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date) { const docDate = new Date(doc.date); if (!isNaN(docDate.getTime()) && docDate.getFullYear() === now.getFullYear()) revenueData[docDate.getMonth()] += (Number(doc.amount) || 0); } });
            } else if (filter === 'yearly') {
                const currentYear = now.getFullYear(); for (let y = currentYear - 4; y <= currentYear; y++) { labels.push(String(y)); let total = 0; this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date) { const docDate = new Date(doc.date); if (docDate.getFullYear() === y) total += (Number(doc.amount) || 0); } }); revenueData.push(total); }
            }
            return { labels, data: revenueData };
        },

        initFirebaseRealtime() {
            if (this.portalDataReadyPromise) return this.portalDataReadyPromise;
            this.projectActivitiesLoaded = false;
            this.projectClientUpdatesLoaded = false;

            const subscribeWithReadySignal = (source, onData, label, onError = null) => new Promise((resolve) => {
                let hasInitialData = false;
                const unsubscribe = onSnapshot(source, (snapshot) => {
                    onData(snapshot);
                    if (!hasInitialData) { hasInitialData = true; resolve(); }
                }, (error) => {
                    console.error(`Unable to load ${label}:`, error);
                    if (onError) onError(error);
                    if (!hasInitialData) { hasInitialData = true; resolve(); }
                });
                this.unsubscribers.push(unsubscribe);
            });

            // Subscribes to multiple query sources for the same logical collection and
            // merges their docs by id before calling onMerge — used where a single query
            // can't cover every record a Client-role account is authorized to see (e.g.
            // records written before/after a schema field was added).
            const subscribeMergedWithReadySignal = (sources, onMerge, label) => new Promise((resolve) => {
                const buckets = new Map();
                let resolved = false;
                sources.forEach((source, index) => {
                    const unsubscribe = onSnapshot(source, (snapshot) => {
                        buckets.set(index, snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                        const merged = new Map();
                        buckets.forEach(list => list.forEach(item => merged.set(item.id, item)));
                        onMerge(Array.from(merged.values()));
                        if (!resolved) { resolved = true; resolve(); }
                    }, (error) => {
                        console.error(`Unable to load ${label}:`, error);
                        if (!resolved) { resolved = true; resolve(); }
                    });
                    this.unsubscribers.push(unsubscribe);
                });
            });

            const role = this.userProfile.role;
            const canReadAllDocuments = ['Superadmin', 'Director', 'HR', 'Account', 'IT'].includes(role);
            const canReadAllPayslips = ['Superadmin', 'Director', 'HR', 'Account'].includes(role);
            const canReadAllClaims = ['Superadmin', 'Director', 'HR', 'Account'].includes(role);
            const canReadAllEmployees = ['Superadmin', 'Director', 'HR', 'Account'].includes(role);
            // Internal user-directory metadata is staff-only. Client project cards already
            // carry the assigned PIC's public project fields, so exposing every portal user
            // record to a Client account is unnecessary and violates least privilege.
            const canReadUserDirectory = role !== 'Client';
            const canReadAuditLogs = ['Superadmin', 'Director', 'IT'].includes(role);
            // Must mirror the monthly_archives read rule in firestore.rules, or the
            // listener throws permission-denied for every other role on sign-in.
            const canReadMonthlyArchives = ['Superadmin', 'Director', 'HR', 'Account'].includes(role);
            const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
            const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
            // Firestore rules intentionally deny Client access to invoice drafts.
            // A broad `raw.customerId == ...` query can still *potentially* return
            // a draft, so Firestore rejects the whole listener before it returns any
            // permitted records. Split Client billing reads into rule-compatible
            // quotation and non-draft invoice queries, then merge by document ID.
            // Retain the exact-email sources for pre-Client-ID records only; both
            // source families are scoped to the signed-in Client, never by name.
            const clientDocumentSources = role === 'Client'
                ? [
                    ...(clientDirectoryId ? [
                        query(collection(db, 'docs'), where('raw.customerId', '==', clientDirectoryId), where('type', '==', 'Quotation')),
                        query(collection(db, 'docs'), where('raw.customerId', '==', clientDirectoryId), where('type', '==', 'Invoice'), where('status', 'not-in', ['Draft']))
                    ] : []),
                    ...(clientEmail ? [
                        query(collection(db, 'docs'), where('raw.clientEmail', '==', clientEmail), where('type', '==', 'Quotation')),
                        query(collection(db, 'docs'), where('raw.clientEmail', '==', clientEmail), where('type', '==', 'Invoice'), where('status', 'not-in', ['Draft']))
                    ] : [])
                ]
                : [];
            const documentsSource = canReadAllDocuments
                ? collection(db, 'docs')
                // Staff may read sent invoices solely so the Billing Workflow
                    // can open a submitted payment proof. Draft invoices and every
                    // quotation stay outside this listener and the Firestore rule.
                : role === 'Staff'
                    ? query(collection(db, 'docs'), where('billingPicEmail', '==', String(this.userProfile.email || '').trim().toLowerCase()), where('type', '==', 'Invoice'), where('status', 'not-in', ['Draft']))
                    : null;
            const payslipsSource = canReadAllPayslips
                ? collection(db, 'payslips')
                : role === 'Staff'
                    ? query(collection(db, 'payslips'), where('raw.empEmail', '==', this.userProfile.email))
                    : null;
            const claimsSource = canReadAllClaims
                ? collection(db, 'claims')
                : role === 'Staff'
                    ? query(collection(db, 'claims'), where('empEmail', '==', this.userProfile.email))
                    : null;
            const vouchersSource = canReadAllClaims
                ? collection(db, 'payment_vouchers')
                : role === 'Staff'
                    ? query(collection(db, 'payment_vouchers'), where('empEmail', '==', this.userProfile.email))
                    : null;
            const employeesSource = canReadAllEmployees
                ? collection(db, 'employees')
                : ['Staff', 'IT'].includes(role)
                    ? query(collection(db, 'employees'), where('email', '==', this.userProfile.email))
                    : null;
            const projectsSources = role === 'Client'
                // clientDirectoryId is a required field on every project (see
                // hasValidProjectLinks in firestore.rules), so this covers both the primary
                // contact and any authorized secondary contact under the same customer
                // record. Falls back to the old uid-based match only if the claim hasn't
                // been synced yet for this session.
                ? (this.userProfile.clientDirectoryId
                    ? [query(collection(db, 'projects'), where('clientDirectoryId', '==', this.userProfile.clientDirectoryId))]
                    : [query(collection(db, 'projects'), where('clientEmail', '==', this.userProfile.email), where('clientPortalUid', '==', this.userProfile.uid))])
                // Directors and Superadmins oversee every Project Activity.
                // Other internal staff load only their PIC assignments, matching
                // the Firestore read rule and preventing an all-project payload
                // from reaching their browser.
                : this.canManageProjects
                    ? [collection(db, 'projects')]
                    // Two disjoint grants, one query each (Firestore has no OR across
                    // different fields): the projects this employee runs as PIC, and
                    // the projects that hold an activity assigned to them. Merged by
                    // doc id below; both mirror a branch of the projects read rule.
                    : [
                        query(collection(db, 'projects'), where('ownerEmail', '==', String(this.userProfile.email || '').trim().toLowerCase())),
                        query(collection(db, 'projects'), where('activityAssigneeEmails', 'array-contains', String(this.userProfile.email || '').trim().toLowerCase()))
                    ];
            const projectActivitiesSources = role === 'Client'
                ? null
                : this.canManageProjects
                    ? [collection(db, 'project_activities')]
                    // Same split for the activities themselves: everything scheduled
                    // under a project this employee runs, plus everything assigned to
                    // them personally under someone else's project.
                    : [
                        query(collection(db, 'project_activities'), where('projectOwnerEmail', '==', String(this.userProfile.email || '').trim().toLowerCase())),
                        query(collection(db, 'project_activities'), where('assignedEmail', '==', String(this.userProfile.email || '').trim().toLowerCase()))
                    ];
            // Client updates have existed through three linkage versions: primary portal
            // uid, shared Client Directory id, and the original primary email. Subscribe
            // to each available safe key and merge by doc id so legacy updates remain
            // visible after the Client Directory migration.
            const projectClientUpdatesSources = role === 'Client'
                ? [
                    query(collection(db, 'project_client_updates'), where('clientPortalUid', '==', this.userProfile.uid)),
                    ...(this.userProfile.clientDirectoryId
                        ? [query(collection(db, 'project_client_updates'), where('clientDirectoryId', '==', this.userProfile.clientDirectoryId))]
                        : []),
                    ...(String(this.userProfile.email || '').trim()
                        ? [query(collection(db, 'project_client_updates'), where('clientEmail', '==', String(this.userProfile.email || '').trim().toLowerCase()))]
                        : [])
                ]
                : [collection(db, 'project_client_updates')];
            const portalNotificationsSource = query(collection(db, 'portal_notifications'), where('recipientUid', '==', this.userProfile.uid));
            // A Client account never raises or decides a portal access request,
            // so it subscribes to nothing here rather than to an empty query.
            const accessRequestsSource = role === 'Client'
                ? null
                : (FULL_ACCESS_ROLES.includes(role)
                    ? collection(db, 'access_requests')
                    : query(collection(db, 'access_requests'), where('requesterUid', '==', this.userProfile.uid)));

            const userSubscription = canReadUserDirectory
                ? subscribeWithReadySignal(collection(db, 'users'), (snapshot) => {
                    this.users = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                    this.processPortalPresenceNotifications(this.users);
                    const currentUser = this.users.find(user => user.id === this.userProfile.uid);
                    if (!currentUser) {
                        if (!this.isSeedAdminEmail(this.userProfile.email)) this.revokePortalAccessIfConfirmed('missing from the portal directory');
                        return;
                    }
                    if (!this.isPortalEmailAllowed(this.userProfile.email, currentUser.role) && !this.isSeedAdminEmail(this.userProfile.email)) {
                        this.revokePortalAccessIfConfirmed('role no longer permits this email');
                        return;
                    }
                    // Locked while signed in. Confirmed against the server for the
                    // same reason a revocation is: this snapshot may be the cached
                    // one, and an account unlocked moments ago must not be thrown
                    // out by a stale copy that still reads locked.
                    if (this.isAccountLocked(currentUser)) {
                        this.revokePortalAccessIfLocked();
                        return;
                    }
                    this.userProfile.role = currentUser.role || this.userProfile.role;
                    this.userProfile.name = currentUser.name || this.userProfile.name;
                    this.userProfile.photo = currentUser.photo || this.userProfile.photo;
                    if (Object.prototype.hasOwnProperty.call(currentUser, 'clientDirectoryId')) {
                        this.userProfile.clientDirectoryId = currentUser.clientDirectoryId || '';
                    }
                    if (Object.prototype.hasOwnProperty.call(currentUser, 'themePreference')) {
                        this.userProfile.themePreference = currentUser.themePreference || 'light';
                        this.applyDarkModePreference();
                    }
                }, 'portal users', (error) => {
                    // The protected bootstrap Superadmin is intentionally allowed
                    // to repair/recreate its own profile. Do not turn a transient
                    // directory-list listener denial into a sign-out for that one
                    // non-deletable account; every other account remains revoked.
                    if (error?.code === 'permission-denied' && !this.isSeedAdminEmail(this.userProfile.email)) this.revokePortalAccessIfConfirmed('portal directory listener denied');
                })
                : subscribeWithReadySignal(doc(db, 'users', this.userProfile.uid), (snapshot) => {
                    if (!snapshot.exists()) {
                        // Very often a cached miss on a doc created moments ago by
                        // the pending_access migration — confirm with the server.
                        this.revokePortalAccessIfConfirmed('portal profile reported missing');
                        return;
                    }
                    const currentUser = { ...snapshot.data(), id: snapshot.id };
                    if (!this.isPortalEmailAllowed(this.userProfile.email, currentUser.role)) {
                        this.revokePortalAccessIfConfirmed('role no longer permits this email');
                        return;
                    }
                    // Same server-confirmed lock gate as the directory listener
                    // above, for the roles that only read their own profile.
                    if (this.isAccountLocked(currentUser)) {
                        this.revokePortalAccessIfLocked();
                        return;
                    }
                    this.users = [currentUser];
                    this.userProfile.role = currentUser.role || this.userProfile.role;
                    this.userProfile.name = currentUser.name || this.userProfile.name;
                    this.userProfile.photo = currentUser.photo || this.userProfile.photo;
                    if (Object.prototype.hasOwnProperty.call(currentUser, 'clientDirectoryId')) {
                        this.userProfile.clientDirectoryId = currentUser.clientDirectoryId || '';
                    }
                    if (Object.prototype.hasOwnProperty.call(currentUser, 'themePreference')) {
                        this.userProfile.themePreference = currentUser.themePreference || 'light';
                        this.applyDarkModePreference();
                    }
                }, 'current portal user', (error) => {
                    if (error?.code === 'permission-denied') this.revokePortalAccessIfConfirmed('portal profile listener denied');
                });

            const initialLoads = [
                // Every session reads the company profile, not only the roles that
                // may edit it. Clients see these details on the support page and
                // staff print them onto quotations and invoices; gating the read
                // on the edit permission left everyone else rendering the
                // build-time defaults, so a change saved in Global Company
                // Settings never reached them. A denied read is logged and
                // ignored, leaving those same defaults in place.
                subscribeWithReadySignal(doc(db, "settings", "company_profile"), (snapshot) => { if (snapshot.exists()) this.company = this.hydrateCompanyAddress(snapshot.data()); }, 'company settings'),
                employeesSource
                    ? subscribeWithReadySignal(employeesSource, (snapshot) => { this.employees = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'employees')
                    : Promise.resolve(),
                (this.hasAccess('client-directory') || this.hasAccess('doc-generator'))
                    ? subscribeWithReadySignal(collection(db, "customers"), (snapshot) => {
                        this.customers = snapshot.docs.map(d => {
                            const data = d.data();
                            return { id: d.id, ...data, clientAddress1: data.clientAddress1 || data.clientAddress || '' };
                        });
                        this.projects = this.projects.map(project => this.projectWithLiveClientData(project));
                        this.ensureClientTasksForExistingProjects();
                        this.repairLegacyProjectClientLinks();
                    }, 'clients')
                    : role === 'Client' && this.userProfile.clientDirectoryId
                        ? subscribeWithReadySignal(doc(db, 'customers', this.userProfile.clientDirectoryId), (snapshot) => {
                            this.customers = snapshot.exists()
                                ? [{ id: snapshot.id, ...snapshot.data(), clientAddress1: snapshot.data().clientAddress1 || snapshot.data().clientAddress || '' }]
                                : [];
                            this.projects = this.projects.map(project => this.projectWithLiveClientData(project));
                        }, 'client profile')
                    : Promise.resolve(),
                clientDocumentSources.length
                    ? subscribeMergedWithReadySignal(clientDocumentSources, (merged) => {
                        this.docHistory = merged;
                        this.generateDocNo();
                        this.refreshDashboardCharts();
                    }, 'client billing documents')
                    : documentsSource
                    ? subscribeWithReadySignal(documentsSource, (snapshot) => { this.docHistory = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); this.generateDocNo(); this.refreshDashboardCharts(); }, 'documents')
                    : Promise.resolve(),
                payslipsSource
                    ? subscribeWithReadySignal(payslipsSource, (snapshot) => { this.payslipHistory = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'payslips')
                    : Promise.resolve(),
                claimsSource
                    ? subscribeWithReadySignal(claimsSource, (snapshot) => {
                        this.claimsHistory = snapshot.docs.map(d => this.normalizeClaimRecord({ id: d.id, ...d.data() }));
                        this.synchronizeLegacyApprovedClaims(snapshot.docs);
                    }, 'claims')
                    : Promise.resolve(),
                vouchersSource
                    ? subscribeWithReadySignal(vouchersSource, (snapshot) => {
                        this.paymentVouchers = snapshot.docs.map(d => ({ id: d.id, documentType: 'Payment Voucher', type: 'Payment Voucher', ...d.data() }));
                    }, 'payment vouchers')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(collection(db, 'portfolio_web'), (snapshot) => {
                        this.websiteContent.portfolio_web = this.sortGalleryItemsNewestFirst(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                    }, 'website content — Digital Systems')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(collection(db, 'portfolio_gaming'), (snapshot) => {
                        this.websiteContent.portfolio_gaming = this.sortGalleryItemsNewestFirst(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                    }, 'website content — Licensing & Permits')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(collection(db, 'services'), (snapshot) => {
                        // Deliberately NOT date-sorted: a service card shows no date,
                        // and this ascending createdAt order is the sequence the admin
                        // added them in, which is how the public Services page reads.
                        this.websiteContent.services = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
                    }, 'website content — Services')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(doc(db, 'content', 'site_text'), (snapshot) => {
                        this.siteTextOverrides = snapshot.exists() ? snapshot.data() : {};
                    }, 'website content — Page Text')
                    : Promise.resolve(),
                subscribeMergedWithReadySignal(projectsSources, (merged) => {
                    this.projects = merged.map(project => this.projectWithLiveClientData(project));
                    this.ensureClientTasksForExistingProjects();
                    this.repairLegacyProjectClientLinks();
                    this.syncProjectActivityOwners();
                    this.syncProjectActivityAssignees();
                }, 'project activities'),
                projectActivitiesSources ? subscribeMergedWithReadySignal(projectActivitiesSources, (merged) => {
                    const previousIds = new Set(this.projectActivities.map(activity => activity.id));
                    this.projectActivities = merged;
                    const assignedOpen = this.projectActivities.filter(activity => activity.status !== 'Done' && String(activity.assignedEmail || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase());
                    const today = this.getLocalDateKey();
                    if (!this.projectActivitiesLoaded) {
                        const dueCount = assignedOpen.filter(activity => activity.dueDate <= today).length;
                        if (dueCount) setTimeout(() => this.showNotify(`${dueCount} assigned project activity${dueCount > 1 ? 'ies are' : ' is'} due or overdue.`), 350);
                    } else {
                        const newAssigned = assignedOpen.find(activity => !previousIds.has(activity.id));
                        if (newAssigned) this.showNotify(`New project activity assigned: ${newAssigned.summary}`);
                    }
                    this.projectActivitiesLoaded = true;
                    this.syncProjectActivityOwners();
                    this.syncProjectActivityAssignees();
                }, 'project activity issues') : Promise.resolve(),
                subscribeMergedWithReadySignal(projectClientUpdatesSources, (merged) => {
                    const previousIds = new Set(this.projectClientUpdates.map(update => update.id));
                    this.projectClientUpdates = merged;
                    if (this.projectClientUpdatesLoaded && role === 'Client') {
                        const newUpdate = this.projectClientUpdates.find(update => !previousIds.has(update.id));
                        if (newUpdate) this.showNotify(`New project update received: ${newUpdate.projectRef}`);
                    }
                    this.projectClientUpdatesLoaded = true;
                }, 'Client activity history'),
                subscribeWithReadySignal(portalNotificationsSource, (snapshot) => {
                    const previousIds = new Set(this.portalNotifications.map(notification => notification.id));
                    this.portalNotifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (this.portalNotificationsLoaded) {
                        const latest = this.portalNotifications.find(notification => !previousIds.has(notification.id) && !notification.hiddenAt);
                        if (latest) {
                            this.notification = { show: true, message: latest.title || 'You have a new portal notification.' };
                            setTimeout(() => { this.notification.show = false; }, 3500);
                        }
                    }
                    this.portalNotificationsLoaded = true;
                }, 'website notifications'),
                userSubscription,
                canReadAuditLogs
                    ? subscribeWithReadySignal(collection(db, "audit_logs"), (snapshot) => { this.auditLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)); }, 'audit logs')
                    : Promise.resolve(),

                // Staff Portal access requests. Superadmin/Director read the whole
                // queue because they decide it; everyone else reads only the rows
                // they raised themselves, which is exactly what the access_requests
                // read rule permits - a broader listener would just be denied.
                accessRequestsSource
                    ? subscribeWithReadySignal(accessRequestsSource, (snapshot) => {
                        this.accessRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    }, 'portal access requests')
                    : Promise.resolve(),
                // Closed monthly packages listed in Enterprise Reports & Data Export.
                canReadMonthlyArchives
                    ? subscribeWithReadySignal(collection(db, 'monthly_archives'), (snapshot) => {
                        this.monthlyArchives = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    }, 'monthly archives')
                    : Promise.resolve()
            ];

            this.portalDataReadyPromise = Promise.all(initialLoads).then(() => {
                this.portalDataReady = true;
                this.refreshDashboardCharts();
                // Only after every collection has arrived — closing a month from a
                // half-loaded snapshot would freeze understated totals into the package.
                this.ensureMonthlyArchives();
                return true;
            });
            return this.portalDataReadyPromise;
        }
    },
    mounted() {
        this.checkPasswordResetLink();
        this.autoCalculatePayroll();
        this.generateDocNo();
        this.installUniversalButtonContextMenu();
        window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
        this.browserBackHandler = (event) => {
            if (this.isLoggedIn) this.restoreTabFromHistory(event.state?.tab);
        };
        window.addEventListener('popstate', this.browserBackHandler);

        // Escape-to-close (Step 24) — deferred in Step 11's modal architecture pass.
        // Mirrors each overlay's own @click.self backdrop-dismiss behavior exactly:
        // a modal only closes on Escape if it already closes on a backdrop click.
        // Modals with no @click.self (idle-timeout warning, the employee/portal-
        // access/change-password forms, the pre-login OTP challenge) are deliberately
        // NOT closable this way, same as they're not backdrop-closable — Escape must
        // not make a mandatory or data-entry-sensitive dialog accidentally dismissible.
        // Checked topmost (highest z-index) first, in case more than one is ever open.
        this.globalEscapeHandler = (event) => {
            if (event.key !== 'Escape') return;
            if (this.markProjectDoneModal.show && this.markProjectDoneModal.project) { this.closeMarkProjectDoneModal(); return; }
            if (this.appConfirm.show) { this.resolveAppConfirm(false); return; }
            if (this.employeeView.show) { this.employeeView.show = false; return; }
            if (this.staffPortalAccount.show) { this.closeStaffPortalAccount(); return; }
            if (this.clientView.show) { this.closeClientView(); return; }
            if (this.clientUpdateModal.show && this.clientUpdateModal.project) { this.closeClientUpdateModal(); return; }
            if (this.websiteContentModal.show) { this.closeWebsiteContentModal(); return; }
            if (this.siteTextModal.show) { this.closeSiteTextModal(); return; }
            if (this.activityModal.show && this.activityModal.project) { this.closeActivityModal(); return; }
            if (this.projectPreview.show && this.projectPreview.project) { this.closeProjectDetails(); return; }
            if (this.projectModal.show) { this.closeProjectModal(); return; }
            if (this.logoutConfirm) { this.logoutConfirm = false; return; }
            if (this.postLogoutChoice) { this.stayOnPortal(); return; }
            if (this.clientActionConfirm.show) { this.clientActionConfirm.show = false; return; }
            if (this.employeeActionConfirm.show) { this.employeeActionConfirm.show = false; return; }
            if (this.contextMenu.show) { this.closeContextMenu(); return; }
            if (this.clientTaskModal.show) { this.closeClientTaskModal(); return; }
        };
        window.addEventListener('keydown', this.globalEscapeHandler);

        this.checkForAppUpdate();
        this.appUpdateCheckInterval = setInterval(() => this.checkForAppUpdate(), 5 * 60 * 1000);
        this.appVisibilityHandler = () => { if (document.visibilityState === 'visible') this.checkForAppUpdate(); };
        document.addEventListener('visibilitychange', this.appVisibilityHandler);

        onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Session restoration can race with a cached layout. Keep the
                // navigation closed until the restored session is ready.
                this.mobileMenuOpen = false;
                this.desktopSidebarOpen = false;
                if (this.interactiveLoginInProgress) { this.authLoading = false; return; }
                if (this.isLoggedIn && this.userProfile.uid === firebaseUser.uid) { this.authLoading = false; return; }
                try {
                    this.loginLoading = true;
                    // A restored session on a slow/flaky connection (mobile data, a cold
                    // Firestore connection right after a hard refresh) can otherwise leave
                    // this getDoc() waiting indefinitely for a server round-trip — which
                    // reads as the whole portal being stuck on the landing screen with no
                    // spinner, no error, nothing. Bound it so that failure mode surfaces as
                    // a real, actionable error instead (see the catch block below).
                    const userData = await Promise.race([
                        this.loadOrMigrateUserMetadata(firebaseUser),
                        this.timeoutPromise(15000, 'Timed out while loading your account. Please check your connection and sign in again.')
                    ]);
                    const isSeedAdmin = this.isSeedAdminEmail(firebaseUser.email);

                    if (!userData && !isSeedAdmin) {
                        this.loginError = 'This account is not provisioned or your access has been revoked. Contact your administrator.';
                        await signOut(auth);
                        return;
                    }

                    const lockedMessage = this.accountLockedSignInMessage(userData, firebaseUser.email);
                    if (lockedMessage) {
                        this.loginError = lockedMessage;
                        await signOut(auth);
                        return;
                    }

                    let role = userData?.role || 'Staff';
                    let name = userData?.name || firebaseUser.displayName || firebaseUser.email;
                    let photo = userData?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B1E36&color=D4AF37`;
                    const mustChangePassword = userData?.mustChangePassword === true;
                    if (isSeedAdmin) role = 'Superadmin';
                    if (!this.isPortalEmailAllowed(firebaseUser.email, role)) {
                        this.loginError = this.portalEmailRejectionMessage(role);
                        await signOut(auth);
                        return;
                    }
                    const loginContext = { firebaseUser, userData, role, name, photo, mustChangePassword };
                    if (mustChangePassword) {
                        this.loginLoading = false;
                        this.authLoading = false;
                        this.openFirstTimePasswordFlow(loginContext);
                        return;
                    }
                    this.userProfile = { name, email: firebaseUser.email, role, uid: firebaseUser.uid, photo, mustChangePassword, themePreference: userData?.themePreference || 'light' };
                    this.applyDarkModePreference();
                    this.notificationsLog = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : [];
                    this.startIdleTimeoutWatch();
                    await this.syncUserClaims();
                    this.resetAllForms();
                    this.isLoggedIn = true;
                    // The sidebar stays closed after a restored session too;
                    // it only opens when the user presses the menu control.
                    this.desktopSidebarOpen = false;
                    this.mobileMenuOpen = false;
                    this.currentTab = role === 'Client' ? 'client-portal' : 'dashboard';
                    this.playWelcomeGreeting();
                    window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
                    this.loginLoading = false;
                    this.initFirebaseRealtime().catch(error => {
                        console.error('Realtime data initialization failed after login:', error);
                        this.portalDataReady = false;
                    });
                    this.startClientStatusClock();
                    this.startPresenceTracking().catch(error => console.error('Presence tracking failed after login:', error));
                    this.refreshDashboardCharts();
                } catch (e) {
                    console.error("Error fetching user metadata:", e);
                    this.isLoggedIn = false; this.mobileMenuOpen = false; this.desktopSidebarOpen = false;
                    this.loginLoading = false;
                    // Surface this instead of silently dropping back to the role-chooser
                    // landing screen with no explanation — that's what read as a "hang" to
                    // begin with. Sign out too: Firebase still considers this session valid,
                    // so without it every subsequent refresh would hit this same error again.
                    this.loginError = 'We could not restore your session. Please sign in again.';
                    try { await signOut(auth); } catch (signOutError) { console.error('Sign-out after failed session restore also failed:', signOutError); }
                }
            } else {
                // Preserve a revocation/restore error, but never carry one onto
                // the landing screen after the user chose to sign out normally.
                if (this.intentionalLogoutInProgress) this.loginError = '';
                this.intentionalLogoutInProgress = false;
                this.stopPresenceTracking();
                this.stopClientStatusClock();
                this.isLoggedIn = false; this.mobileMenuOpen = false; this.desktopSidebarOpen = false;
                this.loginLoading = false;
                this.destroyDashboardCharts();
                this.portalDataReady = false;
                this.portalDataReadyPromise = null;
                this.userProfile = { name: '', email: '', role: '', photo: '' };
                this.unsubscribers.forEach(unsub => unsub && unsub());
                this.unsubscribers = [];
                if (this.clientDocumentsUnsubscribe) { this.clientDocumentsUnsubscribe(); this.clientDocumentsUnsubscribe = null; }
                this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' };
                this.projects = [];
                this.projectActivities = [];
                this.projectClientUpdates = [];
                this.projectActivitiesLoaded = false;
                this.projectClientUpdatesLoaded = false;
                this.employees = [];
                this.customers = [];
                this.docHistory = [];
                this.payslipHistory = [];
                this.claimsHistory = [];
                this.paymentVouchers = [];
                this.users = [];
                this.auditLogs = [];
                this.accessRequests = [];
                this.staffPortalAccount = { show: false, tab: 'overview', account: null };
                this.staffPortalBusyUid = '';
                this.websiteContent = { portfolio_web: [], portfolio_gaming: [], services: [] };
                this.siteTextOverrides = {};
                this.notificationsLog = [];
                this.portalNotifications = [];
                this.portalNotificationsLoaded = false;
                this.notificationsPanelOpen = false;
                if (this.notificationsSyncTimer) { clearTimeout(this.notificationsSyncTimer); this.notificationsSyncTimer = null; }
                this.stopIdleTimeoutWatch();
            }
            this.authLoading = false;
        });
    },
    unmounted() {
        if (this.isLoggedIn) this.setCurrentEmployeePresence(false);
        this.stopPresenceTracking();
        this.stopClientStatusClock();
        this.unsubscribers.forEach(unsub => unsub && unsub());
        if (this.clientDocumentsUnsubscribe) this.clientDocumentsUnsubscribe();
        if (this.browserBackHandler) window.removeEventListener('popstate', this.browserBackHandler);
        if (this.appUpdateCheckInterval) clearInterval(this.appUpdateCheckInterval);
        if (this.appVisibilityHandler) document.removeEventListener('visibilitychange', this.appVisibilityHandler);
        if (this.notificationsSyncTimer) clearTimeout(this.notificationsSyncTimer);
        this.clearWelcomeGreetingTimers();
        this.removeUniversalButtonContextMenu();
        this.stopIdleTimeoutWatch();
    }
}).directive('longpress', longpressDirective).mount('#app');
