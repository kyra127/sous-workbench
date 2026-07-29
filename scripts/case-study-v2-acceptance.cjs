const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "case-study-v2.html");
const cssPath = path.join(root, "case-study-v2.css");
const jsPath = path.join(root, "case-study-v2.js");
const serverPath = path.join(root, "workbench-server.mjs");

const html = fs.readFileSync(htmlPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");
const server = fs.readFileSync(serverPath, "utf8");
const failures = [];

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const pages = [...html.matchAll(/<section id="p(\d{2})" class="story-page/g)].map((match) => match[1]);
expect(pages.length === 21, `expected 21 story pages, found ${pages.length}`);
expect(new Set(pages).size === 21, "story page ids must be unique");
expect(pages[0] === "01" && pages.at(-1) === "21", "story pages must run from P01 to P21");

[
  "订单是怎么丢的？",
  "这应该是一个 AI 助手，还是一个经营系统？",
  "为什么 AI 不能替经营者做决定？",
  "AI 不确定的时候，界面应该说什么？",
  "真实经营中的使用",
  "从做出功能，",
].forEach((copy) => expect(html.includes(copy), `missing required outline copy: ${copy}`));

[
  "/case-assets/home.png",
  "/case-assets/intake.png",
  "/case-assets/draft-missing.png",
  "/case-assets/draft-ready.png",
  "/case-assets/orders.png",
  "/case-assets/prep.png",
  "/case-assets/products.png",
  "/case-assets/real-chat-confirmation.jpg",
].forEach((asset) => {
  expect(html.includes(asset), `missing real product asset reference: ${asset}`);
  expect(fs.existsSync(path.join(root, asset.replace(/^\//, ""))), `asset does not exist: ${asset}`);
});

expect(!/\b(?:GPT|Claude|LLM|Prompt)\b/i.test(html), "v2 visible content includes a banned implementation term");
expect(html.includes("产品效果仍需用真实订单比较"), "evidence page must distinguish prototype evidence from product outcomes");
expect(html.includes("跨行业适用性仍需要后续验证"), "cross-industry claim must remain explicitly unverified");
expect(html.includes("历史能力尚待真实验证"), "customer-history context must not be presented as a verified capability");
expect(html.includes("团队协作与订阅方案不是当前承诺"), "roadmap hypotheses must not be presented as commitments");

expect(css.includes("@media (prefers-reduced-motion: reduce)"), "missing reduced-motion support");
expect(css.includes("@media print"), "missing print/PDF layout support");
expect(js.includes("IntersectionObserver"), "missing section/reveal observer");
expect(js.includes("showModal"), "missing product screenshot lightbox");
expect(server.includes('pathname === "/projects/sous-v2"'), "v2 route is not registered");
expect(server.includes('"/case-study-v2.css"'), "v2 stylesheet route is not registered");
expect(server.includes('"/case-study-v2.js"'), "v2 script route is not registered");

const altlessImages = [...html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)];
expect(altlessImages.length === 0, `found ${altlessImages.length} image(s) without alt`);

if (failures.length) {
  console.error("SOUS v2 acceptance failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`SOUS v2 acceptance passed: ${pages.length} pages, factual labels, real assets, route and accessibility hooks verified.`);
