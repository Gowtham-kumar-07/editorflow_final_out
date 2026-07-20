'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Check, UserPlus, Mail, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useInviteMember } from '../hooks/use-team'
import { inviteSchema, type InviteFormValues } from '../schema'
import { ROLE_LABELS, SPECIALIZATION_LABELS } from '../types'
import type { TeamSpecialization } from '../types'

const INVITABLE_ROLES = ['admin', 'project_manager', 'member'] as const
const SPECIALIZATIONS: TeamSpecialization[] = ['editor', 'designer', 'photographer', 'videographer', 'other']

type ResultState = {
  token:      string
  email:      string
  email_sent: boolean
}

export function InviteMemberDialog() {
  const [open, setOpen]     = useState(false)
  const [result, setResult] = useState<ResultState | null>(null)
  const [copied, setCopied] = useState(false)
  const mutation            = useInviteMember()

  const form = useForm<InviteFormValues>({
    resolver:      zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member', specialization: undefined },
  })

  function handleClose() {
    setOpen(false)
    setResult(null)
    form.reset()
  }

  async function onSubmit(values: InviteFormValues) {
    const res = await mutation.mutateAsync(values)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setResult({ token: res.data.token, email: values.email, email_sent: res.data.email_sent })
  }

  function copyLink() {
    if (!result) return
    const link = `${window.location.origin}/invite/accept?token=${result.token}`
    void navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inviteLink = result ? `${window.location.origin}/invite/accept?token=${result.token}` : ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Invite member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            {result
              ? result.email_sent
                ? 'Invitation sent successfully.'
                : 'Invitation created — share the link below.'
              : 'Send an invitation to a new team member.'}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* ── Result pane ──────────────────────────────────────────────── */
          <div className="space-y-4 py-2">
            {result.email_sent ? (
              /* Email sent ✓ */
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">Invitation email sent</p>
                  <p className="text-xs text-muted-foreground">
                    We sent an invitation to <strong>{result.email}</strong>.
                    The link expires in 7 days and can only be accepted by that address.
                  </p>
                </div>
              </div>
            ) : (
              /* Email delivery failed — show link fallback */
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Email delivery failed for <strong>{result.email}</strong> — this address may
                    already have a Supabase account. Share the link below directly.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLink}
                    aria-label={copied ? 'Copied' : 'Copy invite link'}
                  >
                    {copied
                      ? <Check className="h-4 w-4 text-emerald-600" />
                      : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The link expires in 7 days and can only be accepted by <strong>{result.email}</strong>.
                </p>
              </>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          /* ── Invite form ──────────────────────────────────────────────── */
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input placeholder="colleague@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVITABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
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
                name="specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Specialization{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPECIALIZATIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SPECIALIZATION_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Sending…' : 'Send invitation'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
