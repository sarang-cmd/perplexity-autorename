/**
 * Toolbar Popup controller (`extension/popup.html`).
 *
 * Security invariants:
 * - Never calls `getApiKey()` (uses `hasApiKey()` and `setApiKey()`).
 * - Requests optional runtime host permissions directly inside user-gesture handlers.
 */

import { MESSAGE_NS, RUNTIME_MESSAGES } from "../config/selectors.js";
import {
  STORAGE_KEYS,
  getSettings,
  saveSettings,
  hasApiKey,
  setApiKey,
  getLastStatus,
  getBatchStatus,
} from "../lib/storage.js";
import {
  PROVIDER_LIST,
  getProviderSpec,
  getProviderOriginPattern,
} from "../lib/providers/index.js";
import { createPixelLogoElement } from "../ui/pixel-logo.js";

const els = {
  logoSlot: document.getElementById("popup-logo-slot"),
  enabled: document.getElementById("popup-enabled"),
  enabledLabel: document.getElementById("popup-enabled-label"),

  statusBox: document.getElementById("popup-status-box"),
  statusSummary: document.getElementById("popup-status-summary"),
  statusBadge: document.getElementById("popup-status-badge"),
  statusDetail: document.getElementById("popup-status-detail"),

  openChatBadge: document.getElementById("popup-open-chat-badge"),
  renameCurrentBtn: document.getElementById("popup-rename-current-btn"),
  regenCurrentBtn: document.getElementById("popup-regen-current-btn"),
  currentFeedback: document.getElementById("popup-current-feedback"),
  batchPreset: document.getElementById("popup-batch-preset"),
  batchCustom: document.getElementById("popup-batch-custom"),
  skipRenamed: document.getElementById("popup-skip-renamed"),
  startBatchBtn: document.getElementById("popup-start-batch-btn"),
  stopBatchBtn: document.getElementById("popup-stop-batch-btn"),
  batchProgress: document.getElementById("popup-batch-progress"),
  batchLabel: document.getElementById("popup-batch-label"),
  batchPct: document.getElementById("popup-batch-pct"),
  batchFill: document.getElementById("popup-batch-fill"),
  batchStats: document.getElementById("popup-batch-stats"),

  provider: document.getElementById("popup-provider"),
  model: document.getElementById("popup-model"),
  customUrlWrap: document.getElementById("popup-custom-url-wrap"),
  customUrl: document.getElementById("popup-custom-url"),
  apiKey: document.getElementById("popup-api-key"),
  keyBadge: document.getElementById("popup-key-badge"),
  saveBtn: document.getElementById("popup-save-btn"),
  testBtn: document.getElementById("popup-test-btn"),
  feedback: document.getElementById("popup-feedback"),

  showToast: document.getElementById("popup-show-toast"),
  prefix: document.getElementById("popup-prefix"),

  permBadge: document.getElementById("popup-perm-badge"),
  grantBtn: document.getElementById("popup-grant-btn"),
  openOptions: document.getElementById("popup-open-options"),
};

let lastProvider = "groq";

function showFeedback(kind, text) {
  els.feedback.className = `feedback visible ${kind}`;
  els.feedback.textContent = text;
}

function showCurrentFeedback(kind, text) {
  if (!els.currentFeedback) return;
  els.currentFeedback.className = `feedback visible ${kind}`;
  els.currentFeedback.textContent = text;
}

function buildPopupBatchSpec() {
  const raw = els.batchPreset?.value || "count:50";
  const skipAlreadyRenamed = Boolean(els.skipRenamed?.checked);
  if (raw === "all") return { mode: "all", skipAlreadyRenamed };
  if (raw === "custom-count") {
    return {
      mode: "count",
      count: Math.max(1, Math.min(5000, Number(els.batchCustom?.value) || 100)),
      skipAlreadyRenamed,
    };
  }
  if (raw === "custom-days") {
    return {
      mode: "days",
      days: Math.max(1, Math.min(3650, Number(els.batchCustom?.value) || 14)),
      skipAlreadyRenamed,
    };
  }
  const [mode, num] = raw.split(":");
  return mode === "days"
    ? { mode: "days", days: Math.max(1, Number(num) || 30), skipAlreadyRenamed }
    : { mode: "count", count: Math.max(1, Number(num) || 50), skipAlreadyRenamed };
}

function renderActiveThreadBadge(activeThread) {
  if (!els.openChatBadge) return;
  if (activeThread?.isThreadOpen) {
    els.openChatBadge.className = "badge ok";
    els.openChatBadge.textContent = "CHAT OPEN";
  } else if (activeThread?.hasPerplexityTab) {
    els.openChatBadge.className = "badge warn";
    els.openChatBadge.textContent = "HOME / LIBRARY";
  } else {
    els.openChatBadge.className = "badge";
    els.openChatBadge.textContent = "NO TAB";
  }
}

function renderBatchStatus(batch) {
  if (!els.batchProgress) return;
  if (!batch) {
    els.batchProgress.classList.add("hidden");
    els.startBatchBtn?.classList.remove("hidden");
    els.stopBatchBtn?.classList.add("hidden");
    return;
  }

  const running = Boolean(batch.running);
  els.batchProgress.classList.remove("hidden");
  els.batchProgress.classList.toggle("running", running);
  els.startBatchBtn?.classList.toggle("hidden", running);
  els.stopBatchBtn?.classList.toggle("hidden", !running);

  if (running) {
    const isScan = batch.phase === "scanning";
    const pct = isScan
      ? 12
      : batch.total > 0
        ? Math.round((batch.processed / batch.total) * 100)
        : 15;
    els.batchLabel.textContent =
      batch.message ||
      (isScan
        ? "Scanning library…"
        : `Renaming ${batch.processed}/${batch.total}…`);
    els.batchPct.textContent = isScan ? "SCAN" : `${pct}%`;
    els.batchFill.style.width = `${Math.max(6, Math.min(100, pct))}%`;
    els.batchStats.textContent = isScan
      ? `${batch.scanned || 0} chats discovered`
      : `${batch.renamed || 0} renamed · ${batch.skipped || 0} skipped`;
  } else {
    const isErr = batch.state === "error";
    const pct =
      batch.total > 0
        ? Math.round(((batch.processed || 0) / batch.total) * 100)
        : 100;
    els.batchLabel.textContent = batch.message || "Batch complete";
    els.batchPct.textContent = isErr ? "ERR" : `${pct}%`;
    els.batchFill.style.width = `${isErr ? 100 : Math.max(0, Math.min(100, pct))}%`;
    els.batchStats.textContent = `${batch.renamed || 0} renamed · ${batch.skipped || 0} skipped${
      batch.failed ? ` · ${batch.failed} failed` : ""
    }`;
  }
}

function renderStatus(status) {
  if (!status || typeof status !== "object") {
    els.statusBox.className = "status-banner";
    els.statusBadge.className = "badge";
    els.statusBadge.textContent = "IDLE";
    els.statusSummary.textContent = "No rename activity yet";
    els.statusDetail.textContent =
      "Ask a question in a fresh Perplexity tab to auto-rename.";
    return;
  }

  if (status.outcome === "renamed") {
    const isFallback = status.source === "heuristic";
    els.statusBox.className = `status-banner ${isFallback ? "warn" : "ok"}`;
    els.statusBadge.className = `badge ${isFallback ? "warn" : "ok"}`;
    els.statusBadge.textContent = isFallback ? "FALLBACK" : "LLM";
    els.statusSummary.textContent = status.title || "Thread renamed";
    els.statusDetail.textContent = status.error
      ? `Fallback reason: ${status.error}`
      : `HTTP ${status.httpStatus || 204} via ${status.provider || "provider"}`;
    return;
  }

  if (status.outcome === "skipped") {
    els.statusBox.className = "status-banner";
    els.statusBadge.className = "badge";
    els.statusBadge.textContent = "SKIPPED";
    els.statusSummary.textContent = `Skipped (${status.reason || "rule"})`;
    els.statusDetail.textContent =
      status.error || "Thread was not eligible for auto-rename.";
    return;
  }

  els.statusBox.className = "status-banner err";
  els.statusBadge.className = "badge err";
  els.statusBadge.textContent = "ERROR";
  els.statusSummary.textContent = `Failed (${status.reason || "error"})`;
  els.statusDetail.textContent = status.error || "Open Full Settings for details.";
}

async function refreshKeyBadge(providerId) {
  const spec = getProviderSpec(providerId);
  const saved = await hasApiKey(providerId);
  if (saved) {
    els.keyBadge.className = "badge ok";
    els.keyBadge.textContent = "KEY SAVED";
    els.apiKey.placeholder = "Key saved - paste to replace";
  } else if (!spec.requiresKey) {
    els.keyBadge.className = "badge ok";
    els.keyBadge.textContent = "OPTIONAL";
    els.apiKey.placeholder = "Optional API key";
  } else {
    els.keyBadge.className = "badge warn";
    els.keyBadge.textContent = "NO KEY";
    els.apiKey.placeholder = `Paste ${spec.label} key`;
  }
}

async function refreshHostPerm() {
  const originPattern = getProviderOriginPattern(
    els.provider.value,
    els.customUrl.value.trim()
  );
  if (!originPattern) {
    els.permBadge.className = "badge warn";
    els.permBadge.textContent = "ENTER BASE URL";
    els.grantBtn.classList.add("hidden");
    return false;
  }
  if (!chrome?.permissions?.contains) {
    els.permBadge.className = "badge ok";
    els.permBadge.textContent = "HOST OK";
    els.grantBtn.classList.add("hidden");
    return true;
  }
  const granted = await chrome.permissions.contains({
    origins: [originPattern],
  });
  if (granted) {
    els.permBadge.className = "badge ok";
    els.permBadge.textContent = "HOST ACCESS OK";
    els.grantBtn.classList.add("hidden");
  } else {
    els.permBadge.className = "badge warn";
    els.permBadge.textContent = "HOST NOT GRANTED";
    els.grantBtn.classList.remove("hidden");
  }
  return granted;
}

async function requestPermFromGesture() {
  const originPattern = getProviderOriginPattern(
    els.provider.value,
    els.customUrl.value.trim()
  );
  if (!originPattern || !chrome?.permissions?.request) return true;
  try {
    const has = await chrome.permissions.contains({ origins: [originPattern] });
    if (has) return true;
    const granted = await chrome.permissions.request({
      origins: [originPattern],
    });
    await refreshHostPerm();
    return granted;
  } catch {
    return false;
  }
}

async function persistQuickFields() {
  const provider = els.provider.value;
  const spec = getProviderSpec(provider);
  const model = els.model.value.trim() || spec.defaultModel;
  await saveSettings({
    enabled: els.enabled.checked,
    provider,
    model,
    customBaseUrl: els.customUrl.value.trim(),
    showToast: els.showToast.checked,
    titlePrefix: els.prefix.value.trim(),
  });
  return { provider, model };
}

async function init() {
  if (els.logoSlot) {
    els.logoSlot.appendChild(
      createPixelLogoElement(document, { size: 32, className: "brand-logo" })
    );
  }

  for (const spec of PROVIDER_LIST) {
    const opt = document.createElement("option");
    opt.value = spec.id;
    opt.textContent = spec.label;
    els.provider.appendChild(opt);
  }

  const [settings, lastStatus, storedBatch, swState] = await Promise.all([
    getSettings(),
    getLastStatus(),
    getBatchStatus(),
    chrome?.runtime?.sendMessage
      ? chrome.runtime
          .sendMessage({ ns: MESSAGE_NS, type: RUNTIME_MESSAGES.GET_STATE })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  lastProvider = settings.provider;
  els.enabled.checked = settings.enabled;
  els.enabledLabel.textContent = settings.enabled ? "ON" : "OFF";
  els.provider.value = settings.provider;
  els.model.value = settings.model;
  els.customUrl.value = settings.customBaseUrl;
  els.showToast.checked = settings.showToast;
  els.prefix.value = settings.titlePrefix;

  els.customUrlWrap.classList.toggle("hidden", settings.provider !== "custom");
  renderStatus(lastStatus);
  renderBatchStatus(swState?.batchStatus || storedBatch);
  if (swState?.activeThread) {
    renderActiveThreadBadge(swState.activeThread);
  }
  await refreshKeyBadge(settings.provider);
  await refreshHostPerm();

  els.enabled.addEventListener("change", async () => {
    els.enabledLabel.textContent = els.enabled.checked ? "ON" : "OFF";
    await saveSettings({ enabled: els.enabled.checked });
  });

  els.showToast.addEventListener("change", async () => {
    await saveSettings({ showToast: els.showToast.checked });
  });

  els.prefix.addEventListener("change", async () => {
    await saveSettings({ titlePrefix: els.prefix.value.trim() });
  });

  els.provider.addEventListener("change", async () => {
    const nextProvider = els.provider.value;
    const prevSpec = getProviderSpec(lastProvider);
    const nextSpec = getProviderSpec(nextProvider);
    if (
      !els.model.value.trim() ||
      els.model.value.trim() === prevSpec.defaultModel
    ) {
      els.model.value = nextSpec.defaultModel;
    }
    lastProvider = nextProvider;
    els.apiKey.value = "";
    els.customUrlWrap.classList.toggle("hidden", nextProvider !== "custom");
    await refreshKeyBadge(nextProvider);
    await refreshHostPerm();
  });

  els.customUrl.addEventListener("input", refreshHostPerm);

  els.grantBtn.addEventListener("click", async () => {
    const ok = await requestPermFromGesture();
    showFeedback(
      ok ? "ok" : "warn",
      ok ? "Host access granted." : "Permission not granted."
    );
  });

  els.saveBtn.addEventListener("click", async () => {
    const permOk = await requestPermFromGesture();
    const { provider, model } = await persistQuickFields();
    els.model.value = model;

    const typedKey = els.apiKey.value.trim();
    if (typedKey) {
      await setApiKey(provider, typedKey);
      els.apiKey.value = "";
    }
    await refreshKeyBadge(provider);
    await refreshHostPerm();

    showFeedback(
      permOk ? "ok" : "warn",
      permOk
        ? "Settings saved."
        : "Saved, but host permission is still needed — click Grant Access."
    );
  });

  els.testBtn.addEventListener("click", async () => {
    els.testBtn.disabled = true;
    showFeedback("warn", "Testing LLM connection…");
    await requestPermFromGesture();

    const provider = els.provider.value;
    const spec = getProviderSpec(provider);
    const model = els.model.value.trim() || spec.defaultModel;
    const customBaseUrl = els.customUrl.value.trim();
    const apiKey = els.apiKey.value.trim();

    try {
      const res = await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.TEST_PROVIDER,
        provider,
        model,
        customBaseUrl,
        apiKey,
      });
      if (res?.ok) {
        showFeedback("ok", `Success (${res.latencyMs}ms): "${res.title}"`);
      } else {
        showFeedback("err", res?.error || "Provider test failed");
      }
    } catch (err) {
      showFeedback("err", err?.message || "Service worker error");
    } finally {
      els.testBtn.disabled = false;
    }
  });

  async function runOpenChatAction(regenerate) {
    await requestPermFromGesture();
    els.renameCurrentBtn.disabled = true;
    els.regenCurrentBtn.disabled = true;
    showCurrentFeedback(
      "warn",
      regenerate ? "Regenerating fresh title…" : "Renaming open chat…"
    );
    try {
      const res = await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.RENAME_CURRENT_CHAT,
        regenerate,
      });
      if (res?.ok && res.title) {
        showCurrentFeedback(
          "ok",
          `${regenerate ? "Regenerated" : "Renamed"}: "${res.title}"`
        );
      } else {
        showCurrentFeedback(
          "err",
          res?.error || "Open a Perplexity chat (/search/...) first."
        );
      }
    } catch (err) {
      showCurrentFeedback("err", err?.message || "Could not reach Perplexity tab.");
    } finally {
      els.renameCurrentBtn.disabled = false;
      els.regenCurrentBtn.disabled = false;
    }
  }

  els.renameCurrentBtn?.addEventListener("click", () => {
    runOpenChatAction(false);
  });

  els.regenCurrentBtn?.addEventListener("click", () => {
    runOpenChatAction(true);
  });

  els.batchPreset?.addEventListener("change", () => {
    const val = els.batchPreset.value;
    if (val === "custom-count") {
      els.batchCustom.classList.remove("hidden");
      els.batchCustom.value = "100";
    } else if (val === "custom-days") {
      els.batchCustom.classList.remove("hidden");
      els.batchCustom.value = "14";
    } else {
      els.batchCustom.classList.add("hidden");
    }
  });

  els.startBatchBtn?.addEventListener("click", async () => {
    await requestPermFromGesture();
    const spec = buildPopupBatchSpec();
    els.startBatchBtn.disabled = true;
    renderBatchStatus({
      running: true,
      phase: "scanning",
      scanned: 0,
      processed: 0,
      total: 0,
      renamed: 0,
      skipped: 0,
      message: "Starting library scan on Perplexity…",
    });
    try {
      const res = await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.START_BATCH_RENAME,
        spec,
      });
      if (!res?.ok) {
        renderBatchStatus({
          running: false,
          state: "error",
          processed: 0,
          total: 0,
          renamed: 0,
          skipped: 0,
          failed: 1,
          message: res?.error || "Could not start batch library rename.",
        });
      }
    } catch (err) {
      renderBatchStatus({
        running: false,
        state: "error",
        processed: 0,
        total: 0,
        renamed: 0,
        skipped: 0,
        failed: 1,
        message: err?.message || "Service worker error",
      });
    } finally {
      els.startBatchBtn.disabled = false;
    }
  });

  els.stopBatchBtn?.addEventListener("click", async () => {
    els.stopBatchBtn.disabled = true;
    try {
      await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.CANCEL_BATCH_RENAME,
      });
    } finally {
      els.stopBatchBtn.disabled = false;
    }
  });

  els.openOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEYS.LAST_STATUS]) {
        renderStatus(changes[STORAGE_KEYS.LAST_STATUS].newValue);
      }
      if (changes[STORAGE_KEYS.BATCH_STATUS]) {
        renderBatchStatus(changes[STORAGE_KEYS.BATCH_STATUS].newValue || null);
      }
    });
  }
}

init();
