// Live-Check: prüft die veröffentlichte Seite wie ein Android-Handy.
//   node tests/live-check.mjs https://befcknquiet.github.io/classpad-bildwandler/
// Braucht nur Playwright (npm i playwright). Läuft auch gegen einen lokalen Server.
import { chromium, devices } from "playwright";
import { readFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || "https://befcknquiet.github.io/classpad-bildwandler/").replace(/\/?$/, "/");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WAIT_MIN = Number(process.env.WAIT_MIN || 10);
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "OK    " : "FEHLER"} ${name}${detail ? " – " + detail : ""}`); };
const sha = b => createHash("sha256").update(b).digest("hex");

// ---------- 1. Ausgelieferte Dateien = Dateien im Repo ----------
const sw = readFileSync(ROOT + "sw.js", "utf8");
const FILES = JSON.parse("[" + sw.match(/const FILES = \[([\s\S]*?)\];/)[1].replace(/,\s*$/, "") + "]");
const TYPES = { html: "text/html", webmanifest: "application/manifest+json", css: "text/css", woff2: "font/woff2", png: "image/png", svg: "image/svg+xml", js: "javascript" };

async function compareFiles() {
  const diff = [];
  for (const f of [...FILES, "sw.js"]) {
    const local = readFileSync(ROOT + (f === "./" ? "index.html" : f));
    const res = await fetch(BASE + (f === "./" ? "" : f), { cache: "no-store" });
    const body = Buffer.from(await res.arrayBuffer());
    const ext = (f === "./" ? "index.html" : f).split(".").pop();
    const type = res.headers.get("content-type") || "";
    if (!res.ok) diff.push(`${f}: HTTP ${res.status}`);
    else if (sha(body) !== sha(local)) diff.push(`${f}: Inhalt anders`);
    else if (!type.includes(TYPES[ext])) diff.push(`${f}: Content-Type ${type}`);
  }
  return diff;
}
let diff = [], deadline = Date.now() + WAIT_MIN * 60000;
for (;;) {
  try { diff = await compareFiles(); } catch (e) { diff = ["Abruf: " + e.message]; }
  if (!diff.length || Date.now() > deadline) break;
  console.log("warte auf Veröffentlichung:", diff.slice(0, 3).join("; "));
  await new Promise(r => setTimeout(r, 20000));
}
ok(`${FILES.length + 1} Dateien online, identisch mit dem Repo, richtiger Content-Type`, !diff.length, diff.join("; "));

// ---------- Testbilder als PNG (ohne Abhängigkeiten) ----------
const CRC = new Int32Array(256).map((_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function png(w, h, rgbAt) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgbAt(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const quad = (x, y) => y < 15 ? (x < 20 ? [255, 0, 0] : [0, 255, 0]) : (x < 20 ? [0, 0, 255] : [255, 255, 255]);
const grad = (x, y) => [x, (x * 3 + y * 5) % 256, 255 - x];
const IMAGES = [
  { name: "quadranten.png", w: 40, h: 30, at: quad },
  { name: "verlauf.png", w: 256, h: 64, at: grad },
];

// ---------- .c2p-Prüfung nach der Formatbeschreibung (README) ----------
const FOOTER_SHA = "868a7ad2cba1fd37d3f94534d74a9c4db539ab3772928c128633bb39aae23a79"; // getFooter() aus heheleo/c2p
function expectedHeader(dataLen, w, h) {
  const size = dataLen + 0xDC + 0x17C, H = Buffer.alloc(0xDC);
  H.set([0xBC, 0xBE, 0xAC, 0xB6, 0xB0, 0xFF, 0xFF, 0xFF, 0x9C, 0xCD, 0x8F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFE, 0xFF, 0xEF, 0xFF, 0xFE, 0xFF], 0);
  const a = ~size & 0xFFFFFF; H.set([a >> 16 & 255, a >> 8 & 255, a & 255, (0x1D1 - (size & 255)) & 255], 0x17);
  H.write("CC0100ColorCP\0", 0x20, "latin1");
  H.writeUInt32BE(size - 0x20, 0x30); H[0x37] = 0x09; H.writeUInt32BE(size - 0x234, 0x38); H.set([0x01, 0x7C], 0x46);
  H.write("0100", 0xB8, "latin1"); H.writeUInt32BE(size - 0x254, 0xBC);
  H.writeUInt16BE(w, 0xC2); H.writeUInt16BE(h, 0xC4);
  H.set([0x00, 0x10, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0x01, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], 0xC6);
  H.writeUInt32BE(size - 0x258, 0xD8);
  return H;
}
function checkC2P(buf, img) {
  const errs = [], w = buf.readUInt16BE(0xC2), h = buf.readUInt16BE(0xC4), data = buf.subarray(0xDC, buf.length - 0x17C);
  if (w !== img.w || h !== img.h) errs.push(`Maße ${w}×${h} statt ${img.w}×${img.h}`);
  if (!buf.subarray(0, 0xDC).equals(expectedHeader(data.length, w, h))) errs.push("Header weicht ab");
  if (sha(buf.subarray(buf.length - 0x17C)) !== FOOTER_SHA) errs.push("Footer weicht ab");
  let raw; try { raw = inflateSync(data); } catch (e) { errs.push("zlib: " + e.message); }
  if (raw && raw.length !== w * h * 2) errs.push(`Rohdaten ${raw.length} statt ${w * h * 2}`);
  if (raw && !errs.length) {
    let bad = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [r, g, b] = img.at(x, y);
      const v = (Math.round(r * 31 / 255) << 11) | (Math.round(g * 63 / 255) << 5) | Math.round(b * 31 / 255);
      if (raw.readUInt16BE((y * w + x) * 2) !== v) bad++;
    }
    if (bad) errs.push(`${bad} Pixel falsch`);
  }
  return errs;
}

// ---------- 2. Im Browser wie auf einem Android-Handy ----------
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], acceptDownloads: true });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", m => { if (["error", "warning"].includes(m.type())) logs.push(m.text()); });
  page.on("pageerror", e => logs.push("pageerror: " + e.message));

  await page.goto(BASE);
  await page.waitForSelector(".file .icon.dl:not([disabled])", { timeout: 20000 });
  ok("Seite lädt, Beispielbild wird umgewandelt", true);
  ok("Handy-Layout ohne horizontales Scrollen", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  ok("Service Worker steuert die Seite", await page.evaluate(() => !!navigator.serviceWorker.controller));
  const cdp = await ctx.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  ok("Chrome: als App installierbar", !installabilityErrors.length, installabilityErrors.map(e => e.errorId).join(", "));

  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector(".file .icon.dl:not([disabled])", { timeout: 20000 });
  ok("Offline: Seite lädt aus dem Cache", true);

  // 1:1 und ohne Glätten, damit jedes Pixel exakt vorhersagbar ist
  await page.click("label:has(#fit-orig)");
  await page.click("label:has(#dither)");
  await page.setInputFiles("#file", IMAGES.map(i => ({ name: i.name, mimeType: "image/png", buffer: png(i.w, i.h, i.at) })));
  await page.waitForFunction(n => document.querySelectorAll(".file .icon.dl:not([disabled])").length === n, IMAGES.length);
  const downloads = [];
  page.on("download", d => downloads.push(d));
  await page.click("#all");
  await page.waitForFunction(() => /gespeichert/.test(document.getElementById("status").textContent));
  await page.waitForTimeout(1500);
  ok(`Offline: „Alle speichern“ liefert ${IMAGES.length} einzelne .c2p (kein ZIP)`,
    downloads.length === IMAGES.length && downloads.every(d => d.suggestedFilename().endsWith(".c2p")),
    downloads.map(d => d.suggestedFilename()).join(", "));
  for (const img of IMAGES) {
    const d = downloads.find(x => x.suggestedFilename() === img.name.replace(".png", ".c2p"));
    if (!d) { ok(`${img.name}: .c2p`, false, "nicht heruntergeladen"); continue; }
    const errs = checkC2P(readFileSync(await d.path()), img);
    ok(`${d.suggestedFilename()}: Header, Footer, zlib, Länge, alle ${img.w * img.h} Pixel`, !errs.length, errs.join("; "));
  }
  ok("Konsole ohne Fehler und Warnungen", !logs.length, logs.join(" | "));
} catch (e) {
  ok("Browser-Test", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.pass).length;
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Live-Check ${BASE}\n\n` + results.map(r => `- ${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`).join("\n") + "\n");
}
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen.` : "\nAlles in Ordnung.");
process.exit(failed ? 1 : 0);
