import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS } from '../types'
import type { OrgRole } from '../types'

const ROLE_CLASS: Record<OrgRole, string> = {
  owner:           'border-purple-500 text-purple-700 dark:text-purple-400',
  admin:           'border-blue-500  text-blue-700  dark:text-blue-400',
  project_manager: 'border-teal-500  text-teal-700  dark:text-teal-400',
  member:          '',
}

export function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <Badge variant="outline" className={ROLE_CLASS[role]}>
      {ROLE_LABELS[role]}
    </Badge>
  )
}
