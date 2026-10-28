import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadTpDtPortfolio, type TpDtBook } from "@/lib/tpDtPortfolio";

async function fromDevApi(): Promise<TpDtBook> {
  const res = await fetch(`/api/tp-dt-portfolio?t=${Date.now()}`, { cache: "no-store" });
  const body = (await res.json()) as TpDtBook & { error?: string };
  if (!res.ok || body.error) throw new Error(body.error || `TP DT snapshot failed (${res.status})`);
  if (!body.groups) throw new Error("Empty TP DT snapshot");
  return body;
}

async function fromEdge(): Promise<TpDtBook> {
  const { data, error } = await supabase.functions.invoke("portfolio-snapshot");
  if (error) throw error;
  const body = data as { tpDt?: TpDtBook; error?: string };
  if (body?.error) throw new Error(body.error);
  if (!body?.tpDt?.groups) throw new Error("TP DT tab missing from snapshot");
  return body.tpDt;
}

export function useTpDtPortfolio() {
  return useQuery({
    queryKey: ["tp-dt-portfolio"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TpDtBook> => {
      if (import.meta.env.DEV) {
        try {
          return await fromDevApi();
        } catch {
          return loadTpDtPortfolio();
        }
      }
      try {
        return await fromEdge();
      } catch {
        return loadTpDtPortfolio();
      }
    },
  });
}
