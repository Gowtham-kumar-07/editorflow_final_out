import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout'
import { DashboardClient } from '@/features/dashboard/components'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <PageContainer
      title="Dashboard"
      description="Your organization's real-time operational overview."
    >
      <DashboardClient />
    </PageContainer>
  )
}
