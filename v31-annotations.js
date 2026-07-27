(() => {
  "use strict";

  const labels = {
    home: "\u9996\u9875",
    intake: "\u5f55\u5355",
    orders: "\u8ba2\u5355",
    prep: "\u5907\u8d27",
    more: "\u7ecf\u8425\u5de5\u5177",
    menu: "\u5546\u54c1\u7ba1\u7406",
    content: "AI \u5185\u5bb9\u52a9\u624b"
  };

  const currentPage = () => document.querySelector(".page.on")?.id?.replace(/^page-/, "") || "home";

  const refreshEmptyOrder = () => {
    const empty = document.querySelector("#orderList .empty");
    if (!empty || empty.dataset.v31Ready === "true") return;
    empty.dataset.v31Ready = "true";
    empty.innerHTML = `<div class="empty-icon">Order</div><b>\u8fd8\u6ca1\u6709\u8ba2\u5355</b><span>\u5f55\u5165\u5ba2\u6237\u6d88\u606f\uff0c\u6838\u5bf9\u540e\u5373\u53ef\u521b\u5efa\u7b2c\u4e00\u7b14\u8ba2\u5355\u3002</span><button class="btn primary small" onclick="go('intake')">\u5f00\u59cb\u5f55\u5355</button>`;
  };

  const updateSettingsBack = () => {
    const back = document.querySelector("#page-settings .back-chip");
    if (!back) return;
    const origin = window.__settingsReturnPage && window.__settingsReturnPage !== "settings" ? window.__settingsReturnPage : "more";
    const text = "← 返回";
    if (back.textContent !== text) back.textContent = text;
    back.setAttribute("aria-label", text);
    back.dataset.v29Ready = "true";
    back.dataset.v31Ready = "true";
    back.onclick = null;
    if (!back.dataset.v31Bound) {
      back.dataset.v31Bound = "true";
      back.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const destination = window.__settingsReturnPage && window.__settingsReturnPage !== "settings" ? window.__settingsReturnPage : "more";
        window.go?.(destination);
      }, true);
    }
  };

  const normalizeSettingsButton = () => {
    document.querySelectorAll("header.top .account-settings").forEach((old) => {
      if (old.dataset.v31Ready === "true") return;
      const button = old.cloneNode(true);
      button.dataset.v29Ready = "true";
      button.dataset.v31Ready = "true";
      button.setAttribute("aria-label", "\u6253\u5f00\u8bbe\u7f6e");
      button.setAttribute("title", "\u8bbe\u7f6e");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const origin = currentPage();
        if (origin === "settings") return;
        window.__settingsReturnPage = origin;
        sessionStorage.setItem("sous:settings-return-page", origin);
        window.go?.("settings");
        requestAnimationFrame(updateSettingsBack);
      }, true);
      old.replaceWith(button);
    });
  };

  const simplifySettings = () => {
    const page = document.getElementById("page-settings");
    if (!page) return;
    const savedOrigin = sessionStorage.getItem("sous:settings-return-page");
    if (!window.__settingsReturnPage && savedOrigin) window.__settingsReturnPage = savedOrigin;
    const subtitle = page.querySelector(".pg-sub");
    if (subtitle && subtitle.textContent !== "\u7ba1\u7406\u4e1a\u52a1\u7a7a\u95f4\u4e0e\u672c\u673a\u6570\u636e\u3002") subtitle.textContent = "\u7ba1\u7406\u4e1a\u52a1\u7a7a\u95f4\u4e0e\u672c\u673a\u6570\u636e\u3002";
    const delivery = page.querySelector("#prefDelivery");
    if (delivery) {
      delivery.disabled = true;
      delivery.closest(".card")?.classList.add("v31-removed-default");
    }
    const moved = page.querySelector("#movedSettings");
    const label = moved?.querySelector(":scope > .section-label");
    if (label && label.textContent !== "\u6570\u636e\u4e0e\u8bb0\u5f55") label.textContent = "\u6570\u636e\u4e0e\u8bb0\u5f55";
    updateSettingsBack();
  };

  const ensureOtherTemplate = () => {
    const grid = document.getElementById("v7TemplateGrid");
    if (!grid || grid.querySelector("[data-v31-other]")) return;
    const selected = !grid.querySelector(".v7-template.on");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `v7-template v31-other-template${selected ? " on" : ""}`;
    button.dataset.v7Template = "blank";
    button.dataset.v31Other = "true";
    button.innerHTML = `<b>\u5176\u4ed6\u884c\u4e1a</b><small>\u81ea\u5b9a\u4e49\u5546\u54c1\u76ee\u5f55</small>`;
    grid.append(button);
    if (selected) {
      const next = document.querySelector("[data-v7-preview]");
      if (next) next.textContent = "\u4f7f\u7528\u5176\u4ed6\u884c\u4e1a";
    }
  };

  const normalizeSetup = () => {
    const shell = document.getElementById("sousSetup");
    if (!shell) return;
    ensureOtherTemplate();
    const industryOn = shell.querySelector('[data-v7-step="1"].on');
    shell.classList.toggle("v31-industry-step", Boolean(industryOn));
  };

  const normalizeDialog = () => {
    const dialog = document.getElementById("v6Dialog");
    if (!dialog) return;
    const kicker = dialog.querySelector(".v6-dialog-kicker");
    const cancel = dialog.querySelector("[data-dialog-cancel]");
    const confirm = dialog.querySelector("[data-dialog-confirm]");
    if (kicker) kicker.textContent = "\u8bf7\u786e\u8ba4";
    if (cancel) cancel.textContent = "\u53d6\u6d88";
    if (confirm && !confirm.textContent.trim()) confirm.textContent = "\u786e\u8ba4";
  };
  const WORKSPACE_INDEX = "sous:workspaces:v1";
  const ACTIVE_WORKSPACE = "sous:active-workspace:v1";
  const PROFILE_KEY = "sous:business-profile:v1";
  const WORKSPACE_DATA_KEYS = ["orders", "menu", "editLog", "customers", "parseCountWeek", "prefs", "materials", "inventory", "starterTemplateHistory"];

  const readStoredJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const writeStoredJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const renameWorkspace = (id) => {
    const list = readStoredJson(WORKSPACE_INDEX, []);
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    const nextName = window.prompt("业务名称", item.name || "未命名业务")?.trim();
    if (!nextName || nextName === item.name) return;

    writeStoredJson(WORKSPACE_INDEX, list.map((entry) => entry.id === id ? { ...entry, name: nextName, updatedAt: new Date().toISOString() } : entry));
    const snapshotKey = `sous:workspace:${id}`;
    const snapshot = readStoredJson(snapshotKey, {});
    snapshot.profile = { ...(snapshot.profile || {}), businessName: nextName };
    snapshot.savedAt = new Date().toISOString();
    writeStoredJson(snapshotKey, snapshot);

    if ((localStorage.getItem(ACTIVE_WORKSPACE) || "primary") === id) {
      const currentProfile = readStoredJson(PROFILE_KEY, {});
      writeStoredJson(PROFILE_KEY, { ...currentProfile, businessName: nextName });
    }
    document.querySelector("#page-settings .workspace-card")?.removeAttribute("data-v29-signature");
    window.toast?.("业务名称已更新");
  };
  const deleteWorkspace = (id) => {
    const list = readStoredJson(WORKSPACE_INDEX, []);
    if (list.length <= 1) {
      window.toast?.("至少保留一个业务");
      return;
    }
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    const isCurrent = (localStorage.getItem(ACTIVE_WORKSPACE) || "primary") === id;
    const snapshot = isCurrent
      ? { orders: readStoredJson("sous:orders", []), menu: readStoredJson("sous:menu", {}) }
      : readStoredJson(`sous:workspace:${id}`, {});
    const orderCount = Array.isArray(snapshot.orders) ? snapshot.orders.length : 0;
    const productCount = snapshot.menu && typeof snapshot.menu === "object" ? Object.keys(snapshot.menu).length : 0;
    if (!window.confirm(`删除业务“${item.name || "未命名业务"}”？\n包含 ${orderCount} 笔订单、${productCount} 个商品。删除后无法恢复。`)) return;

    const remaining = list.filter((entry) => entry.id !== id);
    localStorage.removeItem(`sous:workspace:${id}`);
    writeStoredJson(WORKSPACE_INDEX, remaining);

    if ((localStorage.getItem(ACTIVE_WORKSPACE) || "primary") === id) {
      const nextId = remaining[0]?.id;
      const next = readStoredJson(`sous:workspace:${nextId}`, null);
      if (nextId && next) {
        localStorage.setItem(ACTIVE_WORKSPACE, nextId);
        writeStoredJson(PROFILE_KEY, next.profile || {});
        WORKSPACE_DATA_KEYS.forEach((key) => {
          if (next[key] == null) localStorage.removeItem(`sous:${key}`);
          else writeStoredJson(`sous:${key}`, next[key]);
        });
        location.reload();
        return;
      }
    }
    document.querySelector("#page-settings .workspace-card")?.removeAttribute("data-v29-signature");
    window.toast?.("业务已删除");
  };

  const enhanceWorkspaceCard = () => {
    const card = document.querySelector("#page-settings .v29-workspace-card");
    if (!card) return;
    const buttons = [...card.querySelectorAll("[data-v29-workspace]")];
    buttons.forEach((button) => {
      if (button.parentElement?.classList.contains("v31-workspace-row")) return;
      const row = document.createElement("div");
      row.className = "v31-workspace-row";
      button.before(row);
      row.append(button);
      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "v31-workspace-rename";
      rename.dataset.workspaceRename = button.dataset.v29Workspace;
      rename.textContent = "重命名";
      rename.setAttribute("aria-label", `重命名业务 ${button.querySelector("b")?.textContent || ""}`);
      row.append(rename);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "v31-workspace-delete";
      remove.dataset.workspaceDelete = button.dataset.v29Workspace;
      remove.textContent = "删除";
      remove.setAttribute("aria-label", `删除业务 ${button.querySelector("b")?.textContent || ""}`);
      row.append(remove);
    });

    const add = card.querySelector(".v29-workspace-add");
    if (add) {
      const atLimit = buttons.length >= 2;
      add.disabled = atLimit;
      add.textContent = atLimit ? "最多可保留 2 个业务" : "＋ 添加另一个业务";
      add.setAttribute("aria-disabled", String(atLimit));
    }
    const help = card.querySelector(".v29-workspace-help");
    if (help) help.textContent = buttons.length >= 2 ? "已达到上限；删除一个业务后可再次添加。" : "每个业务的数据独立保存。";
  };

  const normalizeBackLabels = () => {
    document.querySelectorAll(".back-chip, [data-v7-close-settings]").forEach((button) => {
      if (button.textContent.trim() !== "← 返回") button.textContent = "← 返回";
      button.setAttribute("aria-label", "返回");
    });
  };
  const initialize = () => {
    normalizeSettingsButton();
    normalizeDialog();
    simplifySettings();
    normalizeSetup();
    refreshEmptyOrder();
    enhanceWorkspaceCard();
    normalizeBackLabels();
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const workspaceRename = target.closest("[data-workspace-rename]");
      if (workspaceRename) {
        event.preventDefault();
        event.stopImmediatePropagation();
        renameWorkspace(workspaceRename.dataset.workspaceRename);
        return;
      }
      const workspaceDelete = target.closest("[data-workspace-delete]");
      if (workspaceDelete) {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteWorkspace(workspaceDelete.dataset.workspaceDelete);
        return;
      }
      if (target.closest(".account-settings")) {
        requestAnimationFrame(() => {
          simplifySettings();
          updateSettingsBack();
        });
      }
      window.setTimeout(() => {
        refreshEmptyOrder();
        enhanceWorkspaceCard();
        normalizeBackLabels();
      }, 0);
      if (target.closest("[data-v7-template], [data-v7-preview], [data-v7-back-template], [data-v9-open-templates], [data-manage-templates], [data-v27-new-workspace], [data-v29-new-workspace]")) {
        window.setTimeout(normalizeSetup, 0);
      }
    });
    window.SOUSRuntime?.registerSync("v31-annotations", () => {
      enhanceWorkspaceCard();
      normalizeBackLabels();
    });
  };

  window.addEventListener("load", initialize);
})();







(() => {
  "use strict";

  const syncOnboardingPolish = () => {
    const shell = document.getElementById("sousSetup");
    if (!shell || shell.hidden) return;
    const industry = shell.querySelector('[data-v7-step="1"].on');
    const products = shell.querySelector('[data-v7-step="2"].on');
    const label = shell.querySelector("#v7StepLabel");

    if (industry) {
      if (label) label.textContent = "1 / 2 · 选择行业";
      const grid = shell.querySelector("#v7TemplateGrid");
      if (grid && !grid.querySelector('[data-v7-template="blank"]')) {
        const other = document.createElement("button");
        other.type = "button";
        other.className = `v7-template v31-other-template${grid.querySelector(".v7-template.on") ? "" : " on"}`;
        other.dataset.v7Template = "blank";
        other.innerHTML = "<b>其他行业</b><small>自定义商品目录</small>";
        grid.append(other);
      }
    }

    if (products) {
      if (label) label.textContent = "2 / 2 · 选择商品";
      const heading = shell.querySelector(".v7-manual-product .v7-preview-heading span");
      if (heading) heading.innerHTML = "<b>添加您的商品</b><small>输入商品名称和销售单位，加入自己的目录</small>";
    }
  };

  const start = () => {
    const shell = document.getElementById("sousSetup");
    if (!shell) return;
    const observer = new MutationObserver(() => requestAnimationFrame(syncOnboardingPolish));
    observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
    shell.addEventListener("click", () => requestAnimationFrame(syncOnboardingPolish));
    syncOnboardingPolish();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
(() => {
  "use strict";
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest("header.top .account-settings")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const origin = document.querySelector(".page.on")?.id?.replace(/^page-/, "") || "home";
      if (origin === "settings") return;
      window.__settingsReturnPage = origin;
      sessionStorage.setItem("sous:settings-return-page", origin);
      window.go?.("settings");
      return;
    }

    if (target.closest("#page-settings .back-chip")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const destination = window.__settingsReturnPage || sessionStorage.getItem("sous:settings-return-page") || "more";
      window.go?.(destination === "settings" ? "more" : destination);
    }
  }, true);
})();
(() => {
  "use strict";
  const syncWorkspaceCount = () => {
    const card = document.querySelector("#page-settings .v29-workspace-card");
    if (!card) return;
    const count = card.querySelectorAll("[data-v29-workspace]").length;
    card.classList.toggle("v31-single-workspace", count <= 1);
  };
  const observer = new MutationObserver(syncWorkspaceCount);
  const start = () => {
    const card = document.querySelector("#page-settings .v29-workspace-card");
    if (card) observer.observe(card, { childList: true, subtree: true });
    syncWorkspaceCount();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  window.addEventListener("load", syncWorkspaceCount);
})();