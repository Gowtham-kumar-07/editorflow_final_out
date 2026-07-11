'use client'

import { Building2, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type OrganizationSwitcherProps = {
  orgName: string
}

export function OrganizationSwitcher({ orgName }: OrganizationSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-1.5 px-2 text-sm font-medium">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="hidden max-w-[120px] truncate sm:block">{orgName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Organization
        </DropdownMenuLabel>
        <DropdownMenuItem className="gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{orgName}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Switching organizations coming soon
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
