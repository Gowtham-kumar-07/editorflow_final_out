'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { recordPaymentAction } from '../actions'
import { getFxPreviewAction } from '@/features/fx/actions'
import { recordPaymentSchema, PAYMENT_METHODS } from '../schema'
import { PAYMENT_METHOD_LABELS } from '../types'
import type { RecordPaymentInput } from '../schema'
import type { PaymentMethod } from '../types'
import { formatCurrency } from '@/utils/format'
import type { FxPreview } from '@/features/fx/actions'

interface Props {
  invoiceId:  string
  balanceDue: number
  currency?:  string
}

export function RecordPaymentDialog({ invoiceId, balanceDue, currency = 'USD' }: Props) {
  const router                = useRouter()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [fxPreview, setFxPreview] = useState<FxPreview | null>(null)

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount:          balanceDue,
      payment_date:    new Date().toISOString().split('T')[0],
      payment_method:  'bank_transfer',
      transaction_ref: '',
      notes:           '',
    },
  })

  // Fetch FX preview once when dialog opens
  useEffect(() => {
    if (!open) return
    getFxPreviewAction(invoiceId).then(setFxPreview).catch(() => {})
  }, [open, invoiceId])

  const watchedAmount = form.watch('amount')
  const showFx = fxPreview && fxPreview.transaction_currency !== fxPreview.base_currency

  async function onSubmit(values: RecordPaymentInput) {
    setLoading(true)
    const result = await recordPaymentAction(invoiceId, values)
    setLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Payment recorded successfully')
    setOpen(false)
    form.reset()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Balance due: <strong>{formatCurrency(balanceDue, currency)}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FX preview — only shown when invoice currency ≠ org base currency */}
            {showFx && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground/80">Currency Conversion</p>
                <p>
                  Rate: 1 {fxPreview.transaction_currency} ≈ {fxPreview.rate.toFixed(4)} {fxPreview.base_currency}
                  {fxPreview.source === 'fallback_1' && (
                    <span className="ml-1 text-amber-600">(live rate unavailable)</span>
                  )}
                </p>
                <p>
                  Estimated base amount:{' '}
                  <strong>
                    {formatCurrency(
                      Math.round(watchedAmount * fxPreview.rate * 100) / 100,
                      fxPreview.base_currency
                    )}
                  </strong>
                  <span className="ml-1 opacity-60">(rate locked at submission)</span>
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m as PaymentMethod]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_ref"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Reference <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="UTR / Transaction ID / Cheque no." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Any additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
