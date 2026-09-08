const p = require("puppeteer-core"),
  fs = require("fs"),
  path = require("path");
const base = process.env.DOYA_QA_URL || "http://localhost:3107";
const phase = base.includes("localhost") ? "local" : "production";
const ids =
  "top banner seo interview persona hr kintai doyalist promane doyaslide cunning sfa shodan aio mensetsu quote aishodan adimage".split(
    " ",
  );
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await p.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [],
    errors = [];
  let cursor = 0;
  const check = (name, pass) => {
    checks.push({ name, pass: !!pass });
    console.log(pass ? "PASS" : "FAIL", name);
  };
  const frame = (page) => page.$eval("[data-scene]", (e) => e.dataset.frame);
  await Promise.all(
    Array.from({ length: 1 }, async () => {
      const page = await browser.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      while (cursor < ids.length) {
        const id = ids[cursor++];
        await page.setViewport({ width: 1440, height: 1000 });
        const response = await page.goto(
          base + (id === "top" ? "/" : "/" + id),
          { waitUntil: "networkidle2" },
        );
        check(
          `${id}: new motion version and HTTP 200`,
          response.status() === 200 &&
            (await page.$('[data-fv-motion="2026-09-08"]')),
        );
        await page.waitForFunction(() =>
          document
            .querySelector("[data-scene]")
            .classList.contains("is-running"),
        );
        const before = await frame(page);
        await wait(4500);
        check(
          `${id}: scene advances automatically`,
          before !== (await frame(page)),
        );
        await page.setViewport({ width: 390, height: 844 });
        check(
          `${id}: animated mobile layout stays within viewport`,
          await page.evaluate(
            () => document.documentElement.scrollWidth === innerWidth,
          ),
        );
      }
      await page.close();
    }),
  );
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: "networkidle2" });
  await wait(1500);
  const orbit = () =>
    page.$eval(".doya-orbit-one", (e) => getComputedStyle(e).transform);
  const orbitBefore = await orbit();
  await wait(700);
  check("Orbit visibly changes position", orbitBefore !== (await orbit()));
  await page.click(".doya-motion-toggle");
  await wait(150);
  const frozenOrbit = await orbit(),
    frozenFrame = await frame(page);
  await wait(4600);
  check(
    "Global pause freezes orbit and automatic screen changes",
    frozenOrbit === (await orbit()) && frozenFrame === (await frame(page)),
  );
  check(
    "Paused headline remains visible",
    await page.$eval(
      "h1",
      (e) =>
        getComputedStyle(e).opacity === "1" &&
        e.getBoundingClientRect().height > 100,
    ),
  );
  await page.click(".doya-motion-toggle");
  await wait(4500);
  check("Resume restarts screen changes", frozenFrame !== (await frame(page)));
  await page.focus(".doya-scene-selector button:nth-child(3)");
  await page.keyboard.press("Enter");
  await wait(4600);
  check(
    "Keyboard selection remains selected without automatic takeover",
    (await frame(page)) === "2" &&
      (await page.$eval(
        ".doya-scene-selector button:nth-child(3)",
        (e) => e.getAttribute("aria-pressed") === "true",
      )),
  );
  await page.click(".doya-scene-replay");
  await wait(4500);
  check("Local replay restarts the sequence", (await frame(page)) !== "0");
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await wait(500);
  const offscreen = await frame(page);
  await wait(4500);
  check("Offscreen scene stops its timer", offscreen === (await frame(page)));
  await page.evaluate(() => scrollTo(0, 0));
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await wait(200);
  const reduced = await frame(page);
  await wait(4500);
  check(
    "Reduced motion disables CSS animation and automatic changes",
    reduced === (await frame(page)) &&
      (await page.$eval(
        ".doya-scene-bears",
        (e) => getComputedStyle(e).animationName === "none",
      )),
  );
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "no-preference" },
  ]);
  await page.goto(base + "/banner", { waitUntil: "networkidle2" });
  await wait(1500);
  await page.click(".doya-motion-toggle");
  await wait(150);
  const state = () =>
    page.evaluate(() => ({
      frame: document.querySelector("[data-scene]").dataset.frame,
      product: getComputedStyle(
        document.querySelector(".doya-product-display > [data-mock-window]"),
      ).transform,
      shine: getComputedStyle(
        document.querySelector(".doya-product-display > [data-mock-window]"),
        "::after",
      ).transform,
      progress: getComputedStyle(document.querySelector(".doya-step-timer"))
        .transform,
    }));
  const frozen = await state();
  await wait(4600);
  check(
    "Service pause freezes product, shine, progress and step",
    JSON.stringify(frozen) === JSON.stringify(await state()),
  );
  await page.click(".doya-product-display .doya-preview-caption button");
  check(
    "Animated product still opens native full-size preview",
    await page.$eval(
      ".doya-product-display dialog",
      (e) => e.open && e.getBoundingClientRect().width > 1000,
    ),
  );
  await page.keyboard.press("Escape");
  await page.focus(".doya-motion-steps button:nth-child(2)");
  await page.keyboard.press("Enter");
  check(
    "Service steps support keyboard selection",
    (await frame(page)) === "1",
  );
  check("No browser runtime errors", errors.length === 0);
  const output = {
    base,
    checkedAt: new Date().toISOString(),
    checks,
    errors,
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
  };
  fs.writeFileSync(
    path.join(__dirname, `motion-${phase}.json`),
    JSON.stringify(output, null, 2),
  );
  await browser.close();
  process.exitCode = output.passed === output.total ? 0 : 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
