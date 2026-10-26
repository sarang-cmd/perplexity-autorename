/**
 * Perplexity same-origin HTTP helpers for:
 * - fetching the session account ID (`GET /api/auth/session` -> `user.id` only)
 * - renaming a thread (`POST /rest/thread/set_thread_title?version=2.18&source=default`)
 * - listing library threads (`POST /rest/thread/list_ask_threads`)
 * - hydrating a single thread's opening exchange (`GET /rest/thread/:slug`)
 *
 * All paths, query parameters, header names, and body keys come exclusively
 * from `src/config/selectors.js`.
 */

import { PERPLEXITY_CONFIG } from "../config/selectors.js";
import { parseLibraryListPage, parseThreadDetailPayload } from "./library.js";

const {
  endpoints,
  queryParams,
  threadDetailQueryParams: TDQ,
  listRequestFields: LRF,
  headers: H,
  renameBodyFields: RB,
  sessionFields: SF,
} = PERPLEXITY_CONFIG;

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveOrigin(origin) {
  return origin && origin !== "null" ? origin : PERPLEXITY_CONFIG.origin;
}

/**
 * Builds the full rename endpoint URL relative to `origin`.
 */
export function buildRenameUrl(origin = PERPLEXITY_CONFIG.origin) {
  const url = new URL(endpoints.renamePath, resolveOrigin(origin));
  url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
  url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
  return url.toString();
}

/**
 * Builds the session endpoint URL relative to `origin`.
 */
export function buildSessionUrl(origin = PERPLEXITY_CONFIG.origin) {
  return new URL(endpoints.sessionPath, resolveOrigin(origin)).toString();
}

/**
 * Builds the library list endpoint URL relative to `origin`.
 */
export function buildListThreadsUrl(
  origin = PERPLEXITY_CONFIG.origin,
  { pinned = false } = {}
) {
  const path = pinned
    ? endpoints.listPinnedThreadsPath
    : endpoints.listThreadsPath;
  const url = new URL(path, resolveOrigin(origin));
  url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
  url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
  return url.toString();
}

/**
 * Builds the thread detail endpoint URL relative to `origin`.
 */
export function buildThreadDetailUrl(
  slug,
  origin = PERPLEXITY_CONFIG.origin,
  { limit = 1, offset = 0 } = {}
) {
  const path = `${endpoints.threadDetailPathPrefix}${encodeURIComponent(slug)}`;
  const url = new URL(path, resolveOrigin(origin));
  url.searchParams.set(TDQ.withParentInfo, "true");
  url.searchParams.set(TDQ.withSchematizedResponse, "true");
  url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
  url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
  url.searchParams.set(TDQ.limit, String(limit));
  url.searchParams.set(TDQ.offset, String(offset));
  url.searchParams.set(TDQ.fromFirst, "true");
  return url.toString();
}

function buildCommonHeaders(accountId, { jsonBody = false, reason } = {}) {
  const reqHeaders = {
    Accept: "application/json",
    [H.apiClient]: PERPLEXITY_CONFIG.apiClient,
    [H.apiVersion]: PERPLEXITY_CONFIG.apiVersion,
    [H.requestId]: generateRequestId(),
  };
  if (jsonBody) {
    reqHeaders[H.contentType] = "application/json";
  }
  if (reason) {
    reqHeaders[H.requestReason] = reason;
  }
  if (typeof accountId === "string" && accountId.trim().length > 0) {
    reqHeaders[H.account] = accountId.trim();
  }
  return reqHeaders;
}

/**
 * Fetches ONLY `user.id` from `/api/auth/session`.
 * Never stores or logs any other fields from the session response.
 */
export async function fetchAccountId(
  fetchImpl = fetch,
  origin = PERPLEXITY_CONFIG.origin
) {
  try {
    const res = await fetchImpl(buildSessionUrl(origin), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    const id = data?.[SF.user]?.[SF.userId];
    return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Sends a single `POST /rest/thread/set_thread_title` request.
 */
export async function postThreadRename({
  contextUuid,
  readWriteToken,
  title,
  accountId = null,
  fetchImpl = fetch,
  origin = PERPLEXITY_CONFIG.origin,
}) {
  const reqHeaders = {
    [H.contentType]: "application/json",
    [H.apiClient]: PERPLEXITY_CONFIG.apiClient,
    [H.apiVersion]: PERPLEXITY_CONFIG.apiVersion,
    [H.requestReason]: PERPLEXITY_CONFIG.renameRequestReason,
    [H.requestId]: generateRequestId(),
  };

  if (typeof accountId === "string" && accountId.trim().length > 0) {
    reqHeaders[H.account] = accountId.trim();
  }

  const body = {
    [RB.contextUuid]: contextUuid,
    [RB.title]: title,
  };
  if (typeof readWriteToken === "string" && readWriteToken.trim().length > 0) {
    body[RB.readWriteToken] = readWriteToken;
  }

  try {
    const res = await fetchImpl(buildRenameUrl(origin), {
      method: "POST",
      credentials: "include",
      headers: reqHeaders,
      body: JSON.stringify(body),
    });

    if (res.status === 204 || res.ok) {
      return { ok: true, status: res.status, error: null };
    }

    const endpointLabel =
      endpoints.renamePath.split("/").filter(Boolean).pop() || "rename";
    return {
      ok: false,
      status: res.status,
      error: `${endpointLabel} returned HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.message || "Network error during thread rename",
    };
  }
}

/**
 * Fetches one page of the user's Perplexity Library (`list_ask_threads` or `list_pinned_ask_threads`).
 */
export async function fetchLibraryThreadsPage({
  offset = 0,
  limit = 20,
  pinned = false,
  accountId = null,
  fetchImpl = fetch,
  origin = PERPLEXITY_CONFIG.origin,
} = {}) {
  const reqHeaders = buildCommonHeaders(accountId, {
    jsonBody: true,
    reason: PERPLEXITY_CONFIG.libraryRequestReason,
  });

  const reqBody = {
    [LRF.limit]: limit,
    [LRF.offset]: offset,
    [LRF.ascending]: false,
    [LRF.searchTerm]: "",
  };

  try {
    const res = await fetchImpl(buildListThreadsUrl(origin, { pinned }), {
      method: "POST",
      credentials: "include",
      headers: reqHeaders,
      body: JSON.stringify(reqBody),
    });

    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        items: [],
        hasNextPage: false,
        fatal: true,
        error: "Sign in to perplexity.ai before running library batch rename (HTTP 401).",
      };
    }

    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        items: [],
        hasNextPage: false,
        fatal: true,
        error: "Perplexity blocked the request (HTTP 403 / Cloudflare check). Open perplexity.ai and retry.",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        items: [],
        hasNextPage: false,
        fatal: res.status === 429,
        error: `Library list returned HTTP ${res.status}`,
      };
    }

    const rawText = await res.text();
    const parsed = parseLibraryListPage(rawText);
    if (!parsed.ok) {
      return {
        ok: false,
        status: res.status,
        items: [],
        hasNextPage: false,
        fatal: false,
        error: parsed.error,
      };
    }

    return {
      ok: true,
      status: res.status,
      items: parsed.items,
      hasNextPage: parsed.hasNextPage,
      fatal: false,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      items: [],
      hasNextPage: false,
      fatal: false,
      error: err?.message || "Network error reading Perplexity Library",
    };
  }
}

/**
 * Fetches a single thread's opening entry and rename identifiers by slug (`GET /rest/thread/:slug`).
 */
export async function fetchThreadDetail({
  slug,
  accountId = null,
  fetchImpl = fetch,
  origin = PERPLEXITY_CONFIG.origin,
  fallbacks = {},
} = {}) {
  if (!slug || typeof slug !== "string" || !slug.trim()) {
    return {
      ok: false,
      status: 0,
      detail: null,
      fatal: false,
      error: "No thread slug found in URL",
    };
  }

  const reqHeaders = buildCommonHeaders(accountId, {
    jsonBody: false,
    reason: PERPLEXITY_CONFIG.renameRequestReason,
  });

  try {
    const res = await fetchImpl(
      buildThreadDetailUrl(slug.trim(), origin, { limit: 1, offset: 0 }),
      {
        method: "GET",
        credentials: "include",
        headers: reqHeaders,
      }
    );

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: res.status,
        detail: null,
        fatal: true,
        error:
          res.status === 401
            ? "Not signed in on perplexity.ai (HTTP 401)"
            : "Perplexity returned HTTP 403 (check open tab for verification)",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        detail: null,
        fatal: res.status === 429,
        error: `Thread detail returned HTTP ${res.status}`,
      };
    }

    const rawText = await res.text();
    const parsed = parseThreadDetailPayload(rawText, {
      slug: slug.trim(),
      ...fallbacks,
    });

    if (!parsed.ok || !parsed.detail) {
      return {
        ok: false,
        status: res.status,
        detail: null,
        fatal: false,
        error: parsed.error || "Could not parse thread detail",
      };
    }

    return {
      ok: true,
      status: res.status,
      detail: parsed.detail,
      fatal: false,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail: null,
      fatal: false,
      error: err?.message || "Network error fetching thread detail",
    };
  }
}
