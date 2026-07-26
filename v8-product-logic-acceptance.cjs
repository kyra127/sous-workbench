process.env.NODE_PATH =
  "C:/Users/邱钶馨/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
require("module").Module._initPaths();
const { chromium } = require("playwright");

const APP = "http://127.0.0.1:8136/?firstUse=1";
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#v30Entry").waitFor({ state: "visible" });
  await page.locator("#v30BusinessName").fill("测试工作室");
  await page.locator("#v30Email").fill("owner@example.com");
  await page.locator("#v30EntryForm").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(
    () => document.querySelector('[data-v7-step="1"]')?.classList.contains("on"),
  );
  await page.locator("[data-v7-template='bakery']").click();
  await page.locator("[data-v7-preview]").click();
  assert((await page.locator("[data-preview-product]").count()) > 0, "product preview missing");
  assert((await page.locator("[data-preview-material]").count()) === 0, "materials still in import preview");
  assert((await page.locator("[data-preview-fulfillment]").count()) === 0, "fulfillment still in import preview");
  assert((await page.locator(".v7-recipe").count()) === 0, "recipes still in import preview");

  await page.locator("[data-v7-import]").click();
  await page.waitForTimeout(450);
  const imported = await page.evaluate(() => ({
    menu: JSON.parse(localStorage.getItem("sous:menu") || "{}"),
    materials: JSON.parse(localStorage.getItem("sous:materials") || "[]"),
  }));
  const firstImported = Object.values(imported.menu)[0];
  assert(firstImported && firstImported.active === true, "imported product not active");
  assert(firstImported.isExample === false, "imported product still marked as example");
  assert(
    Array.isArray(firstImported.ingredients) && firstImported.ingredients.length === 0,
    "recipe materials imported unexpectedly",
  );
  assert(imported.materials.length === 0, "materials imported unexpectedly");

  await page.evaluate(async () => {
    menu = {
      "巴斯克蛋糕": {
        id: "catalog-basque",
        price: 58,
        cost: 18,
        unit: "个",
        active: true,
        isExample: false,
        ingredients: [{ name: "奶油奶酪", unit: "g", amount: 250 }],
        ings: { "奶油奶酪 (g)": 250 },
      },
    };
    orders = [
      {
        id: "order-fuzzy",
        customer: "测试客户",
        items: "巴斯克 ×2",
        status: "pending",
        date: "2026-07-30",
      },
    ];
    await store.set("menu", menu);
    await store.set("orders", orders);
    renderAll();
    go("menu");
  });
  await page.waitForTimeout(180);
  await page.locator("[data-toggle-product-edit]").click();
  const unit = page.locator("select[id^='ing-unit-']").first();
  await unit.selectOption("m");
  await page.waitForTimeout(220);
  const savedUnit = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sous:menu") || "{}")["巴斯克蛋糕"].ingredients[0].unit,
  );
  assert(savedUnit === "m", "unit change did not persist");

  await page.evaluate(() => {
    go("prep");
    renderPrepTable();
  });
  await page.waitForTimeout(250);
  const prepText = await page.locator("#prepTable").innerText();
  assert(prepText.includes("巴斯克蛋糕"), "short product name did not match catalog");
  assert(prepText.includes("关键词匹配") || prepText.includes("简称匹配"), "match reason missing");
  assert(prepText.includes("500.0 m"), "deterministic material calculation missing");
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(" | ")}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        welcome: true,
        channels: true,
        productOnlyImport: true,
        formalCatalog: true,
        unitChange: true,
        fuzzyPrepMatch: true,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
