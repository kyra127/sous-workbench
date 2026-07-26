(() => {
  function installFirstWorkspaceGuard() {
    const shell = document.getElementById("sousSetup");
    if (!shell || shell.dataset.v6FirstWorkspaceGuard === "true") return;
    shell.dataset.v6FirstWorkspaceGuard = "true";
    shell.addEventListener("click", (event) => {
      const finish = event.target.closest("#finishSetup");
      if (!finish) return;
      const editing = finish.textContent.includes("保存");
      const sample = shell.querySelector("#loadSampleData");
      if (editing || !sample || sample.checked) return;
      setTimeout(async () => {
        menu = {};
        await store.set("menu", menu);
        renderAll();
        if (typeof enhanceAll === "function") enhanceAll();
      }, 0);
    }, true);
  }

  function init() {
    installFirstWorkspaceGuard();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
