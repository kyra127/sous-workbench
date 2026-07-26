(() => {
  "use strict";

  const PROFILE_KEY = "sous:business-profile:v1";
  const ONBOARDING_SESSION_KEY = "sous:onboarding-session:v1";
  const LEGACY_BACKUP_KEY = "sous:legacy-industry-backup:v1";
  const TEMPLATE_HISTORY_KEY = "starterTemplateHistory";
  const MATERIALS_KEY = "materials";
  const TEMPLATE_INDEX_URL = "/starter-templates/index.json";
  const LEGACY_TEMPLATE_MAP = {
    bakery: "bakery",
    florist: "floristry",
    floristry: "floristry",
    privateKitchen: "food",
    private_kitchen: "food",
    food: "food",
    handmade: "handmade",
    custom: "handmade",
    customGift: "handmade",
    gift: "handmade",
    other: "blank",
  };

  const V7 = {
    templates: [],
    selectedTemplateId: "blank",
    selectedProducts: new Set(),
    manualProducts: [],
    selectedMaterials: new Set(),
    selectedFulfillment: new Set(),
    step: 0,
    settingsMode: false,
    previewMode: false,
    materials: [],
    profile: null,
    languageScheduled: false,
  };

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeProfile(profile) {
    V7.profile = profile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function readOnboardingSession() {
    try {
      return JSON.parse(localStorage.getItem(ONBOARDING_SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeOnboardingSession(currentStep) {
    localStorage.setItem(ONBOARDING_SESSION_KEY, JSON.stringify({ currentStep, updatedAt: new Date().toISOString() }));
  }

  function clearOnboardingSession() {
    localStorage.removeItem(ONBOARDING_SESSION_KEY);
  }

  function selectedTemplate() {
    return V7.templates.find((template) => template.id === V7.selectedTemplateId) || null;
  }

  function templateName(id) {
    if (!id || id === "blank") return "从空白开始";
    return V7.templates.find((template) => template.id === id)?.name || id;
  }

  function ingredientKey(name, unit) {
    return unit ? `${name} (${unit})` : name;
  }

  function normalizeIngredient(entry) {
    if (entry?.name) {
      return {
        name: String(entry.name).trim(),
        unit: String(entry.unit || "g").trim(),
        amount: Number(entry.amount) || 0,
      };
    }
    return null;
  }

  function normalizeMenuItem(item, name, isNewExample = false) {
    const next = item && typeof item === "object" ? item : {};
    if (!Array.isArray(next.ingredients)) {
      next.ingredients = Object.entries(next.ings || {}).map(([key, amount]) => {
        const match = String(key).trim().match(/^(.*?)\s*\(([^()]+)\)\s*$/);
        return {
          name: (match?.[1] || key).trim(),
          unit: (match?.[2] || "g").trim(),
          amount: Number(amount) || 0,
        };
      });
    }
    next.ingredients = next.ingredients.map(normalizeIngredient).filter(Boolean);
    next.ings = Object.fromEntries(
      next.ingredients.map((ingredient) => [
        ingredientKey(ingredient.name, ingredient.unit),
        ingredient.amount,
      ]),
    );
    if (!next.id) next.id = `catalog-${slug(name)}-${Date.now().toString(36)}`;
    if (!next.unit) next.unit = "件";
    if (typeof next.active !== "boolean") next.active = !isNewExample;
    if (typeof next.isExample !== "boolean") next.isExample = isNewExample;
    if (typeof next.price !== "number") next.price = Number(next.price) || 0;
    if (typeof next.cost !== "number") next.cost = Number(next.cost) || 0;
    return next;
  }

  function slug(value) {
    return String(value || "item")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "item";
  }

  function uniqueName(base, collection) {
    let index = 2;
    let next = `${base}（模板）`;
    while (collection.includes(next)) next = `${base}（模板 ${index++}）`;
    return next;
  }

  function getFormalMenu() {
    return Object.fromEntries(
      Object.entries(menu).filter(([, item]) => item?.active !== false && item?.isExample !== true),
    );
  }

  async function loadTemplates() {
    const response = await fetch(TEMPLATE_INDEX_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("启动模板加载失败");
    const index = await response.json();
    V7.templates = await Promise.all(
      (index.templates || []).map(async (file) => {
        const templateResponse = await fetch(`/starter-templates/${file}`, { cache: "no-store" });
        if (!templateResponse.ok) throw new Error(`模板 ${file} 加载失败`);
        return await templateResponse.json();
      }),
    );
  }

  async function migrateLegacyData() {
    const oldProfile = readProfile();
    const storedMenu = await store.get("menu");
    const isFirstUse = !oldProfile && !storedMenu;

    if (isFirstUse) {
      menu = {};
      await store.set("menu", menu);
    } else if (storedMenu) {
      menu = storedMenu;
    }

    let menuChanged = false;
    for (const [name, item] of Object.entries(menu)) {
      const before = JSON.stringify(item);
      menu[name] = normalizeMenuItem(item, name, false);
      if (before !== JSON.stringify(menu[name])) menuChanged = true;
    }
    if (menuChanged) await store.set("menu", menu);

    V7.materials = (await store.get(MATERIALS_KEY)) || [];
    const materialIndex = new Map(
      V7.materials.map((material) => [`${material.name}|${material.unit}`, material]),
    );
    for (const item of Object.values(menu)) {
      for (const ingredient of item.ingredients || []) {
        const key = `${ingredient.name}|${ingredient.unit}`;
        if (materialIndex.has(key)) continue;
        const material = {
          id: `material-${slug(ingredient.name)}-${slug(ingredient.unit)}`,
          name: ingredient.name,
          unit: ingredient.unit,
          stockQuantity: 0,
          isExample: Boolean(item.isExample),
          templateSource: item.templateSource || undefined,
        };
        V7.materials.push(material);
        materialIndex.set(key, material);
      }
    }
    await store.set(MATERIALS_KEY, V7.materials);

    if (!oldProfile) {
      V7.profile = null;
      return;
    }

    const legacyIndustry =
      oldProfile.industryType || oldProfile.industry || oldProfile.businessType || null;
    const legacyTerms =
      oldProfile.customTerms || oldProfile.terminology || oldProfile.termMapping || null;
    if ((legacyIndustry || legacyTerms) && !localStorage.getItem(LEGACY_BACKUP_KEY)) {
      localStorage.setItem(
        LEGACY_BACKUP_KEY,
        JSON.stringify({
          industryType: legacyIndustry,
          customTerms: legacyTerms,
          sourceProfile: clone(oldProfile),
          migratedAt: new Date().toISOString(),
        }),
      );
    }

    const profile = {
      email: oldProfile.email || "",
      businessName: oldProfile.businessName || oldProfile.storeName || "",
      channels: Array.isArray(oldProfile.channels) ? oldProfile.channels : [],
      fulfillment: Array.isArray(oldProfile.fulfillment) ? oldProfile.fulfillment : [],
      starterTemplateId:
        oldProfile.starterTemplateId || LEGACY_TEMPLATE_MAP[legacyIndustry] || undefined,
      starterTemplateHistory: Array.isArray(oldProfile.starterTemplateHistory)
        ? oldProfile.starterTemplateHistory
        : [],
      createdAt: oldProfile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeProfile(profile);
  }

  function chipMarkup(kind, values, selectedValues) {
    return values
      .map(
        (value) =>
          `<button type="button" class="choice-chip ${selectedValues.includes(value) ? "on" : ""}" data-v7-choice="${kind}" data-value="${esc(value)}">${esc(value)}</button>`,
      )
      .join("");
  }

  function setupMarkup() {
    return `
      <section class="setup-shell v7-setup" id="sousSetup" role="dialog" aria-modal="true" aria-labelledby="v7SetupTitle" hidden>
        <div class="setup-panel">
          <div class="v7-settings-head"><button type="button" data-v7-close-settings aria-label="返回更多页面">← 返回更多</button><span>行业设置</span></div>
          <div class="setup-brand">
            <div class="logo">SOUS<span class="dot">.</span></div>
            <span class="setup-step-label" id="v7StepLabel">1 / 2 · 经营信息</span>
          </div>
          <div class="setup-progress" aria-hidden="true"><span></span><span></span><span></span></div>

          <div class="setup-screen v7-welcome-screen" data-v7-step="-1">
            <span class="setup-kicker">欢迎使用 SOUS</span>
            <h1 class="setup-title" id="v7SetupTitle">把聊天里的订单，轻松管起来</h1>
            <p class="setup-copy">上传客户聊天，SOUS 帮您整理订单；只有经过您的确认，才会创建正式订单。</p>
            <div class="v7-welcome-points" aria-label="SOUS 工作方式">
              <div><b>整理订单信息</b><small>识别商品、数量、交付时间和待确认内容</small></div>
              <div><b>由您确认</b><small>检查和修改后，再创建正式订单</small></div>
            </div>
            <div class="setup-actions"><button type="button" class="btn primary" data-v7-welcome>开始使用</button></div>
          </div>

          <div class="setup-screen" data-v7-step="0">
            <span class="setup-kicker">经营信息</span>
            <h1 class="setup-title" id="v7SetupTitle">先填写基本信息</h1>
            <p class="setup-copy">这些信息用于建立工作台和 AI 录单上下文，之后可以在设置中修改。</p>
            <div class="setup-field"><label for="v7Business">店铺或品牌名称</label><input id="v7Business" autocomplete="organization" placeholder="例如：晨光工作室"></div>
            <div class="setup-field"><label for="v7Email">工作邮箱</label><input id="v7Email" type="email" autocomplete="email" placeholder="name@business.com"></div>
            <div class="v7-choice-group"><b>接单渠道 <span class="v7-optional">可选</span></b><div class="choice-row" id="v7Channels"></div></div>
            <div class="setup-field v7-other-channel" id="v7OtherChannelField" hidden><label for="v7OtherChannel">其他接单渠道</label><input id="v7OtherChannel" placeholder="例如：微信、WhatsApp"></div>
            <div class="v7-choice-group"><b>常用交付方式 <span class="v7-optional">可选</span></b><div class="choice-row" id="v7Fulfillment"></div></div>
            <div class="setup-inline-error" id="v7SetupError" role="alert" hidden></div>
            <div class="setup-actions"><button type="button" class="btn primary" data-v7-next>继续</button></div>
          </div>

          <div class="setup-screen" data-v7-step="1">
            <span class="setup-kicker">选择行业</span>
            <h1 class="setup-title">您经营哪类业务？</h1>
            <p class="setup-copy">选择最接近的行业，我们会推荐一组常见商品。您可以自由勾选，也可以添加自己的商品。</p>
            <div class="v7-template-grid" id="v7TemplateGrid"></div>
            <div class="setup-actions">
              <button type="button" class="btn ghost" data-v7-prev>上一步：经营信息</button>
              <button type="button" class="btn primary" data-v7-preview>下一步</button>
            </div>
            <button type="button" class="v7-text-action" data-v7-blank>暂不选择</button>
          </div>
          <div class="setup-screen" data-v7-step="2">
            <span class="setup-kicker">最后一步</span>
            <h1 class="setup-title" id="v7PreviewTitle">选择您的在售商品</h1>
            <p class="setup-copy">勾选您正在售卖的商品，也可以在下方直接添加。</p>
            <div class="v7-preview" id="v7Preview"></div>
            <div class="setup-inline-error" id="v7ImportError" role="alert" hidden></div>
            <div class="setup-actions">
              <button type="button" class="btn ghost" data-v7-back-template>上一步：选择行业</button>
              <button type="button" class="btn primary" data-v7-import>加入商品目录</button>
            </div>
            <button type="button" class="v7-text-action" data-v7-blank>从空白开始</button>
          </div>
        </div>
      </section>`;
  }

  function renderTemplateOptions() {
    const grid = document.getElementById("v7TemplateGrid");
    if (!grid) return;
    const simpleDescriptions = { bakery: "蛋糕、甜点等", floristry: "花束、花盒等", food: "私厨、便当等", handmade: "定制手作等" };
    grid.innerHTML = [
      ...V7.templates.map(
        (template) => `
          <button type="button" class="v7-template ${V7.selectedTemplateId === template.id ? "on" : ""}" data-v7-template="${esc(template.id)}">
            <b>${esc(template.name)}</b><small>${esc(simpleDescriptions[template.id] || "常用商品")}</small>
          </button>`,
      )
    ].join("");
  }

  function initializeTemplateSelection(template) {
    V7.selectedProducts = new Set((template?.catalogItems || []).slice(0, 6).map((item) => item.id));
    V7.manualProducts = [];
    V7.selectedMaterials = new Set();
    V7.selectedFulfillment = new Set();
  }

  function conflictOptions(kind, name, existing) {
    if (!existing) return "";
    const canOverwrite = existing.isExample === true;
    return `
      <select class="v7-conflict" data-conflict-kind="${kind}" data-conflict-name="${esc(name)}" aria-label="${esc(name)}重名处理方式">
        <option value="skip">重名：跳过</option>
        <option value="keep">保留两个</option>
        <option value="merge">合并</option>
        ${canOverwrite ? `<option value="overwrite">覆盖已有示例数据</option>` : ""}
      </select>`;
  }

  function renderPreview() {
    const preview = document.getElementById("v7Preview");
    const title = document.getElementById("v7PreviewTitle");
    const importButton = document.querySelector("[data-v7-import]");
    const template = selectedTemplate();
    if (!preview || !title || !importButton) return;

    if (!template) {
      title.textContent = "暂不添加商品";
      importButton.textContent = V7.settingsMode ? "返回设置" : "进入工作台";
      preview.innerHTML = `<div class="v7-preview-empty"><b>商品目录可以稍后完善</b><span>手动录单始终可用；商品匹配和备货计算会在添加商品后启用。</span></div>`;
      return;
    }

    title.textContent = V7.settingsMode ? "选择要添加的商品" : "选择您的在售商品";
    importButton.textContent = V7.settingsMode ? "加入商品目录" : "保存并进入工作台";
    const products = template.catalogItems.map((item) => `
      <label class="v7-check v7-product-preview-row">
        <input type="checkbox" data-preview-product="${esc(item.id)}" ${V7.selectedProducts.has(item.id) ? "checked" : ""}>
        <span><b>${esc(item.name)}</b></span>
      </label>`).join("");
    const manualRows = V7.manualProducts.map((item) => `
      <div class="v7-manual-row"><span><b>${esc(item.name)}</b><small>${esc(item.unit)}</small></span><button type="button" data-v7-remove-manual="${esc(item.id)}" aria-label="删除 ${esc(item.name)}">删除</button></div>`).join("");

    preview.innerHTML = `
      <section class="v7-preview-group v7-product-only-preview">
        <div class="v7-preview-heading"><span><b>${esc(template.name)}商品建议</b><small>可多选</small></span><small>已选 ${V7.selectedProducts.size + V7.manualProducts.length} 项</small></div>
        <div class="v7-candidate-list">${products || "<div class='v7-preview-empty'>暂无建议商品。</div>"}</div>
      </section>
      <section class="v7-manual-product">
        <div class="v7-preview-heading"><span><b>添加其他商品</b><small>直接加入本次目录</small></span></div>
        <div class="v7-manual-form">
          <label><span>商品名称</span><input id="v7ManualName" placeholder="例如：生日蛋糕" maxlength="40"></label>
          <label><span>销售单位</span><select id="v7ManualUnit"><option>个</option><option>份</option><option>盒</option><option>套</option><option>束</option><option>件</option><option>瓶</option><option>张</option></select></label>
          <button type="button" class="btn ghost small" data-v7-add-manual>添加</button>
        </div>
        <div class="v7-manual-list">${manualRows}</div>
      </section>`;
  }
  function showStep(step) {
    V7.step = Math.max(-1, Math.min(2, step));
    const shell = document.getElementById("sousSetup");
    if (!shell) return;
    shell.querySelectorAll("[data-v7-step]").forEach((screen) => {
      screen.classList.toggle("on", Number(screen.dataset.v7Step) === V7.step);
    });
    shell.querySelectorAll(".setup-progress span").forEach((bar, index) => {
      bar.classList.toggle("on", index <= V7.step);
    });
    shell.querySelector("#v7StepLabel").textContent =
      V7.step === -1 ? "欢迎" : V7.step === 0 ? "1 / 2 · 基本信息" : V7.step === 1 ? "2 / 2 · 选择行业" : "选择商品";
    if (V7.step === 1) renderTemplateOptions();
    if (V7.step === 2) renderPreview();
    if (!V7.settingsMode && !V7.previewMode) writeOnboardingSession(V7.step);
    shell.scrollTop = 0;
  }

  function openSetup(settingsMode = false, startStep = null, previewMode = false) {
    V7.settingsMode = settingsMode;
    V7.previewMode = previewMode;
    V7.profile = readProfile();
    const shell = document.getElementById("sousSetup");
    if (!shell) return;
    const profile = V7.profile || {};
    shell.classList.toggle("v7-settings-mode", settingsMode);
    const industryScreen = shell.querySelector('[data-v7-step="1"]');
    const productScreen = shell.querySelector('[data-v7-step="2"]');
    const industryTitle = industryScreen?.querySelector(".setup-title");
    const industryCopy = industryScreen?.querySelector(".setup-copy");
    const industryBack = industryScreen?.querySelector("[data-v7-prev]");
    const industryNext = industryScreen?.querySelector("[data-v7-preview]");
    const productKicker = productScreen?.querySelector(".setup-kicker");
    const productCopy = productScreen?.querySelector(".setup-copy");
    const productBack = productScreen?.querySelector("[data-v7-back-template]");
    if (industryTitle) industryTitle.textContent = settingsMode ? "切换经营行业" : "您经营哪类业务？";
    if (industryCopy) industryCopy.textContent = settingsMode ? "选择新的行业后，您可以添加一组商品；现有正式商品不会被删除。" : "选择最接近的行业，我们会推荐一组常见商品。您可以自由勾选，也可以添加自己的商品。";
    if (industryBack) industryBack.textContent = settingsMode ? "取消" : "上一步：经营信息";
    if (industryNext) industryNext.textContent = settingsMode ? "选择商品" : "下一步";
    if (productKicker) productKicker.textContent = settingsMode ? "商品设置" : "最后一步";
    if (productCopy) productCopy.textContent = settingsMode ? "勾选需要添加的商品；现有商品保持不变。" : "勾选您正在售卖的商品，也可以在下方直接添加。";
    if (productBack) productBack.textContent = settingsMode ? "返回选择行业" : "上一步：选择行业";
    shell.querySelector("#v7Business").value = profile.businessName || "";
    shell.querySelector("#v7Email").value = profile.email || "";
    const standardChannels = ["小红书", "抖音", "Instagram"];
    const savedChannels = profile.channels || [];
    const customChannel = profile.otherChannel || savedChannels.find((channel) => !standardChannels.includes(channel) && channel !== "其他") || "";
    shell.querySelector("#v7Channels").innerHTML = chipMarkup(
      "channels",
      [...standardChannels, "其他"],
      [...savedChannels.filter((channel) => standardChannels.includes(channel)), ...(customChannel ? ["其他"] : [])],
    );
    shell.querySelector("#v7OtherChannel").value = customChannel;
    shell.querySelector("#v7OtherChannelField").hidden = !customChannel;
    shell.querySelector("#v7Fulfillment").innerHTML = chipMarkup(
      "fulfillment",
      ["自取", "配送", "到店服务", "上门服务"],
      profile.fulfillment || [],
    );
    V7.selectedTemplateId = profile.starterTemplateId || "blank";
    initializeTemplateSelection(selectedTemplate());
    shell.hidden = false;
    document.body.classList.add("setup-open");
    showStep(settingsMode ? 1 : Number.isInteger(startStep) ? startStep : -1);
  }

  function closeSetup() {
    const shell = document.getElementById("sousSetup");
    if (shell) {
      shell.hidden = true;
      shell.classList.remove("v7-settings-mode");
    }
    V7.previewMode = false;
    document.body.classList.remove("setup-open");
  }

  function getChoiceValues(kind) {
    return [...document.querySelectorAll(`[data-v7-choice="${kind}"].on`)].map(
      (button) => button.dataset.value,
    );
  }

  function validateBusinessInfo() {
    const businessName = document.getElementById("v7Business")?.value.trim() || "";
    const email = document.getElementById("v7Email")?.value.trim() || "";
    const error = document.getElementById("v7SetupError");
    const messages = [];
    if (!businessName) messages.push("请填写店铺或品牌名称");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) messages.push("请填写有效的工作邮箱");
    if (messages.length) {
      error.textContent = messages.join("；");
      error.hidden = false;
      document.getElementById(!businessName ? "v7Business" : "v7Email")?.focus();
      return false;
    }
    error.hidden = true;
    const previous = readProfile() || {};
    writeProfile({
      ...previous,
      businessName,
      email,
      channels: [
        ...getChoiceValues("channels").filter((channel) => channel !== "其他"),
        ...(getChoiceValues("channels").includes("其他") && document.getElementById("v7OtherChannel")?.value.trim()
          ? [document.getElementById("v7OtherChannel").value.trim()]
          : []),
      ],
      otherChannel: getChoiceValues("channels").includes("其他")
        ? document.getElementById("v7OtherChannel")?.value.trim() || ""
        : "",
      fulfillment: getChoiceValues("fulfillment"),
      createdAt: previous.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  function readConflict(kind, name) {
    return (
      document.querySelector(
        `[data-conflict-kind="${kind}"][data-conflict-name="${CSS.escape(name)}"]`,
      )?.value || "skip"
    );
  }

  function mergeIngredients(existing, incoming) {
    const map = new Map(
      (existing.ingredients || []).map((ingredient) => [
        `${ingredient.name}|${ingredient.unit}`,
        clone(ingredient),
      ]),
    );
    for (const ingredient of incoming.ingredients || []) {
      const key = `${ingredient.name}|${ingredient.unit}`;
      if (!map.has(key)) map.set(key, clone(ingredient));
    }
    existing.ingredients = [...map.values()];
    existing.ings = Object.fromEntries(
      existing.ingredients.map((ingredient) => [
        ingredientKey(ingredient.name, ingredient.unit),
        ingredient.amount,
      ]),
    );
  }

  async function importSelectedTemplate() {
    const template = selectedTemplate();
    if (!template) {
      await finishWithoutTemplate();
      return;
    }


    const existingNames = Object.keys(menu);
    let createdCount = 0;
    for (const item of template.catalogItems.filter((candidate) =>
      V7.selectedProducts.has(candidate.id),
    )) {
      const incoming = normalizeMenuItem(
        {
          id: `catalog-${slug(item.name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          price: Number(item.price) || 0,
          cost: 0,
          unit: item.unit,
          ingredients: [],
          active: true,
          isExample: false,
          importedFromTemplate: template.id,
        },
        item.name,
        true,
      );
      const existing = menu[item.name];
      const action = readConflict("product", item.name);
      if (!existing) {
        menu[item.name] = incoming;
        existingNames.push(item.name);
        createdCount += 1;
      } else if (action === "keep") {
        const name = uniqueName(item.name, existingNames);
        incoming.id = `${item.id}-copy-${Date.now().toString(36)}`;
        menu[name] = incoming;
        existingNames.push(name);
      } else if (action === "merge") {
        mergeIngredients(existing, incoming);
      } else if (action === "overwrite" && existing.isExample) {
        menu[item.name] = incoming;
      }
    }

    for (const item of V7.manualProducts) {
      const name = item.name.trim();
      if (!name || menu[name]) continue;
      menu[name] = normalizeMenuItem({
        id: `catalog-${slug(name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        price: 0,
        cost: 0,
        unit: item.unit || "件",
        ingredients: [],
        active: true,
        isExample: false,
        createdManually: true,
      }, name, false);
      createdCount += 1;
    }
    const profile = readProfile() || {};
    const history = Array.isArray(profile.starterTemplateHistory)
      ? profile.starterTemplateHistory
      : [];
    const record = { templateId: template.id, importedAt: new Date().toISOString() };
    history.push(record);
    const nextProfile = {
      ...profile,
      starterTemplateId: template.id,
      starterTemplateHistory: history,
      onboardingCompleted: true,
      onboardingCompletedAt: profile.onboardingCompletedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeProfile(nextProfile);
    clearOnboardingSession();
    await store.set("menu", menu);
    await store.set(TEMPLATE_HISTORY_KEY, history);
    closeSetup();
    renderAll();
    postRender();
    if (!V7.settingsMode) go("home");
    toast(createdCount ? `已添加 ${createdCount} 个正式商品` : "未添加新商品，您可以稍后在商品管理中完善");
  }

  async function finishWithoutTemplate() {
    const profile = readProfile() || {};
    writeProfile({
      ...profile,
      starterTemplateId: profile.starterTemplateId,
      onboardingCompleted: true,
      onboardingCompletedAt: profile.onboardingCompletedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    clearOnboardingSession();
    closeSetup();
    renderAll();
    postRender();
    if (!V7.settingsMode) go("home");
    toast(V7.settingsMode ? "未导入新的示例数据" : "已从空白工作台开始");
  }

  async function promoteExample(name, notify = true) {
    const item = menu[name];
    if (!item?.isExample) return;
    item.isExample = false;
    item.active = true;
    for (const ingredient of item.ingredients || []) {
      const material = V7.materials.find(
        (candidate) =>
          candidate.name === ingredient.name && candidate.unit === ingredient.unit,
      );
      if (material) material.isExample = false;
    }
    await store.set("menu", menu);
    await store.set(MATERIALS_KEY, V7.materials);
    renderAll();
    postRender();
    if (notify) toast(`${name} 已转为正式商品`);
  }

  async function promoteAllExamples() {
    const names = Object.entries(menu)
      .filter(([, item]) => item.isExample)
      .map(([name]) => name);
    for (const name of names) {
      menu[name].isExample = false;
      menu[name].active = true;
    }
    V7.materials.forEach((material) => {
      material.isExample = false;
    });
    await store.set("menu", menu);
    await store.set(MATERIALS_KEY, V7.materials);
    renderAll();
    postRender();
    toast(names.length ? `已启用 ${names.length} 个示例商品` : "没有待启用的示例商品");
  }

  async function clearInactiveExamples() {
    const removedNames = Object.entries(menu)
      .filter(([, item]) => item.isExample && item.active === false)
      .map(([name]) => name);
    removedNames.forEach((name) => delete menu[name]);
    const usedMaterialKeys = new Set();
    Object.values(menu).forEach((item) =>
      (item.ingredients || []).forEach((ingredient) =>
        usedMaterialKeys.add(`${ingredient.name}|${ingredient.unit}`),
      ),
    );
    V7.materials = V7.materials.filter(
      (material) =>
        !material.isExample || usedMaterialKeys.has(`${material.name}|${material.unit}`),
    );
    await store.set("menu", menu);
    await store.set(MATERIALS_KEY, V7.materials);
    renderAll();
    postRender();
    toast(removedNames.length ? `已清除 ${removedNames.length} 个未启用示例` : "没有可清除的示例数据");
  }

  function enhanceExampleCatalog() {
    document.querySelectorAll("#menuList .menu-item").forEach((element) => {
      const name = element.querySelector(".mname")?.textContent.trim();
      const item = menu[name];
      if (!name || !item?.isExample) return;
      element.classList.add("is-example");
      const heading = element.querySelector(".mname");
      if (heading && !heading.querySelector(".example-badge")) {
        heading.insertAdjacentHTML("beforeend", `<span class="example-badge">示例</span>`);
      }
      const head = element.querySelector(".menu-head");
      if (head && !head.querySelector(".example-activate")) {
        head.insertAdjacentHTML(
          "beforeend",
          `<button type="button" class="example-activate" data-activate-example="${esc(name)}">启用</button>`,
        );
      }
    });
  }

  function createSettingsCard() {
    const more = document.getElementById("page-more");
    if (!more) return;
    more.querySelector("#activeBusinessProfile")?.remove();
    let card = document.getElementById("v7StarterSettings");
    if (!card) {
      card = document.createElement("section");
      card.id = "v7StarterSettings";
      card.className = "v7-settings-card";
      more.appendChild(card);
    }
    const profile = readProfile() || {};
    const history = profile.starterTemplateHistory || [];
    const exampleCount = Object.values(menu).filter((item) => item.isExample).length;
    const used = [...new Set(history.map((record) => templateName(record.templateId)))];
    card.innerHTML = `
      <details>
        <summary><span><small>数据与设置</small><b>产品模板</b></span><span aria-hidden="true">›</span></summary>
        <div class="v7-settings-details">
          <p>${used.length ? `曾使用：${esc(used.join("、"))}` : "还没有使用产品模板"}${exampleCount ? `<br>旧版未启用示例：${exampleCount} 个` : ""}</p>
          <button type="button" class="btn ghost small" data-manage-templates>查看并导入产品</button>
        </div>
      </details>`;
  }

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function setNavLabel(page, label) {
    const button = document.querySelector(`nav.tabs [data-page="${page}"]`);
    if (!button) return;
    const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode && textNode.nodeValue !== label) textNode.nodeValue = label;
  }

  function applyGenericLanguage() {
    const profile = readProfile() || {};
    const compactBusinessName = String(profile.businessName || "我的工作台")
      .split("·")
      .map((part) => part.trim())
      .find((part) => part && part !== "新业务" && part !== "经营助手") || "我的工作台";
    setText(document.querySelector(".logo-sub"), `${compactBusinessName} · 经营助手`);
    setNavLabel("home", "首页");
    setNavLabel("intake", "录单");
    setNavLabel("orders", "订单");
    setNavLabel("prep", "备货");
    setNavLabel("more", "更多");

    const intake = document.getElementById("page-intake");
    setText(intake?.querySelector("h1.pg"), "录入订单");
    setText(intake?.querySelector(".pg-sub"), "上传聊天截图，检查后保存订单。");
    const message = document.getElementById("msgInput");
    if (message) message.placeholder = "粘贴客户消息，例如：想订两件商品，周六下午自取。";

    const prep = document.getElementById("page-prep");
    setText(prep?.querySelector("h1.pg"), "备货");
    setText(prep?.querySelector(".pg-sub"), "查看今天需要准备的商品和材料。");
    setText(prep?.querySelector(".card b"), "材料需求");
    prep?.querySelector(".execution-context")?.remove();
    const prepSummaryTitle = prep?.querySelectorAll(".card")[1]?.querySelector("b")?.firstChild;
    if (prepSummaryTitle && prepSummaryTitle.nodeValue !== "备货摘要 ") {
      prepSummaryTitle.nodeValue = "备货摘要 ";
    }
    setText(document.getElementById("prepBtn"), "生成备货摘要");

    const menuPage = document.getElementById("page-menu");
    setText(menuPage?.querySelector("h1.pg"), "商品管理");
    setText(menuPage?.querySelector(".pg-sub"), "添加和编辑正在售卖的商品。");

    const more = document.getElementById("page-more");
    setText(more?.querySelector(".pg-sub"), "管理商品、内容和设置。");
    document.getElementById("businessScope")?.remove();
    const firstEntry = more?.querySelector(".entry-card");
    setText(firstEntry?.querySelector("b"), "商品管理");
    setText(firstEntry?.querySelector("small"), "商品 · 售价成本 · 材料配置");
    const contentEntry = more?.querySelectorAll(".entry-card")[1];
    if (contentEntry) contentEntry.hidden = false;

    const status = document.querySelector(".status-pill span:last-child");
    setText(status, "经营正常");
    document.querySelector(".status-pill")?.setAttribute("aria-label", "工作台运行正常");
    createSettingsCard();
    enhanceExampleCatalog();
  }

  function scheduleGenericLanguage() {
    if (V7.languageScheduled) return;
    V7.languageScheduled = true;
    setTimeout(() => {
      V7.languageScheduled = false;
      applyGenericLanguage();
    }, 0);
  }

  function updateSampleMessages() {
    if (typeof SAMPLES === "undefined" || !Array.isArray(SAMPLES)) return;
    const names = Object.keys(getFormalMenu());
    const first = names[0] || "商品";
    const second = names[1] || first;
    SAMPLES.splice(
      0,
      SAMPLES.length,
      `你好，想订两件${first}，周六下午四点自取。`,
      `需要一份${second}，明天下午配送。`,
      "跟上次一样再来一份，交付时间不变。",
      `${first}两件、${second}一件，分别周六和周日交付。`,
    );
  }

  function buildActiveAiPrompt(message, draft) {
    const profile = readProfile() || {};
    const activeMenu = getFormalMenu();
    const catalogLines = Object.entries(activeMenu).map(([name, item]) => {
      const recipe = (item.ingredients || [])
        .map((ingredient) => `${ingredient.name} ${ingredient.amount}${ingredient.unit}`)
        .join("、");
      return `- ${name}${recipe ? `；材料：${recipe}` : "；未配置材料"}`;
    });
    const orderLines = (orders || []).slice(-12).map(
      (order) =>
        `- ${order.customer || "未命名客户"}：${order.items || "未填写商品"}；${order.date || "日期未定"}；${order.status || "pending"}`,
    );
    const customerLines = (customers || []).slice(0, 8).map(
      (customer) =>
        `- ${customer.name}：上次 ${customer.lastItems || "无记录"}；累计 ${customer.count || 0} 单`,
    );
    const correctionLines = (editLog || []).slice(-10).map((entry) => `- ${JSON.stringify(entry)}`);
    const starter = templateName(profile.starterTemplateId);

    return `你是 SOUS 的订单理解助手。你负责理解与结构化，不负责金额、库存、毛利或材料数量计算。

【店铺信息】
店铺名称：${profile.businessName || "未填写"}
接单渠道：${(profile.channels || []).join("、") || "未填写"}
常用交付方式：${(profile.fulfillment || []).join("、") || "未填写"}

【当前真实启用的商品目录｜最高优先级】
${catalogLines.join("\n") || "- 当前没有启用的正式商品"}

【历史订单】
${orderLines.join("\n") || "- 暂无"}

【客户历史偏好】
${customerLines.join("\n") || "- 暂无"}

【用户修正记录】
${correctionLines.join("\n") || "- 暂无"}

【低权重启动信息】
最初使用过的启动模板：${starter}。这只用于辅助理解，不得据此断言店铺行业，也不得改变字段名称。

【输出要求】
只输出一个 JSON 对象，不要输出 Markdown：
{
  "parse_ok": true,
  "customer": "",
  "items": [{"product": "", "qty": 1}],
  "delivery_date": "",
  "delivery_time": "",
  "method": "自取/配送/到店服务/上门服务/未确定",
  "address": "",
  "customer_note": "",
  "customer_ref": "",
  "urgent": false,
  "confidence": {"customer":"high/low","items":"high/low","delivery_date":"high/low","delivery_time":"high/low","method":"high/low","address":"high/low","customer_note":"high/low","customer_ref":"high/low"},
  "reasons": {},
  "missing_critical": [],
  "follow_up": ""
}

规则：
1. 优先将商品描述匹配到上面的真实启用商品目录。
2. 无法确认时保留客户原话、将 items 标为 low，并要求人工确认。
3. 不得自行创建正式商品，不得因为商品名称推断固定行业。
4. 启动模板中的未启用示例不属于正式目录。
5. 客制、口味、包装和分装要求写入 customer_note。
6. 日期不确定、交付方式缺失或指代历史订单时必须标低置信度。
7. customer_note 只保留客户明确提出、会影响制作、包装或交付的特殊要求；用途、活动场景和交付后的安排属于无关背景，不得写入。不能从场景自行推断包装要求；存在潜在影响时标低置信度并追问。不超过 30 个汉字。
8. reasons 每项只说明一个不确定点，不超过 20 个汉字。follow_up 只写一句问题，不超过 40 个汉字。
${draft ? `9. 当前已有订单草稿，请将新消息合并进去：${JSON.stringify(draft)}` : ""}

客户输入：
${message}`;
  }

  function installAiContext() {
    if (typeof callWorkbenchApi !== "function") return;
    callAI = async function v7CallAI(userPrompt, images, task = "text") {
      const result = await callWorkbenchApi(
        "/api/ai",
        {
          prompt: userPrompt,
          images: (images || []).map(({ data, type }) => ({ data, type })),
          task,
        },
        100000,
      );
      return result.text;
    };
    buildParsePrompt = buildActiveAiPrompt;
  }

  function normalizeProductText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[（）()【】[\]\s·,，。;；:："'“”‘’]/g, "")
      .replace(/[×xX*]\d+(?:\.\d+)?/g, "")
      .replace(/\d+(?:\.\d+)?(?:件|个|份|盒|束|组|块|套)?$/g, "");
  }

  function productCore(value) {
    return normalizeProductText(value).replace(
      /(蛋糕|甜点|点心|花束|花礼|礼盒|套装|套餐|产品|商品)$/g,
      "",
    );
  }

  function matchCatalogProduct(segment, activeMenu) {
    const query = normalizeProductText(segment);
    const queryCore = productCore(segment);
    if (!query || query.length < 2) return null;
    const candidates = Object.entries(activeMenu)
      .map(([name, item]) => {
        const normalizedName = normalizeProductText(name);
        const aliases = (item.aliases || []).map(normalizeProductText).filter(Boolean);
        let score = 0;
        let reason = "";
        if (query.includes(normalizedName)) {
          score = 100;
          reason = "完整名称";
        } else if (aliases.some((alias) => query.includes(alias) || alias.includes(query))) {
          score = 95;
          reason = "商品别名";
        } else if (normalizedName.includes(query) && query.length >= 2) {
          score = 88;
          reason = "关键词";
        } else {
          const core = productCore(name);
          if (queryCore.length >= 2 && core && (core.includes(queryCore) || queryCore.includes(core))) {
            score = 82;
            reason = "简称";
          }
        }
        return { name, score, reason };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || b.name.length - a.name.length);
    if (!candidates.length) return null;
    if (candidates[1] && candidates[1].score === candidates[0].score) return null;
    return candidates[0];
  }

  function parseOrderDemand() {
    const demand = new Map();
    const unknown = new Map();
    const activeMenu = getFormalMenu();
    const pendingOrders = (orders || []).filter(
      (order) => order.status === "pending" || order.status === "needs_confirmation",
    );
    for (const order of pendingOrders) {
      const segments = String(order.items || "")
        .split(/[、,，;；\n]+/)
        .map((segment) => segment.trim())
        .filter(Boolean);
      for (const segment of segments) {
        const qtyMatch = segment.match(/[×xX*]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:件|个|份|盒|束|组|块|套)?$/);
        const qty = Number(qtyMatch?.[1] || qtyMatch?.[2]) || 1;
        const match = matchCatalogProduct(segment, activeMenu);
        const name = match?.name;
        const target = name ? demand : unknown;
        const key = name || segment.replace(/[×xX*]\s*\d+(?:\.\d+)?$/, "").trim();
        if (!key) continue;
        if (!target.has(key)) target.set(key, { qty: 0, sources: [], matchReasons: [] });
        target.get(key).qty += qty;
        target.get(key).sources.push(`${order.customer || "未命名客户"} · ${segment}${match && match.reason !== "完整名称" ? `（${match.reason}匹配）` : ""}`);
        if (match && match.reason !== "完整名称") {
          const sourceName = segment.replace(/[×xX*]\s*\d+(?:\.\d+)?$/, "").trim();
          target.get(key).matchReasons.push(`“${sourceName}” → ${name} · ${match.reason}匹配`);
        }
      }
    }
    return { demand, unknown, pendingOrders };
  }

  async function renderDeterministicPrep() {
    const target = document.getElementById("prepTable");
    if (!target) return;
    const { demand, unknown, pendingOrders } = parseOrderDemand();
    if (!pendingOrders.length) {
      target.innerHTML = `<div class="empty" style="padding:18px">暂无待处理订单需要备货。</div>`;
      return;
    }

    const materialRows = new Map();
    const missingRecipes = [];
    for (const [productName, detail] of demand) {
      const item = menu[productName];
      const ingredients = item?.ingredients || [];
      if (!ingredients.length) {
        missingRecipes.push(productName);
        continue;
      }
      for (const ingredient of ingredients) {
        const key = `${ingredient.name}|${ingredient.unit}`;
        if (!materialRows.has(key)) {
          materialRows.set(key, {
            name: ingredient.name,
            unit: ingredient.unit,
            needed: 0,
            sources: [],
          });
        }
        const row = materialRows.get(key);
        row.needed += Number(ingredient.amount || 0) * detail.qty;
        row.sources.push(`${productName} ×${detail.qty}`);
      }
    }

    const unitsByName = new Map();
    for (const row of materialRows.values()) {
      if (!unitsByName.has(row.name)) unitsByName.set(row.name, new Set());
      unitsByName.get(row.name).add(row.unit);
    }
    const inventory = (await store.get("inventory")) || {};
    const demandRows = [
      ...[...demand].map(
        ([name, detail]) => `
          <div class="v7-demand-row"><span><strong>${esc(name)}</strong>${missingRecipes.includes(name) ? ` <span class="v7-missing">缺少材料配置</span>` : ""}${detail.matchReasons?.length ? `<small class="v7-match-reason">${esc([...new Set(detail.matchReasons)].join("；"))}</small>` : ""}</span><b>×${detail.qty}</b></div>`,
      ),
      ...[...unknown].map(
        ([name, detail]) => `
          <div class="v7-demand-row"><span><strong>${esc(name)}</strong> <span class="v7-missing">未匹配到正式商品</span></span><b>×${detail.qty}</b></div>`,
      ),
    ].join("");
    const materialHtml = [...materialRows.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
      .map((row) => {
        const stock = Number(inventory[`${row.name}|${row.unit}`]) || 0;
        const purchase = Math.max(0, row.needed - stock);
        const conflict = unitsByName.get(row.name)?.size > 1;
        return `
          <div class="v7-material-row">
            <div class="v7-material-main">
              <div><div class="v7-material-name">${esc(row.name)}</div><div class="v7-material-meta">需求 ${row.needed.toFixed(1)} ${esc(row.unit)} · 库存 ${stock.toFixed(1)} ${esc(row.unit)}</div></div>
              <div class="v7-material-qty">建议采购<br>${purchase.toFixed(1)} ${esc(row.unit)}</div>
            </div>
            ${conflict ? `<div class="v7-unit-warning">单位冲突：同名材料按单位分开显示，请统一单位后再合并。</div>` : ""}
            <div class="v7-source">计算来源：${esc(row.sources.join("、"))}</div>
          </div>`;
      })
      .join("");

    target.innerHTML = `
      <div class="prep-meta">来自 ${pendingOrders.length} 笔待处理订单。示例商品不参与计算。</div>
      <section class="v7-product-demand"><b>商品需求量</b>${demandRows || "<span class='v7-missing'>没有匹配到正式商品</span>"}</section>
      ${materialHtml || `<div class="prep-warning">当前没有可计算的材料数量。请先为正式商品配置材料。</div>`}`;
  }

  function withFormalMenu(callback) {
    const original = menu;
    menu = getFormalMenu();
    try {
      return callback();
    } finally {
      menu = original;
    }
  }

  function installDataFilters() {
    const originalRenderHome = renderHome;
    renderHome = function v7RenderHome() {
      return withFormalMenu(() => originalRenderHome());
    };

    const originalWeeklyChecks = renderWeeklyChecks;
    renderWeeklyChecks = function v7WeeklyChecks() {
      return withFormalMenu(() => originalWeeklyChecks());
    };

    renderPrepTable = function v7Prep() {
      renderDeterministicPrep().catch((error) => {
        const target = document.getElementById("prepTable");
        if (target) target.innerHTML = `<div class="prep-warning">备货计算失败：${esc(error.message)}</div>`;
      });
    };

    const originalRenderMenu = renderMenu;
    renderMenu = function v7RenderMenu() {
      const result = originalRenderMenu();
      enhanceExampleCatalog();
      return result;
    };
  }

  function bindEvents() {
    const shell = document.getElementById("sousSetup");
    shell.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-v7-choice]");
      if (choice) {
        choice.classList.toggle("on");
        if (choice.dataset.v7Choice === "channels" && choice.dataset.value === "其他") {
          const field = document.getElementById("v7OtherChannelField");
          field.hidden = !choice.classList.contains("on");
          if (!field.hidden) document.getElementById("v7OtherChannel")?.focus();
        }
        return;
      }
      if (event.target.closest("[data-v7-close-settings]")) {
        closeSetup();
        return;
      }
      if (event.target.closest("[data-v7-welcome]")) {
        showStep(0);
        return;
      }
      const templateButton = event.target.closest("[data-v7-template]");
      if (templateButton) {
        V7.selectedTemplateId = templateButton.dataset.v7Template;
        initializeTemplateSelection(selectedTemplate());
        renderTemplateOptions();
        return;
      }
      if (event.target.closest("[data-v7-next]")) {
        if (validateBusinessInfo()) showStep(1);
        return;
      }
      if (event.target.closest("[data-v7-prev]")) {
        if (V7.settingsMode) closeSetup();
        else showStep(0);
        return;
      }
      if (event.target.closest("[data-v7-preview]")) {
        if (V7.selectedTemplateId === "blank") finishWithoutTemplate();
        else {
          initializeTemplateSelection(selectedTemplate());
          showStep(2);
        }
        return;
      }
      if (event.target.closest("[data-v7-back-template]")) {
        showStep(1);
        return;
      }
      if (event.target.closest("[data-v7-blank]")) {
        V7.selectedTemplateId = "blank";
        finishWithoutTemplate();
        return;
      }
      if (event.target.closest("[data-v7-add-manual]")) {
        const input = document.getElementById("v7ManualName");
        const unit = document.getElementById("v7ManualUnit")?.value || "件";
        const name = input?.value.trim() || "";
        if (!name) { input?.focus(); return; }
        if (V7.manualProducts.some((item) => item.name === name) || menu[name]) {
          const message = document.getElementById("v7ImportError");
          message.textContent = "这个商品已经存在，请换一个名称";
          message.hidden = false;
          input?.focus();
          return;
        }
        V7.manualProducts.push({ id: `manual-${Date.now().toString(36)}`, name, unit });
        renderPreview();
        return;
      }
      const removeManual = event.target.closest("[data-v7-remove-manual]");
      if (removeManual) {
        V7.manualProducts = V7.manualProducts.filter((item) => item.id !== removeManual.dataset.v7RemoveManual);
        renderPreview();
        return;
      }      if (event.target.closest("[data-v7-import]")) {
        importSelectedTemplate().catch((error) => {
          const message = document.getElementById("v7ImportError");
          message.textContent = error.message;
          message.hidden = false;
        });
      }
    });

    shell.addEventListener("change", (event) => {
      const product = event.target.closest("[data-preview-product]");
      if (product) {
        product.checked
          ? V7.selectedProducts.add(product.dataset.previewProduct)
          : V7.selectedProducts.delete(product.dataset.previewProduct);
        renderPreview();
        return;
      }
      const material = event.target.closest("[data-preview-material]");
      if (material) {
        material.checked
          ? V7.selectedMaterials.add(material.dataset.previewMaterial)
          : V7.selectedMaterials.delete(material.dataset.previewMaterial);
        renderPreview();
        return;
      }
      const fulfillment = event.target.closest("[data-preview-fulfillment]");
      if (fulfillment) {
        fulfillment.checked
          ? V7.selectedFulfillment.add(fulfillment.dataset.previewFulfillment)
          : V7.selectedFulfillment.delete(fulfillment.dataset.previewFulfillment);
        renderPreview();
      }
    });

    document.addEventListener("click", (event) => {
      const activate = event.target.closest("[data-activate-example]");
      if (activate) {
        promoteExample(activate.dataset.activateExample);
        return;
      }
      if (event.target.closest("[data-manage-templates]")) {
        openSetup(true);
        return;
      }
      if (event.target.closest("[data-promote-all]")) {
        promoteAllExamples();
        return;
      }
      if (event.target.closest("[data-clear-examples]")) {
        clearInactiveExamples();
        return;
      }
      scheduleGenericLanguage();
    }, true);

    document.addEventListener("change", (event) => {
      const item = event.target.closest("#menuList .menu-item");
      const name = item?.querySelector(".mname")?.textContent.replace("示例", "").trim();
      if (name && menu[name]?.isExample && event.target.matches("input,select,textarea")) {
        promoteExample(name, false);
      }
    }, true);
  }

  function postRender() {
    applyGenericLanguage();
    updateSampleMessages();
  }

  async function init() {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/workbench-v7.css";
    document.head.appendChild(style);

    try {
      await loadTemplates();
      await migrateLegacyData();
    } catch (error) {
      console.error("SOUS v7 migration failed", error);
    }

    document.getElementById("sousSetup")?.remove();
    document.body.classList.remove("setup-open");
    document.body.insertAdjacentHTML("beforeend", setupMarkup());
    installAiContext();
    installDataFilters();
    bindEvents();
    renderAll();
    postRender();
    window.sousOpenBusinessSetup = () => openSetup(true);
    window.sousStarterTemplates = {
      open: () => openSetup(true),
      promoteAllExamples,
      clearInactiveExamples,
      getActiveCatalog: () => clone(getFormalMenu()),
      getMaterials: () => clone(V7.materials),
    };

    const profile = readProfile();
    const session = readOnboardingSession();
    const previewWelcome = new URLSearchParams(window.location.search).get("welcome") === "1";
    const legacyCompleted = Boolean(profile?.businessName && profile?.email && profile?.onboardingCompleted === undefined && !session);
    const onboardingCompleted = profile?.onboardingCompleted === true || legacyCompleted;
    if (previewWelcome) openSetup(false, -1, true);
    else if (!onboardingCompleted) openSetup(false, Number.isInteger(session?.currentStep) ? session.currentStep : -1);
    else closeSetup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();












