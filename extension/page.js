(() => {
  // src/config/selectors.js
  var MESSAGE_NS = "ppx-autorename";
  var WINDOW_MESSAGES = {
    ANSWER_STARTED: "answer-started",
    ANSWER_COMPLETE: "answer-complete",
    USER_RENAME: "user-rename",
    RENAME_REQUEST: "page-rename-request",
    RENAME_RESPONSE: "page-rename-response"
  };
  var PERPLEXITY_CONFIG = {
    origin: "https://www.perplexity.ai",
    hostPattern: "https://www.perplexity.ai/*",
    searchPathPrefix: "/search/",
    apiVersion: "2.18",
    apiClient: "default",
    source: "default",
    renameRequestReason: "thread-item",
    endpoints: {
      askStreamPath: "/rest/sse/perplexity_ask",
      renamePath: "/rest/thread/set_thread_title",
      sessionPath: "/api/auth/session"
    },
    queryParams: {
      version: "version",
      source: "source"
    },
    headers: {
      contentType: "Content-Type",
      apiClient: "x-app-apiclient",
      apiVersion: "x-app-apiversion",
      requestReason: "x-perplexity-request-reason",
      account: "x-pplx-account",
      requestId: "x-request-id"
    },
    askRequestFields: {
      params: "params",
      queryStr: "query_str",
      fallbackQuery: "query",
      lastBackendUuid: "last_backend_uuid",
      isRelatedQuery: "is_related_query"
    },
    renameBodyFields: {
      contextUuid: "context_uuid",
      title: "title",
      readWriteToken: "read_write_token"
    },
    sessionFields: {
      user: "user",
      userId: "id"
    },
    streamFields: {
      eventPrefix: "event:",
      dataPrefix: "data:",
      commentPrefix: ":",
      messageEvent: "message",
      endEvent: "end_of_stream",
      status: "status",
      completedStatus: "COMPLETED",
      final: "final",
      finalSseMessage: "final_sse_message",
      contextUuid: "context_uuid",
      contextUuidAlt: "contextUUID",
      readWriteToken: "read_write_token",
      readWriteTokenAlt: "readWriteToken",
      backendUuid: "backend_uuid",
      backendUuidAlt: "backendUUID",
      nestedContainers: ["entry", "thread", "metadata"],
      itemType: "type",
      workflowItemText: "WORKFLOW_ITEM_TEXT",
      payload: "payload",
      textPayload: "text_payload",
      variant: "variant",
      answerVariant: "answer",
      text: "text",
      chunks: "chunks",
      // Alternate/fallback stream structures
      blocks: "blocks",
      intendedUsage: "intended_usage",
      askTextUsage: "ask_text",
      markdownBlock: "markdown_block",
      answer: "answer",
      stepType: "step_type",
      finalStepType: "FINAL",
      content: "content"
    },
    domMarkers: {
      pageInjectedAttr: "data-ppx-autorename-page",
      globalFlag: "__ppxAutorenameInstalled",
      toastHostId: "ppx-autorename-toast"
    }
  };

  // src/lib/sse.js
  var SF = PERPLEXITY_CONFIG.streamFields;
  var AF = PERPLEXITY_CONFIG.askRequestFields;
  function splitSseFrames(buffer) {
    if (typeof buffer !== "string" || buffer.length === 0) {
      return { frames: [], rest: "" };
    }
    let holdBack = "";
    let working = buffer;
    if (working.endsWith("\r\n\r")) {
      holdBack = "\r\n\r";
      working = working.slice(0, -3);
    } else if (working.endsWith("\n\r")) {
      holdBack = "\n\r";
      working = working.slice(0, -2);
    } else if (working.endsWith("\r")) {
      holdBack = "\r";
      working = working.slice(0, -1);
    }
    const delimiterRegex = /\r?\n\r?\n/g;
    const frames = [];
    let lastIndex = 0;
    let match;
    while ((match = delimiterRegex.exec(working)) !== null) {
      const raw = working.slice(lastIndex, match.index);
      if (raw.length > 0) {
        frames.push(raw);
      }
      lastIndex = match.index + match[0].length;
    }
    const rest = working.slice(lastIndex) + holdBack;
    return { frames, rest };
  }
  function parseSseFrame(rawFrame) {
    if (typeof rawFrame !== "string" || rawFrame.trim().length === 0) {
      return { event: "", rawData: "", data: null };
    }
    const lines = rawFrame.split(/\r?\n/);
    let event = SF.messageEvent;
    let hasExplicitEvent = false;
    const dataLines = [];
    for (const line of lines) {
      if (!line || line.startsWith(SF.commentPrefix)) {
        continue;
      }
      if (line.startsWith(SF.eventPrefix)) {
        event = line.slice(SF.eventPrefix.length).trim();
        hasExplicitEvent = true;
      } else if (line.startsWith(SF.dataPrefix)) {
        let value = line.slice(SF.dataPrefix.length);
        if (value.startsWith(" ")) {
          value = value.slice(1);
        }
        dataLines.push(value);
      }
    }
    if (!hasExplicitEvent && dataLines.length === 0) {
      return { event: "", rawData: "", data: null };
    }
    const rawData = dataLines.join("\n");
    let data = null;
    if (rawData.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawData);
        if (parsed && typeof parsed === "object") {
          data = parsed;
        }
      } catch {
        data = null;
      }
    }
    return { event, rawData, data };
  }
  function isCompletedMessageData(data) {
    if (!data || typeof data !== "object") {
      return false;
    }
    const isStatusCompleted = data[SF.status] === SF.completedStatus;
    const hasFinalFlag = data[SF.final] === true || data[SF.finalSseMessage] === true;
    return Boolean(isStatusCompleted || hasFinalFlag);
  }
  function nonEmptyString(val) {
    return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
  }
  function extractThreadIds(data) {
    const empty = { contextUuid: null, readWriteToken: null, backendUuid: null };
    if (!data || typeof data !== "object") {
      return empty;
    }
    let contextUuid = nonEmptyString(data[SF.contextUuid]) || nonEmptyString(data[SF.contextUuidAlt]);
    let readWriteToken = nonEmptyString(data[SF.readWriteToken]) || nonEmptyString(data[SF.readWriteTokenAlt]);
    let backendUuid = nonEmptyString(data[SF.backendUuid]) || nonEmptyString(data[SF.backendUuidAlt]);
    for (const key of SF.nestedContainers) {
      const sub = data[key];
      if (sub && typeof sub === "object") {
        if (!contextUuid) {
          contextUuid = nonEmptyString(sub[SF.contextUuid]) || nonEmptyString(sub[SF.contextUuidAlt]);
        }
        if (!readWriteToken) {
          readWriteToken = nonEmptyString(sub[SF.readWriteToken]) || nonEmptyString(sub[SF.readWriteTokenAlt]);
        }
        if (!backendUuid) {
          backendUuid = nonEmptyString(sub[SF.backendUuid]) || nonEmptyString(sub[SF.backendUuidAlt]);
        }
      }
    }
    return { contextUuid, readWriteToken, backendUuid };
  }
  function collectWorkflowAnswerParts(node, out, seen, depth) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        collectWorkflowAnswerParts(item, out, seen, depth + 1);
      }
      return;
    }
    if (node[SF.itemType] === SF.workflowItemText) {
      const tp = node[SF.payload]?.[SF.textPayload];
      if (tp && tp[SF.variant] === SF.answerVariant) {
        const directText = typeof tp[SF.text] === "string" && tp[SF.text].length > 0 ? tp[SF.text] : "";
        if (directText) {
          out.push(directText);
        } else if (Array.isArray(tp[SF.chunks])) {
          const joined = tp[SF.chunks].filter((c) => typeof c === "string").join("");
          if (joined.length > 0) {
            out.push(joined);
          }
        }
        return;
      }
    }
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (val && typeof val === "object") {
        collectWorkflowAnswerParts(val, out, seen, depth + 1);
      }
    }
  }
  function extractAnswerText(data) {
    if (!data || typeof data !== "object") {
      return "";
    }
    const workflowParts = [];
    collectWorkflowAnswerParts(data, workflowParts, /* @__PURE__ */ new Set(), 0);
    if (workflowParts.length > 0) {
      return workflowParts.join("\n\n").trim();
    }
    const rawTextField = data[SF.text];
    if (typeof rawTextField === "string") {
      const trimmed = rawTextField.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const inner = JSON.parse(trimmed);
          const innerWorkflowParts = [];
          collectWorkflowAnswerParts(inner, innerWorkflowParts, /* @__PURE__ */ new Set(), 0);
          if (innerWorkflowParts.length > 0) {
            return innerWorkflowParts.join("\n\n").trim();
          }
          if (Array.isArray(inner)) {
            for (const step of inner) {
              if (step && step[SF.stepType] === SF.finalStepType) {
                const stepAnswer = step[SF.content]?.[SF.answer];
                if (typeof stepAnswer === "string" && stepAnswer.trim()) {
                  try {
                    const parsedStepAnswer = JSON.parse(stepAnswer);
                    if (typeof parsedStepAnswer?.[SF.answer] === "string") {
                      return parsedStepAnswer[SF.answer].trim();
                    }
                  } catch {
                    return stepAnswer.trim();
                  }
                }
              }
            }
          }
        } catch {
        }
      }
    }
    if (Array.isArray(data[SF.blocks])) {
      const blockParts = [];
      for (const block of data[SF.blocks]) {
        if (!block || typeof block !== "object") continue;
        const mb = block[SF.markdownBlock];
        if (mb && typeof mb === "object") {
          if (block[SF.intendedUsage] && block[SF.intendedUsage] !== SF.askTextUsage) {
            continue;
          }
          if (typeof mb[SF.answer] === "string" && mb[SF.answer].length > 0) {
            blockParts.push(mb[SF.answer]);
          } else if (Array.isArray(mb[SF.chunks])) {
            const joined = mb[SF.chunks].filter((c) => typeof c === "string").join("");
            if (joined) blockParts.push(joined);
          }
        }
      }
      if (blockParts.length > 0) {
        return blockParts.join("\n\n").trim();
      }
    }
    if (typeof data[SF.answer] === "string" && data[SF.answer].trim().length > 0) {
      return data[SF.answer].trim();
    }
    return "";
  }
  function isFollowUpRequest(body) {
    if (!body || typeof body !== "object") {
      return false;
    }
    const params = body[AF.params] && typeof body[AF.params] === "object" ? body[AF.params] : {};
    const lastBackend = nonEmptyString(params[AF.lastBackendUuid]) || nonEmptyString(body[AF.lastBackendUuid]);
    if (lastBackend) {
      return true;
    }
    const related = params[AF.isRelatedQuery] ?? body[AF.isRelatedQuery];
    if (related === true) {
      return true;
    }
    if (typeof related === "string" && related.trim().toLowerCase() === "true") {
      return true;
    }
    return false;
  }
  function parseAskRequestBody(rawBody) {
    let parsed = null;
    if (typeof rawBody === "string" && rawBody.trim().length > 0) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = null;
      }
    } else if (rawBody && typeof rawBody === "object") {
      parsed = rawBody;
    }
    if (!parsed || typeof parsed !== "object") {
      return { question: "", isFollowUp: false };
    }
    const params = parsed[AF.params] && typeof parsed[AF.params] === "object" ? parsed[AF.params] : {};
    const rawQuestion = typeof parsed[AF.queryStr] === "string" && parsed[AF.queryStr] || typeof params[AF.queryStr] === "string" && params[AF.queryStr] || typeof parsed[AF.fallbackQuery] === "string" && parsed[AF.fallbackQuery] || "";
    return {
      question: rawQuestion.trim(),
      isFollowUp: isFollowUpRequest(parsed)
    };
  }
  function createStreamAssembler() {
    let buffer = "";
    let contextUuid = null;
    let readWriteToken = null;
    let backendUuid = null;
    let latestAnswer = "";
    let sawCompleted = false;
    let sawEndOfStream = false;
    let emitted = false;
    function processRawFrame(rawFrame) {
      const frame = parseSseFrame(rawFrame);
      if (frame.event === SF.endEvent) {
        sawEndOfStream = true;
      }
      if (frame.data) {
        const ids = extractThreadIds(frame.data);
        if (ids.contextUuid) contextUuid = ids.contextUuid;
        if (ids.readWriteToken) readWriteToken = ids.readWriteToken;
        if (ids.backendUuid) backendUuid = ids.backendUuid;
        const text = extractAnswerText(frame.data);
        if (text) {
          latestAnswer = text;
        }
        if (isCompletedMessageData(frame.data)) {
          sawCompleted = true;
        }
      }
    }
    function buildSnapshot() {
      return {
        answer: latestAnswer,
        contextUuid,
        readWriteToken,
        backendUuid,
        completed: sawCompleted || sawEndOfStream
      };
    }
    return {
      /**
       * Pushes a decoded text chunk into the assembler.
       * Returns the final snapshot immediately if `event: end_of_stream` arrived after content/IDs;
       * otherwise returns null until more chunks or `flush()`.
       *
       * @param {string} chunk
       * @returns { ReturnType<typeof buildSnapshot> | null }
       */
      push(chunk) {
        if (emitted || typeof chunk !== "string" || chunk.length === 0) {
          return null;
        }
        buffer += chunk;
        const { frames, rest } = splitSseFrames(buffer);
        buffer = rest;
        for (const rawFrame of frames) {
          processRawFrame(rawFrame);
        }
        if (sawEndOfStream && (sawCompleted || latestAnswer || contextUuid)) {
          emitted = true;
          return buildSnapshot();
        }
        return null;
      },
      /**
       * Flushes any trailing un-delimited frame at stream EOF and returns the final snapshot
       * if not already emitted and a completed message (or valid answer + thread ID) was observed.
       *
       * @returns { ReturnType<typeof buildSnapshot> | null }
       */
      flush() {
        if (emitted) {
          return null;
        }
        if (buffer.trim().length > 0) {
          processRawFrame(buffer);
          buffer = "";
        }
        if (sawCompleted || sawEndOfStream || latestAnswer && contextUuid) {
          emitted = true;
          return buildSnapshot();
        }
        return null;
      }
    };
  }

  // src/lib/perplexity-api.js
  var { endpoints, queryParams, headers: H, renameBodyFields: RB, sessionFields: SF2 } = PERPLEXITY_CONFIG;
  function generateRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0;
      const v = ch === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  function buildRenameUrl(origin = PERPLEXITY_CONFIG.origin) {
    const base = origin && origin !== "null" ? origin : PERPLEXITY_CONFIG.origin;
    const url = new URL(endpoints.renamePath, base);
    url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
    url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
    return url.toString();
  }
  function buildSessionUrl(origin = PERPLEXITY_CONFIG.origin) {
    const base = origin && origin !== "null" ? origin : PERPLEXITY_CONFIG.origin;
    return new URL(endpoints.sessionPath, base).toString();
  }
  async function fetchAccountId(fetchImpl = fetch, origin = PERPLEXITY_CONFIG.origin) {
    try {
      const res = await fetchImpl(buildSessionUrl(origin), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      const id = data?.[SF2.user]?.[SF2.userId];
      return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
    } catch {
      return null;
    }
  }
  async function postThreadRename({
    contextUuid,
    readWriteToken,
    title,
    accountId = null,
    fetchImpl = fetch,
    origin = PERPLEXITY_CONFIG.origin
  }) {
    const reqHeaders = {
      [H.contentType]: "application/json",
      [H.apiClient]: PERPLEXITY_CONFIG.apiClient,
      [H.apiVersion]: PERPLEXITY_CONFIG.apiVersion,
      [H.requestReason]: PERPLEXITY_CONFIG.renameRequestReason,
      [H.requestId]: generateRequestId()
    };
    if (typeof accountId === "string" && accountId.trim().length > 0) {
      reqHeaders[H.account] = accountId.trim();
    }
    const body = {
      [RB.contextUuid]: contextUuid,
      [RB.title]: title,
      [RB.readWriteToken]: readWriteToken
    };
    try {
      const res = await fetchImpl(buildRenameUrl(origin), {
        method: "POST",
        credentials: "include",
        headers: reqHeaders,
        body: JSON.stringify(body)
      });
      if (res.status === 204 || res.ok) {
        return { ok: true, status: res.status, error: null };
      }
      const endpointLabel = endpoints.renamePath.split("/").filter(Boolean).pop() || "rename";
      return {
        ok: false,
        status: res.status,
        error: `${endpointLabel} returned HTTP ${res.status}`
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || "Network error during thread rename"
      };
    }
  }

  // src/page/inject.js
  var { endpoints: endpoints2, renameBodyFields, domMarkers } = PERPLEXITY_CONFIG;
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
      const base = win?.location?.origin && win.location.origin !== "null" ? win.location.origin : PERPLEXITY_CONFIG.origin;
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
          hasQuestion: Boolean(question)
        }
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
            reader.cancel().catch(() => {
            });
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
        backendUuid: finalSnapshot.backendUuid || null
      };
      console.info("[ppx-autorename] answer-complete posted", {
        hasContextUuid: Boolean(ids.contextUuid),
        hasReadWriteToken: Boolean(ids.readWriteToken),
        hasBackendUuid: Boolean(ids.backendUuid),
        isFollowUp: Boolean(isFollowUp),
        hasAnswer: Boolean(finalSnapshot.answer)
      });
      postMessageFn({
        ns: MESSAGE_NS,
        type: WINDOW_MESSAGES.ANSWER_COMPLETE,
        payload: {
          question,
          answer: finalSnapshot.answer || "",
          isFollowUp: Boolean(isFollowUp),
          ids
        }
      });
    } catch {
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
          contextUuid: contextUuid.trim()
        });
      }
    } catch {
    }
  }
  function installPageScript(win = globalThis.window) {
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
      if (method === "POST" && pathname === endpoints2.renamePath) {
        const reqBodyPromise = captureRequestBody(input, init);
        notifyManualUserRename(reqBodyPromise, postToPage);
        return originalFetch(input, init);
      }
      if (method === "POST" && pathname === endpoints2.askStreamPath) {
        const reqBodyPromise = captureRequestBody(input, init);
        const response = await originalFetch(input, init);
        if (response && response.ok && typeof response.clone === "function") {
          try {
            const cloned = response.clone();
            observeAskStream(cloned, reqBodyPromise, postToPage);
          } catch {
          }
        }
        return response;
      }
      return originalFetch(input, init);
    };
    try {
      Object.defineProperty(wrappedFetch, "name", {
        value: "fetch",
        configurable: true
      });
    } catch {
    }
    win.fetch = wrappedFetch;
    const onWindowMessage = async (event) => {
      if (event.source !== win) return;
      const msg = event.data;
      if (!msg || msg.ns !== MESSAGE_NS || msg.type !== WINDOW_MESSAGES.RENAME_REQUEST || typeof msg.requestId !== "string") {
        return;
      }
      const origin = win.location?.origin && win.location.origin !== "null" ? win.location.origin : PERPLEXITY_CONFIG.origin;
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
        origin
      });
      if (result.ok && win.document && typeof msg.title === "string" && msg.title) {
        try {
          win.document.title = msg.title;
        } catch {
        }
      }
      postToPage({
        ns: MESSAGE_NS,
        type: WINDOW_MESSAGES.RENAME_RESPONSE,
        requestId: msg.requestId,
        result
      });
    };
    win.addEventListener("message", onWindowMessage);
    return {
      installed: true,
      uninstall() {
        win.removeEventListener("message", onWindowMessage);
        win.fetch = originalFetch;
        delete win[domMarkers.globalFlag];
      }
    };
  }
  if (typeof window !== "undefined" && !window.__ppxDisableAutoInit) {
    installPageScript(window);
  }
})();
