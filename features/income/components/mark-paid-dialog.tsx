'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { markPaidSchema, type MarkPaidValues } from '../schema'
import { useMarkIncomePaid } from '../hooks/use-income'
import type { IncomeListItem } from '../types'

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'UPI',
  'Cheque',
  'PayPal',
  'Stripe',
  'Other',
]

interface MarkPaidDialogProps {
  item:     IncomeListItem
  open:     boolean
  onClose:  () => void
}

export function MarkPaidDialog({ item, open, onClose }: MarkPaidDialogProps) {
  const { mutateAsync, isPending } = useMarkIncomePaid()

  const form = useForm<MarkPaidValues>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: {
      payment_date:           new Date().toISOString().split('T')[0],
      payment_method:         '',
      transaction_reference:  '',
      notes:                  '',
    },
  })

  async function onSubmit(values: MarkPaidValues) {
    const result = await mutateAsync({ incomeId: item.id, values })
    if (result.ok) {
      toast.success(`Income marked as paid for ${item.member_name ?? 'member'}`)
      form.reset()
      onClose()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-muted px-3 py-2 text-sm mb-2">
          <p className="font-medium">{item.member_name ?? '—'}</p>
          <p className="text-muted-foreground">{item.task_title ?? '—'}</p>
          <p className="font-semibold mt-1">
            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="payment_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="payment_method" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="transaction_reference" render={({ field }) => (
              <FormItem>
                <FormLabel>Transaction Reference</FormLabel>
                <FormControl><Input placeholder="UTR / transaction ID" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Optional notes" className="resize-none min-h-[80px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
