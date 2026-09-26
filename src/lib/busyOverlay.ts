/**
 * File: src/lib/busyOverlay.ts
 * A tiny global "busy" overlay (spinner + message) used for operations that take
 * a moment and would otherwise give no feedback — e.g. multi-select delete, which
 * runs several backend calls then a resync. Plain DOM so it can be driven from the
 * data layer (repo) without React coupling.
 */
let host: HTMLElement | null = null;
let depth = 0;

function ensureStyle() {
  if (document.getElementById("qayd-busy-style")) return;
  const s = document.createElement("style");
  s.id = "qayd-busy-style";
  s.textContent = `@keyframes qayd-spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(s);
}

/** Show the overlay (ref-counted, so nested calls are safe). */
export function showBusy(message = "Working…") {
  depth++;
  ensureStyle();
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.28);";
    host.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 28px;border-radius:14px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,0.25);">' +
      '<div style="width:34px;height:34px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:qayd-spin .7s linear infinite"></div>' +
      '<div class="qayd-busy-msg" style="font:500 13px ui-sans-serif,system-ui,-apple-system,sans-serif;color:#334155"></div>' +
      "</div>";
    document.body.appendChild(host);
  }
  const msg = host.querySelector<HTMLElement>(".qayd-busy-msg");
  if (msg) msg.textContent = message;
}

/** Hide the overlay when the last showBusy() is balanced. */
export function hideBusy() {
  depth = Math.max(0, depth - 1);
  if (depth === 0 && host) {
    host.remove();
    host = null;
  }
}
