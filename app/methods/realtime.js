// The Firestore subscriptions that keep the portal live, scoped by role.
import {
    db,
    collection,
    doc,
    onSnapshot,
    query,
    where
} from "../../firebase-config.js";
import { FULL_ACCESS_ROLES } from "../constants/rbac.js";
export const realtimeMethods = {

        // Staff outside the full-access pair read a client's conversation only for
        // the projects they work on (staffWorksOnProject() in firestore.rules). A
        // listener has to stay inside what the rules allow, so these follow
        // this.projects: one query per 30 project ids (Firestore's limit for
        // 'in'), rebuilt only when that set of ids changes.
        syncProjectClientUpdateListeners() {
            if (this.userProfile.role === 'Client' || this.canManageProjects) return;
            const ids = [...new Set(this.projects.map(project => String(project.id || '')).filter(Boolean))].sort();
            const key = ids.join('|');
            if (this.projectClientUpdateListeners && key === this.projectClientUpdateListenerKey) return;
            this.stopProjectClientUpdateListeners();
            this.projectClientUpdateListenerKey = key;
            const buckets = new Map();
            const publish = () => {
                const merged = new Map();
                buckets.forEach(list => list.forEach(update => merged.set(update.id, update)));
                this.projectClientUpdates = [...merged.values()];
                this.projectClientUpdatesLoaded = true;
            };
            if (!ids.length) { publish(); return; }
            for (let start = 0; start < ids.length; start += 30) {
                const source = query(collection(db, 'project_client_updates'), where('projectId', 'in', ids.slice(start, start + 30)));
                this.projectClientUpdateListeners.push(onSnapshot(source, (snapshot) => {
                    buckets.set(start, snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                    publish();
                }, (error) => console.error('Unable to load Client activity history:', error)));
            }
        },
        stopProjectClientUpdateListeners() {
            (this.projectClientUpdateListeners || []).forEach(unsubscribe => unsubscribe());
            this.projectClientUpdateListeners = [];
            this.projectClientUpdateListenerKey = null;
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
            // Staff and IT follow their own records; see isSelfServiceEmployee() in
            // firestore.rules.
            const isSelfService = ['Staff', 'IT'].includes(role);
            const payslipsSource = canReadAllPayslips
                ? collection(db, 'payslips')
                : isSelfService
                    ? query(collection(db, 'payslips'), where('raw.empEmail', '==', this.userProfile.email))
                    : null;
            const claimsSource = canReadAllClaims
                ? collection(db, 'claims')
                : isSelfService
                    ? query(collection(db, 'claims'), where('empEmail', '==', this.userProfile.email))
                    : null;
            const vouchersSource = canReadAllClaims
                ? collection(db, 'payment_vouchers')
                : isSelfService
                    ? query(collection(db, 'payment_vouchers'), where('empEmail', '==', this.userProfile.email))
                    : null;
            const employeesSource = canReadAllEmployees
                ? collection(db, 'employees')
                : ['Staff', 'IT'].includes(role)
                    ? query(collection(db, 'employees'), where('email', '==', this.userProfile.email))
                    : null;
            // Must mirror the attendance read rule in firestore.rules: HR/Account
            // join Superadmin/Director in reading every record; every other
            // internal role (Staff, IT) reads only its own clock events. Client
            // has no attendance module at all, hence the role !== 'Client' guard.
            const canReadAllAttendance = ['Superadmin', 'Director', 'HR', 'Account'].includes(role);
            const attendanceSource = canReadAllAttendance
                ? collection(db, 'attendance')
                : role !== 'Client'
                    ? query(collection(db, 'attendance'), where('empEmail', '==', this.userProfile.email))
                    : null;
            // Duty roster rules already narrow a Draft week to HR/Admin/Account —
            // every other internal role only ever receives Published weeks back
            // from this same unfiltered collection() listener.
            const dutyRosterSource = role !== 'Client' ? collection(db, 'duty_roster') : null;
            // Leave is single-stage (HR decides), so unlike claims/vouchers,
            // Account is not part of the review chain and reads only its own
            // requests here — matching the leave_requests read rule exactly.
            const canReadAllLeaveRequests = ['Superadmin', 'Director', 'HR'].includes(role);
            const leaveRequestsSource = canReadAllLeaveRequests
                ? collection(db, 'leave_requests')
                : role !== 'Client'
                    ? query(collection(db, 'leave_requests'), where('empEmail', '==', this.userProfile.email))
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
                : this.canManageProjects
                    ? [collection(db, 'project_client_updates')]
                    // Everyone else reads a conversation only for a project they
                    // work on; those listeners follow this.projects, see
                    // syncProjectClientUpdateListeners().
                    : null;
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
                attendanceSource
                    ? subscribeWithReadySignal(attendanceSource, (snapshot) => { this.attendanceRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'attendance')
                    : Promise.resolve(),
                dutyRosterSource
                    ? subscribeWithReadySignal(dutyRosterSource, (snapshot) => { this.dutyRosterWeeks = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'duty roster')
                    : Promise.resolve(),
                leaveRequestsSource
                    ? subscribeWithReadySignal(leaveRequestsSource, (snapshot) => { this.leaveRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); }, 'leave requests')
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
                    this.syncProjectClientUpdateListeners();
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
                projectClientUpdatesSources ? subscribeMergedWithReadySignal(projectClientUpdatesSources, (merged) => {
                    const previousIds = new Set(this.projectClientUpdates.map(update => update.id));
                    this.projectClientUpdates = merged;
                    if (this.projectClientUpdatesLoaded && role === 'Client') {
                        const newUpdate = this.projectClientUpdates.find(update => !previousIds.has(update.id));
                        if (newUpdate) this.showNotify(`New project update received: ${newUpdate.projectRef}`);
                    }
                    this.projectClientUpdatesLoaded = true;
                }, 'Client activity history') : Promise.resolve(),
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
                // Why each locked account was locked, for the administrators who
                // lock them. Nobody else can read access_locks.
                FULL_ACCESS_ROLES.includes(role)
                    ? subscribeWithReadySignal(collection(db, 'access_locks'), (snapshot) => {
                        this.accessLockReasons = Object.fromEntries(snapshot.docs.map(d => [d.id, d.data().reason || '']));
                    }, 'access lock reasons')
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
    
};