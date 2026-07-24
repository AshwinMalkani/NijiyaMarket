// Drives the real UI in Chrome at an iPhone-ish viewport: sign up, add an item
// by hand, rate it, and confirm it shows up in the rankings.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:8787";
const PHONE = process.env.PHONE ?? `555${Math.floor(1000000 + Math.random() * 8999999)}`;
const INVITE = process.env.INVITE_CODE ?? "nijiya";
const ITEM = `Smoke Mochi ${Date.now().toString().slice(-5)}`;

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox"],
});

const fail = (message) => {
  throw new Error(message);
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on("pageerror", (err) => console.error("  page error:", err.message));

  const type = async (selector, value) => {
    await page.waitForSelector(selector, { visible: true });
    await page.type(selector, value);
  };

  const clickText = async (text, tag = "button") => {
    await page.waitForFunction(
      (t, g) => [...document.querySelectorAll(g)].some((el) => el.textContent.trim().includes(t)),
      { timeout: 10000 },
      text,
      tag,
    );
    await page.evaluate(
      (t, g) => [...document.querySelectorAll(g)].find((el) => el.textContent.trim().includes(t)).click(),
      text,
      tag,
    );
  };

  console.log(`→ ${BASE} as ${PHONE}`);
  await page.goto(BASE, { waitUntil: "networkidle0" });

  console.log("· signing up");
  await type('input[type="tel"]', PHONE);
  await clickText("Continue");
  await type('input[placeholder="Ashwin"]', "Smoke Tester");
  await page.type('input[autocomplete="new-password"]', "1234");
  await type('input[autocapitalize="none"]', INVITE);
  await clickText("Create account");

  await page.waitForFunction(() => document.body.textContent.includes("What everyone's been trying"), {
    timeout: 10000,
  });
  console.log("· signed in, feed rendered");

  console.log("· adding an item");
  await page.click('button[aria-label="Add an item"]');
  await clickText("Add it by hand");
  await type('input[placeholder="Strong Zero Lemon"]', ITEM);
  await clickText("🍡 Sweet");
  await clickText("Next: rate it");

  console.log("· rating it");
  await page.waitForSelector('input[type="range"]', { visible: true });
  // The form renders before the item finishes loading and Save stays disabled
  // until it does — clicking early is a silent no-op.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.includes("Save rating") && !b.disabled,
      ),
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(slider, "9.1");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await type("textarea", "Chewy, great texture.");
  await clickText("Save rating");

  // Confirm we actually landed on the item page — not still sitting on the form.
  await page.waitForFunction(() => /\/item\/\d+$/.test(location.pathname), { timeout: 15000 });
  await page.waitForFunction((name) => document.body.textContent.includes(name), { timeout: 10000 }, ITEM);
  const detail = await page.evaluate(() => document.body.innerText);
  if (!detail.includes("9.1")) fail("item detail is missing the 9.1 score");
  if (!detail.includes("What everyone said")) fail("did not land on the item detail page");
  console.log("· item detail shows 9.1");

  console.log("· checking rankings");
  await page.goto(`${BASE}/rankings`, { waitUntil: "networkidle0" });
  await page.waitForFunction((name) => document.body.textContent.includes(name), { timeout: 10000 }, ITEM);
  const rankings = await page.evaluate(() => document.body.innerText);
  if (!rankings.includes("9.1")) fail("rankings is missing the score badge");

  console.log("· checking profile");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle0" });
  await page.waitForFunction((name) => document.body.textContent.includes(name), { timeout: 10000 }, ITEM);

  await page.screenshot({ path: "/tmp/nijiya-smoke.png" });
  console.log("\nSMOKE TEST PASSED");
} finally {
  await browser.close();
}
