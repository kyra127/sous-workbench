const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const out = "C:/Users/邱钶馨/Documents/SOUS/design-audit/v31.14";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 784, height: 790 } });
  await page.addInitScript(() => {
    localStorage.setItem("sous:v7-setup-complete", "true");
    localStorage.setItem("sous:business-profile:v1", JSON.stringify({ businessName: "QA Business", onboardingCompleted: true, starterTemplateId: "food" }));
  });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:8124/?v=20260727-v31.14", {
    waitUntil: "networkidle",
  });

  await page.evaluate(() => {
    const dialog = document.getElementById("v6Dialog");
    dialog.hidden = false;
    dialog.querySelector("#v6DialogTitle").textContent = "订单还没有保存";
    dialog.querySelector("#v6DialogCopy").textContent =
      "离开后草稿仍保留在本次会话中，你可以稍后回来继续。";
    dialog.querySelector("[data-dialog-confirm]").textContent = "仍然离开";
  });
  const dialog = await page.evaluate(() => {
    const card = document.querySelector(".v6-dialog");
    const backdrop = document.querySelector(".v6-dialog-backdrop");
    const nav = document.querySelector("nav.tabs");
    const cardRect = card.getBoundingClientRect();
    const backdropRect = backdrop.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return {
      text: card.innerText,
      card: [cardRect.x, cardRect.y, cardRect.width, cardRect.height],
      backdrop: [backdropRect.x, backdropRect.y, backdropRect.width, backdropRect.height],
      nav: [navRect.x, navRect.y, navRect.width, navRect.height],
      z: [getComputedStyle(backdrop).zIndex, getComputedStyle(nav).zIndex],
      overflow: getComputedStyle(document.body).overflow,
    };
  });
  await page.screenshot({ path: `${out}/dialog.png` });

  await page.evaluate(() => {
    document.getElementById("v6Dialog").hidden = true;
    window.go("intake");
    document.querySelectorAll(".page").forEach((page) => page.classList.remove("on"));
    document.getElementById("page-intake").classList.add("on");
    document.getElementById("parseArea").id = "parseAreaOriginal";
    const fixture = document.createElement("div");
    fixture.id = "parseArea";
    fixture.style.cssText = "position:fixed;inset:24px auto auto 72px;width:640px;z-index:9999;display:block";
    document.body.append(fixture);
    fixture.innerHTML = `
      <div class="card">
        <div class="append-box">
          <div class="at">追加这条消息到当前订单</div>
          <div class="ad">顾客补充了新需求？追加消息后将自动合并进这张订单。</div>
          <button class="btn ghost small">从剪贴板追加消息</button>
        </div>
        <div class="draft-actions">
          <button class="btn ghost" data-save-pending>保存，稍后确认</button>
          <button class="btn primary" data-create-order disabled>还需补全 2 项</button>
          <button class="btn ghost">取消</button>
        </div>
        <p class="draft-validation">创建正式订单前还需补充：交付时间、取货方式。</p>
        <p class="hint-line">点击任意字段可修改 · 黄色为 AI 不确定的部分</p>
      </div>`;
    document.getElementById("parseArea").scrollIntoView({ block: "center" });
  });
  const actions = await page.evaluate(() => {
    const group = document.querySelector(".draft-actions");
    const append = document.querySelector(".append-box");
    const groupRect = group.getBoundingClientRect();
    const appendRect = append.getBoundingClientRect();
    const buttons = [...group.children].map((element) => {
      const rect = element.getBoundingClientRect();
      return [
        element.textContent.trim(),
        Math.round(rect.x),
        Math.round(rect.y),
        Math.round(rect.width),
        Math.round(rect.height),
      ];
    });
    return {
      group: [groupRect.x, groupRect.y, groupRect.width, groupRect.height],
      append: [appendRect.x, appendRect.y, appendRect.width, appendRect.height],
      buttons,
    };
  });
  await page.screenshot({ path: `${out}/actions.png` });
  console.log(JSON.stringify({ dialog, actions, errors }));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
