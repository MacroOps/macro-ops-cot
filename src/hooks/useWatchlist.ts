import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutseta } from "@outseta/react";
import { watchlistRequest } from "@/lib/outseta/watchlist";

export function useWatchlist() {
  const { user } = useOutseta();
  const qc = useQueryClient();
  const personUid = user?.Uid;

  const list = useQuery({
    queryKey: ["watchlist", personUid],
    enabled: !!personUid,
    queryFn: async () => {
      const res = await watchlistRequest("list");
      return new Set(res.marketIds ?? []);
    },
  });

  const add = useMutation({
    mutationFn: async (marketId: string) => {
      if (!personUid) throw new Error("Sign in to save markets");
      await watchlistRequest("add", marketId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", personUid] }),
  });

  const remove = useMutation({
    mutationFn: async (marketId: string) => {
      if (!personUid) throw new Error("Sign in required");
      await watchlistRequest("remove", marketId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", personUid] }),
  });

  return { ids: list.data ?? new Set<string>(), add, remove, loading: list.isLoading, signedIn: !!personUid };
}
