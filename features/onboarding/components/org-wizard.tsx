'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Upload, X, Building2, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { createClient } from '@/supabase/client'
import { uploadOrganizationLogo } from '@/services/organization.service'
import { createOrgSelfServiceAction } from '../actions'
import { generateSlug } from '@/utils/slug'
import {
  orgWizardStep1Schema,
  orgWizardStep2Schema,
  type OrgWizardStep1Values,
  type OrgWizardStep2Values,
} from '../schema'

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMON_CURRENCIES = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'INR', label: 'Indian Rupee (INR)' },
  { code: 'CAD', label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', label: 'Australian Dollar (AUD)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
]

const TIMEZONES = [
  { value: 'UTC',                  label: 'UTC' },
  { value: 'America/New_York',     label: 'Eastern Time (ET)' },
  { value: 'America/Chicago',      label: 'Central Time (CT)' },
  { value: 'America/Denver',       label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles',  label: 'Pacific Time (PT)' },
  { value: 'America/Toronto',      label: 'Toronto (ET)' },
  { value: 'America/Sao_Paulo',    label: 'Brasília (BRT)' },
  { value: 'Europe/London',        label: 'London (GMT/BST)' },
  { value: 'Europe/Paris',         label: 'Paris (CET)' },
  { value: 'Europe/Berlin',        label: 'Berlin (CET)' },
  { value: 'Asia/Kolkata',         label: 'India (IST)' },
  { value: 'Asia/Dubai',           label: 'Dubai (GST)' },
  { value: 'Asia/Singapore',       label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo',           label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai',        label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney',     label: 'Sydney (AEDT)' },
]

const DATE_FORMATS = [
  { value: 'MMM D, YYYY', label: 'Jan 5, 2026' },
  { value: 'D MMM YYYY',  label: '5 Jan 2026' },
  { value: 'MM/DD/YYYY',  label: '01/05/2026' },
  { value: 'DD/MM/YYYY',  label: '05/01/2026' },
  { value: 'YYYY-MM-DD',  label: '2026-01-05' },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Organization', 'Settings', 'Review']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < current
                  ? 'bg-primary text-primary-foreground'
                  : i === current
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-2'
                    : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={[
              'text-xs whitespace-nowrap',
              i === current ? 'font-medium text-foreground' : 'text-muted-foreground',
            ].join(' ')}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={[
              'h-px w-16 mx-1 mt-[-18px] transition-colors',
              i < current ? 'bg-primary' : 'bg-border',
            ].join(' ')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

function LogoUpload({
  value, onChange, orgName,
}: { value: File | null | undefined; onChange: (f: File | null) => void; orgName: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!value) { setPreview(null); return }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const initials = orgName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors hover:border-primary/50 hover:bg-accent"
        aria-label="Upload organization logo"
      >
        {preview ? (
          <Image src={preview} alt="Logo preview" fill className="object-cover" sizes="80px" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            {initials
              ? <span className="text-xl font-bold text-muted-foreground">{initials}</span>
              : <Building2 className="h-6 w-6 text-muted-foreground" />}
          </div>
        )}
      </button>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="w-fit">
          <Upload className="mr-2 h-3.5 w-3.5" />
          {value ? 'Change logo' : 'Upload logo'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} className="w-fit text-muted-foreground">
            <X className="mr-2 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP · max 2 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => { onChange(e.target.files?.[0] ?? null); e.target.value = '' }}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  )
}

// ─── Step 1: Organization identity ───────────────────────────────────────────

function Step1({
  onNext,
  savedValues,
}: {
  onNext: (v: OrgWizardStep1Values) => void
  savedValues: Partial<OrgWizardStep1Values>
}) {
  const slugManuallyEdited = useRef(false)
  const form = useForm<OrgWizardStep1Values>({
    resolver: zodResolver(orgWizardStep1Schema),
    defaultValues: { name: savedValues.name ?? '', slug: savedValues.slug ?? '', logoFile: savedValues.logoFile ?? null },
  })

  const watchedName = form.watch('name')
  useEffect(() => {
    if (slugManuallyEdited.current) return
    form.setValue('slug', generateSlug(watchedName), { shouldValidate: false })
  }, [watchedName, form])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-6" noValidate>
        <FormField control={form.control} name="logoFile" render={({ field }) => (
          <FormItem>
            <FormLabel>Logo <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
            <FormControl>
              <LogoUpload value={field.value} onChange={field.onChange} orgName={watchedName} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Organization name</FormLabel>
            <FormControl>
              <Input placeholder="Pixel Studio" autoComplete="organization" autoFocus {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="slug" render={({ field }) => (
          <FormItem>
            <FormLabel>URL slug</FormLabel>
            <FormControl>
              <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <span className="select-none rounded-l-md border-r bg-muted px-3 py-2 text-sm text-muted-foreground">
                  app/
                </span>
                <Input
                  placeholder="pixel-studio"
                  className="rounded-l-none border-0 shadow-none focus-visible:ring-0"
                  {...field}
                  onChange={(e) => {
                    slugManuallyEdited.current = e.target.value !== ''
                    field.onChange(e)
                  }}
                />
              </div>
            </FormControl>
            <FormDescription>
              Auto-generated from your name. Lowercase letters, numbers, and hyphens only.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" className="w-full">
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </Form>
  )
}

// ─── Step 2: Settings ─────────────────────────────────────────────────────────

function Step2({
  onNext,
  onBack,
  savedValues,
}: {
  onNext: (v: OrgWizardStep2Values) => void
  onBack: () => void
  savedValues: Partial<OrgWizardStep2Values>
}) {
  const form = useForm<OrgWizardStep2Values>({
    resolver: zodResolver(orgWizardStep2Schema),
    defaultValues: {
      defaultCurrency: savedValues.defaultCurrency ?? 'USD',
      payrollCurrency: savedValues.payrollCurrency ?? 'USD',
      timezone:        savedValues.timezone        ?? 'UTC',
      dateFormat:      savedValues.dateFormat       ?? 'MMM D, YYYY',
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField control={form.control} name="defaultCurrency" render={({ field }) => (
            <FormItem>
              <FormLabel>Default currency</FormLabel>
              <FormControl>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...field}
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </FormControl>
              <FormDescription>Used for invoices and revenue tracking.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="payrollCurrency" render={({ field }) => (
            <FormItem>
              <FormLabel>Payroll currency</FormLabel>
              <FormControl>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...field}
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </FormControl>
              <FormDescription>Default currency for member payroll.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="timezone" render={({ field }) => (
          <FormItem>
            <FormLabel>Timezone</FormLabel>
            <FormControl>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                {...field}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="dateFormat" render={({ field }) => (
          <FormItem>
            <FormLabel>Date format</FormLabel>
            <FormControl>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                {...field}
              >
                {DATE_FORMATS.map((df) => (
                  <option key={df.value} value={df.value}>{df.label}</option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" className="flex-1">
            Continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function Step3({
  step1,
  step2,
  onBack,
  onSubmit,
  isSubmitting,
  serverError,
}: {
  step1:       OrgWizardStep1Values
  step2:       OrgWizardStep2Values
  onBack:      () => void
  onSubmit:    () => void
  isSubmitting: boolean
  serverError: string | null
}) {
  const currency = COMMON_CURRENCIES.find((c) => c.code === step2.defaultCurrency)?.label ?? step2.defaultCurrency
  const payroll  = COMMON_CURRENCIES.find((c) => c.code === step2.payrollCurrency)?.label ?? step2.payrollCurrency
  const tz       = TIMEZONES.find((t) => t.value === step2.timezone)?.label ?? step2.timezone
  const df       = DATE_FORMATS.find((d) => d.value === step2.dateFormat)?.label ?? step2.dateFormat

  return (
    <div className="space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border divide-y">
        <Row label="Organization" value={step1.name} />
        <Row label="URL slug"     value={`app/${step1.slug}`} mono />
        <Row label="Default currency" value={currency} />
        <Row label="Payroll currency" value={payroll} />
        <Row label="Timezone"     value={tz} />
        <Row label="Date format"  value={df} />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1" disabled={isSubmitting}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onSubmit} className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Creating…' : 'Create organization'}
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={['text-right font-medium', mono ? 'font-mono text-xs' : ''].join(' ')}>{value}</span>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OrgWizard() {
  const router = useRouter()
  const [step, setStep]           = useState(0)
  const [step1, setStep1]         = useState<Partial<OrgWizardStep1Values>>({})
  const [step2, setStep2]         = useState<Partial<OrgWizardStep2Values>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError]   = useState<string | null>(null)

  async function handleSubmit() {
    if (!step1.name || !step1.slug || !step2.defaultCurrency) return
    setServerError(null)
    setIsSubmitting(true)

    try {
      let logoUrl: string | null = null
      if (step1.logoFile) {
        const supabase = createClient()
        logoUrl = await uploadOrganizationLogo(supabase, step1.slug, step1.logoFile)
        if (!logoUrl) {
          toast.warning('Logo could not be uploaded — organization will be created without it.')
        }
      }

      const result = await createOrgSelfServiceAction({
        name:            step1.name,
        slug:            step1.slug,
        logoUrl,
        defaultCurrency: step2.defaultCurrency ?? 'USD',
        payrollCurrency: step2.payrollCurrency ?? 'USD',
        timezone:        step2.timezone        ?? 'UTC',
        dateFormat:      step2.dateFormat       ?? 'MMM D, YYYY',
      })

      if (result.error) {
        if (result.code === 'AUTH_FAILED') { router.push('/login'); return }
        setServerError(result.error)
        return
      }

      // Store welcome flag so the dashboard shows the first-run banner
      try { localStorage.setItem('editorflow_show_welcome', '1') } catch {}

      toast.success(`${step1.name} is ready! Welcome to EditorFlow.`)
      // revalidatePath('/', 'layout') already ran in the server action so the
      // router cache is fresh.  A separate router.refresh() would race with
      // this push and cancel the navigation — omit it.
      router.push('/dashboard')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 0 && (
        <Step1
          savedValues={step1}
          onNext={(v) => { setStep1(v); setStep(1) }}
        />
      )}
      {step === 1 && (
        <Step2
          savedValues={step2}
          onNext={(v) => { setStep2(v); setStep(2) }}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <Step3
          step1={step1 as OrgWizardStep1Values}
          step2={step2 as OrgWizardStep2Values}
          onBack={() => setStep(1)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
      )}
    </div>
  )
}
