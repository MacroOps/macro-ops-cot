import { toPng } from "html-to-image";

const IGNORED_CLASSES = ["recharts-tooltip-wrapper", "recharts-tooltip-cursor"];

function shouldInclude(node: HTMLElement): boolean {
  if (node.dataset?.exportIgnore !== undefined) return false;
  const cls = node.classList;
  if (cls && IGNORED_CLASSES.some((c) => cls.contains(c))) return false;
  return true;
}

function isOpaque(color: string): boolean {
  if (!color || color === "transparent") return false;
  const m = color.match(/^rgba\(.*,\s*([\d.]+)\)$/) ?? color.match(/\/\s*([\d.]+%?)\s*\)$/);
  if (!m) return true;
  const a = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return a >= 1;
}

/** First fully opaque background up the tree, so translucent panels don't export as see-through PNGs. */
function resolveBackground(node: HTMLElement): string {
  let el: HTMLElement | null = node;
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (isOpaque(bg)) return bg;
    el = el.parentElement;
  }
  const v = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  return v ? `hsl(${v})` : "#ffffff";
}

export function chartFilename(title: string, date = new Date()): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "chart";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${slug}-${y}-${m}-${d}.png`;
}

/** Layout size (CSS px) the panel is re-flowed to before capture; output is 2x. */
const EXPORT_W = 1200;
const EXPORT_H = 675;
const PIXEL_RATIO = 2;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ExportModeListener = (scope: HTMLElement, on: boolean) => void;
const exportModeListeners = new Set<ExportModeListener>();

/** Subscribed by our ResponsiveContainer so charts inside an exported panel drop series animation. */
export function onChartExportMode(listener: ExportModeListener): () => void {
  exportModeListeners.add(listener);
  return () => {
    exportModeListeners.delete(listener);
  };
}

function setExportMode(scope: HTMLElement, on: boolean) {
  exportModeListeners.forEach((l) => l(scope, on));
}

const SHAPE_ATTRS = ["d", "x", "y", "width", "height", "stroke-dasharray"];

function shapeSignature(node: HTMLElement): string {
  let sig = "";
  node.querySelectorAll("svg path, svg rect").forEach((el) => {
    for (const a of SHAPE_ATTRS) sig += `${el.getAttribute(a) ?? ""},`;
    sig += "|";
  });
  return sig;
}

/**
 * Series aren't animated in export mode, so the chart is final once the resize
 * has propagated: wait for the SVG to change, then to hold across two frames.
 * Judged per frame rather than per wall-clock tick so throttled tabs still work.
 */
async function waitForSettledChart(node: HTMLElement, initial: string, timeoutMs = 6000): Promise<void> {
  if (!node.querySelector(".recharts-responsive-container")) return;
  const start = performance.now();
  let prev = initial;
  let changed = false;
  while (performance.now() - start < timeoutMs) {
    await nextFrame();
    await nextFrame();
    await sleep(30);
    const next = shapeSignature(node);
    if (next !== initial) changed = true;
    if (changed && next === prev) return;
    if (!changed && performance.now() - start > 1500) return;
    prev = next;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode chart image"));
    img.src = src;
  });
}

async function fitToCanvas(dataUrl: string, bg: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = EXPORT_W * PIXEL_RATIO;
  const h = EXPORT_H * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return canvas.toDataURL("image/png");
}

/**
 * Re-flows the panel off-screen at 16:9 so Recharts redraws to fill it, then
 * captures it. Panels without a `data-chart-body` keep their natural height and
 * are letterboxed into the 16:9 frame instead.
 */
export async function exportNodeToPng(node: HTMLElement, filename: string): Promise<void> {
  const bg = resolveBackground(node);
  const stretch = node.querySelector("[data-chart-body]") !== null;

  const placeholder = document.createElement("div");
  placeholder.className = node.className;
  placeholder.style.height = `${node.offsetHeight}px`;
  placeholder.style.visibility = "hidden";
  placeholder.setAttribute("aria-hidden", "true");

  setExportMode(node, true);
  await nextFrame();
  await nextFrame();
  const initial = shapeSignature(node);

  const prevStyle = node.getAttribute("style");
  node.parentNode?.insertBefore(placeholder, node);
  Object.assign(node.style, {
    position: "fixed",
    left: "-100000px",
    top: "0px",
    margin: "0px",
    transform: "none",
    maxWidth: "none",
    maxHeight: "none",
    boxSizing: "border-box",
    width: `${EXPORT_W}px`,
    height: stretch ? `${EXPORT_H}px` : "auto",
    backgroundColor: bg,
  });
  node.setAttribute("data-exporting", "");

  try {
    await waitForSettledChart(node, initial);

    const raw = await toPng(node, {
      pixelRatio: PIXEL_RATIO,
      width: node.offsetWidth,
      height: node.offsetHeight,
      cacheBust: true,
      backgroundColor: bg,
      style: { position: "static", left: "0px", top: "0px", margin: "0px", transform: "none" },
      filter: (n) => !(n instanceof HTMLElement) || shouldInclude(n),
    });
    const dataUrl = await fitToCanvas(raw, bg);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  } finally {
    node.removeAttribute("data-exporting");
    if (prevStyle === null) node.removeAttribute("style");
    else node.setAttribute("style", prevStyle);
    placeholder.remove();
    setExportMode(node, false);
  }
}
