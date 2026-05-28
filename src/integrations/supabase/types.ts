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
      cot_reports: {
        Row: {
          created_at: string
          format: Database["public"]["Enums"]["report_format"]
          id: string
          market_id: string
          open_interest: number | null
          release_date: string | null
          report_date: string
        }
        Insert: {
          created_at?: string
          format: Database["public"]["Enums"]["report_format"]
          id?: string
          market_id: string
          open_interest?: number | null
          release_date?: string | null
          report_date: string
        }
        Update: {
          created_at?: string
          format?: Database["public"]["Enums"]["report_format"]
          id?: string
          market_id?: string
          open_interest?: number | null
          release_date?: string | null
          report_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cot_reports_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_log: {
        Row: {
          finished_at: string | null
          id: string
          message: string | null
          rows_written: number
          source: string
          started_at: string
          status: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          message?: string | null
          rows_written?: number
          source: string
          started_at?: string
          status: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          message?: string | null
          rows_written?: number
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          cftc_code: string | null
          contract_size: number | null
          created_at: string
          exchange: string | null
          id: string
          is_active: boolean
          name: string
          news_keywords: string | null
          price_unit: string | null
          sector: Database["public"]["Enums"]["market_sector"]
          symbol: string
          updated_at: string
          yahoo_symbol: string | null
        }
        Insert: {
          cftc_code?: string | null
          contract_size?: number | null
          created_at?: string
          exchange?: string | null
          id?: string
          is_active?: boolean
          name: string
          news_keywords?: string | null
          price_unit?: string | null
          sector: Database["public"]["Enums"]["market_sector"]
          symbol: string
          updated_at?: string
          yahoo_symbol?: string | null
        }
        Update: {
          cftc_code?: string | null
          contract_size?: number | null
          created_at?: string
          exchange?: string | null
          id?: string
          is_active?: boolean
          name?: string
          news_keywords?: string | null
          price_unit?: string | null
          sector?: Database["public"]["Enums"]["market_sector"]
          symbol?: string
          updated_at?: string
          yahoo_symbol?: string | null
        }
        Relationships: []
      }
      news_events: {
        Row: {
          created_at: string
          divergence_note: string | null
          expected_direction: number | null
          headline: string
          id: string
          is_divergence: boolean
          market_id: string | null
          observed_return_1d: number | null
          published_at: string
          source: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          divergence_note?: string | null
          expected_direction?: number | null
          headline: string
          id?: string
          is_divergence?: boolean
          market_id?: string | null
          observed_return_1d?: number | null
          published_at: string
          source?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          divergence_note?: string | null
          expected_direction?: number | null
          headline?: string
          id?: string
          is_divergence?: boolean
          market_id?: string | null
          observed_return_1d?: number | null
          published_at?: string
          source?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_events_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      positioning_snapshots: {
        Row: {
          category: Database["public"]["Enums"]["trader_category"]
          id: string
          long_contracts: number
          net_contracts: number | null
          pct_of_oi: number | null
          report_id: string
          short_contracts: number
          spread_contracts: number
        }
        Insert: {
          category: Database["public"]["Enums"]["trader_category"]
          id?: string
          long_contracts?: number
          net_contracts?: number | null
          pct_of_oi?: number | null
          report_id: string
          short_contracts?: number
          spread_contracts?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["trader_category"]
          id?: string
          long_contracts?: number
          net_contracts?: number | null
          pct_of_oi?: number | null
          report_id?: string
          short_contracts?: number
          spread_contracts?: number
        }
        Relationships: [
          {
            foreignKeyName: "positioning_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "cot_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          close: number
          id: string
          market_id: string
          observed_on: string
        }
        Insert: {
          close: number
          id?: string
          market_id: string
          observed_on: string
        }
        Update: {
          close?: number
          id?: string
          market_id?: string
          observed_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          market_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      market_sector:
        | "Equities"
        | "Rates"
        | "FX"
        | "Energy"
        | "Metals"
        | "Agriculture"
        | "Crypto"
      report_format: "legacy" | "disaggregated" | "tff"
      trader_category:
        | "commercial"
        | "non_commercial"
        | "non_reportable"
        | "producer_merchant"
        | "swap_dealer"
        | "managed_money"
        | "other_reportable"
        | "dealer_intermediary"
        | "asset_manager"
        | "leveraged_fund"
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
      market_sector: [
        "Equities",
        "Rates",
        "FX",
        "Energy",
        "Metals",
        "Agriculture",
        "Crypto",
      ],
      report_format: ["legacy", "disaggregated", "tff"],
      trader_category: [
        "commercial",
        "non_commercial",
        "non_reportable",
        "producer_merchant",
        "swap_dealer",
        "managed_money",
        "other_reportable",
        "dealer_intermediary",
        "asset_manager",
        "leveraged_fund",
      ],
    },
  },
} as const
