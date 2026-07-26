(() => {
  "use strict";

  const INDEX_KEY = "sous:workspaces:v1";
  const ACTIVE_KEY = "sous:active-workspace:v1";
  const PROFILE_KEY = "sous:business-profile:v1";
  const DATA_KEYS = ["orders", "menu", "editLog", "customers", "parseCountWeek", "prefs", "materials", "starterTemplateHistory"];
  const pageLabels = { home: "首页", intake: "录单", orders: "订单", prep: "备货", more: "更多", menu: "商品管理", content: "AI 内容助手" };

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const activeId = () => localStorage.getItem(ACTIVE_KEY) || "primary";
  const profile = () => readJson(PROFILE_KEY, {});
  const industryName = (id) => ({
    bakery: "烘焙甜品",
    floristry: "鲜花花艺",
    food: "餐食料理",
    handmade: "手作产品",
    blank: "自定义",
  })[id] || "自定义";

  function snapshotCurrent(id = activeId()) {
    const currentProfile = profile();
    const escapeText = (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
    const savedAt = new Date().toISOString();
    const snapshot = { profile: currentProfile, savedAt };
    DATA_KEYS.forEach((key) => { snapshot[key] = readJson(`sous:${key}`, null); });
    writeJson(`sous:workspace:${id}`, snapshot);
    const list = recoverWorkspaceIndex();
    const next = {
      id,
      name: currentProfile.businessName || list.find((item) => item.id === id)?.name || "当前业务",
      industry: currentProfile.starterTemplateId || list.find((item) => item.id === id)?.industry || "blank",
      updatedAt: savedAt,
    };
    writeJson(INDEX_KEY, list.some((item) => item.id === id)
      ? list.map((item) => item.id === id ? next : item)
      : [...list, next]);
  }

  function recoverWorkspaceIndex() {
    const indexed = readJson(INDEX_KEY, []);
    const merged = new Map(indexed.map((item) => [item.id, item]));
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sous:workspace:")) continue;
      const id = key.slice("sous:workspace:".length);
      const snapshot = readJson(key, null);
      if (!snapshot) continue;
      const existing = merged.get(id) || {};
      merged.set(id, {
        id,
        name: snapshot.profile?.businessName || existing.name || "未命名业务",
        industry: snapshot.profile?.starterTemplateId || existing.industry || "blank",
        updatedAt: snapshot.savedAt || existing.updatedAt || "",
      });
    }
    const result = [...merged.values()];
    writeJson(INDEX_KEY, result);
    return result;
  }

  function switchWorkspace(id) {
    if (!id || id === activeId()) return;
    snapshotCurrent();
    const next = readJson(`sous:workspace:${id}`, null);
    if (!next) return;
    localStorage.setItem(ACTIVE_KEY, id);
    writeJson(PROFILE_KEY, next.profile || {});
    DATA_KEYS.forEach((key) => {
      if (next[key] == null) localStorage.removeItem(`sous:${key}`);
      else writeJson(`sous:${key}`, next[key]);
    });
    location.reload();
  }

  function beginIndependentWorkspace() {
    const source = window.__v27WorkspaceSource || profile();
    const id = `space-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    localStorage.setItem(ACTIVE_KEY, id);
    DATA_KEYS.forEach((key) => localStorage.removeItem(`sous:${key}`));
    const fresh = {
      businessName: source.businessName ? `${source.businessName} · 新业务` : "新业务",
      email: source.email || "",
      channels: source.channels || [],
      fulfillment: source.fulfillment || [],
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    };
    writeJson(PROFILE_KEY, fresh);
    const snapshot = { profile: fresh, orders: [], menu: {}, editLog: [], customers: [], prefs: {}, savedAt: now };
    writeJson(`sous:workspace:${id}`, snapshot);
    const list = recoverWorkspaceIndex();
    writeJson(INDEX_KEY, [...list.filter((item) => item.id !== id), {
      id,
      name: fresh.businessName,
      industry: "blank",
      updatedAt: now,
    }]);
    if (typeof window.orders !== "undefined") window.orders = [];
    if (typeof window.menu !== "undefined") window.menu = {};
    if (typeof window.editLog !== "undefined") window.editLog = [];
    if (typeof window.customers !== "undefined") window.customers = [];
    if (typeof window.prefs !== "undefined") window.prefs = {};
  }

  function currentPage() {
    const active = document.querySelector(".page.on");
    return active?.id?.replace(/^page-/, "") || "home";
  }

  function installHeader() {
    document.querySelectorAll("header.top").forEach((header) => {
      const old = header.querySelector(".account-settings");
      if (!old || old.dataset.v27Ready) return;
      const button = old.cloneNode(false);
      button.dataset.v27Ready = "true";
      button.setAttribute("aria-label", "打开设置");
      button.setAttribute("title", "设置");
      button.innerHTML = '<img src="/v27-settings.svg" alt="" aria-hidden="true">';
      button.addEventListener("click", () => {
        window.__settingsReturnPage = currentPage();
        window.go?.("settings");
        updateSettingsBack();
      });
      old.replaceWith(button);
    });
  }

  function updateSettingsBack() {
    let button = document.querySelector("#page-settings .back-chip");
    if (!button) return;
    if (!button.dataset.v27Ready) {
      const clone = button.cloneNode(false);
      clone.dataset.v27Ready = "true";
      clone.addEventListener("click", () => {
        window.go?.(window.__settingsReturnPage || "more");
      });
      button.replaceWith(clone);
      button = clone;
    }
    const origin = window.__settingsReturnPage || "more";
    button.textContent = `← 返回${pageLabels[origin] || "上一页"}`;
    button.setAttribute("aria-label", `返回${pageLabels[origin] || "上一页"}`);
  }

  function renderWorkspaceSettings() {
    const card = document.querySelector("#page-settings .workspace-card");
    if (!card || card.dataset.v27Ready) return;
    const list = recoverWorkspaceIndex();
    const current = activeId();
    const currentProfile = profile();
    const escapeText = (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
    card.dataset.v27Ready = "true";
    card.innerHTML = `
      <div class="workspace-current">
        <span>正在使用</span>
        <b>${escapeText(currentProfile.businessName || "当前业务")}</b>
        <small>每个业务的商品和订单分别保存</small>
      </div>
      <div class="workspace-list" aria-label="业务列表">
        ${list.map((item) => `
          <button type="button" data-v27-workspace="${escapeText(item.id)}" ${item.id === current ? "aria-current=\"true\"" : ""}>
            <span><b>${escapeText(item.name)}</b><small>${escapeText(industryName(item.industry))}</small></span>
            <em>${item.id === current ? "当前" : "切换"}</em>
          </button>`).join("")}
      </div>
      <button class="workspace-add" type="button" id="v27NewWorkspace">＋ 添加另一个业务</button>
      <p class="workspace-help">原业务会保留，之后可随时切换回来。</p>`;
    card.querySelectorAll("[data-v27-workspace]").forEach((button) => {
      button.addEventListener("click", () => switchWorkspace(button.dataset.v27Workspace));
    });
    card.querySelector("#v27NewWorkspace")?.addEventListener("click", () => {
      snapshotCurrent();
      window.__v27WorkspaceSource = profile();
      window.__v27CreateWorkspace = true;
      window.sousStarterTemplates?.open?.();
      setTimeout(() => {
        const title = document.querySelector('#sousSetup [data-v7-step="1"] .setup-title');
        const copy = document.querySelector('#sousSetup [data-v7-step="1"] .setup-copy');
        if (title) title.textContent = "添加另一个业务";
        if (copy) copy.textContent = "选择行业后创建独立业务，当前业务不会被替换。";
      }, 0);
    });

    const movedLabel = document.querySelector("#movedSettings > .section-label");
    if (movedLabel) movedLabel.textContent = "订单偏好与数据";
  }

  function demoteIndustryEntry() {
    const more = document.getElementById("page-more");
    if (!more || document.getElementById("v27BusinessEntry")) return;
    const section = document.createElement("section");
    section.id = "v27BusinessEntry";
    section.className = "v27-business-entry";
    section.innerHTML = '<button type="button">切换经营行业 <span>在设置中管理独立业务 →</span></button>';
    section.querySelector("button")?.addEventListener("click", () => {
      window.__settingsReturnPage = "more";
      window.go?.("settings");
      updateSettingsBack();
      setTimeout(() => document.querySelector("#page-settings .settings-section")?.scrollIntoView({ block: "start" }), 0);
    });
    more.append(section);
  }

  function installNewWorkspaceInterception() {
    document.addEventListener("click", (event) => {
      if (!window.__v27CreateWorkspace) return;
      if (!event.target.closest("[data-v7-import],[data-v7-blank]")) return;
      beginIndependentWorkspace();
      window.__v27CreateWorkspace = false;
      setTimeout(() => snapshotCurrent(), 900);
    }, true);
  }

  function sync() {
    installHeader();
    updateSettingsBack();
    renderWorkspaceSettings();
    demoteIndustryEntry();
  }

  recoverWorkspaceIndex();
  installNewWorkspaceInterception();
  sync();
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
})();
