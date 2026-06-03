import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";
import { IndicatorCard, CardGrid } from "@/components/hud/IndicatorCard";
import { RangeBar } from "@/components/hud/RangeBar";
import {
  getWorkspace,
  listWorkspaces,
  removeItem,
  deleteWorkspace,
  renameWorkspace,
  createWorkspace,
  type Workspace,
} from "@/lib/workspaces";
import { Plus, Trash2, Pencil, Check } from "lucide-react";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ver, setVer] = useState(0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const h = () => setVer((x) => x + 1);
    window.addEventListener("mhud:workspaces-changed", h);
    return () => window.removeEventListener("mhud:workspaces-changed", h);
  }, []);

  const workspaces = useMemo(() => {
    void ver;
    return listWorkspaces();
  }, [ver]);

  const ws: Workspace | null = useMemo(() => {
    void ver;
    return id ? getWorkspace(id) : null;
  }, [id, ver]);

  useEffect(() => {
    if (ws) setName(ws.name);
  }, [ws]);

  if (!id || !ws) {
    return (
      <AppShell title="Workspaces">
        <PageHeader
          eyebrow="Workspaces"
          title="Saved Workspaces"
          description="Pin any chart from the platform into a custom workspace. Browser-local for now — sync coming."
        />
        <div className="px-3 pb-4">
          <div className="hud-panel">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="text-[11px] uppercase tracking-wider font-semibold">All Workspaces</div>
              <button
                onClick={() => {
                  const w = createWorkspace("New Workspace");
                  navigate(`/workspace/${w.id}`);
                }}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 bg-primary text-primary-foreground rounded-sm"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            </div>
            <div className="divide-y divide-border">
              {workspaces.length === 0 && (
                <div className="px-3 py-6 text-xs text-muted-foreground italic text-center">
                  No workspaces yet. Pin a chart by clicking the pin icon on any indicator.
                </div>
              )}
              {workspaces.map((w) => (
                <Link
                  key={w.id}
                  to={`/workspace/${w.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-surface-2/40"
                >
                  <div>
                    <div className="text-xs font-medium">{w.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {w.items.length} pinned · {new Date(w.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(`Delete "${w.name}"?`)) deleteWorkspace(w.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={ws.name}>
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workspace</span>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface border border-border rounded-sm px-2 py-0.5 text-sm font-semibold focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => {
                  renameWorkspace(ws.id, name.trim() || ws.name);
                  setEditing(false);
                }}
                className="text-primary"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-base font-semibold truncate">{ws.name}</h1>
              <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary">
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">· {ws.items.length} pinned</span>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete workspace "${ws.name}"?`)) {
              deleteWorkspace(ws.id);
              navigate("/workspace");
            }
          }}
          className="text-[10px] uppercase tracking-wider px-2 py-1 border border-border rounded-sm hover:border-destructive hover:text-destructive flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>

      <RangeBar />

      {ws.items.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Empty workspace. Open any indicator across the platform and click the{" "}
          <kbd className="px-1 border border-border rounded-sm font-mono">pin</kbd> icon to add it here.
        </div>
      ) : (
        <CardGrid cols={3}>
          {ws.items.map((it) => (
            <div key={it.id} className="relative group/pin">
              <IndicatorCard
                title={it.title}
                subtitle={it.subtitle}
                seed={it.seed}
                variant={it.variant ?? "area"}
                min={it.min}
                max={it.max}
                drift={it.drift}
                thresholds={{ hi: it.thresholdHi, lo: it.thresholdLo }}
                unit={it.unit}
                indicatorKey={it.indicatorKey}
              />
              <button
                onClick={() => removeItem(ws.id, it.id)}
                className="absolute top-1 right-1 opacity-0 group-hover/pin:opacity-100 h-5 w-5 grid place-items-center rounded-sm bg-background border border-border hover:border-destructive hover:text-destructive transition-opacity"
                title="Unpin"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </CardGrid>
      )}
    </AppShell>
  );
}
