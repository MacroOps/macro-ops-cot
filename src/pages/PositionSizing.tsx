import { useMemo, useState } from "react";
import { AppShell } from "@/components/hud/AppShell";
import { PageHeader } from "@/components/hud/PageHeader";

type Instrument = {
  symbol: string;
  name: string;
  category: string;
  multiplier: number; // $ per 1.0 price move per contract
  tick?: number;
};

const INSTRUMENTS: Instrument[] = [
  { symbol: "STK", name: "Stock (generic)", category: "Generic", multiplier: 1 },
  // Equities Futures
  { symbol: "ES", name: "E-mini S&P 500", category: "Equities Futures", multiplier: 50 },
  { symbol: "MES", name: "Micro E-mini S&P 500", category: "Equities Futures", multiplier: 5 },
  { symbol: "NQ", name: "E-mini Nasdaq 100", category: "Equities Futures", multiplier: 20 },
  { symbol: "MNQ", name: "Micro E-mini Nasdaq 100", category: "Equities Futures", multiplier: 2 },
  { symbol: "RTY", name: "E-mini Russell 2000", category: "Equities Futures", multiplier: 50 },
  { symbol: "M2K", name: "Micro E-mini Russell 2000", category: "Equities Futures", multiplier: 5 },
  { symbol: "YM", name: "E-mini Dow Jones", category: "Equities Futures", multiplier: 5 },
  { symbol: "MYM", name: "Micro E-mini Dow Jones", category: "Equities Futures", multiplier: 0.5 },
  { symbol: "BTC", name: "Bitcoin Futures", category: "Equities Futures", multiplier: 5 },
  { symbol: "MBT", name: "Micro Bitcoin", category: "Equities Futures", multiplier: 0.1 },
  { symbol: "ETH", name: "Ether Futures", category: "Equities Futures", multiplier: 50 },
  // Metals
  { symbol: "GC", name: "Gold", category: "Metals", multiplier: 100 },
  { symbol: "MGC", name: "Micro Gold", category: "Metals", multiplier: 10 },
  { symbol: "SI", name: "Silver", category: "Metals", multiplier: 5000 },
  { symbol: "SIL", name: "Micro Silver", category: "Metals", multiplier: 1000 },
  { symbol: "HG", name: "Copper", category: "Metals", multiplier: 25000 },
  { symbol: "PL", name: "Platinum", category: "Metals", multiplier: 50 },
  { symbol: "PA", name: "Palladium", category: "Metals", multiplier: 100 },
  // Energy
  { symbol: "CL", name: "WTI Crude Oil", category: "Energy", multiplier: 1000 },
  { symbol: "MCL", name: "Micro WTI Crude", category: "Energy", multiplier: 100 },
  { symbol: "NG", name: "Natural Gas", category: "Energy", multiplier: 10000 },
  { symbol: "MNG", name: "Micro Natural Gas", category: "Energy", multiplier: 1000 },
  { symbol: "RB", name: "RBOB Gasoline", category: "Energy", multiplier: 42000 },
  // Agriculture
  { symbol: "ZC", name: "Corn", category: "Agriculture", multiplier: 50 },
  { symbol: "ZS", name: "Soybeans", category: "Agriculture", multiplier: 50 },
  { symbol: "ZW", name: "Wheat (SRW)", category: "Agriculture", multiplier: 50 },
  { symbol: "ZL", name: "Soybean Oil", category: "Agriculture", multiplier: 600 },
  { symbol: "ZM", name: "Soybean Meal", category: "Agriculture", multiplier: 100 },
  { symbol: "LE", name: "Live Cattle", category: "Agriculture", multiplier: 400 },
  { symbol: "HE", name: "Lean Hogs", category: "Agriculture", multiplier: 400 },
  { symbol: "GF", name: "Feeder Cattle", category: "Agriculture", multiplier: 500 },
  { symbol: "KC", name: "Coffee", category: "Agriculture", multiplier: 375 },
  { symbol: "SB", name: "Sugar", category: "Agriculture", multiplier: 1120 },
  { symbol: "CT", name: "Cotton", category: "Agriculture", multiplier: 500 },
  // Currencies
  { symbol: "6E", name: "Euro FX", category: "Currencies", multiplier: 125000 },
  { symbol: "6J", name: "Japanese Yen", category: "Currencies", multiplier: 12500000 },
  { symbol: "6B", name: "British Pound", category: "Currencies", multiplier: 62500 },
  { symbol: "6C", name: "Canadian Dollar", category: "Currencies", multiplier: 100000 },
  { symbol: "6A", name: "Australian Dollar", category: "Currencies", multiplier: 100000 },
  { symbol: "6S", name: "Swiss Franc", category: "Currencies", multiplier: 125000 },
  { symbol: "6N", name: "New Zealand Dollar", category: "Currencies", multiplier: 100000 },
  // Fixed Income
  { symbol: "ZT", name: "UST 2-Year Note", category: "Fixed Income", multiplier: 2000 },
  { symbol: "ZF", name: "UST 5-Year Note", category: "Fixed Income", multiplier: 1000 },
  { symbol: "ZN", name: "UST 10-Year Note", category: "Fixed Income", multiplier: 1000 },
  { symbol: "ZB", name: "UST Bond", category: "Fixed Income", multiplier: 1000 },
];

const CATEGORIES = [
  "Generic",
  "Equities Futures",
  "Metals",
  "Energy",
  "Agriculture",
  "Currencies",
  "Fixed Income",
];

export default function PositionSizing() {
  const [symbol, setSymbol] = useState("ES");
  const [account, setAccount] = useState(1_000_000);
  const [riskBps, setRiskBps] = useState(50);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState(0);
  const [exit, setExit] = useState(0);
  const [result, setResult] = useState<null | {
    contracts: number;
    dollarRisk: number;
    notional: number;
    perContractRisk: number;
  }>(null);

  const inst = useMemo(() => INSTRUMENTS.find((i) => i.symbol === symbol)!, [symbol]);

  const calc = () => {
    const dollarRisk = account * (riskBps / 10_000);
    const priceMove = Math.abs(entry - exit);
    const perContractRisk = priceMove * inst.multiplier;
    const contracts = perContractRisk > 0 ? Math.floor(dollarRisk / perContractRisk) : 0;
    const notional = contracts * entry * inst.multiplier;
    setResult({ contracts, dollarRisk, notional, perContractRisk });
  };

  return (
    <AppShell title="Tools · Position Sizing">
      <PageHeader
        eyebrow="Tools"
        title="Position Sizing Calculator"
        description="Size trades by risk budget. Supports ~50 futures contracts plus generic stock."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
        <div className="hud-panel p-4 space-y-3">
          <Field label="Asset">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {INSTRUMENTS.filter((i) => i.category === cat).map((i) => (
                    <option key={i.symbol} value={i.symbol}>
                      {i.name} ({i.symbol})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Size ($)">
              <NumberInput value={account} onChange={setAccount} />
            </Field>
            <Field label="Risk (bps)">
              <NumberInput value={riskBps} onChange={setRiskBps} />
            </Field>
          </div>
          <Field label="Direction">
            <div className="flex gap-2">
              {(["long", "short"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm border ${
                    direction === d
                      ? d === "long"
                        ? "bg-pos-long text-background border-pos-long"
                        : "bg-pos-short text-background border-pos-short"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entry">
              <NumberInput value={entry} onChange={setEntry} step="any" />
            </Field>
            <Field label="Exit / Stop">
              <NumberInput value={exit} onChange={setExit} step="any" />
            </Field>
          </div>
          <button
            onClick={calc}
            className="w-full bg-primary text-primary-foreground text-xs uppercase tracking-wider font-semibold px-3 py-2 rounded-sm hover:opacity-90"
          >
            Calculate
          </button>
        </div>

        <div className="hud-panel p-4 space-y-4">
          <div>
            <div className="hud-label">Selected Asset</div>
            <div className="mt-1 text-sm text-surface-foreground">
              {inst.name} <span className="text-muted-foreground">({inst.symbol})</span>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {inst.category} · multiplier {inst.multiplier.toLocaleString()}
            </div>
          </div>

          {result ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Contracts / Shares" value={result.contracts.toLocaleString()} />
              <Stat label="Dollar Risk" value={`$${result.dollarRisk.toLocaleString()}`} />
              <Stat label="Risk / Contract" value={`$${result.perContractRisk.toLocaleString()}`} />
              <Stat label="Notional" value={`$${Math.round(result.notional).toLocaleString()}`} />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Fill the form and click Calculate. Risk = account × (bps / 10,000). Contracts = floor(risk / |entry − exit| × multiplier).
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="hud-label mb-1">{label}</div>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string | number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono tabular-nums"
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-sm p-2">
      <div className="hud-label">{label}</div>
      <div className="mt-1 font-mono tabular-nums text-sm text-surface-foreground">{value}</div>
    </div>
  );
}
