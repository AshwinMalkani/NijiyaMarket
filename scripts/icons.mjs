// Rasterizes public/icon.svg into the PNG sizes the manifest and iOS need.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "public/icon.svg"), "utf8");

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

try {
  for (const size of [192, 512]) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      { waitUntil: "load" },
    );
    const buffer = await page.screenshot({ omitBackground: true, type: "png" });
    writeFileSync(resolve(root, `public/icon-${size}.png`), buffer);
    console.log(`wrote public/icon-${size}.png`);
    await page.close();
  }
} finally {
  await browser.close();
}
