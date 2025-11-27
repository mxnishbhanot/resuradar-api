import puppeteer from "puppeteer";

export const generatePDF = async (html) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu"
    ]
  });

  const page = await browser.newPage();

  // FIX: wait for all DOM + styles to load
  await page.setContent(html, {
    waitUntil: ["domcontentloaded", "networkidle0"]
  });

  // FIX: ensure page has correct dimensions
  await page.emulateMediaType("screen");

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: "20mm",
      bottom: "20mm",
      left: "15mm",
      right: "15mm"
    }
  });

  await browser.close();
  return pdf;
};
