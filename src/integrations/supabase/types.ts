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
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          summary: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          summary?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          summary?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          note: string | null
          spent_at: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          spent_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          spent_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_balances: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_key: string
          customer_name: string | null
          customer_phone: string | null
          points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_key: string
          customer_name?: string | null
          customer_phone?: string | null
          points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_key?: string
          customer_name?: string | null
          customer_phone?: string | null
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_key: string
          delta: number
          id: string
          kind: string
          note: string | null
          order_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          customer_key: string
          delta: number
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          value?: number
        }
        Update: {
          created_at?: string
          customer_key?: string
          delta?: number
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          value?: number
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string | null
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_note: string | null
          discount: number
          extra_fee: number
          id: string
          order_date: string
          order_no: number
          payment_status: string
          points_earned: number
          points_redeemed: number
          points_value: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_note?: string | null
          discount?: number
          extra_fee?: number
          id?: string
          order_date?: string
          order_no?: number
          payment_status?: string
          points_earned?: number
          points_redeemed?: number
          points_value?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_note?: string | null
          discount?: number
          extra_fee?: number
          id?: string
          order_date?: string
          order_no?: number
          payment_status?: string
          points_earned?: number
          points_redeemed?: number
          points_value?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          final_sell_mmk: number | null
          id: string
          name: string
          note: string | null
          price: number
          product_id: string
          size: string | null
          sold_qty: number
          status: string
          stock_in: number
          thb_price: number | null
          updated_at: string
          variant_code: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          final_sell_mmk?: number | null
          id?: string
          name: string
          note?: string | null
          price?: number
          product_id: string
          size?: string | null
          sold_qty?: number
          status?: string
          stock_in?: number
          thb_price?: number | null
          updated_at?: string
          variant_code?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          final_sell_mmk?: number | null
          id?: string
          name?: string
          note?: string | null
          price?: number
          product_id?: string
          size?: string | null
          sold_qty?: number
          status?: string
          stock_in?: number
          thb_price?: number | null
          updated_at?: string
          variant_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          final_sell_mmk: number | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          margin_percent: number | null
          name: string
          note: string | null
          price: number
          pricing_buy_rate: number | null
          pricing_cargo_mmk: number | null
          pricing_deli_mmk: number | null
          pricing_fixed_profit: number | null
          pricing_minimum_price_mode: string | null
          pricing_other_mmk: number | null
          pricing_percent_profit: number | null
          pricing_profit_mode: string | null
          pricing_rounding_rule: string | null
          pricing_sell_gap: number | null
          product_code: string | null
          size: string | null
          sold_qty: number
          status: string
          stock_in: number
          stock_status: string
          thb_price: number | null
          updated_at: string
          waiting_time: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          final_sell_mmk?: number | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          margin_percent?: number | null
          name: string
          note?: string | null
          price?: number
          pricing_buy_rate?: number | null
          pricing_cargo_mmk?: number | null
          pricing_deli_mmk?: number | null
          pricing_fixed_profit?: number | null
          pricing_minimum_price_mode?: string | null
          pricing_other_mmk?: number | null
          pricing_percent_profit?: number | null
          pricing_profit_mode?: string | null
          pricing_rounding_rule?: string | null
          pricing_sell_gap?: number | null
          product_code?: string | null
          size?: string | null
          sold_qty?: number
          status?: string
          stock_in?: number
          stock_status?: string
          thb_price?: number | null
          updated_at?: string
          waiting_time?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          final_sell_mmk?: number | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          margin_percent?: number | null
          name?: string
          note?: string | null
          price?: number
          pricing_buy_rate?: number | null
          pricing_cargo_mmk?: number | null
          pricing_deli_mmk?: number | null
          pricing_fixed_profit?: number | null
          pricing_minimum_price_mode?: string | null
          pricing_other_mmk?: number | null
          pricing_percent_profit?: number | null
          pricing_profit_mode?: string | null
          pricing_rounding_rule?: string | null
          pricing_sell_gap?: number | null
          product_code?: string | null
          size?: string | null
          sold_qty?: number
          status?: string
          stock_in?: number
          stock_status?: string
          thb_price?: number | null
          updated_at?: string
          waiting_time?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          po_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          po_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          po_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          note: string | null
          ordered_at: string
          po_no: number
          received_at: string | null
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          ordered_at?: string
          po_no?: number
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          ordered_at?: string
          po_no?: number
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          buy_rate: number
          created_at: string
          date: string
          id: string
          note: string | null
          sell_gap: number
          source: string
        }
        Insert: {
          buy_rate?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          sell_gap?: number
          source?: string
        }
        Update: {
          buy_rate?: number
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          sell_gap?: number
          source?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          business_name: string | null
          currency: string | null
          default_waiting_time: string | null
          id: string
          language: string
          logo_url: string | null
          minimum_price_buffer: number | null
          service_fee: number | null
          tax_percent: number | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          currency?: string | null
          default_waiting_time?: string | null
          id?: string
          language?: string
          logo_url?: string | null
          minimum_price_buffer?: number | null
          service_fee?: number | null
          tax_percent?: number | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          currency?: string | null
          default_waiting_time?: string | null
          id?: string
          language?: string
          logo_url?: string | null
          minimum_price_buffer?: number | null
          service_fee?: number | null
          tax_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      vouchers: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount: number
          extra_fee: number
          id: string
          issued_at: string
          items: Json
          note: string | null
          order_id: string | null
          paid: number
          payment_method: string | null
          subtotal: number
          total: number
          voucher_no: number
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          extra_fee?: number
          id?: string
          issued_at?: string
          items?: Json
          note?: string | null
          order_id?: string | null
          paid?: number
          payment_method?: string | null
          subtotal?: number
          total?: number
          voucher_no?: number
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          extra_fee?: number
          id?: string
          issued_at?: string
          items?: Json
          note?: string | null
          order_id?: string | null
          paid?: number
          payment_method?: string | null
          subtotal?: number
          total?: number
          voucher_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
