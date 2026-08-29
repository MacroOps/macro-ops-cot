import { outsetaEdgePost } from "@/lib/outseta/edge";

export async function alertsRequest<T extends Record<string, unknown> = Record<string, unknown>>(
  action: string,
  extra: Record<string, unknown> = {},
): Promise<T> {
  return outsetaEdgePost<T>("alerts", { action, ...extra });
}
