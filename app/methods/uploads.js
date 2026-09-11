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
    getDocs,
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
            if (code.includes('permission-denied')) return `Permission denied while trying to ${action}. Deploy the latest firestore.rules and sign in again.`;
            // Every branch here reports a write that did not happen, so each
            // one says so outright. Two of them used to open with neutral
            // prose and reached the operator wearing a success tick.
            if (code.includes('resource-exhausted') || code.includes('invalid-argument')) return `Unable to ${action} — the record is too large. Select smaller images.`;
            if (code.includes('unavailable') || code.includes('deadline-exceeded')) return `Unable to ${action} — Firestore is temporarily unavailable. Check the network and try again.`;
            return `Unable to ${action}. ${error?.message || 'Please try again.'}`;
        },
        getSerializedSize(value) {
            return new Blob([JSON.stringify(value)]).size;
        },
        getDataUrlSize(dataUrl) {
            if (!dataUrl || !String(dataUrl).startsWith('data:')) return 0;
            const value = String(dataUrl);
            return Math.ceil((value.length - value.indexOf(',') - 1) * 3 / 4);
        },
        async prepareImageAttachment(file, maxDataUrlBytes = 220 * 1024, maxDimension = 1600) {
            await this.validateImageFile(file);
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
                let quality = 0.9;
                let dataUrl = '';
                for (let attempt = 0; attempt < 14; attempt++) {
                    canvas.width = width;
                    canvas.height = height;
                    context.fillStyle = '#FFFFFF';
                    context.fillRect(0, 0, width, height);
                    context.drawImage(image, 0, 0, width, height);
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const encodedBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4);
                    if (encodedBytes <= maxDataUrlBytes) return dataUrl;
                    if (quality > 0.5) quality -= 0.1;
                    else {
                        const currentMax = Math.max(width, height);
                        const nextMax = Math.max(480, Math.round(currentMax * 0.82));
                        const resizeScale = nextMax / currentMax;
                        width = Math.max(1, Math.round(width * resizeScale));
                        height = Math.max(1, Math.round(height * resizeScale));
                        quality = 0.72;
                    }
                }
                throw new Error('The image could not be reduced to a safe Firestore size. Please use a smaller image.');
            } finally {
                URL.revokeObjectURL(imageUrl);
            }
        },
        async handleAttachmentUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            this.attachmentUploadState.payment = true;
            try {
                this.docForm.paymentAttachment = await this.prepareImageAttachment(file);
                this.showNotify('Payment attachment is ready to be saved.');
            } catch (error) {
                console.error('Payment attachment upload failed:', error);
                this.docForm.paymentAttachment = '';
                this.showNotify(this.getUploadErrorMessage(error));
                e.target.value = '';
            } finally { this.attachmentUploadState.payment = false; e.target.value = ''; }
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
            if (!clientDirectoryId) { this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' }; return; }
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
                    uploadedByUid: this.userProfile.uid,
                    uploadedByName: this.userProfile.name,
                    uploadedByEmail: this.userProfile.email,
                    uploadedAt: new Date().toISOString()
                });
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
                console.error('Client document download failed:', error);
                this.showNotify('Unable to download this document. Please try again.');
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