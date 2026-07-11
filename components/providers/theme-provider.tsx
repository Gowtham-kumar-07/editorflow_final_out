'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** undefined until the component has mounted — safe SSR default */
  resolvedTheme: ResolvedTheme | undefined
  systemTheme: ResolvedTheme | undefined
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: undefined,
  systemTheme: undefined,
})

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

// ─── Helpers (browser-only) ───────────────────────────────────────────────────

const STORAGE_KEY = 'theme'
const VALID: Theme[] = ['light', 'dark', 'system']

function readStored(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && (VALID as string[]).includes(raw)) return raw as Theme
  } catch {}
  return 'system'
}

function getSystemPref(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyToDOM(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function resolveTheme(theme: Theme, sys: ResolvedTheme): ResolvedTheme {
  return theme === 'system' ? sys : theme
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial values match server render — no hydration mismatch.
  const [theme, setThemeState] = useState<Theme>('system')
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme | undefined>(undefined)

  // On mount: read persisted preference and detect system theme.
  useEffect(() => {
    const sys = getSystemPref()
    const stored = readStored()
    setSystemTheme(sys)
    setThemeState(stored)
    applyToDOM(resolveTheme(stored, sys))
  }, [])

  // Sync DOM whenever theme or systemTheme changes after mount.
  useEffect(() => {
    if (systemTheme === undefined) return
    applyToDOM(resolveTheme(theme, systemTheme))
  }, [theme, systemTheme])

  // Track OS preference changes while 'system' is selected.
  useEffect(() => {
    if (systemTheme === undefined) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [systemTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  // resolvedTheme is undefined before mount → same on server and initial client render.
  const resolvedTheme: ResolvedTheme | undefined =
    systemTheme === undefined ? undefined : resolveTheme(theme, systemTheme)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, systemTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
