import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTitle, heuristicTitle } from "../src/lib/title.js";

describe("title: sanitizeTitle", () => {
  it("strips <think>...</think> blocks before extracting the title", () => {
    const raw =
      "<think>\nLet me pick 4-5 clear words summarizing the question.\n</think>\n\"Rust Async Pinning Mechanics.\"";
    assert.equal(sanitizeTitle(raw), "Rust Async Pinning Mechanics");
  });

  it("strips unclosed <think> tags safely (returns empty so caller knows model truncated)", () => {
    const raw = "<think>Still reasoning when max_tokens ran out...";
    assert.equal(sanitizeTitle(raw), "");
  });

  it("removes 'Title:' prefixes, markdown markers, quotes, and trailing punctuation", () => {
    assert.equal(
      sanitizeTitle('Title: "**PostgreSQL MVCC Vacuum Tuning!**"'),
      "PostgreSQL MVCC Vacuum Tuning"
    );
    assert.equal(
      sanitizeTitle("### - Linux eBPF Packet Filtering:"),
      "Linux eBPF Packet Filtering"
    );
  });

  it("truncates titles exceeding 7 words and trims dangling conjunctions", () => {
    const raw =
      "Comparative Analysis of Modern Distributed Consensus Protocols and Fault Tolerance";
    const clean = sanitizeTitle(raw);
    const words = clean.split(" ");
    assert.ok(words.length <= 7);
    assert.ok(!/\band$/i.test(clean));
  });
});

describe("title: heuristicTitle", () => {
  it("produces a 3-7 word title preserving acronyms and mixed-case identifiers", () => {
    const title = heuristicTitle(
      "Can you explain how Chrome MV3 service workers handle WebSockets in FastAPI?"
    );
    const words = title.split(" ");
    assert.ok(words.length >= 3 && words.length <= 7);
    assert.ok(title.includes("MV3"));
    assert.ok(title.includes("FastAPI"));
  });

  it("supplements terse questions using the opening sentence of the answer", () => {
    const title = heuristicTitle(
      "Explain this",
      "Kriging is a geostatistical interpolation method that predicts unknown spatial values."
    );
    const words = title.split(" ");
    assert.ok(words.length >= 3 && words.length <= 7);
    assert.match(title, /Kriging/i);
  });

  it("never returns an empty string even on minimal input", () => {
    assert.equal(heuristicTitle("", ""), "New Search Thread");
  });
});
