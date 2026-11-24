/* ==========================================================================
   TCTM data layer: reads Dean's public "TCTM Signals" Google Sheet tab as CSV.
   No DOM and no charting libraries, so any page can load the same data the
   TCTM pages use.
   ========================================================================== */
import { TCTM as E } from './engine.js';

const C = E.CONFIG;
const SHEET_ID = '14fsrfe_0YRyhVSL9axk7fhQP6kx81zqLRVXK8mS-QNA';

function looksLikeCsv(text) {
  if (!text || text.trim().length < 8) return false;
  const head = text.slice(0, 800);
  if (/^\s*<(!doctype|html)/i.test(head)) return false;
  if (/accounts\.google\.com|ServiceLogin/i.test(head)) return false;
  return true;
}
async function tryCsv(url) {
  try {
    const r = await fetch(url, { headers: { Accept: 'text/csv,text/plain,*/*' } });
    const text = await r.text();
    if (!r.ok || !looksLikeCsv(text)) return null;
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch (e) { return null; }
}
async function discoverGid() {
  const name = C.sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const urls = [
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview?t=${Date.now()}`,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pubhtml?t=${Date.now()}`
  ];
  const patterns = [
    new RegExp(`"name"\\s*:\\s*"${name}"[\\s\\S]{0,240}?"sheetId"\\s*:\\s*(\\d+)`),
    new RegExp(`"sheetId"\\s*:\\s*(\\d+)[\\s\\S]{0,240}?"name"\\s*:\\s*"${name}"`),
    new RegExp(`gid=(\\d+)[\\s\\S]{0,160}?${name}`),
    new RegExp(`${name}[\\s\\S]{0,160}?gid=(\\d+)`)
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      const html = await r.text();
      if (!r.ok) continue;
      for (const re of patterns) {
        const m = html.match(re);
        if (m) return m[1];
      }
    } catch (e) { /* next */ }
  }
  return null;
}
export async function loadFromSheet(progress) {
  progress(0.15, 'Downloading TCTM Signals…');
  const stamp = Date.now();
  const named = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(C.sheetName)}&headers=0&t=${stamp}`;
  let text = await tryCsv(named);
  if (!text) {
    progress(0.4, 'Finding the TCTM Signals tab…');
    const gid = await discoverGid();
    if (gid != null) {
      const urls = [
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}&headers=0&t=${stamp}`,
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&t=${stamp}`
      ];
      for (const url of urls) {
        text = await tryCsv(url);
        if (text) break;
      }
    }
  }
  if (!text) {
    throw new Error(`The “${C.sheetName}” tab could not be read. Share the Google Sheet so anyone with the link can view it.`);
  }
  progress(0.75, 'Reading the sheet…');
  return { values: parseCSV(text), info: { source: `Google Sheet · ${C.sheetName}` } };
}
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
