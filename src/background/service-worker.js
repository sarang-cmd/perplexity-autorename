/**
 * Background Service Worker (Chrome MV3, ESM).
 *
 * Security invariants:
 * - This is the ONLY module in the extension that calls `getApiKey()`.
 * - The API key is never returned in any message response or written to console logs.
 * - Ignores runtime messages not tagged with `ns: MESSAGE_NS` (`return false`) so
 *   message channels opened by other extensions are never held open or broken.
 */

import { MESSAGE_NS, RUNTIME_MESSAGES } from "../config/selectors.js";
import {
  STORAGE_KEYS,
  getSettings,
  getApiKey,
  getRenamedIds,
  recordRenameEntry,
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

/**
 * Creates the service worker message dispatcher with injectable storage and fetch
 * for deterministic unit testing.
 */
export function createRuntimeDispatcher({
  storageArea,
  fetchImpl = globalThis.fetch,
  permissionsApi = globalThis.chrome?.permissions,
} = {}) {
  return async function dispatch(message) {
    switch (message.type) {
      case RUNTIME_MESSAGES.GET_STATE: {
        const [settings, renamedIds] = await Promise.all([
          getSettings(storageArea),
          getRenamedIds(storageArea),
        ]);
        return {
          ok: true,
          settings,
          renamedIds,
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

    dispatch(message)
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
