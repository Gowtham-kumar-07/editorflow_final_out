import type { Client } from '@/types/client'
import type { Json, ProjectStatus, ProjectPriority, InvoiceStatus, ActivityType } from '@/types/supabase'

export type { Client, ClientStatus } from '@/types/client'
export type { ProjectStatus, ProjectPriority, InvoiceStatus, ActivityType, Json }

export type ClientSortField = 'company_name' | 'created_at' | 'updated_at'
export type ClientSortOrder = 'asc' | 'desc'
export type ClientStatusFilter = 'active' | 'inactive' | 'archived' | 'all'

export interface ClientFilters {
  search?: string
  statusFilter?: ClientStatusFilter
  sortBy?: ClientSortField
  sortOrder?: ClientSortOrder
  page?: number
  pageSize?: number
}

export interface ClientWithCounts extends Client {
  project_count: number
  invoice_count: number
}

export interface GetClientsResult {
  clients: ClientWithCounts[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Client Detail section types ──────────────────────────────────────────────

export interface ClientProject {
  id: string
  name: string
  status: ProjectStatus
  priority: ProjectPriority
  progress: number
  due_date: string | null
  created_at: string
}

export interface ClientInvoice {
  id: string
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  total: number
  created_at: string
}

export interface ClientActivity {
  id: string
  activity_type: ActivityType
  entity_type: string
  metadata: Json | null
  created_at: string
}
