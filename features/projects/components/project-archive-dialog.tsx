'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { archiveProjectAction } from '../actions'
import type { ProjectWithClient } from '@/types/project'

type ProjectArchiveDialogProps = {
  project: ProjectWithClient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProjectArchiveDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ProjectArchiveDialogProps) {
  const [isArchiving, setIsArchiving] = useState(false)

  async function handleConfirm() {
    if (!project) return
    setIsArchiving(true)
    try {
      const result = await archiveProjectAction(project.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`"${project.name}" archived.`)
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('Failed to archive project. Please try again.')
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive &ldquo;{project?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This project will be hidden from your active list. You can restore it at any time from
            the Archived view.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isArchiving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isArchiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isArchiving ? 'Archiving…' : 'Archive'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
