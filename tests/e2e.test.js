import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installPageScript } from "../src/page/inject.js";
import { initContentScript } from "../src/content/content.js";
import { createRuntimeDispatcher } from "../src/background/service-worker.js";
import { setApiKey, saveSettings, getHistory, getLastStatus } from "../src/lib/storage.js";

function createMemoryStorage() {
  const data = {};
  return {
    async get(key) {
      if (typeof key === "string") {
        return key in data ? { [key]: structuredClone(data[key]) } : {};
      }
      return structuredClone(data);
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) {
        data[k] = structuredClone(v);
      }
    },
  };
}

function createSyntheticSseResponse(frames, delimiter = "\r\n\r\n") {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const f of frames) {
        controller.enqueue(encoder.encode(f + delimiter));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function createMockEnvironment({ onPerplexityFetch, onLlmFetch }) {
  const listeners = new Set();
  const attrs = new Map();
  const storageArea = createMemoryStorage();

  const mockWindow = {
    __ppxDisableAutoInit: true,
    location: { origin: "https://www.perplexity.ai" },
    document: {
      title: "Perplexity",
      documentElement: {
        setAttribute: (k, v) => attrs.set(k, String(v)),
        getAttribute: (k) => attrs.get(k) ?? null,
      },
    },
    addEventListener(type, fn) {
      if (type === "message") listeners.add(fn);
    },
    removeEventListener(type, fn) {
      if (type === "message") listeners.delete(fn);
    },
    postMessage(data) {
      queueMicrotask(() => {
        for (const fn of [...listeners]) {
          fn({ source: mockWindow, data });
        }
      });
    },
    fetch: onPerplexityFetch,
  };

  const dispatcher = createRuntimeDispatcher({
    storageArea,
    fetchImpl: onLlmFetch,
  });

  const mockChrome = {
    runtime: {
      lastError: null,
      getURL: (p) => `chrome-extension://test-ext-id/${p}`,
      sendMessage(msg, cb) {
        dispatcher(msg)
          .then((res) => cb(res))
          .catch((err) => cb({ ok: false, error: err.message }));
      },
    },
  };

  return { mockWindow, mockChrome, storageArea };
}

function waitFor(predicate, timeoutMs = 1500) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const val = await predicate();
        if (val) {
          resolve(val);
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Timed out waiting for condition"));
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

describe("e2e: page-world wrapper + content script + service worker pipeline", () => {
  it("observes relative-URL perplexity_ask stream, generates LLM title, and posts 204 rename", async () => {
    const renameCalls = [];
    let sessionCalls = 0;

    const sseFrames = [
      'event: message\r\ndata: {"context_uuid":"ctx-live-1","read_write_token":"rwt-live-1","backend_uuid":"slug-live-1","status":"PENDING"}',
      'event: message\r\ndata: {"context_uuid":"ctx-live-1","status":"COMPLETED","final":true,"final_sse_message":true,"blocks":[{"type":"WORKFLOW_ITEM_TEXT","payload":{"text_payload":{"variant":"answer","text":"Solid-state batteries replace liquid electrolytes with ceramic or sulfide conductors.","chunks":["Solid-state batteries ","replace liquid electrolytes with ceramic or sulfide conductors."]}}}]}',
      "event: end_of_stream\r\ndata: {}",
    ];

    const env = createMockEnvironment({
      onPerplexityFetch: async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/rest/sse/perplexity_ask")) {
          return createSyntheticSseResponse(sseFrames);
        }
        if (url.includes("/api/auth/session")) {
          sessionCalls++;
          return new Response(
            JSON.stringify({
              user: { id: "user-acct-77", email: "private@example.com" },
              accessToken: "sensitive-session-token",
            }),
            { status: 200 }
          );
        }
        if (url.includes("/rest/thread/set_thread_title")) {
          renameCalls.push({
            url,
            headers: init.headers,
            body: JSON.parse(init.body),
          });
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      },
      onLlmFetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Solid-State Battery Electrolyte Materials" } }],
        }),
      }),
    });

    await saveSettings(
      { enabled: true, provider: "groq", model: "openai/gpt-oss-20b" },
      env.storageArea
    );
    await setApiKey("groq", "gsk_e2e_key", env.storageArea);

    installPageScript(env.mockWindow);
    initContentScript({
      win: env.mockWindow,
      chromeObj: env.mockChrome,
      retryDelaysMs: [5, 10],
    });

    // Simulate Perplexity's frontend calling relative fetch() and consuming its own stream
    const req = new Request(
      "https://www.perplexity.ai/rest/sse/perplexity_ask?version=2.18&source=default",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_str: "How do solid-state batteries differ from conventional Li-ion?",
          params: { last_backend_uuid: null, is_related_query: "False" },
        }),
      }
    );

    const pageRes = await env.mockWindow.fetch(req);
    const pageText = await pageRes.text();
    assert.ok(pageText.includes("WORKFLOW_ITEM_TEXT"));

    await waitFor(() => renameCalls.length === 1);

    assert.equal(sessionCalls, 1);
    assert.equal(
      renameCalls[0].url,
      "https://www.perplexity.ai/rest/thread/set_thread_title?version=2.18&source=default"
    );
    assert.equal(renameCalls[0].headers["x-pplx-account"], "user-acct-77");
    assert.equal(renameCalls[0].headers["x-app-apiversion"], "2.18");
    assert.equal(renameCalls[0].headers["x-perplexity-request-reason"], "thread-item");
    assert.ok(renameCalls[0].headers["x-request-id"]);
    assert.deepEqual(renameCalls[0].body, {
      context_uuid: "ctx-live-1",
      title: "Solid-State Battery Electrolyte Materials",
      read_write_token: "rwt-live-1",
    });
    assert.equal(
      env.mockWindow.document.title,
      "Solid-State Battery Electrolyte Materials"
    );

    const history = await waitFor(async () => {
      const h = await getHistory(env.storageArea);
      return h.length === 1 ? h : null;
    });
    assert.equal(history[0].source, "llm");
    assert.equal(history[0].backendUuid, "slug-live-1");

    const status = await getLastStatus(env.storageArea);
    assert.equal(status.outcome, "renamed");
    assert.equal(status.source, "llm");
  });

  it("retries failed set_thread_title calls at most twice (succeeds on 2nd attempt)", async () => {
    let renameAttempts = 0;

    const sseFrames = [
      'event: message\ndata: {"context_uuid":"ctx-retry","read_write_token":"rwt-retry","status":"COMPLETED","final":true,"blocks":[{"type":"WORKFLOW_ITEM_TEXT","payload":{"text_payload":{"variant":"answer","text":"Retry test answer."}}}]}',
      "event: end_of_stream\ndata: {}",
    ];

    const env = createMockEnvironment({
      onPerplexityFetch: async (input) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/rest/sse/perplexity_ask")) {
          return createSyntheticSseResponse(sseFrames, "\n\n");
        }
        if (url.includes("/api/auth/session")) {
          return new Response(JSON.stringify({ user: { id: "u-1" } }), { status: 200 });
        }
        if (url.includes("/rest/thread/set_thread_title")) {
          renameAttempts++;
          if (renameAttempts === 1) {
            return new Response("Gateway Timeout", { status: 504 });
          }
          return new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
      onLlmFetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Transient Failure Recovery Check" } }],
        }),
      }),
    });

    await setApiKey("groq", "gsk_test", env.storageArea);
    installPageScript(env.mockWindow);
    initContentScript({
      win: env.mockWindow,
      chromeObj: env.mockChrome,
      retryDelaysMs: [5, 5],
    });

    await env.mockWindow.fetch("/rest/sse/perplexity_ask", {
      method: "POST",
      body: JSON.stringify({ query_str: "Test transient retry", params: {} }),
    });

    await waitFor(() => renameAttempts === 2);
    const status = await waitFor(async () => {
      const s = await getLastStatus(env.storageArea);
      return s?.outcome === "renamed" ? s : null;
    });
    assert.equal(status.outcome, "renamed");
  });

  it("stops after 3 total attempts (initial + 2 retries) on persistent HTTP 500", async () => {
    let renameAttempts = 0;

    const sseFrames = [
      'event: message\ndata: {"context_uuid":"ctx-fail","read_write_token":"rwt-fail","status":"COMPLETED","final":true,"blocks":[{"type":"WORKFLOW_ITEM_TEXT","payload":{"text_payload":{"variant":"answer","text":"Persistent failure answer."}}}]}',
      "event: end_of_stream\ndata: {}",
    ];

    const env = createMockEnvironment({
      onPerplexityFetch: async (input) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/rest/sse/perplexity_ask")) {
          return createSyntheticSseResponse(sseFrames, "\n\n");
        }
        if (url.includes("/api/auth/session")) {
          return new Response(JSON.stringify({ user: { id: "u-1" } }), { status: 200 });
        }
        if (url.includes("/rest/thread/set_thread_title")) {
          renameAttempts++;
          return new Response("Server Error", { status: 500 });
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
      onLlmFetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Persistent Server Error Test" } }],
        }),
      }),
    });

    await setApiKey("groq", "gsk_test", env.storageArea);
    installPageScript(env.mockWindow);
    initContentScript({
      win: env.mockWindow,
      chromeObj: env.mockChrome,
      retryDelaysMs: [5, 5],
    });

    await env.mockWindow.fetch("/rest/sse/perplexity_ask", {
      method: "POST",
      body: JSON.stringify({ query_str: "Test max retries cap", params: {} }),
    });

    const status = await waitFor(async () => {
      const s = await getLastStatus(env.storageArea);
      return s?.outcome === "failed" ? s : null;
    });
    assert.equal(renameAttempts, 3);
    assert.equal(status.httpStatus, 500);
  });

  it("never overwrites a thread that the user manually renamed via Perplexity UI", async () => {
    let extensionRenameCalls = 0;

    const sseFrames = [
      'event: message\ndata: {"context_uuid":"ctx-user-edited","read_write_token":"rwt-1","status":"COMPLETED","final":true,"blocks":[{"type":"WORKFLOW_ITEM_TEXT","payload":{"text_payload":{"variant":"answer","text":"Answer text."}}}]}',
      "event: end_of_stream\ndata: {}",
    ];

    const env = createMockEnvironment({
      onPerplexityFetch: async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/rest/sse/perplexity_ask")) {
          return createSyntheticSseResponse(sseFrames, "\n\n");
        }
        if (url.includes("/rest/thread/set_thread_title")) {
          const body = JSON.parse(init.body);
          if (body.title !== "My Custom User Title") {
            extensionRenameCalls++;
          }
          return new Response(null, { status: 204 });
        }
        return new Response("{}", { status: 200 });
      },
      onLlmFetch: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Auto Generated Title" } }],
        }),
      }),
    });

    await setApiKey("groq", "gsk_test", env.storageArea);
    installPageScript(env.mockWindow);
    initContentScript({
      win: env.mockWindow,
      chromeObj: env.mockChrome,
      retryDelaysMs: [5, 5],
    });

    // Simulate user manually renaming the thread through Perplexity's UI (calls wrapped window.fetch)
    await env.mockWindow.fetch("/rest/thread/set_thread_title?version=2.18", {
      method: "POST",
      body: JSON.stringify({
        context_uuid: "ctx-user-edited",
        title: "My Custom User Title",
        read_write_token: "rwt-1",
      }),
    });

    // Wait a tick for the user-rename message to register, then finish first answer
    await new Promise((r) => setTimeout(r, 20));

    await env.mockWindow.fetch("/rest/sse/perplexity_ask", {
      method: "POST",
      body: JSON.stringify({ query_str: "Initial question", params: {} }),
    });

    const status = await waitFor(async () => {
      const s = await getLastStatus(env.storageArea);
      return s?.outcome === "skipped" ? s : null;
    });
    assert.equal(status.reason, "already-renamed");
    assert.equal(extensionRenameCalls, 0);
  });

  it("skips follow-up questions in an existing thread without calling LLM or rename", async () => {
    let llmCalls = 0;
    let renameCalls = 0;

    const sseFrames = [
      'event: message\r\ndata: {"context_uuid":"ctx-existing","read_write_token":"rwt-existing","status":"COMPLETED","final":true,"blocks":[{"type":"WORKFLOW_ITEM_TEXT","payload":{"text_payload":{"variant":"answer","text":"Follow-up answer."}}}]}',
      "event: end_of_stream\r\ndata: {}",
    ];

    const env = createMockEnvironment({
      onPerplexityFetch: async (input) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/rest/sse/perplexity_ask")) {
          return createSyntheticSseResponse(sseFrames);
        }
        if (url.includes("/rest/thread/set_thread_title")) {
          renameCalls++;
          return new Response(null, { status: 204 });
        }
        return new Response("{}", { status: 200 });
      },
      onLlmFetch: async () => {
        llmCalls++;
        return { ok: true, status: 200, json: async () => ({}) };
      },
    });

    installPageScript(env.mockWindow);
    initContentScript({
      win: env.mockWindow,
      chromeObj: env.mockChrome,
    });

    await env.mockWindow.fetch("/rest/sse/perplexity_ask", {
      method: "POST",
      body: JSON.stringify({
        query_str: "And how much does that cost?",
        params: { last_backend_uuid: "prev-entry-uuid" },
      }),
    });

    const status = await waitFor(async () => {
      const s = await getLastStatus(env.storageArea);
      return s?.outcome === "skipped" ? s : null;
    });
    assert.equal(status.reason, "follow-up");
    assert.equal(llmCalls, 0);
    assert.equal(renameCalls, 0);
  });

  it("supports test-provider message on service worker and reports missing host permission clearly", async () => {
    const storageArea = createMemoryStorage();
    await setApiKey("groq", "gsk_live_test", storageArea);

    const dispatcherOk = createRuntimeDispatcher({
      storageArea,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Autumn Leaf Pigment Chemistry" } }],
        }),
      }),
    });

    const okRes = await dispatcherOk({
      type: "test-provider",
      provider: "groq",
      model: "openai/gpt-oss-20b",
    });
    assert.equal(okRes.ok, true);
    assert.equal(okRes.title, "Autumn Leaf Pigment Chemistry");

    const dispatcherNoPerm = createRuntimeDispatcher({
      storageArea,
      permissionsApi: { contains: async () => false },
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    const failRes = await dispatcherNoPerm({
      type: "test-provider",
      provider: "groq",
    });
    assert.equal(failRes.ok, false);
    assert.match(failRes.error, /Host permission not granted for https:\/\/api\.groq\.com\/\*/);
  });
});

describe("security & architecture invariants", () => {
  it("keeps getApiKey() strictly confined to src/background/service-worker.js and storage.js", () => {
    const forbiddenDirs = [
      join(process.cwd(), "src/content"),
      join(process.cwd(), "src/page"),
      join(process.cwd(), "src/options"),
      join(process.cwd(), "src/popup"),
      join(process.cwd(), "src/ui"),
    ];
    for (const dir of forbiddenDirs) {
      for (const file of readdirSync(dir)) {
        const src = readFileSync(join(dir, file), "utf8");
        assert.ok(
          !/\bgetApiKey\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")),
          `getApiKey must not be used in ${dir}/${file}`
        );
      }
    }
  });

  it("keeps Perplexity endpoint paths exclusively in src/config/selectors.js", () => {
    const checkFiles = [
      "src/page/inject.js",
      "src/content/content.js",
      "src/content/toast.js",
      "src/background/service-worker.js",
      "src/lib/sse.js",
      "src/lib/perplexity-api.js",
      "src/options/options.js",
      "src/popup/popup.js",
    ];
    for (const rel of checkFiles) {
      const codeOnly = readFileSync(join(process.cwd(), rel), "utf8").replace(
        /\/\*[\s\S]*?\*\/|\/\/.*/g,
        ""
      );
      assert.ok(
        !codeOnly.includes("perplexity_ask") &&
          !codeOnly.includes("set_thread_title") &&
          !codeOnly.includes("/api/auth/session"),
        `Hardcoded Perplexity endpoint found in ${rel}`
      );
    }
  });

  it("validates Chrome Web Store manifest constraints", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "extension/manifest.json"), "utf8")
    );
    assert.equal(manifest.manifest_version, 3);
    assert.ok(manifest.name.length <= 75, "CWS name must be <= 75 chars");
    assert.ok(manifest.description.length <= 132, "CWS description must be <= 132 chars");
    assert.deepEqual(manifest.permissions, ["storage"]);
    for (const size of ["16", "32", "48", "128"]) {
      assert.ok(manifest.icons[size], `Missing icon size ${size}`);
    }
  });

  it("bundled extension/background.js includes reasoning_effort fix", () => {
    const bg = readFileSync(
      join(process.cwd(), "extension/background.js"),
      "utf8"
    );
    assert.ok(bg.includes("reasoning_effort"));
  });
});
