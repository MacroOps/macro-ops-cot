import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useWatchlist() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["watchlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchlist").select("market_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map(r => r.market_id));
    },
  });

  const add = useMutation({
    mutationFn: async (marketId: string) => {
      if (!user) throw new Error("Sign in to save markets");
      const { error } = await supabase.from("watchlist")
        .insert({ user_id: user.id, market_id: marketId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", user?.id] }),
  });

  const remove = useMutation({
    mutationFn: async (marketId: string) => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("watchlist")
        .delete().eq("user_id", user.id).eq("market_id", marketId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist", user?.id] }),
  });

  return { ids: list.data ?? new Set<string>(), add, remove, loading: list.isLoading };
}
