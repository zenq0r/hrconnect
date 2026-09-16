// Weekly duty roster: HR/Admin defines shifts and assigns staff to them; every
// internal role views the shifts it has been assigned to, once the week is
// Published. One document per week (id = the Monday it starts on) holds the
// whole week's shifts — small enough that a read-modify-setDoc({merge:true})
// on the array is simpler than a subcollection, and it keeps firestore.rules
// to a single match block.
import {
    db,
    doc,
    setDoc
} from "../../firebase-config.js";

export const dutyRosterMethods = {

        weekStartKeyFor(value) {
            const date = new Date(value);
            const daysSinceMonday = (date.getDay() + 6) % 7;
            date.setDate(date.getDate() - daysSinceMonday);
            return this.getLocalDateKey(date);
        },
        activeDutyRosterWeekKey() {
            const base = new Date();
            base.setDate(base.getDate() + (this.dutyRosterWeekOffset || 0) * 7);
            return this.weekStartKeyFor(base);
        },
        dutyRosterWeekDates(weekKey) {
            const start = new Date(`${weekKey}T00:00:00`);
            return Array.from({ length: 7 }, (_, i) => {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                return this.getLocalDateKey(date);
            });
        },
        shiftDutyRosterWeek(delta) { this.dutyRosterWeekOffset = (this.dutyRosterWeekOffset || 0) + delta; },
        resetDutyRosterWeek() { this.dutyRosterWeekOffset = 0; },
        // The week currently on screen. Synthesized as an empty Draft when HR
        // has not created it yet, so the grid still renders with Add-Shift
        // controls instead of an error.
        activeDutyRosterWeek() {
            const weekKey = this.activeDutyRosterWeekKey();
            return this.dutyRosterWeeks.find(week => week.id === weekKey) ||
                { id: weekKey, weekStartDate: weekKey, status: 'Draft', shifts: [] };
        },
        dutyRosterShiftsForDate(date) {
            return this.activeDutyRosterWeek().shifts.filter(shift => shift.date === date);
        },
        // Self-service view: only the shifts this signed-in employee is on,
        // and only once HR has published the week (an unpublished week never
        // reaches a non-manager's dutyRosterWeeks at all, per firestore.rules,
        // but the status check also covers the manager's own preview).
        myWeekRoster() {
            const employee = this.myEmployeeRecord();
            const week = this.activeDutyRosterWeek();
            if (!employee || week.status !== 'Published') return [];
            return week.shifts.filter(shift => (shift.assignedEmpNos || []).includes(employee.empNo));
        },
        slugifyShiftLabel(label) {
            return String(label || 'shift').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'shift';
        },
        openDutyRosterModal(shift = null, date = '') {
            if (!this.canManageDutyRoster) { this.showNotify('Only HR, Superadmin and Director can edit the duty roster.'); return; }
            this.dutyRosterModal = {
                show: true,
                isEdit: Boolean(shift),
                weekKey: this.activeDutyRosterWeekKey(),
                shiftId: shift?.shiftId || '',
                form: shift
                    ? { label: shift.label, date: shift.date, startTime: shift.startTime, endTime: shift.endTime }
                    : { label: 'Pagi', date: date || this.activeDutyRosterWeekKey(), startTime: '08:00', endTime: '17:00' }
            };
        },
        async saveDutyRosterShift() {
            if (!this.canManageDutyRoster) { this.showNotify('Only HR, Superadmin and Director can edit the duty roster.'); return; }
            const { weekKey, isEdit, shiftId, form } = this.dutyRosterModal;
            if (!form.label.trim() || !form.date || !form.startTime || !form.endTime) { this.showNotify('Complete the shift label, date and times.'); return; }
            try {
                const week = this.dutyRosterWeeks.find(w => w.id === weekKey);
                const shifts = week ? [...week.shifts] : [];
                if (isEdit) {
                    const index = shifts.findIndex(s => s.shiftId === shiftId);
                    if (index === -1) { this.showNotify('This shift no longer exists.'); return; }
                    shifts[index] = { ...shifts[index], label: form.label.trim(), date: form.date, startTime: form.startTime, endTime: form.endTime };
                } else {
                    shifts.push({
                        shiftId: `${form.date}-${this.slugifyShiftLabel(form.label)}`,
                        date: form.date, label: form.label.trim(), startTime: form.startTime, endTime: form.endTime,
                        assignedEmpNos: [], assignedNames: []
                    });
                }
                await setDoc(doc(db, 'duty_roster', weekKey), {
                    weekStartDate: weekKey,
                    status: week?.status || 'Draft',
                    shifts,
                    ...(week ? {} : { createdByUid: this.userProfile.uid, createdByName: this.userProfile.name, createdAt: new Date().toISOString() }),
                    lastEditedByUid: this.userProfile.uid,
                    lastEditedByName: this.userProfile.name,
                    lastEditedAt: new Date().toISOString()
                }, { merge: true });
                this.logAudit(isEdit ? 'UPDATE' : 'CREATE', `${isEdit ? 'Updated' : 'Added'} shift "${form.label.trim()}" on ${form.date} (week ${weekKey})`);
                this.showNotify(isEdit ? 'Shift updated.' : 'Shift added.');
                this.dutyRosterModal.show = false;
            } catch (error) {
                console.error('Save shift failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'save this shift'));
            }
        },
        async removeDutyRosterShift(shift) {
            if (!this.canManageDutyRoster) { this.showNotify('Only HR, Superadmin and Director can edit the duty roster.'); return; }
            if (!await this.askConfirm({
                title: 'Remove this shift?',
                message: `"${shift.label}" on ${this.formatDateWithDay(shift.date)} will be removed, along with its staff assignments.`,
                confirmLabel: 'Yes, Remove'
            })) return;
            const weekKey = this.activeDutyRosterWeekKey();
            const week = this.dutyRosterWeeks.find(w => w.id === weekKey);
            if (!week) return;
            try {
                await setDoc(doc(db, 'duty_roster', weekKey), {
                    shifts: week.shifts.filter(s => s.shiftId !== shift.shiftId),
                    lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: new Date().toISOString()
                }, { merge: true });
                this.logAudit('DELETE', `Removed shift "${shift.label}" on ${shift.date} (week ${weekKey})`);
                this.showNotify('Shift removed.');
            } catch (error) {
                console.error('Remove shift failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'remove this shift'));
            }
        },
        async toggleStaffOnShift(shift, employee) {
            if (!this.canManageDutyRoster) { this.showNotify('Only HR, Superadmin and Director can edit the duty roster.'); return; }
            const weekKey = this.activeDutyRosterWeekKey();
            const week = this.dutyRosterWeeks.find(w => w.id === weekKey);
            if (!week) return;
            const assigned = (shift.assignedEmpNos || []).includes(employee.empNo);
            const shifts = week.shifts.map(s => {
                if (s.shiftId !== shift.shiftId) return s;
                return assigned
                    ? { ...s, assignedEmpNos: s.assignedEmpNos.filter(empNo => empNo !== employee.empNo), assignedNames: s.assignedNames.filter(name => name !== employee.name) }
                    : { ...s, assignedEmpNos: [...(s.assignedEmpNos || []), employee.empNo], assignedNames: [...(s.assignedNames || []), employee.name] };
            });
            try {
                await setDoc(doc(db, 'duty_roster', weekKey), {
                    shifts,
                    lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: new Date().toISOString()
                }, { merge: true });
            } catch (error) {
                console.error('Assign staff failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update this shift\'s staff'));
            }
        },
        async publishDutyRosterWeek() {
            if (!this.canManageDutyRoster) { this.showNotify('Only HR, Superadmin and Director can publish the duty roster.'); return; }
            const weekKey = this.activeDutyRosterWeekKey();
            const week = this.dutyRosterWeeks.find(w => w.id === weekKey);
            if (!week || !week.shifts.length) { this.showNotify('Add at least one shift before publishing.'); return; }
            if (!await this.askConfirm({
                title: 'Publish this week\'s roster?',
                message: 'Every internal staff member will be able to see this week\'s shifts and who is assigned to them.',
                confirmLabel: 'Yes, Publish'
            })) return;
            try {
                await setDoc(doc(db, 'duty_roster', weekKey), {
                    status: 'Published',
                    publishedAt: new Date().toISOString(), publishedByUid: this.userProfile.uid, publishedByName: this.userProfile.name
                }, { merge: true });
                this.logAudit('UPDATE', `Published duty roster for week ${weekKey}`);
                this.showNotify('Roster published.');
                this.notifyAssignedStaffOfPublishedRoster(weekKey, week);
            } catch (error) {
                console.error('Publish roster failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'publish this roster'));
            }
        },
        // Fire-and-forget, same as every other notifyByEmail() call in this
        // app — reuses the existing /api/notify endpoint (which writes the
        // in-app bell notification and sends the email), so publishing a
        // roster needs no new API route.
        notifyAssignedStaffOfPublishedRoster(weekKey, week) {
            const empNos = new Set();
            (week.shifts || []).forEach(shift => (shift.assignedEmpNos || []).forEach(empNo => empNos.add(empNo)));
            const emails = [...empNos].map(empNo => this.employees.find(e => e.empNo === empNo)?.email).filter(Boolean);
            if (!emails.length) return;
            this.notifyByEmail({
                to: emails,
                subject: `Duty Roster Published — Week of ${weekKey}`,
                heading: 'New Duty Roster Published',
                message: `The duty roster for the week of ${weekKey} has been published. Open Duty Roster in the portal to see your assigned shifts.`,
                ctaLabel: 'View Duty Roster'
            });
        }
};
