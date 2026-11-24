import { toPng } from "html-to-image";
import { readChartToken } from "@/lib/chartTheme";
import { exportDateLabel, exportFilename } from "@/lib/exportNaming";

const IGNORED_CLASSES = ["recharts-tooltip-wrapper", "recharts-tooltip-cursor"];

function shouldInclude(node: HTMLElement): boolean {
  if (node.dataset?.exportIgnore !== undefined) return false;
  const cls = node.classList;
  if (cls && IGNORED_CLASSES.some((c) => cls.contains(c))) return false;
  return true;
}

/**
 * Same output as the TCTM JPG buttons: JPEG on white, 1200x900. The layout is 800x600 CSS px
 * and is rendered at 1.5x, so the file is sharper but the composition is the same as on screen.
 */
const EXPORT_W = 800;
const EXPORT_H = 600;
const PIXEL_RATIO = 1.5;
const JPEG_QUALITY = 0.95;

/** What stays in an exported panel: the plot area plus anything flagged as a legend or caption. */
const KEEP_SELECTOR = "[data-chart-body], [data-export-keep]";

/**
 * Hides toolbars, controls, KPI strips and the panel's own title so the capture is only the chart
 * under a uniform heading. Ancestors of a kept element stay (their other children are hidden).
 */
function hidePanelChrome(node: HTMLElement): () => void {
  const hidden: HTMLElement[] = [];
  if (node.querySelector(KEEP_SELECTOR)) {
    const visit = (el: HTMLElement) => {
      for (const child of Array.from(el.children) as HTMLElement[]) {
        if (child.matches(KEEP_SELECTOR)) continue;
        if (child.querySelector(KEEP_SELECTOR)) {
          visit(child);
          continue;
        }
        child.setAttribute("data-export-hidden", "");
        hidden.push(child);
      }
    };
    visit(node);
  }
  return () => hidden.forEach((h) => h.removeAttribute("data-export-hidden"));
}

/** Title on the left, date on the right: the same strip TCTM draws above its charts. */
function insertHeading(node: HTMLElement, heading: string, dateLabel: string): () => void {
  const el = document.createElement("div");
  el.className = "export-heading";
  el.setAttribute("data-export-heading", "");
  const b = document.createElement("b");
  b.textContent = heading.charAt(0).toUpperCase() + heading.slice(1);
  const s = document.createElement("span");
  s.textContent = dateLabel;
  el.append(b, s);
  node.insertBefore(el, node.firstChild);
  return () => el.remove();
}

export interface ChartExportOptions {
  /** Heading drawn at the top of the image and the base of the file name. */
  title: string;
  /** Date of the last data point (ISO). Falls back to the export day. */
  asOf?: string | null;
  /** Overrides the heading when it should differ from the file name base. */
  heading?: string;
}

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

async function fitToCanvas(dataUrl: string, bg: string): Promise<Blob> {
  const img = await loadImage(dataUrl);
  const w = EXPORT_W * PIXEL_RATIO;
  const h = EXPORT_H * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  // JPEG has no alpha, so the white fill above is what the viewer sees.
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the JPG"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/**
 * Saves a blob the way the TCTM buttons do: object URL on an anchor that is attached to the page
 * for the click. A detached anchor with a large data: URL is ignored by some browsers.
 */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
}

/**
 * Re-flows the panel off-screen at 800x600 so Recharts redraws to fill it, then captures it as a
 * JPG: uniform heading, chart only (toolbars and controls hidden), white background. Panels
 * without a `data-chart-body` keep their natural height and are letterboxed into the frame.
 */
export async function exportNodeToJpg(node: HTMLElement, opts: ChartExportOptions): Promise<void> {
  const bg = readChartToken("--export-surface");
  const stretch = node.querySelector("[data-chart-body]") !== null;
  const filename = exportFilename(opts.title, opts.asOf, "jpg");

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
  const showChrome = hidePanelChrome(node);
  const removeHeading = insertHeading(node, opts.heading ?? opts.title, exportDateLabel(opts.asOf));

  try {
    await waitForSettledChart(node, initial);

    // Content that does not shrink (tables, heatmaps) can be taller than the frame: grow the node
    // to fit it and let fitToCanvas scale the whole thing into 800x600 instead of cutting it off.
    if (node.scrollHeight > node.clientHeight + 1) {
      node.style.height = `${node.scrollHeight}px`;
      await nextFrame();
      await nextFrame();
    }

    const raw = await toPng(node, {
      pixelRatio: PIXEL_RATIO,
      width: node.offsetWidth,
      height: node.offsetHeight,
      cacheBust: true,
      backgroundColor: bg,
      style: { position: "static", left: "0px", top: "0px", margin: "0px", transform: "none" },
      filter: (n) => !(n instanceof HTMLElement) || shouldInclude(n),
    });
    const jpg = await fitToCanvas(raw, bg);
    saveBlob(jpg, filename);
  } finally {
    removeHeading();
    showChrome();
    node.removeAttribute("data-exporting");
    if (prevStyle === null) node.removeAttribute("style");
    else node.setAttribute("style", prevStyle);
    placeholder.remove();
    setExportMode(node, false);
  }
}
