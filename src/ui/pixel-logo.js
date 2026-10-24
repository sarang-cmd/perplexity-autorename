/**
 * Bit-exact 16×16 pixel-art `P_` brand mark (`shape-rendering="crispEdges"`).
 * Zero external requests; works inside Popup, Options, and Shadow-DOM Toaster.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const PIXEL_ROWS = [
  "..111111111111..",
  ".12222222222221.",
  "1200000000000001",
  "1203333333000001",
  "1203333333300001",
  "1203300003300001",
  "1203300003300001",
  "1203333333300001",
  "1203333333000001",
  "1203300000000441",
  "1203300000000441",
  "1203300555555441",
  "1203300555555441",
  "1200000000000001",
  ".10000000000001.",
  "..111111111111..",
];

const PALETTE = {
  "0": "#11222b",
  "1": "#081116",
  "2": "#1e3a49",
  "3": "#f0fdfa",
  "4": "#5eead4",
  "5": "#2dd4bf",
};

export function createPixelLogoElement(doc = globalThis.document, { size = 32, className = "" } = {}) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  if (className) {
    svg.setAttribute("class", className);
  }

  for (let y = 0; y < PIXEL_ROWS.length; y++) {
    const row = PIXEL_ROWS[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || !PALETTE[ch]) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) {
        end++;
      }
      const rect = doc.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(end - x));
      rect.setAttribute("height", "1");
      rect.setAttribute("fill", PALETTE[ch]);
      svg.appendChild(rect);
      x = end;
    }
  }

  return svg;
}
