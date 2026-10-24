/**
 * Title sanitization and local keyword-heuristic fallback (3–7 words).
 */

const STOPWORDS = new Set([
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
  "your",
]);

const SMALL_TITLE_WORDS = new Set([
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
  "with",
]);

/**
 * Cleans raw LLM output into a crisp, single-line title of at most `maxWords` words.
 * Strips `<think>` blocks, preambles ("Title:"), markdown formatting, surrounding quotes,
 * and trailing punctuation.
 *
 * @param {string | null | undefined} raw
 * @param {{ maxWords?: number, maxChars?: number }} [options]
 * @returns {string}
 */
export function sanitizeTitle(raw, { maxWords = 7, maxChars = 90 } = {}) {
  if (typeof raw !== "string") {
    return "";
  }

  // Strip closed <think>...</think> blocks and any unclosed <think>... tail
  let text = raw
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, " ")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, " ")
    .trim();

  if (!text) {
    return "";
  }

  // Pick the first meaningful non-empty line
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  let line = lines[0];

  // Remove markdown heading markers, list bullets, and chatty prefixes like "Title:"
  line = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*•]\s+/, "")
    .replace(
      /^(?:thread\s+title|suggested\s+title|concise\s+title|here(?:'s|\s+is)\s+(?:a\s+|the\s+)?title|title)\s*[:\-–—]\s*/i,
      ""
    )
    .trim();

  // Strip markdown emphasis/code markers
  line = line.replace(/[*_`~]+/g, "");

  // Strip matching or stray outer quotes
  line = line
    .replace(/^["'“”‘’«»]+/, "")
    .replace(/["'“”‘’«»]+$/, "")
    .trim();

  // Strip trailing sentence punctuation (periods, colons, semicolons, exclamation, commas)
  line = line.replace(/[.,;:!?…]+$/g, "").trim();

  // Collapse internal whitespace
  line = line.replace(/\s+/g, " ");
  if (!line) {
    return "";
  }

  const words = line.split(" ").filter(Boolean);
  const limited = words.slice(0, Math.max(1, maxWords)).join(" ");

  // Clean trailing connectors/punctuation left after word slicing
  let result = limited
    .replace(/\s+(?:and|or|the|a|an|of|in|to|for|with|on|at|by|-|–|—)$/i, "")
    .replace(/[.,;:!?…\-–—]+$/g, "")
    .trim();

  if (result.length > maxChars) {
    result = result.slice(0, maxChars).replace(/\s+\S*$/, "").trim() || result.slice(0, maxChars).trim();
  }

  return result;
}

function formatHeuristicWord(word, index) {
  // Preserve mixed-case tech terms (e.g. iOS, macOS, JavaScript, FastAPI, OpenAI, GPT-4o, MV3)
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

  // Strip code blocks, inline URLs, and citation brackets like [1]
  const cleaned = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\[(?:\d+|web:\d+)\]/gi, " ")
    .replace(/[^\p{L}\p{N}+#.\-/\s]/gu, " ");

  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const selected = [];
  const seenLower = new Set();

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

/**
 * Generates a deterministic 3–7 word title from the question (and optionally answer)
 * when no LLM key is configured or the provider request fails.
 *
 * @param {string} question
 * @param {string} [answer]
 * @returns {string}
 */
export function heuristicTitle(question, answer = "") {
  const qWords = extractCandidateWords(question);

  if (qWords.length < 3 && typeof answer === "string" && answer.trim()) {
    // Supplement from the opening sentence of the answer if the question was ultra-terse
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

  // Last-resort fallback: first words of the raw question
  const fallbackRaw = sanitizeTitle(question, { maxWords: 6 });
  return fallbackRaw || "New Search Thread";
}
