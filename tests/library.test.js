import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBatchSpec,
  parseLibraryListPage,
  parsePerplexityTimestampMs,
  parseSlugFromUrl,
  parseThreadDetailPayload,
  selectBatchCandidates,
  shouldStopLibraryPagination,
} from "../src/lib/library.js";
import {
  buildListThreadsUrl,
  buildThreadDetailUrl,
  fetchLibraryThreadsPage,
  fetchThreadDetail,
} from "../src/lib/perplexity-api.js";
import { heuristicTitle } from "../src/lib/title.js";
import { generateTitleWithFallback } from "../src/lib/providers/index.js";

const DAY_MS = 86_400_000;

test("parseSlugFromUrl extracts thread slugs from /search/<slug> URLs and rejects non-thread paths", () => {
  assert.equal(
    parseSlugFromUrl("https://www.perplexity.ai/search/how-sqlite-wal-works-9f8a7b?focus=internet#top"),
    "how-sqlite-wal-works-9f8a7b"
  );
  assert.equal(
    parseSlugFromUrl("/search/lithium-ion-cold-weather-xyz/"),
    "lithium-ion-cold-weather-xyz"
  );
  assert.equal(parseSlugFromUrl("https://www.perplexity.ai/"), null);
  assert.equal(parseSlugFromUrl("https://www.perplexity.ai/library"), null);
  assert.equal(parseSlugFromUrl("/search/"), null);
});

test("parsePerplexityTimestampMs treats zoneless Perplexity timestamps as UTC", () => {
  const ms = parsePerplexityTimestampMs("2026-10-25T14:22:10.999999");
  assert.equal(ms, Date.parse("2026-10-25T14:22:10.999Z"));

  const zonedMs = parsePerplexityTimestampMs("2026-10-25T14:22:10.250000+00:00");
  assert.equal(zonedMs, Date.parse("2026-10-25T14:22:10.250Z"));
});

test("parseLibraryListPage parses Perplexity array pages and reads has_next_page from last item", () => {
  const samplePage = [
    {
      context_uuid: "ctx-101",
      slug: "first-thread-slug",
      title: "what is a b-tree index in postgres",
      last_query_datetime: "2026-10-25T12:00:00.123456",
      status: "COMPLETED",
      has_next_page: true,
    },
    {
      context_uuid: "ctx-102",
      slug: "second-thread-slug",
      title: "rust borrow checker lifetime elision",
      last_query_datetime: "2026-10-20T08:30:00.000000",
      status: "COMPLETED",
      has_next_page: false,
    },
  ];

  const parsed = parseLibraryListPage(JSON.stringify(samplePage));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.hasNextPage, false);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].contextUuid, "ctx-101");
  assert.equal(parsed.items[0].slug, "first-thread-slug");
  assert.equal(
    parsed.items[0].updatedAtMs,
    Date.parse("2026-10-25T12:00:00.123Z")
  );
});

test("parseThreadDetailPayload extracts contextUuid, readWriteToken, question, and ask_text answer", () => {
  const rawDetail = {
    read_write_token: "rwt-secret-999",
    entries: [
      {
        uuid: "entry-1",
        context_uuid: "ctx-999",
        backend_uuid: "slug-999",
        thread_title: "why do oled screens burn in",
        query_str: "Why do OLED screens experience burn-in over time?",
        blocks: [
          {
            intended_usage: "sources_answer_mode",
            markdown_block: { answer: "Ignored citation block" },
          },
          {
            intended_usage: "ask_text",
            markdown_block: {
              answer:
                "OLED burn-in happens because organic blue subpixels degrade faster than red and green subpixels under static high-luminance UI elements.",
            },
          },
        ],
      },
    ],
    has_next_page: false,
  };

  const parsed = parseThreadDetailPayload(rawDetail, { slug: "slug-999" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.detail.contextUuid, "ctx-999");
  assert.equal(parsed.detail.readWriteToken, "rwt-secret-999");
  assert.equal(
    parsed.detail.question,
    "Why do OLED screens experience burn-in over time?"
  );
  assert.match(parsed.detail.answer, /organic blue subpixels degrade faster/);
});

test("parseThreadDetailPayload supports numbered ask_text_<n>_markdown blocks when ask_text is absent", () => {
  const rawDetail = {
    context_uuid: "ctx-num-1",
    read_write_token: "rwt-num-1",
    entries: [
      {
        query_str: "Compare TCP cubic vs BBR congestion control",
        blocks: [
          {
            intended_usage: "ask_text_1_markdown",
            markdown_block: { answer: "BBR models bottleneck bandwidth and RTT." },
          },
          {
            intended_usage: "ask_text_0_markdown",
            markdown_block: { answer: "CUBIC uses packet loss as congestion signal." },
          },
        ],
      },
    ],
  };

  const parsed = parseThreadDetailPayload(rawDetail);
  assert.equal(parsed.ok, true);
  assert.equal(
    parsed.detail.answer,
    "CUBIC uses packet loss as congestion signal.\n\nBBR models bottleneck bandwidth and RTT."
  );
});

test("selectBatchCandidates and shouldStopLibraryPagination handle Last 20 Days, Last 30 Days, Past 50 Chats, and All Chats", () => {
  const nowMs = Date.parse("2026-10-26T12:00:00Z");
  const threads = [];
  for (let i = 0; i < 65; i++) {
    threads.push({
      key: `ctx-${i}`,
      contextUuid: `ctx-${i}`,
      slug: `slug-${i}`,
      title: `Thread ${i}`,
      updatedAtMs: nowMs - i * DAY_MS,
    });
  }

  // 1. Last 20 Days
  const spec20d = normalizeBatchSpec({ mode: "days", days: 20, skipAlreadyRenamed: true });
  const res20d = selectBatchCandidates(threads, spec20d, {
    nowMs,
    alreadyRenamedIds: ["ctx-0", "ctx-5"],
    userRenamedIds: ["ctx-2"],
  });
  // Days 0..20 inclusive => 21 threads in scope, minus 3 skipped => 18 toRename
  assert.equal(res20d.scopedTotal, 21);
  assert.equal(res20d.preSkipped, 3);
  assert.equal(res20d.toRename.length, 18);

  // Pagination stop check for Last 20 Days
  assert.equal(
    shouldStopLibraryPagination(threads.slice(0, 20), spec20d, {
      collectedCount: 20,
      nowMs,
    }),
    false
  );
  assert.equal(
    shouldStopLibraryPagination(threads.slice(25, 45), spec20d, {
      collectedCount: 45,
      nowMs,
    }),
    true
  );

  // 2. Last 30 Days
  const spec30d = normalizeBatchSpec({ mode: "days", days: 30, skipAlreadyRenamed: false });
  const res30d = selectBatchCandidates(threads, spec30d, {
    nowMs,
    alreadyRenamedIds: ["ctx-0"],
    userRenamedIds: ["ctx-1"],
  });
  // Days 0..30 inclusive => 31 threads; skipAlreadyRenamed=false includes ctx-0, but ALWAYS skips manual userRenamedIds (ctx-1)
  assert.equal(res30d.scopedTotal, 31);
  assert.equal(res30d.preSkipped, 1);
  assert.equal(res30d.toRename.length, 30);

  // 3. Past 50 Chats
  const spec50 = normalizeBatchSpec({ mode: "count", count: 50, skipAlreadyRenamed: true });
  const res50 = selectBatchCandidates(threads, spec50, { nowMs });
  assert.equal(res50.scopedTotal, 50);
  assert.equal(res50.toRename.length, 50);
  assert.equal(
    shouldStopLibraryPagination(threads.slice(40, 60), spec50, {
      collectedCount: 50,
      nowMs,
    }),
    true
  );

  // 4. All Chats
  const specAll = normalizeBatchSpec({ mode: "all", skipAlreadyRenamed: true });
  const resAll = selectBatchCandidates(threads, specAll, { nowMs });
  assert.equal(resAll.scopedTotal, 65);
  assert.equal(resAll.toRename.length, 65);
});

test("fetchLibraryThreadsPage and fetchThreadDetail hit verified Perplexity REST contracts and flag 401/403 as fatal", async () => {
  const seenCalls = [];
  const mockFetch = async (url, init) => {
    seenCalls.push({ url: String(url), init });
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith("list_ask_threads")) {
      return new Response(
        JSON.stringify([
          {
            context_uuid: "ctx-a",
            slug: "slug-a",
            title: "sample thread",
            last_query_datetime: "2026-10-26T09:00:00.000000",
            has_next_page: false,
          },
        ]),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        context_uuid: "ctx-a",
        read_write_token: "rwt-a",
        entries: [
          {
            query_str: "How does WebGPU compute shader workgroup memory work?",
            blocks: [
              {
                intended_usage: "ask_text",
                markdown_block: { answer: "Workgroup shared memory allows threads in the same workgroup to share fast on-chip SRAM." },
              },
            ],
          },
        ],
      }),
      { status: 200 }
    );
  };

  assert.match(buildListThreadsUrl(), /\?version=2\.18&source=default$/);
  assert.match(buildThreadDetailUrl("slug-a"), /from_first=true/);

  const page = await fetchLibraryThreadsPage({
    offset: 20,
    limit: 20,
    accountId: "acct-77",
    fetchImpl: mockFetch,
  });
  assert.equal(page.ok, true);
  assert.equal(page.items.length, 1);
  assert.equal(seenCalls[0].init.headers["x-pplx-account"], "acct-77");
  assert.deepEqual(JSON.parse(seenCalls[0].init.body), {
    limit: 20,
    offset: 20,
    ascending: false,
    search_term: "",
  });

  const detail = await fetchThreadDetail({
    slug: "slug-a",
    accountId: "acct-77",
    fetchImpl: mockFetch,
  });
  assert.equal(detail.ok, true);
  assert.equal(detail.detail.readWriteToken, "rwt-a");

  const unauthPage = await fetchLibraryThreadsPage({
    fetchImpl: async () => new Response("{}", { status: 401 }),
  });
  assert.equal(unauthPage.ok, false);
  assert.equal(unauthPage.fatal, true);
});

test("regenerate mode passes avoidTitles, bumps LLM temperature to 0.65, and varies offline heuristic titles", async () => {
  let capturedBody = null;
  const mockFetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Subzero Graphite Lithium Plating" } }],
      }),
      { status: 200 }
    );
  };

  const llmRes = await generateTitleWithFallback({
    settings: { provider: "openai", model: "gpt-4.1-nano", titlePrefix: "" },
    apiKey: "sk-test-123",
    question: "Why do lithium-ion batteries lose capacity in freezing weather?",
    answer: "Slowed anode diffusion triggers metallic lithium plating on graphite.",
    avoidTitles: ["Cold Weather Battery Capacity Loss"],
    regenerate: true,
    fetchImpl: mockFetch,
  });

  assert.equal(llmRes.source, "llm");
  assert.equal(llmRes.title, "Subzero Graphite Lithium Plating");
  assert.equal(capturedBody.temperature, 0.65);
  assert.match(
    capturedBody.messages[1].content,
    /Cold Weather Battery Capacity Loss/
  );

  // Offline heuristic regeneration produces distinct non-repeating variations
  const q = "Why do lithium-ion batteries lose capacity faster in freezing weather?";
  const a = "Slowed graphite anode diffusion causes metallic plating and electrolyte impedance.";
  const firstOffline = heuristicTitle(q, a);
  const secondOffline = heuristicTitle(q, a, { avoidTitles: [firstOffline] });
  assert.notEqual(secondOffline.toLowerCase(), firstOffline.toLowerCase());
});
