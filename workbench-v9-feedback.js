(function installFeedbackCompletion() {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  function catalog() { return typeof menu !== "undefined" ? menu : {}; }
  function ingredientsOf(product) {
    return Array.isArray(product?.ingredients) ? product.ingredients : Object.entries(product?.ings || {}).map(([rawName, amount]) => {
      const match = rawName.match(/^(.*?)\s*\((.*?)\)$/);
      return { name: match?.[1] || rawName, unit: match?.[2] || "", amount: Number(amount) || 0 };
    });
  }
  function materialLibrary() {
    const counts = new Map();
    Object.values(catalog()).forEach((product) => ingredientsOf(product).forEach(({ name, unit }) => {
      const clean = String(name || "").trim();
      if (!clean) return;
      const current = counts.get(clean) || { name: clean, unit: unit || "", count: 0 };
      current.count += 1;
      if (!current.unit && unit) current.unit = unit;
      counts.set(clean, current);
    }));
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
  }
  function shortcutButtons(materials) {
    return materials.map((item) => `<button type="button" data-v9-material="${esc(item.name)}" data-v9-unit="${esc(item.unit)}">${esc(item.name)}</button>`).join("");
  }
  function bindShortcutButtons(root, onPick) {
    root.querySelectorAll("[data-v9-material]").forEach((button) => button.addEventListener("click", () => onPick(button.dataset.v9Material || "", button.dataset.v9Unit || "")));
  }

  function addMaterialShortcuts() {
    const materials = materialLibrary();
    if (!materials.length) return;
    document.querySelectorAll("#menuList .structured-add").forEach((panel) => {
      if (panel.querySelector(".v9-common-materials")) return;
      const nameInput = panel.querySelector('input[id^="ai-name-"]');
      const unitSelect = panel.querySelector('select[id^="ai-unit-"]');
      if (!nameInput) return;
      const listId = `${nameInput.id}-options`;
      nameInput.setAttribute("list", listId);
      panel.insertAdjacentHTML("beforeend", `<datalist id="${esc(listId)}">${materials.map((item) => `<option value="${esc(item.name)}"></option>`).join("")}</datalist><div class="v9-common-materials" aria-label="常用物料"><span>常用</span>${shortcutButtons(materials)}</div>`);
      bindShortcutButtons(panel, (name, unit) => {
        nameInput.value = name;
        if (unitSelect && unit) unitSelect.value = unit;
        panel.querySelector('input[id^="ai-amt-"]')?.focus();
      });
    });
  }

  function addCompactMaterialPreviews() {
    document.querySelectorAll("#menuList .menu-item").forEach((item) => {
      if (item.querySelector(".v10-material-preview")) return;
      const name = item.dataset.product || item.querySelector(".mname")?.textContent.trim();
      const ingredients = ingredientsOf(catalog()[name]);
      if (!ingredients.length) return;
      const summary = item.querySelector(".menu-summary");
      summary?.insertAdjacentHTML("afterend", `<div class="v10-material-preview" aria-label="物料摘要">${ingredients.map((entry) => `<span><b>${esc(entry.name)}</b><small>× ${esc(entry.amount ?? 0)}${esc(entry.unit || "")}</small></span>`).join("")}</div>`);
    });
  }

  function enhanceNewItemForm() {
    const form = document.getElementById("newItemForm");
    const rows = document.getElementById("niIngs");
    const materials = materialLibrary();
    if (!form || !rows || !materials.length) return;
    let list = form.querySelector("#v10MaterialOptions");
    if (!list) {
      form.insertAdjacentHTML("beforeend", `<datalist id="v10MaterialOptions">${materials.map((item) => `<option value="${esc(item.name)}"></option>`).join("")}</datalist>`);
    }
    rows.querySelectorAll(".rn").forEach((input) => input.setAttribute("list", "v10MaterialOptions"));
    if (form.querySelector(".v10-new-materials")) return;
    const block = document.createElement("div");
    block.className = "v10-new-materials";
    block.setAttribute("aria-label", "常用物料快捷选择");
    block.innerHTML = `<span>常用物料</span>${shortcutButtons(materials)}`;
    rows.before(block);
    bindShortcutButtons(block, (name, unit) => {
      let row = [...rows.querySelectorAll(".ing-row")].find((candidate) => !candidate.querySelector(".rn")?.value.trim());
      if (!row) { if (typeof addIngRowToForm === "function") addIngRowToForm(); row = [...rows.querySelectorAll(".ing-row")].at(-1); }
      const nameInput = row?.querySelector(".rn");
      const unitSelect = row?.querySelector(".ru");
      if (nameInput) nameInput.value = name;
      if (unitSelect && unit) unitSelect.value = unit;
      row?.querySelector(".ra")?.focus();
    });
  }

  function replaceTemplateSettings() {
    let card = document.getElementById("v9ProductTemplateEntry");
    if (!card) {
      const more = document.getElementById("page-more");
      if (!more) return;
      card = document.createElement("section"); card.id = "v9ProductTemplateEntry"; more.appendChild(card);
    }
    if (card.dataset.v9Ready) return;
    card.dataset.v9Ready = "true"; card.className = "v9-template-entry v10-template-entry";
    card.innerHTML = `<button type="button" data-v9-open-templates><span class="entry-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><path d="M7 3v4M17 3v4"/></svg></span><span class="entry-tx"><b>切换经营行业</b><small>更换行业并重新选择商品</small></span><span class="entry-cv" aria-hidden="true">›</span></button>`;
    card.querySelector("[data-v9-open-templates]")?.addEventListener("click", () => window.sousStarterTemplates?.open ? window.sousStarterTemplates.open() : window.sousOpenBusinessSetup?.());
  }

  function enhanceMoreLayout() {
    const more = document.getElementById("page-more");
    if (!more) return;
    const mainEntries = [...more.querySelectorAll(":scope > .entry-card")];
    const productEntry = mainEntries.find((entry) => entry.textContent.includes("商品管理"));
    const contentEntry = mainEntries.find((entry) => entry.textContent.includes("内容工作流") || entry.textContent.includes("内容发布"));
    const templateEntry = document.getElementById("v9ProductTemplateEntry");
    if (contentEntry) {
      const title = contentEntry.querySelector(".entry-tx b");
      const copy = contentEntry.querySelector(".entry-tx small");
      if (title && title.textContent !== "AI 内容助手") title.textContent = "AI 内容助手";
      if (copy && copy.textContent !== "生成文案和图片") copy.textContent = "生成文案和图片";
    }


    const sectionLabel = [...more.querySelectorAll(":scope > .section-label")].find((item) => item.textContent.includes("设置与数据"));
    const preferenceCard = sectionLabel?.nextElementSibling;
    if (preferenceCard?.classList.contains("card")) {
      if (!preferenceCard.classList.contains("v10-preference-card")) preferenceCard.classList.add("v10-preference-card");
      const title = preferenceCard.querySelector("b");
      const copy = preferenceCard.querySelector("p");
      if (title && title.textContent !== "订单默认设置") title.textContent = "订单默认设置";
      if (copy && copy.textContent !== "设置常用配送时间，录单时可一键填入") copy.textContent = "设置常用配送时间，录单时可一键填入";
    }
    const exportCard = [...more.querySelectorAll(":scope > .card")].find((card) => card.querySelector("b")?.textContent.trim() === "数据导出");
    if (exportCard && !exportCard.classList.contains("v10-export-card")) exportCard.classList.add("v10-export-card");
    if (templateEntry && exportCard && templateEntry.nextElementSibling !== exportCard) exportCard.before(templateEntry);
  }
  function fixTerminology() {
    document.querySelectorAll("button").forEach((button) => {
      if (button.textContent.includes("智能接单")) button.textContent = button.textContent.replace("智能接单", "智能录单");
    });
  }
  function syncPage() {
    const subpage = document.getElementById("page-menu")?.classList.contains("on") || document.getElementById("page-content")?.classList.contains("on");
    document.body.classList.toggle("v9-subpage", Boolean(subpage));
    const delivery = document.getElementById("prefDelivery");
    if (delivery && delivery.placeholder !== "例：周日 14:00–17:00") delivery.placeholder = "例：周日 14:00–17:00";
    document.querySelectorAll(".back-chip").forEach((button) => {
      if (button.textContent.trim() !== "← 返回更多") button.textContent = "← 返回更多";
      if (button.getAttribute("aria-label") !== "返回更多页面") button.setAttribute("aria-label", "返回更多页面");
    });
    addMaterialShortcuts(); addCompactMaterialPreviews(); enhanceNewItemForm(); replaceTemplateSettings(); enhanceMoreLayout(); fixTerminology();
  }

  const style = document.createElement("link"); style.rel = "stylesheet"; style.href = "/workbench-v9-feedback.css"; document.head.appendChild(style);
  const systemStyle = document.createElement("link"); systemStyle.rel = "stylesheet"; systemStyle.href = "/workbench-v10-system.css"; document.head.appendChild(systemStyle);
  setTimeout(() => {
    const baseGo = window.go;
    if (typeof baseGo === "function") window.go = function v9Go(page) { baseGo(page); requestAnimationFrame(syncPage); };
    const baseRenderMenu = window.renderMenu;
    if (typeof baseRenderMenu === "function") window.renderMenu = function v9RenderMenu() { baseRenderMenu(); syncPage(); };
    new MutationObserver(syncPage).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("button[onclick^='toggleAddIng']");
      if (!trigger) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const panel = trigger.closest(".menu-item")?.querySelector(".structured-add");
      if (panel) panel.style.display = panel.style.display === "none" ? "grid" : "none";
    }, true);
    syncPage(); setInterval(syncPage, 500);
  }, 1500);
})();




