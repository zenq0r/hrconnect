// Employee records and the identity references that follow an employee around
// the rest of the portal.
import {
    db,
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    writeBatch,
    query,
    where
} from "../../firebase-config.js";
export const hrMethods = {

        openEmployeeModal(emp = null) {
            if (!this.canManageEmployees) { this.showNotify('You do not have permission to update employee records.'); return; }
            const sensitiveFields = ['ic', 'bankAcc', 'epfNo', 'socsoNo', 'eisNo', 'taxNo'];
            if (emp) {
                this.employeeModal.isEdit = true;
                this.employeeModal.form = JSON.parse(JSON.stringify(emp));
                this.employeeModal.originalSensitive = Object.fromEntries(sensitiveFields.map(field => [field, emp[field] || '']));
                sensitiveFields.forEach(field => { this.employeeModal.form[field] = ''; });
            } else {
                this.employeeModal.isEdit = false;
                this.employeeModal.originalSensitive = {};
                this.employeeModal.form = { empNo: 'ZEN-HR' + String(Math.floor(1000+Math.random()*9000)), name: '', email: '', ic: '', dept: '', position: '', employmentType: 'Probation', status: 'Aktif', epfNo: '', socsoNo: '', eisNo: '', taxNo: '', bankAcc: '', isSenior: false, joinDate: new Date().toISOString().substr(0,10), basicSalary: 0, allowance: 0, deduction: 0 };
            }
            this.employeeModal.show = true;
        },
        async saveEmployee() {
            try {
                if (!this.canManageSensitiveData) { this.showNotify('Only HR, Superadmin and Director can update sensitive employee information.'); return; }
                const form = this.employeeModal.form;
                Object.assign(form, this.normalizeOfficialRecord(form));
                form.email = String(form.email || '').trim().toLowerCase();
                const sensitiveFields = ['ic', 'bankAcc', 'epfNo', 'socsoNo', 'eisNo', 'taxNo'];
                if (!form.empNo || !form.name || !form.dept || !form.joinDate || !form.employmentType) return this.showNotify("Complete the required Basic Information fields.");
                if (!this.employeeModal.isEdit && !form.ic) return this.showNotify("National ID / Passport is required for a new employee.");
                form.email = String(form.email || '').trim().toLowerCase();
                if (sensitiveFields.some(field => /^X{5}/i.test(String(form[field] || '').trim()))) return this.showNotify("Enter the complete sensitive number, not a masked value.");
                // National ID/Passport, Bank Account and EPF/SOCSO can only be set once at
                // creation — once the employee record already exists, changing them is
                // Superadmin/Director only (the inputs are also disabled for anyone else on
                // an existing record; this is the server-side-facing guard in case of a
                // direct API call). Leaving a field blank always means "keep unchanged" and
                // is never blocked, matching the existing masked-placeholder UX.
                const lockedFields = ['ic', 'bankAcc', 'epfNo', 'socsoNo'];
                if (this.employeeModal.isEdit && !this.canEditLockedIdentityFields &&
                    lockedFields.some(field => String(form[field] || '').trim() && String(form[field] || '').trim() !== String(this.employeeModal.originalSensitive[field] || '').trim())) {
                    return this.showNotify('Only Superadmin and Director may change National ID/Passport, Bank Account or EPF/SOCSO on an existing employee record.');
                }
                sensitiveFields.forEach(field => {
                    if (this.employeeModal.isEdit && !String(form[field] || '').trim()) form[field] = this.employeeModal.originalSensitive[field] || '';
                });
                const employeeId = form.empNo.trim();
                const wasEdit = this.employeeModal.isEdit;
                await setDoc(doc(db, "employees", employeeId), { ...form, empNo: employeeId }, { merge: true });
                if (wasEdit) await this.syncEmployeeIdentityReferences({ ...form, empNo: employeeId });
                this.employeeModal.show = false; this.logAudit(wasEdit ? 'UPDATE':'CREATE', `Saved employee ${employeeId}`); this.showNotify(wasEdit ? 'Employee and linked records updated.' : 'Employee data saved!');
            } catch (error) { console.error('Employee save failed:', error); this.showNotify('Unable to save employee information.'); }
        },
        async syncEmployeeIdentityReferences(employee) {
            const employeeId = String(employee.empNo || '').trim();
            if (!employeeId) throw new Error('Employee ID is required to synchronize linked records.');

            // Projects stay live (an active PIC assignment should always show current
            // identity), but claims/vouchers/payslips are point-in-time payroll and
            // audit records: once a claim/voucher is Approved (or a payslip is issued
            // at all — this app has no "draft" payslip state, every payslip record IS
            // the issued document), it must keep showing the employee's name/position/
            // department exactly as they were on that date. Retroactively rewriting an
            // approved claim or an old payslip just because the employee was later
            // promoted or moved departments would falsify the historical record — so
            // only still-pending claims/vouchers are synced, and payslips are never
            // touched by this cascade at all.
            // employees/{empNo} (this HR record) and users/{uid} (the same person's portal
            // login/access record, if they have one) are separate documents — editing the
            // employee's name here does NOT touch users/{uid}.name on its own. That divorce
            // is what left approverNameLive() (Approval Workflow, Approved/Rejected by)
            // showing a stale name after an HR edit: it reads live from `this.users`, which
            // is sourced from users/{uid}, not from employees/{empNo}. Bridge them by email.
            const normalizedEmail = String(employee.email || '').trim().toLowerCase();
            const [claimsSnapshot, vouchersSnapshot, projectsSnapshot, usersSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'claims'), where('empNo', '==', employeeId))),
                getDocs(query(collection(db, 'payment_vouchers'), where('empNo', '==', employeeId))),
                getDocs(query(collection(db, 'projects'), where('ownerEmpNo', '==', employeeId))),
                normalizedEmail ? getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail))) : Promise.resolve(null)
            ]);
            const writes = [];
            claimsSnapshot.forEach(record => {
                if (record.data().status === 'Approved') return;
                writes.push({
                    ref: record.ref,
                    data: {
                        name: employee.name || '',
                        position: employee.position || '',
                        dept: employee.dept || '',
                        empEmail: employee.email || ''
                    }
                });
            });
            vouchersSnapshot.forEach(record => {
                if (record.data().status === 'Approved') return;
                writes.push({
                    ref: record.ref,
                    data: {
                        name: employee.name || '',
                        position: employee.position || '',
                        dept: employee.dept || '',
                        empEmail: employee.email || ''
                    }
                });
            });
            projectsSnapshot.forEach(record => writes.push({
                ref: record.ref,
                data: {
                    ownerName: employee.name || '',
                    ownerEmail: String(employee.email || '').trim().toLowerCase(),
                    ownerPosition: employee.position || '',
                    ownerDepartment: employee.dept || ''
                }
            }));
            // Name only — role and email stay untouched here, and firestore.rules
            // only grants HR write access to exactly this one field on someone else's
            // users/{uid} record (see the users match block), matching this cascade's scope.
            if (employee.name && usersSnapshot) usersSnapshot.forEach(record => writes.push({ ref: record.ref, data: { name: employee.name } }));

            for (let start = 0; start < writes.length; start += 450) {
                const batch = writeBatch(db);
                writes.slice(start, start + 450).forEach(item => batch.update(item.ref, item.data));
                await batch.commit();
            }
        },
        // ONE-TIME ADMIN MIGRATION: move legacy Payment Voucher records that still live inside the
        // shared 'claims' collection into their own dedicated 'payment_vouchers' collection. Each
        // record is copied to its new home and only then deleted from 'claims' inside a single atomic
        // batch, so a mid-way failure (e.g. rules not deployed yet) leaves the original data untouched.
        async migrateLegacyPaymentVouchers() {
            if (!['Superadmin', 'Director'].includes(this.userProfile.role)) { this.showNotify('Only Superadmin and Director can run this migration.'); return; }
            const legacyVouchers = this.claimsHistory.filter(c => (c.documentType || c.type) === 'Payment Voucher');
            if (!legacyVouchers.length) { this.showNotify('No payment vouchers are still filed under Claims.'); return; }
            if (!await this.askConfirm({
                title: 'Migrate legacy payment vouchers?',
                // Deployment prerequisites are an operator's concern, not the
                // approver's: a failure is reported as one, and nothing is lost.
                message: `${legacyVouchers.length} Payment Voucher record(s) move out of Claims and onto the Payment Vouchers list. Each record is copied first, then removed from Claims — if anything fails, no data is lost.`,
                confirmLabel: 'Yes, Migrate'
            })) return;
            try {
                for (let start = 0; start < legacyVouchers.length; start += 400) {
                    const batch = writeBatch(db);
                    legacyVouchers.slice(start, start + 400).forEach(record => {
                        const { id, ...rest } = record;
                        batch.set(doc(db, 'payment_vouchers', id), { ...rest, id, documentType: 'Payment Voucher', type: 'Payment Voucher' }, { merge: true });
                        batch.delete(doc(db, 'claims', id));
                    });
                    await batch.commit();
                }
                this.logAudit('UPDATE', `Migrated ${legacyVouchers.length} legacy Payment Voucher record(s) into the dedicated payment_vouchers collection.`);
                this.showNotify(`${legacyVouchers.length} Payment Voucher record(s) migrated successfully.`);
            } catch (error) {
                console.error('Payment Voucher migration failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'migrate legacy payment vouchers'));
            }
        },
        openEmployeeView(emp) {
            this.employeeView.employee = {
                empNo: emp.empNo || '-', name: emp.name || '-', email: emp.email || '-', position: emp.position || '-', dept: emp.dept || '-',
                employmentType: emp.employmentType || '-', status: emp.status || '-', joinDate: emp.joinDate || '-', isSenior: !!emp.isSenior,
                presenceStatus: this.employeePresenceLabel(emp), presenceDetail: this.employeeLastSeen(emp),
                ic: this.maskSensitive(emp.ic), bankAcc: this.maskSensitive(emp.bankAcc), epfNo: this.maskSensitive(emp.epfNo),
                socsoNo: this.maskSensitive(emp.socsoNo), eisNo: this.maskSensitive(emp.eisNo), taxNo: this.maskSensitive(emp.taxNo),
                basicSalary: this.formatCurrency(emp.basicSalary), allowance: this.formatCurrency(emp.allowance), deduction: this.formatCurrency(emp.deduction)
            };
            this.employeeView.show = true;
        },
        requestEmployeeAction(action, emp) {
            this.employeeActionConfirm = { show: true, action, employee: emp };
        },
        async confirmEmployeeAction() {
            const { action, employee } = this.employeeActionConfirm;
            this.employeeActionConfirm = { show: false, action: '', employee: null };
            if (!employee) return;
            if (action === 'edit') this.openEmployeeModal(employee);
            if (action === 'delete') await this.deleteEmployee(employee.empNo, false);
        },
        employeeActiveProjectAssignments(empNo) {
            return this.projects.filter(project => project.ownerEmpNo === empNo && project.status !== 'Completed & Done');
        },
        employeeActiveActivityAssignments(empNo) {
            return this.projectActivities.filter(activity => activity.assignedEmpNo === empNo && activity.status !== 'Done');
        },
        employeeHasActiveProjectWork(empNo) {
            return this.employeeActiveProjectAssignments(empNo).length > 0 || this.employeeActiveActivityAssignments(empNo).length > 0;
        },
        viewEmployeeProjectAssignments(emp) {
            this.searchQuery = emp.name || emp.empNo;
            this.projectViewMode = 'list';
            this.switchTab('project-activities');
        },
        async deleteEmployee(empNo, requiresConfirmation = true) {
            if (requiresConfirmation) {
                const employee = this.employees.find(emp => emp.empNo === empNo);
                if (employee) this.requestEmployeeAction('delete', employee);
                return;
            }
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete employee records.'); return; }
            const blockingProjects = this.employeeActiveProjectAssignments(empNo);
            const blockingActivities = this.employeeActiveActivityAssignments(empNo);
            if (blockingProjects.length || blockingActivities.length) {
                const parts = [];
                if (blockingProjects.length) parts.push(`Person In Charge on ${blockingProjects.length} active project(s) (${blockingProjects.slice(0, 3).map(p => p.projectRef).join(', ')}${blockingProjects.length > 3 ? '…' : ''})`);
                if (blockingActivities.length) parts.push(`assigned to ${blockingActivities.length} open activity issue(s)`);
                this.showNotify(`Cannot delete: this employee is still ${parts.join(' and ')}. Reassign in Project Activities first.`);
                return;
            }
            try {
                await deleteDoc(doc(db, "employees", empNo));
                this.logAudit('DELETE', `Deleted employee ${empNo}`);
                this.showNotify('Employee deleted.');
            } catch (error) {
                this.showNotify('Unable to delete employee.');
            }
        },
        selectEmployeeFromTable(emp) {
            this.selectedPayEmployeeId = emp.empNo || '';
            this.payForm.empNo = emp.empNo || ''; this.payForm.name = emp.name || ''; this.payForm.empEmail = emp.email || ''; this.payForm.ic = emp.ic || ''; this.payForm.dept = emp.dept || ''; this.payForm.position = emp.position || ''; this.payForm.joinDate = emp.joinDate || ''; this.payForm.bankAcc = emp.bankAcc || ''; this.payForm.isSenior = !!emp.isSenior; this.payForm.epfSocso = `KWSP: ${emp.epfNo || '-'} | PERKESO: ${emp.socsoNo || '-'}`; this.payForm.basic = emp.basicSalary || 0;
            this.autoCalculatePayroll(); this.showNotify(`Employee loaded.`);
        },
        selectEmployeeForPayslip(e) { const emp = this.employees.find(x => x.empNo === e.target.value); if (emp) this.selectEmployeeFromTable(emp); },
        selectEmployeeForClaim(e) { const emp = this.employees.find(x => x.empNo === e.target.value); if (emp) { this.claimForm.name = emp.name||''; this.claimForm.empNo = emp.empNo||''; this.claimForm.empEmail = emp.email||''; this.claimForm.position = emp.position||''; this.claimForm.dept = emp.dept||''; this.showNotify(`Applicant loaded.`); } },
        selectEmployeeForVoucher(e) { const emp = this.employees.find(x => x.empNo === e.target.value); if (emp) { this.voucherForm.name = emp.name||''; this.voucherForm.empNo = emp.empNo||''; this.voucherForm.empEmail = emp.email||''; this.voucherForm.position = emp.position||''; this.voucherForm.dept = emp.dept||''; this.showNotify(`Requested-by staff loaded.`); } }
};