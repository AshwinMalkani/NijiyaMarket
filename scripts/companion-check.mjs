// Regression test for tagging a companion who has no account yet.
// Covers both paths: pressing "Add them", and typing the fields but going
// straight to Save (an earlier nested-<form> bug silently dropped both).
import puppeteer from "puppeteer-core";
import { refuseProduction } from "./guard.mjs";

const BASE = process.env.BASE ?? "http://localhost:8787";
const INVITE = process.env.INVITE_CODE ?? "";
const stamp = Date.now().toString().slice(-6);

refuseProduction(BASE);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox"],
});

const fail = (m) => {
  throw new Error(m);
};

async function run({ label, pressAddThem, itemName, companion, companionPhone }) {
  // Each run needs its own cookie jar so it starts signed out.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const clickText = async (text) => {
    await page.waitForFunction(
      (t) =>
        [...document.querySelectorAll("button")].some(
          (el) => el.textContent.trim().includes(t) && !el.disabled,
        ),
      { timeout: 15000 },
      text,
    );
    await page.evaluate(
      (t) =>
        [...document.querySelectorAll("button")]
          .find((el) => el.textContent.trim().includes(t) && !el.disabled)
          .click(),
      text,
    );
  };

  console.log(`\n== ${label} ==`);
  const phone = `555${Math.floor(1000000 + Math.random() * 8999999)}`;
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.type('input[type="tel"]', phone);
  await clickText("Continue");
  await page.waitForSelector('input[placeholder="Ashwin"]');
  await page.type('input[placeholder="Ashwin"]', "Tagger");
  await page.type('input[autocomplete="new-password"]', "1234");
  if (INVITE) await page.type('input[autocapitalize="none"]', INVITE);
  await clickText("Create account");
  await page.waitForFunction(() => document.body.textContent.includes("What everyone's been trying"));

  await page.click('button[aria-label="Add an item"]');
  await clickText("Add it by hand");
  await page.waitForSelector('input[placeholder="Strong Zero Lemon"]');
  await page.type('input[placeholder="Strong Zero Lemon"]', itemName);
  await clickText("🍶 Alcohol");
  await clickText("Next: rate it");

  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.includes("Save rating") && !b.disabled,
      ),
    { timeout: 15000 },
  );

  await clickText("Someone new");
  await page.waitForSelector('input[placeholder="Their name"]', { visible: true });
  await page.type('input[placeholder="Their name"]', companion);
  await page.type('input[placeholder="Their phone number"]', companionPhone);

  const urlBefore = page.url();
  if (pressAddThem) {
    await clickText("Add them");
    await page.waitForFunction(
      (n) =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent.includes(n) && b.className.includes("rounded-full"),
        ),
      { timeout: 10000 },
      companion,
    );
    if (page.url() !== urlBefore) fail(`navigated away when adding ${companion}`);
    console.log(`· "${companion}" chip appeared, still on the rating form`);
  } else {
    console.log(`· skipped "Add them" on purpose`);
  }

  await clickText("Save rating");
  await page.waitForFunction(() => /\/item\/\d+$/.test(location.pathname), { timeout: 15000 });

  const text = await page.evaluate(() => document.body.innerText);
  if (!text.includes(`with ${companion}`)) {
    fail(`item page does not credit "${companion}" — got:\n${text.slice(0, 400)}`);
  }
  console.log(`· item page shows "with ${companion}"`);
  await context.close();
}

try {
  await run({
    label: "pressing 'Add them'",
    pressAddThem: true,
    itemName: `Sapporo A ${stamp}`,
    companion: "Sahil",
    companionPhone: `555${Math.floor(1000000 + Math.random() * 8999999)}`,
  });

  await run({
    label: "typing the fields but going straight to Save",
    pressAddThem: false,
    itemName: `Sapporo B ${stamp}`,
    companion: "Priya",
    companionPhone: `555${Math.floor(1000000 + Math.random() * 8999999)}`,
  });

  console.log("\nCOMPANION CHECKS PASSED");
} finally {
  await browser.close();
}
