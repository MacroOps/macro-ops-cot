// Alert builder + inbox.
import { useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAlerts, type AlertRule } from "@/hooks/useAlerts";
import { REGISTRY } from "@/lib/backtest/registry";
import { toast } from "sonner";
import { Bell, Check, Play, Trash2 } from "lucide-react";

const OPS: Array<{ value: AlertRule["operator"]; label: string }> = [
  { value: "gte", label: "≥ (greater than or equal)" },
  { value: "lte", label: "≤ (less than or equal)" },
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
];

export default function Alerts() {
  const { alerts, events, signedIn, create, setActive, remove, ack, ackAll, evaluate } = useAlerts();

  const [name, setName] = useState("");
  const [indicatorKey, setIndicatorKey] = useState(REGISTRY[0].key);
  const [operator, setOperator] = useState<AlertRule["operator"]>("gte");
  const [threshold, setThreshold] = useState<string>("75");
  const [cooldown, setCooldown] = useState("360");

  const onCreate = async () => {
    if (!signedIn) return toast.error("Log in to create alerts");
    if (!name.trim()) return toast.error("Name required");
    const th = parseFloat(threshold);
    if (Number.isNaN(th)) return toast.error("Invalid threshold");
    try {
      await create.mutateAsync({
        name: name.trim(),
        indicatorKey,
        operator,
        threshold: th,
        cooldownMinutes: parseInt(cooldown) || 360,
      });
      toast.success("Alert created");
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create alert");
    }
  };

  const runNow = async () => {
    if (!signedIn) return toast.error("Log in to run alerts");
    try {
      const data = await evaluate.mutateAsync();
      toast.success(`Evaluated ${data.evaluated ?? 0} alerts, ${data.fired ?? 0} fired`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Evaluate failed");
    }
  };

  const indicator = REGISTRY.find((r) => r.key === indicatorKey);
  const unacked = events.filter((e) => !e.acknowledged).length;

  return (
    <AppShell title="Alerts">
      <PageHeader
        eyebrow="Intelligence"
        title="Alert Engine"
        description="Get notified when indicators cross thresholds. Evaluated every 15 minutes; firing respects per-alert cooldowns."
      />

      {!signedIn ? (
        <div className="px-3 pb-4 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
          Log in to create and view your alerts.
        </div>
      ) : (
      <div className="px-3 pb-4">
        <Tabs defaultValue="inbox" className="w-full">
          <TabsList>
            <TabsTrigger value="inbox">
              Inbox
              {unacked > 0 && (
                <span className="ml-2 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold tabular-nums">
                  {unacked}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules">Rules ({alerts.length})</TabsTrigger>
            <TabsTrigger value="new">+ New alert</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-3">
            <div className="hud-panel">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider font-semibold">Recent fires</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={runNow} disabled={evaluate.isPending}>
                    <Play className="h-3 w-3 mr-1" /> Run now
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => ackAll.mutate()} disabled={ackAll.isPending}>
                    <Check className="h-3 w-3 mr-1" /> Mark all read
                  </Button>
                </div>
              </div>
              {events.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  No alerts have fired yet. Create rules in the New alert tab.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {events.map((e) => {
                    const a = alerts.find((x) => x.id === e.alert_id);
                    return (
                      <div key={e.id} className={`px-3 py-2 flex items-center gap-3 ${e.acknowledged ? "opacity-50" : ""}`}>
                        <div className="flex-1">
                          <div className="text-xs font-medium">{a?.name ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{e.message}</div>
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                          {new Date(e.fired_at).toLocaleString()}
                        </div>
                        {!e.acknowledged && (
                          <Button size="sm" variant="ghost" onClick={() => ack.mutate(e.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-3">
            <div className="hud-panel">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No alert rules yet.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-2 pl-3 font-medium">Active</th>
                      <th className="text-left py-2 font-medium">Name</th>
                      <th className="text-left py-2 font-medium">Condition</th>
                      <th className="text-right py-2 font-medium">Last value</th>
                      <th className="text-right py-2 font-medium">Last fired</th>
                      <th className="text-right py-2 pr-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => {
                      const ind = REGISTRY.find((r) => r.key === a.indicator_key);
                      return (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="py-2 pl-3">
                            <Switch
                              checked={a.active}
                              onCheckedChange={(on) => setActive.mutate({ id: a.id, active: on })}
                            />
                          </td>
                          <td className="py-2 font-medium">{a.name}</td>
                          <td className="py-2 font-mono text-[11px] text-muted-foreground">
                            {ind?.label ?? a.indicator_key} {a.operator.replace("_", " ")} {a.threshold}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums">{a.last_value ?? "—"}</td>
                          <td className="py-2 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                            {a.last_fired_at ? new Date(a.last_fired_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-3">
            <div className="hud-panel p-4 space-y-3 max-w-2xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trend Fragility extreme" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Indicator</label>
                  <Select value={indicatorKey} onValueChange={setIndicatorKey}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REGISTRY.map((r) => (
                        <SelectItem key={r.key} value={r.key}>{r.label} <span className="text-muted-foreground">· {r.category}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Operator</label>
                  <Select value={operator} onValueChange={(v) => setOperator(v as AlertRule["operator"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Threshold {indicator && <span className="font-mono">[{indicator.min}, {indicator.max}]</span>}
                  </label>
                  <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cooldown (minutes)</label>
                  <Input type="number" value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
                </div>
              </div>
              <Button onClick={onCreate} disabled={create.isPending}>Create alert</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      )}
    </AppShell>
  );
}
