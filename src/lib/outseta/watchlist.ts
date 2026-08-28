const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function getOutsetaAccessToken(): Promise<string | null> {
  const embed = window.Outseta;
  if (!embed?.getAccessToken) return null;
  try {
    const token = await embed.getAccessToken();
    return token || null;
  } catch {
    return null;
  }
}

export async function watchlistRequest(
  action: "list" | "add" | "remove",
  marketId?: string,
): Promise<{ marketIds?: string[]; error?: string }> {
  const token = await getOutsetaAccessToken();
  if (!token) throw new Error("Sign in to save markets");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/watchlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, marketId }),
  });
  const json = (await res.json().catch(() => ({}))) as { marketIds?: string[]; error?: string };
  if (!res.ok) throw new Error(json.error || `Watchlist failed (${res.status})`);
  return json;
}
