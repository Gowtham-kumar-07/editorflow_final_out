'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Check, UserPlus } from 'lucide-react'
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
import { useInviteMember } from '../hooks/use-team'
import { inviteSchema, type InviteFormValues } from '../schema'
import { ROLE_LABELS, SPECIALIZATION_LABELS } from '../types'
import type { TeamSpecialization } from '../types'

const INVITABLE_ROLES = ['admin', 'project_manager', 'member'] as const
const SPECIALIZATIONS: TeamSpecialization[] = ['editor', 'designer', 'photographer', 'videographer', 'other']

export function InviteMemberDialog() {
  const [open, setOpen]       = useState(false)
  const [token, setToken]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)
  const mutation              = useInviteMember()

  const form = useForm<InviteFormValues>({
    resolver:      zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member', specialization: undefined },
  })

  function handleClose() {
    setOpen(false)
    setToken(null)
    form.reset()
  }

  async function onSubmit(values: InviteFormValues) {
    const result = await mutation.mutateAsync(values)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setToken(result.data.token)
  }

  function copyToken() {
    if (!token) return
    const link = `${window.location.origin}/invite/accept?token=${token}`
    void navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
            Send an invitation link to a new member.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          /* Step 2: show the invite link */
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Copy this link and share it with the invited person. It expires in 7 days
              and can only be accepted by the invited email address.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/invite/accept?token=${token}`}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyToken}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 1: invitation form */
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input placeholder="colleague@example.com" {...field} />
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
                    <FormLabel>Specialization <span className="text-muted-foreground">(optional)</span></FormLabel>
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
                  {mutation.isPending ? 'Creating…' : 'Create invitation'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {token && (
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
