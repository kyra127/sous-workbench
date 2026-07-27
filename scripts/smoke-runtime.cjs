const { chromium } = require("playwright");

const appUrl = process.env.SOUS_TEST_URL || "http://127.0.0.1:8136/";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 939, height: 792 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const result = await page.evaluate(() => ({
    scripts: document.querySelectorAll("script[src]").length,
    sources: [...document.querySelectorAll("script[src]")].map((script) =>
      script.getAttribute("src"),
    ),
    stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
    localStylesheets: document.querySelectorAll('link[rel="stylesheet"][href^="/"]').length,
    styleSources: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
      link.getAttribute("href"),
    ),
    syncers: window.SOUSRuntime?.syncerCount || 0,
    activePage: document.querySelector(".page.on")?.id || "",
  }));

  for (const target of ["orders", "prep", "more", "settings", "home"]) {
    await page.evaluate((pageName) => window.go?.(pageName), target);
    await page.waitForTimeout(120);
  }
  result.finalPage = await page.evaluate(
    () => document.querySelector(".page.on")?.id || "",
  );
  result.errors = errors;

  if (result.scripts !== 1) {
    throw new Error(`Expected one browser script, found ${result.scripts}`);
  }
  if (!result.sources[0]?.startsWith("/sous-runtime.js")) {
    throw new Error(`Unexpected browser entry: ${result.sources[0] || "none"}`);
  }
  if (result.localStylesheets !== 1 || !result.styleSources.some((source) => source?.startsWith("/sous-ui.css"))) {
    throw new Error(`Expected one UI stylesheet, found ${result.styleSources.join(", ") || "none"}`);
  }
  if (errors.length) {
    throw new Error(`Browser errors: ${errors.join(" | ")}`);
  }

  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
