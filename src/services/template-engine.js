import fs from "fs";
import handlebars from "handlebars";

export const renderTemplateHTML = (resumeData, templateName) => {
  // Convert Mongo objects → plain JSON
  const cleanData = JSON.parse(JSON.stringify(resumeData));

  console.log("CLEAN DATA:", cleanData);

  const html = fs.readFileSync(`src/config/templates/${templateName}/template.hbs`, "utf8");
  const css = fs.readFileSync(`src/config/templates/${templateName}/style.css`, "utf8");

  const compile = handlebars.compile(html);

  return compile({
    ...cleanData,
    style: css
  });
};
