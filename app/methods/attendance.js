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
    doc,
    setDoc,
    updateDoc,
    serverTimestamp
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
        async clockIn() {
            const employee = this.myEmployeeRecord();
            if (!employee) { this.showNotify('No employee record is linked to your account. Ask HR to add your email to your employee record.'); return; }
            if (this.myTodayAttendanceRecord()) { this.showNotify('You have already clocked in today.'); return; }
            const date = this.getLocalDateKey();
            try {
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
                    createdAt: new Date().toISOString()
                });
                this.logAudit('CREATE', `Clocked in for ${date}`);
                this.showNotify('Clocked in.');
            } catch (error) {
                console.error('Clock in failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'clock in'));
            }
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
        // Own attendance records still open from a day before today — the
        // person almost certainly forgot to clock out. Filters this.attendanceRecords
        // by own email rather than assuming the list is already self-scoped:
        // for HR/Account/Admin it holds every employee's records, and this is
        // what narrows it back down to their own.
        myStaleAttendanceRecords() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            const today = this.getLocalDateKey();
            return this.attendanceRecords.filter(record => record.status === 'Clocked In' && record.date < today && String(record.empEmail || '').trim().toLowerCase() === email);
        },
        // Same check, company-wide — only meaningful for a role that actually
        // reads every employee's records (canCorrectAttendance); for anyone
        // else this.attendanceRecords is already scoped to their own, so it
        // silently equals myStaleAttendanceRecords().
        companyStaleAttendanceRecords() {
            const today = this.getLocalDateKey();
            return this.attendanceRecords.filter(record => record.status === 'Clocked In' && record.date < today);
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
        }
};
