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

export class OutsetaEdgeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** GET with the Outseta access token. Throws OutsetaEdgeError (status 401 when signed out). */
export async function outsetaEdgeGet<T>(functionName: string): Promise<T> {
  const token = await getOutsetaAccessToken();
  if (!token) throw new OutsetaEdgeError("Sign in required", 401);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "GET",
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new OutsetaEdgeError((json as { error?: string })?.error || `${functionName} failed (${res.status})`, res.status);
  return json;
}

/** Same as outsetaEdgePost but keeps the HTTP status on failure. */
export async function outsetaEdgePostStatus<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const token = await getOutsetaAccessToken();
  if (!token) throw new OutsetaEdgeError("Sign in required", 401);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new OutsetaEdgeError((json as { error?: string })?.error || `${functionName} failed (${res.status})`, res.status);
  return json;
}

export function edgeAccessMessage(e: unknown): string {
  const status = e instanceof OutsetaEdgeError ? e.status : 0;
  if (status === 401) return "Please sign in to view the Daily Briefing.";
  if (status === 403) return "The Daily Briefing is available to Team Plan members only.";
  return e instanceof Error ? e.message : "Something went wrong.";
}
