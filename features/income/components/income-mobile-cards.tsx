'use client'

import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { formatDate } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { IncomeStatusBadge } from './income-status-badge'
import { MarkPaidDialog } from './mark-paid-dialog'
import type { IncomeListItem } from '../types'

interface IncomeMobileCardsProps {
  items:     IncomeListItem[]
  canManage: boolean
}

function fmtAmt(n: number, currency: string) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function IncomeMobileCards({ items, canManage }: IncomeMobileCardsProps) {
  const [dialogItem, setDialogItem] = useState<IncomeListItem | null>(null)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Banknote}
        title="No income records"
        description="Income records appear here as tasks are completed and marked as paid."
      />
    )
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => {
          const hasConversion =
            item.converted_amount != null &&
            item.member_currency  != null &&
            item.original_currency != null &&
            item.member_currency !== item.original_currency

          return (
            <Card key={item.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {canManage && (
                      <p className="font-medium text-sm truncate">{item.member_name ?? '—'}</p>
                    )}
                    <p className="text-sm truncate">{item.task_title ?? '—'}</p>
                    {item.project_name && (
                      <p className="text-xs text-muted-foreground truncate">{item.project_name}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {hasConversion && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {fmtAmt(item.original_amount!, item.original_currency!)}
                      </p>
                    )}
                    <p className="font-mono font-semibold text-sm">
                      {hasConversion
                        ? fmtAmt(item.converted_amount!, item.member_currency!)
                        : fmtAmt(item.converted_amount ?? item.original_amount ?? item.amount, item.member_currency ?? item.original_currency ?? item.currency)}
                    </p>
                    <IncomeStatusBadge status={item.status} />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Completed {formatDate(item.completed_at)}</span>
                  {item.paid_at && <span>Paid {formatDate(item.paid_at)}</span>}
                  {canManage && item.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      onClick={() => setDialogItem(item)}
                    >
                      Mark Paid
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {dialogItem && (
        <MarkPaidDialog
          item={dialogItem}
          open={!!dialogItem}
          onClose={() => setDialogItem(null)}
        />
      )}
    </>
  )
}
