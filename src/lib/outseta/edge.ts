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

export async function outsetaEdgePost<T extends Record<string, unknown>>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = await getOutsetaAccessToken();
  if (!token) throw new Error("Sign in required");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `${functionName} failed (${res.status})`);
  return json;
}
