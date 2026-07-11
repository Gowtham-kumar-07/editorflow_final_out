import type { Database, ClientStatus } from './supabase'

export type { ClientStatus }

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']

/** Params for creating a new client (org association is required). */
export type CreateClientData = Omit<ClientInsert, 'id' | 'created_at' | 'updated_at'>

/** Params for updating an existing client (org ID cannot be changed). */
export type UpdateClientData = Omit<Partial<CreateClientData>, 'organization_id'>

/** Lightweight client reference used in dropdowns and project associations. */
export type ClientOption = Pick<Client, 'id' | 'company_name'>
