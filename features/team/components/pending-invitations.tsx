'use client'

import { ChevronDown, ChevronUp, Mail, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RoleBadge } from './role-badge'
import { useCancelInvitation } from '../hooks/use-team'
import type { TeamInvitation, OrgRole } from '../types'

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  const days  = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Expired'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} day${days !== 1 ? 's' : ''}`
}

type Props = { invitations: TeamInvitation[] }

export function PendingInvitations({ invitations }: Props) {
  const [open, setOpen] = useState(false)
  const cancel = useCancelInvitation()

  const pending = invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date())
  if (pending.length === 0) return null

  return (
    <div className="rounded-lg border bg-muted/30">
      <Button
        variant="ghost"
        className="w-full justify-between px-4 py-2.5 h-auto text-sm font-medium"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Pending invitations</span>
          <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {open && (
        <div className="border-t divide-y">
          <p className="px-4 py-2 text-xs text-muted-foreground">
            Share these links manually — no email is sent automatically.
          </p>
          {pending.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{inv.email}</p>
                <p className="text-xs text-muted-foreground">{formatExpiry(inv.expires_at)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RoleBadge role={inv.role as OrgRole} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Cancel invitation"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(inv.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
