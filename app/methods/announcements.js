// Company-wide notice board. Director/Superadmin/HR post and archive;
// every other internal role reads Active notices only (Client accounts never
// reach this collection at all — see the announcements rule in
// firestore.rules). Modelled on duty-roster.js's Draft/Published shape:
// one collection, a status field, and a client-side ordering rather than a
// server-side query, since the list is small enough that streaming the
// whole thing is simpler than paginating it.
import {
    db,
    storage,
    collection,
    doc,
    setDoc,
    deleteDoc,
    writeBatch,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "../../firebase-config.js";

const PRIORITY_ORDER = { Urgent: 0, Important: 1, Normal: 2 };

// Extension -> content type, and back to a human icon/label. Must mirror the
// announcement_attachments write rule in storage.rules exactly, or a file
// this map accepts would still be refused at the Storage boundary.
const ATTACHMENT_TYPES = {
    png: { contentType: 'image/png', icon: 'fa-file-image', label: 'Image' },
    jpg: { contentType: 'image/jpeg', icon: 'fa-file-image', label: 'Image' },
    jpeg: { contentType: 'image/jpeg', icon: 'fa-file-image', label: 'Image' },
    gif: { contentType: 'image/gif', icon: 'fa-file-image', label: 'Image' },
    webp: { contentType: 'image/webp', icon: 'fa-file-image', label: 'Image' },
    pdf: { contentType: 'application/pdf', icon: 'fa-file-pdf', label: 'PDF' },
    mp4: { contentType: 'video/mp4', icon: 'fa-file-video', label: 'Video' },
    docx: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', icon: 'fa-file-word', label: 'Word' },
    xlsx: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', icon: 'fa-file-excel', label: 'Excel' },
    pptx: { contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', icon: 'fa-file-powerpoint', label: 'PowerPoint' }
};
const MAX_ATTACHMENT_BYTES = { 'image': 10, 'application/pdf': 15, 'video/mp4': 40, 'office': 15 };
function attachmentSizeLimitBytes(contentType) {
    const key = contentType.startsWith('image/') ? 'image' : contentType.startsWith('application/vnd.openxmlformats') ? 'office' : contentType;
    return (MAX_ATTACHMENT_BYTES[key] || 10) * 1024 * 1024;
}

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
        // A date-only compare (both sides are YYYY-MM-DD, or expiresAt is
        // empty/unset) — never on the clock, so an announcement stays up for
        // the whole of its expiry date rather than disappearing mid-morning.
        isAnnouncementExpired(item) {
            return Boolean(item?.expiresAt) && item.expiresAt < this.getLocalDateKey();
        },
        // The board's own list: managers can flip announcementFilter to review
        // Archived notices, everyone else only ever has Active ones to look at
        // (firestore.rules never sends them anything else). An expired-but-
        // still-Active item (the brief window before autoArchiveExpiredAnnouncements()
        // commits) is treated as already Archived here too, so nobody sees a
        // stale notice flash before the write lands.
        visibleAnnouncements() {
            const filter = this.canManageAnnouncements ? this.announcementFilter : 'Active';
            return this.sortedAnnouncements(this.announcements.filter(a => {
                const effectiveStatus = a.status === 'Active' && this.isAnnouncementExpired(a) ? 'Archived' : a.status;
                return effectiveStatus === filter;
            }));
        },
        // Dashboard widget: top few Active notices, for everyone, regardless of
        // the board's own Active/Archived filter.
        latestAnnouncements(limit = 3) {
            return this.sortedAnnouncements(this.announcements.filter(a => a.status === 'Active' && !this.isAnnouncementExpired(a))).slice(0, limit);
        },
        // Director/Superadmin/HR-only housekeeping, opportunistic rather than
        // scheduled: this static site has no cron, so whichever manager's
        // session next loads the collection is the one that notices an expiry
        // date has passed and flips status to Archived — the same shape as
        // ensureClientTasksForExistingProjects()/repairLegacyProjectClientLinks()
        // in clients.js. The write itself is an ordinary archive, already
        // covered by the announcements update rule; this only decides when to
        // fire it. Guarded against re-entry while a previous pass is still
        // committing, exactly like those two functions guard themselves.
        async autoArchiveExpiredAnnouncements() {
            if (!this.canManageAnnouncements || this.announcementAutoArchiveRunning) return;
            const due = this.announcements.filter(a => a.status === 'Active' && this.isAnnouncementExpired(a));
            if (!due.length) return;
            this.announcementAutoArchiveRunning = true;
            try {
                const nowIso = new Date().toISOString();
                const batch = writeBatch(db);
                due.forEach(item => batch.set(doc(db, 'announcements', item.id), {
                    ...item, status: 'Archived',
                    lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: nowIso
                }));
                await batch.commit();
                due.forEach(item => this.logAudit('UPDATE', `Auto-archived expired announcement "${item.title}" (expired ${item.expiresAt})`));
            } catch (error) {
                console.warn('Auto-archiving expired announcements failed (non-fatal, will retry next load):', error);
            } finally {
                this.announcementAutoArchiveRunning = false;
            }
        },
        openAnnouncementModal(item = null) {
            if (!this.canManageAnnouncements) { this.showNotify('Only Director, Superadmin and HR can post an announcement.'); return; }
            this.announcementModal = {
                show: true,
                isEdit: Boolean(item),
                id: item?.id || '',
                uploading: false,
                form: item
                    ? { title: item.title, message: item.message, priority: item.priority, attachments: [...(item.attachments || [])], expiresAt: item.expiresAt || '' }
                    : { title: '', message: '', priority: 'Normal', attachments: [], expiresAt: '' }
            };
        },
        async saveAnnouncement() {
            if (!this.canManageAnnouncements) { this.showNotify('Only Director, Superadmin and HR can post an announcement.'); return; }
            const { isEdit, id, form } = this.announcementModal;
            const title = form.title.trim();
            const message = form.message.trim();
            if (!title || !message) { this.showNotify('Complete the title and message.'); return; }
            if (form.expiresAt && form.expiresAt < this.getLocalDateKey()) { this.showNotify('Expiry date cannot be in the past.'); return; }
            const nowIso = new Date().toISOString();
            try {
                if (isEdit) {
                    const existing = this.announcements.find(a => a.id === id);
                    await setDoc(doc(db, 'announcements', id), {
                        title, message, priority: form.priority, attachments: form.attachments, expiresAt: form.expiresAt || '',
                        status: existing?.status || 'Active',
                        createdByUid: existing?.createdByUid, createdByName: existing?.createdByName, createdByEmail: existing?.createdByEmail, createdAt: existing?.createdAt,
                        lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: nowIso
                    });
                    this.logAudit('UPDATE', `Edited announcement "${title}"`);
                    this.showNotify('Announcement updated.');
                } else {
                    const ref = doc(collection(db, 'announcements'));
                    await setDoc(ref, {
                        title, message, priority: form.priority, status: 'Active', attachments: form.attachments, expiresAt: form.expiresAt || '',
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
        // Uploaded immediately on selection, same as every other attachment
        // flow in this app (handleClientDocumentUpload, handleClaimAttachmentUpload)
        // — the modal just accumulates the resulting URLs in form.attachments,
        // so Post/Save Changes writes them like any other field.
        async validateAnnouncementAttachmentFile(file) {
            if (!file) throw new Error('No file was selected.');
            if (file.size <= 0) throw new Error('The selected file is empty.');
            const extension = String(file.name || '').split('.').pop().toLowerCase();
            const type = ATTACHMENT_TYPES[extension];
            if (!type) throw new Error('Only JPG, PNG, GIF, WEBP, PDF, MP4, DOCX, XLSX and PPTX files are allowed.');
            const limit = attachmentSizeLimitBytes(type.contentType);
            if (file.size > limit) throw new Error(`This file type is limited to ${this.formatFileSize(limit)}.`);
            // Magic-byte check for the types that have one fixed, cheap-to-check
            // signature (mirrors validateClientDocumentFile's rigor); MP4 and the
            // OOXML office formats are checked by extension + declared type only
            // — storage.rules' own contentType gate is the real boundary either way.
            const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
            const isPng = signature.length >= 8 && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47;
            const isJpeg = signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;
            const isGif = signature.length >= 4 && signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46 && signature[3] === 0x38;
            const isWebp = signature.length >= 12 && signature[0] === 0x52 && signature[1] === 0x49 && signature[2] === 0x46 && signature[3] === 0x46 && signature[8] === 0x57 && signature[9] === 0x45 && signature[10] === 0x42 && signature[11] === 0x50;
            const isPdf = signature.length >= 4 && signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46;
            const checks = { 'image/png': isPng, 'image/jpeg': isJpeg, 'image/gif': isGif, 'image/webp': isWebp, 'application/pdf': isPdf };
            if (type.contentType in checks && !checks[type.contentType]) throw new Error('The selected file\'s content does not match its extension.');
            return type.contentType;
        },
        isImageAttachmentType(contentType) { return String(contentType || '').startsWith('image/'); },
        announcementAttachmentIcon(contentType) {
            const entry = Object.values(ATTACHMENT_TYPES).find(t => t.contentType === contentType);
            return entry ? entry.icon : 'fa-file';
        },
        async handleAnnouncementAttachmentUpload(e) {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            if (this.announcementModal.form.attachments.length + files.length > 5) {
                this.showNotify('An announcement may carry at most 5 attachments.');
                e.target.value = '';
                return;
            }
            this.announcementModal.uploading = true;
            for (const file of files) {
                try {
                    const contentType = await this.validateAnnouncementAttachmentFile(file);
                    const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                    const storageFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}_${safeName}`;
                    const storagePath = `announcement_attachments/${this.userProfile.uid}/${storageFileName}`;
                    const fileRef = storageRef(storage, storagePath);
                    await uploadBytes(fileRef, file, { contentType });
                    const downloadURL = await getDownloadURL(fileRef);
                    this.announcementModal.form.attachments.push({ name: file.name, contentType, size: file.size, storagePath, downloadURL });
                } catch (error) {
                    console.error('Announcement attachment upload failed:', error);
                    this.showNotify(error?.message || `Unable to upload "${file.name}".`);
                }
            }
            this.announcementModal.uploading = false;
            e.target.value = '';
        },
        // The file is not yet referenced by any saved announcement while the
        // composer is still open (Post/Save Changes hasn't run), so it is safe
        // to remove from Storage immediately rather than leaving it orphaned.
        async removeAnnouncementAttachment(index) {
            const [attachment] = this.announcementModal.form.attachments.splice(index, 1);
            if (attachment?.storagePath) {
                try { await deleteObject(storageRef(storage, attachment.storagePath)); }
                catch (error) { console.warn('Unable to remove the attachment file (non-fatal):', error); }
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
                // A past expiry date left in place would just have
                // autoArchiveExpiredAnnouncements() re-archive this the next
                // time any manager's session loads the collection — clearing
                // it here is what makes Restore actually mean "active again",
                // not "active until the next page load."
                const expiresAt = this.isAnnouncementExpired(item) ? '' : item.expiresAt;
                await setDoc(doc(db, 'announcements', item.id), {
                    ...item, status: 'Active', expiresAt,
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
                await Promise.all((item.attachments || []).map(a =>
                    deleteObject(storageRef(storage, a.storagePath)).catch(error => console.warn('Unable to remove an attachment file (non-fatal):', error))
                ));
                this.logAudit('DELETE', `Deleted announcement "${item.title}"`);
                this.showNotify('Announcement deleted.');
            } catch (error) {
                console.error('Delete announcement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete this announcement'));
            }
        },
        openAnnouncementAttachment(attachment) {
            window.open(attachment.downloadURL, '_blank', 'noopener');
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
