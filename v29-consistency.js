(() => {
  "use strict";

  const INDEX_KEY = "sous:workspaces:v1";
  const ACTIVE_KEY = "sous:active-workspace:v1";
  const PROFILE_KEY = "sous:business-profile:v1";
  const DATA_KEYS = [
    "orders",
    "menu",
    "editLog",
    "customers",
    "parseCountWeek",
    "prefs",
    "materials",
    "starterTemplateHistory",
  ];
  const PAGE_LABELS = {
    home: "首页",
    intake: "录单",
    orders: "订单",
    prep: "备货",
    more: "经营工具",
    menu: "商品管理",
    content: "AI 内容助手",
  };
  const INDUSTRY_LABELS = {
    bakery: "烘焙甜品",
    floristry: "鲜花花艺",
    food: "餐食料理",
    handmade: "手作产品",
    blank: "自定义",
  };

  let syncing = false;

  const readJson = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const activeId = () => localStorage.getItem(ACTIVE_KEY) || "primary";
  const profile = () => readJson(PROFILE_KEY, {});
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function currentPage() {
    return document.querySelector(".page.on")?.id?.replace(/^page-/, "") || "home";
  }

  function workspaceIndex() {
    const indexed = readJson(INDEX_KEY, []);
    const merged = new Map(indexed.map((item) => [item.id, item]));

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sous:workspace:")) continue;
      const id = key.slice("sous:workspace:".length);
      const snapshot = readJson(key, null);
      if (!snapshot) continue;
      const previous = merged.get(id) || {};
      merged.set(id, {
        id,
        name: snapshot.profile?.businessName || previous.name || "未命名业务",
        industry: snapshot.profile?.starterTemplateId || previous.industry || "blank",
        updatedAt: snapshot.savedAt || previous.updatedAt || "",
      });
    }

    const result = [...merged.values()];
    if (!result.some((item) => item.id === activeId())) {
      result.push({
        id: activeId(),
        name: profile().businessName || "当前业务",
        industry: profile().starterTemplateId || "blank",
        updatedAt: new Date().toISOString(),
      });
    }
    writeJson(INDEX_KEY, result);
    return result;
  }

  function snapshotCurrent() {
    const id = activeId();
    const currentProfile = profile();
    const savedAt = new Date().toISOString();
    const snapshot = { profile: currentProfile, savedAt };
    DATA_KEYS.forEach((key) => {
      snapshot[key] = readJson(`sous:${key}`, null);
    });
    writeJson(`sous:workspace:${id}`, snapshot);

    const list = workspaceIndex();
    const next = {
      id,
      name: currentProfile.businessName || "当前业务",
      industry: currentProfile.starterTemplateId || "blank",
      updatedAt: savedAt,
    };
    writeJson(
      INDEX_KEY,
      list.some((item) => item.id === id)
        ? list.map((item) => (item.id === id ? next : item))
        : [...list, next],
    );
  }

  function switchWorkspace(id) {
    if (!id || id === activeId()) return;
    const next = readJson(`sous:workspace:${id}`, null);
    if (!next) return;

    snapshotCurrent();
    localStorage.setItem(ACTIVE_KEY, id);
    writeJson(PROFILE_KEY, next.profile || {});
    DATA_KEYS.forEach((key) => {
      if (next[key] == null) localStorage.removeItem(`sous:${key}`);
      else writeJson(`sous:${key}`, next[key]);
    });
    location.reload();
  }

  function normalizeSettingsButtons() {
    document.querySelectorAll("header.top").forEach((header) => {
      const old = header.querySelector(".account-settings");
      if (!old) return;
      const isNormalized =
        old.dataset.v29Ready === "true" &&
        old.children.length === 1 &&
        old.firstElementChild?.tagName === "IMG" &&
        !old.textContent.trim();
      if (isNormalized) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "account-settings";
      button.dataset.v29Ready = "true";
      button.setAttribute("aria-label", "打开设置");
      button.setAttribute("title", "设置");
      button.innerHTML = '<img src="/v27-settings.svg" alt="" aria-hidden="true">';
      button.addEventListener("click", () => {
        const origin = currentPage();
        if (origin === "settings") return;
        window.__settingsReturnPage = origin;
        window.go?.("settings");
        requestAnimationFrame(normalizeSettingsBack);
      });
      old.replaceWith(button);
    });
  }

  function normalizeSettingsBack() {
    const old = document.querySelector("#page-settings .back-chip");
    if (!old) return;
    const origin =
      window.__settingsReturnPage && window.__settingsReturnPage !== "settings"
        ? window.__settingsReturnPage
        : "more";
    const label = PAGE_LABELS[origin] || "上一页";

    if (old.dataset.v29Ready !== "true") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "back-chip";
      button.dataset.v29Ready = "true";
      button.addEventListener("click", () => {
        const destination =
          window.__settingsReturnPage && window.__settingsReturnPage !== "settings"
            ? window.__settingsReturnPage
            : "more";
        window.go?.(destination);
      });
      old.replaceWith(button);
      button.textContent = `← 返回${label}`;
      button.setAttribute("aria-label", `返回${label}`);
      return;
    }
    const nextText = '\u2190 \u8fd4\u56de' + label;
    if (old.textContent !== nextText) old.textContent = nextText;
    if (old.getAttribute('aria-label') !== nextText) old.setAttribute('aria-label', nextText);
  }

  function openNewWorkspaceFlow() {
    snapshotCurrent();
    window.__v27WorkspaceSource = profile();
    window.__v27CreateWorkspace = true;
    window.sousStarterTemplates?.open?.();
    setTimeout(() => {
      const title = document.querySelector('#sousSetup [data-v7-step="1"] .setup-title');
      const copy = document.querySelector('#sousSetup [data-v7-step="1"] .setup-copy');
      if (title) title.textContent = "添加另一个业务";
      if (copy) copy.textContent = "新业务会单独保存商品和订单，当前业务不会被替换。";
    }, 0);
  }

  function normalizeWorkspaceCard() {
    const card = document.querySelector("#page-settings .workspace-card");
    if (!card) return;
    const list = workspaceIndex();
    const current = activeId();
    const currentProfile = profile();
    const signature = JSON.stringify({
      current,
      list: list.map(({ id, name, industry }) => ({ id, name, industry })),
    });
    const hasUnifiedStructure =
      card.querySelector(".v29-workspace-list") &&
      card.querySelectorAll("[data-v29-workspace]").length === list.length;
    if (card.dataset.v29Signature === signature && hasUnifiedStructure) return;

    card.dataset.v29Signature = signature;
    card.classList.add("v29-workspace-card");
    card.innerHTML = `
      <div class="v29-workspace-current">
        <span>正在使用</span>
        <b>${escapeHtml(currentProfile.businessName || "当前业务")}</b>
        <small>每个业务的商品、订单和设置分别保存</small>
      </div>
      <div class="v29-workspace-list" aria-label="业务空间列表">
        ${list
          .map(
            (item) => `
              <button type="button" data-v29-workspace="${escapeHtml(item.id)}" ${
                item.id === current ? 'aria-current="true"' : ""
              }>
                <span>
                  <b>${escapeHtml(item.name)}</b>
                  <small>${escapeHtml(INDUSTRY_LABELS[item.industry] || "自定义")}</small>
                </span>
                <em>${item.id === current ? "当前" : "切换"}</em>
              </button>`,
          )
          .join("")}
      </div>
      <button class="v29-workspace-add" type="button">＋ 添加另一个业务</button>
      <p class="v29-workspace-help">原业务会保留，之后可以随时切换回来。</p>`;

    card.querySelectorAll("[data-v29-workspace]").forEach((button) => {
      button.addEventListener("click", () => switchWorkspace(button.dataset.v29Workspace));
    });
    card.querySelector(".v29-workspace-add")?.addEventListener("click", openNewWorkspaceFlow);

    const label = card.closest(".settings-section")?.querySelector(":scope > .section-label");
    if (label) label.textContent = "业务空间";
  }

  function moveIndustryEntryToBottom() {
    const page = document.getElementById("page-more");
    const entry = document.getElementById("v27BusinessEntry");
    if (!page || !entry) return;

    entry.classList.add("v29-business-entry");
    const contentEntry = [...page.children].find((node) =>
      node.classList?.contains("entry-card") &&
      (node.getAttribute("onclick")?.includes("content") || node.textContent.includes("AI 内容助手"))
    );
    if (contentEntry && contentEntry.nextElementSibling !== entry) contentEntry.after(entry);
    const button = entry.querySelector("button");
    if (button && button.dataset.v29Ready !== 'true') {
      button.dataset.v29Ready = 'true';
      button.innerHTML = "<b>切换经营行业</b><span>在设置中管理独立业务 →</span>";
    }
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      normalizeSettingsButtons();
      normalizeSettingsBack();
      normalizeWorkspaceCard();
      moveIndustryEntryToBottom();
    } finally {
      syncing = false;
    }
  }

  document.addEventListener("DOMContentLoaded", sync);
  window.addEventListener("load", sync);
  new MutationObserver(() => requestAnimationFrame(sync)).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(sync, 600);
  sync();
})();
