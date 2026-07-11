'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface SectionCardProps {
  id:          string
  title:       string
  description: string
  children:    React.ReactNode
  onSave?:     () => void
  saving?:     boolean
  dirty?:      boolean
}

export function SectionCard({
  id,
  title,
  description,
  children,
  onSave,
  saving,
  dirty,
}: SectionCardProps) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <h2 className="text-base font-semibold leading-none">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Separator />
        <div className="p-6 space-y-4">
          {children}
        </div>
        {onSave && (
          <>
            <Separator />
            <div className="flex justify-end p-4">
              <Button
                onClick={onSave}
                disabled={saving || !dirty}
                size="sm"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
