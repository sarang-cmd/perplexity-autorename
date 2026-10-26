import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const LANDING = path.join(ROOT, "landing-page");

const SITE_URL = "https://perplexity-autorename.vercel.app";
const REPO_URL = "https://github.com/sarang-cmd/perplexity-autorename";
const DOWNLOAD_URL = `${SITE_URL}/?download=1#install`;
const TODAY = "2026-10-26";
const INDEXNOW_KEY = "8f4e2a9c1b7d3e6f5a0c8b2d4e6f1a3c";

const SOFTWARE_LD = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: "Auto-Rename for Perplexity",
  alternateName: [
    "PPX Auto-Rename",
    "Perplexity Auto-Rename Extension",
    "Perplexity Thread Auto-Renamer",
  ],
  applicationCategory: "BrowserApplication",
  applicationSubCategory: "ProductivityExtension",
  operatingSystem: "Chrome, Brave, Arc, Microsoft Edge, Vivaldi, Opera (Chromium Manifest V3)",
  softwareVersion: "0.1.0",
  isAccessibleForFree: true,
  license: "https://opensource.org/licenses/MIT",
  url: `${SITE_URL}/`,
  downloadUrl: `${SITE_URL}/releases/auto-rename-for-perplexity-v0.1.0.zip`,
  installUrl: DOWNLOAD_URL,
  codeRepository: REPO_URL,
  screenshot: [
    `${SITE_URL}/assets/screenshots/02-toast-renamed.png`,
    `${SITE_URL}/assets/screenshots/03-toolbar-popup.png`,
    `${SITE_URL}/assets/screenshots/04-settings-full.png`,
  ],
  featureList: [
    "Automatically renames new Perplexity.ai threads to crisp 3-7 word titles after the first answer streams",
    "Supports 10 LLM providers (Groq, OpenRouter, Gemini, OpenAI, Anthropic, Mistral, DeepSeek, Sarvam, OpenCode Zen, Ollama)",
    "100% offline zero-key heuristic fallback title generator",
    "Optional custom title prefixes (e.g. [Research], [Bug]) and regex exclude patterns",
    "Isolated Shadow-DOM pixel HUD toaster notification on perplexity.ai",
    "Never overwrites manual thread edits or follow-up questions",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  author: {
    "@type": "Person",
    name: "sarang-cmd",
    url: "https://github.com/sarang-cmd",
  },
};

export const GUIDES = [
  {
    slug: "fix-perplexity-thread-titles",
    badge: "POPULAR FIX",
    badgeClass: "ok",
    shortTitle: "Fix Messy Perplexity Thread Titles",
    title: "How to Fix Messy or Cut-Off Perplexity Thread Titles Automatically (2026)",
    h1: 'HOW TO FIX MESSY OR CUT-OFF <span class="accent">PERPLEXITY THREAD TITLES</span> AUTOMATICALLY',
    description:
      "Tired of Perplexity.ai using your raw prompt, stack trace, or truncated paragraph as the thread title? Fix Perplexity Library titles automatically in 60 seconds with Auto-Rename for Perplexity.",
    lead:
      "By default, Perplexity.ai copies the first words of your prompt directly into your Library sidebar—turning pasted stack traces, code blocks, and detailed questions into unreadable titles. Here is how to fix it automatically on every new thread.",
    quickAnswer:
      'To fix messy or cut-off thread titles on Perplexity.ai, install the free open-source <a href="../index.html"><strong>Auto-Rename for Perplexity</strong></a> Chrome/Chromium extension (<a href="https://perplexity-autorename.vercel.app">perplexity-autorename.vercel.app</a>). It watches the first answer stream on each new Perplexity thread and automatically renames the thread to a clean <strong>3–7 word summary title</strong> using Groq, Gemini, OpenAI, local Ollama, or a zero-key offline mode—works immediately via 60-second unpacked install even without the Chrome Web Store.',
    schemaType: "HowTo",
    howToSteps: [
      {
        name: "Download Auto-Rename for Perplexity (.zip)",
        text: "Download auto-rename-for-perplexity-v0.1.0.zip from perplexity-autorename.vercel.app and extract the folder on your computer.",
      },
      {
        name: "Load unpacked in your Chromium browser",
        text: "Open chrome://extensions (or brave://extensions, arc://extensions, edge://extensions), enable Developer mode, click Load unpacked, and select the extracted extension folder.",
      },
      {
        name: "Choose offline mode or add an optional LLM key",
        text: "Use it immediately with zero API key via the built-in offline title generator, or paste a free Groq / Gemini / OpenRouter key or local Ollama URL in the toolbar popup.",
      },
      {
        name: "Ask any new question on perplexity.ai",
        text: "Start a new Perplexity search. Once the first answer finishes streaming, the extension automatically saves a crisp 3–7 word thread title to your Perplexity Library.",
      },
    ],
    sectionsHtml: `
      <section class="guide-section">
        <h2>Why Are Perplexity.ai Thread Titles So Messy?</h2>
        <p>
          Unlike ChatGPT or Claude—which run a background title-generation pass after your first exchange—<strong>Perplexity.ai uses your literal opening prompt string</strong> as the thread title in your Library and browser history. That works fine when you type a three-word lookup, but breaks down immediately in real research and engineering workflows:
        </p>
        <ul>
          <li><strong>Pasted stack traces &amp; compiler errors:</strong> Every debugging thread starts with <code>Traceback (most recent call last)...</code> or <code>TypeError: Cannot read properties of...</code>, making ten different bug threads look identical in your sidebar.</li>
          <li><strong>Polite conversational lead-ins:</strong> Prompts starting with <em>"Hey can you explain the difference between..."</em> waste the entire visible sidebar width on filler words before the actual topic appears.</li>
          <li><strong>Multi-constraint prompts &amp; code snippets:</strong> System context, SQL queries, or pasted paper abstracts get chopped off mid-sentence.</li>
        </ul>

        <div class="seo-table-wrap">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Default Perplexity Sidebar Title</th>
                <th>After Auto-Rename for Perplexity (3–7 Words)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Python Debugging</strong></td>
                <td><code>Traceback (most recent call last): sqlalchemy.exc...</code></td>
                <td><strong>FastAPI Async SQLAlchemy Session Leak</strong></td>
              </tr>
              <tr>
                <td><strong>Battery Research</strong></td>
                <td><code>Hey can you explain how solid-state batteries differ...</code></td>
                <td><strong>Solid-State vs Liquid Lithium Electrolytes</strong></td>
              </tr>
              <tr>
                <td><strong>Database Tuning</strong></td>
                <td><code>SELECT * FROM orders WHERE created_at &gt; NOW() - ...</code></td>
                <td><strong>PostgreSQL Composite Index Range Scan</strong></td>
              </tr>
              <tr>
                <td><strong>Distributed Systems</strong></td>
                <td><code>Can you compare zk-rollups vs optimistic rollups...</code></td>
                <td><strong>Zero-Knowledge Rollup Proof Batching</strong></td>
              </tr>
              <tr>
                <td><strong>Frontend Graphics</strong></td>
                <td><code>I am getting a validation error in WGSL compute...</code></td>
                <td><strong>WebGPU Compute Shader Memory Layout</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="guide-section">
        <h2>How Auto-Rename for Perplexity Fixes It Without Touching Page Layout</h2>
        <p>
          <strong>Auto-Rename for Perplexity</strong> is a lightweight, MIT-licensed Manifest V3 extension built specifically for <code>https://www.perplexity.ai/*</code>. Instead of scraping brittle DOM classes that break whenever Perplexity updates its frontend, it observes the first-turn answer stream cleanly at the network layer:
        </p>
        <ol>
          <li><strong>Non-blocking stream clone:</strong> When you submit a brand-new question, the extension clones Perplexity’s Server-Sent Events stream via <code>Response.body.tee()</code> with zero latency added to your answer.</li>
          <li><strong>Context-aware 3–7 word summary:</strong> As soon as Perplexity emits <code>status: "COMPLETED"</code>, both your opening question (up to 600 chars) and the completed answer excerpt (up to 1,200 chars) are summarized into a specific 3–7 word title—either by your chosen LLM provider or the built-in offline heuristic.</li>
          <li><strong>Official persistence (<code>HTTP 204</code>):</strong> The extension calls Perplexity’s own rename endpoint so your clean title is saved permanently across your Perplexity Library, web sidebar, and mobile app sync.</li>
        </ol>

        <figure class="guide-shot">
          <img
            src="../assets/screenshots/02-toast-renamed.png"
            width="748"
            height="268"
            loading="lazy"
            alt="Auto-Rename for Perplexity bottom-right HUD confirmation toast showing Solid-State vs Liquid Lithium Electrolytes"
          />
          <figcaption>Real capture: isolated Shadow-DOM confirmation toast on perplexity.ai once the thread title is saved.</figcaption>
        </figure>
      </section>

      <section class="guide-section">
        <h2>60-Second Fix (Works Before Chrome Web Store Listing)</h2>
        <p>
          Auto-Rename for Perplexity is 100% free and open source on <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub (<code>sarang-cmd/perplexity-autorename</code>)</a>. While Chrome Web Store publication is pending, you can load the prebuilt unpacked release in under a minute on Chrome, Brave, Arc, Edge, or Vivaldi:
        </p>
        <ol>
          <li>Click <strong>⬇ Download Extension .zip</strong> on this page to save <code>auto-rename-for-perplexity-v0.1.0.zip</code>, then unzip it.</li>
          <li>Navigate to <code>chrome://extensions</code> (or <code>brave://extensions</code> / <code>arc://extensions</code> / <code>edge://extensions</code>) and toggle <strong>Developer mode</strong> on.</li>
          <li>Click <strong>Load unpacked</strong> and select the unzipped folder.</li>
          <li>Optional: click the pixel <code>P_</code> icon in your toolbar to add a free <a href="../free-groq-ollama-setup/">Groq, Gemini, OpenRouter, or local Ollama</a> configuration—or leave the API key blank to use instant offline mode.</li>
        </ol>
        <p>
          Need browser-specific screenshots and update tips? Follow the full <a href="../install-chrome-brave-arc-edge/">Chrome, Brave, Arc &amp; Edge unpacked install guide</a>.
        </p>
      </section>
    `,
    faqs: [
      {
        q: "Why does Perplexity cut off my thread titles instead of summarizing them?",
        a: "Perplexity defaults to naming each thread after the raw text of your first query. Long questions, pasted error logs, or conversational intros get truncated in the Library sidebar unless you manually click Rename or run Auto-Rename for Perplexity.",
      },
      {
        q: "Does Auto-Rename for Perplexity work even though it is not on the Chrome Web Store yet?",
        a: "Yes. Every Chromium browser (Chrome, Brave, Arc, Edge, Vivaldi) natively supports loading unpacked Manifest V3 extensions in Developer Mode. Download the prebuilt ZIP from perplexity-autorename.vercel.app, unzip it, and click Load unpacked on chrome://extensions.",
      },
      {
        q: "Will this overwrite threads I already renamed by hand?",
        a: "Never. Auto-Rename only runs on the first answer of a brand-new thread, skips all follow-up turns, and permanently locks out auto-renaming on any thread you edit manually.",
      },
    ],
  },

  {
    slug: "organize-perplexity-library",
    badge: "WORKFLOW GUIDE",
    badgeClass: "cyan",
    shortTitle: "Organize Perplexity Library & History",
    title: "How to Organize Perplexity Library & Search History (Prefixes, Regex & Auto-Titles)",
    h1: 'HOW TO ORGANIZE YOUR <span class="accent">PERPLEXITY LIBRARY</span> &amp; SEARCH HISTORY',
    description:
      "Turn a cluttered Perplexity.ai Library into a searchable knowledge base using automatic 3–7 word titles, custom project prefixes like [Research] or [Bug], and regex exclude rules.",
    lead:
      "Once you pass a few hundred Perplexity searches, finding an answer from two weeks ago becomes frustrating when every thread starts with 'Can you explain...' or 'What is the best...'. Here is a repeatable system for keeping your Perplexity Library clean.",
    quickAnswer:
      'You can organize your Perplexity.ai Library automatically with <a href="../index.html"><strong>Auto-Rename for Perplexity</strong></a> by combining three built-in features: <strong>3–7 word semantic auto-titling</strong> after the first answer streams, <strong>custom title prefixes</strong> (such as <code>[Research]</code> or <code>[Client]</code>) for instant visual grouping, and <strong>regex exclude rules</strong> (like <code>^define\\b</code>) so quick dictionary or translation lookups are never renamed.',
    schemaType: "TechArticle",
    sectionsHtml: `
      <section class="guide-section">
        <h2>3 Layers of a Clean Perplexity.ai Library</h2>
        <p>
          Perplexity Spaces are great for grouping curated collections, but 90% of daily searches happen directly from the home bar or omnibox and land straight in your chronological <strong>Library</strong>. Combining Perplexity’s built-in Spaces with automatic thread naming solves daily clutter without manual upkeep:
        </p>
        <ul>
          <li><strong>Layer 1 — Noun-phrase 3–7 word titles:</strong> Strip conversational filler (<em>"Hey please help me understand..."</em>) and preserve technical identifiers, acronyms, error codes, and proper nouns (e.g., <code>PostgreSQL MVCC Autovacuum Tuning</code>).</li>
          <li><strong>Layer 2 — Optional Title Prefixes:</strong> Prepend a tag such as <code>[Thesis]</code>, <code>[Backend]</code>, or <code>[Tax]</code> from the toolbar popup during focused research sprints so related threads cluster visually in your sidebar.</li>
          <li><strong>Layer 3 — Regex Exclude Rules:</strong> Keep one-off throwaway queries (definitions, translations, quick sanity checks) from burning LLM tokens or cluttering your rename history.</li>
        </ul>
      </section>

      <section class="guide-section">
        <h2>Recommended Regex Exclude Patterns for Daily Use</h2>
        <p>
          In Auto-Rename’s Settings page (<code>options.html</code>), each line in <strong>Exclude Patterns</strong> is compiled as a case-insensitive regular expression tested against your opening question before any LLM request is made:
        </p>
        <div class="seo-table-wrap">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Regex Pattern</th>
                <th>What It Skips</th>
                <th>Why It Helps</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>^define\\b</code></td>
                <td><em>"define epistemological"</em></td>
                <td>Short two-word definitions are already self-descriptive.</td>
              </tr>
              <tr>
                <td><code>^translate\\b</code></td>
                <td><em>"translate guten abend to english"</em></td>
                <td>Avoids renaming disposable translation checks.</td>
              </tr>
              <tr>
                <td><code>^(hi|hello|test)\\b</code></td>
                <td><em>"test"</em>, <em>"hello"</em></td>
                <td>Skips connectivity or prompt warm-up messages.</td>
              </tr>
              <tr>
                <td><code>^weather\\b</code></td>
                <td><em>"weather in Dresden tomorrow"</em></td>
                <td>Leaves ephemeral local lookups untouched.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <figure class="guide-shot">
          <img
            src="../assets/screenshots/04-settings-full.png"
            width="1280"
            height="1570"
            loading="lazy"
            alt="Auto-Rename for Perplexity full settings page showing prefix input, regex exclude patterns, and recent rename history"
          />
          <figcaption>Full Settings view: configure prefixes, per-line regex exclusions, and inspect your local rename log.</figcaption>
        </figure>
      </section>

      <section class="guide-section">
        <h2>Switching Prefixes Fast from the Toolbar Popup</h2>
        <p>
          You don’t need to open the full Options page when switching tasks. Click the extension’s pixel <code>P_</code> toolbar icon to toggle auto-renaming on/off, toggle the bottom-right HUD toaster, or set a temporary <strong>Title Prefix</strong> (for example <code>[Paper Review]</code>) in two seconds. Auto-Rename automatically prevents double-prefixing if the model already includes your tag.
        </p>
      </section>
    `,
    faqs: [
      {
        q: "Do renamed titles sync to the Perplexity mobile app and Library search?",
        a: "Yes. Because Auto-Rename updates the thread via Perplexity's own server-side title endpoint (HTTP 204), the clean 3–7 word title persists across web reloads, Library search, and mobile devices signed into your Perplexity account.",
      },
      {
        q: "What happens if I type an invalid regular expression in Exclude Patterns?",
        a: "Auto-Rename compiles each regex safely inside a guard and ignores malformed expressions without crashing or blocking valid patterns.",
      },
      {
        q: "Does Auto-Rename touch old threads in my Perplexity Library?",
        a: "No. It only names new threads at the moment their first answer finishes streaming, so your existing archived threads and manually curated titles are never modified.",
      },
    ],
  },

  {
    slug: "install-chrome-brave-arc-edge",
    badge: "INSTALL GUIDE",
    badgeClass: "ok",
    shortTitle: "Install on Chrome, Brave, Arc & Edge",
    title: "Install Auto-Rename for Perplexity on Chrome, Brave, Arc & Edge (No Web Store Needed)",
    h1: 'INSTALL ON <span class="accent">CHROME, BRAVE, ARC &amp; EDGE</span> IN 60 SECONDS',
    description:
      "Step-by-step unpacked installation guide for Auto-Rename for Perplexity across Google Chrome, Brave, Arc, Microsoft Edge, and Vivaldi—no Chrome Web Store account or Node.js required.",
    lead:
      "Auto-Rename for Perplexity is distributed directly as an open-source, prebuilt Manifest V3 release ZIP while Chrome Web Store registration is on hold. Loading it unpacked takes under 60 seconds in any Chromium browser.",
    quickAnswer:
      'To install <strong>Auto-Rename for Perplexity</strong> without the Chrome Web Store, download <code>auto-rename-for-perplexity-v0.1.0.zip</code> from <a href="https://perplexity-autorename.vercel.app">perplexity-autorename.vercel.app</a>, extract the ZIP to a permanent folder, open <code>chrome://extensions</code> (or <code>brave://extensions</code>, <code>arc://extensions</code>, <code>edge://extensions</code>), turn on <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the extracted folder containing <code>manifest.json</code>.',
    schemaType: "HowTo",
    howToSteps: [
      {
        name: "Download and unzip the release archive",
        text: "Click Download .ZIP on perplexity-autorename.vercel.app to get auto-rename-for-perplexity-v0.1.0.zip, then extract it to a permanent folder such as ~/Extensions/perplexity-autorename.",
      },
      {
        name: "Open your browser's Extensions management page",
        text: "Visit chrome://extensions in Chrome, brave://extensions in Brave, arc://extensions in Arc, or edge://extensions in Microsoft Edge.",
      },
      {
        name: "Enable Developer mode",
        text: "Flip the Developer mode switch in the top-right corner (or bottom-left sidebar in Microsoft Edge).",
      },
      {
        name: "Click Load unpacked and select the unzipped folder",
        text: "Choose the folder that directly contains manifest.json. Pin the pixel P_ icon in your browser toolbar for one-click access.",
      },
    ],
    sectionsHtml: `
      <section class="guide-section">
        <h2>Browser-by-Browser Extensions URL &amp; Developer Mode Location</h2>
        <p>
          Every Chromium-based desktop browser uses the exact same Manifest V3 extension engine under the hood—only the settings URL and toggle placement differ slightly:
        </p>
        <div class="seo-table-wrap">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Browser</th>
                <th>Extensions URL</th>
                <th>Where to Toggle Developer Mode</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Google Chrome</strong></td>
                <td><code>chrome://extensions</code></td>
                <td>Top-right toggle switch → click <strong>Load unpacked</strong> (top-left).</td>
              </tr>
              <tr>
                <td><strong>Brave Browser</strong></td>
                <td><code>brave://extensions</code></td>
                <td>Top-right toggle switch → click <strong>Load unpacked</strong> (top-left).</td>
              </tr>
              <tr>
                <td><strong>Arc Browser</strong></td>
                <td><code>arc://extensions</code></td>
                <td>Top-right toggle switch (or <code>Cmd/Ctrl + T</code> → <em>Manage Extensions</em>) → <strong>Load unpacked</strong>.</td>
              </tr>
              <tr>
                <td><strong>Microsoft Edge</strong></td>
                <td><code>edge://extensions</code></td>
                <td>Left sidebar toggle labeled <strong>Developer mode</strong> → click <strong>Load unpacked</strong>.</td>
              </tr>
              <tr>
                <td><strong>Vivaldi / Opera</strong></td>
                <td><code>vivaldi://extensions</code></td>
                <td>Top-right <strong>Developer mode</strong> toggle → <strong>Load unpacked</strong>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="guide-section">
        <h2>Important Tip: Keep the Unzipped Folder in a Permanent Spot</h2>
        <p>
          When you load an unpacked extension in Chromium, the browser reads files from that directory on launch rather than copying them into an internal <code>.crx</code> archive. Before clicking <strong>Load unpacked</strong>, move the unzipped folder out of <code>Downloads</code> into a permanent location like <code>~/Extensions/auto-rename-for-perplexity</code> or <code>C:\\Extensions\\auto-rename-for-perplexity</code> so you don’t accidentally delete it later.
        </p>
        <h3>Prefer Building from Source?</h3>
        <p>
          If you want to audit every line of code and compile the 5 bundles yourself with <code>esbuild</code> (Node.js 20+), clone the MIT repository directly:
        </p>
        <div class="code-block">
          <div class="code-block-head">
            <span>TERMINAL</span>
            <button
              type="button"
              class="copy-btn"
              data-copy="git clone https://github.com/sarang-cmd/perplexity-autorename.git&#10;cd perplexity-autorename&#10;npm install&#10;npm run build &amp;&amp; npm test"
            >
              COPY
            </button>
          </div>
          <pre><code>git clone https://github.com/sarang-cmd/perplexity-autorename.git
cd perplexity-autorename
npm install
npm run build &amp;&amp; npm test</code></pre>
        </div>
        <p style="margin-top: 12px">
          Then point <strong>Load unpacked</strong> at the compiled <code>extension/</code> subdirectory inside the repo.
        </p>
      </section>

      <section class="guide-section">
        <h2>Auditable Permissions: Why Minimal MV3 Permissions Matter</h2>
        <p>
          Many third-party AI browser extensions request blanket <code>&lt;all_urls&gt;</code> access on install. Auto-Rename for Perplexity requests only <code>storage</code> and <code>https://www.perplexity.ai/*</code> at install time. Network access to your chosen LLM endpoint (for example <code>https://api.groq.com/*</code>) uses Chrome’s <code>optional_host_permissions</code> and is requested <strong>only</strong> for the single provider you actively select.
        </p>
      </section>
    `,
    faqs: [
      {
        q: "Is it safe to install an unpacked Chrome extension from GitHub?",
        a: "Unpacked extensions let you read every file directly before loading. Auto-Rename for Perplexity has zero external runtime scripts, zero analytics/telemetry servers, runs 53 automated tests, and isolates API keys strictly inside the MV3 Service Worker.",
      },
      {
        q: "How do I update the unpacked extension when a new version comes out?",
        a: "Extract the new release files over your existing folder (or git pull && npm run build if cloned from GitHub) and click the Reload icon on chrome://extensions. Your saved settings, API keys, and rename history in chrome.storage.local are preserved.",
      },
      {
        q: "Do I need to reload open perplexity.ai tabs right after installing?",
        a: "Yes—refresh any already-open perplexity.ai tab once after clicking Load unpacked so Chrome attaches the MV3 content and page scripts to that tab.",
      },
    ],
  },

  {
    slug: "free-groq-ollama-setup",
    badge: "10 PROVIDERS + OFFLINE",
    badgeClass: "ok",
    shortTitle: "Free Groq, Gemini & Local Ollama Setup",
    title: "Free & Local AI Setup for Perplexity Auto-Rename: Groq, Gemini, Ollama & Offline Mode",
    h1: 'FREE &amp; LOCAL SETUP: <span class="accent">GROQ, GEMINI, OLLAMA</span> &amp; OFFLINE MODE',
    description:
      "Compare all 10 supported LLM providers plus zero-key offline mode in Auto-Rename for Perplexity—including free Groq (gpt-oss-20b), Gemini 2.5 Flash, OpenRouter :free, and 100% local Ollama.",
    lead:
      "Generating a 3–7 word thread title uses fewer than 500 input tokens per new search—meaning you can run Auto-Rename for Perplexity completely free using Groq, Gemini, OpenRouter free models, local Ollama, or the built-in zero-key heuristic.",
    quickAnswer:
      '<strong>Auto-Rename for Perplexity</strong> works for <strong>$0/month</strong> in four ways: (1) <strong>Zero-key Offline Mode</strong> works immediately on install with no API key or network calls; (2) <strong>Groq</strong> (default <code>openai/gpt-oss-20b</code>) generates titles in ~150–250 ms on its free tier; (3) <strong>Google Gemini 2.5 Flash</strong> and <strong>OpenRouter <code>:free</code></strong> models offer generous free API tiers; and (4) <strong>Ollama</strong> runs 100% locally on <code>127.0.0.1:11434</code>.',
    schemaType: "TechArticle",
    sectionsHtml: `
      <section class="guide-section">
        <h2>All 10 Supported LLM Providers + Offline Heuristic Compared</h2>
        <p>
          Every provider adapter in Auto-Rename for Perplexity is tuned specifically for short title generation—including automatic fixes for 2026 reasoning models so thinking tokens never truncate your 3–7 word title:
        </p>
        <div class="seo-table-wrap">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Default Model</th>
                <th>Free / Local Option</th>
                <th>Built-In Protocol Optimization</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Offline Heuristic</strong></td>
                <td>Built-in <code>heuristicTitle()</code></td>
                <td>100% Free &amp; Offline (No Key)</td>
                <td>Instant local noun-phrase extraction preserving acronyms &amp; mixed-case identifiers; automatic fallback if an API call fails.</td>
              </tr>
              <tr>
                <td><strong>Groq (Default)</strong></td>
                <td><code>openai/gpt-oss-20b</code></td>
                <td>Free developer tier</td>
                <td>Sends <code>reasoning_effort: "low"</code> + <code>max_tokens: 256</code> for ultra-low latency (~200 ms) without empty reasoning truncation.</td>
              </tr>
              <tr>
                <td><strong>Google Gemini</strong></td>
                <td><code>gemini-2.5-flash</code></td>
                <td>Free tier in Google AI Studio</td>
                <td>Sets <code>thinkingBudget: 0</code> on 2.5 Flash and filters thought parts automatically.</td>
              </tr>
              <tr>
                <td><strong>OpenRouter</strong></td>
                <td>Any OpenRouter model ID</td>
                <td>Supports <code>*:free</code> models</td>
                <td>Unified OpenAI-compatible gateway across hundreds of open and frontier models.</td>
              </tr>
              <tr>
                <td><strong>Ollama (Local)</strong></td>
                <td><code>llama3.2:3b</code> / <code>qwen2.5:3b</code></td>
                <td>100% Local on your machine</td>
                <td>Calls <code>http://127.0.0.1:11434</code> directly from your browser—zero cloud data leaves your computer.</td>
              </tr>
              <tr>
                <td><strong>OpenAI</strong></td>
                <td><code>gpt-4o-mini</code> / <code>gpt-5-mini</code></td>
                <td>Pay-as-you-go (~$0.01 per 100+ threads)</td>
                <td>Uses <code>max_completion_tokens: 256</code> for full compatibility with modern OpenAI models.</td>
              </tr>
              <tr>
                <td><strong>Anthropic</strong></td>
                <td><code>claude-haiku-4-5</code></td>
                <td>Pay-as-you-go</td>
                <td>Direct browser MV3 support from the isolated Service Worker with zero proxy server.</td>
              </tr>
              <tr>
                <td><strong>Mistral / DeepSeek / Sarvam / OpenCode Zen</strong></td>
                <td><code>mistral-small</code>, <code>deepseek-chat</code>, <code>sarvam-105b</code>, Zen routing</td>
                <td>Provider free credits / PAYG</td>
                <td>Dedicated adapters including multi-protocol routing for OpenCode Zen and dual header auth for Sarvam.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <figure class="guide-shot">
          <img
            src="../assets/screenshots/03-toolbar-popup.png"
            width="380"
            height="701"
            loading="lazy"
            style="max-width: 360px; margin: 0 auto"
            alt="Auto-Rename for Perplexity toolbar popup showing Groq provider and openai/gpt-oss-20b model configuration"
          />
          <figcaption>Toolbar quick-settings popup: switch providers, paste a key, and click TEST LLM in seconds.</figcaption>
        </figure>
      </section>

      <section class="guide-section">
        <h2>Fastest Cloud Setup: Groq in 30 Seconds</h2>
        <ol>
          <li>Create a free API key at <code>console.groq.com/keys</code>.</li>
          <li>Click the Auto-Rename <code>P_</code> icon in Chrome, leave <strong>Provider</strong> on <code>Groq</code> and <strong>Model</strong> on <code>openai/gpt-oss-20b</code>.</li>
          <li>Paste your key, click <strong>SAVE</strong>, approve the one-time <code>api.groq.com</code> host permission prompt, and click <strong>TEST LLM</strong>.</li>
        </ol>

        <h3>100% Private Local Setup: Ollama</h3>
        <p>
          To run completely offline with a local neural model, start Ollama with Chrome extension origin access enabled so Chromium’s MV3 Service Worker is allowed to POST to localhost:
        </p>
        <div class="code-block">
          <div class="code-block-head">
            <span>MACOS / LINUX TERMINAL</span>
            <button
              type="button"
              class="copy-btn"
              data-copy='OLLAMA_ORIGINS="chrome-extension://*" ollama serve'
            >
              COPY
            </button>
          </div>
          <pre><code>OLLAMA_ORIGINS="chrome-extension://*" ollama serve</code></pre>
        </div>
      </section>
    `,
    faqs: [
      {
        q: "Do I have to enter an API key to use Auto-Rename for Perplexity?",
        a: "No. If you leave the API key blank (or if a provider is temporarily unreachable), Auto-Rename automatically uses its built-in offline heuristic to create a clean 3–7 word title locally.",
      },
      {
        q: "How much data is sent to my configured LLM provider?",
        a: "Only the first question (capped at 600 characters) and an excerpt of the first answer (capped at 1,200 characters) on brand-new threads—sent directly from your browser's Service Worker to your chosen endpoint. Follow-up messages, cookies, and account IDs are never sent.",
      },
      {
        q: "Why does TEST LLM verify my setup before I run a search?",
        a: "Clicking TEST LLM or TEST PROVIDER sends a tiny sample prompt through the exact background Service Worker adapter and confirms both host permission access and valid model output immediately.",
      },
    ],
  },

  {
    slug: "perplexity-vs-chatgpt-claude-thread-titles",
    badge: "COMPARISON",
    badgeClass: "cyan",
    shortTitle: "Perplexity vs ChatGPT & Claude Titles",
    title: "Why Perplexity Doesn't Auto-Name Threads Like ChatGPT or Claude (And How to Add It)",
    h1: 'WHY PERPLEXITY DOESN’T AUTO-TITLE THREADS LIKE <span class="accent">CHATGPT OR CLAUDE</span>',
    description:
      "ChatGPT and Claude automatically summarize new chats into short 3–6 word titles, while Perplexity.ai keeps your raw prompt. Learn why—and how to add automatic AI thread titles to Perplexity.",
    lead:
      "Anyone switching between ChatGPT, Claude, and Perplexity notices one glaring UX difference in the left sidebar: ChatGPT and Claude summarize every new conversation into a clean topic title, while Perplexity leaves your raw first prompt verbatim.",
    quickAnswer:
      'ChatGPT and Claude run an asynchronous LLM summarization pass after your first message to generate a short sidebar title, whereas <strong>Perplexity.ai</strong> treats each thread like a traditional search query and displays your literal prompt text. Installing <a href="../index.html"><strong>Auto-Rename for Perplexity</strong></a> brings ChatGPT/Claude-style <strong>3–7 word semantic thread titles</strong> directly to Perplexity.ai automatically.',
    schemaType: "Article",
    sectionsHtml: `
      <section class="guide-section">
        <h2>Side-by-Side: How ChatGPT, Claude, and Perplexity Name Threads</h2>
        <div class="seo-table-wrap">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>ChatGPT</th>
                <th>Claude</th>
                <th>Perplexity.ai (Default)</th>
                <th>Perplexity + Auto-Rename</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Default Sidebar Title</strong></td>
                <td>AI-generated 3–6 word topic</td>
                <td>AI-generated concise topic</td>
                <td>Raw first prompt truncated</td>
                <td><strong>AI or offline 3–7 word topic</strong></td>
              </tr>
              <tr>
                <td><strong>Uses Answer Context?</strong></td>
                <td>Yes</td>
                <td>Yes</td>
                <td>No (prompt string only)</td>
                <td><strong>Yes (question + first answer)</strong></td>
              </tr>
              <tr>
                <td><strong>Custom Prefix Tags?</strong></td>
                <td>No</td>
                <td>No</td>
                <td>Manual edit only</td>
                <td><strong>Automatic (e.g. <code>[Research]</code>)</strong></td>
              </tr>
              <tr>
                <td><strong>Regex Skip Rules?</strong></td>
                <td>No</td>
                <td>No</td>
                <td>N/A</td>
                <td><strong>Yes (per-line regex exclusions)</strong></td>
              </tr>
              <tr>
                <td><strong>Choose Your Own Model?</strong></td>
                <td>Locked to OpenAI</td>
                <td>Locked to Anthropic</td>
                <td>N/A</td>
                <td><strong>10 providers + local Ollama + offline</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="guide-section">
        <h2>Why Waiting for the First Answer Produces Better Titles Than Prompt-Only Naming</h2>
        <p>
          Many vague prompts—such as pasting an unfamiliar error code, a DOI link, or asking <em>"What causes this phenomenon?"</em>—don’t contain the canonical name of the concept until the answer arrives. Because <strong>Auto-Rename for Perplexity</strong> waits for Perplexity’s first-turn SSE stream to emit <code>COMPLETED</code> and passes both the prompt and the opening answer excerpt to the title generator, even cryptic debugging pastes get crystal-clear titles like <code>Linux io_uring Submission Queue Starvation</code>.
        </p>
      </section>

      <section class="guide-section">
        <h2>Respecting Manual Edits &amp; Multi-Turn Research</h2>
        <p>
          Just like ChatGPT and Claude, once a thread has its topic title, subsequent follow-up questions inside that thread should <strong>not</strong> keep changing the title underneath you. Auto-Rename inspects <code>last_backend_uuid</code> and <code>is_related_query</code> on every request so follow-ups are ignored with zero overhead, and watches manual rename calls so your hand-edited titles always win.
        </p>
      </section>
    `,
    faqs: [
      {
        q: "Can I make Perplexity name my chats automatically like ChatGPT?",
        a: "Yes. Install Auto-Rename for Perplexity in Chrome, Brave, Arc, or Edge. Every new Perplexity search will automatically receive a concise 3–7 word topic title right after the first answer finishes streaming.",
      },
      {
        q: "Does renaming a thread break Perplexity share links or bookmarks?",
        a: "No. Updating a thread's display title via Perplexity's title API updates the human-readable title in your Library while keeping existing thread UUIDs and links working.",
      },
      {
        q: "Does it slow down Perplexity's streaming answer speed?",
        a: "Zero milliseconds of delay. Stream observation uses the standard browser Response.body.tee() API, and renaming happens asynchronously only after the first answer has already finished rendering.",
      },
    ],
  },

  {
    slug: "troubleshooting",
    badge: "DIAGNOSTICS & FIXES",
    badgeClass: "warn",
    shortTitle: "Troubleshooting & Error Fixes",
    title: "Troubleshooting Perplexity Auto-Rename: Fix Empty Titles, 403 Ollama CORS & Permissions",
    h1: 'TROUBLESHOOTING <span class="accent">PERPLEXITY AUTO-RENAME</span> &amp; COMMON FIXES',
    description:
      "Quick fixes if Perplexity threads aren't auto-renaming: grant optional host permissions, fix Ollama HTTP 403 CORS origins, understand reasoning-model token budgets, and check HTTP 204 status.",
    lead:
      "If a Perplexity thread didn't rename—or fell back to `[HEURISTIC]` instead of `[LLM]`—every cause can be diagnosed in under 30 seconds from the extension's Last Rename Activity panel.",
    quickAnswer:
      'If <strong>Auto-Rename for Perplexity</strong> is not renaming a thread, check four things first: (1) refresh any <code>perplexity.ai</code> tab that was already open before installation; (2) test on a <strong>brand-new thread</strong> (follow-ups and manually edited threads are intentionally skipped); (3) click the toolbar popup to verify <code>HOST ACCESS OK</code> for your chosen LLM provider; and (4) if using local Ollama, start it with <code>OLLAMA_ORIGINS="chrome-extension://*"</code> to prevent HTTP 403 CORS blocks.',
    schemaType: "TechArticle",
    sectionsHtml: `
      <section class="guide-section">
        <h2>Quick Symptom → Cause → Fix Matrix</h2>
        <div class="seo-table-wrap">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Symptom</th>
                <th>Most Likely Cause</th>
                <th>30-Second Fix</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>No toast appears at all on <code>perplexity.ai</code></strong></td>
                <td>Tab was open before extension install, or you asked a follow-up inside an existing thread.</td>
                <td>Refresh <code>perplexity.ai</code> once (<code>Cmd/Ctrl + R</code>) and start a <strong>New Thread</strong>. Check that <em>Bottom-Right Rename Toaster</em> is enabled in the popup.</td>
              </tr>
              <tr>
                <td><strong>Toast says <code>HEURISTIC</code> instead of <code>LLM</code></strong></td>
                <td>No API key saved for active provider, missing host permission, or invalid key/model name.</td>
                <td>Open the popup, check for <code>HOST ACCESS OK</code> (click <strong>Grant Host Access</strong> if prompted), and click <strong>TEST LLM</strong> to view the exact status.</td>
              </tr>
              <tr>
                <td><strong>Ollama returns <code>HTTP 403 Forbidden</code></strong></td>
                <td>Ollama blocks <code>chrome-extension://</code> origins by default unless configured.</td>
                <td>Restart Ollama with <code>OLLAMA_ORIGINS="chrome-extension://*" ollama serve</code> (or set the environment variable in your OS service).</td>
              </tr>
              <tr>
                <td><strong>Question skipped with <code>SKIPPED BY RULE</code></strong></td>
                <td>Prompt matched one of your Regex Exclude Patterns (e.g. <code>^define\\b</code> or <code>^test\\b</code>).</td>
                <td>Ask a real question that doesn't start with <code>test</code>/<code>define</code>, or edit <strong>Exclude Patterns</strong> in Full Settings.</td>
              </tr>
              <tr>
                <td><strong>Custom reasoning model returned empty output</strong></td>
                <td>A custom thinking model spent its token budget inside <code>&lt;think&gt;</code> blocks.</td>
                <td>Built-in Groq (<code>gpt-oss-20b</code>) and Gemini 2.5 Flash already auto-configure low/zero thinking budgets; on OpenRouter or custom endpoints, pick a fast non-reasoning instruct model like <code>gpt-4o-mini</code> or <code>llama-3.3-70b-instruct</code>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="guide-section">
        <h2>Checking Live Stream State on Perplexity.ai</h2>
        <p>
          When <strong>Bottom-Right Rename Toaster</strong> is enabled, you get immediate visual feedback on every new thread without opening DevTools:
        </p>
        <figure class="guide-shot">
          <img
            src="../assets/screenshots/01-toast-watching.png"
            width="810"
            height="226"
            loading="lazy"
            alt="Auto-Rename for Perplexity watching stream HUD toast with animated 2x2 pixel spinner"
          />
          <figcaption>Stage 1: As soon as a new Perplexity search starts streaming, WATCHING STREAM_ confirms active observation.</figcaption>
        </figure>
        <p>
          If you want deeper diagnostics for a custom OpenAI-compatible endpoint, enable <strong>Log provider fallback error details in browser console</strong> in Full Settings—all API keys are automatically redacted from error strings before logging.
        </p>
      </section>
    `,
    faqs: [
      {
        q: "Why didn't Auto-Rename run when I asked a second question in the same thread?",
        a: "By design! Renaming on follow-ups would constantly shift your thread's title while you research. Auto-Rename checks last_backend_uuid and is_related_query so only the first answer of a brand-new thread triggers a title.",
      },
      {
        q: "What does 'HTTP 204 via groq' mean in the popup?",
        a: "HTTP 204 (No Content) is Perplexity's success status code confirming that set_thread_title saved your new title on Perplexity's backend. If a transient network hiccup occurs, Auto-Rename automatically retries up to two times.",
      },
      {
        q: "How do I fix Ollama 403 errors with Chrome extensions on Windows or macOS?",
        a: "Set the environment variable OLLAMA_ORIGINS to chrome-extension://* before launching Ollama (on macOS: launchctl setenv OLLAMA_ORIGINS \"chrome-extension://*\", then restart the Ollama app).",
      },
    ],
  },

  {
    slug: "perplexity-chrome-extensions",
    badge: "POWER-USER GUIDE",
    badgeClass: "ok",
    shortTitle: "Perplexity Browser Workflow & Privacy",
    title: "Open-Source Perplexity.ai Chrome Extension Setup: Clean Library, Privacy & MV3 Guide (2026)",
    h1: 'OPEN-SOURCE <span class="accent">PERPLEXITY.AI BROWSER SETUP</span> FOR POWER USERS',
    description:
      "How to upgrade your daily Perplexity.ai research workflow in Chrome, Brave, Arc, and Edge with open-source Manifest V3 tooling, clean 3–7 word Library titles, and strict API key privacy.",
    lead:
      "When Perplexity.ai becomes your primary technical search engine, small friction points—like unreadable sidebar history or extensions that demand overly broad browser permissions—compound fast. Here is what to look for in a clean Perplexity browser setup.",
    quickAnswer:
      'For daily Perplexity.ai power users on Chrome, Brave, Arc, or Edge, <a href="../index.html"><strong>Auto-Rename for Perplexity</strong></a> (<a href="https://perplexity-autorename.vercel.app">perplexity-autorename.vercel.app</a>) solves Perplexity’s biggest Library pain point—raw, truncated prompt titles—using a zero-telemetry, MIT-licensed Manifest V3 architecture that keeps Perplexity’s native UI untouched and isolates LLM keys inside the background Service Worker.',
    schemaType: "Article",
    sectionsHtml: `
      <section class="guide-section">
        <h2>4 Security &amp; UX Checks Before Installing Any AI Browser Extension</h2>
        <p>
          Browser extensions running on AI research tools sit close to sensitive engineering questions and API keys. Before adding any Perplexity companion extension, verify four concrete engineering properties:
        </p>
        <ol>
          <li><strong>No blanket <code>&lt;all_urls&gt;</code> host permissions:</strong> An extension built for Perplexity should only run content scripts on <code>https://www.perplexity.ai/*</code>—never across your banking, email, or internal company dashboards.</li>
          <li><strong>Service-Worker API key isolation:</strong> In Manifest V3, API keys stored in <code>chrome.storage.local</code> should only ever be read inside the background Service Worker—never injected into page scripts or DOM attributes where page scripts could inspect them.</li>
          <li><strong>Zero developer proxy servers:</strong> Your prompt and answer excerpt should go straight from your browser to the LLM endpoint you chose (or stay 100% local via Ollama or offline heuristic mode).</li>
          <li><strong>Zero CSS pollution on Perplexity’s page:</strong> Status UI injected onto <code>perplexity.ai</code> should live inside an isolated ShadowRoot and unmount completely when idle so Perplexity’s layout and keyboard shortcuts never break.</li>
        </ol>
      </section>

      <section class="guide-section">
        <h2>How Auto-Rename for Perplexity Implements Three-World MV3 Isolation</h2>
        <figure class="guide-shot">
          <img
            src="../assets/architecture.svg"
            width="980"
            height="430"
            loading="lazy"
            alt="Three-world Chrome Manifest V3 architecture diagram showing Page MAIN world, Content ISOLATED world, and Background Service Worker"
          />
          <figcaption>Three-world Manifest V3 architecture: stream observation in MAIN, Shadow-DOM HUD in ISOLATED, and API keys confined strictly to the Service Worker.</figcaption>
        </figure>
        <p>
          Every Perplexity endpoint path and SSE field name is isolated in a single auditable module (<code>src/config/selectors.js</code>), backed by <strong>53 unit and end-to-end tests</strong> in the public GitHub repository (<a href="${REPO_URL}" target="_blank" rel="noopener"><code>sarang-cmd/perplexity-autorename</code></a>).
        </p>
      </section>
    `,
    faqs: [
      {
        q: "Does Auto-Rename for Perplexity inject ads, analytics, or tracking scripts into Perplexity?",
        a: "Zero. The extension contains no analytics SDKs, no remote code, and no developer servers. All bundled fonts (Silkscreen, Inter, JetBrains Mono) and icons are packaged locally inside the extension.",
      },
      {
        q: "Can I contribute new providers or features to Auto-Rename for Perplexity?",
        a: "Yes—the entire codebase is MIT-licensed on GitHub at github.com/sarang-cmd/perplexity-autorename with zero runtime npm dependencies and fast Node test runner coverage.",
      },
      {
        q: "Does it change Perplexity's dark/light theme or fonts?",
        a: "Never. Perplexity.ai's own page styling is 100% untouched; the Hybrid Pixel HUD styling applies only to the extension's popup, options page, and optional Shadow-DOM bottom-right toast.",
      },
    ],
  },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHead({
  title,
  description,
  canonicalUrl,
  assetPrefix,
  ldJsonGraph,
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="google-site-verification" content="7qXtBUikHAi5IxiEi94jbzxAAUfIvy1K3-osMQS-E_M" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="sitemap" type="application/xml" title="Sitemap" href="${SITE_URL}/sitemap.xml" />
    <meta property="og:site_name" content="Auto-Rename for Perplexity" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${SITE_URL}/assets/banner-social-1280x640.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/assets/banner-social-1280x640.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="${assetPrefix}assets/icon-48.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="${assetPrefix}assets/icon-192.png" />
    <link rel="icon" type="image/svg+xml" href="${assetPrefix}assets/logo.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="${assetPrefix}assets/apple-touch-icon.png" />
    <link rel="manifest" href="${assetPrefix}site.webmanifest" />
    <meta name="theme-color" content="#091318" />
    <link rel="stylesheet" href="${assetPrefix}styles.css" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": ldJsonGraph,
    })}</script>
  </head>`;
}

function buildHeader(assetPrefix) {
  return `    <header class="site-header">
      <div class="container nav-bar">
        <a href="${assetPrefix}index.html" class="nav-brand">
          <img
            src="${assetPrefix}assets/logo.svg"
            width="36"
            height="36"
            alt="Auto-Rename for Perplexity pixel logo"
            class="pixel-crisp"
          />
          <div>
            <span class="nav-brand-title">PPX AUTO-RENAME</span>
            <span class="nav-brand-sub">3–7 Word Perplexity Thread Titler</span>
          </div>
        </a>

        <nav class="nav-links" aria-label="Primary">
          <a href="${assetPrefix}index.html#why">Before / After</a>
          <a href="${assetPrefix}index.html#providers">10 Providers</a>
          <a href="${assetPrefix}index.html#install">Install</a>
          <a href="${assetPrefix}guides/">Guides &amp; Fixes</a>
          <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>
        </nav>

        <div class="nav-actions">
          <span class="badge ok">MV3 · V0.1.0</span>
          <a
            href="${assetPrefix}index.html#install"
            data-download-release
            download="auto-rename-for-perplexity-v0.1.0.zip"
            class="btn primary sm"
          >
            ⬇ DOWNLOAD .ZIP
          </a>
        </div>
      </div>
    </header>`;
}

function buildFooter(assetPrefix) {
  return `    <footer class="site-footer">
      <div class="container">
        <div class="footer-row">
          <div style="display: flex; align-items: center; gap: 12px">
            <img
              src="${assetPrefix}assets/logo.svg"
              width="36"
              height="36"
              alt="Auto-Rename for Perplexity pixel logo"
              class="pixel-crisp"
            />
            <div>
              <div class="nav-brand-title">AUTO-RENAME FOR PERPLEXITY</div>
              <div style="font-size: 13.5px; color: var(--muted)">
                Crisp 3–7 word thread titles · Chrome Manifest V3 · MIT License
              </div>
            </div>
          </div>

          <div class="footer-links">
            <a
              href="${assetPrefix}index.html#install"
              data-download-release
              download="auto-rename-for-perplexity-v0.1.0.zip"
              >DOWNLOAD V0.1.0</a
            >
            <a href="${assetPrefix}guides/">ALL GUIDES</a>
            <a href="${assetPrefix}fix-perplexity-thread-titles/">FIX TITLES</a>
            <a href="${assetPrefix}troubleshooting/">TROUBLESHOOTING</a>
            <a href="${REPO_URL}" target="_blank" rel="noopener">GITHUB</a>
            <a href="${assetPrefix}privacy-policy.html">PRIVACY POLICY</a>
          </div>
        </div>

        <div class="footer-disclaimer">
          <span>
            Independent open-source project. Not affiliated with, endorsed by, or sponsored by
            Perplexity AI, Inc.
          </span>
          <span>
            Bundled fonts: Silkscreen, Inter &amp; JetBrains Mono (SIL Open Font License 1.1).
          </span>
        </div>
      </div>
    </footer>

    <script src="${assetPrefix}release-bundle.js"></script>
    <script src="${assetPrefix}site.js"></script>
  </body>
</html>`;
}

function buildGuideCardsHtml(assetPrefix, excludeSlug = null) {
  return GUIDES.filter((g) => g.slug !== excludeSlug)
    .map(
      (g) => `          <article class="guide-card">
            <div>
              <span class="badge ${g.badgeClass}">${escapeHtml(g.badge)}</span>
              <h3><a href="${assetPrefix}${g.slug}/">${escapeHtml(g.shortTitle)}</a></h3>
              <p>${escapeHtml(g.description)}</p>
            </div>
            <a href="${assetPrefix}${g.slug}/" class="guide-card-link">READ GUIDE →</a>
          </article>`
    )
    .join("\n");
}

function renderGuidePage(g) {
  const canonicalUrl = `${SITE_URL}/${g.slug}/`;
  const breadcrumbLd = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guides & Fixes", item: `${SITE_URL}/guides/` },
      { "@type": "ListItem", position: 3, name: g.shortTitle, item: canonicalUrl },
    ],
  };

  let mainEntityLd;
  if (g.schemaType === "HowTo" && g.howToSteps) {
    mainEntityLd = {
      "@type": "HowTo",
      name: g.title,
      description: g.description,
      totalTime: "PT1M",
      tool: [{ "@type": "HowToTool", name: "Chrome, Brave, Arc, Edge, or Vivaldi browser" }],
      step: g.howToSteps.map((s, idx) => ({
        "@type": "HowToStep",
        position: idx + 1,
        name: s.name,
        text: s.text,
        url: `${canonicalUrl}#step-${idx + 1}`,
      })),
    };
  } else {
    mainEntityLd = {
      "@type": g.schemaType || "TechArticle",
      headline: g.title,
      description: g.description,
      datePublished: "2026-10-24",
      dateModified: TODAY,
      mainEntityOfPage: canonicalUrl,
      image: `${SITE_URL}/assets/banner-social-1280x640.png`,
      author: {
        "@type": "Person",
        name: "sarang-cmd",
        url: "https://github.com/sarang-cmd",
      },
      about: { "@id": `${SITE_URL}/#software` },
    };
  }

  const faqLd = {
    "@type": "FAQPage",
    mainEntity: g.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  const head = buildHead({
    title: `${g.title} | Auto-Rename for Perplexity`,
    description: g.description,
    canonicalUrl,
    assetPrefix: "../",
    ldJsonGraph: [SOFTWARE_LD, breadcrumbLd, mainEntityLd, faqLd],
  });

  const asideLinks = GUIDES.map(
    (item) =>
      `<li><a href="../${item.slug}/" class="${item.slug === g.slug ? "current" : ""}">${escapeHtml(
        item.shortTitle
      )}</a></li>`
  ).join("\n                ");

  const faqHtml = g.faqs
    .map(
      (f, idx) => `              <details class="faq-item"${idx === 0 ? " open" : ""}>
                <summary>${escapeHtml(f.q.toUpperCase())}</summary>
                <div class="faq-body">${escapeHtml(f.a)}</div>
              </details>`
    )
    .join("\n");

  return `${head}
  <body>
${buildHeader("../")}

    <main>
      <section class="guide-hero">
        <div class="container">
          <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a href="../index.html">HOME</a>
            <span class="sep">/</span>
            <a href="../guides/">GUIDES &amp; FIXES</a>
            <span class="sep">/</span>
            <span>${escapeHtml(g.shortTitle)}</span>
          </nav>

          <div class="guide-meta-row" style="margin-bottom: 14px">
            <span class="badge ${g.badgeClass}">${escapeHtml(g.badge)}</span>
            <span class="badge">UPDATED OCT 2026</span>
            <span class="badge">CHROME · BRAVE · ARC · EDGE</span>
          </div>

          <h1 class="guide-h1">${g.h1}</h1>
          <p class="guide-lead">${escapeHtml(g.lead)}</p>

          <div style="display: flex; flex-wrap: wrap; gap: 12px">
            <a
              href="../index.html#install"
              data-download-release
              download="auto-rename-for-perplexity-v0.1.0.zip"
              class="btn primary"
            >
              ⬇ DOWNLOAD EXTENSION .ZIP (FREE)
            </a>
            <a href="../index.html#top" class="btn">TRY LIVE SIMULATOR →</a>
            <a href="${REPO_URL}" target="_blank" rel="noopener" class="btn">VIEW ON GITHUB ↗</a>
          </div>

          <div class="ai-answer-box" role="region" aria-label="Quick Summary">
            <div class="ai-answer-kicker">
              <span>■ QUICK ANSWER · TL;DR</span>
              <span class="badge ok">OPEN SOURCE MV3</span>
            </div>
            <p>${g.quickAnswer}</p>
          </div>
        </div>
      </section>

      <div class="guide-body-wrap">
        <div class="container guide-layout">
          <div class="guide-article">
${g.sectionsHtml}

            <section class="guide-section" id="faq">
              <h2>Frequently Asked Questions</h2>
              <div class="faq-list">
${faqHtml}
              </div>
            </section>
          </div>

          <aside class="guide-aside" aria-label="Install and Guide Navigation">
            <div class="aside-card">
              <h3>INSTALL IN 60 SECONDS</h3>
              <p>
                Free, MIT-licensed Chrome Manifest V3 extension. Works immediately with zero API key or 10 LLM providers.
              </p>
              <a
                href="../index.html#install"
                data-download-release
                download="auto-rename-for-perplexity-v0.1.0.zip"
                class="btn primary"
                style="width: 100%; justify-content: center; margin-bottom: 10px"
              >
                ⬇ DOWNLOAD V0.1.0 .ZIP
              </a>
              <a
                href="../install-chrome-brave-arc-edge/"
                class="btn sm"
                style="width: 100%; justify-content: center"
              >
                UNPACKED INSTALL STEPS
              </a>
            </div>

            <div class="aside-card">
              <h3>ALL PERPLEXITY GUIDES</h3>
              <ul class="aside-links">
                ${asideLinks}
              </ul>
            </div>
          </aside>
        </div>

        <div class="container" style="margin-top: 52px">
          <div class="section-head">
            <div class="section-kicker">More Guides &amp; Fixes</div>
            <h2 class="section-title">RELATED PERPLEXITY WORKFLOW GUIDES</h2>
          </div>
          <div class="guide-cards-grid">
${buildGuideCardsHtml("../", g.slug)}
          </div>
        </div>
      </div>
    </main>

${buildFooter("../")}`;
}

function renderGuidesHubPage() {
  const canonicalUrl = `${SITE_URL}/guides/`;
  const head = buildHead({
    title: "Perplexity Auto-Rename Guides, Thread Title Fixes & Setup Tutorials | Auto-Rename for Perplexity",
    description:
      "Complete guides on fixing cut-off Perplexity.ai thread titles, organizing your Perplexity Library with prefixes and regex rules, setting up free Groq or local Ollama, and loading unpacked in Chrome, Brave, Arc & Edge.",
    canonicalUrl,
    assetPrefix: "../",
    ldJsonGraph: [
      SOFTWARE_LD,
      {
        "@type": "CollectionPage",
        name: "Perplexity Auto-Rename Guides, Fixes & Browser Setup Hub",
        url: canonicalUrl,
        description:
          "Tutorials, comparisons, and troubleshooting guides for automatically naming Perplexity.ai threads.",
        mainEntity: {
          "@type": "ItemList",
          itemListElement: GUIDES.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: g.title,
            url: `${SITE_URL}/${g.slug}/`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Guides & Fixes", item: canonicalUrl },
        ],
      },
    ],
  });

  return `${head}
  <body>
${buildHeader("../")}

    <main>
      <section class="guide-hero">
        <div class="container">
          <nav class="breadcrumbs" aria-label="Breadcrumb">
            <a href="../index.html">HOME</a>
            <span class="sep">/</span>
            <span>GUIDES &amp; FIXES</span>
          </nav>

          <h1 class="guide-h1">PERPLEXITY THREAD NAMING <span class="accent">GUIDES, FIXES &amp; SETUP</span></h1>
          <p class="guide-lead">
            Everything you need to fix messy or cut-off Perplexity.ai thread titles, organize your Library sidebar, run 100% free with Groq or local Ollama, and install unpacked on Chrome, Brave, Arc, or Edge.
          </p>

          <div class="ai-answer-box">
            <div class="ai-answer-kicker">
              <span>■ WHAT IS AUTO-RENAME FOR PERPLEXITY?</span>
              <span class="badge ok">MIT OPEN SOURCE</span>
            </div>
            <p>
              <strong>Auto-Rename for Perplexity</strong> is a free, open-source Chrome/Chromium Manifest V3 extension (<a href="${SITE_URL}">perplexity-autorename.vercel.app</a> · <a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a>) that watches the first answer stream on every brand-new <code>perplexity.ai</code> thread and automatically saves a clean <strong>3–7 word summary title</strong> via Perplexity’s native title API—supporting 10 LLM providers plus a zero-key offline mode.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div class="container">
          <div class="guide-cards-grid">
${buildGuideCardsHtml("../", null)}
          </div>
        </div>
      </section>
    </main>

${buildFooter("../")}`;
}

function buildRobotsTxt() {
  return `# robots.txt for Auto-Rename for Perplexity (${SITE_URL})
# Open-source Chrome/Chromium MV3 extension: ${REPO_URL}
# All search engines, AI Overviews, Gemini Grounding, Perplexity, and LLM search crawlers are explicitly allowed.

User-agent: *
Allow: /

# Google Search, AI Overviews & AI Mode
User-agent: Googlebot
Allow: /

User-agent: Googlebot-Image
Allow: /

User-agent: GoogleOther
Allow: /

# Google Gemini Apps & Vertex AI Grounding
User-agent: Google-Extended
Allow: /

# Bing, Microsoft Copilot, DuckDuckGo & Yahoo
User-agent: Bingbot
Allow: /

User-agent: DuckAssistBot
Allow: /

# Perplexity Search & Citations
User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

# OpenAI ChatGPT Search & Citations
User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# Anthropic Claude Search & Citations
User-agent: Claude-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

# Apple Spotlight, Safari & Siri
User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function buildSitemapXml() {
  const pages = [
    {
      loc: `${SITE_URL}/`,
      priority: "1.0",
      changefreq: "weekly",
      images: [
        `${SITE_URL}/assets/banner-social-1280x640.png`,
        `${SITE_URL}/assets/screenshots/01-toast-watching.png`,
        `${SITE_URL}/assets/screenshots/02-toast-renamed.png`,
        `${SITE_URL}/assets/screenshots/03-toolbar-popup.png`,
        `${SITE_URL}/assets/screenshots/04-settings-full.png`,
      ],
    },
    {
      loc: `${SITE_URL}/guides/`,
      priority: "0.9",
      changefreq: "weekly",
      images: [],
    },
    ...GUIDES.map((g) => ({
      loc: `${SITE_URL}/${g.slug}/`,
      priority: "0.85",
      changefreq: "weekly",
      images: [],
    })),
    {
      loc: `${SITE_URL}/privacy-policy.html`,
      priority: "0.5",
      changefreq: "monthly",
      images: [],
    },
  ];

  const entries = pages
    .map((p) => {
      const imgXml = p.images
        .map(
          (img) => `    <image:image>
      <image:loc>${img}</image:loc>
    </image:image>`
        )
        .join("\n");
      return `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${imgXml ? "\n" + imgXml : ""}
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}
</urlset>
`;
}

function buildLlmsTxt() {
  const guideLines = GUIDES.map(
    (g) => `- [${g.title}](${SITE_URL}/${g.slug}/): ${g.description}`
  ).join("\n");

  return `# Auto-Rename for Perplexity

> Free, MIT-licensed Chrome/Chromium Manifest V3 extension that fixes messy or cut-off Perplexity.ai thread titles by automatically renaming every new thread to a crisp 3–7 word topic summary once the first answer finishes streaming. Works immediately via 60-second unpacked install on Chrome, Brave, Arc, Edge, and Vivaldi (no Chrome Web Store listing required), with 10 LLM providers plus a 100% offline zero-key fallback.

- Website & Live Simulator: ${SITE_URL}/
- Direct Extension ZIP Download (v0.1.0): ${DOWNLOAD_URL}
- GitHub Repository (MIT Open Source): ${REPO_URL}
- Complete LLM Technical Reference: ${SITE_URL}/llms-full.txt
- Privacy Policy: ${SITE_URL}/privacy-policy.html

## Core Problems Solved
- Fixes Perplexity.ai saving raw prompts, pasted stack traces, SQL queries, or cut-off sentences as Library sidebar thread titles.
- Brings ChatGPT / Claude-style automatic 3–7 word conversation naming to Perplexity.ai.
- Never overwrites manual thread renames or follow-up turns (\`last_backend_uuid\` / \`is_related_query\` detection).
- Supports custom prefixes (e.g. \`[Research]\`, \`[Bug]\`) and per-line regex exclude patterns (e.g. \`^define\\\\b\`, \`^translate\\\\b\`).
- Zero telemetry, zero developer servers, and strict MV3 Service-Worker API key isolation (\`chrome.storage.local\`).

## Guides & Documentation
- [Guides & Fixes Hub](${SITE_URL}/guides/)
${guideLines}
`;
}

function buildLlmsFullTxt() {
  const sections = GUIDES.map(
    (g) => `## ${g.title}
URL: ${SITE_URL}/${g.slug}/
Summary: ${g.description}

${g.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}`
  ).join("\n\n---\n\n");

  return `${buildLlmsTxt()}

---

## Quick Unpacked Installation (No Chrome Web Store Needed)
1. Download \`auto-rename-for-perplexity-v0.1.0.zip\` from ${DOWNLOAD_URL} and extract it to a permanent folder.
2. Open \`chrome://extensions\` (or \`brave://extensions\`, \`arc://extensions\`, \`edge://extensions\`) and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted directory containing \`manifest.json\`.
4. Refresh any open \`perplexity.ai\` tab and ask a new question. Works out of the box with zero API key (offline heuristic) or with Groq, Gemini, OpenRouter, OpenAI, Anthropic, Mistral, DeepSeek, Sarvam, OpenCode Zen, or local Ollama (\`http://127.0.0.1:11434\`).

---

${sections}
`;
}

function buildManifestJson() {
  return JSON.stringify(
    {
      name: "Auto-Rename for Perplexity",
      short_name: "PPX Auto-Rename",
      description:
        "Open-source Chrome MV3 extension that automatically renames new Perplexity.ai threads to crisp 3–7 word titles once the first answer streams.",
      start_url: "/",
      display: "standalone",
      background_color: "#091318",
      theme_color: "#091318",
      icons: [
        { src: "/assets/icon-48.png", sizes: "48x48", type: "image/png" },
        { src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/assets/logo.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2
  ) + "\n";
}

function upgradeRootIndexHtml(html) {
  const homeGraph = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Auto-Rename for Perplexity",
      alternateName: ["PPX Auto-Rename", "Perplexity Auto-Rename Extension"],
      url: `${SITE_URL}/`,
    },
    SOFTWARE_LD,
    {
      "@type": "HowTo",
      name: "How to Install Auto-Rename for Perplexity in Chrome, Brave, Arc, or Edge",
      totalTime: "PT1M",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Download Extension ZIP",
          text: "Download auto-rename-for-perplexity-v0.1.0.zip from perplexity-autorename.vercel.app and unzip it.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Enable Developer Mode",
          text: "Open chrome://extensions (or brave://extensions, arc://extensions, edge://extensions) and enable Developer mode.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Load Unpacked",
          text: "Click Load unpacked and select the extracted folder containing manifest.json.",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Does this change Perplexity.ai's fonts, theme, or page layout?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Perplexity's website layout, fonts, and CSS remain 100% untouched. Only the extension's own toolbar popup, settings page, and isolated Shadow-DOM bottom-right status toast use the retro pixel HUD theme—and the toast can be disabled anytime with one click.",
          },
        },
        {
          "@type": "Question",
          name: "Where is my LLM API key stored, and can websites read it?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your API key is stored locally on your device in chrome.storage.local and read exclusively inside the extension's background MV3 Service Worker (src/background/service-worker.js). Neither perplexity.ai nor content scripts nor even the popup DOM ever read back the raw key string. Zero developer servers or analytics exist.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use it completely free without an API key?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes! Out of the box with no API key saved, Auto-Rename uses its built-in offline keyword heuristic (heuristicTitle()) to generate clean 3–7 word titles locally with zero network requests. You can also use free-tier keys from Groq, Google AI Studio (Gemini), OpenRouter :free models, or a local Ollama server.",
          },
        },
        {
          "@type": "Question",
          name: "Will it overwrite titles I rename manually or on follow-up questions?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Never. Follow-up messages and related-query clicks are skipped automatically via last_backend_uuid and is_related_query. And if you manually rename a thread in Perplexity's sidebar, the extension detects that request and locks out auto-renaming for that thread permanently.",
          },
        },
      ],
    },
  ];

  const seoHeadAdditions = `    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="google-site-verification" content="7qXtBUikHAi5IxiEi94jbzxAAUfIvy1K3-osMQS-E_M" />
    <link rel="canonical" href="${SITE_URL}/" />
    <link rel="sitemap" type="application/xml" title="Sitemap" href="${SITE_URL}/sitemap.xml" />
    <meta property="og:site_name" content="Auto-Rename for Perplexity" />
    <link rel="icon" type="image/png" sizes="48x48" href="assets/icon-48.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png" />
    <link rel="manifest" href="site.webmanifest" />
    <meta name="theme-color" content="#091318" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": homeGraph,
    })}</script>`;

  let out = html;
  // Remove previous SEO injection if re-run idempotently
  out = out.replace(/\s*<meta name="robots"[\s\S]*?<\/script>(?=\s*<link rel="icon" type="image\/svg\+xml")/, "");
  out = out.replace(
    '    <link rel="icon" type="image/svg+xml" href="assets/logo.svg" />',
    `${seoHeadAdditions}\n    <link rel="icon" type="image/svg+xml" href="assets/logo.svg" />`
  );

  // Add Guides link to primary nav if not already there
  if (!out.includes('href="guides/"')) {
    out = out.replace(
      '          <a href="#faq">FAQ</a>',
      '          <a href="#faq">FAQ</a>\n          <a href="guides/">Guides</a>'
    );
  }

  // Add Guides & Troubleshooting section right before </main> if not present
  const guidesSection = `
      <!-- Guides, Fixes & Browser Setup Hub -->
      <section id="guides">
        <div class="container">
          <div class="section-head">
            <div class="section-kicker">Guides, Fixes &amp; Tutorials</div>
            <h2 class="section-title">PERPLEXITY THREAD NAMING &amp; SETUP GUIDES</h2>
            <p class="section-sub">
              Deep-dive walkthroughs on fixing truncated Perplexity sidebar titles, organizing your Library with prefixes &amp; regex rules, setting up free Groq or local Ollama, and loading unpacked in any Chromium browser.
            </p>
          </div>

          <div class="guide-cards-grid">
${buildGuideCardsHtml("", null)}
          </div>
        </div>
      </section>
    </main>`;

  if (!out.includes('id="guides"')) {
    out = out.replace("    </main>", guidesSection);
  }

  // Add GUIDES + GITHUB links to footer if not present
  if (!out.includes('href="guides/">GUIDES')) {
    out = out.replace(
      '            <a href="privacy-policy.html">PRIVACY POLICY</a>',
      `            <a href="guides/">GUIDES &amp; FIXES</a>\n            <a href="${REPO_URL}" target="_blank" rel="noopener">GITHUB</a>\n            <a href="privacy-policy.html">PRIVACY POLICY</a>`
    );
  }

  return out;
}

function upgradePrivacyHtml(html) {
  if (html.includes('rel="canonical"')) return html;
  const canonicalUrl = `${SITE_URL}/privacy-policy.html`;
  const additions = `    <meta name="description" content="Privacy Policy for Auto-Rename for Perplexity: zero developer servers, zero analytics/telemetry in the extension, local chrome.storage.local API key isolation." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="icon" type="image/png" sizes="48x48" href="assets/icon-48.png" />
    <link rel="manifest" href="site.webmanifest" />`;
  return html.replace(
    '    <link rel="icon" type="image/svg+xml" href="assets/logo.svg" />',
    `${additions}\n    <link rel="icon" type="image/svg+xml" href="assets/logo.svg" />`
  );
}

// 1. Write static SEO & AI-Discovery files into docs/
fs.writeFileSync(path.join(DOCS, "robots.txt"), buildRobotsTxt(), "utf8");
fs.writeFileSync(path.join(DOCS, "sitemap.xml"), buildSitemapXml(), "utf8");
fs.writeFileSync(path.join(DOCS, "llms.txt"), buildLlmsTxt(), "utf8");
fs.writeFileSync(path.join(DOCS, "llms-full.txt"), buildLlmsFullTxt(), "utf8");
fs.writeFileSync(path.join(DOCS, "site.webmanifest"), buildManifestJson(), "utf8");
fs.writeFileSync(path.join(DOCS, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY, "utf8");

// 2. Write /guides/index.html and all 7 deep-dive SEO pages into docs/
const guidesDir = path.join(DOCS, "guides");
fs.mkdirSync(guidesDir, { recursive: true });
fs.writeFileSync(path.join(guidesDir, "index.html"), renderGuidesHubPage(), "utf8");

for (const g of GUIDES) {
  const dir = path.join(DOCS, g.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderGuidePage(g), "utf8");
}

// 3. Upgrade docs/index.html and docs/privacy-policy.html
const rawIndex = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
fs.writeFileSync(path.join(DOCS, "index.html"), upgradeRootIndexHtml(rawIndex), "utf8");

const rawPrivacy = fs.readFileSync(path.join(DOCS, "privacy-policy.html"), "utf8");
fs.writeFileSync(path.join(DOCS, "privacy-policy.html"), upgradePrivacyHtml(rawPrivacy), "utf8");

// 4. Mirror everything into landing-page/ and inject Vercel Web Analytics + Speed Insights into every HTML page
const itemsToMirror = [
  "FONT-LICENSES.md",
  "assets",
  "index.html",
  "privacy-policy.html",
  "release-bundle.js",
  "releases",
  "site.js",
  "styles.css",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  "site.webmanifest",
  `${INDEXNOW_KEY}.txt`,
  "guides",
  ...GUIDES.map((g) => g.slug),
];

fs.mkdirSync(LANDING, { recursive: true });
for (const item of itemsToMirror) {
  const srcPath = path.join(DOCS, item);
  const destPath = path.join(LANDING, item);
  if (!fs.existsSync(srcPath)) continue;
  fs.rmSync(destPath, { recursive: true, force: true });
  fs.cpSync(srcPath, destPath, { recursive: true });
}

// Inject Vercel Web Analytics + Speed Insights into all HTML files under landing-page/
const vaSnippet = `    <script>
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/insights/script.js"></script>\n  </head>`;

const siSnippet = `    <script>
      window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/speed-insights/script.js"></script>\n  </body>`;

function injectVercelScriptsRecursively(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      injectVercelScriptsRecursively(full);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      let html = fs.readFileSync(full, "utf8");
      if (!html.includes("/_vercel/insights/script.js")) {
        html = html.replace("  </head>", vaSnippet);
      }
      if (!html.includes("/_vercel/speed-insights/script.js")) {
        html = html.replace("  </body>", siSnippet);
      }
      fs.writeFileSync(full, html, "utf8");
    }
  }
}

injectVercelScriptsRecursively(LANDING);
console.log(`Built ${GUIDES.length + 1} SEO pages + robots.txt + sitemap.xml + llms.txt + IndexNow key in docs/ & landing-page/!`);
