import { requireManagerRole } from '@/lib/route-guard'

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  await requireManagerRole()
  return <>{children}</>
}
