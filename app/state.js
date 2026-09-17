// Every reactive field the portal starts with. One call per app instance, so
// a signed-out session can be reset simply by rebuilding this object.
import { SUPPORT_EMAIL, createEmailActionFlow, createLoginOtpState, SIDEBAR_GROUPS_STORAGE_KEY } from "./config.js";

function readSidebarGroupsCollapsed() {
    try {
        const raw = localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        // Private browsing, or storage disabled entirely — every group opens expanded.
        return {};
    }
}

export function createInitialState() {
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
            loginOtp: createLoginOtpState(),
            loginOtpCooldownTimer: null,
            pendingLoginContext: null,
            currentTab: 'dashboard',
            // Screens whose markup has been fetched and mounted. A screen stays
            // mounted once it has been opened, so a half-filled form survives a
            // trip to another tab exactly as it did when every screen was in
            // index.html. See app/views.js.
            mountedViews: [],
            viewLoading: false,
            viewError: '',
            // Whether app/portal.js has been fetched and its methods attached.
            // Stays true for the life of the page: signing out does not unload
            // code, and a second sign-in has nothing left to fetch.
            portalCodeLoaded: false,
            mobileMenuOpen: false,
            // The navigation stays hidden until the user opens it deliberately
            // from the single menu control, on desktop as well as on mobile.
            desktopSidebarOpen: false,
            // Which sidebar groups a user has collapsed, keyed by group id
            // ('ops' | 'billing' | 'admin'). Read once at boot from
            // localStorage (see toggleSidebarGroup) so the preference survives
            // a reload; absent = expanded.
            sidebarGroupsCollapsed: readSidebarGroupsCollapsed(),
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
            attachmentUploadState: { receipt: false, director: false },
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
            // Per-project listeners for staff outside the full-access pair; see
            // syncProjectClientUpdateListeners() in app/methods/realtime.js.
            projectClientUpdateListeners: [],
            projectClientUpdateListenerKey: null,
            // uid -> why that account was locked, for administrators only.
            accessLockReasons: {},
            projectClientUpdatesLoaded: false,
            activityTypes: ['To-Do', 'Document Request', 'Client Follow-Up', 'Government Submission', 'Review', 'Meeting', 'Payment Follow-Up', 'Other'],
            activityModal: { show: false, isEdit: false, activityId: '', project: null, form: { activityType: 'To-Do', summary: '', dueDate: '', assignedEmpNo: '', assignedName: '', assignedEmail: '', assignedPosition: '', details: '' } },
            clientUpdateTypes: ['Progress Update', 'Document Update', 'Government Update', 'Client Action Required', 'Milestone Completed', 'General Notice'],
            clientUpdateModal: { show: false, isEdit: false, updateId: '', original: null, project: null, form: { updateType: 'Progress Update', updateDate: '', message: '' } },
            clientReplyMessage: '',
            clientPanel: 'ov',
            // A manual bank transfer's full proof, collected together in one
            // required form rather than a bare file picker with no context: which
            // bank the client paid from, whose account it was paid from, when and
            // how much, the transfer reference, and the receipt itself. `doc` is
            // the invoice being proven; nulled out whenever the modal is closed so
            // a stale submission can't be reused.
            paymentProofModal: { show: false, doc: null, bankName: '', accountType: '', accountHolderName: '', paymentDate: '', amount: '', refNo: '', file: null, fileName: '', uploading: false, error: '' },
            bulkPrintPreparing: false,
            editingReplyId: '',
            editingReplyMessage: '',
            projectViewMode: 'board',
            projectScopeFilter: 'all',
            clientPortalFilter: { type: 'all', status: 'all' },
            clientEscalationMessage: '',
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
            clientDocuments: { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '', pendingExpiryDate: '' },
            trustedDevices: { items: [], loading: false, error: '', loaded: false },
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
                refGenerating: false,
                form: { id: '', projectType: '', projectRef: '', title: '', clientDirectoryId: '', clientPortalUid: '', clientName: '', clientEmail: '', clientSSM: '', clientTier: 'Standard', ownerEmpNo: '', ownerName: '', ownerEmail: '', ownerPhoto: '', ownerPosition: '', ownerDepartment: '', ownerAssignedAt: '', ownerPresenceStatus: 'Offline', ownerPresenceUpdatedAt: '', ownerLastSeen: '', status: 'Project Planning', startDate: '', targetDate: '', description: '', govState: '', govPbt: '', govApplicationType: '' }
            },
            // confirmStep: null (picker) -> 'handover' or 'complete' (confirmation sub-view)
            markProjectDoneModal: { show: false, project: null, newOwnerEmpNo: '', confirmStep: null, saving: false },
            employees: [],
            attendanceRecords: [],
            attendanceSelectedDate: new Date().toISOString().slice(0, 10),
            dutyRosterWeeks: [],
            dutyRosterWeekOffset: 0,
            dutyRosterModal: {
                show: false,
                isEdit: false,
                weekKey: '',
                shiftId: '',
                form: { label: 'Pagi', date: '', startTime: '08:00', endTime: '17:00' }
            },
            attendanceCorrectionModal: { show: false, record: null, clockInInput: '', clockOutInput: '', status: 'Clocked In', correctionNote: '' },
            leaveRequests: [],
            selectedLeaveEmployeeId: '',
            editingLeaveId: null,
            leaveForm: { id: '', empNo: '', name: '', empEmail: '', position: '', dept: '', leaveType: 'Annual', startDate: '', endDate: '', totalDays: 1, reason: '' },
            leaveCorrectionModal: { show: false, record: null, correctionNote: '' },
            customers: [],
            users: [],
            auditLogs: [],
            auditRetention: { value: 30, unit: 'day', loading: false, saving: false, message: '', error: '' },

            editingDocId: null,
            clientSavedForDocument: false,
            // The Assign list is grouped by project stage and hides finished
            // projects, because a client with two years of history has more
            // closed projects than open ones and the open ones are what a new
            // quotation is for. A closed project stays selectable through this
            // toggle rather than being unreachable.
            documentProjectShowClosed: false,
            // Loaded on demand, per document, rather than subscribed: a
            // timeline is read when someone asks for one, and there is no
            // reason for every session to stream the whole collection.
            billingTimelineModal: { show: false, loading: false, error: '', document: null, entries: [] },
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
            allowedStaffDomains: ['zenqor.com.my'],
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

            leaveTypes: ['Annual', 'Medical', 'Emergency', 'Unpaid', 'Maternity', 'Paternity'],
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
                dedEpf: 0, dedSocso: 0, dedSkbbk: 0, dedEis: 0, dedPcb: 0, dedAdvance: 0, dedOther: 0,
                skbbkOptedOut: false, statutoryOverride: false, statutoryOverrideReason: ''
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

            payCalc: { gross: 0, deduct: 0, net: 0, epfEmpr: 0, socsoEmpr: 0, eisEmpr: 0, skbbkTableCovers: true }
        };
    }