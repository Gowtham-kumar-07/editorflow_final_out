import { redirect } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { getPaymentOrgContext } from '@/features/payments/actions'
import { canViewPayments } from '@/lib/permissions'
import { OrgRecordPaymentDialog } from '@/features/payments/components/org-record-payment-dialog'
import { PaymentsListClient } from '@/features/payments/components/payments-list-client'
import { canRecordPayment } from '@/lib/permissions'

export default async function PaymentsPage() {
  const ctx = await getPaymentOrgContext()

  if (!ctx || !canViewPayments(ctx.role)) {
    redirect('/dashboard')
  }

  const { orgId, role } = ctx

  return (
    <PageContainer
      title="Payments"
      description="Track payment history and transactions."
      actions={
        canRecordPayment(role)
          ? <OrgRecordPaymentDialog orgId={orgId} />
          : undefined
      }
    >
      <PaymentsListClient orgId={orgId} role={role} />
    </PageContainer>
  )
}
