import { chromium } from "playwright";
import { getPdfMarginCss } from "../config/print-spec.js";

export const generatePDF = async (html) => {
  let browser;
  
  try {
    // Launch browser with optimal settings
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Prevents memory issues
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewportSize({
      width: 1280,
      height: 1024
    });

    // Set content with proper wait
    await page.setContent(html, {
      waitUntil: "networkidle", // Wait for all network requests
      timeout: 30000 // 30 second timeout
    });

    // CRITICAL FIX: Use print media type for PDF
    await page.emulateMedia({ media: "print" });

    // Wait a bit for fonts and rendering
    await page.waitForTimeout(500);

    // Generate PDF with proper settings
    const margin = getPdfMarginCss();
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false, // Use A4 format, not CSS @page
      margin,
      displayHeaderFooter: false,
      scale: 1.0 // Ensure no scaling
    });

    return pdfBuffer;

  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
