(() => {
  "use strict";

  const SESSION_KEY = "sous:intake-groups:v1";
  const Batch = {
    groups: [{ id: "group-1", label: "顾客会话 1" }],
    queue: [],
    activeIndex: 0,
    parsing: false,
    failedGroups: [],
    adjusting: false,
    detecting: false,
    detectedSignature: "",
    detectionError: "",
    uncertainPairs: [],
  };

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  function nextGroupId() {
    let index = 1;
    while (Batch.groups.some((group) => group.id === `group-${index}`)) index += 1;
    return `group-${index}`;
  }

  function ensureImageAssignments() {
    if (!Batch.groups.length) Batch.groups.push({ id: "group-1", label: "顾客会话 1" });
    pendingImages.forEach((image, index) => {
      if (!image.id) image.id = `source-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`;
      if (!Batch.groups.some((group) => group.id === image.groupId)) {
        image.groupId = Batch.groups[0].id;
      }
    });
  }

  function activeGroups() {
    ensureImageAssignments();
    return Batch.groups
      .map((group) => ({
        ...group,
        images: pendingImages.filter((image) => image.groupId === group.id),
      }))
      .filter((group) => group.images.length);
  }

  function persistGrouping() {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          groups: Batch.groups,
          assignments: pendingImages.map((image) => ({ id: image.id, groupId: image.groupId })),
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {}
  }

  function groupOptions(selectedId) {
    return Batch.groups
      .map(
        (group) =>
          `<option value="${esc(group.id)}" ${group.id === selectedId ? "selected" : ""}>${esc(group.label)}</option>`,
      )
      .join("");
  }

  function imageSignature() {
    return pendingImages.map((image) => image.id || image.data?.length || "image").join("|");
  }

  function parseGroupingJson(raw) {
    const parsed = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
    if (!Array.isArray(parsed.groups) || !parsed.groups.length) throw new Error("missing groups");
    const seen = new Set();
    const groups = parsed.groups.map((group, index) => {
      const indexes = Array.isArray(group.image_indexes) ? group.image_indexes.map(Number) : [];
      if (!indexes.length) throw new Error("empty group");
      indexes.forEach((imageIndex) => {
        if (!Number.isInteger(imageIndex) || imageIndex < 1 || imageIndex > pendingImages.length || seen.has(imageIndex)) {
          throw new Error("invalid image assignment");
        }
        seen.add(imageIndex);
      });
      const detectedName = typeof group.customer_name === "string" ? group.customer_name.trim().slice(0, 24) : "";
      return { id: `group-${index + 1}`, label: detectedName || `顾客 ${index + 1}`, indexes };
    });
    if (seen.size !== pendingImages.length) throw new Error("incomplete image assignment");
    return {
      groups,
      uncertainPairs: Array.isArray(parsed.uncertain_pairs) ? parsed.uncertain_pairs.slice(0, 1) : [],
    };
  }

  function applyGroupingSuggestion(suggestion) {
    Batch.groups = suggestion.groups.map(({ id, label }) => ({ id, label }));
    suggestion.groups.forEach((group) => {
      group.indexes.forEach((imageIndex) => {
        pendingImages[imageIndex - 1].groupId = group.id;
      });
    });
    Batch.uncertainPairs = suggestion.uncertainPairs;
    Batch.adjusting = false;
  }

  async function detectConversationGroups() {
    const signature = imageSignature();
    if (pendingImages.length < 2 || !signature || Batch.detecting || Batch.detectedSignature === signature) return;
    Batch.detecting = true;
    Batch.detectedSignature = signature;
    Batch.detectionError = "";
    renderGroupingPanel();
    try {
      const prompt = `判断这些聊天截图分别属于几位顾客。只依据聊天对象、头像、账号名、时间连续性和上下文判断，不提取订单内容。
返回严格 JSON：{"groups":[{"image_indexes":[1,2],"customer_name":"截图中显示的昵称或 null"}],"uncertain_pairs":[{"image_index":2,"reference_index":1}]}。
要求：每张截图必须且只能出现一次；同一顾客的连续截图放在同一组；无法确定时先放在最可能的组，并在 uncertain_pairs 中标记。`;
      const images = pendingImages.map(({ data, type }) => ({ data, type }));
      applyGroupingSuggestion(parseGroupingJson(await callAI(prompt, images)));
    } catch (error) {
      Batch.groups = [{ id: "group-1", label: "顾客 1" }];
      pendingImages.forEach((image) => { image.groupId = "group-1"; });
      Batch.uncertainPairs = [];
      Batch.detectionError = "暂时无法自动判断，已按同一位顾客整理。你可以手动调整。";
    } finally {
      Batch.detecting = false;
      renderGroupingPanel();
    }
  }

  function suggestionThumbs(group) {
    return group.images.map((image) => {
      const sourceIndex = pendingImages.indexOf(image);
      return `<img src="${image.url}" alt="截图 ${sourceIndex + 1}">`;
    }).join("");
  }

  function renderAdjustment(groups) {
    return `
      <div class="grouping-head">
        <div><b>调整截图</b><small>把同一位顾客的截图放在一起。</small></div>
        <button type="button" class="btn ghost tiny" data-add-conversation>＋ 添加顾客</button>
      </div>
      <div class="conversation-groups grouping-adjustment">
        ${groups.map((group) => `
          <section class="conversation-group" data-conversation="${esc(group.id)}">
            <div class="conversation-title">
              <b>${esc(group.label)}</b><span>${group.images.length} 张</span>
              ${groups.length > 1 ? `<button type="button" class="text-button" data-remove-conversation="${esc(group.id)}">删除</button>` : ""}
            </div>
            <div class="group-image-list">
              ${group.images.map((image) => {
                const sourceIndex = pendingImages.indexOf(image);
                return `<div class="group-image"><img src="${image.url}" alt="截图 ${sourceIndex + 1}"><label><span>截图 ${sourceIndex + 1}</span><select data-image-group="${esc(image.id)}" aria-label="截图 ${sourceIndex + 1} 属于哪位顾客">${groupOptions(group.id)}</select></label></div>`;
              }).join("")}
            </div>
          </section>`).join("")}
      </div>
      <button type="button" class="btn ghost grouping-done" data-finish-adjustment>完成调整</button>`;
  }

  function renderGroupingPanel() {
    const panel = document.getElementById("conversationGrouping");
    if (!panel) return;
    if (pendingImages.length < 2) {
      panel.hidden = true;
      panel.innerHTML = "";
      Batch.detectedSignature = "";
      updateGroupedParseButton();
      return;
    }
    panel.hidden = false;
    ensureImageAssignments();
    const groups = Batch.groups.map((group) => ({ ...group, images: pendingImages.filter((image) => image.groupId === group.id) })).filter((group) => group.images.length);
    if (Batch.detecting) {
      panel.innerHTML = `<div class="grouping-loading"><span class="pearl" aria-hidden="true"></span><div><b>正在识别顾客</b><small>判断哪些截图属于同一位顾客…</small></div></div>`;
      updateGroupedParseButton();
      return;
    }
    if (Batch.adjusting) {
      panel.innerHTML = renderAdjustment(groups);
      updateGroupedParseButton();
      persistGrouping();
      return;
    }
    const count = groups.length;
    const uncertain = Batch.uncertainPairs[0];
    panel.innerHTML = `
      <div class="grouping-result-head">
        <div><b>${count === 1 ? `已合并 ${pendingImages.length} 张截图` : `检测到 ${count} 位顾客`}</b><small>${count === 1 ? "将生成 1 个订单草稿" : `将分别生成 ${count} 个订单草稿`}</small></div>
        <span class="ai-suggestion">AI 建议</span>
      </div>
      ${Batch.detectionError ? `<p class="grouping-notice" role="status">${esc(Batch.detectionError)}</p>` : ""}
      <div class="grouping-suggestions">
        ${groups.map((group) => `<section class="group-suggestion-card"><div><b>${esc(group.label)}</b><span>${group.images.length} 张</span></div><div class="suggestion-thumbs">${suggestionThumbs(group)}</div></section>`).join("")}
      </div>
      ${uncertain ? `<div class="grouping-question"><b>有一张截图需要确认</b><span>截图 ${Number(uncertain.image_index) || "?"} 与截图 ${Number(uncertain.reference_index) || "?"} 是同一位顾客吗？</span><div><button type="button" class="btn ghost tiny" data-answer-pair="same">是</button><button type="button" class="btn ghost tiny" data-answer-pair="different">不是</button></div></div>` : ""}
      <button type="button" class="grouping-adjust-link" data-adjust-grouping>调整截图归属</button>`;
    updateGroupedParseButton();
    persistGrouping();
  }
  const baseRenderThumbs = renderThumbs;
  renderThumbs = function renderGroupedThumbs() {
    ensureImageAssignments();
    baseRenderThumbs();
    const thumbs = document.getElementById("imgThumbs");
    if (thumbs) thumbs.hidden = pendingImages.length > 1;
    renderGroupingPanel();
    detectConversationGroups();
    const intakePage = document.getElementById("page-intake");
    intakePage?.classList.toggle("has-image-intake", pendingImages.length > 0);
    const messageLabel = document.querySelector('label[for="msgInput"]');
    if (messageLabel) messageLabel.textContent = pendingImages.length ? "补充说明（可选）" : "客户消息";
  };

  function updateGroupedParseButton() {
    const button = document.getElementById("parseBtn");
    if (!button || currentParse || Batch.parsing) return;
    const count = activeGroups().length;
    button.disabled = Batch.detecting;
    button.textContent =
      pendingImages.length > 1
        ? (Batch.detecting ? "正在识别顾客…" : `生成 ${count} 个订单草稿`)
        : "解析消息";
  }

  function addConversation() {
    const id = nextGroupId();
    Batch.groups.push({ id, label: `顾客 ${Batch.groups.length + 1}` });
    renderGroupingPanel();
  }

  function removeConversation(id) {
    if (Batch.groups.length <= 1) return;
    const target = Batch.groups.find((group) => group.id !== id);
    pendingImages.forEach((image) => {
      if (image.groupId === id) image.groupId = target.id;
    });
    Batch.groups = Batch.groups.filter((group) => group.id !== id);
    renderGroupingPanel();
  }

  function captureCurrentDraft() {
    if (!currentParse?.data) return;
    const value = (key) => document.getElementById(`f-${key}`)?.value?.trim() || "";
    const items = value("items")
      .split(/[；;\n]+/)
      .map((entry) => {
        const match = entry.trim().match(/^(.*?)\s*[×xX*]\s*(\d+(?:\.\d+)?)$/);
        return match
          ? { product: match[1].trim(), qty: Number(match[2]) || 1 }
          : entry.trim()
            ? { product: entry.trim(), qty: 1 }
            : null;
      })
      .filter(Boolean);
    currentParse.data = {
      ...currentParse.data,
      customer: value("customer"),
      items,
      delivery_date: value("delivery"),
      delivery_time: "",
      method: value("method"),
      address: value("address"),
      customer_note: value("customer_note"),
      customer_ref: value("customer_ref"),
      urgent: value("urgent") === "加急",
    };
  }

  function queueEntryLabel(entry, index) {
    return entry.parse?.data?.customer || entry.group.label || `订单草稿 ${index + 1}`;
  }

  function decorateDraftQueue() {
    if (Batch.queue.length <= 1 || !currentParse) return;
    const card = document.querySelector("#parseArea .card");
    if (!card) return;
    card.querySelector(".draft-queue")?.remove();
    const readyCount = Batch.queue.filter((entry) => entry.status === "ready").length;
    const failedCount = Batch.queue.filter((entry) => entry.status === "error").length;
    const queue = document.createElement("section");
    queue.className = "draft-queue";
    queue.setAttribute("aria-label", "订单草稿队列");
    queue.innerHTML = `
      <div class="draft-queue-head">
        <span><b>${readyCount} 位顾客</b>${failedCount ? ` · ${failedCount} 位待重试` : ""}</span>
        <small>选择一位检查</small>
      </div>
      <div class="draft-queue-tabs">
        ${Batch.queue
          .map((entry, index) => `
            <button type="button"
              class="${index === Batch.activeIndex ? "on" : ""} ${entry.status === "error" ? "error" : ""}"
              data-draft-index="${index}"
              ${entry.status === "error" ? "disabled" : ""}>
              <span>${index + 1}</span>
              <b>${esc(queueEntryLabel(entry, index))}</b>
              <small>${entry.group.images.length} 张截图${entry.status === "error" ? " · 解析失败" : ""}</small>
            </button>`)
          .join("")}
      </div>`;
    card.insertBefore(queue, card.firstChild);
  }

  const baseRenderParseResult = renderParseResult;
  renderParseResult = function renderQueuedParseResult() {
    baseRenderParseResult();
    decorateDraftQueue();
  };

  function activateDraft(index) {
    const entry = Batch.queue[index];
    if (!entry || entry.status !== "ready") return;
    captureCurrentDraft();
    if (Batch.queue[Batch.activeIndex]?.status === "ready") {
      Batch.queue[Batch.activeIndex].parse = currentParse;
    }
    Batch.activeIndex = index;
    currentParse = entry.parse;
    renderParseResult();
    document.getElementById("parseArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function parseConversationGroup(group, note) {
    const imagePayload = group.images.map(({ data, type }) => ({ data, type }));
    const prompt = buildParsePrompt(
      `\n输入是同一位顾客的 ${group.images.length} 张连续聊天截图，分组名称为“${group.label}”。只提取这一组顾客的订单需求，不要引用其他顾客。${note ? `商家补充说明：「${note}」` : ""}`,
      null,
    );
    const raw = await callAI(prompt, imagePayload, "order");
    const parsed = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
    if (parsed.parse_ok === false) throw new Error("没有识别到订单");
    return {
      data: parsed,
      original: JSON.parse(JSON.stringify(parsed)),
      rawMsg: `[${group.label} · ${group.images.length} 张截图]${note ? ` ${note}` : ""}`,
      sourceImages: group.images.map((image) => ({
        id: image.id,
        fingerprint: image.fingerprint || window.sousImageFingerprint?.(image.data) || "",
        type: image.type,
        url: image.url,
        groupId: group.id,
      })),
      conversationGroupId: group.id,
      merged: group.images.length > 1,
    };
  }

  async function parseGroupedScreenshots() {
    if (Batch.parsing) return;
    if (Batch.queue.length || currentParse) {
      toast("这批截图已经生成，请先处理当前订单");
      return;
    }
    const groups = activeGroups();
    if (!groups.length) {
      toast("请先上传聊天截图");
      return;
    }
    const button = document.getElementById("parseBtn");
    const area = document.getElementById("parseArea");
    const note = document.getElementById("msgInput")?.value.trim() || "";
    Batch.parsing = true;
    button.disabled = true;
    button.textContent = `正在解析 0 / ${groups.length}`;
    area.innerHTML = `<div class="card"><div class="loading-center"><div class="pearl"></div><b>正在按顾客分组整理订单…</b><span>每组会生成一张独立草稿</span></div></div>`;

    const results = [];
    for (let index = 0; index < groups.length; index += 1) {
      button.textContent = `正在解析 ${index + 1} / ${groups.length}`;
      try {
        const parse = await parseConversationGroup(groups[index], note);
        results.push({ status: "ready", group: groups[index], parse });
      } catch (error) {
        results.push({ status: "error", group: groups[index], error: error.message });
      }
    }

    Batch.queue = results;
    Batch.failedGroups = results.filter((entry) => entry.status === "error");
    Batch.activeIndex = results.findIndex((entry) => entry.status === "ready");
    Batch.parsing = false;
    button.disabled = false;

    if (Batch.activeIndex < 0) {
      area.innerHTML = `<div class="card"><div class="fail-center"><div class="ft">这些会话暂时没有解析成功</div><div class="fs">截图和分组仍然保留，可以调整后重试。</div><button type="button" class="btn primary" data-retry-groups>重试全部</button></div></div>`;
      updateGroupedParseButton();
      return;
    }

    currentParse = results[Batch.activeIndex].parse;
    parseCountWeek.push(Date.now());
    await store.set("parseCountWeek", parseCountWeek);
    renderParseResult();
    document.getElementById("page-intake")?.classList.add("has-active-review");
    document.getElementById("msgInput").value = "";
    if (!Batch.failedGroups.length) {
      pendingImages = [];
      baseRenderThumbs();
      document.getElementById("conversationGrouping").hidden = true;
    }
    button.textContent = "追加到当前订单";
    toast(`已生成 ${results.filter((entry) => entry.status === "ready").length} 个订单草稿`);
  }

  const baseParseMessage = parseMessage;
  parseMessage = async function parseWithConversationGroups() {
    if (!currentParse && pendingImages.length > 1) {
      await parseGroupedScreenshots();
      return;
    }
    return baseParseMessage();
  };

  function removeActiveQueueEntry() {
    if (!Batch.queue.length) return null;
    const [removed] = Batch.queue.splice(Batch.activeIndex, 1);
    Batch.activeIndex = Math.min(Batch.activeIndex, Math.max(0, Batch.queue.length - 1));
    return removed;
  }

  function showNextQueuedDraft() {
    const nextIndex = Batch.queue.findIndex((entry) => entry.status === "ready");
    if (nextIndex < 0) {
      Batch.queue = [];
      currentParse = null;
      document.getElementById("page-intake")?.classList.remove("has-active-review");
      document.getElementById("parseArea").innerHTML = "";
      updateParseBtn();
      return;
    }
    Batch.activeIndex = nextIndex;
    currentParse = Batch.queue[nextIndex].parse;
    go("intake");
    renderParseResult();
    toast(`继续检查剩余 ${Batch.queue.filter((entry) => entry.status === "ready").length} 个草稿`);
  }

  const baseConfirmOrder = confirmOrder;
  confirmOrder = async function confirmQueuedOrder() {
    if (!Batch.queue.length) return baseConfirmOrder();
    captureCurrentDraft();
    Batch.queue[Batch.activeIndex].parse = currentParse;
    const active = currentParse;
    const sources = active.sourceImages || [];
    await baseConfirmOrder();
    if (currentParse === active) return;
    const savedOrder = active.editingOrderId ? orders.find((order) => order.id === active.editingOrderId) : orders[0];
    if (savedOrder && sources.length) {
      savedOrder.sourceImages = sources;
      savedOrder.conversationGroupId = active.conversationGroupId;
      await store.set("orders", orders);
    }
    removeActiveQueueEntry();
    showNextQueuedDraft();
  };

  const baseSavePending = window.saveNeedsConfirmation;
  window.saveNeedsConfirmation = async () => {
    if (!Batch.queue.length) return baseSavePending();
    captureCurrentDraft();
    Batch.queue[Batch.activeIndex].parse = currentParse;
    const active = currentParse;
    const sources = active.sourceImages || [];
    await baseSavePending();
    if (currentParse === active) return;
    const savedOrder = active.editingOrderId ? orders.find((order) => order.id === active.editingOrderId) : orders[0];
    if (savedOrder && sources.length) {
      savedOrder.sourceImages = sources;
      savedOrder.conversationGroupId = active.conversationGroupId;
      await store.set("orders", orders);
    }
    removeActiveQueueEntry();
    showNextQueuedDraft();
  };

  const baseDiscardParse = discardParse;
  discardParse = async function discardQueuedDraft() {
    if (!Batch.queue.length) return baseDiscardParse();
    const active = currentParse;
    await baseDiscardParse();
    if (currentParse === active) return;
    removeActiveQueueEntry();
    showNextQueuedDraft();
  };

  function installFinalQueueHooks() {
    if (confirmOrder.sousQueueHook === true) return;

    const finalConfirmOrder = confirmOrder;
    confirmOrder = async function finalQueuedOrderConfirmation() {
      if (!Batch.queue.length) return finalConfirmOrder();
      captureCurrentDraft();
      Batch.queue[Batch.activeIndex].parse = currentParse;
      const active = currentParse;
      const sources = active.sourceImages || [];
      await finalConfirmOrder();
      if (currentParse === active) return;
      const savedOrder = active.editingOrderId ? orders.find((order) => order.id === active.editingOrderId) : orders[0];
      if (savedOrder && sources.length) {
        savedOrder.sourceImages = sources;
        savedOrder.conversationGroupId = active.conversationGroupId;
        await store.set("orders", orders);
      }
      removeActiveQueueEntry();
      showNextQueuedDraft();
    };
    confirmOrder.sousQueueHook = true;

    const finalSavePending = window.saveNeedsConfirmation;
    window.saveNeedsConfirmation = async () => {
      if (!Batch.queue.length) return finalSavePending();
      captureCurrentDraft();
      Batch.queue[Batch.activeIndex].parse = currentParse;
      const active = currentParse;
      const sources = active.sourceImages || [];
      await finalSavePending();
      if (currentParse === active) return;
      const savedOrder = active.editingOrderId ? orders.find((order) => order.id === active.editingOrderId) : orders[0];
      if (savedOrder && sources.length) {
        savedOrder.sourceImages = sources;
        savedOrder.conversationGroupId = active.conversationGroupId;
        await store.set("orders", orders);
      }
      removeActiveQueueEntry();
      showNextQueuedDraft();
    };
    window.saveNeedsConfirmation.sousQueueHook = true;

    const finalDiscard = discardParse;
    discardParse = async function finalQueuedDiscard() {
      if (!Batch.queue.length) return finalDiscard();
      const active = currentParse;
      await finalDiscard();
      if (currentParse === active) return;
      removeActiveQueueEntry();
      showNextQueuedDraft();
    };
    discardParse.sousQueueHook = true;
  }

  setTimeout(installFinalQueueHooks, 1200);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-adjust-grouping]")) {
      Batch.adjusting = true;
      renderGroupingPanel();
      return;
    }
    if (event.target.closest("[data-finish-adjustment]")) {
      Batch.adjusting = false;
      renderGroupingPanel();
      return;
    }
    const pairAnswer = event.target.closest("[data-answer-pair]");
    if (pairAnswer && Batch.uncertainPairs[0]) {
      const pair = Batch.uncertainPairs[0];
      const image = pendingImages[Number(pair.image_index) - 1];
      const reference = pendingImages[Number(pair.reference_index) - 1];
      if (image && reference) {
        if (pairAnswer.dataset.answerPair === "same") image.groupId = reference.groupId;
        else {
          const id = nextGroupId();
          Batch.groups.push({ id, label: `顾客 ${Batch.groups.length + 1}` });
          image.groupId = id;
        }
      }
      Batch.uncertainPairs = [];
      renderGroupingPanel();
      return;
    }    if (event.target.closest("[data-add-conversation]")) {
      addConversation();
      return;
    }
    const remove = event.target.closest("[data-remove-conversation]");
    if (remove) {
      removeConversation(remove.dataset.removeConversation);
      return;
    }
    const draft = event.target.closest("[data-draft-index]");
    if (draft) {
      activateDraft(Number(draft.dataset.draftIndex));
      return;
    }
    if (event.target.closest("[data-retry-groups]")) {
      parseGroupedScreenshots();
    }
  });

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-image-group]");
    if (select) {
      const image = pendingImages.find((candidate) => candidate.id === select.dataset.imageGroup);
      if (image) image.groupId = select.value;
      renderGroupingPanel();
      return;
    }
    const label = event.target.closest("[data-group-label]");
    if (label) {
      const group = Batch.groups.find((candidate) => candidate.id === label.dataset.groupLabel);
      if (group && label.value.trim()) group.label = label.value.trim();
      renderGroupingPanel();
    }
  });

  function installGroupingUi() {
    const thumbs = document.getElementById("imgThumbs");
    if (!thumbs || document.getElementById("conversationGrouping")) return;
    thumbs.insertAdjacentHTML(
      "afterend",
      `<section class="conversation-grouping" id="conversationGrouping" aria-live="polite" hidden></section>`,
    );
    const uploadCopy = document.querySelector(".upzone small");
    if (uploadCopy) uploadCopy.textContent = "最多 5 张 · 可按顾客分组后分别生成订单草稿";
    document.querySelector(".samples")?.setAttribute("hidden", "");
    renderThumbs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installGroupingUi, { once: true });
  } else {
    installGroupingUi();
  }

  window.sousConversationGroups = {
    state: Batch,
    render: renderGroupingPanel,
    parse: parseGroupedScreenshots,
  };
})();
