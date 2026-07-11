'use client'

import { useFieldArray, useFormContext } from 'react-hook-form'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import type { InvoiceFormValues } from '../schema'
import { formatCurrency } from '@/utils/format'

interface Props {
  currency?: string
}

export function InvoiceLineItems({ currency = 'USD' }: Props) {
  const { control, watch } = useFormContext<InvoiceFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const lineItems = watch('line_items')

  function addManualItem() {
    append({ description: '', quantity: 1, unit_price: 0, project_id: null })
  }

  return (
    <div className="space-y-3">
      {/* ── Column headers (desktop) ────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-[1fr_80px_120px_100px_40px] gap-2 px-1">
        <span className="text-xs font-medium text-muted-foreground">Description</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Qty</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Unit Price</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Amount</span>
        <span />
      </div>

      {/* ── Line item rows ──────────────────────────────────────────── */}
      {fields.map((field, index) => {
        const qty        = Number(lineItems?.[index]?.quantity  ?? 0)
        const price      = Number(lineItems?.[index]?.unit_price ?? 0)
        const amount     = qty * price
        const isProjectItem = !!lineItems?.[index]?.project_id

        return (
          <div
            key={field.id}
            className={`grid grid-cols-1 md:grid-cols-[1fr_80px_120px_100px_40px] gap-2 items-start rounded-lg p-3 md:p-0 border md:border-0 ${
              isProjectItem
                ? 'border-primary/20 bg-primary/[0.02] md:bg-transparent'
                : ''
            }`}
          >
            {/* Description */}
            <FormField
              control={control}
              name={`line_items.${index}.description`}
              render={({ field: f }) => (
                <FormItem className="space-y-1">
                  {isProjectItem && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <FolderOpen className="h-3 w-3" />
                      <span>Project item</span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground md:hidden">Description</span>
                  <FormControl>
                    <Input placeholder="Description of service or product" {...f} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity */}
            <FormField
              control={control}
              name={`line_items.${index}.quantity`}
              render={({ field: f }) => (
                <FormItem className="space-y-1">
                  <span className="text-xs text-muted-foreground md:hidden">Quantity</span>
                  <FormControl>
                    <Input
                      type="number"
                      min={0.01}
                      step="any"
                      className="text-right"
                      placeholder="1"
                      {...f}
                      onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unit Price */}
            <FormField
              control={control}
              name={`line_items.${index}.unit_price`}
              render={({ field: f }) => (
                <FormItem className="space-y-1">
                  <span className="text-xs text-muted-foreground md:hidden">Unit Price</span>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="text-right"
                      placeholder="0.00"
                      {...f}
                      onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount (read-only) */}
            <div className="flex items-center justify-end h-10 tabular-nums text-sm font-medium pr-1">
              <span className="md:hidden text-xs text-muted-foreground mr-2">Amount:</span>
              {formatCurrency(amount, currency)}
            </div>

            {/* Remove */}
            <div className="flex items-start justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                aria-label="Remove line item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      })}

      {/* ── Add manual line item ─────────────────────────────────────── */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addManualItem}
        className="w-full md:w-auto"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Line Item
      </Button>
    </div>
  )
}
