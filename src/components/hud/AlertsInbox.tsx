// Topbar bell with unacknowledged alert events. Polls every 30s; surfaces
// toast on new fires. Click → /alerts.
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useAlerts } from "@/hooks/useAlerts";

export function AlertsInbox() {
  const { signedIn, events } = useAlerts();
  const seen = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);
  const unacked = events.filter((e) => !e.acknowledged);

  useEffect(() => {
    if (!signedIn) return;
    if (bootstrapped.current) {
      for (const e of unacked) {
        if (!seen.current.has(e.id)) {
          toast(`🔔 ${e.message ?? "Alert fired"}`, {
            action: { label: "View", onClick: () => (window.location.href = "/alerts") },
          });
        }
      }
    }
    unacked.forEach((e) => seen.current.add(e.id));
    bootstrapped.current = true;
  }, [signedIn, events]);

  if (!signedIn) return null;
  const count = unacked.length;

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
