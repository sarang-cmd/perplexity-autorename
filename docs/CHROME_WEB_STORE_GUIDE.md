# Chrome Web Store Deployment & Publishing Guide

This guide walks you step-by-step from your built `perplexity-autorename-0.1.0.zip` package to a **live, approved Chrome Web Store (CWS) listing**, including copy-paste text for every form field and permission justification so you avoid review rejections.

---

## Pre-Flight Checklist (Already Done in This Repo)

Your codebase has already been configured to pass Chrome Web Store automated and manual review checks:

- **Manifest V3 (`extension/manifest.json`):** Service worker background (`background.js`), zero remote code, zero `eval()`.
- **Trademark-Safe Name (`<= 75` chars):** `"Auto-Rename for Perplexity"` (uses *"for Perplexity"* rather than *"Perplexity Auto-Rename"*, which is required by Google's Impersonation / Third-Party Brand policy).
- **Compliant Summary (`<= 132` chars):** `"Automatically renames new Perplexity threads to a concise 3–7 word title once the first answer completes."` (106 chars).
- **Minimal Permissions:** Only `"storage"`, content scripts strictly scoped to `https://www.perplexity.ai/*`, and runtime `optional_host_permissions` requested only when the user clicks Save/Test for their chosen LLM provider.
- **In-Product Data Disclosure (CWS Policy Requirement):** Built directly into `extension/options.html` ("Data & Privacy Disclosure" card) explaining what excerpt is sent to the user's chosen LLM endpoint.
- **Clean Store Assets:** Pre-rendered in `store-assets/`:
  - `store-assets/store-icon-128.png` (`128×128` PNG with `96×96` rounded icon + `16px` transparent perimeter padding per Google's icon spec)
  - `store-assets/small-promo-440x280.png` (`440×280` 24-bit PNG without alpha channel)
- **Standalone Privacy Policy:** Ready to host in `docs/privacy-policy.html` (and `docs/PRIVACY_POLICY.md`).

---

## Step 1: Create & Verify Your Chrome Web Store Developer Account

1. **Enable 2-Step Verification (Mandatory):**
   - Make sure the Google account you want to publish under has **2-Step Verification (2FA)** turned on at <https://myaccount.google.com/security>. Chrome Web Store blocks submissions without 2FA.
   - *Tip:* Consider using a dedicated developer email (or a clean email alias) because your **Support Email** is displayed publicly on the store listing.
2. **Register at the Developer Console:**
   - Open <https://chrome.google.com/webstore/devconsole/>.
   - Accept the Chrome Web Store Developer Agreement and pay the **one-time $5 USD registration fee**.
3. **Complete Account Profile:**
   - Go to **Account** (left sidebar):
     - **Publisher name:** Your name, handle, or studio name.
     - **Email address:** Enter your contact/support email and click **Verify Email** (check your inbox for the verification link — you cannot click *Submit for Review* until verified).
     - **Trader / Non-Trader Declaration (Required for EU Digital Services Act):**
       - Select **Non-trader** if this is a free hobby/open-source extension and you are not acting in a commercial/business capacity (this avoids displaying a physical business address publicly).
       - Select **Trader** only if publishing commercially as a business (requires address verification).

---

## Step 2: Host Your Public Privacy Policy URL (Takes 2 Minutes)

Because this extension reads the first Q&A on `perplexity.ai` to generate a title and stores user settings in `chrome.storage.local`, Chrome Web Store **requires a publicly accessible Privacy Policy URL** (note: Google Docs links are often rejected — use a static web page).

We included a ready-made page at `docs/privacy-policy.html`. Pick **any one** of these free options:

### Option A: GitHub Pages (Recommended if your code is on GitHub)
1. Push this repo to GitHub (public repository, or public docs repo).
2. In your GitHub repo, go to **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, pick `main` and `/docs` (or `/root`), and click **Save**.
4. Within ~60 seconds your policy will be live at:
   `https://<your-github-username>.github.io/<repo-name>/privacy-policy.html`

### Option B: Cloudflare Pages / Netlify Drop (No Git repo required)
1. Copy `docs/privacy-policy.html` to a folder as `index.html`.
2. Drag-and-drop that folder onto <https://app.netlify.com/drop> or Cloudflare Pages.
3. Copy the resulting `https://...` URL.

---

## Step 3: Capture 1–3 Real Screenshots (`1280×800`)

Chrome Web Store requires **at least 1 screenshot** (`1280×800` or `640×400`, PNG or JPEG, **no alpha transparency**) showing the real extension experience:

1. Load `extension/` unpacked at `chrome://extensions` for testing.
2. Open Chrome DevTools (`F12` / `Cmd+Opt+I`) → click the **Toggle device toolbar** icon (`Ctrl+Shift+M`) → set viewport size to **`1280` × `800`** (`DPR: 1`).
3. Capture 2–3 clean screenshots:
   - **Screenshot 1:** A Perplexity thread right after the first answer completes, showing the concise 3–7 word title and the bottom-right **"Thread renamed"** confirmation toast.
   - **Screenshot 2:** Clicking the extension icon in the toolbar showing the **Auto-Rename Quick Settings Popup** (`Provider`, `Model`, `Test LLM`, `Bottom-right rename toast`).
   - **Screenshot 3:** The full **Settings (`options.html`)** page showing the 10 supported LLM providers, exclude regex rules, Recent Renames table, and Data & Privacy Disclosure card.

*(Note: Ensure saved PNGs are 24-bit RGB without transparency, or save as `.jpg`.)*

---

## Step 4: Build & Verify the Upload ZIP

 Chrome Web Store requires `manifest.json` to sit at the **root** of the uploaded `.zip` file (not nested inside an `extension/` wrapper folder, and without `src/`, `tests/`, or `node_modules/`).

Whenever you build a new release, run:

```bash
npm run build
npm test
(cd extension && zip -r ../auto-rename-for-perplexity-v0.1.0.zip . -x "*.DS_Store")
```

Verify the archive contents (`manifest.json` must be top-level):

```bash
unzip -l auto-rename-for-perplexity-v0.1.0.zip
```

Expected files inside the ZIP:
- `manifest.json`
- `background.js`
- `content.js`
- `page.js`
- `popup.html`, `popup.js`
- `options.html`, `options.js`
- `pixel-ui.css`
- `fonts/Silkscreen-Regular.woff2`, `fonts/Silkscreen-Bold.woff2`, `fonts/PixelifySans-Regular.woff2`, `fonts/PixelifySans-SemiBold.woff2`, `fonts/PixelifySans-Bold.woff2`
- `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`

---

## Step 5: Upload & Fill Out the Store Listing Tab

1. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/), click **+ New Item** (top right).
2. Drag and drop `auto-rename-for-perplexity-v0.1.0.zip`.
3. Once uploaded, open the **Store listing** tab and fill in:

### Title & Summary (Auto-populated from `manifest.json`)
- **Title:** `Auto-Rename for Perplexity`
- **Summary:** `Automatically renames new Perplexity threads to a concise 3–7 word title once the first answer completes.`

### Detailed Description (Copy & Paste)

```text
Stop scrolling through a sidebar full of truncated raw prompts. Auto-Rename for Perplexity automatically gives every new Perplexity thread a clean, scannable 3–7 word title the moment its first answer finishes streaming.

HOW IT WORKS
• Watches only the first question and answer in a brand-new thread on www.perplexity.ai.
• Generates a concise 3–7 word topic title using your choice of fast, low-cost (or free-tier) LLM API — or falls back automatically to an instant offline keyword heuristic if no API key is configured.
• Saves the title directly to your Perplexity thread so your Library and sidebar stay organized across devices.
• Shows a subtle, dismissible bottom-right toast notification when a thread is renamed (can be turned off anytime).

SMART & NON-INTRUSIVE BY DESIGN
• Never overwrites manual edits: If you rename a thread yourself, Auto-Rename backs off permanently for that thread.
• First answer only: Follow-up questions in existing threads are ignored so your titles never jump around.
• Custom rules: Add an optional title prefix (e.g., "[Research]") or line-by-line regular expression exclude patterns (e.g., skip "^define" or "^translate").
• Clean native look: Does not alter Perplexity's page layout, fonts, or styles.

BRING YOUR OWN KEY — 10 PROVIDERS SUPPORTED
• Groq (default: openai/gpt-oss-20b)
• OpenRouter (free & paid models)
• Google Gemini (gemini-2.5-flash-lite)
• OpenAI (gpt-5-nano / gpt-4o-mini)
• Anthropic (claude-haiku-4-5)
• Mistral, Cerebras, OpenCode Zen, Sarvam, or any Custom OpenAI-compatible URL (including local Ollama / LM Studio servers).

PRIVACY FIRST
• Zero developer servers, zero analytics, zero tracking.
• Your API key is stored locally in chrome.storage.local and read exclusively by the extension's background service worker.
• Only the first question (up to 600 chars) and first answer excerpt (up to 1,200 chars) of a new thread are sent to the LLM endpoint you configure.

Disclaimer: Auto-Rename for Perplexity is an independent open-source extension and is not affiliated with, endorsed by, or sponsored by Perplexity AI, Inc.
```

### Category & Language
- **Category:** `Productivity` → `Workflow & Planning` (or `Tools`)
- **Language:** `English`

### Graphic Assets
- **Store Icon (`128×128`):** Upload `store-assets/store-icon-128.png`.
- **Screenshots (`1280×800`):** Upload the 1–3 screenshots captured in Step 3.
- **Small Promo Tile (`440×280`):** Upload `store-assets/small-promo-440x280.png`.
- **Marquee Promo Tile (`1400×560`):** Leave blank (optional; only used if Google editorial features the extension).

### Additional Fields
- **Official URL / Homepage URL:** `https://perplexity-autorename.vercel.app`
- **Support URL:** Your GitHub Issues URL (e.g., `https://github.com/<you>/<repo>/issues`).
- **Mature content:** Select **No**.

Click **Save draft**.

---

## Step 6: Fill Out the Privacy Practices Tab (Critical for Fast Approval!)

Reviewers check the **Privacy** tab against `manifest.json` line-by-line. Copy-paste the exact answers below so there are zero mismatches:

### 1. Single Purpose Description
```text
Automatically generates and saves a concise 3–7 word title for brand-new conversation threads on https://www.perplexity.ai after the first answer completes.
```

### 2. Permission Justifications

- **`storage` justification:**
  ```text
  Used strictly to store user preferences locally on the device (enabled state, selected LLM provider and model, optional title prefix, exclude regex patterns, API key in chrome.storage.local, and local rename history).
  ```

- **Host permission (`https://www.perplexity.ai/*`) justification:**
  ```text
  Required so the content script can detect when the first answer stream completes on a brand-new Perplexity thread, display an optional rename toast, and submit the same-origin thread rename request on https://www.perplexity.ai.
  ```

- **Optional host permissions (`https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`) justification:**
  ```text
  Requested dynamically at runtime only when the user configures and saves an external or local OpenAI-compatible LLM provider endpoint (such as Groq, OpenRouter, Gemini, OpenAI, Anthropic, Mistral, Cerebras, or a local Ollama/LM Studio server on localhost) so the background service worker can request a 3–7 word thread title.
  ```

- **Are you using remote code?**
  - Select **No, I am not using remote code.** (All JavaScript is bundled at build time via `esbuild`; runtime calls only exchange JSON payloads with user-configured LLM APIs.)

### 3. Data Usage Checkboxes

Check **ONLY** the following box (leave all others — Health, Financial, Authentication, Personal communications, Location, Web history, User activity, Personally identifiable information — **unchecked**):

- [x] **Website content** *(Checked — because when an LLM provider is configured, an excerpt of the first question and answer on `www.perplexity.ai` is transmitted to the user's chosen LLM endpoint to generate the thread title).*

Then check **ALL THREE** mandatory certifications at the bottom of Data Usage:
- [x] *I do not sell or transfer user data to third parties, outside of the approved use cases.*
- [x] *I do not use or transfer user data for purposes that are unrelated to my item's single purpose.*
- [x] *I do not use or transfer user data to determine creditworthiness or for lending purposes.*

### 4. Privacy Policy URL
- Paste your live HTTPS Privacy Policy URL: `https://perplexity-autorename.vercel.app/privacy-policy.html` (or your GitHub Pages equivalent).

Click **Save draft**.

---

## Step 7: Distribution & Visibility Settings

Open the **Distribution** tab:
- **Visibility:**
  - **Public** — searchable by everyone on the Chrome Web Store.
  - *(Optional tip: Choose **Unlisted** first if you want a live Chrome Web Store install link to test with friends before flipping to **Public**.)*
- **Geographic distribution:** **All regions**.

---

## Step 8: Submit for Review & What to Expect

1. Click **Submit for Review** (top right).
2. In the confirmation modal:
   - Leave **"Publish automatically after it has passed review"** enabled (or choose manual publish if you want to control launch timing).
3. **Typical Review Timeline:**
   - Because this extension requests narrow default host access (`https://www.perplexity.ai/*` + `storage`) and uses runtime `optional_host_permissions` rather than broad upfront `<all_urls>`, initial review typically completes in **1 to 3 business days**.
4. **Reviewer Testing Note (If Asked):**
   - Remember that the extension includes a zero-config **offline keyword heuristic fallback** when no API key is entered — meaning even if a Chrome Web Store automated/manual reviewer tests the extension on `perplexity.ai` without entering an LLM API key, the extension still works cleanly out of the box!

---

## Step 9: Publishing Future Updates (`v0.1.1+`)

Whenever you make improvements later:

1. Bump `"version"` in **both** `package.json` and `extension/manifest.json` (Chrome Web Store rejects uploads with an existing version number, e.g., change `"0.1.0"` → `"0.1.1"`).
2. Rebuild, test, and package:
   ```bash
   npm run build
   npm test
   (cd extension && zip -r ../perplexity-autorename-0.1.1.zip . -x "*.DS_Store")
   ```
3. In the Chrome Web Store Developer Console → open your item → **Package** → **Upload new package** → upload `perplexity-autorename-0.1.1.zip` → **Submit for review**. Updates that don't add new permissions usually clear review in **under 24 hours**.
