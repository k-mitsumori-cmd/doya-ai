const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const base = process.env.DOYA_QA_URL || "http://localhost:3107";
  const checks = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const assert = (name, value) => {
    checks.push({ name, pass: !!value });
    if (!value) console.error("FAIL " + name);
  };
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + "/banner", { waitUntil: "networkidle2" });
  await page.click("#doya-step-1");
  await wait(100);
  assert(
    "Workflow click changes active step",
    await page.$eval(
      "#doya-step-1",
      (e) => e.getAttribute("aria-selected") === "true",
    ),
  );
  assert(
    "Workflow panel changes",
    await page.$eval("#doya-step-panel", (e) =>
      e.innerText.includes("STEP 02"),
    ),
  );
  await page.focus("#doya-step-1");
  await page.keyboard.press("ArrowRight");
  await wait(100);
  assert(
    "Workflow supports keyboard arrows",
    await page.$eval(
      "#doya-step-2",
      (e) =>
        e === document.activeElement &&
        e.getAttribute("aria-selected") === "true",
    ),
  );
  await page.keyboard.press("Home");
  await wait(100);
  assert(
    "Workflow Home returns to first step",
    await page.$eval(
      "#doya-step-0",
      (e) =>
        e === document.activeElement &&
        e.getAttribute("aria-selected") === "true",
    ),
  );
  await page.$eval(".doya-resource", (e) =>
    e.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await wait(400);
  await page.mouse.move(0, 0);
  await wait(600);
  const before = await page.$eval(
    ".doya-book",
    (e) => getComputedStyle(e).transform,
  );
  await page.hover(".doya-resource");
  await wait(650);
  const after = await page.$eval(
    ".doya-book",
    (e) => getComputedStyle(e).transform,
  );
  assert("Resource cover moves on hover", before !== after);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  assert(
    "Reduced motion disables bear animation",
    await page.$eval(
      ".doya-hero-bear",
      (e) => getComputedStyle(e).animationName === "none",
    ),
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.click(".doya-motion-toggle");
  assert(
    "Pause button pauses bear motion",
    await page.$eval(
      ".doya-hero-bear",
      (e) => getComputedStyle(e).animationPlayState === "paused",
    ),
  );
  await page.$eval(".doya-pricing", (e) =>
    e.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await wait(150);
  assert(
    "Paused reveal remains fully visible",
    await page.$eval(
      ".doya-pricing",
      (e) =>
        getComputedStyle(e).opacity === "1" &&
        getComputedStyle(e).animationName === "none",
    ),
  );
  await page.$eval("details summary", (e) => e.click());
  assert("FAQ opens", await page.$eval("details", (e) => e.open));
  await page.goto(base + "/", { waitUntil: "networkidle2" });
  assert(
    "All 17 services listed",
    await page.$$eval(".doya-service-card", (els) => els.length === 17),
  );
  await page.$$eval(".doya-filter button", (els) => els[2].click());
  await wait(100);
  assert(
    "Sales filter has six services",
    await page.$$eval(".doya-service-card", (els) => els.length === 6),
  );
  const iconCheck = await page.evaluate(async () => {
    const ids = [
      "banner",
      "seo",
      "interview",
      "persona",
      "hr",
      "kintai",
      "doyalist",
      "promane",
      "doyaslide",
      "cunning",
      "sfa",
      "shodan",
      "aio",
      "mensetsu",
      "quote",
      "aishodan",
      "adimage",
    ];
    return Promise.all(
      ids.map(
        (id) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = "/renewal/icons/" + id + ".webp";
          }),
      ),
    );
  });
  assert("All 17 service icons decode", iconCheck.every(Boolean));
  assert(
    "Consultation points directly to the existing verified form",
    await page.$eval(
      ".doya-consult-toggle",
      (e) =>
        e.href ===
        "https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1",
    ),
  );

  const ids = [
    "",
    "banner",
    "seo",
    "interview",
    "persona",
    "hr",
    "kintai",
    "doyalist",
    "promane",
    "doyaslide",
    "cunning",
    "sfa",
    "shodan",
    "aio",
    "mensetsu",
    "quote",
    "aishodan",
    "adimage",
  ];
  for (const id of ids) {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(base + "/" + id, { waitUntil: "domcontentloaded" });
    await wait(400);
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      headings: document.querySelectorAll("h1").length,
      renewal: !!document.querySelector("[data-renewal]"),
      headers: document.querySelectorAll(".doya-header").length,
    }));
    assert(
      (id || "top") + " mobile layout has no overflow and one H1",
      !result.overflow &&
        result.headings === 1 &&
        result.renewal &&
        result.headers === 1,
    );
  }
  for (const file of ["overview", "getting-started", "checklist"]) {
    const r = await page.goto(base + "/resources/doya-ai/" + file + ".html");
    assert(
      file + " resource has all 17 service sections",
      r.status() === 200 &&
        (await page.$$eval("section[id]", (els) => els.length === 17)),
    );
  }
  assert("No first-party JavaScript errors", errors.length === 0);
  const out = {
    base,
    createdAt: new Date().toISOString(),
    checks,
    errors,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
  };
  fs.writeFileSync(
    path.join(
      __dirname,
      base.includes("localhost")
        ? "interaction-qa-local.json"
        : "interaction-qa-production.json",
    ),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify({ passed: out.passed, total: out.total, errors }));
  await browser.close();
  process.exitCode = checks.some((c) => !c.pass) ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
