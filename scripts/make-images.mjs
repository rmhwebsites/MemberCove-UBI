// Makes the share image (public/og.png, 1200 by 630) and the Apple touch icon
// (public/apple-touch-icon.png). Run after changing the logo, the headline or the hero
// screenshot:  node scripts/make-images.mjs
// Set CHROMIUM_PATH to use a Chromium other than the one Playwright installed.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = new URL("../", import.meta.url);

// iOS draws its own rounded corners, so the touch icon is a full square.
const touchIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="#282c32"/><circle cx="90" cy="90" r="38" fill="#f2ca4b"/></svg>`;
await sharp(Buffer.from(touchIcon)).png().toFile(new URL("public/apple-touch-icon.png", root).pathname);

const fontFile = (style) => readFileSync(new URL(`node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-${style}.woff2`, root)).toString("base64");
const font = fontFile("normal");
const fontItalic = fontFile("italic");
const shot = readFileSync(new URL("src/assets/screens/admin-overview.webp", root)).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Playfair; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 400 900; }
@font-face { font-family: Playfair; src: url(data:font/woff2;base64,${fontItalic}) format("woff2"); font-weight: 400 900; font-style: italic; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #f2ca4b; color: #282c32; font-family: Playfair, Georgia, serif; position: relative; }
.logo { position: absolute; left: 72px; top: 64px; display: flex; align-items: center; gap: 14px; font-size: 40px; letter-spacing: -0.02em; }
.dot { width: 20px; height: 20px; border-radius: 50%; background: #282c32; }
h1 { position: absolute; left: 72px; top: 170px; width: 560px; font-weight: 400; font-size: 70px; line-height: 1.08; letter-spacing: -0.015em; }
p { position: absolute; left: 72px; bottom: 64px; width: 520px; font-size: 26px; line-height: 1.3; font-style: italic; }
.frame { position: absolute; left: 690px; top: 96px; width: 900px; padding: 12px; border-radius: 26px; background: #282c32; box-shadow: 0 30px 60px -20px rgba(40,44,50,.45); }
.frame img { display: block; width: 100%; border-radius: 16px; }
</style></head><body>
<div class="logo"><span class="dot"></span>MemberCove</div>
<h1>Members, dues and events, all in one place</h1>
<p>Membership software for practice management associations</p>
<div class="frame"><img src="data:image/webp;base64,${shot}" alt=""></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("public/og.png", root).pathname, type: "png" });
await browser.close();
console.log("Wrote public/og.png and public/apple-touch-icon.png");
