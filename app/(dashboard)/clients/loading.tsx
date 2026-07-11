import { PageContainer } from '@/components/layout'
import { ClientLoadingSkeleton } from '@/features/clients/components/client-loading-skeleton'

export default function ClientsLoading() {
  return (
    <PageContainer title="Clients">
      <ClientLoadingSkeleton />
    </PageContainer>
  )
}
