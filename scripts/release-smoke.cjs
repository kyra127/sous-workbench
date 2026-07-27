const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:8124/?v=release-smoke", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("sous:release-sentinel", "preserve-me");
    localStorage.setItem("sous:clean-release", "older-build");
  });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(() => localStorage.getItem("sous:release-sentinel")),
    "preserve-me",
    "A version change cleared existing local data",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("sous:clean-release")),
    "20260727-v31.36-rc1",
    "Release marker was not updated",
  );
  assert.deepEqual(errors, [], `Page errors: ${errors.join("; ")}`);
  console.log("release smoke passed");
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
