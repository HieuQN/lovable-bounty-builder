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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_profiles: {
        Row: {
          brokerage_name: string | null
          created_at: string
          credit_balance: number | null
          id: string
          license_number: string | null
          profile_bio: string | null
          profile_photo_url: string | null
          service_areas: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brokerage_name?: string | null
          created_at?: string
          credit_balance?: number | null
          id?: string
          license_number?: string | null
          profile_bio?: string | null
          profile_photo_url?: string | null
          service_areas?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brokerage_name?: string | null
          created_at?: string
          credit_balance?: number | null
          id?: string
          license_number?: string | null
          profile_bio?: string | null
          profile_photo_url?: string | null
          service_areas?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_logs: {
        Row: {
          context: Json | null
          created_at: string
          function_name: string
          id: string
          job_id: string | null
          level: string
          message: string
          report_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          function_name: string
          id?: string
          job_id?: string | null
          level: string
          message: string
          report_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          function_name?: string
          id?: string
          job_id?: string | null
          level?: string
          message?: string
          report_id?: string | null
        }
        Relationships: []
      }
      bids: {
        Row: {
          bid_amount: number
          bidding_agent_id: string
          created_at: string
          id: string
          showing_request_id: string
        }
        Insert: {
          bid_amount: number
          bidding_agent_id: string
          created_at?: string
          id?: string
          showing_request_id: string
        }
        Update: {
          bid_amount?: number
          bidding_agent_id?: string
          created_at?: string
          id?: string
          showing_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_bidding_agent_id_fkey"
            columns: ["bidding_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_showing_request_id_fkey"
            columns: ["showing_request_id"]
            isOneToOne: false
            referencedRelation: "showing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          agent_profile_id: string | null
          amount: number
          created_at: string
          description: string | null
          id: string
          related_disclosure_id: string | null
          related_showing_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          agent_profile_id?: string | null
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          related_disclosure_id?: string | null
          related_showing_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          agent_profile_id?: string | null
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          related_disclosure_id?: string | null
          related_showing_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      disclosure_bounties: {
        Row: {
          claim_expiration: string | null
          claimed_by_agent_id: string | null
          created_at: string
          id: string
          property_id: string
          requested_by_user_id: string | null
          status: Database["public"]["Enums"]["bounty_status"] | null
          updated_at: string
        }
        Insert: {
          claim_expiration?: string | null
          claimed_by_agent_id?: string | null
          created_at?: string
          id?: string
          property_id: string
          requested_by_user_id?: string | null
          status?: Database["public"]["Enums"]["bounty_status"] | null
          updated_at?: string
        }
        Update: {
          claim_expiration?: string | null
          claimed_by_agent_id?: string | null
          created_at?: string
          id?: string
          property_id?: string
          requested_by_user_id?: string | null
          status?: Database["public"]["Enums"]["bounty_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disclosure_bounties_claimed_by_agent_id_fkey"
            columns: ["claimed_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disclosure_bounties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      disclosure_reports: {
        Row: {
          created_at: string
          dummy_analysis_complete: boolean | null
          id: string
          property_id: string
          raw_pdf_url: string | null
          report_summary_basic: string | null
          report_summary_full: Json | null
          requested_by_user_id: string | null
          risk_score: number | null
          status: Database["public"]["Enums"]["report_status"] | null
          updated_at: string
          uploaded_by_agent_id: string | null
        }
        Insert: {
          created_at?: string
          dummy_analysis_complete?: boolean | null
          id?: string
          property_id: string
          raw_pdf_url?: string | null
          report_summary_basic?: string | null
          report_summary_full?: Json | null
          requested_by_user_id?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["report_status"] | null
          updated_at?: string
          uploaded_by_agent_id?: string | null
        }
        Update: {
          created_at?: string
          dummy_analysis_complete?: boolean | null
          id?: string
          property_id?: string
          raw_pdf_url?: string | null
          report_summary_basic?: string | null
          report_summary_full?: Json | null
          requested_by_user_id?: string | null
          risk_score?: number | null
          status?: Database["public"]["Enums"]["report_status"] | null
          updated_at?: string
          uploaded_by_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disclosure_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disclosure_reports_uploaded_by_agent_id_fkey"
            columns: ["uploaded_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disclosure_upload_jobs: {
        Row: {
          agent_id: string
          bounty_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string
          file_path: string
          id: string
          status: string
        }
        Insert: {
          agent_id: string
          bounty_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_path: string
          id?: string
          status?: string
        }
        Update: {
          agent_id?: string
          bounty_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_path?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disclosure_upload_jobs_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "disclosure_bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          type: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          type: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number | null
          email: string
          first_name: string | null
          id: string
          is_verified: boolean | null
          phone_number: string | null
          stripe_customer_id: string | null
          subscription_active: boolean | null
          subscription_end_date: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"] | null
        }
        Insert: {
          created_at?: string
          credits?: number | null
          email: string
          first_name?: string | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string | null
          stripe_customer_id?: string | null
          subscription_active?: boolean | null
          subscription_end_date?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Update: {
          created_at?: string
          credits?: number | null
          email?: string
          first_name?: string | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string | null
          stripe_customer_id?: string | null
          subscription_active?: boolean | null
          subscription_end_date?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"] | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          city: string
          created_at: string
          full_address: string
          id: string
          state: string
          street_address: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          city: string
          created_at?: string
          full_address: string
          id?: string
          state: string
          street_address: string
          updated_at?: string
          zip_code: string
        }
        Update: {
          city?: string
          created_at?: string
          full_address?: string
          id?: string
          state?: string
          street_address?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          disclosure_report_id: string
          id: string
          payment_status: string
          stripe_payment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          disclosure_report_id: string
          id?: string
          payment_status?: string
          stripe_payment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          disclosure_report_id?: string
          id?: string
          payment_status?: string
          stripe_payment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchases_disclosure_report"
            columns: ["disclosure_report_id"]
            isOneToOne: false
            referencedRelation: "disclosure_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      showing_bids: {
        Row: {
          bid_amount: number
          bidding_agent_id: string
          created_at: string | null
          id: string
          selected_time_slot: string | null
          showing_request_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bid_amount: number
          bidding_agent_id: string
          created_at?: string | null
          id?: string
          selected_time_slot?: string | null
          showing_request_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bid_amount?: number
          bidding_agent_id?: string
          created_at?: string | null
          id?: string
          selected_time_slot?: string | null
          showing_request_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showing_bids_showing_request_id_fkey"
            columns: ["showing_request_id"]
            isOneToOne: false
            referencedRelation: "showing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      showing_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message_text: string
          sender_id: string
          sender_type: string
          showing_request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message_text: string
          sender_id: string
          sender_type: string
          showing_request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message_text?: string
          sender_id?: string
          sender_type?: string
          showing_request_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      showing_requests: {
        Row: {
          agent_confirmed_at: string | null
          buyer_confirmed_at: string | null
          confirmation_status:
            | Database["public"]["Enums"]["confirmation_status"]
            | null
          created_at: string
          credits_spent: number | null
          current_high_bid: number | null
          id: string
          preferred_dates: Json | null
          preferred_times: string | null
          property_id: string
          refund_deadline: string | null
          requested_by_user_id: string
          selected_time_slot: string | null
          status: Database["public"]["Enums"]["showing_status"] | null
          updated_at: string
          winning_agent_id: string | null
          winning_bid_amount: number | null
        }
        Insert: {
          agent_confirmed_at?: string | null
          buyer_confirmed_at?: string | null
          confirmation_status?:
            | Database["public"]["Enums"]["confirmation_status"]
            | null
          created_at?: string
          credits_spent?: number | null
          current_high_bid?: number | null
          id?: string
          preferred_dates?: Json | null
          preferred_times?: string | null
          property_id: string
          refund_deadline?: string | null
          requested_by_user_id: string
          selected_time_slot?: string | null
          status?: Database["public"]["Enums"]["showing_status"] | null
          updated_at?: string
          winning_agent_id?: string | null
          winning_bid_amount?: number | null
        }
        Update: {
          agent_confirmed_at?: string | null
          buyer_confirmed_at?: string | null
          confirmation_status?:
            | Database["public"]["Enums"]["confirmation_status"]
            | null
          created_at?: string
          credits_spent?: number | null
          current_high_bid?: number | null
          id?: string
          preferred_dates?: Json | null
          preferred_times?: string | null
          property_id?: string
          refund_deadline?: string | null
          requested_by_user_id?: string
          selected_time_slot?: string | null
          status?: Database["public"]["Enums"]["showing_status"] | null
          updated_at?: string
          winning_agent_id?: string | null
          winning_bid_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "showing_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showing_requests_winning_agent_id_fkey"
            columns: ["winning_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_showing_requests: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_message: string
          p_type: string
          p_url?: string
          p_user_id: string
        }
        Returns: string
      }
      create_profile_if_not_exists: {
        Args: {
          email: string
          user_id: string
          user_type_val?: Database["public"]["Enums"]["user_type"]
        }
        Returns: undefined
      }
      get_available_bounties_with_reset: {
        Args: Record<PropertyKey, never>
        Returns: {
          claim_expiration: string
          claimed_by_agent_id: string
          created_at: string
          id: string
          property_id: string
          requested_by_user_id: string
          status: Database["public"]["Enums"]["bounty_status"]
          updated_at: string
        }[]
      }
      log_credit_transaction: {
        Args: {
          p_agent_profile_id: string
          p_amount: number
          p_description?: string
          p_disclosure_id?: string
          p_showing_id?: string
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_user_id: string
        }
        Returns: string
      }
      reset_expired_bounty_claims: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_upload_job_status: {
        Args: { error_msg?: string; job_id: string; new_status: string }
        Returns: undefined
      }
    }
    Enums: {
      bounty_status: "open" | "claimed" | "completed" | "expired"
      confirmation_status:
        | "pending"
        | "agent_confirmed"
        | "buyer_confirmed"
        | "both_confirmed"
        | "cancelled"
      report_status: "pending" | "processing" | "complete" | "failed"
      showing_status: "bidding" | "awarded" | "confirmed" | "completed"
      transaction_type:
        | "disclosure_upload"
        | "showing_win"
        | "showing_deduction"
        | "manual_adjustment"
        | "showing_bid_placed"
        | "showing_bid_win"
        | "showing_bid_refund"
      user_type: "Buyer" | "Agent"
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
      bounty_status: ["open", "claimed", "completed", "expired"],
      confirmation_status: [
        "pending",
        "agent_confirmed",
        "buyer_confirmed",
        "both_confirmed",
        "cancelled",
      ],
      report_status: ["pending", "processing", "complete", "failed"],
      showing_status: ["bidding", "awarded", "confirmed", "completed"],
      transaction_type: [
        "disclosure_upload",
        "showing_win",
        "showing_deduction",
        "manual_adjustment",
        "showing_bid_placed",
        "showing_bid_win",
        "showing_bid_refund",
      ],
      user_type: ["Buyer", "Agent"],
    },
  },
} as const
