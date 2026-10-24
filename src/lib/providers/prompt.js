/**
 * Shared prompt construction, output token budget, and secret-safe error formatting
 * for all LLM title-generation adapters.
 */

export const MAX_OUTPUT_TOKENS = 256;
export const MAX_QUESTION_CHARS = 600;
export const MAX_ANSWER_CHARS = 1200;

export const SYSTEM_PROMPT =
  "You generate concise, descriptive titles for research threads. " +
  "Write a clear 3 to 7 word title capturing the core topic. " +
  "Return ONLY the plain title words — no quotes, no markdown, no trailing period, and no 'Title:' prefix.";

/**
 * Builds the bounded user prompt sent to the configured LLM.
 *
 * @param {string} question
 * @param {string} answer
 * @returns {string}
 */
export function buildUserPrompt(question, answer = "") {
  const q = String(question || "").trim().slice(0, MAX_QUESTION_CHARS);
  const a = String(answer || "").trim().slice(0, MAX_ANSWER_CHARS);
  if (!a) {
    return `Question:\n${q}\n\nGenerate a 3-7 word thread title:`;
  }
  return `Question:\n${q}\n\nAnswer excerpt:\n${a}\n\nGenerate a 3-7 word thread title:`;
}

/**
 * Extracts a short, human-readable error message from a failed HTTP response body
 * while stripping any accidental echo of the API key.
 *
 * @param {string} providerLabel
 * @param {number} status
 * @param {string} bodyText
 * @param {string} [apiKey]
 * @returns {string}
 */
export function formatHttpError(providerLabel, status, bodyText, apiKey = "") {
  let detail = "";
  if (typeof bodyText === "string" && bodyText.trim()) {
    try {
      const parsed = JSON.parse(bodyText);
      const candidate =
        parsed?.error?.message ||
        parsed?.message ||
        parsed?.detail ||
        (typeof parsed?.error === "string" ? parsed.error : "");
      if (typeof candidate === "string") {
        detail = candidate.trim();
      }
    } catch {
      detail = bodyText.trim();
    }
  }

  detail = redactSecret(detail, apiKey).replace(/\s+/g, " ").slice(0, 180);
  return detail
    ? `${providerLabel} HTTP ${status}: ${detail}`
    : `${providerLabel} HTTP ${status}`;
}

/**
 * Redacts a secret string from any error text.
 *
 * @param {string} text
 * @param {string} [secret]
 * @returns {string}
 */
export function redactSecret(text, secret = "") {
  if (typeof text !== "string" || !text) return "";
  let out = text;
  if (typeof secret === "string" && secret.trim().length >= 4) {
    out = out.split(secret.trim()).join("[REDACTED]");
  }
  return out;
}
