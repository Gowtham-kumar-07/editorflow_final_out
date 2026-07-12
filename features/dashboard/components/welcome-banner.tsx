'use client'

import { useState, useEffect } from 'react'
import { X, Users, UserPlus, FolderPlus, ClipboardList } from 'lucide-react'
import Link from 'next/link'

const STORAGE_KEY = 'editorflow_show_welcome'

interface QuickAction {
  label: string
  href:  string
  icon:  React.ElementType
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Invite team',      href: '/team',         icon: UserPlus    },
  { label: 'Add client',       href: '/clients/new',  icon: Users       },
  { label: 'Create project',   href: '/projects/new', icon: FolderPlus  },
  { label: 'Create task',      href: '/tasks/new',    icon: ClipboardList },
]

export function WelcomeBanner({ orgName }: { orgName: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        setVisible(true)
      }
    } catch {}
  }, [])

  function dismiss() {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="relative rounded-xl border bg-primary/5 p-5 mb-2">
      <button
        onClick={dismiss}
        className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="font-semibold text-base">Welcome to EditorFlow, {orgName}!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your organization is ready. Here are a few things to get you started:
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            onClick={dismiss}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <action.icon className="h-3.5 w-3.5 text-primary" />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
