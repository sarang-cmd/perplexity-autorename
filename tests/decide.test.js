import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldRename,
  compileExcludePatterns,
  matchesExcludePattern,
  applyTitlePrefix,
} from "../src/lib/decide.js";

describe("decide: shouldRename", () => {
  it("returns 'disabled' when extension is disabled", () => {
    const res = shouldRename({
      enabled: false,
      question: "What is TLS 1.3?",
      contextUuid: "ctx-1",
    });
    assert.deepEqual(res, { rename: false, reason: "disabled" });
  });

  it("returns 'follow-up' on follow-up or related questions", () => {
    const res = shouldRename({
      enabled: true,
      isFollowUp: true,
      question: "What about QUIC?",
      contextUuid: "ctx-1",
    });
    assert.deepEqual(res, { rename: false, reason: "follow-up" });
  });

  it("returns 'empty-question' when question text is blank", () => {
    const res = shouldRename({
      enabled: true,
      isFollowUp: false,
      question: "   ",
      contextUuid: "ctx-1",
    });
    assert.deepEqual(res, { rename: false, reason: "empty-question" });
  });

  it("returns 'already-renamed' when contextUuid was already renamed or manually edited", () => {
    const res1 = shouldRename({
      enabled: true,
      question: "Explain Raft consensus",
      contextUuid: "ctx-9",
      alreadyRenamedIds: new Set(["ctx-9"]),
    });
    assert.deepEqual(res1, { rename: false, reason: "already-renamed" });

    const res2 = shouldRename({
      enabled: true,
      question: "Explain Raft consensus",
      contextUuid: "ctx-manual",
      userRenamedIds: new Set(["ctx-manual"]),
    });
    assert.deepEqual(res2, { rename: false, reason: "already-renamed" });
  });

  it("returns 'excluded' when question matches any exclude regex", () => {
    const res = shouldRename({
      enabled: true,
      question: "define ephemeral",
      contextUuid: "ctx-2",
      excludePatterns: ["^define\\b", "^translate\\b"],
    });
    assert.deepEqual(res, { rename: false, reason: "excluded" });
  });

  it("returns 'ok' when all checks pass", () => {
    const res = shouldRename({
      enabled: true,
      isFollowUp: false,
      question: "How do solid-state lithium-metal batteries prevent dendrites?",
      contextUuid: "ctx-fresh",
      alreadyRenamedIds: ["ctx-old"],
      excludePatterns: ["^define\\b"],
    });
    assert.deepEqual(res, { rename: true, reason: "ok" });
  });
});

describe("decide: compileExcludePatterns & matchesExcludePattern", () => {
  it("supports regex literals, strips stateful /g flag, and reports invalid patterns safely", () => {
    const { regexes, errors } = compileExcludePatterns([
      "/^secret:/gi",
      "[unclosed-bracket",
      "^weather in ",
    ]);
    assert.equal(regexes.length, 2);
    assert.equal(errors.length, 1);
    assert.equal(matchesExcludePattern("SECRET: launch notes", regexes), true);
    assert.equal(matchesExcludePattern("SECRET: launch notes", regexes), true);
    assert.equal(matchesExcludePattern("Weather in Dresden today", regexes), true);
    assert.equal(matchesExcludePattern("Climate trends in Europe", regexes), false);
  });
});

describe("decide: applyTitlePrefix", () => {
  it("returns clean title unchanged when prefix is empty", () => {
    assert.equal(applyTitlePrefix("Zero Knowledge Proof Basics", ""), "Zero Knowledge Proof Basics");
  });

  it("prepends prefix once and avoids double-prefixing", () => {
    assert.equal(
      applyTitlePrefix("Zero Knowledge Proof Basics", "[Crypto]"),
      "[Crypto] Zero Knowledge Proof Basics"
    );
    assert.equal(
      applyTitlePrefix("[Crypto] Zero Knowledge Proof Basics", "[Crypto]"),
      "[Crypto] Zero Knowledge Proof Basics"
    );
  });
});
