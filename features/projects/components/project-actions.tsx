'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Edit, Archive, RotateCcw, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { restoreProjectAction } from '../actions'
import { ProjectArchiveDialog } from './project-archive-dialog'
import { canEditProject, canArchiveProject } from '@/lib/permissions'
import type { ProjectWithClient } from '@/types/project'
import type { OrgRole } from '@/types/supabase'

export function ProjectActions({
  project,
  userRole,
}: {
  project:  ProjectWithClient
  userRole: OrgRole | null
}) {
  const role = userRole ?? 'member'
  const router = useRouter()
  const [showArchive, setShowArchive] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  async function handleRestore() {
    setIsRestoring(true)
    try {
      const result = await restoreProjectAction(project.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`"${project.name}" restored.`)
      router.refresh()
    } catch {
      toast.error('Failed to restore project. Please try again.')
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {project.status !== 'archived' && canEditProject(role) && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${project.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      )}

      {canArchiveProject(role) && (
        project.status === 'archived' ? (
          <Button variant="outline" size="sm" onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {isRestoring ? 'Restoring…' : 'Restore'}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchive(true)}
            className="text-destructive hover:text-destructive"
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
        )
      )}

      <ProjectArchiveDialog
        project={project}
        open={showArchive}
        onOpenChange={setShowArchive}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
