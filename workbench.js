/* Runtime enhancements: secure OpenAI proxy, durable storage, GPT Image 2,
   live service status, and keyboard/accessibility fixes. */

const wbStoragePrefix = "sous:";

store.get = async function getLocal(key) {
  try {
    const value = localStorage.getItem(wbStoragePrefix + key);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
};

store.set = async function setLocal(key, value) {
  localStorage.setItem(wbStoragePrefix + key, JSON.stringify(value));
};

async function callWorkbenchApi(path, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.detail || data.error || `API ${response.status}`);
      error.requestId = data.requestId;
      if (response.status === 429 && /quota|billing|额度|配额/i.test(error.message)) {
        markAiUnavailable("AI 额度不足", error.message);
      } else if (response.status >= 500) {
        markAiUnavailable("AI 暂不可用", error.message);
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("AI 请求超时，请重试");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function markAiUnavailable(label, detail) {
  const pill = document.getElementById("aiStatus");
  const text = document.getElementById("aiStatusText");
  if (!pill || !text) return;
  pill.classList.remove("checking");
  pill.classList.add("offline");
  text.textContent = label;
  pill.title = detail || "";
}

callAI = async function callOpenAI(userPrompt, images, task = "text") {
  const result = await callWorkbenchApi(
    "/api/ai",
    {
      prompt: userPrompt,
      images: (images || []).map(({ data, type }) => ({ data, type })),
      task,
    },
    100000,
  );
  return result.text;
};

async function refreshAiStatus() {
  const pill = document.getElementById("aiStatus");
  const text = document.getElementById("aiStatusText");
  if (!pill || !text) return;
  pill.classList.add("checking");
  text.textContent = "检查 AI…";
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const health = await response.json();
    pill.classList.remove("checking", "offline");
    if (!health.ok) throw new Error("OpenAI API 尚未配置");
    text.textContent = "AI 已配置";
    pill.title = `${health.textModel} · ${health.imageModel}`;
  } catch (error) {
    pill.classList.remove("checking");
    pill.classList.add("offline");
    text.textContent = "AI 暂不可用";
    pill.title = error.message;
  }
}

async function hydrateWorkbenchData() {
  const savedOrders = await store.get("orders");
  const savedLog = await store.get("editLog");
  const savedCustomers = await store.get("customers");
  const savedParseCount = await store.get("parseCountWeek");
  const savedPrefs = await store.get("prefs");
  const savedMenu = await store.get("menu");
  if (savedOrders) orders = savedOrders;
  if (savedLog) editLog = savedLog;
  if (savedCustomers) customers = savedCustomers;
  if (savedParseCount) parseCountWeek = savedParseCount;
  if (savedPrefs) prefs = savedPrefs;
  if (savedMenu) menu = savedMenu;
  const prefInput = document.getElementById("prefDelivery");
  if (prefInput) prefInput.value = prefs.deliveryPreset || "";
  renderAll();
}

function enhanceAccessibility() {
  const upload = document.querySelector(".upzone");
  if (upload) {
    upload.setAttribute("role", "button");
    upload.setAttribute("tabindex", "0");
    upload.setAttribute("aria-label", "上传聊天截图，最多五张");
    upload.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      document.getElementById("shotInput")?.click();
    });
  }
  document.getElementById("msgInput")?.setAttribute("aria-label", "订单消息");
  document.getElementById("contentTopic")?.setAttribute("aria-label", "文案主题");
  document.getElementById("contentExtra")?.setAttribute("aria-label", "文案补充要求");
  document.getElementById("imagePrompt")?.setAttribute("aria-label", "图片生成需求");
  document.getElementById("prefDelivery")?.setAttribute("aria-label", "统一配送时间");
  document.querySelectorAll(".entry-card").forEach((entry) => {
    entry.setAttribute("role", "button");
    entry.setAttribute("tabindex", "0");
    entry.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      entry.click();
    });
  });
}

function installImageWorkbench() {
  const imageArea = document.getElementById("weeklyImgArea");
  if (!imageArea || document.getElementById("imageBtn")) return;
  const actions = document.createElement("div");
  actions.className = "poster-actions";
  actions.innerHTML = `
    <button class="btn primary small" id="imageBtn" onclick="genMenuImage('low')">生成海报初稿</button>
    <button class="btn ghost small" id="imageHighBtn" onclick="genMenuImage('high')">生成高清版</button>
  `;
  imageArea.appendChild(actions);
  const poster = document.createElement("div");
  poster.id = "generatedPoster";
  imageArea.appendChild(poster);
  const note = imageArea.querySelector(".hint-line");
  if (note) {
    note.textContent = "由 GPT Image 2 生成；初稿使用低质量以减少等待与成本，方向确认后再生成高清版。";
  }
}

async function genMenuImage(quality = "low") {
  const prompt = document.getElementById("weeklyPrompt")?.innerText.trim();
  if (!prompt) {
    toast("请先生成本周上新");
    return;
  }
  const lowBtn = document.getElementById("imageBtn");
  const highBtn = document.getElementById("imageHighBtn");
  const poster = document.getElementById("generatedPoster");
  lowBtn.disabled = true;
  highBtn.disabled = true;
  poster.innerHTML = `<div class="loading"><div class="pearl"></div>GPT Image 2 正在生成${quality === "high" ? "高清" : ""}海报…</div>`;
  try {
    const result = await callWorkbenchApi(
      "/api/image",
      { prompt, quality, size: "1024x1536" },
      190000,
    );
    poster.innerHTML = `
      <img class="generated-poster" src="${result.image}" alt="AI 生成的本周上新海报">
      <div class="api-note">${escapeHtml(result.model)} · ${quality === "high" ? "高清" : "初稿"}</div>
      <a class="btn ghost small block" style="margin-top:10px;text-decoration:none" href="${result.image}" download="sous-weekly-menu.jpg">下载海报</a>
    `;
  } catch (error) {
    poster.innerHTML = `<div class="empty" style="padding:18px">海报生成失败：${escapeHtml(error.message)}</div>`;
  } finally {
    lowBtn.disabled = false;
    highBtn.disabled = false;
  }
}

const originalParseMessage = parseMessage;
parseMessage = async function parseWithStructuredOutput() {
  const originalCall = callAI;
  callAI = (prompt, images) => originalCall(prompt, images, "order");
  try {
    return await originalParseMessage();
  } finally {
    callAI = originalCall;
  }
};

const originalWeeklyMenu = typeof genWeeklyMenu === "function" ? genWeeklyMenu : null;
if (originalWeeklyMenu) {
  genWeeklyMenu = async function weeklyWithStructuredOutput() {
    const originalCall = callAI;
    callAI = (prompt, images) => originalCall(prompt, images, "weekly");
    try {
      return await originalWeeklyMenu();
    } finally {
      callAI = originalCall;
    }
  };
}

(async function startWorkbench() {
  const existingPill = document.querySelector(".status-pill");
  if (existingPill) {
    existingPill.id = "aiStatus";
    existingPill.classList.add("checking");
    const label = existingPill.querySelector("span:last-child");
    if (label) {
      label.id = "aiStatusText";
      label.textContent = "检查 AI…";
    }
  }
  enhanceAccessibility();
  installImageWorkbench();
  await hydrateWorkbenchData();
  await refreshAiStatus();
})();
