import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  callProvider,
  generateTitleWithFallback,
  getProviderOriginPattern,
} from "../src/lib/providers/index.js";
import { resolveZenProtocol } from "../src/lib/providers/opencode-zen.js";

function mockJsonFetch(responseBody, status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      headers: init?.headers || {},
      body: init?.body ? JSON.parse(init.body) : null,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
      text: async () =>
        typeof responseBody === "string"
          ? responseBody
          : JSON.stringify(responseBody),
    };
  };
  return { fn, calls };
}

describe("providers: Groq & reasoning-model fix", () => {
  it("sends max_tokens=256 and reasoning_effort='low' for openai/gpt-oss-20b on Groq", async () => {
    const { fn, calls } = mockJsonFetch({
      choices: [{ message: { content: "Quantum Error Correction Surface Codes" } }],
    });

    const title = await callProvider({
      provider: "groq",
      model: "openai/gpt-oss-20b",
      apiKey: "gsk_test_key_12345",
      question: "How do surface codes work in quantum error correction?",
      answer: "Surface codes arrange physical qubits on a 2D lattice...",
      fetchImpl: fn,
    });

    assert.equal(title, "Quantum Error Correction Surface Codes");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(calls[0].headers.Authorization, "Bearer gsk_test_key_12345");
    assert.equal(calls[0].body.max_tokens, 256);
    assert.equal(calls[0].body.reasoning_effort, "low");
  });

  it("throws '<provider> returned an empty title' if reasoning consumes output without visible text", async () => {
    const { fn } = mockJsonFetch({
      choices: [{ message: { content: "" } }],
    });

    await assert.rejects(
      () =>
        callProvider({
          provider: "groq",
          model: "openai/gpt-oss-20b",
          apiKey: "gsk_test_key_12345",
          question: "Test?",
          fetchImpl: fn,
        }),
      /groq returned an empty title/
    );
  });
});

describe("providers: Sarvam, Mistral, OpenAI", () => {
  it("sends api-subscription-key and Bearer headers for Sarvam sarvam-105b", async () => {
    const { fn, calls } = mockJsonFetch({
      choices: [{ message: { content: "Monsoon Rainfall Forecasting Models" } }],
    });

    const title = await callProvider({
      provider: "sarvam",
      model: "sarvam-105b",
      apiKey: "sv_secret_key",
      question: "How is monsoon rainfall forecast?",
      fetchImpl: fn,
    });

    assert.equal(title, "Monsoon Rainfall Forecasting Models");
    assert.equal(calls[0].url, "https://api.sarvam.ai/v1/chat/completions");
    assert.equal(calls[0].headers["api-subscription-key"], "sv_secret_key");
    assert.equal(calls[0].headers.Authorization, "Bearer sv_secret_key");
    assert.equal(calls[0].body.reasoning_effort, "low");
  });

  it("uses max_completion_tokens=256 for OpenAI", async () => {
    const { fn, calls } = mockJsonFetch({
      choices: [{ message: { content: "SQLite Write Ahead Logging" } }],
    });

    const title = await callProvider({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test-openai",
      question: "How does SQLite WAL mode work?",
      fetchImpl: fn,
    });

    assert.equal(title, "SQLite Write Ahead Logging");
    assert.equal(calls[0].body.max_completion_tokens, 256);
    assert.equal(calls[0].body.max_tokens, undefined);
  });
});

describe("providers: Gemini & Anthropic", () => {
  it("calls Gemini with x-goog-api-key header, thinkingBudget=0 on 2.5-flash, and skips thought parts", async () => {
    const { fn, calls } = mockJsonFetch({
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "Hidden internal thought" },
              { text: "CRISPR Base Editing Mechanisms" },
            ],
          },
        },
      ],
    });

    const title = await callProvider({
      provider: "gemini",
      model: "gemini-2.5-flash",
      apiKey: "AIzaSyTestKey",
      question: "How does base editing differ from Cas9?",
      fetchImpl: fn,
    });

    assert.equal(title, "CRISPR Base Editing Mechanisms");
    assert.ok(!calls[0].url.includes("AIzaSyTestKey"));
    assert.equal(calls[0].headers["x-goog-api-key"], "AIzaSyTestKey");
    assert.equal(calls[0].body.generationConfig.maxOutputTokens, 256);
    assert.deepEqual(calls[0].body.generationConfig.thinkingConfig, {
      thinkingBudget: 0,
    });
  });

  it("calls Anthropic /v1/messages with anthropic-dangerous-direct-browser-access header", async () => {
    const { fn, calls } = mockJsonFetch({
      content: [{ type: "text", text: "WebGPU Compute Shader Pipelines" }],
    });

    const title = await callProvider({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKey: "sk-ant-test",
      question: "How do WebGPU compute shaders dispatch workgroups?",
      fetchImpl: fn,
    });

    assert.equal(title, "WebGPU Compute Shader Pipelines");
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
    assert.equal(calls[0].headers["x-api-key"], "sk-ant-test");
    assert.equal(
      calls[0].headers["anthropic-dangerous-direct-browser-access"],
      "true"
    );
  });
});

describe("providers: OpenCode Zen multi-protocol routing", () => {
  it("routes GPT, Claude, Gemini, and OpenAI-compatible Zen models to their documented endpoints", () => {
    assert.deepEqual(resolveZenProtocol("opencode/gpt-5.5"), {
      cleanModel: "gpt-5.5",
      protocol: "responses",
    });
    assert.deepEqual(resolveZenProtocol("claude-sonnet-4-5"), {
      cleanModel: "claude-sonnet-4-5",
      protocol: "anthropic",
    });
    assert.deepEqual(resolveZenProtocol("gemini-2.5-flash"), {
      cleanModel: "gemini-2.5-flash",
      protocol: "gemini",
    });
    assert.deepEqual(resolveZenProtocol("big-pickle"), {
      cleanModel: "big-pickle",
      protocol: "chat-completions",
    });
  });

  it("invokes /zen/v1/responses for GPT models on OpenCode Zen", async () => {
    const { fn, calls } = mockJsonFetch({
      output_text: "Browser Sandboxing Site Isolation",
    });

    const title = await callProvider({
      provider: "opencode-zen",
      model: "gpt-5.5",
      apiKey: "",
      question: "What is Chrome site isolation?",
      fetchImpl: fn,
    });

    assert.equal(title, "Browser Sandboxing Site Isolation");
    assert.equal(calls[0].url, "https://opencode.ai/zen/v1/responses");
    assert.equal(calls[0].headers.Authorization, "Bearer public");
  });
});

describe("providers: secret redaction & heuristic fallback", () => {
  it("redacts echoed API keys from HTTP error messages and falls back to heuristic", async () => {
    const secretKey = "gsk_SUPER_SECRET_TOKEN_999";
    const { fn } = mockJsonFetch(
      { error: { message: `Invalid API key provided: ${secretKey}` } },
      401
    );

    const res = await generateTitleWithFallback({
      settings: {
        provider: "groq",
        model: "openai/gpt-oss-20b",
        titlePrefix: "[Dev]",
      },
      apiKey: secretKey,
      question: "How does Linux io_uring reduce syscall overhead?",
      answer: "io_uring uses shared submission and completion ring buffers.",
      fetchImpl: fn,
    });

    assert.equal(res.source, "heuristic");
    assert.ok(res.title.startsWith("[Dev] "));
    assert.ok(res.error);
    assert.ok(!res.error.includes(secretKey));
    assert.ok(res.error.includes("[REDACTED]"));
  });

  it("computes runtime optional host permission match patterns accurately", () => {
    assert.equal(getProviderOriginPattern("groq"), "https://api.groq.com/*");
    assert.equal(
      getProviderOriginPattern("custom", "http://localhost:11434/v1"),
      "http://localhost:11434/*"
    );
    assert.equal(getProviderOriginPattern("custom", "not-a-url"), null);
  });
});
