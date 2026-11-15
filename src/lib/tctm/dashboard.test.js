import { afterEach, describe, expect, it, vi } from "vitest";
import { mountTctm } from "./dashboard.js";

function csvText() {
  const cols = 72;
  const header = Array.from({ length: cols }, (_, i) => (i === 0 ? "Date" : i === 1 ? "SPX" : "C" + i));
  const lines = [header.join(",")];
  for (let i = 0; i < 80; i++) {
    const row = Array.from({ length: cols }, () => "0");
    const d = new Date(Date.UTC(2020, 0, 2) + i * 86400000);
    row[0] = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
    row[1] = String(100 * Math.pow(1.001, i));
    row[18] = "1";
    row[19] = i < 10 ? "-1" : "1";
    if (i === 20) {
      row[20] = "1";
      row[25] = "1";
    }
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function hashTo(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

describe("TCTM dashboard", () => {
  let cleanup = () => {};

  afterEach(() => {
    cleanup();
    cleanup = () => {};
    vi.unstubAllGlobals();
    window.location.hash = "";
  });

  it("shows the share error when the sheet is not public", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, text: async () => "<html>Sign in</html>" })));
    const host = document.createElement("div");
    document.body.appendChild(host);
    cleanup = mountTctm(host);
    await vi.waitFor(() => {
      expect(host.textContent).toContain("anyone with the link");
    });
    expect(host.querySelector("#reload")).toBeTruthy();
    expect(host.querySelectorAll("nav.main a").length).toBe(9);
  });

  it("renders Dean's pages from a public CSV and keeps Weeks/Months", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => csvText() })));
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    cleanup = mountTctm(host);

    await vi.waitFor(() => {
      expect(host.textContent).toContain("Tactical Composite Trend Model");
      expect(host.textContent).toContain("Model summary");
      expect(host.querySelector("#asof").textContent).toMatch(/Data through/);
    });
    expect(host.querySelector("#pill").textContent).toContain("TCTM status");

    hashTo("#open");
    expect(host.querySelector("h1").textContent).toBe("Current open signals");

    hashTo("#riskoff");
    expect(host.querySelector("h1").textContent).toBe("Risk-Off");
    host.querySelector('button[data-h="months"]').click();
    expect(host.textContent).toContain("1 Mo");

    hashTo("#riskoff-1");
    expect(host.textContent).toContain("component");

    hashTo("#trend");
    expect(host.querySelector("h1").textContent).toBe("Long-Term Trend");

    hashTo("#glossary");
    expect(host.querySelector("h1").textContent).toBe("Glossary");
    expect(host.textContent).toContain("Capitulation Composite");

    hashTo("#tctm");
    expect(host.textContent).toContain("Model summary");
    expect(host.querySelector("nav.main a.on").getAttribute("href")).toBe("#tctm");
  });
});
