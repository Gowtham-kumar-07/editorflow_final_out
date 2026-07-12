export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          created_at: string
          deleted_at: string | null
          file_name: string
          file_size: number
          folder_id: string | null
          id: string
          mime_type: string
          organization_id: string
          original_name: string
          project_id: string | null
          storage_path: string
          thumbnail_url: string | null
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          deleted_at?: string | null
          file_name: string
          file_size: number
          folder_id?: string | null
          id?: string
          mime_type: string
          organization_id: string
          original_name: string
          project_id?: string | null
          storage_path: string
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          file_size?: number
          folder_id?: string | null
          id?: string
          mime_type?: string
          organization_id?: string
          original_name?: string
          project_id?: string | null
          storage_path?: string
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          gst_tax_id: string | null
          id: string
          industry: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gst_tax_id?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          gst_tax_id?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          parent_folder_id: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          parent_folder_id?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_folder_id?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          specialization: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          specialization?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          specialization?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          invoice_id: string
          organization_id: string
          project_id: string | null
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          invoice_id: string
          organization_id: string
          project_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          project_id?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_sequences: {
        Row: {
          last_number: number
          organization_id: string
          year: number
        }
        Insert: {
          last_number?: number
          organization_id: string
          year: number
        }
        Update: {
          last_number?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_projects: {
        Row: {
          created_at: string
          invoice_id: string
          organization_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          invoice_id: string
          organization_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          invoice_id?: string
          organization_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_projects_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          discount: number
          discount_type: string
          discount_value: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          organization_id: string
          paid_amount: number
          paid_at: string | null
          payment_terms: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          balance_due?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          discount_type?: string
          discount_value?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          paid_amount?: number
          paid_at?: string | null
          payment_terms?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          balance_due?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          discount_type?: string
          discount_value?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          paid_at?: string | null
          payment_terms?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      member_income: {
        Row: {
          amount: number
          completed_at: string
          converted_amount: number | null
          created_at: string
          currency: string
          fx_rate: number | null
          fx_rate_source: string | null
          fx_snapshot_date: string | null
          id: string
          member_currency: string | null
          member_id: string
          notes: string | null
          organization_id: string
          original_amount: number | null
          original_currency: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          status: string
          task_id: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          completed_at?: string
          converted_amount?: number | null
          created_at?: string
          currency?: string
          fx_rate?: number | null
          fx_rate_source?: string | null
          fx_snapshot_date?: string | null
          id?: string
          member_currency?: string | null
          member_id: string
          notes?: string | null
          organization_id: string
          original_amount?: number | null
          original_currency?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          status?: string
          task_id: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          completed_at?: string
          converted_amount?: number | null
          created_at?: string
          currency?: string
          fx_rate?: number | null
          fx_rate_source?: string | null
          fx_snapshot_date?: string | null
          id?: string
          member_currency?: string | null
          member_id?: string
          notes?: string | null
          organization_id?: string
          original_amount?: number | null
          original_currency?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          status?: string
          task_id?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_income_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_income_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          dedupe_key: string | null
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          dedupe_key?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          dedupe_key?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bank_swift: string | null
          business_email: string | null
          business_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          default_currency: string
          default_payment_terms_days: number | null
          default_payroll_currency: string
          deleted_at: string | null
          id: string
          invoice_accent_color: string | null
          invoice_footer_text: string | null
          invoice_legal_text: string | null
          invoice_prefix: string
          logo_url: string | null
          name: string
          owner_id: string
          payment_qr_url: string | null
          postal_code: string | null
          slug: string
          state: string | null
          tagline: string | null
          tax_id: string | null
          updated_at: string
          upi_id: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          business_email?: string | null
          business_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          default_payment_terms_days?: number | null
          default_payroll_currency?: string
          deleted_at?: string | null
          id?: string
          invoice_accent_color?: string | null
          invoice_footer_text?: string | null
          invoice_legal_text?: string | null
          invoice_prefix?: string
          logo_url?: string | null
          name: string
          owner_id: string
          payment_qr_url?: string | null
          postal_code?: string | null
          slug: string
          state?: string | null
          tagline?: string | null
          tax_id?: string | null
          updated_at?: string
          upi_id?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          business_email?: string | null
          business_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string
          default_payment_terms_days?: number | null
          default_payroll_currency?: string
          deleted_at?: string | null
          id?: string
          invoice_accent_color?: string | null
          invoice_footer_text?: string | null
          invoice_legal_text?: string | null
          invoice_prefix?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          payment_qr_url?: string | null
          postal_code?: string | null
          slug?: string
          state?: string | null
          tagline?: string | null
          tax_id?: string | null
          updated_at?: string
          upi_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          base_amount: number
          base_currency: string
          created_at: string
          deleted_at: string | null
          fx_rate: number
          fx_rate_date: string | null
          fx_rate_source: string
          id: string
          invoice_id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_currency: string
          transaction_reference: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          base_amount?: number
          base_currency?: string
          created_at?: string
          deleted_at?: string | null
          fx_rate?: number
          fx_rate_date?: string | null
          fx_rate_source?: string
          id?: string
          invoice_id: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_currency?: string
          transaction_reference?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number
          base_currency?: string
          created_at?: string
          deleted_at?: string | null
          fx_rate?: number
          fx_rate_date?: string | null
          fx_rate_source?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_currency?: string
          transaction_reference?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_organization_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          preferred_currency: string
          updated_at: string
        }
        Insert: {
          active_organization_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          preferred_currency?: string
          updated_at?: string
        }
        Update: {
          active_organization_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          preferred_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          project_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          organization_id: string
          priority: Database["public"]["Enums"]["project_priority"]
          progress: number
          project_files_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          organization_id: string
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number
          project_files_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          progress?: number
          project_files_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          task_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          task_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          tag_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          tag_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          tag_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          amount: number
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          organization_id: string
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["project_priority"]
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          task_currency: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          amount?: number
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["project_priority"]
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          task_currency?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          amount?: number
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          organization_id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["project_priority"]
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          task_currency?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      archive_project: { Args: { p_project_id: string }; Returns: undefined }
      cancel_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      create_invitation: {
        Args: {
          p_email: string
          p_org_id: string
          p_role?: Database["public"]["Enums"]["org_role"]
          p_specialization?: string
        }
        Returns: Json
      }
      create_invoice: {
        Args: {
          p_client_id: string
          p_currency: string
          p_discount_type: string
          p_discount_value: number
          p_due_date: string
          p_issue_date: string
          p_line_items: Json
          p_notes: string
          p_org_id: string
          p_payment_terms: string
          p_project_ids: Json
          p_tax_rate: number
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_actor_id: string
          p_body: string
          p_dedupe_key?: string
          p_entity_id?: string
          p_entity_type?: string
          p_link?: string
          p_org_id: string
          p_recipient_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_organization: {
        Args: { p_logo_url?: string; p_name: string; p_slug: string }
        Returns: Json
      }
      deactivate_member: {
        Args: { p_org_id: string; p_target_id: string }
        Returns: undefined
      }
      generate_overdue_invoice_notifications: { Args: never; Returns: number }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      get_my_org_ids: { Args: never; Returns: string[] }
      get_my_role_in_org: { Args: { org_id: string }; Returns: string }
      global_search: {
        Args: { p_query: string }
        Returns: {
          action_url: string
          id: string
          relevance: number
          status: string
          subtitle: string
          title: string
          type: string
        }[]
      }
      mark_all_notifications_read: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      mark_member_income_paid: {
        Args: {
          p_income_id: string
          p_notes?: string
          p_payment_date: string
          p_payment_method: string
          p_transaction_reference?: string
        }
        Returns: {
          amount: number
          completed_at: string
          converted_amount: number | null
          created_at: string
          currency: string
          fx_rate: number | null
          fx_rate_source: string | null
          fx_snapshot_date: string | null
          id: string
          member_currency: string | null
          member_id: string
          notes: string | null
          organization_id: string
          original_amount: number | null
          original_currency: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          status: string
          task_id: string
          transaction_reference: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_income"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      next_invoice_number: { Args: { p_org_id: string }; Returns: string }
      organization_qr_path: {
        Args: { p_ext: string; p_org_slug: string }
        Returns: string
      }
      reactivate_member: {
        Args: { p_org_id: string; p_target_id: string }
        Returns: undefined
      }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_base_amount?: number
          p_base_currency?: string
          p_fx_rate?: number
          p_fx_rate_date?: string
          p_fx_rate_source?: string
          p_invoice_id: string
          p_notes: string
          p_payment_date: string
          p_payment_method: string
          p_transaction_currency?: string
          p_transaction_ref: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transition_invoice_status: {
        Args: {
          p_invoice_id: string
          p_new_status: Database["public"]["Enums"]["invoice_status"]
        }
        Returns: undefined
      }
      transition_task_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["task_status"]
          p_task_id: string
        }
        Returns: undefined
      }
      update_income_fx_snapshot: {
        Args: {
          p_converted_amount: number
          p_fx_rate: number
          p_fx_rate_source: string
          p_fx_snapshot_date: string
          p_member_currency: string
          p_task_id: string
        }
        Returns: undefined
      }
      update_invoice: {
        Args: {
          p_client_id: string
          p_currency: string
          p_discount_type: string
          p_discount_value: number
          p_due_date: string
          p_invoice_id: string
          p_issue_date: string
          p_line_items: Json
          p_notes: string
          p_payment_terms: string
          p_project_ids: Json
          p_tax_rate: number
        }
        Returns: Json
      }
      update_member_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["org_role"]
          p_org_id: string
          p_target_id: string
        }
        Returns: undefined
      }
      update_member_specialization: {
        Args: {
          p_org_id: string
          p_specialization: string
          p_target_id: string
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: { p_full_name: string; p_preferred_currency?: string }
        Returns: Json
      }
      update_organization_settings: {
        Args: { p_org_id: string; p_updates: Json }
        Returns: Json
      }
      update_project_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["project_status"]
          p_project_id: string
        }
        Returns: undefined
      }
      void_invoice_payment: {
        Args: { p_payment_id: string; p_void_reason: string }
        Returns: undefined
      }
      log_activity: {
        Args: {
          p_organization_id: string
          p_entity_type:     string
          p_entity_id:       string
          p_activity_type:   string
          p_metadata?:       Json | null
        }
        Returns: void
      }
    }

    Enums: {
      activity_type:
        | "created"
        | "updated"
        | "deleted"
        | "commented"
        | "assigned"
        | "uploaded"
        | "completed"
        | "payment_received"
      asset_type: "video" | "image" | "audio" | "document" | "other"
      client_status: "active" | "inactive" | "archived"
      invoice_status:
        | "draft"
        | "sent"
        | "paid"
        | "partial"
        | "overdue"
        | "cancelled"
      org_role: "owner" | "admin" | "project_manager" | "member"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "completed"
        | "voided"
      project_priority: "low" | "medium" | "high" | "urgent"
      project_status:
        | "draft"
        | "planning"
        | "active"
        | "on_hold"
        | "review"
        | "completed"
        | "cancelled"
        | "archived"
      task_status: "todo" | "in_progress" | "review" | "completed" | "blocked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "created",
        "updated",
        "deleted",
        "commented",
        "assigned",
        "uploaded",
        "completed",
        "payment_received",
      ],
      asset_type: ["video", "image", "audio", "document", "other"],
      client_status: ["active", "inactive", "archived"],
      invoice_status: [
        "draft",
        "sent",
        "paid",
        "partial",
        "overdue",
        "cancelled",
      ],
      org_role: ["owner", "admin", "project_manager", "member"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "completed",
        "voided",
      ],
      project_priority: ["low", "medium", "high", "urgent"],
      project_status: [
        "draft",
        "planning",
        "active",
        "on_hold",
        "review",
        "completed",
        "cancelled",
        "archived",
      ],
      task_status: ["todo", "in_progress", "review", "completed", "blocked"],
    },
  },
} as const


// ─── Convenience type aliases ─────────────────────────────────────────────────
// Re-export database enum types as named aliases so feature modules can import
// them without referencing Database['public']['Enums']['...'] directly.
// Generated by scripts/gen-types.mjs — do not edit this block manually.

export type ActivityType      = Database['public']['Enums']['activity_type']
export type AssetType         = Database['public']['Enums']['asset_type']
export type ClientStatus      = Database['public']['Enums']['client_status']
export type InvoiceStatus     = Database['public']['Enums']['invoice_status']
export type OrgRole           = Database['public']['Enums']['org_role']
export type PaymentStatus     = Database['public']['Enums']['payment_status']
export type ProjectPriority   = Database['public']['Enums']['project_priority']
export type ProjectStatus     = Database['public']['Enums']['project_status']
export type TaskStatus        = Database['public']['Enums']['task_status']

// Tasks reuse project_priority for their priority field (no separate task_priority enum).
export type TaskPriority      = Database['public']['Enums']['project_priority']

// project_members.role is stored as plain text (no dedicated enum in the schema).
export type ProjectMemberRole = string
