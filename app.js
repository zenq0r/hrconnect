// ============================================================
// ZENQOR TECHNOLOGIES - app.js (ENTERPRISE FINAL BUILD v8.7)
// ============================================================

import {
    db,
    auth,
    storage,
    collection,
    doc,
    getDoc,
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
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "./firebase-config.js";
import { DOCUMENT_TEMPLATES, defaultFieldValues, requiredFieldsMissing, prefillFromCustomer, buildPdfForDocument, buildOverlayPdfForDocument } from "./documents-templates.js";

const { createApp } = Vue;

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
    { key: 'pw_hero_title', label: 'Pw Hero Title', group: 'Our Client Page (Hero)' },
    { key: 'pw_hero_sub', label: 'Pw Hero - Subtitle', group: 'Our Client Page (Hero)' },
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
    'Director': ['dashboard', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'client-portal', 'documents', 'website-content', 'audit-logs', 'settings', 'profile'],
    'Superadmin': ['dashboard', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'client-portal', 'documents', 'website-content', 'audit-logs', 'settings', 'profile'],
    'HR': ['dashboard', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'documents', 'profile'],
    'Account': ['dashboard', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'reports', 'documents', 'profile'],
    'IT': ['dashboard', 'project-activities', 'website-content', 'audit-logs', 'settings', 'profile'],
    'Client': ['project-activities', 'client-portal', 'client-documents', 'client-updates', 'client-support', 'documents', 'profile'],
    'Staff': ['dashboard', 'project-activities', 'claims', 'profile']
};

// Bump the top entry's `version` (and add a new entry above it) whenever a meaningful feature ships.
// Every signed-in user whose stored `lastSeenChangelogVersion` (in Firestore, users/{uid}) doesn't
// match APP_CHANGELOG[0].version will automatically see the "What's New" onboarding message once.
const APP_CHANGELOG = [
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

createApp({
    data() {
        return {
            isLoggedIn: false,
            authLoading: true,
            loginLoading: false,
            interactiveLoginInProgress: false,
            logoutConfirm: false,
            forgetTrustedDeviceOnLogout: false,
            postLogoutChoice: false,
            passwordResetFlow: { active: false, oobCode: '', email: '', verifying: true, valid: false, error: '', newPassword: '', confirmPassword: '', loading: false, success: false },
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
            // Mandatory second-factor email OTP for every provisioned RBAC role.
            loginOtp: { show: false, code: '', error: '', sending: false, verifying: false, email: '', trustDevice: true },
            pendingLoginContext: null,
            currentTab: 'dashboard',
            mobileMenuOpen: false,
            desktopSidebarOpen: false,
            chartTimeFilter: 'monthly',
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

            notification: { show: false, message: '' },
            notificationsLog: [],
            notificationsPanelOpen: false,
            darkMode: false,
            appUpdateAvailable: false,
            appVersionMarker: '',
            showOnboarding: false,
            onboardingMode: 'welcome',
            showUpdateHistory: false,

            activePrintModule: null,
            claimPrint: null,
            recordPreview: { show: false, html: '' },
            claimPreview: { show: false, claim: null, directorApprovalAttachment: '', directorApprovalAttachmentName: '', directorApprovalOriginalBytes: 0 },
            attachmentPreview: { show: false, url: '', label: '' },
            attachmentUploadState: { payment: false, receipt: false, director: false },
            unsubscribers: [],
            portalDataReady: false,
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
            lastProjectPresenceSyncAt: 0,
            presenceNow: Date.now(),
            presencePageHideHandler: null,
            presencePageShowHandler: null,
            presenceVisibilityHandler: null,
            presenceNotificationsReady: false,
            portalUserOnlineStates: {},
            legacyClaimMigrationRunning: false,

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
                address: "SURIA RESIDENCE (BLOK A), JALAN RESIDENCE SEK 3\nBANDAR MAHKOTA CHERAS, 43200 CHERAS, SELANGOR",
                address1: 'SURIA RESIDENCE (BLOK A)',
                address2: 'JALAN RESIDENCE SEK 3',
                address3: 'BANDAR MAHKOTA CHERAS',
                postcode: '43200',
                city: 'Cheras',
                state: 'Selangor',
                country: 'Malaysia',
                phone: "+60 11-6501 2569",
                email: "admin@zenq0r.com",
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
            projectActivities: [],
            projectActivitiesLoaded: false,
            projectClientUpdates: [],
            projectClientUpdatesLoaded: false,
            activityTypes: ['To-Do', 'Document Request', 'Client Follow-Up', 'Government Submission', 'Review', 'Meeting', 'Payment Follow-Up', 'Other'],
            activityModal: { show: false, isEdit: false, activityId: '', project: null, form: { activityType: 'To-Do', summary: '', dueDate: '', assignedEmpNo: '', assignedName: '', assignedEmail: '', assignedPosition: '', details: '' } },
            clientUpdateTypes: ['Progress Update', 'Document Update', 'Government Update', 'Client Action Required', 'Milestone Completed', 'General Notice'],
            clientUpdateModal: { show: false, isEdit: false, updateId: '', original: null, project: null, form: { updateType: 'Progress Update', updateDate: '', message: '' } },
            clientReplyMessage: '',
            editingReplyId: '',
            editingReplyMessage: '',
            projectViewMode: 'board',
            projectScopeFilter: 'all',
            clientPortalFilter: { type: 'all', status: 'all' },
            expandedClientGroups: new Set(),
            projectPreview: { show: false, project: null },
            clientDocuments: { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' },
            clientDocumentsUnsubscribe: null,

            // Signed Documents module (Authorization Letter / Client Info Form / NDA / Service Agreement).
            // Field definitions + PDF layout live in documents-templates.js — see DOCUMENT_TEMPLATES import above.
            documentTemplates: DOCUMENT_TEMPLATES,
            signedDocuments: { items: [], loading: false, error: '', clientFilter: 'all', statusFilter: 'all' },
            signedDocumentsUnsubscribe: null,
            newSignedDocumentModal: { show: false, clientDirectoryId: '', templateId: '', saving: false },
            signedDocumentModal: { show: false, mode: 'view', saving: false, doc: null, fields: {} },
            sigPad: {
                client: { hasStrokes: false, drawing: false, ctx: null },
                zenqor: { hasStrokes: false, drawing: false, ctx: null }
            },
            // Public-site content management: Firestore-backed content consumed directly by
            // zenqor-tech — Portfolio galleries (portfolio_web = Digital Systems,
            // portfolio_gaming = Licensing & Permits), the Services page, and page-text
            // overrides (content/site_text, any data-i18n key on any page). Once any doc
            // exists in a portfolio_web/portfolio_gaming/services collection, the matching
            // public page shows ONLY Firestore items — fallback content stops showing.
            websiteContentTab: 'portfolio_web',
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
            clientActionConfirm: { show: false, action: '', client: null },
            appConfirm: { show: false, title: '', message: '', confirmLabel: 'Yes, Continue', danger: false, onConfirm: null },

            officialEmailDomain: 'zenq0r.com',

            userModal: {
                show: false,
                isEdit: false,
                form: { uid: '', name: '', email: '', password: '', role: 'Staff', customAccess: {} }
            },
            // Pages available for the per-user custom access override in Portal Access
            // Management. Keys must match the module keys used by hasAccess()/RBAC_ROLES.
            accessModules: [
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'project-activities', label: 'Project Activities' },
                { key: 'doc-generator', label: 'Documents (Quotation / Invoice)' },
                { key: 'payslip-generator', label: 'Payroll (Payslip Generator)' },
                { key: 'claims', label: 'Claims & Payment Vouchers' },
                { key: 'client-directory', label: 'Client Directory' },
                { key: 'hr-employees', label: 'HR Employees' },
                { key: 'reports', label: 'Reports' },
                { key: 'client-portal', label: 'Client Portal (Staff View)' },
                { key: 'client-documents', label: 'Client Documents & Billing' },
                { key: 'client-updates', label: 'Client Project Updates' },
                { key: 'client-support', label: 'Client Help & Support' },
                { key: 'website-content', label: 'Website Content (zenqor-tech Portfolio, Services, Page Text)' },
                { key: 'audit-logs', label: 'Audit Logs' },
                { key: 'settings', label: 'Settings' },
                { key: 'profile', label: 'Profile' }
            ],

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
        canManageDocuments() { return this.hasModulePermission('doc-generator', 'edit'); },
        // Clients may upload to their OWN client_documents folder (but not the
        // doc-generator/billing tools canManageDocuments otherwise gates) — the
        // Firestore/Storage rules independently re-verify clientDirectoryId ownership,
        // this is just the UI-level show/hide for the upload button.
        canUploadClientDocuments() { return this.canManageDocuments || this.userProfile.role === 'Client'; },
        // Staff who can create/prefill/countersign Signed Documents — same roster as
        // 'documents' in RBAC_ROLES for the non-Client roles.
        canManageSignedDocuments() { return ['Director', 'Superadmin', 'HR', 'Account'].includes(this.userProfile.role); },
        // Deleting a Voided signed document is more destructive than the routine
        // create/prefill/countersign work canManageSignedDocuments covers — restricted to
        // Superadmin/Director only, matching firestore.rules' delete rule on this collection.
        canDeleteSignedDocuments() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        activeTemplateFieldConfig() {
            const templateId = this.signedDocumentModal.doc ? this.signedDocumentModal.doc.templateId : this.newSignedDocumentModal.templateId;
            const tpl = this.documentTemplates[templateId];
            return tpl ? tpl.fieldConfig : [];
        },
        activeTemplateSections() {
            const seen = [];
            this.activeTemplateFieldConfig.forEach(f => { if (!seen.includes(f.section)) seen.push(f.section); });
            return seen;
        },
        visibleSignedDocuments() {
            let items = this.signedDocuments.items;
            if (this.userProfile.role === 'Client') {
                items = items.filter(d => d.status !== 'draft');
            } else {
                if (this.signedDocuments.clientFilter !== 'all') items = items.filter(d => d.clientDirectoryId === this.signedDocuments.clientFilter);
            }
            if (this.signedDocuments.statusFilter !== 'all') items = items.filter(d => d.status === this.signedDocuments.statusFilter);
            return items.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        },
        canManagePayroll() { return this.hasModulePermission('payslip-generator', 'edit'); },
        canDeleteEmployees() { return this.hasModulePermission('hr-employees', 'delete'); },
        canDeleteClients() { return this.hasModulePermission('client-directory', 'delete'); },
        canDeleteDocuments() { return this.hasModulePermission('doc-generator', 'delete'); },
        canDeletePayroll() { return this.hasModulePermission('payslip-generator', 'delete'); },
        canDelete() { return ['Superadmin', 'Director'].includes(this.userProfile.role); },
        canManageRBAC() { return ['Superadmin', 'Director'].includes(this.userProfile.role); },
        canManageCompanySettings() { return ['Director', 'Superadmin', 'IT'].includes(this.userProfile.role); },
        canManageProjects() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        canBackupDatabase() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        unreadNotificationsCount() { return this.notificationsLog.filter(n => !n.read).length; },
        latestChangelog() { return APP_CHANGELOG[0] || null; },
        appChangelog() { return APP_CHANGELOG; },
        priorityClients() { return this.customers.filter(c => c.clientTier === 'Priority'); },
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
            return this.docHistory.filter(d => d.raw && (
                this.userProfile.clientDirectoryId
                    ? d.raw.customerId === this.userProfile.clientDirectoryId
                    : d.raw.clientEmail === this.userProfile.email
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
            return [...this.projectClientUpdates]
                .sort((a, b) => String(b.createdAt || b.updateDate || '').localeCompare(String(a.createdAt || a.updateDate || '')));
        },
        clientRecentUpdates() {
            return this.clientUpdatesTimeline.slice(0, 4);
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

        totalQuotations() { return this.docHistory.filter(d => d.type === 'Quotation').length; },
        totalQuotationValue() { return this.docHistory.filter(d => d.type === 'Quotation').reduce((s, d) => s + (Number(d.amount) || 0), 0); },
        totalInvoices() { return this.docHistory.filter(d => d.type === 'Invoice').length; },
        paidInvoicesCount() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status === 'Paid').length; },
        unpaidInvoicesCount() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },

        totalRevenuePaid() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status === 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0); },
        totalRevenuePending() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status !== 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0); },

        activeEmployeesCount() { return this.employees.filter(e => e.status === 'Aktif').length; },
        totalPayrollNet() { return this.payslipHistory.reduce((s, p) => s + (Number(p.amount) || 0), 0); },

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
        totalApprovedClaimsAmount() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => c.status === 'Approved').reduce((s, c) => s + (Number(c.amount) || 0), 0); },
        financePendingClaims() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => c.status === 'Pending Account'); },

        clientPortalDocs() {
            if (this.userProfile.role === 'Client' || this.userProfile.role === 'Staff') {
                return this.docHistory.filter(d => d.raw && (
                    this.userProfile.clientDirectoryId
                        ? d.raw.customerId === this.userProfile.clientDirectoryId
                        : d.raw.clientEmail === this.userProfile.email
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
        filteredProjects() {
            const queryText = this.searchQuery.trim().toLowerCase();
            let records = [...this.projects].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
            if (this.projectScopeFilter === 'mine' && this.userProfile.role !== 'Client') {
                const email = String(this.userProfile.email || '').trim().toLowerCase();
                records = records.filter(project => String(project.ownerEmail || '').trim().toLowerCase() === email);
            }
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
        // (staff) account already owns it — almost always @zenq0r.com, since
        // isOfficialEmail() requires every non-Client role to sign in with that
        // domain. createUserWithEmailAndPassword always hits
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
        // record, not colliding with any staff account, just genuinely doesn't
        // have a Client Portal login yet. No domain restriction applies to these —
        // any domain (company domain, Gmail, whatever was saved in Client
        // Information) works fine for a Client-role account. openClientPortalAccessForEmail()
        // lets Director/Superadmin provision one for exactly this saved email in
        // one click, right from this modal.
        awaitingProjectClientEmails() {
            const blocked = new Set(this.blockedProjectClientEmails.map(b => b.email));
            return this.unlinkedProjectClientEmails.filter(email => !blocked.has(email));
        },
        projectStaffOptions() {
            return this.employees.filter(employee => employee.email && employee.empNo).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        },
        myPendingProjectActivities() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.projectActivities.filter(activity => activity.status !== 'Done' && String(activity.assignedEmail || '').trim().toLowerCase() === email).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
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
        searchQuery() { this.currentPage = 1; }
    },
    methods: {
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
                const key = project.clientDirectoryId || `unlinked-${project.clientName || 'unknown'}`;
                if (!indexByKey.has(key)) {
                    indexByKey.set(key, groups.length);
                    groups.push({ key, clientDirectoryId: project.clientDirectoryId || '', clientName: project.clientName || 'Unknown Client', projects: [] });
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
            this.projectPreview = { show: true, project: JSON.parse(JSON.stringify(project)) };
            this.loadClientDocuments(project.clientDirectoryId, project.clientName, project.clientEmail);
        },
        closeProjectDetails() {
            this.projectPreview = { show: false, project: null };
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
            if (!confirm(`Delete Client update dated ${update.updateDate || '-'}? This action cannot be undone.`)) return;
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
            if (activity.status === 'Done') return { label: 'Done', className: 'bg-slate-200 text-slate-700', borderClass: 'border-l-slate-400', dotClass: 'bg-slate-400', daysRemaining: null };
            const today = this.getLocalDateKey();
            const dueDate = String(activity.dueDate || '');
            const daysRemaining = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
            if (!Number.isFinite(daysRemaining)) return { label: 'No Due Date', className: 'bg-slate-200 text-slate-700', borderClass: 'border-l-slate-400', dotClass: 'bg-slate-400', daysRemaining: null };
            if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)} Day${Math.abs(daysRemaining) === 1 ? '' : 's'} Overdue`, className: 'bg-red-100 text-red-800', borderClass: 'border-l-red-500', dotClass: 'bg-red-500', daysRemaining };
            if (daysRemaining === 0) return { label: 'Due Today', className: 'bg-amber-100 text-amber-800', borderClass: 'border-l-amber-400', dotClass: 'bg-amber-400', daysRemaining };
            if (daysRemaining <= 3) return { label: `Due In ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}`, className: 'bg-emerald-100 text-emerald-800', borderClass: 'border-l-emerald-500', dotClass: 'bg-emerald-500', daysRemaining };
            return { label: `Scheduled · ${daysRemaining} Days`, className: 'bg-blue-100 text-blue-800', borderClass: 'border-l-blue-500', dotClass: 'bg-blue-500', daysRemaining };
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
        canCompleteProjectActivity(activity) {
            return this.canManageProjects || (this.userProfile.role !== 'Client' && String(activity?.assignedEmail || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase());
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
                    await setDoc(doc(db, 'project_activities', this.activityModal.activityId), this.normalizeOfficialRecord({ activityType: form.activityType, summary: form.summary, dueDate: form.dueDate, assignedEmpNo: form.assignedEmpNo, assignedName: form.assignedName, assignedEmail: form.assignedEmail, assignedPosition: form.assignedPosition, details: form.details, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email }), { merge: true });
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
                await setDoc(doc(db, 'project_activities', activityId), payload);
                this.logAudit('CREATE', `Scheduled ${payload.activityType} for ${payload.projectRef} and assigned to ${payload.assignedName}`);
                this.closeActivityModal();
                this.showNotify('Project activity scheduled. The assigned employee will receive an in-portal alert.');
            } catch (error) {
                console.error('Project activity scheduling failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'schedule the project activity'));
            }
        },
        async markProjectActivityDone(activity) {
            if (!this.canCompleteProjectActivity(activity)) { this.showNotify('Only the assigned employee, Director or Superadmin may complete this activity.'); return; }
            try {
                await updateDoc(doc(db, 'project_activities', activity.id), { status: 'Done', completedAt: new Date().toISOString(), completedByUid: this.userProfile.uid, completedByEmail: this.userProfile.email });
                this.logAudit('UPDATE', `Completed project activity ${activity.summary}`);
                this.showNotify('Project activity marked as done.');
            } catch (error) {
                console.error('Project activity completion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'complete the project activity'));
            }
        },
        async deleteProjectActivity(activity) {
            if (!this.canDeleteProjectActivity(activity)) { this.showNotify('Only Director and Superadmin may delete project activities.'); return; }
            if (!confirm(`Delete activity "${activity.summary || activity.id}"? This action cannot be undone.`)) return;
            try {
                await deleteDoc(doc(db, 'project_activities', activity.id));
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
            const authorizedEmails = [customer.clientEmail, ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])]
                .map(email => String(email || '').trim().toLowerCase()).filter(Boolean);
            const matchingAccess = this.projectClientAccessUsers.find(user => authorizedEmails.includes(String(user.email || '').trim().toLowerCase()))
                || this.projectClientAccessUsers.find(user => String(user.name || '').trim().toLowerCase() === String(customer.clientName || '').trim().toLowerCase());
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
                await setDoc(doc(db, 'projects', projectId), payload, { merge: isEdit });
                this.logAudit(isEdit ? 'UPDATE' : 'CREATE', `Project activity ${payload.projectRef}`);
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
            if (!this.canEditProject(project)) { this.showNotify('You do not have permission to update this project stage.'); return; }
            const currentIndex = this.projectStages.indexOf(project.status);
            const nextIndex = currentIndex + direction;
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.projectStages.length) return;
            try {
                await updateDoc(doc(db, 'projects', project.id), { status: this.projectStages[nextIndex], updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email });
                this.logAudit('UPDATE', `Project ${project.projectRef} moved to ${this.projectStages[nextIndex]}`);
                this.showNotify(`Project moved to ${this.projectStages[nextIndex]}.`);
                this.notifyByEmail({
                    to: project.clientEmail,
                    subject: `Project Update — ${project.projectRef}: ${this.projectStages[nextIndex]}`,
                    heading: 'Your Project Has Been Updated',
                    message: `Your project "${project.title}" (${project.projectRef}) has moved to the "${this.projectStages[nextIndex]}" stage.`
                });
            } catch (error) {
                console.error('Project stage update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the project stage'));
            }
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
                    await updateDoc(doc(db, 'projects', project.id), {
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
            if (!confirm(`Delete project ${project.projectRef}?${cascadeWarning} This action cannot be undone.`)) return false;
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
        csvSafeCell(value) {
            let str = String(value);
            if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
            return `"${str.replace(/"/g, '""')}"`;
        },
        exportCSV(type) {
            let filename = '';
            let rows = [];
            const todayStr = new Date().toISOString().slice(0, 10);
            
            if (type === 'payroll') {
                filename = `Laporan_Payroll_ZENQOR_${todayStr}.csv`;
                rows = [['Payslip No', 'Tarikh Bayaran', 'Nama Pekerja', 'Gaji Bersih (MYR)'], ...this.payslipHistory.map(p => [p.docNo || '', p.date || '', p.name || '', Number(p.amount || 0).toFixed(2)])];
            } else if (type === 'employees') {
                filename = `Direktori_Pekerja_ZENQOR_${todayStr}.csv`;
                rows = [['ID Pekerja', 'Nama Lengkap', 'Jawatan', 'Jabatan', 'Status', 'Gaji Asas (MYR)'], ...this.employees.map(e => [e.empNo || '', e.name || '', e.position || '', e.dept || '', e.status || 'Aktif', Number(e.basicSalary || 0).toFixed(2)])];
            } else if (type === 'docs') {
                filename = `Laporan_Invois_SebutHarga_ZENQOR_${todayStr}.csv`;
                rows = [['No Dokumen', 'Jenis', 'Tarikh Issue', 'Nama Pelanggan', 'Status', 'Jumlah (MYR)'], ...this.docHistory.map(d => [d.docNo || '', d.type || '', d.date || '', d.name || '', d.status || '', Number(d.amount || 0).toFixed(2)])];
            } else if (type === 'claims') {
                filename = `Laporan_Claims_Vouchers_ZENQOR_${todayStr}.csv`;
                rows = [
                    ['No Rujukan', 'Jenis', 'Tarikh', 'Nama Pemohon', 'No Pekerja', 'Jabatan', 'Kategori', 'Status', 'Jumlah (MYR)'],
                    ...[...this.claimsHistory, ...this.paymentVouchers].map(c => [
                        c.receiptNo || c.voucherNo || '', c.documentType || c.type || '', c.date || c.expenseDate || c.paymentDate || '',
                        c.name || '', c.empNo || '', c.dept || '', c.category || '', c.status || '', Number(c.amount || 0).toFixed(2)
                    ])
                ];
            }

            if (rows.length === 0) { this.showNotify("Tiada rekod data untuk dieksport."); return; }

            const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.map(cell => this.csvSafeCell(cell)).join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.logAudit('EXPORT', `Mengeksport fail CSV bagi modul: ${type.toUpperCase()}`);
            this.showNotify(`Laporan CSV (${type}) berjaya dimuat turun.`);
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
                customerId: '', clientName: '', clientPhone: '', clientSSM: '', clientAddress: '', clientAddress1: '', clientAddress2: '', clientAddress3: '', clientCity: '', clientState: '', clientPostcode: '', clientCountry: 'Malaysia', clientEmail: '', clientContactPerson: '', clientPosition: '', additionalClientEmailsText: '',
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

        isOfficialEmail(email) {
            if (!email) return false;
            return email.toLowerCase().trim().endsWith('@' + this.officialEmailDomain.toLowerCase());
        },
        detectClientPostcode() {
            const result = lookupMalaysiaPostcode(this.docForm.clientPostcode);
            this.docForm.clientPostcode = result.postcode;
            if (result.city) this.docForm.clientCity = result.city;
            if (result.state) this.docForm.clientState = result.state;
            if (result.postcode.length === 5) this.docForm.clientCountry = 'Malaysia';
            this.clientSavedForDocument = false;
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
            if (code.includes('resource-exhausted') || code.includes('invalid-argument')) return `The record is too large to ${action}. Select smaller images.`;
            if (code.includes('unavailable') || code.includes('deadline-exceeded')) return `Firestore is temporarily unavailable. Check the network and try again.`;
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
        // ===================== SIGNED DOCUMENTS MODULE =====================
        // Live subscription (not a one-time getDocs): a status change from any side —
        // client signs, staff countersigns, Superadmin requests deletion, Director
        // approves/rejects/voids — appears immediately for everyone else already on the
        // Documents tab, no tab switch/refresh needed. Guarded so repeated calls (tab
        // switches, post-write refreshes elsewhere in this module) don't tear down and
        // re-create the listener once it's already live; the one exception is a Client
        // account whose clientDirectoryId claim hasn't synced yet (q is null below), in
        // which case no listener is set here so the next call can retry once it has.
        loadSignedDocuments() {
            if (this.signedDocumentsUnsubscribe) return;
            this.signedDocuments.loading = true;
            this.signedDocuments.error = '';
            const baseCol = collection(db, 'signed_documents');
            // IMPORTANT: Firestore denies an ENTIRE list query if even one document
            // matching the query's filters fails the read rule — not just that one
            // document, the whole request. The read rule denies 'draft' documents to
            // clients (they haven't been sent yet), so the query itself must exclude
            // drafts too; otherwise a single pending draft for this client would make
            // their ENTIRE Signed Documents list fail with permission-denied, hiding
            // documents they actually do have access to.
            const q = this.userProfile.role === 'Client'
                ? (this.userProfile.clientDirectoryId
                    ? query(baseCol, where('clientDirectoryId', '==', this.userProfile.clientDirectoryId), where('status', 'in', ['awaiting_client', 'awaiting_zenqor', 'completed', 'voided']))
                    : null)
                : baseCol;
            if (!q) { this.signedDocuments.items = []; this.signedDocuments.loading = false; return; }
            this.signedDocumentsUnsubscribe = onSnapshot(q, (snapshot) => {
                this.signedDocuments.items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                this.signedDocuments.loading = false;
            }, (error) => {
                console.error('Load signed documents failed:', error);
                this.signedDocuments.error = error && error.code === 'permission-denied'
                    ? "You don't have access to view these documents. If this looks wrong, please contact our team."
                    : 'Could not load documents right now — check your internet connection and try again.';
                this.signedDocuments.loading = false;
            });
        },
        openNewSignedDocumentModal() {
            if (!this.canManageSignedDocuments) { this.showNotify('You do not have permission to create documents.'); return; }
            this.newSignedDocumentModal = { show: true, clientDirectoryId: '', templateId: '', saving: false };
        },
        closeNewSignedDocumentModal() { this.newSignedDocumentModal.show = false; },
        // Coordinate-overlay templates (those with a fieldMap, e.g. authorization_letter)
        // have a real master PDF registered in Firestore's document_templates
        // collection; other templates still use the legacy generate-from-scratch
        // renderer and have no such registration — returns null for those.
        async getActiveMasterTemplate(templateId) {
            const tpl = DOCUMENT_TEMPLATES[templateId];
            if (!tpl || !tpl.fieldMap) return null;
            const snap = await getDoc(doc(db, 'document_templates', templateId));
            return snap.exists() ? snap.data() : null;
        },
        // Single entry point for producing a signed_documents PDF — branches to the
        // coordinate-overlay renderer (loads + overlays the real master PDF) for
        // templates that have one registered, otherwise falls back to the legacy
        // generate-from-scratch renderer. Used by both finalizeZenqorSignature and
        // regenerateSignedDocumentPdf so they can never drift onto different engines.
        async renderSignedDocumentPdf(templateId, fields, signatures, meta) {
            const master = await this.getActiveMasterTemplate(templateId);
            if (master) {
                if (!master.downloadURL) throw new Error('The active master template has no downloadable file.');
                const masterBytes = await fetch(master.downloadURL, { cache: 'no-store' }).then(r => r.arrayBuffer());
                return buildOverlayPdfForDocument(templateId, fields, signatures, masterBytes);
            }
            return buildPdfForDocument(templateId, fields, signatures, meta);
        },
        async createSignedDocument() {
            const { clientDirectoryId, templateId } = this.newSignedDocumentModal;
            if (!clientDirectoryId) { this.showNotify('Please select a client.'); return; }
            if (!templateId || !this.documentTemplates[templateId]) { this.showNotify('Please select a document template.'); return; }
            const customer = this.customers.find(c => c.id === clientDirectoryId);
            if (!customer) { this.showNotify('Selected client could not be found.'); return; }
            this.newSignedDocumentModal.saving = true;
            try {
                const docId = doc(collection(db, 'signed_documents')).id;
                const now = new Date().toISOString();
                const activeMaster = await this.getActiveMasterTemplate(templateId);
                const record = {
                    templateId,
                    templateVersion: activeMaster ? activeMaster.version : 1,
                    status: 'draft',
                    clientDirectoryId,
                    clientName: customer.clientName || '',
                    clientEmail: customer.clientEmail || '',
                    title: `${this.documentTemplates[templateId].label.en} — ${customer.clientName || ''}`,
                    referenceNo: templateId === 'service_agreement' ? `ZNQ-SA-${Date.now().toString().slice(-6)}` : '',
                    fields: { ...defaultFieldValues(templateId), ...prefillFromCustomer(templateId, customer) },
                    signatures: { client: null, zenqor: null },
                    finalPdf: null,
                    audit: [{ action: 'created', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }],
                    createdByUid: this.userProfile.uid,
                    createdByName: this.userProfile.name,
                    createdByEmail: this.userProfile.email,
                    createdAt: now,
                    updatedAt: now,
                    lockedAt: null
                };
                await setDoc(doc(db, 'signed_documents', docId), record);
                this.logAudit('CREATE_SIGNED_DOCUMENT', `Created ${this.documentTemplates[templateId].label.en} for client ${customer.clientName}`);
                this.showNotify('Document created. Fill in your details, then send it to the client.');
                this.newSignedDocumentModal.show = false;
                await this.loadSignedDocuments();
                const created = this.signedDocuments.items.find(d => d.id === docId);
                if (created) this.openSignedDocument(created);
            } catch (error) {
                console.error('Create signed document failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'create this document'));
            } finally {
                this.newSignedDocumentModal.saving = false;
            }
        },
        openSignedDocument(docItem) {
            this.signedDocumentModal = {
                show: true,
                mode: docItem.status === 'completed' || docItem.status === 'voided' ? 'view' : 'edit',
                saving: false,
                doc: docItem,
                fields: JSON.parse(JSON.stringify(docItem.fields || {}))
            };
            this.$nextTick(() => { this.resetSignaturePad('client'); this.resetSignaturePad('zenqor'); });
        },
        closeSignedDocumentModal() { this.signedDocumentModal.show = false; },
        // Whether the CURRENT logged-in user may edit a given field right now, based on
        // its `owner` and the document's current status — mirrors the ownership boundary
        // enforced (at the top-level-key granularity) by firestore.rules.
        canEditSignedField(field) {
            const status = this.signedDocumentModal.doc ? this.signedDocumentModal.doc.status : null;
            if (this.userProfile.role === 'Client') {
                return field.owner === 'client_fills' && status === 'awaiting_client';
            }
            if (!this.canManageSignedDocuments) return false;
            if (field.owner === 'zenqor_editable') return status === 'draft' || status === 'awaiting_client';
            if (field.owner === 'zenqor_fills_after') return status === 'awaiting_zenqor';
            return false;
        },
        toggleCheckboxGroupValue(fieldId, option) {
            const current = Array.isArray(this.signedDocumentModal.fields[fieldId]) ? this.signedDocumentModal.fields[fieldId] : [];
            const idx = current.indexOf(option);
            if (idx >= 0) current.splice(idx, 1); else current.push(option);
            this.signedDocumentModal.fields[fieldId] = current;
        },
        async saveSignedDocumentFields() {
            const docItem = this.signedDocumentModal.doc;
            if (!docItem) return;
            this.signedDocumentModal.saving = true;
            try {
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    fields: this.signedDocumentModal.fields,
                    updatedAt: new Date().toISOString()
                });
                this.showNotify('Draft saved.');
                await this.loadSignedDocuments();
            } catch (error) {
                console.error('Save signed document fields failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'save this document'));
            } finally {
                this.signedDocumentModal.saving = false;
            }
        },
        async sendSignedDocumentToClient() {
            const docItem = this.signedDocumentModal.doc;
            if (!docItem) return;
            const missing = requiredFieldsMissing(docItem.templateId, this.signedDocumentModal.fields, ['zenqor_editable']);
            if (missing.length) { this.showNotify(`Please complete required fields first: ${missing.join(', ')}`); return; }
            this.signedDocumentModal.saving = true;
            try {
                const now = new Date().toISOString();
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    fields: this.signedDocumentModal.fields,
                    status: 'awaiting_client',
                    updatedAt: now,
                    audit: [...(docItem.audit || []), { action: 'sent_to_client', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.logAudit('SEND_SIGNED_DOCUMENT', `Sent ${this.documentTemplates[docItem.templateId].label.en} to client ${docItem.clientName}`);
                this.notifyByEmail({
                    to: docItem.clientEmail,
                    subject: `Action Required: Please Sign — ${this.documentTemplates[docItem.templateId].label.en}`,
                    heading: 'A Document Is Waiting For Your Signature',
                    message: `${this.documentTemplates[docItem.templateId].label.en} has been prepared for ${docItem.clientName}. Please sign in to the Client Portal to review, complete and sign it.`
                });
                this.showNotify('Sent to client for review and signature.');
                this.signedDocumentModal.show = false;
                await this.loadSignedDocuments();
            } catch (error) {
                console.error('Send signed document failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'send this document'));
            } finally {
                this.signedDocumentModal.saving = false;
            }
        },
        async submitClientSignature() {
            const docItem = this.signedDocumentModal.doc;
            if (!docItem) return;
            const missing = requiredFieldsMissing(docItem.templateId, this.signedDocumentModal.fields, ['client_fills']);
            if (missing.length) { this.showNotify(`Please complete required fields first: ${missing.join(', ')}`); return; }
            if (!this.sigPad.client.hasStrokes) { this.showNotify('Please draw your signature before submitting.'); return; }
            this.signedDocumentModal.saving = true;
            try {
                const dataUrl = this.exportSignaturePad('client');
                const now = new Date().toISOString();
                const safeDocId = docItem.id;
                const storagePath = `signed_documents/${docItem.clientDirectoryId}/${safeDocId}/signature_client.png`;
                const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                await uploadBytes(storageRef(storage, storagePath), pngBytes, { contentType: 'image/png' });
                const downloadURL = await getDownloadURL(storageRef(storage, storagePath));
                const signature = { dataUrl, storagePath, downloadURL, signedByUid: this.userProfile.uid, signedByName: this.userProfile.name, signedByEmail: this.userProfile.email, signedAt: now };
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    fields: this.signedDocumentModal.fields,
                    'signatures.client': signature,
                    status: 'awaiting_zenqor',
                    updatedAt: now,
                    audit: [...(docItem.audit || []), { action: 'client_submitted', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.logAudit('SIGN_DOCUMENT_CLIENT', `${docItem.clientName} signed ${this.documentTemplates[docItem.templateId].label.en}`);
                this.notifyByEmail({
                    to: [...this.emailsForRole('Superadmin'), ...this.emailsForRole('Director'), ...this.emailsForRole('Account')],
                    subject: `Client Signed — ${this.documentTemplates[docItem.templateId].label.en}`,
                    heading: 'Client Has Signed — Countersignature Needed',
                    message: `${docItem.clientName} has completed and signed ${this.documentTemplates[docItem.templateId].label.en}. Please review and countersign to finalize.`
                });
                this.showNotify('Signed and submitted. Zenqor will countersign to finalize this document.');
                this.signedDocumentModal.show = false;
                await this.loadSignedDocuments();
            } catch (error) {
                console.error('Submit client signature failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'submit your signature'));
            } finally {
                this.signedDocumentModal.saving = false;
            }
        },
        async finalizeZenqorSignature() {
            const docItem = this.signedDocumentModal.doc;
            if (!docItem) return;
            const missing = requiredFieldsMissing(docItem.templateId, this.signedDocumentModal.fields, ['zenqor_fills_after']);
            if (missing.length) { this.showNotify(`Please complete required fields first: ${missing.join(', ')}`); return; }
            if (!this.sigPad.zenqor.hasStrokes) { this.showNotify('Please draw the Zenqor signature before finalizing.'); return; }
            this.signedDocumentModal.saving = true;
            try {
                const now = new Date().toISOString();
                const dataUrl = this.exportSignaturePad('zenqor');
                const sigStoragePath = `signed_documents/${docItem.clientDirectoryId}/${docItem.id}/signature_zenqor.png`;
                const sigPngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                await uploadBytes(storageRef(storage, sigStoragePath), sigPngBytes, { contentType: 'image/png' });
                const sigDownloadURL = await getDownloadURL(storageRef(storage, sigStoragePath));
                const zenqorSignature = { dataUrl, storagePath: sigStoragePath, downloadURL: sigDownloadURL, signedByUid: this.userProfile.uid, signedByName: this.userProfile.name, signedByEmail: this.userProfile.email, signedAt: now };
                const signatures = { client: docItem.signatures ? docItem.signatures.client : null, zenqor: zenqorSignature };

                const pdfBytes = await this.renderSignedDocumentPdf(docItem.templateId, this.signedDocumentModal.fields, signatures, { referenceNo: docItem.referenceNo });
                const pdfStoragePath = `signed_documents/${docItem.clientDirectoryId}/${docItem.id}/final.pdf`;
                // no-cache/must-revalidate: this exact URL (path stays the same across
                // a later Regenerate PDF) would otherwise be served from the browser's
                // cache for up to an hour under Storage's default Cache-Control, so a
                // regenerated PDF could silently keep showing the old cached bytes.
                await uploadBytes(storageRef(storage, pdfStoragePath), pdfBytes, { contentType: 'application/pdf', cacheControl: 'no-cache, max-age=0, must-revalidate' });
                const pdfDownloadURL = await getDownloadURL(storageRef(storage, pdfStoragePath));

                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    fields: this.signedDocumentModal.fields,
                    'signatures.zenqor': zenqorSignature,
                    status: 'completed',
                    lockedAt: now,
                    updatedAt: now,
                    finalPdf: { storagePath: pdfStoragePath, downloadURL: pdfDownloadURL, generatedAt: now, generatedByUid: this.userProfile.uid },
                    audit: [...(docItem.audit || []), { action: 'zenqor_finalized', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.logAudit('SIGN_DOCUMENT_ZENQOR', `Finalized ${this.documentTemplates[docItem.templateId].label.en} for client ${docItem.clientName}`);
                this.notifyByEmail({
                    to: docItem.clientEmail,
                    subject: `Document Completed — ${this.documentTemplates[docItem.templateId].label.en}`,
                    heading: 'Your Document Is Now Complete',
                    message: `${this.documentTemplates[docItem.templateId].label.en} has been countersigned by Zenqor Technologies and is now complete. Sign in to the Client Portal to download the final PDF.`
                });
                this.showNotify('Document finalized and PDF generated.');
                this.signedDocumentModal.show = false;
                await this.loadSignedDocuments();
            } catch (error) {
                console.error('Finalize signed document failed:', error);
                this.showNotify(error?.message || this.getFirestoreWriteError(error, 'finalize this document'));
            } finally {
                this.signedDocumentModal.saving = false;
            }
        },
        requestVoidSignedDocument(docItem) {
            if (!['Superadmin', 'Director'].includes(this.userProfile.role)) { this.showNotify('You do not have permission to void this document.'); return; }
            this.requestConfirm({
                title: 'Void this document?',
                message: `"${docItem.title}" will be marked void and can no longer be edited or signed. This cannot be undone.`,
                confirmLabel: 'Yes, Void Document',
                danger: true,
                onConfirm: () => this.voidSignedDocument(docItem)
            });
        },
        async voidSignedDocument(docItem) {
            try {
                const now = new Date().toISOString();
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    status: 'voided',
                    updatedAt: now,
                    audit: [...(docItem.audit || []), { action: 'voided', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.showNotify('Document voided.');
                await this.loadSignedDocuments();
            } catch (error) {
                console.error('Void signed document failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'void this document'));
            }
        },
        // Same "Delete" button/click-handler for both roles — behavior branches
        // internally: a Director deletes immediately (no extra sign-off, exactly
        // like before), while a Superadmin can no longer delete on the spot and
        // is routed into requestSignedDocumentDeletionApproval() instead. This
        // matches firestore.rules: `allow delete: if isDirector();` on this
        // collection now excludes Superadmin — see the deletionRequest clauses
        // added alongside it for the approval hand-off.
        requestDeleteSignedDocument(docItem) {
            if (!this.canDeleteSignedDocuments) { this.showNotify('You do not have permission to delete this document.'); return; }
            if (this.userProfile.role !== 'Director') {
                this.requestSignedDocumentDeletionApproval(docItem);
                return;
            }
            const isCompleted = docItem.status === 'completed';
            this.requestConfirm({
                title: isCompleted ? 'Permanently delete this SIGNED document?' : 'Permanently delete this document?',
                message: isCompleted
                    ? `"${docItem.title}" has already been signed by both parties and finalized. Deleting it will permanently remove the executed PDF and signature records with no way to recover them. This cannot be undone.`
                    : `"${docItem.title}" and its signature/PDF files will be permanently removed. This cannot be undone.`,
                confirmLabel: 'Yes, Delete Document',
                danger: true,
                onConfirm: () => this.deleteSignedDocument(docItem)
            });
        },
        // Superadmin's half of the approval hand-off: instead of deleting, flag a
        // pending deletionRequest on the document for a Director to review. The
        // document itself is untouched until a Director approves (deletes) or
        // rejects (clears the flag) it.
        requestSignedDocumentDeletionApproval(docItem) {
            if (this.userProfile.role !== 'Superadmin') { this.showNotify('You do not have permission to delete this document.'); return; }
            if (docItem.deletionRequest && docItem.deletionRequest.status === 'pending') { this.showNotify('A deletion request for this document is already pending Director approval.'); return; }
            const label = this.documentTemplates[docItem.templateId] ? this.documentTemplates[docItem.templateId].label.en : docItem.templateId;
            this.requestConfirm({
                title: 'Send this document for Director approval to delete?',
                message: `As Superadmin, you can no longer delete "${label}" for ${docItem.clientName} directly — it will be sent to a Director for approval first. The document stays exactly as-is until a Director approves or rejects the request.`,
                confirmLabel: 'Send for Approval',
                danger: true,
                onConfirm: () => this.submitSignedDocumentDeletionRequest(docItem)
            });
        },
        async submitSignedDocumentDeletionRequest(docItem) {
            try {
                const now = new Date().toISOString();
                const request = { status: 'pending', requestedByUid: this.userProfile.uid, requestedByName: this.userProfile.name, requestedByEmail: this.userProfile.email, requestedAt: now };
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    deletionRequest: request,
                    updatedAt: now,
                    audit: [...(docItem.audit || []), { action: 'deletion_requested', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.logAudit('REQUEST_DELETE_SIGNED_DOCUMENT', `Requested Director approval to delete ${this.documentTemplates[docItem.templateId] ? this.documentTemplates[docItem.templateId].label.en : docItem.templateId} for client ${docItem.clientName}`);
                this.showNotify('Sent for Director approval. The document will be deleted once a Director approves it.');
                await this.loadSignedDocuments();
                if (this.signedDocumentModal.doc && this.signedDocumentModal.doc.id === docItem.id) {
                    const refreshed = this.signedDocuments.items.find(d => d.id === docItem.id);
                    if (refreshed) this.signedDocumentModal.doc = refreshed;
                }
            } catch (error) {
                console.error('Request signed document deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'request deletion approval for this document'));
            }
        },
        // Director's half: approving simply performs the real delete (same
        // deleteSignedDocument() used for a Director's own direct deletes).
        approveSignedDocumentDeletion(docItem) {
            if (this.userProfile.role !== 'Director') { this.showNotify('Only a Director can approve document deletion.'); return; }
            const label = this.documentTemplates[docItem.templateId] ? this.documentTemplates[docItem.templateId].label.en : docItem.templateId;
            const requestedBy = docItem.deletionRequest?.requestedByName || 'A Superadmin';
            this.requestConfirm({
                title: 'Approve and permanently delete this document?',
                message: `${requestedBy} requested deletion of "${label}" for ${docItem.clientName}. Approving will permanently remove the document, its signatures and final PDF. This cannot be undone.`,
                confirmLabel: 'Approve & Delete',
                danger: true,
                onConfirm: () => this.deleteSignedDocument(docItem)
            });
        },
        async rejectSignedDocumentDeletionRequest(docItem) {
            if (this.userProfile.role !== 'Director') { this.showNotify('Only a Director can reject a deletion request.'); return; }
            try {
                const now = new Date().toISOString();
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    deletionRequest: null,
                    updatedAt: now,
                    audit: [...(docItem.audit || []), { action: 'deletion_request_rejected', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.logAudit('REJECT_DELETE_SIGNED_DOCUMENT', `Rejected deletion request for ${this.documentTemplates[docItem.templateId] ? this.documentTemplates[docItem.templateId].label.en : docItem.templateId}, client ${docItem.clientName}`);
                this.showNotify('Deletion request rejected — the document was kept.');
                await this.loadSignedDocuments();
                if (this.signedDocumentModal.doc && this.signedDocumentModal.doc.id === docItem.id) {
                    const refreshed = this.signedDocuments.items.find(d => d.id === docItem.id);
                    if (refreshed) this.signedDocumentModal.doc = refreshed;
                }
            } catch (error) {
                console.error('Reject signed document deletion request failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'reject this deletion request'));
            }
        },
        async deleteSignedDocument(docItem) {
            try {
                const storagePaths = [
                    docItem.signatures?.client?.storagePath,
                    docItem.signatures?.zenqor?.storagePath,
                    docItem.finalPdf?.storagePath
                ].filter(Boolean);
                for (const path of storagePaths) {
                    try {
                        await deleteObject(storageRef(storage, path));
                    } catch (storageError) {
                        if (storageError?.code !== 'storage/object-not-found') throw storageError;
                    }
                }
                await deleteDoc(doc(db, 'signed_documents', docItem.id));
                this.logAudit('DELETE_SIGNED_DOCUMENT', `Deleted ${this.documentTemplates[docItem.templateId] ? this.documentTemplates[docItem.templateId].label.en : docItem.templateId} for client ${docItem.clientName}`);
                this.showNotify('Document permanently deleted.');
                this.signedDocumentModal.show = false;
                await this.loadSignedDocuments();
            } catch (error) {
                console.error('Delete signed document failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete this document'));
            }
        },
        // Re-renders a COMPLETED document's PDF from its already-locked fields and
        // signatures using the current buildPdfForDocument() — needed because a
        // finalPdf is generated once and stored as a static file, so a later fix to
        // the PDF layout/content doesn't retroactively touch documents completed
        // before the fix shipped. Restricted to Superadmin/Director (matches the
        // firestore.rules 'Regenerate PDF' clause) and never touches fields,
        // signatures, or status — only finalPdf itself is replaced.
        async regenerateSignedDocumentPdf(docItem) {
            if (!this.canDeleteSignedDocuments) { this.showNotify('You do not have permission to regenerate this PDF.'); return; }
            try {
                this.showNotify('Regenerating PDF…');
                const pdfBytes = await this.renderSignedDocumentPdf(docItem.templateId, docItem.fields, docItem.signatures, { referenceNo: docItem.referenceNo });
                const pdfStoragePath = docItem.finalPdf?.storagePath || `signed_documents/${docItem.clientDirectoryId}/${docItem.id}/final.pdf`;
                // no-cache/must-revalidate: this exact URL (path stays the same across
                // a later Regenerate PDF) would otherwise be served from the browser's
                // cache for up to an hour under Storage's default Cache-Control, so a
                // regenerated PDF could silently keep showing the old cached bytes.
                await uploadBytes(storageRef(storage, pdfStoragePath), pdfBytes, { contentType: 'application/pdf', cacheControl: 'no-cache, max-age=0, must-revalidate' });
                const pdfDownloadURL = await getDownloadURL(storageRef(storage, pdfStoragePath));
                const now = new Date().toISOString();
                await updateDoc(doc(db, 'signed_documents', docItem.id), {
                    finalPdf: { storagePath: pdfStoragePath, downloadURL: pdfDownloadURL, generatedAt: now, generatedByUid: this.userProfile.uid },
                    updatedAt: now,
                    audit: [...(docItem.audit || []), { action: 'pdf_regenerated', byUid: this.userProfile.uid, byName: this.userProfile.name, byEmail: this.userProfile.email, byRole: this.userProfile.role, at: now }]
                });
                this.logAudit('REGENERATE_SIGNED_DOCUMENT_PDF', `Regenerated PDF for ${this.documentTemplates[docItem.templateId] ? this.documentTemplates[docItem.templateId].label.en : docItem.templateId}, client ${docItem.clientName}`);
                this.showNotify('PDF regenerated.');
                await this.loadSignedDocuments();
                if (this.signedDocumentModal.doc && this.signedDocumentModal.doc.id === docItem.id) {
                    const refreshed = this.signedDocuments.items.find(d => d.id === docItem.id);
                    if (refreshed) this.signedDocumentModal.doc = refreshed;
                }
            } catch (error) {
                console.error('Regenerate signed document PDF failed:', error);
                this.showNotify(error?.message || this.getFirestoreWriteError(error, 'regenerate this PDF'));
            }
        },
        // ---- Signature pad (hand-drawn, canvas + Pointer Events) ----
        signaturePadRef(role) { return this.$refs['sigCanvas_' + role]; },
        resetSignaturePad(role) {
            const canvas = this.signaturePadRef(role);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const ratio = window.devicePixelRatio || 1;
            canvas.width = canvas.clientWidth * ratio;
            canvas.height = canvas.clientHeight * ratio;
            ctx.scale(ratio, ratio);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#0f172a';
            this.sigPad[role].ctx = ctx;
            this.sigPad[role].hasStrokes = false;
        },
        sigPadPointerDown(role, evt) {
            const canvas = this.signaturePadRef(role);
            if (!canvas) return;
            evt.preventDefault();
            canvas.setPointerCapture(evt.pointerId);
            this.sigPad[role].drawing = true;
            const rect = canvas.getBoundingClientRect();
            const ctx = this.sigPad[role].ctx;
            ctx.beginPath();
            ctx.moveTo(evt.clientX - rect.left, evt.clientY - rect.top);
        },
        sigPadPointerMove(role, evt) {
            if (!this.sigPad[role].drawing) return;
            const canvas = this.signaturePadRef(role);
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const ctx = this.sigPad[role].ctx;
            ctx.lineTo(evt.clientX - rect.left, evt.clientY - rect.top);
            ctx.stroke();
            this.sigPad[role].hasStrokes = true;
        },
        sigPadPointerUp(role) { this.sigPad[role].drawing = false; },
        sigPadClear(role) {
            const canvas = this.signaturePadRef(role);
            if (!canvas) return;
            const ctx = this.sigPad[role].ctx;
            ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            this.sigPad[role].hasStrokes = false;
        },
        exportSignaturePad(role) {
            const canvas = this.signaturePadRef(role);
            return canvas ? canvas.toDataURL('image/png') : '';
        },
        // Opens the finished PDF in a new tab so either party (Client or Zenqor staff)
        // can use their browser's own PDF viewer to print it — same open-in-tab pattern
        // as viewClientDocument(), just for the Signed Documents module's finalPdf.
        // Appends a cache-busting param so a PDF fetched again right after a
        // Regenerate PDF can't be served from an existing browser cache entry
        // for this exact same URL (path/token stay identical across a regenerate).
        signedDocumentPdfUrl(docItem) {
            const url = docItem.finalPdf && docItem.finalPdf.downloadURL;
            if (!url) return '';
            const cacheBust = docItem.finalPdf.generatedAt ? new Date(docItem.finalPdf.generatedAt).getTime() : Date.now();
            return `${url}${url.includes('?') ? '&' : '?'}cb=${cacheBust}`;
        },
        printSignedDocumentPdf(docItem) {
            const url = this.signedDocumentPdfUrl(docItem);
            if (!url) return;
            window.open(url, '_blank', 'noopener');
        },
        async downloadSignedDocumentPdf(docItem) {
            const url = this.signedDocumentPdfUrl(docItem);
            if (!url) return;
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error('Download failed.');
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `${docItem.title || 'document'}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error('Download signed document PDF failed:', error);
                this.showNotify('Unable to download this PDF. Please try again.');
            }
        },
        signedDocumentStatusLabel(status) {
            return { draft: 'Draft', awaiting_client: 'Awaiting Client', awaiting_zenqor: 'Awaiting Zenqor', completed: 'Completed', voided: 'Voided' }[status] || status;
        },
        signedDocumentStatusClass(status) {
            return {
                draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
                awaiting_client: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                awaiting_zenqor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
                completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
                voided: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
            }[status] || 'bg-slate-100 text-slate-700';
        },
        // ===================== END SIGNED DOCUMENTS MODULE =====================
        requestConfirm({ title, message, confirmLabel = 'Yes, Continue', danger = false, onConfirm }) {
            this.appConfirm = { show: true, title, message, confirmLabel, danger, onConfirm };
        },
        resolveAppConfirm(confirmed) {
            const { onConfirm } = this.appConfirm;
            this.appConfirm = { show: false, title: '', message: '', confirmLabel: 'Yes, Continue', danger: false, onConfirm: null };
            if (confirmed && typeof onConfirm === 'function') onConfirm();
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
            const override = this.userProfile.customAccess && this.userProfile.customAccess[moduleName];
            if (override && typeof override.view === 'boolean') return override.view;
            if (['client-documents', 'client-updates', 'client-support'].includes(moduleName)) {
                const portalOverride = this.userProfile.customAccess && this.userProfile.customAccess['client-portal'];
                if (portalOverride && typeof portalOverride.view === 'boolean') return portalOverride.view;
            }
            const allowedModules = RBAC_ROLES[this.userProfile.role] || ['dashboard'];
            return allowedModules.includes(moduleName);
        },
        // Per-module permission check used by Portal Access Management's custom overrides.
        // action: 'view' | 'edit' | 'delete'. Falls back to the role's default when the
        // admin/owner hasn't ticked a specific override for this module on this user —
        // 'edit' defaults to page visibility, 'delete' defaults to the global canDelete flag,
        // matching this app's pre-existing behavior for users with no override set.
        hasModulePermission(moduleName, action) {
            const override = this.userProfile.customAccess && this.userProfile.customAccess[moduleName];
            if (override && typeof override[action] === 'boolean') return override[action];
            // website-content grants IT full edit+delete (firestore.rules' isContentAdmin()
            // covers IT for these public-site collections too), unlike every other module
            // where 'delete' defaults to Superadmin/Director only.
            if (action === 'delete' && moduleName === 'website-content') return this.hasAccess(moduleName);
            if (action === 'delete') return ['Superadmin', 'Director'].includes(this.userProfile.role);
            return this.hasAccess(moduleName);
        },
        // Toggles a module's custom access override on the Add/Update Portal Access form.
        // Ticking grants full view+edit+delete for that page by default; the admin can then
        // untick Edit/Delete individually to fine-tune. Unticking removes the override
        // entirely so the user reverts to their role's default access for that page.
        toggleAccessModule(moduleKey) {
            if (!this.userModal.form.customAccess) this.userModal.form.customAccess = {};
            if (this.userModal.form.customAccess[moduleKey]) {
                delete this.userModal.form.customAccess[moduleKey];
            } else {
                this.userModal.form.customAccess[moduleKey] = { view: true, edit: true, delete: true };
            }
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
        isEmployeeOnline(emp) {
            const lastUpdate = this.getPresenceTime(emp.presenceUpdatedAt || emp.lastSeen);
            return emp.presenceStatus === 'Online' && lastUpdate > 0 && (this.presenceNow - lastUpdate) < 90000;
        },
        isPortalUserOnline(user) {
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
        async setCurrentEmployeePresence(isOnline) {
            if (!auth.currentUser || !this.userProfile.email || !this.employees.length) return false;
            const email = this.userProfile.email.trim().toLowerCase();
            const employee = this.employees.find(emp => emp.presenceUid === auth.currentUser.uid)
                || this.employees.find(emp => String(emp.email || '').trim().toLowerCase() === email);
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
        showNotify(msg) {
            this.notification = { show: true, message: msg };
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
        markAllNotificationsRead() {
            this.notificationsLog.forEach(n => { n.read = true; });
            this.syncNotificationsLog();
        },
        clearNotificationsLog() {
            this.notificationsLog = [];
            this.notificationsPanelOpen = false;
            this.syncNotificationsLog();
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
        openSidebar() {
            if (window.innerWidth < 768) this.mobileMenuOpen = true;
            else this.desktopSidebarOpen = true;
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
                // Checks BOTH index.html and app.js — most deploys only change app.js
                // (the actual application logic), so watching the page alone missed
                // updates entirely and this banner never appeared for those releases.
                const [pageResponse, scriptResponse] = await Promise.all([
                    fetch(`${window.location.pathname}?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }),
                    fetch(`/app.js?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
                ]);
                const pageMarker = pageResponse.headers.get('etag') || pageResponse.headers.get('last-modified') || '';
                const scriptMarker = scriptResponse.headers.get('etag') || scriptResponse.headers.get('last-modified') || '';
                if (!pageMarker && !scriptMarker) return;
                const marker = `${pageMarker}|${scriptMarker}`;
                if (!this.appVersionMarker) { this.appVersionMarker = marker; return; }
                if (marker !== this.appVersionMarker) this.appUpdateAvailable = true;
            } catch (error) { /* offline or blocked request, ignore and retry next interval */ }
        },
        refreshApp() {
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
        async dismissOnboarding() {
            this.showOnboarding = false;
            const latestVersion = APP_CHANGELOG[0]?.version || '';
            this.userProfile.lastSeenChangelogVersion = latestVersion;
            if (!this.userProfile.uid) return;
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid), { lastSeenChangelogVersion: latestVersion }, { merge: true });
            } catch (error) {
                console.error('Unable to save onboarding/changelog state:', error);
            }
        },
        maybeShowOnboarding() {
            const latestVersion = APP_CHANGELOG[0]?.version || '';
            if (!latestVersion) return;
            const seenVersion = this.userProfile.lastSeenChangelogVersion || '';
            if (seenVersion === latestVersion) return;
            this.onboardingMode = seenVersion ? 'whatsnew' : 'welcome';
            this.showOnboarding = true;
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
            this.currentTab = tabName; this.mobileMenuOpen = false; this.desktopSidebarOpen = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (tabName === 'documents') this.loadSignedDocuments();
        },
        returnToDashboard() {
            if (this.userProfile.role === 'Client') this.switchTab('client-portal');
            else this.switchTab('dashboard');
        },
        restoreTabFromHistory(tabName) {
            const homeTab = this.userProfile.role === 'Client' ? 'client-portal' : 'dashboard';
            const safeTab = typeof tabName === 'string' && this.hasAccess(tabName) ? tabName : homeTab;
            this.currentTab = safeTab;
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.scrollTo({ top: 0, behavior: 'auto' });
            if (safeTab === 'documents') this.loadSignedDocuments();
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
            this.forgetTrustedDeviceOnLogout = false;
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
            const token = params.get('resetToken');
            if (!token) return;
            this.passwordResetFlow.active = true;
            this.passwordResetFlow.oobCode = token;
            window.history.replaceState({}, '', window.location.pathname);
            try {
                const response = await fetch('/api/verify-reset-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                const data = await response.json();
                this.passwordResetFlow.valid = Boolean(data.valid);
                if (data.valid) this.passwordResetFlow.email = data.email;
                else this.passwordResetFlow.error = data.reason || 'This reset link is invalid. Please request a new one.';
            } catch (error) {
                console.error('Password reset link verification failed:', error);
                this.passwordResetFlow.valid = false;
                this.passwordResetFlow.error = 'Unable to verify this reset link. Please request a new one.';
            } finally {
                this.passwordResetFlow.verifying = false;
            }
        },
        async submitPasswordReset() {
            this.passwordResetFlow.error = '';
            if (this.passwordResetFlow.newPassword.length < 8) { this.passwordResetFlow.error = 'New password must be at least 8 characters long.'; return; }
            if (this.passwordResetFlow.newPassword !== this.passwordResetFlow.confirmPassword) { this.passwordResetFlow.error = 'Passwords do not match.'; return; }
            this.passwordResetFlow.loading = true;
            try {
                const response = await fetch('/api/confirm-password-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: this.passwordResetFlow.oobCode, newPassword: this.passwordResetFlow.newPassword })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Unable to reset your password.');
                this.passwordResetFlow.success = true;
            } catch (error) {
                console.error('Password reset confirmation failed:', error);
                this.passwordResetFlow.error = error.message || 'Unable to reset your password. Please try again.';
            } finally {
                this.passwordResetFlow.loading = false;
            }
        },
        exitPasswordResetFlow() {
            this.passwordResetFlow = { active: false, oobCode: '', email: '', verifying: true, valid: false, error: '', newPassword: '', confirmPassword: '', loading: false, success: false };
        },

        async handleLogin() {
            this.loginError = '';
            this.loginLoading = true;
            this.interactiveLoginInProgress = true;
            try {
                const userCredential = await signInWithEmailAndPassword(auth, this.loginForm.email, this.loginForm.password);
                const firebaseUser = userCredential.user;
                const userData = await this.loadOrMigrateUserMetadata(firebaseUser);
                const isSeedAdmin = firebaseUser.email === 'admin@zenq0r.com';

                if (!userData && !isSeedAdmin) {
                    await signOut(auth);
                    this.loginError = 'This account is not provisioned or your access has been revoked. Contact your administrator.';
                    this.loginLoading = false;
                    return;
                }

                let role = userData?.role || 'Staff';
                let name = userData?.name || firebaseUser.displayName || firebaseUser.email;
                let photo = userData?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B1E36&color=D4AF37`;

                const mustChangePassword = userData?.mustChangePassword === true;
                if (isSeedAdmin) role = 'Superadmin';
                if (role !== 'Client' && !this.isOfficialEmail(firebaseUser.email)) {
                    await signOut(auth);
                    this.loginError = `Only Client Users System Terminal may use an external email. Other roles must use @${this.officialEmailDomain}.`;
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

                // Password alone is not trusted to finish any provisioned RBAC login.
                // Every role must verify an emailed one-time code before the portal starts.
                // The Firebase Auth session is already live at this point (signOut on
                // cancel below un-does it); this gate only controls when the PORTAL
                // itself trusts the sign-in as complete.
                if (Object.prototype.hasOwnProperty.call(RBAC_ROLES, role)) {
                    const loginContext = { firebaseUser, userData, role, name, photo, mustChangePassword };
                    this.pendingLoginContext = loginContext;
                    if (await this.checkTrustedDevice(firebaseUser)) {
                        this.pendingLoginContext = null;
                        await this.completeLogin(loginContext);
                        return;
                    }
                    this.loginOtp = { show: true, code: '', error: '', sending: true, verifying: false, email: firebaseUser.email, trustDevice: true };
                    this.loginLoading = false;
                    await this.requestLoginOtp();
                    return;
                }

                await this.completeLogin({ firebaseUser, userData, role, name, photo, mustChangePassword });
            } catch (error) {
                this.loginError = 'Invalid email or password credentials / System Error.';
                this.loginLoading = false;
            } finally {
                this.interactiveLoginInProgress = false;
            }
        },
        async requestLoginOtp() {
            try {
                const idToken = await this.pendingLoginContext.firebaseUser.getIdToken();
                const resp = await fetch('/api/request-login-otp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` } });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(data.error || 'Failed to send verification code.');
                this.loginOtp.sending = false;
            } catch (error) {
                console.error('Request login OTP failed:', error);
                this.loginOtp.error = error.message || 'Unable to send verification code. Try again.';
                this.loginOtp.sending = false;
            }
        },
        async checkTrustedDevice(firebaseUser, attempt = 0) {
            try {
                const idToken = await firebaseUser.getIdToken();
                const resp = await fetch('/api/check-trusted-device', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });
                const data = await resp.json().catch(() => ({}));
                return resp.ok && data.trusted === true;
            } catch (error) {
                // A hard refresh re-fetches every resource from cold — Firebase's SDK, this
                // call's own network path, everything — at once, which occasionally trips a
                // transient failure here that a normal refresh wouldn't hit. One retry avoids
                // forcing an already-trusted device through a fresh OTP over a network blip.
                if (attempt < 1) return this.checkTrustedDevice(firebaseUser, attempt + 1);
                console.warn('Trusted-device check failed; OTP will be required:', error);
                return false;
            }
        },
        async verifyLoginOtp() {
            if (!this.loginOtp.code || this.loginOtp.code.trim().length !== 6) { this.loginOtp.error = 'Enter the 6-digit code from your email.'; return; }
            this.loginOtp.verifying = true;
            this.loginOtp.error = '';
            try {
                const idToken = await this.pendingLoginContext.firebaseUser.getIdToken();
                const resp = await fetch('/api/verify-login-otp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify({ code: this.loginOtp.code.trim(), trustDevice: this.loginOtp.trustDevice === true }) });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.valid) throw new Error(data.error || 'Invalid or expired code.');
                this.loginOtp.show = false;
                this.loginOtp.verifying = false;
                const ctx = this.pendingLoginContext;
                this.pendingLoginContext = null;
                await this.completeLogin(ctx);
            } catch (error) {
                console.error('Verify login OTP failed:', error);
                this.loginOtp.error = error.message || 'Verification failed.';
                this.loginOtp.verifying = false;
            }
        },
        async cancelLoginOtp() {
            this.loginOtp.show = false;
            this.pendingLoginContext = null;
            try { await signOut(auth); } catch (error) { console.error('Sign-out during OTP cancel failed:', error); }
        },
        async completeLogin({ firebaseUser, userData, role, name, photo, mustChangePassword }) {
            if (Object.prototype.hasOwnProperty.call(RBAC_ROLES, role)) {
                try { sessionStorage.setItem('zenqorOtpVerifiedUid', firebaseUser.uid); } catch (error) { console.error('Failed to persist OTP-verified marker:', error); }
            }
            this.userProfile = { name: name, email: firebaseUser.email, role: role, uid: firebaseUser.uid, photo: photo, mustChangePassword, themePreference: userData?.themePreference || 'light', lastSeenChangelogVersion: userData?.lastSeenChangelogVersion || '', customAccess: userData?.customAccess || {} };
            this.applyDarkModePreference();
            this.notificationsLog = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : [];
            this.startIdleTimeoutWatch();
            await this.syncUserClaims();

            this.resetAllForms(); this.isLoggedIn = true; this.desktopSidebarOpen = false; this.mobileMenuOpen = false;
            await this.logAudit('LOGIN', `User logged in with role ${this.getRoleDisplayName(role)}`);
            this.showNotify(`Welcome back (${this.getRoleDisplayName(role)}): ${name}`);
            this.currentTab = mustChangePassword ? 'profile' : (role === 'Client' ? 'client-portal' : 'dashboard');
            window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
            if (mustChangePassword) { this.changePasswordModal.required = true; this.changePasswordModal.show = true; }
            else this.maybeShowOnboarding();
            await this.initFirebaseRealtime();
            await this.startPresenceTracking();
            this.loginLoading = false;
            this.refreshDashboardCharts();
        },

        async handleLogout() {
            this.logoutConfirm = false;
            try { await this.logAudit('LOGOUT', 'User logged out'); } catch (error) { console.error('Audit log failed during logout:', error); }
            try { await this.setCurrentPresence(false); } catch (error) { console.error('Presence update failed during logout:', error); }
            this.stopPresenceTracking();
            if (this.forgetTrustedDeviceOnLogout) {
                try { await this.revokeTrustedDeviceAccess(); }
                catch (error) { console.error('Trusted-device revocation failed during logout:', error); }
            }
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Firebase sign-out failed:', error);
                this.showNotify('Sign-out ran into an issue, but your local session has been cleared. Close this tab if you are on a shared device.');
            } finally {
                this.destroyDashboardCharts();
                this.isLoggedIn = false; this.loginLoading = false; this.portalDataReady = false; this.portalDataReadyPromise = null; this.userProfile = { name: '', email: '', role: '', photo: '' };
                this.resetAllForms(); this.currentTab = 'dashboard'; this.loginForm = { email: '', password: '' }; this.searchQuery = ''; this.authView = 'landing';
                try { sessionStorage.removeItem('zenqorOtpVerifiedUid'); } catch (error) { console.error('Failed to clear OTP-verified marker:', error); }
                this.forgetTrustedDeviceOnLogout = false;
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
                await this.revokeTrustedDeviceAccess();
                await updatePassword(user, newPassword);
                await setDoc(doc(db, "users", user.uid), { mustChangePassword: false }, { merge: true });
                this.userProfile.mustChangePassword = false;
                this.changePasswordModal.show = false; this.changePasswordModal.required = false; this.changePasswordModal.currentPassword = ''; this.changePasswordModal.newPassword = ''; this.changePasswordModal.confirmPassword = '';
                this.logAudit('UPDATE', 'User changed their password'); this.showNotify('Password updated successfully!');
            } catch (error) { this.changePasswordModal.error = 'Current password is incorrect or System error.'; } finally { this.changePasswordModal.loading = false; }
        },

        async revokeTrustedDeviceAccess() {
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) return;
            const idToken = await firebaseUser.getIdToken();
            const resp = await fetch('/api/revoke-trusted-devices', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!resp.ok) throw new Error('Unable to forget trusted devices.');
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
            if (usr) { this.userModal.isEdit = true; this.userModal.form = { uid: usr.uid || usr.id || '', name: usr.name || '', email: usr.email || '', password: '', role: usr.role || 'Staff', customAccess: JSON.parse(JSON.stringify(usr.customAccess || {})) }; }
            else { this.userModal.isEdit = false; this.userModal.form = { uid: '', name: '', email: '', password: this.generateRandomPassword(8), role: 'Staff', customAccess: {} }; }
            this.userModal.show = true;
        },

        // One-click provisioning for a Client Portal Access account, called from the
        // New/Update Project modal for one of awaitingProjectClientEmails — an email
        // already saved on the client's Bill To record (Client Information form) that
        // has no login account yet. No domain restriction applies here: whatever was
        // typed into Email Address / Additional Authorized Emails (company domain,
        // Gmail, anything) is used exactly as saved — this just opens the same Add
        // Portal Access form used elsewhere, pre-filled with that email and role
        // 'Client', so Director/Superadmin only has to set a password and confirm.
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
                customAccess: {}
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
                body: JSON.stringify({ to: recipients, subject, heading, message, ctaLabel, ctaUrl: ctaUrl || 'https://www.hrct.portal.zenqor.com.my/' })
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
            const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnapshot = await getDoc(userRef);
            if (userSnapshot.exists()) return userSnapshot.data();

            const normalizedEmail = firebaseUser.email.trim().toLowerCase();
            const pendingRef = doc(db, 'pending_access', normalizedEmail);
            const pendingSnapshot = await getDoc(pendingRef);
            if (!pendingSnapshot.exists()) return null;

            const pendingData = pendingSnapshot.data();
            const migratedData = {
                email: normalizedEmail,
                name: pendingData.name || firebaseUser.displayName || normalizedEmail,
                photo: pendingData.photo || '',
                role: pendingData.role || 'Client',
                customAccess: pendingData.customAccess || {},
                mustChangePassword: pendingData.mustChangePassword === true,
                migratedAt: new Date().toISOString()
            };
            await setDoc(userRef, migratedData);
            await deleteDoc(pendingRef);
            return migratedData;
        },

        sendWelcomeEmail(userForm) {
            const originEmail = "admin@zenq0r.com";
            const subject = encodeURIComponent(`[ZENQOR ENTERPRISE] Official Account & Portal Access Information (${this.getRoleDisplayName(userForm.role)})`);
                const emailBody = encodeURIComponent(`Greetings ${userForm.name},\n\nYour user account for the ZENQOR TECHNOLOGIES Enterprise Portal v2.0 has been created.\n\nSign-In Email: ${userForm.email}\nTemporary Password: ${userForm.password}\nAssigned Role: ${this.getRoleDisplayName(userForm.role)}\nPortal Link: https://www.hrct.portal.zenqor.com.my/\n\nYou will be required to change this temporary password immediately after your first sign-in.\n\nBest regards,\nSystem Administrator`);
            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(userForm.email)}&su=${subject}&body=${emailBody}`, '_blank');
            this.showNotify(`Google Gmail compose window opened.`);
        },

        async savePortalUser() {
            try {
                if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
                if (!this.userModal.form.name || !this.userModal.form.email || (this.userModal.isEdit === false && !this.userModal.form.password)) { this.showNotify("Please fill out all required fields."); return; }
                if (this.userModal.form.role !== 'Client' && !this.isOfficialEmail(this.userModal.form.email)) {
                    this.showNotify(`Only Client Users System Terminal may use Gmail or another external domain. This role must use @${this.officialEmailDomain}.`);
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
                    const { initializeApp, deleteApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
                    const { getAuth, createUserWithEmailAndPassword, signOut: signOutSecondary } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
                    const secondaryApp = initializeApp(auth.app.options, "SecondaryAuthApp-" + Date.now());
                    const secondaryAuth = getAuth(secondaryApp);
                    try {
                        const createdUser = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                        userId = createdUser.user.uid;
                    } catch (authErr) {
                        if (authErr.code === 'auth/email-already-in-use') existingAuthenticationAccount = true;
                        else { this.showNotify("Gagal mendaftar ke Firebase: " + authErr.message); return; }
                    } finally {
                        await signOutSecondary(secondaryAuth).catch(() => {});
                        await deleteApp(secondaryApp).catch(() => {});
                    }
                }

                if (!userId) {
                    await setDoc(doc(db, 'pending_access', email), {
                        email,
                        name: this.userModal.form.name,
                        photo: photoUrl,
                        role: this.userModal.form.role,
                        customAccess: this.userModal.form.customAccess || {},
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
                await setDoc(doc(db, "users", userId), { email: email, name: this.userModal.form.name, photo: photoUrl, role: this.userModal.form.role, customAccess: this.userModal.form.customAccess || {}, ...(isNewUser ? { mustChangePassword: true } : {}) }, { merge: true });
                if (userId === this.userProfile.uid) {
                    this.userProfile.role = this.userModal.form.role;
                    this.userProfile.name = this.userModal.form.name;
                    this.userProfile.photo = photoUrl;
                    this.userProfile.customAccess = this.userModal.form.customAccess || {};
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
            if (confirm(`Are you sure you want to delete portal access for: ${email}?`)) {
                try { await deleteDoc(doc(db, "users", uid)); this.logAudit('DELETE', `Deleted user metadata for ${email}`); this.showNotify('User record deleted.'); } catch (error) { console.error('Portal user deletion failed:', error); this.showNotify('Unable to delete portal access.'); }
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
            try { this.company.address = this.formattedCompanyAddress(); this.company = this.normalizeOfficialRecord(this.company); this.company.email = String(this.company.email || '').trim().toLowerCase(); await setDoc(doc(db, "settings", "company_profile"), { ...this.company }, { merge: true }); this.logAudit('UPDATE', 'Updated settings'); this.showNotify('Settings updated!'); } catch (error) { this.showNotify('Unable to save company settings.'); }
        },

        loadCustomerIntoDocument(cust) {
            if (!cust?.id) return;
            const previousCustomerId = this.docForm.customerId || '';
            const switchedCompany = previousCustomerId !== cust.id;
            const clientFields = ['clientName', 'clientPhone', 'clientSSM', 'clientAddress', 'clientAddress1', 'clientAddress2', 'clientAddress3', 'clientCity', 'clientState', 'clientPostcode', 'clientEmail', 'clientContactPerson', 'clientPosition'];

            // Assign every client field explicitly, including empty values. This
            // prevents an optional field from the previous company leaking into the
            // document for the newly selected company.
            clientFields.forEach(field => { this.docForm[field] = cust[field] || ''; });
            this.docForm.clientAddress1 = cust.clientAddress1 || cust.clientAddress || '';
            this.docForm.clientAddress = cust.clientAddress || this.docForm.clientAddress1;
            this.docForm.clientCountry = cust.clientCountry || 'Malaysia';
            this.docForm.customerId = cust.id;
            this.docForm.additionalClientEmailsText = Array.isArray(cust.additionalClientEmails) ? cust.additionalClientEmails.join(', ') : '';
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
                this.docForm.additionalClientEmailsText = '';
                this.clientSavedForDocument = false;
            }
        },
        async saveCustomerToDatabase() {
            if (!this.canManageClients) { this.showNotify('You do not have permission to save client records.'); return false; }
            if (!this.docForm.clientName || !this.docForm.clientPhone || !(this.docForm.clientAddress1 || this.docForm.clientAddress)) return this.showNotify('Enter Client Name, Phone, and Address Line 1.');
            if (!/^\d{5}$/.test(String(this.docForm.clientPostcode || '')) || !this.docForm.clientCity || !this.docForm.clientState) return this.showNotify('Enter a valid 5-digit postcode, City, and State.');
            try {
                // Existing records keep whatever ID they already have (legacy records are
                // still name-derived — left untouched to avoid a data migration). New
                // records get a generated unique ID instead of one derived from the client
                // name, since two unrelated clients can share a common SME name (e.g. two
                // different "ABC Enterprise" entities) and would otherwise silently merge
                // into the same customers/{id} document.
                const isNewRecord = !this.docForm.customerId;
                const docId = this.docForm.customerId || doc(collection(db, "customers")).id;
                const additionalClientEmails = String(this.docForm.additionalClientEmailsText || '')
                    .split(',').map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'));
                const clientAddress1 = String(this.docForm.clientAddress1 || this.docForm.clientAddress || '').trim();
                const newCust = this.normalizeOfficialRecord({ clientName: this.docForm.clientName, clientPhone: this.docForm.clientPhone, clientSSM: this.docForm.clientSSM, clientAddress: clientAddress1, clientAddress1, clientAddress2: this.docForm.clientAddress2, clientAddress3: this.docForm.clientAddress3, clientCity: this.docForm.clientCity, clientState: this.docForm.clientState, clientPostcode: this.docForm.clientPostcode, clientCountry: this.docForm.clientCountry, clientEmail: String(this.docForm.clientEmail || '').trim().toLowerCase(), clientContactPerson: this.docForm.clientContactPerson, clientPosition: this.docForm.clientPosition, additionalClientEmails });
                if (isNewRecord) newCust.createdAt = new Date().toISOString();
                this.docForm.customerId = docId;
                Object.assign(this.docForm, newCust);
            await setDoc(doc(db, "customers", docId), newCust, { merge: true }); this.clientSavedForDocument = true; this.logAudit(isNewRecord ? 'CREATE' : 'UPDATE', `Saved customer ${this.docForm.clientName}`);
                // Email Address / Additional Authorized Emails save fine as plain contact
                // info regardless of domain — but if one already belongs to an existing
                // non-Client (staff) portal account, it can NEVER also become this client's
                // Client Portal login (one email = one Firebase Auth account), so the
                // "Client Portal Access" link on any Project created for this client will
                // stay empty no matter how many times Portal Access is (re)created for it.
                // Warn immediately here instead of leaving the director to discover it only
                // when Project creation silently produces no linked account.
                const staffEmailConflicts = [newCust.clientEmail, ...additionalClientEmails]
                    .filter(Boolean)
                    .map(email => this.users.find(user => user.role && user.role !== 'Client' && String(user.email || '').trim().toLowerCase() === email))
                    .filter(Boolean);
                if (staffEmailConflicts.length) {
                    const list = staffEmailConflicts.map(user => `${user.email} (${user.role} staff account)`).join(', ');
                    this.showNotify(`Client saved. Note: ${list} cannot be used for this client's Client Portal login — already an active staff account. Use a different email for Client Portal access.`);
                } else {
                    this.showNotify('Client saved. You can now add document items.');
                }
                return true;
            } catch (error) { console.error('Client save failed:', error); this.showNotify('Unable to save client information.'); return false; }
        },
        selectCustomerFromTable(cust) {
            this.loadCustomerIntoDocument(cust);
        },
        openClientView(cust) {
            this.clientView.client = {
                id: cust.id || '', clientName: cust.clientName || '-', clientSSM: cust.clientSSM || '-', clientContactPerson: cust.clientContactPerson || '-',
                clientPosition: cust.clientPosition || '-', clientEmail: cust.clientEmail || '-', clientPhone: cust.clientPhone || '-',
                clientAddress: cust.clientAddress || '', clientAddress1: cust.clientAddress1 || cust.clientAddress || '', clientAddress2: cust.clientAddress2 || '', clientAddress3: cust.clientAddress3 || '', clientCity: cust.clientCity || '', clientState: cust.clientState || '',
                clientPostcode: cust.clientPostcode || '', clientCountry: cust.clientCountry || 'Malaysia', clientTier: cust.clientTier || 'Standard'
            };
            this.clientView.show = true;
            if (cust.id) this.loadClientDocuments(cust.id, cust.clientName, cust.clientEmail);
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
                    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
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
                Priority: { label: 'Priority', badgeClass: 'bg-rose-100 text-rose-700' },
                Premium: { label: 'Premium', badgeClass: 'bg-amber-100 text-amber-700' },
                Standard: { label: 'Standard', badgeClass: 'bg-slate-100 text-slate-600' }
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
        // CROSS-SYSTEM INSIGHT: client health score blends Billing (payment behaviour) with
        // Project Activities (delivery velocity) — a signal only possible with HR + Client data unified.
        clientHealthScore(cust) {
            if (!cust) return { score: 0, label: 'No Data', className: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' };
            // Match by the linked customer record id, not the display name — two distinct
            // clients can share the same clientName (see saveCustomerToDatabase's own guard
            // against this), which would otherwise silently conflate their invoice totals.
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
        isNewClient(clientDirectoryId) {
            if (!clientDirectoryId) return false;
            const customer = this.customers.find(c => c.id === clientDirectoryId);
            if (!customer?.createdAt) return false;
            const createdMs = Date.parse(customer.createdAt);
            if (!Number.isFinite(createdMs)) return false;
            const ageMs = Date.now() - createdMs;
            return ageMs >= 0 && ageMs <= 3 * 24 * 60 * 60 * 1000;
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
        websiteContentLabel(collectionName) {
            if (collectionName === 'portfolio_gaming') return 'Licensing & Permits';
            if (collectionName === 'services') return 'Services';
            return 'Our Client';
        },
        openWebsiteContentModal(collectionName, item = null) {
            if (!this.hasModulePermission('website-content', 'edit')) { this.showNotify('You do not have permission to manage website content.'); return; }
            if (this.websiteContentModal.imagePreviewUrl && this.websiteContentModal.imageFile) URL.revokeObjectURL(this.websiteContentModal.imagePreviewUrl);
            (this.websiteContentModal.mediaItems || []).forEach(media => { if (media.file && media.previewUrl) URL.revokeObjectURL(media.previewUrl); });
            const isPortfolioWeb = collectionName === 'portfolio_web';
            let mediaItems = [];
            if (isPortfolioWeb) {
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
            this.websiteContentModal = { show: false, isEdit: false, collectionName: 'portfolio_web', id: '', form: { tag: '', title: '', desc: '', imgUrl: '', imgStoragePath: '', icon: '', name: '', companyName: '', eventDate: '' }, imageFile: null, imagePreviewUrl: '', imageOrientation: '', mediaItems: [], removedMediaStoragePaths: [], uploading: false };
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
        async handleWebsiteContentImageSelect(e) {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await this.validateWebsiteContentImage(file);
            } catch (error) {
                this.showNotify(error.message || 'Unable to use this image.');
                e.target.value = '';
                return;
            }
            if (this.websiteContentModal.imagePreviewUrl && this.websiteContentModal.imageFile) URL.revokeObjectURL(this.websiteContentModal.imagePreviewUrl);
            this.websiteContentModal.imageFile = file;
            this.websiteContentModal.imagePreviewUrl = URL.createObjectURL(file);
            this.websiteContentModal.imageOrientation = '';
            // Detected purely for the admin's own preview label (Portrait/Landscape/Square) —
            // the public site (zenqor-tech) does its own detection from the uploaded image
            // directly, so nothing here needs to be persisted to Firestore.
            const probe = new Image();
            probe.onload = () => {
                if (this.websiteContentModal.imageFile !== file) return;
                const ratio = probe.naturalWidth / probe.naturalHeight;
                this.websiteContentModal.imageOrientation = ratio < 0.85 ? 'Portrait' : ratio > 1.15 ? 'Landscape' : 'Square';
            };
            probe.src = this.websiteContentModal.imagePreviewUrl;
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
        // Our Client gallery's multi-media uploader (images + MP4, up to 6 files).
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
            const isPortfolioWeb = collectionName === 'portfolio_web';
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
                if (isPortfolioWeb) {
                    if (!this.websiteContentModal.mediaItems.length) { this.showNotify('Attach at least one photo or video.'); return; }
                } else if (!this.websiteContentModal.imageFile && !form.imgUrl) {
                    this.showNotify('Upload an image (PNG, JPG or JPEG).'); return;
                }
                payload = { tag, companyName, title, eventDate, desc };
            }
            const label = isServices ? payload.name : payload.title;
            this.websiteContentModal.uploading = isPortfolioWeb
                ? this.websiteContentModal.mediaItems.some(media => media.file)
                : (!isServices && Boolean(this.websiteContentModal.imageFile));
            try {
                let oldStoragePath = '';
                if (isPortfolioWeb) {
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
                if (isPortfolioWeb && this.websiteContentModal.removedMediaStoragePaths.length) {
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
            if (!confirm(`Delete "${label}" from ${this.websiteContentLabel(collectionName)}? This removes it from the live site immediately.`)) return;
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
            if (!confirm(`Reset "${key}" to the site's built-in default text? This removes your override.`)) return;
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
            if (!this.canManageClients) { this.showNotify('You do not have permission to update client tier.'); return; }
            if (!cust?.id) return;
            try {
                await setDoc(doc(db, 'customers', cust.id), { clientTier: tier, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid }, { merge: true });
                this.logAudit('UPDATE', `Set ${tier} tier for client ${cust.clientName}`);
                this.showNotify(`${cust.clientName} tagged as ${tier} Client.`);
            } catch (error) {
                console.error('Client tier update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the client tier'));
            }
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
            if (!this.hasAccess('doc-generator')) { this.showNotify('Editing client details requires Billing & Documents access, which your role does not have.'); return; }
            this.selectCustomerFromTable(cust); this.switchTab('doc-generator');
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
            // Name only — role/customAccess/email stay untouched here, and firestore.rules
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
            if (!confirm(`Move ${legacyVouchers.length} Payment Voucher record(s) out of the Claims collection into the new dedicated Payment Vouchers collection?\n\nThis requires the updated firestore.rules to already be deployed. Each record is copied first, then removed from Claims — if anything fails, no data is lost.`)) return;
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
            if (role === 'Director') return typeof clm.status === 'string' && clm.status.startsWith('Pending');
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
            if (this.userProfile.role === 'Director') { this.showNotify('Director approvals require an individual supporting document per claim — please approve one at a time.'); return; }
            const targets = this.claimsHistory.filter(c => this.selectedClaimIds.includes(c.id) && this.canApproveClaim(c));
            if (!targets.length) { this.showNotify('No eligible claims selected.'); return; }
            if (!confirm(`Approve ${targets.length} selected claim(s) and forward to the next reviewer?`)) return;
            let succeeded = 0;
            for (const clm of targets) { if (await this.approveClaim(clm)) succeeded++; }
            this.selectedClaimIds = [];
            this.showNotify(`${succeeded} of ${targets.length} claim(s) approved and forwarded.`);
        },
        async bulkApproveSelectedVouchers() {
            if (this.userProfile.role === 'Director') { this.showNotify('Director approvals require an individual supporting document per voucher — please approve one at a time.'); return; }
            const targets = this.paymentVouchers.filter(v => this.selectedVoucherIds.includes(v.id) && this.canApprovePaymentVoucher(v));
            if (!targets.length) { this.showNotify('No eligible vouchers selected.'); return; }
            if (!confirm(`Approve ${targets.length} selected voucher(s) and forward to the next reviewer?`)) return;
            let succeeded = 0;
            for (const pv of targets) { if (await this.approvePaymentVoucher(pv)) succeeded++; }
            this.selectedVoucherIds = [];
            this.showNotify(`${succeeded} of ${targets.length} voucher(s) approved and forwarded.`);
        },
        async approveClaim(clm) {
            if (!this.canApproveClaim(clm)) { this.showNotify('You do not have permission to approve this record at its current workflow stage.'); return false; }
            if (this.attachmentUploadState.director) { this.showNotify('Wait for the Director approval document upload to finish.'); return false; }
            const isDirectorDecision = this.userProfile.role === 'Director';
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
            if (confirm("REJECT this claim application?")) { try { await updateDoc(doc(db, "claims", clm.id), { status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString() }); this.showNotify("Claim rejected."); this.notifyByEmail({ to: clm.empEmail, subject: `Your Expense Claim Was Rejected — ${clm.receiptNo}`, heading: 'Expense Claim Rejected', message: `Your expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.` }); } catch (error) { this.showNotify('Unable to reject claim.'); } }
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
            if (role === 'Director') return typeof pv.status === 'string' && pv.status.startsWith('Pending');
            const expectedStatus = { HR: 'Pending HR', Account: 'Pending Account', Director: 'Pending Director' }[role];
            return !!expectedStatus && pv.status === expectedStatus && (!pv.assignedToEmail || pv.assignedToEmail === this.userProfile.email);
        },
        canEditPaymentVoucher(pv) {
            return (pv.createdByUid === this.userProfile.uid || pv.empEmail === this.userProfile.email) && pv.status === 'Pending HR';
        },
        async approvePaymentVoucher(pv) {
            if (!this.canApprovePaymentVoucher(pv)) { this.showNotify('You do not have permission to approve this record at its current workflow stage.'); return false; }
            if (this.attachmentUploadState.director) { this.showNotify('Wait for the Director approval document upload to finish.'); return false; }
            const isDirectorDecision = this.userProfile.role === 'Director';
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
            if (confirm("REJECT this payment voucher?")) { try { await updateDoc(doc(db, "payment_vouchers", pv.id), { status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString() }); this.showNotify("Payment voucher rejected."); this.notifyByEmail({ to: pv.empEmail, subject: `Your Payment Voucher Was Rejected — ${pv.voucherNo}`, heading: 'Payment Voucher Rejected', message: `Your payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.` }); } catch (error) { this.showNotify('Unable to reject voucher.'); } }
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
        async printDocumentModule() { if (!this.clientSavedForDocument) return this.showNotify('Save Client information before previewing or printing this document.'); this.activePrintModule = this.docForm.type === 'Quotation' ? 'QUOTATION' : 'INVOICE'; this.setPrintOrientation('portrait', '15mm'); setTimeout(() => { window.print(); }, 250); },
        async printPayslipModule() { if (!this.payForm.name || !this.payForm.empNo) return this.showNotify('Enter Name and Emp ID.'); this.autoCalculatePayroll(); this.activePrintModule = 'PAYSLIP'; this.setPrintOrientation('landscape', '0mm'); setTimeout(() => { window.print(); }, 250); },
        
        async saveDocRecord() {
            try {
                if (this.attachmentUploadState.payment) { this.showNotify('Wait for the payment attachment upload to finish.'); return false; }
                if (!this.canManageDocuments) { this.showNotify('You do not have permission to save documents.'); return false; }
                if (['Paid', 'Partial'].includes(this.docForm.status) && (!this.docForm.paymentRefNo || this.docForm.paymentRefNo.trim() === '')) { this.showNotify("Payment Reference No. is REQUIRED."); return false; }
                const normalizedDocForm = this.normalizeOfficialRecord(this.docForm);
                normalizedDocForm.clientEmail = String(this.docForm.clientEmail || '').trim().toLowerCase();
                Object.assign(this.docForm, normalizedDocForm);
                const docId = String(this.editingDocId || Date.now());
                const payload = { id: docId, type: this.docForm.type, docNo: this.docForm.docNo, status: this.docForm.status || (this.docForm.type === 'Invoice' ? 'Unpaid' : 'Open'), paymentMethod: this.docForm.paymentMethod || 'Bank Transfer', paymentBank: this.docForm.paymentBank || '', paymentReceiver: this.docForm.paymentReceiver || '', paymentRefNo: this.docForm.paymentRefNo || '', paymentAttachment: this.docForm.paymentAttachment || '', date: this.docForm.date, name: this.docForm.clientName, amount: this.docGrandTotal, raw: JSON.parse(JSON.stringify(this.docForm)) };
                if (!this.clientSavedForDocument) { this.showNotify('Save Client information before saving this document.'); return false; }
                await setDoc(doc(db, "docs", docId), payload, { merge: true }); this.editingDocId = docId; this.showNotify(`Document saved.`); return true;
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
        viewClaimRecord(claim) {
            this.claimPreview = { show: true, claim: JSON.parse(JSON.stringify(claim)), directorApprovalAttachment: '', directorApprovalAttachmentName: '', directorApprovalOriginalBytes: 0 };
        },
        editRecord(item) {
            this.mobileMenuOpen = false;
            if (item.isDoc) { this.editingDocId = item.id; if (item.raw) { this.docForm = JSON.parse(JSON.stringify(item.raw)); this.docForm.status = item.raw.status || item.status || (item.type === 'Invoice' ? 'Unpaid' : 'Open'); } this.switchTab('doc-generator'); }
            else if (item.isPay) { this.editingPayId = item.id; if (item.raw) { this.payForm = JSON.parse(JSON.stringify(item.raw)); this.selectedPayEmployeeId = this.payForm.empNo || ''; } this.autoCalculatePayroll(); this.switchTab('payslip-generator'); }
            else if (item.isVoucher) this.editPaymentVoucher(item);
            else if (item.isClaim) this.editClaimRecord(item);
        },
        async confirmDeleteRecord(item) {
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete records.'); return; }
            if (confirm(`WARNING: Delete record?`)) {
                try { if (item.isDoc) await deleteDoc(doc(db, "docs", item.id)); else if (item.isPay) await deleteDoc(doc(db, "payslips", item.id)); else if (item.isVoucher) await deleteDoc(doc(db, "payment_vouchers", item.id)); else if (item.isClaim) await deleteDoc(doc(db, "claims", item.id)); this.showNotify('Record deleted.'); } catch (error) { console.error('Record deletion failed:', error); this.showNotify('Unable to delete record.'); }
            }
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

            const subscribeWithReadySignal = (source, onData, label) => new Promise((resolve) => {
                let hasInitialData = false;
                const unsubscribe = onSnapshot(source, (snapshot) => {
                    onData(snapshot);
                    if (!hasInitialData) { hasInitialData = true; resolve(); }
                }, (error) => {
                    console.error(`Unable to load ${label}:`, error);
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
            const documentsSource = canReadAllDocuments
                ? collection(db, 'docs')
                : role === 'Client'
                    // raw.customerId links to the same customers/{clientDirectoryId} record
                    // as the "Multi-user Client Portal" claim, so this covers both the primary
                    // contact and any authorized secondary contact. Falls back to matching by
                    // the account's own email if the claim hasn't been synced yet.
                    ? (this.userProfile.clientDirectoryId
                        ? query(collection(db, 'docs'), where('raw.customerId', '==', this.userProfile.clientDirectoryId))
                        : query(collection(db, 'docs'), where('raw.clientEmail', '==', this.userProfile.email)))
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
            const projectsSource = role === 'Client'
                // clientDirectoryId is a required field on every project (see
                // hasValidProjectLinks in firestore.rules), so this covers both the primary
                // contact and any authorized secondary contact under the same customer
                // record. Falls back to the old uid-based match only if the claim hasn't
                // been synced yet for this session.
                ? (this.userProfile.clientDirectoryId
                    ? query(collection(db, 'projects'), where('clientDirectoryId', '==', this.userProfile.clientDirectoryId))
                    : query(collection(db, 'projects'), where('clientEmail', '==', this.userProfile.email), where('clientPortalUid', '==', this.userProfile.uid)))
                : collection(db, 'projects');
            const projectActivitiesSource = role === 'Client' ? null : collection(db, 'project_activities');
            // clientDirectoryId was only added to project_client_updates records once the
            // Multi-user Client Portal support landed, so older records only carry
            // clientPortalUid. Subscribe to both queries and merge by doc id so a Client
            // account keeps seeing its full history regardless of which field a given
            // record was written with, and a secondary contact sees records addressed to
            // the shared customer record even though they never match clientPortalUid.
            const projectClientUpdatesSources = role === 'Client'
                ? [
                    query(collection(db, 'project_client_updates'), where('clientPortalUid', '==', this.userProfile.uid)),
                    ...(this.userProfile.clientDirectoryId
                        ? [query(collection(db, 'project_client_updates'), where('clientDirectoryId', '==', this.userProfile.clientDirectoryId))]
                        : [])
                ]
                : [collection(db, 'project_client_updates')];

            const userSubscription = canReadUserDirectory
                ? subscribeWithReadySignal(collection(db, 'users'), (snapshot) => {
                    this.users = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                    this.processPortalPresenceNotifications(this.users);
                    const currentUser = this.users.find(user => user.id === this.userProfile.uid);
                    if (currentUser) {
                        this.userProfile.role = currentUser.role || this.userProfile.role;
                        this.userProfile.name = currentUser.name || this.userProfile.name;
                        this.userProfile.photo = currentUser.photo || this.userProfile.photo;
                    }
                }, 'portal users')
                : subscribeWithReadySignal(doc(db, 'users', this.userProfile.uid), (snapshot) => {
                    if (!snapshot.exists()) return;
                    const currentUser = { ...snapshot.data(), id: snapshot.id };
                    this.users = [currentUser];
                    this.userProfile.role = currentUser.role || this.userProfile.role;
                    this.userProfile.name = currentUser.name || this.userProfile.name;
                    this.userProfile.photo = currentUser.photo || this.userProfile.photo;
                }, 'current portal user');

            const initialLoads = [
                this.canManageCompanySettings
                    ? subscribeWithReadySignal(doc(db, "settings", "company_profile"), (snapshot) => { if (snapshot.exists()) this.company = this.hydrateCompanyAddress(snapshot.data()); }, 'company settings')
                    : Promise.resolve(),
                employeesSource
                    ? subscribeWithReadySignal(employeesSource, (snapshot) => { this.employees = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'employees')
                    : Promise.resolve(),
                (this.hasAccess('client-directory') || this.hasAccess('doc-generator'))
                    ? subscribeWithReadySignal(collection(db, "customers"), (snapshot) => { this.customers = snapshot.docs.map(d => { const data = d.data(); return { id: d.id, ...data, clientAddress1: data.clientAddress1 || data.clientAddress || '' }; }); }, 'clients')
                    : role === 'Client' && this.userProfile.clientDirectoryId
                        ? subscribeWithReadySignal(doc(db, 'customers', this.userProfile.clientDirectoryId), (snapshot) => {
                            this.customers = snapshot.exists()
                                ? [{ id: snapshot.id, ...snapshot.data(), clientAddress1: snapshot.data().clientAddress1 || snapshot.data().clientAddress || '' }]
                                : [];
                        }, 'client profile')
                    : Promise.resolve(),
                documentsSource
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
                        this.websiteContent.portfolio_web = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
                    }, 'website content — Digital Systems')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(collection(db, 'portfolio_gaming'), (snapshot) => {
                        this.websiteContent.portfolio_gaming = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
                    }, 'website content — Licensing & Permits')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(collection(db, 'services'), (snapshot) => {
                        this.websiteContent.services = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
                    }, 'website content — Services')
                    : Promise.resolve(),
                this.hasAccess('website-content')
                    ? subscribeWithReadySignal(doc(db, 'content', 'site_text'), (snapshot) => {
                        this.siteTextOverrides = snapshot.exists() ? snapshot.data() : {};
                    }, 'website content — Page Text')
                    : Promise.resolve(),
                subscribeWithReadySignal(projectsSource, (snapshot) => { this.projects = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'project activities'),
                projectActivitiesSource ? subscribeWithReadySignal(projectActivitiesSource, (snapshot) => {
                    const previousIds = new Set(this.projectActivities.map(activity => activity.id));
                    this.projectActivities = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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
                userSubscription,
                canReadAuditLogs
                    ? subscribeWithReadySignal(collection(db, "audit_logs"), (snapshot) => { this.auditLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)); }, 'audit logs')
                    : Promise.resolve()
            ];

            this.portalDataReadyPromise = Promise.all(initialLoads).then(() => {
                this.portalDataReady = true;
                this.refreshDashboardCharts();
                return true;
            });
            return this.portalDataReadyPromise;
        }
    },
    mounted() {
        this.checkPasswordResetLink();
        this.autoCalculatePayroll();
        this.generateDocNo();
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
            if (this.clientView.show) { this.closeClientView(); return; }
            if (this.clientUpdateModal.show && this.clientUpdateModal.project) { this.closeClientUpdateModal(); return; }
            if (this.websiteContentModal.show) { this.closeWebsiteContentModal(); return; }
            if (this.siteTextModal.show) { this.closeSiteTextModal(); return; }
            if (this.activityModal.show && this.activityModal.project) { this.closeActivityModal(); return; }
            if (this.newSignedDocumentModal.show) { this.closeNewSignedDocumentModal(); return; }
            if (this.signedDocumentModal.show && this.signedDocumentModal.doc) { this.closeSignedDocumentModal(); return; }
            if (this.projectPreview.show && this.projectPreview.project) { this.closeProjectDetails(); return; }
            if (this.projectModal.show) { this.closeProjectModal(); return; }
            if (this.isLoggedIn && this.showOnboarding) { this.dismissOnboarding(); return; }
            if (this.logoutConfirm) { this.logoutConfirm = false; return; }
            if (this.postLogoutChoice) { this.stayOnPortal(); return; }
            if (this.clientActionConfirm.show) { this.clientActionConfirm.show = false; return; }
            if (this.employeeActionConfirm.show) { this.employeeActionConfirm.show = false; return; }
        };
        window.addEventListener('keydown', this.globalEscapeHandler);

        this.checkForAppUpdate();
        this.appUpdateCheckInterval = setInterval(() => this.checkForAppUpdate(), 5 * 60 * 1000);
        this.appVisibilityHandler = () => { if (document.visibilityState === 'visible') this.checkForAppUpdate(); };
        document.addEventListener('visibilitychange', this.appVisibilityHandler);

        onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                if (this.interactiveLoginInProgress) { this.authLoading = false; return; }
                if (this.isLoggedIn && this.userProfile.uid === firebaseUser.uid) { this.authLoading = false; return; }
                try {
                    this.loginLoading = true;
                    const userData = await this.loadOrMigrateUserMetadata(firebaseUser);
                    const isSeedAdmin = firebaseUser.email === 'admin@zenq0r.com';

                    if (!userData && !isSeedAdmin) {
                        this.loginError = 'This account is not provisioned or your access has been revoked. Contact your administrator.';
                        await signOut(auth);
                        return;
                    }

                    let role = userData?.role || 'Staff';
                    let name = userData?.name || firebaseUser.displayName || firebaseUser.email;
                    let photo = userData?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B1E36&color=D4AF37`;
                    const mustChangePassword = userData?.mustChangePassword === true;
                    if (isSeedAdmin) role = 'Superadmin';
                    if (role !== 'Client' && !this.isOfficialEmail(firebaseUser.email)) {
                        this.loginError = `Only Client Users System Terminal may use an external email. Other roles must use @${this.officialEmailDomain}.`;
                        await signOut(auth);
                        return;
                    }
                    if (Object.prototype.hasOwnProperty.call(RBAC_ROLES, role)) {
                        let otpVerifiedUid = null;
                        try { otpVerifiedUid = sessionStorage.getItem('zenqorOtpVerifiedUid'); } catch (error) { console.error('Failed to read OTP-verified marker:', error); }
                        if (otpVerifiedUid !== firebaseUser.uid) {
                            const trusted = await this.checkTrustedDevice(firebaseUser);
                            if (!trusted) {
                                this.loginLoading = false;
                                this.authLoading = false;
                                // A restored session (page refresh, including a hard refresh that
                                // drops sessionStorage's OTP marker) on a browser Firebase still
                                // considers signed-in but this portal doesn't yet trust needs the
                                // same one-time-code challenge a fresh sign-in would require —
                                // show it here instead of silently leaving the user stranded on
                                // the landing page looking logged out with no way back in short
                                // of typing their password again. Skip only when handleLogin()'s
                                // OWN in-flight sign-in already has this exact OTP prompt open
                                // (its signInWithEmailAndPassword call fires this same listener
                                // a second time while that modal is still up).
                                if (!this.loginOtp.show || this.loginOtp.email !== firebaseUser.email) {
                                    this.pendingLoginContext = { firebaseUser, userData, role, name, photo, mustChangePassword };
                                    this.loginOtp = { show: true, code: '', error: '', sending: true, verifying: false, email: firebaseUser.email, trustDevice: true };
                                    await this.requestLoginOtp();
                                }
                                return;
                            }
                            try { sessionStorage.setItem('zenqorOtpVerifiedUid', firebaseUser.uid); } catch (error) { console.error('Failed to persist trusted-device marker:', error); }
                        }
                    }
                    this.userProfile = { name, email: firebaseUser.email, role, uid: firebaseUser.uid, photo, mustChangePassword, themePreference: userData?.themePreference || 'light', lastSeenChangelogVersion: userData?.lastSeenChangelogVersion || '', customAccess: userData?.customAccess || {} };
                    this.applyDarkModePreference();
                    this.notificationsLog = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : [];
                    this.startIdleTimeoutWatch();
                    await this.syncUserClaims();
                    this.resetAllForms();
                    this.isLoggedIn = true;
                    if (mustChangePassword) { this.currentTab = 'profile'; this.changePasswordModal.required = true; this.changePasswordModal.show = true; }
                    else { this.currentTab = role === 'Client' ? 'client-portal' : 'dashboard'; this.maybeShowOnboarding(); }
                    window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
                    await this.initFirebaseRealtime();
                    await this.startPresenceTracking();
                    this.loginLoading = false;
                    this.refreshDashboardCharts();
                } catch (e) {
                    console.error("Error fetching user metadata:", e);
                    this.isLoggedIn = false;
                    this.loginLoading = false;
                }
            } else {
                this.stopPresenceTracking();
                this.isLoggedIn = false;
                this.loginLoading = false;
                this.destroyDashboardCharts();
                this.portalDataReady = false;
                this.portalDataReadyPromise = null;
                this.userProfile = { name: '', email: '', role: '', photo: '' };
                this.unsubscribers.forEach(unsub => unsub && unsub());
                this.unsubscribers = [];
                if (this.clientDocumentsUnsubscribe) { this.clientDocumentsUnsubscribe(); this.clientDocumentsUnsubscribe = null; }
                if (this.signedDocumentsUnsubscribe) { this.signedDocumentsUnsubscribe(); this.signedDocumentsUnsubscribe = null; }
                this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' };
                this.signedDocuments = { items: [], loading: false, error: '', clientFilter: 'all', statusFilter: 'all' };
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
                this.websiteContent = { portfolio_web: [], portfolio_gaming: [], services: [] };
                this.siteTextOverrides = {};
                this.notificationsLog = [];
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
        this.unsubscribers.forEach(unsub => unsub && unsub());
        if (this.clientDocumentsUnsubscribe) this.clientDocumentsUnsubscribe();
        if (this.signedDocumentsUnsubscribe) this.signedDocumentsUnsubscribe();
        if (this.browserBackHandler) window.removeEventListener('popstate', this.browserBackHandler);
        if (this.appUpdateCheckInterval) clearInterval(this.appUpdateCheckInterval);
        if (this.appVisibilityHandler) document.removeEventListener('visibilitychange', this.appVisibilityHandler);
        if (this.notificationsSyncTimer) clearTimeout(this.notificationsSyncTimer);
        this.stopIdleTimeoutWatch();
    }
}).mount('#app');
