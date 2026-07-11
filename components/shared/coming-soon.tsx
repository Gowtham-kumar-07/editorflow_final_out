import { Construction } from 'lucide-react'

type ComingSoonProps = {
  title: string
  description?: string
}

export function ComingSoon({
  title,
  description = 'This section is under construction. Check back soon.',
}: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
        <Construction className="text-muted-foreground h-8 w-8" />
      </div>
      <div className="max-w-sm">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </div>
  )
}
