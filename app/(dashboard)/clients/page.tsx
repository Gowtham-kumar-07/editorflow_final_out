import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Suspense } from 'react'
import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ClientListView } from '@/features/clients/components/client-list-view'
import { ClientLoadingSkeleton } from '@/features/clients/components/client-loading-skeleton'

export const metadata: Metadata = {
  title: 'Clients',
}

export default function ClientsPage() {
  return (
    <PageContainer
      title="Clients"
      actions={
        <Button asChild size="sm">
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<ClientLoadingSkeleton />}>
        <ClientListView />
      </Suspense>
    </PageContainer>
  )
}
