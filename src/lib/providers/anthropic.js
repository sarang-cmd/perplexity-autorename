/**
 * Anthropic Messages API adapter.
 * Includes `anthropic-dangerous-direct-browser-access: true` required for
 * Chrome MV3 service worker / browser-origin requests.
 */

import {
  MAX_OUTPUT_TOKENS,
  SYSTEM_PROMPT,
  buildUserPrompt,
  formatHttpError,
} from "./prompt.js";

export const ANTHROPIC_PRESET = {
  id: "anthropic",
  label: "Anthropic",
  adapter: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  defaultModel: "claude-haiku-4-5",
  requiresKey: true,
};

export function extractAnthropicText(json) {
  if (!Array.isArray(json?.content)) return "";
  return json.content
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

export async function callAnthropic({
  baseUrl = ANTHROPIC_PRESET.baseUrl,
  model = ANTHROPIC_PRESET.defaultModel,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal,
}) {
  const trimmedBase = String(baseUrl || ANTHROPIC_PRESET.baseUrl)
    .trim()
    .replace(/\/+$/, "");
  const cleanModel = String(model || ANTHROPIC_PRESET.defaultModel).trim();
  if (!cleanModel) {
    throw new Error("Anthropic: model name is required");
  }

  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const endpoint = trimmedBase.endsWith("/messages")
    ? trimmedBase
    : `${trimmedBase}/messages`;

  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
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
        content: buildUserPrompt(question, answer),
      },
    ],
  };

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
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
