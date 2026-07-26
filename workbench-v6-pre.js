(() => {
  const NativeMutationObserver = window.MutationObserver;
  class DeferredSetupObserver {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  window.MutationObserver = DeferredSetupObserver;
  const restore = () => setTimeout(() => {
    window.MutationObserver = NativeMutationObserver;
  }, 0);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restore, { once: true });
  } else {
    restore();
  }
})();
