'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Area } from 'react-easy-crop'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { SectionCard } from './section-card'
const LogoCropDialog = dynamic(
  () => import('./logo-crop-dialog').then((m) => m.LogoCropDialog),
  { ssr: false }
)
import { cropAndCompressLogo, compressQrImage } from '../lib/image-processing'
import { uploadOrgLogoAction, removeOrgLogoAction, uploadOrgQrAction, removeOrgQrAction } from '../actions'
import type { OrgSettings } from '../types'

// ─── Shared constants ─────────────────────────────────────────────────────────

const ACCEPTED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ACCEPTED_ATTR = 'image/jpeg,image/jpg,image/png,image/webp'

// Client-side source file limits
const MAX_SOURCE_BYTES = 15 * 1024 * 1024  // 15 MB — safety limit before canvas decode
const MAX_UPLOAD_BYTES =  4 * 1024 * 1024  // 4 MB — processed output sent to server

function validateSource(file: File): string | null {
  if (!ACCEPTED_MIME.has(file.type)) return 'Only JPEG, PNG, and WebP images are allowed.'
  if (file.size > MAX_SOURCE_BYTES)  return 'Source image must be smaller than 15 MB.'
  if (file.size === 0)               return 'Selected file appears to be empty.'
  return null
}

function revokeIfSet(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

// ─── Logo slot (with crop dialog) ────────────────────────────────────────────

interface LogoSlotProps {
  currentUrl: string | null
  onUploaded: (newUrl: string) => void
  onRemoved:  () => void
}

function LogoSlot({ currentUrl, onUploaded, onRemoved }: LogoSlotProps) {
  const inputRef            = useRef<HTMLInputElement>(null)
  const [preview,     setPreview]     = useState<string | null>(currentUrl)
  const [cropSrc,     setCropSrc]     = useState<string | null>(null)
  const [sourceMime,  setSourceMime]  = useState<string>('image/png')
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [removing,    setRemoving]    = useState(false)

  // Revoke crop src object URL on unmount
  useEffect(() => {
    return () => { revokeIfSet(cropSrc) }
  }, [cropSrc])

  function openFilePicker() {
    inputRef.current?.click()
  }

  function handleFileSelected(file: File) {
    const err = validateSource(file)
    if (err) { toast.error(err); return }

    // Revoke any previously open crop URL before creating a new one
    revokeIfSet(cropSrc)
    const url = URL.createObjectURL(file)
    setSourceMime(file.type)
    setCropSrc(url)
    setDialogOpen(true)
  }

  async function handleCropConfirm(croppedAreaPixels: Area) {
    if (!cropSrc) return
    let processed: File
    try {
      const transparent = sourceMime === 'image/png' || sourceMime === 'image/webp'
      processed = await cropAndCompressLogo(cropSrc, croppedAreaPixels, transparent)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to process this image. Please try another file.'
      toast.error(msg)
      return
    }

    // Verify processed output before sending to server
    if (processed.size === 0 || processed.size > MAX_UPLOAD_BYTES) {
      toast.error('Processed image exceeds 4 MB. Please use a smaller source image.')
      return
    }

    const fd = new FormData()
    fd.append('file', processed)
    const result = await uploadOrgLogoAction(fd)

    if (result.ok) {
      // Close dialog and clean up crop URL; show processed file as preview
      setDialogOpen(false)
      revokeIfSet(cropSrc)
      setCropSrc(null)
      // Use the server-returned URL for the persistent preview
      const serverUrl = (result as { ok: true; data: { logo_url: string } }).data.logo_url
      setPreview(serverUrl)
      onUploaded(serverUrl)
      toast.success('Logo uploaded')
    } else {
      toast.error((result as { ok: false; error: string }).error ?? 'Upload failed')
      // Keep dialog open so user can retry
    }
  }

  function handleCropCancel() {
    setDialogOpen(false)
    revokeIfSet(cropSrc)
    setCropSrc(null)
    // Reset file input so the same file can be re-selected if needed
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleRemove() {
    setRemoving(true)
    const result = await removeOrgLogoAction()
    setRemoving(false)
    if (result.ok) {
      setPreview(null)
      onRemoved()
      toast.success('Logo removed')
    } else {
      toast.error((result as { ok: false; error: string }).error ?? 'Remove failed')
    }
  }

  return (
    <>
      <div className="flex items-start gap-4">
        {/* Preview box */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {preview ? (
            <Image src={preview} alt="Organization logo" fill className="object-contain p-1" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Upload className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium">Organization Logo</p>
          <p className="text-xs text-muted-foreground">
            Shown in the header of all invoices and receipts.
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP · source up to 15 MB · output cropped to 1024 × 1024 px
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removing}
              onClick={openFilePicker}
            >
              <Upload className="mr-1.5 h-3 w-3" />
              {preview ? 'Replace' : 'Upload'}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removing}
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                {removing
                  ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  : <X className="mr-1 h-3 w-3" />
                }
                Remove
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_ATTR}
            className="hidden"
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <LogoCropDialog
        open={dialogOpen}
        imageSrc={cropSrc}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </>
  )
}

// ─── QR slot (compress only — no crop) ───────────────────────────────────────

interface QrSlotProps {
  currentUrl: string | null
  onUploaded: (newUrl: string) => void
  onRemoved:  () => void
}

function QrSlot({ currentUrl, onUploaded, onRemoved }: QrSlotProps) {
  const inputRef            = useRef<HTMLInputElement>(null)
  const [preview,  setPreview]  = useState<string | null>(currentUrl)
  const [saving,   setSaving]   = useState(false)

  async function handleFile(file: File) {
    const err = validateSource(file)
    if (err) { toast.error(err); return }

    setSaving(true)

    const objectUrl = URL.createObjectURL(file)
    let processed: File
    try {
      processed = await compressQrImage(objectUrl, file.type)
    } catch (err) {
      URL.revokeObjectURL(objectUrl)
      setSaving(false)
      const msg = err instanceof Error ? err.message : 'Unable to process this image. Please try another file.'
      toast.error(msg)
      return
    }

    // Object URL no longer needed after canvas decode
    URL.revokeObjectURL(objectUrl)

    if (processed.size === 0 || processed.size > MAX_UPLOAD_BYTES) {
      setSaving(false)
      toast.error('QR image exceeds 4 MB after compression. Please use a smaller file.')
      return
    }

    const fd = new FormData()
    fd.append('file', processed)
    const result = await uploadOrgQrAction(fd)
    setSaving(false)

    if (result.ok) {
      const serverUrl = (result as { ok: true; data: { payment_qr_url: string } }).data.payment_qr_url
      setPreview(serverUrl)
      onUploaded(serverUrl)
      toast.success('Payment QR uploaded')
    } else {
      toast.error((result as { ok: false; error: string }).error ?? 'Upload failed')
    }
  }

  async function handleRemove() {
    setSaving(true)
    const result = await removeOrgQrAction()
    setSaving(false)
    if (result.ok) {
      setPreview(null)
      onRemoved()
      toast.success('Payment QR removed')
    } else {
      toast.error((result as { ok: false; error: string }).error ?? 'Remove failed')
    }
  }

  return (
    <div className="flex items-start gap-4">
      {/* Preview box */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {preview ? (
          <Image src={preview} alt="Payment QR code" fill className="object-contain p-1" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Upload className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-medium">Payment QR Code</p>
        <p className="text-xs text-muted-foreground">
          UPI or payment QR code printed on invoices for quick payment.
        </p>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG or WebP · source up to 15 MB · full image preserved (not cropped)
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => inputRef.current?.click()}
          >
            {saving
              ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              : <Upload className="mr-1.5 h-3 w-3" />
            }
            {preview ? 'Replace' : 'Upload'}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="mr-1 h-3 w-3" />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_ATTR}
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface ImageUploadSectionProps {
  org: OrgSettings
}

export function ImageUploadSection({ org }: ImageUploadSectionProps) {
  return (
    <SectionCard
      id="media"
      title="Logo &amp; QR Code"
      description="Images shown on invoices and receipts."
    >
      <div className="space-y-6">
        <LogoSlot
          currentUrl={org.logo_url}
          onUploaded={() => {}}
          onRemoved={() => {}}
        />
        <div className="border-t" />
        <QrSlot
          currentUrl={org.payment_qr_url}
          onUploaded={() => {}}
          onRemoved={() => {}}
        />
      </div>
    </SectionCard>
  )
}
