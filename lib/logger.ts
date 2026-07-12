const isProd = process.env.NODE_ENV === 'production'

type Level = 'info' | 'warn' | 'error'
type Context = Record<string, unknown>

const SENSITIVE_KEY = /token|key|secret|password|jwt|cookie|authorization|email|phone|credential/i

function sanitize(ctx: Context): Context {
  const out: Context = {}
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : v
  }
  return out
}

function emit(level: Level, msg: string, ctx: Context): void {
  const safe = Object.keys(ctx).length ? sanitize(ctx) : undefined
  if (isProd) {
    const entry = JSON.stringify({ level, msg, ...(safe ?? {}), t: Date.now() })
    if (level === 'error') console.error(entry)
    else if (level === 'warn') console.warn(entry)
    else console.log(entry)
  } else {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`[${level.toUpperCase()}] ${msg}`, ...(safe ? [safe] : []))
  }
}

export const logger = {
  info:  (msg: string, ctx: Context = {}) => emit('info',  msg, ctx),
  warn:  (msg: string, ctx: Context = {}) => emit('warn',  msg, ctx),
  error: (msg: string, ctx: Context = {}) => emit('error', msg, ctx),
}
