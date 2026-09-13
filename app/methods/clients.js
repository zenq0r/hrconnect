// Client Directory and Client Task: the client information record, the client
// drawer, tier changes and the task list each client board is built from.
import {
    db,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    deleteField,
    writeBatch
} from "../../firebase-config.js";
import { canonicalClientTier } from "../constants/client-tiers.js";
export const clientMethods = {
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
                companyType: record.companyType || '', industry: record.industry || '', clientTier: canonicalClientTier(record.clientTier),
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
                const clientEmail = String(form.clientEmail || '').trim().toLowerCase();
                const additionalClientEmails = [...new Set(String(form.additionalClientEmailsText || '')
                    .split(',').map(email => email.trim().toLowerCase()).filter(email => email && email.includes('@')))]
                    .filter(email => email !== clientEmail);
                const registeredEmails = new Set([
                    clientEmail,
                    ...additionalClientEmails
                ].filter(Boolean));
                const conflictingCustomer = this.customers.find(customer => {
                    if (customer.id === docId) return false;
                    const customerEmails = [
                        customer.clientEmail,
                        ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])
                    ].map(email => String(email || '').trim().toLowerCase());
                    return customerEmails.some(email => registeredEmails.has(email));
                });
                if (conflictingCustomer) {
                    const conflictingEmail = [
                        conflictingCustomer.clientEmail,
                        ...(Array.isArray(conflictingCustomer.additionalClientEmails) ? conflictingCustomer.additionalClientEmails : [])
                    ].map(email => String(email || '').trim().toLowerCase()).find(email => registeredEmails.has(email));
                    this.showNotify(`Email ${conflictingEmail} is already registered to Client Directory record "${conflictingCustomer.clientName || conflictingCustomer.id}". Keep each client login email on one record only.`);
                    return false;
                }
                const composedSSM = this.composeClientSSM(form.clientBrnNew, form.clientBrnOld);
                // Client ID is derived from the BRN, so it must read the composed
                // value rather than the now-unbound clientSSM field.
                const clientId = existingCust?.clientId || form.clientId || this.generateClientId(composedSSM);
                const now = new Date().toISOString();
                const clientTier = canonicalClientTier(form.clientTier || existingCust?.clientTier);
                const clientRecord = this.normalizeOfficialRecord({
                    clientId,
                    clientName: String(form.clientName).trim(),
                    clientSSM: this.composeClientSSM(form.clientBrnNew, form.clientBrnOld),
                    clientBrnNew: String(form.clientBrnNew || '').replace(/\s/g, ''),
                    clientBrnOld: String(form.clientBrnOld || '').replace(/\s/g, '').toUpperCase(),
                    clientTin: this.normalizeTin(form.clientTin),
                    companyType: String(form.companyType || '').trim(), industry: String(form.industry || '').trim(), clientTier,
                    clientContactPerson: String(form.clientContactPerson || '').trim(), clientPosition: String(form.clientPosition || '').trim(),
                    clientEmail, clientPhone: String(form.clientPhone || '').trim(),
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
            return map[canonicalClientTier(tier)] || map.Standard;
        },
        clientTierForId(clientDirectoryId, fallbackTier = 'Standard') {
            const customer = this.customers.find(c => c.id === clientDirectoryId);
            return canonicalClientTier(customer?.clientTier || fallbackTier);
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
            if (!this.canCreateClientTask) { this.showNotify('Only Director and Superadmin may create a new Client Task.'); return; }
            this.clientTaskModal = { show: true, clientDirectoryId: '', saving: false };
        },
        closeClientTaskModal() {
            this.clientTaskModal.show = false;
        },
        // A Client Directory record stays separate from a Client Task. The task
        // becomes mandatory once a project exists; creating a directory record
        // alone still does not add an empty task to the board.
        async addClientToTask(cust) {
            if (!this.canCreateClientTask) { this.showNotify('Only Director and Superadmin may create a new Client Task.'); return false; }
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
            if (!this.canCreateClientTask) { this.showNotify('Only Director and Superadmin may create a new Client Task.'); return; }
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
        }
};