import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioSnapshot, StatsPoint } from "@/lib/portfolio/types";

export type PortfolioPayload = {
  portfolio: PortfolioSnapshot;
  stats: StatsPoint[];
  fetchedAt: string;
  holdingsCadence: string;
  statsCadence: string;
};

export function usePortfolioSnapshot() {
  return useQuery({
    queryKey: ["portfolio-snapshot"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PortfolioPayload> => {
      if (import.meta.env.DEV) {
        const res = await fetch("/api/portfolio-snapshot");
        const body = (await res.json()) as PortfolioPayload & { error?: string };
        if (!res.ok || body.error) throw new Error(body.error || `Snapshot failed (${res.status})`);
        if (!body.portfolio) throw new Error("Empty portfolio snapshot");
        return body;
      }
      const { data, error } = await supabase.functions.invoke("portfolio-snapshot");
      if (error) throw error;
      const body = data as PortfolioPayload & { error?: string };
      if (body?.error) throw new Error(body.error);
      if (!body?.portfolio) throw new Error("Empty portfolio snapshot");
      return body;
    },
  });
}
