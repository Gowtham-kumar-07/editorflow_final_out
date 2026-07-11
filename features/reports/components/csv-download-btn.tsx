'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CsvDownloadBtnProps {
  href:     string // e.g. '/api/reports/revenue.csv?from=...&to=...'
  filename: string
  label?:   string
}

export function CsvDownloadBtn({ href, filename, label = 'Export CSV' }: CsvDownloadBtnProps) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(href)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
      {loading
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        : <Download className="mr-2 h-4 w-4" />
      }
      {label}
    </Button>
  )
}
