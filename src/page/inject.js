/**
 * Page-world (MAIN world) script injected into `https://www.perplexity.ai/*` at `document_start`.
 *
 * Responsibilities:
 * 1. Wraps `window.fetch` before page scripts run.
 * 2. Clones and observes `POST /rest/sse/perplexity_ask` streams without delaying or altering
 *    Perplexity's own response consumption.
 * 3. Posts `answer-started` when a stream opens and `answer-complete` when it finishes.
 * 4. Detects user-initiated manual calls to `POST /rest/thread/set_thread_title` (via wrapped fetch)
 *    so the extension never overwrites a manually renamed thread.
 * 5. Executes extension-initiated same-origin `set_thread_title` requests via `originalFetch`
 *    so requests carry first-party `Origin: https://www.perplexity.ai` and session cookies
 *    without triggering content-script CORS preflights or the manual-rename detector.
 */

import {
  MESSAGE_NS,
  WINDOW_MESSAGES,
  PERPLEXITY_CONFIG,
} from "../config/selectors.js";
import { createStreamAssembler, parseAskRequestBody } from "../lib/sse.js";
import { fetchAccountId, postThreadRename } from "../lib/perplexity-api.js";

const { endpoints, renameBodyFields, domMarkers } = PERPLEXITY_CONFIG;

function resolveTargetOrigin(win) {
  const origin = win?.location?.origin;
  return origin && origin !== "null" ? origin : "*";
}

function getPathname(input, win) {
  try {
    let rawUrl = "";
    if (typeof input === "string") {
      rawUrl = input;
    } else if (typeof URL !== "undefined" && input instanceof URL) {
      rawUrl = input.href;
    } else if (input && typeof input.url === "string") {
      rawUrl = input.url;
    }
    if (!rawUrl) return "";
    const base =
      win?.location?.origin && win.location.origin !== "null"
        ? win.location.origin
        : PERPLEXITY_CONFIG.origin;
    return new URL(rawUrl, base).pathname;
  } catch {
    return "";
  }
}

function getMethod(input, init) {
  if (init && typeof init.method === "string") {
    return init.method.toUpperCase();
  }
  if (input && typeof input.method === "string") {
    return input.method.toUpperCase();
  }
  return "GET";
}

/**
 * Captures the request body text without consuming `input` before `originalFetch(input, init)`.
 */
function captureRequestBody(input, init) {
  try {
    if (init && init.body != null) {
      if (typeof init.body === "string") {
        return Promise.resolve(init.body);
      }
      if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) {
        const decoded = new TextDecoder("utf-8").decode(init.body);
        return Promise.resolve(decoded);
      }
      if (typeof Blob !== "undefined" && init.body instanceof Blob) {
        return init.body.text().catch(() => "");
      }
    }
    if (input && typeof input.clone === "function") {
      const clonedReq = input.clone();
      return clonedReq.text().catch(() => "");
    }
  } catch {
    // Ignore body extraction errors so page fetch is never disrupted
  }
  return Promise.resolve("");
}

async function observeAskStream(clonedResponse, reqBodyPromise, postMessageFn) {
  try {
    const rawReqBody = await reqBodyPromise;
    const { question, isFollowUp } = parseAskRequestBody(rawReqBody);

    postMessageFn({
      ns: MESSAGE_NS,
      type: WINDOW_MESSAGES.ANSWER_STARTED,
      payload: {
        isFollowUp: Boolean(isFollowUp),
        hasQuestion: Boolean(question),
      },
    });

    if (!clonedResponse.body || typeof clonedResponse.body.getReader !== "function") {
      return;
    }

    const reader = clonedResponse.body.getReader();
    const decoder = new TextDecoder("utf-8");
    const assembler = createStreamAssembler();
    let finalSnapshot = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        const tail = decoder.decode();
        if (tail) {
          finalSnapshot = assembler.push(tail) || finalSnapshot;
        }
        finalSnapshot = assembler.flush() || finalSnapshot;
        break;
      }

      if (value) {
        const chunkText = decoder.decode(value, { stream: true });
        const snap = assembler.push(chunkText);
        if (snap) {
          finalSnapshot = snap;
          reader.cancel().catch(() => {});
          break;
        }
      }
    }

    if (!finalSnapshot) {
      return;
    }

    const ids = {
      contextUuid: finalSnapshot.contextUuid || null,
      readWriteToken: finalSnapshot.readWriteToken || null,
      backendUuid: finalSnapshot.backendUuid || null,
    };

    // Safe diagnostic log: booleans only, never question/answer/token values
    console.info("[ppx-autorename] answer-complete posted", {
      hasContextUuid: Boolean(ids.contextUuid),
      hasReadWriteToken: Boolean(ids.readWriteToken),
      hasBackendUuid: Boolean(ids.backendUuid),
      isFollowUp: Boolean(isFollowUp),
      hasAnswer: Boolean(finalSnapshot.answer),
    });

    postMessageFn({
      ns: MESSAGE_NS,
      type: WINDOW_MESSAGES.ANSWER_COMPLETE,
      payload: {
        question,
        answer: finalSnapshot.answer || "",
        isFollowUp: Boolean(isFollowUp),
        ids,
      },
    });
  } catch {
    // Never surface internal stream-observer errors into the host page
  }
}

async function notifyManualUserRename(reqBodyPromise, postMessageFn) {
  try {
    const raw = await reqBodyPromise;
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const contextUuid = parsed?.[renameBodyFields.contextUuid];
    if (typeof contextUuid === "string" && contextUuid.trim()) {
      postMessageFn({
        ns: MESSAGE_NS,
        type: WINDOW_MESSAGES.USER_RENAME,
        contextUuid: contextUuid.trim(),
      });
    }
  } catch {
    // Ignore malformed manual rename body
  }
}

/**
 * Installs the fetch wrapper and same-origin rename bridge onto `win`.
 * Idempotent: calling more than once on the same window is a no-op.
 *
 * @param {Window & typeof globalThis} [win]
 */
export function installPageScript(win = globalThis.window) {
  if (!win || typeof win.fetch !== "function") {
    return { installed: false };
  }
  if (win[domMarkers.globalFlag]) {
    return { installed: false, alreadyInstalled: true };
  }

  win[domMarkers.globalFlag] = true;
  try {
    win.document?.documentElement?.setAttribute(
      domMarkers.pageInjectedAttr,
      "1"
    );
  } catch {
    // Ignore if documentElement is not yet attached
  }

  console.info("[ppx-autorename] page script loaded");

  const originalFetch = win.fetch.bind(win);
  let cachedAccountId = null;
  let accountIdFetched = false;

  const postToPage = (msg) => {
    win.postMessage(msg, resolveTargetOrigin(win));
  };

  const wrappedFetch = async function ppxWrappedFetch(input, init) {
    const method = getMethod(input, init);
    const pathname = getPathname(input, win);

    if (method === "POST" && pathname === endpoints.renamePath) {
      const reqBodyPromise = captureRequestBody(input, init);
      notifyManualUserRename(reqBodyPromise, postToPage);
      return originalFetch(input, init);
    }

    if (method === "POST" && pathname === endpoints.askStreamPath) {
      const reqBodyPromise = captureRequestBody(input, init);
      const response = await originalFetch(input, init);
      if (response && response.ok && typeof response.clone === "function") {
        try {
          const cloned = response.clone();
          observeAskStream(cloned, reqBodyPromise, postToPage);
        } catch {
          // Ignore clone failures
        }
      }
      return response;
    }

    return originalFetch(input, init);
  };

  try {
    Object.defineProperty(wrappedFetch, "name", {
      value: "fetch",
      configurable: true,
    });
  } catch {
    // Ignore descriptor failure in restricted environments
  }

  win.fetch = wrappedFetch;

  // Same-origin rename bridge for the content script (uses `originalFetch` so it
  // bypasses `wrappedFetch` and preserves true page Origin & cookies).
  const onWindowMessage = async (event) => {
    if (event.source !== win) return;
    const msg = event.data;
    if (
      !msg ||
      msg.ns !== MESSAGE_NS ||
      msg.type !== WINDOW_MESSAGES.RENAME_REQUEST ||
      typeof msg.requestId !== "string"
    ) {
      return;
    }

    const origin =
      win.location?.origin && win.location.origin !== "null"
        ? win.location.origin
        : PERPLEXITY_CONFIG.origin;

    if (!accountIdFetched) {
      accountIdFetched = true;
      cachedAccountId = await fetchAccountId(originalFetch, origin);
    }

    const result = await postThreadRename({
      contextUuid: msg.contextUuid,
      readWriteToken: msg.readWriteToken,
      title: msg.title,
      accountId: cachedAccountId,
      fetchImpl: originalFetch,
      origin,
    });

    if (result.ok && win.document && typeof msg.title === "string" && msg.title) {
      try {
        win.document.title = msg.title;
      } catch {
        // Ignore document.title write errors
      }
    }

    postToPage({
      ns: MESSAGE_NS,
      type: WINDOW_MESSAGES.RENAME_RESPONSE,
      requestId: msg.requestId,
      result,
    });
  };

  win.addEventListener("message", onWindowMessage);

  return {
    installed: true,
    uninstall() {
      win.removeEventListener("message", onWindowMessage);
      win.fetch = originalFetch;
      delete win[domMarkers.globalFlag];
    },
  };
}

if (
  typeof window !== "undefined" &&
  !window.__ppxDisableAutoInit
) {
  installPageScript(window);
}
