// Staff and client directories, the notification feed and the release notes
// shown in Settings.
import { APP_CHANGELOG } from "../config.js";
import { canonicalClientTier, CLIENT_TIER_ORDER } from "../constants/client-tiers.js";
export const directoryComputed = {
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
        priorityClients() { return this.customers.filter(c => canonicalClientTier(c.clientTier) === 'Priority'); },
        // The dashboard widget's own name — Priority sorts ahead of Premium,
        // the same order CLIENT_TIER_ORDER already ranks them in everywhere
        // else this codebase compares tiers.
        premiumAndPriorityClients() {
            return this.customers
                .filter(c => ['Premium', 'Priority'].includes(canonicalClientTier(c.clientTier)))
                .sort((a, b) => CLIENT_TIER_ORDER.indexOf(canonicalClientTier(b.clientTier)) - CLIENT_TIER_ORDER.indexOf(canonicalClientTier(a.clientTier)));
        },
        // The Client Directory table's own list — the global search box's
        // placeholder has always promised "Documents, Employees, TIN, ID...",
        // but nothing wired it to this table until now.
        filteredCustomers() {
            if (!this.searchQuery) return this.customers;
            const q = this.searchQuery.toLowerCase();
            return this.customers.filter(c => [c.clientName, c.clientId, c.clientSSM, c.clientContactPerson, c.clientEmail, c.clientPhone]
                .some(field => String(field || '').toLowerCase().includes(q)));
        },
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
        legacyPaymentVouchersCount() { return this.claimsHistory.filter(c => (c.documentType || c.type) === 'Payment Voucher').length; }
};