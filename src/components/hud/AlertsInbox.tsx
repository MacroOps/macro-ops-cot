// Topbar bell with unacknowledged alert events. Polls every 30s; surfaces
// toast on new fires. Click → /alerts.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AlertEvent {
  id: string;
  fired_at: string;
  message: string | null;
}

export function AlertsInbox() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("alert_events")
        .select("id, fired_at, message")
        .eq("acknowledged", false)
        .order("fired_at", { ascending: false })
        .limit(20);
      if (cancelled || !data) return;
      if (bootstrapped.current) {
        for (const e of data) {
          if (!seen.current.has(e.id)) {
            toast(`🔔 ${e.message ?? "Alert fired"}`, {
              action: { label: "View", onClick: () => (window.location.href = "/alerts") },
            });
          }
        }
      }
      data.forEach((e) => seen.current.add(e.id));
      setEvents(data);
      bootstrapped.current = true;
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  if (!user) return null;
  const count = events.length;

  return (
    <Link
      to="/alerts"
      className="relative flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:bg-muted transition-colors"
      aria-label={`Alerts (${count})`}
    >
      <Bell className="h-3 w-3" />
      <span className="hidden sm:inline">Alerts</span>
      {count > 0 && (
        <span className="ml-0.5 px-1 min-w-[16px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
