import { requireManagerRole } from '@/lib/route-guard'

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  await requireManagerRole()
  return <>{children}</>
}
