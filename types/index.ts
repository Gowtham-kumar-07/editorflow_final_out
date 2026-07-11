import type { ComponentType } from 'react'

export type { Database, Json, OrgRole, ClientStatus, ProjectStatus, ProjectPriority } from './supabase'
export type {
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  OrganizationMembership,
  OrganizationWithRole,
  CreateOrganizationParams,
} from './organization'
export type {
  Client,
  ClientInsert,
  ClientUpdate,
  CreateClientData,
  UpdateClientData,
  ClientOption,
} from './client'
export type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectWithClient,
  CreateProjectData,
  UpdateProjectData,
} from './project'

export type NavItem = {
  title: string
  href: string
  icon?: ComponentType<{ className?: string }>
  badge?: string | number
  children?: NavItem[]
}

export type PageParams<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
