const PRODUCT_SCREENS = [
  { title: "经营首页", purpose: "查看待处理订单与经营入口。", image: "/case-assets/home.png", alt: "SOUS 移动端经营首页" },
  { title: "订单管理", purpose: "按交付日期管理正式订单。", image: "/case-assets/orders.png", alt: "SOUS 正式订单管理页面" },
  { title: "商品管理", purpose: "维护商品、价格与材料。", image: "/case-assets/products.png", alt: "SOUS 商品管理页面" },
  { title: "备货计算", purpose: "汇总正式订单的材料需求。", image: "/case-assets/prep.png", alt: "SOUS 备货计算页面" },
  { title: "AI 内容助手", purpose: "使用商品资料生成内容草稿。", image: "/case-assets/content.png", alt: "SOUS AI 内容助手页面" },
  { title: "设置与数据", purpose: "管理本机数据与导出。", image: "/case-assets/settings.png", alt: "SOUS 设置与数据页面" },
];

const BOUNDARY_SCREENS = [
  { tone: "ai", role: "AI", title: "理解输入", bullets: ["读取聊天与截图", "生成可编辑草稿"], label: "输出", outcome: "订单草稿", image: "/case-assets/ai-processing.png", alt: "SOUS AI 正在理解订单消息" },
  { tone: "rule", role: "程序", title: "校验结果", bullets: ["检查重复与必填", "计算金额与备货"], label: "输出", outcome: "可检查的草稿状态", image: "/case-assets/draft-missing.png", alt: "SOUS 订单草稿中的缺失字段提示" },
  { tone: "human", role: "经营者", title: "确认订单", bullets: ["修正订单字段", "决定是否创建"], label: "输出", outcome: "正式订单", image: "/case-assets/draft-ready.png", alt: "SOUS 字段完整并可确认的订单草稿" },
];

const PRIMARY_STEPS = [
  { owner: "用户", tone: "user", title: "提交聊天内容", body: "上传截图或粘贴文字，原始输入继续保留。", image: "/case-assets/intake.png", alt: "智能录单输入状态" },
  { owner: "AI", tone: "ai", title: "生成订单草稿", body: "提取商品、数量和交付信息，不写入正式订单。", image: "/case-assets/ai-processing.png", alt: "AI 正在理解订单消息" },
  { owner: "程序", tone: "rule", title: "标记缺失字段", body: "必填规则阻止不完整草稿进入正式创建。", image: "/case-assets/draft-missing.png", alt: "订单草稿中的缺失字段提示" },
  { owner: "用户", tone: "human", title: "补全并确认", body: "修正字段后，用户决定是否创建订单。", image: "/case-assets/draft-ready.png", alt: "订单草稿补全后的确认状态" },
];

const RECOVERY_STORIES = [
  { number: "01", title: "重复输入：暂停创建", image: "/case-assets/duplicate-warning.png", alt: "重复订单警告", trigger: "相同截图可能创建重复订单。", response: "本地检测命中后暂停 AI 调用，由用户取消、查看原订单或继续。" },
  { number: "02", title: "解析失败：保留输入", image: "/case-assets/error-recovery.png", alt: "AI 解析失败后的恢复状态", trigger: "超时或不可用输出不能丢失订单信息。", response: "错误状态不创建订单，也不清空文字和截图；用户可以重试或手动录入。" },
];

function phoneMockup({ image, alt, title }, className = "") {
  return `<span class="phone-mockup ${className}" aria-hidden="true"><span class="phone-speaker"></span><span class="phone-screen"><img src="${image}" alt="${alt || title || "SOUS 产品界面"}" loading="eager"></span></span>`;
}

function zoomButton(screen, className = "") {
  return `<button type="button" class="screen-zoom ${className}" data-gallery-src="${screen.image}" data-gallery-title="${screen.title}" data-gallery-alt="${screen.alt}" aria-label="放大查看${screen.title}">${phoneMockup(screen)}</button>`;
}

function renderBoundaryScreens() {
  const target = document.querySelector("#boundaryScreens");
  if (!target) return;
  target.innerHTML = `<div class="boundary-screen-grid">${BOUNDARY_SCREENS.map((screen) => `<article class="boundary-screen-card ${screen.tone}"><div class="boundary-copy"><span>${screen.role}</span><h3>${screen.title}</h3><ul>${screen.bullets.map((item) => `<li>${item}</li>`).join("")}</ul></div><div class="boundary-visual">${zoomButton(screen, "boundary-phone-button")}</div><div class="boundary-outcome"><span>${screen.label}</span><b>${screen.outcome}</b></div></article>`).join("")}</div>`;
  observeReveals(target);
}

function renderGallery() {
  const target = document.querySelector("#productGallery");
  if (!target) return;
  target.innerHTML = PRODUCT_SCREENS.map((screen) => `<article class="product-gallery-device reveal">${zoomButton(screen)}<div class="gallery-device-copy"><h3>${screen.title}</h3><p>${screen.purpose}</p></div></article>`).join("");
  observeReveals(target);
}

function renderPrimaryInteraction() {
  const target = document.querySelector("#primaryInteraction");
  if (!target) return;
  const first = PRIMARY_STEPS[0];
  target.innerHTML = `<article class="primary-interaction reveal"><div class="interaction-device">${phoneMockup({ image: first.image, alt: first.alt, title: first.title }, "interaction-phone")}<p id="interactionCaption" aria-live="polite">${first.owner} · ${first.title}</p></div><div class="interaction-content"><div class="primary-interaction-intro"><span>真实主路径</span><h3>输入 → 草稿 → 校验 → 确认</h3><p>缺失字段时创建动作保持禁用，原始输入仍可回看。</p><div class="interaction-playback"><span class="interaction-playback-status"><i aria-hidden="true"></i><b id="interactionPlaybackStatus">自动演示 · 1 / ${PRIMARY_STEPS.length}</b></span><button type="button" id="interactionToggle" aria-pressed="false">暂停演示</button></div></div><ol class="interaction-step-list">${PRIMARY_STEPS.map((step, index) => `<li><button type="button" class="interaction-step ${index === 0 ? "is-active" : ""}" data-interaction-index="${index}" aria-pressed="${index === 0}"><span class="owner ${step.tone}">${step.owner}</span><small>STEP ${String(index + 1).padStart(2, "0")}</small><b>${step.title}</b><p>${step.body}</p></button></li>`).join("")}</ol></div></article>`;
}

function renderRecoveryStories() {
  const target = document.querySelector("#recoveryStories");
  if (!target) return;
  target.innerHTML = RECOVERY_STORIES.map((story) => `<article class="recovery-card reveal"><div class="recovery-phone">${zoomButton({ image: story.image, alt: story.alt, title: story.title })}</div><div><span>${story.number}</span><h3>${story.title}</h3><dl><div><dt>触发条件</dt><dd>${story.trigger}</dd></div><div><dt>系统处理</dt><dd>${story.response}</dd></div></dl></div></article>`).join("");
}

function bindGallery() {
  const dialog = document.querySelector("#galleryDialog");
  const image = document.querySelector("#galleryDialogImage");
  const title = document.querySelector("#galleryDialogTitle");
  let opener = null;
  document.addEventListener("click", (event) => {
    const zoom = event.target.closest?.("[data-gallery-src]");
    if (!zoom) return;
    opener = zoom;
    image.src = zoom.dataset.gallerySrc;
    image.alt = zoom.dataset.galleryAlt || zoom.dataset.galleryTitle || "放大的 SOUS 产品界面";
    title.textContent = zoom.dataset.galleryTitle || "产品界面";
    dialog?.showModal();
  });
  document.querySelector("#galleryDialogClose")?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog?.addEventListener("close", () => opener?.focus());
}

function bindPrimaryInteraction() {
  const root = document.querySelector("#primaryInteraction");
  if (!root) return;

  const buttons = [...root.querySelectorAll("[data-interaction-index]")];
  const image = root.querySelector(".interaction-phone img");
  const caption = root.querySelector("#interactionCaption");
  const status = root.querySelector("#interactionPlaybackStatus");
  const toggle = root.querySelector("#interactionToggle");
  const duration = 850;
  let activeIndex = 0;
  let timer = null;
  let inView = false;
  let hovered = false;
  let focused = false;
  let userPaused = false;

  PRIMARY_STEPS.forEach((step) => {
    const preload = new Image();
    preload.src = step.image;
  });

  const canRun = () => !reducedMotion && !userPaused && inView && !hovered && !focused && !document.hidden;

  const updateControls = (running) => {
    root.classList.toggle("is-autoplaying", running);
    if (!toggle) return;
    if (reducedMotion) {
      toggle.textContent = "已关闭动态效果";
      toggle.disabled = true;
      toggle.setAttribute("aria-pressed", "true");
      return;
    }
    toggle.textContent = userPaused ? "继续演示" : "暂停演示";
    toggle.setAttribute("aria-pressed", String(userPaused));
  };

  const activateStep = (index) => {
    const step = PRIMARY_STEPS[index];
    if (!step || !image || !caption) return;
    activeIndex = index;
    root.dataset.activeIndex = String(index);
    root.classList.add("is-changing");
    window.setTimeout(() => {
      image.src = step.image;
      image.alt = step.alt;
      requestAnimationFrame(() => root.classList.remove("is-changing"));
    }, 110);
    caption.textContent = `${step.owner} · ${step.title}`;
    if (status) status.textContent = `自动演示 · ${index + 1} / ${PRIMARY_STEPS.length}`;
    buttons.forEach((item, itemIndex) => {
      const active = itemIndex === index;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
  };

  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    root.classList.remove("is-autoplaying");
    const running = canRun();
    if (running) {
      void root.offsetWidth;
      root.classList.add("is-autoplaying");
      timer = window.setTimeout(() => {
        activateStep((activeIndex + 1) % PRIMARY_STEPS.length);
        schedule();
      }, duration);
    }
    updateControls(running);
  };

  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-interaction-index]");
    if (button) {
      activateStep(Number(button.dataset.interactionIndex));
      schedule();
      return;
    }
    if (event.target.closest?.("#interactionToggle")) {
      userPaused = !userPaused;
      schedule();
    }
  });

  root.addEventListener("pointerenter", () => {
    hovered = true;
    schedule();
  });
  root.addEventListener("pointerleave", () => {
    hovered = false;
    schedule();
  });
  root.addEventListener("focusin", () => {
    focused = true;
    schedule();
  });
  root.addEventListener("focusout", () => {
    window.setTimeout(() => {
      focused = root.contains(document.activeElement);
      schedule();
    });
  });
  document.addEventListener("visibilitychange", schedule);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      schedule();
    }, { threshold: 0.35 });
    observer.observe(root);
  } else {
    inView = true;
  }

  activateStep(0);
  schedule();
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let revealObserver = null;
function observeReveals(root = document) {
  const items = root.querySelectorAll(".reveal:not(.visible)");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("visible"));
    return;
  }
  if (!revealObserver) revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  }), { threshold: 0.08, rootMargin: "0px 0px -7% 0px" });
  items.forEach((item) => revealObserver.observe(item));
}

function bindProgress() {
  const progress = document.querySelector("#progressBar");
  const update = () => {
    const height = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${height > 0 ? (scrollY / height) * 100 : 0}%`;
  };
  addEventListener("scroll", update, { passive: true });
  update();
}

renderBoundaryScreens();
renderGallery();
renderPrimaryInteraction();
renderRecoveryStories();
bindGallery();
bindPrimaryInteraction();
bindProgress();
observeReveals();