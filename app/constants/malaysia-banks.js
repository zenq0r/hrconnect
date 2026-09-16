// ---- Banks operating in Malaysia ------------------------------------------
// Used by the client's Payment Proof form (which bank they paid FROM) — not
// to be confused with docForm.paymentBank/paymentReceiver in tab-documents.html,
// which is the company's OWN receiving account, printed on the invoice as
// payment instructions. Compiled from Bank Negara Malaysia's public list of
// licensed commercial banks, Islamic banks, digital banks and development
// financial institutions. An "Other Bank" entry closes the list rather than
// silently blocking a client whose bank is not named here.
export const MALAYSIA_BANKS = [
    // Commercial banks
    'Affin Bank Berhad',
    'Alliance Bank Malaysia Berhad',
    'AmBank (M) Berhad',
    'Bangkok Bank Berhad',
    'Bank of China (Malaysia) Berhad',
    'CIMB Bank Berhad',
    'Citibank Berhad',
    'Hong Leong Bank Berhad',
    'HSBC Bank Malaysia Berhad',
    'Industrial and Commercial Bank of China (Malaysia) Berhad',
    'J.P. Morgan Chase Bank Berhad',
    'Malayan Banking Berhad (Maybank)',
    'MUFG Bank (Malaysia) Berhad',
    'OCBC Bank (Malaysia) Berhad',
    'Public Bank Berhad',
    'RHB Bank Berhad',
    'Standard Chartered Bank Malaysia Berhad',
    'Sumitomo Mitsui Banking Corporation Malaysia Berhad',
    'United Overseas Bank (Malaysia) Berhad',
    // Islamic banks
    'Affin Islamic Bank Berhad',
    'Al Rajhi Banking & Investment Corporation (Malaysia) Berhad',
    'Alliance Islamic Bank Berhad',
    'AmBank Islamic Berhad',
    'Bank Islam Malaysia Berhad',
    'Bank Muamalat Malaysia Berhad',
    'CIMB Islamic Bank Berhad',
    'Hong Leong Islamic Bank Berhad',
    'HSBC Amanah Malaysia Berhad',
    'Kuwait Finance House (Malaysia) Berhad',
    'Maybank Islamic Berhad',
    'MBSB Bank Berhad',
    'OCBC Al-Amin Bank Berhad',
    'Public Islamic Bank Berhad',
    'RHB Islamic Bank Berhad',
    'Standard Chartered Saadiq Berhad',
    // Development financial institutions
    'Bank Kerjasama Rakyat Malaysia Berhad (Bank Rakyat)',
    'Bank Pertanian Malaysia Berhad (Agrobank)',
    'Bank Simpanan Nasional (BSN)',
    // Digital banks
    'AEON Bank (M) Berhad',
    'Boost Bank Berhad',
    'GXBank Berhad',
    'KAF Digital Bank Berhad',
    'Ryt Bank Berhad',
    // Fallback for a bank not named above
    'Other Bank'
];

export const CLIENT_PAYMENT_ACCOUNT_TYPES = [
    { value: 'Personal', label: 'Personal / Individual' },
    { value: 'Business', label: 'Business / Company' }
];
