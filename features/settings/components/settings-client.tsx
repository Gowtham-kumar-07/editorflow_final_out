'use client'

import { canEditSettings } from '@/lib/permissions'
import type { OrgRole }     from '@/types/supabase'
import type { SettingsPageData } from '../types'
import { SettingsNav }            from './settings-nav'
import { ProfileSection }         from './profile-section'
import { OrgProfileSection }      from './org-profile-section'
import { FinancialDefaultsSection } from './financial-defaults-section'
import { InvoiceBrandingSection }  from './invoice-branding-section'
import { PaymentDetailsSection }   from './payment-details-section'
import { ImageUploadSection }      from './image-upload-section'

interface SettingsClientProps {
  data: SettingsPageData
  role: OrgRole
}

export function SettingsClient({ data, role }: SettingsClientProps) {
  const isAdmin = canEditSettings(role)
  const { profile, org } = data

  return (
    <div className="flex gap-8">
      {/* Left nav — hidden on mobile */}
      <aside className="hidden w-48 shrink-0 lg:block">
        <div className="sticky top-24">
          <SettingsNav role={role} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <ProfileSection profile={profile} />

        {isAdmin && org && (
          <>
            <OrgProfileSection org={org} />
            <FinancialDefaultsSection org={org} />
            <InvoiceBrandingSection org={org} />
            <PaymentDetailsSection org={org} />
            <ImageUploadSection org={org} />
          </>
        )}
      </div>
    </div>
  )
}
