// Canvas-based image processing: crop, resize, and compress logos and QR images.
// All work happens in the browser before the Server Action request.
// This module uses browser-only APIs (HTMLCanvasElement, HTMLImageElement).
// Import only from 'use client' components.

export type CropAreaPixels = { x: number; y: number; width: number; height: number }

const QR_MAX_PX          = 1600
const MAX_UPLOAD_BYTES   = 4 * 1024 * 1024

// Bounded compression strategies — tried in order, first that fits wins
const LOGO_STRATEGIES: Array<{ maxPx: number; quality: number }> = [
  { maxPx: 1024, quality: 0.82 },
  { maxPx: 1024, quality: 0.72 },
  { maxPx: 768,  quality: 0.72 },
  { maxPx: 768,  quality: 0.62 },
]

// ─── Internal helpers ────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = src
  })
}

function canvasToBlobAsync(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      },
      mimeType,
      quality,
    )
  })
}

function drawToCanvas(
  img: HTMLImageElement,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  smooth = true,
): HTMLCanvasElement {
  const canvas   = document.createElement('canvas')
  canvas.width   = outW
  canvas.height  = outH
  const ctx      = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = smooth
  if (smooth) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
  return canvas
}

// ─── Logo: crop + compress ───────────────────────────────────────────────────

// sourceHasTransparency: true for PNG / WebP sources where alpha matters
export async function cropAndCompressLogo(
  objectUrl: string,
  crop: CropAreaPixels,
  sourceHasTransparency: boolean,
): Promise<File> {
  const img = await loadImage(objectUrl)

  for (const { maxPx, quality } of LOGO_STRATEGIES) {
    const scale = Math.min(1, maxPx / Math.max(crop.width, crop.height, 1))
    const outW  = Math.max(1, Math.round(crop.width  * scale))
    const outH  = Math.max(1, Math.round(crop.height * scale))

    const canvas = drawToCanvas(img, crop.x, crop.y, crop.width, crop.height, outW, outH, true)

    // Format preference: WebP first, then PNG (transparent) or JPEG (opaque) as fallback
    const formats: Array<[string, number]> = [
      ['image/webp', quality],
      sourceHasTransparency
        ? ['image/png',  1]
        : ['image/jpeg', quality],
    ]

    for (const [mime, q] of formats) {
      let blob: Blob
      try {
        blob = await canvasToBlobAsync(canvas, mime, q)
      } catch {
        continue
      }
      if (blob.size > 0 && blob.size <= MAX_UPLOAD_BYTES) {
        const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]
        return new File([blob], `logo.${ext}`, { type: mime })
      }
    }
  }

  throw new Error(
    'Image could not be compressed to under 4 MB. Please try a smaller source image.',
  )
}

// ─── QR: resize + compress (no crop — preserves full bounds) ─────────────────

export async function compressQrImage(objectUrl: string, sourceMime: string): Promise<File> {
  const img  = await loadImage(objectUrl)
  const natW = img.naturalWidth
  const natH = img.naturalHeight

  const scale = Math.min(1, QR_MAX_PX / Math.max(natW, natH, 1))
  const outW  = Math.max(1, Math.round(natW * scale))
  const outH  = Math.max(1, Math.round(natH * scale))

  // QR codes need crisp pixels — no smoothing; prefer PNG for source PNGs
  const preferPng = sourceMime === 'image/png'
  const mime      = preferPng ? 'image/png' : 'image/webp'
  const quality   = preferPng ? 1 : 0.92

  const canvas = drawToCanvas(img, 0, 0, natW, natH, outW, outH, false)
  const blob   = await canvasToBlobAsync(canvas, mime, quality)

  // ext is either 'png' or 'webp' — never jpeg for QR output
  const ext = preferPng ? 'png' : 'webp'

  if (blob.size <= MAX_UPLOAD_BYTES) {
    return new File([blob], `qr.${ext}`, { type: mime })
  }

  // One retry at smaller dimensions / lower quality
  const scale2  = Math.min(1, 800 / Math.max(natW, natH, 1))
  const outW2   = Math.max(1, Math.round(natW * scale2))
  const outH2   = Math.max(1, Math.round(natH * scale2))
  const canvas2 = drawToCanvas(img, 0, 0, natW, natH, outW2, outH2, false)
  const blob2   = await canvasToBlobAsync(canvas2, mime, 0.85)

  if (blob2.size > MAX_UPLOAD_BYTES) {
    throw new Error('QR image exceeds 4 MB limit even after compression. Please use a smaller file.')
  }

  return new File([blob2], `qr.${ext}`, { type: mime })
}
