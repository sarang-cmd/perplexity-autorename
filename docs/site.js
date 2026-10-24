(function () {
  "use strict";

  const PRESETS = [
    {
      id: "battery",
      label: "1. Solid-State Batteries",
      slug: "solid-state-vs-liquid-electrolytes",
      question:
        "Hey can you explain how solid-state batteries differ from conventional liquid lithium-ion electrolytes and why dendrites form?",
      answer:
        "Solid-state batteries replace flammable organic liquid electrolytes (such as LiPF6 in carbonate solvents) with solid ceramic, sulfide, or polymer conductors. Solid electrolytes enable lithium-metal anodes for higher energy density while mechanically suppressing lithium dendrite propagation when interface impedance is controlled.",
      llmTitle: "Solid-State vs Liquid Lithium Electrolytes",
      source: "LLM · GROQ",
      excluded: false,
    },
    {
      id: "stacktrace",
      label: "2. Pasted Stack Trace",
      slug: "fastapi-sqlalchemy-queuepool-timeout",
      question:
        "Traceback (most recent call last): sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached in my FastAPI async endpoint — how do I fix this?",
      answer:
        "QueuePool exhaustion in async FastAPI apps typically happens when synchronous Session calls block the event loop or async sessions are not yielded inside an async context manager, leaking checked-out connections under concurrent load.",
      llmTitle: "FastAPI Async SQLAlchemy Session Leak",
      source: "LLM · GROQ",
      excluded: false,
    },
    {
      id: "zk",
      label: "3. ZK Cryptography",
      slug: "zk-rollup-proof-batching",
      question:
        "Can you compare zk-rollups vs optimistic rollups specifically around proof batching latency and L1 calldata compression?",
      answer:
        "ZK-rollups amortize validity proof verification costs across thousands of L2 transactions per batch and post state diffs rather than full witness signatures, achieving finality once the SNARK or STARK proof settles on L1 instead of waiting a 7-day challenge window.",
      llmTitle: "Zero-Knowledge Rollup Proof Batching",
      source: "LLM · OPENAI",
      excluded: false,
    },
    {
      id: "excluded",
      label: "4. Excluded (^define\\b)",
      slug: "define-epistemological",
      question: "define epistemological in one short sentence",
      answer:
        "Epistemological relates to the philosophical study of knowledge—specifically its nature, origin, methods of justification, and limits.",
      llmTitle: "",
      source: "SKIPPED",
      excluded: true,
    },
  ];

  const PROVIDERS = [
    {
      id: "groq",
      name: "Groq",
      tag: "DEFAULT",
      tagClass: "ok",
      model: "openai/gpt-oss-20b",
      keyReq: "API key (free tier available)",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      protocol: "OpenAI Chat Completions + Bearer token",
      quirk:
        "Passes max_tokens: 256 and reasoning_effort: \"low\" on gpt-oss-20b / 120b so reasoning tokens never starve message.content.",
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      tag: "FREE MODELS",
      tagClass: "ok",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      keyReq: "Optional on free-tier routes",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      protocol: "OpenAI Chat Completions + Bearer token",
      quirk:
        "Supports hundreds of open and commercial models through one unified endpoint, including :free community models.",
    },
    {
      id: "gemini",
      name: "Google Gemini",
      tag: "FAST",
      tagClass: "cyan",
      model: "gemini-2.5-flash-lite",
      keyReq: "Google AI Studio API key",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/<id>:generateContent",
      protocol: "Native Gemini v1beta + x-goog-api-key header",
      quirk:
        "Sets thinkingConfig: { thinkingBudget: 0 } on Gemini 2.5 Flash variants and filters thought parts automatically.",
    },
    {
      id: "openai",
      name: "OpenAI",
      tag: "OFFICIAL",
      tagClass: "",
      model: "gpt-5-nano",
      keyReq: "OpenAI API key",
      endpoint: "https://api.openai.com/v1/chat/completions",
      protocol: "OpenAI Chat Completions + Bearer token",
      quirk:
        "Uses max_completion_tokens: 256 for modern o-series / GPT-5 nano compatibility instead of legacy max_tokens.",
    },
    {
      id: "anthropic",
      name: "Anthropic",
      tag: "OFFICIAL",
      tagClass: "",
      model: "claude-haiku-4-5",
      keyReq: "Anthropic API key",
      endpoint: "https://api.anthropic.com/v1/messages",
      protocol: "Native Messages API + x-api-key + browser CORS header",
      quirk:
        "Includes anthropic-dangerous-direct-browser-access: true inside the isolated MV3 Service Worker so direct browser calls succeed.",
    },
    {
      id: "mistral",
      name: "Mistral",
      tag: "EU",
      tagClass: "",
      model: "mistral-small-latest",
      keyReq: "Mistral La Plateforme API key",
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      protocol: "OpenAI-compatible Chat Completions",
      quirk: "Low-latency sub-second small model ideal for crisp multilingual or English technical titles.",
    },
    {
      id: "cerebras",
      name: "Cerebras",
      tag: "ULTRA-FAST",
      tagClass: "cyan",
      model: "llama3.1-8b",
      keyReq: "Cerebras Cloud API key",
      endpoint: "https://api.cerebras.ai/v1/chat/completions",
      protocol: "OpenAI-compatible Chat Completions",
      quirk: "Wafer-scale inference returns 3-7 word titles in ~120ms end-to-end.",
    },
    {
      id: "opencode-zen",
      name: "OpenCode Zen",
      tag: "MULTI-ROUTE",
      tagClass: "",
      model: "gpt-5-nano",
      keyReq: "OpenCode Zen API key",
      endpoint: "https://opencode.ai/zen/v1/{responses|messages|chat/completions}",
      protocol: "Automatic model-family protocol router",
      quirk:
        "Automatically dispatches GPT models to /responses, Claude to /messages, Gemini to :generateContent, and others to /chat/completions.",
    },
    {
      id: "sarvam",
      name: "Sarvam",
      tag: "INDIC + EN",
      tagClass: "",
      model: "sarvam-105b",
      keyReq: "Sarvam API subscription key",
      endpoint: "https://api.sarvam.ai/v1/chat/completions",
      protocol: "api-subscription-key + Authorization Bearer",
      quirk: "Sends both api-subscription-key and Bearer headers and strips reasoning traces cleanly.",
    },
    {
      id: "custom",
      name: "Custom / Ollama",
      tag: "LOCAL AI",
      tagClass: "ok",
      model: "llama3.2 / qwen2.5 (editable)",
      keyReq: "Optional (none needed for local Ollama / LM Studio)",
      endpoint: "http://localhost:11434/v1  or  http://127.0.0.1:1234/v1",
      protocol: "Any OpenAI-compatible /v1 or /chat/completions endpoint",
      quirk:
        "Run 100% private local LLM inference on your own GPU/CPU with zero cloud traffic.",
    },
    {
      id: "heuristic",
      name: "Offline Heuristic",
      tag: "0 KEYS",
      tagClass: "warn",
      model: "Built-in deterministic extractor",
      keyReq: "None — works immediately on install",
      endpoint: "In-memory inside extension (0 network requests)",
      protocol: "Stopword-aware technical token extractor",
      quirk:
        "Automatic fallback whenever no API key is saved or an endpoint times out—preserves acronyms & mixed-case identifiers (FastAPI, PostgreSQL, LiPF6).",
    },
  ];

  // Real stopword-aware heuristic from src/lib/title.js for custom user prompts
  const STOPWORDS = new Set([
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "while",
    "what", "which", "who", "whom", "whose", "where", "why", "how", "can", "could",
    "would", "should", "will", "shall", "may", "might", "must", "do", "does", "did",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "them",
    "this", "that", "these", "those", "there", "here", "hey", "hi", "hello", "please",
    "explain", "tell", "give", "show", "help", "write", "make", "create", "find",
    "difference", "between", "about", "into", "from", "with", "without", "for", "to",
    "in", "on", "at", "by", "of", "as", "up", "out", "over", "under"
  ]);

  function computeHeuristicTitle(question) {
    const cleaned = String(question || "")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[`*_#[\](){}<>|\\/~^]+/g, " ")
      .replace(/[?!.,;:"]+$/g, "")
      .trim();
    if (!cleaned) return "New Perplexity Thread";

    const rawTokens = cleaned.split(/\s+/).filter(Boolean);
    const chosen = [];
    for (const tok of rawTokens) {
      const stripped = tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+-]+$/g, "");
      if (!stripped) continue;
      const lower = stripped.toLowerCase();
      if (STOPWORDS.has(lower)) continue;
      const hasInternalCase = /[A-Z]/.test(stripped.slice(1)) || /\d/.test(stripped);
      const formatted = hasInternalCase
        ? stripped
        : stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
      chosen.push(formatted);
      if (chosen.length >= 6) break;
    }

    if (chosen.length < 3) {
      const fallback = rawTokens
        .slice(0, 5)
        .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
      return fallback.join(" ") || "Perplexity Search Summary";
    }
    return chosen.join(" ");
  }

  function applyPrefix(title, prefix) {
    const cleanPrefix = String(prefix || "").trim();
    if (!cleanPrefix) return title;
    if (title.toLowerCase().startsWith(cleanPrefix.toLowerCase())) return title;
    return `${cleanPrefix} ${title}`;
  }

  // --- Simulator Controller ---
  let simTimer = null;
  let activePreset = PRESETS[0];

  const elPresets = document.getElementById("sim-presets");
  const elPromptInput = document.getElementById("sim-custom-q");
  const elPrefixInput = document.getElementById("sim-prefix");
  const elRunBtn = document.getElementById("sim-run-btn");
  const elUrl = document.getElementById("sim-url");
  const elActiveThread = document.getElementById("sim-active-thread");
  const elSimQ = document.getElementById("sim-q");
  const elSimA = document.getElementById("sim-a");
  const elHudToast = document.getElementById("sim-hud-toast");
  const elHudLabel = document.getElementById("sim-hud-label");
  const elHudRight = document.getElementById("sim-hud-right");
  const elHudBody = document.getElementById("sim-hud-body");
  const elNetLog = document.getElementById("sim-net-status");
  const elHttpBadge = document.getElementById("sim-http-badge");

  function clearSimTimer() {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
  }

  function runSimulation(spec) {
    clearSimTimer();

    const rawQ = spec.question.trim();
    const prefix = elPrefixInput ? elPrefixInput.value.trim() : "";
    const truncatedSidebar = rawQ.length > 34 ? rawQ.slice(0, 34) + "…" : rawQ;
    const isExcluded = /^define\b|^translate\b|^(hi|hello|test)\b/i.test(rawQ);

    elUrl.textContent = `https://www.perplexity.ai/search/${spec.slug || "new-thread-stream"}`;
    elActiveThread.className = "sim-thread-item active";
    elActiveThread.textContent = truncatedSidebar;
    elSimQ.textContent = rawQ;
    elSimA.innerHTML = '<span class="sim-cursor"></span>';

    // Phase 1: Watching Stream
    elHudToast.className = "hud-toast";
    elHudLabel.textContent = "WATCHING STREAM_";
    elHudRight.innerHTML =
      '<div class="pixel-spinner spinning" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';
    elHudBody.innerHTML = "Answer streaming — will auto-rename when complete.";
    elNetLog.textContent = "POST /rest/sse/perplexity_ask → Response.body.tee()";
    elHttpBadge.className = "badge cyan";
    elHttpBadge.textContent = "SSE STREAMING";

    const words = spec.answer.split(" ");
    let idx = 0;

    simTimer = setInterval(() => {
      idx += 3;
      if (idx < words.length) {
        elSimA.innerHTML =
          escapeHtml(words.slice(0, idx).join(" ")) + '<span class="sim-cursor"></span>';
        return;
      }

      clearSimTimer();
      elSimA.textContent = spec.answer;

      if (isExcluded) {
        elHudToast.className = "hud-toast skipped";
        elHudLabel.textContent = "SKIPPED BY RULE";
        elHudRight.innerHTML = '<span class="badge warn">REGEX</span>';
        elHudBody.innerHTML =
          'Matched exclude pattern <code>^define\\b</code> — zero tokens used.';
        elNetLog.textContent = "shouldRename() → 'excluded' (set_thread_title not called)";
        elHttpBadge.className = "badge warn";
        elHttpBadge.textContent = "SKIPPED";
        return;
      }

      const baseTitle = spec.llmTitle || computeHeuristicTitle(rawQ);
      const finalTitle = applyPrefix(baseTitle, prefix);
      const badgeLabel = spec.llmTitle ? "LLM" : "HEURISTIC";

      elHudToast.className = "hud-toast renamed";
      elHudLabel.textContent = "✓ THREAD RENAMED";
      elHudRight.innerHTML = `<span class="badge ok">${badgeLabel}</span>`;
      elHudBody.innerHTML = `<div class="hud-title-pill">${escapeHtml(finalTitle)}</div>`;

      elActiveThread.className = "sim-thread-item renamed";
      elActiveThread.textContent = finalTitle;

      elNetLog.textContent = "POST /rest/thread/set_thread_title?version=2.18";
      elHttpBadge.className = "badge ok";
      elHttpBadge.textContent = "HTTP 204 OK";
    }, 65);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (elPresets) {
    PRESETS.forEach((p, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-chip" + (idx === 0 ? " active" : "");
      btn.textContent = p.label;
      btn.addEventListener("click", () => {
        activePreset = p;
        elPresets.querySelectorAll(".preset-chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (elPromptInput) elPromptInput.value = p.question;
        runSimulation(p);
      });
      elPresets.appendChild(btn);
    });

    if (elPromptInput) elPromptInput.value = activePreset.question;
    runSimulation(activePreset);
  }

  if (elRunBtn && elPromptInput) {
    const triggerCustom = () => {
      const customQ = elPromptInput.value.trim();
      if (!customQ) return;
      const matchedPreset = PRESETS.find((p) => p.question.trim() === customQ);
      if (matchedPreset) {
        runSimulation(matchedPreset);
        return;
      }
      if (elPresets) {
        elPresets.querySelectorAll(".preset-chip").forEach((b) => b.classList.remove("active"));
      }
      runSimulation({
        slug: "custom-thread-stream",
        question: customQ,
        answer:
          "First-turn answer stream observed via Response.body.tee(). Once Perplexity emits status: \"COMPLETED\" and end_of_stream, Auto-Rename extracts your 3-7 word topic title and persists it via set_thread_title.",
        llmTitle: "",
      });
    };

    elRunBtn.addEventListener("click", triggerCustom);
    elPromptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        triggerCustom();
      }
    });
    if (elPrefixInput) {
      elPrefixInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerCustom();
        }
      });
    }
  }

  // --- Screenshot Gallery Tabs ---
  const tabBtns = document.querySelectorAll("[data-gallery-tab]");
  const tabPanels = document.querySelectorAll("[data-gallery-panel]");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-gallery-tab");
      tabBtns.forEach((b) => {
        const isMatch = b === btn;
        b.classList.toggle("active", isMatch);
        b.setAttribute("aria-selected", isMatch ? "true" : "false");
      });
      tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.getAttribute("data-gallery-panel") === target);
      });
    });
  });

  // --- 10 Providers + Heuristic Inspector ---
  const elProviderGrid = document.getElementById("provider-grid");
  const elProvName = document.getElementById("prov-detail-name");
  const elProvBadge = document.getElementById("prov-detail-badge");
  const elProvModel = document.getElementById("prov-detail-model");
  const elProvKey = document.getElementById("prov-detail-key");
  const elProvEndpoint = document.getElementById("prov-detail-endpoint");
  const elProvProtocol = document.getElementById("prov-detail-protocol");
  const elProvQuirk = document.getElementById("prov-detail-quirk");

  function selectProvider(p) {
    if (!elProvName) return;
    elProvName.textContent = p.name;
    elProvBadge.className = "badge" + (p.tagClass ? " " + p.tagClass : "");
    elProvBadge.textContent = p.tag;
    elProvModel.textContent = p.model;
    elProvKey.textContent = p.keyReq;
    elProvEndpoint.textContent = p.endpoint;
    elProvProtocol.textContent = p.protocol;
    elProvQuirk.textContent = p.quirk;
  }

  if (elProviderGrid) {
    PROVIDERS.forEach((p, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "provider-btn" + (idx === 0 ? " active" : "");
      btn.innerHTML = `
        <div class="provider-btn-top">
          <span class="provider-name">${escapeHtml(p.name)}</span>
          <span class="badge ${p.tagClass}">${escapeHtml(p.tag)}</span>
        </div>
        <div class="provider-model">${escapeHtml(p.model)}</div>
      `;
      btn.addEventListener("click", () => {
        elProviderGrid
          .querySelectorAll(".provider-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectProvider(p);
      });
      elProviderGrid.appendChild(btn);
    });
    selectProvider(PROVIDERS[0]);
  }

  // --- Copy-to-Clipboard Buttons ---
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy");
      const original = btn.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "COPIED ✓";
      } catch {
        btn.textContent = "SELECT & COPY";
      }
      setTimeout(() => {
        btn.textContent = original;
      }, 1600);
    });
  });
})();
