/**
 * Pure decision logic for thread auto-renaming:
 * - shouldRename: returns { rename: boolean, reason: string }
 * - compileExcludePatterns: parses and validates exclude regex patterns
 * - matchesExcludePattern: checks whether a question matches any exclude regex
 * - applyTitlePrefix: prepends an optional configured prefix cleanly
 */

export const DECISION_REASONS = {
  OK: "ok",
  DISABLED: "disabled",
  FOLLOW_UP: "follow-up",
  EMPTY_QUESTION: "empty-question",
  ALREADY_RENAMED: "already-renamed",
  EXCLUDED: "excluded",
};

/**
 * Parses a single pattern string into a RegExp.
 * Supports either `/pattern/flags` regex literal syntax or plain regex patterns (defaulting to `i`).
 *
 * @param {string} raw
 * @returns {{ regex: RegExp | null, error: string | null }}
 */
function parseSinglePattern(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return { regex: null, error: null };
  }

  try {
    const literalMatch = /^\/(.+)\/([dgimsuvy]*)$/.exec(trimmed);
    if (literalMatch) {
      // Remove stateful 'g'/'y' flags so repeated .test() calls remain deterministic
      const safeFlags = literalMatch[2].replace(/[gy]/g, "");
      return { regex: new RegExp(literalMatch[1], safeFlags), error: null };
    }
    return { regex: new RegExp(trimmed, "i"), error: null };
  } catch (err) {
    return {
      regex: null,
      error: `Invalid regex "${trimmed}": ${err?.message || "syntax error"}`,
    };
  }
}

/**
 * Normalizes an array or newline-delimited string of exclude regexes into compiled RegExp instances.
 * Invalid regexes are reported in `errors` and skipped rather than throwing.
 *
 * @param {string[] | string | null | undefined} patterns
 * @returns {{ regexes: RegExp[], errors: string[] }}
 */
export function compileExcludePatterns(patterns) {
  if (!patterns) {
    return { regexes: [], errors: [] };
  }

  const lines = Array.isArray(patterns)
    ? patterns
    : typeof patterns === "string"
      ? patterns.split(/\r?\n/)
      : [];

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

/**
 * Tests whether `question` matches any configured exclude regex pattern.
 *
 * @param {string} question
 * @param {Array<string | RegExp> | string | null | undefined} patterns
 * @returns {boolean}
 */
export function matchesExcludePattern(question, patterns) {
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

/**
 * Pure decision function determining whether a completed Perplexity answer should trigger a rename.
 *
 * Reason codes (matching triage spec):
 * - "disabled"
 * - "follow-up"
 * - "empty-question"
 * - "already-renamed"
 * - "excluded"
 * - "ok"
 *
 * @param {object} input
 * @param {boolean} input.enabled
 * @param {boolean} [input.isFollowUp]
 * @param {string | null} [input.contextUuid]
 * @param {Set<string> | string[] | Record<string, boolean>} [input.alreadyRenamedIds]
 * @param {Set<string> | string[] | Record<string, boolean>} [input.userRenamedIds]
 * @param {string} [input.question]
 * @param {string[] | string} [input.excludePatterns]
 * @returns {{ rename: boolean, reason: string }}
 */
export function shouldRename({
  enabled = true,
  isFollowUp = false,
  contextUuid = null,
  alreadyRenamedIds = null,
  userRenamedIds = null,
  question = "",
  excludePatterns = [],
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

  if (
    contextUuid &&
    (hasId(alreadyRenamedIds, contextUuid) ||
      hasId(userRenamedIds, contextUuid))
  ) {
    return { rename: false, reason: DECISION_REASONS.ALREADY_RENAMED };
  }

  if (matchesExcludePattern(cleanQuestion, excludePatterns)) {
    return { rename: false, reason: DECISION_REASONS.EXCLUDED };
  }

  return { rename: true, reason: DECISION_REASONS.OK };
}

/**
 * Prepends an optional prefix to a sanitized title without duplicating an existing prefix.
 *
 * @param {string} title
 * @param {string | null | undefined} prefix
 * @returns {string}
 */
export function applyTitlePrefix(title, prefix) {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!cleanTitle) {
    return "";
  }
  if (typeof prefix !== "string" || prefix.trim().length === 0) {
    return cleanTitle;
  }

  const trimmedPrefix = prefix.trim();
  if (
    cleanTitle.toLowerCase().startsWith((trimmedPrefix + " ").toLowerCase()) ||
    cleanTitle.toLowerCase() === trimmedPrefix.toLowerCase()
  ) {
    return cleanTitle;
  }

  // If the user explicitly ended their prefix with whitespace or a joining character with no space (e.g. "ppx/"), respect it
  if (/\s$/.test(prefix)) {
    return `${trimmedPrefix} ${cleanTitle}`;
  }

  return `${trimmedPrefix} ${cleanTitle}`;
}
