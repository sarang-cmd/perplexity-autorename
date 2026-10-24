// src/config/selectors.js
var MESSAGE_NS = "ppx-autorename";
var RUNTIME_MESSAGES = {
  GET_STATE: "get-state",
  GENERATE_TITLE: "generate-title",
  RECORD_RENAME: "record-rename",
  RECORD_STATUS: "record-status",
  TEST_PROVIDER: "test-provider",
  SETTINGS_UPDATED: "settings-updated"
};

// src/lib/storage.js
var STORAGE_KEYS = {
  SETTINGS: "settings",
  API_KEYS: "apiKeys",
  RENAMED_IDS: "renamedIds",
  HISTORY: "renameHistory",
  LAST_STATUS: "lastStatus"
};
var MAX_RENAMED_IDS = 300;
var MAX_HISTORY_ENTRIES = 50;
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
async function getApiKey(providerId, storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.API_KEYS);
  const map = raw?.[STORAGE_KEYS.API_KEYS];
  if (!map || typeof map !== "object") {
    return "";
  }
  const key = map[providerId];
  return typeof key === "string" ? key.trim() : "";
}
async function getRenamedIds(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.RENAMED_IDS);
  const list = raw?.[STORAGE_KEYS.RENAMED_IDS];
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}
async function getHistory(storageArea) {
  const store = resolveStorage(storageArea);
  const raw = await store.get(STORAGE_KEYS.HISTORY);
  const list = raw?.[STORAGE_KEYS.HISTORY];
  return Array.isArray(list) ? list : [];
}
async function recordRenameEntry(entry, storageArea) {
  const store = resolveStorage(storageArea);
  const [renamedIds, history] = await Promise.all([
    getRenamedIds(store),
    getHistory(store)
  ]);
  const nextIds = entry.contextUuid ? [
    entry.contextUuid,
    ...renamedIds.filter((id) => id !== entry.contextUuid)
  ].slice(0, MAX_RENAMED_IDS) : renamedIds;
  const historyItem = {
    contextUuid: entry.contextUuid || null,
    backendUuid: entry.backendUuid || null,
    title: entry.title || "",
    source: entry.source || "llm",
    provider: entry.provider || "",
    error: entry.error || null,
    timestamp: entry.timestamp || Date.now()
  };
  const nextHistory = [historyItem, ...history].slice(0, MAX_HISTORY_ENTRIES);
  await store.set({
    [STORAGE_KEYS.RENAMED_IDS]: nextIds,
    [STORAGE_KEYS.HISTORY]: nextHistory
  });
  return { renamedIds: nextIds, historyItem };
}
async function setLastStatus(statusObj, storageArea) {
  const store = resolveStorage(storageArea);
  const payload = {
    timestamp: Date.now(),
    ...statusObj
  };
  await store.set({ [STORAGE_KEYS.LAST_STATUS]: payload });
  return payload;
}

// src/lib/title.js
var STOPWORDS = /* @__PURE__ */ new Set([
  "a",
  "about",
  "actually",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "both",
  "but",
  "by",
  "can",
  "could",
  "describe",
  "detail",
  "details",
  "did",
  "do",
  "does",
  "doing",
  "done",
  "each",
  "eli5",
  "explain",
  "find",
  "for",
  "from",
  "get",
  "give",
  "good",
  "had",
  "has",
  "have",
  "having",
  "help",
  "here",
  "hey",
  "hi",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "know",
  "let",
  "like",
  "list",
  "make",
  "many",
  "may",
  "me",
  "might",
  "more",
  "most",
  "much",
  "must",
  "my",
  "need",
  "now",
  "of",
  "on",
  "one",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "please",
  "provide",
  "really",
  "should",
  "show",
  "simple",
  "simply",
  "so",
  "some",
  "such",
  "summarize",
  "summary",
  "tell",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "thing",
  "things",
  "think",
  "this",
  "those",
  "through",
  "to",
  "too",
  "understand",
  "up",
  "us",
  "use",
  "using",
  "very",
  "want",
  "was",
  "way",
  "we",
  "well",
  "were",
  "what",
  "whats",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "would",
  "write",
  "you",
  "your"
]);
var SMALL_TITLE_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "vs",
  "with"
]);
function sanitizeTitle(raw, { maxWords = 7, maxChars = 90 } = {}) {
  if (typeof raw !== "string") {
    return "";
  }
  let text = raw.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, " ").replace(/<think\b[^>]*>[\s\S]*$/gi, " ").trim();
  if (!text) {
    return "";
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return "";
  }
  let line = lines[0];
  line = line.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s+/, "").replace(
    /^(?:thread\s+title|suggested\s+title|concise\s+title|here(?:'s|\s+is)\s+(?:a\s+|the\s+)?title|title)\s*[:\-–—]\s*/i,
    ""
  ).trim();
  line = line.replace(/[*_`~]+/g, "");
  line = line.replace(/^["'“”‘’«»]+/, "").replace(/["'“”‘’«»]+$/, "").trim();
  line = line.replace(/[.,;:!?…]+$/g, "").trim();
  line = line.replace(/\s+/g, " ");
  if (!line) {
    return "";
  }
  const words = line.split(" ").filter(Boolean);
  const limited = words.slice(0, Math.max(1, maxWords)).join(" ");
  let result = limited.replace(/\s+(?:and|or|the|a|an|of|in|to|for|with|on|at|by|-|–|—)$/i, "").replace(/[.,;:!?…\-–—]+$/g, "").trim();
  if (result.length > maxChars) {
    result = result.slice(0, maxChars).replace(/\s+\S*$/, "").trim() || result.slice(0, maxChars).trim();
  }
  return result;
}
function formatHeuristicWord(word, index) {
  if (/[A-Z]/.test(word.slice(1)) || /^[A-Z0-9]{2,}$/.test(word)) {
    return word;
  }
  const lower = word.toLowerCase();
  if (index > 0 && SMALL_TITLE_WORDS.has(lower)) {
    return lower;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
function extractCandidateWords(source) {
  if (typeof source !== "string" || !source.trim()) {
    return [];
  }
  const cleaned = source.replace(/```[\s\S]*?```/g, " ").replace(/https?:\/\/\S+/gi, " ").replace(/\[(?:\d+|web:\d+)\]/gi, " ").replace(/[^\p{L}\p{N}+#.\-/\s]/gu, " ");
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const selected = [];
  const seenLower = /* @__PURE__ */ new Set();
  for (const raw of rawTokens) {
    const token = raw.replace(/^[.\-/]+|[.\-/]+$/g, "");
    if (!token || token.length < 2) continue;
    const norm = token.toLowerCase().replace(/'s$/, "");
    if (STOPWORDS.has(norm)) continue;
    if (seenLower.has(norm)) continue;
    seenLower.add(norm);
    selected.push(token);
    if (selected.length >= 7) break;
  }
  return selected;
}
function heuristicTitle(question, answer = "") {
  const qWords = extractCandidateWords(question);
  if (qWords.length < 3 && typeof answer === "string" && answer.trim()) {
    const firstSentence = answer.split(/(?<=[.!?])\s+/)[0] || answer.slice(0, 240);
    const aWords = extractCandidateWords(firstSentence);
    const existing = new Set(qWords.map((w) => w.toLowerCase()));
    for (const w of aWords) {
      if (!existing.has(w.toLowerCase())) {
        qWords.push(w);
        existing.add(w.toLowerCase());
      }
      if (qWords.length >= 5) break;
    }
  }
  if (qWords.length >= 1) {
    const target = qWords.slice(0, 7);
    const formatted = target.map((w, idx) => formatHeuristicWord(w, idx)).join(" ");
    const clean = sanitizeTitle(formatted, { maxWords: 7 });
    if (clean) return clean;
  }
  const fallbackRaw = sanitizeTitle(question, { maxWords: 6 });
  return fallbackRaw || "New Search Thread";
}

// src/lib/decide.js
function applyTitlePrefix(title, prefix) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!cleanTitle) {
    return "";
  }
  if (typeof prefix !== "string" || prefix.trim().length === 0) {
    return cleanTitle;
  }
  const trimmedPrefix = prefix.trim();
  if (cleanTitle.toLowerCase().startsWith((trimmedPrefix + " ").toLowerCase()) || cleanTitle.toLowerCase() === trimmedPrefix.toLowerCase()) {
    return cleanTitle;
  }
  if (/\s$/.test(prefix)) {
    return `${trimmedPrefix} ${cleanTitle}`;
  }
  return `${trimmedPrefix} ${cleanTitle}`;
}

// src/lib/providers/prompt.js
var MAX_OUTPUT_TOKENS = 256;
var MAX_QUESTION_CHARS = 600;
var MAX_ANSWER_CHARS = 1200;
var SYSTEM_PROMPT = "You generate concise, descriptive titles for research threads. Write a clear 3 to 7 word title capturing the core topic. Return ONLY the plain title words — no quotes, no markdown, no trailing period, and no 'Title:' prefix.";
function buildUserPrompt(question, answer = "") {
  const q = String(question || "").trim().slice(0, MAX_QUESTION_CHARS);
  const a = String(answer || "").trim().slice(0, MAX_ANSWER_CHARS);
  if (!a) {
    return `Question:
${q}

Generate a 3-7 word thread title:`;
  }
  return `Question:
${q}

Answer excerpt:
${a}

Generate a 3-7 word thread title:`;
}
function formatHttpError(providerLabel, status, bodyText, apiKey = "") {
  let detail = "";
  if (typeof bodyText === "string" && bodyText.trim()) {
    try {
      const parsed = JSON.parse(bodyText);
      const candidate = parsed?.error?.message || parsed?.message || parsed?.detail || (typeof parsed?.error === "string" ? parsed.error : "");
      if (typeof candidate === "string") {
        detail = candidate.trim();
      }
    } catch {
      detail = bodyText.trim();
    }
  }
  detail = redactSecret(detail, apiKey).replace(/\s+/g, " ").slice(0, 180);
  return detail ? `${providerLabel} HTTP ${status}: ${detail}` : `${providerLabel} HTTP ${status}`;
}
function redactSecret(text, secret = "") {
  if (typeof text !== "string" || !text) return "";
  let out = text;
  if (typeof secret === "string" && secret.trim().length >= 4) {
    out = out.split(secret.trim()).join("[REDACTED]");
  }
  return out;
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
function buildChatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Custom provider base URL is required");
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}
function extractChatCompletionText(json) {
  const message = json?.choices?.[0]?.message;
  if (!message) return "";
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content.map((part) => typeof part === "string" ? part : part?.text || "").join("");
  }
  return "";
}
async function callOpenAiCompatible({
  preset,
  baseUrl,
  model,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal
}) {
  const effectiveBase = baseUrl || preset.baseUrl;
  const endpoint = buildChatCompletionsUrl(effectiveBase);
  const chosenModel = (model || preset.defaultModel || "").trim();
  if (!chosenModel) {
    throw new Error(`${preset.label}: model name is required`);
  }
  const headers = {
    "Content-Type": "application/json"
  };
  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (preset.authStyle === "sarvam") {
    if (trimmedKey) {
      headers["api-subscription-key"] = trimmedKey;
      headers["Authorization"] = `Bearer ${trimmedKey}`;
    }
  } else if (trimmedKey) {
    headers["Authorization"] = `Bearer ${trimmedKey}`;
  }
  const tokenField = preset.maxTokensField === "max_completion_tokens" || /^(?:o[134](?:-|$)|gpt-5)/i.test(chosenModel) ? "max_completion_tokens" : "max_tokens";
  const body = {
    model: chosenModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(question, answer) }
    ],
    [tokenField]: MAX_OUTPUT_TOKENS
  };
  if (/gpt-oss/i.test(chosenModel) || /^sarvam-105b$/i.test(chosenModel)) {
    body.reasoning_effort = "low";
  } else if (!/^(?:o[134](?:-|$)|gpt-5)/i.test(chosenModel)) {
    body.temperature = 0.2;
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(formatHttpError(preset.label, response.status, errText, trimmedKey));
  }
  const data = await response.json();
  return extractChatCompletionText(data);
}

// src/lib/providers/gemini.js
var GEMINI_PRESET = {
  id: "gemini",
  label: "Google Gemini",
  adapter: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  defaultModel: "gemini-2.5-flash",
  requiresKey: true
};
function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => p && !p.thought && typeof p.text === "string").map((p) => p.text).join("");
}
async function callGemini({
  baseUrl = GEMINI_PRESET.baseUrl,
  model = GEMINI_PRESET.defaultModel,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal
}) {
  const trimmedBase = String(baseUrl || GEMINI_PRESET.baseUrl).trim().replace(/\/+$/, "");
  const cleanModel = String(model || GEMINI_PRESET.defaultModel).trim().replace(/^models\//, "");
  if (!cleanModel) {
    throw new Error("Google Gemini: model name is required");
  }
  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const endpoint = `${trimmedBase}/models/${encodeURIComponent(cleanModel)}:generateContent`;
  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2
  };
  if (/^gemini-2\.5-flash/i.test(cleanModel)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserPrompt(question, answer) }]
      }
    ],
    generationConfig
  };
  const headers = {
    "Content-Type": "application/json"
  };
  if (trimmedKey) {
    headers["x-goog-api-key"] = trimmedKey;
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      formatHttpError(GEMINI_PRESET.label, response.status, errText, trimmedKey)
    );
  }
  const data = await response.json();
  return extractGeminiText(data);
}

// src/lib/providers/anthropic.js
var ANTHROPIC_PRESET = {
  id: "anthropic",
  label: "Anthropic",
  adapter: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  defaultModel: "claude-haiku-4-5",
  requiresKey: true
};
function extractAnthropicText(json) {
  if (!Array.isArray(json?.content)) return "";
  return json.content.filter((block) => block && block.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
}
async function callAnthropic({
  baseUrl = ANTHROPIC_PRESET.baseUrl,
  model = ANTHROPIC_PRESET.defaultModel,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal
}) {
  const trimmedBase = String(baseUrl || ANTHROPIC_PRESET.baseUrl).trim().replace(/\/+$/, "");
  const cleanModel = String(model || ANTHROPIC_PRESET.defaultModel).trim();
  if (!cleanModel) {
    throw new Error("Anthropic: model name is required");
  }
  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const endpoint = trimmedBase.endsWith("/messages") ? trimmedBase : `${trimmedBase}/messages`;
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true"
  };
  if (trimmedKey) {
    headers["x-api-key"] = trimmedKey;
  }
  const body = {
    model: cleanModel,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(question, answer)
      }
    ]
  };
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      formatHttpError(ANTHROPIC_PRESET.label, response.status, errText, trimmedKey)
    );
  }
  const data = await response.json();
  return extractAnthropicText(data);
}

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
function resolveZenProtocol(rawModel) {
  const cleanModel = String(rawModel || OPENCODE_ZEN_PRESET.defaultModel).trim().replace(/^opencode\//i, "");
  if (/^(?:gpt-|o[134](?:-|$)|codex-)/i.test(cleanModel)) {
    return { cleanModel, protocol: "responses" };
  }
  if (/^claude-/i.test(cleanModel)) {
    return { cleanModel, protocol: "anthropic" };
  }
  if (/^gemini-/i.test(cleanModel)) {
    return { cleanModel, protocol: "gemini" };
  }
  return { cleanModel, protocol: "chat-completions" };
}
function extractResponsesApiText(json) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) {
    return json.output_text;
  }
  if (Array.isArray(json?.output)) {
    const parts = [];
    for (const item of json.output) {
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if ((c?.type === "output_text" || c?.type === "text") && typeof c.text === "string") {
            parts.push(c.text);
          }
        }
      }
    }
    return parts.join("");
  }
  return "";
}
async function callOpenCodeZen({
  baseUrl = OPENCODE_ZEN_PRESET.baseUrl,
  model = OPENCODE_ZEN_PRESET.defaultModel,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal
}) {
  const trimmedBase = String(baseUrl || OPENCODE_ZEN_PRESET.baseUrl).trim().replace(/\/+$/, "");
  const { cleanModel, protocol } = resolveZenProtocol(model);
  if (!cleanModel) {
    throw new Error("OpenCode Zen: model name is required");
  }
  const trimmedKey = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "public";
  const userPrompt = buildUserPrompt(question, answer);
  let endpoint;
  let headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${trimmedKey}`
  };
  let body;
  if (protocol === "responses") {
    endpoint = `${trimmedBase}/responses`;
    body = {
      model: cleanModel,
      instructions: SYSTEM_PROMPT,
      input: userPrompt,
      max_output_tokens: MAX_OUTPUT_TOKENS
    };
  } else if (protocol === "anthropic") {
    endpoint = `${trimmedBase}/messages`;
    headers["x-api-key"] = trimmedKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: cleanModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    };
  } else if (protocol === "gemini") {
    endpoint = `${trimmedBase}/models/${encodeURIComponent(cleanModel)}:generateContent`;
    headers["x-goog-api-key"] = trimmedKey;
    body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 }
    };
  } else {
    endpoint = `${trimmedBase}/chat/completions`;
    body = {
      model: cleanModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2
    };
    if (/gpt-oss/i.test(cleanModel)) {
      body.reasoning_effort = "low";
    }
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      formatHttpError(OPENCODE_ZEN_PRESET.label, response.status, errText, trimmedKey)
    );
  }
  const data = await response.json();
  if (protocol === "responses") return extractResponsesApiText(data);
  if (protocol === "anthropic") return extractAnthropicText(data);
  if (protocol === "gemini") return extractGeminiText(data);
  return extractChatCompletionText(data);
}

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
async function callProvider({
  provider = "groq",
  model = "",
  apiKey = "",
  customBaseUrl = "",
  question,
  answer = "",
  fetchImpl = fetch,
  timeoutMs = 15e3
}) {
  const spec = getProviderSpec(provider);
  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (spec.requiresKey && !trimmedKey) {
    throw new Error(`No API key configured for ${spec.label}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let rawOutput = "";
    const chosenModel = (model || spec.defaultModel || "").trim();
    if (spec.adapter === "gemini") {
      rawOutput = await callGemini({
        baseUrl: spec.baseUrl,
        model: chosenModel,
        apiKey: trimmedKey,
        question,
        answer,
        fetchImpl,
        signal: controller.signal
      });
    } else if (spec.adapter === "anthropic") {
      rawOutput = await callAnthropic({
        baseUrl: spec.baseUrl,
        model: chosenModel,
        apiKey: trimmedKey,
        question,
        answer,
        fetchImpl,
        signal: controller.signal
      });
    } else if (spec.adapter === "opencode-zen") {
      rawOutput = await callOpenCodeZen({
        baseUrl: spec.baseUrl,
        model: chosenModel,
        apiKey: trimmedKey,
        question,
        answer,
        fetchImpl,
        signal: controller.signal
      });
    } else {
      rawOutput = await callOpenAiCompatible({
        preset: spec,
        baseUrl: spec.id === "custom" ? customBaseUrl : spec.baseUrl,
        model: chosenModel,
        apiKey: trimmedKey,
        question,
        answer,
        fetchImpl,
        signal: controller.signal
      });
    }
    const clean = sanitizeTitle(rawOutput);
    if (!clean) {
      throw new Error(`${spec.id} returned an empty title`);
    }
    return clean;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`${spec.label} request timed out after ${timeoutMs}ms`);
    }
    const safeMsg = redactSecret(err?.message || String(err), trimmedKey);
    throw new Error(safeMsg || `${spec.label} request failed`);
  } finally {
    clearTimeout(timer);
  }
}
async function generateTitleWithFallback({
  settings = {},
  apiKey = "",
  question,
  answer = "",
  fetchImpl = fetch,
  timeoutMs = 15e3
}) {
  const providerId = settings.provider || "groq";
  const spec = getProviderSpec(providerId);
  const model = settings.model || spec.defaultModel;
  const prefix = settings.titlePrefix || "";
  try {
    const llmTitle = await callProvider({
      provider: spec.id,
      model,
      apiKey,
      customBaseUrl: settings.customBaseUrl || "",
      question,
      answer,
      fetchImpl,
      timeoutMs
    });
    return {
      title: applyTitlePrefix(llmTitle, prefix),
      source: "llm",
      provider: spec.id,
      model,
      error: null
    };
  } catch (err) {
    const fallback = heuristicTitle(question, answer);
    return {
      title: applyTitlePrefix(fallback, prefix),
      source: "heuristic",
      provider: spec.id,
      model,
      error: redactSecret(err?.message || "LLM request failed", apiKey)
    };
  }
}

// src/background/service-worker.js
var TEST_SAMPLE = Object.freeze({
  question: "Why do deciduous tree leaves change color in autumn before falling?",
  answer: "As autumn days shorten and temperatures drop, trees stop producing chlorophyll. As green chlorophyll breaks down, yellow and orange carotenoids become visible, while trapped sugars trigger red and purple anthocyanin synthesis."
});
async function checkHostPermission(providerId, customBaseUrl, permissionsApi) {
  if (!permissionsApi?.contains) {
    return true;
  }
  const originPattern = getProviderOriginPattern(providerId, customBaseUrl);
  if (!originPattern) {
    return true;
  }
  try {
    return await permissionsApi.contains({ origins: [originPattern] });
  } catch {
    return true;
  }
}
function createRuntimeDispatcher({
  storageArea,
  fetchImpl = globalThis.fetch,
  permissionsApi = globalThis.chrome?.permissions
} = {}) {
  return async function dispatch(message) {
    switch (message.type) {
      case RUNTIME_MESSAGES.GET_STATE: {
        const [settings, renamedIds] = await Promise.all([
          getSettings(storageArea),
          getRenamedIds(storageArea)
        ]);
        return {
          ok: true,
          settings,
          renamedIds
        };
      }
      case RUNTIME_MESSAGES.GENERATE_TITLE: {
        const settings = await getSettings(storageArea);
        const providerId = settings.provider || "groq";
        const apiKey = await getApiKey(providerId, storageArea);
        const hasPerm = await checkHostPermission(
          providerId,
          settings.customBaseUrl,
          permissionsApi
        );
        const result = await generateTitleWithFallback({
          settings,
          apiKey,
          question: message.question || "",
          answer: message.answer || "",
          fetchImpl
        });
        let enrichedError = result.error;
        if (enrichedError && !hasPerm && /failed to fetch|networkerror/i.test(enrichedError)) {
          const originPattern = getProviderOriginPattern(
            providerId,
            settings.customBaseUrl
          );
          enrichedError = `Host permission not granted for ${originPattern || providerId}. Open Extension Settings and click Save.`;
        }
        return {
          ok: true,
          title: result.title,
          source: result.source,
          provider: result.provider,
          model: result.model,
          error: enrichedError
        };
      }
      case RUNTIME_MESSAGES.RECORD_RENAME: {
        const entry = message.entry || {};
        const saved = await recordRenameEntry(entry, storageArea);
        await setLastStatus(
          {
            outcome: "renamed",
            reason: "ok",
            title: entry.title || "",
            source: entry.source || "llm",
            provider: entry.provider || "",
            httpStatus: entry.httpStatus ?? 204,
            error: entry.error || null
          },
          storageArea
        );
        return {
          ok: true,
          historyItem: saved.historyItem
        };
      }
      case RUNTIME_MESSAGES.RECORD_STATUS: {
        const status = message.status || {};
        const updated = await setLastStatus(status, storageArea);
        return {
          ok: true,
          lastStatus: updated
        };
      }
      case RUNTIME_MESSAGES.TEST_PROVIDER: {
        const savedSettings = await getSettings(storageArea);
        const providerId = message.provider || savedSettings.provider || "groq";
        const spec = getProviderSpec(providerId);
        const model = typeof message.model === "string" && message.model.trim() || savedSettings.model || spec.defaultModel;
        const customBaseUrl = typeof message.customBaseUrl === "string" ? message.customBaseUrl : savedSettings.customBaseUrl || "";
        const candidateKey = typeof message.apiKey === "string" && message.apiKey.trim() ? message.apiKey.trim() : await getApiKey(providerId, storageArea);
        const startedAt = Date.now();
        try {
          const title = await callProvider({
            provider: spec.id,
            model,
            apiKey: candidateKey,
            customBaseUrl,
            question: TEST_SAMPLE.question,
            answer: TEST_SAMPLE.answer,
            fetchImpl
          });
          return {
            ok: true,
            title,
            provider: spec.id,
            model,
            latencyMs: Date.now() - startedAt
          };
        } catch (err) {
          const hasPerm = await checkHostPermission(
            spec.id,
            customBaseUrl,
            permissionsApi
          );
          let safeErr = redactSecret(
            err?.message || "Provider test failed",
            candidateKey
          );
          if (!hasPerm && /failed to fetch|networkerror/i.test(safeErr)) {
            const originPattern = getProviderOriginPattern(spec.id, customBaseUrl);
            safeErr = `Host permission not granted for ${originPattern || spec.id}. Grant host access when prompted.`;
          }
          return {
            ok: false,
            provider: spec.id,
            model,
            error: safeErr
          };
        }
      }
      default:
        return {
          ok: false,
          error: `Unknown message type: ${String(message.type)}`
        };
    }
  };
}
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  const dispatch = createRuntimeDispatcher();
  const activeTabIds = /* @__PURE__ */ new Set();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.ns !== MESSAGE_NS || typeof message.type !== "string") {
      return false;
    }
    if (typeof sender?.tab?.id === "number") {
      activeTabIds.add(sender.tab.id);
    }
    dispatch(message).then((res) => sendResponse(res)).catch(
      (err) => sendResponse({
        ok: false,
        error: err?.message || "Internal service worker error"
      })
    );
    return true;
  });
  if (chrome.storage?.onChanged && chrome.tabs?.sendMessage) {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEYS.SETTINGS]) {
        return;
      }
      const nextSettings = await getSettings();
      for (const tabId of [...activeTabIds]) {
        chrome.tabs.sendMessage(tabId, {
          ns: MESSAGE_NS,
          type: RUNTIME_MESSAGES.SETTINGS_UPDATED,
          settings: nextSettings
        }).catch(() => {
          activeTabIds.delete(tabId);
        });
      }
    });
  }
}
export {
  createRuntimeDispatcher
};
