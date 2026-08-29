import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutseta } from "@outseta/react";
import { alertsRequest } from "@/lib/outseta/alerts";

export interface AlertRule {
  id: string;
  name: string;
  indicator_key: string;
  operator: "gte" | "lte" | "crosses_above" | "crosses_below";
  threshold: number;
  active: boolean;
  cooldown_minutes: number;
  last_fired_at: string | null;
  last_value: number | null;
}

export interface AlertEvent {
  id: string;
  alert_id: string;
  fired_at: string;
  indicator_value: number;
  percentile: number | null;
  message: string | null;
  acknowledged: boolean;
}

export function useAlerts() {
  const { user } = useOutseta();
  const qc = useQueryClient();
  const personUid = user?.Uid;

  const list = useQuery({
    queryKey: ["alerts", personUid],
    enabled: !!personUid,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await alertsRequest<{ alerts?: AlertRule[]; events?: AlertEvent[] }>("list");
      return { alerts: res.alerts ?? [], events: res.events ?? [] };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["alerts", personUid] });

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      indicatorKey: string;
      operator: AlertRule["operator"];
      threshold: number;
      cooldownMinutes: number;
    }) => alertsRequest("create", input),
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: (input: { id: string; active: boolean }) => alertsRequest("setActive", input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => alertsRequest("delete", { id }),
    onSuccess: invalidate,
  });

  const ack = useMutation({
    mutationFn: (id: string) => alertsRequest("ack", { id }),
    onSuccess: invalidate,
  });

  const ackAll = useMutation({
    mutationFn: () => alertsRequest("ackAll"),
    onSuccess: invalidate,
  });

  const evaluate = useMutation({
    mutationFn: () => alertsRequest<{ evaluated?: number; fired?: number }>("evaluate"),
    onSuccess: invalidate,
  });

  return {
    alerts: list.data?.alerts ?? [],
    events: list.data?.events ?? [],
    loading: list.isLoading,
    signedIn: !!personUid,
    create,
    setActive,
    remove,
    ack,
    ackAll,
    evaluate,
  };
}
