import { Badge } from '@/components/ui/badge'
import { SPECIALIZATION_LABELS } from '../types'
import type { TeamSpecialization } from '../types'

export function SpecializationBadge({ specialization }: { specialization: string | null }) {
  if (!specialization) return <span className="text-muted-foreground text-xs">—</span>
  const label = SPECIALIZATION_LABELS[specialization as TeamSpecialization] ?? specialization
  return <Badge variant="secondary">{label}</Badge>
}
