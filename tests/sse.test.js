import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  splitSseFrames,
  parseSseFrame,
  isFinalFrame,
  extractThreadIds,
  extractAnswerText,
  isFollowUpRequest,
  parseAskRequestBody,
  createStreamAssembler,
} from "../src/lib/sse.js";

describe("sse: splitSseFrames", () => {
  it("splits CRLF-delimited HAR frames cleanly", () => {
    const raw =
      'event: message\r\ndata: {"a":1}\r\n\r\nevent: message\r\ndata: {"b":2}\r\n\r\n';
    const { frames, rest } = splitSseFrames(raw);
    assert.equal(frames.length, 2);
    assert.equal(rest, "");
  });

  it("splits LF-delimited frames cleanly", () => {
    const raw = 'event: message\ndata: {"a":1}\n\nevent: end_of_stream\ndata: {}\n\n';
    const { frames, rest } = splitSseFrames(raw);
    assert.equal(frames.length, 2);
    assert.equal(rest, "");
  });

  it("preserves partial frame and split CRLF delimiter across chunk boundaries", () => {
    const chunk1 = 'event: message\r\ndata: {"step":1}\r\n\r';
    const chunk2 = '\nevent: message\r\ndata: {"step":2}\r\n\r\npartial';

    const r1 = splitSseFrames(chunk1);
    assert.equal(r1.frames.length, 0);
    assert.equal(r1.rest, chunk1);

    const r2 = splitSseFrames(r1.rest + chunk2);
    assert.equal(r2.frames.length, 2);
    assert.equal(r2.rest, "partial");
  });
});

describe("sse: parseSseFrame & isFinalFrame", () => {
  it("parses event name and JSON data while ignoring SSE comments", () => {
    const raw =
      ': keep-alive\r\nevent: message\r\ndata: {"status":"IN_PROGRESS","context_uuid":"ctx-1"}';
    const parsed = parseSseFrame(raw);
    assert.equal(parsed.event, "message");
    assert.equal(parsed.data?.context_uuid, "ctx-1");
    assert.equal(isFinalFrame(parsed), false);
  });

  it("detects COMPLETED status, final flags, and end_of_stream event", () => {
    const completed = parseSseFrame(
      'event: message\r\ndata: {"status":"COMPLETED","final_sse_message":true}'
    );
    const endEvt = parseSseFrame("event: end_of_stream\r\ndata: {}");
    assert.equal(isFinalFrame(completed), true);
    assert.equal(isFinalFrame(endEvt), true);
  });
});

describe("sse: extractThreadIds", () => {
  it("extracts snake_case and camelCase thread identifiers", () => {
    const ids1 = extractThreadIds({
      context_uuid: "ctx-abc",
      read_write_token: "rwt-123",
      backend_uuid: "slug-999",
    });
    assert.deepEqual(ids1, {
      contextUuid: "ctx-abc",
      readWriteToken: "rwt-123",
      backendUuid: "slug-999",
    });

    const ids2 = extractThreadIds({
      thread: { contextUUID: "ctx-nested", readWriteToken: "rwt-nested" },
    });
    assert.equal(ids2.contextUuid, "ctx-nested");
    assert.equal(ids2.readWriteToken, "rwt-nested");
  });
});

describe("sse: extractAnswerText", () => {
  it("uses `text` when non-empty and does NOT duplicate `chunks`", () => {
    const payload = {
      blocks: [
        {
          type: "WORKFLOW_ITEM_TEXT",
          payload: {
            text_payload: {
              variant: "answer",
              text: "Photosynthesis converts light energy into chemical energy.",
              chunks: [
                "Photosynthesis converts ",
                "light energy into chemical energy.",
              ],
            },
          },
        },
      ],
    };
    assert.equal(
      extractAnswerText(payload),
      "Photosynthesis converts light energy into chemical energy."
    );
  });

  it("falls back to joining `chunks` when `text` is empty", () => {
    const payload = {
      items: [
        {
          type: "WORKFLOW_ITEM_TEXT",
          payload: {
            text_payload: {
              variant: "answer",
              text: "",
              chunks: ["First part ", "and second part."],
            },
          },
        },
      ],
    };
    assert.equal(extractAnswerText(payload), "First part and second part.");
  });

  it("ignores non-answer WORKFLOW_ITEM_TEXT variants such as thoughts/queries", () => {
    const payload = {
      items: [
        {
          type: "WORKFLOW_ITEM_TEXT",
          payload: {
            text_payload: {
              variant: "thinking",
              text: "Internal reasoning steps...",
            },
          },
        },
        {
          type: "WORKFLOW_ITEM_TEXT",
          payload: {
            text_payload: {
              variant: "answer",
              text: "Visible final answer.",
            },
          },
        },
      ],
    };
    assert.equal(extractAnswerText(payload), "Visible final answer.");
  });
});

describe("sse: parseAskRequestBody & isFollowUpRequest", () => {
  it("treats a fresh question with null/empty last_backend_uuid and 'False' related flag as NOT a follow-up", () => {
    const raw = JSON.stringify({
      query_str: "How does WebAssembly memory isolation work?",
      params: {
        last_backend_uuid: null,
        is_related_query: "False",
      },
    });
    const parsed = parseAskRequestBody(raw);
    assert.equal(parsed.question, "How does WebAssembly memory isolation work?");
    assert.equal(parsed.isFollowUp, false);
  });

  it("detects follow-up when last_backend_uuid is non-empty", () => {
    assert.equal(
      isFollowUpRequest({
        query_str: "Give an example in Rust",
        params: { last_backend_uuid: "entry-uuid-1" },
      }),
      true
    );
  });

  it("detects related query when is_related_query is 'True' or boolean true", () => {
    assert.equal(
      isFollowUpRequest({
        query_str: "How fast is Wasmtime?",
        params: { is_related_query: "True" },
      }),
      true
    );
    assert.equal(
      isFollowUpRequest({
        query_str: "How fast is Wasmtime?",
        params: { is_related_query: true },
      }),
      true
    );
  });
});

describe("sse: createStreamAssembler", () => {
  it("retains read_write_token from frame 1 and final answer from COMPLETED frame", () => {
    const assembler = createStreamAssembler();
    const frame1 =
      'event: message\r\ndata: {"context_uuid":"ctx-42","read_write_token":"tok-secret","backend_uuid":"slug-42","status":"PENDING"}\r\n\r\n';
    const frame2 =
      'event: message\r\ndata: {"context_uuid":"ctx-42","status":"COMPLETED","final":true,"final_sse_message":true,"items":[{"type":"WORKFLOW_ITEM_TEXT","payload":{"text_payload":{"variant":"answer","text":"BGP routes packets between autonomous systems.","chunks":["BGP routes packets ","between autonomous systems."]}}}]}\r\n\r\n';
    const frame3 = "event: end_of_stream\r\ndata: {}\r\n\r\n";

    assert.equal(assembler.push(frame1), null);
    assert.equal(assembler.push(frame2), null);
    const snap = assembler.push(frame3);

    assert.ok(snap);
    assert.equal(snap.contextUuid, "ctx-42");
    assert.equal(snap.readWriteToken, "tok-secret");
    assert.equal(snap.backendUuid, "slug-42");
    assert.equal(snap.answer, "BGP routes packets between autonomous systems.");
    assert.equal(assembler.flush(), null);
  });
});
