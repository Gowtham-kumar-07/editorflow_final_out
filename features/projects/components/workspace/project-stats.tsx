'use client'

import { CheckSquare, Users, Receipt, ListTodo } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectStats } from '../../hooks/use-project-workspace'
import { StatsSkeleton } from './skeletons'

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export function ProjectStats({ projectId }: { projectId: string }) {
  const { data: result, isPending } = useProjectStats(projectId)

  if (isPending) return <StatsSkeleton />
  if (!result?.ok) return null

  const { totalTasks, completedTasks, teamMembers, invoices } = result.data

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
      <StatCard icon={ListTodo}    label="Total Tasks"   value={totalTasks} />
      <StatCard icon={CheckSquare} label="Completed"     value={completedTasks} />
      <StatCard icon={Users}       label="Team Members"  value={teamMembers} />
      <StatCard icon={Receipt}     label="Invoices"      value={invoices} />
    </div>
  )
}
