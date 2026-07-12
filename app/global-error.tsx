'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error]', error.digest ?? 'no-digest')
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#09090b', color: '#fafafa', textAlign: 'center', padding: '24px', boxSizing: 'border-box' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Application error</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: '#71717a', maxWidth: 320, lineHeight: 1.6 }}>
          A critical error occurred. Please refresh the page to try again.
        </p>
        <button
          onClick={reset}
          style={{ marginTop: 24, padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fafafa', fontSize: 14, cursor: 'pointer' }}
        >
          Refresh page
        </button>
      </body>
    </html>
  )
}
