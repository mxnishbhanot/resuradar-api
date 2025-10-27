import { PDFParse}  from "pdf-parse";

export const extractText = async (filePath, mimetype) => {
  if (mimetype === "application/pdf") {
    const data = new PDFParse({url: filePath});
    const result = await data.getText()
    
    return result.text;
  } else {
    throw new Error("Only PDF supported for now");
  }
};
