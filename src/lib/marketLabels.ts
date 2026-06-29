// Symbol → friendly name for quick UI labeling.
// Server-side resolution happens in the copilot-agent edge function via DB.
export const MARKET_LABELS: Record<string, string> = {
  "6A": "Australian Dollar", "6B": "British Pound", "6C": "Canadian Dollar",
  "6E": "Euro FX", "6J": "Japanese Yen", "6L": "Brazilian Real",
  "6M": "Mexican Peso", "6N": "New Zealand Dollar", "6S": "Swiss Franc",
  "6Z": "South African Rand", DXY: "Dollar Index", RP: "EUR/GBP", RY: "EUR/JPY",
  ES: "S&P 500 E-mini", NQ: "Nasdaq 100 E-mini", YM: "Dow E-mini",
  RTY: "Russell 2000", MME: "MSCI EM E-mini", NKD: "Nikkei 225",
  VX: "VIX Futures", VSTOXX: "VSTOXX",
  GC: "Gold", SI: "Silver", HG: "Copper", PL: "Platinum", PA: "Palladium", ALI: "Aluminum",
  CL: "WTI Crude", BRN: "Brent Crude", NG: "Natural Gas", HO: "Heating Oil", RB: "RBOB Gasoline",
  ZC: "Corn", ZW: "Wheat", KE: "KC Wheat", MW: "Spring Wheat", ZS: "Soybeans",
  ZM: "Soybean Meal", ZL: "Soybean Oil", ZO: "Oats", ZR: "Rough Rice",
  SB: "Sugar", CC: "Cocoa", KC: "Coffee", CT: "Cotton", OJ: "Orange Juice", LBR: "Lumber",
  LE: "Live Cattle", GF: "Feeder Cattle", HE: "Lean Hogs",
  ZT: "2Y T-Note", ZF: "5Y T-Note", ZN: "10Y T-Note", TN: "Ultra 10Y", ZB: "30Y T-Bond",
  UB: "Ultra T-Bond", ZQ: "Fed Funds", SR1: "SOFR 1M", SR3: "SOFR 3M", ESR: "Euro Short-Term Rate",
  BTC: "Bitcoin", MBT: "Micro Bitcoin", ETH: "Ether", SOL: "Solana", XRP: "XRP",
  FDAX: "DAX", FESX: "Euro Stoxx 50", FSMI: "SMI", FSTX: "Broad EU Indexes",
  FESB: "Euro Stoxx Sector", FXXP: "Stoxx 600 Sector",
};
