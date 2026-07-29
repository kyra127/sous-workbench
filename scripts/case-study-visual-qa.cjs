const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const baseUrl = process.env.SOUS_CASE_STUDY_URL || "http://127.0.0.1:8137/projects/sous";
const edgeExecutable = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function inspect(page, viewport, screenshotName) {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.setViewportSize(viewport);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#productGallery .product-gallery-device");

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < height; top += Math.max(500, viewport.height * 0.8)) {
    await page.evaluate((value) => window.scrollTo(0, value), top);
    await page.waitForTimeout(20);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);

  const firstZoom = page.locator("#productGallery [data-gallery-src]").first();
  await firstZoom.click();
  await page.waitForSelector("#galleryDialog[open]");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#galleryDialog")?.open);

  const interactionRoot = page.locator("#primaryInteraction");
  await interactionRoot.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(180);
  const initialAutoplayIndex = await interactionRoot.getAttribute("data-active-index");
  await page.waitForTimeout(1050);
  const advancedAutoplayIndex = await interactionRoot.getAttribute("data-active-index");
  if (initialAutoplayIndex === advancedAutoplayIndex) throw new Error("Autoplay did not advance the core journey");
  await page.locator('[data-interaction-index="0"]').click();
  await page.waitForTimeout(180);
  const initialInteractionImage = await page.locator(".interaction-phone img").getAttribute("src");
  await page.locator('[data-interaction-index="2"]').click();
  await page.waitForTimeout(180);
  const updatedInteractionImage = await page.locator(".interaction-phone img").getAttribute("src");

  const metrics = await page.evaluate(() => {
    const images = [...document.images];
    const spread = (selector) => {
      const heights = [...document.querySelectorAll(selector)].map((item) => Math.round(item.getBoundingClientRect().height));
      return heights.length ? Math.max(...heights) - Math.min(...heights) : -1;
    };
    const rowCount = (selector) => new Set(
      [...document.querySelectorAll(selector)].map((item) => Math.round(item.getBoundingClientRect().top)),
    ).size;
    const nav = document.querySelector(".site-header nav")?.getBoundingClientRect();
    const brand = document.querySelector(".brand")?.getBoundingClientRect();
    const cta = document.querySelector(".header-cta")?.getBoundingClientRect();
    const heroScreen = document.querySelector(".hero-screen")?.getBoundingClientRect();
    const heroPhone = document.querySelector(".hero-phone")?.getBoundingClientRect();
    const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const phoneAspectErrors = [...document.querySelectorAll(".phone-screen img")].map((image) => {
      const rect = image.getBoundingClientRect();
      return Math.abs((rect.width / rect.height) - (image.naturalWidth / image.naturalHeight));
    });
    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      totalHeight: document.documentElement.scrollHeight,
      topLevelSections: document.querySelectorAll("main > section").length,
      galleryCards: document.querySelectorAll("#productGallery .product-gallery-device").length,
      designPanels: document.querySelectorAll("#design-system .design-panel").length,
      designSwatches: document.querySelectorAll("#design-system .design-swatches > div").length,
      componentSpecs: document.querySelectorAll("#design-system .component-spec-grid > section").length,
      architectureModules: document.querySelectorAll("#architecture .architecture-module").length,
      scopeExcludedReasons: document.querySelectorAll("#scope .scope-excluded-reasons > section").length,
      scopeIncludedStages: document.querySelectorAll("#scope .scope-included-stages > section").length,
      galleryRows: rowCount("#productGallery .product-gallery-device"),
      boundaryScreens: document.querySelectorAll("#boundaryScreens .boundary-screen-card").length,
      boundarySources: [...document.querySelectorAll("#boundaryScreens .phone-screen img")].map((image) => image.getAttribute("src")),
      iterationSource: document.querySelector("#evidence .phone-screen img")?.getAttribute("src"),
      reflectionGate: Boolean(document.querySelector("#reflection .reflection-gate")),
      responsibilityCards: document.querySelectorAll(".responsibility-grid article").length,
      galleryPhoneWidth: Math.round(document.querySelector("#productGallery .phone-mockup")?.getBoundingClientRect().width || 0),
      boundaryPhoneWidth: Math.round(document.querySelector("#boundaryScreens .phone-mockup")?.getBoundingClientRect().width || 0),
      interactionPhoneWidth: Math.round(document.querySelector(".interaction-phone")?.getBoundingClientRect().width || 0),
      autoplayToggle: Boolean(document.querySelector("#interactionToggle")),
      activeInteractionSteps: document.querySelectorAll(".interaction-step.is-active").length,
      phoneImageMinWidth: Math.min(...[...document.querySelectorAll(".phone-screen img")].map((image) => image.naturalWidth || 0)),
      phoneAspectMaxError: Math.max(...phoneAspectErrors),
      heroMockupsOverlap: overlaps(heroScreen, heroPhone),
      realScenarios: document.querySelectorAll(".real-scenarios article").length,
      conditionCards: document.querySelectorAll(".condition-grid article").length,
      decisions: document.querySelectorAll(".decision-matrix article").length,
      recoveryCards: document.querySelectorAll("#recoveryStories .recovery-card").length,
      phoneMockups: document.querySelectorAll(".phone-mockup").length,
      removedStructures: document.querySelectorAll("#system,#product,#interactions,.journey-swimlane,.micro-state-grid,.product-chapter-intro").length,
      decisionSectionHeight: Math.round(document.querySelector("#decisions")?.getBoundingClientRect().height || 0),
      gallerySectionHeight: Math.round(document.querySelector("#gallery")?.getBoundingClientRect().height || 0),
      conditionHeightSpread: spread(".condition-grid article"),
      galleryHeightSpread: spread(".product-gallery-device"),
      boundaryHeightSpread: spread(".boundary-screen-card"),
      navClear: !nav || !brand || !cta || (brand.right < nav.left && nav.right < cta.left),
      heroSource: document.querySelector(".hero-screen")?.getAttribute("src"),
      missingImages: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
    };
  });

  if (metrics.scrollWidth > metrics.viewportWidth + 1) throw new Error(`Horizontal overflow: ${metrics.scrollWidth}/${metrics.viewportWidth}`);
  if (metrics.topLevelSections !== 14) throw new Error(`Expected 14 top-level sections including hero, received ${metrics.topLevelSections}`);
  if (metrics.galleryCards !== 6) throw new Error(`Expected 6 purposeful gallery cards, received ${metrics.galleryCards}`);
  if (metrics.designPanels !== 3) throw new Error(`Expected 3 design-system panels, received ${metrics.designPanels}`);
  if (metrics.designSwatches !== 6) throw new Error(`Expected 6 core color swatches, received ${metrics.designSwatches}`);
  if (metrics.componentSpecs !== 4) throw new Error(`Expected 4 component groups, received ${metrics.componentSpecs}`);
  if (metrics.architectureModules !== 4) throw new Error(`Expected 4 architecture modules, received ${metrics.architectureModules}`);
  if (metrics.scopeExcludedReasons !== 4 || metrics.scopeIncludedStages !== 4) throw new Error(`Unexpected MVP grouping: ${metrics.scopeIncludedStages}/${metrics.scopeExcludedReasons}`);
  if (metrics.boundaryScreens !== 3) throw new Error(`Expected 3 real boundary screens, received ${metrics.boundaryScreens}`);
  if (metrics.boundarySources.join("|") !== "/case-assets/ai-processing.png|/case-assets/draft-missing.png|/case-assets/draft-ready.png") throw new Error(`Boundary screenshots do not match their responsibilities: ${metrics.boundarySources.join("|")}`);
  if (metrics.iterationSource !== "/case-assets/draft-special-requirement.png") throw new Error(`Iteration is not using the real product screenshot: ${metrics.iterationSource}`);
  if (metrics.reflectionGate) throw new Error("Removed reflection optimization gate is still visible");
  if (metrics.responsibilityCards !== 0) throw new Error(`Standalone responsibility cards should be merged, received ${metrics.responsibilityCards}`);
  if (metrics.realScenarios !== 2) throw new Error(`Expected 2 real scenarios, received ${metrics.realScenarios}`);
  if (metrics.conditionCards !== 3) throw new Error(`Expected 3 applicability conditions, received ${metrics.conditionCards}`);
  if (metrics.decisions !== 3) throw new Error(`Expected 3 compact decisions, received ${metrics.decisions}`);
  if (metrics.recoveryCards !== 2) throw new Error(`Expected 2 recovery cards, received ${metrics.recoveryCards}`);
  if (metrics.removedStructures !== 0) throw new Error(`Found ${metrics.removedStructures} removed duplicate structures`);
  if (metrics.heroSource !== "/case-assets/registration-wide.png") throw new Error(`Unexpected hero source: ${metrics.heroSource}`);
  if (viewport.width >= 1000 && metrics.decisionSectionHeight > viewport.height) throw new Error(`Decision section exceeds one viewport: ${metrics.decisionSectionHeight}/${viewport.height}`);
  if (viewport.width >= 1101 && metrics.galleryRows !== 1) throw new Error(`Desktop Gallery must keep all six key screens in one row, received ${metrics.galleryRows} rows`);
  if (viewport.width >= 1101 && metrics.galleryPhoneWidth < 140) throw new Error(`Gallery mockups are too small: ${metrics.galleryPhoneWidth}px`);
  if (viewport.width >= 1000 && metrics.boundaryPhoneWidth < 110) throw new Error(`Boundary mockups are too small: ${metrics.boundaryPhoneWidth}px`);
  if (viewport.width >= 1000 && metrics.interactionPhoneWidth < 240) throw new Error(`Interaction mockup is too small: ${metrics.interactionPhoneWidth}px`);
  if (!metrics.autoplayToggle) throw new Error("Core journey autoplay control is missing");
  if (metrics.activeInteractionSteps !== 1) throw new Error(`Expected one active interaction step, received ${metrics.activeInteractionSteps}`);
  if (metrics.phoneImageMinWidth < 786) throw new Error(`Phone screenshot source is not 2x: ${metrics.phoneImageMinWidth}px`);
  if (metrics.phoneAspectMaxError > 0.002) throw new Error(`Phone screenshot is cropped or distorted: ${metrics.phoneAspectMaxError}`);
  if (viewport.width >= 1000 && !metrics.heroMockupsOverlap) throw new Error("Restored Hero stage must retain the intentional layered composition");
  if (viewport.width >= 1000 && metrics.conditionHeightSpread > 1) throw new Error(`Condition card heights differ by ${metrics.conditionHeightSpread}px`);
  if (viewport.width >= 1101 && metrics.galleryHeightSpread > 1) throw new Error(`Gallery device heights differ by ${metrics.galleryHeightSpread}px`);
  if (viewport.width >= 1000 && metrics.boundaryHeightSpread > 1) throw new Error(`Boundary screen heights differ by ${metrics.boundaryHeightSpread}px`);
  if (viewport.width >= 1000 && !metrics.navClear) throw new Error("Desktop header elements overlap");
  if (initialInteractionImage === updatedInteractionImage) throw new Error("Interaction state image did not change");
  if (metrics.missingImages.length) throw new Error(`Missing images: ${metrics.missingImages.join(", ")}`);
  if (errors.length) throw new Error(errors.join("\n"));

  if (viewport.width >= 1000) {
    await page.locator("#ai").screenshot({ path: path.join(root, "qa-case-study-ai-boundary.png"), animations: "disabled" });
    await page.locator("#design-system").screenshot({ path: path.join(root, "qa-case-study-design-system.png"), animations: "disabled" });
    await page.locator("#conditions").screenshot({ path: path.join(root, "qa-case-study-conditions.png"), animations: "disabled" });
    await page.locator("#evidence").screenshot({ path: path.join(root, "qa-case-study-iteration.png"), animations: "disabled" });
    await page.locator("#primaryInteraction").screenshot({ path: path.join(root, "qa-case-study-interaction-missing.png"), animations: "disabled" });
    await page.locator("#problem").screenshot({ path: path.join(root, "qa-case-study-problem.png"), animations: "disabled" });
    await page.locator("#architecture").screenshot({ path: path.join(root, "qa-case-study-architecture.png"), animations: "disabled" });
    await page.locator("#gallery").screenshot({ path: path.join(root, "qa-case-study-gallery.png"), animations: "disabled" });
  }
  await page.screenshot({ path: path.join(root, screenshotName), fullPage: true, animations: "disabled" });
  return metrics;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: edgeExecutable });
  const desktopPage = await browser.newPage();
  const mobilePage = await browser.newPage();
  const desktop = await inspect(desktopPage, { width: 1355, height: 792 }, "qa-case-study-desktop.png");
  const mobile = await inspect(mobilePage, { width: 390, height: 844 }, "qa-case-study-mobile.png");
  await browser.close();
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
