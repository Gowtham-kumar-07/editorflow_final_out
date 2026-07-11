import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { InvoiceListView } from '@/features/invoices/components'
import { getInvoiceUserRole } from '@/features/invoices/actions'
import { canViewInvoices, canCreateInvoice } from '@/lib/permissions'
import { createClient } from '@/supabase/server'

export const metadata: Metadata = { title: 'Invoices' }

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

export default async function InvoicesPage() {
  const [role, orgId] = await Promise.all([getInvoiceUserRole(), getOrgId()])

  if (!role || !canViewInvoices(role)) {
    redirect('/dashboard')
  }

  return (
    <PageContainer
      title="Invoices"
      description="Create and manage client invoices."
      actions={
        canCreateInvoice(role!) ? (
          <Button asChild size="sm">
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        ) : undefined
      }
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>}>
        <InvoiceListView orgId={orgId!} />
      </Suspense>
    </PageContainer>
  )
}
