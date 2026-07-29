const path = require("path");
const { chromium } = process.env.CODEX_PLAYWRIGHT_PATH
  ? require(process.env.CODEX_PLAYWRIGHT_PATH)
  : require("playwright");

const root = path.resolve(__dirname, "..");
const url = process.env.CASE_STUDY_V2_URL || "http://127.0.0.1:8137/projects/sous-v2";

async function inspectViewport(browser, name, viewport, sections) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelectorAll("img").forEach((image) => { image.loading = "eager"; }));
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1200);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete), null, { timeout: 10000 });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}" });

  const report = await page.evaluate(() => ({
    title: document.title,
    pageCount: document.querySelectorAll(".story-page").length,
    viewportWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    brokenImages: [...document.images].filter((image) => image.getAttribute("src") && !image.naturalWidth).map((image) => image.src),
    duplicateIds: [...document.querySelectorAll("[id]")]
      .map((node) => node.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index),
  }));

  if (report.pageCount !== 21) throw new Error(`${name}: expected 21 pages, got ${report.pageCount}`);
  if (report.scrollWidth > report.viewportWidth + 1) throw new Error(`${name}: horizontal overflow ${report.scrollWidth}px > ${report.viewportWidth}px`);
  if (report.brokenImages.length) throw new Error(`${name}: broken images ${report.brokenImages.join(", ")}`);
  if (report.duplicateIds.length) throw new Error(`${name}: duplicate ids ${report.duplicateIds.join(", ")}`);

  for (const id of sections) {
    const target = page.locator(`#${id}`);
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: path.join(root, `qa-case-study-v2-${name}-${id}.png`) });
  }
  await page.close();
  return report;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CASE_BROWSER_EXECUTABLE || undefined });
  try {
    const desktop = await inspectViewport(browser, "desktop", { width: 1440, height: 900 }, ["p01", "p03", "p08", "p10", "p13", "p17", "p21"]);
    const mobile = await inspectViewport(browser, "mobile", { width: 390, height: 844 }, ["p01", "p08", "p21"]);
    console.log(JSON.stringify({ url, desktop, mobile }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
