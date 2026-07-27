const { chromium } = require("playwright");

// Dedicated test origin. It is intentionally different from the user's live 8124 app,
// so localStorage mutations cannot touch real SOUS data.
const APP = "http://127.0.0.1:8134/";
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function resetIsolatedTestOrigin(page) {
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
}

async function fillBusiness(page, name = "测试工作室", email = "owner@example.com") {
  await page.locator("#v7Business").fill(name);
  await page.locator("#v7Email").fill(email);
  await page.locator("[data-v7-next]").click();
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await resetIsolatedTestOrigin(page);
  assert(await page.locator("#sousSetup").isVisible(), "fresh user should see setup");
  assert((await page.locator("#v7Business").count()) === 1, "business field missing");
  assert((await page.locator("#v7Email").count()) === 1, "email field missing");
  assert((await page.locator("[data-industry]").count()) === 0, "legacy industry selector remains");

  await fillBusiness(page);
  const templateNames = await page.locator("[data-v7-template]").allTextContents();
  for (const expected of ["烘焙甜品", "鲜花花艺", "餐食料理", "手作产品", "从空白开始"]) {
    assert(templateNames.some((value) => value.includes(expected)), `template missing: ${expected}`);
  }

  await page.locator('[data-v7-template="floristry"]').click();
  await page.locator("[data-v7-preview]").click();
  await page.waitForTimeout(100);
  assert((await page.locator("[data-preview-product]").count()) === 3, "product preview count");
  assert((await page.locator("[data-preview-material]").count()) === 5, "material preview count");
  assert((await page.locator("[data-preview-fulfillment]").count()) === 3, "fulfillment preview count");
  assert((await page.locator(".v7-recipe").count()) === 3, "recipe preview missing");

  await page.locator('[data-preview-product="floristry-table-flower"]').uncheck();
  await page.waitForTimeout(100);
  await page.locator("[data-v7-import]").click();
  await page.waitForTimeout(500);

  const imported = await page.evaluate(() => ({
    menu: JSON.parse(localStorage.getItem("sous:menu") || "{}"),
    materials: JSON.parse(localStorage.getItem("sous:materials") || "[]"),
    profile: JSON.parse(localStorage.getItem("sous:business-profile:v1") || "{}"),
  }));
  assert(Object.keys(imported.menu).length === 2, "partial product import failed");
  assert(imported.menu["韩式花束"].isExample === true, "example flag missing");
  assert(imported.menu["韩式花束"].active === false, "example should be inactive");
  assert(imported.materials.every((item) => item.isExample === true), "material example flag missing");
  assert(imported.profile.starterTemplateId === "floristry", "starter template id missing");
  assert(imported.profile.industry === undefined, "industry should not remain active");

  const navText = await page.locator("nav.tabs").innerText();
  for (const word of ["首页", "录单", "订单", "备货", "更多"]) {
    assert(navText.includes(word), `generic nav missing: ${word}`);
  }
  assert(!/备花|备餐/.test(navText), "industry nav term remains");

  await page.evaluate(() => go("menu"));
  await page.waitForTimeout(120);
  assert((await page.locator(".example-badge").count()) === 2, "example badge missing");
  await page.locator('[data-activate-example="韩式花束"]').click();
  await page.waitForTimeout(220);
  const promoted = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sous:menu"))["韩式花束"],
  );
  assert(promoted.isExample === false && promoted.active === true, "promotion failed");

  const prompt = await page.evaluate(() => buildParsePrompt("想订一束韩式花束", null));
  assert(prompt.includes("韩式花束"), "active catalog missing from AI context");
  assert(!prompt.includes("花盒；材料"), "inactive example leaked into AI catalog");
  assert(prompt.includes("不得据此断言店铺行业"), "industry inference guard missing");

  await page.evaluate(async () => {
    orders = [
      { id: 1, customer: "甲", items: "韩式花束 ×2", status: "pending", date: "2026-07-30" },
      { id: 2, customer: "乙", items: "花盒 ×1", status: "pending", date: "2026-07-30" },
    ];
    await store.set("orders", orders);
    go("prep");
    renderPrepTable();
  });
  await page.waitForTimeout(250);
  const prepText = await page.locator("#prepTable").innerText();
  assert(prepText.includes("商品需求量"), "product demand missing");
  assert(prepText.includes("韩式花束"), "active product demand missing");
  assert(
    prepText.includes("花盒") && prepText.includes("未匹配到正式商品"),
    "example exclusion warning missing",
  );
  assert(prepText.includes("建议采购"), "deterministic purchase result missing");

  await resetIsolatedTestOrigin(page);
  await fillBusiness(page, "空白工作室", "blank@example.com");
  await page.locator("[data-v7-blank]").click();
  await page.waitForTimeout(250);
  const blank = await page.evaluate(() => ({
    setupVisible: !document.getElementById("sousSetup").hidden,
    menu: JSON.parse(localStorage.getItem("sous:menu") || "{}"),
  }));
  assert(blank.setupVisible === false, "blank flow should enter workspace");
  assert(Object.keys(blank.menu).length === 0, "blank flow should not seed catalog");

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sous:business-profile:v1", JSON.stringify({
      email: "legacy@example.com",
      businessName: "旧花店",
      industry: "florist",
      customTerms: { item: "花礼", material: "花材" },
      channels: ["私聊"],
      fulfillment: ["配送"],
    }));
    localStorage.setItem("sous:menu", JSON.stringify({
      "真实商品": { price: 88, cost: 30, ings: { "真实材料 (件)": 1 } },
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(950);
  const migrated = await page.evaluate(() => ({
    profile: JSON.parse(localStorage.getItem("sous:business-profile:v1")),
    backup: JSON.parse(localStorage.getItem("sous:legacy-industry-backup:v1")),
    menu: JSON.parse(localStorage.getItem("sous:menu")),
    nav: document.querySelector("nav.tabs").innerText,
  }));
  assert(migrated.profile.starterTemplateId === "floristry", "legacy industry migration failed");
  assert(migrated.backup.customTerms.item === "花礼", "legacy custom term backup missing");
  assert(migrated.menu["真实商品"].isExample === false, "real product should stay formal");
  assert(
    migrated.nav.includes("备货") && !migrated.nav.includes("备花"),
    "generic nav not restored",
  );

  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({
    ok: true,
    templateOptions: templateNames.length,
    importedProducts: Object.keys(imported.menu).length,
    importedMaterials: imported.materials.length,
    aiCatalogUpdated: true,
    prepFilteredExamples: true,
    blankStart: true,
    migration: true,
  }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
