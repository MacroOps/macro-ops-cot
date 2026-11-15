/* ==========================================================================
   TCTM calculation engine
   One module, used by every page. No DOM access. Testable in Node.
   All windows are counted in trading sessions (rows of the sheet that carry
   an S&P 500 close), never in calendar days.
   ========================================================================== */

  // ---------------------------------------------------------------- config
  // Column positions in the "TCTM Signals" tab. Component names are read from
  // the sheet's header row, so renaming a column in the sheet renames it here.
  // To add a component: widen its model's `comps` range (or list columns).
  const CONFIG = {
    sheetName: 'TCTM Signals',
    dateCol: 'A',
    priceCol: 'B',
    sectorCols: ['C', 'M'],
    ltCol: 'S',
    statusCol: 'T',
    holdSessions: 42,          // component & composite signal life, signal day = session 1
    threshold: 40,             // histogram colouring threshold (%)
    extremeLookback: 252,      // sessions searched for the most recent high / low
    trackPre: 130,             // tracking chart: sessions before signal
    trackPost: 260,            // tracking chart: sessions after signal
    // Forward-return horizons, in trading sessions. "weeks" is the default
    // view everywhere; "months" is the longer view behind the Months button.
    horizons: {
      weeks: [
        { label: '1 Wk', h: 5 }, { label: '2 Wk', h: 10 }, { label: '3 Wk', h: 15 }, { label: '4 Wk', h: 21 },
        { label: '5 Wk', h: 26 }, { label: '6 Wk', h: 31 }, { label: '7 Wk', h: 36 }, { label: '8 Wk', h: 42 }
      ],
      months: [
        { label: '1 Mo', h: 21 }, { label: '2 Mo', h: 42 }, { label: '3 Mo', h: 63 }, { label: '4 Mo', h: 84 },
        { label: '5 Mo', h: 105 }, { label: '6 Mo', h: 126 }, { label: '9 Mo', h: 189 }, { label: '12 Mo', h: 252 }
      ]
    },
    sectorHorizons: [
      { label: '1 Month', h: 21 }, { label: '2 Months', h: 42 }, { label: '3 Months', h: 63 },
      { label: '4 Months', h: 84 }, { label: '5 Months', h: 105 }, { label: '6 Months', h: 126 },
      { label: '9 Months', h: 189 }, { label: '1 Year', h: 252 }
    ],
    tradingDaysPerYear: 252,
    // Per-component hold length, by column letter, where a component's life
    // differs from holdSessions. Empty = every component holds 42 sessions.
    holdOverrides: {},
    models: [
      { id: 'riskoff',      name: 'Risk-Off',     dir: -1, readingCol: 'N', signalCol: 'U', comps: ['Z', 'AK'] },
      { id: 'capitulation', name: 'Capitulation', dir: 1,  readingCol: 'O', signalCol: 'V', comps: ['AL', 'AO'] },
      { id: 'bottom',       name: 'Bottom',       dir: 1,  readingCol: 'P', signalCol: 'W', comps: ['AP', 'AY'] },
      { id: 'thrust',       name: 'Thrust',       dir: 1,  readingCol: 'Q', signalCol: 'X', comps: ['AZ', 'BJ'] },
      { id: 'confirmation', name: 'Confirmation', dir: 1,  readingCol: 'R', signalCol: 'Y', comps: ['BK', 'BT'] }
    ]
  };

  // --------------------------------------------------------------- helpers
  function colIndex(letters) {
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  function colLetters(idx) {
    let s = ''; idx += 1;
    while (idx > 0) { const m = (idx - 1) % 26; s = String.fromCharCode(65 + m) + s; idx = Math.floor((idx - 1) / 26); }
    return s;
  }
  function expandCols(spec) {
    // ['Z','AK'] -> every column Z..AK ; ['Z','AB','AD'] (3+) -> as listed
    if (spec.length === 2) {
      const a = colIndex(spec[0]), b = colIndex(spec[1]), out = [];
      for (let i = a; i <= b; i++) out.push(i);
      return out;
    }
    return spec.map(colIndex);
  }
  function num(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    const s = String(v).trim().replace(/[,$\s]/g, '').replace(/%$/, '');
    if (s === '' || s === '-' || /^#/.test(s)) return NaN;
    const x = Number(s);
    return Number.isFinite(x) ? x : NaN;
  }
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v).trim())) {
      // spreadsheet serial (1899-12-30 epoch)
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v)) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    return isNaN(d) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  }
  function median(a) {
    if (!a.length) return null;
    const s = Float64Array.from(a).sort(), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) { if (!a.length) return null; let t = 0; for (const x of a) t += x; return t / a.length; }
  function std(a) {
    if (a.length < 2) return null;
    const m = mean(a); let t = 0; for (const x of a) t += (x - m) * (x - m);
    return Math.sqrt(t / (a.length - 1));
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // ------------------------------------------------------------- dataset
  /**
   * values: array of rows as returned by Sheets (row 0 = header).
   * Returns the aligned dataset: one entry per trading session, ascending.
   */
  function buildDataset(values, cfg) {
    cfg = cfg || CONFIG;
    const warnings = [];
    if (!values || values.length < 2) throw new Error('The sheet returned no data rows.');
    const header = values[0].map(h => (h == null ? '' : String(h).trim()));
    const di = colIndex(cfg.dateCol), pi = colIndex(cfg.priceCol);

    // parse + clean
    const byDate = new Map();
    let dropped = 0, dupes = 0, unsorted = 0, prev = '';
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row || !row.length) continue;
      const d = parseDate(row[di]);
      const p = num(row[pi]);
      if (!d) { if (row.some(c => c !== '' && c != null)) dropped++; continue; }
      if (!(p > 0)) { dropped++; continue; }
      if (d < prev) unsorted++;
      prev = d;
      if (byDate.has(d)) dupes++;
      byDate.set(d, row);        // a repeated date keeps the later row
    }
    if (dropped) warnings.push(`${dropped} row(s) skipped because the date or S&P 500 close was missing or unreadable.`);
    if (dupes) warnings.push(`${dupes} duplicate date(s) found; the lower row in the sheet was used.`);
    if (unsorted) warnings.push(`${unsorted} row(s) were out of date order and have been re-sorted.`);

    const dates = Array.from(byDate.keys()).sort();
    const rows = dates.map(d => byDate.get(d));
    const n = dates.length;
    const col = (idx) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = num(rows[i][idx]); return a; };

    const ds = {
      cfg, header, n, dates,
      spx: col(pi),
      lt: col(colIndex(cfg.ltCol)),
      status: col(colIndex(cfg.statusCol)),
      sectors: [],
      models: [],
      warnings,
      _cache: {}
    };
    // timestamps (UTC ms) for charts
    ds.time = new Float64Array(n);
    for (let i = 0; i < n; i++) ds.time[i] = Date.parse(dates[i] + 'T00:00:00Z');

    // sectors
    const [sa, sb] = cfg.sectorCols.map(colIndex);
    for (let c = sa; c <= sb; c++) {
      const s = col(c);
      let first = -1; for (let i = 0; i < n; i++) if (s[i] > 0) { first = i; break; }
      ds.sectors.push({ name: header[c] || colLetters(c), col: colLetters(c), px: s, first });
    }

    // models & components
    for (const m of cfg.models) {
      const ci = expandCols(m.comps);
      const comps = ci.map((c, k) => {
        const raw = col(c);
        const trig = new Uint8Array(n);
        for (let i = 0; i < n; i++) trig[i] = raw[i] > 0 ? 1 : 0;
        const name = header[c] || `${m.name} component ${k + 1}`;
        if (!header[c]) warnings.push(`Column ${colLetters(c)} (${m.name}) has no header; using a placeholder name.`);
        return { id: `${m.id}-${k + 1}`, idx: k + 1, name, col: colLetters(c), trig };
      });
      ds.models.push({
        id: m.id, name: m.name, dir: m.dir,
        readingCol: m.readingCol, signalCol: m.signalCol,
        sheetReading: col(colIndex(m.readingCol)),
        sheetSignal: (() => { const a = col(colIndex(m.signalCol)); const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = a[i] > 0 ? 1 : 0; return u; })(),
        comps
      });
    }
    return computeAll(ds);
  }

  // ------------------------------------------------- core signal calculations
  /**
   * Hold a trigger series for H sessions. Signal day = session 1, so a trigger
   * at index s keeps the component active on s .. s+H-1 and inactive from s+H.
   * A new trigger while active restarts the window (it is NOT a new episode).
   */
  function holdSeries(trig, H) {
    const n = trig.length, active = new Uint8Array(n), episodes = [], triggers = [];
    let last = -Infinity;
    for (let i = 0; i < n; i++) {
      const wasActive = i - last < H;        // state carried from the prior session's window
      if (trig[i]) {
        triggers.push(i);
        if (!wasActive) episodes.push(i);
        last = i;
      }
      active[i] = i - last < H ? 1 : 0;
    }
    return { active, episodes, triggers };
  }

  function computeAll(ds) {
    const H = ds.cfg.holdSessions, n = ds.n;
    for (const m of ds.models) {
      const N = m.comps.length;
      const calcCount = new Uint8Array(n);
      for (const c of m.comps) {
        c.hold = ds.cfg.holdOverrides[c.col] || H;
        const h = holdSeries(c.trig, c.hold);
        c.active = h.active; c.episodes = h.episodes; c.triggers = h.triggers;
        for (let i = 0; i < n; i++) calcCount[i] += h.active[i];
      }
      // The sheet's composite column is what the pages show. The 42-session
      // count is the cross-check, and the fallback when that cell is blank.
      m.calcCount = calcCount;
      m.calcReading = new Float64Array(n);
      m.reading = new Float64Array(n);
      m.count = new Uint8Array(n);
      m.readingFallbackDays = [];
      for (let i = 0; i < n; i++) {
        m.calcReading[i] = Math.round((calcCount[i] / N) * 10000) / 100;
        const sheet = m.sheetReading[i];
        if (Number.isFinite(sheet)) m.reading[i] = sheet;
        else { m.reading[i] = m.calcReading[i]; m.readingFallbackDays.push(i); }
        m.count[i] = Math.round(m.reading[i] * N / 100);
      }
      // composite signals: taken from the sheet's signal column as given
      m.events = [];
      for (let i = 0; i < n; i++) if (m.sheetSignal[i]) m.events.push(i);
      // composite signal window (status): active H sessions after each signal
      m.window = holdSeries(m.sheetSignal, H).active;
    }
    // long-term trend transitions
    ds.ltEvents = [];
    for (let i = 1; i < n; i++) {
      if ((ds.lt[i] === 1 || ds.lt[i] === -1) && (ds.lt[i - 1] === 1 || ds.lt[i - 1] === -1) && ds.lt[i] !== ds.lt[i - 1]) {
        ds.ltEvents.push(i);
      }
    }
    ds.statusEvents = [];
    for (let i = 1; i < n; i++) {
      if ((ds.status[i] === 1 || ds.status[i] === -1) && (ds.status[i - 1] === 1 || ds.status[i - 1] === -1) && ds.status[i] !== ds.status[i - 1]) ds.statusEvents.push(i);
    }
    ds.integrity = integrity(ds);
    return ds;
  }

  // ---------------------------------------------------------- integrity
  function integrity(ds) {
    const out = { models: [], warnings: ds.warnings.slice() };
    for (const m of ds.models) {
      let compared = 0, mismatched = 0, maxDiff = 0; const examples = [];
      let belowThreshold = 0;
      for (let i = 0; i < ds.n; i++) {
        const s = m.sheetReading[i];
        if (Number.isFinite(s)) {
          compared++;
          const d = Math.abs(s - m.calcReading[i]);
          if (d > 0.011) {
            mismatched++;
            if (d > maxDiff) maxDiff = d;
            if (examples.length < 12) examples.push({ date: ds.dates[i], sheet: s, calc: m.calcReading[i] });
          }
        }
      }
      for (const i of m.events) if (m.calcReading[i] < ds.cfg.threshold) belowThreshold++;
      out.models.push({ id: m.id, name: m.name, components: m.comps.length, compared, mismatched, maxDiff, examples,
        signals: m.events.length, signalsBelowThreshold: belowThreshold,
        componentNames: m.comps.map(c => `${c.col}: ${c.name}`) });
    }
    return out;
  }

  // --------------------------------------------------------- returns
  function fwdReturn(ds, i, h) {
    const j = i + h;
    if (j >= ds.n || i < 0) return null;
    return ds.spx[j] / ds.spx[i] - 1;
  }
  /** Worst / best close-to-close excursion within h sessions; null until complete. */
  function excursion(ds, i, h) {
    if (i + h >= ds.n) return null;
    let lo = 0, hi = 0;
    for (let k = 1; k <= h; k++) {
      const r = ds.spx[i + k] / ds.spx[i] - 1;
      if (r < lo) lo = r; if (r > hi) hi = r;
    }
    return { maxLoss: lo, maxGain: hi };
  }
  function baseline(ds, h) {
    const key = 'base' + h;
    if (ds._cache[key]) return ds._cache[key];
    const a = [];
    for (let i = 0; i + h < ds.n; i++) a.push(ds.spx[i + h] / ds.spx[i] - 1);
    const pos = a.filter(x => x > 0).length;
    return (ds._cache[key] = { n: a.length, mean: mean(a), median: median(a), hit: a.length ? pos / a.length : null, std: std(a) });
  }
  function horizonStats(ds, events, h) {
    const a = [];
    const lo = [], hi = [];
    for (const i of events) {
      const r = fwdReturn(ds, i, h); if (r !== null) a.push(r);
      const x = excursion(ds, i, h); if (x) { lo.push(x.maxLoss); hi.push(x.maxGain); }
    }
    const b = baseline(ds, h);
    const m = mean(a);
    // One-sample t-statistic of the signal returns against the all-days mean:
    // t = (signal mean - baseline mean) / (signal st. dev. / sqrt(n)), n >= 2.
    const sd = std(a);
    const t = (a.length >= 2 && sd > 0) ? (m - b.mean) / (sd / Math.sqrt(a.length)) : null;
    return { h, n: a.length, mean: m, median: median(a), hit: a.length ? a.filter(x => x > 0).length / a.length : null,
      min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null, avgMaxLoss: mean(lo), avgMaxGain: mean(hi), sd, base: b, t };
  }

  /** Annualized return from a set of daily simple returns (geometric). */
  function annualize(dailyLogSum, nDays, tdy) {
    if (!nDays) return null;
    return Math.exp((dailyLogSum / nDays) * tdy) - 1;
  }

  /**
   * Daily-observation method. The state observed at the CLOSE of session t is
   * paired with the S&P 500 return from close t to close t+1, so no future
   * information is used. Returns are compounded and scaled to 252 sessions.
   */
  function conditionalAnnualized(ds, stateFn, keys) {
    const acc = new Map(keys.map(k => [k, { key: k, logSum: 0, n: 0 }]));
    let total = 0;
    for (let t = 0; t + 1 < ds.n; t++) {
      const k = stateFn(t);
      if (k === null || k === undefined) continue;
      const a = acc.get(k); if (!a) continue;
      a.logSum += Math.log(ds.spx[t + 1] / ds.spx[t]); a.n++; total++;
    }
    const tdy = ds.cfg.tradingDaysPerYear;
    return keys.map(k => { const a = acc.get(k); return { key: k, days: a.n, logSum: a.logSum, total, share: total ? a.n / total : null, ann: annualize(a.logSum, a.n, tdy) }; });
  }

  function bucketOf(reading) {
    if (!Number.isFinite(reading)) return null;
    return Math.min(9, Math.floor(reading / 10 + 1e-9));
  }
  const BUCKET_LABELS = ['0–9%', '10–19%', '20–29%', '30–39%', '40–49%', '50–59%', '60–69%', '70–79%', '80–89%', '90–100%'];

  function readingBuckets(ds, model) {
    const key = 'bk_' + model.id;
    if (ds._cache[key]) return ds._cache[key];
    const res = conditionalAnnualized(ds, t => bucketOf(model.reading[t]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    res.forEach(r => { r.label = BUCKET_LABELS[r.key]; });
    return (ds._cache[key] = res);
  }
  /**
   * Threshold levels (TCTM page): annualized S&P 500 return on all days the
   * reading was at or above each level (>= 10%, >= 20% ... >= 90%), plus the
   * days below 10%. Levels overlap by design: a 45% day counts in >=10..>=40.
   */
  const LEVELS = [{ key: 'lt10', label: '< 10%', from: 0, to: 0 }].concat(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ({ key: 'ge' + k * 10, label: '≥ ' + k * 10 + '%', from: k, to: 9, min: k * 10 })));
  function readingLevels(ds, model) {
    const key = 'lv_' + model.id;
    if (ds._cache[key]) return ds._cache[key];
    const bk = readingBuckets(ds, model), tdy = ds.cfg.tradingDaysPerYear;
    const res = LEVELS.map(L => {
      let ls = 0, n = 0; for (let b = L.from; b <= L.to; b++) { ls += bk[b].logSum; n += bk[b].days; }
      const total = bk[0].total;
      return { key: L.key, label: L.label, min: L.min ?? null, days: n, share: total ? n / total : null, ann: annualize(ls, n, tdy) };
    });
    return (ds._cache[key] = res);
  }
  /** The highest level the reading currently satisfies. */
  function levelOf(reading) {
    if (!Number.isFinite(reading)) return null;
    if (reading < 10) return 'lt10';
    return 'ge' + Math.min(9, Math.floor(reading / 10 + 1e-9)) * 10;
  }
  function allDaysAnnualized(ds) {
    if (ds._cache.allAnn) return ds._cache.allAnn;
    return (ds._cache.allAnn = conditionalAnnualized(ds, () => 'all', ['all'])[0]);
  }

  // --------------------------------------------------- extremes
  function distanceFromHigh(ds, i, L) {
    L = L || ds.cfg.extremeLookback;
    let hi = -Infinity, hiIdx = i;
    for (let k = Math.max(0, i - L + 1); k <= i; k++) if (ds.spx[k] >= hi) { hi = ds.spx[k]; hiIdx = k; }
    return { pct: ds.spx[i] / hi - 1, sessions: i - hiIdx, date: ds.dates[hiIdx], level: hi };
  }
  function distanceFromLow(ds, i, L) {
    L = L || ds.cfg.extremeLookback;
    let lo = Infinity, loIdx = i;
    for (let k = Math.max(0, i - L + 1); k <= i; k++) if (ds.spx[k] <= lo) { lo = ds.spx[k]; loIdx = k; }
    return { pct: ds.spx[i] / lo - 1, sessions: i - loIdx, date: ds.dates[loIdx], level: lo };
  }

  // --------------------------------------------------- tracking
  /**
   * Path of the S&P 500 around signal index i, 100 = signal-day close.
   * Offsets beyond the last available session are null (never estimated).
   */
  function trackPath(ds, i, pre, post) {
    pre = pre ?? ds.cfg.trackPre; post = post ?? ds.cfg.trackPost;
    const out = [];
    for (let k = -pre; k <= post; k++) {
      const j = i + k;
      out.push(j >= 0 && j < ds.n ? (ds.spx[j] / ds.spx[i]) * 100 : null);
    }
    return out;
  }
  /**
   * Historical average path for a selected signal at index `sel`.
   * Point-in-time: only signals dated BEFORE `sel` are used, and each one
   * contributes only offsets whose session is on or before `sel`
   * (j + k <= sel), so nothing the selected signal could not have known
   * enters the average. n is reported per offset.
   */
  function trackAverage(ds, events, sel, pre, post) {
    pre = pre ?? ds.cfg.trackPre; post = post ?? ds.cfg.trackPost;
    const len = pre + post + 1, sum = new Float64Array(len), cnt = new Uint32Array(len);
    const used = events.filter(j => j < sel);
    for (const j of used) {
      for (let k = -pre; k <= post; k++) {
        const t = j + k;
        if (t < 0 || t >= ds.n || t > sel) continue;
        sum[k + pre] += (ds.spx[t] / ds.spx[j]) * 100; cnt[k + pre]++;
      }
    }
    const avg = [], n = [];
    for (let x = 0; x < len; x++) { avg.push(cnt[x] ? sum[x] / cnt[x] : null); n.push(cnt[x]); }
    return { avg, n, signals: used.length };
  }

  // --------------------------------------------------- sectors
  function sectorStudy(ds, events) {
    const H = ds.cfg.sectorHorizons;
    const rows = [];
    const spxRow = { name: 'S&P 500', med: [], win: [], n: [] };
    for (const hz of H) {
      const a = []; for (const i of events) { const r = fwdReturn(ds, i, hz.h); if (r !== null) a.push(r); }
      spxRow.med.push(median(a)); spxRow.win.push(a.length ? a.filter(x => x > 0).length / a.length : null); spxRow.n.push(a.length);
    }
    rows.push(spxRow);
    for (const s of ds.sectors) {
      const row = { name: s.name, med: [], win: [], excess: [], n: [] };
      for (const hz of H) {
        const a = [], ex = [];
        for (const i of events) {
          const j = i + hz.h;
          if (j >= ds.n || !(s.px[i] > 0) || !(s.px[j] > 0)) continue;
          const r = s.px[j] / s.px[i] - 1; a.push(r); ex.push(r - (ds.spx[j] / ds.spx[i] - 1));
        }
        row.med.push(median(a)); row.win.push(a.length ? a.filter(x => x > 0).length / a.length : null);
        row.excess.push(median(ex)); row.n.push(a.length);
      }
      rows.push(row);
    }
    return rows;
  }

  // --------------------------------------------------- signal objects
  /**
   * A "signal source" is anything with dated events: a composite, a single
   * component or the long-term trend. Every page renders from these.
   */
  function compositeSource(ds, m) {
    return { key: m.id, kind: 'composite', model: m, label: `${m.name} Composite`, modelName: m.name, dir: m.dir,
      events: m.events, eventDir: () => m.dir, activeAt: (t) => !!m.window[t], series: m.reading };
  }
  function componentSource(ds, m, c) {
    return { key: c.id, kind: 'component', model: m, comp: c, label: c.name, modelName: m.name, dir: m.dir,
      events: c.episodes, eventDir: () => m.dir, activeAt: (t) => !!c.active[t], series: c.active };
  }
  function trendSource(ds) {
    return { key: 'lt', kind: 'trend', label: 'Long-Term Trend', modelName: 'Long-Term Trend', dir: 0,
      events: ds.ltEvents, eventDir: (i) => ds.lt[i], activeAt: (t, i) => ds.lt[t] === ds.lt[i], series: ds.lt };
  }
  function allSources(ds) {
    const out = [];
    for (const m of ds.models) { out.push(compositeSource(ds, m)); for (const c of m.comps) out.push(componentSource(ds, m, c)); }
    out.push(trendSource(ds));
    return out;
  }

  /** Status of a source as of the last session. */
  function sourceStatus(ds, src) {
    const T = ds.n - 1, H = ds.cfg.holdSessions;
    const last = src.events.length ? src.events[src.events.length - 1] : null;
    if (src.kind === 'trend') {
      const v = ds.lt[T];
      return { state: v === 1 ? 'bull' : v === -1 ? 'bear' : 'neutral', lastIdx: last, sessionsSince: last === null ? null : T - last + 1 };
    }
    const live = src.activeAt(T);
    const since = last === null ? null : T - last + 1;
    const recent = since !== null && since <= H;
    return { state: (src.kind === 'composite' ? recent : live) ? (src.dir < 0 ? 'bear' : 'bull') : 'neutral',
      lastIdx: last, sessionsSince: since, active: live, recent };
  }

  /** Every signal whose date falls within the last `win` sessions. */
  function openSignals(ds, win) {
    win = win || ds.cfg.holdSessions;
    const T = ds.n - 1, H = ds.cfg.holdSessions, out = [];
    for (const src of allSources(ds)) {
      for (const i of src.events) {
        const since = T - i + 1;
        if (since > win) continue;
        let active;
        if (src.kind === 'trend') active = ds.lt[T] === ds.lt[i];
        else if (src.kind === 'component') active = !!src.comp.active[T] && lastEpisodeCovers(src, i, T);
        else active = since <= H;
        out.push({ idx: i, date: ds.dates[i], src, since, active, dir: src.eventDir(i),
          weeks: ds.cfg.horizons.weeks.map(hz => fwdReturn(ds, i, hz.h)) });
      }
    }
    out.sort((a, b) => b.idx - a.idx || (a.src.kind === 'composite' ? -1 : 1));
    return out;
  }
  function lastEpisodeCovers(src, i, T) {
    // the episode that began at i is still the live one (no later episode start)
    const eps = src.events; const k = eps.indexOf(i);
    return k === eps.length - 1;
  }

  /** Apply fn to every horizon of every set: {weeks: [...], months: [...]} */
  function mapSets(ds, fn) {
    const out = {};
    for (const k of Object.keys(ds.cfg.horizons)) out[k] = ds.cfg.horizons[k].map(fn);
    return out;
  }
  /** Stats for an arbitrary list of event indices, per horizon set. */
  function eventStats(ds, events) {
    return mapSets(ds, hz => Object.assign(horizonStats(ds, events, hz.h), { label: hz.label }));
  }
  /** Full per-event history table for a source. */
  function eventTable(ds, src) {
    return src.events.map(i => ({
      idx: i, date: ds.dates[i], close: ds.spx[i], dir: src.eventDir(i),
      ret: mapSets(ds, hz => fwdReturn(ds, i, hz.h)),
      exc: mapSets(ds, hz => excursion(ds, i, hz.h)),
      high: distanceFromHigh(ds, i), low: distanceFromLow(ds, i)
    }));
  }
  function sourceStats(ds, src) {
    const key = 'st_' + src.key;
    if (ds._cache[key]) return ds._cache[key];
    const sets = mapSets(ds, hz => Object.assign(horizonStats(ds, src.events, hz.h), { label: hz.label }));
    // annualized during the signal condition vs outside it (daily method)
    let cond;
    if (src.kind === 'trend') {
      cond = conditionalAnnualized(ds, t => ds.lt[t] === 1 ? 'on' : ds.lt[t] === -1 ? 'off' : null, ['on', 'off']);
    } else {
      const act = src.kind === 'composite' ? src.model.window : src.comp.active;
      cond = conditionalAnnualized(ds, t => act[t] ? 'on' : 'off', ['on', 'off']);
    }
    // frequency
    const ev = src.events;
    const gaps = []; for (let k = 1; k < ev.length; k++) gaps.push(ev[k] - ev[k - 1]);
    const years = ds.n / ds.cfg.tradingDaysPerYear;
    const freq = { total: ev.length, perYear: ev.length / years, medianGap: median(gaps), first: ev.length ? ds.dates[ev[0]] : null,
      last: ev.length ? ds.dates[ev[ev.length - 1]] : null, span: [ds.dates[0], ds.dates[ds.n - 1]] };
    return (ds._cache[key] = { sets, cond, freq });
  }

  const api = {
    CONFIG, colIndex, colLetters, expandCols, num, parseDate, mean, median, std, slug,
    buildDataset, holdSeries, computeAll, fwdReturn, excursion, baseline, horizonStats,
    conditionalAnnualized, bucketOf, BUCKET_LABELS, readingBuckets, readingLevels, levelOf, LEVELS, allDaysAnnualized,
    distanceFromHigh, distanceFromLow, trackPath, trackAverage, sectorStudy,
    mapSets, eventStats, compositeSource, componentSource, trendSource, allSources, sourceStatus, openSignals, eventTable, sourceStats
  };

export default api;
export const TCTM = api;
