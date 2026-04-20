import fs from "fs";
import handlebars from "handlebars";
import {
  appendDesignerBridge,
  buildPrintSpecStyleBlock,
  normalizeLayout,
  normalizeSectionOrder,
} from "../config/print-spec.js";

/**
 * @param {object} resumeData
 * @param {string} templateName
 * @param {{ includeDesignerBridge?: boolean }} [options]
 */
export const renderTemplateHTML = (resumeData, templateName, options = {}) => {
  const cleanData = JSON.parse(JSON.stringify(resumeData));

  handlebars.registerHelper("formatDate", function (dateString) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
      }).format(date);
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return dateString;
    }
  });

  handlebars.registerHelper("if", function (conditional, options) {
    if (conditional) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  handlebars.registerHelper("each", function (context, options) {
    let ret = "";
    if (!context || typeof context.length !== "number") return ret;
    for (let i = 0, j = context.length; i < j; i++) {
      ret += options.fn(context[i]);
    }
    return ret;
  });

  handlebars.registerHelper("unless", function (conditional, options) {
    if (!conditional) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  handlebars.registerHelper("hrefUrl", function (url) {
    if (url == null || typeof url !== "string") return "#";
    const t = url.trim();
    if (!t) return "#";
    if (/^https?:\/\//i.test(t)) return t;
    return "https://" + t.replace(/^\/+/, "");
  });

  handlebars.registerHelper("eq", (a, b) => a === b);

  const ts = cleanData.templateSettings && typeof cleanData.templateSettings === "object"
    ? cleanData.templateSettings
    : {};
  const layout = normalizeLayout(ts.layout);
  const sectionOrder = normalizeSectionOrder(ts.sectionOrder, templateName);

  const html = fs.readFileSync(`src/config/templates/${templateName}/template.hbs`, "utf8");

  const compile = handlebars.compile(html);

  let out = compile({
    ...cleanData,
    templateSettings: ts,
    layout,
    sectionOrder,
  });

  const inject = buildPrintSpecStyleBlock(layout);
  out = out.replace(/<head[^>]*>/i, (m) => `${m}${inject}`);

  if (options.includeDesignerBridge !== false) {
    out = appendDesignerBridge(out);
  }

  return out;
};
