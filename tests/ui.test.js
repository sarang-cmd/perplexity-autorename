import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRenameToaster } from "../src/content/toast.js";
import { createPixelLogoElement } from "../src/ui/pixel-logo.js";
import { DEFAULT_SETTINGS } from "../src/lib/storage.js";

function createFakeDom() {
  const elementsById = new Map();

  function makeNode(tag) {
    const classSet = new Set();
    const children = [];
    const attrs = new Map();
    const listeners = new Map();
    const dataset = {};

    const node = {
      tagName: String(tag).toUpperCase(),
      id: "",
      disabled: false,
      textContent: "",
      title: "",
      dataset,
      children,
      shadowRoot: null,
      get className() {
        return [...classSet].join(" ");
      },
      set className(val) {
        classSet.clear();
        for (const c of String(val || "").split(/\s+/).filter(Boolean)) {
          classSet.add(c);
        }
      },
      classList: {
        add: (...tokens) => tokens.forEach((t) => classSet.add(t)),
        remove: (...tokens) => tokens.forEach((t) => classSet.delete(t)),
        toggle: (t, force) => {
          const add = force === undefined ? !classSet.has(t) : Boolean(force);
          if (add) classSet.add(t);
          else classSet.delete(t);
          return add;
        },
        contains: (t) => classSet.has(t),
      },
      setAttribute: (k, v) => {
        if (k === "id") node.id = String(v);
        attrs.set(k, String(v));
      },
      getAttribute: (k) => attrs.get(k) ?? null,
      removeAttribute: (k) => attrs.delete(k),
      appendChild(child) {
        if (child?.id) elementsById.set(child.id, child);
        children.push(child);
        return child;
      },
      append(...nodes) {
        nodes.forEach((n) => node.appendChild(n));
      },
      remove() {
        if (node.id) elementsById.delete(node.id);
      },
      attachShadow() {
        const sr = makeNode("shadow-root");
        node.shadowRoot = sr;
        return sr;
      },
      addEventListener(type, fn) {
        listeners.set(type, fn);
      },
      click() {
        listeners.get("click")?.();
      },
    };
    return node;
  }

  const head = makeNode("head");
  const body = makeNode("body");
  const documentElement = makeNode("html");

  const document = {
    readyState: "complete",
    head,
    body,
    documentElement,
    createElement: (tag) => makeNode(tag),
    createElementNS: (_ns, tag) => makeNode(tag),
    getElementById: (id) => elementsById.get(id) || null,
  };

  return { window: { document }, document, elementsById };
}

describe("ui: Bottom-Right Pixel Rename Toaster", () => {
  it("stays unmounted when idle and transitions cleanly through watching -> renaming -> success -> dismiss", () => {
    const { window, document, elementsById } = createFakeDom();
    const toaster = createRenameToaster({
      win: window,
      chromeObj: { runtime: { getURL: (p) => `chrome-extension://ext/${p}` } },
      autoHideSuccessMs: 0,
    });

    toaster.updateSettings({
      enabled: true,
      showToast: true,
    });
    assert.equal(toaster.getState(), "idle");
    assert.equal(document.head.children.length, 0);

    toaster.showWatching();
    assert.equal(toaster.getState(), "watching");
    assert.ok(elementsById.get("ppx-autorename-toast"));
    const fontStyle = document.getElementById("ppx-autorename-hud-fonts");
    assert.ok(fontStyle);
    assert.ok(fontStyle.textContent.includes("PPX Silkscreen"));
    assert.ok(fontStyle.textContent.includes("PPX Pixel"));

    toaster.showRenaming({ step: "Saving title to Perplexity..." });
    assert.equal(toaster.getState(), "renaming");

    toaster.showSuccess({
      title: "Solid-State vs Liquid Lithium Electrolytes",
      source: "llm",
    });
    assert.equal(toaster.getState(), "success");

    toaster.dismiss();
    assert.equal(toaster.getState(), "idle");
  });

  it("stays completely silent when showToast is disabled", () => {
    const { window, elementsById } = createFakeDom();
    const toaster = createRenameToaster({ win: window, chromeObj: {} });
    toaster.updateSettings({
      enabled: true,
      showToast: false,
    });

    toaster.showWatching();
    assert.equal(toaster.getState(), "idle");
    assert.equal(elementsById.get("ppx-autorename-toast"), undefined);

    toaster.showRenaming();
    assert.equal(toaster.getState(), "idle");
  });
});

describe("ui: Pixel Logo & Removed Website Theme Option", () => {
  it("renders a crisp 16x16 pixel SVG icon", () => {
    const { document } = createFakeDom();
    const svg = createPixelLogoElement(document, { size: 32, className: "brand-logo" });
    assert.equal(svg.tagName, "SVG");
    assert.equal(svg.getAttribute("viewBox"), "0 0 16 16");
    assert.equal(svg.getAttribute("shape-rendering"), "crispEdges");
    assert.ok(svg.children.length > 20);
  });

  it("completely omits any Perplexity.ai website theme option in settings, popup, and options", () => {
    assert.equal("pixelWebsiteTheme" in DEFAULT_SETTINGS, false);
    const popupHtml = readFileSync(join(process.cwd(), "extension/popup.html"), "utf8");
    const optionsHtml = readFileSync(join(process.cwd(), "extension/options.html"), "utf8");
    assert.ok(!/Pixel Theme on Perplexity/i.test(popupHtml));
    assert.ok(!/Pixelated Theme/i.test(optionsHtml));
  });
});
