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

  const [settings, lastStatus] = await Promise.all([
    getSettings(),
    getLastStatus(),
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

  els.openOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEYS.LAST_STATUS]) {
        renderStatus(changes[STORAGE_KEYS.LAST_STATUS].newValue);
      }
    });
  }
}

init();
