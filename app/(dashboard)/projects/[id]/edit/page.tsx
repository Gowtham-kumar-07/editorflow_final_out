import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

import { getProject, getUserRole } from '@/features/projects/actions'
import { getClientOptions } from '@/features/clients/actions'
import { PageContainer } from '@/components/layout'
import { ProjectForm } from '@/features/projects/components/project-form'
import { canEditProject } from '@/lib/permissions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id }    = await params
  const project   = await getProject(id)
  return { title: project ? `Edit · ${project.name}` : 'Edit Project' }
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [project, clientOptions, userRole] = await Promise.all([
    getProject(id),
    getClientOptions(),
    getUserRole(),
  ])

  if (!project) notFound()
  if (!canEditProject(userRole ?? 'member')) redirect(`/projects/${id}`)

  return (
    <PageContainer>
      <Link
        href={`/projects/${id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Project
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the details for <span className="font-medium">{project.name}</span>.
        </p>
      </div>

      <ProjectForm mode="edit" project={project} clients={clientOptions} />
    </PageContainer>
  )
}
