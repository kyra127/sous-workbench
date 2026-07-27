const { chromium } = require("playwright");
const APP = "http://127.0.0.1:8136/";
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const assert = (value, message) => { if (!value) throw new Error(message); };
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sous:business-profile:v1", JSON.stringify({ businessName: "重复检查测试", email: "qa@example.com", onboardingCompleted: true }));
    localStorage.setItem("sous:v7-setup-complete", "true");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => {
    const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXcAAAAASUVORK5CYII=";
    const fingerprint = window.sousImageFingerprint(pixel);
    const existing = [{ id: 1001, customer: "顾客 A", items: "提拉米苏 ×1", date: "2026-07-30 15:00", method: "自取", status: "pending", createdAt: new Date().toISOString(), sourceImages: [{ fingerprint }] }];
    localStorage.setItem("sous:orders", JSON.stringify(existing));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => go("intake"));
  await page.evaluate(() => {
    const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXcAAAAASUVORK5CYII=";
    pendingImages = [{ id: "again", data: pixel, type: "image/png", url: `data:image/png;base64,${pixel}` }];
    window.__aiCalledDuringDuplicateCheck = false;
    callAI = async () => { window.__aiCalledDuringDuplicateCheck = true; return "{}"; };
    renderThumbs();
  });
  await page.locator("#parseBtn").click();
  await page.locator("#duplicateOrderDialog:not([hidden])").waitFor();
  assert(await page.locator("#duplicateDialogReason").innerText().then((text) => text.includes("100%")), "duplicate confidence missing");
  assert(await page.evaluate(() => window.__aiCalledDuringDuplicateCheck === false), "AI was called before duplicate decision");
  await page.locator("[data-duplicate-cancel]").click();
  assert(errors.length === 0, `page errors: ${errors.join(" | ")}`);
  await browser.close();
  console.log(JSON.stringify({ ok: true, preparseBlocked: true, aiCalledBeforeDecision: false, exactScreenshot: true }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
