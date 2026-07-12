'use server'

import { createClient } from '@/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Sets profiles.active_organization_id for the calling user.
 *
 * Guards:
 *   - User must be authenticated.
 *   - User must have an active (deleted_at IS NULL) membership in the target org.
 *
 * Uses the user-scoped client throughout so auth.uid() and the
 * "profiles: users can update own row" RLS policy are both satisfied.
 */
export async function switchOrganizationAction(
  orgId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Session expired. Please sign in again.' }
  }

  // Membership guard — verify the user actually belongs to this org
  const { data: membership, error: memberError } = await supabase
    .from('organization_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (memberError) {
    logger.error('switchOrganizationAction membership check failed', {
      operation: 'organization_memberships.select',
      code:    memberError.code,
      message: memberError.message,
    })
    return { error: 'Failed to switch organization. Please try again.' }
  }

  if (!membership) {
    logger.warn('switchOrganizationAction: attempted switch to non-member org')
    return { error: 'You do not have access to this organization.' }
  }

  // Update active_organization_id (RLS: "profiles: users can update own row")
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ active_organization_id: orgId })
    .eq('id', user.id)

  if (updateError) {
    logger.error('switchOrganizationAction profile update failed', {
      operation: 'profiles.update',
      code:    updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint:    updateError.hint,
    })
    return { error: 'Failed to switch organization. Please try again.' }
  }

  return { error: null }
}
