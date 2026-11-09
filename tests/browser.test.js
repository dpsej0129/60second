import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

const external = process.env.GAME_TEST_URL;
const url = external || "http://127.0.0.1:4173";
const server = external
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "4173",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
let browser;
let page;
const errors = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) break;
    } catch {}
    if (i === 99) throw new Error("Vite server did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    locale: "ko-KR",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-11-08T03:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-08T03:00:01Z"));
  await page.goto(url);
  await expect(page.locator("h1")).toHaveText("아직, 돌아갈 집이 있다.");
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/01-intro.png", fullPage: true });
  async function click(action) {
    await page.locator(`[data-action="${action}"]`).first().click();
  }
  async function tickUntil(check, max = 20000) {
    for (let t = 0; t < max; t += 100) {
      if (await check()) return;
      await page.clock.runFor(100);
    }
    throw new Error(
      `Timed out after ${max} virtual ms: ${await page.locator("h1").textContent()}`,
    );
  }
  async function collect(id) {
    const before = await page.locator(".bag-cell.filled").count();
    await page.locator(`[data-loot="${id}"]`).click();
    await tickUntil(
      async () => (await page.locator(".bag-cell.filled").count()) > before,
      16000,
    );
  }
  async function returnHome(first = false) {
    await click("home");
    await tickUntil(
      async () =>
        first
          ? (await page.locator(".family-modal").count()) > 0
          : (await page.locator(".people-panel").count()) > 0,
      16000,
    );
  }
  async function startCampaign(target = "rescue") {
    await click("start");
    await expect(page.locator("#world")).toBeVisible();
    if (target === "rescue") {
      await collect(7);
      await collect(8);
      await collect(4);
    } else {
      await collect(1);
      await collect(6);
    }
    await expect(page.locator(".bag-panel .panel-heading>b")).toContainText(
      "4",
    );
    const time = await page.locator("#clock").textContent();
    assert.ok(parseFloat(time) < 60);
    await page.screenshot({
      path: "test-results/02-expedition.png",
      fullPage: true,
    });
    await returnHome(true);
    for (let i = 0; i < 3; i++)
      await click(
        target === "community" && i === 2 ? "family-no" : "family-yes",
      );
    await expect(page.locator(".person-row")).toHaveCount(
      target === "rescue" ? 4 : 3,
    );
    const amount = target === "rescue" ? "12인분" : "18인분";
    await expect(page.locator(".resource").nth(0).locator("strong")).toHaveText(
      amount,
    );
    await expect(page.locator(".resource").nth(1).locator("strong")).toHaveText(
      amount,
    );
  }
  await startCampaign();
  await page.screenshot({
    path: "test-results/03-shelter.png",
    fullPage: true,
  });
  // Exercise the daily ration UI, including state-preserving checkbox changes.
  const foodCheck = page.locator('[data-ration="eun"][data-resource="food"]');
  await foodCheck.uncheck();
  await expect(page.locator("#ration-summary")).toContainText("식량 3 / 12");
  await foodCheck.check();
  await click("next-day");
  await expect(page.locator(".resource").nth(0).locator("strong")).toHaveText(
    "8인분",
  );
  await expect(page.locator(".resource").nth(1).locator("strong")).toHaveText(
    "8인분",
  );
  let eventShot = false;
  async function resolve(target) {
    if (!(await page.locator(".event-modal").count())) return;
    if (!eventShot) {
      await page.screenshot({
        path: "test-results/04-event.png",
        fullPage: true,
      });
      eventShot = true;
    }
    const available = await page
      .locator(".event-options button:not([disabled])")
      .evaluateAll((els) => els.map((e) => e.dataset.choice));
    const preference =
      target === "rescue"
        ? [
            "answer",
            "prepare",
            "leave",
            "refuse",
            "wait",
            "defend",
            "nurse",
            "watch",
            "pass",
            "rest",
          ]
        : [
            "talk",
            "repair",
            "join",
            "ignore",
            "wait",
            "defend",
            "nurse",
            "watch",
            "pass",
            "rest",
          ];
    const choice = preference.find((x) => available.includes(x));
    assert.ok(choice, `No safe event action: ${available}`);
    await page.locator(`[data-choice="${choice}"]`).click();
  }
  async function supplies() {
    const food = parseInt(
      await page.locator(".resource").nth(0).locator("strong").textContent(),
    );
    const water = parseInt(
      await page.locator(".resource").nth(1).locator("strong").textContent(),
    );
    const household = await page.locator(".person-row:not(.deceased)").count();
    const rescuePending = await page
      .locator(".route")
      .first()
      .locator("small")
      .textContent();
    const reserve = rescuePending === "연락 중" ? household * 2 : household;
    if (Math.min(food, water) >= reserve) return;
    await click("start");
    const restartedTime = parseFloat(
      await page.locator("#clock").textContent(),
    );
    assert.ok(
      restartedTime > 58 && restartedTime <= 60,
      "new supply trip starts with a fresh 60 seconds",
    );
    // Get the northern foodbox before the pursuer intercepts this aisle.
    const count = async (id) =>
      Number(
        await page.locator(`[data-loot="${id}"]`).getAttribute("data-count"),
      );
    let waterBudget = 1;
    for (const id of [1, 9, 7, 0]) {
      if ((await count(id)) > 0) {
        await collect(id);
        waterBudget = [1, 9].includes(id) ? 2 : 1;
        break;
      }
    }
    // Keep an escape margin: after the bulk stock is gone, a quick two-slot
    // run is safer than detouring into a pursuer to fill every last slot.
    for (const id of waterBudget === 2 ? [6, 2, 8] : [8, 2]) {
      const size = id === 6 ? 2 : 1;
      while (waterBudget >= size && (await count(id)) > 0) {
        await collect(id);
        waterBudget -= size;
      }
    }
    await returnHome();
  }
  async function finish(target) {
    for (
      let i = 0;
      i < 24 && !(await page.locator(".ending-screen").count());
      i++
    ) {
      await resolve(target);
      if (await page.locator(".ending-screen").count()) break;
      await supplies();
      await click("next-day");
    }
    await resolve(target);
    await expect(page.locator(".ending-screen")).toBeVisible();
    await expect(page.locator(".ending-screen h1")).toHaveText(
      target === "rescue" ? "새벽의 구조" : "함께 만드는 내일",
    );
    await page.screenshot({
      path: `test-results/05-${target}-ending.png`,
      fullPage: true,
    });
  }
  await finish("rescue");
  console.log(
    "PASS browser: first run, 4-slot loading, family, rations, repeat supply runs, rescue ending",
  );
  await click("restart");
  await expect(page.locator("h1")).toHaveText("아직, 돌아갈 집이 있다.");
  await startCampaign("community");
  await finish("community");
  console.log("PASS browser: restart and a different community ending");
  await click("restart");
  await click("start");
  await page.clock.runFor(61000);
  await expect(page.locator(".ending-screen .tag")).toContainText("생존 실패");
  console.log("PASS browser: elapsed time / zombie loss in actual UI");
  await click("restart");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile page must not overflow horizontally",
  );
  await page.screenshot({ path: "test-results/06-mobile.png", fullPage: true });
  await click("help");
  await expect(page.locator(".help-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".help-modal")).toHaveCount(0);
  await click("start");
  await expect(page.locator("#world")).toBeVisible();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "mobile expedition overflow stays inside map",
  );
  await page.screenshot({
    path: "test-results/07-mobile-expedition.png",
    fullPage: true,
  });
  const position = await page.locator("#player").getAttribute("transform");
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(400);
  await page.keyboard.up("ArrowRight");
  assert.notEqual(
    await page.locator("#player").getAttribute("transform"),
    position,
  );
  await page.keyboard.press("e");
  await tickUntil(
    async () => (await page.locator(".bag-cell.filled").count()) === 1,
    5000,
  );
  await page.locator(".control-hint").scrollIntoViewIfNeeded();
  await expect(page.locator("#header-clock")).toBeVisible();
  console.log(
    "PASS browser: mobile layout, map access, help and keyboard dismissal",
  );
  assert.deepEqual(errors, [], "no unhandled browser exceptions");
  console.log("PASS browser: no JavaScript runtime errors");
} catch (error) {
  await page?.screenshot({ path: "test-results/failure.png", fullPage: true });
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
