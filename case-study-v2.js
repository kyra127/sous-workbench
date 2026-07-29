(() => {
  "use strict";

  const pages = [...document.querySelectorAll(".story-page")];
  const revealItems = [...document.querySelectorAll(".reveal")];
  const pageCounter = document.getElementById("pageCounter");
  const railProgress = document.getElementById("railProgress");
  const scrollProgress = document.getElementById("scrollProgress");
  const chapterLinks = [...document.querySelectorAll(".chapter-links a")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const updateDocumentProgress = () => {
    const root = document.documentElement;
    const available = Math.max(1, root.scrollHeight - innerHeight);
    const ratio = Math.min(1, Math.max(0, scrollY / available));
    if (scrollProgress) scrollProgress.style.width = `${ratio * 100}%`;
  };

  const setActivePage = (page) => {
    if (!page) return;
    const index = pages.indexOf(page);
    const number = page.dataset.page || String(index + 1).padStart(2, "0");
    if (pageCounter) pageCounter.textContent = `${number} / ${String(pages.length).padStart(2, "0")}`;
    if (railProgress) railProgress.style.height = `${((index + 1) / pages.length) * 100}%`;

    const anchors = chapterLinks.map((link) => document.querySelector(link.getAttribute("href")));
    let activeChapter = anchors[0];
    anchors.forEach((anchor) => {
      if (anchor && anchor.offsetTop <= page.offsetTop + 2) activeChapter = anchor;
    });
    chapterLinks.forEach((link) => {
      const selected = activeChapter && link.getAttribute("href") === `#${activeChapter.id}`;
      if (selected) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealItems.forEach((item) => revealObserver.observe(item));

    const pageObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActivePage(visible.target);
    }, { threshold: [0.25, 0.5, 0.72] });
    pages.forEach((page) => pageObserver.observe(page));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    setActivePage(pages[0]);
  }

  addEventListener("scroll", updateDocumentProgress, { passive: true });
  addEventListener("resize", updateDocumentProgress, { passive: true });
  updateDocumentProgress();

  const dialog = document.getElementById("screenDialog");
  const dialogImage = document.getElementById("dialogImage");
  const dialogTitle = document.getElementById("dialogTitle");
  document.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!dialog || !dialogImage || !dialogTitle) return;
      dialogImage.src = button.dataset.lightbox || "";
      dialogImage.alt = button.querySelector("img")?.alt || button.dataset.title || "SOUS 产品界面";
      dialogTitle.textContent = button.dataset.title || "产品界面";
      dialog.showModal();
    });
  });
  document.querySelector("[data-close-dialog]")?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (dialog?.open) {
      if (event.key === "Escape") dialog.close();
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
    if (!["PageDown", "PageUp"].includes(event.key)) return;
    event.preventDefault();
    const nearest = pages.reduce((best, page) => (
      Math.abs(page.getBoundingClientRect().top - 68) < Math.abs(best.getBoundingClientRect().top - 68) ? page : best
    ), pages[0]);
    const current = pages.indexOf(nearest);
    const next = event.key === "PageDown"
      ? Math.min(pages.length - 1, current + 1)
      : Math.max(0, current - 1);
    pages[next]?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
})();
