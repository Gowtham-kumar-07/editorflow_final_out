import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Zap,
  Users,
  FileText,
  BarChart3,
  Globe2,
  Shield,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

import { createClient } from '@/supabase/server'
import { getUserOrganization } from '@/services/organization.service'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Authenticated users skip the landing page entirely
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const org = await getUserOrganization(supabase, user.id)
    redirect(org ? '/dashboard' : '/onboarding')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-32">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Free 14-day trial · No credit card required
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance leading-tight">
          Run your editing agency
          <span className="block text-muted-foreground font-normal mt-1">without the spreadsheet chaos</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
          {APP_DESCRIPTION}. Manage clients, projects, invoices, payroll, and team — in one place built for editorial studios.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Start for free
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Sign in to your account
          </Link>
        </div>

        {/* Dashboard preview placeholder */}
        <div className="mt-16 mx-auto max-w-4xl rounded-2xl border bg-muted/30 h-64 sm:h-80 flex items-center justify-center text-muted-foreground/40">
          <div className="flex flex-col items-center gap-3">
            <BarChart3 className="h-12 w-12" />
            <span className="text-sm">Dashboard preview</span>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="border-t bg-muted/20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Everything your agency needs</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Stop stitching together separate tools. EditorFlow gives you the full picture in one workspace.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Up and running in minutes</h2>
            <p className="mt-3 text-muted-foreground">No setup calls. No lengthy onboarding. Just a clean start.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                  {i + 1}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="border-t bg-muted/20 py-20" id="pricing">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={[
                  'rounded-xl border p-6 flex flex-col',
                  plan.featured ? 'bg-primary text-primary-foreground ring-2 ring-primary' : 'bg-card',
                ].join(' ')}
              >
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-70">
                  {plan.name}
                </div>
                <div className="mt-2 mb-1 text-3xl font-bold">
                  {plan.price}
                  {plan.period && <span className="text-base font-normal opacity-70">{plan.period}</span>}
                </div>
                <p className={['mt-1 mb-6 text-sm', plan.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'].join(' ')}>
                  {plan.description}
                </p>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 opacity-80" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={[
                    'block rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors',
                    plan.featured
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  ].join(' ')}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Pricing is indicative. Billing not yet active — contact us for early-access rates.
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-10">Frequently asked questions</h2>
          <dl className="divide-y">
            {FAQ.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-semibold">{item.q}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Ready to get started?</h2>
          <p className="mt-4 text-muted-foreground">Join editorial agencies who run their business on {APP_NAME}.</p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Start your free trial
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <Zap className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">{APP_NAME}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Static content ───────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon:  Users,
    title: 'Client CRM',
    body:  'Keep all your clients, contacts, and project history in one searchable place.',
  },
  {
    icon:  FileText,
    title: 'Invoicing',
    body:  'Create and send branded invoices in seconds. Track payments and outstanding balances.',
  },
  {
    icon:  BarChart3,
    title: 'Revenue dashboard',
    body:  'Real-time KPIs for revenue, outstanding balances, and team payroll — no spreadsheet required.',
  },
  {
    icon:  Users,
    title: 'Team management',
    body:  'Invite editors, assign tasks, set rates, and manage payroll across currencies.',
  },
  {
    icon:  Globe2,
    title: 'Multi-currency',
    body:  'Accept payments and pay team members in any currency with live FX conversion.',
  },
  {
    icon:  Shield,
    title: 'Built-in security',
    body:  'Role-based access control ensures every team member sees only what they need to.',
  },
]

const HOW_IT_WORKS = [
  {
    title: 'Create your organization',
    body:  'Sign up and set up your agency profile in under two minutes. No credit card needed.',
  },
  {
    title: 'Invite your team',
    body:  'Send email invitations to your editors and project managers. They join with one click.',
  },
  {
    title: 'Start working',
    body:  'Add clients, create projects, assign tasks, and send invoices from day one.',
  },
]

const PLANS = [
  {
    name:        'Starter',
    price:       '$0',
    period:      '/mo',
    description: 'Perfect for freelancers and small studios getting started.',
    cta:         'Start free',
    featured:    false,
    features:    ['Up to 3 team members', '5 active projects', 'Basic invoicing', 'Client CRM'],
  },
  {
    name:        'Pro',
    price:       '$49',
    period:      '/mo',
    description: 'For growing agencies with larger teams and more clients.',
    cta:         'Start free trial',
    featured:    true,
    features:    ['Unlimited team members', 'Unlimited projects', 'Multi-currency payroll', 'Advanced reports', 'Priority support'],
  },
  {
    name:        'Enterprise',
    price:       'Custom',
    period:      '',
    description: 'For large studios with custom needs and dedicated support.',
    cta:         'Contact us',
    featured:    false,
    features:    ['Everything in Pro', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee'],
  },
]

const FAQ = [
  {
    q: 'Do I need a credit card to sign up?',
    a: 'No. Your 14-day trial is completely free with no payment details required.',
  },
  {
    q: 'Can I invite my whole team?',
    a: 'Yes. You can invite as many editors, project managers, and clients as you need. Each member gets role-specific access.',
  },
  {
    q: 'Does EditorFlow support multiple currencies?',
    a: 'Yes. You can invoice clients and pay team members in different currencies. Live FX rates are captured at the point of payment.',
  },
  {
    q: 'Can I customize my invoices?',
    a: 'Yes. You can upload your logo, set your brand color, add payment details, and customize invoice numbering from Settings.',
  },
  {
    q: 'Is my data secure?',
    a: 'All data is stored in Supabase with row-level security. Team members can only see data their role permits. All connections are encrypted.',
  },
]
