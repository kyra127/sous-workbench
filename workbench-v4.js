(() => {
  "use strict";

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "/workbench-v4.css";
  document.head.appendChild(style);

  const replacements = [
    [/K&K Bakery/g, "Independent Business"],
    [/烘焙工作室/g, "小型经营者"],
    [/烘焙品牌/g, "独立经营品牌"],
    [/菜单管理/g, "商品管理"],
    [/每周菜单/g, "本周上新"],
    [/本周菜单/g, "本周上新"],
    [/菜单海报/g, "商品海报"],
    [/菜单文案/g, "商品文案"],
    [/前往菜单/g, "前往商品"],
    [/「菜单」/g, "「商品」"],
    [/菜单/g, "商品"],
    [/配方原料/g, "物料清单"],
    [/配方/g, "物料清单"],
    [/原料/g, "物料"],
    [/在售品类/g, "在售商品"],
    [/品类/g, "商品"],
    [/甜品/g, "商品"],
  ];

  function generalize(value) {
    let result = value;
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  function updateText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    for (const node of nodes) {
      const next = generalize(node.nodeValue || "");
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }

  function updateAttributes(root) {
    const elements = root.matches?.("input,textarea,button,img")
      ? [root, ...root.querySelectorAll("input,textarea,button,img")]
      : [...root.querySelectorAll("input,textarea,button,img")];
    for (const element of elements) {
      for (const attr of ["placeholder", "aria-label", "alt", "title"]) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        const next = generalize(value);
        if (next !== value) element.setAttribute(attr, next);
      }
    }
  }

  function applyProductDefinition(root = document.body) {
    const sub = document.querySelector(".logo-sub");
    if (sub && sub.textContent !== "AI Business Operations · Independent Business") {
      sub.textContent = "AI Business Operations · Independent Business";
    }

    const morePage = document.getElementById("page-more");
    const moreSub = morePage?.querySelector(".pg-sub");
    if (moreSub) {
      moreSub.textContent = "商品、内容、履约与经营设置。";
      if (!document.getElementById("businessScope")) {
        const scope = document.createElement("div");
        scope.id = "businessScope";
        scope.className = "scope-card";
        scope.innerHTML = `
          <b>为小型经营者而设</b>
          <span>把私聊里的需求，变成订单、商品、物料和交付计划。</span>
          <small>适合烘焙、鲜花、私厨、手作与定制业务</small>
        `;
        moreSub.insertAdjacentElement("afterend", scope);
      }
    }

    updateText(root);
    updateAttributes(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => applyProductDefinition(document.body),
      { once: true },
    );
  } else {
    applyProductDefinition(document.body);
  }

})();
