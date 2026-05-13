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
      custom_products: {
        Row: {
          color_token: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          color_token?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          color_token?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_statuses: {
        Row: {
          created_at: string
          custom_product_id: string
          id: string
          label: string
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          custom_product_id: string
          id?: string
          label: string
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          custom_product_id?: string
          id?: string
          label?: string
          name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_statuses_custom_product_id_fkey"
            columns: ["custom_product_id"]
            isOneToOne: false
            referencedRelation: "custom_products"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          file_type: string | null
          folder_id: string
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder_id: string
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          custom_product_id: string | null
          custom_status_id: string | null
          customer_email: string | null
          customer_name: string
          id: string
          installment_count: number | null
          installment_fee: number | null
          installments_paid: number | null
          name: string
          next_payment_date: string | null
          partner_code: string | null
          payment_link_url: string | null
          payment_selection_token: string | null
          payment_status: string | null
          product: Database["public"]["Enums"]["product_type"] | null
          prognose_amount: number | null
          prognose_created_at: string | null
          status: Database["public"]["Enums"]["case_status"] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          custom_product_id?: string | null
          custom_status_id?: string | null
          customer_email?: string | null
          customer_name: string
          id?: string
          installment_count?: number | null
          installment_fee?: number | null
          installments_paid?: number | null
          name: string
          next_payment_date?: string | null
          partner_code?: string | null
          payment_link_url?: string | null
          payment_selection_token?: string | null
          payment_status?: string | null
          product?: Database["public"]["Enums"]["product_type"] | null
          prognose_amount?: number | null
          prognose_created_at?: string | null
          status?: Database["public"]["Enums"]["case_status"] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          custom_product_id?: string | null
          custom_status_id?: string | null
          customer_email?: string | null
          customer_name?: string
          id?: string
          installment_count?: number | null
          installment_fee?: number | null
          installments_paid?: number | null
          name?: string
          next_payment_date?: string | null
          partner_code?: string | null
          payment_link_url?: string | null
          payment_selection_token?: string | null
          payment_status?: string | null
          product?: Database["public"]["Enums"]["product_type"] | null
          prognose_amount?: number | null
          prognose_created_at?: string | null
          status?: Database["public"]["Enums"]["case_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_custom_product_id_fkey"
            columns: ["custom_product_id"]
            isOneToOne: false
            referencedRelation: "custom_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_custom_status_id_fkey"
            columns: ["custom_status_id"]
            isOneToOne: false
            referencedRelation: "custom_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          content: string | null
          content_type: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_path: string | null
          id: string
          product_type: Database["public"]["Enums"]["product_type"] | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_path: string | null
          file_type: string | null
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      partner_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_provision_configs: {
        Row: {
          bookkeeper_fee: number
          created_at: string
          created_by: string | null
          id: string
          partner_code: string
          provision_type: string
          provision_value: number
          updated_at: string
        }
        Insert: {
          bookkeeper_fee?: number
          created_at?: string
          created_by?: string | null
          id?: string
          partner_code: string
          provision_type: string
          provision_value: number
          updated_at?: string
        }
        Update: {
          bookkeeper_fee?: number
          created_at?: string
          created_by?: string | null
          id?: string
          partner_code?: string
          provision_type?: string
          provision_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          language: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          language?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          language?: string | null
        }
        Relationships: []
      }
      user_custom_product_visibility: {
        Row: {
          custom_product_id: string
          is_visible: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          custom_product_id: string
          is_visible?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          custom_product_id?: string
          is_visible?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_product_visibility_custom_product_id_fkey"
            columns: ["custom_product_id"]
            isOneToOne: false
            referencedRelation: "custom_products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_product_visibility: {
        Row: {
          is_visible: boolean
          product: Database["public"]["Enums"]["product_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          is_visible?: boolean
          product: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          is_visible?: boolean
          product?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sachbearbeiter" | "vertriebler"
      case_status:
        | "neu"
        | "bezahlt"
        | "abgeschickt"
        | "in_bearbeitung"
        | "abgeschlossen"
        | "einspruch"
        | "anfrage_eingegangen"
        | "prognose_erstellt"
        | "angebot_gesendet"
        | "anzahlung_erhalten"
        | "einspruch_nacharbeit"
        | "rueckstand"
      product_type:
        | "steuern"
        | "kredit"
        | "versicherung"
        | "problemfall"
        | "global_sourcing"
        | "unternehmensberatung"
        | "ai_due_diligence"
        | "payment_solutions"
        | "solaranlagen"
        | "immobilien"
        | "rechtsberatung"
        | "sonstiges"
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
      app_role: ["admin", "sachbearbeiter", "vertriebler"],
      case_status: [
        "neu",
        "bezahlt",
        "abgeschickt",
        "in_bearbeitung",
        "abgeschlossen",
        "einspruch",
        "anfrage_eingegangen",
        "prognose_erstellt",
        "angebot_gesendet",
        "anzahlung_erhalten",
        "einspruch_nacharbeit",
        "rueckstand",
      ],
      product_type: [
        "steuern",
        "kredit",
        "versicherung",
        "problemfall",
        "global_sourcing",
        "unternehmensberatung",
        "ai_due_diligence",
        "payment_solutions",
        "solaranlagen",
        "immobilien",
        "rechtsberatung",
        "sonstiges",
      ],
    },
  },
} as const
