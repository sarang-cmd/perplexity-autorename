/**
 * OpenCode Zen adapter (`https://opencode.ai/zen/v1`).
 *
 * Verified routing rules from OpenCode Zen documentation:
 * - GPT / o-series models (`/^(?:gpt-|o[134](?:-|$)|codex-)/i`) -> POST `/zen/v1/responses` (OpenAI Responses protocol)
 * - Claude models (`/^claude-/i`)                               -> POST `/zen/v1/messages` (Anthropic Messages protocol)
 * - Gemini models (`/^gemini-/i`)                               -> POST `/zen/v1/models/<id>:generateContent` (Google protocol)
 * - All other models (`big-pickle`, `mistral-*`, `*-free`, etc) -> POST `/zen/v1/chat/completions` (OpenAI Chat Completions)
 */

import {
  MAX_OUTPUT_TOKENS,
  SYSTEM_PROMPT,
  buildUserPrompt,
  formatHttpError,
} from "./prompt.js";
import { extractChatCompletionText } from "./openai-compatible.js";
import { extractAnthropicText } from "./anthropic.js";
import { extractGeminiText } from "./gemini.js";

export const OPENCODE_ZEN_PRESET = {
  id: "opencode-zen",
  label: "OpenCode Zen",
  adapter: "opencode-zen",
  baseUrl: "https://opencode.ai/zen/v1",
  defaultModel: "big-pickle",
  // Free models on OpenCode Zen work with "public" token if no paid key is entered
  requiresKey: false,
};

/**
 * Determines which OpenCode Zen wire protocol a model ID requires.
 *
 * @param {string} rawModel
 * @returns {{ cleanModel: string, protocol: "responses" | "anthropic" | "gemini" | "chat-completions" }}
 */
export function resolveZenProtocol(rawModel) {
  const cleanModel = String(rawModel || OPENCODE_ZEN_PRESET.defaultModel)
    .trim()
    .replace(/^opencode\//i, "");

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

export function extractResponsesApiText(json) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) {
    return json.output_text;
  }
  if (Array.isArray(json?.output)) {
    const parts = [];
    for (const item of json.output) {
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (
            (c?.type === "output_text" || c?.type === "text") &&
            typeof c.text === "string"
          ) {
            parts.push(c.text);
          }
        }
      }
    }
    return parts.join("");
  }
  return "";
}

export async function callOpenCodeZen({
  baseUrl = OPENCODE_ZEN_PRESET.baseUrl,
  model = OPENCODE_ZEN_PRESET.defaultModel,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal,
}) {
  const trimmedBase = String(baseUrl || OPENCODE_ZEN_PRESET.baseUrl)
    .trim()
    .replace(/\/+$/, "");
  const { cleanModel, protocol } = resolveZenProtocol(model);
  if (!cleanModel) {
    throw new Error("OpenCode Zen: model name is required");
  }

  const trimmedKey = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : "public";
  const userPrompt = buildUserPrompt(question, answer);

  let endpoint;
  let headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${trimmedKey}`,
  };
  let body;

  if (protocol === "responses") {
    endpoint = `${trimmedBase}/responses`;
    body = {
      model: cleanModel,
      instructions: SYSTEM_PROMPT,
      input: userPrompt,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    };
  } else if (protocol === "anthropic") {
    endpoint = `${trimmedBase}/messages`;
    headers["x-api-key"] = trimmedKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: cleanModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    };
  } else if (protocol === "gemini") {
    endpoint = `${trimmedBase}/models/${encodeURIComponent(cleanModel)}:generateContent`;
    headers["x-goog-api-key"] = trimmedKey;
    body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.2 },
    };
  } else {
    endpoint = `${trimmedBase}/chat/completions`;
    body = {
      model: cleanModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
    };
    if (/gpt-oss/i.test(cleanModel)) {
      body.reasoning_effort = "low";
    }
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
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
