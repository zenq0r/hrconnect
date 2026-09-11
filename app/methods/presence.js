// Who is online. Presence is anchored to a person's Staff ID / Client ID by
// email, and mirrored to the records that display it.
import {
    db,
    auth,
    collection,
    doc,
    setDoc,
    updateDoc,
    getDocs,
    writeBatch,
    query,
    where
} from "../../firebase-config.js";
export const presenceMethods = {
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
        }
};