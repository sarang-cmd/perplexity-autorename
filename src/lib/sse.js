/**
 * Pure SSE stream parsing and Perplexity stream extraction helpers.
 * Handles both \r\n\r\n (HAR-captured) and \n\n (standard SSE) frame delimiters,
 * chunk boundaries splitting delimiters mid-sequence, final-message detection,
 * deduplicated WORKFLOW_ITEM_TEXT answer extraction, and follow-up detection.
 */

import { PERPLEXITY_CONFIG } from "../config/selectors.js";

const SF = PERPLEXITY_CONFIG.streamFields;
const AF = PERPLEXITY_CONFIG.askRequestFields;

/**
 * Splits an accumulated SSE buffer into complete raw frames and trailing remainder.
 * Safely preserves a trailing '\r' in `rest` so a '\r\n\r\n' boundary split across
 * stream chunks is never mis-split.
 *
 * @param {string} buffer
 * @returns {{ frames: string[], rest: string }}
 */
export function splitSseFrames(buffer) {
  if (typeof buffer !== "string" || buffer.length === 0) {
    return { frames: [], rest: "" };
  }

  // Hold back a trailing \r or \r\n\r in case the next chunk completes \r\n\r\n
  let holdBack = "";
  let working = buffer;
  if (working.endsWith("\r\n\r")) {
    holdBack = "\r\n\r";
    working = working.slice(0, -3);
  } else if (working.endsWith("\n\r")) {
    holdBack = "\n\r";
    working = working.slice(0, -2);
  } else if (working.endsWith("\r")) {
    holdBack = "\r";
    working = working.slice(0, -1);
  }

  const delimiterRegex = /\r?\n\r?\n/g;
  const frames = [];
  let lastIndex = 0;
  let match;

  while ((match = delimiterRegex.exec(working)) !== null) {
    const raw = working.slice(lastIndex, match.index);
    if (raw.length > 0) {
      frames.push(raw);
    }
    lastIndex = match.index + match[0].length;
  }

  const rest = working.slice(lastIndex) + holdBack;
  return { frames, rest };
}

/**
 * Parses a single raw SSE frame into event name, raw data string, and parsed JSON object (if valid).
 *
 * @param {string} rawFrame
 * @returns {{ event: string, rawData: string, data: object | null }}
 */
export function parseSseFrame(rawFrame) {
  if (typeof rawFrame !== "string" || rawFrame.trim().length === 0) {
    return { event: "", rawData: "", data: null };
  }

  const lines = rawFrame.split(/\r?\n/);
  let event = SF.messageEvent;
  let hasExplicitEvent = false;
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(SF.commentPrefix)) {
      continue;
    }
    if (line.startsWith(SF.eventPrefix)) {
      event = line.slice(SF.eventPrefix.length).trim();
      hasExplicitEvent = true;
    } else if (line.startsWith(SF.dataPrefix)) {
      let value = line.slice(SF.dataPrefix.length);
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }
      dataLines.push(value);
    }
  }

  if (!hasExplicitEvent && dataLines.length === 0) {
    return { event: "", rawData: "", data: null };
  }

  const rawData = dataLines.join("\n");
  let data = null;
  if (rawData.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawData);
      if (parsed && typeof parsed === "object") {
        data = parsed;
      }
    } catch {
      data = null;
    }
  }

  return { event, rawData, data };
}

/**
 * Checks whether a parsed JSON payload marks the completed SSE message.
 *
 * @param {object | null} data
 * @returns {boolean}
 */
export function isCompletedMessageData(data) {
  if (!data || typeof data !== "object") {
    return false;
  }
  const isStatusCompleted = data[SF.status] === SF.completedStatus;
  const hasFinalFlag =
    data[SF.final] === true || data[SF.finalSseMessage] === true;
  return Boolean(isStatusCompleted || hasFinalFlag);
}

/**
 * Checks whether a parsed SSE frame represents a final message or end-of-stream marker.
 *
 * @param {{ event: string, data: object | null }} frame
 * @returns {boolean}
 */
export function isFinalFrame(frame) {
  if (!frame || typeof frame !== "object") {
    return false;
  }
  if (frame.event === SF.endEvent) {
    return true;
  }
  return isCompletedMessageData(frame.data);
}

function nonEmptyString(val) {
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

/**
 * Extracts thread identifiers (contextUuid, readWriteToken, backendUuid) from a frame JSON object.
 *
 * @param {object | null} data
 * @returns {{ contextUuid: string | null, readWriteToken: string | null, backendUuid: string | null }}
 */
export function extractThreadIds(data) {
  const empty = { contextUuid: null, readWriteToken: null, backendUuid: null };
  if (!data || typeof data !== "object") {
    return empty;
  }

  let contextUuid =
    nonEmptyString(data[SF.contextUuid]) ||
    nonEmptyString(data[SF.contextUuidAlt]);
  let readWriteToken =
    nonEmptyString(data[SF.readWriteToken]) ||
    nonEmptyString(data[SF.readWriteTokenAlt]);
  let backendUuid =
    nonEmptyString(data[SF.backendUuid]) ||
    nonEmptyString(data[SF.backendUuidAlt]);

  for (const key of SF.nestedContainers) {
    const sub = data[key];
    if (sub && typeof sub === "object") {
      if (!contextUuid) {
        contextUuid =
          nonEmptyString(sub[SF.contextUuid]) ||
          nonEmptyString(sub[SF.contextUuidAlt]);
      }
      if (!readWriteToken) {
        readWriteToken =
          nonEmptyString(sub[SF.readWriteToken]) ||
          nonEmptyString(sub[SF.readWriteTokenAlt]);
      }
      if (!backendUuid) {
        backendUuid =
          nonEmptyString(sub[SF.backendUuid]) ||
          nonEmptyString(sub[SF.backendUuidAlt]);
      }
    }
  }

  return { contextUuid, readWriteToken, backendUuid };
}

/**
 * Recursively collects WORKFLOW_ITEM_TEXT (variant === "answer") items from an object tree.
 */
function collectWorkflowAnswerParts(node, out, seen, depth) {
  if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) {
    return;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      collectWorkflowAnswerParts(item, out, seen, depth + 1);
    }
    return;
  }

  if (node[SF.itemType] === SF.workflowItemText) {
    const tp = node[SF.payload]?.[SF.textPayload];
    if (tp && tp[SF.variant] === SF.answerVariant) {
      // Verified rule from HAR: use `text` when non-empty; ONLY fall back to joining `chunks`
      // because `text` and `chunks` duplicate each other.
      const directText =
        typeof tp[SF.text] === "string" && tp[SF.text].length > 0
          ? tp[SF.text]
          : "";
      if (directText) {
        out.push(directText);
      } else if (Array.isArray(tp[SF.chunks])) {
        const joined = tp[SF.chunks]
          .filter((c) => typeof c === "string")
          .join("");
        if (joined.length > 0) {
          out.push(joined);
        }
      }
      return;
    }
  }

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === "object") {
      collectWorkflowAnswerParts(val, out, seen, depth + 1);
    }
  }
}

/**
 * Extracts the assistant's answer text from a parsed SSE frame payload without duplication.
 *
 * @param {object | null} data
 * @returns {string}
 */
export function extractAnswerText(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const workflowParts = [];
  collectWorkflowAnswerParts(data, workflowParts, new Set(), 0);
  if (workflowParts.length > 0) {
    return workflowParts.join("\n\n").trim();
  }

  // Fallback 1: serialized JSON inside `text` field (used by some Perplexity v2.18 step payloads)
  const rawTextField = data[SF.text];
  if (typeof rawTextField === "string") {
    const trimmed = rawTextField.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const inner = JSON.parse(trimmed);
        const innerWorkflowParts = [];
        collectWorkflowAnswerParts(inner, innerWorkflowParts, new Set(), 0);
        if (innerWorkflowParts.length > 0) {
          return innerWorkflowParts.join("\n\n").trim();
        }
        if (Array.isArray(inner)) {
          for (const step of inner) {
            if (step && step[SF.stepType] === SF.finalStepType) {
              const stepAnswer = step[SF.content]?.[SF.answer];
              if (typeof stepAnswer === "string" && stepAnswer.trim()) {
                try {
                  const parsedStepAnswer = JSON.parse(stepAnswer);
                  if (typeof parsedStepAnswer?.[SF.answer] === "string") {
                    return parsedStepAnswer[SF.answer].trim();
                  }
                } catch {
                  return stepAnswer.trim();
                }
              }
            }
          }
        }
      } catch {
        // Not serialized JSON; ignore
      }
    }
  }

  // Fallback 2: blocks with markdown_block (ask_text)
  if (Array.isArray(data[SF.blocks])) {
    const blockParts = [];
    for (const block of data[SF.blocks]) {
      if (!block || typeof block !== "object") continue;
      const mb = block[SF.markdownBlock];
      if (mb && typeof mb === "object") {
        if (
          block[SF.intendedUsage] &&
          block[SF.intendedUsage] !== SF.askTextUsage
        ) {
          continue;
        }
        if (typeof mb[SF.answer] === "string" && mb[SF.answer].length > 0) {
          blockParts.push(mb[SF.answer]);
        } else if (Array.isArray(mb[SF.chunks])) {
          const joined = mb[SF.chunks]
            .filter((c) => typeof c === "string")
            .join("");
          if (joined) blockParts.push(joined);
        }
      }
    }
    if (blockParts.length > 0) {
      return blockParts.join("\n\n").trim();
    }
  }

  // Fallback 3: direct `answer` string on payload
  if (typeof data[SF.answer] === "string" && data[SF.answer].trim().length > 0) {
    return data[SF.answer].trim();
  }

  return "";
}

/**
 * Determines whether a `/rest/sse/perplexity_ask` request payload is a follow-up or related query.
 * First questions in a new thread have no non-empty `last_backend_uuid` and are not related queries.
 *
 * @param {object | null} body
 * @returns {boolean}
 */
export function isFollowUpRequest(body) {
  if (!body || typeof body !== "object") {
    return false;
  }
  const params =
    body[AF.params] && typeof body[AF.params] === "object"
      ? body[AF.params]
      : {};

  const lastBackend =
    nonEmptyString(params[AF.lastBackendUuid]) ||
    nonEmptyString(body[AF.lastBackendUuid]);
  if (lastBackend) {
    return true;
  }

  const related = params[AF.isRelatedQuery] ?? body[AF.isRelatedQuery];
  if (related === true) {
    return true;
  }
  if (typeof related === "string" && related.trim().toLowerCase() === "true") {
    return true;
  }

  return false;
}

/**
 * Parses the JSON body of a POST `/rest/sse/perplexity_ask` request.
 *
 * @param {string | object | null | undefined} rawBody
 * @returns {{ question: string, isFollowUp: boolean }}
 */
export function parseAskRequestBody(rawBody) {
  let parsed = null;
  if (typeof rawBody === "string" && rawBody.trim().length > 0) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
  } else if (rawBody && typeof rawBody === "object") {
    parsed = rawBody;
  }

  if (!parsed || typeof parsed !== "object") {
    return { question: "", isFollowUp: false };
  }

  const params =
    parsed[AF.params] && typeof parsed[AF.params] === "object"
      ? parsed[AF.params]
      : {};

  const rawQuestion =
    (typeof parsed[AF.queryStr] === "string" && parsed[AF.queryStr]) ||
    (typeof params[AF.queryStr] === "string" && params[AF.queryStr]) ||
    (typeof parsed[AF.fallbackQuery] === "string" &&
      parsed[AF.fallbackQuery]) ||
    "";

  return {
    question: rawQuestion.trim(),
    isFollowUp: isFollowUpRequest(parsed),
  };
}

/**
 * Stateful stream assembler that folds incoming text chunks from `perplexity_ask`
 * into thread IDs, deduplicated answer text, and single-fire completion output.
 */
export function createStreamAssembler() {
  let buffer = "";
  let contextUuid = null;
  let readWriteToken = null;
  let backendUuid = null;
  let latestAnswer = "";
  let sawCompleted = false;
  let sawEndOfStream = false;
  let emitted = false;

  function processRawFrame(rawFrame) {
    const frame = parseSseFrame(rawFrame);
    if (frame.event === SF.endEvent) {
      sawEndOfStream = true;
    }
    if (frame.data) {
      const ids = extractThreadIds(frame.data);
      if (ids.contextUuid) contextUuid = ids.contextUuid;
      if (ids.readWriteToken) readWriteToken = ids.readWriteToken;
      if (ids.backendUuid) backendUuid = ids.backendUuid;

      const text = extractAnswerText(frame.data);
      if (text) {
        latestAnswer = text;
      }
      if (isCompletedMessageData(frame.data)) {
        sawCompleted = true;
      }
    }
  }

  function buildSnapshot() {
    return {
      answer: latestAnswer,
      contextUuid,
      readWriteToken,
      backendUuid,
      completed: sawCompleted || sawEndOfStream,
    };
  }

  return {
    /**
     * Pushes a decoded text chunk into the assembler.
     * Returns the final snapshot immediately if `event: end_of_stream` arrived after content/IDs;
     * otherwise returns null until more chunks or `flush()`.
     *
     * @param {string} chunk
     * @returns { ReturnType<typeof buildSnapshot> | null }
     */
    push(chunk) {
      if (emitted || typeof chunk !== "string" || chunk.length === 0) {
        return null;
      }
      buffer += chunk;
      const { frames, rest } = splitSseFrames(buffer);
      buffer = rest;

      for (const rawFrame of frames) {
        processRawFrame(rawFrame);
      }

      if (sawEndOfStream && (sawCompleted || latestAnswer || contextUuid)) {
        emitted = true;
        return buildSnapshot();
      }
      return null;
    },

    /**
     * Flushes any trailing un-delimited frame at stream EOF and returns the final snapshot
     * if not already emitted and a completed message (or valid answer + thread ID) was observed.
     *
     * @returns { ReturnType<typeof buildSnapshot> | null }
     */
    flush() {
      if (emitted) {
        return null;
      }
      if (buffer.trim().length > 0) {
        processRawFrame(buffer);
        buffer = "";
      }
      if (sawCompleted || sawEndOfStream || (latestAnswer && contextUuid)) {
        emitted = true;
        return buildSnapshot();
      }
      return null;
    },
  };
}
