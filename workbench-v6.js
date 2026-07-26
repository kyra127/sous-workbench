(() => {
  "use strict";

  const V6 = {
    allowNavigation: false,
    editingProducts: new Set(),
    undoTimer: null,
    setupIndustryChosen: false,
  };

  function addStyle() {
    if (document.querySelector('link[href="/workbench-v6.css"]')) return;
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "/workbench-v6.css";
    document.head.appendChild(style);
  }

  function ensureUtilityUi() {
    if (!document.getElementById("v6Dialog")) {
      document.body.insertAdjacentHTML("beforeend", `
        <div class="v6-dialog-backdrop" id="v6Dialog" hidden>
          <section class="v6-dialog" role="alertdialog" aria-modal="true" aria-labelledby="v6DialogTitle" aria-describedby="v6DialogCopy">
            <span class="v6-dialog-kicker">请确认</span>
            <h2 id="v6DialogTitle"></h2>
            <p id="v6DialogCopy"></p>
            <div class="v6-dialog-actions">
              <button type="button" class="btn ghost" data-dialog-cancel>取消</button>
              <button type="button" class="btn primary" data-dialog-confirm>确认</button>
            </div>
          </section>
        </div>`);
    }
    if (!document.getElementById("v6Undo")) {
      document.body.insertAdjacentHTML("beforeend", `
        <div class="v6-undo" id="v6Undo" role="status" aria-live="polite" hidden>
          <span id="v6UndoText"></span>
          <button type="button" id="v6UndoAction">撤销</button>
        </div>`);
    }
  }

  function ask({ title, copy, confirmText = "确认", danger = false }) {
    ensureUtilityUi();
    const root = document.getElementById("v6Dialog");
    const confirm = root.querySelector("[data-dialog-confirm]");
    const cancel = root.querySelector("[data-dialog-cancel]");
    root.querySelector("#v6DialogTitle").textContent = title;
    root.querySelector("#v6DialogCopy").textContent = copy;
    confirm.textContent = confirmText;
    confirm.classList.toggle("danger", danger);
    root.hidden = false;
    requestAnimationFrame(() => confirm.focus());

    return new Promise((resolve) => {
      const finish = (value) => {
        root.hidden = true;
        confirm.classList.remove("danger");
        confirm.removeEventListener("click", yes);
        cancel.removeEventListener("click", no);
        root.removeEventListener("click", outside);
        resolve(value);
      };
      const yes = () => finish(true);
      const no = () => finish(false);
      const outside = (event) => {
        if (event.target === root) finish(false);
      };
      confirm.addEventListener("click", yes);
      cancel.addEventListener("click", no);
      root.addEventListener("click", outside);
    });
  }

  function showUndo(message, action) {
    ensureUtilityUi();
    const root = document.getElementById("v6Undo");
    const button = document.getElementById("v6UndoAction");
    document.getElementById("v6UndoText").textContent = message;
    root.hidden = false;
    clearTimeout(V6.undoTimer);
    const close = () => {
      root.hidden = true;
      button.onclick = null;
    };
    button.onclick = async () => {
      close();
      await action();
    };
    V6.undoTimer = setTimeout(close, 8000);
  }

  function draftValue(key) {
    return document.getElementById(`f-${key}`)?.value?.trim() || "";
  }

  function validateDraft() {
    const requirements = [
      ["customer", "顾客"],
      ["items", "品项"],
      ["delivery", "交付时间"],
      ["method", "取货方式"],
    ];
    const missing = requirements.filter(([key]) => {
      const value = draftValue(key);
      return !value || value === "未确定";
    });
    if (draftValue("method") === "配送" && !draftValue("address")) {
      missing.push(["address", "配送地址"]);
    }
    return { valid: missing.length === 0, missing };
  }

  function markDraftOpen(open) {
    document.body.classList.toggle("draft-open", Boolean(open));
  }

  function refreshDraftActions() {
    const root = document.getElementById("parseArea");
    if (!root || !currentParse) {
      markDraftOpen(false);
      return;
    }
    markDraftOpen(true);
    const result = validateDraft();
    const create = root.querySelector("[data-create-order]");
    const hint = root.querySelector("[data-draft-validation]");
    if (create) {
      create.disabled = !result.valid;
      create.textContent = result.valid ? "确认并创建订单" : `还需补全 ${result.missing.length} 项`;
    }
    if (hint) {
      hint.textContent = result.valid
        ? "信息已完整，可以创建正式订单。"
        : `创建正式订单前还需补充：${result.missing.map(([, label]) => label).join("、")}。`;
      hint.classList.toggle("ok", result.valid);
    }
    try {
      sessionStorage.setItem("sous:active-draft:v1", JSON.stringify({
        customer: draftValue("customer"),
        items: draftValue("items"),
        delivery: draftValue("delivery"),
        method: draftValue("method"),
        address: draftValue("address"),
        customer_note: draftValue("customer_note"),
        rawMsg: currentParse?.rawMsg || "",
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {}
  }

  function enhanceDraftCard() {
    if (!currentParse) return;
    const area = document.getElementById("parseArea");
    const card = area?.querySelector(".card:last-child");
    if (!card) return;

    const heading = card.querySelector(".result-head");
    const resultTitle = heading?.querySelector(".t");
    if (resultTitle) resultTitle.textContent = "确认订单";
    const existingSaveStates = [...card.querySelectorAll(".draft-save-state")];
    existingSaveStates.slice(1).forEach((node) => node.remove());
    if (heading && !card.querySelector(".draft-save-state")) {
      heading.insertAdjacentHTML("afterend", `<p class="draft-save-state">检查并修改信息，内容会自动保存</p>`);
    }

    const oldConfirm = [...card.querySelectorAll("button")].find((button) =>
      /确认入库|创建订单|请补全/.test(button.textContent),
    );
    if (oldConfirm && !card.querySelector("[data-create-order]")) {
      oldConfirm.dataset.createOrder = "";
      oldConfirm.textContent = "创建订单";
      oldConfirm.setAttribute("onclick", "confirmOrder()");
      const oldDiscard = [...card.querySelectorAll("button")].find((button) => button.textContent.trim() === "放弃");
      if (oldDiscard) {
        oldDiscard.textContent = "取消";
        oldDiscard.setAttribute("onclick", "discardParse()");
      }
      const actions = oldConfirm.parentElement;
      actions.classList.add("draft-actions");
      if (!actions.querySelector("[data-save-pending]")) {
        oldConfirm.insertAdjacentHTML("beforebegin", `<button type="button" class="btn ghost" data-save-pending onclick="saveNeedsConfirmation()">保存，稍后确认</button>`);
      }
      actions.insertAdjacentHTML("afterend", `<p class="draft-validation" data-draft-validation aria-live="polite"></p>`);
      const savePending = actions.querySelector("[data-save-pending]");
      const cancelAction = [...actions.querySelectorAll("button")].find((button) => button !== oldConfirm && button !== savePending);
      if (savePending) actions.prepend(savePending);
      if (cancelAction) actions.append(cancelAction);
    }

    const message = document.getElementById("msgInput");
    if (message && !message.previousElementSibling?.classList.contains("field-label")) {
      message.insertAdjacentHTML("beforebegin", `<label class="field-label" for="msgInput">客户消息</label>`);
    }

    area.querySelectorAll("input:not([type='hidden'])").forEach((input) => {
      const row = input.closest(".field-row");
      const label = row?.querySelector(".k")?.textContent?.trim();
      if (label && !input.getAttribute("aria-label")) input.setAttribute("aria-label", label);
    });
    const addressRow = document.getElementById("wrap-address")?.closest(".field-row");
    if (addressRow) {
      addressRow.classList.add("delivery-address-row");
      addressRow.hidden = draftValue("method") === "自取" && !draftValue("address");
    }
    refreshDraftActions();
  }

  function clearDraftUi() {
    currentParse = null;
    document.getElementById("page-intake")?.classList.remove("has-active-review");
    document.getElementById("parseArea").innerHTML = "";
    document.getElementById("msgInput").value = "";
    sessionStorage.removeItem("sous:active-draft:v1");
    markDraftOpen(false);
    updateParseBtn();
  }

  async function persistDraft(status) {
    if (!currentParse) return;
    const existingId = currentParse.editingOrderId;
    const previous = existingId ? orders.find((order) => order.id === existingId) : null;
    const order = {
      ...(previous || {}),
      id: existingId || Date.now(),
      customer: draftValue("customer"),
      items: draftValue("items") || "品项待确认",
      date: draftValue("delivery"),
      time: "",
      method: draftValue("method"),
      address: draftValue("address"),
      note: draftValue("customer_note"),
      ref: draftValue("customer_ref"),
      urgent: draftValue("urgent") === "加急",
      rawMsg: currentParse.rawMsg || previous?.rawMsg || "",
      status,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (previous) orders = orders.map((item) => item.id === existingId ? order : item);
    else orders.unshift(order);
    await store.set("orders", orders);

    if (order.customer) {
      const customer = customers.find((item) => item.name === order.customer);
      if (customer) {
        customer.lastItems = order.items;
        customer.lastDate = order.date;
        if (!previous) customer.count += 1;
        customers = [customer, ...customers.filter((item) => item !== customer)];
      } else {
        customers.unshift({ name: order.customer, lastItems: order.items, lastDate: order.date, count: 1 });
      }
      await store.set("customers", customers);
    }

    if (currentParse.edits) {
      for (const key in currentParse.edits) {
        const item = currentParse.edits[key];
        editLog.unshift({
          time: new Date().toISOString(),
          field: item.label,
          from: item.from,
          to: item.to,
          msg: currentParse.rawMsg || "",
        });
      }
      await store.set("editLog", editLog);
    }

    clearDraftUi();
    renderAll();
    V6.allowNavigation = true;
    go("orders");
    V6.allowNavigation = false;
    toast(status === "needs_confirmation" ? "已保存为待确认订单" : previous ? "订单已更新" : "订单已创建");
  }

  function editOrder(id) {
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    V6.allowNavigation = true;
    go("intake");
    V6.allowNavigation = false;
    manualForm();
    currentParse.editingOrderId = id;
    currentParse.rawMsg = order.rawMsg || "";
    const values = {
      customer: order.customer,
      items: order.items,
      delivery: order.date,
      method: order.method || "未确定",
      address: order.address,
      customer_note: order.note,
      customer_ref: order.ref,
      urgent: order.urgent ? "加急" : "普通",
    };
    Object.entries(values).forEach(([key, value]) => {
      const input = document.getElementById(`f-${key}`);
      if (input) input.value = value || "";
    });
    if (order.method === "配送") setMethod("配送");
    if (order.urgent) setUrgent(true);
    const title = document.querySelector("#parseArea .result-head .t");
    if (title) title.textContent = "补全订单";
    enhanceDraftCard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function statusMeta(status) {
    if (status === "needs_confirmation") return { label: "待确认", className: "needs" };
    if (status === "done") return { label: "已完成", className: "done" };
    return { label: "待处理", className: "pending" };
  }

  function installOrderFlow() {
    const originalRenderParseResult = renderParseResult;
    renderParseResult = function v6RenderParseResult() {
      originalRenderParseResult();
      enhanceDraftCard();
    };

    const originalManualForm = manualForm;
    manualForm = function v6ManualForm() {
      originalManualForm();
      if (!currentParse.original) currentParse.original = { items: [] };
      enhanceDraftCard();
    };

    getOriginalValue = function v6OriginalValue(key) {
      const original = currentParse?.original || { items: [] };
      if (key === "items") return (original.items || []).map((item) => `${item.product} ×${item.qty}`).join("；");
      if (key === "delivery") return [original.delivery_date, original.delivery_time].filter(Boolean).join(" ");
      return original[key] || "";
    };

    const originalFieldEdited = fieldEdited;
    fieldEdited = function v6FieldEdited(key, label) {
      if (!currentParse) return;
      if (!currentParse.original) currentParse.original = { items: [] };
      originalFieldEdited(key, label);
      refreshDraftActions();
    };

    const originalSetMethod = setMethod;
    setMethod = function v6SetMethod(value) {
      if (!currentParse) return;
      if (!currentParse.original) currentParse.original = { items: [] };
      originalSetMethod(value);
      let addressRow = document.getElementById("wrap-address")?.closest(".field-row");
      if (value === "配送" && !addressRow) {
        document.getElementById("wrap-method")?.closest(".field-row")?.insertAdjacentHTML(
          "afterend",
          fieldRow("配送地址", "address", "", true, "配送订单需要完整地址"),
        );
        addressRow = document.getElementById("wrap-address")?.closest(".field-row");
      }
      if (addressRow) {
        addressRow.classList.add("delivery-address-row");
        addressRow.hidden = value === "自取" && !draftValue("address");
      }
      refreshDraftActions();
    };

    confirmOrder = async function v6ConfirmOrder() {
      const result = validateDraft();
      if (!result.valid) {
        toast(`请先补充：${result.missing.map(([, label]) => label).join("、")}`);
        document.getElementById(`f-${result.missing[0]?.[0]}`)?.focus();
        refreshDraftActions();
        return;
      }
      await persistDraft("pending");
    };
    window.saveNeedsConfirmation = () => persistDraft("needs_confirmation");
    window.editOrder = editOrder;

    discardParse = async function v6DiscardParse() {
      if (!currentParse) return;
      const confirmed = await ask({
        title: "放弃这张订单草稿？",
        copy: "已经整理或修改的内容将被清除。",
        confirmText: "放弃草稿",
        danger: true,
      });
      if (!confirmed) return;
      clearDraftUi();
      toast("草稿已放弃");
    };

    const originalGo = go;
    go = function v6Go(page) {
      const intakeActive = document.getElementById("page-intake")?.classList.contains("on");
      if (currentParse && intakeActive && page !== "intake" && !V6.allowNavigation) {
        ask({
          title: "订单还没有保存",
          copy: "离开后草稿仍保留在本次会话中，你可以稍后回来继续。",
          confirmText: "仍然离开",
        }).then((confirmed) => {
          if (!confirmed) return;
          V6.allowNavigation = true;
          originalGo(page);
          V6.allowNavigation = false;
        });
        return;
      }
      originalGo(page);
      setTimeout(enhanceAll, 0);
    };

    function specialRequirementPoints(value) {
      const irrelevant = /演唱会|聚会|派对|外面吃|带去吃|送人|自己吃|到家后|配送后/;
      const operational = /低糖|少糖|无糖|过敏|无坚果|不要|去掉|加量|少量|口味|黑巧|豆乳|芝麻|尺寸|\d+寸|颜色|造型|包装|分装|保冷|冰袋|蜡烛|祝福|写字|餐具|加急/;
      return String(value || "")
        .replace(/[“”]/g, "")
        .split(/[。；;]+/)
        .map((part) => part.trim())
        .filter((part) => part && !irrelevant.test(part) && operational.test(part))
        .slice(0, 3)
        .map((part) => part.replace(/客户确认要|客户原话要求|客户表示要|客户表示|店家表示|商家表示/g, "").trim())
        .filter(Boolean)
        .map((part) => part.length > 24 ? `${part.slice(0, 23)}…` : part);
    }

    function specialRequirementsHtml(value) {
      const points = specialRequirementPoints(value);
      if (!points.length) return "";
      return `<section class="order-special" aria-label="特殊要求"><b>特殊要求</b><ul>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul></section>`;
    }

    function formatDeliveryDisplay(order) {
      const rawDate = String(order.date || "").trim();
      const rawTime = String(order.time || "").trim();
      const iso = rawDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{2}))?/);
      if (iso) {
        const time = rawTime || (iso[4] ? `${iso[4].padStart(2, "0")}:${iso[5]}` : "");
        return `${Number(iso[2])}月${Number(iso[3])}日${time ? ` ${time}` : ""}`;
      }
      return [rawDate, rawTime].filter(Boolean).join(" · ") || "待补充";
    }

    function orderSummaryHtml(order, meta, specialCount) {
      const delivery = formatDeliveryDisplay(order);
      const method = order.method && order.method !== "未确定" ? order.method : "";
      const missing = [];
      if (delivery === "待补充") missing.push("交付时间");
      if (!method) missing.push("取货方式");
      if (method === "配送" && !order.address) missing.push("配送地址");
      const fulfillment = [];
      if (delivery !== "待补充") fulfillment.push(delivery);
      if (method === "配送" && order.address) fulfillment.push(order.address);
      if (method === "自取") fulfillment.push("自取");
      return `<div class="order-list-summary">
        <div class="order-list-main">
          <strong>${escapeHtml(order.customer || "未填写顾客")}</strong>
          <span class="order-list-product">${escapeHtml(order.items || "商品待补充")}</span>
          <div class="order-list-meta">${fulfillment.length ? fulfillment.map((value) => `<span>${escapeHtml(value)}</span>`).join("") : `<span class="order-list-empty-meta">交付信息未填写</span>`}</div>
        </div>
        <div class="order-list-state">
          <span class="chip ${meta.className}">${meta.label}</span>
          ${missing.length ? `<small class="order-list-missing">缺：${missing.join("、")}</small>` : specialCount ? `<small>${specialCount} 项特殊要求</small>` : ""}
        </div>
      </div>`;
    }
    orderCardHtml = function v6OrderCardHtml(order, withActions) {
      const amount = orderAmount(order);
      const meta = statusMeta(order.status);
      const delivery = formatDeliveryDisplay(order);
      const method = order.method && order.method !== "未确定" ? order.method : "待补充";
      const address = method === "配送" ? (order.address || "待补充") : method === "待补充" ? (order.address || "待补充") : "不适用";
      const specialPoints = specialRequirementPoints(order.note);
      const summary = orderSummaryHtml(order, meta, specialPoints.length);
      if (!withActions) {
        return `<article class="order-card order-card-compact status-${meta.className}">${summary}</article>`;
      }
      let primaryAction = "";
      if (order.status === "needs_confirmation") primaryAction = `<button class="btn primary small" onclick="editOrder(${order.id})">补全信息</button>`;
      else if (order.status === "pending") primaryAction = `<button class="btn primary small" onclick="requestCompleteOrder(${order.id})">确认已交付</button>`;
      else primaryAction = `<button class="btn ghost small" onclick="requestCompleteOrder(${order.id})">重新打开</button>`;
      return `<details class="order-card order-card-expandable status-${meta.className}">
        <summary>${summary}<span class="order-expand-label">查看详情</span></summary>
        <div class="order-detail-body">
          <dl class="order-facts">
            <div><dt>交付时间</dt><dd class="${delivery === "待补充" ? "missing" : ""}">${escapeHtml(delivery)}</dd></div>
            <div><dt>取货方式</dt><dd class="${method === "待补充" ? "missing" : ""}">${escapeHtml(method)}</dd></div>
            <div><dt>配送地址</dt><dd class="${address === "待补充" ? "missing" : ""}">${escapeHtml(address)}</dd></div>
            <div><dt>订单金额</dt><dd class="${amount.known ? "amount" : "missing"}">${amount.known ? `A$ ${amount.rev.toFixed(0)}` : "待确认"}</dd></div>
          </dl>
          ${specialPoints.length ? `<section class="order-special" aria-label="特殊要求"><b>特殊要求</b><ul>${specialPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul></section>` : ""}
          ${order.ref ? `<span class="note ref">来源：${escapeHtml(order.ref)}</span>` : ""}
          <div class="order-detail-actions">${primaryAction}${order.status === "needs_confirmation" ? "" : `<button type="button" class="btn ghost small" onclick="editOrder(${order.id})">编辑</button>`}<button type="button" class="btn ghost small danger-link" onclick="requestDeleteOrder(${order.id})">删除</button></div>
        </div>
      </details>`;
    };
    window.requestCompleteOrder = async (id) => {
      const order = orders.find((item) => item.id === id);
      if (!order) return;
      if (order.status === "needs_confirmation") {
        editOrder(id);
        return;
      }
      const reopening = order.status === "done";
      const amount = orderAmount(order);
      const confirmed = await ask({
        title: reopening ? "重新打开这笔订单？" : "确认已经完成交付？",
        copy: reopening
          ? "订单会回到待处理，经营数据也会同步回退。"
          : amount.known
            ? `确认后将计入本周营收 A$${amount.rev.toFixed(0)}。`
            : "确认后订单将标记为已完成；当前商品价格不完整，营收不会被估算。",
        confirmText: reopening ? "重新打开" : "确认已交付",
      });
      if (!confirmed) return;
      order.status = reopening ? "pending" : "done";
      order.completedAt = reopening ? null : new Date().toISOString();
      await store.set("orders", orders);
      renderAll();
      toast(reopening ? "订单已重新打开" : "订单已标记为已交付");
    };

    window.requestDeleteOrder = async (id) => {
      const index = orders.findIndex((item) => item.id === id);
      if (index < 0) return;
      const order = orders[index];
      const confirmed = await ask({
        title: "删除这笔订单？",
        copy: "删除后备货和经营数据会立即更新，你仍可在 8 秒内撤销。",
        confirmText: "删除订单",
        danger: true,
      });
      if (!confirmed) return;
      orders.splice(index, 1);
      await store.set("orders", orders);
      renderAll();
      showUndo("订单已删除", async () => {
        orders.splice(index, 0, order);
        await store.set("orders", orders);
        renderAll();
        toast("订单已恢复");
      });
    };

    toggleStatus = window.requestCompleteOrder;
    delOrder = window.requestDeleteOrder;

    const originalRenderOrders = renderOrders;
    renderOrders = function v6RenderOrders() {
      originalRenderOrders();
      const empty = document.querySelector("#orderList .empty");
      if (empty && !orders.length) {
        empty.innerHTML = `<div class="empty-icon">订单</div><b>还没有订单</b><span>从客户消息开始，或直接手动创建。</span><button class="btn primary small" onclick="go('intake')">创建第一笔订单</button>`;
      }
    };

    const originalRenderHome = renderHome;
    renderHome = function v6RenderHome() {
      originalRenderHome();
      const active = orders.filter((order) => order.status === "pending" || order.status === "needs_confirmation");
      document.getElementById("heroCount").textContent = active.length;
      const needs = orders.filter((order) => order.status === "needs_confirmation");
      if (needs.length) {
        document.getElementById("heroNext").textContent = `${needs.length} 笔订单需要补全信息`;
      }
      const homeOrders = document.getElementById("homeOrders");
      if (!orders.length && homeOrders) {
        homeOrders.innerHTML = `<div class="home-empty">
          <b>还没有订单哦</b>
          <p>上传一张客户聊天截图，开始整理第一笔订单。</p>
          <div><button class="btn primary small" onclick="go('intake')">去录单</button><button class="btn ghost small" onclick="go('menu')">管理商品</button></div>
        </div>`;
      }
    };

    document.addEventListener("input", (event) => {
      if (event.target.closest("#parseArea")) refreshDraftActions();
    });
    window.addEventListener("beforeunload", (event) => {
      if (!currentParse) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function installCatalogSafety() {
    const originalRenderMenu = renderMenu;
    renderMenu = function v6RenderMenu() {
      originalRenderMenu();
      document.querySelectorAll("#menuList .menu-item").forEach((item) => {
        const name = item.querySelector(".mname")?.textContent?.trim();
        if (!name) return;
        item.dataset.product = name;
        const editing = V6.editingProducts.has(name);
        item.classList.toggle("is-editing", editing);
        const head = item.querySelector(".menu-head");
        if (head && !head.querySelector("[data-toggle-product-edit]")) {
          const deleteButton = head.querySelector(".icon-btn");
          deleteButton?.insertAdjacentHTML("beforebegin", `<button type="button" class="btn ghost tiny edit-product-btn" data-toggle-product-edit onclick="toggleProductEdit('${escapeAttr(name)}')">${editing ? "完成" : "编辑"}</button>`);
        }
        const priceRow = item.querySelector(".price-row");
        const ingGrid = item.querySelector(".ing-grid");
        priceRow?.classList.add("menu-edit-body");
        ingGrid?.classList.add("menu-edit-body");
        item.querySelector(".add-inline")?.classList.add("menu-edit-body");
        if (!item.querySelector(".menu-summary")) {
          const data = menu[name];
          const margin = (data?.price || 0) - (data?.cost || 0);
          head?.insertAdjacentHTML("afterend", `<div class="menu-summary">售价 A$${Number(data?.price || 0).toFixed(0)} · 毛利 A$${margin.toFixed(1)} · ${Object.keys(data?.ings || {}).length} 项物料</div>`);
        }
        item.querySelectorAll("input").forEach((input) => {
          if (input.getAttribute("aria-label")) return;
          const label = input.closest(".price-cell")?.querySelector(".pl")?.textContent
            || input.closest(".ing-chip")?.firstChild?.textContent?.trim()
            || "物料用量";
          input.setAttribute("aria-label", label);
        });
      });
    };

    window.toggleProductEdit = (name) => {
      if (V6.editingProducts.has(name)) V6.editingProducts.delete(name);
      else {
        V6.editingProducts.clear();
        V6.editingProducts.add(name);
      }
      renderMenu();
    };

    const originalUpdateMenuField = updateMenuField;
    updateMenuField = async function v6UpdateMenuField(product, field, value) {
      const before = Number(menu[product]?.[field] || 0);
      await originalUpdateMenuField(product, field, value);
      const after = Number(menu[product]?.[field] || 0);
      if (before === after) return;
      editLog.unshift({
        time: new Date().toISOString(),
        field: `${product} ${field === "price" ? "售价" : "成本"}`,
        from: String(before),
        to: String(after),
        msg: "商品资料调整",
      });
      await store.set("editLog", editLog);
      showUndo(`${product}${field === "price" ? "售价" : "成本"}已更新`, async () => {
        menu[product][field] = before;
        await store.set("menu", menu);
        renderAll();
        toast("价格已恢复");
      });
    };

    deleteMenuItem = async function v6DeleteMenuItem(product) {
      const snapshot = menu[product];
      if (!snapshot) return;
      const confirmed = await ask({
        title: `删除“${product}”？`,
        copy: "已有订单不会被删除，但之后的备货计算可能缺少商品资料。",
        confirmText: "删除商品",
        danger: true,
      });
      if (!confirmed) return;
      delete menu[product];
      V6.editingProducts.delete(product);
      await store.set("menu", menu);
      renderAll();
      showUndo("商品已删除", async () => {
        menu[product] = snapshot;
        await store.set("menu", menu);
        renderAll();
        toast("商品已恢复");
      });
    };

    deleteIng = async function v6DeleteIngredient(product, ingredient) {
      const before = menu[product]?.ings?.[ingredient];
      if (before == null) return;
      const confirmed = await ask({
        title: `移除“${ingredient}”？`,
        copy: "这会影响后续备货计算，但可以在 8 秒内撤销。",
        confirmText: "移除物料",
        danger: true,
      });
      if (!confirmed) return;
      delete menu[product].ings[ingredient];
      await store.set("menu", menu);
      renderAll();
      showUndo("物料已移除", async () => {
        menu[product].ings[ingredient] = before;
        await store.set("menu", menu);
        renderAll();
        toast("物料已恢复");
      });
    };
  }

  function promoteCard(element) {
    if (!element || element.tagName === "BUTTON") return element;
    const button = document.createElement("button");
    [...element.attributes].forEach((attribute) => button.setAttribute(attribute.name, attribute.value));
    button.type = "button";
    button.innerHTML = element.innerHTML;
    element.replaceWith(button);
    return button;
  }

  function enhanceSemantics() {
    document.querySelectorAll(".mini[onclick], .entry-card[onclick]").forEach(promoteCard);
    const status = document.querySelector(".status-pill span:last-child");
    if (status) status.textContent = "经营正常";
    const statusPill = document.querySelector(".status-pill");
    statusPill?.setAttribute("aria-label", "工作台运行正常");

    const message = document.getElementById("msgInput");
    if (message && !document.querySelector('label[for="msgInput"]')) {
      message.insertAdjacentHTML("beforebegin", `<label class="field-label" for="msgInput">客户消息</label>`);
    }
    document.getElementById("prefDelivery")?.setAttribute("aria-label", "统一配送时间");
    document.querySelectorAll(".inventory-field input").forEach((input) => {
      input.setAttribute("aria-label", "现有库存");
    });
  }

  function showSetupError(shell, message) {
    let error = shell.querySelector(".setup-inline-error");
    if (!error) {
      error = document.createElement("p");
      error.className = "setup-inline-error";
      shell.querySelector(".setup-screen.on .setup-actions")?.insertAdjacentElement("beforebegin", error);
    }
    error.textContent = message;
    error.focus?.();
  }

  function patchSetup() {
    const shell = document.getElementById("sousSetup");
    if (!shell) return;
    const editing = shell.querySelector("#finishSetup")?.textContent.includes("保存");
    const active = shell.querySelector(".setup-screen.on");
    const step = Number(active?.dataset.step);
    const label = shell.querySelector("#setupStepLabel");
    if (step === 0 && label) label.textContent = "经营档案";
    const copy = shell.querySelector('[data-step="0"] .setup-copy');
    if (copy) copy.textContent = "先建立经营档案。SOUS 会按照你的业务调整用词、执行流程和 AI 建议。";
    const foot = shell.querySelector('[data-step="0"] .setup-foot');
    if (foot) foot.textContent = "当前为产品原型，经营档案保存在本机。正式 SaaS 版本将接入安全账户与云端同步。";

    if (!editing && step === 1 && !V6.setupIndustryChosen) {
      shell.querySelectorAll("[data-industry]").forEach((button) => button.classList.remove("on"));
      const next = active.querySelector("[data-next]");
      if (next) {
        next.disabled = true;
        next.textContent = "请选择经营类型";
      }
    }
    if (step === 3) {
      const sample = shell.querySelector("#loadSampleData");
      if (sample && !editing && sample.dataset.userTouched !== "true") sample.checked = false;
      const toggleText = shell.querySelector(".setup-toggle span");
      if (toggleText) toggleText.textContent += "（可选，之后可一键删除）";
    }
  }

  function installSetupProtection() {
    const shell = document.getElementById("sousSetup");
    if (!shell) return;
    shell.querySelector("#loadSampleData")?.addEventListener("change", (event) => {
      event.target.dataset.userTouched = "true";
    });
    shell.addEventListener("click", (event) => {
      const industry = event.target.closest("[data-industry]");
      if (industry) {
        V6.setupIndustryChosen = true;
        const next = shell.querySelector('[data-step="1"] [data-next]');
        if (next) {
          next.disabled = false;
          next.textContent = "继续";
        }
        shell.querySelector(".setup-inline-error")?.remove();
      }
    }, true);
    shell.addEventListener("click", (event) => {
      const next = event.target.closest("[data-next]");
      if (!next) return;
      const active = shell.querySelector(".setup-screen.on");
      const step = Number(active?.dataset.step);
      const editing = shell.querySelector("#finishSetup")?.textContent.includes("保存");
      if (step === 1 && !editing && !V6.setupIndustryChosen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showSetupError(shell, "请先选择最接近你的经营类型。");
        return;
      }
      if (step === 2) {
        const groups = [...active.querySelectorAll(".choice-group")];
        const channels = groups[0]?.querySelectorAll(".choice-chip.on").length || 0;
        const fulfillment = groups[1]?.querySelectorAll(".choice-chip.on").length || 0;
        if (!channels || !fulfillment) {
          event.preventDefault();
          event.stopImmediatePropagation();
          showSetupError(shell, "接单渠道和交付方式都至少选择一项。");
          return;
        }
      }
      setTimeout(patchSetup, 0);
    }, true);
    new MutationObserver(() => patchSetup()).observe(shell, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });
    patchSetup();
  }

  function enhanceAll() {
    enhanceSemantics();
    patchSetup();
    if (currentParse) enhanceDraftCard();
    renderMenu();
  }

  function init() {
    if (window.__sousV6Ready) return;
    window.__sousV6Ready = true;
    addStyle();
    ensureUtilityUi();
    installOrderFlow();
    installCatalogSafety();
    installSetupProtection();
    const originalSavePrefs = savePrefs;
    savePrefs = async function v6SavePrefs() {
      const field = document.getElementById("prefDelivery");
      field?.closest(".card")?.classList.add("is-saving");
      await originalSavePrefs();
      field?.closest(".card")?.classList.remove("is-saving");
      let state = field?.closest(".card")?.querySelector(".save-state");
      if (!state) {
        state = document.createElement("span");
        state.className = "save-state";
        field?.insertAdjacentElement("afterend", state);
      }
      if (state) state.textContent = `已保存 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    };
    renderAll();
    enhanceAll();
    document.addEventListener("click", () => setTimeout(enhanceAll, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();










