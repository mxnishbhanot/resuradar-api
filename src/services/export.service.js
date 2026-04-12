import { generatePDF } from "./puppeteer.js";
import { renderTemplateHTML } from "./template-engine.js";


export const exportResumeService = async (resumeData, templateName) => {
  const html = await renderTemplateHTML(resumeData, templateName);
  const pdfBuffer = await generatePDF(html);
  return pdfBuffer;
};
