'use client'

import Link from 'next/link'
import { ArrowRight, FolderKanban, Plus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectStatusBadge } from '@/features/projects/components/project-status-badge'
import { ProjectProgress } from '@/features/projects/components/project-progress'
import { useClientProjects } from '../hooks/use-client-detail'

function ProjectsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md p-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface ClientProjectsCardProps {
  clientId: string
}

export function ClientProjectsCard({ clientId }: ClientProjectsCardProps) {
  const { data: projects, isLoading, isError } = useClientProjects(clientId)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Projects</CardTitle>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/projects/new?client_id=${clientId}`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <ProjectsSkeleton />}

        {isError && (
          <p className="text-sm text-destructive">Failed to load projects.</p>
        )}

        {!isLoading && !isError && projects?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No projects yet</p>
          </div>
        )}

        {!isLoading && !isError && projects && projects.length > 0 && (
          <div className="space-y-1">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
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
