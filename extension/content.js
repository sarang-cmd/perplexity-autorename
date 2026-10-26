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
  var RUNTIME_MESSAGES = {
    GET_STATE: "get-state",
    GENERATE_TITLE: "generate-title",
    RECORD_RENAME: "record-rename",
    RECORD_STATUS: "record-status",
    TEST_PROVIDER: "test-provider",
    SETTINGS_UPDATED: "settings-updated"
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

  // src/lib/perplexity-api.js
  var { endpoints, queryParams, headers: H, renameBodyFields: RB, sessionFields: SF } = PERPLEXITY_CONFIG;
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
      const id = data?.[SF.user]?.[SF.userId];
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
      cardEl.append(hdr, bodyEl);
      shadow.append(styleEl, cardEl);
      parent.appendChild(host);
      return true;
    }
    function dismiss() {
      clearTimer();
      state = "idle";
      if (cardEl) {
        cardEl.classList.add("hidden");
      }
    }
    function canDisplay() {
      return Boolean(settings.enabled && settings.showToast);
    }
    function showWatching() {
      clearTimer();
      if (!canDisplay()) return;
      if (!ensureMounted()) return;
      state = "watching";
      cardEl.dataset.state = "watching";
      cardEl.classList.remove("hidden");
      labelEl.textContent = "WATCHING STREAM_";
      spinnerEl.classList.remove("hidden");
      pillEl.className = "pill hidden";
      bodyEl.className = "body-msg";
      bodyEl.textContent = "Answer streaming - will auto-rename when complete.";
    }
    function showRenaming({ step = "Generating 3-7 word title..." } = {}) {
      clearTimer();
      if (!canDisplay()) return;
      if (!ensureMounted()) return;
      state = "renaming";
      cardEl.dataset.state = "renaming";
      cardEl.classList.remove("hidden");
      labelEl.textContent = "RENAMING THREAD_";
      spinnerEl.classList.remove("hidden");
      pillEl.className = "pill hidden";
      bodyEl.className = "body-msg";
      bodyEl.textContent = step;
    }
    function showSuccess({ title = "", source = "llm" } = {}) {
      clearTimer();
      if (!canDisplay()) return;
      if (!ensureMounted()) return;
      const isFallback = source === "heuristic";
      state = "success";
      cardEl.dataset.state = isFallback ? "warn" : "success";
      cardEl.classList.remove("hidden");
      labelEl.textContent = "✓ THREAD RENAMED";
      spinnerEl.classList.add("hidden");
      pillEl.className = `pill${isFallback ? " warn" : ""}`;
      pillEl.textContent = isFallback ? "FALLBACK" : "LLM";
      bodyEl.className = "body-msg title-box";
      bodyEl.textContent = title || "Thread renamed";
      if (autoHideSuccessMs > 0) {
        hideTimer = setTimeout(() => {
          dismiss();
        }, autoHideSuccessMs);
      }
    }
    function showError({ message = "Could not rename thread." } = {}) {
      clearTimer();
      if (!canDisplay()) return;
      if (!ensureMounted()) return;
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
      if (!canDisplay()) {
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
          title
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
    bridgeTimeoutMs = 5e3
  } = {}) {
    console.info("[ppx-autorename] content script loaded");
    ensurePageScriptInjected(win, chromeObj);
    const toaster = createRenameToaster({ win });
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
    function applySettings(nextSettings) {
      currentSettings = { ...currentSettings, ...nextSettings };
      toaster.updateSettings(currentSettings);
    }
    sendToServiceWorker(chromeObj, { type: RUNTIME_MESSAGES.GET_STATE }).then((res) => {
      if (res?.ok && res.settings) {
        applySettings(res.settings);
      }
    }).catch(() => {
    });
    const onRuntimeMessage = (msg) => {
      if (msg && msg.ns === MESSAGE_NS && msg.type === RUNTIME_MESSAGES.SETTINGS_UPDATED && msg.settings) {
        applySettings(msg.settings);
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
        toaster.showSuccess({
          title: titleRes.title,
          source: titleRes.source
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
      toaster,
      destroy() {
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
