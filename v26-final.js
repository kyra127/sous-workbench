(() => {
  "use strict";

  const WORKSPACE_INDEX = "sous:workspaces:v1";
  const ACTIVE_WORKSPACE = "sous:active-workspace:v1";
  const DATA_KEYS = ["orders", "menu", "editLog", "customers", "parseCountWeek", "prefs", "materials", "starterTemplateHistory"];
  const PROFILE_KEY = "sous:business-profile:v1";
  let syncing = false;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const currentProfile = () => readJson(PROFILE_KEY, {});
  const workspaceList = () => readJson(WORKSPACE_INDEX, []);
  const activeWorkspaceId = () => localStorage.getItem(ACTIVE_WORKSPACE) || "primary";

  function captureWorkspace(id = activeWorkspaceId()) {
    const profile = currentProfile();
    const snapshot = { profile, savedAt: new Date().toISOString() };
    DATA_KEYS.forEach((key) => { snapshot[key] = readJson(`sous:${key}`, null); });
    writeJson(`sous:workspace:${id}`, snapshot);
    const list = workspaceList();
    const existing = list.find((item) => item.id === id);
    const item = {
      id,
      name: profile.businessName || existing?.name || "当前业务",
      industry: profile.starterTemplateId || existing?.industry || "blank",
      updatedAt: snapshot.savedAt,
    };
    writeJson(WORKSPACE_INDEX, existing ? list.map((entry) => entry.id === id ? item : entry) : [...list, item]);
  }

  function ensurePrimaryWorkspace() {
    if (!localStorage.getItem(ACTIVE_WORKSPACE)) localStorage.setItem(ACTIVE_WORKSPACE, "primary");
    if (!localStorage.getItem("sous:workspace:primary")) captureWorkspace("primary");
  }

  function restoreWorkspace(id) {
    captureWorkspace();
    const snapshot = readJson(`sous:workspace:${id}`, null);
    if (!snapshot) return;
    localStorage.setItem(ACTIVE_WORKSPACE, id);
    writeJson(PROFILE_KEY, snapshot.profile || {});
    DATA_KEYS.forEach((key) => {
      if (snapshot[key] == null) localStorage.removeItem(`sous:${key}`);
      else writeJson(`sous:${key}`, snapshot[key]);
    });
    location.reload();
  }

  function beginNewWorkspace() {
    captureWorkspace();
    const previous = currentProfile();
    const id = `space-${Date.now().toString(36)}`;
    localStorage.setItem(ACTIVE_WORKSPACE, id);
    DATA_KEYS.forEach((key) => localStorage.removeItem(`sous:${key}`));
    const freshProfile = {
      businessName: previous.businessName ? `${previous.businessName} · 新业务` : "新业务",
      email: previous.email || "",
      channels: previous.channels || [],
      fulfillment: previous.fulfillment || [],
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeJson(PROFILE_KEY, freshProfile);
    if (typeof orders !== "undefined") orders = [];
    if (typeof menu !== "undefined") menu = {};
    if (typeof editLog !== "undefined") editLog = [];
    if (typeof customers !== "undefined") customers = [];
    if (typeof prefs !== "undefined") prefs = {};
    writeJson(`sous:workspace:${id}`, { profile: freshProfile, orders: [], menu: {}, editLog: [], customers: [], prefs: {}, savedAt: new Date().toISOString() });
    const list = workspaceList();
    writeJson(WORKSPACE_INDEX, [...list, { id, name: freshProfile.businessName, industry: "blank", updatedAt: new Date().toISOString() }]);
  }

  function installStorageMirroring() {
    if (!window.store || store.__v26Mirrored) return;
    const baseSet = store.set.bind(store);
    store.set = async (key, value) => {
      const result = await baseSet(key, value);
      clearTimeout(store.__v26Timer);
      store.__v26Timer = setTimeout(() => captureWorkspace(), 80);
      return result;
    };
    store.__v26Mirrored = true;
  }

  function buildSettingsPage() {
    if (document.getElementById("page-settings")) return;
    const more = document.getElementById("page-more");
    if (!more) return;
    const settings = document.createElement("div");
    settings.className = "page";
    settings.id = "page-settings";
    settings.innerHTML = `
      <button class="back-chip" type="button" onclick="go('more')">← 返回更多</button>
      <h1 class="pg">设置</h1>
      <p class="pg-sub">管理当前业务空间、订单默认值和本机数据。</p>
      <section class="settings-section">
        <div class="section-label">业务空间</div>
        <div class="workspace-card">
          <div><b id="activeWorkspaceName"></b><small>商品、订单和设置相互独立</small></div>
          <label>切换业务空间<select id="workspaceSelect" aria-label="切换业务空间"></select></label>
          <button class="btn ghost block" type="button" id="newWorkspaceBtn">＋ 新建业务空间</button>
        </div>
      </section>
      <section class="settings-section" id="movedSettings"></section>`;
    more.after(settings);

    const sectionLabel = [...more.querySelectorAll(":scope > .section-label")].find((node) => node.textContent.includes("设置"));
    const moved = settings.querySelector("#movedSettings");
    if (sectionLabel) {
      const settingsNodes = [];
      let node = sectionLabel.nextElementSibling;
      while (node) {
        const next = node.nextElementSibling;
        if (!node.classList.contains("footnote")) settingsNodes.push(node);
        node = next;
      }
      moved.append(sectionLabel);
      settingsNodes.forEach((item) => moved.append(item));
    }
    const footnote = more.querySelector(".footnote");
    if (footnote) moved.append(footnote);

    const list = workspaceList();
    const active = activeWorkspaceId();
    const select = settings.querySelector("#workspaceSelect");
    select.innerHTML = list.map((item) => `<option value="${item.id}" ${item.id === active ? "selected" : ""}>${escapeHtml(item.name)} · ${industryLabel(item.industry)}</option>`).join("");
    settings.querySelector("#activeWorkspaceName").textContent = currentProfile().businessName || "当前业务";
    select.addEventListener("change", () => restoreWorkspace(select.value));
    settings.querySelector("#newWorkspaceBtn").addEventListener("click", () => {
      window.__sousCreateWorkspace = true;
      window.sousStarterTemplates?.open?.();
      setTimeout(() => {
        const title = document.querySelector('#sousSetup [data-v7-step="1"] .setup-title');
        const copy = document.querySelector('#sousSetup [data-v7-step="1"] .setup-copy');
        if (title) title.textContent = "为新业务选择行业";
        if (copy) copy.textContent = "将创建一个独立业务空间，原来的商品和订单会完整保留。";
      }, 0);
    });
  }

  function industryLabel(id) {
    return ({ bakery: "烘焙甜品", floristry: "鲜花花艺", food: "餐食料理", handmade: "手作产品", blank: "自定义" })[id] || "自定义";
  }

  function installHeaderSettings() {
    document.querySelectorAll("header.top").forEach((header) => {
      if (header.querySelector(".account-settings")) return;
      let actions = header.querySelector(".header-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "header-actions";
        const status = header.querySelector(".status-pill");
        if (status) actions.append(status);
        header.append(actions);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "account-settings";
      button.setAttribute("aria-label", "打开设置");
      button.innerHTML = `<span>${(currentProfile().businessName || "SOUS").slice(0, 1)}</span><b>设置</b>`;
      button.addEventListener("click", () => go("settings"));
      actions.append(button);
    });
  }

  function simplifyMorePage() {
    const more = document.getElementById("page-more");
    if (!more) return;
    const subtitle = more.querySelector(".pg-sub");
    if (subtitle) subtitle.textContent = "管理商品，使用 AI 制作文案和图片。";
    const entries = [...more.querySelectorAll(":scope > .entry-card")];
    entries.forEach((entry) => {
      const title = entry.querySelector("b");
      const copy = entry.querySelector("small");
      if (entry.getAttribute("onclick")?.includes("content")) {
        if (title) title.textContent = "AI 内容助手";
        if (copy) copy.textContent = "生成宣传文案、菜单图片和社媒配图";
      }
      if (entry.getAttribute("onclick")?.includes("menu")) {
        if (copy) copy.textContent = "在售商品 · 售价成本 · 材料清单";
      }
    });
  }

  function improveContentPage() {
    const page = document.getElementById("page-content");
    if (!page || page.dataset.v26Ready) return;
    page.dataset.v26Ready = "true";
    const subtitle = page.querySelector(".pg-sub");
    if (subtitle) subtitle.textContent = "生成宣传文案、菜单图片或社媒配图；AI 先出草稿，由您确认后使用。";

    const imageHeading = page.querySelector("#content-image .content-card-heading small");
    if (imageHeading) imageHeading.textContent = "描述您想要的画面，例如新品宣传图、菜单图片或社媒配图。";
    const promptLabel = page.querySelector('label[for="imagePrompt"]') || document.getElementById("imagePrompt")?.closest("label");
    promptLabel?.querySelector(":scope > span")?.replaceChildren("描述画面");
    const prompt = document.getElementById("imagePrompt");
    if (prompt) prompt.placeholder = "例如：为周末新品制作一张清爽的竖版宣传图，突出巴斯克蛋糕，适合小红书";

    const products = document.getElementById("imageProductChecks")?.parentElement;
    if (products && products.tagName !== "DETAILS") {
      const details = document.createElement("details");
      details.className = "content-products-details";
      const summary = document.createElement("summary");
      summary.innerHTML = `<span><b>使用商品资料</b><small>选填 · 可带入准确名称和价格</small></span><span>展开</span>`;
      products.parentNode.insertBefore(details, products);
      details.append(summary, products);
      const oldLabel = products.querySelector(":scope > span");
      if (oldLabel) oldLabel.hidden = true;
    }
    const ratio = document.getElementById("imageRatio")?.closest("label");
    if (ratio) {
      ratio.classList.add("ratio-hint");
      ratio.innerHTML = `<span>画面比例</span><small>可在描述中写“方形、横版或竖版”；未说明时默认竖版。</small>`;
    }
    const boundary = page.querySelector(".content-boundary-note");
    if (boundary) boundary.textContent = "生成结果不会自动发布，也不会修改商品资料。";

    const textHeading = page.querySelector("#content-text .content-card-heading small");
    if (textHeading) textHeading.textContent = "填写发布渠道、用途和主题，AI 会提供 3 版可编辑文案。";
    const actions = document.getElementById("contentActions");
    if (actions) {
      actions.querySelector("button:first-child").textContent = "复制文案";
      actions.querySelector("button:last-child").textContent = "再生成 3 版";
    }
  }

  function installContentOverrides() {
    window.genContent = async function genContentV26() {
      const topic = document.getElementById("contentTopic")?.value.trim();
      if (!topic) { toast("请填写文案主题"); return; }
      const channel = document.getElementById("contentChannel")?.value || "其他";
      const goal = document.getElementById("contentGoal")?.value || "日常分享";
      const extra = document.getElementById("contentExtra")?.value.trim() || "";
      const button = document.getElementById("contentBtn");
      const out = document.getElementById("contentOut");
      button.disabled = true;
      out.style.display = "block";
      out.innerHTML = `<div class="loading"><div class="pearl"></div>正在生成 3 版文案…</div>`;
      try {
        const text = await callAI(`你是小型经营品牌的内容助理。请根据以下信息生成 3 个差异明显、可直接编辑的中文文案草稿。
发布渠道：${channel}
内容用途：${goal}
文案风格：${window.contentTone || "亲切自然"}
主题：${topic}
${extra ? `补充要求：${extra}` : ""}

要求：
1. 每版包含简短标题、80-160 字正文、自然行动引导；小红书可附 3-5 个相关标签。
2. 三版分别偏“直接清晰”“有画面感”“亲切对话”，不要只是换同义词。
3. 不编造价格、库存、销量、折扣或经营结果；缺失信息不自行补充。
4. 用“方案一 / 方案二 / 方案三”分隔，只输出文案。`);
        out.textContent = text.trim();
        document.getElementById("contentActions").style.display = "grid";
      } catch {
        out.textContent = "生成失败。您填写的内容已保留，可以重试。";
      } finally { button.disabled = false; }
    };

    window.generateAIContentImage = async function generateImageV26() {
      const request = document.getElementById("imagePrompt")?.value.trim();
      if (!request) { toast("请描述您想生成的画面"); return; }
      const size = /方形|1[:：]1/.test(request) ? "1024x1024" : /横版|3[:：]2|横向/.test(request) ? "1536x1024" : "1024x1536";
      const products = typeof selectedImageProducts === "function" ? selectedImageProducts() : [];
      const result = document.getElementById("contentImageResult");
      const canvas = document.getElementById("contentImageCanvas");
      const actions = document.getElementById("contentImageActions");
      const button = document.getElementById("imageGenerateBtn");
      const productContext = products.length ? `仅可使用这些正式商品资料：${products.map((item) => `${item.name} A$${item.price.toFixed(0)}`).join("；")}。` : "";
      result.style.display = "block";
      actions.style.display = "none";
      canvas.innerHTML = `<div class="loading"><div class="pearl"></div>正在生成图片草稿…</div>`;
      button.disabled = true;
      result.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        const response = await callWorkbenchApi("/api/image", {
          prompt: `为小型经营品牌生成可检查的商业图片草稿。经营者需求：${request}。${productContext}不要自行添加折扣、销量、库存或无法确认的业务事实。`,
          quality: "low",
          size,
        }, 190000);
        window.__v26ImageState = response;
        window.contentImageState = response;
        canvas.innerHTML = `<img class="generated-poster content-generated-image" src="${response.image}" alt="AI 生成的图片草稿">`;
        document.getElementById("contentImageModel").textContent = response.model || "GPT Image 2";
        actions.style.display = "grid";
      } catch (error) {
        canvas.innerHTML = `<div class="empty">生成失败：${escapeHtml(error.message)}</div>`;
      } finally { button.disabled = false; }
    };
  }

  window.downloadAIContentImage = function downloadImageV26() {
    const image = window.__v26ImageState?.image;
    if (!image) { toast("请先生成图片"); return; }
    const link = document.createElement("a");
    link.download = `sous-ai-image-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = image;
    document.body.append(link);
    link.click();
    link.remove();
    toast("图片已下载");
  };

  function improveProductPage() {
    const page = document.getElementById("page-menu");
    if (!page) return;
    page.querySelector(".stat-strip")?.setAttribute("hidden", "");
    document.getElementById("menuSaveState")?.setAttribute("hidden", "");
    const subtitle = page.querySelector(".pg-sub");
    if (subtitle) subtitle.textContent = "添加和编辑在售商品、价格与材料。";
    page.querySelectorAll(".menu-summary").forEach((summary) => {
      summary.textContent = summary.textContent.replace(/项物料/g, "项材料").replace(/物料/g, "材料");
    });
    page.querySelectorAll("[aria-label*='物料']").forEach((node) => node.setAttribute("aria-label", node.getAttribute("aria-label").replaceAll("物料", "材料")));
    page.querySelectorAll(".v9-common-materials > span,.v10-new-materials > span").forEach((node) => node.textContent = "常用材料");
  }

  function installRenderEnhancement() {
    if (typeof window.renderMenu !== "function" || window.renderMenu.__v26Enhanced) return;
    const baseRenderMenu = window.renderMenu;
    window.renderMenu = function renderMenuV26(...args) {
      const result = baseRenderMenu.apply(this, args);
      queueMicrotask(improveProductPage);
      return result;
    };
    window.renderMenu.__v26Enhanced = true;
  }
  function installMaterialFix() {
    document.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-v9-material]");
      if (!chip) return;
      const scope = chip.closest(".structured-add,.new-item-form,#newItemForm,.menu-item");
      const nameInput = scope?.querySelector('input[id^="ai-name-"],.rn');
      const unitInput = scope?.querySelector('select[id^="ai-unit-"],.ru');
      const amountInput = scope?.querySelector('input[id^="ai-amt-"],.ra');
      if (!nameInput) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      nameInput.value = chip.dataset.v9Material || chip.textContent.trim();
      if (unitInput && chip.dataset.v9Unit) unitInput.value = chip.dataset.v9Unit;
      amountInput?.focus();
    }, true);
  }

  function installWorkspaceInterception() {
    document.addEventListener("click", (event) => {
      if (!window.__sousCreateWorkspace) return;
      if (!event.target.closest("[data-v7-import],[data-v7-blank]")) return;
      beginNewWorkspace();
      window.__sousCreateWorkspace = false;
      setTimeout(() => captureWorkspace(), 700);
    }, true);
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      buildSettingsPage();
      installHeaderSettings();
      simplifyMorePage();
      improveContentPage();
      improveProductPage();
      syncing = false;
    });
  }

  ensurePrimaryWorkspace();
  installStorageMirroring();
  installContentOverrides();
  installRenderEnhancement();
  installMaterialFix();
  installWorkspaceInterception();
  window.SOUSRuntime?.registerSync("v26-layout", sync) || sync();
  window.addEventListener("beforeunload", () => captureWorkspace());
})();
