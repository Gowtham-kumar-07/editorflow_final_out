import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    let supabaseHost = ''
    try {
      if (supabaseUrl) supabaseHost = new URL(supabaseUrl).host
    } catch {}

    const supabaseSrcs = supabaseHost
      ? `https://${supabaseHost} wss://${supabaseHost}`
      : ''

    const csp = [
      `default-src 'self'`,
      // Next.js requires unsafe-inline for inline scripts/styles generated during hydration
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `style-src 'self' 'unsafe-inline'`,
      // data: for inline images/avatars, blob: for react-easy-crop preview
      `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''}`,
      `font-src 'self' data:`,
      `connect-src 'self'${supabaseSrcs ? ` ${supabaseSrcs}` : ''}`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
