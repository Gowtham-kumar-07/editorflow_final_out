'use client'

import Link from 'next/link'
import { Users, FolderPlus, UserPlus, ClipboardList } from 'lucide-react'

const CARDS = [
  {
    icon:        UserPlus,
    title:       'Invite your first editor',
    description: 'Add team members so you can assign tasks and track payroll.',
    href:        '/team',
    cta:         'Go to Team',
  },
  {
    icon:        Users,
    title:       'Add your first client',
    description: 'Create a client profile to start tracking projects and invoices.',
    href:        '/clients/new',
    cta:         'Add Client',
  },
  {
    icon:        FolderPlus,
    title:       'Create your first project',
    description: 'Organize work by project to manage tasks, files, and billing in one place.',
    href:        '/projects/new',
    cta:         'New Project',
  },
  {
    icon:        ClipboardList,
    title:       'Create your first task',
    description: 'Assign work to team members with a fixed rate and track completion.',
    href:        '/tasks/new',
    cta:         'New Task',
  },
]

export function OnboardingPrompt() {
  return (
    <div className="rounded-xl border border-dashed p-6">
      <h2 className="text-base font-semibold mb-1">Your organization is ready</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Get started by completing a few setup steps. You can do these in any order.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group flex flex-col gap-3 rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <card.icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm leading-tight">{card.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-snug">{card.description}</p>
            </div>
            <span className="mt-auto text-xs font-medium text-primary">{card.cta} →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
