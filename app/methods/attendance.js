// Staff attendance: self-service clock in/out, and HR/Admin corrections.
//
// clockInAt/clockOutAt are written with serverTimestamp() rather than this
// app's usual new Date().toISOString() — a deliberate, one-off exception.
// Every other timestamp in this codebase trusts the client because nothing
// about it is adversarial; a clock-in time is the one field a staff member
// has a reason to falsify (an incorrect device clock), so it is the one
// field firestore.rules requires to be the server-assigned sentinel instead
// (see isSelfAttendanceRecord()/attendanceId create rule).
import {
    db,
    storage,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    storageRef,
    uploadBytes,
    getDownloadURL
} from "../../firebase-config.js";

export const attendanceMethods = {

        // The signed-in account's own HR record, matched by email exactly like
        // presence.js's setCurrentEmployeePresence() already does — the login
        // account and the employee record are two different documents linked
        // only by this address.
        myEmployeeRecord() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            if (!email) return null;
            return this.employees.find(emp => String(emp.email || '').trim().toLowerCase() === email) || null;
        },
        attendanceIdFor(empNo, date) { return `${empNo}_${date}`; },
        myTodayAttendanceRecord() {
            const employee = this.myEmployeeRecord();
            if (!employee) return null;
            const id = this.attendanceIdFor(employee.empNo, this.getLocalDateKey());
            return this.attendanceRecords.find(record => record.id === id) || null;
        },
        // A Firestore Timestamp (what clockInAt/clockOutAt resolve to once read
        // back from a snapshot) is not a value `new Date()` understands the way
        // formatDateTime() expects — it needs toDate() first.
        attendanceTimeLabel(value) {
            if (!value) return '-';
            const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            return this.formatDateTime(date);
        },
        // The same Timestamp-or-plain-value coercion as attendanceTimeLabel(),
        // formatted for a <input type="datetime-local"> instead of for display.
        toDateTimeLocalValue(value) {
            if (!value) return '';
            const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            if (Number.isNaN(date.getTime())) return '';
            const pad = n => String(n).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        },
        // Clock In now opens a modal that captures both a live selfie and the
        // device's GPS position before the actual write happens — the button
        // itself only ever starts that flow; confirmClockInVerification()
        // below is what actually calls setDoc(). Both are required server-side
        // too (see firestore.rules' attendance create rule), not just by this
        // modal, so a client that skipped straight to a write still cannot
        // clock someone in without them.
        async openClockInVerification() {
            const employee = this.myEmployeeRecord();
            if (!employee) { this.showNotify('No employee record is linked to your account. Ask HR to add your email to your employee record.'); return; }
            if (this.myTodayAttendanceRecord()) { this.showNotify('You have already clocked in today.'); return; }
            this.clockInVerifyModal = {
                show: true, stream: null,
                locationStatus: 'idle', location: null, locationError: '',
                cameraStatus: 'idle', cameraError: '',
                photoDataUrl: '', photoBlob: null, submitting: false
            };
            this.requestClockInLocation();
            await this.startClockInCamera();
        },
        requestClockInLocation() {
            this.clockInVerifyModal.locationStatus = 'requesting';
            this.clockInVerifyModal.locationError = '';
            if (!navigator.geolocation) {
                this.clockInVerifyModal.locationStatus = 'error';
                this.clockInVerifyModal.locationError = 'This device does not support location. Clock in from a device with location services.';
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (!this.clockInVerifyModal.show) return;
                    this.clockInVerifyModal.location = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
                    this.clockInVerifyModal.locationStatus = 'ready';
                },
                (error) => {
                    if (!this.clockInVerifyModal.show) return;
                    this.clockInVerifyModal.locationStatus = 'error';
                    this.clockInVerifyModal.locationError = error.code === 1
                        ? 'Location access was denied. Allow location access for this site in your browser settings, then try again.'
                        : error.code === 2
                            ? "Your location could not be determined. Check that your device's location/GPS is turned on."
                            : 'Getting your location took too long. Move somewhere with a clearer signal and try again.';
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        },
        async startClockInCamera() {
            this.clockInVerifyModal.cameraStatus = 'requesting';
            this.clockInVerifyModal.cameraError = '';
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.clockInVerifyModal.cameraStatus = 'error';
                this.clockInVerifyModal.cameraError = 'This browser does not support camera access. Clock in from a device with a camera.';
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
                if (!this.clockInVerifyModal.show) { stream.getTracks().forEach(track => track.stop()); return; }
                this.clockInVerifyModal.stream = stream;
                this.clockInVerifyModal.cameraStatus = 'ready';
                await this.$nextTick();
                const video = this.$refs.clockInVideo;
                if (video) { video.srcObject = stream; await video.play().catch(() => {}); }
            } catch (error) {
                console.error('Camera access failed:', error);
                this.clockInVerifyModal.cameraStatus = 'error';
                this.clockInVerifyModal.cameraError = error && error.name === 'NotAllowedError'
                    ? 'Camera access was denied. Allow camera access for this site in your browser settings, then try again.'
                    : error && error.name === 'NotFoundError'
                        ? 'No camera was found on this device.'
                        : 'Unable to start the camera. Please try again.';
            }
        },
        // Drawn mirrored to match what the <video> preview (itself CSS-mirrored
        // for a natural selfie feel) actually showed the person taking it —
        // otherwise any text in frame (a lanyard, a sign) would capture backwards
        // from what they just saw themselves lining up.
        captureClockInPhoto() {
            const video = this.$refs.clockInVideo;
            if (!video || !video.videoWidth) { this.showNotify('Camera is not ready yet.'); return; }
            const maxDim = 640;
            const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
            const width = Math.max(1, Math.round(video.videoWidth * scale));
            const height = Math.max(1, Math.round(video.videoHeight * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext('2d');
            context.translate(width, 0);
            context.scale(-1, 1);
            context.drawImage(video, 0, 0, width, height);
            canvas.toBlob(blob => {
                if (!blob) { this.showNotify('Unable to capture the photo. Please try again.'); return; }
                this.clockInVerifyModal.photoBlob = blob;
                this.clockInVerifyModal.photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            }, 'image/jpeg', 0.85);
        },
        retakeClockInPhoto() {
            this.clockInVerifyModal.photoBlob = null;
            this.clockInVerifyModal.photoDataUrl = '';
        },
        closeClockInVerification() {
            const stream = this.clockInVerifyModal.stream;
            if (stream) stream.getTracks().forEach(track => track.stop());
            this.clockInVerifyModal.show = false;
            this.clockInVerifyModal.stream = null;
        },
        // One private selfie per uploader per clock-in, mirroring
        // storeAttachment() in uploads.js — the path carries the uploader's own
        // uid so storage.rules can say "your own" without a cross-service lookup.
        async storeAttendanceSelfie(blob, ownerUid) {
            const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
            const fileRef = storageRef(storage, `attendance_selfies/${ownerUid}/${name}`);
            await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
            return await getDownloadURL(fileRef);
        },
        async confirmClockInVerification() {
            const modal = this.clockInVerifyModal;
            if (modal.locationStatus !== 'ready' || !modal.location) { this.showNotify('Location is required before you can clock in.'); return; }
            if (!modal.photoBlob) { this.showNotify('Take a selfie before you can clock in.'); return; }
            const employee = this.myEmployeeRecord();
            if (!employee) { this.showNotify('No employee record is linked to your account.'); this.closeClockInVerification(); return; }
            if (this.myTodayAttendanceRecord()) { this.showNotify('You have already clocked in today.'); this.closeClockInVerification(); return; }
            modal.submitting = true;
            try {
                const selfieUrl = await this.storeAttendanceSelfie(modal.photoBlob, this.userProfile.uid);
                const date = this.getLocalDateKey();
                await setDoc(doc(db, 'attendance', this.attendanceIdFor(employee.empNo, date)), {
                    empNo: employee.empNo,
                    empEmail: String(employee.email || '').trim().toLowerCase(),
                    name: employee.name || '',
                    position: employee.position || '',
                    dept: employee.dept || '',
                    date,
                    clockInAt: serverTimestamp(),
                    clockOutAt: null,
                    status: 'Clocked In',
                    createdByUid: this.userProfile.uid,
                    createdAt: new Date().toISOString(),
                    selfieUrl,
                    clockInLocation: { lat: modal.location.lat, lng: modal.location.lng, accuracy: modal.location.accuracy }
                });
                this.logAudit('CREATE', `Clocked in for ${date} with location and selfie verification`);
                this.showNotify('Clocked in — location and selfie verified.');
                this.closeClockInVerification();
            } catch (error) {
                console.error('Verified clock in failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'clock in'));
            } finally {
                modal.submitting = false;
            }
        },
        // The map link HR/Admin uses to check a clock-in location against the
        // workplace — plain lat,lng query works for both Google Maps and every
        // major map app's universal link handler, no API key required.
        attendanceLocationMapUrl(location) {
            if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return '';
            return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
        },
        async clockOut() {
            const record = this.myTodayAttendanceRecord();
            if (!record) { this.showNotify('Clock in first.'); return; }
            if (record.status !== 'Clocked In') { this.showNotify('You have already clocked out today.'); return; }
            try {
                await updateDoc(doc(db, 'attendance', record.id), {
                    clockOutAt: serverTimestamp(),
                    status: 'Clocked Out'
                });
                this.logAudit('UPDATE', `Clocked out for ${record.date}`);
                this.showNotify('Clocked out.');
            } catch (error) {
                console.error('Clock out failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'clock out'));
            }
        },
        // deleteEmployee() never cascades to that person's attendance history
        // (kept for audit/payroll compliance even after offboarding), so a
        // stale clock-in can outlive the employee record it belongs to.
        // Nobody can meaningfully "correct" a clock-out for someone no longer
        // in the system, so both stale-record checks below drop any record
        // whose empNo isn't in the currently-loaded employees list. The
        // record itself is untouched — Superadmin/Director can still Correct
        // or Delete it from the full Attendance table.
        activeEmployeeNumbers() {
            return new Set(this.employees.map(emp => emp.empNo));
        },
        // Own attendance records still open from a day before today — the
        // person almost certainly forgot to clock out. Filters this.attendanceRecords
        // by own email rather than assuming the list is already self-scoped:
        // for HR/Account/Admin it holds every employee's records, and this is
        // what narrows it back down to their own.
        myStaleAttendanceRecords() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            const today = this.getLocalDateKey();
            const activeEmpNos = this.activeEmployeeNumbers();
            return this.attendanceRecords.filter(record => record.status === 'Clocked In' && record.date < today && activeEmpNos.has(record.empNo) && String(record.empEmail || '').trim().toLowerCase() === email);
        },
        // Same check, company-wide — only meaningful for a role that actually
        // reads every employee's records (canCorrectAttendance); for anyone
        // else this.attendanceRecords is already scoped to their own, so it
        // silently equals myStaleAttendanceRecords().
        companyStaleAttendanceRecords() {
            const today = this.getLocalDateKey();
            const activeEmpNos = this.activeEmployeeNumbers();
            return this.attendanceRecords.filter(record => record.status === 'Clocked In' && record.date < today && activeEmpNos.has(record.empNo));
        },
        // Run once per sign-in (see initFirebaseRealtime's portalDataReadyPromise,
        // right where ensureMonthlyArchives runs) rather than on every realtime
        // update — nobody needs this toast twice because a colleague's document
        // synced a second later.
        checkForgottenClockOuts() {
            const mine = this.myStaleAttendanceRecords();
            if (mine.length) {
                const dates = mine.map(record => record.date).join(', ');
                this.showNotify(`You have ${mine.length} attendance record${mine.length > 1 ? 's' : ''} still open from a previous day (${dates}) — it looks like you forgot to clock out. Contact HR to correct it.`);
            }
            if (this.canCorrectAttendance) {
                const companyCount = this.companyStaleAttendanceRecords().length;
                if (companyCount) {
                    this.showNotify(`${companyCount} attendance record${companyCount > 1 ? 's' : ''} company-wide look${companyCount > 1 ? '' : 's'} like a forgotten clock-out. Check Attendance to correct ${companyCount > 1 ? 'them' : 'it'}.`);
                }
            }
        },
        // Records for the selected date, newest-first by empNo — used by the
        // HR/Admin table. Self-service history (views/tab-attendance.html for
        // a role without canCorrectAttendance) reads this.attendanceRecords
        // directly instead, since the realtime listener already scopes it to
        // just that person's own records.
        attendanceRecordsForDate(date) {
            return this.attendanceRecords
                .filter(record => record.date === date)
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        },
        attendanceStatusLabel(record) {
            if (!record) return 'No record';
            return record.status === 'Clocked Out' ? 'Clocked Out' : 'Clocked In';
        },
        openAttendanceCorrectionModal(record) {
            if (!this.canCorrectAttendance) { this.showNotify('Only HR, Superadmin and Director can correct an attendance record.'); return; }
            this.attendanceCorrectionModal = {
                show: true,
                record,
                clockInInput: this.toDateTimeLocalValue(record.clockInAt),
                clockOutInput: this.toDateTimeLocalValue(record.clockOutAt),
                status: record.status || 'Clocked In',
                correctionNote: ''
            };
        },
        async saveAttendanceCorrection() {
            const { record, clockInInput, clockOutInput, status, correctionNote } = this.attendanceCorrectionModal;
            if (!record) return;
            if (!correctionNote.trim()) { this.showNotify('Explain the correction before saving.'); return; }
            if (!clockInInput) { this.showNotify('Clock In time is required.'); return; }
            if (status === 'Clocked Out' && !clockOutInput) { this.showNotify('Clock Out time is required when status is Clocked Out.'); return; }
            try {
                await updateDoc(doc(db, 'attendance', record.id), {
                    clockInAt: new Date(clockInInput),
                    clockOutAt: status === 'Clocked Out' && clockOutInput ? new Date(clockOutInput) : null,
                    status,
                    lastEditedByUid: this.userProfile.uid,
                    lastEditedByName: this.userProfile.name,
                    lastEditedAt: new Date().toISOString(),
                    correctionNote: correctionNote.trim()
                });
                this.logAudit('UPDATE', `Corrected attendance record ${record.id}: ${correctionNote.trim()}`);
                this.showNotify('Attendance record corrected.');
                this.attendanceCorrectionModal = { show: false, record: null, clockInInput: '', clockOutInput: '', status: 'Clocked In', correctionNote: '' };
            } catch (error) {
                console.error('Attendance correction failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'correct this attendance record'));
            }
        },
        // Permanent removal, unlike Correct above — matches MODULE_ACTIONS.attendance's
        // remove: FULL_ACCESS_ROLES (rbac.js) and firestore.rules' attendance/{id}
        // allow delete: if isAdmin(), so only Superadmin/Director ever reach the
        // server for this even if this gate were somehow bypassed client-side.
        async deleteAttendanceRecord(record) {
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete an attendance record.'); return; }
            if (!await this.askConfirm({
                title: 'Delete this attendance record?',
                message: `${record.name}'s attendance for ${this.formatDateWithDay(record.date)} will be permanently removed. This cannot be undone.`,
                confirmLabel: 'Yes, Delete'
            })) return;
            try {
                await deleteDoc(doc(db, 'attendance', record.id));
                this.logAudit('DELETE', `Deleted attendance record for ${record.name} (${record.empNo}) on ${record.date}`);
                this.showNotify('Attendance record deleted.');
            } catch (error) {
                console.error('Delete attendance record failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete this attendance record'));
            }
        }
};
