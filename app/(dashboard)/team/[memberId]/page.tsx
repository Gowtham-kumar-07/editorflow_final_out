import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/supabase/server'
import type { Database } from '@/types/supabase'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { RoleBadge } from '@/features/team/components/role-badge'
import { SpecializationBadge } from '@/features/team/components/specialization-badge'
import type { OrgRole, TeamSpecialization } from '@/features/team/types'

export const metadata: Metadata = { title: 'Team Member' }

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-green-500' : 'bg-muted-foreground'}`}
    />
  )
}

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = await params
  const supabase     = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  // Fetch membership + profile
  const { data: membership, error: mErr } = await supabase
    .from('organization_memberships')
    .select('id, user_id, organization_id, role, specialization, deleted_at, created_at')
    .eq('id', memberId)
    .maybeSingle()

  if (mErr || !membership) return notFound()

  // Verify viewer is in the same org
  const { data: viewerMembership } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', membership.organization_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!viewerMembership) return notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .eq('id', membership.user_id)
    .maybeSingle()

  const isActive = membership.deleted_at === null

  // Fetch open assigned tasks using only valid task_status values
  type TaskStatus = Database['public']['Enums']['task_status']
  const OPEN_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'review']

  const today = new Date().toISOString()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id')
    .eq('organization_id', membership.organization_id)
    .eq('assigned_to', membership.user_id)
    .is('deleted_at', null)
    .in('status', OPEN_STATUSES)
    .order('due_date', { ascending: true, nullsFirst: false })

  const allTasks = tasks ?? []
  const inReview = allTasks.filter((t) => t.status === 'review')
  const active   = allTasks.filter((t) => t.status !== 'review')
  // Overdue: only active-workload statuses (not review tasks)
  const overdue  = active.filter((t) => t.due_date && t.due_date < today)

  const name      = profile?.full_name ?? 'Unknown Member'
  const role      = membership.role as OrgRole
  const spec      = membership.specialization as TeamSpecialization | null

  return (
    <PageContainer>
      <Link
        href="/team"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Team
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <StatusDot active={isActive} />
            <span className="text-sm text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
          </div>
          {profile?.email && (
            <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <RoleBadge role={role} />
            {spec && <SpecializationBadge specialization={spec} />}
          </div>
        </div>
      </div>

      <Separator />

      {/* Workload summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{active.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Active tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{inReview.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">In review</p>
          </CardContent>
        </Card>
        <Card className={overdue.length > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${overdue.length > 0 ? 'text-destructive' : ''}`}>
              {overdue.length}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Task lists */}
      <div className="space-y-4">
        {inReview.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                In Review
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <TaskList tasks={inReview} today={today} />
            </CardContent>
          </Card>
        )}

        {overdue.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <TaskList tasks={overdue} today={today} />
            </CardContent>
          </Card>
        )}

        {active.filter((t) => !overdue.includes(t)).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <TaskList tasks={active.filter((t) => !overdue.includes(t))} today={today} />
            </CardContent>
          </Card>
        )}

        {allTasks.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No active tasks assigned.</p>
          </div>
        )}
      </div>
    </PageContainer>
  )
}

// ─── Task list sub-component ──────────────────────────────────────────────────

type Task = {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
  project_id: string | null
}

function TaskList({ tasks, today }: { tasks: Task[]; today: string }) {
  return (
    <div className="divide-y">
      {tasks.map((task) => {
        const isOverdue = task.due_date && task.due_date < today
        return (
          <div key={task.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <Link
                href={`/tasks/${task.id}`}
                className="text-sm hover:underline truncate block"
              >
                {task.title}
              </Link>
              {task.due_date && (
                <p className={`text-xs mt-0.5 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                  Due {new Date(task.due_date).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {task.priority && (
                <Badge
                  variant="outline"
                  className="text-xs capitalize"
                >
                  {task.priority}
                </Badge>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
