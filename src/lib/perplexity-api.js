/**
 * Perplexity same-origin HTTP helpers for fetching the session account ID
 * (`GET /api/auth/session` -> `user.id` only) and renaming a thread
 * (`POST /rest/thread/set_thread_title?version=2.18&source=default`).
 *
 * All paths, query parameters, header names, and body keys come exclusively
 * from `src/config/selectors.js`.
 */

import { PERPLEXITY_CONFIG } from "../config/selectors.js";

const { endpoints, queryParams, headers: H, renameBodyFields: RB, sessionFields: SF } =
  PERPLEXITY_CONFIG;

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

/**
 * Builds the full rename endpoint URL relative to `origin`.
 *
 * @param {string} [origin]
 * @returns {string}
 */
export function buildRenameUrl(origin = PERPLEXITY_CONFIG.origin) {
  const base = origin && origin !== "null" ? origin : PERPLEXITY_CONFIG.origin;
  const url = new URL(endpoints.renamePath, base);
  url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
  url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
  return url.toString();
}

/**
 * Builds the session endpoint URL relative to `origin`.
 *
 * @param {string} [origin]
 * @returns {string}
 */
export function buildSessionUrl(origin = PERPLEXITY_CONFIG.origin) {
  const base = origin && origin !== "null" ? origin : PERPLEXITY_CONFIG.origin;
  return new URL(endpoints.sessionPath, base).toString();
}

/**
 * Fetches ONLY `user.id` from `/api/auth/session`.
 * Never stores or logs any other fields from the session response.
 *
 * @param {typeof fetch} fetchImpl
 * @param {string} [origin]
 * @returns {Promise<string | null>}
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
 *
 * @param {object} opts
 * @param {string} opts.contextUuid
 * @param {string} opts.readWriteToken
 * @param {string} opts.title
 * @param {string | null} [opts.accountId]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {string} [opts.origin]
 * @returns {Promise<{ ok: boolean, status: number, error: string | null }>}
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
    [RB.readWriteToken]: readWriteToken,
  };

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

    const endpointLabel = endpoints.renamePath.split("/").filter(Boolean).pop() || "rename";
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
