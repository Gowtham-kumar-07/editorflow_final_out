import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import { APP_NAME, APP_DESCRIPTION, APP_URL } from '@/lib/constants'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_URL,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

/**
 * Inline script injected into <head> by this Server Component.
 * Runs synchronously before React hydrates, preventing a flash of the
 * wrong theme. Kept here (not in a client component) so React 19 never
 * sees it and never emits "Encountered a script tag while rendering".
 */
const THEME_INIT_SCRIPT = `(function(){
  try {
    var s=localStorage.getItem('theme')||'system';
    var d=document.documentElement;
    d.classList.remove('light','dark');
    if(s==='dark'){d.classList.add('dark');d.style.colorScheme='dark';}
    else if(s==='light'){d.classList.add('light');d.style.colorScheme='light';}
    else{
      var m=window.matchMedia('(prefers-color-scheme: dark)').matches;
      d.classList.add(m?'dark':'light');
      d.style.colorScheme=m?'dark':'light';
    }
  }catch(e){}
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
       * suppressHydrationWarning on <html> suppresses the class mismatch
       * between the server-rendered element (no dark/light class) and the
       * DOM after THEME_INIT_SCRIPT has run (dark or light class present).
       */}
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
          suppressHydrationWarning
        />
      </head>
      <body className="flex min-h-full flex-col overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
