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
import {
  normalizeBatchSpec,
  parseSlugFromUrl,
  selectBatchCandidates,
  shouldStopLibraryPagination,
} from "../lib/library.js";
import {
  fetchAccountId,
  fetchLibraryThreadsPage,
  fetchThreadDetail,
  postThreadRename,
} from "../lib/perplexity-api.js";
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
  slug = null,
  batch = false,
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
        slug,
        batch,
      },
      targetOrigin
    );
  });
}

/**
 * Fetches a thread's opening Q&A and IDs via the MAIN-world `page.js` bridge,
 * falling back to direct `fetchThreadDetail` if the bridge times out.
 */
export function requestThreadDetail({
  win,
  slug,
  fetchImpl = globalThis.fetch,
  getCachedAccountId,
  setCachedAccountId,
  bridgeTimeoutMs = 10000,
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

  const runDirect = async () => {
    let accountId = getCachedAccountId();
    if (accountId === undefined) {
      accountId = await fetchAccountId(fetchImpl, origin);
      setCachedAccountId(accountId);
    }
    return fetchThreadDetail({ slug, accountId, fetchImpl, origin });
  };

  if (!hasBridge) {
    return runDirect();
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
        data.type !== WINDOW_MESSAGES.THREAD_DETAIL_RESPONSE ||
        data.requestId !== requestId
      ) {
        return;
      }
      if (settled) return;
      settled = true;
      cleanup(timer);
      resolve(
        data.result || { ok: false, status: 0, error: "Empty detail response" }
      );
    };

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      win.removeEventListener("message", onMessage);
      resolve(await runDirect());
    }, bridgeTimeoutMs);

    win.addEventListener("message", onMessage);
    const targetOrigin =
      origin !== PERPLEXITY_CONFIG.origin && win.location?.origin === "null"
        ? "*"
        : origin;
    win.postMessage(
      {
        ns: MESSAGE_NS,
        type: WINDOW_MESSAGES.THREAD_DETAIL_REQUEST,
        requestId,
        slug,
      },
      targetOrigin
    );
  });
}

/**
 * Fetches one page of Perplexity Library threads via the MAIN-world `page.js` bridge,
 * falling back to direct `fetchLibraryThreadsPage` if the bridge times out.
 */
export function requestLibraryPage({
  win,
  offset = 0,
  limit = 20,
  pinned = false,
  fetchImpl = globalThis.fetch,
  getCachedAccountId,
  setCachedAccountId,
  bridgeTimeoutMs = 12000,
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

  const runDirect = async () => {
    let accountId = getCachedAccountId();
    if (accountId === undefined) {
      accountId = await fetchAccountId(fetchImpl, origin);
      setCachedAccountId(accountId);
    }
    return fetchLibraryThreadsPage({
      offset,
      limit,
      pinned,
      accountId,
      fetchImpl,
      origin,
    });
  };

  if (!hasBridge) {
    return runDirect();
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
        data.type !== WINDOW_MESSAGES.LIST_THREADS_RESPONSE ||
        data.requestId !== requestId
      ) {
        return;
      }
      if (settled) return;
      settled = true;
      cleanup(timer);
      resolve(
        data.result || { ok: false, status: 0, error: "Empty library response" }
      );
    };

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      win.removeEventListener("message", onMessage);
      resolve(await runDirect());
    }, bridgeTimeoutMs);

    win.addEventListener("message", onMessage);
    const targetOrigin =
      origin !== PERPLEXITY_CONFIG.origin && win.location?.origin === "null"
        ? "*"
        : origin;
    win.postMessage(
      {
        ns: MESSAGE_NS,
        type: WINDOW_MESSAGES.LIST_THREADS_REQUEST,
        requestId,
        offset,
        limit,
        pinned,
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
  batchPageDelayMs = 180,
  batchStepDelayMs = 320,
} = {}) {
  console.info("[ppx-autorename] content script loaded");

  ensurePageScriptInjected(win, chromeObj);

  const toaster = createRenameToaster({ win, chromeObj });

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
  let lastOpenThreadCache = null;
  let activeBatchController = null;

  function applySettings(nextSettings) {
    currentSettings = { ...currentSettings, ...nextSettings };
    toaster.updateSettings(currentSettings);
  }

  function rememberThreadSnapshot({
    slug,
    contextUuid,
    readWriteToken,
    backendUuid,
    currentTitle = "",
    question = "",
    answer = "",
    generatedTitle = "",
  }) {
    if (!slug) return;
    const prevTitles =
      lastOpenThreadCache?.slug === slug &&
      Array.isArray(lastOpenThreadCache.titlesUsed)
        ? lastOpenThreadCache.titlesUsed
        : [];
    const nextTitles = [...prevTitles];
    if (currentTitle && !nextTitles.includes(currentTitle)) {
      nextTitles.push(currentTitle);
    }
    if (generatedTitle && !nextTitles.includes(generatedTitle)) {
      nextTitles.push(generatedTitle);
    }
    lastOpenThreadCache = {
      slug,
      contextUuid,
      readWriteToken: readWriteToken || null,
      backendUuid: backendUuid || slug,
      currentTitle: generatedTitle || currentTitle,
      question,
      answer,
      titlesUsed: nextTitles.slice(-6),
    };
  }

  function sleepCancellable(ms, signal) {
    if (!ms || ms <= 0 || signal?.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener?.("abort", onAbort);
        resolve();
      }, ms);
      signal?.addEventListener?.("abort", onAbort, { once: true });
    });
  }

  function resolveCurrentSlug() {
    const loc = win?.location;
    if (!loc) return null;
    return parseSlugFromUrl(loc.href || loc.pathname || "");
  }

  /**
   * Renames or regenerates the title of the currently open `/search/<slug>` thread.
   */
  async function renameCurrentChat({ regenerate = false } = {}) {
    const slug = resolveCurrentSlug();
    if (!slug) {
      return {
        ok: false,
        error: "Open a Perplexity thread (/search/...) first to rename it.",
      };
    }

    const lockKey = `manual:${slug}`;
    if (inFlightIds.has(lockKey)) {
      return {
        ok: false,
        error: "Already renaming this chat — wait a moment.",
      };
    }
    inFlightIds.add(lockKey);

    try {
      const stateRes = await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.GET_STATE,
      });
      if (stateRes?.ok && stateRes.settings) {
        applySettings(stateRes.settings);
      }

      toaster.showRenaming({
        step: regenerate
          ? "Regenerating fresh 3-7 word title..."
          : "Reading open chat & generating title...",
        label: regenerate ? "REGENERATING_" : "RENAMING CHAT_",
        forceShow: true,
      });

      let detail = null;
      if (
        lastOpenThreadCache &&
        lastOpenThreadCache.slug === slug &&
        lastOpenThreadCache.contextUuid &&
        lastOpenThreadCache.question
      ) {
        detail = { ...lastOpenThreadCache };
      } else {
        const detailRes = await requestThreadDetail({
          win,
          slug,
          fetchImpl,
          getCachedAccountId: () => cachedAccountId,
          setCachedAccountId: (v) => {
            cachedAccountId = v;
          },
          bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 10000),
        });
        if (!detailRes?.ok || !detailRes.detail) {
          const errMsg =
            detailRes?.error || "Could not read this Perplexity thread.";
          toaster.showError({ message: errMsg, forceShow: true });
          return { ok: false, error: errMsg };
        }
        detail = detailRes.detail;
      }

      if (!detail.contextUuid || !detail.question) {
        const errMsg =
          "Wait for Perplexity to finish creating the thread before renaming.";
        toaster.showError({ message: errMsg, forceShow: true });
        return { ok: false, error: errMsg };
      }

      const avoidTitles = [];
      if (regenerate) {
        if (detail.currentTitle) avoidTitles.push(detail.currentTitle);
        if (
          lastOpenThreadCache?.slug === slug &&
          Array.isArray(lastOpenThreadCache.titlesUsed)
        ) {
          for (const t of lastOpenThreadCache.titlesUsed) {
            if (t && !avoidTitles.includes(t)) avoidTitles.push(t);
          }
        }
      }

      const titleRes = await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.GENERATE_TITLE,
        question: detail.question,
        answer: detail.answer || "",
        contextUuid: detail.contextUuid,
        regenerate,
        avoidTitles,
      });

      if (!titleRes?.ok || !titleRes.title) {
        const errMsg = titleRes?.error || "Failed to generate title";
        toaster.showError({ message: errMsg, forceShow: true });
        return { ok: false, error: errMsg };
      }

      toaster.showRenaming({
        step: "Saving title to Perplexity...",
        label: regenerate ? "REGENERATING_" : "RENAMING CHAT_",
        forceShow: true,
      });

      const renameRes = await renameWithRetries(
        () =>
          requestSingleRename({
            win,
            contextUuid: detail.contextUuid,
            readWriteToken: detail.readWriteToken,
            title: titleRes.title,
            slug,
            fetchImpl,
            getCachedAccountId: () => cachedAccountId,
            setCachedAccountId: (v) => {
              cachedAccountId = v;
            },
            bridgeTimeoutMs,
          }),
        { maxRetries: 2, retryDelaysMs }
      );

      if (!renameRes.ok) {
        const errMsg =
          renameRes.error || `Perplexity returned HTTP ${renameRes.status}`;
        toaster.showError({ message: errMsg, forceShow: true });
        await sendToServiceWorker(chromeObj, {
          type: RUNTIME_MESSAGES.RECORD_STATUS,
          status: {
            outcome: "failed",
            reason: "rename-http-error",
            source: titleRes.source,
            provider: titleRes.provider || "",
            httpStatus: renameRes.status,
            error: errMsg,
          },
        });
        return { ok: false, error: errMsg };
      }

      localRenamedIds.add(detail.contextUuid);
      rememberThreadSnapshot({
        slug,
        contextUuid: detail.contextUuid,
        readWriteToken: detail.readWriteToken,
        backendUuid: detail.backendUuid || slug,
        currentTitle: detail.currentTitle || "",
        question: detail.question,
        answer: detail.answer || "",
        generatedTitle: titleRes.title,
      });

      toaster.showSuccess({
        title: titleRes.title,
        source: titleRes.source,
        label: regenerate ? "✓ TITLE REGENERATED" : "✓ THREAD RENAMED",
        forceShow: true,
        onRegenerate: () => {
          renameCurrentChat({ regenerate: true }).catch(() => {});
        },
      });

      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_RENAME,
        entry: {
          contextUuid: detail.contextUuid,
          backendUuid: detail.backendUuid || slug,
          title: titleRes.title,
          source: titleRes.source,
          provider: titleRes.provider || "",
          error: titleRes.error || null,
          httpStatus: renameRes.status,
        },
      });

      return {
        ok: true,
        title: titleRes.title,
        source: titleRes.source,
        provider: titleRes.provider || "",
        error: titleRes.error || null,
      };
    } finally {
      inFlightIds.delete(lockKey);
    }
  }

  function cancelBatchRename() {
    if (activeBatchController) {
      activeBatchController.abort();
      return true;
    }
    return false;
  }

  async function reportBatchStatus(statusPatch) {
    await sendToServiceWorker(chromeObj, {
      type: RUNTIME_MESSAGES.UPDATE_BATCH_STATUS,
      status: statusPatch,
    });
  }

  /**
   * Retroactively renames threads across the user's Perplexity Library by count, date window, or all.
   */
  async function runBatchRename(rawSpec = {}) {
    if (activeBatchController) {
      return { ok: false, error: "A batch library rename is already running." };
    }

    const spec = normalizeBatchSpec(rawSpec);
    const controller = new AbortController();
    const { signal } = controller;
    activeBatchController = controller;

    const jobId = makeRequestId();
    const startedAt = Date.now();
    const MAX_SCAN_PAGES = 100;

    try {
      const stateRes = await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.GET_STATE,
      });
      if (stateRes?.ok && stateRes.settings) {
        applySettings(stateRes.settings);
      }

      const alreadyRenamedIds = new Set([
        ...(Array.isArray(stateRes?.renamedIds) ? stateRes.renamedIds : []),
        ...localRenamedIds,
      ]);

      await reportBatchStatus({
        jobId,
        running: true,
        state: "scanning",
        phase: "scanning",
        label: spec.label,
        spec,
        scanned: 0,
        processed: 0,
        total: 0,
        renamed: 0,
        skipped: 0,
        failed: 0,
        currentTitle: "",
        message: `Scanning Perplexity Library (${spec.label})…`,
        error: null,
        startedAt,
      });

      toaster.showBatchProgress({
        phase: "scanning",
        processed: 0,
        total: 0,
        renamed: 0,
        skipped: 0,
        label: spec.label,
        onCancel: cancelBatchRename,
      });

      const byKey = new Map();
      const nowMs = Date.now();

      // Best-effort check for pinned threads first
      const pinnedRes = await requestLibraryPage({
        win,
        offset: 0,
        limit: 50,
        pinned: true,
        fetchImpl,
        getCachedAccountId: () => cachedAccountId,
        setCachedAccountId: (v) => {
          cachedAccountId = v;
        },
        bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 10000),
      });
      if (pinnedRes?.fatal) {
        throw new Error(
          pinnedRes.error || "Sign in to perplexity.ai before running batch rename."
        );
      }
      if (pinnedRes?.ok && Array.isArray(pinnedRes.items)) {
        for (const item of pinnedRes.items) {
          if (item.key && !byKey.has(item.key)) {
            byKey.set(item.key, item);
          }
        }
      }

      // Paginate regular library threads newest-first
      let offset = 0;
      const pageSize = PERPLEXITY_CONFIG.defaultLibraryPageSize || 20;

      for (let pageIdx = 0; pageIdx < MAX_SCAN_PAGES; pageIdx++) {
        if (signal.aborted) break;

        const pageRes = await requestLibraryPage({
          win,
          offset,
          limit: pageSize,
          pinned: false,
          fetchImpl,
          getCachedAccountId: () => cachedAccountId,
          setCachedAccountId: (v) => {
            cachedAccountId = v;
          },
          bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 10000),
        });

        if (!pageRes?.ok) {
          if (pageIdx === 0 || pageRes?.fatal) {
            throw new Error(
              pageRes?.error || "Could not read Perplexity Library threads."
            );
          }
          break;
        }

        const pageItems = Array.isArray(pageRes.items) ? pageRes.items : [];
        for (const item of pageItems) {
          if (item.key && !byKey.has(item.key)) {
            byKey.set(item.key, item);
          }
        }

        await reportBatchStatus({
          jobId,
          running: true,
          state: "scanning",
          phase: "scanning",
          label: spec.label,
          spec,
          scanned: byKey.size,
          processed: 0,
          total: 0,
          renamed: 0,
          skipped: 0,
          failed: 0,
          currentTitle: "",
          message: `Scanning library… (${byKey.size} chats found)`,
          error: null,
          startedAt,
        });

        toaster.showBatchProgress({
          phase: "scanning",
          processed: byKey.size,
          total: 0,
          renamed: 0,
          skipped: 0,
          label: spec.label,
          onCancel: cancelBatchRename,
        });

        const stopEarly = shouldStopLibraryPagination(pageItems, spec, {
          collectedCount: byKey.size,
          nowMs,
        });

        if (!pageRes.hasNextPage || pageItems.length === 0 || stopEarly) {
          break;
        }

        offset += pageItems.length;
        await sleepCancellable(batchPageDelayMs, signal);
      }

      if (signal.aborted) {
        const stopStatus = {
          jobId,
          running: false,
          state: "cancelled",
          phase: "done",
          label: spec.label,
          spec,
          scanned: byKey.size,
          processed: 0,
          total: 0,
          renamed: 0,
          skipped: 0,
          failed: 0,
          currentTitle: "",
          message: "Batch library scan stopped.",
          error: null,
          startedAt,
          finishedAt: Date.now(),
        };
        await reportBatchStatus(stopStatus);
        toaster.showBatchSummary({
          renamed: 0,
          skipped: 0,
          cancelled: true,
          message: stopStatus.message,
        });
        return { ok: true, ...stopStatus };
      }

      const orderedThreads = [...byKey.values()].sort((a, b) => {
        if (typeof a.updatedAtMs === "number" && typeof b.updatedAtMs === "number") {
          return b.updatedAtMs - a.updatedAtMs;
        }
        return 0;
      });

      const { scopedTotal, toRename, preSkipped } = selectBatchCandidates(
        orderedThreads,
        spec,
        {
          nowMs,
          alreadyRenamedIds,
          userRenamedIds,
        }
      );

      if (toRename.length === 0) {
        const doneMsg =
          scopedTotal === 0
            ? `No library chats found for "${spec.label}".`
            : `All ${scopedTotal} matching chat${scopedTotal === 1 ? "" : "s"} already renamed (${preSkipped} skipped).`;

        const emptyStatus = {
          jobId,
          running: false,
          state: "completed",
          phase: "done",
          label: spec.label,
          spec,
          scanned: byKey.size,
          processed: 0,
          total: 0,
          renamed: 0,
          skipped: preSkipped,
          failed: 0,
          currentTitle: "",
          message: doneMsg,
          error: null,
          startedAt,
          finishedAt: Date.now(),
        };
        await reportBatchStatus(emptyStatus);
        toaster.showBatchSummary({
          renamed: 0,
          skipped: preSkipped,
          cancelled: false,
          message: doneMsg,
        });
        return { ok: true, ...emptyStatus };
      }

      let processed = 0;
      let renamed = 0;
      let skipped = preSkipped;
      let failed = 0;
      let lastTitle = "";
      let fatalStopError = null;

      for (const item of toRename) {
        if (signal.aborted) break;

        processed++;
        const previewLabel =
          item.title || item.questionPreview || item.slug || "Thread";

        await reportBatchStatus({
          jobId,
          running: true,
          state: "renaming",
          phase: "renaming",
          label: spec.label,
          spec,
          scanned: byKey.size,
          processed,
          total: toRename.length,
          renamed,
          skipped,
          failed,
          currentTitle: previewLabel,
          message: `Renaming ${processed} of ${toRename.length}…`,
          error: null,
          startedAt,
        });

        toaster.showBatchProgress({
          phase: "renaming",
          processed,
          total: toRename.length,
          renamed,
          skipped,
          currentTitle: previewLabel,
          label: spec.label,
          onCancel: cancelBatchRename,
        });

        let detail = null;
        if (item.slug) {
          const detailRes = await requestThreadDetail({
            win,
            slug: item.slug,
            fetchImpl,
            getCachedAccountId: () => cachedAccountId,
            setCachedAccountId: (v) => {
              cachedAccountId = v;
            },
            bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 10000),
          });
          if (detailRes?.fatal) {
            fatalStopError =
              detailRes.error ||
              "Perplexity paused requests (HTTP 401/403/429). Retry shortly.";
            failed++;
            break;
          }
          if (detailRes?.ok && detailRes.detail) {
            detail = detailRes.detail;
          }
        }

        const contextUuid = detail?.contextUuid || item.contextUuid;
        const readWriteToken =
          detail?.readWriteToken || item.readWriteToken || null;
        const backendUuid =
          detail?.backendUuid || item.backendUuid || item.slug || null;
        const question =
          detail?.question || item.questionPreview || item.title || "";
        const answer = detail?.answer || "";

        if (!contextUuid || !question) {
          skipped++;
          await sleepCancellable(batchStepDelayMs, signal);
          continue;
        }

        const titleRes = await sendToServiceWorker(chromeObj, {
          type: RUNTIME_MESSAGES.GENERATE_TITLE,
          question,
          answer,
          contextUuid,
        });

        if (!titleRes?.ok || !titleRes.title) {
          failed++;
          await sleepCancellable(batchStepDelayMs, signal);
          continue;
        }

        const existingTitle = (detail?.currentTitle || item.title || "").trim();
        if (
          existingTitle &&
          existingTitle === titleRes.title.trim() &&
          spec.skipAlreadyRenamed
        ) {
          skipped++;
          localRenamedIds.add(contextUuid);
          await sleepCancellable(batchStepDelayMs, signal);
          continue;
        }

        const renameRes = await renameWithRetries(
          () =>
            requestSingleRename({
              win,
              contextUuid,
              readWriteToken,
              title: titleRes.title,
              slug: item.slug,
              batch: true,
              fetchImpl,
              getCachedAccountId: () => cachedAccountId,
              setCachedAccountId: (v) => {
                cachedAccountId = v;
              },
              bridgeTimeoutMs,
            }),
          { maxRetries: 1, retryDelaysMs }
        );

        if (renameRes.ok) {
          renamed++;
          lastTitle = titleRes.title;
          localRenamedIds.add(contextUuid);
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
        } else {
          failed++;
          if (
            renameRes.status === 401 ||
            renameRes.status === 403 ||
            renameRes.status === 429
          ) {
            fatalStopError =
              renameRes.error ||
              `Perplexity returned HTTP ${renameRes.status}; batch paused safely.`;
            break;
          }
        }

        await sleepCancellable(batchStepDelayMs, signal);
      }

      const wasCancelled = signal.aborted;
      const finalState = fatalStopError
        ? "error"
        : wasCancelled
          ? "cancelled"
          : "completed";

      const summaryMessage = fatalStopError
        ? `${fatalStopError} (${renamed} renamed before pause)`
        : wasCancelled
          ? `Stopped after ${renamed} renamed · ${skipped} skipped.`
          : `Batch complete: ${renamed} chat${renamed === 1 ? "" : "s"} renamed${
              skipped > 0 ? ` · ${skipped} skipped` : ""
            }${failed > 0 ? ` · ${failed} failed` : ""}.`;

      const finalStatus = {
        jobId,
        running: false,
        state: finalState,
        phase: "done",
        label: spec.label,
        spec,
        scanned: byKey.size,
        processed,
        total: toRename.length,
        renamed,
        skipped,
        failed,
        currentTitle: lastTitle,
        message: summaryMessage,
        error: fatalStopError,
        startedAt,
        finishedAt: Date.now(),
      };

      await reportBatchStatus(finalStatus);
      if (fatalStopError && renamed === 0) {
        toaster.showError({ message: summaryMessage, forceShow: true });
      } else {
        toaster.showBatchSummary({
          renamed,
          skipped,
          failed,
          cancelled: wasCancelled,
          message: summaryMessage,
        });
      }

      return { ok: !fatalStopError, ...finalStatus };
    } catch (err) {
      const errMsg = err?.message || "Batch library rename failed";
      const errStatus = {
        jobId,
        running: false,
        state: "error",
        phase: "done",
        label: spec.label,
        spec,
        scanned: 0,
        processed: 0,
        total: 0,
        renamed: 0,
        skipped: 0,
        failed: 1,
        currentTitle: "",
        message: errMsg,
        error: errMsg,
        startedAt,
        finishedAt: Date.now(),
      };
      await reportBatchStatus(errStatus);
      toaster.showError({ message: errMsg, forceShow: true });
      return { ok: false, error: errMsg };
    } finally {
      activeBatchController = null;
    }
  }

  sendToServiceWorker(chromeObj, { type: RUNTIME_MESSAGES.GET_STATE })
    .then((res) => {
      if (res?.ok && res.settings) {
        applySettings(res.settings);
      }
    })
    .catch(() => {});

  const onRuntimeMessage = (msg, _sender, sendResponse) => {
    if (!msg || msg.ns !== MESSAGE_NS || typeof msg.type !== "string") {
      return false;
    }

    if (msg.type === RUNTIME_MESSAGES.SETTINGS_UPDATED && msg.settings) {
      applySettings(msg.settings);
      return false;
    }

    if (msg.type === RUNTIME_MESSAGES.PING_CONTENT) {
      const slug = resolveCurrentSlug();
      sendResponse?.({
        ok: true,
        url: win?.location?.href || "",
        slug,
        isThreadOpen: Boolean(slug),
        batchRunning: Boolean(activeBatchController),
      });
      return false;
    }

    if (msg.type === RUNTIME_MESSAGES.RENAME_CURRENT_CHAT) {
      renameCurrentChat({ regenerate: Boolean(msg.regenerate) })
        .then((res) => sendResponse?.(res))
        .catch((err) =>
          sendResponse?.({
            ok: false,
            error: err?.message || "Failed to rename open chat",
          })
        );
      return true;
    }

    if (msg.type === RUNTIME_MESSAGES.START_BATCH_RENAME) {
      if (activeBatchController) {
        sendResponse?.({
          ok: false,
          error: "A batch library rename is already running.",
        });
        return false;
      }
      runBatchRename(msg.spec || {}).catch(() => {});
      sendResponse?.({ ok: true, started: true });
      return false;
    }

    if (msg.type === RUNTIME_MESSAGES.CANCEL_BATCH_RENAME) {
      const stopped = cancelBatchRename();
      sendResponse?.({ ok: true, stopped });
      return false;
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
      const slug = resolveCurrentSlug() || backendUuid || null;
      if (slug) {
        rememberThreadSnapshot({
          slug,
          contextUuid,
          readWriteToken,
          backendUuid: backendUuid || slug,
          question,
          answer,
          generatedTitle: titleRes.title,
        });
      }
      toaster.showSuccess({
        title: titleRes.title,
        source: titleRes.source,
        onRegenerate: slug
          ? () => {
              renameCurrentChat({ regenerate: true }).catch(() => {});
            }
          : null,
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
    renameCurrentChat,
    runBatchRename,
    cancelBatchRename,
    toaster,
    destroy() {
      cancelBatchRename();
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
