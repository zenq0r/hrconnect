// The right-click / long-press menu, and the action list each kind of row,
// card or button contributes to it.
import { LONGPRESS_THRESHOLD_MS, LONGPRESS_MOVE_TOLERANCE_PX } from "../directives/longpress.js";
export const contextMenuMethods = {
        // Generic context menu — desktop right-click (@contextmenu.prevent) and
        // mobile/tablet long-press (v-longpress directive) both call this with
        // an `items` array of {label, icon, action, danger|undefined} built at
        // the call site; falsy entries (permission-gated out) are dropped here
        // so callers can just write `condition ? {...} : null` inline, matching
        // the exact same v-if the row's visible action buttons already use.
        // `event` may be a real MouseEvent (right-click) or a Touch object
        // (long-press) — both expose clientX/clientY, which is all this needs.
        openContextMenu(event, items) {
            const validItems = (items || []).filter(Boolean);
            if (!validItems.length) return;
            const MENU_WIDTH = 208;
            const ROW_HEIGHT = 44;
            const menuHeight = 40 + validItems.length * ROW_HEIGHT;
            const x = Math.max(8, Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8));
            const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));
            this.contextMenu = { show: true, x, y, items: validItems };
        },
        getButtonContextLabel(button) {
            const rawLabel = button?.getAttribute('aria-label') || button?.getAttribute('title') || button?.innerText || button?.textContent || 'Button';
            const label = String(rawLabel).replace(/\s+/g, ' ').trim();
            return label.length > 46 ? `${label.slice(0, 43)}…` : (label || 'Button');
        },
        isButtonContextEligible(button) {
            return !!(button && this.$el?.contains(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !button.closest('.zq-context-menu'));
        },
        openButtonContextMenu(event, button) {
            if (!this.isButtonContextEligible(button)) return;
            const label = this.getButtonContextLabel(button);
            this.openContextMenu(event, [
                { label: `Use: ${label}`, icon: 'fa-arrow-pointer', action: () => button.click() },
                { label: 'Copy action name', icon: 'fa-copy', action: () => this.copyButtonContextLabel(label) }
            ]);
        },
        async copyButtonContextLabel(label) {
            try {
                await navigator.clipboard.writeText(label);
                this.showNotify(`Copied action: ${label}`);
            } catch (error) {
                this.showNotify(`Action: ${label}`);
            }
        },
        clearButtonContextLongPress() {
            if (this.buttonContextLongPress.timer) clearTimeout(this.buttonContextLongPress.timer);
            this.buttonContextLongPress = { timer: null, startX: 0, startY: 0, button: null };
        },
        installUniversalButtonContextMenu() {
            const findButton = (target) => target instanceof Element ? target.closest('button, [role="button"]') : null;
            this.buttonContextHandlers.contextmenu = (event) => {
                const button = findButton(event.target);
                if (!this.isButtonContextEligible(button)) return;
                event.preventDefault();
                event.stopPropagation();
                this.openButtonContextMenu(event, button);
            };
            this.buttonContextHandlers.touchstart = (event) => {
                const button = findButton(event.target);
                if (!this.isButtonContextEligible(button) || !event.touches || event.touches.length !== 1) return;
                const touch = event.touches[0];
                event.stopPropagation();
                this.clearButtonContextLongPress();
                this.buttonContextLongPress = { timer: null, startX: touch.clientX, startY: touch.clientY, button };
                this.buttonContextLongPress.timer = setTimeout(() => {
                    const heldButton = this.buttonContextLongPress.button;
                    const heldTouch = { clientX: this.buttonContextLongPress.startX, clientY: this.buttonContextLongPress.startY };
                    this.clearButtonContextLongPress();
                    if (!this.isButtonContextEligible(heldButton)) return;
                    const suppressClick = (clickEvent) => { clickEvent.preventDefault(); clickEvent.stopImmediatePropagation(); };
                    heldButton.addEventListener('click', suppressClick, { capture: true, once: true });
                    setTimeout(() => heldButton.removeEventListener('click', suppressClick, { capture: true }), 500);
                    this.openButtonContextMenu(heldTouch, heldButton);
                }, LONGPRESS_THRESHOLD_MS);
            };
            this.buttonContextHandlers.touchmove = (event) => {
                if (!this.buttonContextLongPress.timer) return;
                const touch = event.touches && event.touches[0];
                if (!touch || Math.abs(touch.clientX - this.buttonContextLongPress.startX) > LONGPRESS_MOVE_TOLERANCE_PX || Math.abs(touch.clientY - this.buttonContextLongPress.startY) > LONGPRESS_MOVE_TOLERANCE_PX) this.clearButtonContextLongPress();
            };
            this.buttonContextHandlers.touchend = () => this.clearButtonContextLongPress();
            this.$el.addEventListener('contextmenu', this.buttonContextHandlers.contextmenu, true);
            this.$el.addEventListener('touchstart', this.buttonContextHandlers.touchstart, true);
            this.$el.addEventListener('touchmove', this.buttonContextHandlers.touchmove, true);
            this.$el.addEventListener('touchend', this.buttonContextHandlers.touchend, true);
            this.$el.addEventListener('touchcancel', this.buttonContextHandlers.touchend, true);
        },
        removeUniversalButtonContextMenu() {
            this.clearButtonContextLongPress();
            if (!this.$el) return;
            const handlers = this.buttonContextHandlers;
            if (handlers.contextmenu) this.$el.removeEventListener('contextmenu', handlers.contextmenu, true);
            if (handlers.touchstart) this.$el.removeEventListener('touchstart', handlers.touchstart, true);
            if (handlers.touchmove) this.$el.removeEventListener('touchmove', handlers.touchmove, true);
            if (handlers.touchend) {
                this.$el.removeEventListener('touchend', handlers.touchend, true);
                this.$el.removeEventListener('touchcancel', handlers.touchend, true);
            }
            this.buttonContextHandlers = { contextmenu: null, touchstart: null, touchmove: null, touchend: null };
        },
        closeContextMenu() {
            this.contextMenu.show = false;
        },
        runContextMenuAction(item) {
            this.closeContextMenu();
            if (item && typeof item.action === 'function') item.action();
        },
        viewClientBoard(cust) {
            if (!this.canOpenClientTaskBoard) {
                this.showNotify('You do not have access to Project Activities.');
                return;
            }
            if (!cust?.id || !cust.clientTaskCreatedAt) {
                this.showNotify('Register this client in Client Task before viewing Project Activities.');
                return;
            }
            this.boardClientFilter = { id: cust.id, name: cust.clientName || 'Unknown Client' };
            this.switchTab('project-activities');
        },
        // Shared by the card's @contextmenu.prevent AND v-longpress bindings —
        // one items builder per row type so both desktop and mobile/tablet
        // reach the exact same actions/permissions, defined once.
        clientTaskMenuItems(cust) {
            return [
                this.canOpenClientTaskBoard ? { label: 'View Board', icon: 'fa-table-columns', action: () => this.viewClientBoard(cust) } : null,
                { label: 'View Client Information', icon: 'fa-circle-info', action: () => this.openClientView(cust) },
                this.canDelete ? { label: 'Delete Client Task and Projects', icon: 'fa-trash', danger: true, action: () => this.requestDeleteClientTask(cust) } : null
            ];
        },
        // Shared by the board card (grouped + drilled-down variants) and the
        // list-view row — stageIndex is omitted for the list row, which has no
        // Move actions (no stage columns to move between there).
        projectCardMenuItems(project, stageIndex) {
            const items = [
                { label: 'View Details', icon: 'fa-eye', action: () => this.openProjectDetails(project) }
            ];
            if (this.canEditProject(project)) {
                items.push({ label: 'Edit Project', icon: 'fa-pen', action: () => this.openProjectModal(project) });
                if (typeof stageIndex === 'number') {
                    if (stageIndex > 0) items.push({ label: 'Move to Previous Stage', icon: 'fa-arrow-left', action: () => this.moveProject(project, -1) });
                    if (stageIndex < this.projectStages.length - 1) items.push({ label: 'Move to Next Stage', icon: 'fa-arrow-right', action: () => this.moveProject(project, 1) });
                }
                if (project.status !== 'Completed & Done') items.push({ label: 'Assign / Mark Done', icon: 'fa-check', action: () => this.openMarkProjectDoneModal(project) });
            }
            if (this.canManageProjects) items.push({ label: 'Delete Project', icon: 'fa-trash', danger: true, action: () => this.deleteProject(project) });
            return items;
        },
        // One menu-items builder per remaining row/card type that already exposes
        // 2+ inline actions (Claims, Vouchers, Recent Activity, Client Directory,
        // HR Employees, Client Documents, Website Content x2, Portal Access,
        // Project Activity Issues, Client Activity History) — each mirrors that
        // row's existing buttons/v-if gates exactly, no new actions or permissions.
        claimRowMenuItems(clm) {
            return [
                { label: 'View Claim Record', icon: 'fa-eye', action: () => this.viewClaimRecord(clm) },
                this.canEditClaim(clm) ? { label: 'Edit Claim Record', icon: 'fa-pen', action: () => this.editClaimRecord(clm) } : null,
                this.canDelete ? { label: 'Delete Claim Record', icon: 'fa-trash', danger: true, action: () => this.confirmDeleteRecord({ ...clm, isClaim: true }) } : null
            ];
        },
        voucherRowMenuItems(pv) {
            return [
                { label: 'View Voucher Record', icon: 'fa-eye', action: () => this.viewClaimRecord(pv) },
                this.canEditPaymentVoucher(pv) ? { label: 'Edit Voucher Record', icon: 'fa-pen', action: () => this.editPaymentVoucher(pv) } : null,
                this.canDelete ? { label: 'Delete Voucher Record', icon: 'fa-trash', danger: true, action: () => this.confirmDeleteRecord({ ...pv, isVoucher: true }) } : null
            ];
        },
        recentActivityMenuItems(item) {
            return [
                { label: 'View Record', icon: 'fa-eye', action: () => (item.isClaim || item.isVoucher) ? this.viewClaimRecord(item) : this.viewRecord(item) },
                ((item.isDoc && this.canManageDocuments) || (item.isPay && this.canManagePayroll)) ? { label: 'Edit Record', icon: 'fa-pen', action: () => this.editRecord(item) } : null,
                this.canDeleteRecord(item) ? { label: 'Delete Record', icon: 'fa-trash', danger: true, action: () => this.confirmDeleteRecord(item) } : null
            ];
        },
        clientDirectoryRowMenuItems(cust) {
            return [
                { label: 'View Client Information', icon: 'fa-eye', action: () => this.openClientView(cust) },
                this.canManageClients ? { label: 'Edit Client', icon: 'fa-pen', action: () => this.requestClientAction('edit', cust) } : null,
                this.canDeleteClients ? { label: 'Delete Client', icon: 'fa-trash', danger: true, action: () => this.requestClientAction('delete', cust) } : null
            ];
        },
        employeeRowMenuItems(emp) {
            return [
                { label: 'View Employee Information', icon: 'fa-eye', action: () => this.openEmployeeView(emp) },
                this.employeeHasActiveProjectWork(emp.empNo) ? { label: 'View Active Project Assignments', icon: 'fa-diagram-project', action: () => this.viewEmployeeProjectAssignments(emp) } : null,
                this.canManageEmployees ? { label: 'Edit Employee', icon: 'fa-pen', action: () => this.requestEmployeeAction('edit', emp) } : null,
                this.canDeleteEmployees ? { label: 'Delete Employee', icon: 'fa-trash', danger: true, action: () => this.requestEmployeeAction('delete', emp) } : null
            ];
        },
        attendanceRowMenuItems(record) {
            return [
                this.canCorrectAttendance ? { label: 'Correct Attendance', icon: 'fa-pen', action: () => this.openAttendanceCorrectionModal(record) } : null
            ];
        },
        dutyRosterShiftMenuItems(shift) {
            return [
                this.canManageDutyRoster ? { label: 'Edit Shift', icon: 'fa-pen', action: () => this.openDutyRosterModal(shift) } : null,
                this.canManageDutyRoster ? { label: 'Remove Shift', icon: 'fa-trash', danger: true, action: () => this.removeDutyRosterShift(shift) } : null
            ];
        },
        announcementMenuItems(item) {
            return [
                this.canManageAnnouncements ? { label: 'Edit Announcement', icon: 'fa-pen', action: () => this.openAnnouncementModal(item) } : null,
                this.canManageAnnouncements && item.status === 'Active' ? { label: 'Archive Announcement', icon: 'fa-box-archive', action: () => this.archiveAnnouncement(item) } : null,
                this.canManageAnnouncements && item.status === 'Archived' ? { label: 'Restore Announcement', icon: 'fa-rotate-left', action: () => this.restoreAnnouncement(item) } : null,
                this.canDelete ? { label: 'Delete Announcement', icon: 'fa-trash', danger: true, action: () => this.deleteAnnouncement(item) } : null
            ];
        },
        leaveRequestRowMenuItems(record) {
            return [
                this.canEditLeaveRequest(record) ? { label: 'Edit Leave Request', icon: 'fa-pen', action: () => this.editLeaveRequest(record) } : null,
                this.isFullAccessRole ? { label: 'Correct Leave Request', icon: 'fa-pen-to-square', action: () => this.openLeaveCorrectionModal(record) } : null,
                this.canDecideLeaveRequest(record) ? { label: 'Approve', icon: 'fa-circle-check', action: () => this.approveLeaveRequest(record) } : null,
                this.canDecideLeaveRequest(record) ? { label: 'Reject', icon: 'fa-circle-xmark', danger: true, action: () => this.rejectLeaveRequest(record) } : null,
                this.canDelete ? { label: 'Delete Leave Request', icon: 'fa-trash', danger: true, action: () => this.deleteLeaveRequest(record) } : null
            ];
        },
        clientDocumentMenuItems(item) {
            return [
                { label: 'View', icon: 'fa-eye', action: () => this.viewClientDocument(item) },
                { label: 'Download', icon: 'fa-download', action: () => this.downloadClientDocument(item) },
                this.canManageDocuments ? { label: 'Remove', icon: 'fa-trash', danger: true, action: () => this.requestDeleteClientDocument(item) } : null
            ];
        },
        websiteContentMenuItems(item) {
            return [
                this.hasModulePermission('website-content', 'edit') ? { label: 'Edit', icon: 'fa-pen', action: () => this.openWebsiteContentModal(this.websiteContentTab, item) } : null,
                this.hasModulePermission('website-content', 'delete') ? { label: 'Delete', icon: 'fa-trash', danger: true, action: () => this.deleteWebsiteContentItem(this.websiteContentTab, item) } : null
            ];
        },
        siteTextRowMenuItems(row) {
            return [
                this.hasModulePermission('website-content', 'edit') ? { label: 'Edit', icon: 'fa-pen', action: () => this.openSiteTextModal(row) } : null,
                (row.override && this.hasModulePermission('website-content', 'delete')) ? { label: 'Reset to Default', icon: 'fa-rotate-left', danger: true, action: () => this.resetSiteTextOverride(row.key) } : null
            ];
        },
        // Built from the same STAFF_PORTAL_ACTIONS list as the row buttons, so
        // right-clicking a row offers exactly what its buttons offer - never one
        // action more, never one less.
        portalUserRowMenuItems(usr) {
            return this.staffPortalActionsFor(usr).map(action => ({
                label: action.label,
                icon: action.icon,
                danger: action.key === 'delete',
                action: () => this.runStaffPortalAction(action.key, usr)
            }));
        },
        accessRequestRowMenuItems(request) {
            if ((request?.status || 'Pending') !== 'Pending') return [];
            return this.staffPortalRequestActions().map(action => ({
                label: action.label,
                icon: action.icon,
                danger: action.key === 'reject',
                action: () => this.runAccessRequestAction(action.key, request)
            }));
        },
        projectActivityMenuItems(activity) {
            return [
                (activity.status !== 'Done' && this.canCompleteProjectActivity(activity)) ? { label: 'Mark Done', icon: 'fa-check', action: () => this.markProjectActivityDone(activity) } : null,
                this.canEditProjectActivity(activity) ? { label: 'Edit Activity', icon: 'fa-pen', action: () => this.openActivityModal(this.projectPreview.project, activity) } : null,
                this.canDeleteProjectActivity() ? { label: 'Delete Activity', icon: 'fa-trash', danger: true, action: () => this.deleteProjectActivity(activity) } : null
            ];
        },
        clientUpdateMenuItems(update) {
            return [
                (this.canEditClientUpdate(update) && this.editingReplyId !== update.id) ? { label: 'Edit', icon: 'fa-pen', action: () => update.senderRole === 'Client' ? this.startEditReply(update) : this.openClientUpdateModal(this.projectPreview.project, update) } : null,
                this.canDeleteClientUpdate(update) ? { label: 'Delete', icon: 'fa-trash', danger: true, action: () => this.deleteClientUpdate(update) } : null
            ];
        }
};