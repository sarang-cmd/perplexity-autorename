/**
 * Background Service Worker (Chrome MV3, ESM).
 *
 * Security invariants:
 * - This is the ONLY module in the extension that calls `getApiKey()`.
 * - The API key is never returned in any message response or written to console logs.
 * - Ignores runtime messages not tagged with `ns: MESSAGE_NS` (`return false`) so
 *   message channels opened by other extensions are never held open or broken.
 */

import {
  MESSAGE_NS,
  PERPLEXITY_CONFIG,
  RUNTIME_MESSAGES,
} from "../config/selectors.js";
import {
  STORAGE_KEYS,
  getSettings,
  getApiKey,
  getBatchStatus,
  getRenamedIds,
  recordRenameEntry,
  setBatchStatus,
  setLastStatus,
} from "../lib/storage.js";
import {
  callProvider,
  generateTitleWithFallback,
  getProviderSpec,
  getProviderOriginPattern,
} from "../lib/providers/index.js";
import { redactSecret } from "../lib/providers/prompt.js";

const TEST_SAMPLE = Object.freeze({
  question: "Why do deciduous tree leaves change color in autumn before falling?",
  answer:
    "As autumn days shorten and temperatures drop, trees stop producing chlorophyll. " +
    "As green chlorophyll breaks down, yellow and orange carotenoids become visible, " +
    "while trapped sugars trigger red and purple anthocyanin synthesis.",
});

async function checkHostPermission(providerId, customBaseUrl, permissionsApi) {
  if (!permissionsApi?.contains) {
    return true;
  }
  const originPattern = getProviderOriginPattern(providerId, customBaseUrl);
  if (!originPattern) {
    return true;
  }
  try {
    return await permissionsApi.contains({ origins: [originPattern] });
  } catch {
    return true;
  }
}

async function queryTabsSafe(tabsApi, queryInfo) {
  if (!tabsApi?.query) return [];
  try {
    const res = await tabsApi.query(queryInfo);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

async function sendTabMessageSafe(tabsApi, tabId, payload, timeoutMs = 20000) {
  if (!tabsApi?.sendMessage || typeof tabId !== "number") return null;
  let timer = null;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const msgPromise = Promise.resolve(
      tabsApi.sendMessage(tabId, { ns: MESSAGE_NS, ...payload })
    ).catch(() => null);
    return await Promise.race([msgPromise, timeoutPromise]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function createTabSafe(tabsApi, createProps) {
  if (!tabsApi?.create) return null;
  try {
    return (await tabsApi.create(createProps)) || null;
  } catch {
    return null;
  }
}

/**
 * Creates the service worker message dispatcher with injectable storage and fetch
 * for deterministic unit testing.
 */
export function createRuntimeDispatcher({
  storageArea,
  fetchImpl = globalThis.fetch,
  permissionsApi = globalThis.chrome?.permissions,
  tabsApi = globalThis.chrome?.tabs,
} = {}) {
  /** @type {Map<number, { url: string, slug: string | null, seenAt: number }>} */
  const knownTabs = new Map();
  let batchRunnerTabId = null;

  function rememberTab(tabId, extra = {}) {
    if (typeof tabId !== "number") return;
    const prev = knownTabs.get(tabId) || {};
    knownTabs.set(tabId, {
      url: extra.url || prev.url || "",
      slug: extra.slug !== undefined ? extra.slug : prev.slug || null,
      seenAt: Date.now(),
    });
  }

  async function findCandidateTabIds({ preferActive = true } = {}) {
    const orderedIds = [];
    const pushUnique = (id) => {
      if (typeof id === "number" && !orderedIds.includes(id)) {
        orderedIds.push(id);
      }
    };

    if (preferActive) {
      const focused = await queryTabsSafe(tabsApi, {
        active: true,
        lastFocusedWindow: true,
      });
      for (const t of focused) pushUnique(t.id);

      const active = await queryTabsSafe(tabsApi, { active: true });
      for (const t of active) pushUnique(t.id);
    }

    const sortedKnown = [...knownTabs.entries()]
      .sort((a, b) => b[1].seenAt - a[1].seenAt)
      .map(([id]) => id);
    for (const id of sortedKnown) pushUnique(id);

    const allTabs = await queryTabsSafe(tabsApi, {});
    for (const t of allTabs) pushUnique(t.id);

    return orderedIds;
  }

  async function findLivePerplexityTab({ requireOpenThread = false } = {}) {
    const ids = await findCandidateTabIds({ preferActive: true });
    let firstAlive = null;

    for (const tabId of ids) {
      const pong = await sendTabMessageSafe(
        tabsApi,
        tabId,
        { type: RUNTIME_MESSAGES.PING_CONTENT },
        900
      );
      if (!pong?.ok) {
        knownTabs.delete(tabId);
        continue;
      }

      rememberTab(tabId, { url: pong.url || "", slug: pong.slug || null });
      const info = {
        tabId,
        url: pong.url || "",
        slug: pong.slug || null,
        isThreadOpen: Boolean(pong.isThreadOpen),
        batchRunning: Boolean(pong.batchRunning),
      };
      if (!firstAlive) firstAlive = info;
      if (!requireOpenThread || info.isThreadOpen) {
        return info;
      }
    }

    return firstAlive;
  }

  async function ensurePerplexityTabForBatch() {
    const existing = await findLivePerplexityTab({ requireOpenThread: false });
    if (existing) return existing;

    const created = await createTabSafe(tabsApi, {
      url: `${PERPLEXITY_CONFIG.origin}/`,
      active: false,
    });
    if (!created || typeof created.id !== "number") {
      return null;
    }

    const deadline = Date.now() + 9000;
    while (Date.now() < deadline) {
      const pong = await sendTabMessageSafe(
        tabsApi,
        created.id,
        { type: RUNTIME_MESSAGES.PING_CONTENT },
        750
      );
      if (pong?.ok) {
        rememberTab(created.id, {
          url: pong.url || `${PERPLEXITY_CONFIG.origin}/`,
          slug: pong.slug || null,
        });
        return {
          tabId: created.id,
          url: pong.url || `${PERPLEXITY_CONFIG.origin}/`,
          slug: pong.slug || null,
          isThreadOpen: Boolean(pong.isThreadOpen),
          batchRunning: Boolean(pong.batchRunning),
        };
      }
      await new Promise((r) => setTimeout(r, 320));
    }

    return null;
  }

  async function resolveFreshBatchStatus() {
    const stored = await getBatchStatus(storageArea);
    if (!stored || !stored.running) {
      return stored;
    }
    if (typeof batchRunnerTabId === "number") {
      const pong = await sendTabMessageSafe(
        tabsApi,
        batchRunnerTabId,
        { type: RUNTIME_MESSAGES.PING_CONTENT },
        750
      );
      if (!pong?.ok || !pong.batchRunning) {
        const recheck = await getBatchStatus(storageArea);
        if (recheck && !recheck.running) {
          batchRunnerTabId = null;
          return recheck;
        }
        batchRunnerTabId = null;
        return setBatchStatus(
          {
            ...stored,
            running: false,
            state: "cancelled",
            phase: "done",
            message: "Batch stopped (Perplexity tab was closed or reloaded).",
            finishedAt: Date.now(),
          },
          storageArea
        );
      }
    }
    return stored;
  }

  return async function dispatch(message, sender) {
    const senderTabId = sender?.tab?.id;
    if (typeof senderTabId === "number") {
      rememberTab(senderTabId, { url: sender?.tab?.url || "" });
    }

    switch (message.type) {
      case RUNTIME_MESSAGES.PING_CONTENT: {
        rememberTab(senderTabId, {
          url: message.url || "",
          slug: message.slug || null,
        });
        return { ok: true };
      }

      case RUNTIME_MESSAGES.GET_STATE: {
        const [settings, renamedIds, batchStatus] = await Promise.all([
          getSettings(storageArea),
          getRenamedIds(storageArea),
          resolveFreshBatchStatus(),
        ]);

        let activeThread = null;
        if (typeof senderTabId !== "number" && tabsApi) {
          const liveTab = await findLivePerplexityTab({
            requireOpenThread: true,
          });
          activeThread = liveTab
            ? {
                hasPerplexityTab: true,
                isThreadOpen: liveTab.isThreadOpen,
                slug: liveTab.slug,
              }
            : {
                hasPerplexityTab: false,
                isThreadOpen: false,
                slug: null,
              };
        }

        return {
          ok: true,
          settings,
          renamedIds,
          batchStatus,
          activeThread,
        };
      }

      case RUNTIME_MESSAGES.GENERATE_TITLE: {
        const settings = await getSettings(storageArea);
        const providerId = settings.provider || "groq";
        const apiKey = await getApiKey(providerId, storageArea);

        const hasPerm = await checkHostPermission(
          providerId,
          settings.customBaseUrl,
          permissionsApi
        );

        const result = await generateTitleWithFallback({
          settings,
          apiKey,
          question: message.question || "",
          answer: message.answer || "",
          avoidTitles: Array.isArray(message.avoidTitles)
            ? message.avoidTitles
            : [],
          regenerate: Boolean(message.regenerate),
          fetchImpl,
        });

        let enrichedError = result.error;
        if (
          enrichedError &&
          !hasPerm &&
          /failed to fetch|networkerror/i.test(enrichedError)
        ) {
          const originPattern = getProviderOriginPattern(
            providerId,
            settings.customBaseUrl
          );
          enrichedError = `Host permission not granted for ${originPattern || providerId}. Open Extension Settings and click Save.`;
        }

        return {
          ok: true,
          title: result.title,
          source: result.source,
          provider: result.provider,
          model: result.model,
          error: enrichedError,
        };
      }

      case RUNTIME_MESSAGES.RECORD_RENAME: {
        const entry = message.entry || {};
        const saved = await recordRenameEntry(entry, storageArea);
        await setLastStatus(
          {
            outcome: "renamed",
            reason: "ok",
            title: entry.title || "",
            source: entry.source || "llm",
            provider: entry.provider || "",
            httpStatus: entry.httpStatus ?? 204,
            error: entry.error || null,
          },
          storageArea
        );
        return {
          ok: true,
          historyItem: saved.historyItem,
        };
      }

      case RUNTIME_MESSAGES.RECORD_STATUS: {
        const status = message.status || {};
        const updated = await setLastStatus(status, storageArea);
        return {
          ok: true,
          lastStatus: updated,
        };
      }

      case RUNTIME_MESSAGES.TEST_PROVIDER: {
        const savedSettings = await getSettings(storageArea);
        const providerId = message.provider || savedSettings.provider || "groq";
        const spec = getProviderSpec(providerId);
        const model =
          (typeof message.model === "string" && message.model.trim()) ||
          savedSettings.model ||
          spec.defaultModel;
        const customBaseUrl =
          typeof message.customBaseUrl === "string"
            ? message.customBaseUrl
            : savedSettings.customBaseUrl || "";

        const candidateKey =
          typeof message.apiKey === "string" && message.apiKey.trim()
            ? message.apiKey.trim()
            : await getApiKey(providerId, storageArea);

        const startedAt = Date.now();
        try {
          const title = await callProvider({
            provider: spec.id,
            model,
            apiKey: candidateKey,
            customBaseUrl,
            question: TEST_SAMPLE.question,
            answer: TEST_SAMPLE.answer,
            fetchImpl,
          });
          return {
            ok: true,
            title,
            provider: spec.id,
            model,
            latencyMs: Date.now() - startedAt,
          };
        } catch (err) {
          const hasPerm = await checkHostPermission(
            spec.id,
            customBaseUrl,
            permissionsApi
          );
          let safeErr = redactSecret(
            err?.message || "Provider test failed",
            candidateKey
          );
          if (!hasPerm && /failed to fetch|networkerror/i.test(safeErr)) {
            const originPattern = getProviderOriginPattern(spec.id, customBaseUrl);
            safeErr = `Host permission not granted for ${originPattern || spec.id}. Grant host access when prompted.`;
          }
          return {
            ok: false,
            provider: spec.id,
            model,
            error: safeErr,
          };
        }
      }

      case RUNTIME_MESSAGES.RENAME_CURRENT_CHAT: {
        const targetTab = await findLivePerplexityTab({
          requireOpenThread: true,
        });
        if (!targetTab) {
          return {
            ok: false,
            error:
              "Open a Perplexity chat tab (https://www.perplexity.ai/search/...) first.",
          };
        }
        if (!targetTab.isThreadOpen) {
          return {
            ok: false,
            error:
              "Active Perplexity tab is on Home/Library — open a specific chat (/search/...) to rename or regenerate its title.",
          };
        }

        const res = await sendTabMessageSafe(
          tabsApi,
          targetTab.tabId,
          {
            type: RUNTIME_MESSAGES.RENAME_CURRENT_CHAT,
            regenerate: Boolean(message.regenerate),
          },
          25000
        );

        return (
          res || {
            ok: false,
            error:
              "Could not reach Perplexity tab — reload perplexity.ai once and try again.",
          }
        );
      }

      case RUNTIME_MESSAGES.START_BATCH_RENAME: {
        const currentBatch = await resolveFreshBatchStatus();
        if (currentBatch?.running) {
          return {
            ok: false,
            error: "A batch library rename is already running.",
          };
        }

        const targetTab = await ensurePerplexityTabForBatch();
        if (!targetTab) {
          return {
            ok: false,
            error:
              "Open https://www.perplexity.ai/ (signed in) in a tab first, then click Run Batch.",
          };
        }

        batchRunnerTabId = targetTab.tabId;
        const res = await sendTabMessageSafe(
          tabsApi,
          targetTab.tabId,
          {
            type: RUNTIME_MESSAGES.START_BATCH_RENAME,
            spec: message.spec || {},
          },
          10000
        );

        if (!res?.ok) {
          batchRunnerTabId = null;
          return {
            ok: false,
            error:
              res?.error ||
              "Could not start batch rename in Perplexity tab — reload perplexity.ai and retry.",
          };
        }

        return { ok: true, started: true, tabId: targetTab.tabId };
      }

      case RUNTIME_MESSAGES.CANCEL_BATCH_RENAME: {
        const candidateIds = await findCandidateTabIds({ preferActive: false });
        if (
          typeof batchRunnerTabId === "number" &&
          !candidateIds.includes(batchRunnerTabId)
        ) {
          candidateIds.unshift(batchRunnerTabId);
        }

        let anyStopped = false;
        for (const id of candidateIds) {
          const res = await sendTabMessageSafe(
            tabsApi,
            id,
            { type: RUNTIME_MESSAGES.CANCEL_BATCH_RENAME },
            2500
          );
          if (res?.stopped) anyStopped = true;
        }

        if (!anyStopped) {
          const stored = await getBatchStatus(storageArea);
          if (stored?.running) {
            await setBatchStatus(
              {
                ...stored,
                running: false,
                state: "cancelled",
                phase: "done",
                message: "Batch library rename stopped.",
                finishedAt: Date.now(),
              },
              storageArea
            );
          }
        }
        batchRunnerTabId = null;
        return { ok: true, stopped: true };
      }

      case RUNTIME_MESSAGES.GET_BATCH_STATUS: {
        const batchStatus = await resolveFreshBatchStatus();
        return { ok: true, batchStatus };
      }

      case RUNTIME_MESSAGES.UPDATE_BATCH_STATUS: {
        const patch = message.status || {};
        if (typeof senderTabId === "number") {
          if (patch.running) {
            batchRunnerTabId = senderTabId;
          } else if (batchRunnerTabId === senderTabId) {
            batchRunnerTabId = null;
          }
        }
        const saved = await setBatchStatus(patch, storageArea);
        return { ok: true, batchStatus: saved };
      }

      default:
        return {
          ok: false,
          error: `Unknown message type: ${String(message.type)}`,
        };
    }
  };
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  const dispatch = createRuntimeDispatcher();
  const activeTabIds = new Set();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      !message ||
      message.ns !== MESSAGE_NS ||
      typeof message.type !== "string"
    ) {
      return false;
    }

    if (typeof sender?.tab?.id === "number") {
      activeTabIds.add(sender.tab.id);
    }

    dispatch(message, sender)
      .then((res) => sendResponse(res))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err?.message || "Internal service worker error",
        })
      );

    return true;
  });

  // Push live settings changes (e.g. from Popup or Options) to open Perplexity tabs
  if (chrome.storage?.onChanged && chrome.tabs?.sendMessage) {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEYS.SETTINGS]) {
        return;
      }
      const nextSettings = await getSettings();
      for (const tabId of [...activeTabIds]) {
        chrome.tabs
          .sendMessage(tabId, {
            ns: MESSAGE_NS,
            type: RUNTIME_MESSAGES.SETTINGS_UPDATED,
            settings: nextSettings,
          })
          .catch(() => {
            activeTabIds.delete(tabId);
          });
      }
    });
  }
}
