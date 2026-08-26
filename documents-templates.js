// ============================================================
// ZENQOR TECHNOLOGIES - documents-templates.js
// ------------------------------------------------------------
// Field-definition configs + PDF rendering ("PDF kit") for the
// Signed Documents module (Authorization Letter, Client Information
// Form, NDA, Service Agreement). Kept out of app.js because it's a
// large, mostly-declarative data set with no reason to bloat the
// already very large app.js file. Loaded via ES import from app.js.
//
// `owner` on each field describes who may edit it and when:
//   zenqor_prefilled  - fixed Zenqor company info, always read-only
//   zenqor_editable   - Zenqor staff fills while status is draft/awaiting_client
//   client_fills      - the client fills while status is awaiting_client
//   zenqor_fills_after- Zenqor staff fills while status is awaiting_zenqor (after client signs)
// ============================================================

const ZENQOR_INFO = {
    name: 'ZENQOR TECHNOLOGIES',
    regNo: '202603157897 (JM1045730-D)',
    address: 'SURIA RESIDENCE BLOCK A, JALAN RESIDENCE SEK 3, BANDAR MAHKOTA CHERAS 43200 CHERAS SELANGOR',
    contactPerson: 'Muhammad Annas',
    phone: '+60 11-6501 2569',
    email: 'admin@zenq0r.com'
};

// ---------------------------------------------------------------
// 1. AUTHORIZATION LETTER (Surat Wakil Kuasa)
// ---------------------------------------------------------------
const authorizationLetterFields = [
    { id: 'refKami', label: { en: 'Our Reference', ms: 'Rujukan Kami' }, type: 'text', owner: 'zenqor_editable', section: 'Letter Details', required: false, defaultValue: '' },
    { id: 'tarikhSurat', label: { en: 'Date', ms: 'Tarikh' }, type: 'date', owner: 'zenqor_editable', section: 'Letter Details', required: true, defaultValue: '' },
    { id: 'refTuan', label: { en: 'Your Reference', ms: 'Rujukan Tuan' }, type: 'text', owner: 'client_fills', section: 'Letter Details', required: false, defaultValue: '' },
    { id: 'lampiran', label: { en: 'Enclosure', ms: 'Lampiran' }, type: 'text', owner: 'client_fills', section: 'Letter Details', required: false, defaultValue: '' },

    { id: 'appointerName', label: { en: 'Appointer Name ("I, ____")', ms: 'Nama Yang Melantik (Saya, ____)' }, type: 'text', owner: 'client_fills', section: 'Appointer', required: true, defaultValue: '' },
    { id: 'appointerPosition', label: { en: 'Position ("as ____")', ms: 'Selaku (Jawatan)' }, type: 'text', owner: 'client_fills', section: 'Appointer', required: true, defaultValue: '' },
    { id: 'appointerCompany', label: { en: 'On Behalf Of (Company)', ms: 'Bagi (Nama Syarikat)' }, type: 'text', owner: 'client_fills', section: 'Appointer', required: true, defaultValue: '' },
    { id: 'appointerRegNo', label: { en: 'Company Registration No.', ms: 'No. Pendaftaran Syarikat' }, type: 'text', owner: 'client_fills', section: 'Appointer', required: true, defaultValue: '' },

    { id: 'clientCompanyName', label: { en: 'Client Company Name', ms: 'Nama Syarikat Pelanggan' }, type: 'text', owner: 'client_fills', section: '1. Appointing Party Details', required: true, defaultValue: '' },
    { id: 'clientRegNo', label: { en: 'Company Registration No.', ms: 'No. Pendaftaran Syarikat' }, type: 'text', owner: 'client_fills', section: '1. Appointing Party Details', required: true, defaultValue: '' },
    { id: 'clientRegisteredAddress', label: { en: 'Registered Address / Premises', ms: 'Alamat Berdaftar / Premis' }, type: 'textarea', owner: 'client_fills', section: '1. Appointing Party Details', required: true, defaultValue: '' },
    { id: 'clientSignatoryNameTitle', label: { en: 'Signatory Name & Position', ms: 'Nama & Jawatan Penandatangan' }, type: 'text', owner: 'client_fills', section: '1. Appointing Party Details', required: true, defaultValue: '' },

    { id: 'matterType', label: { en: 'Type of Application / Matter', ms: 'Jenis Permohonan / Urusan' }, type: 'text', owner: 'zenqor_editable', section: '3. Matter Details', required: true, defaultValue: '' },
    { id: 'matterAgency', label: { en: 'Related Authority / Agency', ms: 'Pihak / Agensi Berkaitan' }, type: 'text', owner: 'zenqor_editable', section: '3. Matter Details', required: true, defaultValue: '' },
    { id: 'matterLocation', label: { en: 'Location / Premises / Project', ms: 'Lokasi / Premis / Projek' }, type: 'textarea', owner: 'zenqor_editable', section: '3. Matter Details', required: false, defaultValue: '' },

    { id: 'validityStart', label: { en: 'Valid From', ms: 'Berkuat Kuasa Mulai' }, type: 'date', owner: 'zenqor_editable', section: '6. Validity Period', required: true, defaultValue: '' },
    { id: 'validityEnd', label: { en: 'Valid Until', ms: 'Hingga' }, type: 'date', owner: 'zenqor_editable', section: '6. Validity Period', required: true, defaultValue: '' },

    { id: 'clientSigName', label: { en: 'Name', ms: 'Nama' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' },
    { id: 'clientSigPosition', label: { en: 'Position', ms: 'Jawatan' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' },
    { id: 'clientCompanyStampNote', label: { en: 'Company Stamp Note', ms: 'Catatan Cop Syarikat' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: false, defaultValue: '' },

    { id: 'zenqorSigName', label: { en: 'Name', ms: 'Nama' }, type: 'text', owner: 'zenqor_prefilled', section: 'Zenqor Signature Block', required: true, defaultValue: 'MUHAMMAD ANNAS BIN MUHAMMAD NAZMI' },
    { id: 'zenqorSigPosition', label: { en: 'Position', ms: 'Jawatan' }, type: 'text', owner: 'zenqor_prefilled', section: 'Zenqor Signature Block', required: true, defaultValue: 'PENGARAH' }
];

// ---------------------------------------------------------------
// Authorization Letter — coordinate overlay map (PDF-native points,
// origin bottom-left, matching both pdfjs-dist's getTextContent() output
// and pdf-lib's page.drawText() input — no flipping needed). Measured
// directly from authorization_letter.pdf's own text layer (pdfjs-dist
// getTextContent, one-off extraction script, not OCR/guessed) against
// every blank line, table cell and signature area on both pages. `page`
// is 0-indexed. zenqorSigName/zenqorSigPosition have no entries here —
// they're already printed as static text in the master PDF itself.
// ---------------------------------------------------------------
const authorizationLetterFieldMap = [
    { id: 'refKami', page: 0, x: 108, y: 746.62, width: 128, height: 11.04, fontSize: 10 },
    { id: 'tarikhSurat', page: 0, x: 400, y: 746.62, width: 120, height: 11.04, fontSize: 10 },
    { id: 'refTuan', page: 0, x: 107, y: 729.10, width: 128, height: 11.04, fontSize: 10 },
    { id: 'lampiran', page: 0, x: 398, y: 729.10, width: 122, height: 11.04, fontSize: 10 },
    { id: 'appointerName', page: 0, x: 65, y: 533.18, width: 106, height: 11.04, fontSize: 10 },
    { id: 'appointerPosition', page: 0, x: 211, y: 533.18, width: 107, height: 11.04, fontSize: 10 },
    { id: 'appointerCompany', page: 0, x: 346, y: 533.18, width: 107, height: 11.04, fontSize: 10 },
    { id: 'appointerRegNo', page: 0, x: 80.5, y: 520.46, width: 107, height: 11.04, fontSize: 10 },
    { id: 'clientCompanyName', page: 0, x: 270, y: 390.12, width: 270, height: 14, fontSize: 10 },
    { id: 'clientRegNo', page: 0, x: 270, y: 369.94, width: 270, height: 14, fontSize: 10 },
    { id: 'clientRegisteredAddress', page: 0, x: 270, y: 350.02, width: 270, height: 18, fontSize: 8.5, multiline: true },
    { id: 'clientSignatoryNameTitle', page: 0, x: 270, y: 330.10, width: 270, height: 14, fontSize: 10 },
    { id: 'matterType', page: 0, x: 270, y: 189, width: 270, height: 22, fontSize: 9, multiline: true },
    { id: 'matterAgency', page: 0, x: 270, y: 159, width: 270, height: 22, fontSize: 9, multiline: true },
    { id: 'matterLocation', page: 0, x: 270, y: 129, width: 270, height: 34, fontSize: 9, multiline: true },
    { id: 'validityStart', page: 1, x: 222.58, y: 386.04, width: 55, height: 11.04, fontSize: 10 },
    { id: 'validityEnd', page: 1, x: 307.56, y: 386.04, width: 55, height: 11.04, fontSize: 10 },
    { id: 'clientSigName', page: 1, x: 70, y: 195.89, width: 150, height: 11.04, fontSize: 10 },
    { id: 'clientSigPosition', page: 1, x: 80, y: 182.21, width: 140, height: 11.04, fontSize: 10 },
    { id: 'clientCompanyStampNote', page: 1, x: 100, y: 165.65, width: 120, height: 11.04, fontSize: 9 }
];

// Where the captured signature-pad PNGs get drawn on the master PDF —
// separate from the field map since signatures aren't text fields.
const authorizationLetterSignatureBoxes = {
    client: { page: 1, x: 36, y: 215, width: 165, height: 35 },
    zenqor: { page: 1, x: 225.46, y: 215, width: 165, height: 35 }
};

// ---------------------------------------------------------------
// 2. CLIENT INFORMATION FORM (Borang Maklumat Pelanggan)
// ---------------------------------------------------------------
const clientInfoFormFields = [
    { id: 'clientType', label: { en: 'Client Type', ms: 'Jenis Pelanggan' }, type: 'checkboxGroup', owner: 'client_fills', section: 'A. Client / Company Information', required: true, defaultValue: [], options: ['Individual / Individu', 'Enterprise / Milikan Tunggal', 'Partnership / Perkongsian', 'Sdn. Bhd.', 'Other / Lain-lain'] },
    { id: 'legalName', label: { en: 'Legal / Registered Name', ms: 'Nama Berdaftar' }, type: 'text', owner: 'client_fills', section: 'A. Client / Company Information', required: true, defaultValue: '' },
    { id: 'tradingName', label: { en: 'Trading / Business Name', ms: 'Nama Perniagaan' }, type: 'text', owner: 'client_fills', section: 'A. Client / Company Information', required: false, defaultValue: '' },
    { id: 'brnNricPassport', label: { en: 'BRN / NRIC / Passport No.', ms: 'No. BRN / KP / Pasport' }, type: 'text', owner: 'client_fills', section: 'A. Client / Company Information', required: true, defaultValue: '' },
    { id: 'tin', label: { en: 'Tax Identification No. (TIN)', ms: 'No. Pengenalan Cukai' }, type: 'text', owner: 'client_fills', section: 'A. Client / Company Information', required: false, defaultValue: '' },
    { id: 'sstNo', label: { en: 'SST Registration No. (if applicable)', ms: 'No. SST (jika berkenaan)' }, type: 'text', owner: 'client_fills', section: 'A. Client / Company Information', required: false, defaultValue: '' },
    { id: 'industry', label: { en: 'Industry / Nature of Business', ms: 'Industri / Jenis Perniagaan' }, type: 'text', owner: 'client_fills', section: 'A. Client / Company Information', required: false, defaultValue: '' },
    { id: 'registeredAddress', label: { en: 'Registered Address', ms: 'Alamat Berdaftar' }, type: 'textarea', owner: 'client_fills', section: 'A. Client / Company Information', required: true, defaultValue: '' },
    { id: 'correspondenceSameAsRegistered', label: { en: 'Correspondence address same as registered', ms: 'Alamat surat-menyurat sama seperti berdaftar' }, type: 'checkbox', owner: 'client_fills', section: 'A. Client / Company Information', required: false, defaultValue: false },
    { id: 'correspondenceAddress', label: { en: 'Correspondence Address', ms: 'Alamat Surat-Menyurat' }, type: 'textarea', owner: 'client_fills', section: 'A. Client / Company Information', required: false, defaultValue: '' },

    { id: 'contactPersonName', label: { en: 'Contact Person', ms: 'Nama Pegawai Dihubungi' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: true, defaultValue: '' },
    { id: 'designation', label: { en: 'Designation / Position', ms: 'Jawatan' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: false, defaultValue: '' },
    { id: 'department', label: { en: 'Department', ms: 'Jabatan' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: false, defaultValue: '' },
    { id: 'mobileNo', label: { en: 'Mobile No.', ms: 'No. Telefon Bimbit' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: true, defaultValue: '' },
    { id: 'officeNo', label: { en: 'Office No.', ms: 'No. Pejabat' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: false, defaultValue: '' },
    { id: 'contactEmail', label: { en: 'Email Address', ms: 'Alamat E-mel' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: true, defaultValue: '' },
    { id: 'website', label: { en: 'Website', ms: 'Laman Web' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: false, defaultValue: '' },
    { id: 'preferredContactMethod', label: { en: 'Preferred Contact Method', ms: 'Kaedah Hubungan Pilihan' }, type: 'text', owner: 'client_fills', section: 'B. Primary Contact Information', required: false, defaultValue: '' },

    { id: 'billingName', label: { en: 'Billing / Buyer Name', ms: 'Nama Bil / Pembeli' }, type: 'text', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'billingEmail', label: { en: 'Billing Email', ms: 'E-mel Bil' }, type: 'text', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'buyerTin', label: { en: 'Buyer TIN', ms: 'TIN Pembeli' }, type: 'text', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'buyerBrn', label: { en: 'Buyer BRN / NRIC / Passport No.', ms: 'BRN / KP / Pasport Pembeli' }, type: 'text', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'buyerSst', label: { en: 'Buyer SST Registration No. (if applicable)', ms: 'No. SST Pembeli (jika berkenaan)' }, type: 'text', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'buyerContactNo', label: { en: 'Buyer Contact No.', ms: 'No. Hubungan Pembeli' }, type: 'text', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'buyerAddress', label: { en: 'Buyer / Billing Address', ms: 'Alamat Pembeli / Bil' }, type: 'textarea', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: '' },
    { id: 'preferredInvoiceMethod', label: { en: 'Preferred Invoice Method', ms: 'Kaedah Invois Pilihan' }, type: 'checkboxGroup', owner: 'client_fills', section: 'C. Billing & e-Invoice Information', required: false, defaultValue: [], options: ['Email', 'e-Invoice / MyInvois', 'Client Portal', 'Other / Lain-lain'] },

    { id: 'serviceRequired', label: { en: 'Service Required', ms: 'Perkhidmatan Diperlukan' }, type: 'checkboxGroup', owner: 'client_fills', section: 'D. Service / Project Information', required: true, defaultValue: [], options: ['IT Services', 'Software / System', 'Website', 'Technical Support', 'Consultation', 'Maintenance', 'Other'] },
    { id: 'projectName', label: { en: 'Project / Service Name', ms: 'Nama Projek / Perkhidmatan' }, type: 'text', owner: 'client_fills', section: 'D. Service / Project Information', required: false, defaultValue: '' },
    { id: 'estimatedBudget', label: { en: 'Estimated Budget', ms: 'Anggaran Bajet' }, type: 'text', owner: 'client_fills', section: 'D. Service / Project Information', required: false, defaultValue: '' },
    { id: 'expectedStartDate', label: { en: 'Expected Start Date', ms: 'Tarikh Mula Dijangka' }, type: 'date', owner: 'client_fills', section: 'D. Service / Project Information', required: false, defaultValue: '' },
    { id: 'expectedCompletionDate', label: { en: 'Expected Completion Date', ms: 'Tarikh Siap Dijangka' }, type: 'date', owner: 'client_fills', section: 'D. Service / Project Information', required: false, defaultValue: '' },
    { id: 'briefRequirements', label: { en: 'Brief Requirements / Scope', ms: 'Ringkasan Keperluan / Skop' }, type: 'textarea', owner: 'client_fills', section: 'D. Service / Project Information', required: false, defaultValue: '' },

    { id: 'authRepName', label: { en: 'Name', ms: 'Nama' }, type: 'text', owner: 'client_fills', section: 'E. Authorised Representative', required: false, defaultValue: '' },
    { id: 'authRepDesignation', label: { en: 'Designation', ms: 'Jawatan' }, type: 'text', owner: 'client_fills', section: 'E. Authorised Representative', required: false, defaultValue: '' },
    { id: 'authRepContactNo', label: { en: 'Contact No.', ms: 'No. Hubungan' }, type: 'text', owner: 'client_fills', section: 'E. Authorised Representative', required: false, defaultValue: '' },
    { id: 'authRepEmail', label: { en: 'Email', ms: 'E-mel' }, type: 'text', owner: 'client_fills', section: 'E. Authorised Representative', required: false, defaultValue: '' },
    { id: 'authorisedToApprove', label: { en: 'Authorised To Approve', ms: 'Diberi Kuasa Meluluskan' }, type: 'checkboxGroup', owner: 'client_fills', section: 'E. Authorised Representative', required: false, defaultValue: [], options: ['Quotation', 'Purchase / Order', 'Project Changes', 'Invoice / Payment', 'All of the above'] },

    { id: 'documentsAttached', label: { en: 'Documents Attached', ms: 'Dokumen Dilampirkan' }, type: 'checkboxGroup', owner: 'client_fills', section: 'F. Supporting Documents & Additional Information', required: false, defaultValue: [], options: ['SSM / Registration', 'SST Certificate', 'Purchase Order', 'Company Profile', 'Other'] },
    { id: 'referralSource', label: { en: 'How did you hear about us?', ms: 'Bagaimana mengetahui kami?' }, type: 'text', owner: 'client_fills', section: 'F. Supporting Documents & Additional Information', required: false, defaultValue: '' },
    { id: 'clientReference', label: { en: 'Client Reference / Referral', ms: 'Rujukan / Referral' }, type: 'text', owner: 'client_fills', section: 'F. Supporting Documents & Additional Information', required: false, defaultValue: '' },
    { id: 'additionalNotes', label: { en: 'Additional Notes', ms: 'Catatan Tambahan' }, type: 'textarea', owner: 'client_fills', section: 'F. Supporting Documents & Additional Information', required: false, defaultValue: '' },

    { id: 'pdpaConsent', label: { en: 'I/We acknowledge that I/we have read and understood the notice above and consent to the processing described, subject to applicable law.', ms: 'Saya/Kami mengakui telah membaca dan memahami notis di atas serta bersetuju dengan pemprosesan yang dinyatakan, tertakluk kepada undang-undang yang terpakai.' }, type: 'checkbox', owner: 'client_fills', section: 'G. Personal Data Protection Notice & Consent', required: true, defaultValue: false },
    { id: 'privacyContact', label: { en: 'Privacy Contact', ms: 'Hubungan Privasi' }, type: 'text', owner: 'client_fills', section: 'G. Personal Data Protection Notice & Consent', required: false, defaultValue: '' },

    { id: 'declarationName', label: { en: 'Name', ms: 'Nama' }, type: 'text', owner: 'client_fills', section: 'H. Client Declaration & Authorisation', required: true, defaultValue: '' },
    { id: 'declarationDesignation', label: { en: 'Designation', ms: 'Jawatan' }, type: 'text', owner: 'client_fills', section: 'H. Client Declaration & Authorisation', required: false, defaultValue: '' },
    { id: 'declarationDate', label: { en: 'Date', ms: 'Tarikh' }, type: 'date', owner: 'client_fills', section: 'H. Client Declaration & Authorisation', required: true, defaultValue: '' },
    { id: 'companyStampNote', label: { en: 'Company Stamp (if applicable)', ms: 'Cop Syarikat (jika berkenaan)' }, type: 'text', owner: 'client_fills', section: 'H. Client Declaration & Authorisation', required: false, defaultValue: '' },
    { id: 'officialEmailContact', label: { en: 'Official Email / Contact', ms: 'E-mel / Hubungan Rasmi' }, type: 'text', owner: 'client_fills', section: 'H. Client Declaration & Authorisation', required: false, defaultValue: '' },

    { id: 'clientId', label: { en: 'Client ID', ms: 'ID Pelanggan' }, type: 'text', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' },
    { id: 'accountRefNo', label: { en: 'Account / Reference No.', ms: 'No. Akaun / Rujukan' }, type: 'text', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' },
    { id: 'clientStatus', label: { en: 'Client Status', ms: 'Status Pelanggan' }, type: 'checkboxGroup', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: [], options: ['New / Baru', 'Active / Aktif', 'Existing / Sedia Ada', 'Inactive / Tidak Aktif'] },
    { id: 'handledBy', label: { en: 'Handled By', ms: 'Dikendalikan Oleh' }, type: 'text', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' },
    { id: 'dateReceived', label: { en: 'Date Received', ms: 'Tarikh Diterima' }, type: 'date', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' },
    { id: 'verifiedBy', label: { en: 'Verified By', ms: 'Disahkan Oleh' }, type: 'text', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' },
    { id: 'verificationDate', label: { en: 'Verification Date', ms: 'Tarikh Pengesahan' }, type: 'date', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' },
    { id: 'officeRemarks', label: { en: 'Remarks', ms: 'Catatan' }, type: 'textarea', owner: 'zenqor_fills_after', section: 'I. For Office Use Only', required: false, defaultValue: '' }
];

// ---------------------------------------------------------------
// 3. NDA LETTER (Perjanjian Kerahsiaan)
// ---------------------------------------------------------------
const ndaFields = [
    { id: 'effectiveDate', label: { en: 'Effective Date', ms: 'Tarikh Kuat Kuasa' }, type: 'date', owner: 'zenqor_editable', section: 'Agreement Details', required: true, defaultValue: '' },

    { id: 'receivingCompanyName', label: { en: 'Company Name (Receiving Party)', ms: 'Nama Syarikat (Pihak Penerima)' }, type: 'text', owner: 'client_fills', section: 'Receiving Party (Client)', required: true, defaultValue: '' },
    { id: 'receivingRegNo', label: { en: 'Registration No.', ms: 'No. Pendaftaran' }, type: 'text', owner: 'client_fills', section: 'Receiving Party (Client)', required: true, defaultValue: '' },
    { id: 'receivingAddress', label: { en: 'Address', ms: 'Alamat' }, type: 'textarea', owner: 'client_fills', section: 'Receiving Party (Client)', required: true, defaultValue: '' },

    { id: 'confidentialitySurvivalPeriod', label: { en: 'Confidentiality Survival Period (Clause 10)', ms: 'Tempoh Kelangsungan Kerahsiaan (Fasal 10)' }, type: 'text', owner: 'zenqor_editable', section: 'Term', required: true, defaultValue: 'tiga (3) tahun' },

    { id: 'zenqorRepName', label: { en: 'Zenqor Representative Name', ms: 'Nama Wakil Zenqor' }, type: 'text', owner: 'zenqor_editable', section: 'Zenqor Signature Block', required: true, defaultValue: 'MUHAMMAD ANNAS BIN MUHAMMAD NAZMI' },
    { id: 'zenqorRepPosition', label: { en: 'Zenqor Representative Position', ms: 'Jawatan Wakil Zenqor' }, type: 'text', owner: 'zenqor_editable', section: 'Zenqor Signature Block', required: true, defaultValue: 'PENGARAH' },
    { id: 'zenqorSignDate', label: { en: 'Date', ms: 'Tarikh' }, type: 'date', owner: 'zenqor_fills_after', section: 'Zenqor Signature Block', required: true, defaultValue: '' },

    { id: 'clientRepName', label: { en: 'Client Representative Name', ms: 'Nama Wakil Pihak Penerima' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' },
    { id: 'clientRepPosition', label: { en: 'Client Representative Position', ms: 'Jawatan Wakil Pihak Penerima' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' },
    { id: 'clientSignDate', label: { en: 'Date', ms: 'Tarikh' }, type: 'date', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' }
];

// ---------------------------------------------------------------
// 4. SERVICE AGREEMENT (Perjanjian Perkhidmatan)
// ---------------------------------------------------------------
const serviceAgreementFields = [
    { id: 'agreementRefSuffix', label: { en: 'Agreement Reference (ZNQ-SA-___)', ms: 'Rujukan Perjanjian (ZNQ-SA-___)' }, type: 'text', owner: 'zenqor_editable', section: 'Agreement Details', required: true, defaultValue: '' },
    { id: 'documentDate', label: { en: 'Document Date', ms: 'Tarikh Dokumen' }, type: 'date', owner: 'zenqor_editable', section: 'Agreement Details', required: true, defaultValue: '' },
    { id: 'agreementDate', label: { en: 'Agreement Date', ms: 'Tarikh Perjanjian' }, type: 'date', owner: 'zenqor_editable', section: 'Agreement Details', required: true, defaultValue: '' },

    { id: 'clientCompanyName', label: { en: 'Company / Business Name', ms: 'Nama Syarikat / Perniagaan' }, type: 'text', owner: 'client_fills', section: 'Client (Second Party)', required: true, defaultValue: '' },
    { id: 'clientRegNo', label: { en: 'Registration No. (SSM)', ms: 'No. Pendaftaran (SSM)' }, type: 'text', owner: 'client_fills', section: 'Client (Second Party)', required: true, defaultValue: '' },
    { id: 'clientBusinessAddress', label: { en: 'Business Address', ms: 'Alamat Perniagaan' }, type: 'textarea', owner: 'client_fills', section: 'Client (Second Party)', required: true, defaultValue: '' },
    { id: 'clientContactPerson', label: { en: 'Contact Person', ms: 'Pegawai untuk Dihubungi' }, type: 'text', owner: 'client_fills', section: 'Client (Second Party)', required: true, defaultValue: '' },
    { id: 'clientPhone', label: { en: 'Telephone / WhatsApp', ms: 'Telefon / WhatsApp' }, type: 'text', owner: 'client_fills', section: 'Client (Second Party)', required: true, defaultValue: '' },
    { id: 'clientEmail', label: { en: 'Official Email', ms: 'E-mel Rasmi' }, type: 'text', owner: 'client_fills', section: 'Client (Second Party)', required: true, defaultValue: '' },

    { id: 'totalFee', label: { en: 'Total Fee (RM)', ms: 'Jumlah Fi (RM)' }, type: 'text', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: true, defaultValue: '' },
    { id: 'phase1_workStage', label: { en: 'Phase 1 — Work Stage', ms: 'Fasa 1 — Peringkat Kerja' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 0, col: 0 } },
    { id: 'phase1_amount', label: { en: 'Phase 1 — Amount (RM)', ms: 'Fasa 1 — Amaun (RM)' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 0, col: 1 } },
    { id: 'phase1_milestone', label: { en: 'Phase 1 — Payment Milestone', ms: 'Fasa 1 — Milestone Pembayaran' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 0, col: 2 } },
    { id: 'phase2_workStage', label: { en: 'Phase 2 — Work Stage', ms: 'Fasa 2 — Peringkat Kerja' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 1, col: 0 } },
    { id: 'phase2_amount', label: { en: 'Phase 2 — Amount (RM)', ms: 'Fasa 2 — Amaun (RM)' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 1, col: 1 } },
    { id: 'phase2_milestone', label: { en: 'Phase 2 — Payment Milestone', ms: 'Fasa 2 — Milestone Pembayaran' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 1, col: 2 } },
    { id: 'phase3_workStage', label: { en: 'Phase 3 — Work Stage', ms: 'Fasa 3 — Peringkat Kerja' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 2, col: 0 } },
    { id: 'phase3_amount', label: { en: 'Phase 3 — Amount (RM)', ms: 'Fasa 3 — Amaun (RM)' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 2, col: 1 } },
    { id: 'phase3_milestone', label: { en: 'Phase 3 — Payment Milestone', ms: 'Fasa 3 — Milestone Pembayaran' }, type: 'tableRow', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '', pdf: { table: 'fees', row: 2, col: 2 } },
    { id: 'totalAmount', label: { en: 'TOTAL (RM)', ms: 'JUMLAH (RM)' }, type: 'text', owner: 'zenqor_editable', section: 'Fees & Payment Terms', required: false, defaultValue: '' },

    { id: 'zenqorSignatoryName', label: { en: 'Name', ms: 'Nama' }, type: 'text', owner: 'zenqor_prefilled', section: 'Zenqor Signature Block', required: true, defaultValue: 'Muhammad Annas Bin Muhammad Nazmi' },
    { id: 'zenqorSignatoryTitle', label: { en: 'Title', ms: 'Jawatan' }, type: 'text', owner: 'zenqor_prefilled', section: 'Zenqor Signature Block', required: true, defaultValue: 'Director' },
    { id: 'zenqorSignDate', label: { en: 'Date', ms: 'Tarikh' }, type: 'date', owner: 'zenqor_fills_after', section: 'Zenqor Signature Block', required: true, defaultValue: '' },

    { id: 'clientSignatoryName', label: { en: 'Name', ms: 'Nama' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' },
    { id: 'clientSignatoryTitleStamp', label: { en: 'Title / Official Stamp', ms: 'Jawatan / Cap Rasmi' }, type: 'text', owner: 'client_fills', section: 'Client Signature Block', required: false, defaultValue: '' },
    { id: 'clientSignDate', label: { en: 'Date', ms: 'Tarikh' }, type: 'date', owner: 'client_fills', section: 'Client Signature Block', required: true, defaultValue: '' }
];

// ---------------------------------------------------------------
// PDF DOCUMENT FLOW — reproduces the ACTUAL wording, clause order and
// layout of the source .docx templates (headings, full clause text,
// bullet lists, bordered tables, bilingual paragraphs), not just a
// field label/value summary. {{fieldId}} inside any string is replaced
// with the filled value (or an underscore blank line if still empty)
// at render time — see `sub()` in buildPdfForDocument(). Static legal
// wording below is transcribed verbatim from the source documents and
// must not be reworded independently of them.
// ---------------------------------------------------------------
const authorizationLetterPdfBlocks = [
    { t: 'title', en: 'SURAT WAKIL KUASA', ms: 'AUTHORIZATION LETTER' },
    { t: 'tworef', items: [['Rujukan Kami', '{{refKami}}'], ['Tarikh', '{{tarikhSurat}}']] },
    { t: 'tworef', items: [['Rujukan Tuan', '{{refTuan}}'], ['Lampiran', '{{lampiran}}']] },
    { t: 'spacer' },
    { t: 'para', text: 'MUHAMMAD ANNAS BIN MUHAMMAD NAZMI\nPENGARAH PERKHIDMATAN PERLESENAN & PERUNDINGAN\nSURIA RESIDENCE BLOCK A\nJALAN RESIDENCE SEK 3\nBANDAR MAHKOTA CHERAS\n43200 CHERAS SELANGOR' },
    { t: 'para', text: 'Tuan / Puan,' },
    { t: 'boldpara', text: 'PER: PELANTIKAN ZENQOR TECHNOLOGIES SEBAGAI WAKIL RASMI BAGI PENGURUSAN PERMOHONAN, PENYERAHAN DOKUMEN DAN URUSAN BERKAITAN.' },
    { t: 'para', text: 'Dengan hormatnya, perkara di atas dirujuk.' },
    { t: 'para', text: 'Saya, {{appointerName}}, selaku {{appointerPosition}} bagi {{appointerCompany}} No. Pendaftaran Syarikat: {{appointerRegNo}}, dengan ini melantik dan memberi kuasa kepada ZENQOR TECHNOLOGIES sebagai wakil rasmi untuk bertindak bagi pihak syarikat berhubung dengan urusan yang dinyatakan dalam surat ini.' },
    { t: 'para', text: 'Pelantikan ini bertujuan untuk membolehkan ZENQOR TECHNOLOGIES menguruskan segala permohonan, semakan, penyerahan dan pengambilan dokumen, serta urusan komunikasi dengan pihak kementerian, jabatan, agensi kerajaan, pihak berkuasa tempatan, badan berkanun atau mana-mana pihak berkaitan, tertakluk pada skop urusan yang diluluskan oleh pihak syarikat.' },
    { t: 'heading', text: '1. BUTIRAN PIHAK YANG MELANTIK' },
    { t: 'table2', rows: [
        ['Nama Syarikat Pelanggan', '{{clientCompanyName}}'],
        ['No. Pendaftaran Syarikat', '{{clientRegNo}}'],
        ['Alamat Berdaftar / Premis', '{{clientRegisteredAddress}}'],
        ['Nama & Jawatan Penandatangan', '{{clientSignatoryNameTitle}}']
    ]},
    { t: 'heading', text: '2. BUTIRAN PIHAK YANG DILANTIK' },
    { t: 'table2', rows: [
        ['Nama Syarikat', 'ZENQOR TECHNOLOGIES'],
        ['No. Pendaftaran Syarikat', '202603157897 (JM1045730-D)'],
        ['Alamat / Maklumat Hubungan', 'SURIA RESIDENCE BLOCK A, JALAN RESIDENCE SEK 3, BANDAR MAHKOTA CHERAS 43200 CHERAS SELANGOR']
    ]},
    { t: 'heading', text: '3. BUTIRAN URUSAN YANG DIBERI KUASA' },
    { t: 'table2', rows: [
        ['Jenis Permohonan / Urusan', '{{matterType}}'],
        ['Pihak / Agensi Berkaitan', '{{matterAgency}}'],
        ['Lokasi / Premis / Projek', '{{matterLocation}}']
    ]},
    { t: 'heading', text: '4. SKOP KUASA YANG DIBERIKAN' },
    { t: 'bullets', items: [
        'Penyediaan Dokumen: Menyediakan, menyemak, menyusun dan mengemukakan borang, permohonan, surat, dokumen sokongan serta maklumat yang diperlukan bagi pihak syarikat.',
        'Permohonan dan Pembaharuan: Menguruskan permohonan baharu, pembaharuan, pindaan, tambahan, pengesahan, semakan atau pembetulan yang berkaitan.',
        'Urusan dengan Pihak Berkuasa: Berurusan dan berkomunikasi dengan pegawai, jabatan, agensi, pihak berkuasa tempatan, badan berkanun atau pihak berkaitan bagi kelancaran pemprosesan urusan.',
        'Dokumen dan Surat Rasmi: Mengemukakan, menerima, menyerahkan, melengkapkan, mengambil, serta mendapatkan salinan dokumen atau surat rasmi yang berkaitan.',
        'Semakan dan Susulan: Membuat semakan status, memantau perkembangan, dan melaksanakan tindakan susulan yang munasabah sehingga urusan selesai.',
        'Notis dan Keputusan: Menerima notis, surat makluman, keputusan, ulasan, atau dokumen berkaitan yang dikeluarkan oleh pihak berkuasa.',
        'Tindakan Berkaitan: Mengambil sebarang tindakan pentadbiran yang munasabah dan berkait langsung dengan penyelesaian urusan yang diberi kuasa.'
    ]},
    { t: 'heading', text: '5. PENGESAHAN DAN HAD KUASA' },
    { t: 'para', text: 'Pelantikan ini dibuat dengan kebenaran dan persetujuan penuh pihak syarikat. ZENQOR TECHNOLOGIES diberi kuasa untuk bertindak sebagai wakil bagi melaksanakan urusan yang dinyatakan dalam surat ini.' },
    { t: 'para', text: 'Walau bagaimanapun, pemberian kuasa ini TIDAK merangkumi sebarang tindakan untuk membuat pengakuan, pengisytiharan, perjanjian, komitmen kewangan, atau keputusan yang mengikat pihak syarikat; kecuali dengan kelulusan bertulis terlebih dahulu daripada pihak syarikat, atau dibenarkan secara nyata oleh pihak berkuasa yang berkenaan.' },
    { t: 'heading', text: '6. TEMPOH KUAT KUASA' },
    { t: 'para', text: 'Surat wakil kuasa ini berkuat kuasa mulai {{validityStart}} hingga {{validityEnd}}, atau sehingga dibatalkan secara bertulis oleh pihak syarikat. Segala tindakan yang dilaksanakan hendaklah terhad kepada skop urusan yang dinyatakan di dalam surat ini.' },
    { t: 'para', text: 'Segala kerjasama pihak tuan/puan dalam melancarkan urusan ini amatlah dihargai.' },
    { t: 'para', text: 'Sekian, terima kasih.' },
    { t: 'para', text: 'Yang benar,' },
    { t: 'signatures2',
        left: { title: 'BAGI PIHAK SYARIKAT PELANGGAN', nameField: 'clientSigName', positionField: 'clientSigPosition', stampField: 'clientCompanyStampNote', sigRole: 'client' },
        right: { title: 'DENGAN PENERIMAAN / PENGESAHAN', nameField: 'zenqorSigName', positionField: 'zenqorSigPosition', sigRole: 'zenqor' }
    }
];

const ndaPdfBlocks = [
    { t: 'title', en: 'NON-DISCLOSURE AGREEMENT', ms: 'PERJANJIAN KERAHSIAAN' },
    { t: 'para', text: 'Perjanjian Kerahsiaan ini (“Perjanjian”) dibuat dan berkuat kuasa pada {{effectiveDate}} (“Tarikh Kuat Kuasa”), antara pihak-pihak berikut:' },
    { t: 'table3', headers: ['', 'PIHAK PENDEDAH', 'PIHAK PENERIMA'], rows: [
        ['Nama Syarikat', 'ZENQOR TECHNOLOGIES', '{{receivingCompanyName}}'],
        ['No. Pendaftaran', '202603157897 (JM1045730-G)', '{{receivingRegNo}}'],
        ['Alamat', 'SURIA RESIDENCE BLOCK A, JALAN RESIDENCE SEK 3, BANDAR MAHKOTA CHERAS 43200 CHERAS SELANGOR', '{{receivingAddress}}']
    ]},
    { t: 'para', text: 'Pihak Pendedah dan Pihak Penerima selepas ini secara bersama dirujuk sebagai “Pihak-Pihak” dan secara berasingan sebagai “Pihak”.' },
    { t: 'heading', text: '1. TUJUAN' },
    { t: 'para', text: 'Pihak Pendedah boleh mendedahkan Maklumat Sulit kepada Pihak Penerima bagi tujuan perbincangan, penilaian, perundingan, penyediaan cadangan, pelaksanaan projek, penyampaian perkhidmatan atau urusan perniagaan yang berkaitan antara Pihak-Pihak (“Tujuan Yang Dibenarkan”). Pihak Penerima hanya boleh menggunakan Maklumat Sulit bagi Tujuan Yang Dibenarkan.' },
    { t: 'heading', text: '2. TAKRIF MAKLUMAT SULIT' },
    { t: 'para', text: '“Maklumat Sulit” bermaksud apa-apa maklumat yang didedahkan oleh atau bagi pihak Pihak Pendedah kepada Pihak Penerima, sama ada sebelum atau selepas Tarikh Kuat Kuasa, dalam bentuk bertulis, lisan, visual, elektronik, digital atau apa-apa bentuk lain, termasuk tetapi tidak terhad kepada:' },
    { t: 'bullets', items: [
        'rancangan perniagaan, strategi, harga, sebut harga, cadangan, kontrak, maklumat kewangan dan operasi;',
        'maklumat pelanggan, prospek, pembekal, rakan niaga, pekerja dan hubungan komersial;',
        'pelan teknikal, seni bina sistem, dokumentasi, algoritma, kod sumber, kod objek, pangkalan data, API, token, kunci akses, kata laluan, konfigurasi, reka bentuk, prototaip, pengetahuan teknikal dan rahsia dagangan;',
        'laporan, analisis, nota, salinan atau bahan terbitan yang mengandungi atau mencerminkan Maklumat Sulit; dan',
        'apa-apa maklumat yang. menurut sifatnya, keadaan pendedahan atau penandaan munasabah sepatutnya dianggap sulit.'
    ]},
    { t: 'heading', text: '3. KEWAJIPAN PIHAK PENERIMA' },
    { t: 'para', text: 'Pihak Penerima hendaklah:' },
    { t: 'bullets', items: [
        'menjaga kerahsiaan Maklumat Sulit dengan tahap penjagaan yang munasabah dan sekurang-kurangnya setara dengan tahap penjagaan yang digunakan untuk melindungi maklumat sulitnya sendiri;',
        'tidak mendedahkan, menerbitkan, menyalin, memindahkan, menjual atau menyebarkan Maklumat Sulit kepada mana-mana pihak ketiga kecuali sebagaimana dibenarkan di bawah Perjanjian ini;',
        'tidak menggunakan Maklumat Sulit untuk apa-apa tujuan selain Tujuan Yang Dibenarkan;',
        'mengambil langkah keselamatan pentadbiran, teknikal dan fizikal yang munasabah bagi mencegah akses, penggunaan, kehilangan atau pendedahan tanpa kebenaran; dan',
        'memaklumkan Pihak Pendedah dengan segera apabila menyedari sebarang akses, penggunaan, kehilangan atau pendedahan Maklumat Sulit tanpa kebenaran, serta memberikan kerjasama yang munasabah untuk mengurangkan kesannya.'
    ]},
    { t: 'heading', text: '4. PENDEDAHAN KEPADA WAKIL YANG DIBENARKAN' },
    { t: 'para', text: 'Pihak Penerima boleh mendedahkan Maklumat Sulit hanya kepada pengarah, pegawai, pekerja, penasihat profesional, kontraktor atau ejen yang benar-benar perlu mengetahui maklumat tersebut bagi Tujuan Yang Dibenarkan (“Wakil Yang Dibenarkan”), dengan syarat mereka terikat dengan kewajipan kerahsiaan yang sekurang-kurangnya setara dengan Perjanjian ini. Pihak Penerima bertanggungjawab terhadap sebarang pelanggaran Perjanjian ini oleh Wakil Yang Dibenarkan setakat yang dibenarkan oleh undang-undang.' },
    { t: 'heading', text: '5. PENGECUALIAN DARIPADA MAKLUMAT SULIT' },
    { t: 'para', text: 'Kewajipan kerahsiaan tidak terpakai kepada maklumat yang dapat dibuktikan oleh Pihak Penerima melalui rekod yang munasabah bahawa maklumat tersebut:' },
    { t: 'bullets', items: [
        'telah tersedia kepada umum tanpa pelanggaran Perjanjian ini;',
        'telah diketahui secara sah oleh Pihak Penerima sebelum pendedahan oleh Pihak Pendedah dan tidak tertakluk kepada kewajipan kerahsiaan;',
        'diterima secara sah daripada pihak ketiga yang tidak terikat dengan kewajipan kerahsiaan berhubung maklumat tersebut; atau',
        'dibangunkan secara bebas oleh Pihak Penerima tanpa menggunakan atau merujuk kepada Maklumat Sulit Pihak Pendedah.'
    ]},
    { t: 'heading', text: '6. PENDEDAHAN YANG DIKEHENDAKI UNDANG-UNDANG' },
    { t: 'para', text: 'Sekiranya Pihak Penerima diwajibkan oleh undang-undang, perintah mahkamah atau arahan pihak berkuasa yang mempunyai bidang kuasa untuk mendedahkan Maklumat Sulit, Pihak Penerima hendaklah, setakat yang dibenarkan oleh undang-undang, memberikan notis bertulis kepada Pihak Pendedah secepat yang munasabah dan hanya mendedahkan bahagian Maklumat Sulit yang diwajibkan.' },
    { t: 'heading', text: '7. HAK MILIK DAN TIADA PEMBERIAN LESEN' },
    { t: 'para', text: 'Semua hak, hak milik dan kepentingan terhadap Maklumat Sulit kekal milik Pihak Pendedah atau pemiliknya yang sah. Tiada apa-apa dalam Perjanjian ini boleh ditafsirkan sebagai memberikan kepada Pihak Penerima sebarang lesen, pemindahan hak harta intelek atau hak lain kecuali hak terhad untuk menggunakan Maklumat Sulit bagi Tujuan Yang Dibenarkan.' },
    { t: 'heading', text: '8. DATA PERIBADI' },
    { t: 'para', text: 'Sekiranya Maklumat Sulit mengandungi data peribadi, setiap Pihak hendaklah memproses dan melindungi data peribadi tersebut mengikut undang-undang perlindungan data yang terpakai di Malaysia, termasuk Akta Perlindungan Data Peribadi 2010 [Akta 709], sebagaimana dipinda dari semasa ke semasa, setakat undang-undang tersebut terpakai kepada pemprosesan berkenaan.' },
    { t: 'heading', text: '9. PEMULANGAN ATAU PEMUSNAHAN MAKLUMAT' },
    { t: 'para', text: 'Atas permintaan bertulis Pihak Pendedah atau apabila Tujuan Yang Dibenarkan berakhir, Pihak Penerima hendaklah dalam tempoh yang munasabah memulangkan atau memusnahkan Maklumat Sulit dan semua salinannya yang berada dalam milikan atau kawalannya, kecuali salinan yang perlu disimpan bagi tujuan pematuhan undang-undang, peraturan, audit atau dasar sandaran automatik yang sah. Sebarang salinan yang dikekalkan terus tertakluk kepada kewajipan kerahsiaan di bawah Perjanjian ini.' },
    { t: 'heading', text: '10. TEMPOH DAN KELANGSUNGAN KEWAJIPAN' },
    { t: 'para', text: 'Perjanjian ini berkuat kuasa pada Tarikh Kuat Kuasa dan kekal berkuat kuasa sehingga ditamatkan secara bertulis oleh mana-mana Pihak. Walau apa pun penamatan, kewajipan kerahsiaan dan sekatan penggunaan Maklumat Sulit akan terus berkuat kuasa selama {{confidentialitySurvivalPeriod}} selepas tarikh penamatan atau tarikh pendedahan terakhir Maklumat Sulit, yang mana terkemudian.' },
    { t: 'heading', text: '11. TIADA KEWAJIPAN UNTUK MENERUSKAN TRANSAKSI' },
    { t: 'para', text: 'Perjanjian ini tidak mewajibkan mana-mana Pihak untuk meneruskan sebarang transaksi, projek atau hubungan perniagaan. Kecuali dipersetujui secara bertulis dalam perjanjian berasingan, setiap Pihak menanggung kosnya sendiri berkaitan perbincangan atau penilaian yang dijalankan.' },
    { t: 'heading', text: '12. REMEDI' },
    { t: 'para', text: 'Pihak Penerima mengakui bahawa pendedahan atau penggunaan Maklumat Sulit tanpa kebenaran boleh menyebabkan kerugian kepada Pihak Pendedah. Sekiranya berlaku pelanggaran, Pihak Pendedah berhak mendapatkan apa-apa remedi yang tersedia di sisi undang-undang, tertakluk kepada keputusan mahkamah atau pihak berkuasa yang berbidang kuasa.' },
    { t: 'heading', text: '13. PERUNTUKAN AM' },
    { t: 'bullets', items: [
        'Keseluruhan Perjanjian. Perjanjian ini merupakan keseluruhan persetujuan Pihak-Pihak berhubung kerahsiaan bagi perkara yang dinyatakan di sini dan menggantikan persefahaman terdahulu mengenai perkara yang sama, kecuali dinyatakan sebaliknya secara bertulis.',
        'Pindaan. Sebarang pindaan atau tambahan kepada Perjanjian ini hendaklah dibuat secara bertulis dan dipersetujui oleh kedua-dua Pihak.',
        'Ketaksahan Sebahagian. Jika mana-mana peruntukan didapati tidak sah atau tidak boleh dikuatkuasakan, baki peruntukan hendaklah terus berkuat kuasa setakat yang dibenarkan oleh undang-undang.',
        'Pengabaian. Kegagalan atau kelewatan mana-mana Pihak untuk menguatkuasakan sesuatu hak tidak dianggap sebagai pengabaian hak tersebut.',
        'Salinan dan Tandatangan Elektronik. Perjanjian ini boleh ditandatangani dalam beberapa salinan dan, setakat dibenarkan oleh undang-undang, melalui tandatangan elektronik; setiap salinan dianggap sebagai sebahagian daripada dokumen yang sama.'
    ]},
    { t: 'heading', text: '14. UNDANG-UNDANG MENGAWAL SELIA DAN BIDANG KUASA' },
    { t: 'para', text: 'Perjanjian ini ditadbir dan ditafsirkan menurut undang-undang Malaysia. Pihak-Pihak bersetuju untuk tertakluk kepada bidang kuasa mahkamah di Malaysia bagi sebarang pertikaian yang timbul daripada atau berkaitan dengan Perjanjian ini.' },
    { t: 'boldpara', text: 'DITANDATANGANI OLEH PIHAK-PIHAK' },
    { t: 'signatures2',
        left: { title: 'BAGI PIHAK PENDEDAH (ZENQOR TECHNOLOGIES)', nameField: 'zenqorRepName', positionField: 'zenqorRepPosition', dateField: 'zenqorSignDate', sigRole: 'zenqor' },
        right: { title: 'BAGI PIHAK PENERIMA', nameField: 'clientRepName', positionField: 'clientRepPosition', dateField: 'clientSignDate', sigRole: 'client' }
    },
    { t: 'para', text: 'Nota: Dokumen ini ialah templat kontrak perniagaan. Sebelum digunakan untuk transaksi bernilai tinggi, maklumat sangat sensitif, urusan rentas sempadan atau keadaan khusus industri, pertimbangkan semakan oleh peguam berkelayakan di Malaysia.', italic: true, small: true }
];

const serviceAgreementPdfBlocks = [
    { t: 'title', en: 'CONSULTANCY & LICENSE APPLICATION SERVICE AGREEMENT', ms: 'PERUNDINGAN & PERMOHONAN LESEN PERJANJIAN PERKHIDMATAN' },
    { t: 'tworef', items: [['Agreement Reference (Rujukan Perjanjian)', 'ZNQ-SA-{{agreementRefSuffix}}'], ['Document Date (Tarikh Dokumen)', '{{documentDate}}']] },
    { t: 'para', text: 'This Consultancy & License Application Service Agreement (the "Agreement") is entered into as of the Agreement Date stated in Section 1 by and between Zenqor Technologies (the "Service Provider" or "Consultant") and the client identified in Section 1 (the "Client"). Each may be referred to individually as a "Party" and collectively as the "Parties."' },
    { t: 'para', text: '(Perjanjian Perkhidmatan Perundingan dan Permohonan Lesen ini ("Perjanjian") dibuat pada Tarikh Perjanjian yang dinyatakan dalam Seksyen 1 antara Zenqor Technologies ("Penyedia Perkhidmatan" atau "Perunding") dengan pelanggan yang dikenal pasti dalam Seksyen 1 ("Pelanggan"). Setiap satunya boleh disebut sebagai "Pihak" dan secara bersama sebagai "Pihak-Pihak".)', italic: true },
    { t: 'heading', text: '1.0 PARTY INFORMATION (MAKLUMAT PIHAK-PIHAK)' },
    { t: 'table3', headers: ['DETAIL (BUTIRAN)', 'SERVICE PROVIDER (FIRST PARTY) (PENYEDIA PERKHIDMATAN (PIHAK PERTAMA))', 'CLIENT (SECOND PARTY) (PELANGGAN (PIHAK KEDUA))'], rows: [
        ['Company / Business Name (Nama Syarikat / Perniagaan)', 'ZENQOR TECHNOLOGIES', '{{clientCompanyName}}'],
        ['Registration No. (SSM) (No. Pendaftaran (SSM))', '202603157897 (JM1045730-D)', '{{clientRegNo}}'],
        ['Business Address (Alamat Perniagaan)', 'Suria Residence, Block A, Jalan Residence, Bandar Mahkota Cheras, 43200 Selangor', '{{clientBusinessAddress}}'],
        ['Contact Person (Pegawai untuk Dihubungi)', 'Muhammad Annas', '{{clientContactPerson}}'],
        ['Telephone / WhatsApp (Telefon / WhatsApp)', '+60 11-6501 2569', '{{clientPhone}}'],
        ['Official Email (E-mel Rasmi)', 'admin@zenq0r.com', '{{clientEmail}}'],
        ['Agreement Date (Tarikh Perjanjian)', '{{agreementDate}}', '{{agreementDate}}']
    ]},
    { t: 'heading', text: '2.0 SCOPE OF SERVICES (SKOP PERKHIDMATAN)' },
    { t: 'para', text: 'Zenqor Technologies will provide consultancy, file-management, and premises-license application services within the following scope:' },
    { t: 'para', text: '(Zenqor Technologies akan menyediakan perkhidmatan perundingan, pengurusan fail dan permohonan lesen premis berdasarkan skop berikut:)', italic: true },
    { t: 'bullets', items: [
        '2.1 Document Review and Audit. Review, audit, and organize supporting documents and application files for completeness and alignment with the requirements and guidelines of the relevant Local Authority (Pihak Berkuasa Tempatan, or "PBT") or another competent agency.',
        '2.2 Application Preparation. Prepare, complete, and process official application documents and forms using information supplied by the Client.',
        '2.3 Premises Compliance Advisory. Provide basic technical guidance on PBT compliance requirements, including business-signage specifications, fire-extinguisher requirements, and premises layout.',
        '2.4 Submission and Tracking. Submit the application file at the PBT counter or through the relevant official portal and periodically monitor the application status.',
        '2.5 Coordination of Authority Feedback. Guide the Client on corrective actions required in response to technical comments, notices, additional conditions, or findings arising from a PBT premises inspection.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(2.1 Semakan dan Audit Dokumen. Menyemak, mengaudit dan menyusun dokumen sokongan serta fail permohonan bagi memastikan kelengkapannya dan pematuhannya terhadap keperluan serta garis panduan Pihak Berkuasa Tempatan (PBT) atau agensi berwajib yang berkaitan.)',
        '(2.2 Penyediaan Permohonan. Menyediakan, melengkapkan dan memproses dokumen serta borang permohonan rasmi berdasarkan maklumat yang diberikan oleh Pelanggan.)',
        '(2.3 Khidmat Nasihat Pematuhan Premis. Memberikan panduan teknikal asas berkaitan keperluan pematuhan PBT, termasuk spesifikasi papan tanda perniagaan, keperluan alat pemadam api dan susun atur premis.)',
        '(2.4 Penyerahan dan Pemantauan. Menyerahkan fail permohonan di kaunter PBT atau melalui portal rasmi yang berkaitan serta memantau status permohonan secara berkala.)',
        '(2.5 Penyelarasan Maklum Balas Pihak Berkuasa. Membimbing Pelanggan berhubung tindakan pembetulan yang diperlukan susulan ulasan teknikal, notis, syarat tambahan atau dapatan pemeriksaan premis oleh PBT.)'
    ]},
    { t: 'heading', text: '3.0 SERVICE PROVIDER RESPONSIBILITIES (TANGGUNGJAWAB PENYEDIA PERKHIDMATAN)' },
    { t: 'bullets', items: [
        '3.1 Professional Care. Perform the Services with reasonable professional skill, care, and diligence consistent with applicable industry practices in Malaysia.',
        '3.2 Status Updates. Provide the Client with periodic updates on application progress, status, and official feedback received from the PBT or relevant agencies.',
        '3.3 Document Management. Organize and safeguard working documents provided by the Client while the application is being processed.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(3.1 Ketelitian Profesional. Melaksanakan Perkhidmatan dengan kemahiran, ketelitian dan usaha profesional yang munasabah, selaras dengan amalan industri yang berkaitan di Malaysia.)',
        '(3.2 Kemas Kini Status. Memberikan kemas kini berkala kepada Pelanggan mengenai perkembangan dan status permohonan serta maklum balas rasmi yang diterima daripada PBT atau agensi berkaitan.)',
        '(3.3 Pengurusan Dokumen. Menyusun dan menjaga keselamatan dokumen kerja yang diberikan oleh Pelanggan sepanjang tempoh pemprosesan permohonan.)'
    ]},
    { t: 'heading', text: '4.0 CLIENT RESPONSIBILITIES (TANGGUNGJAWAB PELANGGAN)' },
    { t: 'para', text: 'To support timely processing and avoid preventable delays, the Client agrees to the following:' },
    { t: 'para', text: '(Bagi menyokong pemprosesan yang lancar dan mengelakkan kelewatan yang boleh dicegah, Pelanggan bersetuju untuk mematuhi perkara berikut:)', italic: true },
    { t: 'bullets', items: [
        '4.1 Accuracy and Authenticity. Provide valid, accurate, current, and authentic supporting documents, including, where applicable, the SSM profile, tenancy agreement, floor plan, and copies of identification documents.',
        '4.2 Response Time. Provide all documents or additional information requested by Zenqor Technologies within seven (7) business days.',
        '4.3 Physical and Technical Compliance. Ensure that the premises comply with applicable PBT requirements, including restrictions on unauthorized structural alterations, Fire and Rescue Department of Malaysia requirements, and hygiene standards.',
        '4.4 Official Government Fees. Pay all official license fees, inspection charges, signage charges, deposits, penalties, and other governmental charges directly to the PBT or relevant agency. These amounts are separate from Zenqor Technologies’ service fees.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(4.1 Ketepatan dan Kesahihan. Menyediakan dokumen sokongan yang sah, tepat, terkini dan tulen, termasuk, jika berkenaan, profil SSM, perjanjian sewa, pelan lantai dan salinan dokumen pengenalan.)',
        '(4.2 Tempoh Maklum Balas. Menyerahkan semua dokumen atau maklumat tambahan yang diminta oleh Zenqor Technologies dalam tempoh tujuh (7) hari bekerja.)',
        '(4.3 Pematuhan Fizikal dan Teknikal. Memastikan premis mematuhi keperluan PBT yang berkenaan, termasuk larangan terhadap pengubahsuaian struktur tanpa kebenaran, keperluan Jabatan Bomba dan Penyelamat Malaysia serta piawaian kebersihan.)',
        '(4.4 Fi Rasmi Kerajaan. Membayar semua fi lesen rasmi, caj pemeriksaan, caj papan tanda, deposit, penalti dan caj kerajaan yang lain secara terus kepada PBT atau agensi berkaitan. Semua amaun tersebut adalah berasingan daripada fi perkhidmatan Zenqor Technologies.)'
    ]},
    { t: 'heading', text: '5.0 FEES AND PAYMENT TERMS (FI DAN TERMA PEMBAYARAN)' },
    { t: 'para', text: 'The total fee for the scope of services described in this Agreement is {{totalFee}}, inclusive of the Professional Service Fee and the applicable Official Government / Statutory Charges within the agreed scope of services. The total fee shall be payable in the following fixed instalments:' },
    { t: 'para', text: '(Jumlah fi bagi skop perkhidmatan yang dinyatakan dalam Perjanjian ini ialah sebanyak {{totalFee}}, yang merangkumi Fi Perkhidmatan Profesional serta Fi Rasmi Kerajaan / Statutori yang berkenaan dalam skop perkhidmatan yang dipersetujui. Jumlah fi tersebut hendaklah dibayar melalui ansuran tetap berikut:)', italic: true },
    { t: 'table4', headers: ['PHASE (FASA)', 'WORK STAGE (PERINGKAT KERJA)', 'AMOUNT (RM) (AMAUN (RM))', 'PAYMENT MILESTONE (MILESTONE PEMBAYARAN)'], rows: [
        ['Phase 1 (Fasa 1)', '{{phase1_workStage}}', '{{phase1_amount}}', '{{phase1_milestone}}'],
        ['Phase 2 (Fasa 2)', '{{phase2_workStage}}', '{{phase2_amount}}', '{{phase2_milestone}}'],
        ['Phase 3 (Fasa 3)', '{{phase3_workStage}}', '{{phase3_amount}}', '{{phase3_milestone}}'],
        ['TOTAL (JUMLAH)', '', '{{totalAmount}}', '']
    ]},
    { t: 'bullets', items: [
        '5.1 Official Payment Method. Online bank transfer to Maybank Islamic Berhad, Account No. 5629 8205 7309, Account Name: Zenqor Technologies. The Client should retain and provide proof of payment.',
        '5.2 Invoice Due Date. Each phase payment is due within three (3) business days after the applicable invoice date.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(5.1 Kaedah Pembayaran Rasmi. Pindahan bank dalam talian ke Maybank Islamic Berhad, No. Akaun 5629 8205 7309, Nama Akaun: Zenqor Technologies. Pelanggan hendaklah menyimpan dan mengemukakan bukti pembayaran.)',
        '(5.2 Tempoh Pembayaran Invois. Bayaran bagi setiap fasa hendaklah dijelaskan dalam tempoh tiga (3) hari bekerja dari tarikh invois berkenaan.)'
    ]},
    { t: 'heading', text: '6.0 CANCELLATION AND TERMINATION (PEMBATALAN DAN PENAMATAN)' },
    { t: 'bullets', items: [
        '6.1 Cancellation by Client. If the Client cancels the application or terminates this Agreement for its own reasons after consultancy work or the document audit has begun, all deposits and fees already paid are non-refundable.',
        '6.2 Termination for Breach. Zenqor Technologies may terminate this Agreement immediately by written notice if the Client fails to provide required documents for more than thirty (30) days, provides false or misleading information, or fails to make payment when due.',
        '6.3 Amounts Due on Termination. The Client remains responsible for payment for every phase of work completed before the effective termination date.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(6.1 Pembatalan oleh Pelanggan. Jika Pelanggan membatalkan permohonan atau menamatkan Perjanjian ini atas sebabnya sendiri selepas kerja perundingan atau audit dokumen dimulakan, semua deposit dan fi yang telah dibayar tidak akan dikembalikan.)',
        '(6.2 Penamatan kerana Pelanggaran. Zenqor Technologies boleh menamatkan Perjanjian ini serta-merta melalui notis bertulis jika Pelanggan gagal mengemukakan dokumen yang diperlukan melebihi tiga puluh (30) hari, memberikan maklumat palsu atau mengelirukan, atau gagal membuat pembayaran apabila perlu dibayar.)',
        '(6.3 Amaun yang Perlu Dibayar semasa Penamatan. Pelanggan tetap bertanggungjawab membayar setiap fasa kerja yang telah diselesaikan sebelum tarikh kuat kuasa penamatan.)'
    ]},
    { t: 'heading', text: '7.0 LICENSE APPROVAL DISCLAIMER AND LIMITATION OF LIABILITY (PENAFIAN KELULUSAN LESEN DAN HAD LIABILITI)' },
    { t: 'bullets', items: [
        '7.1 Authority Decision. The Client acknowledges that all decisions to approve, reject, defer, or impose additional conditions on a license application rest solely with the PBT and other competent agencies, subject to their policies, standards, and discretion.',
        '7.2 Consultant’s Role. Zenqor Technologies acts solely as a professional consultant and facilitator in managing and coordinating the application. Zenqor Technologies does not guarantee approval and makes no representation that approval will be automatic.',
        '7.3 Limitation of Responsibility. Zenqor Technologies is not responsible for any rejection, processing delay, or loss arising from inaccurate or incomplete Client documents, false information, pre-existing legal or regulatory issues affecting the premises, the Client’s delay, or the premises’ failure to meet applicable technical standards.',
        '7.4 Non-Refundable Fees. Service fees compensate Zenqor Technologies for consultancy, audit, file preparation, and related work performed and are non-refundable if the PBT rejects the application.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(7.1 Keputusan Pihak Berkuasa. Pelanggan mengakui bahawa semua keputusan untuk meluluskan, menolak, menangguhkan atau mengenakan syarat tambahan terhadap permohonan lesen terletak sepenuhnya pada PBT dan agensi berwajib yang lain, tertakluk pada dasar, piawaian dan budi bicara mereka.)',
        '(7.2 Peranan Perunding. Zenqor Technologies bertindak semata-mata sebagai perunding profesional dan fasilitator dalam mengurus serta menyelaraskan permohonan. Zenqor Technologies tidak menjamin kelulusan dan tidak membuat sebarang representasi bahawa kelulusan akan diberikan secara automatik.)',
        '(7.3 Had Tanggungjawab. Zenqor Technologies tidak bertanggungjawab terhadap sebarang penolakan, kelewatan pemprosesan atau kerugian yang berpunca daripada dokumen Pelanggan yang tidak tepat atau tidak lengkap, maklumat palsu, isu undang-undang atau kawal selia sedia ada yang menjejaskan premis, kelewatan oleh Pelanggan, atau kegagalan premis memenuhi piawaian teknikal yang berkenaan.)',
        '(7.4 Fi Tidak Boleh Dikembalikan. Fi perkhidmatan merupakan bayaran bagi kerja perundingan, audit, penyediaan fail dan kerja berkaitan yang telah dilaksanakan oleh Zenqor Technologies dan tidak boleh dikembalikan jika permohonan ditolak oleh PBT.)'
    ]},
    { t: 'heading', text: '8.0 CONFIDENTIALITY AND PERSONAL DATA (KERAHSIAAN DAN DATA PERIBADI)' },
    { t: 'bullets', items: [
        '8.1 Confidential Information. Each Party will keep confidential all non-public business information, technical documents, financial data, and company information shared in connection with the Services and will not disclose such information to a third party without prior written consent, except where disclosure is required by law or reasonably necessary for the license application.',
        '8.2 Personal Data Protection. Zenqor Technologies will process personal data and Client company information for purposes connected with the license application and in accordance with Malaysia’s Personal Data Protection Act 2010 (Act 709), as applicable.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(8.1 Maklumat Sulit. Setiap Pihak hendaklah merahsiakan semua maklumat perniagaan bukan awam, dokumen teknikal, data kewangan dan maklumat syarikat yang dikongsi berkaitan Perkhidmatan serta tidak mendedahkannya kepada pihak ketiga tanpa persetujuan bertulis terlebih dahulu, kecuali jika pendedahan diwajibkan oleh undang-undang atau semunasabahnya diperlukan bagi permohonan lesen.)',
        '(8.2 Perlindungan Data Peribadi. Zenqor Technologies akan memproses data peribadi dan maklumat syarikat Pelanggan bagi tujuan yang berkaitan dengan permohonan lesen dan mengikut Akta Perlindungan Data Peribadi 2010 (Akta 709), setakat yang terpakai.)'
    ]},
    { t: 'heading', text: '9.0 TERM (TEMPOH PERJANJIAN)' },
    { t: 'para', text: '9.1 Effective Date and Expiration. This Agreement takes effect when signed by both Parties and continues until the PBT issues its decision on the license application, unless earlier terminated under Section 6.0.' },
    { t: 'para', text: '(9.1 Tarikh Kuat Kuasa dan Tamat Tempoh. Perjanjian ini berkuat kuasa apabila ditandatangani oleh kedua-dua Pihak dan berterusan sehingga PBT mengeluarkan keputusan mengenai permohonan lesen, melainkan ditamatkan lebih awal di bawah Seksyen 6.0.)', italic: true },
    { t: 'heading', text: '10.0 DISPUTE RESOLUTION AND GOVERNING LAW (PENYELESAIAN PERTIKAIAN DAN UNDANG-UNDANG YANG MENGAWAL)' },
    { t: 'bullets', items: [
        '10.1 Good-Faith Negotiation. The Parties will first attempt to resolve amicably any dispute, difference in interpretation, or claim arising out of or relating to this Agreement through good-faith negotiations for fourteen (14) days after written notice of the dispute.',
        '10.2 Malaysian Law and Jurisdiction. This Agreement is governed by and construed in accordance with the laws of Malaysia. The Parties submit to the jurisdiction of the courts of Malaysia.'
    ]},
    { t: 'bullets', italic: true, items: [
        '(10.1 Rundingan dengan Niat Baik. Pihak-Pihak hendaklah terlebih dahulu berusaha menyelesaikan secara baik sebarang pertikaian, perbezaan tafsiran atau tuntutan yang timbul daripada atau berkaitan dengan Perjanjian ini melalui rundingan dengan niat baik selama empat belas (14) hari selepas notis bertulis mengenai pertikaian diberikan.)',
        '(10.2 Undang-Undang dan Bidang Kuasa Malaysia. Perjanjian ini ditadbir dan ditafsirkan mengikut undang-undang Malaysia. Pihak-Pihak bersetuju untuk tertakluk pada bidang kuasa mahkamah Malaysia.)'
    ]},
    { t: 'heading', text: '11.0 ACKNOWLEDGMENT AND EXECUTION (PENGAKUAN DAN PENANDATANGANAN)' },
    { t: 'para', text: 'By signing below, each Party confirms that it has read and understood this Agreement, has had the opportunity to seek independent advice, and agrees to be bound by its terms and conditions. Each signatory represents that they are authorized to sign for the Party identified below.' },
    { t: 'para', text: '(Dengan menandatangani di bawah, setiap Pihak mengesahkan bahawa Pihak tersebut telah membaca dan memahami Perjanjian ini, telah diberikan peluang untuk mendapatkan nasihat bebas, dan bersetuju untuk terikat dengan terma dan syaratnya. Setiap penandatangan mengesahkan bahawa mereka diberi kuasa untuk menandatangani bagi pihak yang dikenal pasti di bawah.)', italic: true },
    { t: 'signatures2',
        left: { title: 'FOR ZENQOR TECHNOLOGIES', nameField: 'zenqorSignatoryName', positionField: 'zenqorSignatoryTitle', dateField: 'zenqorSignDate', sigRole: 'zenqor' },
        right: { title: 'FOR THE CLIENT / COMPANY', nameField: 'clientSignatoryName', positionField: 'clientSignatoryTitleStamp', dateField: 'clientSignDate', sigRole: 'client' }
    }
];

const clientInfoFormPdfBlocks = [
    { t: 'title', en: 'CLIENT INFORMATION FORM', ms: 'BORANG MAKLUMAT PELANGGAN' },
    { t: 'para', text: 'Please complete all applicable fields clearly. Information marked "if applicable" may be left blank where not relevant.', italic: true, small: true },
    { t: 'para', text: 'Sila lengkapkan semua ruangan yang berkenaan dengan jelas. Ruangan "jika berkenaan" boleh dibiarkan kosong jika tidak berkaitan.', italic: true, small: true },
    { t: 'heading', text: 'A. CLIENT / COMPANY INFORMATION (Maklumat Pelanggan / Syarikat)' },
    { t: 'checkboxGroup', fieldId: 'clientType' },
    { t: 'table2', rows: [
        ['Legal / Registered Name (Nama Berdaftar)', '{{legalName}}'],
        ['Trading / Business Name (Nama Perniagaan)', '{{tradingName}}'],
        ['BRN / NRIC / Passport No. (No. BRN / KP / Pasport)', '{{brnNricPassport}}'],
        ['Tax Identification No. (TIN) (No. Pengenalan Cukai)', '{{tin}}'],
        ['SST Registration No. (if applicable) (No. SST (jika berkenaan))', '{{sstNo}}'],
        ['Industry / Nature of Business (Industri / Jenis Perniagaan)', '{{industry}}'],
        ['Registered Address (Alamat Berdaftar)', '{{registeredAddress}}'],
        ['Correspondence Address (Alamat Surat-Menyurat)', '{{correspondenceAddress}}']
    ]},
    { t: 'heading', text: 'B. PRIMARY CONTACT INFORMATION (Maklumat Perhubungan Utama)' },
    { t: 'table2', rows: [
        ['Contact Person (Nama Pegawai Dihubungi)', '{{contactPersonName}}'],
        ['Designation / Position (Jawatan)', '{{designation}}'],
        ['Department (Jabatan)', '{{department}}'],
        ['Mobile No. (No. Telefon Bimbit)', '{{mobileNo}}'],
        ['Office No. (No. Pejabat)', '{{officeNo}}'],
        ['Email Address (Alamat E-mel)', '{{contactEmail}}'],
        ['Website (Laman Web)', '{{website}}'],
        ['Preferred Contact Method (Kaedah Hubungan Pilihan)', '{{preferredContactMethod}}']
    ]},
    { t: 'heading', text: 'C. BILLING & E-INVOICE INFORMATION (Maklumat Bil & e-Invois)' },
    { t: 'para', text: 'For accurate e-Invoice issuance, complete the buyer information below where applicable.', small: true },
    { t: 'table2', rows: [
        ['Billing / Buyer Name (Nama Bil / Pembeli)', '{{billingName}}'],
        ['Billing Email (E-mel Bil)', '{{billingEmail}}'],
        ['Buyer TIN (TIN Pembeli)', '{{buyerTin}}'],
        ['Buyer BRN / NRIC / Passport No. (BRN / KP / Pasport Pembeli)', '{{buyerBrn}}'],
        ['Buyer SST Registration No. (if applicable) (No. SST Pembeli (jika berkenaan))', '{{buyerSst}}'],
        ['Buyer Contact No. (No. Hubungan Pembeli)', '{{buyerContactNo}}'],
        ['Buyer / Billing Address (Alamat Pembeli / Bil)', '{{buyerAddress}}']
    ]},
    { t: 'checkboxGroup', fieldId: 'preferredInvoiceMethod' },
    { t: 'heading', text: 'D. SERVICE / PROJECT INFORMATION (Maklumat Perkhidmatan / Projek)' },
    { t: 'checkboxGroup', fieldId: 'serviceRequired' },
    { t: 'table2', rows: [
        ['Project / Service Name (Nama Projek / Perkhidmatan)', '{{projectName}}'],
        ['Estimated Budget (Anggaran Bajet)', '{{estimatedBudget}}'],
        ['Expected Start Date (Tarikh Mula Dijangka)', '{{expectedStartDate}}'],
        ['Expected Completion Date (Tarikh Siap Dijangka)', '{{expectedCompletionDate}}'],
        ['Brief Requirements / Scope (Ringkasan Keperluan / Skop)', '{{briefRequirements}}']
    ]},
    { t: 'heading', text: 'E. AUTHORISED REPRESENTATIVE (Wakil Yang Diberi Kuasa)' },
    { t: 'table2', rows: [
        ['Name (Nama)', '{{authRepName}}'],
        ['Designation (Jawatan)', '{{authRepDesignation}}'],
        ['Contact No. (No. Hubungan)', '{{authRepContactNo}}'],
        ['Email (E-mel)', '{{authRepEmail}}']
    ]},
    { t: 'checkboxGroup', fieldId: 'authorisedToApprove' },
    { t: 'heading', text: 'F. SUPPORTING DOCUMENTS & ADDITIONAL INFORMATION (Dokumen Sokongan & Maklumat Tambahan)' },
    { t: 'checkboxGroup', fieldId: 'documentsAttached' },
    { t: 'table2', rows: [
        ['How did you hear about us? (Bagaimana mengetahui kami?)', '{{referralSource}}'],
        ['Client Reference / Referral (Rujukan / Referral)', '{{clientReference}}'],
        ['Additional Notes (Catatan Tambahan)', '{{additionalNotes}}']
    ]},
    { t: 'heading', text: 'G. PERSONAL DATA PROTECTION NOTICE & CONSENT (Notis & Persetujuan Perlindungan Data Peribadi)' },
    { t: 'para', text: 'Zenqor Technologies may collect and process the personal data provided in this form for client onboarding, identity and contact verification, quotation and contract administration, delivery and support of services, billing, payment administration, e-Invoice and tax compliance, record keeping, legal or regulatory requirements, and related business communications. Where reasonably necessary, such data may be disclosed to service providers, professional advisers, financial institutions, government, tax or regulatory authorities, and other parties permitted or required by law. Reasonable security measures will be applied and personal data will be retained only for as long as necessary for the stated purposes or as required by applicable law.', small: true },
    { t: 'para', text: 'Zenqor Technologies boleh mengumpul dan memproses data peribadi yang diberikan dalam borang ini bagi tujuan pendaftaran pelanggan, pengesahan identiti dan hubungan, pentadbiran sebut harga dan kontrak, penyampaian serta sokongan perkhidmatan, pengebilan, pentadbiran bayaran, pematuhan e-Invois dan cukai, penyimpanan rekod, keperluan undang-undang atau kawal selia, serta komunikasi perniagaan yang berkaitan. Jika perlu secara munasabah, data tersebut boleh didedahkan kepada penyedia perkhidmatan, penasihat profesional, institusi kewangan, pihak kerajaan, percukaian atau kawal selia, serta pihak lain yang dibenarkan atau dikehendaki oleh undang-undang. Langkah keselamatan yang munasabah akan diambil dan data peribadi akan disimpan hanya selama diperlukan bagi tujuan yang dinyatakan atau sebagaimana dikehendaki oleh undang-undang yang terpakai.', small: true },
    { t: 'checkboxGroup', fieldId: 'pdpaConsent' },
    { t: 'table2', rows: [['Privacy Contact (Hubungan Privasi)', '{{privacyContact}}']] },
    { t: 'heading', text: 'H. CLIENT DECLARATION & AUTHORISATION (Akuan & Kebenaran Pelanggan)' },
    { t: 'para', text: 'I/We confirm that the information provided in this form is true, complete and accurate to the best of my/our knowledge, and I/we am/are authorised to provide it on behalf of the client.', small: true },
    { t: 'para', text: 'Saya/Kami mengesahkan bahawa maklumat yang diberikan dalam borang ini adalah benar, lengkap dan tepat setakat pengetahuan saya/kami, dan saya/kami diberi kuasa untuk memberikannya bagi pihak pelanggan.', small: true },
    { t: 'signatures2', left: { title: 'Client Declaration / Akuan Pelanggan', nameField: 'declarationName', positionField: 'declarationDesignation', dateField: 'declarationDate', stampField: 'companyStampNote', sigRole: 'client' }, right: null },
    { t: 'table2', rows: [['Official Email / Contact', '{{officialEmailContact}}']] },
    { t: 'heading', text: 'I. FOR OFFICE USE ONLY (Untuk Kegunaan Pejabat Sahaja)' },
    { t: 'table2', rows: [
        ['Client ID', '{{clientId}}'],
        ['Account / Reference No.', '{{accountRefNo}}'],
        ['Handled By', '{{handledBy}}'],
        ['Date Received', '{{dateReceived}}'],
        ['Verified By', '{{verifiedBy}}'],
        ['Verification Date', '{{verificationDate}}'],
        ['Remarks', '{{officeRemarks}}']
    ]},
    { t: 'checkboxGroup', fieldId: 'clientStatus' },
    { t: 'para', text: 'Document owner: Zenqor Technologies. Uncontrolled when printed unless otherwise stated.', small: true, italic: true }
];

export const DOCUMENT_TEMPLATES = {
    authorization_letter: {
        id: 'authorization_letter',
        label: { en: 'Authorization Letter', ms: 'Surat Wakil Kuasa' },
        icon: 'fa-file-signature',
        fieldConfig: authorizationLetterFields,
        pdfBlocks: authorizationLetterPdfBlocks,
        // Presence of fieldMap is what selects the coordinate-overlay engine
        // (buildOverlayPdfForDocument) over the legacy generate-from-scratch
        // renderer (buildPdfForDocument/pdfBlocks) — see documents-templates.js
        // header comment and app.js's finalizeZenqorSignature/regenerateSignedDocumentPdf.
        fieldMap: authorizationLetterFieldMap,
        signatureBoxes: authorizationLetterSignatureBoxes
    },
    client_info_form: {
        id: 'client_info_form',
        label: { en: 'Client Information Form', ms: 'Borang Maklumat Pelanggan' },
        icon: 'fa-address-card',
        fieldConfig: clientInfoFormFields,
        pdfBlocks: clientInfoFormPdfBlocks
    },
    nda: {
        id: 'nda',
        label: { en: 'Non-Disclosure Agreement', ms: 'Perjanjian Kerahsiaan' },
        icon: 'fa-user-secret',
        fieldConfig: ndaFields,
        pdfBlocks: ndaPdfBlocks
    },
    service_agreement: {
        id: 'service_agreement',
        label: { en: 'Service Agreement', ms: 'Perjanjian Perkhidmatan' },
        icon: 'fa-file-contract',
        fieldConfig: serviceAgreementFields,
        pdfBlocks: serviceAgreementPdfBlocks
    }
};

export function defaultFieldValues(templateId) {
    const tpl = DOCUMENT_TEMPLATES[templateId];
    if (!tpl) return {};
    const values = {};
    tpl.fieldConfig.forEach(f => { values[f.id] = f.defaultValue !== undefined ? (Array.isArray(f.defaultValue) ? [...f.defaultValue] : f.defaultValue) : ''; });
    return values;
}

export function requiredFieldsMissing(templateId, fields, owners) {
    const tpl = DOCUMENT_TEMPLATES[templateId];
    if (!tpl) return [];
    return tpl.fieldConfig.filter(f => f.required && owners.includes(f.owner)).filter(f => {
        const v = fields ? fields[f.id] : undefined;
        if (f.type === 'checkbox') return v !== true;
        if (f.type === 'checkboxGroup') return !Array.isArray(v) || v.length === 0;
        return v === undefined || v === null || String(v).trim() === '';
    }).map(f => f.label.en);
}

function formatCustomerAddress(customer) {
    if (!customer) return '';
    const line1 = customer.clientAddress1 || customer.clientAddress || '';
    const parts = [line1, customer.clientAddress2, customer.clientAddress3, [customer.clientPostcode, customer.clientCity].filter(Boolean).join(' '), customer.clientState, customer.clientCountry && customer.clientCountry !== 'Malaysia' ? customer.clientCountry : ''];
    return parts.map(p => String(p || '').trim()).filter(Boolean).join(', ');
}

// Maps each template's client-side fields to the matching Client Directory
// (customers/{id}) record so staff picking a client from the dropdown gets
// those fields pre-populated instead of blank — the client only needs to
// review/correct them (still editable, owner stays 'client_fills') rather
// than re-type company info the office already has on file.
export function prefillFromCustomer(templateId, customer) {
    if (!customer) return {};
    const name = customer.clientName || '';
    const regNo = customer.clientSSM || '';
    const address = formatCustomerAddress(customer);
    const contactPerson = customer.clientContactPerson || '';
    const position = customer.clientPosition || '';
    const phone = customer.clientPhone || '';
    const email = customer.clientEmail || '';
    const signatoryNameTitle = contactPerson ? [contactPerson, position].filter(Boolean).join(' — ') : '';

    const byTemplate = {
        authorization_letter: {
            appointerName: contactPerson,
            appointerPosition: position,
            appointerCompany: name,
            appointerRegNo: regNo,
            clientCompanyName: name,
            clientRegNo: regNo,
            clientRegisteredAddress: address,
            clientSignatoryNameTitle: signatoryNameTitle,
            clientSigName: contactPerson,
            clientSigPosition: position
        },
        client_info_form: {
            legalName: name,
            registeredAddress: address,
            brnNricPassport: regNo,
            contactPersonName: contactPerson,
            designation: position,
            mobileNo: phone,
            contactEmail: email,
            billingName: name,
            billingEmail: email,
            buyerAddress: address,
            authRepName: contactPerson,
            authRepDesignation: position,
            authRepContactNo: phone,
            authRepEmail: email,
            declarationName: contactPerson,
            declarationDesignation: position,
            officialEmailContact: email
        },
        nda: {
            receivingCompanyName: name,
            receivingRegNo: regNo,
            receivingAddress: address,
            clientRepName: contactPerson,
            clientRepPosition: position
        },
        service_agreement: {
            clientCompanyName: name,
            clientRegNo: regNo,
            clientBusinessAddress: address,
            clientContactPerson: contactPerson,
            clientPhone: phone,
            clientEmail: email,
            clientSignatoryName: contactPerson,
            clientSignatoryTitleStamp: position
        }
    };
    const overrides = byTemplate[templateId] || {};
    // Never overwrite with an empty string — leave the field's own defaultValue
    // (e.g. '') so the client still sees it as blank/required if the Client
    // Directory record itself doesn't have that piece of information on file.
    return Object.fromEntries(Object.entries(overrides).filter(([, v]) => String(v || '').trim() !== ''));
}


// ---------------------------------------------------------------
// PDF KIT — built on the global `PDFLib` (loaded via CDN in index.html).
// Renders the `pdfBlocks` flow defined per template above: real clause
// text with {{fieldId}} blanks substituted, bordered tables, checkbox
// lines and a two-party signature block — a faithful reproduction of
// the source .docx content, not a generic field-summary sheet.
// ---------------------------------------------------------------
const PAGE_WIDTH = 595.28;  // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(font, text, size, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    words.forEach(word => {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    });
    if (line) lines.push(line);
    return lines;
}

export async function buildPdfForDocument(templateId, fields, signatures, meta) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const tpl = DOCUMENT_TEMPLATES[templateId];
    if (!tpl || !tpl.pdfBlocks) throw new Error('Unknown document template.');
    const safeFields = fields || {};

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // Matches the official letterhead — the source templates carry the Zenqor
    // logo on their cover page. /logo.png itself is a 1920x1080 canvas that's
    // mostly blank padding around a much smaller centered wordmark (measured
    // pixel bounds: x 227–1694, y 396–625) — embedding the full canvas at a
    // small letterhead size renders as an near-invisible sliver, so it's
    // cropped to the wordmark (plus a small margin) via an offscreen canvas
    // before embedding. Any failure here (offline, blocked request, no canvas
    // support) must not break PDF generation, so it degrades to a text-only
    // header with no logo.
    let logoImage = null;
    try {
        const logoResp = await fetch('/logo.png');
        if (logoResp.ok) {
            const bitmap = await createImageBitmap(await logoResp.blob());
            const cropX = 205, cropY = 375, cropW = 1497, cropH = 262; // wordmark bounds + ~15px margin
            const canvas = document.createElement('canvas');
            canvas.width = cropW; canvas.height = cropH;
            canvas.getContext('2d').drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const croppedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            if (croppedBlob) logoImage = await pdfDoc.embedPng(await croppedBlob.arrayBuffer());
        }
    } catch (e) { /* no logo, continue without it */ }

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    function drawRunningHeader() {
        page.drawText(tpl.label.ms.toUpperCase(), { x: MARGIN, y, size: 7.5, font, color: rgb(0.55, 0.55, 0.55) });
        const right = 'ZENQOR TECHNOLOGIES';
        const w = font.widthOfTextAtSize(right, 7.5);
        page.drawText(right, { x: PAGE_WIDTH - MARGIN - w, y, size: 7.5, font, color: rgb(0.55, 0.55, 0.55) });
        y -= 8;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
        y -= 18;
    }
    function newPage() {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        drawRunningHeader();
    }
    function ensureSpace(needed) {
        if (y - needed < MARGIN + 24) newPage();
    }
    function sub(str) {
        return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, id) => {
            const v = safeFields[id];
            if (v === undefined || v === null || String(v).trim() === '') return '________________';
            return String(v);
        });
    }
    function drawWrapped(text, opts = {}) {
        const { size = 9.5, f = font, color = rgb(0.08, 0.08, 0.08), lh = size + 2.5, x = MARGIN, w = CONTENT_WIDTH } = opts;
        String(text || '').split('\n').forEach(paragraph => {
            const lines = wrapText(f, paragraph, size, w);
            ensureSpace(lines.length * lh);
            lines.forEach(line => { page.drawText(line, { x, y, size, font: f, color }); y -= lh; });
        });
    }

    function drawGridTable(headers, rows, widthFractions, opts = {}) {
        const colWidths = widthFractions.map(fr => fr * CONTENT_WIDTH);
        const hasHeader = !opts.noHeader && headers && headers.some(Boolean);
        const cellPadX = 6;
        ensureSpace(24);
        y -= 6;

        // Tracks one border segment per PAGE the table actually spans. A table
        // that page-breaks mid-row must not draw a single outer box computed
        // from the pre-break top coordinate onto the post-break page — that
        // coordinate is meaningless on the new page and produces a stray box/
        // divider line running through whatever content follows. checkBreak()
        // closes out the current page's segment and opens a new one whenever
        // ensureSpace() actually flipped to a new page.
        const segments = [];
        let segPage = page, segTopY = y;
        // `preY` is the y value on segPage right before the ensureSpace() call
        // that may have flipped to a new page — that's the segment's true
        // bottom edge. Using `y` itself here would read the NEW page's y
        // (set by newPage()) instead, corrupting the box height.
        function checkBreak(preY) {
            if (page !== segPage) {
                segments.push({ page: segPage, topY: segTopY, bottomY: preY });
                segPage = page;
                segTopY = y;
            }
        }

        if (hasHeader) {
            const headerLines = headers.map((h, i) => wrapText(bold, h, 7.5, colWidths[i] - cellPadX * 2));
            const headerMaxLines = Math.max(...headerLines.map(l => l.length));
            // headerH's tail after the LAST line is a small descender allowance
            // (headerLastTail), not a full extra headerLineH — using a whole line
            // height there left a big dead gap below single-line header cells.
            const headerPadTop = 10, headerPadBottom = 5, headerLineH = 9.5, headerLastTail = 3.5;
            const headerH = headerPadTop + Math.max(0, headerMaxLines - 1) * headerLineH + headerLastTail + headerPadBottom;
            const preHeaderY = y;
            ensureSpace(headerH);
            checkBreak(preHeaderY);
            const headerTopY = y;
            let hx = MARGIN;
            headerLines.forEach((lines, i) => {
                lines.forEach((line, li) => page.drawText(line, { x: hx + cellPadX, y: headerTopY - headerPadTop - li * headerLineH, size: 7.5, font: bold, color: rgb(0.02, 0.16, 0.29) }));
                hx += colWidths[i];
            });
            y = headerTopY - headerH;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: rgb(0.5, 0.5, 0.5) });
        }

        // Every row's text sits the same fixed distance (padTop) below its own
        // row's top border, and the same fixed distance (padBottom) above its
        // bottom border, regardless of how many lines that row wraps to — this
        // is what keeps the grid looking evenly spaced ("sekata") instead of
        // rows with more lines reading as cramped and short rows as bloated.
        // The tail after the LAST line is `lastTail` (a small descender
        // allowance), not a full extra `lineH` — reserving a whole line height
        // there was leaving a large dead gap below single-line cells.
        const padTop = 11, padBottom = 5, lineH = 11, lastTail = 4;
        rows.forEach(row => {
            const wrapped = row.map((cell, i) => wrapText(opts.boldFirstCol && i === 0 ? bold : font, String(cell || '—'), 8.5, colWidths[i] - cellPadX * 2));
            const maxLines = Math.max(...wrapped.map(w => w.length));
            const rowH = padTop + Math.max(0, maxLines - 1) * lineH + lastTail + padBottom;
            const preRowY = y;
            ensureSpace(rowH);
            checkBreak(preRowY);
            const rowTopY = y;
            let cx = MARGIN;
            wrapped.forEach((lines, i) => {
                lines.forEach((line, li) => page.drawText(line, { x: cx + cellPadX, y: rowTopY - padTop - li * lineH, size: 8.5, font: opts.boldFirstCol && i === 0 ? bold : font, color: rgb(0.08, 0.08, 0.08) }));
                cx += colWidths[i];
            });
            y = rowTopY - rowH;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.4, color: rgb(0.82, 0.82, 0.82) });
        });

        segments.push({ page: segPage, topY: segTopY, bottomY: y });

        // Outer + column borders, drawn once per page-segment the table
        // actually spans (see checkBreak() above).
        segments.forEach(seg => {
            seg.page.drawRectangle({ x: MARGIN, y: seg.bottomY, width: CONTENT_WIDTH, height: seg.topY - seg.bottomY, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.8 });
            let vx = MARGIN;
            colWidths.slice(0, -1).forEach(w => { vx += w; seg.page.drawLine({ start: { x: vx, y: seg.topY }, end: { x: vx, y: seg.bottomY }, thickness: 0.4, color: rgb(0.82, 0.82, 0.82) }); });
        });
        y -= 10;
    }

    async function drawSignatures(b) {
        const sides = [b.left, b.right].filter(Boolean);
        const boxWidth = sides.length === 2 ? CONTENT_WIDTH / 2 - 10 : CONTENT_WIDTH;
        const boxHeight = 110;
        ensureSpace(boxHeight + 10);
        const topY = y;
        for (let i = 0; i < sides.length; i++) {
            const s = sides[i];
            const x = MARGIN + i * (boxWidth + 20);
            page.drawRectangle({ x, y: topY - boxHeight, width: boxWidth, height: boxHeight, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 1 });
            wrapText(bold, s.title, 8, boxWidth - 12).forEach((line, li) => page.drawText(line, { x: x + 6, y: topY - 13 - li * 10, size: 8, font: bold, color: rgb(0.02, 0.16, 0.29) }));
            const sig = signatures ? signatures[s.sigRole] : null;
            if (sig && sig.dataUrl) {
                try {
                    const pngBytes = Uint8Array.from(atob(sig.dataUrl.split(',')[1]), c => c.charCodeAt(0));
                    const png = await pdfDoc.embedPng(pngBytes);
                    const scale = Math.min((boxWidth - 12) / png.width, 38 / png.height);
                    page.drawImage(png, { x: x + 6, y: topY - boxHeight + 56, width: png.width * scale, height: png.height * scale });
                } catch (e) { /* ignore malformed signature image */ }
            }
            const nameVal = (s.nameField && safeFields[s.nameField]) || (sig && sig.signedByName) || '';
            const posVal = s.positionField ? safeFields[s.positionField] : '';
            const dateVal = s.dateField ? safeFields[s.dateField] : (sig && sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('en-GB') : '');
            let ly = topY - boxHeight + 44;
            page.drawText(`Name / Nama: ${nameVal || '—'}`, { x: x + 6, y: ly, size: 7.5, font, color: rgb(0.2, 0.2, 0.2) }); ly -= 10;
            if (s.positionField) { page.drawText(`Position / Jawatan: ${posVal || '—'}`, { x: x + 6, y: ly, size: 7.5, font, color: rgb(0.2, 0.2, 0.2) }); ly -= 10; }
            if (s.dateField) { page.drawText(`Date / Tarikh: ${dateVal || '—'}`, { x: x + 6, y: ly, size: 7.5, font, color: rgb(0.2, 0.2, 0.2) }); ly -= 10; }
            if (s.stampField) page.drawText(`Stamp / Cop: ${safeFields[s.stampField] || '—'}`, { x: x + 6, y: ly, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
        }
        y = topY - boxHeight - 16;
    }

    async function drawBlock(b) {
        if (b.t === 'title') {
            ensureSpace(56);
            if (logoImage) {
                const logoH = 34;
                const logoW = logoImage.width * (logoH / logoImage.height);
                page.drawImage(logoImage, { x: MARGIN, y: y - logoH + 6, width: logoW, height: logoH });
                y -= logoH + 4;
            }
            const enSize = 14.5;
            const enW = bold.widthOfTextAtSize(b.en, enSize);
            page.drawText(b.en, { x: (PAGE_WIDTH - enW) / 2, y, size: enSize, font: bold, color: rgb(0.02, 0.16, 0.29) });
            y -= 18;
            const msSize = 10.5;
            const msW = italic.widthOfTextAtSize(b.ms, msSize);
            page.drawText(b.ms, { x: (PAGE_WIDTH - msW) / 2, y, size: msSize, font: italic, color: rgb(0.35, 0.35, 0.35) });
            y -= 12;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.2, color: rgb(0.02, 0.16, 0.29) });
            y -= 18;
        } else if (b.t === 'heading') {
            const headingLines = wrapText(bold, sub(b.text), 10.5, CONTENT_WIDTH);
            ensureSpace(24 + (headingLines.length - 1) * 13);
            y -= 4;
            headingLines.forEach((line, li) => {
                page.drawText(line, { x: MARGIN, y: y - li * 13, size: 10.5, font: bold, color: rgb(0.02, 0.16, 0.29) });
            });
            y -= headingLines.length * 13 + 1;
            page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.82, 0.82, 0.82) });
            y -= 13;
        } else if (b.t === 'boldpara') {
            drawWrapped(sub(b.text), { size: 9.5, f: bold, lh: 12 });
            y -= 5;
        } else if (b.t === 'para') {
            const f = b.italic ? italic : font;
            const size = b.small ? 7.8 : 9.5;
            drawWrapped(sub(b.text), { size, f, lh: size + 3, color: b.small ? rgb(0.35, 0.35, 0.35) : undefined });
            y -= 5;
        } else if (b.t === 'bullets') {
            const bf = b.italic ? italic : font;
            const bColor = b.italic ? rgb(0.35, 0.35, 0.35) : rgb(0.08, 0.08, 0.08);
            b.items.forEach(item => {
                const lines = wrapText(bf, sub(item), 9, CONTENT_WIDTH - 14);
                ensureSpace(lines.length * 11.5 + 2);
                lines.forEach((line, i) => {
                    if (i === 0) page.drawText('•', { x: MARGIN, y, size: 9, font: bf, color: bColor });
                    page.drawText(line, { x: MARGIN + 13, y, size: 9, font: bf, color: bColor });
                    y -= 11.5;
                });
            });
            y -= 4;
        } else if (b.t === 'spacer') {
            y -= 8;
        } else if (b.t === 'tworef') {
            ensureSpace(30);
            const colW = CONTENT_WIDTH / 2;
            b.items.forEach(([label], i) => page.drawText(label, { x: MARGIN + i * colW, y, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) }));
            y -= 11;
            b.items.forEach(([, tmpl], i) => page.drawText(sub(tmpl), { x: MARGIN + i * colW, y, size: 9.5, font, color: rgb(0.08, 0.08, 0.08) }));
            y -= 15;
        } else if (b.t === 'table2') {
            drawGridTable(['', ''], b.rows.map(r => [r[0], sub(r[1])]), [0.4, 0.6], { noHeader: true, boldFirstCol: true });
        } else if (b.t === 'table3') {
            drawGridTable(b.headers, b.rows.map(r => r.map((c, i) => i === 0 ? c : sub(c))), [0.3, 0.35, 0.35], { boldFirstCol: true });
        } else if (b.t === 'table4') {
            drawGridTable(b.headers, b.rows.map(r => r.map((c, i) => (i === 0 || c === '') ? c : sub(c))), [0.13, 0.35, 0.17, 0.35], {});
        } else if (b.t === 'checkboxGroup') {
            const field = tpl.fieldConfig.find(f => f.id === b.fieldId);
            if (field) {
                const headerLines = wrapText(bold, `${field.label.en} / ${field.label.ms}`, 8, CONTENT_WIDTH);
                ensureSpace(headerLines.length * 10.5 + 3);
                headerLines.forEach((line, li) => {
                    page.drawText(line, { x: MARGIN, y: y - li * 10.5, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
                });
                y -= headerLines.length * 10.5 + 1;
                const text = field.type === 'checkbox'
                    ? `${safeFields[b.fieldId] ? '[X]' : '[ ]'} ${field.label.en}`
                    : (field.options || []).map(o => `${(safeFields[b.fieldId] || []).includes(o) ? '[X]' : '[ ]'} ${o}`).join('   ');
                drawWrapped(text, { size: 9, lh: 11.5 });
                y -= 10;
            }
        } else if (b.t === 'signatures2') {
            await drawSignatures(b);
        }
    }

    drawRunningHeader();
    if (meta && meta.referenceNo) {
        page.drawText(`Reference: ${meta.referenceNo}`, { x: MARGIN, y, size: 8, font: italic, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
    }
    for (const b of tpl.pdfBlocks) {
        await drawBlock(b);
    }

    return pdfDoc.save();
}

// ---------------------------------------------------------------
// COORDINATE-OVERLAY RENDERER — for templates that carry a real master
// PDF file (Firebase Storage) plus a `fieldMap`/`signatureBoxes` (see
// authorization_letter above). Unlike buildPdfForDocument (which draws an
// entirely new PDF from the pdfBlocks flow), this LOADS the actual master
// PDF bytes and draws each field's value directly at its measured
// coordinates — the generated PDF is the real master file with values
// overlaid, not a re-creation. templateId must resolve to a template with
// a non-empty fieldMap; other templates keep using buildPdfForDocument.
// ---------------------------------------------------------------
export async function buildOverlayPdfForDocument(templateId, fields, signatures, masterPdfBytes) {
    const { PDFDocument, StandardFonts } = PDFLib;
    const tpl = DOCUMENT_TEMPLATES[templateId];
    if (!tpl || !tpl.fieldMap) throw new Error('This template does not use the coordinate-overlay renderer.');
    const safeFields = fields || {};

    const pdfDoc = await PDFDocument.load(masterPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const pages = pdfDoc.getPages();

    tpl.fieldMap.forEach(f => {
        const page = pages[f.page];
        if (!page) return;
        const raw = safeFields[f.id];
        const value = raw === undefined || raw === null ? '' : String(raw);
        if (!value) return;
        if (f.multiline) {
            const lines = wrapText(font, value, f.fontSize, f.width);
            const lineHeight = f.fontSize * 1.15;
            let ly = f.y;
            for (const line of lines) {
                if (f.y - ly >= f.height) break; // don't draw past this field's box into the next one
                page.drawText(line, { x: f.x, y: ly, size: f.fontSize, font });
                ly -= lineHeight;
            }
        } else {
            page.drawText(value, { x: f.x, y: f.y, size: f.fontSize, font });
        }
    });

    if (tpl.signatureBoxes && signatures) {
        for (const [role, box] of Object.entries(tpl.signatureBoxes)) {
            const sig = signatures[role];
            if (!sig || !sig.dataUrl) continue;
            const page = pages[box.page];
            if (!page) continue;
            const pngBytes = Uint8Array.from(atob(sig.dataUrl.split(',')[1]), c => c.charCodeAt(0));
            const png = await pdfDoc.embedPng(pngBytes);
            const scale = Math.min(box.width / png.width, box.height / png.height);
            const w = png.width * scale;
            const h = png.height * scale;
            page.drawImage(png, { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h });
        }
    }

    return pdfDoc.save();
}
