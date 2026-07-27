(() => {
  "use strict";

  const PROFILE_KEY = "sous:business-profile:v1";
  const FORCE_PARAM = "firstUse";

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function markup(profile = {}) {
    const businessName = String(profile.businessName || "").replaceAll('"', "&quot;");
    const email = String(profile.email || "").replaceAll('"', "&quot;");
    return `
      <section class="v30-entry" id="v30Entry" aria-labelledby="v30EntryTitle">
        <div class="v30-entry-brand">
          <span class="v30-entry-logo">SOUS.</span>
        </div>
        <div class="v30-entry-sheet">
          <div class="v30-entry-handle" aria-hidden="true"></div>
          <div class="v30-entry-emblem" aria-hidden="true">
            <img src="/sous-mark-v1.png" alt="">
          </div>
          <div class="v30-entry-copy">
            <h1 id="v30EntryTitle">欢迎使用 SOUS</h1>
            <p>先告诉我们您的店铺信息，接下来设置在售商品。</p>
          </div>
          <form class="v30-entry-form" id="v30EntryForm" novalidate>
            <div class="v30-entry-field">
              <label for="v30BusinessName">店铺名称</label>
              <input id="v30BusinessName" name="businessName" autocomplete="organization" placeholder="例如：KK Bakery" value="${businessName}" aria-describedby="v30EntryError">
            </div>
            <div class="v30-entry-field">
              <label for="v30Email">邮箱</label>
              <input id="v30Email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="${email}" aria-describedby="v30EntryError">
            </div>
            <p class="v30-entry-error" id="v30EntryError" role="alert" hidden></p>
            <button class="v30-entry-submit" type="submit">继续设置</button>
            <p class="v30-entry-note">无需密码。信息只用于建立当前本地工作台。</p>
          </form>
        </div>
      </section>`;
  }

  function showIndustryStep(businessName, email) {
    const shell = document.getElementById("sousSetup");
    if (!shell) return false;

    shell.classList.remove("v7-settings-mode");
    shell.hidden = false;
    document.body.classList.add("setup-open");
    shell.querySelectorAll("[data-v7-step]").forEach((screen) => screen.classList.remove("on"));
    const welcome = shell.querySelector('[data-v7-step="-1"]');
    welcome?.classList.add("on");
    shell.querySelector("[data-v7-welcome]")?.click();

    const businessInput = document.getElementById("v7Business");
    const emailInput = document.getElementById("v7Email");
    if (businessInput) businessInput.value = businessName;
    if (emailInput) emailInput.value = email;
    shell.querySelector("[data-v7-next]")?.click();
    const industryBack = shell.querySelector('[data-v7-step="1"] [data-v7-prev]');
    if (industryBack) {
      industryBack.textContent = "返回注册页";
      industryBack.setAttribute("aria-label", "返回注册页");
    }
    return true;
  }

  function showEntry() {
    const entry = document.getElementById("v30Entry");
    const shell = document.getElementById("sousSetup");
    if (!entry) return;
    if (shell) shell.hidden = true;
    document.body.classList.remove("setup-open");
    entry.hidden = false;
    document.body.classList.add("v30-entry-open");
    entry.querySelector("#v30BusinessName")?.focus();
  }

  function bindIndustryBack() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest('#sousSetup [data-v7-step="1"] [data-v7-prev]');
      if (!button) return;
      const industryStep = button.closest('[data-v7-step="1"]');
      if (!industryStep?.classList.contains("on")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showEntry();
    }, true);
  }

  function bindEntry(entry) {
    const form = entry.querySelector("#v30EntryForm");
    const businessInput = entry.querySelector("#v30BusinessName");
    const emailInput = entry.querySelector("#v30Email");
    const error = entry.querySelector("#v30EntryError");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const businessName = businessInput?.value.trim() || "";
      const email = emailInput?.value.trim() || "";
      const invalidEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      businessInput?.setAttribute("aria-invalid", String(!businessName));
      emailInput?.setAttribute("aria-invalid", String(invalidEmail));

      if (!businessName || invalidEmail) {
        error.textContent = !businessName ? "请填写店铺名称。" : "请填写有效的邮箱地址。";
        error.hidden = false;
        (!businessName ? businessInput : emailInput)?.focus();
        return;
      }

      error.hidden = true;
      const previous = readProfile() || {};
      writeProfile({
        ...previous,
        businessName,
        email,
        createdAt: previous.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      entry.hidden = true;
      document.body.classList.remove("v30-entry-open");
      let attempts = 0;
      const advance = () => {
        attempts += 1;
        if (showIndustryStep(businessName, email) || attempts >= 20) return;
        window.setTimeout(advance, 150);
      };
      advance();
    });
  }

  function normalizeScreenshotRemoveButtons() {
    document.querySelectorAll("#imgThumbs > span > button").forEach((button, index) => {
      button.type = "button";
      button.textContent = "×";
      button.setAttribute("aria-label", `删除第 ${index + 1} 张截图`);
      button.setAttribute("title", `删除第 ${index + 1} 张截图`);
    });
  }

  function enhanceBrand() {
    const logo = document.querySelector("header.top .logo");
    if (!logo || logo.querySelector(".v30-brand-mark")) return;
    const mark = document.createElement("img");
    mark.className = "v30-brand-mark";
    mark.src = "/sous-mark-v1.png";
    mark.alt = "";
    mark.setAttribute("aria-hidden", "true");
    logo.prepend(mark);
  }

  function compactHeaderSubtitle() {
    const subtitle = document.querySelector("header.top .logo-sub");
    if (!subtitle) return;

    const profile = readProfile() || {};
    const source = String(profile.businessName || subtitle.textContent || "");
    const parts = source
      .split("·")
      .map((part) => part.trim())
      .filter((part) => part && part !== "新业务" && part !== "经营助手");
    const uniqueParts = [...new Set(parts)];
    const businessLabel = uniqueParts.slice(0, 2).join(" · ") || "当前业务";
    const compactLabel = `${businessLabel} · 经营助手`;

    if (subtitle.textContent.trim() !== compactLabel) {
      subtitle.textContent = compactLabel;
    }
    subtitle.title = source || compactLabel;
  }
  function watchHeaderSubtitle() {
    const subtitle = document.querySelector("header.top .logo-sub");
    if (!subtitle || subtitle.dataset.v30CompactWatch === "true") return;
    subtitle.dataset.v30CompactWatch = "true";
    new MutationObserver(compactHeaderSubtitle).observe(subtitle, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  function addHomeQuickTools() {
    const home = document.getElementById("page-home");
    const hero = home?.querySelector(".hero");
    if (!home || !hero) return;

    let tools = document.getElementById("v30HomeQuickTools");
    if (!tools) {
      tools = document.createElement("section");
      tools.id = "v30HomeQuickTools";
      tools.className = "v30-home-quick-tools";
      tools.setAttribute("aria-label", "常用工具");
      tools.innerHTML = `
        <button type="button" class="v30-home-quick-tool" data-v30-target="menu">
          <span class="v30-home-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3.8h12v16.4H6zM9 8h6M9 12h6M9 16h4"/></svg></span>
          <span class="v30-home-quick-copy"><b>商品管理</b><small>商品与材料</small></span>
          <span class="v30-home-quick-arrow" aria-hidden="true">›</span>
        </button>
        <button type="button" class="v30-home-quick-tool" data-v30-target="content">
          <span class="v30-home-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 18 1.2-4.7L16.8 2.7l4.5 4.5L10.7 17.8zM5 18l4.7-1.2M14.7 4.8l4.5 4.5"/></svg></span>
          <span class="v30-home-quick-copy"><b>AI 内容助手</b><small>文案与图片</small></span>
          <span class="v30-home-quick-arrow" aria-hidden="true">›</span>
        </button>`;
      tools.addEventListener("click", (event) => {
        const button = event.target.closest("[data-v30-target]");
        if (button) window.go?.(button.dataset.v30Target);
      });
    }
    if (hero.nextElementSibling !== tools) hero.insertAdjacentElement("afterend", tools);
  }

  function placeIndustryEntryAfterContent() {
    const page = document.getElementById("page-more");
    const entry = document.getElementById("v27BusinessEntry");
    if (!page || !entry) return;

    const contentEntry = [...page.children].find((node) => {
      if (!node.classList?.contains("entry-card")) return false;
      return node.getAttribute("onclick")?.includes("content") || node.textContent.includes("AI 内容助手");
    });
    if (!contentEntry) return;

    entry.classList.add("v30-industry-entry");
    if (contentEntry.nextElementSibling !== entry) contentEntry.insertAdjacentElement("afterend", entry);
  }

  function syncLayout() {
    addHomeQuickTools();
    placeIndustryEntryAfterContent();
  }

  function init() {
    enhanceBrand();
    document.getElementById("v30HomeTools")?.remove();
    compactHeaderSubtitle();
    watchHeaderSubtitle();
    syncLayout();
    const params = new URLSearchParams(window.location.search);
    const profile = readProfile();
    const forcePreview = params.get(FORCE_PARAM) === "1";
    const needsEntry = forcePreview || !profile?.businessName || !profile?.email;
    if (!needsEntry || document.getElementById("v30Entry")) return;

    document.body.insertAdjacentHTML("beforeend", markup(forcePreview ? profile || {} : {}));
    document.body.classList.add("v30-entry-open");
    const entry = document.getElementById("v30Entry");
    bindEntry(entry);
    window.setTimeout(() => entry.querySelector("#v30BusinessName")?.focus(), 120);
  }

  bindIndustryBack();
  normalizeScreenshotRemoveButtons();
  const imageThumbs = document.getElementById("imgThumbs");
  if (imageThumbs) {
    new MutationObserver(normalizeScreenshotRemoveButtons).observe(imageThumbs, {
      childList: true,
      subtree: true,
    });
  }

  window.SOUSRuntime?.registerSync("v30-entry", syncLayout) || syncLayout();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();








