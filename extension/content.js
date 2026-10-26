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
  var RUNTIME_MESSAGES = {
    GET_STATE: "get-state",
    GENERATE_TITLE: "generate-title",
    RECORD_RENAME: "record-rename",
    RECORD_STATUS: "record-status",
    TEST_PROVIDER: "test-provider",
    SETTINGS_UPDATED: "settings-updated",
    PING_CONTENT: "ping-content",
    RENAME_CURRENT_CHAT: "rename-current-chat",
    START_BATCH_RENAME: "start-batch-rename",
    CANCEL_BATCH_RENAME: "cancel-batch-rename",
    GET_BATCH_STATUS: "get-batch-status",
    UPDATE_BATCH_STATUS: "update-batch-status"
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

  // src/lib/decide.js
  var DECISION_REASONS = {
    OK: "ok",
    DISABLED: "disabled",
    FOLLOW_UP: "follow-up",
    EMPTY_QUESTION: "empty-question",
    ALREADY_RENAMED: "already-renamed",
    EXCLUDED: "excluded"
  };
  function parseSinglePattern(raw) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) {
      return { regex: null, error: null };
    }
    try {
      const literalMatch = /^\/(.+)\/([dgimsuvy]*)$/.exec(trimmed);
      if (literalMatch) {
        const safeFlags = literalMatch[2].replace(/[gy]/g, "");
        return { regex: new RegExp(literalMatch[1], safeFlags), error: null };
      }
      return { regex: new RegExp(trimmed, "i"), error: null };
    } catch (err) {
      return {
        regex: null,
        error: `Invalid regex "${trimmed}": ${err?.message || "syntax error"}`
      };
    }
  }
  function compileExcludePatterns(patterns) {
    if (!patterns) {
      return { regexes: [], errors: [] };
    }
    const lines = Array.isArray(patterns) ? patterns : typeof patterns === "string" ? patterns.split(/\r?\n/) : [];
    const regexes = [];
    const errors = [];
    for (const item of lines) {
      if (typeof item !== "string" || item.trim().length === 0) {
        continue;
      }
      const { regex, error } = parseSinglePattern(item);
      if (regex) {
        regexes.push(regex);
      } else if (error) {
        errors.push(error);
      }
    }
    return { regexes, errors };
  }
  function matchesExcludePattern(question, patterns) {
    if (typeof question !== "string" || question.length === 0 || !patterns) {
      return false;
    }
    if (Array.isArray(patterns) && patterns.every((p) => p instanceof RegExp)) {
      return patterns.some((re) => re.test(question));
    }
    const { regexes } = compileExcludePatterns(patterns);
    return regexes.some((re) => re.test(question));
  }
  function hasId(collection, id) {
    if (!id || !collection) return false;
    if (collection instanceof Set) return collection.has(id);
    if (Array.isArray(collection)) return collection.includes(id);
    if (typeof collection === "object") return Boolean(collection[id]);
    return false;
  }
  function shouldRename({
    enabled = true,
    isFollowUp = false,
    contextUuid = null,
    alreadyRenamedIds = null,
    userRenamedIds = null,
    question = "",
    excludePatterns = []
  } = {}) {
    if (!enabled) {
      return { rename: false, reason: DECISION_REASONS.DISABLED };
    }
    if (isFollowUp) {
      return { rename: false, reason: DECISION_REASONS.FOLLOW_UP };
    }
    const cleanQuestion = typeof question === "string" ? question.trim() : "";
    if (!cleanQuestion) {
      return { rename: false, reason: DECISION_REASONS.EMPTY_QUESTION };
    }
    if (contextUuid && (hasId(alreadyRenamedIds, contextUuid) || hasId(userRenamedIds, contextUuid))) {
      return { rename: false, reason: DECISION_REASONS.ALREADY_RENAMED };
    }
    if (matchesExcludePattern(cleanQuestion, excludePatterns)) {
      return { rename: false, reason: DECISION_REASONS.EXCLUDED };
    }
    return { rename: true, reason: DECISION_REASONS.OK };
  }

  // src/lib/sse.js
  var SF = PERPLEXITY_CONFIG.streamFields;
  var AF = PERPLEXITY_CONFIG.askRequestFields;
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

  // src/lib/library.js
  var LF = PERPLEXITY_CONFIG.listItemFields;
  var DF = PERPLEXITY_CONFIG.threadDetailFields;
  var DAY_MS = 864e5;
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
  function normalizeBatchSpec(raw = {}) {
    const skipAlreadyRenamed = typeof raw.skipAlreadyRenamed === "boolean" ? raw.skipAlreadyRenamed : true;
    const mode = raw.mode === "days" || raw.mode === "all" ? raw.mode : "count";
    if (mode === "all") {
      return {
        mode: "all",
        count: 0,
        days: 0,
        skipAlreadyRenamed,
        label: "All Library Chats"
      };
    }
    if (mode === "days") {
      const days = Math.max(1, Math.min(3650, Math.floor(Number(raw.days) || 30)));
      return {
        mode: "days",
        count: 0,
        days,
        skipAlreadyRenamed,
        label: `Last ${days} Day${days === 1 ? "" : "s"} of Library`
      };
    }
    const count = Math.max(1, Math.min(5e3, Math.floor(Number(raw.count) || 50)));
    return {
      mode: "count",
      count,
      days: 0,
      skipAlreadyRenamed,
      label: `Past ${count} Chat${count === 1 ? "" : "s"}`
    };
  }
  function shouldStopLibraryPagination(pageItems, spec, { collectedCount = 0, nowMs = Date.now() } = {}) {
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
      if (datedItems.length > 0 && datedItems.every((item) => item.updatedAtMs < cutoffMs)) {
        return true;
      }
    }
    return false;
  }
  function selectBatchCandidates(threads, spec, {
    nowMs = Date.now(),
    alreadyRenamedIds = [],
    userRenamedIds = []
  } = {}) {
    const renamedSet = alreadyRenamedIds instanceof Set ? alreadyRenamedIds : new Set(alreadyRenamedIds);
    const manualSet = userRenamedIds instanceof Set ? userRenamedIds : new Set(userRenamedIds);
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
      preSkipped
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

  // src/ui/pixel-logo.js
  var SVG_NS = "http://www.w3.org/2000/svg";
  var PIXEL_ROWS = [
    "..111111111111..",
    ".12222222222221.",
    "1200000000000001",
    "1203333333000001",
    "1203333333300001",
    "1203300003300001",
    "1203300003300001",
    "1203333333300001",
    "1203333333000001",
    "1203300000000441",
    "1203300000000441",
    "1203300555555441",
    "1203300555555441",
    "1200000000000001",
    ".10000000000001.",
    "..111111111111.."
  ];
  var PALETTE = {
    "0": "#11222b",
    "1": "#081116",
    "2": "#1e3a49",
    "3": "#f0fdfa",
    "4": "#5eead4",
    "5": "#2dd4bf"
  };
  function createPixelLogoElement(doc = globalThis.document, { size = 32, className = "" } = {}) {
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("aria-hidden", "true");
    if (className) {
      svg.setAttribute("class", className);
    }
    for (let y = 0; y < PIXEL_ROWS.length; y++) {
      const row = PIXEL_ROWS[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === "." || !PALETTE[ch]) {
          x++;
          continue;
        }
        let end = x + 1;
        while (end < row.length && row[end] === ch) {
          end++;
        }
        const rect = doc.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(end - x));
        rect.setAttribute("height", "1");
        rect.setAttribute("fill", PALETTE[ch]);
        svg.appendChild(rect);
        x = end;
      }
    }
    return svg;
  }

  // src/content/toast.js
  var FONT_STYLE_ID = "ppx-autorename-hud-fonts";
  function ensurePixelFontFaces(doc, chromeObj) {
    if (!doc?.head || doc.getElementById(FONT_STYLE_ID)) return;
    const getUrl = (rel) => chromeObj?.runtime?.getURL ? chromeObj.runtime.getURL(rel) : rel;
    const style = doc.createElement("style");
    style.id = FONT_STYLE_ID;
    style.textContent = `
    @font-face {
      font-family: "PPX Silkscreen";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("${getUrl("fonts/Silkscreen-Regular.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX Silkscreen";
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url("${getUrl("fonts/Silkscreen-Bold.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX Inter";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("${getUrl("fonts/Inter-Regular.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX Inter";
      font-style: normal;
      font-weight: 600;
      font-display: swap;
      src: url("${getUrl("fonts/Inter-SemiBold.woff2")}") format("woff2");
    }
    @font-face {
      font-family: "PPX JetBrains Mono";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url("${getUrl("fonts/JetBrainsMono-Medium.woff2")}") format("woff2");
    }
  `;
    doc.head.appendChild(style);
  }
  var SHADOW_CSS = `
  :host {
    all: initial;
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483646;
    pointer-events: none;
    font-family: "PPX Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .toast {
    pointer-events: auto;
    min-width: 310px;
    max-width: 380px;
    background: #11222b;
    color: #f0fdfa;
    border: 2px solid #38bdf8;
    box-shadow: 5px 5px 0 #050b0e;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .toast.hidden {
    display: none !important;
  }

  .toast[data-state="watching"],
  .toast[data-state="renaming"] {
    border-color: #38bdf8;
  }

  .toast[data-state="success"] {
    border-color: #2dd4bf;
  }

  .toast[data-state="warn"] {
    border-color: #f59e0b;
  }

  .toast[data-state="error"] {
    border-color: #f87171;
  }

  .hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .hdr-left {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .logo {
    flex-shrink: 0;
    display: block;
    image-rendering: pixelated;
  }

  .label {
    font-family: "PPX Silkscreen", monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #f0fdfa;
    white-space: nowrap;
  }

  .hdr-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* 2x2 Pixel Matrix Spinner */
  .px-spinner {
    display: grid;
    grid-template-columns: 7px 7px;
    grid-template-rows: 7px 7px;
    gap: 2px;
  }

  .px-spinner.hidden {
    display: none;
  }

  .px-cell {
    width: 7px;
    height: 7px;
    background: #1e3a49;
    animation: ppx-matrix 0.8s steps(1, end) infinite;
  }
  .px-cell:nth-child(1) { animation-delay: 0s; }
  .px-cell:nth-child(2) { animation-delay: 0.2s; }
  .px-cell:nth-child(4) { animation-delay: 0.4s; }
  .px-cell:nth-child(3) { animation-delay: 0.6s; }

  @keyframes ppx-matrix {
    0%, 24% { background: #5eead4; }
    25%, 49% { background: #2dd4bf; }
    50%, 100% { background: #1e3a49; }
  }

  .pill {
    font-family: "PPX Silkscreen", monospace;
    font-size: 10px;
    font-weight: 400;
    padding: 3px 7px;
    background: #153b40;
    color: #5eead4;
    border: 1px solid #2dd4bf;
    text-transform: uppercase;
    line-height: 1.1;
  }

  .pill.warn {
    background: #3b2a11;
    color: #fcd34d;
    border-color: #f59e0b;
  }

  .pill.hidden {
    display: none;
  }

  .close-btn {
    appearance: none;
    width: 22px;
    height: 22px;
    border: 1px solid #254656;
    background: #0b161c;
    color: #94a3b8;
    font-family: "PPX Silkscreen", monospace;
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    border-color: #2dd4bf;
    color: #f0fdfa;
  }

  .body-msg {
    font-family: "PPX Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13.5px;
    line-height: 1.45;
    color: #cbd5e1;
    word-break: break-word;
    -webkit-font-smoothing: antialiased;
  }

  .body-msg.title-box {
    background: #0b161c;
    border: 1px solid #244554;
    padding: 9px 11px;
    color: #f0fdfa;
    font-size: 14px;
    font-weight: 600;
  }

  .progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-wrap.hidden {
    display: none !important;
  }

  .progress-track {
    width: 100%;
    height: 10px;
    background: #0b161c;
    border: 1px solid #254656;
    padding: 1px;
    box-sizing: border-box;
  }

  .progress-fill {
    height: 100%;
    width: 0%;
    background: repeating-linear-gradient(
      90deg,
      #2dd4bf 0px,
      #2dd4bf 7px,
      #0f766e 7px,
      #0f766e 9px
    );
  }

  .footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .footer-row.hidden {
    display: none !important;
  }

  .footer-sub {
    font-family: "PPX JetBrains Mono", "PPX Inter", monospace;
    font-size: 11px;
    color: #94a3b8;
    min-width: 0;
  }

  .action-btn {
    appearance: none;
    border: 1px solid #2dd4bf;
    background: #153b40;
    color: #5eead4;
    box-shadow: 2px 2px 0 #050b0e;
    font-family: "PPX Silkscreen", monospace;
    font-size: 10px;
    line-height: 1.1;
    padding: 4px 8px;
    cursor: pointer;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .action-btn:hover {
    background: #2dd4bf;
    color: #050b0e;
  }

  .action-btn.danger {
    border-color: #f87171;
    background: #35161b;
    color: #fca5a5;
  }

  .action-btn.danger:hover {
    background: #f87171;
    color: #050b0e;
  }
`;
  function createRenameToaster({
    win = globalThis.window,
    chromeObj = globalThis.chrome,
    autoHideSuccessMs = 5e3,
    autoHideErrorMs = 6e3
  } = {}) {
    let host = null;
    let cardEl = null;
    let labelEl = null;
    let spinnerEl = null;
    let pillEl = null;
    let bodyEl = null;
    let progressWrapEl = null;
    let progressFillEl = null;
    let footerRowEl = null;
    let footerSubEl = null;
    let actionBtnEl = null;
    let actionHandler = null;
    let hideTimer = null;
    let state = "idle";
    let settings = {
      enabled: true,
      showToast: true
    };
    function clearTimer() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }
    function resetExtras() {
      actionHandler = null;
      if (progressWrapEl) progressWrapEl.className = "progress-wrap hidden";
      if (footerRowEl) footerRowEl.className = "footer-row hidden";
      if (actionBtnEl) actionBtnEl.className = "action-btn hidden";
    }
    function setFillWidth(pct) {
      if (!progressFillEl) return;
      const clamped = `${Math.max(4, Math.min(100, Math.round(pct)))}%`;
      if (progressFillEl.style) {
        progressFillEl.style.width = clamped;
      } else {
        progressFillEl.setAttribute("style", `width:${clamped}`);
      }
    }
    function ensureMounted() {
      if (cardEl) return true;
      const doc = win?.document;
      if (!doc || typeof doc.createElement !== "function" || typeof doc.getElementById !== "function") {
        return false;
      }
      const parent = doc.body || doc.documentElement;
      if (!parent || typeof parent.appendChild !== "function") return false;
      ensurePixelFontFaces(doc, chromeObj);
      const existing = doc.getElementById(PERPLEXITY_CONFIG.domMarkers.toastHostId);
      if (existing) {
        existing.remove();
      }
      host = doc.createElement("div");
      host.id = PERPLEXITY_CONFIG.domMarkers.toastHostId;
      const shadow = host.attachShadow({ mode: "open" });
      const styleEl = doc.createElement("style");
      styleEl.textContent = SHADOW_CSS;
      cardEl = doc.createElement("div");
      cardEl.className = "toast hidden";
      cardEl.setAttribute("role", "status");
      cardEl.setAttribute("aria-live", "polite");
      const hdr = doc.createElement("div");
      hdr.className = "hdr";
      const hdrLeft = doc.createElement("div");
      hdrLeft.className = "hdr-left";
      const logo = createPixelLogoElement(doc, { size: 24, className: "logo" });
      labelEl = doc.createElement("span");
      labelEl.className = "label";
      hdrLeft.append(logo, labelEl);
      const hdrRight = doc.createElement("div");
      hdrRight.className = "hdr-right";
      spinnerEl = doc.createElement("div");
      spinnerEl.className = "px-spinner hidden";
      for (let i = 0; i < 4; i++) {
        const c = doc.createElement("span");
        c.className = "px-cell";
        spinnerEl.appendChild(c);
      }
      pillEl = doc.createElement("span");
      pillEl.className = "pill hidden";
      const closeBtn = doc.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "close-btn";
      closeBtn.title = "Dismiss";
      closeBtn.textContent = "X";
      closeBtn.addEventListener("click", () => {
        dismiss();
      });
      hdrRight.append(spinnerEl, pillEl, closeBtn);
      hdr.append(hdrLeft, hdrRight);
      bodyEl = doc.createElement("div");
      bodyEl.className = "body-msg";
      progressWrapEl = doc.createElement("div");
      progressWrapEl.className = "progress-wrap hidden";
      const trackEl = doc.createElement("div");
      trackEl.className = "progress-track";
      progressFillEl = doc.createElement("div");
      progressFillEl.className = "progress-fill";
      trackEl.appendChild(progressFillEl);
      progressWrapEl.appendChild(trackEl);
      footerRowEl = doc.createElement("div");
      footerRowEl.className = "footer-row hidden";
      footerSubEl = doc.createElement("span");
      footerSubEl.className = "footer-sub";
      actionBtnEl = doc.createElement("button");
      actionBtnEl.type = "button";
      actionBtnEl.className = "action-btn";
      actionBtnEl.addEventListener("click", () => {
        if (typeof actionHandler === "function") {
          actionHandler();
        }
      });
      footerRowEl.append(footerSubEl, actionBtnEl);
      cardEl.append(hdr, bodyEl, progressWrapEl, footerRowEl);
      shadow.append(styleEl, cardEl);
      parent.appendChild(host);
      return true;
    }
    function dismiss() {
      clearTimer();
      resetExtras();
      state = "idle";
      if (cardEl) {
        cardEl.classList.add("hidden");
      }
    }
    function canDisplay(forceShow = false) {
      if (!settings.showToast) return false;
      return forceShow ? true : Boolean(settings.enabled);
    }
    function showWatching() {
      clearTimer();
      if (!canDisplay(false)) return;
      if (!ensureMounted()) return;
      resetExtras();
      state = "watching";
      cardEl.dataset.state = "watching";
      cardEl.classList.remove("hidden");
      labelEl.textContent = "WATCHING STREAM_";
      spinnerEl.classList.remove("hidden");
      pillEl.className = "pill hidden";
      bodyEl.className = "body-msg";
      bodyEl.textContent = "Answer streaming - will auto-rename when complete.";
    }
    function showRenaming({
      step = "Generating 3-7 word title...",
      label = "RENAMING THREAD_",
      forceShow = false
    } = {}) {
      clearTimer();
      if (!canDisplay(forceShow)) return;
      if (!ensureMounted()) return;
      resetExtras();
      state = "renaming";
      cardEl.dataset.state = "renaming";
      cardEl.classList.remove("hidden");
      labelEl.textContent = label;
      spinnerEl.classList.remove("hidden");
      pillEl.className = "pill hidden";
      bodyEl.className = "body-msg";
      bodyEl.textContent = step;
    }
    function showSuccess({
      title = "",
      source = "llm",
      label = "✓ THREAD RENAMED",
      onRegenerate = null,
      forceShow = false
    } = {}) {
      clearTimer();
      if (!canDisplay(forceShow)) return;
      if (!ensureMounted()) return;
      resetExtras();
      const isFallback = source === "heuristic";
      state = "success";
      cardEl.dataset.state = isFallback ? "warn" : "success";
      cardEl.classList.remove("hidden");
      labelEl.textContent = label;
      spinnerEl.classList.add("hidden");
      pillEl.className = `pill${isFallback ? " warn" : ""}`;
      pillEl.textContent = isFallback ? "FALLBACK" : "LLM";
      bodyEl.className = "body-msg title-box";
      bodyEl.textContent = title || "Thread renamed";
      if (typeof onRegenerate === "function") {
        actionHandler = onRegenerate;
        footerSubEl.textContent = "Want another variation?";
        actionBtnEl.className = "action-btn";
        actionBtnEl.textContent = "↻ REGEN";
        footerRowEl.className = "footer-row";
      }
      if (autoHideSuccessMs > 0) {
        hideTimer = setTimeout(() => {
          dismiss();
        }, typeof onRegenerate === "function" ? Math.max(autoHideSuccessMs, 6500) : autoHideSuccessMs);
      }
    }
    function showBatchProgress({
      phase = "renaming",
      processed = 0,
      total = 0,
      renamed = 0,
      skipped = 0,
      currentTitle = "",
      label = "Library",
      onCancel = null
    } = {}) {
      clearTimer();
      if (!canDisplay(true)) return;
      if (!ensureMounted()) return;
      resetExtras();
      const isScan = phase === "scanning";
      const pct = isScan ? 12 : total > 0 ? Math.round(processed / total * 100) : 15;
      state = "batch";
      cardEl.dataset.state = "renaming";
      cardEl.classList.remove("hidden");
      labelEl.textContent = isScan ? "SCANNING LIBRARY_" : "BATCH RENAMING_";
      spinnerEl.classList.remove("hidden");
      pillEl.className = "pill";
      pillEl.textContent = isScan ? "SCAN" : `${pct}%`;
      bodyEl.className = "body-msg";
      bodyEl.textContent = isScan ? `Scanning Perplexity Library (${label})…` : currentTitle ? `${processed}/${total}: ${currentTitle}` : `Processing ${processed} of ${total} chats…`;
      progressWrapEl.className = "progress-wrap";
      setFillWidth(pct);
      footerSubEl.textContent = isScan ? `${processed} threads found` : `${renamed} renamed · ${skipped} skipped`;
      if (typeof onCancel === "function") {
        actionHandler = onCancel;
        actionBtnEl.className = "action-btn danger";
        actionBtnEl.textContent = "■ STOP";
      } else {
        actionBtnEl.className = "action-btn hidden";
      }
      footerRowEl.className = "footer-row";
    }
    function showBatchSummary({
      renamed = 0,
      skipped = 0,
      failed = 0,
      cancelled = false,
      message = ""
    } = {}) {
      clearTimer();
      if (!canDisplay(true)) return;
      if (!ensureMounted()) return;
      resetExtras();
      state = "success";
      cardEl.dataset.state = failed > 0 && renamed === 0 ? "warn" : "success";
      cardEl.classList.remove("hidden");
      labelEl.textContent = cancelled ? "BATCH STOPPED" : "✓ BATCH COMPLETE";
      spinnerEl.classList.add("hidden");
      pillEl.className = `pill${cancelled ? " warn" : ""}`;
      pillEl.textContent = cancelled ? "STOPPED" : "DONE";
      bodyEl.className = "body-msg title-box";
      bodyEl.textContent = message || `${renamed} chat${renamed === 1 ? "" : "s"} renamed${skipped > 0 ? ` · ${skipped} skipped` : ""}`;
      if (autoHideSuccessMs > 0) {
        hideTimer = setTimeout(() => {
          dismiss();
        }, Math.max(autoHideSuccessMs, 6500));
      }
    }
    function showError({
      message = "Could not rename thread.",
      forceShow = false
    } = {}) {
      clearTimer();
      if (!canDisplay(forceShow)) return;
      if (!ensureMounted()) return;
      resetExtras();
      state = "error";
      cardEl.dataset.state = "error";
      cardEl.classList.remove("hidden");
      labelEl.textContent = "RENAME FAILED";
      spinnerEl.classList.add("hidden");
      pillEl.className = "pill hidden";
      bodyEl.className = "body-msg";
      bodyEl.textContent = message;
      if (autoHideErrorMs > 0) {
        hideTimer = setTimeout(() => {
          dismiss();
        }, autoHideErrorMs);
      }
    }
    function updateSettings(next = {}) {
      settings = {
        ...settings,
        ...next
      };
      if (!settings.showToast || !settings.enabled && state === "watching") {
        dismiss();
      }
    }
    function destroy() {
      clearTimer();
      if (host) {
        host.remove();
        host = null;
        cardEl = null;
      }
    }
    function clearIfWatching() {
      if (state === "watching") {
        dismiss();
      }
    }
    return {
      showWatching,
      showRenaming,
      showSuccess,
      showBatchProgress,
      showBatchSummary,
      showError,
      clearIfWatching,
      dismiss,
      updateSettings,
      destroy,
      getState: () => state
    };
  }

  // src/content/content.js
  var { domMarkers } = PERPLEXITY_CONFIG;
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function makeRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function ensurePageScriptInjected(win, chromeObj) {
    try {
      const doc = win?.document;
      if (!doc) return false;
      if (doc.documentElement?.getAttribute(domMarkers.pageInjectedAttr) === "1" || win[domMarkers.globalFlag]) {
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
  function sendToServiceWorker(chromeObj, message) {
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
                error: lastErr.message || "Service worker connection failed"
              });
              return;
            }
            resolve(response || { ok: false, error: "Empty response from service worker" });
          }
        );
      } catch (err) {
        resolve({
          ok: false,
          error: err?.message || "Extension context invalidated"
        });
      }
    });
  }
  function requestSingleRename({
    win,
    contextUuid,
    readWriteToken,
    title,
    slug = null,
    batch = false,
    fetchImpl = globalThis.fetch,
    getCachedAccountId,
    setCachedAccountId,
    bridgeTimeoutMs = 5e3
  }) {
    const origin = win?.location?.origin && win.location.origin !== "null" ? win.location.origin : PERPLEXITY_CONFIG.origin;
    const hasBridge = Boolean(
      win && typeof win.postMessage === "function" && typeof win.addEventListener === "function" && (win.document?.documentElement?.getAttribute(domMarkers.pageInjectedAttr) === "1" || win[domMarkers.globalFlag])
    );
    if (!hasBridge) {
      return (async () => {
        let accountId = getCachedAccountId();
        if (accountId === void 0) {
          accountId = await fetchAccountId(fetchImpl, origin);
          setCachedAccountId(accountId);
        }
        return postThreadRename({
          contextUuid,
          readWriteToken,
          title,
          accountId,
          fetchImpl,
          origin
        });
      })();
    }
    return new Promise((resolve) => {
      const requestId = makeRequestId();
      let settled = false;
      const cleanup = (timer2) => {
        clearTimeout(timer2);
        win.removeEventListener("message", onMessage);
      };
      const onMessage = (event) => {
        if (event.source !== win) return;
        const data = event.data;
        if (!data || data.ns !== MESSAGE_NS || data.type !== WINDOW_MESSAGES.RENAME_RESPONSE || data.requestId !== requestId) {
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
        if (accountId === void 0) {
          accountId = await fetchAccountId(fetchImpl, origin);
          setCachedAccountId(accountId);
        }
        const fallbackResult = await postThreadRename({
          contextUuid,
          readWriteToken,
          title,
          accountId,
          fetchImpl,
          origin
        });
        resolve(fallbackResult);
      }, bridgeTimeoutMs);
      win.addEventListener("message", onMessage);
      const targetOrigin = origin !== PERPLEXITY_CONFIG.origin && win.location?.origin === "null" ? "*" : origin;
      win.postMessage(
        {
          ns: MESSAGE_NS,
          type: WINDOW_MESSAGES.RENAME_REQUEST,
          requestId,
          contextUuid,
          readWriteToken,
          title,
          slug,
          batch
        },
        targetOrigin
      );
    });
  }
  function requestThreadDetail({
    win,
    slug,
    fetchImpl = globalThis.fetch,
    getCachedAccountId,
    setCachedAccountId,
    bridgeTimeoutMs = 1e4
  }) {
    const origin = win?.location?.origin && win.location.origin !== "null" ? win.location.origin : PERPLEXITY_CONFIG.origin;
    const hasBridge = Boolean(
      win && typeof win.postMessage === "function" && typeof win.addEventListener === "function" && (win.document?.documentElement?.getAttribute(domMarkers.pageInjectedAttr) === "1" || win[domMarkers.globalFlag])
    );
    const runDirect = async () => {
      let accountId = getCachedAccountId();
      if (accountId === void 0) {
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
      const cleanup = (timer2) => {
        clearTimeout(timer2);
        win.removeEventListener("message", onMessage);
      };
      const onMessage = (event) => {
        if (event.source !== win) return;
        const data = event.data;
        if (!data || data.ns !== MESSAGE_NS || data.type !== WINDOW_MESSAGES.THREAD_DETAIL_RESPONSE || data.requestId !== requestId) {
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
      const targetOrigin = origin !== PERPLEXITY_CONFIG.origin && win.location?.origin === "null" ? "*" : origin;
      win.postMessage(
        {
          ns: MESSAGE_NS,
          type: WINDOW_MESSAGES.THREAD_DETAIL_REQUEST,
          requestId,
          slug
        },
        targetOrigin
      );
    });
  }
  function requestLibraryPage({
    win,
    offset = 0,
    limit = 20,
    pinned = false,
    fetchImpl = globalThis.fetch,
    getCachedAccountId,
    setCachedAccountId,
    bridgeTimeoutMs = 12e3
  }) {
    const origin = win?.location?.origin && win.location.origin !== "null" ? win.location.origin : PERPLEXITY_CONFIG.origin;
    const hasBridge = Boolean(
      win && typeof win.postMessage === "function" && typeof win.addEventListener === "function" && (win.document?.documentElement?.getAttribute(domMarkers.pageInjectedAttr) === "1" || win[domMarkers.globalFlag])
    );
    const runDirect = async () => {
      let accountId = getCachedAccountId();
      if (accountId === void 0) {
        accountId = await fetchAccountId(fetchImpl, origin);
        setCachedAccountId(accountId);
      }
      return fetchLibraryThreadsPage({
        offset,
        limit,
        pinned,
        accountId,
        fetchImpl,
        origin
      });
    };
    if (!hasBridge) {
      return runDirect();
    }
    return new Promise((resolve) => {
      const requestId = makeRequestId();
      let settled = false;
      const cleanup = (timer2) => {
        clearTimeout(timer2);
        win.removeEventListener("message", onMessage);
      };
      const onMessage = (event) => {
        if (event.source !== win) return;
        const data = event.data;
        if (!data || data.ns !== MESSAGE_NS || data.type !== WINDOW_MESSAGES.LIST_THREADS_RESPONSE || data.requestId !== requestId) {
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
      const targetOrigin = origin !== PERPLEXITY_CONFIG.origin && win.location?.origin === "null" ? "*" : origin;
      win.postMessage(
        {
          ns: MESSAGE_NS,
          type: WINDOW_MESSAGES.LIST_THREADS_REQUEST,
          requestId,
          offset,
          limit,
          pinned
        },
        targetOrigin
      );
    });
  }
  async function renameWithRetries(performAttempt, { maxRetries = 2, retryDelaysMs = [500, 1200] } = {}) {
    let lastResult = { ok: false, status: 0, error: "Not attempted" };
    const totalAllowed = 1 + Math.max(0, maxRetries);
    for (let attempt = 1; attempt <= totalAllowed; attempt++) {
      lastResult = await performAttempt(attempt);
      if (lastResult.ok) {
        return { ...lastResult, attempts: attempt };
      }
      if (attempt < totalAllowed) {
        const delay = retryDelaysMs[attempt - 1] ?? retryDelaysMs[retryDelaysMs.length - 1] ?? 500;
        if (delay > 0) {
          await sleep(delay);
        }
      }
    }
    return { ...lastResult, attempts: totalAllowed };
  }
  function initContentScript({
    win = globalThis.window,
    chromeObj = globalThis.chrome,
    fetchImpl = globalThis.fetch,
    retryDelaysMs = [500, 1200],
    bridgeTimeoutMs = 5e3,
    batchPageDelayMs = 180,
    batchStepDelayMs = 320
  } = {}) {
    console.info("[ppx-autorename] content script loaded");
    ensurePageScriptInjected(win, chromeObj);
    const toaster = createRenameToaster({ win, chromeObj });
    let currentSettings = {
      enabled: true,
      showToast: true,
      excludePatterns: [],
      debug: false
    };
    const localRenamedIds = /* @__PURE__ */ new Set();
    const inFlightIds = /* @__PURE__ */ new Set();
    const userRenamedIds = /* @__PURE__ */ new Set();
    let cachedAccountId = void 0;
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
      generatedTitle = ""
    }) {
      if (!slug) return;
      const prevTitles = lastOpenThreadCache?.slug === slug && Array.isArray(lastOpenThreadCache.titlesUsed) ? lastOpenThreadCache.titlesUsed : [];
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
        titlesUsed: nextTitles.slice(-6)
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
    async function renameCurrentChat({ regenerate = false } = {}) {
      const slug = resolveCurrentSlug();
      if (!slug) {
        return {
          ok: false,
          error: "Open a Perplexity thread (/search/...) first to rename it."
        };
      }
      const lockKey = `manual:${slug}`;
      if (inFlightIds.has(lockKey)) {
        return {
          ok: false,
          error: "Already renaming this chat — wait a moment."
        };
      }
      inFlightIds.add(lockKey);
      try {
        const stateRes = await sendToServiceWorker(chromeObj, {
          type: RUNTIME_MESSAGES.GET_STATE
        });
        if (stateRes?.ok && stateRes.settings) {
          applySettings(stateRes.settings);
        }
        toaster.showRenaming({
          step: regenerate ? "Regenerating fresh 3-7 word title..." : "Reading open chat & generating title...",
          label: regenerate ? "REGENERATING_" : "RENAMING CHAT_",
          forceShow: true
        });
        let detail = null;
        if (lastOpenThreadCache && lastOpenThreadCache.slug === slug && lastOpenThreadCache.contextUuid && lastOpenThreadCache.question) {
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
            bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 1e4)
          });
          if (!detailRes?.ok || !detailRes.detail) {
            const errMsg = detailRes?.error || "Could not read this Perplexity thread.";
            toaster.showError({ message: errMsg, forceShow: true });
            return { ok: false, error: errMsg };
          }
          detail = detailRes.detail;
        }
        if (!detail.contextUuid || !detail.question) {
          const errMsg = "Wait for Perplexity to finish creating the thread before renaming.";
          toaster.showError({ message: errMsg, forceShow: true });
          return { ok: false, error: errMsg };
        }
        const avoidTitles = [];
        if (regenerate) {
          if (detail.currentTitle) avoidTitles.push(detail.currentTitle);
          if (lastOpenThreadCache?.slug === slug && Array.isArray(lastOpenThreadCache.titlesUsed)) {
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
          avoidTitles
        });
        if (!titleRes?.ok || !titleRes.title) {
          const errMsg = titleRes?.error || "Failed to generate title";
          toaster.showError({ message: errMsg, forceShow: true });
          return { ok: false, error: errMsg };
        }
        toaster.showRenaming({
          step: "Saving title to Perplexity...",
          label: regenerate ? "REGENERATING_" : "RENAMING CHAT_",
          forceShow: true
        });
        const renameRes = await renameWithRetries(
          () => requestSingleRename({
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
            bridgeTimeoutMs
          }),
          { maxRetries: 2, retryDelaysMs }
        );
        if (!renameRes.ok) {
          const errMsg = renameRes.error || `Perplexity returned HTTP ${renameRes.status}`;
          toaster.showError({ message: errMsg, forceShow: true });
          await sendToServiceWorker(chromeObj, {
            type: RUNTIME_MESSAGES.RECORD_STATUS,
            status: {
              outcome: "failed",
              reason: "rename-http-error",
              source: titleRes.source,
              provider: titleRes.provider || "",
              httpStatus: renameRes.status,
              error: errMsg
            }
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
          generatedTitle: titleRes.title
        });
        toaster.showSuccess({
          title: titleRes.title,
          source: titleRes.source,
          label: regenerate ? "✓ TITLE REGENERATED" : "✓ THREAD RENAMED",
          forceShow: true,
          onRegenerate: () => {
            renameCurrentChat({ regenerate: true }).catch(() => {
            });
          }
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
            httpStatus: renameRes.status
          }
        });
        return {
          ok: true,
          title: titleRes.title,
          source: titleRes.source,
          provider: titleRes.provider || "",
          error: titleRes.error || null
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
        status: statusPatch
      });
    }
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
          type: RUNTIME_MESSAGES.GET_STATE
        });
        if (stateRes?.ok && stateRes.settings) {
          applySettings(stateRes.settings);
        }
        const alreadyRenamedIds = /* @__PURE__ */ new Set([
          ...Array.isArray(stateRes?.renamedIds) ? stateRes.renamedIds : [],
          ...localRenamedIds
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
          startedAt
        });
        toaster.showBatchProgress({
          phase: "scanning",
          processed: 0,
          total: 0,
          renamed: 0,
          skipped: 0,
          label: spec.label,
          onCancel: cancelBatchRename
        });
        const byKey = /* @__PURE__ */ new Map();
        const nowMs = Date.now();
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
          bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 1e4)
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
            bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 1e4)
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
            startedAt
          });
          toaster.showBatchProgress({
            phase: "scanning",
            processed: byKey.size,
            total: 0,
            renamed: 0,
            skipped: 0,
            label: spec.label,
            onCancel: cancelBatchRename
          });
          const stopEarly = shouldStopLibraryPagination(pageItems, spec, {
            collectedCount: byKey.size,
            nowMs
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
            finishedAt: Date.now()
          };
          await reportBatchStatus(stopStatus);
          toaster.showBatchSummary({
            renamed: 0,
            skipped: 0,
            cancelled: true,
            message: stopStatus.message
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
            userRenamedIds
          }
        );
        if (toRename.length === 0) {
          const doneMsg = scopedTotal === 0 ? `No library chats found for "${spec.label}".` : `All ${scopedTotal} matching chat${scopedTotal === 1 ? "" : "s"} already renamed (${preSkipped} skipped).`;
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
            finishedAt: Date.now()
          };
          await reportBatchStatus(emptyStatus);
          toaster.showBatchSummary({
            renamed: 0,
            skipped: preSkipped,
            cancelled: false,
            message: doneMsg
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
          const previewLabel = item.title || item.questionPreview || item.slug || "Thread";
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
            startedAt
          });
          toaster.showBatchProgress({
            phase: "renaming",
            processed,
            total: toRename.length,
            renamed,
            skipped,
            currentTitle: previewLabel,
            label: spec.label,
            onCancel: cancelBatchRename
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
              bridgeTimeoutMs: Math.max(bridgeTimeoutMs, 1e4)
            });
            if (detailRes?.fatal) {
              fatalStopError = detailRes.error || "Perplexity paused requests (HTTP 401/403/429). Retry shortly.";
              failed++;
              break;
            }
            if (detailRes?.ok && detailRes.detail) {
              detail = detailRes.detail;
            }
          }
          const contextUuid = detail?.contextUuid || item.contextUuid;
          const readWriteToken = detail?.readWriteToken || item.readWriteToken || null;
          const backendUuid = detail?.backendUuid || item.backendUuid || item.slug || null;
          const question = detail?.question || item.questionPreview || item.title || "";
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
            contextUuid
          });
          if (!titleRes?.ok || !titleRes.title) {
            failed++;
            await sleepCancellable(batchStepDelayMs, signal);
            continue;
          }
          const existingTitle = (detail?.currentTitle || item.title || "").trim();
          if (existingTitle && existingTitle === titleRes.title.trim() && spec.skipAlreadyRenamed) {
            skipped++;
            localRenamedIds.add(contextUuid);
            await sleepCancellable(batchStepDelayMs, signal);
            continue;
          }
          const renameRes = await renameWithRetries(
            () => requestSingleRename({
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
              bridgeTimeoutMs
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
                httpStatus: renameRes.status
              }
            });
          } else {
            failed++;
            if (renameRes.status === 401 || renameRes.status === 403 || renameRes.status === 429) {
              fatalStopError = renameRes.error || `Perplexity returned HTTP ${renameRes.status}; batch paused safely.`;
              break;
            }
          }
          await sleepCancellable(batchStepDelayMs, signal);
        }
        const wasCancelled = signal.aborted;
        const finalState = fatalStopError ? "error" : wasCancelled ? "cancelled" : "completed";
        const summaryMessage = fatalStopError ? `${fatalStopError} (${renamed} renamed before pause)` : wasCancelled ? `Stopped after ${renamed} renamed · ${skipped} skipped.` : `Batch complete: ${renamed} chat${renamed === 1 ? "" : "s"} renamed${skipped > 0 ? ` · ${skipped} skipped` : ""}${failed > 0 ? ` · ${failed} failed` : ""}.`;
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
          finishedAt: Date.now()
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
            message: summaryMessage
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
          finishedAt: Date.now()
        };
        await reportBatchStatus(errStatus);
        toaster.showError({ message: errMsg, forceShow: true });
        return { ok: false, error: errMsg };
      } finally {
        activeBatchController = null;
      }
    }
    sendToServiceWorker(chromeObj, { type: RUNTIME_MESSAGES.GET_STATE }).then((res) => {
      if (res?.ok && res.settings) {
        applySettings(res.settings);
      }
    }).catch(() => {
    });
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
          batchRunning: Boolean(activeBatchController)
        });
        return false;
      }
      if (msg.type === RUNTIME_MESSAGES.RENAME_CURRENT_CHAT) {
        renameCurrentChat({ regenerate: Boolean(msg.regenerate) }).then((res) => sendResponse?.(res)).catch(
          (err) => sendResponse?.({
            ok: false,
            error: err?.message || "Failed to rename open chat"
          })
        );
        return true;
      }
      if (msg.type === RUNTIME_MESSAGES.START_BATCH_RENAME) {
        if (activeBatchController) {
          sendResponse?.({
            ok: false,
            error: "A batch library rename is already running."
          });
          return false;
        }
        runBatchRename(msg.spec || {}).catch(() => {
        });
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
        type: RUNTIME_MESSAGES.GET_STATE
      });
      if (!stateRes.ok) {
        toaster.clearIfWatching();
        console.warn("[ppx-autorename] service worker unavailable", {
          error: stateRes.error || "unknown"
        });
        return { renamed: false, reason: "sw-error" };
      }
      const settings = stateRes.settings || currentSettings;
      applySettings(settings);
      const combinedRenamedIds = /* @__PURE__ */ new Set([
        ...Array.isArray(stateRes.renamedIds) ? stateRes.renamedIds : [],
        ...localRenamedIds,
        ...inFlightIds
      ]);
      const decision = shouldRename({
        enabled: settings.enabled,
        isFollowUp,
        contextUuid,
        alreadyRenamedIds: combinedRenamedIds,
        userRenamedIds,
        question,
        excludePatterns: settings.excludePatterns
      });
      console.info("[ppx-autorename] decision", {
        rename: decision.rename,
        reason: decision.reason,
        hasContextUuid: Boolean(contextUuid),
        hasReadWriteToken: Boolean(readWriteToken)
      });
      if (!decision.rename) {
        toaster.clearIfWatching();
        await sendToServiceWorker(chromeObj, {
          type: RUNTIME_MESSAGES.RECORD_STATUS,
          status: {
            outcome: "skipped",
            reason: decision.reason
          }
        });
        return { renamed: false, reason: decision.reason };
      }
      if (!contextUuid || !readWriteToken) {
        toaster.clearIfWatching();
        console.warn("[ppx-autorename] skipped: missing thread identifiers", {
          hasContextUuid: Boolean(contextUuid),
          hasReadWriteToken: Boolean(readWriteToken)
        });
        await sendToServiceWorker(chromeObj, {
          type: RUNTIME_MESSAGES.RECORD_STATUS,
          status: {
            outcome: "skipped",
            reason: "missing-ids",
            error: "Stream finished without context_uuid or read_write_token"
          }
        });
        return { renamed: false, reason: "missing-ids" };
      }
      inFlightIds.add(contextUuid);
      toaster.showRenaming({ step: "Generating 3–7 word title…" });
      const titleRes = await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.GENERATE_TITLE,
        question,
        answer,
        contextUuid
      });
      if (!titleRes.ok || !titleRes.title) {
        inFlightIds.delete(contextUuid);
        toaster.showError({ message: titleRes.error || "Failed to generate title" });
        console.warn("[ppx-autorename] title generation failed", {
          error: titleRes.error || "empty title"
        });
        await sendToServiceWorker(chromeObj, {
          type: RUNTIME_MESSAGES.RECORD_STATUS,
          status: {
            outcome: "failed",
            reason: "title-error",
            error: titleRes.error || "Failed to generate title"
          }
        });
        return { renamed: false, reason: "title-error" };
      }
      console.info("[ppx-autorename] title", {
        source: titleRes.source,
        provider: titleRes.provider || null,
        fallbackUsed: titleRes.source === "heuristic",
        errorType: titleRes.error ? "provider-error" : null
      });
      if (settings.debug && titleRes.error) {
        console.info("[ppx-autorename] provider fallback detail", {
          error: titleRes.error
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
            reason: "already-renamed"
          }
        });
        return { renamed: false, reason: "already-renamed" };
      }
      toaster.showRenaming({ step: "Saving title to Perplexity…" });
      const renameRes = await renameWithRetries(
        () => requestSingleRename({
          win,
          contextUuid,
          readWriteToken,
          title: titleRes.title,
          fetchImpl,
          getCachedAccountId: () => cachedAccountId,
          setCachedAccountId: (val) => {
            cachedAccountId = val;
          },
          bridgeTimeoutMs
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
            generatedTitle: titleRes.title
          });
        }
        toaster.showSuccess({
          title: titleRes.title,
          source: titleRes.source,
          onRegenerate: slug ? () => {
            renameCurrentChat({ regenerate: true }).catch(() => {
            });
          } : null
        });
        console.info("[ppx-autorename] renamed", {
          status: renameRes.status,
          attempts: renameRes.attempts,
          source: titleRes.source
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
            httpStatus: renameRes.status
          }
        });
        return {
          renamed: true,
          source: titleRes.source,
          status: renameRes.status,
          attempts: renameRes.attempts
        };
      }
      toaster.showError({
        message: renameRes.error || `Perplexity returned HTTP ${renameRes.status}`
      });
      console.warn("[ppx-autorename] rename failed after retries", {
        status: renameRes.status,
        attempts: renameRes.attempts,
        error: renameRes.error || null
      });
      await sendToServiceWorker(chromeObj, {
        type: RUNTIME_MESSAGES.RECORD_STATUS,
        status: {
          outcome: "failed",
          reason: "rename-http-error",
          source: titleRes.source,
          provider: titleRes.provider || "",
          httpStatus: renameRes.status,
          error: renameRes.error || `HTTP ${renameRes.status}`
        }
      });
      return {
        renamed: false,
        reason: "rename-http-error",
        status: renameRes.status,
        attempts: renameRes.attempts
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
        if (!msg.payload.isFollowUp && msg.payload.hasQuestion && currentSettings.enabled && currentSettings.showToast) {
          toaster.showWatching();
        }
        return;
      }
      if (msg.type === WINDOW_MESSAGES.ANSWER_COMPLETE && msg.payload) {
        processAnswerComplete(msg.payload).catch(() => {
        });
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
      }
    };
  }
  if (typeof window !== "undefined" && !window.__ppxDisableAutoInit) {
    initContentScript();
  }
})();
