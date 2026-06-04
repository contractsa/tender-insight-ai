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
      company_profiles: {
        Row: {
          bbbee_certificate_type: string | null
          bbbee_level: string | null
          business_structure: string | null
          capabilities: Json
          cidb_designation: string | null
          cidb_grade: string | null
          created_at: string
          directors: Json
          id: string
          legal_name: string | null
          professional_registrations: Json
          registration_number: string | null
          tax_compliance_status: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          bbbee_certificate_type?: string | null
          bbbee_level?: string | null
          business_structure?: string | null
          capabilities?: Json
          cidb_designation?: string | null
          cidb_grade?: string | null
          created_at?: string
          directors?: Json
          id?: string
          legal_name?: string | null
          professional_registrations?: Json
          registration_number?: string | null
          tax_compliance_status?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          bbbee_certificate_type?: string | null
          bbbee_level?: string | null
          business_structure?: string | null
          capabilities?: Json
          cidb_designation?: string | null
          cidb_grade?: string | null
          created_at?: string
          directors?: Json
          id?: string
          legal_name?: string | null
          professional_registrations?: Json
          registration_number?: string | null
          tax_compliance_status?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          compliance_checklist: Json | null
          contract_result: Json | null
          created_at: string
          credits_used: number | null
          error_message: string | null
          evaluation_result: Json | null
          extraction_failed_passes: string[] | null
          extraction_passes_completed: number | null
          extraction_version: string | null
          file_name: string
          file_path: string
          file_size: number
          file_size_bytes: number | null
          id: string
          master_result: Json | null
          mime_type: string | null
          missing_data: Json | null
          page_level_intelligence: Json | null
          pricing_result: Json | null
          returnables_result: Json | null
          risk_flags: Json | null
          status: string
          submission_result: Json | null
          triage_result: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compliance_checklist?: Json | null
          contract_result?: Json | null
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          evaluation_result?: Json | null
          extraction_failed_passes?: string[] | null
          extraction_passes_completed?: number | null
          extraction_version?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_size_bytes?: number | null
          id?: string
          master_result?: Json | null
          mime_type?: string | null
          missing_data?: Json | null
          page_level_intelligence?: Json | null
          pricing_result?: Json | null
          returnables_result?: Json | null
          risk_flags?: Json | null
          status?: string
          submission_result?: Json | null
          triage_result?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compliance_checklist?: Json | null
          contract_result?: Json | null
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          evaluation_result?: Json | null
          extraction_failed_passes?: string[] | null
          extraction_passes_completed?: number | null
          extraction_version?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_size_bytes?: number | null
          id?: string
          master_result?: Json | null
          mime_type?: string | null
          missing_data?: Json | null
          page_level_intelligence?: Json | null
          pricing_result?: Json | null
          returnables_result?: Json | null
          risk_flags?: Json | null
          status?: string
          submission_result?: Json | null
          triage_result?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      eligibility_checks: {
        Row: {
          created_at: string
          document_id: string
          id: string
          overall_status: string | null
          result: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          overall_status?: string | null
          result?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          overall_status?: string | null
          result?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monitored_tenders: {
        Row: {
          alert_sent: boolean
          changes_detected: Json
          closing_date: string | null
          closing_time: string | null
          created_at: string
          document_id: string | null
          id: string
          last_checked: string | null
          source_url: string | null
          status: string
          tender_reference: string | null
          tender_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_sent?: boolean
          changes_detected?: Json
          closing_date?: string | null
          closing_time?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          last_checked?: string | null
          source_url?: string | null
          status?: string
          tender_reference?: string | null
          tender_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_sent?: boolean
          changes_detected?: Json
          closing_date?: string | null
          closing_time?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          last_checked?: string | null
          source_url?: string | null
          status?: string
          tender_reference?: string | null
          tender_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          credits_remaining: number
          credits_total: number
          full_name: string | null
          id: string
          plan: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          credits_remaining?: number
          credits_total?: number
          full_name?: string | null
          id?: string
          plan?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          credits_remaining?: number
          credits_total?: number
          full_name?: string | null
          id?: string
          plan?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      submission_packs: {
        Row: {
          checklist_items: Json
          created_at: string
          document_id: string
          generated_at: string
          id: string
          overall_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_items?: Json
          created_at?: string
          document_id: string
          generated_at?: string
          id?: string
          overall_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_items?: Json
          created_at?: string
          document_id?: string
          generated_at?: string
          id?: string
          overall_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tender_analyses: {
        Row: {
          addenda: Json | null
          bbbee_level: string | null
          bid_data: Json | null
          cidb_grade: string | null
          closing_date: string | null
          compliance_requirements: Json | null
          confidence_score: number | null
          contact_info: Json | null
          contract_duration: string | null
          contract_intelligence: Json | null
          created_at: string
          department: string | null
          detected_tables: Json | null
          document_id: string
          estimated_value: string | null
          evaluation_criteria: Json | null
          forms_detected: Json | null
          id: string
          important_dates: Json | null
          issuing_entity: string | null
          jv_requirements: string | null
          key_clauses: Json | null
          page_intelligence: Json | null
          pages_flagged: Json | null
          pricing_schedules: Json | null
          procurement_type: string | null
          professional_registrations: Json | null
          province: string | null
          raw_response: Json | null
          readiness_score: number | null
          reference_number: string | null
          returnables: Json | null
          risks: Json | null
          scope_of_work: string | null
          scoring_tables: Json | null
          signature_blocks: Json | null
          subcontracting_requirements: string | null
          submission_details: Json | null
          summary: string | null
          tender_category: string | null
          tender_title: string | null
          user_id: string
        }
        Insert: {
          addenda?: Json | null
          bbbee_level?: string | null
          bid_data?: Json | null
          cidb_grade?: string | null
          closing_date?: string | null
          compliance_requirements?: Json | null
          confidence_score?: number | null
          contact_info?: Json | null
          contract_duration?: string | null
          contract_intelligence?: Json | null
          created_at?: string
          department?: string | null
          detected_tables?: Json | null
          document_id: string
          estimated_value?: string | null
          evaluation_criteria?: Json | null
          forms_detected?: Json | null
          id?: string
          important_dates?: Json | null
          issuing_entity?: string | null
          jv_requirements?: string | null
          key_clauses?: Json | null
          page_intelligence?: Json | null
          pages_flagged?: Json | null
          pricing_schedules?: Json | null
          procurement_type?: string | null
          professional_registrations?: Json | null
          province?: string | null
          raw_response?: Json | null
          readiness_score?: number | null
          reference_number?: string | null
          returnables?: Json | null
          risks?: Json | null
          scope_of_work?: string | null
          scoring_tables?: Json | null
          signature_blocks?: Json | null
          subcontracting_requirements?: string | null
          submission_details?: Json | null
          summary?: string | null
          tender_category?: string | null
          tender_title?: string | null
          user_id: string
        }
        Update: {
          addenda?: Json | null
          bbbee_level?: string | null
          bid_data?: Json | null
          cidb_grade?: string | null
          closing_date?: string | null
          compliance_requirements?: Json | null
          confidence_score?: number | null
          contact_info?: Json | null
          contract_duration?: string | null
          contract_intelligence?: Json | null
          created_at?: string
          department?: string | null
          detected_tables?: Json | null
          document_id?: string
          estimated_value?: string | null
          evaluation_criteria?: Json | null
          forms_detected?: Json | null
          id?: string
          important_dates?: Json | null
          issuing_entity?: string | null
          jv_requirements?: string | null
          key_clauses?: Json | null
          page_intelligence?: Json | null
          pages_flagged?: Json | null
          pricing_schedules?: Json | null
          procurement_type?: string | null
          professional_registrations?: Json | null
          province?: string | null
          raw_response?: Json | null
          readiness_score?: number | null
          reference_number?: string | null
          returnables?: Json | null
          risks?: Json | null
          scope_of_work?: string | null
          scoring_tables?: Json | null
          signature_blocks?: Json | null
          subcontracting_requirements?: string | null
          submission_details?: Json | null
          summary?: string | null
          tender_category?: string | null
          tender_title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refund_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      reserve_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
