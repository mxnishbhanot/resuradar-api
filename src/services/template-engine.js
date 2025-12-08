import fs from "fs";
import handlebars from "handlebars";

export const renderTemplateHTML = (resumeData, templateName) => {
  // Convert Mongo objects → plain JSON
  const cleanData = JSON.parse(JSON.stringify(resumeData));

  // --- Register Handlebars Helpers ---
  
  // Date formatting helper
  handlebars.registerHelper('formatDate', function(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
      }).format(date);
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return dateString;
    }
  });

  // Conditional helper (if missing)
  handlebars.registerHelper('if', function(conditional, options) {
    if (conditional) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });

  // Each helper (if missing)
  handlebars.registerHelper('each', function(context, options) {
    let ret = "";
    for (let i = 0, j = context.length; i < j; i++) {
      ret = ret + options.fn(context[i]);
    }
    return ret;
  });

  // Unless helper
  handlebars.registerHelper('unless', function(conditional, options) {
    if (!conditional) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });

  console.log("CLEAN DATA:", cleanData);

  // Read template file
  const html = fs.readFileSync(
    `src/config/templates/${templateName}/template.hbs`, 
    "utf8"
  );

  const compile = handlebars.compile(html);

  return compile({
    ...cleanData,
  });
};