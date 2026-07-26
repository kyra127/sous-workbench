(() => {
  const COMPLETE_KEY = "sous:v7-setup-complete";
  const PROFILE_KEY = "sous:business-profile:v1";
  const LEGACY_BACKUP_KEY = "sous:legacy-industry-backup:v1";

  const normalizeHomeRecordingAction = () => {
    const button = Array.from(
      document.querySelectorAll("#homeOrders .home-empty button"),
    ).find((candidate) =>
      candidate.getAttribute("onclick")?.includes("go('intake')"),
    );
    if (button && button.textContent.trim() !== "录单") {
      button.textContent = "录单";
    }
  };

  const installHomeRecordingLabel = () => {
    normalizeHomeRecordingAction();
    const homeOrders = document.getElementById("homeOrders");
    if (!homeOrders) return;
    new MutationObserver(normalizeHomeRecordingAction).observe(homeOrders, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installHomeRecordingLabel, {
      once: true,
    });
  } else {
    installHomeRecordingLabel();
  }

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest("[data-v7-import],[data-v7-blank]")) {
        localStorage.setItem(COMPLETE_KEY, "true");
      }
    },
    true,
  );

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const shell = document.getElementById("sousSetup");
    if (!shell && attempts < 80) return;
    clearInterval(timer);
    if (!shell) return;

    if (localStorage.getItem(LEGACY_BACKUP_KEY)) {
      localStorage.setItem(COMPLETE_KEY, "true");
    }

    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    } catch {}
    if (!profile?.businessName || !profile?.email) return;
    if (localStorage.getItem(COMPLETE_KEY) === "true") return;

    const business = shell.querySelector("#v7Business");
    const email = shell.querySelector("#v7Email");
    if (business) business.value = profile.businessName;
    if (email) email.value = profile.email;

    const makeChoices = (target, kind, options, selected) => {
      if (!target || target.children.length) return;
      target.innerHTML = options
        .map(
          (value) =>
            `<button type="button" class="choice-chip ${selected.includes(value) ? "on" : ""}" data-v7-choice="${kind}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`,
        )
        .join("");
    };
    makeChoices(
      shell.querySelector("#v7Channels"),
      "channels",
      ["小红书", "抖音", "Instagram", "其他"],
      profile.channels || [],
    );
    makeChoices(
      shell.querySelector("#v7Fulfillment"),
      "fulfillment",
      ["自取", "配送", "到店服务", "上门服务"],
      profile.fulfillment || [],
    );

    shell.hidden = false;
    document.body.classList.add("setup-open");
    shell.querySelectorAll("[data-v7-step]").forEach((screen) => {
      screen.classList.toggle("on", screen.dataset.v7Step === "0");
    });
    shell.querySelectorAll(".setup-progress span").forEach((bar, index) => {
      bar.classList.toggle("on", index === 0);
    });
    const label = shell.querySelector("#v7StepLabel");
    if (label) label.textContent = "1 / 2 · 经营信息";
  }, 50);
})();
