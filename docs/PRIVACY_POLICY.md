# Privacy Policy — Auto-Rename for Perplexity

**Effective Date:** October 24, 2026  
**Extension Name:** Auto-Rename for Perplexity  

## 1. Overview & Single Purpose

**Auto-Rename for Perplexity** is a browser extension whose single purpose is to automatically generate and save a concise 3–7 word thread title on `https://www.perplexity.ai` after the first answer in a brand-new thread finishes streaming.

The developer of this extension operates **no backend servers, databases, analytics pipelines, or telemetry endpoints**. All processing occurs locally inside your browser and between your browser and the third-party Large Language Model (LLM) API provider that you explicitly configure.

---

## 2. Data Accessed and Processed

When automatic renaming is enabled and you ask the **first question** in a brand-new Perplexity thread on `https://www.perplexity.ai`:

1. **First Question & Answer Excerpt (Website Content):**
   - The extension reads up to the first **600 characters** of your initial question and up to the first **1,200 characters** of Perplexity's completed first answer in memory.
   - If you have configured an LLM provider, this excerpt is transmitted directly over HTTPS from your browser's background service worker to your chosen LLM API endpoint (for example, Groq, OpenRouter, Google Gemini, OpenAI, Anthropic, Mistral, Cerebras, OpenCode Zen, Sarvam, or a custom URL you specify) solely to generate a short 3–7 word title.
   - Follow-up messages in existing threads are skipped and never sent to any LLM API.
   - If no API key is configured or the LLM call fails, a local keyword heuristic runs entirely inside your browser with zero external network requests.

2. **Same-Origin Perplexity Session & Thread Identifiers:**
   - To save the generated title back to your Perplexity thread, the extension reads the thread's `context_uuid` and `read_write_token` from the active stream and retrieves your numeric/UUID `user.id` from Perplexity's same-origin `/api/auth/session` endpoint to populate the required `x-pplx-account` request header on `POST https://www.perplexity.ai/rest/thread/set_thread_title`.
   - Neither your Perplexity session token, cookies, email address, nor `user.id` is ever stored persistently or transmitted outside `https://www.perplexity.ai`.

3. **Local Extension Storage (`chrome.storage.local`):**
   - **Settings:** Selected provider, model name, optional custom base URL, optional title prefix, exclude regex patterns, and UI toggles.
   - **API Keys:** Stored locally in `chrome.storage.local` on your device and read exclusively by the extension's background service worker. API keys are never exposed to web pages or content scripts.
   - **Rename History:** Up to the 200 most recent generated thread titles, timestamps, and Perplexity thread slugs (`backend_uuid`) so you can review or clear them in the extension's Settings page.

---

## 3. Data Sharing & Third Parties

- **No Developer Collection:** The developer never collects, receives, views, stores, sells, or shares any of your data.
- **User-Selected LLM Provider:** Prompt excerpts (question ≤ 600 chars, first answer ≤ 1,200 chars) and your API key for that provider are sent directly from your browser to the LLM endpoint you configure, governed by that provider's own privacy policy and API terms.
- **No Advertising or Profiling:** User data is never used or transferred for personalized advertising, creditworthiness, lending, or data brokerage.

---

## 4. Chrome Web Store Limited Use Disclosure

The use of information received from Google/Chrome APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/), including the **Limited Use** requirements. Specifically:
- Data is accessed strictly to provide the user-facing auto-rename feature on `https://www.perplexity.ai`.
- Data is never transferred to third parties except to the user-configured LLM API endpoint as strictly necessary to generate thread titles at the user's direction.
- No humans at the extension publisher read any user data.

---

## 5. User Controls & Data Deletion

You have complete local control over all stored data at any time:
- **Pause/Disable:** Toggle **Auto-Rename** off in the toolbar popup or Settings page to stop all title generation.
- **Delete API Keys:** Click **Clear Key** in Settings to immediately erase your stored API key.
- **Delete Rename History:** Click **Clear History** in Settings to erase local rename logs.
- **Uninstall:** Uninstalling the extension from Chrome permanently deletes all `chrome.storage.local` data associated with the extension.

---

## 6. Independent Project Disclaimer

Auto-Rename for Perplexity is an independent open-source utility and is **not affiliated with, endorsed by, or sponsored by Perplexity AI, Inc.**

## 7. Contact

For privacy questions or support, please contact the developer via the support email or GitHub repository listed on the Chrome Web Store listing page.
