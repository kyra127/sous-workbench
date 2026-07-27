(() => {
  "use strict";

  const pageLabels = {
    home: "首页",
    intake: "录单",
    orders: "订单",
    prep: "备货",
    more: "经营工具",
    menu: "商品管理",
    content: "AI 内容助手",
  };

  function currentPage() {
    return document.querySelector(".page.on")?.id?.replace(/^page-/, "") || "home";
  }

  function settingsButton() {
    document.querySelectorAll("header.top").forEach((header) => {
      const old = header.querySelector(".account-settings");
      if (!old || old.dataset.v28Ready) return;
      const button = old.cloneNode(false);
      button.dataset.v28Ready = "true";
      button.type = "button";
      button.className = "account-settings";
      button.setAttribute("aria-label", "打开设置");
      button.setAttribute("title", "设置");
      button.innerHTML = '<img src="/v27-settings.svg" alt="" aria-hidden="true">';
      button.addEventListener("click", () => {
        const origin = currentPage();
        if (origin === "settings") return;
        window.__settingsReturnPage = origin;
        window.go?.("settings");
        setTimeout(updateSettingsBack);
      });
      old.replaceWith(button);
    });
  }

  function updateSettingsBack() {
    let button = document.querySelector("#page-settings .back-chip");
    if (!button) return;
    if (!button.dataset.v28Ready) {
      const clone = button.cloneNode(false);
      clone.dataset.v28Ready = "true";
      clone.type = "button";
      clone.addEventListener("click", () => {
        const origin = window.__settingsReturnPage;
        window.go?.(origin && origin !== "settings" ? origin : "more");
      });
      button.replaceWith(clone);
      button = clone;
    }
    const origin = window.__settingsReturnPage;
    const safeOrigin = origin && origin !== "settings" ? origin : "more";
    const label = pageLabels[safeOrigin] || "上一页";
    const text = `← 返回${label}`;
    if (button.textContent !== text) button.textContent = text;
    button.setAttribute("aria-label", `返回${label}`);
  }

  function renameToolsHub() {
    const page = document.getElementById("page-more");
    const title = page?.querySelector(":scope > h1.pg");
    const subtitle = page?.querySelector(":scope > .pg-sub");
    if (title) title.textContent = "经营工具";
    if (subtitle) subtitle.textContent = "管理商品，使用 AI 生成内容。";

    document.querySelectorAll("nav button, .bottom-nav button, .nav-item").forEach((item) => {
      const target = item.getAttribute("onclick") || item.dataset.page || "";
      if (!String(target).includes("more")) return;
      const labels = [...item.querySelectorAll("span, b")];
      const label = labels.at(-1);
      if (label && label.textContent !== "工具") label.textContent = "工具";
      else if (item.childNodes.length) {
        const textNode = [...item.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = "工具";
      }
      item.setAttribute("aria-label", "经营工具");
    });
  }

  const channelNotes = {
    小红书: "更重视体验细节、场景和自然标签。",
    抖音: "更口语、更短，开头先说重点。",
    微信: "适合熟客通知，信息清楚、语气自然。",
    Instagram: "更精简，适合图片说明和少量标签。",
    其他: "使用简洁、通用的表达。",
  };

  function channelHint(select) {
    let hint = document.getElementById("v28ChannelHint");
    if (!hint) {
      hint = document.createElement("small");
      hint.id = "v28ChannelHint";
      hint.className = "v28-channel-hint";
      select.closest(".content-field")?.append(hint);
    }
    const selectedLabel = select.selectedOptions?.[0]?.textContent?.trim();
    const text =
      channelNotes[selectedLabel] ||
      channelNotes[select.value] ||
      channelNotes.其他;
    if (hint.textContent !== text) hint.textContent = text;
  }

  function improveContentTools() {
    const page = document.getElementById("page-content");
    if (!page) return;

    const textCard = document.getElementById("content-text");
    const style = document.getElementById("contentStyleBox");
    if (textCard && style && style.parentElement !== textCard) {
      textCard.querySelector(".content-card-heading")?.after(style);
      style.classList.add("content-style-inline");
    }

    const channel = document.getElementById("contentChannel");
    if (channel && ![...channel.options].some((option) => option.textContent.trim() === "微信")) {
      const option = document.createElement("option");
      option.textContent = "微信";
      option.value = "微信";
      const other = [...channel.options].find((item) => item.textContent.trim() === "其他");
      channel.insertBefore(option, other || null);
    }
    if (channel && !channel.dataset.v28Ready) {
      channel.dataset.v28Ready = "true";
      channel.addEventListener("change", () => {
        requestAnimationFrame(() => {
          const current = document.getElementById("contentChannel");
          if (current) channelHint(current);
        });
      });
    }
    if (channel) channelHint(channel);

    const ratio = document.querySelector("#content-image .ratio-hint");
    ratio?.remove();
    const prompt = document.getElementById("imagePrompt");
    if (prompt) {
      prompt.placeholder = "描述主体、风格和用途；也可写方形、横版或竖版，未说明时默认竖版。";
    }
    const imageHeading = document.querySelector("#content-image .content-card-heading small");
    if (imageHeading && imageHeading.textContent !== "可生成菜单、宣传图或商品展示图，先由您检查再使用。") {
      imageHeading.textContent = "可生成菜单、宣传图或商品展示图，先由您检查再使用。";
    }
  }

  function demoteIndustryEntry() {
    const entry = document.getElementById("v27BusinessEntry");
    if (!entry) return;
    entry.classList.add("v28-business-entry");
    const button = entry.querySelector("button");
    const title = button?.querySelector("b");
    const copy = button?.querySelector("small");
    if (title) title.textContent = "切换经营行业";
    if (copy) copy.textContent = "在设置中管理独立业务";
  }

  function sync() {
    settingsButton();
    updateSettingsBack();
    renameToolsHub();
    improveContentTools();
    demoteIndustryEntry();
  }

  window.SOUSRuntime?.registerSync("v28-consistency", sync) || sync();
})();
