/**
 * Options page controller (`extension/options.html`).
 *
 * Security invariants:
 * - Never calls `getApiKey()` (uses `hasApiKey()`, `setApiKey()`, and `clearApiKey()`).
 * - Requests optional runtime host permissions inside user-gesture button handlers.
 * - Live-renders `lastStatus`, `settings`, and `renameHistory` via `chrome.storage.onChanged`.
 */

import {
  MESSAGE_NS,
  RUNTIME_MESSAGES,
  PERPLEXITY_CONFIG,
} from "../config/selectors.js";
import {
  STORAGE_KEYS,
  getSettings,
  saveSettings,
  hasApiKey,
  setApiKey,
  clearApiKey,
  getHistory,
  clearHistory,
  getLastStatus,
  getBatchStatus,
} from "../lib/storage.js";
import {
  PROVIDER_LIST,
  getProviderSpec,
  getProviderOriginPattern,
} from "../lib/providers/index.js";
import { compileExcludePatterns } from "../lib/decide.js";
import { createPixelLogoElement } from "../ui/pixel-logo.js";

const els = {
  logoSlot: document.getElementById("options-logo-slot"),
  lastStatusBox: document.getElementById("last-status-box"),
  lastStatusSummary: document.getElementById("last-status-summary"),
  lastStatusTime: document.getElementById("last-status-time"),
  lastStatusDetail: document.getElementById("last-status-detail"),

  optBatchBadge: document.getElementById("opt-batch-badge"),
  optRenameCurrentBtn: document.getElementById("opt-rename-current-btn"),
  optRegenCurrentBtn: document.getElementById("opt-regen-current-btn"),
  optCurrentFeedback: document.getElementById("opt-current-feedback"),
  optPresetChips: document.getElementById("opt-preset-chips"),
  optBatchMode: document.getElementById("opt-batch-mode"),
  optBatchNumberWrap: document.getElementById("opt-batch-number-wrap"),
  optBatchNumberLabel: document.getElementById("opt-batch-number-label"),
  optBatchNumber: document.getElementById("opt-batch-number"),
  optSkipRenamed: document.getElementById("opt-skip-renamed"),
  optStartBatchBtn: document.getElementById("opt-start-batch-btn"),
  optStopBatchBtn: document.getElementById("opt-stop-batch-btn"),
  optBatchProgress: document.getElementById("opt-batch-progress"),
  optBatchLabel: document.getElementById("opt-batch-label"),
  optBatchPct: document.getElementById("opt-batch-pct"),
  optBatchFill: document.getElementById("opt-batch-fill"),
  optBatchStats: document.getElementById("opt-batch-stats"),

  providerSelect: document.getElementById("provider-select"),
  modelInput: document.getElementById("model-input"),
  customUrlField: document.getElementById("custom-url-field"),
  customUrlInput: document.getElementById("custom-url-input"),
  apiKeyInput: document.getElementById("api-key-input"),
  keyStatusBadge: document.getElementById("key-status-badge"),
  clearKeyBtn: document.getElementById("clear-key-btn"),
  hostPermBadge: document.getElementById("host-perm-badge"),
  hostPermOrigin: document.getElementById("host-perm-origin"),
  grantPermBtn: document.getElementById("grant-perm-btn"),
  saveBtn: document.getElementById("save-btn"),
  testBtn: document.getElementById("test-btn"),
  providerFeedback: document.getElementById("provider-feedback"),

  enabledCheckbox: document.getElementById("enabled-checkbox"),
  showToastCheckbox: document.getElementById("show-toast-checkbox"),
  prefixInput: document.getElementById("prefix-input"),
  excludeTextarea: document.getElementById("exclude-textarea"),
  regexValidationMsg: document.getElementById("regex-validation-msg"),
  debugCheckbox: document.getElementById("debug-checkbox"),
  saveRulesBtn: document.getElementById("save-rules-btn"),
  rulesFeedback: document.getElementById("rules-feedback"),

  clearHistoryBtn: document.getElementById("clear-history-btn"),
  historyEmpty: document.getElementById("history-empty"),
  historyTable: document.getElementById("history-table"),
  historyTbody: document.getElementById("history-tbody"),
};

let lastKnownProvider = "groq";

function showFeedback(el, kind, text) {
  if (!el) return;
  el.className = `feedback visible ${kind}`;
  el.textContent = text;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function renderLastStatus(status) {
  if (!status || typeof status !== "object") {
    els.lastStatusBox.className = "status-banner";
    els.lastStatusSummary.textContent = "No rename attempts recorded yet.";
    els.lastStatusTime.textContent = "";
    els.lastStatusDetail.textContent =
      "Open a fresh Perplexity tab and ask a new question to trigger auto-renaming.";
    return;
  }

  els.lastStatusTime.textContent = formatTimestamp(status.timestamp);

  if (status.outcome === "renamed") {
    const usedHeuristic = status.source === "heuristic";
    els.lastStatusBox.className = `status-banner ${usedHeuristic ? "warn" : "ok"}`;
    const sourceLabel = usedHeuristic
      ? `Heuristic fallback${status.provider ? ` (${status.provider} failed)` : ""}`
      : `LLM (${status.provider || "provider"})`;

    els.lastStatusSummary.textContent = usedHeuristic
      ? `Renamed using keyword heuristic - "${status.title || ""}"`
      : `Renamed via ${sourceLabel} - "${status.title || ""}"`;

    els.lastStatusDetail.textContent = status.error
      ? `HTTP ${status.httpStatus || 204} · LLM fallback reason: ${status.error}`
      : `Source: ${sourceLabel} · Perplexity API status: ${status.httpStatus || 204}`;
    return;
  }

  if (status.outcome === "skipped") {
    els.lastStatusBox.className = "status-banner";
    els.lastStatusSummary.textContent = `Skipped (${status.reason || "rule"})`;
    els.lastStatusDetail.textContent =
      status.error ||
      `Decision reason: ${status.reason || "not eligible for auto-rename"}.`;
    return;
  }

  els.lastStatusBox.className = "status-banner err";
  els.lastStatusSummary.textContent = `Rename failed (${status.reason || "error"})`;
  els.lastStatusDetail.textContent =
    status.error ||
    `HTTP status: ${status.httpStatus ?? "n/a"}`;
}

function renderHistory(items) {
  els.historyTbody.textContent = "";
  if (!Array.isArray(items) || items.length === 0) {
    els.historyEmpty.classList.remove("hidden");
    els.historyTable.classList.add("hidden");
    return;
  }

  els.historyEmpty.classList.add("hidden");
  els.historyTable.classList.remove("hidden");

  for (const item of items) {
    const tr = document.createElement("tr");

    const titleTd = document.createElement("td");
    if (item.backendUuid) {
      const link = document.createElement("a");
      link.href = `${PERPLEXITY_CONFIG.origin}${PERPLEXITY_CONFIG.searchPathPrefix}${encodeURIComponent(item.backendUuid)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title || "(untitled)";
      titleTd.appendChild(link);
    } else {
      titleTd.textContent = item.title || "(untitled)";
    }

    const sourceTd = document.createElement("td");
    const badge = document.createElement("span");
    const isHeuristic = item.source === "heuristic";
    badge.className = `badge ${isHeuristic ? "warn" : "ok"}`;
    badge.textContent = isHeuristic
      ? "HEURISTIC"
      : `LLM${item.provider ? ` · ${item.provider}` : ""}`;
    if (item.error) {
      badge.title = item.error;
    }
    sourceTd.appendChild(badge);

    const timeTd = document.createElement("td");
    timeTd.textContent = formatTimestamp(item.timestamp);

    tr.append(titleTd, sourceTd, timeTd);
    els.historyTbody.appendChild(tr);
  }
}

async function refreshKeyBadge(providerId) {
  const spec = getProviderSpec(providerId);
  const saved = await hasApiKey(providerId);
  if (saved) {
    els.keyStatusBadge.className = "badge ok";
    els.keyStatusBadge.textContent = "KEY SAVED";
    els.apiKeyInput.placeholder = "Key saved - enter a new key to replace";
  } else if (!spec.requiresKey) {
    els.keyStatusBadge.className = "badge ok";
    els.keyStatusBadge.textContent = "OPTIONAL";
    els.apiKeyInput.placeholder = "Optional API key";
  } else {
    els.keyStatusBadge.className = "badge warn";
    els.keyStatusBadge.textContent = "NO KEY SAVED";
    els.apiKeyInput.placeholder = `Paste ${spec.label} API key`;
  }
}

async function refreshHostPermissionUI() {
  const providerId = els.providerSelect.value;
  const customUrl = els.customUrlInput.value.trim();
  const originPattern = getProviderOriginPattern(providerId, customUrl);

  els.hostPermOrigin.textContent = originPattern ? `(${originPattern})` : "";

  if (!originPattern) {
    els.hostPermBadge.className = "badge warn";
    els.hostPermBadge.textContent = "ENTER BASE URL";
    els.grantPermBtn.classList.add("hidden");
    return false;
  }

  if (!chrome?.permissions?.contains) {
    els.hostPermBadge.className = "badge ok";
    els.hostPermBadge.textContent = "AVAILABLE";
    els.grantPermBtn.classList.add("hidden");
    return true;
  }

  const granted = await chrome.permissions.contains({
    origins: [originPattern],
  });
  if (granted) {
    els.hostPermBadge.className = "badge ok";
    els.hostPermBadge.textContent = "GRANTED";
    els.grantPermBtn.classList.add("hidden");
  } else {
    els.hostPermBadge.className = "badge warn";
    els.hostPermBadge.textContent = "NOT GRANTED";
    els.grantPermBtn.classList.remove("hidden");
  }
  return granted;
}

async function ensureHostPermissionFromGesture() {
  const providerId = els.providerSelect.value;
  const customUrl = els.customUrlInput.value.trim();
  const originPattern = getProviderOriginPattern(providerId, customUrl);
  if (!originPattern || !chrome?.permissions?.request) {
    return true;
  }
  try {
    const already = await chrome.permissions.contains({
      origins: [originPattern],
    });
    if (already) return true;
    const granted = await chrome.permissions.request({
      origins: [originPattern],
    });
    await refreshHostPermissionUI();
    return granted;
  } catch {
    return false;
  }
}

function updateCustomUrlVisibility(providerId) {
  if (providerId === "custom") {
    els.customUrlField.classList.remove("hidden");
  } else {
    els.customUrlField.classList.add("hidden");
  }
}

function validateExcludeTextarea() {
  const { errors } = compileExcludePatterns(els.excludeTextarea.value);
  if (errors.length > 0) {
    els.regexValidationMsg.style.color = "var(--err-text)";
    els.regexValidationMsg.textContent = errors[0];
    return { valid: false, errors };
  }
  els.regexValidationMsg.style.color = "";
  els.regexValidationMsg.textContent =
    "Questions matching any line will not be auto-renamed (case-insensitive by default).";
  return { valid: true, errors: [] };
}

function populateProviderSelect() {
  els.providerSelect.textContent = "";
  for (const spec of PROVIDER_LIST) {
    const opt = document.createElement("option");
    opt.value = spec.id;
    opt.textContent = spec.label;
    els.providerSelect.appendChild(opt);
  }
}

function collectCurrentSettings() {
  const provider = els.providerSelect.value;
  const spec = getProviderSpec(provider);
  const model = els.modelInput.value.trim() || spec.defaultModel;
  const excludePatterns = els.excludeTextarea.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    enabled: els.enabledCheckbox.checked,
    showToast: els.showToastCheckbox.checked,
    provider,
    model,
    customBaseUrl: els.customUrlInput.value.trim(),
    titlePrefix: els.prefixInput.value.trim(),
    excludePatterns,
    debug: els.debugCheckbox.checked,
  };
}

async function onSaveProviderClick() {
  const permGranted = await ensureHostPermissionFromGesture();
  const nextSettings = collectCurrentSettings();
  const typedKey = els.apiKeyInput.value.trim();

  await saveSettings(nextSettings);
  if (typedKey) {
    await setApiKey(nextSettings.provider, typedKey);
    els.apiKeyInput.value = "";
  }

  els.modelInput.value = nextSettings.model;
  await refreshKeyBadge(nextSettings.provider);
  await refreshHostPermissionUI();

  if (!permGranted) {
    showFeedback(
      els.providerFeedback,
      "warn",
      "Settings saved, but host access was not granted. Click 'Grant Host Access' so background LLM calls are allowed."
    );
  } else {
    showFeedback(els.providerFeedback, "ok", "Provider settings saved.");
  }
}

async function onSaveRulesClick() {
  const check = validateExcludeTextarea();
  if (!check.valid) {
    showFeedback(els.rulesFeedback, "err", check.errors[0]);
    return;
  }
  const nextSettings = collectCurrentSettings();
  await saveSettings(nextSettings);
  showFeedback(els.rulesFeedback, "ok", "Rules saved.");
}

async function onTestProviderClick() {
  els.testBtn.disabled = true;
  showFeedback(els.providerFeedback, "warn", "Testing provider connection…");

  await ensureHostPermissionFromGesture();

  const provider = els.providerSelect.value;
  const spec = getProviderSpec(provider);
  const model = els.modelInput.value.trim() || spec.defaultModel;
  const customBaseUrl = els.customUrlInput.value.trim();
  const typedKey = els.apiKeyInput.value.trim();

  try {
    const res = await chrome.runtime.sendMessage({
      ns: MESSAGE_NS,
      type: RUNTIME_MESSAGES.TEST_PROVIDER,
      provider,
      model,
      customBaseUrl,
      apiKey: typedKey,
    });

    if (res?.ok) {
      showFeedback(
        els.providerFeedback,
        "ok",
        `Success (${res.latencyMs}ms) - Sample title: "${res.title}"`
      );
    } else {
      showFeedback(
        els.providerFeedback,
        "err",
        `Provider test failed: ${res?.error || "Unknown error"}`
      );
    }
  } catch (err) {
    showFeedback(
      els.providerFeedback,
      "err",
      `Could not contact background service worker: ${err?.message || String(err)}`
    );
  } finally {
    els.testBtn.disabled = false;
  }
}

async function init() {
  if (els.logoSlot) {
    els.logoSlot.appendChild(
      createPixelLogoElement(document, { size: 36, className: "brand-logo" })
    );
  }

  populateProviderSelect();

  const [settings, history, lastStatus, storedBatch, swState] = await Promise.all([
    getSettings(),
    getHistory(),
    getLastStatus(),
    getBatchStatus(),
    chrome?.runtime?.sendMessage
      ? chrome.runtime
          .sendMessage({ ns: MESSAGE_NS, type: RUNTIME_MESSAGES.GET_STATE })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  function syncOptBatchControls() {
    if (!els.optBatchMode) return;
    const mode = els.optBatchMode.value;
    if (mode === "all") {
      els.optBatchNumberWrap.classList.add("hidden");
    } else {
      els.optBatchNumberWrap.classList.remove("hidden");
      els.optBatchNumberLabel.textContent =
        mode === "days" ? "Number of Days" : "Number of Chats";
      els.optBatchNumber.max = mode === "days" ? "3650" : "5000";
    }
    const specKey =
      mode === "all" ? "all" : `${mode}:${Number(els.optBatchNumber.value) || 0}`;
    for (const chip of els.optPresetChips?.querySelectorAll(".preset-chip") || []) {
      chip.classList.toggle("active", chip.dataset.spec === specKey);
    }
  }

  function renderOptBatchStatus(batch) {
    if (!els.optBatchProgress) return;
    if (!batch) {
      els.optBatchProgress.classList.add("hidden");
      els.optStartBatchBtn?.classList.remove("hidden");
      els.optStopBatchBtn?.classList.add("hidden");
      if (els.optBatchBadge) {
        els.optBatchBadge.className = "badge ok";
        els.optBatchBadge.textContent = "READY";
      }
      return;
    }

    const running = Boolean(batch.running);
    els.optBatchProgress.classList.remove("hidden");
    els.optBatchProgress.classList.toggle("running", running);
    els.optStartBatchBtn?.classList.toggle("hidden", running);
    els.optStopBatchBtn?.classList.toggle("hidden", !running);

    if (running) {
      if (els.optBatchBadge) {
        els.optBatchBadge.className = "badge warn";
        els.optBatchBadge.textContent = "RUNNING";
      }
      const isScan = batch.phase === "scanning";
      const pct = isScan
        ? 12
        : batch.total > 0
          ? Math.round((batch.processed / batch.total) * 100)
          : 15;
      els.optBatchLabel.textContent =
        batch.message ||
        (isScan
          ? "Scanning Perplexity Library…"
          : `Renaming ${batch.processed} of ${batch.total}…`);
      els.optBatchPct.textContent = isScan ? "SCAN" : `${pct}%`;
      els.optBatchFill.style.width = `${Math.max(6, Math.min(100, pct))}%`;
      els.optBatchStats.textContent = isScan
        ? `${batch.scanned || 0} chats discovered in library`
        : `${batch.renamed || 0} renamed · ${batch.skipped || 0} skipped`;
    } else {
      const isErr = batch.state === "error";
      if (els.optBatchBadge) {
        els.optBatchBadge.className = isErr ? "badge err" : "badge ok";
        els.optBatchBadge.textContent = isErr
          ? "ERROR"
          : batch.state === "cancelled"
            ? "STOPPED"
            : "COMPLETE";
      }
      const pct =
        batch.total > 0
          ? Math.round(((batch.processed || 0) / batch.total) * 100)
          : 100;
      els.optBatchLabel.textContent = batch.message || "Batch complete";
      els.optBatchPct.textContent = isErr ? "ERR" : `${pct}%`;
      els.optBatchFill.style.width = `${isErr ? 100 : Math.max(0, Math.min(100, pct))}%`;
      els.optBatchStats.textContent = `${batch.renamed || 0} renamed · ${batch.skipped || 0} skipped${
        batch.failed ? ` · ${batch.failed} failed` : ""
      }`;
    }
  }

  lastKnownProvider = settings.provider;
  els.providerSelect.value = settings.provider;
  els.modelInput.value = settings.model;
  els.customUrlInput.value = settings.customBaseUrl;
  els.enabledCheckbox.checked = settings.enabled;
  els.showToastCheckbox.checked = settings.showToast;
  els.prefixInput.value = settings.titlePrefix;
  els.excludeTextarea.value = settings.excludePatterns.join("\n");
  els.debugCheckbox.checked = settings.debug;

  updateCustomUrlVisibility(settings.provider);
  syncOptBatchControls();
  renderLastStatus(lastStatus);
  renderHistory(history);
  renderOptBatchStatus(swState?.batchStatus || storedBatch);
  await refreshKeyBadge(settings.provider);
  await refreshHostPermissionUI();

  async function triggerOptOpenChat(regenerate) {
    await ensureHostPermissionFromGesture();
    els.optRenameCurrentBtn.disabled = true;
    els.optRegenCurrentBtn.disabled = true;
    showFeedback(
      els.optCurrentFeedback,
      "warn",
      regenerate
        ? "Regenerating fresh title for open Perplexity chat…"
        : "Renaming current open Perplexity chat…"
    );
    try {
      const res = await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.RENAME_CURRENT_CHAT,
        regenerate,
      });
      if (res?.ok && res.title) {
        showFeedback(
          els.optCurrentFeedback,
          "ok",
          `${regenerate ? "Regenerated title" : "Renamed open chat"}: "${res.title}"`
        );
      } else {
        showFeedback(
          els.optCurrentFeedback,
          "err",
          res?.error ||
            "Open a Perplexity thread (/search/...) in another tab first."
        );
      }
    } catch (err) {
      showFeedback(
        els.optCurrentFeedback,
        "err",
        err?.message || "Could not contact background service worker."
      );
    } finally {
      els.optRenameCurrentBtn.disabled = false;
      els.optRegenCurrentBtn.disabled = false;
    }
  }

  els.optRenameCurrentBtn?.addEventListener("click", () => {
    triggerOptOpenChat(false);
  });

  els.optRegenCurrentBtn?.addEventListener("click", () => {
    triggerOptOpenChat(true);
  });

  els.optPresetChips?.addEventListener("click", (e) => {
    const chip = e.target.closest(".preset-chip");
    if (!chip) return;
    const raw = chip.dataset.spec || "count:50";
    if (raw === "all") {
      els.optBatchMode.value = "all";
    } else {
      const [mode, val] = raw.split(":");
      els.optBatchMode.value = mode === "days" ? "days" : "count";
      els.optBatchNumber.value = val || "50";
    }
    syncOptBatchControls();
  });

  els.optBatchMode?.addEventListener("change", () => {
    if (els.optBatchMode.value === "days" && Number(els.optBatchNumber.value) === 50) {
      els.optBatchNumber.value = "30";
    }
    syncOptBatchControls();
  });

  els.optBatchNumber?.addEventListener("input", syncOptBatchControls);

  els.optStartBatchBtn?.addEventListener("click", async () => {
    await ensureHostPermissionFromGesture();
    const mode = els.optBatchMode.value;
    const num = Math.max(1, Number(els.optBatchNumber.value) || 30);
    const skipAlreadyRenamed = Boolean(els.optSkipRenamed.checked);
    const spec =
      mode === "all"
        ? { mode: "all", skipAlreadyRenamed }
        : mode === "days"
          ? { mode: "days", days: num, skipAlreadyRenamed }
          : { mode: "count", count: num, skipAlreadyRenamed };

    els.optStartBatchBtn.disabled = true;
    renderOptBatchStatus({
      running: true,
      phase: "scanning",
      scanned: 0,
      processed: 0,
      total: 0,
      renamed: 0,
      skipped: 0,
      message: "Starting Perplexity Library scan…",
    });

    try {
      const res = await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.START_BATCH_RENAME,
        spec,
      });
      if (!res?.ok) {
        renderOptBatchStatus({
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
      renderOptBatchStatus({
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
      els.optStartBatchBtn.disabled = false;
    }
  });

  els.optStopBatchBtn?.addEventListener("click", async () => {
    els.optStopBatchBtn.disabled = true;
    try {
      await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.CANCEL_BATCH_RENAME,
      });
    } finally {
      els.optStopBatchBtn.disabled = false;
    }
  });

  els.enabledCheckbox.addEventListener("change", () => {
    saveSettings({ enabled: els.enabledCheckbox.checked });
  });
  els.showToastCheckbox.addEventListener("change", () => {
    saveSettings({ showToast: els.showToastCheckbox.checked });
  });

  els.providerSelect.addEventListener("change", async () => {
    const newProvider = els.providerSelect.value;
    const prevSpec = getProviderSpec(lastKnownProvider);
    const nextSpec = getProviderSpec(newProvider);

    if (
      !els.modelInput.value.trim() ||
      els.modelInput.value.trim() === prevSpec.defaultModel
    ) {
      els.modelInput.value = nextSpec.defaultModel;
    }
    lastKnownProvider = newProvider;
    els.apiKeyInput.value = "";
    updateCustomUrlVisibility(newProvider);
    await refreshKeyBadge(newProvider);
    await refreshHostPermissionUI();
  });

  els.customUrlInput.addEventListener("input", () => {
    refreshHostPermissionUI();
  });

  els.excludeTextarea.addEventListener("input", validateExcludeTextarea);

  els.grantPermBtn.addEventListener("click", async () => {
    const ok = await ensureHostPermissionFromGesture();
    showFeedback(
      els.providerFeedback,
      ok ? "ok" : "warn",
      ok ? "Host access granted." : "Host access request was dismissed."
    );
  });

  els.clearKeyBtn.addEventListener("click", async () => {
    const provider = els.providerSelect.value;
    await clearApiKey(provider);
    els.apiKeyInput.value = "";
    await refreshKeyBadge(provider);
    showFeedback(els.providerFeedback, "ok", "Stored API key cleared.");
  });

  els.saveBtn.addEventListener("click", onSaveProviderClick);
  els.saveRulesBtn.addEventListener("click", onSaveRulesClick);
  els.testBtn.addEventListener("click", onTestProviderClick);

  els.clearHistoryBtn.addEventListener("click", async () => {
    await clearHistory();
    renderHistory([]);
  });

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[STORAGE_KEYS.LAST_STATUS]) {
        renderLastStatus(changes[STORAGE_KEYS.LAST_STATUS].newValue);
      }
      if (changes[STORAGE_KEYS.HISTORY]) {
        renderHistory(changes[STORAGE_KEYS.HISTORY].newValue || []);
      }
      if (changes[STORAGE_KEYS.BATCH_STATUS]) {
        renderOptBatchStatus(changes[STORAGE_KEYS.BATCH_STATUS].newValue || null);
      }
      if (changes[STORAGE_KEYS.SETTINGS]?.newValue) {
        const s = changes[STORAGE_KEYS.SETTINGS].newValue;
        if (typeof s.enabled === "boolean") els.enabledCheckbox.checked = s.enabled;
        if (typeof s.showToast === "boolean") els.showToastCheckbox.checked = s.showToast;
      }
    });
  }
}

init();
