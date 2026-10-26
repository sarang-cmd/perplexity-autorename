/**
 * Bottom-Right Pixel Rename Toaster (`#ppx-autorename-toast`) on `perplexity.ai`.
 *
 * - Injects ONLY private `@font-face` declarations (`"PPX Silkscreen"`, `"PPX Inter"`)
 *   into `<head>` so Shadow-DOM text renders with crisp pixel HUD headers and ultra-readable
 *   anti-aliased body text while NEVER modifying any CSS or DOM element of Perplexity's website.
 * - Stays completely hidden when idle.
 * - Matches the exact pixel HUD design:
 *   - Watching: sky-blue border (`#38bdf8`), `WATCHING STREAM_`, 2×2 pixel spinner
 *   - Renaming: sky-blue border (`#38bdf8`), `RENAMING THREAD_`, 2×2 pixel spinner
 *   - Success: mint border (`#2dd4bf`), `✓ THREAD RENAMED`, `[LLM]`/`[FALLBACK]` badge, inner title box
 */

import { PERPLEXITY_CONFIG } from "../config/selectors.js";
import { createPixelLogoElement } from "../ui/pixel-logo.js";

const FONT_STYLE_ID = "ppx-autorename-hud-fonts";

function ensurePixelFontFaces(doc, chromeObj) {
  if (!doc?.head || doc.getElementById(FONT_STYLE_ID)) return;
  const getUrl = (rel) =>
    chromeObj?.runtime?.getURL ? chromeObj.runtime.getURL(rel) : rel;

  const style = doc.createElement("style");
  style.id = FONT_STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "PPX Silkscreen";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("${getUrl("fonts/Silkscreen-Regular.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX Silkscreen";
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url("${getUrl("fonts/Silkscreen-Bold.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX Inter";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("${getUrl("fonts/Inter-Regular.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX Inter";
      font-style: normal;
      font-weight: 600;
      font-display: swap;
      src: url("${getUrl("fonts/Inter-SemiBold.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX JetBrains Mono";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url("${getUrl("fonts/JetBrainsMono-Medium.woff2")}") format("woff2");
    }
  `;
  doc.head.appendChild(style);
}

const SHADOW_CSS = `
  :host {
    all: initial;
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483646;
    pointer-events: none;
    font-family: "PPX Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .toast {
    pointer-events: auto;
    min-width: 310px;
    max-width: 380px;
    background: #11222b;
    color: #f0fdfa;
    border: 2px solid #38bdf8;
    box-shadow: 5px 5px 0 #050b0e;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .toast.hidden {
    display: none !important;
  }

  .toast[data-state="watching"],
  .toast[data-state="renaming"] {
    border-color: #38bdf8;
  }

  .toast[data-state="success"] {
    border-color: #2dd4bf;
  }

  .toast[data-state="warn"] {
    border-color: #f59e0b;
  }

  .toast[data-state="error"] {
    border-color: #f87171;
  }

  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .hdr-left {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .logo {
    flex-shrink: 0;
    display: block;
    image-rendering: pixelated;
  }

  .label {
    font-family: "PPX Silkscreen", monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #f0fdfa;
    white-space: nowrap;
  }

  .hdr-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* 2x2 Pixel Matrix Spinner */
  .px-spinner {
    display: grid;
    grid-template-columns: 7px 7px;
    grid-template-rows: 7px 7px;
    gap: 2px;
  }

  .px-spinner.hidden {
    display: none;
  }

  .px-cell {
    width: 7px;
    height: 7px;
    background: #1e3a49;
    animation: ppx-matrix 0.8s steps(1, end) infinite;
  }
  .px-cell:nth-child(1) { animation-delay: 0s; }
  .px-cell:nth-child(2) { animation-delay: 0.2s; }
  .px-cell:nth-child(4) { animation-delay: 0.4s; }
  .px-cell:nth-child(3) { animation-delay: 0.6s; }

  @keyframes ppx-matrix {
    0%, 24% { background: #5eead4; }
    25%, 49% { background: #2dd4bf; }
    50%, 100% { background: #1e3a49; }
  }

  .pill {
    font-family: "PPX Silkscreen", monospace;
    font-size: 10px;
    font-weight: 400;
    padding: 3px 7px;
    background: #153b40;
    color: #5eead4;
    border: 1px solid #2dd4bf;
    text-transform: uppercase;
    line-height: 1.1;
  }

  .pill.warn {
    background: #3b2a11;
    color: #fcd34d;
    border-color: #f59e0b;
  }

  .pill.hidden {
    display: none;
  }

  .close-btn {
    appearance: none;
    width: 22px;
    height: 22px;
    border: 1px solid #254656;
    background: #0b161c;
    color: #94a3b8;
    font-family: "PPX Silkscreen", monospace;
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    border-color: #2dd4bf;
    color: #f0fdfa;
  }

  .body-msg {
    font-family: "PPX Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13.5px;
    line-height: 1.45;
    color: #cbd5e1;
    word-break: break-word;
    -webkit-font-smoothing: antialiased;
  }

  .body-msg.title-box {
    background: #0b161c;
    border: 1px solid #244554;
    padding: 9px 11px;
    color: #f0fdfa;
    font-size: 14px;
    font-weight: 600;
  }

  .progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-wrap.hidden {
    display: none !important;
  }

  .progress-track {
    width: 100%;
    height: 10px;
    background: #0b161c;
    border: 1px solid #254656;
    padding: 1px;
    box-sizing: border-box;
  }

  .progress-fill {
    height: 100%;
    width: 0%;
    background: repeating-linear-gradient(
      90deg,
      #2dd4bf 0px,
      #2dd4bf 7px,
      #0f766e 7px,
      #0f766e 9px
    );
  }

  .footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .footer-row.hidden {
    display: none !important;
  }

  .footer-sub {
    font-family: "PPX JetBrains Mono", "PPX Inter", monospace;
    font-size: 11px;
    color: #94a3b8;
    min-width: 0;
  }

  .action-btn {
    appearance: none;
    border: 1px solid #2dd4bf;
    background: #153b40;
    color: #5eead4;
    box-shadow: 2px 2px 0 #050b0e;
    font-family: "PPX Silkscreen", monospace;
    font-size: 10px;
    line-height: 1.1;
    padding: 4px 8px;
    cursor: pointer;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .action-btn:hover {
    background: #2dd4bf;
    color: #050b0e;
  }

  .action-btn.danger {
    border-color: #f87171;
    background: #35161b;
    color: #fca5a5;
  }

  .action-btn.danger:hover {
    background: #f87171;
    color: #050b0e;
  }
`;

export function createRenameToaster({
  win = globalThis.window,
  chromeObj = globalThis.chrome,
  autoHideSuccessMs = 5000,
  autoHideErrorMs = 6000,
} = {}) {
  let host = null;
  let cardEl = null;
  let labelEl = null;
  let spinnerEl = null;
  let pillEl = null;
  let bodyEl = null;
  let progressWrapEl = null;
  let progressFillEl = null;
  let footerRowEl = null;
  let footerSubEl = null;
  let actionBtnEl = null;
  let actionHandler = null;
  let hideTimer = null;

  let state = "idle";
  let settings = {
    enabled: true,
    showToast: true,
  };

  function clearTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function resetExtras() {
    actionHandler = null;
    if (progressWrapEl) progressWrapEl.className = "progress-wrap hidden";
    if (footerRowEl) footerRowEl.className = "footer-row hidden";
    if (actionBtnEl) actionBtnEl.className = "action-btn hidden";
  }

  function setFillWidth(pct) {
    if (!progressFillEl) return;
    const clamped = `${Math.max(4, Math.min(100, Math.round(pct)))}%`;
    if (progressFillEl.style) {
      progressFillEl.style.width = clamped;
    } else {
      progressFillEl.setAttribute("style", `width:${clamped}`);
    }
  }

  function ensureMounted() {
    if (cardEl) return true;
    const doc = win?.document;
    if (
      !doc ||
      typeof doc.createElement !== "function" ||
      typeof doc.getElementById !== "function"
    ) {
      return false;
    }
    const parent = doc.body || doc.documentElement;
    if (!parent || typeof parent.appendChild !== "function") return false;

    ensurePixelFontFaces(doc, chromeObj);

    const existing = doc.getElementById(PERPLEXITY_CONFIG.domMarkers.toastHostId);
    if (existing) {
      existing.remove();
    }

    host = doc.createElement("div");
    host.id = PERPLEXITY_CONFIG.domMarkers.toastHostId;
    const shadow = host.attachShadow({ mode: "open" });

    const styleEl = doc.createElement("style");
    styleEl.textContent = SHADOW_CSS;

    cardEl = doc.createElement("div");
    cardEl.className = "toast hidden";
    cardEl.setAttribute("role", "status");
    cardEl.setAttribute("aria-live", "polite");

    const hdr = doc.createElement("div");
    hdr.className = "hdr";

    const hdrLeft = doc.createElement("div");
    hdrLeft.className = "hdr-left";
    const logo = createPixelLogoElement(doc, { size: 24, className: "logo" });
    labelEl = doc.createElement("span");
    labelEl.className = "label";
    hdrLeft.append(logo, labelEl);

    const hdrRight = doc.createElement("div");
    hdrRight.className = "hdr-right";

    spinnerEl = doc.createElement("div");
    spinnerEl.className = "px-spinner hidden";
    for (let i = 0; i < 4; i++) {
      const c = doc.createElement("span");
      c.className = "px-cell";
      spinnerEl.appendChild(c);
    }

    pillEl = doc.createElement("span");
    pillEl.className = "pill hidden";

    const closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "close-btn";
    closeBtn.title = "Dismiss";
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", () => {
      dismiss();
    });

    hdrRight.append(spinnerEl, pillEl, closeBtn);
    hdr.append(hdrLeft, hdrRight);

    bodyEl = doc.createElement("div");
    bodyEl.className = "body-msg";

    progressWrapEl = doc.createElement("div");
    progressWrapEl.className = "progress-wrap hidden";
    const trackEl = doc.createElement("div");
    trackEl.className = "progress-track";
    progressFillEl = doc.createElement("div");
    progressFillEl.className = "progress-fill";
    trackEl.appendChild(progressFillEl);
    progressWrapEl.appendChild(trackEl);

    footerRowEl = doc.createElement("div");
    footerRowEl.className = "footer-row hidden";
    footerSubEl = doc.createElement("span");
    footerSubEl.className = "footer-sub";
    actionBtnEl = doc.createElement("button");
    actionBtnEl.type = "button";
    actionBtnEl.className = "action-btn";
    actionBtnEl.addEventListener("click", () => {
      if (typeof actionHandler === "function") {
        actionHandler();
      }
    });
    footerRowEl.append(footerSubEl, actionBtnEl);

    cardEl.append(hdr, bodyEl, progressWrapEl, footerRowEl);
    shadow.append(styleEl, cardEl);
    parent.appendChild(host);
    return true;
  }

  function dismiss() {
    clearTimer();
    resetExtras();
    state = "idle";
    if (cardEl) {
      cardEl.classList.add("hidden");
    }
  }

  function canDisplay(forceShow = false) {
    if (!settings.showToast) return false;
    return forceShow ? true : Boolean(settings.enabled);
  }

  function showWatching() {
    clearTimer();
    if (!canDisplay(false)) return;
    if (!ensureMounted()) return;
    resetExtras();

    state = "watching";
    cardEl.dataset.state = "watching";
    cardEl.classList.remove("hidden");
    labelEl.textContent = "WATCHING STREAM_";
    spinnerEl.classList.remove("hidden");
    pillEl.className = "pill hidden";
    bodyEl.className = "body-msg";
    bodyEl.textContent = "Answer streaming - will auto-rename when complete.";
  }

  function showRenaming({
    step = "Generating 3-7 word title...",
    label = "RENAMING THREAD_",
    forceShow = false,
  } = {}) {
    clearTimer();
    if (!canDisplay(forceShow)) return;
    if (!ensureMounted()) return;
    resetExtras();

    state = "renaming";
    cardEl.dataset.state = "renaming";
    cardEl.classList.remove("hidden");
    labelEl.textContent = label;
    spinnerEl.classList.remove("hidden");
    pillEl.className = "pill hidden";
    bodyEl.className = "body-msg";
    bodyEl.textContent = step;
  }

  function showSuccess({
    title = "",
    source = "llm",
    label = "✓ THREAD RENAMED",
    onRegenerate = null,
    forceShow = false,
  } = {}) {
    clearTimer();
    if (!canDisplay(forceShow)) return;
    if (!ensureMounted()) return;
    resetExtras();

    const isFallback = source === "heuristic";
    state = "success";
    cardEl.dataset.state = isFallback ? "warn" : "success";
    cardEl.classList.remove("hidden");
    labelEl.textContent = label;
    spinnerEl.classList.add("hidden");
    pillEl.className = `pill${isFallback ? " warn" : ""}`;
    pillEl.textContent = isFallback ? "FALLBACK" : "LLM";
    bodyEl.className = "body-msg title-box";
    bodyEl.textContent = title || "Thread renamed";

    if (typeof onRegenerate === "function") {
      actionHandler = onRegenerate;
      footerSubEl.textContent = "Want another variation?";
      actionBtnEl.className = "action-btn";
      actionBtnEl.textContent = "↻ REGEN";
      footerRowEl.className = "footer-row";
    }

    if (autoHideSuccessMs > 0) {
      hideTimer = setTimeout(() => {
        dismiss();
      }, typeof onRegenerate === "function" ? Math.max(autoHideSuccessMs, 6500) : autoHideSuccessMs);
    }
  }

  function showBatchProgress({
    phase = "renaming",
    processed = 0,
    total = 0,
    renamed = 0,
    skipped = 0,
    currentTitle = "",
    label = "Library",
    onCancel = null,
  } = {}) {
    clearTimer();
    if (!canDisplay(true)) return;
    if (!ensureMounted()) return;
    resetExtras();

    const isScan = phase === "scanning";
    const pct = isScan
      ? 12
      : total > 0
        ? Math.round((processed / total) * 100)
        : 15;

    state = "batch";
    cardEl.dataset.state = "renaming";
    cardEl.classList.remove("hidden");
    labelEl.textContent = isScan ? "SCANNING LIBRARY_" : "BATCH RENAMING_";
    spinnerEl.classList.remove("hidden");
    pillEl.className = "pill";
    pillEl.textContent = isScan ? "SCAN" : `${pct}%`;

    bodyEl.className = "body-msg";
    bodyEl.textContent = isScan
      ? `Scanning Perplexity Library (${label})…`
      : currentTitle
        ? `${processed}/${total}: ${currentTitle}`
        : `Processing ${processed} of ${total} chats…`;

    progressWrapEl.className = "progress-wrap";
    setFillWidth(pct);

    footerSubEl.textContent = isScan
      ? `${processed} threads found`
      : `${renamed} renamed · ${skipped} skipped`;

    if (typeof onCancel === "function") {
      actionHandler = onCancel;
      actionBtnEl.className = "action-btn danger";
      actionBtnEl.textContent = "■ STOP";
    } else {
      actionBtnEl.className = "action-btn hidden";
    }
    footerRowEl.className = "footer-row";
  }

  function showBatchSummary({
    renamed = 0,
    skipped = 0,
    failed = 0,
    cancelled = false,
    message = "",
  } = {}) {
    clearTimer();
    if (!canDisplay(true)) return;
    if (!ensureMounted()) return;
    resetExtras();

    state = "success";
    cardEl.dataset.state = failed > 0 && renamed === 0 ? "warn" : "success";
    cardEl.classList.remove("hidden");
    labelEl.textContent = cancelled ? "BATCH STOPPED" : "✓ BATCH COMPLETE";
    spinnerEl.classList.add("hidden");
    pillEl.className = `pill${cancelled ? " warn" : ""}`;
    pillEl.textContent = cancelled ? "STOPPED" : "DONE";
    bodyEl.className = "body-msg title-box";
    bodyEl.textContent =
      message ||
      `${renamed} chat${renamed === 1 ? "" : "s"} renamed${
        skipped > 0 ? ` · ${skipped} skipped` : ""
      }`;

    if (autoHideSuccessMs > 0) {
      hideTimer = setTimeout(() => {
        dismiss();
      }, Math.max(autoHideSuccessMs, 6500));
    }
  }

  function showError({
    message = "Could not rename thread.",
    forceShow = false,
  } = {}) {
    clearTimer();
    if (!canDisplay(forceShow)) return;
    if (!ensureMounted()) return;
    resetExtras();

    state = "error";
    cardEl.dataset.state = "error";
    cardEl.classList.remove("hidden");
    labelEl.textContent = "RENAME FAILED";
    spinnerEl.classList.add("hidden");
    pillEl.className = "pill hidden";
    bodyEl.className = "body-msg";
    bodyEl.textContent = message;

    if (autoHideErrorMs > 0) {
      hideTimer = setTimeout(() => {
        dismiss();
      }, autoHideErrorMs);
    }
  }

  function updateSettings(next = {}) {
    settings = {
      ...settings,
      ...next,
    };
    if (!settings.showToast || (!settings.enabled && state === "watching")) {
      dismiss();
    }
  }

  function destroy() {
    clearTimer();
    if (host) {
      host.remove();
      host = null;
      cardEl = null;
    }
  }

  function clearIfWatching() {
    if (state === "watching") {
      dismiss();
    }
  }

  return {
    showWatching,
    showRenaming,
    showSuccess,
    showBatchProgress,
    showBatchSummary,
    showError,
    clearIfWatching,
    dismiss,
    updateSettings,
    destroy,
    getState: () => state,
  };
}
