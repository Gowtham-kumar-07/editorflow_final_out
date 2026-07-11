import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Calendar, DollarSign, User, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'

import { getProject, getUserRole } from '@/features/projects/actions'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ProjectStatusSelector } from '@/features/projects/components/project-status-selector'
import { ProjectPriorityBadge } from '@/features/projects/components/project-priority-badge'
import { ProjectProgress }     from '@/features/projects/components/project-progress'
import { ProjectActions }      from '@/features/projects/components/project-actions'
import { ProjectStats }        from '@/features/projects/components/workspace/project-stats'
import { ProjectTasksPreview } from '@/features/projects/components/workspace/project-tasks-preview'
import { ProjectTeamCard }     from '@/features/projects/components/workspace/project-team-card'
import { ProjectActivityCard } from '@/features/projects/components/workspace/project-activity-card'
import { formatDate, formatCurrency } from '@/utils/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await getProject(id)
  return { title: project?.name ?? 'Project' }
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [project, userRole] = await Promise.all([getProject(id), getUserRole()])
  if (!project) notFound()

  const dueDate   = project.due_date ? new Date(project.due_date) : null
  const isOverdue =
    dueDate !== null &&
    dueDate.getTime() < Date.now() &&
    !['completed', 'cancelled', 'archived'].includes(project.status)

  return (
    <PageContainer>
      <Link
        href="/projects"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <ProjectStatusSelector
              projectId={id}
              initialStatus={project.status}
              userRole={userRole}
            />
            <ProjectPriorityBadge priority={project.priority} />
          </div>
          {project.client && (
            <Link
              href={`/clients/${project.client.id}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <User className="h-3.5 w-3.5" />
              {project.client.company_name}
            </Link>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDate(project.created_at)} · Updated {formatDate(project.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {project.project_files_url && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={project.project_files_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Project Files
              </a>
            </Button>
          )}
          <ProjectActions project={project} userRole={userRole} />
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{project.progress}%</span>
          </div>
          <div className="mt-2">
            <ProjectProgress value={project.progress} />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.description ? (
                <p className="text-sm whitespace-pre-wrap">{project.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow icon={Calendar} label="Start Date">
                  {project.start_date ? formatDate(project.start_date) : '—'}
                </DetailRow>
                <DetailRow icon={Calendar} label="Due Date">
                  {project.due_date ? (
                    <span
                      className={
                        isOverdue ? 'font-medium text-red-600 dark:text-red-400' : ''
                      }
                    >
                      {formatDate(project.due_date)}
                      {isOverdue && ' (overdue)'}
                    </span>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow icon={DollarSign} label="Budget">
                  {project.budget !== null ? formatCurrency(Number(project.budget)) : '—'}
                </DetailRow>
              </div>
            </CardContent>
          </Card>

          {/* Tasks preview — React Query client component */}
          <ProjectTasksPreview projectId={id} />

          {/* Activity — React Query client component */}
          <ProjectActivityCard projectId={id} />
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Stats — React Query client component */}
          <ProjectStats projectId={id} />

          {/* Team — React Query client component */}
          <ProjectTeamCard projectId={id} />
        </div>
      </div>
    </PageContainer>
  )
}
