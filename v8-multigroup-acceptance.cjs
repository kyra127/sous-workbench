process.env.NODE_PATH =
  "C:/Users/邱钶馨/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
require("module").Module._initPaths();
const { chromium } = require("playwright");
const assert = (value, message) => {
  if (!value) throw new Error(message);
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:8136/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "sous:business-profile:v1",
      JSON.stringify({ businessName: "测试店铺", email: "owner@example.com" }),
    );
    localStorage.setItem("sous:v7-setup-complete", "true");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.evaluate(() => go("intake"));

  await page.evaluate(() => {
    const pixel =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXcAAAAASUVORK5CYII=";
    pendingImages = [0, 1, 2].map((index) => ({
      id: `image-${index + 1}`,
      data: pixel,
      type: "image/png",
      url: `data:image/png;base64,${pixel}`,
    }));
    callAI = async () => JSON.stringify({
      groups: [{ id: "group-1", image_indexes: [1, 2, 3], customer_name: null }],
      uncertain_pairs: []
    });
    renderThumbs();
  });
  await page.locator("[data-adjust-grouping]").waitFor();
  await page.locator("[data-adjust-grouping]").click();
  assert(await page.locator("#conversationGrouping").isVisible(), "grouping panel missing");
  assert((await page.locator(".conversation-group").count()) === 1, "unexpected initial groups");

  await page.locator("[data-add-conversation]").click();
  await page.waitForTimeout(80);
  const thirdSelect = page.locator('[data-image-group="image-3"]');
  await thirdSelect.selectOption("group-2");
  await page.waitForTimeout(100);
  assert((await page.locator(".conversation-group").count()) === 2, "second customer group missing");
  const counts = await page.locator(".conversation-title > span").allTextContents();
  assert(counts.includes("2 张") && counts.includes("1 张"), "2+1 grouping incorrect");

  await page.evaluate(() => {
    callAI = async (prompt) => {
      const second = prompt.includes("顾客 2");
      return JSON.stringify({
        parse_ok: true,
        customer: second ? "顾客 B" : "顾客 A",
        items: [{ product: second ? "司康" : "巴斯克蛋糕", qty: second ? 1 : 2 }],
        delivery_date: "2026-07-30",
        delivery_time: "15:00",
        method: "自取",
        address: "",
        customer_note: "",
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
          customer_ref: "high",
        },
        reasons: {},
        missing_critical: [],
        follow_up: "",
      });
    };
  });
  await page.locator("#parseBtn").click();
  await page.waitForFunction(() => document.querySelectorAll(".draft-queue-tabs button").length === 2);
  assert((await page.locator(".draft-queue-tabs button").count()) === 2, "two drafts not generated");
  assert((await page.locator("#f-customer").inputValue()) === "顾客 A", "first draft customer wrong");
  assert((await page.locator("#f-items").inputValue()).includes("巴斯克蛋糕"), "first draft items wrong");

  await page.locator("[data-create-order]").click();
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => document.querySelector("#f-customer")?.value === "顾客 B", { timeout: 3000 });
  assert((await page.locator("#f-items").inputValue()).includes("司康"), "second draft did not activate");
  await page.locator("[data-create-order]").click();
  await page.waitForFunction(() => {
    const value = localStorage.getItem("sous:orders") || "[]";
    return JSON.parse(value).length === 2;
  });

  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem("sous:orders") || "[]"));
  const customerA = orders.find((order) => order.customer === "顾客 A");
  const customerB = orders.find((order) => order.customer === "顾客 B");
  assert(customerA && customerB, "formal orders missing");
  assert(customerA.items.includes("巴斯克蛋糕") && !customerA.items.includes("司康"), "customer A contaminated");
  assert(customerB.items.includes("司康") && !customerB.items.includes("巴斯克"), "customer B contaminated");
  assert(customerA.sourceImages.length === 2, "customer A sources incorrect");
  assert(customerB.sourceImages.length === 1, "customer B sources incorrect");
  assert(errors.length === 0, `page errors: ${errors.join(" | ")}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        grouping: "2+1",
        draftQueue: 2,
        formalOrders: 2,
        sourceTraceability: true,
        crossCustomerContamination: false,
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
