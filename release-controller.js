/* SOUS release controller.
 * This is the only post-baseline behavior layer. Keep all release fixes here.
 */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const readJson = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const ACTIVE_KEY = "sous:active-workspace:v1";
  const INDEX_KEY = "sous:workspaces:v1";
  const PROFILE_KEY = "sous:business-profile:v1";
  const DATA_KEYS = ["orders", "menu", "editLog", "customers", "parseCountWeek", "prefs", "materials", "inventory", "starterTemplateHistory"];
  const PAGE_LABELS = { home: "首页", intake: "录单", orders: "订单", prep: "备货", more: "更多" };
  const INDUSTRY_LABELS = { bakery: "烘焙甜品", floristry: "鲜花花艺", food: "餐食料理", handmade: "手作产品", blank: "其他行业" };
  const currentPage = () => $(".page.on")?.id?.replace(/^page-/, "") || "home";
  const activeWorkspace = () => localStorage.getItem(ACTIVE_KEY) || "primary";
  const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[\s，,。.!！?？:：;；"“”'‘’()（）\[\]【】]/g, "");
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  function enforceRegistrationGate() {
    const entry = $("#v30Entry");
    const setup = $("#sousSetup");
    const app = $(".app");
    const registrationOpen = Boolean(entry && !entry.hidden);
    document.body.classList.toggle("v30-entry-open", registrationOpen);
    if (registrationOpen) {
      if (setup) {
        setup.hidden = true;
        setup.setAttribute("inert", "");
        setup.setAttribute("aria-hidden", "true");
      }
      if (app) {
        app.setAttribute("inert", "");
        app.setAttribute("aria-hidden", "true");
      }
      return;
    }
    setup?.removeAttribute("inert");
    setup?.removeAttribute("aria-hidden");
    app?.removeAttribute("inert");
    app?.removeAttribute("aria-hidden");
  }

  function ensureDialogRoot() {
    let root = $("#sousReleaseDialog");
    if (root) return root;
    document.body.insertAdjacentHTML("beforeend", `<div id="sousReleaseDialog" class="sous-release-dialog-backdrop" hidden><section class="sous-release-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sousReleaseDialogTitle"><p class="sous-release-dialog-kicker">请确认</p><h2 id="sousReleaseDialogTitle"></h2><p id="sousReleaseDialogBody"></p><label class="sous-release-dialog-field" hidden><span>业务名称</span><input id="sousReleaseDialogInput" autocomplete="off"></label><div class="sous-release-dialog-summary" id="sousReleaseDialogSummary" hidden></div><div class="sous-release-dialog-actions"><button type="button" class="btn ghost" data-dialog-cancel>取消</button><button type="button" class="btn primary" data-dialog-confirm>确认</button></div></section></div>`);
    return $("#sousReleaseDialog");
  }

  function releaseDialog({ title, body = "", value = null, summary = "", confirmText = "确认", danger = false }) {
    const root = ensureDialogRoot();
    const field = $(".sous-release-dialog-field", root);
    const input = $("#sousReleaseDialogInput", root);
    const confirm = $("[data-dialog-confirm]", root);
    $("#sousReleaseDialogTitle", root).textContent = title;
    $("#sousReleaseDialogBody", root).textContent = body;
    field.hidden = value === null;
    input.value = value ?? "";
    const summaryNode = $("#sousReleaseDialogSummary", root);
    summaryNode.hidden = !summary;
    summaryNode.textContent = summary;
    confirm.textContent = confirmText;
    confirm.classList.toggle("danger", danger);
    root.hidden = false;
    const previous = document.activeElement;
    requestAnimationFrame(() => (value === null ? confirm : input).focus());
    return new Promise((resolve) => {
      const finish = (result) => {
        root.hidden = true;
        root.removeEventListener("click", click);
        root.removeEventListener("keydown", keydown);
        previous?.focus?.();
        resolve(result);
      };
      const click = (event) => {
        if (event.target === root || event.target.closest("[data-dialog-cancel]")) finish(null);
        if (event.target.closest("[data-dialog-confirm]")) finish(value === null ? true : input.value.trim());
      };
      const keydown = (event) => {
        if (event.key === "Escape") finish(null);
        if (event.key === "Enter" && (value !== null || event.target === confirm)) finish(value === null ? true : input.value.trim());
      };
      root.addEventListener("click", click);
      root.addEventListener("keydown", keydown);
    });
  }

  function syncNavigation() {
    $$("nav.tabs [data-page]").forEach((button) => {
      const page = button.dataset.page;
      const label = PAGE_LABELS[page] || button.textContent.trim();
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      if (button.classList.contains("on")) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function syncSetup() {
    const shell = $("#sousSetup");
    if (!shell) return;
    const grid = $("#v7TemplateGrid", shell);
    if (grid) {
      const blanks = $$('[data-v7-template="blank"]', grid);
      blanks.slice(1).forEach((node) => node.remove());
      if (!blanks.length) grid.insertAdjacentHTML("beforeend", `<button type="button" class="v7-template v31-other-template" data-v7-template="blank"><b>其他行业</b><small>自定义商品目录</small></button>`);
      $$("[data-v7-template]", grid).forEach((button) => {
        button.setAttribute("aria-pressed", String(button.classList.contains("on")));
        button.classList.toggle("v31-other-template", button.dataset.v7Template === "blank");
      });
    }
    const stepOne = $('[data-v7-step="1"].on', shell);
    const stepTwo = $('[data-v7-step="2"].on', shell);
    shell.classList.toggle("v31-industry-step", Boolean(stepOne));
    const label = $("#v7StepLabel", shell);
    if (label) label.textContent = stepTwo ? "2 / 2 · 选择商品" : "1 / 2 · 选择行业";
    $$(".setup-progress span", shell).forEach((segment, index) => segment.classList.toggle("on", stepTwo ? index < 2 : index === 0));
    const heading = $(".v7-manual-product .v7-preview-heading span", shell);
    if (heading) heading.innerHTML = `<b>添加您的商品</b><small>输入商品名称和销售单位，加入自己的目录</small>`;
  }

  function repairActiveWorkspaceMetadata() {
    const profile = readJson(PROFILE_KEY, {});
    const id = activeWorkspace();
    const list = readJson(INDEX_KEY, []);
    if (!list.length) return;
    let changed = false;
    const next = list.map((item) => {
      if (item.id !== id) return item;
      const industry = profile.starterTemplateId || item.industry || "blank";
      const name = profile.businessName || item.name;
      if (industry === item.industry && name === item.name) return item;
      changed = true;
      return { ...item, industry, name, updatedAt: new Date().toISOString() };
    });
    if (changed) writeJson(INDEX_KEY, next);
    const key = `sous:workspace:${id}`;
    const snapshot = readJson(key, null);
    if (snapshot && profile.starterTemplateId && snapshot.profile?.starterTemplateId !== profile.starterTemplateId) {
      snapshot.profile = { ...(snapshot.profile || {}), ...profile };
      snapshot.savedAt = new Date().toISOString();
      writeJson(key, snapshot);
    }
  }

  function syncWorkspaceCard() {
    repairActiveWorkspaceMetadata();
    const card = $("#page-settings .v29-workspace-card");
    if (!card) return;
    const businessButtons = $$('[data-v29-workspace]', card);
    businessButtons.forEach((button) => {
      let row = button.closest(".v31-workspace-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "v31-workspace-row";
        button.before(row);
        row.append(button);
      }
      if (!$('[data-workspace-rename]', row)) row.insertAdjacentHTML("beforeend", `<button type="button" class="v31-workspace-rename" data-workspace-rename="${escapeHtml(button.dataset.v29Workspace)}">重命名</button>`);
      const oldDelete = $('[data-workspace-delete]', row);
      if (businessButtons.length <= 1) oldDelete?.remove();
      else if (!oldDelete) row.insertAdjacentHTML("beforeend", `<button type="button" class="v31-workspace-delete" data-workspace-delete="${escapeHtml(button.dataset.v29Workspace)}">删除</button>`);
    });
    card.classList.toggle("v31-single-workspace", businessButtons.length <= 1);
    const add = $(".v29-workspace-add", card);
    if (add) {
      const limited = businessButtons.length >= 2;
      add.disabled = limited;
      add.setAttribute("aria-disabled", String(limited));
      add.textContent = limited ? "已达到 2 个业务上限" : "＋ 添加另一个业务";
    }
    const help = $(".v29-workspace-help", card);
    if (help) help.textContent = businessButtons.length >= 2 ? "删除一个业务后可以继续添加。" : "每个业务的数据独立保存。";
  }

  function syncSettings() {
    const page = $("#page-settings");
    if (!page) return;
    const subtitle = $(".pg-sub", page);
    if (subtitle) subtitle.textContent = "管理业务空间与本机数据。";
    const prefDelivery = $("#prefDelivery", page);
    prefDelivery?.closest(".card")?.classList.add("v31-removed-default");
    const back = $(".back-chip", page);
    if (back) { back.textContent = "← 返回"; back.setAttribute("aria-label", "返回"); }
    syncWorkspaceCard();
    ensureDataControls();
  }

  function ensureDataControls() {
    const exportButton = $("#page-settings [onclick='exportData()']");
    const card = exportButton?.closest(".card");
    if (!card || $("[data-sous-import]", card)) return;
    exportButton.removeAttribute("onclick");
    exportButton.dataset.sousExport = "true";
    exportButton.textContent = "导出数据";
    exportButton.insertAdjacentHTML("afterend", `<button type="button" class="btn ghost" data-sous-import>导入并恢复</button><input type="file" data-sous-import-file accept="application/json,.json" hidden>`);
  }

  function syncPricingState() {
    const catalog = window.menu ?? (typeof menu !== "undefined" ? menu : {});
    const configured = Object.values(catalog || {}).some((product) => Number(product?.price) > 0);
    ["statRevenue", "statProfit"].forEach((id) => {
      const value = document.getElementById(id);
      const cell = value?.closest(".mini");
      if (!value || !cell) return;
      cell.classList.toggle("price-unconfigured", !configured);
      const currency = value.previousElementSibling;
      if (!configured) {
        value.textContent = "未设置";
        if (currency) currency.hidden = true;
        cell.setAttribute("aria-label", `${cell.querySelector(".l")?.textContent || "金额"} 尚未配置商品价格`);
      } else {
        if (currency) currency.hidden = false;
        cell.removeAttribute("aria-label");
      }
    });
  }
  function syncEmptyAndPrep() {
    const empty = $("#orderList .empty");
    if (empty && !empty.dataset.releaseReady) {
      empty.dataset.releaseReady = "true";
      empty.innerHTML = `<div class="empty-icon" aria-hidden="true">订单</div><b>还没有订单</b><span>录入客户消息，核对后创建第一笔订单。</span><button class="btn primary small" onclick="go('intake')">开始录单</button>`;
    }
    const prepButton = $("#page-prep .prep-ai-assist button, #page-prep [onclick*='generatePrep']");
    const hasOrders = Array.isArray(window.orders ?? (typeof orders !== "undefined" ? orders : [])) && (window.orders ?? orders).length > 0;
    if (prepButton) {
      prepButton.disabled = !hasOrders;
      prepButton.setAttribute("aria-disabled", String(!hasOrders));
      prepButton.title = hasOrders ? "" : "有待处理订单后可生成";
    }
  }

  function syncOrderCopy() {
    $$(".order-list-state .chip").forEach((chip) => { chip.setAttribute("aria-disabled", "true"); chip.tabIndex = -1; });
    $$(".order-list-missing").forEach((node) => {
      const clean = node.textContent.replace(/[：:、，,；;]/g, " ").replace(/\s+/g, " ").trim();
      if (node.textContent !== clean) node.textContent = clean;
    });
  }

  function syncContentDensity() {
    const content = $("#content-text");
    if (!content || $("details.sous-content-advanced", content)) return;
    const styleBox = $("#contentStyleBox", content);
    if (styleBox) styleBox.classList.add("sous-content-style-row");
    const candidates = $$(".field, .form-field, label", content).filter((node) => /内容用途|想写什么|内容主题/.test(node.textContent));
    if (candidates.length) {
      const details = document.createElement("details");
      details.className = "sous-content-advanced";
      details.innerHTML = `<summary>更多内容设置</summary><div class="sous-content-advanced-body"></div>`;
      candidates[0].before(details);
      candidates.forEach((node) => $(".sous-content-advanced-body", details).append(node));
    }
  }

  function syncAll() {
    enforceRegistrationGate();
    syncNavigation();
    syncSetup();
    syncSettings();
    syncEmptyAndPrep();
    syncPricingState();
    syncOrderCopy();
    syncContentDensity();
  }

  async function renameWorkspace(id) {
    const list = readJson(INDEX_KEY, []);
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    const name = await releaseDialog({ title: "重命名业务", body: "使用容易识别的名称，避免连续出现“新业务”。", value: item.name || "" });
    if (!name || name === item.name) return;
    writeJson(INDEX_KEY, list.map((entry) => entry.id === id ? { ...entry, name, updatedAt: new Date().toISOString() } : entry));
    const key = `sous:workspace:${id}`;
    const snapshot = readJson(key, {});
    snapshot.profile = { ...(snapshot.profile || {}), businessName: name };
    snapshot.savedAt = new Date().toISOString();
    writeJson(key, snapshot);
    if (activeWorkspace() === id) writeJson(PROFILE_KEY, { ...readJson(PROFILE_KEY, {}), businessName: name });
    $("#page-settings .v29-workspace-card")?.removeAttribute("data-v29-signature");
    window.toast?.("业务名称已更新");
    window.SOUSRuntime?.requestSync();
  }

  async function deleteWorkspace(id) {
    const list = readJson(INDEX_KEY, []);
    if (list.length <= 1) return;
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    const current = activeWorkspace() === id;
    const snapshot = current ? { orders: readJson("sous:orders", []), menu: readJson("sous:menu", {}) } : readJson(`sous:workspace:${id}`, {});
    const orderCount = Array.isArray(snapshot.orders) ? snapshot.orders.length : 0;
    const productCount = snapshot.menu && typeof snapshot.menu === "object" ? Object.keys(snapshot.menu).length : 0;
    const approved = await releaseDialog({ title: `删除“${item.name}”？`, body: "此操作无法撤销。", summary: `${orderCount} 笔订单 · ${productCount} 个商品`, confirmText: "确认删除", danger: true });
    if (!approved) return;
    const remaining = list.filter((entry) => entry.id !== id);
    localStorage.removeItem(`sous:workspace:${id}`);
    writeJson(INDEX_KEY, remaining);
    if (current) {
      const nextId = remaining[0]?.id;
      const next = readJson(`sous:workspace:${nextId}`, null);
      if (nextId && next) {
        localStorage.setItem(ACTIVE_KEY, nextId);
        writeJson(PROFILE_KEY, next.profile || {});
        DATA_KEYS.forEach((key) => next[key] == null ? localStorage.removeItem(`sous:${key}`) : writeJson(`sous:${key}`, next[key]));
        location.reload();
        return;
      }
    }
    $("#page-settings .v29-workspace-card")?.removeAttribute("data-v29-signature");
    window.SOUSRuntime?.requestSync();
  }

  async function exportAllData() {
    const approved = await releaseDialog({ title: "导出本机数据？", body: "导出文件包含顾客姓名、地址、订单和聊天解析结果。请妥善保管。", confirmText: "继续导出" });
    if (!approved) return;
    const storage = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("sous:")) storage[key] = localStorage.getItem(key);
    }
    const payload = { schema: "sous-backup-v1", exportedAt: new Date().toISOString(), storage };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sous-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    window.toast?.("数据已导出");
  }

  async function importAllData(file) {
    let payload;
    try { payload = JSON.parse(await file.text()); } catch { window.toast?.("无法读取这个备份文件"); return; }
    if (payload?.schema !== "sous-backup-v1" || !payload.storage || typeof payload.storage !== "object") { window.toast?.("这不是有效的 SOUS 备份文件"); return; }
    const approved = await releaseDialog({ title: "恢复备份数据？", body: "当前本机的 SOUS 数据将被备份文件替换。", summary: `备份时间 ${new Date(payload.exportedAt || 0).toLocaleString()}`, confirmText: "确认恢复", danger: true });
    if (!approved) return;
    [...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter((key) => key?.startsWith("sous:")).forEach((key) => localStorage.removeItem(key));
    Object.entries(payload.storage).forEach(([key, value]) => { if (key.startsWith("sous:") && typeof value === "string") localStorage.setItem(key, value); });
    location.reload();
  }

  function fingerprint(data) {
    const value = String(data || ""); let a = 0x811c9dc5; let b = 0x9e3779b9;
    for (let i = 0; i < value.length; i += 1) { const code = value.charCodeAt(i); a = Math.imul(a ^ code, 0x01000193); b = Math.imul(b ^ code ^ i, 0x85ebca6b); }
    return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}-${value.length.toString(36)}`;
  }
  window.sousImageFingerprint = fingerprint;

  async function visualHash(data) {
    if (!data) return "";
    const image = new Image();
    image.src = data;
    try { await image.decode(); } catch { return ""; }
    const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 16, 16);
    const pixels = context.getImageData(0, 0, 16, 16).data;
    const gray = []; for (let i = 0; i < pixels.length; i += 4) gray.push(Math.round(pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114));
    const average = gray.reduce((sum, value) => sum + value, 0) / gray.length;
    const variance = gray.reduce((sum, value) => sum + ((value - average) ** 2), 0) / gray.length;
    if (Math.sqrt(variance) < 4) return "";
    let bits = ""; gray.forEach((value) => { bits += value >= average ? "1" : "0"; });
    let hex = ""; for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  }
  const validVisualHash = (value) => typeof value === "string" && value.length === 64 && new Set(value).size >= 4;
  const hamming = (left, right) => { if (!left || !right || left.length !== right.length) return Infinity; let count = 0; for (let i = 0; i < left.length; i += 1) { let value = parseInt(left[i], 16) ^ parseInt(right[i], 16); while (value) { count += value & 1; value >>= 1; } } return count; };

  async function pendingSources() {
    const images = Array.isArray(window.pendingImages ?? (typeof pendingImages !== "undefined" ? pendingImages : [])) ? (window.pendingImages ?? pendingImages) : [];
    await Promise.all(images.map(async (image) => { image.fingerprint ||= fingerprint(image.data); image.visualHash ||= await visualHash(image.data); }));
    return images.map((image) => ({ id: image.id, fingerprint: image.fingerprint, visualHash: image.visualHash, type: image.type, url: image.url, groupId: image.groupId }));
  }

  function allLocalOrders() {
    const result = [];
    const seen = new Set();
    const active = Array.isArray(window.orders ?? (typeof orders !== "undefined" ? orders : [])) ? (window.orders ?? orders) : [];
    active.forEach((order) => { seen.add(`${activeWorkspace()}:${order.id}`); result.push({ ...order, __workspaceId: activeWorkspace() }); });
    const index = readJson(INDEX_KEY, []);
    index.forEach((workspace) => {
      const snapshot = readJson(`sous:workspace:${workspace.id}`, null);
      (snapshot?.orders || []).forEach((order) => { const key = `${workspace.id}:${order.id}`; if (!seen.has(key)) result.push({ ...order, __workspaceId: workspace.id, __workspaceName: workspace.name }); });
    });
    return result;
  }

  const tokenSet = (value) => new Set(String(value || "").split(/[，,；;\n]+/).map(normalize).filter(Boolean));
  const similarity = (a, b) => { if (!a.size || !b.size) return 0; let common = 0; a.forEach((value) => b.has(value) && common++); return common / new Set([...a, ...b]).size; };
  function compareDuplicate(candidate, order) {
    if (!order || candidate.editingOrderId === order.id) return null;
    const incoming = candidate.sourceImages || [];
    const existing = order.sourceImages || [];
    const sameActiveBatch = Boolean(window.sousConversationGroups?.state?.queue?.length && candidate.conversationGroupId && order.conversationGroupId && candidate.conversationGroupId !== order.conversationGroupId);
    const exact = !sameActiveBatch && incoming.some((a) => existing.some((b) => a.fingerprint && a.fingerprint === b.fingerprint));
    const visual = !sameActiveBatch && incoming.some((a) => existing.some((b) => validVisualHash(a.visualHash) && validVisualHash(b.visualHash) && hamming(a.visualHash, b.visualHash) <= 18));
    let score = exact ? 1 : visual ? .96 : 0; const reasons = [];
    if (exact) reasons.push("相同截图"); else if (visual) reasons.push("截图画面高度相似");
    if (!exact && !visual) {
      const sameCustomer = normalize(candidate.customer) && normalize(candidate.customer) === normalize(order.customer);
      const itemScore = similarity(tokenSet(candidate.items), tokenSet(order.items));
      const sameDate = normalize(candidate.date) && normalize(candidate.date) === normalize(order.date);
      const dateConflict = normalize(candidate.date) && normalize(order.date) && normalize(candidate.date) !== normalize(order.date);
      if (sameCustomer) { score += .28; reasons.push("同一顾客"); }
      if (itemScore >= .5) { score += itemScore * .42; reasons.push(itemScore === 1 ? "商品数量相同" : "商品高度相似"); }
      if (sameDate) { score += .2; reasons.push("交付时间相同"); }
      if (!dateConflict && sameCustomer && itemScore >= .9 && (!candidate.date || !order.date)) score = Math.max(score, .8);
      if (dateConflict) score -= .32;
    }
    if (score < .72) return null;
    return { order, score: Math.min(1, score), reasons };
  }
  function findDuplicate(candidate) { return allLocalOrders().map((order) => compareDuplicate(candidate, order)).filter(Boolean).sort((a, b) => b.score - a.score)[0] || null; }

  async function duplicateDialog(match, candidate, phase) {
    let root = $("#duplicateOrderDialog");
    if (!root) {
      document.body.insertAdjacentHTML("beforeend", `<div class="duplicate-dialog-backdrop" id="duplicateOrderDialog" hidden><section class="duplicate-dialog" role="alertdialog" aria-modal="true" aria-labelledby="duplicateDialogTitle"><div class="duplicate-dialog-heading"><span>重复订单检查</span><h2 id="duplicateDialogTitle">可能已录过这笔订单</h2><p id="duplicateDialogReason"></p></div><div class="duplicate-compare"><article><small>已有订单</small><strong id="duplicateExistingCustomer"></strong><span id="duplicateExistingItems"></span><em id="duplicateExistingDelivery"></em></article><article><small>本次上传</small><strong id="duplicateIncomingCustomer"></strong><span id="duplicateIncomingItems"></span><em id="duplicateIncomingDelivery"></em></article></div><p class="duplicate-dialog-note">已暂停生成新草稿，请先选择处理方式。</p><div class="duplicate-dialog-actions"><button type="button" class="btn ghost" data-duplicate-cancel>取消本次</button><button type="button" class="btn ghost" data-duplicate-view>查看原订单</button><button type="button" class="btn ghost" data-duplicate-merge>作为更新继续</button><button type="button" class="btn primary" data-duplicate-create>仍然继续</button></div></section></div>`);
      root = $("#duplicateOrderDialog");
    }
    $("#duplicateDialogReason", root).textContent = `${Math.round(match.score * 100)}% 相似 · ${match.reasons.join(" · ")}`;
    $("#duplicateExistingCustomer", root).textContent = match.order.customer || "未填写顾客";
    $("#duplicateExistingItems", root).textContent = match.order.items || "未填写商品";
    $("#duplicateExistingDelivery", root).textContent = [match.order.date, match.order.method].filter(Boolean).join(" ") || "交付信息未填写";
    $("#duplicateIncomingCustomer", root).textContent = candidate.customer || (phase === "preparse" ? "相似截图" : "未填写顾客");
    $("#duplicateIncomingItems", root).textContent = candidate.items || (phase === "preparse" ? "尚未进行 AI 识别" : "未填写商品");
    $("#duplicateIncomingDelivery", root).textContent = [candidate.date, candidate.method].filter(Boolean).join(" ") || "交付信息未填写";
    const external = match.order.__workspaceId && match.order.__workspaceId !== activeWorkspace();
    $("[data-duplicate-merge]", root).hidden = external;
    root.hidden = false;
    requestAnimationFrame(() => $("[data-duplicate-view]", root)?.focus());
    return new Promise((resolve) => {
      const click = (event) => { const action = event.target.closest("[data-duplicate-cancel]") ? "cancel" : event.target.closest("[data-duplicate-view]") ? "view" : event.target.closest("[data-duplicate-merge]") ? "merge" : event.target.closest("[data-duplicate-create]") ? "create" : null; if (!action && event.target !== root) return; root.hidden = true; root.removeEventListener("click", click); resolve(action || "cancel"); };
      root.addEventListener("click", click);
    });
  }

  function viewMatchedOrder(order) {
    if (order.__workspaceId && order.__workspaceId !== activeWorkspace()) {
      const snapshot = readJson(`sous:workspace:${order.__workspaceId}`, null);
      if (snapshot) { localStorage.setItem(ACTIVE_KEY, order.__workspaceId); writeJson(PROFILE_KEY, snapshot.profile || {}); DATA_KEYS.forEach((key) => snapshot[key] == null ? localStorage.removeItem(`sous:${key}`) : writeJson(`sous:${key}`, snapshot[key])); location.reload(); return; }
    }
    window.go?.("orders");
  }

  let bypassPreparse = false;
  async function interceptPreparse(event) {
    const button = event.target.closest?.("#parseBtn");
    const images = window.pendingImages ?? (typeof pendingImages !== "undefined" ? pendingImages : []);
    if (!button || !images?.length || (typeof currentParse !== "undefined" && currentParse)) return;
    if (bypassPreparse) { bypassPreparse = false; return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    const sources = await pendingSources();
    const match = findDuplicate({ sourceImages: sources });
    if (!match) {
      bypassPreparse = true;
      button.click();
      return;
    }
    const action = await duplicateDialog(match, { sourceImages: sources }, "preparse");
    if (action === "view") return viewMatchedOrder(match.order);
    if (action === "cancel") return;
    window.__sousDuplicateDecision = { action, orderId: match.order.id, fingerprints: sources.map((source) => source.fingerprint) };
    bypassPreparse = true;
    button.click();
  }

  function candidateFromParse(parse) {
    const data = parse?.data || {};
    return { customer: data.customer || "", items: Array.isArray(data.items) ? data.items.map((item) => `${item.product || item.name || "商品"} ×${item.qty || item.quantity || 1}`).join("；") : data.items || "", date: [data.delivery_date, data.delivery_time].filter(Boolean).join(" "), method: data.method || "", sourceImages: parse?.sourceImages || [], editingOrderId: parse?.editingOrderId || null, conversationGroupId: parse?.conversationGroupId || null };
  }

  function installDuplicateGuards() {
    if (typeof renderParseResult === "function" && !renderParseResult.releaseGuard) {
      const baseRender = renderParseResult;
      renderParseResult = function guardedRender() {
        const parse = typeof currentParse !== "undefined" ? currentParse : null;
        if (!parse) return;
        const pending = window.pendingImages ?? (typeof pendingImages !== "undefined" ? pendingImages : []);
        if (parse.sourceImages?.length) parse.sourceImages.forEach((source) => { const image = pending?.find((item) => item.id === source.id); if (image) { source.fingerprint ||= image.fingerprint; source.visualHash ||= image.visualHash; } });
        const decision = window.__sousDuplicateDecision;
        if (decision && parse.sourceImages?.some((source) => decision.fingerprints.includes(source.fingerprint))) { delete window.__sousDuplicateDecision; if (decision.action === "merge") parse.editingOrderId = decision.orderId; else parse.duplicateApproved = true; return baseRender(); }
        if (parse.duplicateReviewed || parse.editingOrderId || parse.duplicateApproved) return baseRender();
        const match = findDuplicate(candidateFromParse(parse));
        if (!match) { parse.duplicateReviewed = true; return baseRender(); }
        if (parse.duplicateCheckPending) return;
        parse.duplicateCheckPending = true;
        duplicateDialog(match, candidateFromParse(parse), "predisplay").then((action) => { delete parse.duplicateCheckPending; if (action === "view") return viewMatchedOrder(match.order); if (action === "cancel") { currentParse = null; const area = $("#parseArea"); if (area) area.innerHTML = ""; return; } if (action === "merge") parse.editingOrderId = match.order.id; else parse.duplicateApproved = true; parse.duplicateReviewed = true; if (currentParse === parse) baseRender(); });
      };
      renderParseResult.releaseGuard = true;
    }
    const guardSave = (base) => async function guardedSave() {
      const parse = typeof currentParse !== "undefined" ? currentParse : null;
      if (!parse || parse.editingOrderId || parse.duplicateApproved) return base();
      const read = (key) => $(`#f-${key}`)?.value?.trim() || "";
      const candidate = { customer: read("customer"), items: read("items"), date: read("delivery"), method: read("method"), sourceImages: parse.sourceImages || [], conversationGroupId: parse.conversationGroupId || null };
      const match = findDuplicate(candidate);
      if (!match) return base();
      const action = await duplicateDialog(match, candidate, "save");
      if (action === "view") return viewMatchedOrder(match.order);
      if (action === "cancel") return;
      if (action === "merge") parse.editingOrderId = match.order.id; else parse.duplicateApproved = true;
      return base();
    };
    if (typeof confirmOrder === "function" && !confirmOrder.releaseGuard) { const guarded = guardSave(confirmOrder); guarded.releaseGuard = true; confirmOrder = guarded; }
    if (typeof window.saveNeedsConfirmation === "function" && !window.saveNeedsConfirmation.releaseGuard) { const guarded = guardSave(window.saveNeedsConfirmation); guarded.releaseGuard = true; window.saveNeedsConfirmation = guarded; }
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#parseBtn")) { interceptPreparse(event); return; }
    if (target.closest(".order-list-state .chip")) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (target.closest("header.top .account-settings")) { event.preventDefault(); event.stopImmediatePropagation(); const origin = currentPage(); if (origin !== "settings") { window.__settingsReturnPage = origin; sessionStorage.setItem("sous:settings-return-page", origin); window.go?.("settings"); } return; }
    if (target.closest("#page-settings .back-chip")) { event.preventDefault(); event.stopImmediatePropagation(); const destination = window.__settingsReturnPage || sessionStorage.getItem("sous:settings-return-page") || "more"; window.go?.(destination === "settings" ? "more" : destination); return; }
    const rename = target.closest("[data-workspace-rename]"); if (rename) { event.preventDefault(); renameWorkspace(rename.dataset.workspaceRename); return; }
    const remove = target.closest("[data-workspace-delete]"); if (remove) { event.preventDefault(); deleteWorkspace(remove.dataset.workspaceDelete); return; }
    if (target.closest("[data-sous-export]")) { event.preventDefault(); exportAllData(); return; }
    if (target.closest("[data-sous-import]")) { event.preventDefault(); $("[data-sous-import-file]")?.click(); return; }
    window.SOUSRuntime?.requestSync();
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target.matches?.("[data-sous-import-file]") && event.target.files?.[0]) importAllData(event.target.files[0]);
  });

  installDuplicateGuards();
  const registrationObserver = new MutationObserver(enforceRegistrationGate);
  if (document.documentElement) registrationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  window.SOUSRuntime?.registerSync("release-controller", syncAll);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncAll, { once: true }); else syncAll();
  window.sousDuplicateGuard = { fingerprint, visualHash, compare: compareDuplicate, findMatch: findDuplicate };
})();







