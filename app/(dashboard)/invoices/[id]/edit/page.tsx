import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout'
import { InvoiceForm } from '@/features/invoices/components'
import { getInvoice, getInvoiceUserRole } from '@/features/invoices/actions'
import { canEditInvoice } from '@/lib/permissions'
import { getClientOptions } from '@/features/clients/actions'
import { createClient } from '@/supabase/server'

export const metadata: Metadata = { title: 'Edit Invoice' }

async function getOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.active_organization_id) return profile.active_organization_id
  const { data: mem } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  return mem?.organization_id ?? null
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditInvoicePage({ params }: Props) {
  const { id } = await params
  const [role, invoice, clients, orgId] = await Promise.all([
    getInvoiceUserRole(),
    getInvoice(id),
    getClientOptions(),
    getOrgId(),
  ])

  if (!role || !canEditInvoice(role)) redirect(`/invoices/${id}`)
  if (!invoice) notFound()

  // Only draft invoices are editable
  if (invoice.status !== 'draft') {
    redirect(`/invoices/${id}`)
  }

  return (
    <PageContainer
      title="Edit Invoice"
      description={`Editing ${invoice.invoice_number}`}
    >
      <div className="max-w-3xl">
        <InvoiceForm mode="edit" invoice={invoice} clients={clients} orgId={orgId!} />
      </div>
    </PageContainer>
  )
}
