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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note_text: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note_text: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note_text?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      conductor_del_mes: {
        Row: {
          conductor_id: string
          created_at: string
          id: string
          month: number
          selected_by: string | null
          year: number
        }
        Insert: {
          conductor_id: string
          created_at?: string
          id?: string
          month: number
          selected_by?: string | null
          year: number
        }
        Update: {
          conductor_id?: string
          created_at?: string
          id?: string
          month?: number
          selected_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "conductor_del_mes_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductor_del_mes_selected_by_fkey"
            columns: ["selected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conductor_vacations: {
        Row: {
          created_at: string
          days_count: number
          end_date: string
          id: string
          notes: string | null
          profile_id: string
          rent_postponed: boolean
          start_date: string
          status: string
          surcharge_percentage: number
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          days_count: number
          end_date: string
          id?: string
          notes?: string | null
          profile_id: string
          rent_postponed?: boolean
          start_date: string
          status?: string
          surcharge_percentage?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          days_count?: number
          end_date?: string
          id?: string
          notes?: string | null
          profile_id?: string
          rent_postponed?: boolean
          start_date?: string
          status?: string
          surcharge_percentage?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conductor_vacations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductor_vacations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          id: string
          name: string
          requires_expiration: boolean
        }
        Insert: {
          id?: string
          name: string
          requires_expiration?: boolean
        }
        Update: {
          id?: string
          name?: string
          requires_expiration?: boolean
        }
        Relationships: []
      }
      documents: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          document_type_id: string
          expiration_date: string | null
          file_key: string
          file_url: string
          id: string
          profile_id: string
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          document_type_id: string
          expiration_date?: string | null
          file_key: string
          file_url: string
          id?: string
          profile_id: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          document_type_id?: string
          expiration_date?: string | null
          file_key?: string
          file_url?: string
          id?: string
          profile_id?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          created_at: string
          descuentos_primarios: Json
          descuentos_secundarios: Json
          email: string | null
          enviado_por: string | null
          fecha: string
          file_url: string | null
          firma_completada_at: string | null
          firma_estado: string
          firma_id_documento: string | null
          firma_id_proceso: string | null
          firma_iniciada_at: string | null
          firma_url: string | null
          firma_url_empleador: string | null
          id: string
          mes: string
          nombre: string
          profile_id: string
          rut: string | null
          subtotal: number
          total_a_pagar: number
          total_descuentos: number
          total_facturado: number
          worker_id: string
        }
        Insert: {
          created_at?: string
          descuentos_primarios?: Json
          descuentos_secundarios?: Json
          email?: string | null
          enviado_por?: string | null
          fecha: string
          file_url?: string | null
          firma_completada_at?: string | null
          firma_estado?: string
          firma_id_documento?: string | null
          firma_id_proceso?: string | null
          firma_iniciada_at?: string | null
          firma_url?: string | null
          firma_url_empleador?: string | null
          id?: string
          mes: string
          nombre: string
          profile_id: string
          rut?: string | null
          subtotal?: number
          total_a_pagar?: number
          total_descuentos?: number
          total_facturado?: number
          worker_id: string
        }
        Update: {
          created_at?: string
          descuentos_primarios?: Json
          descuentos_secundarios?: Json
          email?: string | null
          enviado_por?: string | null
          fecha?: string
          file_url?: string | null
          firma_completada_at?: string | null
          firma_estado?: string
          firma_id_documento?: string | null
          firma_id_proceso?: string | null
          firma_iniciada_at?: string | null
          firma_url?: string | null
          firma_url_empleador?: string | null
          id?: string
          mes?: string
          nombre?: string
          profile_id?: string
          rut?: string | null
          subtotal?: number
          total_a_pagar?: number
          total_descuentos?: number
          total_facturado?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidaciones_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_records: {
        Row: {
          created_at: string
          id: string
          kilometers: number
          notes: string | null
          profile_id: string
          recorded_date: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kilometers: number
          notes?: string | null
          profile_id: string
          recorded_date?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kilometers?: number
          notes?: string | null
          profile_id?: string
          recorded_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mileage_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pendientes_pago: {
        Row: {
          created_at: string | null
          estado_autopista: string
          estado_seguro: string
          estado_sueldo: string
          fecha_pago_autopista: string | null
          fecha_pago_seguro: string | null
          fecha_pago_sueldo: string | null
          id: string
          liquidacion_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado_autopista?: string
          estado_seguro?: string
          estado_sueldo?: string
          fecha_pago_autopista?: string | null
          fecha_pago_seguro?: string | null
          fecha_pago_sueldo?: string | null
          id?: string
          liquidacion_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado_autopista?: string
          estado_seguro?: string
          estado_sueldo?: string
          fecha_pago_autopista?: string | null
          fecha_pago_seguro?: string | null
          fecha_pago_sueldo?: string | null
          id?: string
          liquidacion_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pendientes_pago_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: true
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido_materno: string | null
          apellido_paterno: string | null
          created_at: string
          email: string | null
          estado_conductor: string
          full_name: string | null
          id: string
          nombres: string | null
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["app_role"]
          rut: string | null
          score: number | null
          updated_at: string
          user_id: string | null
          worker_id: string | null
        }
        Insert: {
          apellido_materno?: string | null
          apellido_paterno?: string | null
          created_at?: string
          email?: string | null
          estado_conductor?: string
          full_name?: string | null
          id?: string
          nombres?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          rut?: string | null
          score?: number | null
          updated_at?: string
          user_id?: string | null
          worker_id?: string | null
        }
        Update: {
          apellido_materno?: string | null
          apellido_paterno?: string | null
          created_at?: string
          email?: string | null
          estado_conductor?: string
          full_name?: string | null
          id?: string
          nombres?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          rut?: string | null
          score?: number | null
          updated_at?: string
          user_id?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      request_types: {
        Row: {
          id: string
          min_score: number
          name: string
        }
        Insert: {
          id?: string
          min_score?: number
          name: string
        }
        Update: {
          id?: string
          min_score?: number
          name?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          amount: number | null
          created_at: string
          cuotas: number | null
          details: string | null
          es_solicitud_especial: boolean | null
          id: string
          profile_id: string
          recargo_porcentaje: number | null
          request_type_id: string
          status: string
          total_con_recargo: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          cuotas?: number | null
          details?: string | null
          es_solicitud_especial?: boolean | null
          id?: string
          profile_id: string
          recargo_porcentaje?: number | null
          request_type_id: string
          status?: string
          total_con_recargo?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          cuotas?: number | null
          details?: string | null
          es_solicitud_especial?: boolean | null
          id?: string
          profile_id?: string
          recargo_porcentaje?: number | null
          request_type_id?: string
          status?: string
          total_con_recargo?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_assignments: {
        Row: {
          assigned_at: string
          id: string
          profile_id: string
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          profile_id: string
          vehicle_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          profile_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_insurances: {
        Row: {
          amount: number
          created_at: string
          custom_insurance_name: string | null
          expiration_date: string
          id: string
          insurance_type: string
          last_payment_date: string | null
          payment_status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          custom_insurance_name?: string | null
          expiration_date: string
          id?: string
          insurance_type: string
          last_payment_date?: string | null
          payment_status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          custom_insurance_name?: string | null
          expiration_date?: string
          id?: string
          insurance_type?: string
          last_payment_date?: string | null
          payment_status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_insurances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_observations: {
        Row: {
          condition: string
          created_at: string
          description: string
          id: string
          issue_type: string
          part_key: string
          part_name: string
          profile_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          condition?: string
          created_at?: string
          description: string
          id?: string
          issue_type?: string
          part_key: string
          part_name: string
          profile_id: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          part_key?: string
          part_name?: string
          profile_id?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_observations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_observations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_prorrateos: {
        Row: {
          anio_rendimiento: number
          created_at: string
          fecha_registro: string
          id: string
          mes_rendimiento: number
          monto: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          anio_rendimiento: number
          created_at?: string
          fecha_registro: string
          id?: string
          mes_rendimiento: number
          monto?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          anio_rendimiento?: number
          created_at?: string
          fecha_registro?: string
          id?: string
          mes_rendimiento?: number
          monto?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_prorrateos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          id: string
          license_plate: string
          make: string | null
          model: string | null
          status: string
          updated_at: string
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          license_plate: string
          make?: string | null
          model?: string | null
          status?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          license_plate?: string
          make?: string | null
          model?: string | null
          status?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_conductor: {
        Args: {
          apellido_materno: string
          apellido_paterno: string
          email: string
          full_name: string
          nombres: string
          password: string
          phone: string
          rut: string
        }
        Returns: undefined
      }
      can_access_profile: {
        Args: { _profile_id: string; _user_id: string }
        Returns: boolean
      }
      delete_auth_user: { Args: { user_id: string }; Returns: undefined }
      get_conductor_del_mes: {
        Args: { p_month?: number; p_year?: number }
        Returns: Json
      }
      has_vehicle_access: {
        Args: { _user_id: string; _vehicle_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_app_admin: { Args: never; Returns: boolean }
      is_conductor: { Args: { _user_id: string }; Returns: boolean }
      mark_message_read: { Args: { msg_id: string }; Returns: undefined }
      resolve_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      set_profile_photo_url: {
        Args: { new_photo_url: string }
        Returns: undefined
      }
      update_own_profile: {
        Args: {
          p_apellido_materno: string
          p_apellido_paterno: string
          p_nombres: string
          p_phone: string
          p_rut: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "conductor" | "super_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "conductor", "super_admin"],
    },
  },
} as const
