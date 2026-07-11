import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout'
import { ClientForm } from '@/features/clients/components/client-form'

export const metadata: Metadata = {
  title: 'New Client',
}

export default function NewClientPage() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-1">
        <Link
          href="/clients"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Clients
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New Client</h1>
        <p className="text-sm text-muted-foreground">
          Add a new client to your organization.
        </p>
      </div>

      <div className="max-w-2xl">
        <ClientForm />
      </div>
    </PageContainer>
  )
}
