(() => {
  const units = ["g", "kg", "ml", "L", "个", "份", "根", "枝", "束", "颗", "张", "块", "盒", "套", "cm", "m", "卷", "包", "瓶", "罐"];
  let inventory = {};
  let undoTimer = null;

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "/workbench-v2.css";
  document.head.appendChild(style);

  function setUserFacingAiStatus() {
    const label = document.getElementById("aiStatusText");
    if (label?.textContent.trim() === "AI 已配置") label.textContent = "AI 在线";
  }

  const statusLabel = document.getElementById("aiStatusText");
  if (statusLabel) {
    new MutationObserver(setUserFacingAiStatus).observe(statusLabel, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  setUserFacingAiStatus();

  function unitOptions(selected = "") {
    return units
      .map(
        (unit) =>
          `<option value="${unit}" ${unit === selected ? "selected" : ""}>${unit}</option>`,
      )
      .join("");
  }

  function parseIngredientKey(key, amount) {
    const match = String(key).trim().match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    return {
      name: (match?.[1] || key || "").trim(),
      unit: (match?.[2] || "g").trim(),
      amount: Number(amount) || 0,
    };
  }

  function ensureIngredients(item) {
    if (!Array.isArray(item.ingredients)) {
      item.ingredients = Object.entries(item.ings || {}).map(([key, amount]) =>
        parseIngredientKey(key, amount),
      );
    }
    item.ingredients = item.ingredients
      .map((ingredient) => ({
        name: String(ingredient.name || "").trim(),
        unit: String(ingredient.unit || "g").trim(),
        amount: Number(ingredient.amount) || 0,
      }))
      .filter((ingredient) => ingredient.name);
    syncLegacyIngredients(item);
    return item.ingredients;
  }

  function syncLegacyIngredients(item) {
    item.ings = {};
    for (const ingredient of item.ingredients || []) {
      const key = ingredient.unit
        ? `${ingredient.name} (${ingredient.unit})`
        : ingredient.name;
      item.ings[key] = (item.ings[key] || 0) + (Number(ingredient.amount) || 0);
    }
  }

  async function migrateData() {
    let menuChanged = false;
    for (const item of Object.values(menu)) {
      if (!Array.isArray(item.ingredients)) menuChanged = true;
      ensureIngredients(item);
    }
    if (menuChanged) await store.set("menu", menu);

    let orderChanged = false;
    for (const order of orders) {
      if (!order.deliveryDateISO) {
        const normalized = normalizeDelivery(order.date);
        if (normalized.date) {
          order.deliveryDateISO = normalized.date;
          order.deliveryTimeText = normalized.time;
          orderChanged = true;
        }
      }
    }
    if (orderChanged) await store.set("orders", orders);
    inventory = (await store.get("inventory")) || {};
  }

  function normalizeDelivery(value) {
    const text = String(value || "").trim();
    if (!text) return { date: "", time: "" };
    const iso = text.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)?(\d{2}:\d{2})?/);
    if (iso) return { date: iso[1], time: iso[2] || "" };
    const chinese = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日.*?(\d{1,2}:\d{2})?/);
    if (chinese) {
      const year = Number(chinese[1]) || new Date().getFullYear();
      const month = String(chinese[2]).padStart(2, "0");
      const day = String(chinese[3]).padStart(2, "0");
      return { date: `${year}-${month}-${day}`, time: chinese[4] || "" };
    }
    return { date: "", time: "" };
  }

  function toDatetimeLocal(value) {
    const normalized = normalizeDelivery(value);
    return normalized.date
      ? `${normalized.date}T${normalized.time || "12:00"}`
      : "";
  }

  function formatDeliveryDate(order) {
    const iso = order.deliveryDateISO || normalizeDelivery(order.date).date;
    if (!iso) return order.date || "日期待定";
    const date = new Date(`${iso}T12:00:00`);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const base = `${date.getMonth() + 1}月${date.getDate()}日`;
    if (sameDay(date, today)) return `今日 · ${base}`;
    if (sameDay(date, tomorrow)) return `明日 · ${base}`;
    return base;
  }

  function ensureLabel(id, text) {
    const input = document.getElementById(id);
    if (!input || document.querySelector(`label[for="${id}"]`)) return;
    const label = document.createElement("label");
    label.className = "sr-only";
    label.htmlFor = id;
    label.textContent = text;
    input.before(label);
  }

  function addStaticLabels() {
    ensureLabel("msgInput", "订单消息");
    ensureLabel("contentTopic", "内容主题");
    ensureLabel("contentExtra", "内容要点");
    ensureLabel("weeklyNote", "本周上新补充信息");
    ensureLabel("prefDelivery", "统一配送时间");
    ensureLabel("niName", "商品名称");
    ensureLabel("niPrice", "售价");
    ensureLabel("niCost", "单份成本");
  }

  function showUndo(message, undo) {
    let bar = document.getElementById("undoToast");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "undoToast";
      bar.className = "undo-toast";
      bar.innerHTML = `<span id="undoText"></span><button type="button">撤销</button>`;
      document.body.appendChild(bar);
    }
    document.getElementById("undoText").textContent = message;
    bar.style.display = "flex";
    const button = bar.querySelector("button");
    button.onclick = async () => {
      clearTimeout(undoTimer);
      bar.style.display = "none";
      await undo();
    };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      bar.style.display = "none";
    }, 6500);
  }

  function setSaveState(state = "saved") {
    const el = document.getElementById("menuSaveState");
    if (!el) return;
    el.classList.toggle("saving", state === "saving");
    el.textContent = state === "saving" ? "保存中…" : "已自动保存";
  }

  const baseFieldRow = fieldRow;
  fieldRow = function accessibleFieldRow(label, key, value, isLow, reason) {
    const fieldValue = key === "delivery" ? toDatetimeLocal(value) : value;
    let html = baseFieldRow(label, key, fieldValue, isLow, reason);
    html = html.replace(
      `<div class="k">${label}</div>`,
      `<div class="k"><label for="f-${key}">${label}</label></div>`,
    );
    if (key === "delivery") {
      html = html.replace(
        'class="field-input"',
        'class="field-input" type="datetime-local"',
      );
    }
    return html;
  };

  const baseFieldRowPH = fieldRowPH;
  fieldRowPH = function accessibleFieldRowPH(label, key, placeholder, value) {
    const fieldValue = key === "delivery" ? toDatetimeLocal(value) : value;
    let html = baseFieldRowPH(label, key, placeholder, fieldValue);
    html = html.replace(
      `<div class="k">${label}</div>`,
      `<div class="k"><label for="f-${key}">${label}</label></div>`,
    );
    if (key === "delivery") {
      html = html.replace(
        'class="field-input"',
        'class="field-input" type="datetime-local"',
      );
    }
    return html;
  };

  const baseConfirmOrder = confirmOrder;
  confirmOrder = async function confirmStructuredOrder() {
    const deliveryValue = document.getElementById("f-delivery")?.value || "";
    await baseConfirmOrder();
    const order = orders[0];
    if (!order) return;
    const normalized = normalizeDelivery(deliveryValue || order.date);
    order.deliveryDateISO = normalized.date;
    order.deliveryTimeText = normalized.time;
    if (normalized.date) {
      order.date = normalized.date;
      order.time = normalized.time;
    }
    await store.set("orders", orders);
    renderAll();
  };

  renderOrders = function renderStructuredOrders() {
    const list = document.getElementById("orderList");
    if (!orders.length) {
      list.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#C8BFB0;fill:none;stroke-width:1.3;stroke-linecap:round;margin-bottom:8px"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h5"/></svg><br>暂无订单</div>`;
      return;
    }
    const groups = new Map();
    for (const order of orders) {
      const key = order.deliveryDateISO || normalizeDelivery(order.date).date || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(order);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });
    list.innerHTML = sorted
      .map(([date, groupedOrders]) => {
        groupedOrders.sort((a, b) => Number(b.urgent) - Number(a.urgent));
        const label = date ? formatDeliveryDate(groupedOrders[0]) : "日期待定";
        return `<div class="date-group">${escapeHtml(label)}</div>${groupedOrders
          .map((order) => orderCardHtml(order, true))
          .join("")}`;
      })
      .join("");
  };

  delOrder = async function deleteOrderWithUndo(id) {
    const index = orders.findIndex((order) => order.id === id);
    if (index < 0) return;
    const [removed] = orders.splice(index, 1);
    await store.set("orders", orders);
    renderAll();
    showUndo(`已删除 ${removed.customer || "未命名顾客"}的订单`, async () => {
      orders.splice(index, 0, removed);
      await store.set("orders", orders);
      renderAll();
      toast("订单已恢复");
    });
  };

  renderMenu = function renderStructuredMenu() {
    const stats = weekStats();
    document.getElementById("mRevenue").textContent = stats.rev.toFixed(0);
    document.getElementById("mCost").textContent = stats.cost.toFixed(0);
    document.getElementById("mProfit").textContent = stats.profit.toFixed(0);
    const target = document.getElementById("menuList");
    const names = Object.keys(menu);
    if (!names.length) {
      target.innerHTML = `<div class="empty" style="padding:18px">还没有商品。点击右上角「＋ 添加商品」。</div>`;
      return;
    }
    const header = target.closest(".card")?.querySelector(
      ":scope > div:first-child",
    );
    if (header && !document.getElementById("menuSaveState")) {
      const status = document.createElement("span");
      status.id = "menuSaveState";
      status.className = "save-state";
      status.textContent = "已自动保存";
      header.insertBefore(status, header.lastElementChild);
    }
    target.innerHTML = names
      .map((product) => {
        const item = menu[product];
        const ingredients = ensureIngredients(item);
        const margin = (item.price || 0) - (item.cost || 0);
        return `<div class="menu-item">
          <div class="menu-head">
            <span class="mname">${escapeHtml(product)}</span>
            <button class="icon-btn" aria-label="删除${escapeAttr(product)}" title="删除商品" onclick="deleteMenuItem('${escapeAttr(product)}')">×</button>
          </div>
          <div class="price-row">
            <div class="price-cell"><label class="pl" for="price-${cssId(product)}">售价 A$</label><input id="price-${cssId(product)}" type="number" value="${item.price || 0}" onchange="updateMenuField('${escapeAttr(product)}','price',this.value)"></div>
            <div class="price-cell"><label class="pl" for="cost-${cssId(product)}">成本 A$</label><input id="cost-${cssId(product)}" type="number" value="${item.cost || 0}" onchange="updateMenuField('${escapeAttr(product)}','cost',this.value)"></div>
            <div class="price-cell profit"><div class="pl">单份毛利</div><div class="pv">A$ ${margin.toFixed(1)}</div></div>
          </div>
          <div class="structured-ingredients">
            ${ingredients
              .map(
                (ingredient, index) => `<div class="ingredient-row">
                  <label class="sr-only" for="ing-name-${cssId(product)}-${index}">物料名称</label>
                  <input id="ing-name-${cssId(product)}-${index}" value="${escapeAttr(ingredient.name)}" onchange="updateStructuredIngredient('${escapeAttr(product)}',${index},'name',this.value)">
                  <label class="sr-only" for="ing-unit-${cssId(product)}-${index}">单位</label>
                  <select id="ing-unit-${cssId(product)}-${index}" onchange="updateStructuredIngredient('${escapeAttr(product)}',${index},'unit',this.value)">${unitOptions(ingredient.unit)}</select>
                  <label class="sr-only" for="ing-amount-${cssId(product)}-${index}">单份用量</label>
                  <input id="ing-amount-${cssId(product)}-${index}" type="number" step="0.1" value="${ingredient.amount}" onchange="updateStructuredIngredient('${escapeAttr(product)}',${index},'amount',this.value)">
                  <button class="icon-btn" aria-label="删除物料${escapeAttr(ingredient.name)}" onclick="deleteStructuredIngredient('${escapeAttr(product)}',${index})">×</button>
                </div>`,
              )
              .join("")}
          </div>
          <button class="btn ghost tiny" style="margin-top:9px" onclick="toggleAddIng('${escapeAttr(product)}')">＋ 物料</button>
          <div class="structured-add" id="addIng-${cssId(product)}" style="display:none">
            <label class="sr-only" for="ai-name-${cssId(product)}">物料名称</label>
            <input id="ai-name-${cssId(product)}" placeholder="物料名称">
            <label class="sr-only" for="ai-unit-${cssId(product)}">单位</label>
            <select id="ai-unit-${cssId(product)}">${unitOptions("g")}</select>
            <label class="sr-only" for="ai-amt-${cssId(product)}">单份用量</label>
            <input id="ai-amt-${cssId(product)}" type="number" step="0.1" placeholder="用量">
            <button class="btn primary small" onclick="addIng('${escapeAttr(product)}')">添加</button>
          </div>
        </div>`;
      })
      .join("");
  };

  updateMenuField = async function updatePriceWithUndo(product, field, value) {
    const previous = Number(menu[product][field]) || 0;
    const next = Number(value) || 0;
    if (previous === next) return;
    setSaveState("saving");
    menu[product][field] = next;
    await store.set("menu", menu);
    renderAll();
    setSaveState("saved");
    const label = field === "price" ? "售价" : "成本";
    showUndo(`${product}${label}已更新`, async () => {
      menu[product][field] = previous;
      await store.set("menu", menu);
      renderAll();
      toast(`${label}已恢复`);
    });
  };

  window.updateStructuredIngredient = async function updateStructuredIngredient(
    product,
    index,
    field,
    value,
  ) {
    const ingredient = ensureIngredients(menu[product])[index];
    if (!ingredient) return;
    const previous = ingredient[field];
    ingredient[field] = field === "amount" ? Number(value) || 0 : String(value).trim();
    syncLegacyIngredients(menu[product]);
    setSaveState("saving");
    await store.set("menu", menu);
    renderAll();
    setSaveState("saved");
    showUndo(`${product}物料清单已更新`, async () => {
      const currentIngredient = ensureIngredients(menu[product])[index];
      if (!currentIngredient) return;
      currentIngredient[field] = previous;
      syncLegacyIngredients(menu[product]);
      await store.set("menu", menu);
      renderAll();
      toast("物料清单已恢复");
    });
  };

  window.deleteStructuredIngredient = async function deleteStructuredIngredient(
    product,
    index,
  ) {
    const ingredients = ensureIngredients(menu[product]);
    const [removed] = ingredients.splice(index, 1);
    if (!removed) return;
    syncLegacyIngredients(menu[product]);
    await store.set("menu", menu);
    renderAll();
    showUndo(`已删除物料 ${removed.name}`, async () => {
      const currentIngredients = ensureIngredients(menu[product]);
      currentIngredients.splice(Math.min(index, currentIngredients.length), 0, removed);
      syncLegacyIngredients(menu[product]);
      await store.set("menu", menu);
      renderAll();
      toast("物料已恢复");
    });
  };

  const baseDeleteMenuItem = deleteMenuItem;
  deleteMenuItem = async function deleteProductWithUndo(product) {
    const snapshot = JSON.parse(JSON.stringify(menu[product] || null));
    if (!snapshot) return;
    if (!confirm(`删除商品「${product}」？`)) return;
    delete menu[product];
    await store.set("menu", menu);
    renderAll();
    showUndo(`已删除商品 ${product}`, async () => {
      menu[product] = snapshot;
      await store.set("menu", menu);
      renderAll();
      toast("商品已恢复");
    });
  };

  toggleAddIng = function toggleStructuredAdd(product) {
    const el = document.getElementById(`addIng-${cssId(product)}`);
    if (el) el.style.display = el.style.display === "none" ? "grid" : "none";
  };

  addIng = async function addStructuredIngredient(product) {
    const name = document.getElementById(`ai-name-${cssId(product)}`)?.value.trim();
    const unit = document.getElementById(`ai-unit-${cssId(product)}`)?.value || "g";
    const amount = Number(document.getElementById(`ai-amt-${cssId(product)}`)?.value);
    if (!name || !amount) return toast("请填写物料名称和用量");
    ensureIngredients(menu[product]).push({ name, unit, amount });
    syncLegacyIngredients(menu[product]);
    await store.set("menu", menu);
    renderAll();
    toast("物料已添加");
  };

  function ingredientFormRow() {
    const row = document.createElement("div");
    row.className = "ing-row ingredient-row";
    row.innerHTML = `
      <label class="sr-only">物料名称</label><input class="rn" placeholder="物料名称">
      <label class="sr-only">单位</label><select class="ru">${unitOptions("g")}</select>
      <label class="sr-only">单份用量</label><input class="ra" type="number" step="0.1" placeholder="用量">
      <button class="icon-btn" aria-label="移除此行" onclick="this.parentElement.remove()">×</button>
    `;
    return row;
  }

  function upgradeNewItemRows() {
    const wrap = document.getElementById("niIngs");
    if (!wrap) return;
    wrap.querySelectorAll(".ing-row").forEach((row) => {
      if (row.querySelector(".ru")) return;
      const name = row.querySelector(".rn");
      const amount = row.querySelector(".ra");
      const unit = document.createElement("select");
      unit.className = "ru";
      unit.innerHTML = unitOptions("g");
      amount.before(unit);
      row.classList.add("ingredient-row");
      name.placeholder = "物料名称";
      amount.placeholder = "用量";
    });
  }

  addIngRowToForm = function addStructuredIngredientRow() {
    document.getElementById("niIngs")?.appendChild(ingredientFormRow());
  };

  addMenuItem = async function addStructuredMenuItem() {
    const name = document.getElementById("niName").value.trim();
    if (!name) return toast("请填写商品名称");
    if (menu[name]) return toast("该商品已存在");
    const price = Number(document.getElementById("niPrice").value) || 0;
    const cost = Number(document.getElementById("niCost").value) || 0;
    const ingredients = [...document.querySelectorAll("#niIngs .ing-row")]
      .map((row) => ({
        name: row.querySelector(".rn")?.value.trim() || "",
        unit: row.querySelector(".ru")?.value || "g",
        amount: Number(row.querySelector(".ra")?.value) || 0,
      }))
      .filter((ingredient) => ingredient.name && ingredient.amount);
    menu[name] = { price, cost, ingredients, ings: {} };
    syncLegacyIngredients(menu[name]);
    await store.set("menu", menu);
    document.getElementById("niName").value = "";
    document.getElementById("niPrice").value = "";
    document.getElementById("niCost").value = "";
    const wrap = document.getElementById("niIngs");
    wrap.innerHTML = "";
    wrap.appendChild(ingredientFormRow());
    document.getElementById("newItemForm").style.display = "none";
    renderAll();
    toast("商品已添加");
  };

  function calculatePrepDetails() {
    const rows = new Map();
    const unknownProducts = new Set();
    const pendingOrders = orders.filter((order) => order.status === "pending");
    for (const order of pendingOrders) {
      for (const parsed of parseItems(order.items)) {
        if (!parsed.menuKey || !menu[parsed.menuKey]) {
          unknownProducts.add(parsed.name);
          continue;
        }
        const item = menu[parsed.menuKey];
        for (const ingredient of ensureIngredients(item)) {
          const key = `${ingredient.name}|${ingredient.unit}`;
          if (!rows.has(key)) {
            rows.set(key, {
              key,
              name: ingredient.name,
              unit: ingredient.unit,
              needed: 0,
              sources: [],
            });
          }
          const row = rows.get(key);
          row.needed += ingredient.amount * parsed.qty;
          row.sources.push(
            `${order.customer || "未命名顾客"} · ${parsed.menuKey} ×${parsed.qty}`,
          );
        }
      }
    }
    const unitsByName = new Map();
    for (const row of rows.values()) {
      if (!unitsByName.has(row.name)) unitsByName.set(row.name, new Set());
      unitsByName.get(row.name).add(row.unit);
    }
    for (const row of rows.values()) {
      row.unitConflict = unitsByName.get(row.name).size > 1;
      row.stock = Number(inventory[row.key]) || 0;
      row.remaining = Math.max(0, row.needed - row.stock);
    }
    return {
      rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
      unknownProducts: [...unknownProducts],
      orderCount: pendingOrders.length,
    };
  }

  calcIngredients = function structuredIngredientTotals() {
    return Object.fromEntries(
      calculatePrepDetails().rows.map((row) => [
        `${row.name} (${row.unit})`,
        Number(row.remaining.toFixed(2)),
      ]),
    );
  };

  renderPrepTable = function renderExplainablePrep() {
    const target = document.getElementById("prepTable");
    const details = calculatePrepDetails();
    if (!details.rows.length) {
      target.innerHTML = `<div class="empty" style="padding:18px">暂无待处理订单需要备货。</div>`;
      return;
    }
    const warnings = [];
    if (details.unknownProducts.length) {
      warnings.push(`缺少物料清单：${details.unknownProducts.map(escapeHtml).join("、")}`);
    }
    const conflicts = [
      ...new Set(details.rows.filter((row) => row.unitConflict).map((row) => row.name)),
    ];
    if (conflicts.length) warnings.push(`单位冲突：${conflicts.map(escapeHtml).join("、")}`);
    target.innerHTML = `
      <div class="prep-meta">来自 ${details.orderCount} 笔待处理订单；需求量会扣除你填写的已有库存。</div>
      ${warnings.map((warning) => `<div class="prep-warning">${warning}</div>`).join("")}
      ${details.rows
        .map(
          (row) => `<div class="prep-row-v2">
            <div class="prep-main">
              <div><div class="prep-name">${escapeHtml(row.name)}</div><div class="prep-meta">需备 ${row.remaining.toFixed(1)} ${escapeHtml(row.unit)}</div></div>
              <div class="prep-needed">${row.needed.toFixed(1)} ${escapeHtml(row.unit)}</div>
              <label class="inventory-field"><span class="sr-only">${escapeHtml(row.name)}已有库存</span><input type="number" step="0.1" value="${row.stock || ""}" placeholder="库存" onchange="updateInventory('${escapeAttr(row.key)}',this.value)"><span>${escapeHtml(row.unit)}</span></label>
            </div>
            <details class="prep-source"><summary>查看计算来源</summary>${row.sources.map((source) => `<div>${escapeHtml(source)}</div>`).join("")}</details>
          </div>`,
        )
        .join("")}
    `;
  };

  window.updateInventory = async function updateInventory(key, value) {
    inventory[key] = Number(value) || 0;
    await store.set("inventory", inventory);
    renderPrepTable();
    toast("库存已保存");
  };

  function updateStorageCopy() {
    const footnote = document.querySelector("#page-more .footnote");
    if (!footnote) return;
    footnote.className = "footnote storage-truth";
    footnote.textContent = "数据保存在当前浏览器 · 建议定期导出备份";
  }

  (async function initializeV2() {
    await migrateData();
    addStaticLabels();
    upgradeNewItemRows();
    updateStorageCopy();
    renderAll();
    setUserFacingAiStatus();
  })();
})();
