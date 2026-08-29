import { outsetaEdgePost } from "@/lib/outseta/edge";

export async function watchlistRequest(
  action: "list" | "add" | "remove",
  marketId?: string,
): Promise<{ marketIds?: string[]; error?: string }> {
  return outsetaEdgePost("watchlist", { action, marketId });
}
