import { chromium } from "playwright";

export const generatePDF = async (html) => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });

  const page = await browser.newPage();

  // Set content & wait for DOM + network
  await page.setContent(html, {
    waitUntil: "networkidle"
  });

  // Match Puppeteer behavior
  await page.emulateMedia({ media: "screen" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      bottom: "20mm",
      left: "15mm",
      right: "15mm"
    }
  });

  await browser.close();
  return pdfBuffer;
};
