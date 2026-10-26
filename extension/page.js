(() => {
  // src/config/selectors.js
  var MESSAGE_NS = "ppx-autorename";
  var WINDOW_MESSAGES = {
    ANSWER_STARTED: "answer-started",
    ANSWER_COMPLETE: "answer-complete",
    USER_RENAME: "user-rename",
    RENAME_REQUEST: "page-rename-request",
    RENAME_RESPONSE: "page-rename-response",
    THREAD_DETAIL_REQUEST: "page-thread-detail-request",
    THREAD_DETAIL_RESPONSE: "page-thread-detail-response",
    LIST_THREADS_REQUEST: "page-list-threads-request",
    LIST_THREADS_RESPONSE: "page-list-threads-response"
  };
  var PERPLEXITY_CONFIG = {
    origin: "https://www.perplexity.ai",
    hostPattern: "https://www.perplexity.ai/*",
    searchPathPrefix: "/search/",
    apiVersion: "2.18",
    apiClient: "default",
    source: "default",
    renameRequestReason: "thread-item",
    libraryRequestReason: "library",
    defaultLibraryPageSize: 20,
    endpoints: {
      askStreamPath: "/rest/sse/perplexity_ask",
      renamePath: "/rest/thread/set_thread_title",
      sessionPath: "/api/auth/session",
      listThreadsPath: "/rest/thread/list_ask_threads",
      listPinnedThreadsPath: "/rest/thread/list_pinned_ask_threads",
      threadDetailPathPrefix: "/rest/thread/"
    },
    queryParams: {
      version: "version",
      source: "source"
    },
    threadDetailQueryParams: {
      withParentInfo: "with_parent_info",
      withSchematizedResponse: "with_schematized_response",
      limit: "limit",
      offset: "offset",
      fromFirst: "from_first"
    },
    listRequestFields: {
      limit: "limit",
      offset: "offset",
      ascending: "ascending",
      searchTerm: "search_term"
    },
    listItemFields: {
      contextUuid: "context_uuid",
      contextUuidAlt: "contextUUID",
      slug: "slug",
      backendUuid: "backend_uuid",
      uuid: "uuid",
      title: "title",
      name: "name",
      queryStr: "query_str",
      firstMessagePreview: "first_message_preview",
      readWriteToken: "read_write_token",
      readWriteTokenAlt: "readWriteToken",
      lastQueryDatetime: "last_query_datetime",
      updatedDatetime: "updated_datetime",
      createdDatetime: "created_datetime",
      createdAt: "created_at",
      updatedAt: "updated_at",
      queryCount: "query_count",
      status: "status",
      completedStatus: "COMPLETED",
      hasNextPage: "has_next_page",
      containerKeys: ["threads", "items", "data", "results"]
    },
    threadDetailFields: {
      entries: "entries",
      hasNextPage: "has_next_page",
      contextUuid: "context_uuid",
      contextUuidAlt: "contextUUID",
      readWriteToken: "read_write_token",
      readWriteTokenAlt: "readWriteToken",
      backendUuid: "backend_uuid",
      uuid: "uuid",
      status: "status",
      completedStatus: "COMPLETED",
      queryStr: "query_str",
      query: "query",
      title: "title",
      threadTitle: "thread_title",
      thread: "thread",
      entryCreatedDatetime: "entry_created_datetime",
      entryUpdatedDatetime: "entry_updated_datetime",
      blocks: "blocks"
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
      askTextSectionPattern: /^ask_text_(\d+)_markdown$/,
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
      const numberedParts = /* @__PURE__ */ new Map();
      for (const block of data[SF.blocks]) {
        if (!block || typeof block !== "object") continue;
        const mb = block[SF.markdownBlock];
        if (!mb || typeof mb !== "object") continue;
        const usage = block[SF.intendedUsage];
        const textVal = typeof mb[SF.answer] === "string" && mb[SF.answer].length > 0 ? mb[SF.answer] : Array.isArray(mb[SF.chunks]) ? mb[SF.chunks].filter((c) => typeof c === "string").join("") : "";
        if (!textVal) continue;
        if (!usage || usage === SF.askTextUsage) {
          blockParts.push(textVal);
          continue;
        }
        if (typeof usage === "string" && SF.askTextSectionPattern) {
          const m = SF.askTextSectionPattern.exec(usage);
          if (m && m[1] !== void 0) {
            const idx = Number(m[1]);
            if (!numberedParts.has(idx)) {
              numberedParts.set(idx, textVal);
            }
          }
        }
      }
      if (blockParts.length > 0) {
        return blockParts.join("\n\n").trim();
      }
      if (numberedParts.size > 0) {
        const sorted = [...numberedParts.entries()].sort((a, b) => a[0] - b[0]).map(([, val]) => val);
        return sorted.join("\n\n").trim();
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

  // src/lib/library.js
  var LF = PERPLEXITY_CONFIG.listItemFields;
  var DF = PERPLEXITY_CONFIG.threadDetailFields;
  var ZONED_ISO_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/;
  function nonEmptyStr(val) {
    return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
  }
  function isPlainObject(val) {
    return typeof val === "object" && val !== null && !Array.isArray(val);
  }
  function parseSlugFromUrl(urlOrPathname) {
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
  function parsePerplexityTimestampMs(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value < 1e11 ? Math.round(value * 1e3) : Math.round(value);
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
        normZone = zonePart.includes(":") ? zonePart : `${zonePart.slice(0, 3)}:${zonePart.slice(3)}`;
      }
      const parsed = Date.parse(`${datePart}T${timePart}${msFrac}${normZone}`);
      return Number.isNaN(parsed) ? null : parsed;
    }
    const fallback = Date.parse(trimmed);
    return Number.isNaN(fallback) ? null : fallback;
  }
  function parseLibraryThreadItem(item) {
    if (!isPlainObject(item)) {
      return null;
    }
    const contextUuid = nonEmptyStr(item[LF.contextUuid]) || nonEmptyStr(item[LF.contextUuidAlt]);
    const slug = nonEmptyStr(item[LF.slug]) || nonEmptyStr(item[LF.backendUuid]) || nonEmptyStr(item[LF.uuid]);
    if (!contextUuid && !slug) {
      return null;
    }
    const backendUuid = nonEmptyStr(item[LF.backendUuid]) || nonEmptyStr(item[LF.uuid]) || slug;
    const readWriteToken = nonEmptyStr(item[LF.readWriteToken]) || nonEmptyStr(item[LF.readWriteTokenAlt]);
    const title = nonEmptyStr(item[LF.title]) || nonEmptyStr(item[LF.name]) || "";
    const questionPreview = nonEmptyStr(item[LF.queryStr]) || nonEmptyStr(item[LF.firstMessagePreview]) || "";
    const updatedAtMs = parsePerplexityTimestampMs(item[LF.lastQueryDatetime]) ?? parsePerplexityTimestampMs(item[LF.updatedDatetime]) ?? parsePerplexityTimestampMs(item[LF.updatedAt]) ?? parsePerplexityTimestampMs(item[LF.createdDatetime]) ?? parsePerplexityTimestampMs(item[LF.createdAt]);
    return {
      key: contextUuid || slug,
      contextUuid: contextUuid || null,
      slug: slug || null,
      backendUuid: backendUuid || null,
      readWriteToken: readWriteToken || null,
      title,
      questionPreview,
      updatedAtMs,
      completed: !item[LF.status] || item[LF.status] === LF.completedStatus
    };
  }
  function parseLibraryListPage(rawOrJson) {
    let payload = rawOrJson;
    if (typeof rawOrJson === "string") {
      try {
        payload = JSON.parse(rawOrJson);
      } catch {
        return {
          ok: false,
          items: [],
          hasNextPage: false,
          error: "Library response was not valid JSON"
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
        error: "Unexpected library list payload format"
      };
    }
    const items = [];
    for (const raw of rawItems) {
      const parsed = parseLibraryThreadItem(raw);
      if (parsed) {
        items.push(parsed);
      }
    }
    const hasNextPage = explicitHasNext !== null ? explicitHasNext : rawItems.length > 0;
    return {
      ok: true,
      items,
      hasNextPage: rawItems.length === 0 ? false : hasNextPage,
      error: null
    };
  }
  function parseThreadDetailPayload(rawOrJson, fallbacks = {}) {
    let payload = rawOrJson;
    if (typeof rawOrJson === "string") {
      try {
        payload = JSON.parse(rawOrJson);
      } catch {
        return {
          ok: false,
          detail: null,
          error: "Thread detail response was not valid JSON"
        };
      }
    }
    if (!isPlainObject(payload)) {
      return {
        ok: false,
        detail: null,
        error: "Thread detail response was not a JSON object"
      };
    }
    const entries = Array.isArray(payload[DF.entries]) ? payload[DF.entries] : [];
    const firstEntry = entries.find((e) => isPlainObject(e)) || null;
    const threadObj = isPlainObject(payload[DF.thread]) ? payload[DF.thread] : null;
    const topIds = extractThreadIds(payload);
    const entryIds = firstEntry ? extractThreadIds(firstEntry) : { contextUuid: null, readWriteToken: null, backendUuid: null };
    const contextUuid = entryIds.contextUuid || topIds.contextUuid || nonEmptyStr(firstEntry?.[DF.contextUuid]) || nonEmptyStr(firstEntry?.[DF.contextUuidAlt]) || nonEmptyStr(threadObj?.[DF.contextUuid]) || nonEmptyStr(threadObj?.[DF.contextUuidAlt]) || nonEmptyStr(fallbacks.contextUuid) || null;
    const readWriteToken = topIds.readWriteToken || entryIds.readWriteToken || nonEmptyStr(payload[DF.readWriteToken]) || nonEmptyStr(payload[DF.readWriteTokenAlt]) || nonEmptyStr(threadObj?.[DF.readWriteToken]) || nonEmptyStr(threadObj?.[DF.readWriteTokenAlt]) || nonEmptyStr(firstEntry?.[DF.readWriteToken]) || nonEmptyStr(firstEntry?.[DF.readWriteTokenAlt]) || nonEmptyStr(fallbacks.readWriteToken) || null;
    const backendUuid = entryIds.backendUuid || topIds.backendUuid || nonEmptyStr(firstEntry?.[DF.backendUuid]) || nonEmptyStr(firstEntry?.[DF.uuid]) || nonEmptyStr(fallbacks.backendUuid) || nonEmptyStr(fallbacks.slug) || null;
    const currentTitle = nonEmptyStr(payload[DF.title]) || nonEmptyStr(threadObj?.[DF.title]) || nonEmptyStr(firstEntry?.[DF.threadTitle]) || nonEmptyStr(fallbacks.title) || "";
    const question = nonEmptyStr(firstEntry?.[DF.queryStr]) || nonEmptyStr(firstEntry?.[DF.query]) || nonEmptyStr(payload[DF.queryStr]) || nonEmptyStr(fallbacks.question) || "";
    const answer = (firstEntry ? extractAnswerText(firstEntry) : "") || extractAnswerText(payload) || (typeof fallbacks.answer === "string" ? fallbacks.answer.trim() : "");
    return {
      ok: true,
      detail: {
        contextUuid,
        readWriteToken,
        backendUuid,
        slug: nonEmptyStr(fallbacks.slug) || backendUuid,
        currentTitle,
        question,
        answer
      },
      error: null
    };
  }

  // src/lib/perplexity-api.js
  var {
    endpoints,
    queryParams,
    threadDetailQueryParams: TDQ,
    listRequestFields: LRF,
    headers: H,
    renameBodyFields: RB,
    sessionFields: SF2
  } = PERPLEXITY_CONFIG;
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
  function resolveOrigin(origin) {
    return origin && origin !== "null" ? origin : PERPLEXITY_CONFIG.origin;
  }
  function buildRenameUrl(origin = PERPLEXITY_CONFIG.origin) {
    const url = new URL(endpoints.renamePath, resolveOrigin(origin));
    url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
    url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
    return url.toString();
  }
  function buildSessionUrl(origin = PERPLEXITY_CONFIG.origin) {
    return new URL(endpoints.sessionPath, resolveOrigin(origin)).toString();
  }
  function buildListThreadsUrl(origin = PERPLEXITY_CONFIG.origin, { pinned = false } = {}) {
    const path = pinned ? endpoints.listPinnedThreadsPath : endpoints.listThreadsPath;
    const url = new URL(path, resolveOrigin(origin));
    url.searchParams.set(queryParams.version, PERPLEXITY_CONFIG.apiVersion);
    url.searchParams.set(queryParams.source, PERPLEXITY_CONFIG.source);
    return url.toString();
  }
  function buildThreadDetailUrl(slug, origin = PERPLEXITY_CONFIG.origin, { limit = 1, offset = 0 } = {}) {
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
      [H.requestId]: generateRequestId()
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
      [RB.title]: title
    };
    if (typeof readWriteToken === "string" && readWriteToken.trim().length > 0) {
      body[RB.readWriteToken] = readWriteToken;
    }
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
  async function fetchLibraryThreadsPage({
    offset = 0,
    limit = 20,
    pinned = false,
    accountId = null,
    fetchImpl = fetch,
    origin = PERPLEXITY_CONFIG.origin
  } = {}) {
    const reqHeaders = buildCommonHeaders(accountId, {
      jsonBody: true,
      reason: PERPLEXITY_CONFIG.libraryRequestReason
    });
    const reqBody = {
      [LRF.limit]: limit,
      [LRF.offset]: offset,
      [LRF.ascending]: false,
      [LRF.searchTerm]: ""
    };
    try {
      const res = await fetchImpl(buildListThreadsUrl(origin, { pinned }), {
        method: "POST",
        credentials: "include",
        headers: reqHeaders,
        body: JSON.stringify(reqBody)
      });
      if (res.status === 401) {
        return {
          ok: false,
          status: 401,
          items: [],
          hasNextPage: false,
          fatal: true,
          error: "Sign in to perplexity.ai before running library batch rename (HTTP 401)."
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          status: 403,
          items: [],
          hasNextPage: false,
          fatal: true,
          error: "Perplexity blocked the request (HTTP 403 / Cloudflare check). Open perplexity.ai and retry."
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          items: [],
          hasNextPage: false,
          fatal: res.status === 429,
          error: `Library list returned HTTP ${res.status}`
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
          error: parsed.error
        };
      }
      return {
        ok: true,
        status: res.status,
        items: parsed.items,
        hasNextPage: parsed.hasNextPage,
        fatal: false,
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        items: [],
        hasNextPage: false,
        fatal: false,
        error: err?.message || "Network error reading Perplexity Library"
      };
    }
  }
  async function fetchThreadDetail({
    slug,
    accountId = null,
    fetchImpl = fetch,
    origin = PERPLEXITY_CONFIG.origin,
    fallbacks = {}
  } = {}) {
    if (!slug || typeof slug !== "string" || !slug.trim()) {
      return {
        ok: false,
        status: 0,
        detail: null,
        fatal: false,
        error: "No thread slug found in URL"
      };
    }
    const reqHeaders = buildCommonHeaders(accountId, {
      jsonBody: false,
      reason: PERPLEXITY_CONFIG.renameRequestReason
    });
    try {
      const res = await fetchImpl(
        buildThreadDetailUrl(slug.trim(), origin, { limit: 1, offset: 0 }),
        {
          method: "GET",
          credentials: "include",
          headers: reqHeaders
        }
      );
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          detail: null,
          fatal: true,
          error: res.status === 401 ? "Not signed in on perplexity.ai (HTTP 401)" : "Perplexity returned HTTP 403 (check open tab for verification)"
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          detail: null,
          fatal: res.status === 429,
          error: `Thread detail returned HTTP ${res.status}`
        };
      }
      const rawText = await res.text();
      const parsed = parseThreadDetailPayload(rawText, {
        slug: slug.trim(),
        ...fallbacks
      });
      if (!parsed.ok || !parsed.detail) {
        return {
          ok: false,
          status: res.status,
          detail: null,
          fatal: false,
          error: parsed.error || "Could not parse thread detail"
        };
      }
      return {
        ok: true,
        status: res.status,
        detail: parsed.detail,
        fatal: false,
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        detail: null,
        fatal: false,
        error: err?.message || "Network error fetching thread detail"
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
      if (!msg || msg.ns !== MESSAGE_NS || typeof msg.requestId !== "string") {
        return;
      }
      const isHandled = msg.type === WINDOW_MESSAGES.RENAME_REQUEST || msg.type === WINDOW_MESSAGES.THREAD_DETAIL_REQUEST || msg.type === WINDOW_MESSAGES.LIST_THREADS_REQUEST;
      if (!isHandled) {
        return;
      }
      const origin = win.location?.origin && win.location.origin !== "null" ? win.location.origin : PERPLEXITY_CONFIG.origin;
      if (!accountIdFetched) {
        accountIdFetched = true;
        cachedAccountId = await fetchAccountId(originalFetch, origin);
      }
      if (msg.type === WINDOW_MESSAGES.RENAME_REQUEST) {
        const result = await postThreadRename({
          contextUuid: msg.contextUuid,
          readWriteToken: msg.readWriteToken,
          title: msg.title,
          accountId: cachedAccountId,
          fetchImpl: originalFetch,
          origin
        });
        const activeSlug = parseSlugFromUrl(win.location?.pathname || "");
        const shouldSyncDocTitle = !msg.batch && (!msg.slug || !activeSlug || activeSlug === msg.slug);
        if (result.ok && shouldSyncDocTitle && win.document && typeof msg.title === "string" && msg.title) {
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
        return;
      }
      if (msg.type === WINDOW_MESSAGES.THREAD_DETAIL_REQUEST) {
        const effectiveSlug = typeof msg.slug === "string" && msg.slug.trim() || parseSlugFromUrl(win.location?.pathname || "");
        const result = await fetchThreadDetail({
          slug: effectiveSlug,
          accountId: cachedAccountId,
          fetchImpl: originalFetch,
          origin
        });
        postToPage({
          ns: MESSAGE_NS,
          type: WINDOW_MESSAGES.THREAD_DETAIL_RESPONSE,
          requestId: msg.requestId,
          result
        });
        return;
      }
      if (msg.type === WINDOW_MESSAGES.LIST_THREADS_REQUEST) {
        const result = await fetchLibraryThreadsPage({
          offset: Number(msg.offset) || 0,
          limit: Number(msg.limit) || PERPLEXITY_CONFIG.defaultLibraryPageSize,
          pinned: Boolean(msg.pinned),
          accountId: cachedAccountId,
          fetchImpl: originalFetch,
          origin
        });
        postToPage({
          ns: MESSAGE_NS,
          type: WINDOW_MESSAGES.LIST_THREADS_RESPONSE,
          requestId: msg.requestId,
          result
        });
      }
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
