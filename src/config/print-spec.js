/**
 * Single source of truth for PDF page geometry (Playwright) and HTML preview alignment.
 * Templates keep outer chrome minimal; Playwright margins plus injected body padding
 * define the final inset from the physical page edge.
 */

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
/** Playwright PDF page margins — slightly generous so content does not feel edge‑locked. */
export const MARGIN_MM = 14;

export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;
export const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * MARGIN_MM;

/** Padding inside the content box (within max-width), so text clears the printable inset. */
export const INNER_PAD_X_MM = 5;
export const INNER_PAD_Y_MM = 5;

/** Playwright page.pdf margin option */
export function getPdfMarginCss() {
  const m = `${MARGIN_MM}mm`;
  return { top: m, bottom: m, left: m, right: m };
}

const DEFAULT_SECTION_ORDER = ["summary", "experience", "education", "projects", "skills"];

const ALLOWED_SECTIONS = new Set(DEFAULT_SECTION_ORDER);

/**
 * @param {string[]} order
 * @param {'modern'|'corporate'|'faang'|'luxury'|'executive'} templateName
 */
/** @param {string[]} order @param {string} [_templateName] reserved for per-template defaults */
export function normalizeSectionOrder(order, _templateName) {
  const base = [...DEFAULT_SECTION_ORDER];
  if (!Array.isArray(order) || order.length === 0) return base;
  const seen = new Set();
  const out = [];
  for (const k of order) {
    if (ALLOWED_SECTIONS.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of base) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

/**
 * @param {object} raw
 */
export function normalizeLayout(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const scale = typeof r.globalScale === "number" && r.globalScale > 0 ? r.globalScale : 1;
  const sectionGap =
    typeof r.sectionGap === "number" && r.sectionGap > 0 ? r.sectionGap : 1;
  const lineHeight =
    typeof r.lineHeight === "number" && r.lineHeight > 0 ? r.lineHeight : 1;
  return {
    layoutVersion: 1,
    globalScale: Math.min(1.25, Math.max(0.65, scale)),
    sectionGap: Math.min(1.5, Math.max(0.7, sectionGap)),
    lineHeight: Math.min(1.35, Math.max(0.95, lineHeight)),
  };
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function sanitizeHex(c) {
  if (c == null || typeof c !== "string") return null;
  const t = c.trim();
  if (!HEX.test(t)) return null;
  return t.length === 4
    ? `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase()
    : t.toLowerCase();
}

/**
 * @param {object} raw
 */
export function normalizeAppearance(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const colorMode = r.colorMode === "dark" ? "dark" : "light";
  let headingWeight = Number(r.headingWeight);
  if (![600, 700, 800].includes(headingWeight)) headingWeight = 700;
  const underlineLinks = r.underlineLinks === true;
  const bodyColor = sanitizeHex(r.bodyColor);
  const headingColor = sanitizeHex(r.headingColor);
  return {
    appearanceVersion: 1,
    colorMode,
    headingWeight,
    underlineLinks,
    bodyColor,
    headingColor,
  };
}

/**
 * Injected after <head> so it overrides template body padding / max-width.
 * Uses zoom for global scale (Chromium / Playwright PDF).
 * @param {object} layout normalized layout
 * @param {object} appearance normalized appearance
 */
export function buildPrintSpecStyleBlock(layout, appearance) {
  const L = normalizeLayout(layout);
  const A = normalizeAppearance(appearance);
  const linkDeco = A.underlineLinks ? "underline" : "none";
  const bodyInk = A.bodyColor || (A.colorMode === "dark" ? "#fafafa" : "#0a0a0a");
  const headingInk =
    A.headingColor || (A.colorMode === "dark" ? "#fafafa" : "#0a0a0a");
  const muted = A.colorMode === "dark" ? "#a3a3a3" : "#525252";
  const border = A.colorMode === "dark" ? "#404040" : "#e5e5e5";
  const bg = A.colorMode === "dark" ? "#0a0a0a" : "#ffffff";
  const soft = A.colorMode === "dark" ? "#171717" : "#f5f5f5";
  const link = A.colorMode === "dark" ? "#e5e5e5" : "#171717";
  const codeBg = A.colorMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return `<style id="rr-print-spec" data-rr-injected="1">
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root {
  --rr-content-width-mm: ${CONTENT_WIDTH_MM};
  --rr-content-height-mm: ${CONTENT_HEIGHT_MM};
  --rr-page-height-mm: ${PAGE_HEIGHT_MM};
  --rr-margin-mm: ${MARGIN_MM};
  --rr-resume-scale: ${L.globalScale};
  --rr-section-gap-mul: ${L.sectionGap};
  --rr-line-height-mul: ${L.lineHeight};
  --rr-ink: ${bodyInk};
  --rr-heading: ${headingInk};
  --rr-muted: ${muted};
  --rr-border: ${border};
  --rr-bg: ${bg};
  --rr-soft: ${soft};
  --rr-link: ${link};
  --rr-code-bg: ${codeBg};
  --rr-heading-weight: ${A.headingWeight};
  --rr-link-decoration: ${linkDeco};
  --rr-inner-pad-x: ${INNER_PAD_X_MM}mm;
  --rr-inner-pad-y: ${INNER_PAD_Y_MM}mm;
}
body.rr-resume {
  font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
  padding: var(--rr-inner-pad-y) var(--rr-inner-pad-x) !important;
  max-width: ${CONTENT_WIDTH_MM}mm !important;
  width: 100% !important;
  margin: 0 auto !important;
  box-sizing: border-box !important;
  zoom: var(--rr-resume-scale, 1);
  background: var(--rr-bg) !important;
  color: var(--rr-ink) !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
body.rr-resume a {
  color: var(--rr-link) !important;
  text-decoration: var(--rr-link-decoration) !important;
  text-underline-offset: 2px;
  font-weight: 500;
}
</style>`;
}

export function appendDesignerBridge(html) {
  const script = `<script>(function(){
  function post(type,payload){try{window.parent&&window.parent.postMessage(Object.assign({type:type},payload||{}),"*");}catch(e){}}
  document.addEventListener("click",function(e){
    var el=e.target&&e.target.closest&&e.target.closest("[data-rr-field]");
    if(!el)return;
    if(e.target&&e.target.closest&&e.target.closest("a"))return;
    post("rr-field-click",{field:el.getAttribute("data-rr-field")});
  },true);
})();<\/script>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
  return html + script;
}
