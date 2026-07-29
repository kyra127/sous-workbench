const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const appRoot = path.resolve(__dirname, "..");
const outputDir = path.join(appRoot, "case-assets");
const baseUrl = process.env.SOUS_CAPTURE_URL || "http://127.0.0.1:8124/";
const edgeExecutable = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function imageFingerprint(value) {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code ^ index, 0x85ebca6b);
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}-${value.length.toString(36)}`;
}

async function capture(page, name) {
  await page.waitForTimeout(180);
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}

async function openPage(page, name) {
  await page.evaluate((target) => window.go(target), name);
  await page.waitForSelector(`#page-${name}.on`);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const uploadPath = path.join(outputDir, "onboarding.png");
  const uploadBase64 = fs.readFileSync(uploadPath).toString("base64");
  const uploadFingerprint = imageFingerprint(uploadBase64);

  const browser = await chromium.launch({
    headless: true,
    executablePath: edgeExecutable,
  });

  const registrationContext = await browser.newContext({
    viewport: { width: 1100, height: 700 },
    deviceScaleFactor: 2,
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const registrationPage = await registrationContext.newPage();
  await registrationPage.goto(`${baseUrl}?resetAppData=1&firstUse=1`, { waitUntil: "networkidle" });
  await registrationPage.waitForSelector("#v30Entry:not([hidden])");
  await registrationPage.screenshot({
    path: path.join(outputDir, "registration-wide.png"),
    fullPage: false,
    animations: "disabled",
  });
  await registrationContext.close();

  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2,
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const problems = [];

  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !/status of (?:504|431)/.test(text)) problems.push(`console: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

  await page.route("**/api/health", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  );
  await page.route("**/api/ai", async (route) => {
    const payload = route.request().postDataJSON();
    const promptText = String(payload.prompt || "");
    if (String(payload.prompt || "").includes("FAIL_CAPTURE")) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI 请求超时，请稍后重试", requestId: "capture-timeout" }),
      });
      return;
    }
    if (payload.task === "grouping") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: JSON.stringify({
            groups: [{ image_indexes: [1], customer_name: "测试会话" }],
            uncertain_pairs: [],
          }),
          model: "deterministic-capture-fixture",
          requestId: "capture-grouping",
        }),
      });
      return;
    }
    if (promptText.includes("三个巴斯克") && promptText.includes("分装")) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: JSON.stringify({
            parse_ok: true,
            parse_failure_reason: "",
            customer: "测试顾客",
            items: [
              { product: "巴斯克蛋糕", qty: 3 },
              { product: "提拉米苏", qty: 1 },
            ],
            delivery_date: "2026-08-02",
            delivery_time: "16:00",
            method: "自取",
            address: "",
            customer_note: "巴斯克 ×1 需分装",
            customer_ref: "",
            urgent: false,
            confidence: {
              customer: "high",
              items: "high",
              delivery_date: "high",
              delivery_time: "high",
              method: "high",
              address: "high",
              customer_note: "high",
              customer_ref: "low",
            },
            reasons: { customer_ref: "没有可确认的账号信息" },
            missing_critical: [],
            follow_up: "",
          }),
          model: "deterministic-capture-fixture",
          requestId: "capture-special-requirement",
        }),
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: JSON.stringify({
          parse_ok: true,
          parse_failure_reason: "",
          customer: "测试顾客",
          items: [{ product: "抹茶巴斯克", qty: 2 }],
          delivery_date: "2026-08-02",
          delivery_time: "",
          method: "自取",
          address: "",
          customer_note: "少糖",
          customer_ref: "",
          urgent: false,
          confidence: {
            customer: "high",
            items: "high",
            delivery_date: "high",
            delivery_time: "low",
            method: "high",
            address: "high",
            customer_note: "high",
            customer_ref: "low",
          },
          reasons: {
            delivery_time: "顾客只说了下午",
            customer_ref: "没有可确认的账号信息",
          },
          missing_critical: ["delivery_time"],
          follow_up: "请确认具体取货时间。",
        }),
        model: "deterministic-capture-fixture",
        requestId: "capture-order",
      }),
    });
  });

  await page.addInitScript(({ duplicateFingerprint }) => {
    localStorage.setItem("sous:v7-setup-complete", "true");
    localStorage.setItem(
      "sous:business-profile:v1",
      JSON.stringify({
        businessName: "K&K Bakery",
        email: "portfolio@example.com",
        onboardingCompleted: true,
        starterTemplateId: "bakery",
      }),
    );
    localStorage.setItem(
      "sous:menu",
      JSON.stringify({
        巴斯克蛋糕: {
          price: 42,
          cost: 15,
          ingredients: [
            { name: "奶油奶酪", amount: 250, unit: "g" },
            { name: "鸡蛋", amount: 2, unit: "个" },
          ],
        },
        提拉米苏: {
          price: 38,
          cost: 14,
          ingredients: [
            { name: "马斯卡彭", amount: 180, unit: "g" },
            { name: "手指饼干", amount: 6, unit: "片" },
          ],
        },
        抹茶巴斯克: {
          price: 42,
          cost: 15,
          ingredients: [
            { name: "奶油奶酪", amount: 250, unit: "g" },
            { name: "鸡蛋", amount: 2, unit: "个" },
          ],
        },
        原味曲奇: {
          price: 18,
          cost: 6,
          ingredients: [{ name: "黄油", amount: 80, unit: "g" }],
        },
      }),
    );
    localStorage.setItem(
      "sous:orders",
      JSON.stringify([
        {
          id: 101,
          customer: "陈小姐",
          items: "抹茶巴斯克 ×1",
          date: "2026-08-01 14:00",
          time: "",
          method: "自取",
          address: "",
          note: "少糖",
          status: "pending",
          createdAt: "2026-07-28T10:00:00.000Z",
        },
        {
          id: 102,
          customer: "测试重复订单",
          items: "原味曲奇 ×2",
          date: "2026-08-03 16:00",
          time: "",
          method: "自取",
          address: "",
          note: "",
          status: "pending",
          sourceImages: [{ fingerprint: duplicateFingerprint }],
          createdAt: "2026-07-28T11:00:00.000Z",
        },
      ]),
    );
    localStorage.setItem("sous:customers", JSON.stringify([]));
    localStorage.setItem("sous:editLog", JSON.stringify([]));
  }, { duplicateFingerprint: uploadFingerprint });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#page-home.on");

  await capture(page, "home");
  await openPage(page, "intake");
  await capture(page, "intake");
  await page.locator("details.intake-text-details summary").click();

  await page.locator("#msgInput").fill("想订两个抹茶巴斯克，周日下午自取，少糖。");
  await page.locator("#parseBtn").click();
  await page.waitForSelector(".loading-center");
  await capture(page, "ai-processing");
  await page.waitForSelector("[data-draft-validation]", { timeout: 8000 });
  await page.locator("#parseArea").scrollIntoViewIfNeeded();
  await capture(page, "draft-missing");

  await page.locator("#f-delivery").fill("2026-08-02T16:00");
  await page.locator("#f-delivery").dispatchEvent("change");
  await page.waitForFunction(() => !document.querySelector("[data-create-order]")?.disabled);
  await page.locator("#parseArea").scrollIntoViewIfNeeded();
  await capture(page, "draft-ready");

  await page.locator("[data-create-order]").click();
  await page.waitForSelector("#page-orders.on");
  await capture(page, "order-created");
  await capture(page, "orders");

  await openPage(page, "prep");
  await capture(page, "prep");
  await openPage(page, "menu");
  await capture(page, "products");
  await openPage(page, "more");
  await capture(page, "more");
  await openPage(page, "content");
  await capture(page, "content");
  await openPage(page, "settings");
  await capture(page, "settings");

  await openPage(page, "intake");
  const textDetails = page.locator("details.intake-text-details");
  if (!(await textDetails.evaluate((element) => element.open))) await textDetails.locator("summary").click();
  await page.locator("#msgInput").fill("我要三个巴斯克，一个提拉米苏，巴斯克有一个能不能分装一下。");
  await page.locator("#parseBtn").click();
  await page.waitForSelector("[data-draft-validation]", { timeout: 8000 });
  const specialItems = await page.locator("#f-items").inputValue();
  const specialNote = await page.locator("#f-customer_note").inputValue();
  for (const expected of ["巴斯克蛋糕", "提拉米苏"]) {
    if (!specialItems.includes(expected)) throw new Error(`Special-requirement items are missing: ${expected}`);
  }
  if (!specialNote.includes("需分装")) throw new Error(`Special requirement is not in the note field: ${specialNote}`);
  await page.locator("#parseArea").scrollIntoViewIfNeeded();
  await capture(page, "draft-special-requirement");

  await page.reload({ waitUntil: "networkidle" });
  await openPage(page, "intake");
  const errorDetails = page.locator("details.intake-text-details");
  if (!(await errorDetails.evaluate((element) => element.open))) await errorDetails.locator("summary").click();
  await page.locator("#msgInput").fill("FAIL_CAPTURE");
  await page.locator("#parseBtn").click();
  await page.waitForSelector(".fail-center");
  await capture(page, "error-recovery");

  await page.locator("#msgInput").fill("");
  await page.locator("#shotInput").setInputFiles(uploadPath);
  await page.waitForSelector("#imgThumbs img");
  await page.locator("#parseBtn").click();
  await page.waitForSelector("#duplicateOrderDialog:not([hidden])");
  await capture(page, "duplicate-warning");

  await browser.close();

  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Captured SOUS Case Study assets from ${baseUrl}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
