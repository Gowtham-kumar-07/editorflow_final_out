'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, PlusCircle } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { recordPaymentAction } from '../actions'
import { getFxPreviewAction } from '@/features/fx/actions'
import type { FxPreview } from '@/features/fx/actions'
import { recordPaymentSchema, PAYMENT_METHODS } from '../schema'
import { PAYMENT_METHOD_LABELS } from '../types'
import type { RecordPaymentInput } from '../schema'
import type { PaymentMethod } from '../types'
import { useOrgClients, usePayableInvoices } from '../hooks/use-payments'
import { formatCurrency } from '@/utils/format'

type Step = 'client' | 'invoice' | 'form'

interface Props {
  orgId: string
}

export function OrgRecordPaymentDialog({ orgId }: Props) {
  const router = useRouter()

  const [open, setOpen]       = useState(false)
  const [step, setStep]       = useState<Step>('client')
  const [clientId, setClientId]   = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceMeta, setInvoiceMeta] = useState<{
    invoice_number: string; balance_due: number; currency: string
  } | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [fxPreview,  setFxPreview]  = useState<FxPreview | null>(null)

  const { data: clients,  isLoading: clientsLoading  } = useOrgClients(orgId)
  const { data: invoices, isLoading: invoicesLoading } = usePayableInvoices(orgId, clientId)

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount:          0,
      payment_date:    new Date().toISOString().split('T')[0],
      payment_method:  'bank_transfer',
      transaction_ref: '',
      notes:           '',
    },
  })

  function reset() {
    setStep('client')
    setClientId(null)
    setInvoiceId(null)
    setInvoiceMeta(null)
    setFxPreview(null)
    form.reset({
      amount:         0,
      payment_date:   new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      transaction_ref: '',
      notes:          '',
    })
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) reset()
  }

  function handleClientSelect(id: string) {
    setClientId(id)
    setInvoiceId(null)
    setInvoiceMeta(null)
    setStep('invoice')
  }

  function handleInvoiceSelect(id: string) {
    const inv = invoices?.find((i) => i.id === id)
    if (!inv) return
    setInvoiceId(id)
    setInvoiceMeta({ invoice_number: inv.invoice_number, balance_due: inv.balance_due, currency: inv.currency })
    form.setValue('amount', inv.balance_due)
    setFxPreview(null)
    // Fetch FX preview for this invoice asynchronously
    getFxPreviewAction(id).then(setFxPreview).catch(() => {})
    setStep('form')
  }

  async function onSubmit(values: RecordPaymentInput) {
    if (!invoiceId) return
    setLoading(true)
    const result = await recordPaymentAction(invoiceId, values)
    setLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Payment recorded successfully')
    setOpen(false)
    reset()
    router.refresh()
  }

  const clientName = clients?.find((c) => c.id === clientId)?.company_name ?? ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {/* ── Step 1: Select Client ── */}
        {step === 'client' && (
          <>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Step 1 of 3 — Select a client</DialogDescription>
            </DialogHeader>

            {clientsLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !clients?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No clients found.</p>
            ) : (
              <div className="space-y-1.5 py-2 max-h-72 overflow-y-auto">
                {clients.map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-2.5 px-3 text-left"
                    onClick={() => handleClientSelect(c.id)}
                  >
                    {c.company_name}
                  </Button>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 2: Select Invoice ── */}
        {step === 'invoice' && (
          <>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Step 2 of 3 — Select an invoice for <strong>{clientName}</strong>
              </DialogDescription>
            </DialogHeader>

            {invoicesLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !invoices?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No outstanding invoices for this client.
              </p>
            ) : (
              <div className="space-y-1.5 py-2 max-h-72 overflow-y-auto">
                {invoices.map((inv) => (
                  <Button
                    key={inv.id}
                    variant="outline"
                    className="w-full justify-between h-auto py-2.5 px-3 text-left"
                    onClick={() => handleInvoiceSelect(inv.id)}
                  >
                    <span className="font-medium">{inv.invoice_number}</span>
                    <span className="text-sm text-muted-foreground">
                      Balance: {formatCurrency(inv.balance_due, inv.currency)}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setClientId(null); setStep('client') }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 3: Payment form ── */}
        {step === 'form' && invoiceMeta && (
          <>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Step 3 of 3 — {invoiceMeta.invoice_number} &bull;{' '}
                Balance due: <strong>{formatCurrency(invoiceMeta.balance_due, invoiceMeta.currency)}</strong>
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ({invoiceMeta.currency})</FormLabel>
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

                {/* FX preview — only shown when currencies differ */}
                {fxPreview && fxPreview.transaction_currency !== fxPreview.base_currency && (() => {
                  const amount = form.getValues('amount')
                  return (
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
                            Math.round(amount * fxPreview.rate * 100) / 100,
                            fxPreview.base_currency
                          )}
                        </strong>
                        <span className="ml-1 opacity-60">(rate locked at submission)</span>
                      </p>
                    </div>
                  )
                })()}

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
                      <FormLabel>
                        Transaction Reference{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
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
                      <FormLabel>
                        Notes{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Any additional notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('invoice')}
                    disabled={loading}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Record Payment
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
