/**
 * Isolated-world content script running on `https://www.perplexity.ai/*`.
 *
 * Responsibilities:
 * 1. Emits unconditional `[ppx-autorename] content script loaded` diagnostic log.
 * 2. Ensures `page.js` is injected if not already mounted via Manifest V3 `world: "MAIN"`.
 * 3. Manages the isolated Shadow-DOM bottom-right Rename Toaster (`toast.js`).
 * 4. Listens for `answer-started`, `answer-complete`, and `user-rename` events from `page.js`,
 *    plus live `settings-updated` pushes from the service worker.
 * 5. Runs pure `shouldRename` decision logic, requests `generate-title`, executes the thread
 *    rename (retrying at most twice), updates the Toaster, and records the result.
 */

import {
  MESSAGE_NS,
  WINDOW_MESSAGES,
  RUNTIME_MESSAGES,
  PERPLEXITY_CONFIG,
} from "../config/selectors.js";
import { shouldRename } from "../lib/decide.js";
import { fetchAccountId, postThreadRename } from "../lib/perplexity-api.js";
import { createRenameToaster } from "./toast.js";

const { domMarkers } = PERPLEXITY_CONFIG;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fallback `<script src="chrome-extension://.../page.js">` injector in case
 * the browser did not already run `page.js` via Manifest `world: "MAIN"`.
 */
export function ensurePageScriptInjected(win, chromeObj) {
  try {
    const doc = win?.document;
    if (!doc) return false;
    if (
      doc.documentElement?.getAttribute(domMarkers.pageInjectedAttr) === "1" ||
      win[domMarkers.globalFlag]
    ) {
      return true;
    }
    if (!chromeObj?.runtime?.getURL) {
      return false;
    }

    const script = doc.createElement("script");
    script.src = chromeObj.runtime.getURL("page.js");
    script.async = false;
    script.onload = () => script.remove();
    script.onerror = () => script.remove();
    (doc.documentElement || doc.head || doc.body)?.appendChild(script);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a message to the background service worker, safely wrapping MV3 errors.
 */
export function sendToServiceWorker(chromeObj, message) {
  return new Promise((resolve) => {
    try {
      if (!chromeObj?.runtime?.sendMessage) {
        resolve({ ok: false, error: "chrome.runtime.sendMessage unavailable" });
        return;
      }
      chromeObj.runtime.sendMessage(
        { ns: MESSAGE_NS, ...message },
        (response) => {
          const lastErr = chromeObj.runtime.lastError;
          if (lastErr) {
            resolve({
              ok: false,
              error: lastErr.message || "Service worker connection failed",
            });
            return;
          }
          resolve(response || { ok: false, error: "Empty response from service worker" });
        }
      );
    } catch (err) {
      resolve({
        ok: false,
        error: err?.message || "Extension context invalidated",
      });
    }
  });
}

/**
 * Sends a rename request through the MAIN-world `page.js` bridge (so it carries
 * `Origin: https://www.perplexity.ai`), falling back to a direct fetch if the
 * bridge does not answer within `bridgeTimeoutMs`.
 */
export function requestSingleRename({
  win,
  contextUuid,
  readWriteToken,
  title,
  fetchImpl = globalThis.fetch,
  getCachedAccountId,
  setCachedAccountId,
  bridgeTimeoutMs = 5000,
}) {
  const origin =
    win?.location?.origin && win.location.origin !== "null"
      ? win.location.origin
      : PERPLEXITY_CONFIG.origin;

  const hasBridge = Boolean(
    win &&
      typeof win.postMessage === "function" &&
      typeof win.addEventListener === "function" &&
      (win.document?.documentElement?.getAttribute(domMarkers.pageInjectedAttr) ===
        "1" ||
        win[domMarkers.globalFlag])
  );

  if (!hasBridge) {
    return (async () => {
      let accountId = getCachedAccountId();
      if (accountId === undefined) {
        accountId = await fetchAccountId(fetchImpl, origin);
        setCachedAccountId(accountId);
      }
      return postThreadRename({
        contextUuid,
        readWriteToken,
        title,
        accountId,
        fetchImpl,
        origin,
      });
    })();
  }

  return new Promise((resolve) => {
    const requestId = makeRequestId();
    let settled = false;

    const cleanup = (timer) => {
      clearTimeout(timer);
      win.removeEventListener("message", onMessage);
    };

    const onMessage = (event) => {
      if (event.source !== win) return;
      const data = event.data;
      if (
        !data ||
        data.ns !== MESSAGE_NS ||
        data.type !== WINDOW_MESSAGES.RENAME_RESPONSE ||
        data.requestId !== requestId
      ) {
        return;
      }
      if (settled) return;
      settled = true;
      cleanup(timer);
      resolve(
        data.result || { ok: false, status: 0, error: "Empty bridge result" }
      );
    };

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      win.removeEventListener("message", onMessage);
      let accountId = getCachedAccountId();
      if (accountId === undefined) {
        accountId = await fetchAccountId(fetchImpl, origin);
        setCachedAccountId(accountId);
      }
      const fallbackResult = await postThreadRename({
        contextUuid,
        readWriteToken,
        title,
        accountId,
        fetchImpl,
        origin,
      });
      resolve(fallbackResult);
    }, bridgeTimeoutMs);

    win.addEventListener("message", onMessage);
    const targetOrigin =
      origin !== PERPLEXITY_CONFIG.origin && win.location?.origin === "null"
        ? "*"
        : origin;
    win.postMessage(
      {
        ns: MESSAGE_NS,
        type: WINDOW_MESSAGES.RENAME_REQUEST,
        requestId,
        contextUuid,
        readWriteToken,
        title,
      },
      targetOrigin
    );
  });
}

/**
 * Retries `performAttempt` at most `maxRetries` times (default: 2 -> max 3 total calls).
 */
export async function renameWithRetries(
  performAttempt,
  { maxRetries = 2, retryDelaysMs = [500, 1200] } = {}
) {
  let lastResult = { ok: false, status: 0, error: "Not attempted" };
  const totalAllowed = 1 + Math.max(0, maxRetries);

  for (let attempt = 1; attempt <= totalAllowed; attempt++) {
    lastResult = await performAttempt(attempt);
    if (lastResult.ok) {
      return { ...lastResult, attempts: attempt };
    }
    if (attempt < totalAllowed) {
      const delay =
        retryDelaysMs[attempt - 1] ??
        retryDelaysMs[retryDelaysMs.length - 1] ??
        500;
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  return { ...lastResult, attempts: totalAllowed };
}

/**
 * Initializes the isolated-world content script controller.
 * Parameterized so unit and synthetic E2E tests can run without global Chrome state.
 */
export function initContentScript({
  win = globalThis.window,
  chromeObj = globalThis.chrome,
  fetchImpl = globalThis.fetch,
  retryDelaysMs = [500, 1200],
  bridgeTimeoutMs = 5000,
} = {}) {
  console.info("[ppx-autorename] content script loaded");

  ensurePageScriptInjected(win, chromeObj);

  const toaster = createRenameToaster({ win });

  let currentSettings = {
    enabled: true,
    showToast: true,
    excludePatterns: [],
    debug: false,
  };

  const localRenamedIds = new Set();
  const inFlightIds = new Set();
  const userRenamedIds = new Set();
  let cachedAccountId = undefined;

  function applySettings(nextSettings) {
    currentSettings = { ...currentSettings, ...nextSettings };
    toaster.updateSettings(currentSettings);
  }

  sendToServiceWorker(chromeObj, { type: RUNTIME_MESSAGES.GET_STATE })
    .then((res) => {
      if (res?.ok && res.settings) {
        applySettings(res.settings);
      }
    })
    .catch(() => {});

  const onRuntimeMessage = (msg) => {
    if (
      msg &&
      msg.ns === MESSAGE_NS &&
      msg.type === RUNTIME_MESSAGES.SETTINGS_UPDATED &&
      msg.settings
    ) {
      applySettings(msg.settings);
    }
    return false;
  };

  if (chromeObj?.runtime?.onMessage?.addListener) {
    chromeObj.runtime.onMessage.addListener(onRuntimeMessage);
  }

  async function processAnswerComplete(payload) {
    const question = payload?.question || "";
    const answer = payload?.answer || "";
    const isFollowUp = Boolean(payload?.isFollowUp);
    const ids = payload?.ids || {};
    const contextUuid = ids.contextUuid || null;
    const readWriteToken = ids.readWriteToken || null;
    const backendUuid = ids.backendUuid || null;

    const stateRes = await sendToServiceWorker(chromeObj, {
      type: RUNTIME_MESSAGES.GET_STATE,
    });

    if (!stateRes.ok) {
      toaster.clearIfWatching();
      console.warn("[ppx-autorename] service worker unavailable", {
        error: stateRes.error || "unknown",
      });
      return { renamed: false, reason: "sw-error" };
    }

    const settings = stateRes.settings || currentSettings;
    applySettings(settings);

    const combinedRenamedIds = new Set([
      ...(Array.isArray(stateRes.renamedIds) ? stateRes.renamedIds : []),
      ...localRenamedIds,
      ...inFlightIds,
    ]);

    const decision = shouldRename({
      enabled: settings.enabled,
      isFollowUp,
      contextUuid,
      alreadyRenamedIds: combinedRenamedIds,
      userRenamedIds,
      question,
      excludePatterns: settings.excludePatterns,
    });

    console.info("[ppx-autorename] decision", {
      rename: decision.rename,
      reason: decision.reason,
      hasContextUuid: Boolean(contextUuid),
      hasReadWriteToken: Boolean(readWriteToken),
    });

    if (!decision.rename) {
      toaster.clearIfWatching();
      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_STATUS,
        status: {
          outcome: "skipped",
          reason: decision.reason,
        },
      });
      return { renamed: false, reason: decision.reason };
    }

    if (!contextUuid || !readWriteToken) {
      toaster.clearIfWatching();
      console.warn("[ppx-autorename] skipped: missing thread identifiers", {
        hasContextUuid: Boolean(contextUuid),
        hasReadWriteToken: Boolean(readWriteToken),
      });
      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_STATUS,
        status: {
          outcome: "skipped",
          reason: "missing-ids",
          error: "Stream finished without context_uuid or read_write_token",
        },
      });
      return { renamed: false, reason: "missing-ids" };
    }

    inFlightIds.add(contextUuid);
    toaster.showRenaming({ step: "Generating 3–7 word title…" });

    const titleRes = await sendToServiceWorker(chromeObj, {
      type: RUNTIME_MESSAGES.GENERATE_TITLE,
      question,
      answer,
      contextUuid,
    });

    if (!titleRes.ok || !titleRes.title) {
      inFlightIds.delete(contextUuid);
      toaster.showError({ message: titleRes.error || "Failed to generate title" });
      console.warn("[ppx-autorename] title generation failed", {
        error: titleRes.error || "empty title",
      });
      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_STATUS,
        status: {
          outcome: "failed",
          reason: "title-error",
          error: titleRes.error || "Failed to generate title",
        },
      });
      return { renamed: false, reason: "title-error" };
    }

    console.info("[ppx-autorename] title", {
      source: titleRes.source,
      provider: titleRes.provider || null,
      fallbackUsed: titleRes.source === "heuristic",
      errorType: titleRes.error ? "provider-error" : null,
    });

    if (settings.debug && titleRes.error) {
      console.info("[ppx-autorename] provider fallback detail", {
        error: titleRes.error,
      });
    }

    if (userRenamedIds.has(contextUuid)) {
      inFlightIds.delete(contextUuid);
      toaster.dismiss();
      console.info("[ppx-autorename] aborted: user manually renamed thread");
      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_STATUS,
        status: {
          outcome: "skipped",
          reason: "already-renamed",
        },
      });
      return { renamed: false, reason: "already-renamed" };
    }

    toaster.showRenaming({ step: "Saving title to Perplexity…" });

    const renameRes = await renameWithRetries(
      () =>
        requestSingleRename({
          win,
          contextUuid,
          readWriteToken,
          title: titleRes.title,
          fetchImpl,
          getCachedAccountId: () => cachedAccountId,
          setCachedAccountId: (val) => {
            cachedAccountId = val;
          },
          bridgeTimeoutMs,
        }),
      { maxRetries: 2, retryDelaysMs }
    );

    inFlightIds.delete(contextUuid);

    if (renameRes.ok) {
      localRenamedIds.add(contextUuid);
      toaster.showSuccess({
        title: titleRes.title,
        source: titleRes.source,
      });

      console.info("[ppx-autorename] renamed", {
        status: renameRes.status,
        attempts: renameRes.attempts,
        source: titleRes.source,
      });

      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_RENAME,
        entry: {
          contextUuid,
          backendUuid,
          title: titleRes.title,
          source: titleRes.source,
          provider: titleRes.provider || "",
          error: titleRes.error || null,
          httpStatus: renameRes.status,
        },
      });

      return {
        renamed: true,
        source: titleRes.source,
        status: renameRes.status,
        attempts: renameRes.attempts,
      };
    }

    toaster.showError({
      message: renameRes.error || `Perplexity returned HTTP ${renameRes.status}`,
    });

    console.warn("[ppx-autorename] rename failed after retries", {
      status: renameRes.status,
      attempts: renameRes.attempts,
      error: renameRes.error || null,
    });

    await sendToServiceWorker(chromeObj, {
      type: RUNTIME_MESSAGES.RECORD_STATUS,
      status: {
        outcome: "failed",
        reason: "rename-http-error",
        source: titleRes.source,
        provider: titleRes.provider || "",
        httpStatus: renameRes.status,
        error: renameRes.error || `HTTP ${renameRes.status}`,
      },
    });

    return {
      renamed: false,
      reason: "rename-http-error",
      status: renameRes.status,
      attempts: renameRes.attempts,
    };
  }

  const onWindowMessage = (event) => {
    if (win && event.source !== win) return;
    const msg = event.data;
    if (!msg || msg.ns !== MESSAGE_NS) return;

    if (msg.type === WINDOW_MESSAGES.USER_RENAME && msg.contextUuid) {
      userRenamedIds.add(msg.contextUuid);
      toaster.clearIfWatching();
      return;
    }

    if (msg.type === WINDOW_MESSAGES.ANSWER_STARTED && msg.payload) {
      if (
        !msg.payload.isFollowUp &&
        msg.payload.hasQuestion &&
        currentSettings.enabled &&
        currentSettings.showToast
      ) {
        toaster.showWatching();
      }
      return;
    }

    if (msg.type === WINDOW_MESSAGES.ANSWER_COMPLETE && msg.payload) {
      processAnswerComplete(msg.payload).catch(() => {});
    }
  };

  if (win && typeof win.addEventListener === "function") {
    win.addEventListener("message", onWindowMessage);
  }

  return {
    processAnswerComplete,
    toaster,
    destroy() {
      if (win && typeof win.removeEventListener === "function") {
        win.removeEventListener("message", onWindowMessage);
      }
      if (chromeObj?.runtime?.onMessage?.removeListener) {
        chromeObj.runtime.onMessage.removeListener(onRuntimeMessage);
      }
    },
  };
}

if (typeof window !== "undefined" && !window.__ppxDisableAutoInit) {
  initContentScript();
}
