'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/supabase/client'
import { safeRedirect } from '@/lib/safe-redirect'

const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Please enter your name')
      .max(100, 'Name is too long'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type SignupValues = z.infer<typeof signupSchema>

type Props = {
  email?: string
  next?: string
}

export function SignupForm({ email: prefillEmail, next }: Props) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: prefillEmail ?? '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: SignupValues) {
    setServerError(null)
    setIsSubmitting(true)

    try {
      const supabase = createClient()

      // Build the callback URL so email confirmation can return to the
      // invitation page (if email confirmation is enabled in the project).
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      if (next) callbackUrl.searchParams.set('next', next)

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName },
          emailRedirectTo: callbackUrl.toString(),
        },
      })

      if (error) {
        setServerError(error.message)
        return
      }

      if (data.session) {
        // Email confirmation is disabled — session created immediately.
        router.push(safeRedirect(next, '/dashboard'))
        router.refresh()
      } else {
        // Email confirmation is enabled — prompt the user to check their inbox.
        setEmailSent(true)
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Email-sent state ────────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-semibold text-lg">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{' '}
            <strong>{form.getValues('email')}</strong>. Click it to activate
            your account and continue.
          </p>
        </div>
      </div>
    )
  }

  // ── Signup form ─────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Jane Smith"
                  autoComplete="name"
                  autoFocus={!prefillEmail}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus={!!prefillEmail}
                  readOnly={!!prefillEmail}
                  className={
                    prefillEmail
                      ? 'bg-muted text-muted-foreground cursor-not-allowed select-none'
                      : ''
                  }
                  {...field}
                />
              </FormControl>
              {prefillEmail && (
                <p className="text-xs text-muted-foreground">
                  This email is set by your invitation and cannot be changed.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className="pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </Form>
  )
}
