/**
 * Pure parsing, timestamp normalization, and batch-selection helpers for
 * Perplexity Library threads and current-chat detail hydration.
 *
 * All Perplexity path prefixes and JSON field names come exclusively from `src/config/selectors.js`.
 */

import { PERPLEXITY_CONFIG } from "../config/selectors.js";
import { extractAnswerText, extractThreadIds } from "./sse.js";

const LF = PERPLEXITY_CONFIG.listItemFields;
const DF = PERPLEXITY_CONFIG.threadDetailFields;

const DAY_MS = 86_400_000;
const ZONED_ISO_RE =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;

function nonEmptyStr(val) {
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

function isPlainObject(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Extracts the Perplexity thread slug from a URL string or pathname (`/search/<slug>`).
 *
 * @param {string | null | undefined} urlOrPathname
 * @returns {string | null}
 */
export function parseSlugFromUrl(urlOrPathname) {
  if (typeof urlOrPathname !== "string" || !urlOrPathname.trim()) {
    return null;
  }

  let pathname = urlOrPathname.trim();
  try {
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
    } else {
      pathname = pathname.split(/[?#]/)[0];
    }
  } catch {
    return null;
  }

  const prefix = PERPLEXITY_CONFIG.searchPathPrefix;
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const rawRest = pathname.slice(prefix.length).replace(/\/+$/, "");
  if (!rawRest || rawRest.includes("/")) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(rawRest).trim();
    return decoded.length > 0 && decoded.length <= 200 ? decoded : null;
  } catch {
    return rawRest.length <= 200 ? rawRest : null;
  }
}

/**
 * Parses Perplexity timestamps into UTC epoch milliseconds.
 * Perplexity's library list emits zoneless UTC ISO strings with microseconds
 * (e.g. `2026-10-25T14:22:10.482910`), while entry records include `+00:00` or `Z`.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function parsePerplexityTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Distinguish Unix seconds vs milliseconds
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const match = ZONED_ISO_RE.exec(trimmed);
  if (match) {
    const [, datePart, timePart, fracPart, zonePart] = match;
    const msFrac = fracPart ? `.${fracPart.slice(0, 3).padEnd(3, "0")}` : "";
    let normZone = "Z";
    if (zonePart && zonePart !== "Z") {
      normZone = zonePart.includes(":")
        ? zonePart
        : `${zonePart.slice(0, 3)}:${zonePart.slice(3)}`;
    }
    const parsed = Date.parse(`${datePart}T${timePart}${msFrac}${normZone}`);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const fallback = Date.parse(trimmed);
  return Number.isNaN(fallback) ? null : fallback;
}

/**
 * Parses a single item from `list_ask_threads` / `list_pinned_ask_threads`.
 *
 * @param {unknown} item
 * @returns {object | null}
 */
export function parseLibraryThreadItem(item) {
  if (!isPlainObject(item)) {
    return null;
  }

  const contextUuid =
    nonEmptyStr(item[LF.contextUuid]) || nonEmptyStr(item[LF.contextUuidAlt]);
  const slug =
    nonEmptyStr(item[LF.slug]) ||
    nonEmptyStr(item[LF.backendUuid]) ||
    nonEmptyStr(item[LF.uuid]);

  if (!contextUuid && !slug) {
    return null;
  }

  const backendUuid =
    nonEmptyStr(item[LF.backendUuid]) || nonEmptyStr(item[LF.uuid]) || slug;
  const readWriteToken =
    nonEmptyStr(item[LF.readWriteToken]) ||
    nonEmptyStr(item[LF.readWriteTokenAlt]);
  const title =
    nonEmptyStr(item[LF.title]) || nonEmptyStr(item[LF.name]) || "";
  const questionPreview =
    nonEmptyStr(item[LF.queryStr]) ||
    nonEmptyStr(item[LF.firstMessagePreview]) ||
    "";

  const updatedAtMs =
    parsePerplexityTimestampMs(item[LF.lastQueryDatetime]) ??
    parsePerplexityTimestampMs(item[LF.updatedDatetime]) ??
    parsePerplexityTimestampMs(item[LF.updatedAt]) ??
    parsePerplexityTimestampMs(item[LF.createdDatetime]) ??
    parsePerplexityTimestampMs(item[LF.createdAt]);

  return {
    key: contextUuid || slug,
    contextUuid: contextUuid || null,
    slug: slug || null,
    backendUuid: backendUuid || null,
    readWriteToken: readWriteToken || null,
    title,
    questionPreview,
    updatedAtMs,
    completed: !item[LF.status] || item[LF.status] === LF.completedStatus,
  };
}

/**
 * Parses a page response from `list_ask_threads`.
 * Supports both Perplexity's raw JSON array response (where the last item carries `has_next_page`)
 * and object-wrapped responses (`{ threads: [...], has_next_page }`).
 *
 * @param {unknown} rawOrJson
 * @returns {{ ok: boolean, items: object[], hasNextPage: boolean, error: string | null }}
 */
export function parseLibraryListPage(rawOrJson) {
  let payload = rawOrJson;
  if (typeof rawOrJson === "string") {
    try {
      payload = JSON.parse(rawOrJson);
    } catch {
      return {
        ok: false,
        items: [],
        hasNextPage: false,
        error: "Library response was not valid JSON",
      };
    }
  }

  let rawItems = null;
  let explicitHasNext = null;

  if (Array.isArray(payload)) {
    rawItems = payload;
    if (payload.length > 0) {
      const last = payload[payload.length - 1];
      if (isPlainObject(last) && typeof last[LF.hasNextPage] === "boolean") {
        explicitHasNext = last[LF.hasNextPage];
      }
    } else {
      explicitHasNext = false;
    }
  } else if (isPlainObject(payload)) {
    if (typeof payload[LF.hasNextPage] === "boolean") {
      explicitHasNext = payload[LF.hasNextPage];
    }
    for (const k of LF.containerKeys) {
      if (Array.isArray(payload[k])) {
        rawItems = payload[k];
        break;
      }
    }
  }

  if (!Array.isArray(rawItems)) {
    return {
      ok: false,
      items: [],
      hasNextPage: false,
      error: "Unexpected library list payload format",
    };
  }

  const items = [];
  for (const raw of rawItems) {
    const parsed = parseLibraryThreadItem(raw);
    if (parsed) {
      items.push(parsed);
    }
  }

  const hasNextPage =
    explicitHasNext !== null ? explicitHasNext : rawItems.length > 0;

  return {
    ok: true,
    items,
    hasNextPage: rawItems.length === 0 ? false : hasNextPage,
    error: null,
  };
}

/**
 * Parses a single thread detail response (`GET /rest/thread/:slug`) to extract
 * the thread's `contextUuid`, `readWriteToken`, opening `question`, and opening `answer`.
 *
 * @param {unknown} rawOrJson
 * @param {object} [fallbacks]
 * @returns {{ ok: boolean, detail: object | null, error: string | null }}
 */
export function parseThreadDetailPayload(rawOrJson, fallbacks = {}) {
  let payload = rawOrJson;
  if (typeof rawOrJson === "string") {
    try {
      payload = JSON.parse(rawOrJson);
    } catch {
      return {
        ok: false,
        detail: null,
        error: "Thread detail response was not valid JSON",
      };
    }
  }

  if (!isPlainObject(payload)) {
    return {
      ok: false,
      detail: null,
      error: "Thread detail response was not a JSON object",
    };
  }

  const entries = Array.isArray(payload[DF.entries]) ? payload[DF.entries] : [];
  const firstEntry = entries.find((e) => isPlainObject(e)) || null;
  const threadObj = isPlainObject(payload[DF.thread]) ? payload[DF.thread] : null;

  const topIds = extractThreadIds(payload);
  const entryIds = firstEntry ? extractThreadIds(firstEntry) : { contextUuid: null, readWriteToken: null, backendUuid: null };

  const contextUuid =
    entryIds.contextUuid ||
    topIds.contextUuid ||
    nonEmptyStr(firstEntry?.[DF.contextUuid]) ||
    nonEmptyStr(firstEntry?.[DF.contextUuidAlt]) ||
    nonEmptyStr(threadObj?.[DF.contextUuid]) ||
    nonEmptyStr(threadObj?.[DF.contextUuidAlt]) ||
    nonEmptyStr(fallbacks.contextUuid) ||
    null;

  const readWriteToken =
    topIds.readWriteToken ||
    entryIds.readWriteToken ||
    nonEmptyStr(payload[DF.readWriteToken]) ||
    nonEmptyStr(payload[DF.readWriteTokenAlt]) ||
    nonEmptyStr(threadObj?.[DF.readWriteToken]) ||
    nonEmptyStr(threadObj?.[DF.readWriteTokenAlt]) ||
    nonEmptyStr(firstEntry?.[DF.readWriteToken]) ||
    nonEmptyStr(firstEntry?.[DF.readWriteTokenAlt]) ||
    nonEmptyStr(fallbacks.readWriteToken) ||
    null;

  const backendUuid =
    entryIds.backendUuid ||
    topIds.backendUuid ||
    nonEmptyStr(firstEntry?.[DF.backendUuid]) ||
    nonEmptyStr(firstEntry?.[DF.uuid]) ||
    nonEmptyStr(fallbacks.backendUuid) ||
    nonEmptyStr(fallbacks.slug) ||
    null;

  const currentTitle =
    nonEmptyStr(payload[DF.title]) ||
    nonEmptyStr(threadObj?.[DF.title]) ||
    nonEmptyStr(firstEntry?.[DF.threadTitle]) ||
    nonEmptyStr(fallbacks.title) ||
    "";

  const question =
    nonEmptyStr(firstEntry?.[DF.queryStr]) ||
    nonEmptyStr(firstEntry?.[DF.query]) ||
    nonEmptyStr(payload[DF.queryStr]) ||
    nonEmptyStr(fallbacks.question) ||
    "";

  const answer =
    (firstEntry ? extractAnswerText(firstEntry) : "") ||
    extractAnswerText(payload) ||
    (typeof fallbacks.answer === "string" ? fallbacks.answer.trim() : "");

  return {
    ok: true,
    detail: {
      contextUuid,
      readWriteToken,
      backendUuid,
      slug: nonEmptyStr(fallbacks.slug) || backendUuid,
      currentTitle,
      question,
      answer,
    },
    error: null,
  };
}

/**
 * Normalizes a batch specification from UI presets or custom inputs.
 *
 * @param {object} [raw]
 * @returns {{ mode: "count" | "days" | "all", count: number, days: number, skipAlreadyRenamed: boolean, label: string }}
 */
export function normalizeBatchSpec(raw = {}) {
  const skipAlreadyRenamed =
    typeof raw.skipAlreadyRenamed === "boolean" ? raw.skipAlreadyRenamed : true;
  const mode = raw.mode === "days" || raw.mode === "all" ? raw.mode : "count";

  if (mode === "all") {
    return {
      mode: "all",
      count: 0,
      days: 0,
      skipAlreadyRenamed,
      label: "All Library Chats",
    };
  }

  if (mode === "days") {
    const days = Math.max(1, Math.min(3650, Math.floor(Number(raw.days) || 30)));
    return {
      mode: "days",
      count: 0,
      days,
      skipAlreadyRenamed,
      label: `Last ${days} Day${days === 1 ? "" : "s"} of Library`,
    };
  }

  const count = Math.max(1, Math.min(5000, Math.floor(Number(raw.count) || 50)));
  return {
    mode: "count",
    count,
    days: 0,
    skipAlreadyRenamed,
    label: `Past ${count} Chat${count === 1 ? "" : "s"}`,
  };
}

/**
 * Determines whether the library scanner has fetched enough pages for `spec`
 * without walking the entire historical archive unnecessarily.
 *
 * @param {object[]} pageItems
 * @param {{ mode: string, count: number, days: number }} spec
 * @param {{ collectedCount: number, nowMs?: number }} ctx
 * @returns {boolean}
 */
export function shouldStopLibraryPagination(
  pageItems,
  spec,
  { collectedCount = 0, nowMs = Date.now() } = {}
) {
  if (!Array.isArray(pageItems) || pageItems.length === 0) {
    return true;
  }

  if (spec.mode === "count") {
    return collectedCount >= spec.count;
  }

  if (spec.mode === "days") {
    const cutoffMs = nowMs - spec.days * DAY_MS;
    const datedItems = pageItems.filter(
      (item) => typeof item.updatedAtMs === "number"
    );
    // Because regular threads are sorted newest-first, once every dated item on a page
    // is strictly older than cutoffMs, all deeper pages are older as well.
    if (
      datedItems.length > 0 &&
      datedItems.every((item) => item.updatedAtMs < cutoffMs)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Selects eligible batch candidates and counts skipped threads in deterministic order.
 *
 * @param {object[]} threads
 * @param {{ mode: "count" | "days" | "all", count: number, days: number, skipAlreadyRenamed: boolean }} spec
 * @param {{ nowMs?: number, alreadyRenamedIds?: Iterable<string>, userRenamedIds?: Iterable<string> }} [opts]
 * @returns {{ scopedTotal: number, toRename: object[], preSkipped: number }}
 */
export function selectBatchCandidates(
  threads,
  spec,
  {
    nowMs = Date.now(),
    alreadyRenamedIds = [],
    userRenamedIds = [],
  } = {}
) {
  const renamedSet =
    alreadyRenamedIds instanceof Set
      ? alreadyRenamedIds
      : new Set(alreadyRenamedIds);
  const manualSet =
    userRenamedIds instanceof Set ? userRenamedIds : new Set(userRenamedIds);

  let inScope = Array.isArray(threads) ? [...threads] : [];

  if (spec.mode === "days") {
    const cutoffMs = nowMs - spec.days * DAY_MS;
    inScope = inScope.filter(
      (t) => typeof t.updatedAtMs === "number" && t.updatedAtMs >= cutoffMs
    );
  } else if (spec.mode === "count") {
    inScope = inScope.slice(0, spec.count);
  }

  const toRename = [];
  let preSkipped = 0;

  for (const item of inScope) {
    const cid = item.contextUuid;
    // Never overwrite manual user edits
    if (cid && manualSet.has(cid)) {
      preSkipped++;
      continue;
    }
    if (spec.skipAlreadyRenamed && cid && renamedSet.has(cid)) {
      preSkipped++;
      continue;
    }
    toRename.push(item);
  }

  return {
    scopedTotal: inScope.length,
    toRename,
    preSkipped,
  };
}
