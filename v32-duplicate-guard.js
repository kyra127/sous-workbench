(() => {
  "use strict";

  const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[：:、，,；;。.!！?？'"“”‘’（）()【】[\]\s]+/g, "").trim();
  const displayText = (value, fallback = "未填写") => String(value || "").trim() || fallback;

  function fingerprint(data) {
    const value = String(data || "");
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193);
      second ^= code + index;
      second = Math.imul(second, 0x85ebca6b);
    }
    return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}-${value.length.toString(36)}`;
  }

  window.sousImageFingerprint = fingerprint;

  function itemTokens(value) {
    return new Set(String(value || "").split(/[；;，,\n]+/).map(normalize).filter(Boolean));
  }

  function setSimilarity(left, right) {
    if (!left.size || !right.size) return 0;
    let intersection = 0;
    left.forEach((value) => { if (right.has(value)) intersection += 1; });
    return intersection / new Set([...left, ...right]).size;
  }

  function sourceFingerprints(value) {
    return new Set((value?.sourceImages || []).map((image) => image?.fingerprint).filter(Boolean));
  }

  function exactSourceMatch(candidate, order) {
    const incoming = sourceFingerprints(candidate);
    const existing = sourceFingerprints(order);
    if (!incoming.size || !existing.size) return false;
    return [...incoming].some((value) => existing.has(value));
  }

  function candidateFromDraft() {
    const read = (key) => document.getElementById(`f-${key}`)?.value?.trim() || "";
    return {
      customer: read("customer"),
      items: read("items"),
      date: read("delivery"),
      method: read("method"),
      address: read("address"),
      note: read("customer_note"),
      rawMsg: currentParse?.rawMsg || "",
      sourceImages: currentParse?.sourceImages || [],
      editingOrderId: currentParse?.editingOrderId || null,
    };
  }

  function candidateFromParse(parse = currentParse) {
    const data = parse?.data || {};
    const items = Array.isArray(data.items)
      ? data.items.map((item) => `${item?.product || item?.name || "未填写商品"} ×${item?.qty || item?.quantity || 1}`).join("；")
      : data.items || "";
    return {
      customer: data.customer || "",
      items,
      date: [data.delivery_date, data.delivery_time].filter(Boolean).join(" "),
      method: data.method || "",
      address: data.address || "",
      note: data.customer_note || "",
      rawMsg: parse?.rawMsg || "",
      sourceImages: parse?.sourceImages || [],
      editingOrderId: parse?.editingOrderId || null,
    };
  }

  function compare(candidate, order) {
    if (!order || candidate.editingOrderId === order.id) return null;
    const exactSource = exactSourceMatch(candidate, order);
    const reasons = [];
    let score = exactSource ? 1 : 0;

    if (!exactSource) {
      const customerMatch = normalize(candidate.customer) && normalize(candidate.customer) === normalize(order.customer);
      const itemsScore = setSimilarity(itemTokens(candidate.items), itemTokens(order.items));
      const incomingDate = normalize(candidate.date).replaceAll("t", "");
      const existingDate = normalize(order.date).replaceAll("t", "");
      const dateMatch = incomingDate && incomingDate === existingDate;
      const dateConflict = incomingDate && existingDate && incomingDate !== existingDate;
      const methodMatch = normalize(candidate.method) && normalize(candidate.method) === normalize(order.method);
      const addressMatch = normalize(candidate.address) && normalize(candidate.address) === normalize(order.address);
      const rawMatch = normalize(candidate.rawMsg) && normalize(candidate.rawMsg) === normalize(order.rawMsg);

      if (customerMatch) { score += 0.25; reasons.push("同一顾客"); }
      if (itemsScore >= 0.5) { score += itemsScore * 0.35; reasons.push(itemsScore === 1 ? "商品与数量相同" : "商品高度相似"); }
      if (dateMatch) { score += 0.18; reasons.push("交付时间相同"); }
      if (methodMatch) { score += 0.08; reasons.push("取货方式相同"); }
      if (addressMatch) { score += 0.08; reasons.push("地址相同"); }
      if (rawMatch) { score += 0.06; reasons.push("聊天内容相同"); }
      if (dateConflict) score -= 0.3;
      if (!dateConflict && customerMatch && itemsScore >= 0.9 && (!incomingDate || !existingDate)) {
        score = Math.max(score, 0.78);
        reasons.push("交付信息不足，需确认是否重复");
      }
    } else {
      reasons.push("使用了相同截图");
    }

    score = Math.max(0, Math.min(1, score));
    if (score < 0.72) return null;
    return { order, score, level: exactSource || score >= 0.92 ? "exact" : "possible", reasons };
  }

  function findMatch(candidate, list = orders) {
    return (Array.isArray(list) ? list : []).map((order) => compare(candidate, order)).filter(Boolean).sort((left, right) => right.score - left.score)[0] || null;
  }

  function ensureDialog() {
    let root = document.getElementById("duplicateOrderDialog");
    if (root) return root;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="duplicate-dialog-backdrop" id="duplicateOrderDialog" hidden>
        <section class="duplicate-dialog" role="dialog" aria-modal="true" aria-labelledby="duplicateDialogTitle">
          <div class="duplicate-dialog-heading">
            <span>重复订单检查</span>
            <h2 id="duplicateDialogTitle">这笔订单可能已经存在</h2>
            <p id="duplicateDialogReason"></p>
          </div>
          <div class="duplicate-compare">
            <article><small>已有订单</small><strong id="duplicateExistingCustomer"></strong><span id="duplicateExistingItems"></span><em id="duplicateExistingDelivery"></em></article>
            <article><small>本次识别</small><strong id="duplicateIncomingCustomer"></strong><span id="duplicateIncomingItems"></span><em id="duplicateIncomingDelivery"></em></article>
          </div>
          <p class="duplicate-dialog-note">SOUS 不会自动删除或合并订单，请选择处理方式。</p>
          <div class="duplicate-dialog-actions">
            <button type="button" class="btn ghost" data-duplicate-cancel>返回修改</button>
            <button type="button" class="btn ghost" data-duplicate-view>查看原订单</button>
            <button type="button" class="btn ghost" data-duplicate-merge>合并为更新</button>
            <button type="button" class="btn primary" data-duplicate-create>仍然创建</button>
          </div>
        </section>
      </div>`);
    return document.getElementById("duplicateOrderDialog");
  }

  function showDuplicateDialog(match, candidate, options = {}) {
    const root = ensureDialog();
    const order = match.order;
    const isEarlyCheck = options.phase === "preparse" || options.phase === "predisplay";
    root.querySelector("#duplicateDialogTitle").textContent = isEarlyCheck ? "检测到可能重复的订单" : "这笔订单可能已经存在";
    root.querySelector("#duplicateDialogReason").textContent = `${Math.round(match.score * 100)}% 相似 · ${match.reasons.join(" · ")}`;
    root.querySelector("#duplicateExistingCustomer").textContent = displayText(order.customer, "未填写顾客");
    root.querySelector("#duplicateExistingItems").textContent = displayText(order.items, "未填写商品");
    root.querySelector("#duplicateExistingDelivery").textContent = [order.date, order.method].filter(Boolean).join(" ") || "交付信息未填写";
    root.querySelector("#duplicateIncomingCustomer").textContent = displayText(candidate.customer, "未填写顾客");
    root.querySelector("#duplicateIncomingItems").textContent = displayText(candidate.items, "未填写商品");
    root.querySelector("#duplicateIncomingDelivery").textContent = [candidate.date, candidate.method].filter(Boolean).join(" ") || "交付信息未填写";
    root.querySelector(".duplicate-dialog-note").textContent = isEarlyCheck
      ? "SOUS 已暂停生成新草稿，请先选择如何处理。"
      : "SOUS 不会自动删除或合并订单，请选择处理方式。";
    root.querySelector("[data-duplicate-cancel]").textContent = isEarlyCheck ? "取消本次" : "返回修改";
    root.querySelector("[data-duplicate-merge]").textContent = isEarlyCheck ? "作为更新继续" : "合并为更新";
    root.querySelector("[data-duplicate-create]").textContent = isEarlyCheck ? "仍然继续" : "仍然创建";
    root.hidden = false;
    requestAnimationFrame(() => root.querySelector("[data-duplicate-merge]")?.focus());

    return new Promise((resolve) => {
      const finish = (value) => { root.hidden = true; root.removeEventListener("click", onClick); resolve(value); };
      const onClick = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target === root || target.closest("[data-duplicate-cancel]")) finish("cancel");
        else if (target.closest("[data-duplicate-view]")) finish("view");
        else if (target.closest("[data-duplicate-merge]")) finish("merge");
        else if (target.closest("[data-duplicate-create]")) finish("create");
      };
      root.addEventListener("click", onClick);
    });
  }

  async function guardSave(baseSave) {
    if (!currentParse || currentParse.editingOrderId || currentParse.duplicateApproved) return baseSave();
    const candidate = candidateFromDraft();
    const match = findMatch(candidate);
    if (!match) return baseSave();
    const action = await showDuplicateDialog(match, candidate);
    if (action === "cancel") return;
    if (action === "view") { window.go?.("orders"); return; }
    if (action === "merge") currentParse.editingOrderId = match.order.id;
    return baseSave();
  }

  function installSaveGuards() {
    if (confirmOrder?.sousDuplicateGuard === true) return;
    const baseConfirmOrder = confirmOrder;
    const guardedConfirm = function duplicateAwareConfirmOrder() { return guardSave(baseConfirmOrder); };
    guardedConfirm.sousDuplicateGuard = true;
    confirmOrder = guardedConfirm;

    const baseSaveNeedsConfirmation = window.saveNeedsConfirmation;
    const guardedPending = function duplicateAwareSavePending() { return guardSave(baseSaveNeedsConfirmation); };
    guardedPending.sousDuplicateGuard = true;
    window.saveNeedsConfirmation = guardedPending;
  }
  setTimeout(installSaveGuards, 1500);

  let exactBypassOnce = false;
  let pendingExactDecision = null;

  function pendingSourceImages() {
    return (Array.isArray(pendingImages) ? pendingImages : []).map((image) => ({
      id: image.id,
      fingerprint: image.fingerprint || fingerprint(image.data),
      type: image.type,
      url: image.url,
      groupId: image.groupId,
    }));
  }

  function findExactSourceOrder(images = pendingSourceImages()) {
    const candidate = { sourceImages: images };
    return (Array.isArray(orders) ? orders : [])
      .map((order) => compare(candidate, order))
      .find((result) => result?.level === "exact") || null;
  }

  async function interceptExactScreenshot(event) {
    const button = event.target instanceof Element ? event.target.closest("#parseBtn") : null;
    if (!button || currentParse || !pendingImages?.length) return;
    if (exactBypassOnce) {
      exactBypassOnce = false;
      return;
    }
    const match = findExactSourceOrder();
    if (!match) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const candidate = {
      customer: "相同截图",
      items: "检测到与已有订单使用相同截图",
      date: "",
      method: "",
      sourceImages: pendingSourceImages(),
    };
    const action = await showDuplicateDialog(match, candidate, { phase: "preparse" });
    if (action === "cancel") return;
    if (action === "view") {
      window.go?.("orders");
      return;
    }
    pendingExactDecision = {
      action,
      orderId: match.order.id,
      fingerprints: [...sourceFingerprints(candidate)],
    };
    exactBypassOnce = true;
    button.click();
  }

  document.addEventListener("click", interceptExactScreenshot, true);

  function parseUsesPendingDecision(parse) {
    if (!pendingExactDecision) return false;
    const fingerprints = sourceFingerprints(parse);
    return pendingExactDecision.fingerprints.some((value) => fingerprints.has(value));
  }

  function removeParseFromQueue(parse) {
    const batch = window.sousConversationGroups?.state;
    if (!batch?.queue?.length) return false;
    const index = batch.queue.findIndex((entry) => entry.parse === parse);
    if (index < 0) return false;
    batch.queue.splice(index, 1);
    const nextIndex = batch.queue.findIndex((entry) => entry.status === "ready");
    if (nextIndex >= 0) {
      batch.activeIndex = nextIndex;
      currentParse = batch.queue[nextIndex].parse;
      renderParseResult();
    } else {
      batch.queue = [];
      batch.activeIndex = -1;
      currentParse = null;
      document.getElementById("parseArea").innerHTML = "";
      document.getElementById("page-intake")?.classList.remove("has-active-review");
      window.updateParseBtn?.();
    }
    return true;
  }

  function discardIncomingParse(parse) {
    if (removeParseFromQueue(parse)) return;
    if (currentParse === parse) currentParse = null;
    const area = document.getElementById("parseArea");
    if (area) area.innerHTML = "";
    document.getElementById("page-intake")?.classList.remove("has-active-review");
    window.updateParseBtn?.();
  }

  function installRenderGuard() {
    if (renderParseResult?.sousDuplicateGuard === true) return;
    const renderParsedDraft = renderParseResult;
    const guardedRender = function duplicateAwareRenderParseResult() {
      const parse = currentParse;
      if (!parse) return;
      if (!parse.sourceImages?.length && pendingImages?.length) parse.sourceImages = pendingSourceImages();

      if (parseUsesPendingDecision(parse)) {
        const decision = pendingExactDecision;
        pendingExactDecision = null;
        if (decision.action === "merge") parse.editingOrderId = decision.orderId;
        if (decision.action === "create") parse.duplicateApproved = true;
        parse.duplicateReviewed = true;
        return renderParsedDraft();
      }

      if (parse.editingOrderId || parse.duplicateApproved || parse.duplicateReviewed) return renderParsedDraft();
      if (parse.duplicateCheckPending) return;
      const candidate = candidateFromParse(parse);
      const match = findMatch(candidate);
      if (!match) {
        parse.duplicateReviewed = true;
        return renderParsedDraft();
      }

      parse.duplicateCheckPending = true;
      showDuplicateDialog(match, candidate, { phase: "predisplay" }).then((action) => {
        delete parse.duplicateCheckPending;
        if (action === "cancel") {
          discardIncomingParse(parse);
          return;
        }
        if (action === "view") {
          discardIncomingParse(parse);
          window.go?.("orders");
          return;
        }
        if (action === "merge") parse.editingOrderId = match.order.id;
        if (action === "create") parse.duplicateApproved = true;
        parse.duplicateReviewed = true;
        if (currentParse === parse) renderParsedDraft();
      });
    };
    guardedRender.sousDuplicateGuard = true;
    renderParseResult = guardedRender;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installRenderGuard, { once: true });
  else installRenderGuard();

  function blockStatusInteraction(event) {
    const chip = event.target instanceof Element ? event.target.closest(".order-list-state .chip") : null;
    if (!chip) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  document.addEventListener("click", blockStatusInteraction, true);

  function normalizeMissingCopy(root = document) {
    const nodes = [
      ...(root.matches?.(".order-list-missing") ? [root] : []),
      ...(root.querySelectorAll?.(".order-list-missing") || []),
    ];
    nodes.forEach((node) => {
      const next = node.textContent.replace(/[\uFF1A:\u3001\uFF0C,\uFF1B;]+/g, " ").replace(/\s+/g, " ").trim();
      if (node.textContent !== next) node.textContent = next;
    });
  }

  const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) normalizeMissingCopy(node);
  })));
  const start = () => { normalizeMissingCopy(); observer.observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  window.sousDuplicateGuard = {
    fingerprint,
    compare,
    findMatch,
    findExactSourceOrder,
    candidateFromDraft,
    candidateFromParse,
  };
})();
