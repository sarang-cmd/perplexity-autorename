/**
 * `chrome.storage.local` wrappers.
 * Used ONLY by `src/background/service-worker.js`, `src/options/options.js`, and `src/popup/popup.js`.
 *
 * Security invariant:
 * - `getApiKey()` MUST ONLY be called in `src/background/service-worker.js`.
 * - API keys are stored in a separate storage key (`apiKeys`) and never included
 *   in `getSettings()` or `getPublicState()`.
 */

export const STORAGE_KEYS = {
  SETTINGS: "settings",
  API_KEYS: "apiKeys",
  RENAMED_IDS: "renamedIds",
  HISTORY: "renameHistory",
  LAST_STATUS: "lastStatus",
  BATCH_STATUS: "batchStatus",
};

export const MAX_RENAMED_IDS = 2000;
export const MAX_HISTORY_ENTRIES = 200;

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  provider: "groq",
  model: "openai/gpt-oss-20b",
  customBaseUrl: "",
  titlePrefix: "",
  excludePatterns: [],
  showToast: true,
  debug: false,
});

function resolveStorage(storageArea) {
  const area = storageArea || globalThis.chrome?.storage?.local;
  if (!area) {
    throw new Error("chrome.storage.local is unavailable in this context");
  }
  return area;
}

export async function getSettings(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.SETTINGS);
  const saved = raw?.[STORAGE_KEYS.SETTINGS];
  if (!saved || typeof saved !== "object") {
    return { ...DEFAULT_SETTINGS, excludePatterns: [] };
  }
  return {
    enabled:
      typeof saved.enabled === "boolean"
        ? saved.enabled
        : DEFAULT_SETTINGS.enabled,
    provider:
      typeof saved.provider === "string" && saved.provider
        ? saved.provider
        : DEFAULT_SETTINGS.provider,
    model:
      typeof saved.model === "string" ? saved.model : DEFAULT_SETTINGS.model,
    customBaseUrl:
      typeof saved.customBaseUrl === "string" ? saved.customBaseUrl : "",
    titlePrefix:
      typeof saved.titlePrefix === "string" ? saved.titlePrefix : "",
    excludePatterns: Array.isArray(saved.excludePatterns)
      ? saved.excludePatterns.filter((x) => typeof x === "string")
      : [],
    showToast:
      typeof saved.showToast === "boolean"
        ? saved.showToast
        : DEFAULT_SETTINGS.showToast,
    debug: Boolean(saved.debug),
  };
}

export async function saveSettings(partial, storageArea) {
  const store = resolveStorage(storageArea);
  const current = await getSettings(store);
  const next = {
    ...current,
    ...partial,
  };
  if (Array.isArray(partial?.excludePatterns)) {
    next.excludePatterns = partial.excludePatterns
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  await store.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

/**
 * Reads the plaintext API key for `providerId`.
 * IMPORTANT: Call ONLY from `src/background/service-worker.js`.
 */
export async function getApiKey(providerId, storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.API_KEYS);
  const map = raw?.[STORAGE_KEYS.API_KEYS];
  if (!map || typeof map !== "object") {
    return "";
  }
  const key = map[providerId];
  return typeof key === "string" ? key.trim() : "";
}

/**
 * Checks whether a non-empty API key is stored for `providerId` without exposing the key.
 */
export async function hasApiKey(providerId, storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.API_KEYS);
  const map = raw?.[STORAGE_KEYS.API_KEYS];
  if (!map || typeof map !== "object") {
    return false;
  }
  return typeof map[providerId] === "string" && map[providerId].trim().length > 0;
}

export async function setApiKey(providerId, apiKey, storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.API_KEYS);
  const current =
    raw?.[STORAGE_KEYS.API_KEYS] && typeof raw[STORAGE_KEYS.API_KEYS] === "object"
      ? { ...raw[STORAGE_KEYS.API_KEYS] }
      : {};

  const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
  if (trimmed) {
    current[providerId] = trimmed;
  } else {
    delete current[providerId];
  }
  await store.set({ [STORAGE_KEYS.API_KEYS]: current });
}

export async function clearApiKey(providerId, storageArea) {
  return setApiKey(providerId, "", storageArea);
}

export async function getRenamedIds(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.RENAMED_IDS);
  const list = raw?.[STORAGE_KEYS.RENAMED_IDS];
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}

export async function getHistory(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.HISTORY);
  const list = raw?.[STORAGE_KEYS.HISTORY];
  return Array.isArray(list) ? list : [];
}

export async function clearHistory(storageArea) {
  const store = resolveStorage(storageArea);
  await store.set({
    [STORAGE_KEYS.HISTORY]: [],
    [STORAGE_KEYS.RENAMED_IDS]: [],
  });
}

export async function recordRenameEntry(entry, storageArea) {
  const store = resolveStorage(storageArea);
  const [renamedIds, history] = await Promise.all([
    getRenamedIds(store),
    getHistory(store),
  ]);

  const nextIds = entry.contextUuid
    ? [
        entry.contextUuid,
        ...renamedIds.filter((id) => id !== entry.contextUuid),
      ].slice(0, MAX_RENAMED_IDS)
    : renamedIds;

  const historyItem = {
    contextUuid: entry.contextUuid || null,
    backendUuid: entry.backendUuid || null,
    title: entry.title || "",
    source: entry.source || "llm",
    provider: entry.provider || "",
    error: entry.error || null,
    timestamp: entry.timestamp || Date.now(),
  };

  const nextHistory = [historyItem, ...history].slice(0, MAX_HISTORY_ENTRIES);

  await store.set({
    [STORAGE_KEYS.RENAMED_IDS]: nextIds,
    [STORAGE_KEYS.HISTORY]: nextHistory,
  });

  return { renamedIds: nextIds, historyItem };
}

export async function getLastStatus(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.LAST_STATUS);
  return raw?.[STORAGE_KEYS.LAST_STATUS] || null;
}

export async function setLastStatus(statusObj, storageArea) {
  const store = resolveStorage(storageArea);
  const payload = {
    timestamp: Date.now(),
    ...statusObj,
  };
  await store.set({ [STORAGE_KEYS.LAST_STATUS]: payload });
  return payload;
}

export async function getBatchStatus(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.BATCH_STATUS);
  return raw?.[STORAGE_KEYS.BATCH_STATUS] || null;
}

export async function setBatchStatus(statusObj, storageArea) {
  const store = resolveStorage(storageArea);
  const payload = {
    timestamp: Date.now(),
    ...statusObj,
  };
  await store.set({ [STORAGE_KEYS.BATCH_STATUS]: payload });
  return payload;
}
