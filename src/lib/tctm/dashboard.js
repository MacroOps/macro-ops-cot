/* ==========================================================================
   TCTM application: public Google Sheet CSV + presentation.
   All numbers come from the calculation engine.
   ========================================================================== */
import * as echarts from 'echarts';
import html2canvas from 'html2canvas';
import { TCTM as E } from './engine.js';
import { TCTM_GLOSSARY } from './glossary.js';

  const C = E.CONFIG;
  const SHEET_ID = '14fsrfe_0YRyhVSL9axk7fhQP6kx81zqLRVXK8mS-QNA';
  const MIN_DAYS = 21;   // bands with fewer days show no annualized figure
  const CHART_FONT = '"Hanken Grotesk", system-ui, sans-serif';
  const COL = { bull: '#0a7a45', bear: '#d64545', gray: '#8a847a', price: '#181818', grid: '#e4dfd4',
    muted: '#55514b', fg: '#181818', amber: '#c4841d', cyan: '#9c6f4c', bullFg: '#0a7a45', bearFg: '#d64545', panel: '#f5f4f0',
    split: 'rgba(223,228,236,.9)', accent: '#be9173', tipBg: '#f5f4f0', tipBorder: '#e4dfd4', ink: '#181818',
    slider: 'rgba(228,223,212,.55)', fill: 'rgba(190,145,115,.18)' };
  let themeDark = false;
  let themeObs = null;
  function hslToken(name, alpha) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw) return alpha == null ? '#888888' : 'rgba(136,136,136,' + alpha + ')';
    return alpha == null ? 'hsl(' + raw + ')' : 'hsl(' + raw + ' / ' + alpha + ')';
  }
  function readTheme() {
    themeDark = document.documentElement.classList.contains('dark');
    COL.bull = COL.bullFg = hslToken('--success');
    COL.bear = COL.bearFg = hslToken('--destructive');
    COL.gray = hslToken('--chart-band-mid');
    COL.price = COL.fg = COL.ink = hslToken('--chart-ink');
    COL.grid = COL.split = COL.tipBorder = hslToken('--chart-grid');
    COL.muted = hslToken('--chart-axis');
    COL.amber = hslToken('--warning');
    COL.cyan = hslToken('--info');
    COL.panel = COL.tipBg = hslToken('--chart-surface');
    COL.accent = hslToken('--accent');
    COL.slider = hslToken('--chart-grid', 0.55);
    COL.fill = hslToken('--accent', 0.18);
  }
  function onThemeClass() {
    const dark = document.documentElement.classList.contains('dark');
    if (dark === themeDark) return;
    readTheme();
    if (DS && scope) route({ keepScroll: true });
  }

  let DS = null;            // dataset from the engine
  let HSET = 'weeks';       // forward-return horizon set shown in statistics: 'weeks' | 'months'
  let LOADINFO = {};        // source, time, rows
  let charts = [];          // live echarts instances on the current page
  let observers = [];
  let scope = null;
  let req = 0;

  // ---------------------------------------------------------------- utils
  const $ = (s, el) => (el || scope).querySelector(s);
  function scrollParent() {
    return (scope && scope.closest('main')) || document.scrollingElement || document.documentElement;
  }
  function intoView(el, opts) {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView(opts);
  }
  function scrollTo(opts) {
    const el = scrollParent();
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo(opts);
    else el.scrollTop = typeof opts === 'object' && opts ? (opts.top || 0) : 0;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '—';
  function pct(x, d = 1, sign = true) {
    if (x === null || x === undefined || !Number.isFinite(x)) return '<span class="na">N/A</span>';
    const v = x * 100, s = (sign && v > 0 ? '+' : '') + v.toFixed(d) + '%';
    return `<span class="${v > 0.0000001 ? 'pos' : v < -0.0000001 ? 'neg' : ''}">${s}</span>`;
  }
  const pctPlain = (x, d = 1) => (x === null || !Number.isFinite(x)) ? 'N/A' : (x * 100).toFixed(d) + '%';
  const fnum = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x)) ? '—' : x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const badge = (state) => `<span class="badge b-${state}">${state === 'bull' ? 'Bullish' : state === 'bear' ? 'Bearish' : 'Neutral'}</span>`;
  const stateColor = (s) => s === 'bull' ? COL.bull : s === 'bear' ? COL.bear : COL.gray;

  // ------------------------------------------------------------ data layer
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
  async function loadFromSheet(progress) {
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
  function parseCSV(text) {
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

  // ------------------------------------------------------------- charts
  function disposeAll() {
    charts.forEach(c => { try { c.dispose(); } catch (e) {} });
    charts = [];
    observers.forEach(o => o.disconnect()); observers = [];
  }
  function onResize() { charts.forEach(c => c.resize()); }
  function lazy(el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const o = new IntersectionObserver((ents) => { if (ents.some(e => e.isIntersecting)) { o.disconnect(); fn(); } }, { rootMargin: '300px' });
    o.observe(el); observers.push(o);
  }
  function axisDate(v) { return v ? v.slice(0, 4) === '' ? v : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+v.slice(5, 7) - 1]} '${v.slice(2, 4)}` : ''; }
  // Headroom so signal arrows and their labels stay inside the price panel
  // (labels sit below up-arrows and above down-arrows).
  const PRICE_LIN = { min: (v) => v.min - (v.max - v.min) * 0.26, max: (v) => v.max + (v.max - v.min) * 0.10 };
  const PRICE_LOG = { min: (v) => v.min / Math.pow(v.max / v.min, 0.26), max: (v) => v.max * Math.pow(v.max / v.min, 0.10) };
  // Signal arrow: straight shaft with an open chevron head (points up; rotated 180° for down).
  const ARROW = 'path://M5,0 L10,5 L8,7 L6.4,5.4 L6.4,14 L3.6,14 L3.6,5.4 L2,7 L0,5 Z';
  const ARROW_GAP = 5;   // pixels between the arrow tip and the closing price
  const rangeYears = { '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, '25Y': 25, '50Y': 50, 'All': 0 };

  /**
   * Stacked, synchronized panels on one shared session axis.
   * panels: {kind:'price'|'hist'|'binary'|'trend', title, h, data, color, markers, colorByTrend}
   */
  function stackChart(host, panels, o = {}) {
    const n = DS.n, dates = DS.dates;
    host.innerHTML = `<div class="ctrl" style="margin-bottom:6px">${Object.keys(rangeYears).map(k => `<button data-r="${k}" class="${k === (o.range || '5Y') ? 'on' : ''}">${k}</button>`).join('')}
      <span class="sep"></span><button data-log="1" class="${o.log ? 'on' : ''}">Log scale</button><span class="spacer"></span><button class="xjpg" title="Download this chart as an 800×600 JPG">Export JPG</button></div><div class="chart"></div>`;
    host.setAttribute('data-xroot', '');
    const el = host.querySelector('.chart');
    const gap = 24, top0 = 26, slider = 34;
    let y = top0;
    const grid = [], xAxis = [], yAxis = [], series = [], title = [];
    const tips = [];
    const labelled = [];          // marker series whose name labels hide when zoomed far out
    // signal names show while the visible range is 25 years or less (arrows always show)
    const LABEL_SPAN = 25 * 252 + 10;
    panels.forEach((p, k) => {
      grid.push({ left: 10, right: 70, top: y, height: p.h });
      title.push({ text: p.title, left: 10, top: y - 20, textStyle: { fontSize: 11.5, fontWeight: 500, color: COL.muted, fontFamily: CHART_FONT } });
      xAxis.push({ type: 'category', gridIndex: k, data: dates, boundaryGap: p.kind !== 'price',
        axisLine: { lineStyle: { color: COL.grid } }, axisTick: { show: false },
        axisLabel: { show: k === panels.length - 1, color: COL.muted, formatter: axisDate, hideOverlap: true },
        axisPointer: { label: { show: k === panels.length - 1, backgroundColor: COL.ink, formatter: (pp) => fmtDate(pp.value) } } });
      const yBase = { gridIndex: k, position: 'right', splitLine: { lineStyle: { color: COL.split } },
        axisLabel: { color: COL.muted, fontSize: 10 }, axisPointer: { label: { show: false } } };
      if (p.kind === 'price') {
        yAxis.push(Object.assign({}, yBase, o.log ? Object.assign({ type: 'log', logBase: 10 }, PRICE_LOG) : Object.assign({ type: 'value', scale: true }, PRICE_LIN), { axisLabel: { color: COL.muted, fontSize: 10, showMinLabel: false, showMaxLabel: false, formatter: v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : v.toFixed(v < 10 ? 1 : 0) } }));
        const px = Array.from(DS.spx);
        if (p.colorByTrend) {
          const bull = new Array(n).fill(null), bear = new Array(n).fill(null);
          for (let i = 0; i < n; i++) {
            if (DS.lt[i] === 1) bull[i] = px[i]; else if (DS.lt[i] === -1) bear[i] = px[i];
            if (i > 0 && DS.lt[i] !== DS.lt[i - 1]) { bull[i - 1] = bull[i - 1] ?? (DS.lt[i] === 1 ? px[i - 1] : null); bear[i - 1] = bear[i - 1] ?? (DS.lt[i] === -1 ? px[i - 1] : null); }
          }
          series.push({ name: 'S&P 500 (LT bullish)', type: 'line', xAxisIndex: k, yAxisIndex: k, data: bull, showSymbol: false, lineStyle: { width: 1.3, color: COL.bull }, itemStyle: { color: COL.bull }, connectNulls: false, z: 2 });
          series.push({ name: 'S&P 500 (LT bearish)', type: 'line', xAxisIndex: k, yAxisIndex: k, data: bear, showSymbol: false, lineStyle: { width: 1.3, color: COL.bear }, itemStyle: { color: COL.bear }, connectNulls: false, z: 2 });
        } else {
          series.push({ name: 'S&P 500', type: 'line', xAxisIndex: k, yAxisIndex: k, data: px, showSymbol: false, sampling: 'lttb', lineStyle: { width: 1.2, color: COL.price }, itemStyle: { color: COL.price }, z: 2 });
        }
        for (const mk of (p.markers || [])) {
          const up = mk.dir > 0;
          if (mk.label) labelled.push('mk' + series.length);
          series.push({ id: 'mk' + series.length, name: mk.name, type: 'scatter', xAxisIndex: k, yAxisIndex: k, z: 5,
            symbol: ARROW, symbolSize: [15, 21], symbolRotate: up ? 0 : 180, symbolKeepAspect: true,
            symbolOffset: [0, up ? 21 / 2 + ARROW_GAP : -(21 / 2 + ARROW_GAP)],
            itemStyle: { color: up ? COL.bull : COL.bear },
            label: mk.label ? { show: true, formatter: mk.label, position: up ? 'bottom' : 'top', color: COL.fg, fontSize: 10, fontWeight: 600, distance: 4 } : { show: false },
            data: mk.idx.map(i => ({ value: [i, DS.spx[i]], idx: i })),
            tooltip: { show: false } });
        }
        tips.push(i => `<div>S&P 500 <b style="float:right;margin-left:16px">${fnum(DS.spx[i])}</b></div>`);
      } else if (p.kind === 'hist') {
        yAxis.push(Object.assign({}, yBase, { type: 'value', min: 0, max: 100, interval: 50 }));
        const on = new Array(n).fill(null), off = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { const v = p.data[i]; if (!(v > 0)) continue; if (v >= C.threshold) on[i] = v; else off[i] = v; }
        series.push({ name: p.title + ' ≥40', type: 'bar', xAxisIndex: k, yAxisIndex: k, data: on, large: true, barCategoryGap: '0%', barGap: '-100%', itemStyle: { color: p.color } });
        series.push({ name: p.title + ' <40', type: 'bar', xAxisIndex: k, yAxisIndex: k, data: off, large: true, barCategoryGap: '0%', barGap: '-100%', itemStyle: { color: COL.gray } });
        tips.push(i => `<div>${esc(p.short || p.title)} <b style="float:right;margin-left:16px">${fnum(p.data[i])}%</b></div>`);
      } else if (p.kind === 'binary') {
        yAxis.push(Object.assign({}, yBase, { type: 'value', min: 0, max: 1, interval: 1, axisLabel: { show: false }, splitLine: { show: false } }));
        const d = new Array(n).fill(null); for (let i = 0; i < n; i++) if (p.data[i]) d[i] = 1;
        series.push({ name: p.title, type: 'bar', xAxisIndex: k, yAxisIndex: k, data: d, large: true, barCategoryGap: '0%', itemStyle: { color: p.color } });
        if (p.tip !== false) tips.push(i => `<div>${esc(p.short || p.title)} <b style="float:right;margin-left:16px">${p.data[i] ? 1 : 0}</b></div>`);
      } else if (p.kind === 'trend') {
        yAxis.push(Object.assign({}, yBase, { type: 'value', min: -1, max: 1, interval: 1 }));
        const pos = new Array(n).fill(null), neg = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { if (p.data[i] === 1) pos[i] = 1; else if (p.data[i] === -1) neg[i] = -1; }
        series.push({ name: 'Trend +1', type: 'bar', xAxisIndex: k, yAxisIndex: k, data: pos, large: true, barCategoryGap: '0%', barGap: '-100%', itemStyle: { color: COL.bull } });
        series.push({ name: 'Trend -1', type: 'bar', xAxisIndex: k, yAxisIndex: k, data: neg, large: true, barCategoryGap: '0%', barGap: '-100%', itemStyle: { color: COL.bear } });
        tips.push(i => `<div>${esc(p.short || p.title)} <b style="float:right;margin-left:16px">${p.data[i] === 1 ? '+1' : p.data[i] === -1 ? '−1' : '—'}</b></div>`);
      }
      y += p.h + gap;
    });
    const height = y + slider - 6;
    el.style.height = height + 'px';
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    charts.push(chart);
    const xi = panels.map((_, k) => k);
    const yrs = rangeYears[o.range || '5Y'];
    const startValue = yrs ? Math.max(0, n - 1 - yrs * 252) : 0;
    chart.setOption({
      animation: false, backgroundColor: COL.panel, textStyle: { fontFamily: CHART_FONT },
      title, grid, xAxis, yAxis, series,
      axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: COL.accent, width: 1, type: 'dashed' } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: COL.accent } }, confine: true,
        backgroundColor: COL.tipBg, borderColor: COL.tipBorder, extraCssText: 'box-shadow:0 4px 14px rgba(15,23,42,.12)', textStyle: { color: COL.fg, fontSize: 12 },
        formatter: (ps) => { const pp = Array.isArray(ps) ? ps[0] : ps; if (!pp) return ''; const i = pp.dataIndex;
          const mks = (panels[0].markers || []).filter(m => m.idx.includes(i)).map(m => `<div style="color:${m.dir > 0 ? COL.bullFg : COL.bearFg}">▲ ${esc(m.name)} signal</div>`).join('');
          return `<div style="font-weight:600;margin-bottom:4px">${fmtDate(DS.dates[i])}</div>${tips.map(f => f(i)).join('')}${mks}`; } },
      dataZoom: [{ type: 'inside', xAxisIndex: xi, startValue, endValue: n - 1, zoomOnMouseWheel: true, moveOnMouseMove: true },
        { type: 'slider', xAxisIndex: xi, startValue, endValue: n - 1, bottom: 4, height: 20, borderColor: COL.grid, backgroundColor: COL.slider,
          fillerColor: COL.fill, handleStyle: { color: COL.accent }, textStyle: { color: COL.muted, fontSize: 10 }, labelFormatter: (v) => fmtDate(DS.dates[v]), showDataShadow: false }]
    });
    const syncLabels = () => {
      if (!labelled.length) return;
      const dz = chart.getOption().dataZoom[0];
      const s0 = dz.startValue ?? 0, s1 = dz.endValue ?? n - 1;
      const show = (s1 - s0) <= LABEL_SPAN;
      if (show === chart._lblShown) return;
      chart._lblShown = show;
      chart.setOption({ series: labelled.map(id => ({ id, label: { show } })) });
    };
    chart._lblShown = true;
    syncLabels();
    chart.on('datazoom', syncLabels);
    host.querySelectorAll('button[data-r]').forEach(b => b.onclick = () => {
      host.querySelectorAll('button[data-r]').forEach(x => x.classList.toggle('on', x === b));
      const yy = rangeYears[b.dataset.r];
      chart.dispatchAction({ type: 'dataZoom', startValue: yy ? Math.max(0, n - 1 - yy * 252) : 0, endValue: n - 1 });
    });
    host.querySelector('button[data-log]').onclick = (ev) => {
      const on = !ev.currentTarget.classList.contains('on'); ev.currentTarget.classList.toggle('on', on);
      const yi = panels.findIndex(p => p.kind === 'price');
      const ya = chart.getOption().yAxis.map((a, k) => k === yi ? (on ? Object.assign({ type: 'log', logBase: 10, scale: false }, PRICE_LOG) : Object.assign({ type: 'value', scale: true }, PRICE_LIN)) : {});
      chart.setOption({ yAxis: ya });
    };
    if (o.onClick) chart.on('click', (p) => { if (p.data && p.data.idx !== undefined) o.onClick(p.data.idx); });
    return chart;
  }

  function trackingChart(el, src, sel) {
    const pre = C.trackPre, post = C.trackPost;
    const path = E.trackPath(DS, sel, pre, post);
    const avg = E.trackAverage(DS, src.events, sel, pre, post);
    const pts = (arr) => arr.map((v, x) => [x - pre, v === null ? null : +v.toFixed(3)]);
    let chart = echarts.getInstanceByDom(el);
    if (!chart) { chart = echarts.init(el); charts.push(chart); }
    const lastK = DS.n - 1 - sel;
    chart.setOption({
      animation: false, backgroundColor: COL.panel, textStyle: { fontFamily: CHART_FONT },
      title: { text: `S&P 500 around ${src.label} signals`, subtext: `Selected signal ${fmtDate(DS.dates[sel])} · ${lastK} session(s) elapsed · historical average of ${avg.signals} prior signal(s)`,
        left: 'center', textStyle: { color: COL.fg, fontSize: 14, fontWeight: 600 }, subtextStyle: { color: COL.muted, fontSize: 11.5 } },
      grid: { left: 54, right: 24, top: 66, bottom: 64 },
      legend: { bottom: 4, textStyle: { color: COL.muted }, data: ['Historical average', 'Selected signal'] },
      xAxis: { type: 'value', min: -pre, max: post, name: 'Trading sessions from signal', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: COL.muted },
        axisLabel: { color: COL.muted, formatter: v => v > 0 ? '+' + v : v }, splitLine: { show: false }, axisLine: { lineStyle: { color: COL.grid } } },
      yAxis: { type: 'value', scale: true, name: 'Normalized close (100 = signal day)', nameLocation: 'middle', nameGap: 40, nameTextStyle: { color: COL.muted },
        axisLabel: { color: COL.muted }, splitLine: { lineStyle: { color: COL.split } } },
      tooltip: { trigger: 'axis', confine: true, backgroundColor: COL.tipBg, borderColor: COL.tipBorder, extraCssText: 'box-shadow:0 4px 14px rgba(15,23,42,.12)', textStyle: { color: COL.fg, fontSize: 12 },
        formatter: (ps) => { const x = ps[0].value[0]; const k = x + pre;
          const a = avg.avg[k], c = path[k];
          return `<b>Session ${x > 0 ? '+' + x : x}</b><br/>Selected: ${c == null ? 'N/A' : (c - 100).toFixed(2) + '%'}<br/>Historical avg: ${a == null ? 'N/A' : (a - 100).toFixed(2) + '%'} <span style="color:${COL.muted}">(n = ${avg.n[k]})</span>`; } },
      dataZoom: [{ type: 'inside' }],
      series: [
        { name: 'Historical average', type: 'line', data: pts(avg.avg), showSymbol: false, lineStyle: { width: 2.2, color: COL.accent }, itemStyle: { color: COL.accent }, connectNulls: false,
          markLine: { silent: true, symbol: 'none', data: [{ xAxis: 0, lineStyle: { color: COL.bear, width: 1.4, type: 'solid' }, label: { formatter: fmtDate(DS.dates[sel]), color: COL.bear, position: 'end' } },
            { yAxis: 100, lineStyle: { color: COL.bear, type: 'dashed', width: 1 }, label: { show: false } }] } },
        { name: 'Selected signal', type: 'line', data: pts(path), showSymbol: false, lineStyle: { width: 2, color: COL.ink }, itemStyle: { color: COL.ink }, connectNulls: false }
      ]
    }, true);
    const nMax = Math.max(...avg.n), nPost = avg.n.slice(pre + 1).filter(v => v > 0);
    return { signals: avg.signals, nMax, nMinPost: nPost.length ? Math.min(...nPost) : 0 };
  }

  const hsetButtons = () => `<button data-h="weeks" class="${HSET === 'weeks' ? 'on' : ''}">Weeks (1–8)</button><button data-h="months" class="${HSET === 'months' ? 'on' : ''}">Months (1–12)</button>`;
  const hzHead = (hz) => `<th class="n">${hz.label}</th>`;
  function horizonCharts(host, arr) {
    (host._charts || []).forEach(c => { try { c.dispose(); } catch (e) {} });
    const stats = { long: arr };
    host.innerHTML = `<div class="grid g2"><div data-xroot><div class="card-h"><div class="grow"><h2>Forward returns: signal vs all days</h2></div>
      <div class="ctrl"><button data-m="mean" class="on">Avg</button><button data-m="median">Median</button><button class="xjpg">Export JPG</button></div></div><div class="chart" style="height:280px"></div></div>
      <div data-xroot><div class="card-h"><div class="grow"><h2>Hit rate: signal vs all days</h2></div><div class="ctrl"><button class="xjpg">Export JPG</button></div></div><div class="chart" style="height:280px"></div></div></div>`;
    const [e1, e2] = host.querySelectorAll('.chart');
    const c1 = echarts.init(e1), c2 = echarts.init(e2); charts.push(c1, c2); host._charts = [c1, c2];
    const labels = stats.long.map(s => s.label);
    const base = { animation: false, backgroundColor: COL.panel, textStyle: { fontFamily: CHART_FONT }, grid: { left: 50, right: 16, top: 30, bottom: 30 },
      legend: { top: 0, left: 0, textStyle: { color: COL.muted, fontSize: 11 } },
      xAxis: { type: 'category', data: labels, axisLabel: { color: COL.muted }, axisLine: { lineStyle: { color: COL.grid } } },
      tooltip: { trigger: 'axis', confine: true, backgroundColor: COL.tipBg, borderColor: COL.tipBorder, extraCssText: 'box-shadow:0 4px 14px rgba(15,23,42,.12)', textStyle: { color: COL.fg, fontSize: 12 }, valueFormatter: v => v == null ? 'N/A' : v.toFixed(1) + '%' } };
    function draw(m) {
      c1.setOption(Object.assign({}, base, {
        yAxis: { type: 'value', axisLabel: { color: COL.muted, formatter: '{value}%' }, splitLine: { lineStyle: { color: COL.split } } },
        series: [{ name: m === 'mean' ? 'Signal avg.' : 'Signal median', type: 'bar', data: stats.long.map(s => s[m] == null ? null : +(s[m] * 100).toFixed(2)), itemStyle: { color: COL.bull }, barWidth: '50%' },
          { name: m === 'mean' ? 'All-day avg.' : 'All-day median', type: 'line', data: stats.long.map(s => +(s.base[m] * 100).toFixed(2)), lineStyle: { color: COL.fg }, itemStyle: { color: COL.fg }, symbolSize: 6 }]
      }), true);
    }
    draw('mean');
    c2.setOption(Object.assign({}, base, {
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: COL.muted, formatter: '{value}%' }, splitLine: { lineStyle: { color: COL.split } } },
      series: [{ name: 'Signal hit rate', type: 'bar', data: stats.long.map(s => s.hit == null ? null : +(s.hit * 100).toFixed(1)), itemStyle: { color: COL.bull }, barWidth: '50%' },
        { name: 'All-day hit rate', type: 'line', data: stats.long.map(s => +(s.base.hit * 100).toFixed(1)), lineStyle: { color: COL.fg }, itemStyle: { color: COL.fg }, symbolSize: 6 }]
    }));
    host.querySelectorAll('button[data-m]').forEach(b => b.onclick = () => { host.querySelectorAll('button[data-m]').forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.m); });
  }

  // --------------------------------------------------------------- pages
  const MODEL_IDS = C.models.map(m => m.id);
  function model(id) { return DS.models.find(m => m.id === id); }
  function markersFor(m, withLabel) { return { name: m.name, dir: m.dir, idx: m.events, label: withLabel ? m.name : null }; }

  function pageTCTM(root) {
    const T = DS.n - 1;
    const rows = DS.models.map(m => {
      const src = E.compositeSource(DS, m), st = E.sourceStatus(DS, src);
      const lv = E.readingLevels(DS, m).find(x => x.key === E.levelOf(m.reading[T]));
      return { m, st, reading: m.reading[T], count: m.count[T], N: m.comps.length, ann: lv, bucket: lv.label };
    });
    const lt = E.trendSource(DS), ltSt = E.sourceStatus(DS, lt);
    const ltCond = E.sourceStats(DS, lt).cond;
    const ltAnn = ltCond.find(r => r.key === (DS.lt[T] === 1 ? 'on' : 'off'));
    const status = DS.status[T];
    const lastStatusChange = DS.statusEvents.length ? DS.statusEvents[DS.statusEvents.length - 1] : null;
    root.innerHTML = `
      <h1>Tactical Composite Trend Model</h1>
      <p class="sub">As of ${fmtDate(DS.dates[T])} close · S&P 500 ${fnum(DS.spx[T])} · ${DS.n.toLocaleString()} trading sessions since ${fmtDate(DS.dates[0])}</p>
      <div class="card" style="margin-top:14px">
        <div class="card-h"><div class="grow"><h2>Model summary</h2><p class="sub">Bullish / Bearish = a qualifying signal within the last ${C.holdSessions} sessions (signal day = session 1). Overall TCTM status:
          ${badge(status === 1 ? 'bull' : status === -1 ? 'bear' : 'neutral')} ${lastStatusChange !== null ? 'since ' + fmtDate(DS.dates[lastStatusChange]) : ''}</p></div></div>
        <div class="tbl-wrap" data-xt="TCTM Model Summary"><table class="t"><thead><tr><th>Model</th><th class="n">Current reading</th><th>Signal status</th><th>Signal date</th><th class="n">Signal count</th><th class="n">S&P 500 annualized return at this reading</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><a class="link" href="#${r.m.id}">${esc(r.m.name)}</a></td><td class="n">${fnum(r.reading)}%</td><td>${badge(r.st.state)}</td>
          <td>${r.st.lastIdx !== null ? fmtDate(DS.dates[r.st.lastIdx]) + ` <span class="na">(${r.st.sessionsSince} sessions)</span>` : '—'}</td>
          <td class="n">${r.count} of ${r.N}</td><td class="n">${r.ann.days >= MIN_DAYS ? pct(r.ann.ann) : '<span class="na">n/a</span>'} <span class="na">(reading ${esc(r.bucket)})</span></td></tr>`).join('')}
        <tr><td><a class="link" href="#trend">Long-Term Trend</a></td><td class="n">${DS.lt[T] === 1 ? '+1' : DS.lt[T] === -1 ? '−1' : '—'}</td><td>${badge(ltSt.state)}</td>
          <td>${ltSt.lastIdx !== null ? fmtDate(DS.dates[ltSt.lastIdx]) + ` <span class="na">(${ltSt.sessionsSince} sessions)</span>` : '—'}</td><td class="n">—</td>
          <td class="n">${pct(ltAnn.ann)} <span class="na">(when ${DS.lt[T] === 1 ? 'bullish' : 'bearish'})</span></td></tr>
        </tbody></table></div>
      </div>
      <div class="card"><div class="card-h"><div class="grow"><h2>S&P 500 annualized return by composite reading</h2>
        <p class="sub">Daily-observation method, ${fmtDate(DS.dates[0])} – ${fmtDate(DS.dates[T])}. Each level includes every day the reading was at or above it; the share of time at each level is shown beneath each return.</p></div></div>
        <div class="tbl-wrap" data-xt="S&amp;P 500 Annualized Return by Composite Reading">${levelTable()}</div>
        <p class="note"><b>Method.</b> On each session the composite reading at the close (t) is tested against each level (≥ 10%, ≥ 20% … ≥ 90%), and every level it meets receives the S&P 500's close-to-close return from t to t+1, so nothing after the close is used. Levels overlap: a 45% day counts toward ≥ 10% through ≥ 40%.
        Daily returns at each level are compounded geometrically and scaled to ${C.tradingDaysPerYear} sessions: annualized = exp(${C.tradingDaysPerYear} × mean(ln(1+r))) − 1. These are condition returns over all qualifying days, not forward returns after discrete signals (those are on each composite page).
        All days: ${pct(E.allDaysAnnualized(DS).ann)} annualized. Readings move in steps of 100 ÷ components, so for Capitulation (25% steps) the ≥ 30% row equals ≥ 50%.</p>
      </div>
      <div class="card"><div class="card-h"><div class="grow"><h2>Master TCTM</h2><p class="sub">S&P 500 coloured by the Long-Term Trend, with every composite signal on the day it occurred. Histograms: coloured at ≥${C.threshold}%, grey below.</p></div></div>
        <div id="master"></div></div>
      ${DS.models.map(m => `<div class="card"><div class="card-h"><div class="grow"><h2>TCTM ${esc(m.name)} Signals</h2>
          <p class="sub">${m.comps.length} components · ${m.events.length} signals since ${fmtDate(DS.dates[0])} · reading ${fnum(m.reading[T])}%</p></div>
          <button data-comp="${m.id}">View component analysis</button><a class="btn" href="#${m.id}" style="text-decoration:none">Open page</a></div>
        <div id="c-${m.id}"></div><div id="cc-${m.id}" class="hidden" style="margin-top:14px"></div></div>`).join('')}
      <div class="card"><div class="card-h"><div class="grow"><h2>TCTM Long-Term Trend Signals</h2></div></div>
        ${trendStatsTable()}<div id="c-lt" style="margin-top:12px"></div></div>`;

    const master = $('#master', root);
    lazy(master, () => stackChart(master, [
      { kind: 'price', title: 'S&P 500', h: 330, colorByTrend: true, markers: DS.models.map(m => markersFor(m, true)) },
      ...DS.models.map(m => ({ kind: 'hist', title: `${m.name} composite — signal count as % of components   ${fnum(m.reading[T])}`, short: m.name, h: 64, data: m.reading, color: m.dir < 0 ? COL.bear : COL.bull }))
    ], { range: '5Y' }));
    for (const m of DS.models) {
      const el = $('#c-' + m.id, root);
      lazy(el, () => compositeChart(el, m));
      $(`button[data-comp="${m.id}"]`, root).onclick = (ev) => {
        const box = $('#cc-' + m.id, root);
        const show = box.classList.contains('hidden');
        box.classList.toggle('hidden', !show);
        ev.currentTarget.textContent = show ? 'Hide component analysis' : 'View component analysis';
        if (show && !box.dataset.done) { box.dataset.done = 1; componentChart(box, m); }
      };
    }
    const lte = $('#c-lt', root);
    lazy(lte, () => trendChart(lte));
  }
  function compositeChart(el, m, range) {
    const T = DS.n - 1;
    return stackChart(el, [
      { kind: 'price', title: 'S&P 500', h: 260, markers: [markersFor(m, true)] },
      { kind: 'hist', title: `${m.name} composite — signal count as % of components   ${fnum(m.reading[T])}`, short: m.name, h: 110, data: m.reading, color: m.dir < 0 ? COL.bear : COL.bull }
    ], { range: range || '5Y' });
  }
  function componentChart(el, m) {
    const T = DS.n - 1;
    return stackChart(el, [
      { kind: 'price', title: 'S&P 500', h: 220, markers: [markersFor(m, true)] },
      ...m.comps.map(c => ({ kind: 'binary', title: `${m.name} — ${c.name}   ${c.active[T] ? '1' : '0'}`, short: c.name, h: 30, data: c.active, color: m.dir < 0 ? COL.bear : COL.bull }))
    ], { range: '3Y' });
  }
  function trendChart(el) {
    const T = DS.n - 1;
    return stackChart(el, [
      { kind: 'price', title: 'S&P 500 — coloured by Long-Term Trend', h: 300, colorByTrend: true,
        markers: [{ name: 'Long-Term Trend buy', label: 'LT Bullish', dir: 1, idx: DS.ltEvents.filter(i => DS.lt[i] === 1) }, { name: 'Long-Term Trend sell', label: 'LT Bearish', dir: -1, idx: DS.ltEvents.filter(i => DS.lt[i] === -1) }] },
      { kind: 'trend', title: `Long-Term Trend signal   ${DS.lt[T] === 1 ? '+1.00' : '−1.00'}`, short: 'LT Trend', h: 120, data: DS.lt }
    ], { range: '5Y' });
  }
  function levelTable() {
    const all = DS.models.map(m => E.readingLevels(DS, m));
    const cur = DS.models.map(m => E.levelOf(m.reading[DS.n - 1]));
    return `<table class="t"><thead><tr><th>Reading</th>${DS.models.map(m => `<th class="n">${esc(m.name)}</th>`).join('')}</tr></thead><tbody>
      ${E.LEVELS.map((L, li) => `<tr><td>${esc(L.label)}</td>${all.map((lv, k) => { const r = lv[li];
        return `<td class="n${cur[k] === L.key ? ' today' : ''}">${r.days >= MIN_DAYS ? pct(r.ann) : '<span class="na">—</span>'}<div class="na" style="font-size:10.5px">${r.days ? pctPlain(r.share) + ' of time' : 'never reached'}</div></td>`; }).join('')}</tr>`).join('')}
      </tbody></table><p class="note">Outlined cell = the highest level each composite meets today. Levels reached too rarely to annualize (under ${MIN_DAYS} sessions) show —.</p>`;
  }
  function trendStatsTable() {
    const cond = E.sourceStats(DS, E.trendSource(DS)).cond;
    const on = cond.find(r => r.key === 'on'), off = cond.find(r => r.key === 'off');
    return `<div class="tbl-wrap" style="max-width:640px" data-xt="Long-Term Trend Annualized Returns"><table class="t"><thead><tr><th>When trend is…</th><th class="n">Annualized return</th><th class="n">% of time</th></tr></thead><tbody>
      <tr><td>${badge('bull')} Positive (+1)</td><td class="n">${pct(on.ann)}</td><td class="n">${pctPlain(on.share, 0)}</td></tr>
      <tr><td>${badge('bear')} Negative (−1)</td><td class="n">${pct(off.ann)}</td><td class="n">${pctPlain(off.share, 0)}</td></tr></tbody></table></div>
      <p class="note">Period: ${fmtDate(DS.dates[0])} – ${fmtDate(DS.dates[DS.n - 1])}. Trend at the close of day t paired with the S&P 500 return t→t+1; compounded and scaled to ${C.tradingDaysPerYear} sessions.</p>`;
  }

  // ---------------- Open signals
  let openWin = null, openSel = null;
  function pageOpen(root) {
    const win = openWin || C.holdSessions;
    const list = E.openSignals(DS, win);
    if (!openSel || !list.find(o => o.src.key === openSel.key && o.idx === openSel.idx)) openSel = list.length ? { key: list[0].src.key, idx: list[0].idx } : null;
    root.innerHTML = `<h1>Current open signals</h1><p class="sub">Every composite, component and Long-Term Trend signal dated within the last ${win} trading sessions, as of ${fmtDate(DS.dates[DS.n - 1])}. Click a signal name to track it.</p>
      <div class="card" style="margin-top:14px"><div class="card-h"><div class="grow"><h2>Open signals</h2></div>
        <div class="ctrl"><button data-w="42" class="${win === 42 ? 'on' : ''}">Last 42 sessions</button><button data-w="126" class="${win === 126 ? 'on' : ''}">Last 126 sessions (incl. expired)</button></div></div>
        ${list.length ? `<div class="tbl-wrap tall" data-xt="Current Open Signals"><table class="t"><thead><tr><th rowspan="2">Signal date</th><th rowspan="2">Signal name</th><th rowspan="2">Model</th><th rowspan="2">Current status</th><th rowspan="2" class="n">Sessions</th>
          <th colspan="8" class="grp">S&P 500 return after</th></tr><tr>${C.horizons.weeks.map(hzHead).join('')}</tr></thead><tbody>
          ${list.map(o => `<tr class="${openSel && o.src.key === openSel.key && o.idx === openSel.idx ? 'sel' : ''}"><td>${fmtDate(o.date)}</td>
            <td><a class="link" data-k="${esc(o.src.key)}" data-i="${o.idx}">${esc(o.src.kind === 'trend' ? (o.dir > 0 ? 'Long-Term Trend turns bullish' : 'Long-Term Trend turns bearish') : o.src.label)}</a></td>
            <td>${esc(o.src.modelName)}${o.src.kind === 'component' ? ' <span class="na">component</span>' : ''}</td>
            <td><span class="badge b-${o.active ? 'active' : 'expired'}">${o.active ? 'Active' : 'Expired'}</span></td><td class="n">${o.since}</td>
            ${o.weeks.map(r => `<td class="n">${pct(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
          : `<div class="callout">No signals in the last ${win} sessions.</div>`}
        <p class="note">Returns use the S&P 500 close on the signal date and the close the stated number of trading sessions later (1–8 weeks = 5, 10, 15, 21, 26, 31, 36, 42 sessions). N/A = that session has not happened yet. Status: composites stay active for ${C.holdSessions} sessions; a component is active while its hold window (restarted by any re-trigger) is open; a trend signal is active while the trend is unchanged.</p></div>
      <div class="card" data-xroot data-xtitle=""><div class="ctrl" style="justify-content:flex-end"><button class="xjpg">Export JPG</button></div><div id="trk" class="chart" style="height:460px"></div><p class="note" id="trk-note"></p></div>`;
    root.querySelectorAll('button[data-w]').forEach(b => b.onclick = () => { openWin = +b.dataset.w; route(); });
    const srcs = E.allSources(DS);
    const draw = () => {
      if (!openSel) { $('#trk', root).innerHTML = '<div class="loading">No open signal to track.</div>'; return; }
      const src = srcs.find(s => s.key === openSel.key);
      const r = trackingChart($('#trk', root), src, openSel.idx);
      $('#trk-note', root).innerHTML = trackNote(src, r);
    };
    root.querySelectorAll('a[data-k]').forEach(a => a.onclick = () => {
      openSel = { key: a.dataset.k, idx: +a.dataset.i };
      root.querySelectorAll('tr.sel').forEach(tr => tr.classList.remove('sel')); a.closest('tr').classList.add('sel');
      draw();
    });
    draw();
  }
  function trackNote(src, r) {
    return `<b>Method.</b> Both lines are the S&P 500 close divided by its close on the signal day × 100. The historical average uses only ${src.label} signals dated before the selected one (${r.signals}),
      and each contributes only sessions on or before the selected signal's date, so the comparison never uses later information. Sample size varies by offset (max n = ${r.nMax}; smallest n after the signal = ${r.nMinPost}); hover for n at each session.`;
  }

  // ---------------- Composite / component page
  function pageModel(root, id, tab) {
    const m = model(id);
    const T = DS.n - 1;
    const tabs = [{ k: 0, label: `${m.name} Composite`, live: !!m.window[T] }].concat(m.comps.map(c => ({ k: c.idx, label: c.name, live: !!c.active[T] })));
    const cls = m.dir < 0 ? 'live-bear' : 'live-bull';
    root.innerHTML = `<h1>${esc(m.name)}</h1><p class="sub">${m.comps.length} components (columns ${m.comps[0].col}–${m.comps[m.comps.length - 1].col}) · signals are ${m.dir < 0 ? 'bearish' : 'bullish'} · composite signal dates from column ${m.signalCol}</p>
      <div class="tabs" style="margin-top:12px">${tabs.map(t => `<a href="#${id}${t.k ? '-' + t.k : ''}" class="${t.k === tab ? 'on' : ''}"><span class="dot ${t.live ? cls : ''}"></span>${esc(t.label)}</a>`).join('')}</div>
      ${modelOpenSignals(m)}
      <div id="sig"></div>`;
    const src = tab ? E.componentSource(DS, m, m.comps[tab - 1]) : E.compositeSource(DS, m);
    signalPage($('#sig', root), src);
    const on = root.querySelector('.tabs a.on'); intoView(on, { block: 'nearest', inline: 'center' });
  }

  /** Open signals for one model (composite + its components), no return columns. */
  function modelOpenSignals(m) {
    const list = E.openSignals(DS, C.holdSessions).filter(o => o.src.model === m);
    const tabOf = (o) => o.src.kind === 'component' ? `#${m.id}-${o.src.comp.idx}` : `#${m.id}`;
    return `<div class="card"><div class="card-h"><div class="grow"><h2>Open signals</h2>
        <p class="sub">${esc(m.name)} composite and component signals dated within the last ${C.holdSessions} trading sessions, as of ${fmtDate(DS.dates[DS.n - 1])}. Click a name to open its tab.</p></div></div>
      ${list.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Signal date</th><th>Signal name</th><th>Type</th><th>Current status</th><th class="n">Sessions since signal</th></tr></thead><tbody>
        ${list.map(o => `<tr><td>${fmtDate(o.date)}</td><td><a class="link" href="${tabOf(o)}">${esc(o.src.label)}</a></td>
          <td>${o.src.kind === 'composite' ? 'Composite' : 'Component'}</td>
          <td><span class="badge b-${o.active ? 'active' : 'expired'}">${o.active ? 'Active' : 'Expired'}</span></td><td class="n">${o.since}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="callout" style="margin:0">No ${esc(m.name)} signals in the last ${C.holdSessions} sessions.</div>`}</div>`;
  }
  function signalPage(root, src) {
    const T = DS.n - 1, m = src.model, isComp = src.kind === 'composite';
    const st = E.sourceStatus(DS, src), stats = E.sourceStats(DS, src), table = E.eventTable(DS, src);
    const bearish = src.dir < 0;
    const condOn = stats.cond.find(r => r.key === 'on'), condOff = stats.cond.find(r => r.key === 'off');
    const allAnn = E.allDaysAnnualized(DS);
    const ext = (r) => bearish ? r.high : r.low;
    const avgExt = table.length ? { pct: E.mean(table.map(r => ext(r).pct)), ses: E.mean(table.map(r => ext(r).sessions)) } : null;
    const curReading = isComp ? `${fnum(m.reading[T])}%` : (src.comp.active[T] ? 'Active (1)' : 'Inactive (0)');
    root.innerHTML = `
      <div class="card"><div class="card-h"><div class="grow"><h2>${esc(src.label)}${isComp ? '' : ` <span class="na" style="font-weight:400">· ${esc(m.name)} component, column ${src.comp.col}</span>`}</h2></div></div>
        <div class="kpis">
          <div class="kpi"><div class="l">${isComp ? 'Composite reading' : 'Component state'}</div><div class="v">${curReading}</div><div class="s">${isComp ? `${m.count[T]} of ${m.comps.length} components active` : `holds ${src.comp.hold} sessions per trigger`}</div></div>
          <div class="kpi"><div class="l">Signal status</div><div class="v" style="font-size:16px;margin-top:6px">${badge(st.state)}</div><div class="s">${isComp ? (st.recent ? `signal within last ${C.holdSessions} sessions` : `no signal in last ${C.holdSessions} sessions`) : (st.active ? 'component window open' : 'component window closed')}</div></div>
          <div class="kpi"><div class="l">Most recent signal</div><div class="v" style="font-size:16px">${st.lastIdx !== null ? fmtDate(DS.dates[st.lastIdx]) : '—'}</div><div class="s">${st.lastIdx !== null ? st.sessionsSince + ' sessions ago (signal day = 1)' : 'no signals'}</div></div>
          <div class="kpi"><div class="l">Historical signals</div><div class="v">${stats.freq.total}</div><div class="s">${stats.freq.perYear.toFixed(2)} per year · median gap ${stats.freq.medianGap ?? '—'} sessions</div></div>
          <div class="kpi"><div class="l">Annualized in signal window</div><div class="v">${pct(condOn.ann)}</div><div class="s">${pctPlain(condOn.share)} of days · outside: ${pctPlain(condOff.ann)}</div></div>
          <div class="kpi"><div class="l">${bearish ? 'Below recent high at last signal' : 'Above recent low at last signal'}</div><div class="v">${table.length ? pct(ext(table[table.length - 1]).pct) : '—'}</div><div class="s">${table.length ? ext(table[table.length - 1]).sessions + ' sessions since the ' + (bearish ? 'high' : 'low') : ''}</div></div>
        </div>
        ${isComp ? `<h2 style="margin-top:16px">Annualized S&P 500 return by ${esc(m.name)} reading</h2><div class="tbl-wrap" style="margin-top:8px" data-xt="Annualized S&amp;P 500 Return by ${esc(m.name)} Reading">${singleBucketTable(m)}</div>` : ''}
        <p class="note">Signal-window returns: daily method (state at close t → return t to t+1), compounded to ${C.tradingDaysPerYear} sessions. A window is the ${isComp ? C.holdSessions : src.comp.hold} sessions starting on the signal day. All days: ${pctPlain(allAnn.ann)}.</p>
      </div>
      <div class="card"><div class="card-h"><div class="grow"><h2>TCTM ${esc(m.name)} Signals${isComp ? '' : ' – ' + esc(src.label)}</h2>
        <p class="sub">${bearish ? 'Dark red down-arrows' : 'Dark green up-arrows'} mark each ${isComp ? 'composite signal date' : 'new component signal (first trigger of a window)'}. Click an arrow to track it.</p></div>
        ${isComp ? '<button id="btn-cc">View component analysis</button>' : ''}</div>
        <div id="pc"></div><div id="cc" class="hidden" style="margin-top:14px"></div></div>
      <div class="card"><div class="card-h"><div class="grow"><h2>Signal summary vs all-dataset baseline</h2><p class="sub">${stats.freq.total} signals, ${fmtDate(stats.freq.first)} – ${fmtDate(stats.freq.last)}. Close-to-close S&P 500 returns from the signal-day close; incomplete windows are excluded.</p></div>
        <div class="ctrl hset">${hsetButtons()}</div></div>
        <div class="tbl-wrap" id="st-sum" data-xt="${esc(src.label)} – Signal Summary vs All-Dataset Baseline" data-xh="1"></div>
        <p class="note">Max loss / max gain = the worst and best close-to-close move from the signal-day close at any point within the window (0 if the S&P 500 never closed below / above it), averaged across signals. Baseline = the same forward return measured from every session in the dataset. T-statistic = (signal mean − baseline mean) ÷ (signal st. dev. ÷ √n), where n is the number of completed signal windows; |t| ≥ 2 is emphasized. Overlapping windows are not independent, so treat t as a guide rather than a formal significance test. Overlapping signals are each counted (no de-duplication) — see the event list.</p>
        <div id="hz" style="margin-top:14px"></div></div>
      <div class="card" data-xroot data-xtitle=""><div class="card-h"><div class="grow"><h2>Signal tracking</h2></div>
        <div class="ctrl">${table.length ? '<button class="xjpg">Export JPG</button><span class="sep"></span>' : ''}<span class="meta">Selected:</span><select id="trk-sel">${table.slice().reverse().map(r => `<option value="${r.idx}">${fmtDate(r.date)}</option>`).join('')}</select></div></div>
        ${table.length ? '<div id="trk" class="chart" style="height:460px"></div><p class="note" id="trk-note"></p>' : '<div class="callout">No signals to track.</div>'}</div>
      <div class="card"><div class="card-h"><div class="grow"><h2>Signal history and distance from the recent ${bearish ? 'high' : 'low'}</h2>
        <p class="sub">${bearish ? 'Percentage the S&P 500 was below its highest close of the prior ' : 'Percentage the S&P 500 was above its lowest close of the prior '}${C.extremeLookback} sessions on the signal day, and sessions since that ${bearish ? 'high' : 'low'}. Click a date to track it.</p></div>
        <div class="ctrl"><button data-v="ret" class="on">Returns</button><button data-v="exc">Max loss / max gain</button><span class="sep"></span><span class="hset" style="display:contents">${hsetButtons()}</span></div></div>
        <div class="tbl-wrap tall" id="evt" data-xt="${esc(src.label)} – Signal History" data-xh="1"></div></div>
      <div class="card"><div class="card-h"><div class="grow"><h2>Sectors after ${esc(src.label)} signals</h2><p class="sub">Median % return, win rate, and median excess return vs the S&P 500. Each sector uses only signals after its data begins.</p></div>
        <div class="ctrl"><button data-s="med" class="on">Median return</button><button data-s="win">Win rate</button><button data-s="excess">Excess vs S&P 500</button></div></div>
        <div class="tbl-wrap" id="sec" data-xt="Sectors after ${esc(src.label)} Signals"></div></div>`;

    // charts
    const pc = $('#pc', root);
    const mk = { name: src.label, dir: src.dir, idx: src.events, label: isComp ? m.name : src.label.replace(/\s+Signal$/i, '') };
    const trkSel = $('#trk-sel', root);
    const setTrack = (i) => { if (!table.length) return; trkSel.value = String(i); const r = trackingChart($('#trk', root), src, i); $('#trk-note', root).innerHTML = trackNote(src, r);
      root.querySelectorAll('#evt tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.i === String(i))); };
    lazy(pc, () => stackChart(pc, [
      { kind: 'price', title: 'S&P 500', h: 280, markers: [mk] },
      isComp ? { kind: 'hist', title: `${m.name} composite — signal count as % of components   ${fnum(m.reading[T])}`, short: m.name, h: 120, data: m.reading, color: bearish ? COL.bear : COL.bull }
        : { kind: 'binary', title: `${src.label} — active (1) during its ${src.comp.hold}-session window   ${src.comp.active[T] ? 1 : 0}`, short: src.label, h: 70, data: src.comp.active, color: bearish ? COL.bear : COL.bull }
    ], { range: '10Y', onClick: (i) => { setTrack(i); intoView($('#trk', root), { behavior: 'smooth', block: 'center' }); } }));
    if (isComp) $('#btn-cc', root).onclick = (ev) => { const box = $('#cc', root); const show = box.classList.contains('hidden'); box.classList.toggle('hidden', !show);
      ev.currentTarget.textContent = show ? 'Hide component analysis' : 'View component analysis'; if (show && !box.dataset.done) { box.dataset.done = 1; componentChart(box, m); } };
    const hz = $('#hz', root);
    let hzDrawn = false;
    const drawStats = () => {
      $('#st-sum', root).innerHTML = longTable(stats.sets[HSET]);
      if (hzDrawn) horizonCharts(hz, stats.sets[HSET]);
    };
    lazy(hz, () => { hzDrawn = true; horizonCharts(hz, stats.sets[HSET]); });

    // event table
    let view = 'ret';
    const drawEvt = () => {
      const H = C.horizons[HSET];
      const head = view === 'ret' ? H.map(hzHead).join('') : H.map(hz => `<th class="n">${hz.label} loss</th><th class="n">${hz.label} gain</th>`).join('');
      const body = table.slice().reverse().map(r => `<tr data-i="${r.idx}"><td><a class="link" data-t="${r.idx}">${r.date}</a></td>
        <td class="n">${pct(ext(r).pct)}</td><td class="n">${ext(r).sessions}</td>
        ${view === 'ret' ? r.ret[HSET].map(x => `<td class="n">${pct(x)}</td>`).join('') : r.exc[HSET].map(x => x ? `<td class="n">${pct(x.maxLoss)}</td><td class="n">${pct(x.maxGain)}</td>` : '<td class="n na">N/A</td><td class="n na">N/A</td>').join('')}</tr>`).join('');
      const s = view === 'ret' ? stats.sets[HSET] : null;
      const excAgg = (k, f) => { const a = table.map(r => r.exc[HSET][k]).filter(Boolean).map(x => x[f]); return a.length ? f === 'maxLoss' ? E.mean(a) : E.mean(a) : null; };
      const foot = `<tr><td>Average</td><td class="n">${avgExt ? pct(avgExt.pct) : '—'}</td><td class="n">${avgExt ? avgExt.ses.toFixed(0) : '—'}</td>
        ${view === 'ret' ? s.map(x => `<td class="n">${pct(x.mean)}</td>`).join('') : H.map((w, k) => `<td class="n">${pct(excAgg(k, 'maxLoss'))}</td><td class="n">${pct(excAgg(k, 'maxGain'))}</td>`).join('')}</tr>
        ${view === 'ret' ? `<tr><td>Median</td><td class="n">${table.length ? pct(E.median(table.map(r => ext(r).pct))) : '—'}</td><td class="n">${table.length ? E.median(table.map(r => ext(r).sessions)) : '—'}</td>${s.map(x => `<td class="n">${pct(x.median)}</td>`).join('')}</tr>
        <tr><td>% positive</td><td></td><td></td>${s.map(x => `<td class="n">${pctPlain(x.hit, 0)}</td>`).join('')}</tr>` : ''}`;
      $('#evt', root).dataset.xsub = view === 'exc' ? 'Max Loss / Max Gain' : '';
      $('#evt', root).innerHTML = table.length ? `<table class="t"><thead><tr><th>Signal date</th><th class="n">${bearish ? '% below high' : '% above low'}</th><th class="n">Sessions since ${bearish ? 'high' : 'low'}</th>${head}</tr></thead>
        <tbody>${body}</tbody><tfoot>${foot}</tfoot></table>` : '<div class="callout">No signals in the data.</div>';
      root.querySelectorAll('#evt a[data-t]').forEach(a => a.onclick = () => { setTrack(+a.dataset.t); intoView($('#trk', root), { behavior: 'smooth', block: 'center' }); });
      if (trkSel) root.querySelectorAll('#evt tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.i === trkSel.value));
    };
    root.querySelectorAll('button[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; root.querySelectorAll('button[data-v]').forEach(x => x.classList.toggle('on', x === b)); drawEvt(); });
    root.querySelectorAll('button[data-h]').forEach(b => b.onclick = () => {
      HSET = b.dataset.h; root.querySelectorAll('button[data-h]').forEach(x => x.classList.toggle('on', x.dataset.h === HSET)); drawStats(); drawEvt(); });
    drawStats();
    drawEvt();
    if (table.length) { trkSel.onchange = () => setTrack(+trkSel.value); const tEl = $('#trk', root); lazy(tEl, () => setTrack(table[table.length - 1].idx)); }

    // sectors
    let sv = 'med'; const sec = E.sectorStudy(DS, src.events);
    const drawSec = () => {
      const rows = sv === 'excess' ? sec.slice(1) : sec;
      $('#sec', root).innerHTML = `<table class="t heat"><thead><tr><th>${sv === 'win' ? 'Win rate' : sv === 'excess' ? 'Median excess %' : 'Median % return'}</th>${C.sectorHorizons.map(h => `<th class="n">${h.label} later</th>`).join('')}<th class="n">n (1 yr)</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${esc(r.name)}</td>${r[sv].map(v => heatCell(v, sv)).join('')}<td class="n na">${r.n[r.n.length - 1]}</td></tr>`).join('')}</tbody></table>`;
    };
    root.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => { sv = b.dataset.s; root.querySelectorAll('button[data-s]').forEach(x => x.classList.toggle('on', x === b)); drawSec(); });
    drawSec();
  }
  function heatCell(v, mode) {
    if (v === null || !Number.isFinite(v)) return '<td class="n na">—</td>';
    const x = mode === 'win' ? (v - 0.5) * 2 : Math.max(-1, Math.min(1, v / 0.08));
    const a = Math.min(0.45, Math.abs(x) * 0.45);
    const bg = x >= 0 ? `rgba(21,128,61,${a})` : `rgba(165,29,29,${a})`;
    return `<td class="n" style="background:${bg}">${mode === 'win' ? (v * 100).toFixed(0) + '%' : (v * 100).toFixed(1)}</td>`;
  }
  function singleBucketTable(m) {
    const lv = E.readingLevels(DS, m), cur = E.levelOf(m.reading[DS.n - 1]);
    return `<table class="t"><thead><tr><th>Reading</th>${lv.map(r => `<th class="n">${esc(r.label)}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Annualized</td>${lv.map(r => `<td class="n${r.key === cur ? ' today' : ''}">${r.days >= MIN_DAYS ? pct(r.ann) : '<span class="na">—</span>'}</td>`).join('')}</tr>
      <tr><td>% of time</td>${lv.map(r => `<td class="n na">${r.days ? pctPlain(r.share) : '—'}</td>`).join('')}</tr></tbody></table>
      <p class="note">Each level includes every day the reading was at or above it (levels overlap). Outlined = the highest level met today. Levels reached on fewer than ${MIN_DAYS} sessions show —.</p>`;
  }
  function weeksTable(arr) {
    const stats = { weeks: arr };
    return `<table class="t"><thead><tr><th></th>${arr.map(hzHead).join('')}</tr></thead><tbody>
      <tr><td>Average</td>${stats.weeks.map(s => `<td class="n">${pct(s.mean)}</td>`).join('')}</tr>
      <tr><td>Median</td>${stats.weeks.map(s => `<td class="n">${pct(s.median)}</td>`).join('')}</tr>
      <tr><td>% positive</td>${stats.weeks.map(s => `<td class="n">${pctPlain(s.hit, 0)}</td>`).join('')}</tr>
      <tr><td>Worst / best</td>${stats.weeks.map(s => `<td class="n" style="font-size:11px">${pctPlain(s.min)} / ${pctPlain(s.max)}</td>`).join('')}</tr>
      <tr><td>Completed windows (n)</td>${stats.weeks.map(s => `<td class="n na">${s.n}</td>`).join('')}</tr>
      <tr><td class="na">All-days average</td>${stats.weeks.map(s => `<td class="n na">${pctPlain(s.base.mean, 2)}</td>`).join('')}</tr></tbody></table>`;
  }
  function longTable(arr) {
    const stats = { long: arr };
    const z = (v) => v === null ? '<span class="na">—</span>' : `<span style="${Math.abs(v) >= 2 ? 'font-weight:700;color:' + (v > 0 ? COL.bullFg : COL.bearFg) : ''}">${v.toFixed(2)}</span>`;
    return `<table class="t"><thead><tr><th>Metric</th>${arr.map(hzHead).join('')}</tr></thead><tbody>
      <tr><td>Average signal return</td>${stats.long.map(s => `<td class="n">${pct(s.mean)}</td>`).join('')}</tr>
      <tr><td>Median signal return</td>${stats.long.map(s => `<td class="n">${pct(s.median)}</td>`).join('')}</tr>
      <tr><td>Signal hit rate</td>${stats.long.map(s => `<td class="n">${pctPlain(s.hit, 0)}</td>`).join('')}</tr>
      <tr><td>Average max loss</td>${stats.long.map(s => `<td class="n">${pct(s.avgMaxLoss)}</td>`).join('')}</tr>
      <tr><td>Average max gain</td>${stats.long.map(s => `<td class="n">${pct(s.avgMaxGain)}</td>`).join('')}</tr>
      <tr><td>Signal T-statistic</td>${stats.long.map(s => `<td class="n">${z(s.t)}</td>`).join('')}</tr>
      <tr><td>Completed windows</td>${stats.long.map(s => `<td class="n">${s.n}</td>`).join('')}</tr>
      <tr class="base-sep"><td>Average all-dataset return</td>${stats.long.map(s => `<td class="n">${pctPlain(s.base.mean)}</td>`).join('')}</tr>
      <tr><td>Median all-dataset return</td>${stats.long.map(s => `<td class="n">${pctPlain(s.base.median)}</td>`).join('')}</tr>
      <tr><td>All-dataset hit rate</td>${stats.long.map(s => `<td class="n">${pctPlain(s.base.hit, 0)}</td>`).join('')}</tr></tbody></table>`;
  }

  // ---------------- Long-term trend page
  function pageTrend(root) {
    const src = E.trendSource(DS), st = E.sourceStatus(DS, src), table = E.eventTable(DS, src);
    const ups = table.filter(r => r.dir === 1), downs = table.filter(r => r.dir === -1);
    const T = DS.n - 1;
    const extTable = (rows, key, title, word) => {
      const avgP = rows.length ? E.mean(rows.map(r => r[key].pct)) : null, avgS = rows.length ? E.mean(rows.map(r => r[key].sessions)) : null;
      const split = (d) => { const rr = rows.filter(r => r.dir === d); return rr.length ? `${pct(E.mean(rr.map(r => r[key].pct)))} · ${E.mean(rr.map(r => r[key].sessions)).toFixed(0)} sessions (n=${rr.length})` : '—'; };
      return `<div class="card"><div class="card-h"><div class="grow"><h2>${title}</h2><p class="sub">Distance from the ${word} close of the prior ${C.extremeLookback} sessions on each trend change. Bullish avg: ${split(1)} · Bearish avg: ${split(-1)}</p></div></div>
        <div class="tbl-wrap tall" data-xt="Long-Term Trend – ${esc(title)}"><table class="t"><thead><tr><th>Signal date</th><th>Transition</th><th class="n">S&P 500</th><th class="n">% from recent ${word}</th><th class="n">Sessions since ${word}</th><th>${word === 'high' ? 'High' : 'Low'} date</th></tr></thead><tbody>
        ${rows.slice().reverse().map(r => `<tr><td>${fmtDate(r.date)}</td><td>${r.dir === 1 ? badge('bull') : badge('bear')}</td><td class="n">${fnum(r.close)}</td><td class="n">${pct(r[key].pct)}</td><td class="n">${r[key].sessions}</td><td>${fmtDate(r[key].date)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Average (all transitions)</td><td class="n">${pct(avgP)}</td><td class="n">${avgS === null ? '—' : avgS.toFixed(0)}</td><td></td></tr></tfoot></table></div></div>`;
    };
    root.innerHTML = `<h1>Long-Term Trend</h1><p class="sub">Column ${C.ltCol} of the sheet (1 = positive, −1 = negative). ${table.length} trend changes since ${fmtDate(DS.dates[0])}.</p>
      <div class="card" style="margin-top:14px"><div class="kpis">
        <div class="kpi"><div class="l">Current trend</div><div class="v" style="font-size:16px;margin-top:6px">${badge(st.state)}</div><div class="s">${DS.lt[T] === 1 ? '+1' : '−1'} as of ${fmtDate(DS.dates[T])}</div></div>
        <div class="kpi"><div class="l">In force since</div><div class="v" style="font-size:16px">${st.lastIdx !== null ? fmtDate(DS.dates[st.lastIdx]) : '—'}</div><div class="s">${st.sessionsSince ?? '—'} sessions</div></div>
        <div class="kpi"><div class="l">Bullish transitions</div><div class="v">${ups.length}</div></div><div class="kpi"><div class="l">Bearish transitions</div><div class="v">${downs.length}</div></div></div>
        <div style="margin-top:14px">${trendStatsTable()}</div></div>
      <div class="card"><div class="card-h"><div class="grow"><h2>TCTM Long-Term Trend Signals</h2><p class="sub">Up-arrows: trend turns positive. Down-arrows: trend turns negative.</p></div></div><div id="tc"></div></div>
      ${extTable(table, 'high', 'Market high statistics', 'high')}
      ${extTable(table, 'low', 'Market low statistics', 'low')}
      <div class="card"><div class="card-h"><div class="grow"><h2>Forward returns after trend changes</h2></div><div class="ctrl"><button data-d="1" class="on">Bullish transitions</button><button data-d="-1">Bearish transitions</button><span class="sep"></span>${hsetButtons()}</div></div>
        <div class="tbl-wrap" id="ltw" data-xt="Forward Returns after Long-Term Trend Changes" data-xh="1"></div></div>`;
    const tc = $('#tc', root); lazy(tc, () => trendChart(tc));
    let dsel = 1;
    const drawW = () => {
      const ev = table.filter(r => r.dir === dsel).map(r => r.idx);
      $('#ltw', root).innerHTML = weeksTable(E.eventStats(DS, ev)[HSET]);
    };
    root.querySelectorAll('button[data-d]').forEach(b => b.onclick = () => { root.querySelectorAll('button[data-d]').forEach(x => x.classList.toggle('on', x === b)); dsel = +b.dataset.d; drawW(); });
    root.querySelectorAll('button[data-h]').forEach(b => b.onclick = () => { HSET = b.dataset.h; root.querySelectorAll('button[data-h]').forEach(x => x.classList.toggle('on', x.dataset.h === HSET)); drawW(); });
    drawW();
  }

  // ---------------- Data & methodology
  function pageGlossary(root) {
    const G = TCTM_GLOSSARY;
    const ov = G.overview;
    root.innerHTML = `<h1>Glossary</h1>
      <div class="card gloss" style="margin-top:12px"><p style="margin:0;font-size:14.5px">${esc(G.intro)}</p></div>
      <div class="ctrl" style="margin:0 0 14px">${[G.trend].concat(G.composites).map(c => `<a class="btn" style="text-decoration:none" href="#glossary" data-jump="g-${c.id}">${esc(c.title)}</a>`).join('')}</div>
      <div class="card gloss"><h2>${esc(ov.title)}</h2>
        <ol>${ov.items.map(it => `<li><b>${esc(it.name)}</b> – ${esc(it.text)}</li>`).join('')}</ol>
        <p style="margin-top:12px">${esc(ov.closing)}</p></div>
      <div class="card gloss" id="g-${G.trend.id}">
        <div class="card-h"><div class="grow"><h2>Tactical Composite Trend Model – ${esc(G.trend.title)}</h2></div><a class="btn" style="text-decoration:none" href="#trend">Open Long-Term Trend page</a></div>
        <p>${esc(G.trend.text)}</p></div>
      ${G.composites.map(c => `<div class="card gloss" id="g-${c.id}">
        <div class="card-h"><div class="grow"><h2>Tactical Composite Trend Model – ${esc(c.title)}</h2></div><a class="btn" style="text-decoration:none" href="#${c.id}">Open ${esc(c.title.replace(' Composite', ''))} page</a></div>
        <p>${esc(c.intro)}</p>
        <h3>Composite construction and signals</h3>
        <p>${esc(c.construction)}</p>
        <div class="tbl-wrap"><table class="t gtbl"><thead><tr><th>${esc(c.title.replace(' Composite', ''))} components</th><th>Definition</th></tr></thead><tbody>
          ${c.components.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>
        <p class="credit">${esc(G.credit)}</p>
        <h3>How it works</h3>
        <p>${esc(c.how)}</p></div>`).join('')}`;
    root.querySelectorAll('a[data-jump]').forEach(a => a.onclick = (ev) => {
      ev.preventDefault();
      const t = scope.querySelector('#' + CSS.escape(a.dataset.jump));
      const scroller = scrollParent();
      if (t && scroller) {
        const top = t.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 110;
        scrollTo({ top, behavior: 'smooth' });
      }
    });
  }

  // ----------------------------------------------------------- shell/router
  function setStatusPill() {
    const T = DS.n - 1, s = DS.status[T];
    const st = s === 1 ? 'bull' : s === -1 ? 'bear' : 'neutral';
    $('#pill').innerHTML = `<span class="meta">TCTM status</span> ${badge(st)}`;
    $('#asof').textContent = `Data through ${fmtDate(DS.dates[T])}`;
  }
  function route(opts) {
    if (!DS) return;
    disposeAll();
    const h = (location.hash || '#tctm').slice(1);
    const [pg, sub] = h.split('-');
    scope.querySelectorAll('nav.main a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + pg));
    const root = $('#view');
    try {
      if (pg === 'open') pageOpen(root);
      else if (MODEL_IDS.includes(pg)) { const m = model(pg); const k = Math.max(0, Math.min(m.comps.length, parseInt(sub || '0', 10) || 0)); pageModel(root, pg, k); }
      else if (pg === 'trend') pageTrend(root);
      else if (pg === 'glossary') pageGlossary(root);
      else pageTCTM(root);
      addTableButtons(root);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="callout err">This page could not be drawn: ${esc(e.message)}</div>`;
    }
    if (!opts || !opts.keepScroll) scrollTo(0);
  }

  function showLoading(msg, frac) {
    if (!scope) return;
    $('#view').innerHTML = `<div class="loading"><div>${esc(msg)}</div><div class="bar"><i style="width:${Math.round((frac || 0) * 100)}%"></i></div></div>`;
  }
  function showDataError(message) {
    if (!scope) return;
    $('#view').innerHTML = `<div class="card" style="max-width:720px;margin:40px auto"><h2>TCTM data</h2>
      <div class="callout err" style="margin-top:12px">${esc(message)}</div>
      <p class="sub" style="margin-top:10px">This page reads the public “${esc(C.sheetName)}” tab. Share the Google Sheet so anyone with the link can view it.</p>
      <div class="ctrl" style="margin-top:14px"><button id="retry" class="on">Reload data</button></div></div>`;
    $('#retry').onclick = () => start();
  }
  function finish(values, info, mine) {
    showLoading('Calculating signals…', 1);
    setTimeout(() => {
      if (mine !== req || !scope) return;
      try {
        DS = E.buildDataset(values);
        LOADINFO = Object.assign({ at: Date.now() }, info);
        setStatusPill();
        route();
      } catch (e) { console.error(e); showDataError('The data could not be processed: ' + e.message); }
    }, 20);
  }
  async function start() {
    const mine = ++req;
    showLoading('Downloading TCTM Signals…', 0.05);
    try {
      const { values, info } = await loadFromSheet((f, msg) => { if (mine === req) showLoading(msg, f); });
      if (mine !== req || !scope) return;
      finish(values, info, mine);
    } catch (e) {
      if (mine !== req || !scope) return;
      showDataError(e && e.message ? e.message : 'The sheet could not be read.');
    }
  }
  // ------------------------------------------------------------ JPG export
  /**
   * Re-render a chart off-screen at exactly 800×600 on white, keeping the
   * visible date range, and hand the JPG to the viewer.
   */
  const XW = 800, XH = 600;
  function exportOption(chart, heading) {
    const opt = chart.getOption();
    const dom = chart.getDom();
    const out = Object.assign({}, opt, { animation: false, backgroundColor: COL.panel, tooltip: { show: false } });
    const head = heading ? 34 : 0;
    const grids = opt.grid || [];
    const stacked = grids.length > 1 || (grids[0] && typeof grids[0].height === 'number');
    if (stacked) {
      // re-lay the panels: a fixed label strip above each panel, panel heights scaled to fit
      const small = grids.length > 7;
      const band = small ? 13 : 18, pad = small ? 3 : 6, axisRoom = 26;
      const avail = XH - head - axisRoom - grids.length * (band + pad);
      const sc = avail / grids.reduce((t, g) => t + g.height, 0);
      let y = head;
      out.grid = grids.map(g => { y += band; const ng = Object.assign({}, g, { top: y, height: g.height * sc, right: 64 }); y += ng.height + pad; return ng; });
      out.title = (opt.title || []).map((t, k) => Object.assign({}, t, { padding: 0, left: 12, top: out.grid[k] ? out.grid[k].top - band + 1 : 0,
        textStyle: Object.assign({}, t.textStyle, { fontSize: small ? 9.5 : 10.5 }) }));
      const dz = (opt.dataZoom || [])[0] || {};
      out.dataZoom = [{ type: 'inside', xAxisIndex: grids.map((_, k) => k), startValue: dz.startValue, endValue: dz.endValue }];
    } else {
      if (head) out.grid = grids.map(g => Object.assign({}, g, { top: (g.top || 40) + head }));
      out.dataZoom = (opt.dataZoom || []).filter(d => d.type === 'inside').map(d => ({ type: 'inside', start: d.start, end: d.end, startValue: d.startValue, endValue: d.endValue }));
      if (head && opt.legend) out.legend = (opt.legend || []).map(l => Object.assign({}, l, { top: (typeof l.top === 'number' ? l.top : 0) + head }));
    }
    if (heading) out.graphic = [{ type: 'text', left: 12, top: 10, style: { text: heading, fontSize: 15, fontWeight: 600, fill: COL.fg, fontFamily: CHART_FONT } },
      { type: 'text', right: 12, top: 13, style: { text: 'As of ' + fmtDate(DS.dates[DS.n - 1]), fontSize: 11, fill: COL.muted, fontFamily: CHART_FONT } }];
    return out;
  }
  async function exportJPG(chart, heading) {
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;left:-10000px;top:0;width:${XW}px;height:${XH}px`;
    document.body.appendChild(box);
    const off = echarts.init(box, null, { renderer: 'canvas', width: XW, height: XH, devicePixelRatio: 1 });
    let url;
    try {
      off.setOption(exportOption(chart, heading));
      url = off.getDataURL({ type: 'jpeg', pixelRatio: 1, backgroundColor: COL.panel });
    } finally { off.dispose(); box.remove(); }
    const bin = atob(url.split(',')[1]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const base = (heading || (chart.getOption().title || [{}])[0].text || 'tctm-chart');
    return saveBlob(blob, base);
  }
  function saveBlob(blob, base) {
    const stem = String(base).toLowerCase().replace(/&amp;/g, 'and').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
    const filename = `${stem || 'tctm'}_${DS.dates[DS.n - 1]}.jpg`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:9px 14px;border-radius:8px;font-size:12.5px;z-index:99';
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  /** Table → JPG: 800 px wide, height as long as the table needs. */
  async function exportTableJPG(wrap) {
    const table = wrap.querySelector('table');
    if (!table) { toast('There is no table to export yet.'); return; }
    if (typeof html2canvas !== 'function') { toast('Table export is not available in this view.'); return; }
    let title = wrap.dataset.xt || 'TCTM table';
    title = title.replace(/&amp;/g, '&');
    if (wrap.dataset.xsub) title += ' – ' + wrap.dataset.xsub;
    if (wrap.dataset.xh) title += HSET === 'months' ? ' (1–12 months)' : ' (1–8 weeks)';
    const box = document.createElement('div');
    box.className = 'xt-box';
    const head = document.createElement('div'); head.className = 'xt-head';
    const h = document.createElement('b'); h.textContent = title;
    const d = document.createElement('span'); d.textContent = 'As of ' + fmtDate(DS.dates[DS.n - 1]);
    head.append(h, d); box.appendChild(head);
    const t = table.cloneNode(true);
    t.querySelectorAll('tr.sel').forEach(r => r.classList.remove('sel'));
    t.querySelectorAll('a').forEach(a => a.replaceWith(document.createTextNode(a.textContent)));
    t.querySelectorAll('td.today').forEach(c => { c.style.outline = 'none'; c.style.boxShadow = 'inset 0 0 0 1.5px ' + COL.accent; });
    box.appendChild(t);
    document.body.appendChild(box);
    try {
      let fs = 12.5;
      const fit = () => box.style.setProperty('--xfs', fs + 'px');
      fit();
      while (t.scrollWidth > box.clientWidth - 28 && fs > 7.5) { fs -= 0.5; fit(); }
      if (t.scrollWidth > box.clientWidth - 28) box.classList.add('xt-wrap');
      const canvas = await html2canvas(box, { scale: 1, width: 800, windowWidth: 800, backgroundColor: COL.panel, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
      await saveBlob(blob, title);
    } finally { box.remove(); }
  }
  function addTableButtons(root) {
    root.querySelectorAll('.tbl-wrap[data-xt]').forEach(w => {
      if (w.previousElementSibling && w.previousElementSibling.classList.contains('xt-tools')) return;
      const bar = document.createElement('div'); bar.className = 'xt-tools';
      bar.innerHTML = '<button class="xtbl" title="Download this table as a JPG (800 px wide)">Export JPG</button>';
      w.parentNode.insertBefore(bar, w);
    });
  }
  function onExportClick(ev) {
    const tb = ev.target.closest && ev.target.closest('button.xtbl');
    if (tb) {
      const w = tb.parentNode.nextElementSibling;
      tb.disabled = true;
      exportTableJPG(w).catch(e => toast('The table could not be exported: ' + e.message)).finally(() => { tb.disabled = false; });
      return;
    }
    const btn = ev.target.closest && ev.target.closest('button.xjpg');
    if (!btn) return;
    const root = btn.closest('[data-xroot]');
    const el = root && root.querySelector('.chart');
    const chart = el && echarts.getInstanceByDom(el);
    if (!chart) { toast('This chart has not finished drawing yet.'); return; }
    let heading = root.dataset.xtitle;
    if (heading === undefined) {
      const h = root.querySelector('h2') || (root.closest('.card') && root.closest('.card').querySelector('h2'));
      heading = h ? h.textContent.trim() : 'TCTM chart';
      if (/^c{1,2}-|^cc$/.test(root.id) && root.id.startsWith('cc')) heading += ' — component analysis';
    }
    btn.disabled = true;
    exportJPG(chart, heading).finally(() => { btn.disabled = false; });
  }

const SHELL = `<header class="top">
  <div class="top-row">
    <div id="pill" class="status-pill"><span class="meta">Loading…</span></div>
    <div class="spacer"></div>
    <span id="asof" class="meta"></span>
    <button id="reload" title="Re-read every row of the sheet" type="button">Reload data</button>
  </div>
  <nav class="main">
    <a href="#tctm">TCTM</a><a href="#open">Current Open Signals</a><a href="#riskoff">Risk-Off</a><a href="#capitulation">Capitulation</a>
    <a href="#bottom">Bottom</a><a href="#thrust">Thrust</a><a href="#confirmation">Confirmation</a><a href="#trend">Long-Term Trend</a><a href="#glossary">Glossary</a>
  </nav>
</header>
<main id="view"><div class="loading">Loading…</div></main>`;

export function mountTctm(host) {
  scope = host;
  readTheme();
  host.innerHTML = SHELL;
  host.addEventListener('click', onExportClick);
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', onResize);
  themeObs = new MutationObserver(onThemeClass);
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  $('#reload').onclick = () => start();
  start();
  return () => {
    req++;
    window.removeEventListener('hashchange', route);
    window.removeEventListener('resize', onResize);
    host.removeEventListener('click', onExportClick);
    if (themeObs) { themeObs.disconnect(); themeObs = null; }
    disposeAll();
    host.innerHTML = '';
    if (scope === host) scope = null;
  };
}
