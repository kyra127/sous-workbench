const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "case-study.html"), "utf8");
const css = fs.readFileSync(path.join(root, "case-study.css"), "utf8");
const js = fs.readFileSync(path.join(root, "case-study.js"), "utf8");
const server = fs.readFileSync(path.join(root, "workbench-server.mjs"), "utf8");

const sections = ["problem", "conditions", "pain", "definition", "ai", "scope", "architecture", "journey", "gallery", "decisions", "evidence", "design-system", "reflection"];
for (const id of sections) if (!html.includes(`id="${id}"`)) throw new Error(`Missing section: ${id}`);
let lastPosition = -1;
for (const id of sections) {
  const position = html.indexOf(`id="${id}"`);
  if (position <= lastPosition) throw new Error(`Section order is incorrect at: ${id}`);
  lastPosition = position;
}
for (const removedId of ["strategy", "iteration", "evaluation"]) if (html.includes(`id="${removedId}"`)) throw new Error(`Removed section returned: ${removedId}`);
if (!server.includes('pathname === "/projects/sous"')) throw new Error("Missing Case Study route");
for (const asset of ["home.png", "intake.png", "ai-processing.png", "draft-missing.png", "draft-ready.png", "draft-special-requirement.png", "orders.png", "prep.png", "products.png", "content.png", "settings.png", "error-recovery.png", "duplicate-warning.png", "registration-wide.png", "problem-flow-background-v1.png", "real-chat-confirmation.jpg", "real-order-notes.jpg", "real-excel-cost-sheet.jpg"]) {
  if (!server.includes(`/case-assets/${asset}`)) throw new Error(`Missing asset route: ${asset}`);
}
if (!css.includes("prefers-reduced-motion")) throw new Error("Missing reduced motion support");
if (!css.includes("/* Typography and reading-density audit. */") || !css.includes('content:"→"') || !css.includes("width:86px;height:8px")) throw new Error("Typography-density or pain-flow refinement missing");
if (!css.includes("/* Detail refinement: pain spacing and integrated evidence case. */") || !css.includes("border-radius:22px;background:#fff;overflow:hidden")) throw new Error("Final detail refinement missing");
if (!css.includes("/* Final design review: denser reading rhythm and one visual system. */") || !html.includes("SOUS 的 AI 系统边界") || !html.includes("context-strip")) throw new Error("Final AI boundary refinement missing");
if (!css.includes(".phone-mockup") || !js.includes("phoneMockup")) throw new Error("PhoneMockup abstraction missing");
for (const config of ["PRODUCT_SCREENS", "BOUNDARY_SCREENS", "PRIMARY_STEPS", "RECOVERY_STORIES"]) if (!js.includes(`const ${config}`)) throw new Error(`Missing config: ${config}`);
const productConfig = js.match(/const PRODUCT_SCREENS = \[([\s\S]*?)\n\];/)?.[1] || "";
if ((productConfig.match(/image:/g) || []).length !== 6) throw new Error("Final product gallery must contain six real product screens");
if ((productConfig.match(/purpose:/g) || []).length !== 6) throw new Error("Every gallery screen must explain its function");
if (!html.includes('<h1 class="hero-wordmark">SOUS') || !html.includes("hero-positioning")) throw new Error("Hero structure changed");
const expectedTitles = ["问题与现有工作流", "用户痛点", "目标用户与适用场景", "产品形态选择", "SOUS 的 AI 系统边界", "MVP 范围与取舍", "产品架构", "核心用户流程", "关键产品决策", "验证证据与迭代", "真实产品界面", "交互与状态规范", "反思与下一步"];
for (const title of expectedTitles) if (!html.includes(`>${title}</h2>`)) throw new Error(`Unified section title missing: ${title}`);
if ((html.match(/class="section-title"/g) || []).length !== expectedTitles.length) throw new Error("Section-title hierarchy is inconsistent");
if (!html.includes("产品机会：把聊天内容整理成可确认的订单草稿。")) throw new Error("Product opportunity statement missing");
if (!css.includes("/* Unified topic-first section title system. */")) throw new Error("Unified title styling missing");
if (!html.includes('id="conditionsTitle" class="section-title">目标用户与适用场景</h2>')) throw new Error("Applicability section headline missing");
if (!html.includes('id="definitionTitle" class="section-title">产品形态选择</h2>') || !html.includes("轻量经营工作台")) throw new Error("Product definition decision missing");
if (!html.includes("context-strip") || !html.includes("顾客上次订单")) throw new Error("Compact model context boundary missing");
if ((js.match(/owner:/g) || []).length !== 4) throw new Error("Core interaction must contain four real states");
if ((js.match(/number: "0[12]"/g) || []).length !== 2) throw new Error("Recovery flow must contain two scenarios");
if ((html.match(/<article><span>0[123]<\/span><h3>/g) || []).length < 3) throw new Error("Applicability conditions are incomplete");
for (const removedCopy of ["一个已确认场景，两类待验证经营模式。", "四类风险", "固定入口或专业服务", "只保留承担明确产品责任的页面。", "商品资料本身就是行业信息，不需要再问一次。", "内容功能复用正式商品资料"]) {
  if (html.includes(removedCopy)) throw new Error(`Removed or duplicate copy returned: ${removedCopy}`);
}
if (!html.includes("取消行业配置，改用商品目录") || !html.includes("按使用频率组织导航")) throw new Error("Key product decisions are incomplete");
if (!html.includes("一次真实字段修正") || !html.includes("巴斯克 ×1 需分装")) throw new Error("Real recognition correction missing");
if (!html.includes("30–50 条匿名化历史订单") || !html.includes("建单时间") || !html.includes("evidence-status-grid")) throw new Error("Evidence and validation plan missing");
if ((html.match(/class="section-end-summary/g) || []).length !== 2) throw new Error("Only the two narrative-turn summaries should remain");
if (!html.includes("galleryDialog") || !js.includes("bindPrimaryInteraction")) throw new Error("Presentation interactions missing");
if (!html.includes("pain-matrix") || !html.includes("产品机会：把聊天内容整理成可确认的订单草稿。")) throw new Error("Standalone user-pain section missing");
if (!html.includes("design-typography") || !html.includes("Hanken Grotesk") || !html.includes("03 / CORE COMPONENTS")) throw new Error("Professional design-system specification missing");
if ((html.match(/class="architecture-module(?: |")/g) || []).length !== 4) throw new Error("Product architecture must contain four operating modules");
for (const architectureCopy of ["商品与订单资料", "多模态模型 + 人工确认", "规则引擎（自动计算）+ 人工操作", "规则引擎（算）+ LLM（说）", "LLM（文案）+ 图像模型（海报）", "截图识别（多模态）", "顾客记忆", "修正记录", "多模态：识别与生成"]) if (!html.includes(architectureCopy)) throw new Error(`Architecture content missing: ${architectureCopy}`);
if ((html.match(/scope-excluded-reasons/g) || []).length < 1 || (html.match(/<section><span>0[1-4]<\/span><h3>/g) || []).length !== 4) throw new Error("MVP exclusions must be grouped by four decision reasons");
if (!html.includes("只保留验证“聊天能否稳定转为订单”的必要能力") || !html.includes("消息输入 → 草稿确认 → 正式订单 → 备货")) throw new Error("MVP scope rationale is incomplete");
if (/<img(?![^>]*\balt=)/i.test(html)) throw new Error("Static image without alt");
if (!html.includes("reflection-lessons") || html.includes("evidence-roadmap")) throw new Error("Reflection content or removed roadmap state is incorrect");
if (!html.includes("先判断错误会造成什么后果") || !html.includes("原型做得太快，真实验证跟得太慢") || !html.includes("单一真实场景不足以证明普适性")) throw new Error("Rewritten reflection content missing");
if (html.includes("reflection-gate") || html.includes("下一步优化")) throw new Error("Reflection still contains the removed optimization gate");
for (const source of ["/case-assets/ai-processing.png", "/case-assets/draft-missing.png", "/case-assets/draft-ready.png"]) if (!js.includes(source)) throw new Error(`Boundary state missing: ${source}`);
const aiSection = html.slice(html.indexOf('<section id="ai"'), html.indexOf('<section id="scope"'));
const decisionSection = html.slice(html.indexOf('<section id="decisions"'), html.indexOf('<section id="evidence"'));
if (!aiSection.includes("ai-fit-matrix") || decisionSection.includes("ai-fit-matrix") || aiSection.indexOf("ai-fit-matrix") > aiSection.indexOf("boundaryScreens") || !css.includes("/* Compact AI intervention decision framework. */")) throw new Error("AI intervention framework must precede the responsibility evidence in the AI section");
console.log("Case study fusion static acceptance passed.");
