// Company-wide notice board. Director/Superadmin/HR post and archive;
// every other internal role reads Active notices only (Client accounts never
// reach this collection at all — see the announcements rule in
// firestore.rules). Modelled on duty-roster.js's Draft/Published shape:
// one collection, a status field, and a client-side ordering rather than a
// server-side query, since the list is small enough that streaming the
// whole thing is simpler than paginating it.
import {
    db,
    collection,
    doc,
    setDoc,
    deleteDoc
} from "../../firebase-config.js";

const PRIORITY_ORDER = { Urgent: 0, Important: 1, Normal: 2 };

export const announcementMethods = {

        announcementPriorityMeta(priority) {
            const map = {
                Urgent: { label: 'Urgent', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300', barClass: 'bg-red-500' },
                Important: { label: 'Important', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', barClass: 'bg-amber-500' },
                Normal: { label: 'Normal', badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200', barClass: 'bg-slate-400' }
            };
            return map[priority] || map.Normal;
        },
        // Urgent first, then Important, then Normal; newest within each tier —
        // so a single Urgent notice from this morning always outranks ten
        // routine ones from last week.
        sortedAnnouncements(list) {
            return [...list].sort((a, b) => {
                const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
                if (priorityDiff !== 0) return priorityDiff;
                return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
            });
        },
        // The board's own list: managers can flip announcementFilter to review
        // Archived notices, everyone else only ever has Active ones to look at
        // (firestore.rules never sends them anything else).
        visibleAnnouncements() {
            const filter = this.canManageAnnouncements ? this.announcementFilter : 'Active';
            return this.sortedAnnouncements(this.announcements.filter(a => a.status === filter));
        },
        // Dashboard widget: top few Active notices, for everyone, regardless of
        // the board's own Active/Archived filter.
        latestAnnouncements(limit = 3) {
            return this.sortedAnnouncements(this.announcements.filter(a => a.status === 'Active')).slice(0, limit);
        },
        openAnnouncementModal(item = null) {
            if (!this.canManageAnnouncements) { this.showNotify('Only Director, Superadmin and HR can post an announcement.'); return; }
            this.announcementModal = {
                show: true,
                isEdit: Boolean(item),
                id: item?.id || '',
                form: item
                    ? { title: item.title, message: item.message, priority: item.priority }
                    : { title: '', message: '', priority: 'Normal' }
            };
        },
        async saveAnnouncement() {
            if (!this.canManageAnnouncements) { this.showNotify('Only Director, Superadmin and HR can post an announcement.'); return; }
            const { isEdit, id, form } = this.announcementModal;
            const title = form.title.trim();
            const message = form.message.trim();
            if (!title || !message) { this.showNotify('Complete the title and message.'); return; }
            const nowIso = new Date().toISOString();
            try {
                if (isEdit) {
                    const existing = this.announcements.find(a => a.id === id);
                    await setDoc(doc(db, 'announcements', id), {
                        title, message, priority: form.priority,
                        status: existing?.status || 'Active',
                        createdByUid: existing?.createdByUid, createdByName: existing?.createdByName, createdByEmail: existing?.createdByEmail, createdAt: existing?.createdAt,
                        lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: nowIso
                    });
                    this.logAudit('UPDATE', `Edited announcement "${title}"`);
                    this.showNotify('Announcement updated.');
                } else {
                    const ref = doc(collection(db, 'announcements'));
                    await setDoc(ref, {
                        title, message, priority: form.priority, status: 'Active',
                        createdByUid: this.userProfile.uid, createdByName: this.userProfile.name, createdByEmail: this.userProfile.email, createdAt: nowIso,
                        lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: nowIso
                    });
                    this.logAudit('CREATE', `Posted announcement "${title}"`);
                    this.showNotify('Announcement posted.');
                    this.notifyStaffOfNewAnnouncement({ title, message, priority: form.priority });
                }
                this.announcementModal.show = false;
            } catch (error) {
                console.error('Save announcement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'save this announcement'));
            }
        },
        async archiveAnnouncement(item) {
            if (!this.canManageAnnouncements) { this.showNotify('Only Director, Superadmin and HR can archive an announcement.'); return; }
            try {
                await setDoc(doc(db, 'announcements', item.id), {
                    ...item, status: 'Archived',
                    lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: new Date().toISOString()
                });
                this.logAudit('UPDATE', `Archived announcement "${item.title}"`);
                this.showNotify('Announcement archived.');
            } catch (error) {
                console.error('Archive announcement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'archive this announcement'));
            }
        },
        async restoreAnnouncement(item) {
            if (!this.canManageAnnouncements) { this.showNotify('Only Director, Superadmin and HR can restore an announcement.'); return; }
            try {
                await setDoc(doc(db, 'announcements', item.id), {
                    ...item, status: 'Active',
                    lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: new Date().toISOString()
                });
                this.logAudit('UPDATE', `Restored announcement "${item.title}"`);
                this.showNotify('Announcement restored.');
            } catch (error) {
                console.error('Restore announcement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'restore this announcement'));
            }
        },
        async deleteAnnouncement(item) {
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete an announcement.'); return; }
            if (!await this.askConfirm({
                title: 'Delete this announcement?',
                message: `"${item.title}" will be permanently removed for everyone.`,
                confirmLabel: 'Yes, Delete'
            })) return;
            try {
                await deleteDoc(doc(db, 'announcements', item.id));
                this.logAudit('DELETE', `Deleted announcement "${item.title}"`);
                this.showNotify('Announcement deleted.');
            } catch (error) {
                console.error('Delete announcement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete this announcement'));
            }
        },
        // Fire-and-forget, same as duty-roster.js's notifyAssignedStaffOfPublishedRoster
        // — reuses the existing /api/notify endpoint, so posting an announcement
        // needs no new API route. this.users (every non-Client portal account) is
        // already loaded for every internal role — see canReadUserDirectory in
        // realtime.js — so this does not depend on who happens to be HR vs Staff.
        notifyStaffOfNewAnnouncement({ title, message, priority }) {
            const emails = this.users.filter(u => u.role !== 'Client' && u.email && u.id !== this.userProfile.uid).map(u => u.email);
            if (!emails.length) return;
            this.notifyByEmail({
                to: emails,
                subject: `[${priority} Announcement] ${title}`,
                heading: title,
                message,
                ctaLabel: 'View Announcements'
            });
        }
};
