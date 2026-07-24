import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:"new",args:["--no-sandbox"]});
const page = await (await b.createBrowserContext()).newPage();
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await page.goto("http://localhost:8787",{waitUntil:"networkidle0"});
const r = await page.evaluate(async () => {
  const out = { hasShare: "share" in navigator, hasClipboard: !!navigator.clipboard?.writeText };
  if (out.hasShare) {
    try { await navigator.share({ title: "t", url: location.href }); out.shareResult = "resolved"; }
    catch (e) { out.shareResult = `rejected: ${e.name}: ${e.message}`; }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
