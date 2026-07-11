'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Upload, X, Building2 } from 'lucide-react'
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
import { createOrganizationAction } from '../actions'
import { generateSlug } from '@/utils/slug'
import { createOrganizationSchema, type CreateOrganizationValues } from '../schema'

// ─── Logo upload sub-component ────────────────────────────────────────────────

type LogoUploadProps = {
  value: File | null | undefined
  onChange: (file: File | null) => void
  orgName: string
}

function LogoUpload({ value, onChange, orgName }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    onChange(file)
    // Reset input so the same file can be re-selected after removal
    e.target.value = ''
  }

  const initials = orgName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-4">
      {/* Preview / placeholder */}
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
            {initials ? (
              <span className="text-xl font-bold text-muted-foreground">{initials}</span>
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        )}
      </button>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="w-fit"
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          {value ? 'Change logo' : 'Upload logo'}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="w-fit text-muted-foreground"
          >
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
        onChange={handleFileChange}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

type OrganizationFormProps = {
  /** Optional: pre-fill the form from URL params or test data */
  defaultValues?: Partial<CreateOrganizationValues>
}

export function OrganizationForm({ defaultValues }: OrganizationFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track whether the user has manually edited the slug
  const slugManuallyEdited = useRef(false)

  const form = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      slug: defaultValues?.slug ?? '',
      logoFile: null,
    },
  })

  const watchedName = form.watch('name')

  // Auto-derive slug from name while the user hasn't touched it
  useEffect(() => {
    if (slugManuallyEdited.current) return
    form.setValue('slug', generateSlug(watchedName), { shouldValidate: false })
  }, [watchedName, form])

  async function onSubmit(values: CreateOrganizationValues) {
    setServerError(null)
    setIsSubmitting(true)

    try {
      // Logo upload uses the browser client (Supabase Storage, not RLS-gated).
      let logoUrl: string | null = null
      if (values.logoFile) {
        const supabase = createClient()
        logoUrl = await uploadOrganizationLogo(supabase, values.slug, values.logoFile)
        if (!logoUrl) {
          toast.warning('Logo could not be uploaded — organization will be created without it.')
        }
      }

      // Organization creation runs as a Server Action so auth is always
      // resolved server-side and avoids PostgREST schema-cache issues.
      const result = await createOrganizationAction({
        name:    values.name,
        slug:    values.slug,
        logoUrl,
      })

      if (result.error) {
        if (result.code === 'SLUG_TAKEN') {
          form.setError('slug', { message: 'This slug is already taken.' })
        } else if (result.code === 'AUTH_FAILED') {
          router.push('/login')
        } else {
          setServerError(result.error)
        }
        return
      }

      toast.success(`Welcome to ${values.name}! 🎉`)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setServerError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Logo upload */}
        <FormField
          control={form.control}
          name="logoFile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo</FormLabel>
              <FormControl>
                <LogoUpload
                  value={field.value}
                  onChange={field.onChange}
                  orgName={watchedName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Organization name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Acme Corp"
                  autoComplete="organization"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Slug */}
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL slug</FormLabel>
              <FormControl>
                <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="select-none rounded-l-md border-r bg-muted px-3 py-2 text-sm text-muted-foreground">
                    app/
                  </span>
                  <Input
                    placeholder="acme-corp"
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
                This will be used in URLs and cannot be changed easily later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Creating organization…' : 'Create organization'}
        </Button>
      </form>
    </Form>
  )
}
