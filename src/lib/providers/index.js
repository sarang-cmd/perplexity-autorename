/**
 * Provider registry, runtime host-permission origin helper, direct LLM invocation,
 * and fallback-aware title generator.
 */

import { sanitizeTitle, heuristicTitle } from "../title.js";
import { applyTitlePrefix } from "../decide.js";
import { redactSecret } from "./prompt.js";
import {
  OPENAI_COMPATIBLE_PRESETS,
  callOpenAiCompatible,
} from "./openai-compatible.js";
import { GEMINI_PRESET, callGemini } from "./gemini.js";
import { ANTHROPIC_PRESET, callAnthropic } from "./anthropic.js";
import { OPENCODE_ZEN_PRESET, callOpenCodeZen } from "./opencode-zen.js";

export const PROVIDERS = {
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
  custom: OPENAI_COMPATIBLE_PRESETS.custom,
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

/**
 * Resolves a provider specification by ID (defaults to Groq if unknown).
 *
 * @param {string} providerId
 */
export function getProviderSpec(providerId) {
  return PROVIDERS[providerId] || PROVIDERS.groq;
}

/**
 * Computes the Chrome match pattern (`https://host/*`) needed in `optional_host_permissions`
 * for the selected provider.
 *
 * @param {string} providerId
 * @param {string} [customBaseUrl]
 * @returns {string | null}
 */
export function getProviderOriginPattern(providerId, customBaseUrl = "") {
  const spec = getProviderSpec(providerId);
  const rawBase =
    spec.id === "custom" ? String(customBaseUrl || "").trim() : spec.baseUrl;
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

/**
 * Calls the selected LLM provider and returns a sanitized 3–7 word title.
 * Throws a secret-redacted Error if the key is missing, network fails, or output is empty.
 */
export async function callProvider({
  provider = "groq",
  model = "",
  apiKey = "",
  customBaseUrl = "",
  question,
  answer = "",
  fetchImpl = fetch,
  timeoutMs = 15000,
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
        signal: controller.signal,
      });
    } else if (spec.adapter === "anthropic") {
      rawOutput = await callAnthropic({
        baseUrl: spec.baseUrl,
        model: chosenModel,
        apiKey: trimmedKey,
        question,
        answer,
        fetchImpl,
        signal: controller.signal,
      });
    } else if (spec.adapter === "opencode-zen") {
      rawOutput = await callOpenCodeZen({
        baseUrl: spec.baseUrl,
        model: chosenModel,
        apiKey: trimmedKey,
        question,
        answer,
        fetchImpl,
        signal: controller.signal,
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
        signal: controller.signal,
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

/**
 * Generates a thread title via the configured LLM provider, falling back cleanly
 * to the local keyword heuristic if the LLM fails or has no API key.
 * Always surfaces `source` ("llm" | "heuristic") and any sanitized `error`.
 */
export async function generateTitleWithFallback({
  settings = {},
  apiKey = "",
  question,
  answer = "",
  fetchImpl = fetch,
  timeoutMs = 15000,
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
      timeoutMs,
    });
    return {
      title: applyTitlePrefix(llmTitle, prefix),
      source: "llm",
      provider: spec.id,
      model,
      error: null,
    };
  } catch (err) {
    const fallback = heuristicTitle(question, answer);
    return {
      title: applyTitlePrefix(fallback, prefix),
      source: "heuristic",
      provider: spec.id,
      model,
      error: redactSecret(err?.message || "LLM request failed", apiKey),
    };
  }
}
