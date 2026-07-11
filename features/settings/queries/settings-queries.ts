export const settingsKeys = {
  all:     () => ['settings'] as const,
  page:    () => [...settingsKeys.all(), 'page'] as const,
  profile: () => [...settingsKeys.all(), 'profile'] as const,
  org:     () => [...settingsKeys.all(), 'org'] as const,
}
