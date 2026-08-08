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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          description: string
          id: string
          ip_address: string | null
          metadata: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          triggered_by: string | null
          triggered_by_type: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          description: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          title: string
          triggered_by?: string | null
          triggered_by_type?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          triggered_by?: string | null
          triggered_by_type?: string | null
        }
        Relationships: []
      }
      admin_financial_actions_log: {
        Row: {
          action_type: string
          admin_id: string
          amount: number | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          admin_id: string
          amount?: number | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          amount?: number | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_notification_logs: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          description: string | null
          id: string
          new_value: Json | null
          notification_id: string
          previous_value: Json | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          notification_id: string
          previous_value?: Json | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          notification_id?: string
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_recipients: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_status: string
          id: string
          notification_id: string
          read_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          notification_id: string
          read_at?: string | null
          user_id: string
          user_type?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          notification_id?: string
          read_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          scheduled_at: string | null
          sent_at: string | null
          specific_user_ids: string[] | null
          status: string
          target_audience: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          scheduled_at?: string | null
          sent_at?: string | null
          specific_user_ids?: string[] | null
          status?: string
          target_audience?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          scheduled_at?: string | null
          sent_at?: string | null
          specific_user_ids?: string[] | null
          status?: string
          target_audience?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_password_resets: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          reset_token: string
          used: boolean
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          reset_token: string
          used?: boolean
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          reset_token?: string
          used?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_password_resets_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_pending_approvals: {
        Row: {
          action_type: string
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          expires_at: string
          id: string
          initiated_at: string
          initiated_by: string
          ip_address: string | null
          metadata: Json | null
          reason: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          initiated_at?: string
          initiated_by: string
          ip_address?: string | null
          metadata?: Json | null
          reason: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          initiated_at?: string
          initiated_by?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          failed_login_attempts: number
          id: string
          is_active: boolean
          last_login_at: string | null
          locked_until: string | null
          pin_hash: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          failed_login_attempts?: number
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          locked_until?: string | null
          pin_hash: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          failed_login_attempts?: number
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          locked_until?: string | null
          pin_hash?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_key_audit_log: {
        Row: {
          action: string
          api_key_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          key_prefix: string | null
          merchant_id: string
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          key_prefix?: string | null
          merchant_id: string
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          key_prefix?: string | null
          merchant_id?: string
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          customer_id: string
          id: string
          ifsc_code: string
          is_default: boolean
          is_verified: boolean
          updated_at: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          account_holder_name: string
          account_number: string
          account_type?: string
          bank_name: string
          created_at?: string
          customer_id: string
          id?: string
          ifsc_code: string
          is_default?: boolean
          is_verified?: boolean
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          customer_id?: string
          id?: string
          ifsc_code?: string
          is_default?: boolean
          is_verified?: boolean
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      blocked_entities: {
        Row: {
          admin_notes: string | null
          block_reason: string
          blocked_at: string
          created_by: string | null
          entity_identifier: string
          entity_identifier_masked: string | null
          entity_type: string
          expires_at: string | null
          id: string
          is_permanent: boolean
          is_whitelisted: boolean
          metadata: Json | null
          risk_score: number | null
          rule_id: string | null
          rule_name: string | null
          session_id: string | null
          unblock_reason: string | null
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          block_reason: string
          blocked_at?: string
          created_by?: string | null
          entity_identifier: string
          entity_identifier_masked?: string | null
          entity_type: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          is_whitelisted?: boolean
          metadata?: Json | null
          risk_score?: number | null
          rule_id?: string | null
          rule_name?: string | null
          session_id?: string | null
          unblock_reason?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          block_reason?: string
          blocked_at?: string
          created_by?: string | null
          entity_identifier?: string
          entity_identifier_masked?: string | null
          entity_type?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          is_whitelisted?: boolean
          metadata?: Json | null
          risk_score?: number | null
          rule_id?: string | null
          rule_name?: string | null
          session_id?: string | null
          unblock_reason?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_entities_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_entities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_attempts: {
        Row: {
          amount: number
          completed_at: string | null
          error_code: string | null
          error_message: string | null
          gateway: string | null
          gateway_order_id: string | null
          gateway_payment_id: string | null
          gateway_signature: string | null
          id: string
          initiated_at: string
          metadata: Json | null
          payment_method: Database["public"]["Enums"]["checkout_payment_method"]
          session_id: string
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          gateway?: string | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          id?: string
          initiated_at?: string
          metadata?: Json | null
          payment_method: Database["public"]["Enums"]["checkout_payment_method"]
          session_id: string
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          gateway?: string | null
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          id?: string
          initiated_at?: string
          metadata?: Json | null
          payment_method?: Database["public"]["Enums"]["checkout_payment_method"]
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          previous_step: Database["public"]["Enums"]["checkout_step"] | null
          session_id: string
          step: Database["public"]["Enums"]["checkout_step"] | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          previous_step?: Database["public"]["Enums"]["checkout_step"] | null
          session_id: string
          step?: Database["public"]["Enums"]["checkout_step"] | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          previous_step?: Database["public"]["Enums"]["checkout_step"] | null
          session_id?: string
          step?: Database["public"]["Enums"]["checkout_step"] | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_risk_flags: {
        Row: {
          auto_blocked: boolean
          created_at: string
          description: string | null
          flag_type: string
          id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string
          severity: string
        }
        Insert: {
          auto_blocked?: boolean
          created_at?: string
          description?: string | null
          flag_type: string
          id?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id: string
          severity?: string
        }
        Update: {
          auto_blocked?: boolean
          created_at?: string
          description?: string | null
          flag_type?: string
          id?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_risk_flags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          cart_data: Json
          cart_total: number
          cod_available: boolean
          cod_fee: number
          cod_verification_required: boolean
          completed_at: string | null
          created_at: string
          current_step: Database["public"]["Enums"]["checkout_step"]
          delivery_estimate: string | null
          device_fingerprint: string | null
          discount_amount: number
          email: string | null
          expires_at: string
          final_amount: number
          id: string
          ip_address: string | null
          is_guest: boolean
          last_payment_error: string | null
          merchant_id: string
          metadata: Json | null
          order_id: string | null
          otp_attempts: number
          otp_sent_at: string | null
          otp_verified: boolean
          payment_attempts: number
          payment_id: string | null
          payment_link_id: string | null
          phone_number: string | null
          phone_snapshot: string | null
          selected_payment_method:
            | Database["public"]["Enums"]["checkout_payment_method"]
            | null
          shipping_address: Json | null
          shipping_address_id: string | null
          shipping_amount: number
          shipping_name: string | null
          shipping_pincode: string | null
          status: Database["public"]["Enums"]["checkout_session_status"]
          tax_amount: number
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          cart_data?: Json
          cart_total?: number
          cod_available?: boolean
          cod_fee?: number
          cod_verification_required?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: Database["public"]["Enums"]["checkout_step"]
          delivery_estimate?: string | null
          device_fingerprint?: string | null
          discount_amount?: number
          email?: string | null
          expires_at?: string
          final_amount?: number
          id?: string
          ip_address?: string | null
          is_guest?: boolean
          last_payment_error?: string | null
          merchant_id: string
          metadata?: Json | null
          order_id?: string | null
          otp_attempts?: number
          otp_sent_at?: string | null
          otp_verified?: boolean
          payment_attempts?: number
          payment_id?: string | null
          payment_link_id?: string | null
          phone_number?: string | null
          phone_snapshot?: string | null
          selected_payment_method?:
            | Database["public"]["Enums"]["checkout_payment_method"]
            | null
          shipping_address?: Json | null
          shipping_address_id?: string | null
          shipping_amount?: number
          shipping_name?: string | null
          shipping_pincode?: string | null
          status?: Database["public"]["Enums"]["checkout_session_status"]
          tax_amount?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          cart_data?: Json
          cart_total?: number
          cod_available?: boolean
          cod_fee?: number
          cod_verification_required?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: Database["public"]["Enums"]["checkout_step"]
          delivery_estimate?: string | null
          device_fingerprint?: string | null
          discount_amount?: number
          email?: string | null
          expires_at?: string
          final_amount?: number
          id?: string
          ip_address?: string | null
          is_guest?: boolean
          last_payment_error?: string | null
          merchant_id?: string
          metadata?: Json | null
          order_id?: string | null
          otp_attempts?: number
          otp_sent_at?: string | null
          otp_verified?: boolean
          payment_attempts?: number
          payment_id?: string | null
          payment_link_id?: string | null
          phone_number?: string | null
          phone_snapshot?: string | null
          selected_payment_method?:
            | Database["public"]["Enums"]["checkout_payment_method"]
            | null
          shipping_address?: Json | null
          shipping_address_id?: string | null
          shipping_amount?: number
          shipping_name?: string | null
          shipping_pincode?: string | null
          status?: Database["public"]["Enums"]["checkout_session_status"]
          tax_amount?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_settings_audit: {
        Row: {
          admin_id: string
          change_reason: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          previous_value: Json | null
          setting_key: string | null
          setting_table: string
        }
        Insert: {
          admin_id: string
          change_reason?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          setting_key?: string | null
          setting_table: string
        }
        Update: {
          admin_id?: string
          change_reason?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          setting_key?: string | null
          setting_table?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          label: string
          phone: string
          pincode: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          phone: string
          pincode: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_proofs: {
        Row: {
          created_at: string
          customer_id: string
          file_path: string
          id: string
          notes: string | null
          order_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          file_path: string
          id?: string
          notes?: string | null
          order_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          file_path?: string
          id?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_comments: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          is_admin: boolean | null
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          is_admin?: boolean | null
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          is_admin?: boolean | null
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_comments_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_files: {
        Row: {
          created_at: string
          dispute_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_files_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_responses: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          merchant_id: string
          response_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          merchant_id: string
          response_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          merchant_id?: string
          response_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_responses_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_updates: {
        Row: {
          actor_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          dispute_id: string
          id: string
          status: string | null
          title: string
          update_type: string | null
        }
        Insert: {
          actor_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dispute_id: string
          id?: string
          status?: string | null
          title: string
          update_type?: string | null
        }
        Update: {
          actor_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dispute_id?: string
          id?: string
          status?: string | null
          title?: string
          update_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispute_updates_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_id: string
          description: string
          documents: string[] | null
          final_decision: string | null
          id: string
          issue_type: string | null
          merchant_responded: boolean | null
          order_id: string
          reason: string
          refund_amount: number | null
          refund_transaction_id: string | null
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_id: string
          description: string
          documents?: string[] | null
          final_decision?: string | null
          id?: string
          issue_type?: string | null
          merchant_responded?: boolean | null
          order_id: string
          reason: string
          refund_amount?: number | null
          refund_transaction_id?: string | null
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          documents?: string[] | null
          final_decision?: string | null
          id?: string
          issue_type?: string | null
          merchant_responded?: boolean | null
          order_id?: string
          reason?: string
          refund_amount?: number | null
          refund_transaction_id?: string | null
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          new_state: Json | null
          order_id: string
          performed_by: string
          performed_by_role: string
          previous_state: Json | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          order_id: string
          performed_by: string
          performed_by_role: string
          previous_state?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          order_id?: string
          performed_by?: string
          performed_by_role?: string
          previous_state?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_accounts: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          is_frozen: boolean
          locked_balance: number
          merchant_id: string
          notes: string | null
          risk_flag: string | null
          total_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          is_frozen?: boolean
          locked_balance?: number
          merchant_id: string
          notes?: string | null
          risk_flag?: string | null
          total_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          is_frozen?: boolean
          locked_balance?: number
          merchant_id?: string
          notes?: string | null
          risk_flag?: string | null
          total_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      escrow_resolution_log: {
        Row: {
          admin_id: string | null
          amount: number
          approval_source: string
          created_at: string
          escrow_account_id: string | null
          id: string
          idempotency_key: string
          ip_address: string | null
          new_order_status: string
          order_id: string
          previous_order_status: string
          reason: string
          resolution_type: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          approval_source: string
          created_at?: string
          escrow_account_id?: string | null
          id?: string
          idempotency_key: string
          ip_address?: string | null
          new_order_status: string
          order_id: string
          previous_order_status: string
          reason: string
          resolution_type: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          approval_source?: string
          created_at?: string
          escrow_account_id?: string | null
          id?: string
          idempotency_key?: string
          ip_address?: string | null
          new_order_status?: string
          order_id?: string
          previous_order_status?: string
          reason?: string
          resolution_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_resolution_log_escrow_account_id_fkey"
            columns: ["escrow_account_id"]
            isOneToOne: false
            referencedRelation: "escrow_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_resolution_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          escrow_account_id: string
          id: string
          order_id: string | null
          reason: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          escrow_account_id: string
          id?: string
          order_id?: string | null
          reason?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          escrow_account_id?: string
          id?: string
          order_id?: string | null
          reason?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_escrow_account_id_fkey"
            columns: ["escrow_account_id"]
            isOneToOne: false
            referencedRelation: "escrow_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          audience: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          audience?: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          audience?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      gateway_admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          gateway_id: string | null
          id: string
          ip_address: string | null
          new_state: Json | null
          previous_state: Json | null
          reason: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          gateway_id?: string | null
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          gateway_id?: string | null
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_admin_actions_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_error_logs: {
        Row: {
          amount: number | null
          attempt_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          gateway_id: string | null
          id: string
          merchant_id: string | null
          payment_method: string | null
          session_id: string | null
        }
        Insert: {
          amount?: number | null
          attempt_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          gateway_id?: string | null
          id?: string
          merchant_id?: string | null
          payment_method?: string | null
          session_id?: string | null
        }
        Update: {
          amount?: number | null
          attempt_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          gateway_id?: string | null
          id?: string
          merchant_id?: string | null
          payment_method?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_error_logs_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_health_metrics: {
        Row: {
          avg_latency_ms: number
          failure_rate_1h: number
          failure_rate_24h: number
          gateway_id: string
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          success_rate_1h: number
          success_rate_24h: number
          timeout_rate_1h: number
          timeout_rate_24h: number
          total_attempts_1h: number
          total_attempts_24h: number
          updated_at: string
        }
        Insert: {
          avg_latency_ms?: number
          failure_rate_1h?: number
          failure_rate_24h?: number
          gateway_id: string
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          success_rate_1h?: number
          success_rate_24h?: number
          timeout_rate_1h?: number
          timeout_rate_24h?: number
          total_attempts_1h?: number
          total_attempts_24h?: number
          updated_at?: string
        }
        Update: {
          avg_latency_ms?: number
          failure_rate_1h?: number
          failure_rate_24h?: number
          gateway_id?: string
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          success_rate_1h?: number
          success_rate_24h?: number
          timeout_rate_1h?: number
          timeout_rate_24h?: number
          total_attempts_1h?: number
          total_attempts_24h?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_health_metrics_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_incidents: {
        Row: {
          auto_detected: boolean
          created_by: string | null
          description: string | null
          gateway_id: string
          id: string
          incident_type: string
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          started_at: string
          title: string
        }
        Insert: {
          auto_detected?: boolean
          created_by?: string | null
          description?: string | null
          gateway_id: string
          id?: string
          incident_type: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          started_at?: string
          title: string
        }
        Update: {
          auto_detected?: boolean
          created_by?: string | null
          description?: string | null
          gateway_id?: string
          id?: string
          incident_type?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          started_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_incidents_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_overrides: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          expires_at: string | null
          gateway_id: string
          id: string
          is_active: boolean
          override_type: string
          reason: string
          starts_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by: string
          expires_at?: string | null
          gateway_id: string
          id?: string
          is_active?: boolean
          override_type: string
          reason: string
          starts_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          expires_at?: string | null
          gateway_id?: string
          id?: string
          is_active?: boolean
          override_type?: string
          reason?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_overrides_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_routing_rules: {
        Row: {
          config: Json
          id: string
          is_enabled: boolean
          rule_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          is_enabled?: boolean
          rule_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          is_enabled?: boolean
          rule_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      killswitch_audit_log: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          id: string
          incident_id: string | null
          ip_address: string | null
          new_level: number | null
          previous_level: number | null
          reason: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          id?: string
          incident_id?: string | null
          ip_address?: string | null
          new_level?: number | null
          previous_level?: number | null
          reason: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          id?: string
          incident_id?: string | null
          ip_address?: string | null
          new_level?: number | null
          previous_level?: number | null
          reason?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "killswitch_audit_log_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "platform_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_actions_log: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          document_hash: string | null
          document_type: string | null
          id: string
          ip_address: string | null
          kyc_id: string
          kyc_type: string
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          document_hash?: string | null
          document_type?: string | null
          id?: string
          ip_address?: string | null
          kyc_id: string
          kyc_type: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          document_hash?: string | null
          document_type?: string | null
          id?: string
          ip_address?: string | null
          kyc_id?: string
          kyc_type?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      kyc_document_history: {
        Row: {
          created_at: string
          document_type: string
          file_hash: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          kyc_id: string
          kyc_type: string
          replaced_by: string | null
          submission_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          kyc_id: string
          kyc_type: string
          replaced_by?: string | null
          submission_number: number
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          kyc_id?: string
          kyc_type?: string
          replaced_by?: string | null
          submission_number?: number
          user_id?: string
        }
        Relationships: []
      }
      kyc_document_reuse_attempts: {
        Row: {
          attempted_by: string
          created_at: string
          document_hash: string
          document_type: string
          id: string
          ip_address: string | null
          original_kyc_id: string
          original_user_id: string
          user_agent: string | null
        }
        Insert: {
          attempted_by: string
          created_at?: string
          document_hash: string
          document_type: string
          id?: string
          ip_address?: string | null
          original_kyc_id: string
          original_user_id: string
          user_agent?: string | null
        }
        Update: {
          attempted_by?: string
          created_at?: string
          document_hash?: string
          document_type?: string
          id?: string
          ip_address?: string | null
          original_kyc_id?: string
          original_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      kyc_records: {
        Row: {
          address: string | null
          address_proof_url: string | null
          city: string | null
          country: string | null
          created_at: string
          customer_id: string | null
          date_of_birth: string | null
          document_number_hash: string | null
          full_legal_name: string | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string | null
          id_type: string | null
          kyc_level: string | null
          last_rejection_id: string | null
          pincode: string | null
          rejected_at: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          state: string | null
          status: string
          submission_count: number | null
          submitted_at: string | null
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          address_proof_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          document_number_hash?: string | null
          full_legal_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          kyc_level?: string | null
          last_rejection_id?: string | null
          pincode?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          state?: string | null
          status?: string
          submission_count?: number | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          address_proof_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          document_number_hash?: string | null
          full_legal_name?: string | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          id_type?: string | null
          kyc_level?: string | null
          last_rejection_id?: string | null
          pincode?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          state?: string | null
          status?: string
          submission_count?: number | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      merchant_activity: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          merchant_id: string
          reference_id: string | null
          reference_type: string | null
          title: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          merchant_id: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          merchant_id?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
        }
        Relationships: []
      }
      merchant_api_keys: {
        Row: {
          created_at: string
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          key_type: string
          last_used_at: string | null
          merchant_id: string
          name: string
          scopes: string[]
          status: string
        }
        Insert: {
          created_at?: string
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          key_type?: string
          last_used_at?: string | null
          merchant_id: string
          name: string
          scopes?: string[]
          status?: string
        }
        Update: {
          created_at?: string
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          key_type?: string
          last_used_at?: string | null
          merchant_id?: string
          name?: string
          scopes?: string[]
          status?: string
        }
        Relationships: []
      }
      merchant_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          account_type: string
          bank_name: string
          branch_name: string | null
          created_at: string
          id: string
          ifsc_code: string
          is_default: boolean
          is_verified: boolean
          merchant_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          account_type?: string
          bank_name: string
          branch_name?: string | null
          created_at?: string
          id?: string
          ifsc_code: string
          is_default?: boolean
          is_verified?: boolean
          merchant_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          branch_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string
          is_default?: boolean
          is_verified?: boolean
          merchant_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      merchant_checkout_config: {
        Row: {
          created_at: string
          id: string
          login_autolink_by_phone: boolean
          login_guest_checkout_enabled: boolean
          login_guest_max_order_value: number
          login_otp_cooldown_seconds: number
          login_otp_enabled: boolean
          login_otp_retry_limit: number
          login_require_before_payment: boolean
          login_returning_user_autologin: boolean
          merchant_id: string
          payment_cards_enabled: boolean
          payment_emi_enabled: boolean
          payment_methods_order: string[]
          payment_netbanking_enabled: boolean
          payment_reorder_by_device: boolean
          payment_reorder_by_success_rate: boolean
          payment_reorder_by_value: boolean
          payment_upi_enabled: boolean
          payment_wallets_enabled: boolean
          prepaid_discount_enabled: boolean
          prepaid_discount_type: string
          prepaid_discount_value: number
          prepaid_first_time_only: boolean
          prepaid_message: string
          prepaid_min_order_value: number
          prepaid_nudges_enabled: boolean
          prepaid_urgency_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_autolink_by_phone?: boolean
          login_guest_checkout_enabled?: boolean
          login_guest_max_order_value?: number
          login_otp_cooldown_seconds?: number
          login_otp_enabled?: boolean
          login_otp_retry_limit?: number
          login_require_before_payment?: boolean
          login_returning_user_autologin?: boolean
          merchant_id: string
          payment_cards_enabled?: boolean
          payment_emi_enabled?: boolean
          payment_methods_order?: string[]
          payment_netbanking_enabled?: boolean
          payment_reorder_by_device?: boolean
          payment_reorder_by_success_rate?: boolean
          payment_reorder_by_value?: boolean
          payment_upi_enabled?: boolean
          payment_wallets_enabled?: boolean
          prepaid_discount_enabled?: boolean
          prepaid_discount_type?: string
          prepaid_discount_value?: number
          prepaid_first_time_only?: boolean
          prepaid_message?: string
          prepaid_min_order_value?: number
          prepaid_nudges_enabled?: boolean
          prepaid_urgency_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          login_autolink_by_phone?: boolean
          login_guest_checkout_enabled?: boolean
          login_guest_max_order_value?: number
          login_otp_cooldown_seconds?: number
          login_otp_enabled?: boolean
          login_otp_retry_limit?: number
          login_require_before_payment?: boolean
          login_returning_user_autologin?: boolean
          merchant_id?: string
          payment_cards_enabled?: boolean
          payment_emi_enabled?: boolean
          payment_methods_order?: string[]
          payment_netbanking_enabled?: boolean
          payment_reorder_by_device?: boolean
          payment_reorder_by_success_rate?: boolean
          payment_reorder_by_value?: boolean
          payment_upi_enabled?: boolean
          payment_wallets_enabled?: boolean
          prepaid_discount_enabled?: boolean
          prepaid_discount_type?: string
          prepaid_discount_value?: number
          prepaid_first_time_only?: boolean
          prepaid_message?: string
          prepaid_min_order_value?: number
          prepaid_nudges_enabled?: boolean
          prepaid_urgency_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      merchant_checkout_config_audit: {
        Row: {
          change_type: string
          changed_by: string
          config_id: string
          created_at: string
          id: string
          merchant_id: string
          new_values: Json | null
          previous_values: Json | null
        }
        Insert: {
          change_type: string
          changed_by: string
          config_id: string
          created_at?: string
          id?: string
          merchant_id: string
          new_values?: Json | null
          previous_values?: Json | null
        }
        Update: {
          change_type?: string
          changed_by?: string
          config_id?: string
          created_at?: string
          id?: string
          merchant_id?: string
          new_values?: Json | null
          previous_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_config_audit_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "merchant_checkout_config"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_evidence: {
        Row: {
          created_at: string
          description: string | null
          dispute_id: string
          evidence_type: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          merchant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dispute_id: string
          evidence_type?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          merchant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dispute_id?: string
          evidence_type?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_integration_checklist: {
        Row: {
          api_key_generated: boolean
          api_key_generated_at: string | null
          checkout_tested: boolean
          checkout_tested_at: string | null
          created_at: string
          id: string
          live_mode_enabled: boolean
          live_mode_enabled_at: string | null
          merchant_id: string
          updated_at: string
          webhook_configured: boolean
          webhook_configured_at: string | null
        }
        Insert: {
          api_key_generated?: boolean
          api_key_generated_at?: string | null
          checkout_tested?: boolean
          checkout_tested_at?: string | null
          created_at?: string
          id?: string
          live_mode_enabled?: boolean
          live_mode_enabled_at?: string | null
          merchant_id: string
          updated_at?: string
          webhook_configured?: boolean
          webhook_configured_at?: string | null
        }
        Update: {
          api_key_generated?: boolean
          api_key_generated_at?: string | null
          checkout_tested?: boolean
          checkout_tested_at?: string | null
          created_at?: string
          id?: string
          live_mode_enabled?: boolean
          live_mode_enabled_at?: string | null
          merchant_id?: string
          updated_at?: string
          webhook_configured?: boolean
          webhook_configured_at?: string | null
        }
        Relationships: []
      }
      merchant_integrations: {
        Row: {
          created_at: string
          integration_status: string
          last_live_at: string | null
          last_test_at: string | null
          live_mode_enabled: boolean
          merchant_id: string
          test_mode_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          integration_status?: string
          last_live_at?: string | null
          last_test_at?: string | null
          live_mode_enabled?: boolean
          merchant_id: string
          test_mode_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          integration_status?: string
          last_live_at?: string | null
          last_test_at?: string | null
          live_mode_enabled?: boolean
          merchant_id?: string
          test_mode_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      merchant_kyc: {
        Row: {
          additional_notes: string | null
          business_type: string | null
          created_at: string
          gst_number: string | null
          gst_number_hash: string | null
          id: string
          last_rejection_id: string | null
          legal_business_name: string | null
          merchant_id: string
          owner_dob: string | null
          owner_name: string | null
          owner_phone: string | null
          pan_number: string | null
          pan_number_hash: string | null
          registered_address: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_count: number | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          additional_notes?: string | null
          business_type?: string | null
          created_at?: string
          gst_number?: string | null
          gst_number_hash?: string | null
          id?: string
          last_rejection_id?: string | null
          legal_business_name?: string | null
          merchant_id: string
          owner_dob?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          pan_number_hash?: string | null
          registered_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_count?: number | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          additional_notes?: string | null
          business_type?: string | null
          created_at?: string
          gst_number?: string | null
          gst_number_hash?: string | null
          id?: string
          last_rejection_id?: string | null
          legal_business_name?: string | null
          merchant_id?: string
          owner_dob?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          pan_number?: string | null
          pan_number_hash?: string | null
          registered_address?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_count?: number | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      merchant_kyc_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          kyc_id: string | null
          merchant_id: string
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          kyc_id?: string | null
          merchant_id: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          kyc_id?: string | null
          merchant_id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_kyc_documents_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "merchant_kyc"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_notification_prefs: {
        Row: {
          created_at: string
          dispute_email: boolean
          dispute_in_app: boolean
          dispute_sms: boolean
          id: string
          merchant_id: string
          order_email: boolean
          order_in_app: boolean
          order_sms: boolean
          payment_email: boolean
          payment_in_app: boolean
          payment_sms: boolean
          payout_email: boolean
          payout_in_app: boolean
          payout_sms: boolean
          system_email: boolean
          system_in_app: boolean
          system_sms: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispute_email?: boolean
          dispute_in_app?: boolean
          dispute_sms?: boolean
          id?: string
          merchant_id: string
          order_email?: boolean
          order_in_app?: boolean
          order_sms?: boolean
          payment_email?: boolean
          payment_in_app?: boolean
          payment_sms?: boolean
          payout_email?: boolean
          payout_in_app?: boolean
          payout_sms?: boolean
          system_email?: boolean
          system_in_app?: boolean
          system_sms?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispute_email?: boolean
          dispute_in_app?: boolean
          dispute_sms?: boolean
          id?: string
          merchant_id?: string
          order_email?: boolean
          order_in_app?: boolean
          order_sms?: boolean
          payment_email?: boolean
          payment_in_app?: boolean
          payment_sms?: boolean
          payout_email?: boolean
          payout_in_app?: boolean
          payout_sms?: boolean
          system_email?: boolean
          system_in_app?: boolean
          system_sms?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      merchant_notifications: {
        Row: {
          archived_at: string | null
          body: string
          created_at: string
          data: Json | null
          id: string
          merchant_id: string
          priority: string
          read_at: string | null
          related_dispute_id: string | null
          related_order_id: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          merchant_id: string
          priority?: string
          read_at?: string | null
          related_dispute_id?: string | null
          related_order_id?: string | null
          status?: string
          title: string
          type?: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          merchant_id?: string
          priority?: string
          read_at?: string | null
          related_dispute_id?: string | null
          related_order_id?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_notifications_related_dispute_id_fkey"
            columns: ["related_dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_order_actions_log: {
        Row: {
          action_type: string
          created_at: string
          field_changes: Json | null
          id: string
          ip_address: string | null
          merchant_id: string
          new_status: string | null
          order_id: string
          previous_status: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          field_changes?: Json | null
          id?: string
          ip_address?: string | null
          merchant_id: string
          new_status?: string | null
          order_id: string
          previous_status?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          field_changes?: Json | null
          id?: string
          ip_address?: string | null
          merchant_id?: string
          new_status?: string | null
          order_id?: string
          previous_status?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_actions_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payouts: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          failure_reason: string | null
          fee: number
          gst: number | null
          id: string
          idempotency_key: string | null
          merchant_id: string
          net_amount: number
          notes: string | null
          platform_fee: number | null
          processed_at: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          withdrawal_fee: number | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          failure_reason?: string | null
          fee?: number
          gst?: number | null
          id?: string
          idempotency_key?: string | null
          merchant_id: string
          net_amount: number
          notes?: string | null
          platform_fee?: number | null
          processed_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          withdrawal_fee?: number | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          failure_reason?: string | null
          fee?: number
          gst?: number | null
          id?: string
          idempotency_key?: string | null
          merchant_id?: string
          net_amount?: number
          notes?: string | null
          platform_fee?: number | null
          processed_at?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          withdrawal_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payouts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "merchant_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          currency: string | null
          entry_type: string | null
          id: string
          merchant_id: string
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          currency?: string | null
          entry_type?: string | null
          id?: string
          merchant_id: string
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          currency?: string | null
          entry_type?: string | null
          id?: string
          merchant_id?: string
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: []
      }
      merchant_wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          merchant_id: string
          pending_balance: number
          status: string
          total_paid_out: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          merchant_id: string
          pending_balance?: number
          status?: string
          total_paid_out?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          merchant_id?: string
          pending_balance?: number
          status?: string
          total_paid_out?: number
          updated_at?: string
        }
        Relationships: []
      }
      merchant_webhooks: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          last_status: number | null
          last_triggered_at: string | null
          merchant_id: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_status?: number | null
          last_triggered_at?: string | null
          merchant_id: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_status?: number | null
          last_triggered_at?: string | null
          merchant_id?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          address: string | null
          business_name: string
          category: string | null
          created_at: string
          email: string
          gst_number: string | null
          id: string
          logo_url: string | null
          phone: string | null
          slug: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_name: string
          category?: string | null
          created_at?: string
          email: string
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: string | null
          created_at?: string
          email?: string
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          order_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          order_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          order_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_tracking: {
        Row: {
          courier_partner: string
          created_at: string
          estimated_delivery: string | null
          id: string
          merchant_id: string
          notes: string | null
          order_id: string
          shipment_date: string | null
          status: string
          tracking_number: string
          updated_at: string
        }
        Insert: {
          courier_partner: string
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          order_id: string
          shipment_date?: string | null
          status?: string
          tracking_number: string
          updated_at?: string
        }
        Update: {
          courier_partner?: string
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          order_id?: string
          shipment_date?: string | null
          status?: string
          tracking_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          carrier: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_id: string
          delivered_at: string | null
          draft_cancelled_at: string | null
          draft_cancelled_by: string | null
          draft_cancelled_reason: string | null
          draft_change_request_reason: string | null
          draft_change_requested_at: string | null
          draft_change_requested_by: string | null
          draft_deleted_at: string | null
          draft_deleted_by: string | null
          draft_expires_at: string | null
          draft_metadata: Json | null
          draft_rejected_at: string | null
          draft_rejected_by: string | null
          draft_rejection_reason: string | null
          draft_status: string | null
          draft_submitted_at: string | null
          draft_version: number | null
          escrow_finalized_at: string | null
          escrow_finalized_by: string | null
          escrow_resolution_type: string | null
          escrow_status: string
          expected_delivery: string | null
          expected_delivery_date: string | null
          id: string
          merchant_avatar: string | null
          merchant_id: string
          merchant_name: string
          merchant_net_amount: number | null
          notes: string | null
          order_number: string | null
          phone_snapshot: string | null
          platform_fee: number | null
          platform_fee_gst: number | null
          product_description: string | null
          product_name: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          carrier?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          delivered_at?: string | null
          draft_cancelled_at?: string | null
          draft_cancelled_by?: string | null
          draft_cancelled_reason?: string | null
          draft_change_request_reason?: string | null
          draft_change_requested_at?: string | null
          draft_change_requested_by?: string | null
          draft_deleted_at?: string | null
          draft_deleted_by?: string | null
          draft_expires_at?: string | null
          draft_metadata?: Json | null
          draft_rejected_at?: string | null
          draft_rejected_by?: string | null
          draft_rejection_reason?: string | null
          draft_status?: string | null
          draft_submitted_at?: string | null
          draft_version?: number | null
          escrow_finalized_at?: string | null
          escrow_finalized_by?: string | null
          escrow_resolution_type?: string | null
          escrow_status?: string
          expected_delivery?: string | null
          expected_delivery_date?: string | null
          id?: string
          merchant_avatar?: string | null
          merchant_id: string
          merchant_name: string
          merchant_net_amount?: number | null
          notes?: string | null
          order_number?: string | null
          phone_snapshot?: string | null
          platform_fee?: number | null
          platform_fee_gst?: number | null
          product_description?: string | null
          product_name: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          carrier?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          delivered_at?: string | null
          draft_cancelled_at?: string | null
          draft_cancelled_by?: string | null
          draft_cancelled_reason?: string | null
          draft_change_request_reason?: string | null
          draft_change_requested_at?: string | null
          draft_change_requested_by?: string | null
          draft_deleted_at?: string | null
          draft_deleted_by?: string | null
          draft_expires_at?: string | null
          draft_metadata?: Json | null
          draft_rejected_at?: string | null
          draft_rejected_by?: string | null
          draft_rejection_reason?: string | null
          draft_status?: string | null
          draft_submitted_at?: string | null
          draft_version?: number | null
          escrow_finalized_at?: string | null
          escrow_finalized_by?: string | null
          escrow_resolution_type?: string | null
          escrow_status?: string
          expected_delivery?: string | null
          expected_delivery_date?: string | null
          id?: string
          merchant_avatar?: string | null
          merchant_id?: string
          merchant_name?: string
          merchant_net_amount?: number | null
          notes?: string | null
          order_number?: string | null
          phone_snapshot?: string | null
          platform_fee?: number | null
          platform_fee_gst?: number | null
          product_description?: string | null
          product_name?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      otp_settings: {
        Row: {
          block_ip_after_abuse: boolean
          block_phone_after_failures: boolean
          cooldown_between_sends_seconds: number
          id: string
          lockout_duration_minutes: number
          max_otp_requests_per_phone_hourly: number
          max_retries_per_otp: number
          otp_enabled: boolean
          otp_expiry_seconds: number
          otp_length: number
          require_otp_before_payment: boolean
          sms_enabled: boolean
          updated_at: string
          updated_by: string | null
          voice_enabled: boolean
          whatsapp_enabled: boolean
        }
        Insert: {
          block_ip_after_abuse?: boolean
          block_phone_after_failures?: boolean
          cooldown_between_sends_seconds?: number
          id?: string
          lockout_duration_minutes?: number
          max_otp_requests_per_phone_hourly?: number
          max_retries_per_otp?: number
          otp_enabled?: boolean
          otp_expiry_seconds?: number
          otp_length?: number
          require_otp_before_payment?: boolean
          sms_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          voice_enabled?: boolean
          whatsapp_enabled?: boolean
        }
        Update: {
          block_ip_after_abuse?: boolean
          block_phone_after_failures?: boolean
          cooldown_between_sends_seconds?: number
          id?: string
          lockout_duration_minutes?: number
          max_otp_requests_per_phone_hourly?: number
          max_retries_per_otp?: number
          otp_enabled?: boolean
          otp_expiry_seconds?: number
          otp_length?: number
          require_otp_before_payment?: boolean
          sms_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          voice_enabled?: boolean
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          config: Json | null
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          disabled_merchants: string[] | null
          disabled_reason: string | null
          display_name: string
          enabled_merchants: string[] | null
          environment: string
          id: string
          is_default: boolean
          last_status_change_at: string | null
          last_status_change_by: string | null
          max_amount: number | null
          min_amount: number | null
          name: string
          priority: number
          status: string
          supported_methods: string[]
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_merchants?: string[] | null
          disabled_reason?: string | null
          display_name: string
          enabled_merchants?: string[] | null
          environment?: string
          id?: string
          is_default?: boolean
          last_status_change_at?: string | null
          last_status_change_by?: string | null
          max_amount?: number | null
          min_amount?: number | null
          name: string
          priority?: number
          status?: string
          supported_methods?: string[]
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          disabled_merchants?: string[] | null
          disabled_reason?: string | null
          display_name?: string
          enabled_merchants?: string[] | null
          environment?: string
          id?: string
          is_default?: boolean
          last_status_change_at?: string | null
          last_status_change_by?: string | null
          max_amount?: number | null
          min_amount?: number | null
          name?: string
          priority?: number
          status?: string
          supported_methods?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      payment_link_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          merchant_id: string
          new_state: Json | null
          payment_link_id: string
          previous_state: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          merchant_id: string
          new_state?: Json | null
          payment_link_id: string
          previous_state?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          merchant_id?: string
          new_state?: Json | null
          payment_link_id?: string
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_audit_log_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_link_user_associations: {
        Row: {
          association_type: string
          checkout_session_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          order_id: string | null
          payment_id: string | null
          payment_link_id: string | null
          phone_number: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          association_type: string
          checkout_session_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          order_id?: string | null
          payment_id?: string | null
          payment_link_id?: string | null
          phone_number: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          association_type?: string
          checkout_session_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          order_id?: string | null
          payment_id?: string | null
          payment_link_id?: string | null
          phone_number?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_user_associations_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_user_associations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_user_associations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_user_associations_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          cancel_redirect_url: string | null
          created_at: string
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          link_code: string
          merchant_id: string
          metadata: Json | null
          status: string
          success_redirect_url: string | null
          title: string
          total_collected: number
          total_payments: number
          updated_at: string
        }
        Insert: {
          amount: number
          cancel_redirect_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          link_code: string
          merchant_id: string
          metadata?: Json | null
          status?: string
          success_redirect_url?: string | null
          title: string
          total_collected?: number
          total_payments?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_redirect_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          link_code?: string
          merchant_id?: string
          metadata?: Json | null
          status?: string
          success_redirect_url?: string | null
          title?: string
          total_collected?: number
          total_payments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string
          customer_name: string | null
          customer_phone: string
          failure_reason: string | null
          id: string
          order_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id: string
          customer_name?: string | null
          customer_phone: string
          failure_reason?: string | null
          id?: string
          order_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string
          customer_name?: string | null
          customer_phone?: string
          failure_reason?: string | null
          id?: string
          order_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string
          razorpay_event_id: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          payment_id?: string | null
          processed_at?: string
          razorpay_event_id: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string
          razorpay_event_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          gateway_failure_reason: string | null
          gateway_status: string | null
          id: string
          is_final: boolean | null
          merchant_id: string
          order_id: string
          payment_gateway: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          transaction_reference: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          gateway_failure_reason?: string | null
          gateway_status?: string | null
          id?: string
          is_final?: boolean | null
          merchant_id: string
          order_id: string
          payment_gateway?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          gateway_failure_reason?: string | null
          gateway_status?: string | null
          id?: string
          is_final?: boolean | null
          merchant_id?: string
          order_id?: string
          payment_gateway?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pincode_serviceability: {
        Row: {
          city: string | null
          cod_available: boolean
          created_at: string
          delivery_days_max: number
          delivery_days_min: number
          id: string
          is_serviceable: boolean
          pincode: string
          prepaid_available: boolean
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cod_available?: boolean
          created_at?: string
          delivery_days_max?: number
          delivery_days_min?: number
          id?: string
          is_serviceable?: boolean
          pincode: string
          prepaid_available?: boolean
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cod_available?: boolean
          created_at?: string
          delivery_days_max?: number
          delivery_days_min?: number
          id?: string
          is_serviceable?: boolean
          pincode?: string
          prepaid_available?: boolean
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_checkout_settings: {
        Row: {
          description: string | null
          id: string
          is_locked: boolean
          setting_key: string
          setting_type: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_locked?: boolean
          setting_key: string
          setting_type?: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_locked?: boolean
          setting_key?: string
          setting_type?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_flags: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      platform_incidents: {
        Row: {
          activated_at: string
          activated_by: string
          created_at: string
          id: string
          impact_summary: Json | null
          level: number
          metadata: Json | null
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          activated_at?: string
          activated_by: string
          created_at?: string
          id?: string
          impact_summary?: Json | null
          level: number
          metadata?: Json | null
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          activated_at?: string
          activated_by?: string
          created_at?: string
          id?: string
          impact_summary?: Json | null
          level?: number
          metadata?: Json | null
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_claimed: boolean | null
          account_source: string | null
          account_status: string
          auth_method: string | null
          auth_provider: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          last_login_at: string | null
          password_hash: string | null
          phone: string | null
          phone_verified: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_claimed?: boolean | null
          account_source?: string | null
          account_status?: string
          auth_method?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          password_hash?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_claimed?: boolean | null
          account_source?: string | null
          account_status?: string
          auth_method?: string | null
          auth_provider?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          password_hash?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      refund_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          refund_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          refund_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          refund_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_events_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          admin_id: string | null
          admin_notes: string | null
          amount: number
          created_at: string
          credited_at: string | null
          customer_id: string
          dispute_id: string | null
          failure_reason: string | null
          id: string
          initiated_by: string | null
          order_id: string
          payment_id: string | null
          payment_method: string | null
          payment_method_last4: string | null
          razorpay_refund_id: string | null
          reason: string
          receipt_url: string | null
          refund_type: string | null
          retry_allowed: boolean | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          admin_notes?: string | null
          amount: number
          created_at?: string
          credited_at?: string | null
          customer_id: string
          dispute_id?: string | null
          failure_reason?: string | null
          id?: string
          initiated_by?: string | null
          order_id: string
          payment_id?: string | null
          payment_method?: string | null
          payment_method_last4?: string | null
          razorpay_refund_id?: string | null
          reason: string
          receipt_url?: string | null
          refund_type?: string | null
          retry_allowed?: boolean | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          admin_notes?: string | null
          amount?: number
          created_at?: string
          credited_at?: string | null
          customer_id?: string
          dispute_id?: string | null
          failure_reason?: string | null
          id?: string
          initiated_by?: string | null
          order_id?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_method_last4?: string | null
          razorpay_refund_id?: string | null
          reason?: string
          receipt_url?: string | null
          refund_type?: string | null
          retry_allowed?: boolean | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          id: string
          ip_address: string | null
          new_state: Json | null
          previous_state: Json | null
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      risk_evaluations: {
        Row: {
          decision: string
          decision_reason: string | null
          evaluated_at: string
          id: string
          metadata: Json | null
          risk_score: number
          rules_triggered: Json
          session_id: string
          signals: Json
        }
        Insert: {
          decision?: string
          decision_reason?: string | null
          evaluated_at?: string
          id?: string
          metadata?: Json | null
          risk_score?: number
          rules_triggered?: Json
          session_id: string
          signals?: Json
        }
        Update: {
          decision?: string
          decision_reason?: string | null
          evaluated_at?: string
          id?: string
          metadata?: Json | null
          risk_score?: number
          rules_triggered?: Json
          session_id?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "risk_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_rule_versions: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string
          id: string
          new_state: Json
          previous_state: Json
          rule_id: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by: string
          id?: string
          new_state: Json
          previous_state: Json
          rule_id: string
          version: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string
          id?: string
          new_state?: Json
          previous_state?: Json
          rule_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "risk_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_rules: {
        Row: {
          action: string
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          priority: number
          rule_type: string
          scope: string
          scope_id: string | null
          severity: string
          threshold_value: number | null
          time_window_minutes: number | null
          trigger_count: number
          updated_at: string
          version: number
        }
        Insert: {
          action?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          priority?: number
          rule_type: string
          scope?: string
          scope_id?: string | null
          severity?: string
          threshold_value?: number | null
          time_window_minutes?: number | null
          trigger_count?: number
          updated_at?: string
          version?: number
        }
        Update: {
          action?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          priority?: number
          rule_type?: string
          scope?: string
          scope_id?: string | null
          severity?: string
          threshold_value?: number | null
          time_window_minutes?: number | null
          trigger_count?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      shipment_actions_log: {
        Row: {
          action_type: string
          admin_id: string
          admin_notes: string | null
          created_at: string
          description: string | null
          id: string
          new_value: Json | null
          previous_value: Json | null
          shipment_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          shipment_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_actions_log_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_issues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          issue_status: string
          issue_type: string
          order_impact: string | null
          resolved_at: string | null
          resolved_by: string | null
          shipment_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          issue_status?: string
          issue_type: string
          order_impact?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shipment_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          issue_status?: string
          issue_type?: string
          order_impact?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shipment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_issues_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      support_actions_log: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          description: string | null
          id: string
          new_value: Json | null
          previous_value: Json | null
          ticket_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          ticket_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_actions_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: string[] | null
          created_at: string
          id: string
          is_staff: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          id?: string
          is_staff?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          id?: string
          is_staff?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_status_history: {
        Row: {
          changed_by: string
          changed_by_type: string
          created_at: string
          id: string
          new_priority: string | null
          new_status: string
          previous_priority: string | null
          previous_status: string | null
          reason: string | null
          ticket_id: string
        }
        Insert: {
          changed_by: string
          changed_by_type?: string
          created_at?: string
          id?: string
          new_priority?: string | null
          new_status: string
          previous_priority?: string | null
          previous_status?: string | null
          reason?: string | null
          ticket_id: string
        }
        Update: {
          changed_by?: string
          changed_by_type?: string
          created_at?: string
          id?: string
          new_priority?: string | null
          new_status?: string
          previous_priority?: string | null
          previous_status?: string | null
          reason?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          related_order_id: string | null
          related_shipment_id: string | null
          resolved_at: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          related_order_id?: string | null
          related_shipment_id?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          related_order_id?: string | null
          related_shipment_id?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking: {
        Row: {
          actual_delivery_date: string | null
          carrier: string | null
          created_at: string
          estimated_delivery: string | null
          expected_delivery_date: string | null
          id: string
          is_delayed: boolean
          location: string | null
          logistics_provider: string | null
          order_id: string
          shipment_number: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          carrier?: string | null
          created_at?: string
          estimated_delivery?: string | null
          expected_delivery_date?: string | null
          id?: string
          is_delayed?: boolean
          location?: string | null
          logistics_provider?: string | null
          order_id: string
          shipment_number?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          carrier?: string | null
          created_at?: string
          estimated_delivery?: string | null
          expected_delivery_date?: string | null
          id?: string
          is_delayed?: boolean
          location?: string | null
          logistics_provider?: string | null
          order_id?: string
          shipment_number?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          occurred_at: string
          status: string
          tracking_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          status: string
          tracking_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          status?: string
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          duration_days: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          reason: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          reason: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          reason?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_prefs: {
        Row: {
          created_at: string
          dispute_email: boolean
          dispute_in_app: boolean
          dispute_sms: boolean
          id: string
          order_email: boolean
          order_in_app: boolean
          order_sms: boolean
          payment_email: boolean
          payment_in_app: boolean
          payment_sms: boolean
          refund_email: boolean
          refund_in_app: boolean
          refund_sms: boolean
          system_email: boolean
          system_in_app: boolean
          system_sms: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dispute_email?: boolean
          dispute_in_app?: boolean
          dispute_sms?: boolean
          id?: string
          order_email?: boolean
          order_in_app?: boolean
          order_sms?: boolean
          payment_email?: boolean
          payment_in_app?: boolean
          payment_sms?: boolean
          refund_email?: boolean
          refund_in_app?: boolean
          refund_sms?: boolean
          system_email?: boolean
          system_in_app?: boolean
          system_sms?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dispute_email?: boolean
          dispute_in_app?: boolean
          dispute_sms?: boolean
          id?: string
          order_email?: boolean
          order_in_app?: boolean
          order_sms?: boolean
          payment_email?: boolean
          payment_in_app?: boolean
          payment_sms?: boolean
          refund_email?: boolean
          refund_in_app?: boolean
          refund_sms?: boolean
          system_email?: boolean
          system_in_app?: boolean
          system_sms?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_privacy_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security: {
        Row: {
          created_at: string
          id: string
          last_password_change: string | null
          two_factor_enabled: boolean
          two_factor_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_password_change?: string | null
          two_factor_enabled?: boolean
          two_factor_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_password_change?: string | null
          two_factor_enabled?: boolean
          two_factor_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_verification_history: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          notes: string | null
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          customer_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          error_message: string | null
          event_type: string
          id: string
          merchant_id: string
          payload: Json
          response_body: string | null
          response_code: number | null
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          error_message?: string | null
          event_type: string
          id?: string
          merchant_id: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          error_message?: string | null
          event_type?: string
          id?: string
          merchant_id?: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "merchant_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_abuse_signals: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          signal_type: string
          user_agent: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          signal_type: string
          user_agent?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          signal_type?: string
          user_agent?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      withdrawal_actions_log: {
        Row: {
          account_last4: string | null
          action_type: string
          amount: number
          balance_after: number
          balance_before: number
          bank_account_id: string | null
          bank_name: string | null
          created_at: string
          fee: number | null
          gst: number | null
          id: string
          idempotency_key: string | null
          ip_address: string | null
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          session_id: string | null
          total_debit: number
          user_agent: string | null
          user_id: string
          user_type: string
          withdrawal_id: string
          withdrawal_type: string
        }
        Insert: {
          account_last4?: string | null
          action_type: string
          amount: number
          balance_after: number
          balance_before: number
          bank_account_id?: string | null
          bank_name?: string | null
          created_at?: string
          fee?: number | null
          gst?: number | null
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          session_id?: string | null
          total_debit: number
          user_agent?: string | null
          user_id: string
          user_type: string
          withdrawal_id: string
          withdrawal_type: string
        }
        Update: {
          account_last4?: string | null
          action_type?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          bank_account_id?: string | null
          bank_name?: string | null
          created_at?: string
          fee?: number | null
          gst?: number | null
          id?: string
          idempotency_key?: string | null
          ip_address?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          session_id?: string | null
          total_debit?: number
          user_agent?: string | null
          user_id?: string
          user_type?: string
          withdrawal_id?: string
          withdrawal_type?: string
        }
        Relationships: []
      }
      withdrawal_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          gateway_response: Json | null
          id: string
          message: string | null
          payout_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gateway_response?: Json | null
          id?: string
          message?: string | null
          payout_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gateway_response?: Json | null
          id?: string
          message?: string | null
          payout_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "merchant_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          customer_id: string
          failure_reason: string | null
          id: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          customer_id: string
          failure_reason?: string | null
          id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          customer_id?: string
          failure_reason?: string | null
          id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      merchant_wallet_balances: {
        Row: {
          available_balance: number | null
          currency: string | null
          current_balance: number | null
          frozen_amount: number | null
          merchant_id: string | null
          pending_releases: number | null
          total_credits: number | null
          total_debits: number | null
          total_withdrawn: number | null
          wallet_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_merchant_withdraw: {
        Args: { p_amount: number; p_merchant_id: string }
        Returns: {
          allowed: boolean
          available_balance: number
          has_disputes: boolean
          is_frozen: boolean
          kyc_status: string
          reason: string
        }[]
      }
      can_restore_draft: { Args: { p_order_id: string }; Returns: boolean }
      check_all_wallet_consistency: {
        Args: never
        Returns: {
          discrepancy: number
          ledger_balance: number
          needs_attention: boolean
          stored_balance: number
          user_id: string
          user_type: string
        }[]
      }
      check_kyc_document_uniqueness: {
        Args: {
          p_document_hash: string
          p_document_type: string
          p_user_id: string
        }
        Returns: {
          is_unique: boolean
          original_kyc_id: string
          original_user_id: string
        }[]
      }
      check_kyc_reupload_limit: {
        Args: { p_kyc_type: string; p_user_id: string }
        Returns: boolean
      }
      check_wallet_ledger_consistency: {
        Args: { p_customer_id: string }
        Returns: {
          discrepancy: number
          is_consistent: boolean
          ledger_balance: number
          wallet_balance: number
        }[]
      }
      check_withdrawal_rate_limit: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: boolean
      }
      complete_withdrawal: { Args: { p_payout_id: string }; Returns: boolean }
      compute_merchant_balance_from_ledger: {
        Args: { p_merchant_id: string }
        Returns: {
          available_balance: number
          current_balance: number
          frozen_amount: number
          pending_releases: number
          total_credits: number
          total_debits: number
          total_withdrawn: number
        }[]
      }
      compute_merchant_wallet_balances: {
        Args: { p_merchant_id: string }
        Returns: {
          available_balance: number
          pending_balance: number
          total_paid_out: number
        }[]
      }
      compute_wallet_balance: {
        Args: { p_customer_id: string }
        Returns: number
      }
      create_merchant_withdrawal: {
        Args: {
          p_amount: number
          p_bank_account_id: string
          p_idempotency_key?: string
          p_merchant_id: string
          p_notes?: string
        }
        Returns: {
          amount: number
          error: string
          gst_on_fee: number
          net_amount: number
          payout_id: string
          success: boolean
          withdrawal_fee: number
        }[]
      }
      expire_old_drafts: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_payment_link_stats: {
        Args: { link_id: string; payment_amount: number }
        Returns: undefined
      }
      log_draft_action: {
        Args: {
          p_action_type: string
          p_new_state?: Json
          p_order_id: string
          p_performed_by: string
          p_performed_by_role: string
          p_previous_state?: Json
          p_reason?: string
        }
        Returns: string
      }
      log_financial_failure: {
        Args: {
          p_action_type: string
          p_admin_id?: string
          p_amount?: number
          p_error_message: string
          p_metadata?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      reverse_failed_withdrawal: {
        Args: { p_failure_reason?: string; p_payout_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "merchant" | "customer"
      checkout_payment_method:
        | "upi"
        | "card"
        | "wallet"
        | "emi"
        | "cod"
        | "netbanking"
      checkout_session_status:
        | "active"
        | "expired"
        | "completed"
        | "failed"
        | "abandoned"
      checkout_step: "login" | "address" | "payment" | "confirmation"
      dispute_status: "open" | "under_review" | "resolved" | "closed"
      order_status:
        | "pending"
        | "in_progress"
        | "delivered"
        | "completed"
        | "disputed"
        | "refunded"
        | "cancelled"
        | "draft"
        | "escrow_locked"
        | "shipped"
        | "awaiting_shipment"
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
      app_role: ["admin", "merchant", "customer"],
      checkout_payment_method: [
        "upi",
        "card",
        "wallet",
        "emi",
        "cod",
        "netbanking",
      ],
      checkout_session_status: [
        "active",
        "expired",
        "completed",
        "failed",
        "abandoned",
      ],
      checkout_step: ["login", "address", "payment", "confirmation"],
      dispute_status: ["open", "under_review", "resolved", "closed"],
      order_status: [
        "pending",
        "in_progress",
        "delivered",
        "completed",
        "disputed",
        "refunded",
        "cancelled",
        "draft",
        "escrow_locked",
        "shipped",
        "awaiting_shipment",
      ],
    },
  },
} as const
