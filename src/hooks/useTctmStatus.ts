import { useQuery } from "@tanstack/react-query";
import { TCTM as E } from "@/lib/tctm/engine.js";
import { loadFromSheet } from "@/lib/tctm/sheet.js";
import { summarizeTctm, type TctmStatus } from "@/lib/tctm/status";

/** Current state of the five TCTM composites, read from Dean's "TCTM Signals" sheet tab. */
export function useTctmStatus() {
  return useQuery({
    queryKey: ["tctm-status"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<TctmStatus> => {
      const { values } = await loadFromSheet(() => {});
      return summarizeTctm(E.buildDataset(values));
    },
  });
}
