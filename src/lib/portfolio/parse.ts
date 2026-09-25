import type {
  EquityGroups,
  PortfolioSnapshot,
  PortfolioSummary,
  PublicOption,
  PublicPosition,
  StatsPoint,
} from "./types";

export function parseCSV(text: string): string[][] {
  return text.split("\n").map((line) => {
    const row: string[] = [];
    let q = false;
    let cell = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = !q;
      } else if (c === "," && !q) {
        row.push(cell.trim());
        cell = "";
      } else cell += c;
    }
    row.push(cell.trim());
    return row;
  });
}

function num(v: unknown): number | null {
  if (!v || String(v).startsWith("#")) return null;
  const n = parseFloat(String(v).replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

export function extractPortfolio(rows: string[][]): PortfolioSnapshot {
  const asOfIdx = rows.findIndex((r) => /^Holdings As Of$/i.test((r?.[0] || "").trim()));
  const asOf = asOfIdx >= 0 ? String(rows[asOfIdx][1] || "").trim() : "";

  const valAt = (re: RegExp, lcol: number, vcol: number) => {
    const i = rows.findIndex((r) => re.test((r?.[lcol] || "").trim()));
    return i >= 0 ? num(rows[i][vcol]) : null;
  };
  const valRight = (re: RegExp) => {
    for (const row of rows) {
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (!re.test(String(row[c] || "").trim())) continue;
        for (let k = c + 1; k < row.length; k++) {
          const v = num(row[k]);
          if (v !== null) return v;
        }
      }
    }
    return null;
  };

  const summary: PortfolioSummary = {
    ytd: valAt(/YTD Return$/i, 0, 1),
    notional: valAt(/^Total Notional Exposure$/i, 0, 1),
    equity: valAt(/^Equity Exposure$/i, 0, 1),
    futures: valAt(/^Futures\/Forex Exposure$/i, 0, 1),
    cash: valAt(/^Current Cash Value/i, 0, 1),
    capitalRisk: valAt(/^Total Capital At-Risk/i, 0, 1),
    ddRisk: valAt(/^Total Drawdown Risk/i, 0, 1),
    r12m: valAt(/^Rolling 12M Return$/i, 2, 4) ?? valRight(/^Rolling 12M Return$/i),
    ttm3yr: valAt(/^TTM 3YR/i, 2, 4) ?? valRight(/^TTM 3YR/i),
    cagr3yr: valAt(/^Rolling 3YR CAGR$/i, 2, 4) ?? valRight(/^Rolling 3YR CAGR$/i),
  };

  const alloc: Array<{ name: string; pct: number }> = [];
  const thIdx = rows.findIndex((r) => /^Thematic Allocation$/i.test((r?.[6] || "").trim()));
  if (thIdx >= 0) {
    for (let r = thIdx + 1; r < Math.min(thIdx + 12, rows.length); r++) {
      const name = (rows[r]?.[6] || "").trim();
      if (!name) break;
      const pct = num(rows[r]?.[7]);
      if (pct !== null) alloc.push({ name, pct });
    }
  }

  const findRow = (label: string) =>
    rows.findIndex((r) => r[0]?.trim().toLowerCase() === label.toLowerCase());

  function parsePos(row: string[]): PublicPosition | null {
    const name = row[0]?.trim() || "";
    const ticker = row[1]?.trim() || "";
    if (!ticker || !name) return null;
    if (/^(note:|futures,|^equities$|^options$|aerospace|metals & mining|oil & gas|^other$|^crypto$)/i.test(name)) {
      return null;
    }
    const qty = row[2];
    const m = name.match(/\((\d+)(?:st|nd|rd|th) Leg\)/i);
    return {
      name: name.replace(/\s*\(\d+(?:st|nd|rd|th) Leg\)/i, "").replace(/\s*\(Futures\)/i, ""),
      ticker,
      notional: num(row[4]),
      isShort:
        /short/i.test(String(qty || "")) ||
        (qty !== "" && qty !== null && parseFloat(String(qty).replace(/,/g, "")) < 0),
      legNum: m ? parseInt(m[1], 10) : null,
    };
  }

  const futuresHeaderRow = findRow("Futures, Bonds & FX");
  const equitiesHeaderRow = findRow("Equities");
  const futures: PublicPosition[] = [];
  if (futuresHeaderRow >= 0 && equitiesHeaderRow > futuresHeaderRow) {
    for (let r = futuresHeaderRow + 2; r < equitiesHeaderRow; r++) {
      const px = parsePos(rows[r] || []);
      if (px?.ticker) futures.push(px);
    }
  }

  const optionsHeaderRow = findRow("Options");
  const eq: EquityGroups = {
    aerospace: [],
    metals: [],
    oil: [],
    other: [],
    crypto: [],
    techAI: [],
    agriculture: [],
    healthcare: [],
  };
  let grp: keyof EquityGroups | null = null;
  if (equitiesHeaderRow >= 0) {
    const eqEnd = optionsHeaderRow > equitiesHeaderRow ? optionsHeaderRow : rows.length;
    for (let r = equitiesHeaderRow + 1; r < eqEnd; r++) {
      const row = rows[r] || [];
      const l = (row[0] || "").trim();
      if (!l) continue;
      const isHeader = !(row[1] || "").trim();
      if (isHeader) {
        if (/^Aerospace/i.test(l)) grp = "aerospace";
        else if (/^Metals/i.test(l)) grp = "metals";
        else if (/^Oil & Gas/i.test(l)) grp = "oil";
        else if (/^Other$/i.test(l)) grp = "other";
        else if (/^Crypto$/i.test(l)) grp = "crypto";
        else if (/^Tech/i.test(l)) grp = "techAI";
        else if (/^Agri/i.test(l)) grp = "agriculture";
        else if (/^Health/i.test(l)) grp = "healthcare";
        continue;
      }
      const px = parsePos(row);
      if (px?.ticker) eq[grp || "other"].push(px);
    }
  }

  const opts: PublicOption[] = [];
  if (optionsHeaderRow >= 0) {
    const cashRow = findRow("Cash Net Interest");
    const optsEnd = cashRow > optionsHeaderRow ? cashRow : rows.length;
    for (let r = optionsHeaderRow + 2; r < optsEnd; r++) {
      const row = rows[r];
      if (!row || !row[1]?.trim()) continue;
      const isNet = !row[0]?.trim() && row[3]?.toLowerCase() === "net";
      opts.push({
        name: row[0]?.trim() || "Net",
        ticker: row[1]?.trim(),
        notional: num(row[4]),
        isCall: /call/i.test(row[0] || ""),
        isPut: /put/i.test(row[0] || ""),
        isNet,
      });
    }
  }

  return { summary, alloc, futures, eq, opts, asOf };
}

export function parseStatsCSV(text: string): StatsPoint[] {
  const rows = parseCSV(text);
  const data: Array<{ iso: string; ytd: number }> = [];
  const fallbackYear = new Date().getUTCFullYear();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.[0] || !row[1]) continue;
    const rawDate = row[0].trim();
    const val = parseFloat(row[1].trim().replace("%", ""));
    if (Number.isNaN(val)) continue;
    const m1 = rawDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m1) continue;
    const yr = m1[3]
      ? m1[3].length === 2
        ? 2000 + parseInt(m1[3], 10)
        : parseInt(m1[3], 10)
      : fallbackYear;
    const mo = parseInt(m1[1], 10);
    const d = parseInt(m1[2], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const iso = `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    data.push({ iso, ytd: val });
  }
  const seen: Record<string, StatsPoint> = {};
  for (const d of data) seen[d.iso] = { date: d.iso, ytd: d.ytd };
  return Object.values(seen).sort((a, b) => a.date.localeCompare(b.date));
}

export const MO_PORTFOLIO_SHEET = "1MfifAOtyX3PVT7-Ilat4cFVQnmfYVtIfE1_bdKc3BZk";
export const MO_GID_PUBLIC = "555635575";
export const MO_GID_STATS = "1741167923";

export async function fetchSheetCsv(sheet: string, gid: string): Promise<string> {
  const stamp = Date.now();
  const urls = [
    `https://docs.google.com/spreadsheets/d/${sheet}/gviz/tq?tqx=out:csv&gid=${gid}&headers=0&t=${stamp}`,
    `https://docs.google.com/spreadsheets/d/${sheet}/export?format=csv&gid=${gid}&t=${stamp}`,
  ];
  let last = "";
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: "text/csv,text/plain,*/*" } });
      const text = await r.text();
      last = text.slice(0, 80);
      if (!r.ok) continue;
      if (/^\s*<(!doctype|html)/i.test(text)) continue;
      if (text.trim().length < 8) continue;
      return text;
    } catch {
      /* next */
    }
  }
  throw new Error(`Could not load sheet gid=${gid}${last ? ` (${last})` : ""}`);
}

export async function loadPublicPortfolioSnapshot() {
  const [portCsv, statsCsv] = await Promise.all([
    fetchSheetCsv(MO_PORTFOLIO_SHEET, MO_GID_PUBLIC),
    fetchSheetCsv(MO_PORTFOLIO_SHEET, MO_GID_STATS).catch(() => ""),
  ]);
  return {
    portfolio: extractPortfolio(parseCSV(portCsv)),
    stats: statsCsv ? parseStatsCSV(statsCsv) : [],
    fetchedAt: new Date().toISOString(),
    holdingsCadence: "weekly",
    statsCadence: "daily",
  };
}
