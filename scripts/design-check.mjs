#!/usr/bin/env node
// Design consistency check for Terminus.
// Fails (exit 1) when a rule is broken outside the explicit allowlist below.
// Allowlisted hits are printed with their reason so they stay visible.
// Rules and exceptions are documented in AGENTS.md ("Design system exceptions").

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "src");

// Shadcn primitives are generic building blocks; they are not checked.
const SKIP_DIRS = [path.join("components", "ui")];

const RULES = [
  {
    id: "hex",
    message: "hex color written by hand; use a token from src/index.css",
    exts: [".ts", ".tsx"],
    pattern: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/,
    allow: {
      "pages/AssetDetail.tsx": "pending: asset positioning ramp (audit 3.4, decision 1)",
      "pages/SectorAggregates.tsx": "pending: sector hex bands (audit 3.4, decision 1)",
      "lib/exportChart.ts": "chart export colors",
    },
  },
  {
    id: "rounded-full",
    message: "round corners outside avatars, counters and status dots",
    exts: [".ts", ".tsx"],
    pattern: /\brounded-full\b/,
    allow: {
      "components/hud/AppSidebar.tsx": "avatar",
      "components/hud/AlertsInbox.tsx": "counter",
      "pages/Alerts.tsx": "counter",
      "components/hud/MockBadge.tsx": "status dot",
      "components/copilot/CopilotDrawer.tsx": "copilot launcher stays round (decision 9)",
    },
  },
  {
    id: "font-serif",
    message: "serif outside page titles and the wordmark",
    exts: [".ts", ".tsx"],
    pattern: /\bfont-serif\b/,
    allow: {
      "components/hud/PageHeader.tsx": "page title",
      "components/hud/PaywallGate.tsx": "page title",
      "components/hud/AppSidebar.tsx": "wordmark",
      "pages/NotFound.tsx": "page title",
    },
  },
  {
    id: "serif-css",
    message: "serif font outside page titles (CSS)",
    exts: [".css"],
    pattern: /Newsreader/,
    allow: {
      "index.css": "font import and token definition",
    },
  },
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(SRC, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep))) continue;
      walk(full, out);
    } else {
      out.push({ full, rel: rel.split(path.sep).join("/") });
    }
  }
  return out;
}

const files = walk(SRC);
const violations = [];
const allowed = [];

for (const rule of RULES) {
  for (const f of files) {
    if (!rule.exts.includes(path.extname(f.rel))) continue;
    const lines = fs.readFileSync(f.full, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!rule.pattern.test(line)) return;
      const reason = rule.allow[f.rel];
      const hit = { rule: rule.id, file: f.rel, line: i + 1, text: line.trim().slice(0, 140) };
      if (reason) allowed.push({ ...hit, reason });
      else violations.push({ ...hit, message: rule.message });
    });
  }
}

// One line per (rule, file) so the allowlist stays readable.
const grouped = new Map();
for (const a of allowed) {
  const key = `${a.rule} ${a.file}`;
  if (!grouped.has(key)) grouped.set(key, { ...a, count: 0 });
  grouped.get(key).count++;
}
for (const g of grouped.values()) {
  console.log(`allowed  [${g.rule}] src/${g.file} (${g.count}) — ${g.reason}`);
}
console.log("");

if (violations.length === 0) {
  console.log(`design-check: OK (${allowed.length} allowlisted hits)`);
  process.exit(0);
}

for (const v of violations) {
  console.log(`FAIL     [${v.rule}] src/${v.file}:${v.line} — ${v.message}`);
  console.log(`         ${v.text}`);
}
console.log(`\ndesign-check: ${violations.length} violation(s), ${allowed.length} allowlisted hit(s)`);
process.exit(1);
