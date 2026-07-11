'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SectionCard } from './section-card'
import { updateProfileAction } from '../actions'
import { profileSchema, type ProfileFormValues } from '../schema'
import type { ProfileSettings } from '../types'

interface ProfileSectionProps {
  profile: ProfileSettings
}

export function ProfileSection({ profile }: ProfileSectionProps) {
  const router = useRouter()

  const form = useForm<ProfileFormValues>({
    resolver:      zodResolver(profileSchema),
    defaultValues: { full_name: profile.full_name ?? '' },
  })

  const { isDirty, isSubmitting } = form.formState

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return

    const values = form.getValues()
    const result = await updateProfileAction(values)

    if (result.ok) {
      toast.success('Profile updated')
      form.reset(values)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <SectionCard
      id="profile"
      title="Personal Profile"
      description="Your name and account information."
      onSave={form.handleSubmit(handleSave)}
      saving={isSubmitting}
      dirty={isDirty}
    >
      <Form {...form}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Smith" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
              {profile.email ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">Email is managed by your account provider.</p>
          </div>
        </div>
      </Form>
    </SectionCard>
  )
}
