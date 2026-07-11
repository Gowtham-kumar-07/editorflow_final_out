import type { OrgRole } from '@/types/supabase'

export type { OrgRole }

export type TeamSpecialization = 'editor' | 'designer' | 'photographer' | 'videographer' | 'other'

export const SPECIALIZATION_LABELS: Record<TeamSpecialization, string> = {
  editor:        'Editor',
  designer:      'Designer',
  photographer:  'Photographer',
  videographer:  'Videographer',
  other:         'Other',
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner:           'Owner',
  admin:           'Admin',
  project_manager: 'Project Manager',
  member:          'Member',
}

export interface TeamMember {
  id:              string   // membership id
  user_id:         string
  organization_id: string
  role:            OrgRole
  specialization:  string | null
  is_active:       boolean  // deleted_at IS NULL
  joined_at:       string
  profile: {
    id:         string
    full_name:  string | null
    avatar_url: string | null
    email:      string | null
  }
  workload: {
    active:    number  // todo + in_progress + blocked
    in_review: number
    overdue:   number  // past due_date, not complete/cancelled
  }
}

export interface TeamInvitation {
  id:              string
  organization_id: string
  email:           string
  role:            OrgRole
  specialization:  string | null
  invited_by:      string | null
  expires_at:      string
  accepted_at:     string | null
  created_at:      string
}

export interface GetTeamResult {
  members:     TeamMember[]
  invitations: TeamInvitation[]
}

export interface InvitationDetails {
  id:              string
  email:           string
  role:            string
  specialization:  string | null
  expires_at:      string
  org_name:        string
  invited_by_name: string | null
}
