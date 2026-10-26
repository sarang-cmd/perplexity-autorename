(() => {
  // src/config/selectors.js
  var MESSAGE_NS = "ppx-autorename";
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

  // src/lib/storage.js
  var STORAGE_KEYS = {
    SETTINGS: "settings",
    API_KEYS: "apiKeys",
    RENAMED_IDS: "renamedIds",
    HISTORY: "renameHistory",
    LAST_STATUS: "lastStatus",
    BATCH_STATUS: "batchStatus"
  };
  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    provider: "groq",
    model: "openai/gpt-oss-20b",
    customBaseUrl: "",
    titlePrefix: "",
    excludePatterns: [],
    showToast: true,
    debug: false
  });
  function resolveStorage(storageArea) {
    const area = storageArea || globalThis.chrome?.storage?.local;
    if (!area) {
      throw new Error("chrome.storage.local is unavailable in this context");
    }
    return area;
  }
  async function getSettings(storageArea) {
    const store = resolveStorage(storageArea);
    const raw = await store.get(STORAGE_KEYS.SETTINGS);
    const saved = raw?.[STORAGE_KEYS.SETTINGS];
    if (!saved || typeof saved !== "object") {
      return { ...DEFAULT_SETTINGS, excludePatterns: [] };
    }
    return {
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_SETTINGS.enabled,
      provider: typeof saved.provider === "string" && saved.provider ? saved.provider : DEFAULT_SETTINGS.provider,
      model: typeof saved.model === "string" ? saved.model : DEFAULT_SETTINGS.model,
      customBaseUrl: typeof saved.customBaseUrl === "string" ? saved.customBaseUrl : "",
      titlePrefix: typeof saved.titlePrefix === "string" ? saved.titlePrefix : "",
      excludePatterns: Array.isArray(saved.excludePatterns) ? saved.excludePatterns.filter((x) => typeof x === "string") : [],
      showToast: typeof saved.showToast === "boolean" ? saved.showToast : DEFAULT_SETTINGS.showToast,
      debug: Boolean(saved.debug)
    };
  }
  async function saveSettings(partial, storageArea) {
    const store = resolveStorage(storageArea);
    const current = await getSettings(store);
    const next = {
      ...current,
      ...partial
    };
    if (Array.isArray(partial?.excludePatterns)) {
      next.excludePatterns = partial.excludePatterns.map((s) => String(s).trim()).filter(Boolean);
    }
    await store.set({ [STORAGE_KEYS.SETTINGS]: next });
    return next;
  }
  async function hasApiKey(providerId, storageArea) {
    const store = resolveStorage(storageArea);
    const raw = await store.get(STORAGE_KEYS.API_KEYS);
    const map = raw?.[STORAGE_KEYS.API_KEYS];
    if (!map || typeof map !== "object") {
      return false;
    }
    return typeof map[providerId] === "string" && map[providerId].trim().length > 0;
  }
  async function setApiKey(providerId, apiKey, storageArea) {
    const store = resolveStorage(storageArea);
    const raw = await store.get(STORAGE_KEYS.API_KEYS);
    const current = raw?.[STORAGE_KEYS.API_KEYS] && typeof raw[STORAGE_KEYS.API_KEYS] === "object" ? { ...raw[STORAGE_KEYS.API_KEYS] } : {};
    const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
    if (trimmed) {
      current[providerId] = trimmed;
    } else {
      delete current[providerId];
    }
    await store.set({ [STORAGE_KEYS.API_KEYS]: current });
  }
  async function clearApiKey(providerId, storageArea) {
    return setApiKey(providerId, "", storageArea);
  }
  async function getHistory(storageArea) {
    const store = resolveStorage(storageArea);
    const raw = await store.get(STORAGE_KEYS.HISTORY);
    const list = raw?.[STORAGE_KEYS.HISTORY];
    return Array.isArray(list) ? list : [];
  }
  async function clearHistory(storageArea) {
    const store = resolveStorage(storageArea);
    await store.set({
      [STORAGE_KEYS.HISTORY]: [],
      [STORAGE_KEYS.RENAMED_IDS]: []
    });
  }
  async function getLastStatus(storageArea) {
    const store = resolveStorage(storageArea);
    const raw = await store.get(STORAGE_KEYS.LAST_STATUS);
    return raw?.[STORAGE_KEYS.LAST_STATUS] || null;
  }
  async function getBatchStatus(storageArea) {
    const store = resolveStorage(storageArea);
    const raw = await store.get(STORAGE_KEYS.BATCH_STATUS);
    return raw?.[STORAGE_KEYS.BATCH_STATUS] || null;
  }

  // src/lib/decide.js
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

  // src/lib/providers/openai-compatible.js
  var OPENAI_COMPATIBLE_PRESETS = {
    groq: {
      id: "groq",
      label: "Groq",
      adapter: "openai-compatible",
      baseUrl: "https://api.groq.com/openai/v1",
      defaultModel: "openai/gpt-oss-20b",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    },
    mistral: {
      id: "mistral",
      label: "Mistral",
      adapter: "openai-compatible",
      baseUrl: "https://api.mistral.ai/v1",
      defaultModel: "mistral-small-latest",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    },
    sarvam: {
      id: "sarvam",
      label: "Sarvam AI",
      adapter: "openai-compatible",
      baseUrl: "https://api.sarvam.ai/v1",
      defaultModel: "sarvam-105b",
      requiresKey: true,
      authStyle: "sarvam",
      maxTokensField: "max_tokens"
    },
    openai: {
      id: "openai",
      label: "OpenAI",
      adapter: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_completion_tokens"
    },
    openrouter: {
      id: "openrouter",
      label: "OpenRouter",
      adapter: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel: "openai/gpt-4o-mini",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    },
    cerebras: {
      id: "cerebras",
      label: "Cerebras",
      adapter: "openai-compatible",
      baseUrl: "https://api.cerebras.ai/v1",
      defaultModel: "llama-3.3-70b",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    },
    deepseek: {
      id: "deepseek",
      label: "DeepSeek",
      adapter: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      defaultModel: "deepseek-chat",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    },
    together: {
      id: "together",
      label: "Together AI",
      adapter: "openai-compatible",
      baseUrl: "https://api.together.xyz/v1",
      defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      requiresKey: true,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    },
    custom: {
      id: "custom",
      label: "Custom (OpenAI-compatible)",
      adapter: "openai-compatible",
      baseUrl: "",
      defaultModel: "gpt-4o-mini",
      requiresKey: false,
      authStyle: "bearer",
      maxTokensField: "max_tokens"
    }
  };

  // src/lib/providers/gemini.js
  var GEMINI_PRESET = {
    id: "gemini",
    label: "Google Gemini",
    adapter: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    requiresKey: true
  };

  // src/lib/providers/anthropic.js
  var ANTHROPIC_PRESET = {
    id: "anthropic",
    label: "Anthropic",
    adapter: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-haiku-4-5",
    requiresKey: true
  };

  // src/lib/providers/opencode-zen.js
  var OPENCODE_ZEN_PRESET = {
    id: "opencode-zen",
    label: "OpenCode Zen",
    adapter: "opencode-zen",
    baseUrl: "https://opencode.ai/zen/v1",
    defaultModel: "big-pickle",
    // Free models on OpenCode Zen work with "public" token if no paid key is entered
    requiresKey: false
  };

  // src/lib/providers/index.js
  var PROVIDERS = {
    groq: OPENAI_COMPATIBLE_PRESETS.groq,
    mistral: OPENAI_COMPATIBLE_PRESETS.mistral,
    sarvam: OPENAI_COMPATIBLE_PRESETS.sarvam,
    gemini: GEMINI_PRESET,
    anthropic: ANTHROPIC_PRESET,
    openai: OPENAI_COMPATIBLE_PRESETS.openai,
    openrouter: OPENAI_COMPATIBLE_PRESETS.openrouter,
    cerebras: OPENAI_COMPATIBLE_PRESETS.cerebras,
    deepseek: OPENAI_COMPATIBLE_PRESETS.deepseek,
    together: OPENAI_COMPATIBLE_PRESETS.together,
    "opencode-zen": OPENCODE_ZEN_PRESET,
    custom: OPENAI_COMPATIBLE_PRESETS.custom
  };
  var PROVIDER_LIST = Object.values(PROVIDERS);
  function getProviderSpec(providerId) {
    return PROVIDERS[providerId] || PROVIDERS.groq;
  }
  function getProviderOriginPattern(providerId, customBaseUrl = "") {
    const spec = getProviderSpec(providerId);
    const rawBase = spec.id === "custom" ? String(customBaseUrl || "").trim() : spec.baseUrl;
    if (!rawBase) return null;
    try {
      const parsed = new URL(rawBase);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return null;
      }
      return `${parsed.origin}/*`;
    } catch {
      return null;
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

  // src/options/options.js
  var els = {
    logoSlot: document.getElementById("options-logo-slot"),
    lastStatusBox: document.getElementById("last-status-box"),
    lastStatusSummary: document.getElementById("last-status-summary"),
    lastStatusTime: document.getElementById("last-status-time"),
    lastStatusDetail: document.getElementById("last-status-detail"),
    optBatchBadge: document.getElementById("opt-batch-badge"),
    optRenameCurrentBtn: document.getElementById("opt-rename-current-btn"),
    optRegenCurrentBtn: document.getElementById("opt-regen-current-btn"),
    optCurrentFeedback: document.getElementById("opt-current-feedback"),
    optPresetChips: document.getElementById("opt-preset-chips"),
    optBatchMode: document.getElementById("opt-batch-mode"),
    optBatchNumberWrap: document.getElementById("opt-batch-number-wrap"),
    optBatchNumberLabel: document.getElementById("opt-batch-number-label"),
    optBatchNumber: document.getElementById("opt-batch-number"),
    optSkipRenamed: document.getElementById("opt-skip-renamed"),
    optStartBatchBtn: document.getElementById("opt-start-batch-btn"),
    optStopBatchBtn: document.getElementById("opt-stop-batch-btn"),
    optBatchProgress: document.getElementById("opt-batch-progress"),
    optBatchLabel: document.getElementById("opt-batch-label"),
    optBatchPct: document.getElementById("opt-batch-pct"),
    optBatchFill: document.getElementById("opt-batch-fill"),
    optBatchStats: document.getElementById("opt-batch-stats"),
    providerSelect: document.getElementById("provider-select"),
    modelInput: document.getElementById("model-input"),
    customUrlField: document.getElementById("custom-url-field"),
    customUrlInput: document.getElementById("custom-url-input"),
    apiKeyInput: document.getElementById("api-key-input"),
    keyStatusBadge: document.getElementById("key-status-badge"),
    clearKeyBtn: document.getElementById("clear-key-btn"),
    hostPermBadge: document.getElementById("host-perm-badge"),
    hostPermOrigin: document.getElementById("host-perm-origin"),
    grantPermBtn: document.getElementById("grant-perm-btn"),
    saveBtn: document.getElementById("save-btn"),
    testBtn: document.getElementById("test-btn"),
    providerFeedback: document.getElementById("provider-feedback"),
    enabledCheckbox: document.getElementById("enabled-checkbox"),
    showToastCheckbox: document.getElementById("show-toast-checkbox"),
    prefixInput: document.getElementById("prefix-input"),
    excludeTextarea: document.getElementById("exclude-textarea"),
    regexValidationMsg: document.getElementById("regex-validation-msg"),
    debugCheckbox: document.getElementById("debug-checkbox"),
    saveRulesBtn: document.getElementById("save-rules-btn"),
    rulesFeedback: document.getElementById("rules-feedback"),
    clearHistoryBtn: document.getElementById("clear-history-btn"),
    historyEmpty: document.getElementById("history-empty"),
    historyTable: document.getElementById("history-table"),
    historyTbody: document.getElementById("history-tbody")
  };
  var lastKnownProvider = "groq";
  function showFeedback(el, kind, text) {
    if (!el) return;
    el.className = `feedback visible ${kind}`;
    el.textContent = text;
  }
  function formatTimestamp(ts) {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "";
    }
  }
  function renderLastStatus(status) {
    if (!status || typeof status !== "object") {
      els.lastStatusBox.className = "status-banner";
      els.lastStatusSummary.textContent = "No rename attempts recorded yet.";
      els.lastStatusTime.textContent = "";
      els.lastStatusDetail.textContent = "Open a fresh Perplexity tab and ask a new question to trigger auto-renaming.";
      return;
    }
    els.lastStatusTime.textContent = formatTimestamp(status.timestamp);
    if (status.outcome === "renamed") {
      const usedHeuristic = status.source === "heuristic";
      els.lastStatusBox.className = `status-banner ${usedHeuristic ? "warn" : "ok"}`;
      const sourceLabel = usedHeuristic ? `Heuristic fallback${status.provider ? ` (${status.provider} failed)` : ""}` : `LLM (${status.provider || "provider"})`;
      els.lastStatusSummary.textContent = usedHeuristic ? `Renamed using keyword heuristic - "${status.title || ""}"` : `Renamed via ${sourceLabel} - "${status.title || ""}"`;
      els.lastStatusDetail.textContent = status.error ? `HTTP ${status.httpStatus || 204} · LLM fallback reason: ${status.error}` : `Source: ${sourceLabel} · Perplexity API status: ${status.httpStatus || 204}`;
      return;
    }
    if (status.outcome === "skipped") {
      els.lastStatusBox.className = "status-banner";
      els.lastStatusSummary.textContent = `Skipped (${status.reason || "rule"})`;
      els.lastStatusDetail.textContent = status.error || `Decision reason: ${status.reason || "not eligible for auto-rename"}.`;
      return;
    }
    els.lastStatusBox.className = "status-banner err";
    els.lastStatusSummary.textContent = `Rename failed (${status.reason || "error"})`;
    els.lastStatusDetail.textContent = status.error || `HTTP status: ${status.httpStatus ?? "n/a"}`;
  }
  function renderHistory(items) {
    els.historyTbody.textContent = "";
    if (!Array.isArray(items) || items.length === 0) {
      els.historyEmpty.classList.remove("hidden");
      els.historyTable.classList.add("hidden");
      return;
    }
    els.historyEmpty.classList.add("hidden");
    els.historyTable.classList.remove("hidden");
    for (const item of items) {
      const tr = document.createElement("tr");
      const titleTd = document.createElement("td");
      if (item.backendUuid) {
        const link = document.createElement("a");
        link.href = `${PERPLEXITY_CONFIG.origin}${PERPLEXITY_CONFIG.searchPathPrefix}${encodeURIComponent(item.backendUuid)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.title || "(untitled)";
        titleTd.appendChild(link);
      } else {
        titleTd.textContent = item.title || "(untitled)";
      }
      const sourceTd = document.createElement("td");
      const badge = document.createElement("span");
      const isHeuristic = item.source === "heuristic";
      badge.className = `badge ${isHeuristic ? "warn" : "ok"}`;
      badge.textContent = isHeuristic ? "HEURISTIC" : `LLM${item.provider ? ` · ${item.provider}` : ""}`;
      if (item.error) {
        badge.title = item.error;
      }
      sourceTd.appendChild(badge);
      const timeTd = document.createElement("td");
      timeTd.textContent = formatTimestamp(item.timestamp);
      tr.append(titleTd, sourceTd, timeTd);
      els.historyTbody.appendChild(tr);
    }
  }
  async function refreshKeyBadge(providerId) {
    const spec = getProviderSpec(providerId);
    const saved = await hasApiKey(providerId);
    if (saved) {
      els.keyStatusBadge.className = "badge ok";
      els.keyStatusBadge.textContent = "KEY SAVED";
      els.apiKeyInput.placeholder = "Key saved - enter a new key to replace";
    } else if (!spec.requiresKey) {
      els.keyStatusBadge.className = "badge ok";
      els.keyStatusBadge.textContent = "OPTIONAL";
      els.apiKeyInput.placeholder = "Optional API key";
    } else {
      els.keyStatusBadge.className = "badge warn";
      els.keyStatusBadge.textContent = "NO KEY SAVED";
      els.apiKeyInput.placeholder = `Paste ${spec.label} API key`;
    }
  }
  async function refreshHostPermissionUI() {
    const providerId = els.providerSelect.value;
    const customUrl = els.customUrlInput.value.trim();
    const originPattern = getProviderOriginPattern(providerId, customUrl);
    els.hostPermOrigin.textContent = originPattern ? `(${originPattern})` : "";
    if (!originPattern) {
      els.hostPermBadge.className = "badge warn";
      els.hostPermBadge.textContent = "ENTER BASE URL";
      els.grantPermBtn.classList.add("hidden");
      return false;
    }
    if (!chrome?.permissions?.contains) {
      els.hostPermBadge.className = "badge ok";
      els.hostPermBadge.textContent = "AVAILABLE";
      els.grantPermBtn.classList.add("hidden");
      return true;
    }
    const granted = await chrome.permissions.contains({
      origins: [originPattern]
    });
    if (granted) {
      els.hostPermBadge.className = "badge ok";
      els.hostPermBadge.textContent = "GRANTED";
      els.grantPermBtn.classList.add("hidden");
    } else {
      els.hostPermBadge.className = "badge warn";
      els.hostPermBadge.textContent = "NOT GRANTED";
      els.grantPermBtn.classList.remove("hidden");
    }
    return granted;
  }
  async function ensureHostPermissionFromGesture() {
    const providerId = els.providerSelect.value;
    const customUrl = els.customUrlInput.value.trim();
    const originPattern = getProviderOriginPattern(providerId, customUrl);
    if (!originPattern || !chrome?.permissions?.request) {
      return true;
    }
    try {
      const already = await chrome.permissions.contains({
        origins: [originPattern]
      });
      if (already) return true;
      const granted = await chrome.permissions.request({
        origins: [originPattern]
      });
      await refreshHostPermissionUI();
      return granted;
    } catch {
      return false;
    }
  }
  function updateCustomUrlVisibility(providerId) {
    if (providerId === "custom") {
      els.customUrlField.classList.remove("hidden");
    } else {
      els.customUrlField.classList.add("hidden");
    }
  }
  function validateExcludeTextarea() {
    const { errors } = compileExcludePatterns(els.excludeTextarea.value);
    if (errors.length > 0) {
      els.regexValidationMsg.style.color = "var(--err-text)";
      els.regexValidationMsg.textContent = errors[0];
      return { valid: false, errors };
    }
    els.regexValidationMsg.style.color = "";
    els.regexValidationMsg.textContent = "Questions matching any line will not be auto-renamed (case-insensitive by default).";
    return { valid: true, errors: [] };
  }
  function populateProviderSelect() {
    els.providerSelect.textContent = "";
    for (const spec of PROVIDER_LIST) {
      const opt = document.createElement("option");
      opt.value = spec.id;
      opt.textContent = spec.label;
      els.providerSelect.appendChild(opt);
    }
  }
  function collectCurrentSettings() {
    const provider = els.providerSelect.value;
    const spec = getProviderSpec(provider);
    const model = els.modelInput.value.trim() || spec.defaultModel;
    const excludePatterns = els.excludeTextarea.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return {
      enabled: els.enabledCheckbox.checked,
      showToast: els.showToastCheckbox.checked,
      provider,
      model,
      customBaseUrl: els.customUrlInput.value.trim(),
      titlePrefix: els.prefixInput.value.trim(),
      excludePatterns,
      debug: els.debugCheckbox.checked
    };
  }
  async function onSaveProviderClick() {
    const permGranted = await ensureHostPermissionFromGesture();
    const nextSettings = collectCurrentSettings();
    const typedKey = els.apiKeyInput.value.trim();
    await saveSettings(nextSettings);
    if (typedKey) {
      await setApiKey(nextSettings.provider, typedKey);
      els.apiKeyInput.value = "";
    }
    els.modelInput.value = nextSettings.model;
    await refreshKeyBadge(nextSettings.provider);
    await refreshHostPermissionUI();
    if (!permGranted) {
      showFeedback(
        els.providerFeedback,
        "warn",
        "Settings saved, but host access was not granted. Click 'Grant Host Access' so background LLM calls are allowed."
      );
    } else {
      showFeedback(els.providerFeedback, "ok", "Provider settings saved.");
    }
  }
  async function onSaveRulesClick() {
    const check = validateExcludeTextarea();
    if (!check.valid) {
      showFeedback(els.rulesFeedback, "err", check.errors[0]);
      return;
    }
    const nextSettings = collectCurrentSettings();
    await saveSettings(nextSettings);
    showFeedback(els.rulesFeedback, "ok", "Rules saved.");
  }
  async function onTestProviderClick() {
    els.testBtn.disabled = true;
    showFeedback(els.providerFeedback, "warn", "Testing provider connection…");
    await ensureHostPermissionFromGesture();
    const provider = els.providerSelect.value;
    const spec = getProviderSpec(provider);
    const model = els.modelInput.value.trim() || spec.defaultModel;
    const customBaseUrl = els.customUrlInput.value.trim();
    const typedKey = els.apiKeyInput.value.trim();
    try {
      const res = await chrome.runtime.sendMessage({
        ns: MESSAGE_NS,
        type: RUNTIME_MESSAGES.TEST_PROVIDER,
        provider,
        model,
        customBaseUrl,
        apiKey: typedKey
      });
      if (res?.ok) {
        showFeedback(
          els.providerFeedback,
          "ok",
          `Success (${res.latencyMs}ms) - Sample title: "${res.title}"`
        );
      } else {
        showFeedback(
          els.providerFeedback,
          "err",
          `Provider test failed: ${res?.error || "Unknown error"}`
        );
      }
    } catch (err) {
      showFeedback(
        els.providerFeedback,
        "err",
        `Could not contact background service worker: ${err?.message || String(err)}`
      );
    } finally {
      els.testBtn.disabled = false;
    }
  }
  async function init() {
    if (els.logoSlot) {
      els.logoSlot.appendChild(
        createPixelLogoElement(document, { size: 36, className: "brand-logo" })
      );
    }
    populateProviderSelect();
    const [settings, history, lastStatus, storedBatch, swState] = await Promise.all([
      getSettings(),
      getHistory(),
      getLastStatus(),
      getBatchStatus(),
      chrome?.runtime?.sendMessage ? chrome.runtime.sendMessage({ ns: MESSAGE_NS, type: RUNTIME_MESSAGES.GET_STATE }).catch(() => null) : Promise.resolve(null)
    ]);
    function syncOptBatchControls() {
      if (!els.optBatchMode) return;
      const mode = els.optBatchMode.value;
      if (mode === "all") {
        els.optBatchNumberWrap.classList.add("hidden");
      } else {
        els.optBatchNumberWrap.classList.remove("hidden");
        els.optBatchNumberLabel.textContent = mode === "days" ? "Number of Days" : "Number of Chats";
        els.optBatchNumber.max = mode === "days" ? "3650" : "5000";
      }
      const specKey = mode === "all" ? "all" : `${mode}:${Number(els.optBatchNumber.value) || 0}`;
      for (const chip of els.optPresetChips?.querySelectorAll(".preset-chip") || []) {
        chip.classList.toggle("active", chip.dataset.spec === specKey);
      }
    }
    function renderOptBatchStatus(batch) {
      if (!els.optBatchProgress) return;
      if (!batch) {
        els.optBatchProgress.classList.add("hidden");
        els.optStartBatchBtn?.classList.remove("hidden");
        els.optStopBatchBtn?.classList.add("hidden");
        if (els.optBatchBadge) {
          els.optBatchBadge.className = "badge ok";
          els.optBatchBadge.textContent = "READY";
        }
        return;
      }
      const running = Boolean(batch.running);
      els.optBatchProgress.classList.remove("hidden");
      els.optBatchProgress.classList.toggle("running", running);
      els.optStartBatchBtn?.classList.toggle("hidden", running);
      els.optStopBatchBtn?.classList.toggle("hidden", !running);
      if (running) {
        if (els.optBatchBadge) {
          els.optBatchBadge.className = "badge warn";
          els.optBatchBadge.textContent = "RUNNING";
        }
        const isScan = batch.phase === "scanning";
        const pct = isScan ? 12 : batch.total > 0 ? Math.round(batch.processed / batch.total * 100) : 15;
        els.optBatchLabel.textContent = batch.message || (isScan ? "Scanning Perplexity Library…" : `Renaming ${batch.processed} of ${batch.total}…`);
        els.optBatchPct.textContent = isScan ? "SCAN" : `${pct}%`;
        els.optBatchFill.style.width = `${Math.max(6, Math.min(100, pct))}%`;
        els.optBatchStats.textContent = isScan ? `${batch.scanned || 0} chats discovered in library` : `${batch.renamed || 0} renamed · ${batch.skipped || 0} skipped`;
      } else {
        const isErr = batch.state === "error";
        if (els.optBatchBadge) {
          els.optBatchBadge.className = isErr ? "badge err" : "badge ok";
          els.optBatchBadge.textContent = isErr ? "ERROR" : batch.state === "cancelled" ? "STOPPED" : "COMPLETE";
        }
        const pct = batch.total > 0 ? Math.round((batch.processed || 0) / batch.total * 100) : 100;
        els.optBatchLabel.textContent = batch.message || "Batch complete";
        els.optBatchPct.textContent = isErr ? "ERR" : `${pct}%`;
        els.optBatchFill.style.width = `${isErr ? 100 : Math.max(0, Math.min(100, pct))}%`;
        els.optBatchStats.textContent = `${batch.renamed || 0} renamed · ${batch.skipped || 0} skipped${batch.failed ? ` · ${batch.failed} failed` : ""}`;
      }
    }
    lastKnownProvider = settings.provider;
    els.providerSelect.value = settings.provider;
    els.modelInput.value = settings.model;
    els.customUrlInput.value = settings.customBaseUrl;
    els.enabledCheckbox.checked = settings.enabled;
    els.showToastCheckbox.checked = settings.showToast;
    els.prefixInput.value = settings.titlePrefix;
    els.excludeTextarea.value = settings.excludePatterns.join("\n");
    els.debugCheckbox.checked = settings.debug;
    updateCustomUrlVisibility(settings.provider);
    syncOptBatchControls();
    renderLastStatus(lastStatus);
    renderHistory(history);
    renderOptBatchStatus(swState?.batchStatus || storedBatch);
    await refreshKeyBadge(settings.provider);
    await refreshHostPermissionUI();
    async function triggerOptOpenChat(regenerate) {
      await ensureHostPermissionFromGesture();
      els.optRenameCurrentBtn.disabled = true;
      els.optRegenCurrentBtn.disabled = true;
      showFeedback(
        els.optCurrentFeedback,
        "warn",
        regenerate ? "Regenerating fresh title for open Perplexity chat…" : "Renaming current open Perplexity chat…"
      );
      try {
        const res = await chrome.runtime.sendMessage({
          ns: MESSAGE_NS,
          type: RUNTIME_MESSAGES.RENAME_CURRENT_CHAT,
          regenerate
        });
        if (res?.ok && res.title) {
          showFeedback(
            els.optCurrentFeedback,
            "ok",
            `${regenerate ? "Regenerated title" : "Renamed open chat"}: "${res.title}"`
          );
        } else {
          showFeedback(
            els.optCurrentFeedback,
            "err",
            res?.error || "Open a Perplexity thread (/search/...) in another tab first."
          );
        }
      } catch (err) {
        showFeedback(
          els.optCurrentFeedback,
          "err",
          err?.message || "Could not contact background service worker."
        );
      } finally {
        els.optRenameCurrentBtn.disabled = false;
        els.optRegenCurrentBtn.disabled = false;
      }
    }
    els.optRenameCurrentBtn?.addEventListener("click", () => {
      triggerOptOpenChat(false);
    });
    els.optRegenCurrentBtn?.addEventListener("click", () => {
      triggerOptOpenChat(true);
    });
    els.optPresetChips?.addEventListener("click", (e) => {
      const chip = e.target.closest(".preset-chip");
      if (!chip) return;
      const raw = chip.dataset.spec || "count:50";
      if (raw === "all") {
        els.optBatchMode.value = "all";
      } else {
        const [mode, val] = raw.split(":");
        els.optBatchMode.value = mode === "days" ? "days" : "count";
        els.optBatchNumber.value = val || "50";
      }
      syncOptBatchControls();
    });
    els.optBatchMode?.addEventListener("change", () => {
      if (els.optBatchMode.value === "days" && Number(els.optBatchNumber.value) === 50) {
        els.optBatchNumber.value = "30";
      }
      syncOptBatchControls();
    });
    els.optBatchNumber?.addEventListener("input", syncOptBatchControls);
    els.optStartBatchBtn?.addEventListener("click", async () => {
      await ensureHostPermissionFromGesture();
      const mode = els.optBatchMode.value;
      const num = Math.max(1, Number(els.optBatchNumber.value) || 30);
      const skipAlreadyRenamed = Boolean(els.optSkipRenamed.checked);
      const spec = mode === "all" ? { mode: "all", skipAlreadyRenamed } : mode === "days" ? { mode: "days", days: num, skipAlreadyRenamed } : { mode: "count", count: num, skipAlreadyRenamed };
      els.optStartBatchBtn.disabled = true;
      renderOptBatchStatus({
        running: true,
        phase: "scanning",
        scanned: 0,
        processed: 0,
        total: 0,
        renamed: 0,
        skipped: 0,
        message: "Starting Perplexity Library scan…"
      });
      try {
        const res = await chrome.runtime.sendMessage({
          ns: MESSAGE_NS,
          type: RUNTIME_MESSAGES.START_BATCH_RENAME,
          spec
        });
        if (!res?.ok) {
          renderOptBatchStatus({
            running: false,
            state: "error",
            processed: 0,
            total: 0,
            renamed: 0,
            skipped: 0,
            failed: 1,
            message: res?.error || "Could not start batch library rename."
          });
        }
      } catch (err) {
        renderOptBatchStatus({
          running: false,
          state: "error",
          processed: 0,
          total: 0,
          renamed: 0,
          skipped: 0,
          failed: 1,
          message: err?.message || "Service worker error"
        });
      } finally {
        els.optStartBatchBtn.disabled = false;
      }
    });
    els.optStopBatchBtn?.addEventListener("click", async () => {
      els.optStopBatchBtn.disabled = true;
      try {
        await chrome.runtime.sendMessage({
          ns: MESSAGE_NS,
          type: RUNTIME_MESSAGES.CANCEL_BATCH_RENAME
        });
      } finally {
        els.optStopBatchBtn.disabled = false;
      }
    });
    els.enabledCheckbox.addEventListener("change", () => {
      saveSettings({ enabled: els.enabledCheckbox.checked });
    });
    els.showToastCheckbox.addEventListener("change", () => {
      saveSettings({ showToast: els.showToastCheckbox.checked });
    });
    els.providerSelect.addEventListener("change", async () => {
      const newProvider = els.providerSelect.value;
      const prevSpec = getProviderSpec(lastKnownProvider);
      const nextSpec = getProviderSpec(newProvider);
      if (!els.modelInput.value.trim() || els.modelInput.value.trim() === prevSpec.defaultModel) {
        els.modelInput.value = nextSpec.defaultModel;
      }
      lastKnownProvider = newProvider;
      els.apiKeyInput.value = "";
      updateCustomUrlVisibility(newProvider);
      await refreshKeyBadge(newProvider);
      await refreshHostPermissionUI();
    });
    els.customUrlInput.addEventListener("input", () => {
      refreshHostPermissionUI();
    });
    els.excludeTextarea.addEventListener("input", validateExcludeTextarea);
    els.grantPermBtn.addEventListener("click", async () => {
      const ok = await ensureHostPermissionFromGesture();
      showFeedback(
        els.providerFeedback,
        ok ? "ok" : "warn",
        ok ? "Host access granted." : "Host access request was dismissed."
      );
    });
    els.clearKeyBtn.addEventListener("click", async () => {
      const provider = els.providerSelect.value;
      await clearApiKey(provider);
      els.apiKeyInput.value = "";
      await refreshKeyBadge(provider);
      showFeedback(els.providerFeedback, "ok", "Stored API key cleared.");
    });
    els.saveBtn.addEventListener("click", onSaveProviderClick);
    els.saveRulesBtn.addEventListener("click", onSaveRulesClick);
    els.testBtn.addEventListener("click", onTestProviderClick);
    els.clearHistoryBtn.addEventListener("click", async () => {
      await clearHistory();
      renderHistory([]);
    });
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return;
        if (changes[STORAGE_KEYS.LAST_STATUS]) {
          renderLastStatus(changes[STORAGE_KEYS.LAST_STATUS].newValue);
        }
        if (changes[STORAGE_KEYS.HISTORY]) {
          renderHistory(changes[STORAGE_KEYS.HISTORY].newValue || []);
        }
        if (changes[STORAGE_KEYS.BATCH_STATUS]) {
          renderOptBatchStatus(changes[STORAGE_KEYS.BATCH_STATUS].newValue || null);
        }
        if (changes[STORAGE_KEYS.SETTINGS]?.newValue) {
          const s = changes[STORAGE_KEYS.SETTINGS].newValue;
          if (typeof s.enabled === "boolean") els.enabledCheckbox.checked = s.enabled;
          if (typeof s.showToast === "boolean") els.showToastCheckbox.checked = s.showToast;
        }
      });
    }
  }
  init();
})();
