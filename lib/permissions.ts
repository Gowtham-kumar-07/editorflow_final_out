import type { OrgRole, TaskStatus, ProjectStatus, InvoiceStatus } from '@/types/supabase'

// ─── Organization ─────────────────────────────────────────────────────────────

export function canManageOrganization(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canDeleteResource(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canInviteMembers(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageBilling(role: OrgRole): boolean {
  return role === 'owner'
}

export function canEditSettings(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageTeam(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

// ─── Task workflow ────────────────────────────────────────────────────────────

/** owner / admin / project_manager can give final approval (REVIEW → COMPLETED). */
export function canApproveTask(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

const ELEVATED_TASK_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  todo:        ['in_progress'],
  in_progress: ['review', 'todo', 'blocked'],
  review:      ['completed', 'in_progress'],
  completed:   ['in_progress'],
  blocked:     ['todo', 'in_progress'],
}

/** Transitions available to the assigned member (non-elevated). */
const MEMBER_TASK_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus[]>> = {
  todo:        ['in_progress'],
  in_progress: ['review'],
  review:      ['in_progress'],
}

export function getAllowedTaskTransitions(
  currentStatus: TaskStatus,
  userRole: OrgRole,
  isAssignee: boolean
): TaskStatus[] {
  if (userRole === 'owner' || userRole === 'admin' || userRole === 'project_manager') {
    return ELEVATED_TASK_TRANSITIONS[currentStatus] ?? []
  }
  if (!isAssignee) return []
  return MEMBER_TASK_TRANSITIONS[currentStatus] ?? []
}

export function canTransitionTaskStatus({
  currentStatus,
  nextStatus,
  userRole,
  isAssignee,
}: {
  currentStatus: TaskStatus
  nextStatus:    TaskStatus
  userRole:      OrgRole
  isAssignee:    boolean
}): { allowed: boolean; reason?: string } {
  if (nextStatus === 'completed' && !canApproveTask(userRole)) {
    return { allowed: false, reason: 'Only admins and project managers can approve and complete tasks.' }
  }
  if (!canApproveTask(userRole) && !isAssignee) {
    return { allowed: false, reason: 'You must be assigned to this task to update its status.' }
  }
  const allowed = getAllowedTaskTransitions(currentStatus, userRole, isAssignee)
  if (allowed.includes(nextStatus)) return { allowed: true }
  return {
    allowed: false,
    reason: `Cannot move from "${currentStatus}" to "${nextStatus}".`,
  }
}

// ─── Project management ───────────────────────────────────────────────────────

export function canCreateProject(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canEditProject(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canArchiveProject(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

// ─── Task management ──────────────────────────────────────────────────────────

export function canCreateTask(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canEditTask(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canArchiveTask(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

// ─── Project status ───────────────────────────────────────────────────────────

/** owner / admin / project_manager may change project status. */
export function canChangeProjectStatus(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

const PROJECT_TRANSITIONS: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
  draft:     ['planning', 'active'],
  planning:  ['active', 'on_hold', 'cancelled'],
  active:    ['planning', 'on_hold', 'review', 'completed', 'cancelled'],
  on_hold:   ['active', 'cancelled'],
  review:    ['active', 'on_hold', 'completed'],
  completed: ['active'],
  cancelled: ['planning', 'active'],
}

export function getAllowedProjectStatusTransitions(
  currentStatus: ProjectStatus
): ProjectStatus[] {
  return PROJECT_TRANSITIONS[currentStatus] ?? []
}

// ─── Invoice management ───────────────────────────────────────────────────────
// Members are excluded from all invoice access (financial data).

export function canViewInvoices(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canCreateInvoice(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canEditInvoice(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canTransitionInvoiceStatus(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

export function canCancelInvoice(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

// ─── Payment permissions ──────────────────────────────────────────────────────

/** owner / admin / project_manager can record a payment. */
export function canRecordPayment(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

/** Only owner / admin can void (reverse) a payment. */
export function canVoidPayment(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canViewPayments(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

// ─── Reports ──────────────────────────────────────────────────────────────────

/** owner / admin / project_manager can view reports. Members are excluded. */
export function canViewReports(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

/** Financial reports (revenue, receivables, clients) are owner/admin only. */
export function canViewFinancialReports(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin'
}

// ─── Payroll permissions ──────────────────────────────────────────────────────

/** owner / admin / project_manager can mark income as paid and view full payroll. */
export function canManagePayroll(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'project_manager'
}

// ── Invoice status transition map (client-side guard — RPC enforces server-side) ──

const INVOICE_TRANSITIONS: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
  draft:   ['sent', 'cancelled'],
  sent:    ['overdue', 'cancelled'],
  overdue: ['cancelled'],
  partial: ['cancelled'],
}

export function getAllowedInvoiceStatusTransitions(
  currentStatus: InvoiceStatus
): InvoiceStatus[] {
  return INVOICE_TRANSITIONS[currentStatus] ?? []
}
