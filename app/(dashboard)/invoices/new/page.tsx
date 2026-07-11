import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout'
import { InvoiceForm } from '@/features/invoices/components'
import { getInvoiceUserRole } from '@/features/invoices/actions'
import { canCreateInvoice } from '@/lib/permissions'
import { getClientOptions } from '@/features/clients/actions'
import { getOrgDefaultsAction } from '@/features/settings/actions'
import { createClient } from '@/supabase/server'

export const metadata: Metadata = { title: 'New Invoice' }

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

export default async function NewInvoicePage() {
  const [role, clients, orgId, orgDefaults] = await Promise.all([
    getInvoiceUserRole(),
    getClientOptions(),
    getOrgId(),
    getOrgDefaultsAction(),
  ])

  if (!role || !canCreateInvoice(role)) {
    redirect('/invoices')
  }

  return (
    <PageContainer
      title="New Invoice"
      description="Create a new invoice for a client."
    >
      <div className="max-w-3xl">
        <InvoiceForm
          mode="create"
          clients={clients}
          orgId={orgId!}
          defaultCurrency={orgDefaults?.default_currency}
          defaultPaymentTermsDays={orgDefaults?.default_payment_terms_days}
        />
      </div>
    </PageContainer>
  )
}
