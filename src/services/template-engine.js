import fs from "fs";
import handlebars from "handlebars";

export const renderTemplateHTML = (resumeData, templateName) => {
  // Convert Mongo objects → plain JSON
  const cleanData = JSON.parse(JSON.stringify(resumeData));

  // --- 1. Register Date Formatting Helper ---
  handlebars.registerHelper('formatDate', function(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Use Intl.DateTimeFormat for "Month, Year" format
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
      }).format(date);
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return dateString; // Fallback to raw string if formatting fails
    }
  });
  // ----------------------------------------

  console.log("CLEAN DATA:", cleanData);

  const html = fs.readFileSync(`src/config/templates/${templateName}/template.hbs`, "utf8");

  const compile = handlebars.compile(html);

  return compile({
    ...cleanData,
  });
};