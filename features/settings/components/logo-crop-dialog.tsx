'use client'

import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface LogoCropDialogProps {
  open:       boolean
  imageSrc:   string | null
  onConfirm:  (croppedAreaPixels: Area) => Promise<void>
  onCancel:   () => void
}

export function LogoCropDialog({ open, imageSrc, onConfirm, onCancel }: LogoCropDialogProps) {
  const [crop,        setCrop]        = useState({ x: 0, y: 0 })
  const [zoom,        setZoom]        = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [processing,  setProcessing]  = useState(false)

  // Reset state when a new image is loaded into the dialog
  useEffect(() => {
    if (imageSrc) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedArea(null)
    }
  }, [imageSrc])

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedArea || processing) return
    setProcessing(true)
    try {
      await onConfirm(croppedArea)
    } finally {
      setProcessing(false)
    }
  }

  // Prevent close while processing; otherwise delegate to onCancel
  function handleOpenChange(next: boolean) {
    if (!next && !processing) onCancel()
  }

  if (!imageSrc) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle>Crop Logo</DialogTitle>
          <DialogDescription>
            Drag to reposition · use the slider to zoom · output is square
          </DialogDescription>
        </DialogHeader>

        {/* Crop viewport — dark surround makes the crop overlay readable */}
        <div className="relative h-72 w-full bg-black/90 select-none">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            style={{
              containerStyle: { position: 'absolute', inset: 0 },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-5 py-4">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom level"
            disabled={processing}
            className="w-full cursor-pointer accent-primary disabled:opacity-50"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        <DialogFooter className="gap-2 px-5 pb-5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!croppedArea || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Processing…
              </>
            ) : (
              'Crop & Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
