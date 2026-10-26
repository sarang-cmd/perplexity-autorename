/**
 * OpenAI-compatible Chat Completions adapter + verified provider presets.
 * Includes the reasoning-model fix:
 * - Output budget of 256 tokens across all presets
 * - `reasoning_effort: "low"` for `/gpt-oss/` models (e.g. Groq's `openai/gpt-oss-20b`)
 *   and Sarvam's `sarvam-105b`
 */

import {
  MAX_OUTPUT_TOKENS,
  SYSTEM_PROMPT,
  buildUserPrompt,
  formatHttpError,
} from "./prompt.js";

export const OPENAI_COMPATIBLE_PRESETS = {
  groq: {
    id: "groq",
    label: "Groq",
    adapter: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-20b",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    adapter: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
  sarvam: {
    id: "sarvam",
    label: "Sarvam AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.sarvam.ai/v1",
    defaultModel: "sarvam-105b",
    requiresKey: true,
    authStyle: "sarvam",
    maxTokensField: "max_tokens",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    adapter: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_completion_tokens",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    adapter: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    adapter: "openai-compatible",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    adapter: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
  together: {
    id: "together",
    label: "Together AI",
    adapter: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    requiresKey: true,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    adapter: "openai-compatible",
    baseUrl: "",
    defaultModel: "gpt-4o-mini",
    requiresKey: false,
    authStyle: "bearer",
    maxTokensField: "max_tokens",
  },
};

/**
 * Normalizes a base URL into a `/chat/completions` endpoint URL.
 *
 * @param {string} baseUrl
 * @returns {string}
 */
export function buildChatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Custom provider base URL is required");
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

export function extractChatCompletionText(json) {
  const message = json?.choices?.[0]?.message;
  if (!message) return "";
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("");
  }
  return "";
}

/**
 * Calls an OpenAI-compatible Chat Completions endpoint.
 */
export async function callOpenAiCompatible({
  preset,
  baseUrl,
  model,
  apiKey,
  question,
  answer,
  avoidTitles = [],
  regenerate = false,
  fetchImpl = fetch,
  signal,
}) {
  const effectiveBase = baseUrl || preset.baseUrl;
  const endpoint = buildChatCompletionsUrl(effectiveBase);
  const chosenModel = (model || preset.defaultModel || "").trim();
  if (!chosenModel) {
    throw new Error(`${preset.label}: model name is required`);
  }

  const headers = {
    "Content-Type": "application/json",
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

  const tokenField =
    preset.maxTokensField === "max_completion_tokens" ||
    /^(?:o[134](?:-|$)|gpt-5)/i.test(chosenModel)
      ? "max_completion_tokens"
      : "max_tokens";

  const temp = regenerate || (Array.isArray(avoidTitles) && avoidTitles.length > 0) ? 0.65 : 0.2;

  const body = {
    model: chosenModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(question, answer, { avoidTitles }) },
    ],
    [tokenField]: MAX_OUTPUT_TOKENS,
  };

  // Reasoning models (Groq GPT-OSS 20B/120B, Sarvam 105B) need explicit low effort
  // so thinking tokens do not exhaust the output budget and return an empty title.
  if (/gpt-oss/i.test(chosenModel) || /^sarvam-105b$/i.test(chosenModel)) {
    body.reasoning_effort = "low";
    if (regenerate) {
      body.temperature = temp;
    }
  } else if (!/^(?:o[134](?:-|$)|gpt-5)/i.test(chosenModel)) {
    body.temperature = temp;
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(formatHttpError(preset.label, response.status, errText, trimmedKey));
  }

  const data = await response.json();
  return extractChatCompletionText(data);
}
