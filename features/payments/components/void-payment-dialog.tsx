'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { voidPaymentAction } from '../actions'
import { voidPaymentSchema } from '../schema'
import type { VoidPaymentInput } from '../schema'
import { formatCurrency } from '@/utils/format'

interface Props {
  paymentId:  string
  amount?:    number
  currency?:  string
  invoiceId?: string
  trigger?:   React.ReactNode
}

export function VoidPaymentDialog({
  paymentId,
  amount,
  currency = 'USD',
  trigger,
}: Props) {
  const router             = useRouter()
  const [open, setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<VoidPaymentInput>({
    resolver: zodResolver(voidPaymentSchema),
    defaultValues: { void_reason: '' },
  })

  async function onSubmit(values: VoidPaymentInput) {
    setLoading(true)
    const result = await voidPaymentAction(paymentId, values)
    setLoading(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Payment voided')
    setOpen(false)
    form.reset()
    router.refresh()
  }

  const title = amount != null
    ? `Void Payment of ${formatCurrency(amount, currency)}?`
    : 'Void this Payment?'

  const defaultTrigger = (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 text-xs text-muted-foreground hover:text-destructive"
    >
      <Ban className="mr-1 h-3 w-3" />
      Void
    </Button>
  )

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            This will reverse the payment and update the invoice balance. The record will be kept for audit purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="void_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for voiding</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Payment bounced, duplicate entry..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <Button
                type="submit"
                variant="destructive"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Void Payment
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
