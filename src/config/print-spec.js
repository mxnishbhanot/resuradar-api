/**
 * Single source of truth for PDF page geometry (Playwright) and HTML preview alignment.
 * Inner padding is folded into Playwright margins so the same inset repeats on every
 * printed page (body padding does not repeat at page breaks in paged media).
 */

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
/** Legacy base margin (before inner pad); kept for naming clarity in docs. */
export const MARGIN_MM = 14;

/** Desired inset inside the physical page for text (folded into Playwright margins). */
export const INNER_PAD_X_MM = 5;
export const INNER_PAD_Y_MM = 5;

/** Playwright `page.pdf` margin per edge = base margin + inner pad (same visual as old page 1). */
export const PDF_MARGIN_X_MM = MARGIN_MM + INNER_PAD_X_MM;
export const PDF_MARGIN_Y_MM = MARGIN_MM + INNER_PAD_Y_MM;

/** Body max dimensions inside the PDF margin box (no body padding — margins handle inset). */
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * PDF_MARGIN_X_MM;
export const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * PDF_MARGIN_Y_MM;

/** Default PDF palette (ATS-style: near-black on white, standard resume blue links). */
export const STANDARD_RESUME_TOKENS = {
  light: {
    ink: "#000000",
    heading: "#000000",
    muted: "#333333",
    border: "#cccccc",
    bg: "#ffffff",
    soft: "#ffffff",
    link: "#0563c1",
  },
  dark: {
    ink: "#f1f5f9",
    heading: "#f8fafc",
    muted: "#94a3b8",
    border: "#334155",
    bg: "#0f172a",
    soft: "#1e293b",
    link: "#e2e8f0",
  },
};

/** Playwright page.pdf margin option (includes former body inner padding). */
export function getPdfMarginCss() {
  const x = `${PDF_MARGIN_X_MM}mm`;
  const y = `${PDF_MARGIN_Y_MM}mm`;
  return { top: y, bottom: y, left: x, right: x };
}

/** Matches standard single-column resume: summary → jobs → projects → school → skills. */
const DEFAULT_SECTION_ORDER = ["summary", "experience", "projects", "education", "skills"];

const ALLOWED_SECTIONS = new Set(DEFAULT_SECTION_ORDER);

/** @param {string[]} order @param {string} [_templateName] reserved for future per-layout defaults */
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
  let targetPageCount = r.targetPageCount;
  if (targetPageCount !== 1 && targetPageCount !== 2) targetPageCount = undefined;
  return {
    layoutVersion: 1,
    globalScale: Math.min(1.25, Math.max(0.65, scale)),
    sectionGap: Math.min(1.5, Math.max(0.7, sectionGap)),
    lineHeight: Math.min(1.35, Math.max(0.95, lineHeight)),
    ...(targetPageCount === 1 || targetPageCount === 2 ? { targetPageCount } : {}),
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
  const T = A.colorMode === "dark" ? STANDARD_RESUME_TOKENS.dark : STANDARD_RESUME_TOKENS.light;
  const bodyInk = A.bodyColor || T.ink;
  const headingInk = A.headingColor || T.heading;
  const muted = T.muted;
  const border = T.border;
  const bg = T.bg;
  const soft = T.soft;
  const link = T.link;
  const codeBg = A.colorMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return `<style id="rr-print-spec" data-rr-injected="1">
@import url('https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400&display=swap');
:root {
  --rr-content-width-mm: ${CONTENT_WIDTH_MM};
  --rr-content-height-mm: ${CONTENT_HEIGHT_MM};
  --rr-page-height-mm: ${PAGE_HEIGHT_MM};
  --rr-pdf-margin-x-mm: ${PDF_MARGIN_X_MM};
  --rr-pdf-margin-y-mm: ${PDF_MARGIN_Y_MM};
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
}
body.rr-resume {
  font-family: 'Carlito', Calibri, 'Segoe UI', Arial, Helvetica, sans-serif !important;
  padding: 0 !important;
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
