/**
 * Google Gemini GenerateContent adapter.
 * Uses `x-goog-api-key` header so the API key never appears in request URLs.
 */

import {
  MAX_OUTPUT_TOKENS,
  SYSTEM_PROMPT,
  buildUserPrompt,
  formatHttpError,
} from "./prompt.js";

export const GEMINI_PRESET = {
  id: "gemini",
  label: "Google Gemini",
  adapter: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  defaultModel: "gemini-2.5-flash",
  requiresKey: true,
};

export function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => p && !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

export async function callGemini({
  baseUrl = GEMINI_PRESET.baseUrl,
  model = GEMINI_PRESET.defaultModel,
  apiKey,
  question,
  answer,
  fetchImpl = fetch,
  signal,
}) {
  const trimmedBase = String(baseUrl || GEMINI_PRESET.baseUrl)
    .trim()
    .replace(/\/+$/, "");
  const cleanModel = String(model || GEMINI_PRESET.defaultModel)
    .trim()
    .replace(/^models\//, "");

  if (!cleanModel) {
    throw new Error("Google Gemini: model name is required");
  }

  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  const endpoint = `${trimmedBase}/models/${encodeURIComponent(cleanModel)}:generateContent`;

  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
  };

  // Disable thinking budget on Gemini 2.5 Flash so thinking doesn't consume output tokens
  if (/^gemini-2\.5-flash/i.test(cleanModel)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserPrompt(question, answer) }],
      },
    ],
    generationConfig,
  };

  const headers = {
    "Content-Type": "application/json",
  };
  if (trimmedKey) {
    headers["x-goog-api-key"] = trimmedKey;
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
      formatHttpError(GEMINI_PRESET.label, response.status, errText, trimmedKey)
    );
  }

  const data = await response.json();
  return extractGeminiText(data);
}
