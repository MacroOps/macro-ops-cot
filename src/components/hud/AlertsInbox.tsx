// Sidebar bell with unacknowledged alert events. Polls every 30s; surfaces
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
      className="relative p-1.5 rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
      aria-label={`Alerts (${count})`}
      title="Alerts"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
