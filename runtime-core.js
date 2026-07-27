(() => {
  "use strict";

  if (window.SOUSRuntime) return;

  const syncers = new Map();
  let frame = 0;
  let observer = null;

  function flush() {
    frame = 0;
    for (const [name, sync] of syncers) {
      try {
        sync();
      } catch (error) {
        console.error(`[SOUS runtime] ${name} sync failed`, error);
      }
    }
  }

  function requestSync() {
    if (frame) return;
    frame = requestAnimationFrame(flush);
  }

  function registerSync(name, sync) {
    if (!name || typeof sync !== "function") return () => {};
    syncers.set(name, sync);
    requestSync();
    return () => syncers.delete(name);
  }

  function start() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(requestSync);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-current"],
    });
    document.addEventListener("click", requestSync, true);
    window.addEventListener("storage", requestSync);
    requestSync();
  }

  window.SOUSRuntime = {
    registerSync,
    requestSync,
    get syncerCount() {
      return syncers.size;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
