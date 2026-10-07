#!/usr/bin/env node
/**
 * Browser verification loop. Usage:
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/verify.mjs --url=http://localhost:4173 --ids=work,about,skills,contact
 * Needs: npm i -D playwright && npx playwright install chromium   (or CHROME_PATH=/path/to/chrome)
 * Exits non-zero on any failure; screenshots land in verify-out/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=").slice(1).join("=");
const URL_ = arg("url", "http://localhost:4173");
const IDS = arg("ids", "work,about,skills,contact").split(",").filter(Boolean);
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];
mkdirSync("verify-out", { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox"],
});
const failures = [];
const fail = (vp, msg) => { failures.push(`[${vp}] ${msg}`); console.log(`FAIL [${vp}] ${msg}`); };
const pass = (vp, msg) => console.log(`ok   [${vp}] ${msg}`);

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(m.text()));
  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  await page.screenshot({ path: `verify-out/${vp.name}-top.png` });
  await page.mouse.move(vp.width * 0.7, vp.height * 0.4, { steps: 8 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `verify-out/${vp.name}-cursor.png` });
  await page.screenshot({ path: `verify-out/${vp.name}-full.png`, fullPage: true });

  const r = await page.evaluate((ids) => {
    const links = [...document.querySelectorAll("a[href]")].map((a) => ({
      href: a.getAttribute("href") || "",
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel") || "",
    }));
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      missing: ids.filter((id) => !document.getElementById(id)),
      badRelative: links.filter((l) => /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(l.href)).map((l) => l.href),
      unsafeBlank: links.filter((l) => l.target === "_blank" && !/noopener/.test(l.rel)).map((l) => l.href),
      aiMention: /claude|anthropic/i.test(document.body.innerText),
      emptyButtons: [...document.querySelectorAll("button,a")].filter(
        (el) => !el.textContent?.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title")
      ).length,
      imgNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
    };
  }, IDS);

  r.overflowX > 1 ? fail(vp.name, `horizontal overflow ${r.overflowX}px`) : pass(vp.name, "no horizontal overflow");
  r.missing.length ? fail(vp.name, `missing section ids: ${r.missing}`) : pass(vp.name, "section ids present");
  r.badRelative.length ? fail(vp.name, `scheme-less links: ${r.badRelative}`) : pass(vp.name, "no scheme-less links");
  r.unsafeBlank.length ? fail(vp.name, `_blank without noopener: ${r.unsafeBlank}`) : pass(vp.name, "_blank links safe");
  r.aiMention ? fail(vp.name, "page text mentions Claude/Anthropic") : pass(vp.name, "no AI attribution in page text");
  r.emptyButtons ? fail(vp.name, `${r.emptyButtons} links/buttons with no accessible name`) : pass(vp.name, "controls have names");
  r.imgNoAlt ? fail(vp.name, `${r.imgNoAlt} <img> without alt`) : pass(vp.name, "images have alt");
  errors.length ? fail(vp.name, `console/page errors: ${errors.join(" | ")}`) : pass(vp.name, "no console errors");
  await page.close();
}
await browser.close();
if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nAll checks passed. Now LOOK at verify-out/*.png before declaring done.");
