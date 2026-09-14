// File handling: image validation, attachment preparation, and the client
// document library backed by Firebase Storage.
import {
    db,
    storage,
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "../../firebase-config.js";
export const uploadMethods = {
        async validateImageFile(file) {
            if (!file) throw new Error('No image file was selected.');
            if (file.size <= 0) throw new Error('The selected image file is empty.');
            if (file.size > 2 * 1024 * 1024) throw new Error('Image size must not exceed 2 MB.');

            const extension = String(file.name || '').split('.').pop().toLowerCase();
            const contentType = extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' : '';
            if (!contentType) throw new Error('Only PNG, JPG and JPEG files are allowed.');

            const declaredType = String(file.type || '').toLowerCase();
            const compatibleTypes = contentType === 'image/png' ? ['image/png', 'image/x-png'] : ['image/jpeg', 'image/jpg', 'image/pjpeg'];
            if (declaredType && !compatibleTypes.includes(declaredType)) throw new Error('The file extension does not match its image type.');

            const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
            const isPng = signature.length >= 8 && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47 && signature[4] === 0x0D && signature[5] === 0x0A && signature[6] === 0x1A && signature[7] === 0x0A;
            const isJpeg = signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;
            if ((contentType === 'image/png' && !isPng) || (contentType === 'image/jpeg' && !isJpeg)) throw new Error('The selected file is not a valid PNG, JPG or JPEG image.');
            return contentType;
        },
        getUploadErrorMessage(error) {
            return error?.message || 'Unable to process the image. Please select another PNG, JPG or JPEG file.';
        },
        formatFileSize(bytes) {
            const value = Number(bytes) || 0;
            return value < 1024 * 1024 ? `${(value / 1024).toFixed(0)} KB` : `${(value / (1024 * 1024)).toFixed(2)} MB`;
        },
        getFirestoreWriteError(error, action = 'save this record') {
            const code = String(error?.code || '').toLowerCase();
            if (code.includes('permission-denied')) return `You do not have permission to ${action}. Sign in again, and contact your administrator if it keeps happening.`;
            // Every branch here reports a write that did not happen, so each
            // one says so outright. Two of them used to open with neutral
            // prose and reached the operator wearing a success tick.
            if (code.includes('resource-exhausted') || code.includes('invalid-argument')) return `Unable to ${action} — the record is too large. Use fewer or smaller attachments.`;
            if (code.includes('unavailable') || code.includes('deadline-exceeded')) return `Unable to ${action} — the portal could not be reached. Check the network and try again.`;
            return `Unable to ${action}. ${error?.message || 'Please try again.'}`;
        },
        getSerializedSize(value) {
            return new Blob([JSON.stringify(value)]).size;
        },
        // Receipts, payment proofs and approval documents used to be written
        // into the Firestore record itself as a base64 data URL. That put the
        // bytes of every attachment inside the document every reader of that
        // record downloads, pushed each one toward Firestore's 1 MB ceiling,
        // and meant the image was squeezed to 220 KB to fit — a receipt
        // compressed until the amount on it is hard to read is not a receipt.
        //
        // They go to Firebase Storage now, the same place client documents
        // already go, and the record keeps a URL. Records written the old way
        // still carry a data URL and still render: everything that displays an
        // attachment accepts either (see isSupportedImageAttachment).
        //
        // The image is still resized and re-encoded before it leaves the
        // browser — a 12-megapixel phone photo of an A4 receipt helps nobody —
        // but the budget is now what is readable rather than what Firestore
        // will accept. minDimension is how far it may shrink to fit that budget:
        // 900px keeps a receipt's figures legible, and a profile photo passes
        // its own, smaller floor.
        async prepareImageAttachment(file, maxUploadBytes = 1536 * 1024, maxDimension = 2000, minDimension = 900) {
            // Validates the bytes, not just the extension — what comes out of
            // the canvas below is always a JPEG whatever went in.
            await this.validateImageFile(file);
            const ownerUid = this.userProfile.uid;
            if (!ownerUid) throw new Error('Sign in again before attaching a file.');
            const imageUrl = URL.createObjectURL(file);
            try {
                const image = await new Promise((resolve, reject) => {
                    const element = new Image();
                    element.onload = () => resolve(element);
                    element.onerror = () => reject(new Error('The selected image cannot be decoded.'));
                    element.src = imageUrl;
                });
                let width = image.naturalWidth;
                let height = image.naturalHeight;
                if (!width || !height) throw new Error('The selected image has invalid dimensions.');
                const initialScale = Math.min(1, maxDimension / Math.max(width, height));
                width = Math.max(1, Math.round(width * initialScale));
                height = Math.max(1, Math.round(height * initialScale));

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { alpha: false });
                if (!context) throw new Error('This browser cannot process the selected image.');
                let quality = 0.92;
                let drawnWidth = 0;
                let drawnHeight = 0;
                for (let attempt = 0; attempt < 14; attempt++) {
                    // Only a new size needs a new drawing; a new quality is
                    // just another encode of the same pixels.
                    if (width !== drawnWidth || height !== drawnHeight) {
                        canvas.width = width;
                        canvas.height = height;
                        context.fillStyle = '#FFFFFF';
                        context.fillRect(0, 0, width, height);
                        context.drawImage(image, 0, 0, width, height);
                        drawnWidth = width;
                        drawnHeight = height;
                    }
                    const blob = await new Promise((resolve, reject) => {
                        canvas.toBlob(
                            result => result ? resolve(result) : reject(new Error('This browser could not re-encode the selected image.')),
                            'image/jpeg',
                            quality
                        );
                    });
                    if (blob.size <= maxUploadBytes) return await this.storeAttachment(blob, ownerUid);
                    if (quality > 0.6) quality -= 0.08;
                    else {
                        const currentMax = Math.max(width, height);
                        const nextMax = Math.max(minDimension, Math.round(currentMax * 0.85));
                        // At the floor already: nothing left to try. The floor
                        // must never scale an image up either.
                        if (nextMax >= currentMax) break;
                        const resizeScale = nextMax / currentMax;
                        width = Math.max(1, Math.round(width * resizeScale));
                        height = Math.max(1, Math.round(height * resizeScale));
                        quality = 0.8;
                    }
                }
                throw new Error('The image could not be reduced to a reasonable size. Please use a smaller image.');
            } finally {
                URL.revokeObjectURL(imageUrl);
            }
        },
        // One private file per uploader. The path carries the uid so
        // storage.rules can say "your own" without a cross-service lookup,
        // which does not work in this project (see the note in storage.rules).
        //
        // The previous file is deliberately NOT deleted when an attachment is
        // replaced: the record still points at it until the save succeeds, and
        // a failed save that had already destroyed the old receipt would be a
        // worse outcome than an unreferenced file.
        async storeAttachment(blob, ownerUid) {
            const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
            const fileRef = storageRef(storage, `receipts/${ownerUid}/${name}`);
            try {
                await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
                return await getDownloadURL(fileRef);
            } catch (error) {
                console.error('Attachment upload failed:', error);
                const code = String(error?.code || '').toLowerCase();
                if (code.includes('unauthorized') || code.includes('permission')) {
                    throw new Error('You are not allowed to attach a file to this record. Contact your administrator.');
                }
                if (code.includes('retry-limit') || code.includes('canceled')) {
                    throw new Error('The attachment could not be uploaded. Check your connection and try again.');
                }
                throw new Error('The attachment could not be uploaded. Please try again.');
            }
        },
        async handleClaimAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            this.attachmentUploadState.receipt = true;
            try {
                this.claimForm.receiptAttachment = await this.prepareImageAttachment(file);
                this.claimForm.receiptAttachmentName = file.name;
                this.claimForm.receiptAttachmentOriginalBytes = file.size;
                this.showNotify('Receipt attachment is ready to be saved.');
            } catch (error) {
                console.error('Receipt attachment upload failed:', error);
                this.claimForm.receiptAttachment = '';
                this.claimForm.receiptAttachmentName = '';
                this.claimForm.receiptAttachmentOriginalBytes = 0;
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.receipt = false; e.target.value = ''; }
        },
        async handleVoucherAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            this.attachmentUploadState.receipt = true;
            try {
                this.voucherForm.receiptAttachment = await this.prepareImageAttachment(file);
                this.voucherForm.receiptAttachmentName = file.name;
                this.voucherForm.receiptAttachmentOriginalBytes = file.size;
                this.showNotify('Supporting document is ready to be saved.');
            } catch (error) {
                console.error('Voucher attachment upload failed:', error);
                this.voucherForm.receiptAttachment = '';
                this.voucherForm.receiptAttachmentName = '';
                this.voucherForm.receiptAttachmentOriginalBytes = 0;
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.receipt = false; e.target.value = ''; }
        },
        async handleDirectorApprovalAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const receiptOriginalBytes = Number(this.claimPreview.claim?.receiptAttachmentOriginalBytes || 0);
            if (receiptOriginalBytes + file.size > 2 * 1024 * 1024) {
                this.showNotify('The total original attachments for one claim must not exceed 2 MB. Select a smaller Director document.');
                e.target.value = '';
                return;
            }
            this.attachmentUploadState.director = true;
            try {
                this.claimPreview.directorApprovalAttachment = await this.prepareImageAttachment(file);
                this.claimPreview.directorApprovalAttachmentName = file.name;
                this.claimPreview.directorApprovalOriginalBytes = file.size;
                this.showNotify('Director approval document is ready to be saved.');
            } catch (error) {
                console.error('Director attachment upload failed:', error);
                this.claimPreview.directorApprovalAttachment = '';
                this.claimPreview.directorApprovalAttachmentName = '';
                this.claimPreview.directorApprovalOriginalBytes = 0;
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.director = false; e.target.value = ''; }
        },
        async validateClientDocumentFile(file) {
            if (!file) throw new Error('No file was selected.');
            if (file.size <= 0) throw new Error('The selected file is empty.');
            if (file.size > 10 * 1024 * 1024) throw new Error('File size must not exceed 10 MB.');

            const extension = String(file.name || '').split('.').pop().toLowerCase();
            const extensionTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
            const contentType = extensionTypeMap[extension];
            if (!contentType) throw new Error('Only JPG, JPEG, PNG and PDF files are allowed.');

            const declaredType = String(file.type || '').toLowerCase();
            const compatibleTypesMap = {
                'image/png': ['image/png', 'image/x-png'],
                'image/jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
                'application/pdf': ['application/pdf']
            };
            if (declaredType && !compatibleTypesMap[contentType].includes(declaredType)) throw new Error('The file extension does not match its actual file type.');

            const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
            const isPng = signature.length >= 8 && signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47 && signature[4] === 0x0D && signature[5] === 0x0A && signature[6] === 0x1A && signature[7] === 0x0A;
            const isJpeg = signature.length >= 3 && signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;
            const isPdf = signature.length >= 4 && signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46;
            if ((contentType === 'image/png' && !isPng) || (contentType === 'image/jpeg' && !isJpeg) || (contentType === 'application/pdf' && !isPdf)) {
                throw new Error('The selected file is not a valid JPG, PNG or PDF — its content does not match its extension.');
            }
            return contentType;
        },
        loadClientDocuments(clientDirectoryId, clientName = '', clientEmail = '') {
            if (this.clientDocumentsUnsubscribe) { this.clientDocumentsUnsubscribe(); this.clientDocumentsUnsubscribe = null; }
            if (!clientDirectoryId) { this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '', pendingExpiryDate: '' }; return; }
            this.clientDocuments.clientDirectoryId = clientDirectoryId;
            this.clientDocuments.clientName = clientName;
            this.clientDocuments.clientEmail = clientEmail;
            this.clientDocuments.loading = true;
            this.clientDocuments.error = '';
            // Firestore Rules independently re-verify access via customerEmailMatches()
            // against the linked customers record, so this query only needs to scope
            // by clientDirectoryId — filtering on the primary contact's own clientEmail
            // here would incorrectly hide these documents from an authorized secondary
            // client contact (see customers/{id}.additionalClientEmails).
            const q = query(collection(db, 'client_documents'), where('clientDirectoryId', '==', clientDirectoryId));
            // Live subscription (not a one-time getDocs): whoever else — staff or the
            // client — has this same client's document list open sees an upload/delete
            // from the other side appear immediately, no tab switch/refresh needed.
            this.clientDocumentsUnsubscribe = onSnapshot(q, (snapshot) => {
                if (this.clientDocuments.clientDirectoryId !== clientDirectoryId) return;
                this.clientDocuments.items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
                this.clientDocuments.loading = false;
            }, (error) => {
                console.error('Load client documents failed:', error);
                if (this.clientDocuments.clientDirectoryId !== clientDirectoryId) return;
                this.clientDocuments.error = error && error.code === 'permission-denied'
                    ? "You don't have access to view these documents. If this looks wrong, please contact our team."
                    : 'Could not load documents right now — check your internet connection and try again.';
                this.clientDocuments.loading = false;
            });
        },
        clientDocumentIcon(fileType) {
            return fileType === 'application/pdf' ? 'fa-file-pdf text-red-500' : 'fa-file-image text-blue-500';
        },
        async handleClientDocumentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!this.canUploadClientDocuments) { this.showNotify('You do not have permission to upload client documents.'); e.target.value = ''; return; }
            const clientDirectoryId = this.clientDocuments.clientDirectoryId;
            if (!clientDirectoryId) { this.showNotify('No client selected for this document.'); e.target.value = ''; return; }
            this.clientDocuments.uploading = true;
            try {
                const contentType = await this.validateClientDocumentFile(file);
                const safeName = String(file.name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                const storageFileName = `${Date.now()}_${safeName}`;
                const storagePath = `client_documents/${clientDirectoryId}/${storageFileName}`;
                const fileRef = storageRef(storage, storagePath);
                await uploadBytes(fileRef, file, { contentType });
                const downloadURL = await getDownloadURL(fileRef);
                const docId = `${clientDirectoryId}_${Date.now()}`;
                // Optional: staff or the client themselves can date a licence/permit on
                // upload so clientExpiringDocuments (Priority tier) has something real to
                // warn about. Left blank, the document simply never appears in that list.
                const expiryDate = String(this.clientDocuments.pendingExpiryDate || '').trim();
                await setDoc(doc(db, 'client_documents', docId), {
                    clientDirectoryId,
                    clientName: this.clientDocuments.clientName,
                    clientEmail: this.clientDocuments.clientEmail,
                    fileName: file.name,
                    fileType: contentType,
                    fileSize: file.size,
                    storagePath,
                    storageFileName,
                    downloadURL,
                    expiryDate,
                    uploadedByUid: this.userProfile.uid,
                    uploadedByName: this.userProfile.name,
                    uploadedByEmail: this.userProfile.email,
                    uploadedAt: new Date().toISOString()
                });
                this.clientDocuments.pendingExpiryDate = '';
                this.logAudit('UPLOAD_DOCUMENT', `Uploaded "${file.name}" for client ${this.clientDocuments.clientName}`);
                this.showNotify('Document uploaded successfully.');
                if (this.userProfile.role === 'Client') this.notifyByEmail({
                    to: [...this.emailsForRole('Superadmin'), ...this.emailsForRole('Director'), ...this.emailsForRole('HR'), ...this.emailsForRole('Account')],
                    subject: `New Document Uploaded by ${this.clientDocuments.clientName}`,
                    heading: 'Client Uploaded a New Document',
                    message: `${this.userProfile.name} from ${this.clientDocuments.clientName} uploaded "${file.name}" to the Client Documents repository.`
                }); else this.notifyByEmail({
                    to: this.clientDocuments.clientEmail,
                    subject: `New Document Shared — ${this.clientDocuments.clientName}`,
                    heading: 'New Document Shared With You',
                    message: `${this.userProfile.name} shared a new document, "${file.name}", in your Client Documents repository. Sign in to view or download it.`
                });
                // No manual reload — the live subscription set up by loadClientDocuments()
                // already reflects this upload as soon as it commits.
            } catch (error) {
                console.error('Client document upload failed:', error);
                this.showNotify(error?.message || 'Unable to upload the document. Please try again.');
            } finally {
                this.clientDocuments.uploading = false;
                e.target.value = '';
            }
        },
        viewClientDocument(item) {
            window.open(item.downloadURL, '_blank', 'noopener');
        },
        async downloadClientDocument(item) {
            // Fetching the file to force a Save-As with the real filename only
            // works when the Storage bucket's CORS config admits this origin —
            // it currently does not (confirmed live: every attempt fails with
            // "No 'Access-Control-Allow-Origin' header is present"), so this
            // always fell through to a bare failure toast with no way to reach
            // the file at all. Fall back to the same plain-navigation approach
            // viewClientDocument() already uses, which needs no CORS — worse
            // (opens instead of force-downloading) but it actually gets the
            // client to their file instead of a dead end.
            try {
                const response = await fetch(item.downloadURL);
                if (!response.ok) throw new Error('Download failed.');
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = item.fileName || 'document';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error('Direct document download failed, opening it instead:', error);
                const opened = window.open(item.downloadURL, '_blank', 'noopener');
                if (!opened) this.showNotify('Unable to open this document. Please try again.');
            }
        },
        requestDeleteClientDocument(item) {
            if (!this.canManageDocuments) { this.showNotify('You do not have permission to remove client documents.'); return; }
            this.requestConfirm({
                title: 'Remove this document?',
                message: `"${item.fileName}" will be permanently removed from ${this.clientDocuments.clientName}'s document repository. This cannot be undone.`,
                confirmLabel: 'Yes, Remove Document',
                danger: true,
                onConfirm: () => this.deleteClientDocument(item)
            });
        },
        async deleteClientDocument(item) {
            try {
                // The stored file may already be gone (legacy rows predating storagePath, or a
                // file removed straight from the bucket). Losing the bytes must not block removing
                // the metadata row, otherwise the entry is orphaned in the UI forever.
                if (item.storagePath) {
                    try {
                        await deleteObject(storageRef(storage, item.storagePath));
                    } catch (storageError) {
                        if (storageError?.code !== 'storage/object-not-found') throw storageError;
                    }
                }
                await deleteDoc(doc(db, 'client_documents', item.id));
                // No manual list splice — the live subscription drops this item for every
                // viewer (staff and client alike) the moment the delete commits.
                this.logAudit('DELETE_DOCUMENT', `Removed "${item.fileName}" from client ${this.clientDocuments.clientName}`);
                this.showNotify('Document removed.');
            } catch (error) {
                console.error('Client document delete failed:', error);
                this.showNotify('Unable to remove this document. Please try again.');
            }
        },

        isSupportedImageAttachment(attachment) {
            return typeof attachment === 'string' && (
                /^data:image\/(png|jpeg);base64,/i.test(attachment) ||
                /^https:\/\/firebasestorage\.googleapis\.com\//i.test(attachment)
            );
        },
        openAttachment(attachment, label = 'Attachment') {
            const isSupportedImage = this.isSupportedImageAttachment(attachment);
            if (!isSupportedImage) {
                this.showNotify(`${label} is unavailable. Only PNG and JPEG/JPG attachments are supported.`);
                return;
            }

            this.attachmentPreview = { show: true, url: attachment, label };
        }
};