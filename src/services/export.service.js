import { generatePDF } from "./puppeteer.js";
import { renderTemplateHTML } from "./template-engine.js";


export const exportResumeService = async (resumeData, templateName) => {
  const html = await renderTemplateHTML(resumeData, templateName);
  console.log(html);
  
  const pdfBuffer = await generatePDF(html);
  return pdfBuffer;
};
