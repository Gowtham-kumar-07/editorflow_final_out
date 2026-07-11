export const teamKeys = {
  all:         ['team']           as const,
  members:     () => [...teamKeys.all, 'members']     as const,
  invitations: () => [...teamKeys.all, 'invitations'] as const,
}
