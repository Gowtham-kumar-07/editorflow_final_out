import { PageContainer } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays } from 'lucide-react'

export default function CalendarPage() {
  return (
    <PageContainer title="Calendar" description="View deadlines, meetings, and project milestones.">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Calendar coming soon</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            A unified calendar to keep your team aligned on deadlines and deliverables.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
