// The CMS behind the public zenqor.com.my site: portfolio galleries, the
// Services page and per-key page-text overrides.
import {
    db,
    storage,
    collection,
    doc,
    setDoc,
    deleteDoc,
    deleteField,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "../../firebase-config.js";
import { SITE_TEXT_KEYS } from "../constants/site-text.js";
export const websiteContentMethods = {

        // ── Website Content (zenqor-tech Portfolio, Services, Page Text) ────────
        // Gallery cards show the WORK's own date (eventDate — when the permit was
        // issued, the submission made), not when someone happened to type the record
        // into the portal. Ordering by createdAt therefore put an older job in front
        // of a newer one whenever they were entered out of order, which is exactly
        // what the Licensing & Permits list was doing. Sort by what the card shows.
        //
        // createdAt is the fallback for records saved before eventDate existed, and
        // the tiebreaker for two items on the same day. Both are ISO-prefixed
        // (YYYY-MM-DD…), so a plain string compare orders them correctly and a
        // date-only eventDate still compares cleanly against a full timestamp.
        // createdAt is NOT uniformly typed in this collection: older records hold a
        // Firestore Timestamp (written via serverTimestamp()), newer ones an ISO
        // string. String(timestamp) yields "Timestamp(seconds=…)", which sorts
        // nowhere near an ISO date — that is why the previous createdAt ordering
        // came out looking arbitrary. Normalise both shapes to ISO before comparing.
        toComparableIsoDate(value) {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (typeof value.toDate === 'function') {
                try { return value.toDate().toISOString(); } catch (error) { return ''; }
            }
            if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
            return '';
        },
        websiteContentDateKey(item) {
            return String(item?.eventDate || this.toComparableIsoDate(item?.createdAt) || '');
        },
        sortGalleryItemsNewestFirst(items) {
            return [...items].sort((a, b) => {
                const byDate = this.websiteContentDateKey(b).localeCompare(this.websiteContentDateKey(a));
                if (byDate !== 0) return byDate;
                return this.toComparableIsoDate(b.createdAt).localeCompare(this.toComparableIsoDate(a.createdAt));
            });
        },
        websiteContentLabel(collectionName) {
            if (collectionName === 'services') return 'Services';
            // portfolio_web is retired; its records are being folded into
            // Licensing & Permits, so both portfolio collections read the same.
            return 'Licensing & Permits';
        },
        openWebsiteContentModal(collectionName, item = null) {
            if (!this.hasModulePermission('website-content', 'edit')) { this.showNotify('You do not have permission to manage website content.'); return; }
            if (this.websiteContentModal.imagePreviewUrl && this.websiteContentModal.imageFile) URL.revokeObjectURL(this.websiteContentModal.imagePreviewUrl);
            (this.websiteContentModal.mediaItems || []).forEach(media => { if (media.file && media.previewUrl) URL.revokeObjectURL(media.previewUrl); });
            const isGallery = (collectionName === 'portfolio_web' || collectionName === 'portfolio_gaming');
            let mediaItems = [];
            if (isGallery) {
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
            this.websiteContentModal = { show: false, isEdit: false, collectionName: 'portfolio_gaming', id: '', form: { tag: '', title: '', desc: '', imgUrl: '', imgStoragePath: '', icon: '', name: '', companyName: '', eventDate: '' }, imageFile: null, imagePreviewUrl: '', imageOrientation: '', mediaItems: [], removedMediaStoragePaths: [], uploading: false };
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
        // portfolio gallery multi-media uploader (images + MP4, up to 6 files).
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
            const isGallery = (collectionName === 'portfolio_web' || collectionName === 'portfolio_gaming');
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
                if (isGallery) {
                    if (!this.websiteContentModal.mediaItems.length) { this.showNotify('Attach at least one photo or video.'); return; }
                } else if (!this.websiteContentModal.imageFile && !form.imgUrl) {
                    this.showNotify('Upload an image (PNG, JPG or JPEG).'); return;
                }
                payload = { tag, companyName, title, eventDate, desc };
            }
            // Deliberately NOT normalizeOfficialRecord(): that uppercases every
            // string, which suits an invoice's official party details but turns a
            // public marketing paragraph into an unreadable wall of capitals, and
            // left Our Client reading nothing like Licensing & Permits beside it.
            // Every field is already trimmed above; case stays as the editor typed it.
            const label = isServices ? payload.name : payload.title;
            this.websiteContentModal.uploading = isGallery
                ? this.websiteContentModal.mediaItems.some(media => media.file)
                : (!isServices && Boolean(this.websiteContentModal.imageFile));
            try {
                let oldStoragePath = '';
                if (isGallery) {
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
                if (isGallery && this.websiteContentModal.removedMediaStoragePaths.length) {
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
            if (!await this.askConfirm({
                title: 'Delete website content?',
                message: `"${label}" will be removed from ${this.websiteContentLabel(collectionName)} and disappear from the live site immediately.`,
                confirmLabel: 'Yes, Delete',
                danger: true
            })) return;
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
            if (!await this.askConfirm({
                title: 'Reset to default text?',
                message: `"${key}" returns to the site's built-in wording and your override is removed.`,
                confirmLabel: 'Yes, Reset',
                danger: true
            })) return;
            try {
                await setDoc(doc(db, 'content', 'site_text'), { [key]: deleteField() }, { merge: true });
                this.logAudit('DELETE', `Reset page text override "${key}" to default`);
                this.showNotify('Reverted to the default text.');
            } catch (error) {
                console.error('Page text reset failed:', error);
                this.showNotify('Unable to reset this page text override.');
            }
        }
};