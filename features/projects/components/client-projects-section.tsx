import Link from 'next/link'
import { Plus, ArrowRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProjectStatusBadge } from './project-status-badge'
import { ProjectProgress } from './project-progress'
import type { ProjectWithClient } from '@/types/project'

type ClientProjectsSectionProps = {
  clientId: string
  projects: ProjectWithClient[]
}

export function ClientProjectsSection({ clientId, projects }: ClientProjectsSectionProps) {
  const active = projects.filter(
    (p) => !['cancelled', 'archived'].includes(p.status)
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Projects</CardTitle>
        <Button size="sm" asChild>
          <Link href={`/projects/new?client_id=${clientId}`}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add Project
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active projects for this client.</p>
        ) : (
          <div className="space-y-3">
            {active.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="mt-1.5">
                    <ProjectProgress value={project.progress} />
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}

            {projects.length > 5 && (
              <Link
                href={`/projects?client_id=${clientId}`}
                className="flex items-center gap-1 pt-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View all {projects.length} projects
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
