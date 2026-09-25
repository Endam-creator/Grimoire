// Génère les visuels réseaux sociaux « Compte à rebours Samhain »
import fs from "fs";
import path from "path";
import vm from "vm";
import http from "http";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DOCS = path.join(ROOT, "docs");
const OUT = path.join(ROOT, "social", "out");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DOCS, "assets/data.js"), "utf8"), ctx);
const S = (id) => ctx.SPELLS.find((s) => s.id === id);
const short = (x) => { const f = x.split(/(?<=[.!?])\s/)[0]; return f.length > 120 ? f.slice(0, f.lastIndexOf(" ", 117)) + "…" : f; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const POSTS = [
  { file: "00-lancement", date: "Sam. 26 sept.", tag: "J – 35", kind: "launch" },
  { file: "01-bougie-fenetre", date: "Sam. 3 oct.", tag: "J – 28", id: "bougiefenetre" },
  { file: "02-lanterne", date: "Sam. 10 oct.", tag: "J – 21", id: "lanterne" },
  { file: "03-noix-dans-le-feu", date: "Sam. 17 oct.", tag: "J – 14", id: "noix" },
  { file: "04-miroir-et-pomme", date: "Sam. 24 oct.", tag: "J – 7", id: "miroirpomme" },
  { file: "05-nuit-du-31", date: "Sam. 31 oct.", tag: "Ce soir", kind: "night" },
];

const moon = `<svg class="moon" viewBox="-4 -4 108 108"><defs><radialGradient id="g" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#f4ecd8"/><stop offset="1" stop-color="#cdbf9f"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="#221d2e" stroke="#3a3249"/><path d="M50,0 A50,50 0 0 1 50,100 A30,50 0 0 1 50,0Z" fill="url(#g)"/></svg>`;

function card(p, W, H) {
  let inner; const story = H > 1500;
  if (p.kind === "launch") {
    inner = `<p class="k">Nouveau · grimoire en ligne</p><h1>Le Grimoire<br>de Minuit</h1><p class="sub">Un Livre des Ombres à feuilleter</p>
    <ul class="big"><li><b>${ctx.SPELLS.length}</b> sorts détaillés</li><li><b>10</b> rituels pas à pas</li><li><b>8</b> sabbats</li><li>tarot, lune, histoire</li></ul>
    <p class="verse">Samhain approche.<br>Le voile s’amincit.<br>Ouvre le livre.</p>`;
  } else if (p.kind === "night") {
    const n = ctx.SAB.find((x) => x.id === "samhain").more.night;
    inner = `<p class="k">Samhain · 31 octobre</p><h1>La nuit du 31,<br>heure par heure</h1>
    <ol class="night">${n.map((x) => `<li><b>${esc(x[0])}</b><span>${esc(S(x[2]).n)}</span></li>`).join("")}</ol>`;
  } else {
    const s = S(p.id);
    const verse = s.inc.split("\n").slice(0, 4).join("<br>");
    inner = `<p class="k">Sort de Samhain · ${esc(s.day)}</p><h1>${esc(s.n)}</h1><p class="sub">${esc(s.sub)}</p>
    <p class="lab">Il te faut</p><ul>${s.ing.slice(0, 4).map((x) => `<li>${esc(x.split(" (")[0])}</li>`).join("")}</ul>
    <p class="lab">Le geste</p><ol class="steps">${s.steps.slice(0, story ? 4 : 3).map((x) => `<li>${esc(short(x))}</li>`).join("")}</ol>
    <p class="verse">${verse}</p>`;
  }
  return `<!doctype html><html><head><link rel="stylesheet" href="/assets/fonts.css"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${W}px;height:${H}px;background:#15121d;background-image:radial-gradient(ellipse 80% 50% at 80% 0%,rgba(217,169,91,.22),transparent 60%),radial-gradient(ellipse 60% 40% at 0% 100%,rgba(176,96,42,.25),transparent 70%);display:flex;flex-direction:column;padding:${story ? "150px 70px 170px" : "64px 64px"};font-family:Spectral,Georgia,serif;color:#2e2116}
  .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px;color:#e9e0cc}
  .brand{font-family:'IM Fell English SC',serif;font-size:34px;display:flex;align-items:center;gap:14px}
  .moon{width:54px;height:54px}
  .tag{font-family:'IM Fell English SC',serif;font-size:${story ? 64 : 54}px;color:#d9a95b;line-height:1}
  .page{flex:1;background:#efe4c8;border-radius:10px;padding:${story ? "70px 64px" : "58px 60px"};position:relative;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 10px #efe4c8,inset 0 0 0 11px rgba(140,47,42,.35);
    background-image:radial-gradient(ellipse at 10% 10%,rgba(255,255,255,.5),transparent 50%),radial-gradient(ellipse at 90% 95%,rgba(140,95,40,.2),transparent 55%);display:flex;flex-direction:column}
  .k{font-family:'IBM Plex Mono',monospace;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#8c2f2a}
  h1{font-family:'IM Fell English SC',serif;font-weight:400;font-size:${story ? 96 : 84}px;line-height:1;margin-top:18px;color:#2e2116}
  .sub{font-family:'IM Fell English',serif;font-style:italic;font-size:${story ? 40 : 36}px;color:#5a4230;margin-top:16px}
  .lab{font-family:'IM Fell English SC',serif;font-size:30px;color:#8c2f2a;margin-top:${story ? 60 : 36}px}
  ul{list-style:none;padding:0;margin-top:12px;font-size:${story ? 34 : 30}px;line-height:1.45}
  ul li::before{content:"❧  ";color:#8c2f2a}
  ul.big{margin-top:44px;font-size:${story ? 44 : 38}px}
  ul.big b{font-family:'IM Fell English SC',serif;font-weight:400;color:#8c2f2a}
  .verse{margin-top:auto;padding-top:28px;border-top:2px solid rgba(140,47,42,.35);font-family:'IM Fell English',serif;font-style:italic;font-size:${story ? 42 : 36}px;line-height:1.4;text-align:center;color:#3a2413}
  ol.steps{margin-top:12px;padding-left:1.3em;font-size:${story ? 32 : 27}px;line-height:1.4;display:grid;gap:8px}
  ol.steps li::marker{color:#8c2f2a;font-family:'IM Fell English SC',serif}
  ol.night{list-style:none;padding:0;margin-top:${story ? 70 : 40}px;display:grid;gap:${story ? 34 : 20}px}
  ol.night li{display:grid;grid-template-columns:${story ? 300 : 280}px 1fr;gap:20px;font-size:${story ? 36 : 31}px;border-bottom:1px dotted rgba(90,66,48,.4);padding-bottom:${story ? 18 : 12}px}
  ol.night b{font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:${story ? 26 : 23}px;color:#8c2f2a;padding-top:8px}
  .foot{margin-top:34px;display:flex;justify-content:space-between;align-items:center;color:#b6ab97;font-family:'IBM Plex Mono',monospace;font-size:26px}
  .foot b{color:#d9a95b;font-weight:500}
  </style></head><body>
  <div class="top"><span class="brand">${moon}Le Grimoire de Minuit</span><span class="tag">${esc(p.tag)}</span></div>
  <div class="page">${inner}</div>
  <div class="foot"><b>grimoire.endam-digital.com</b><span>${p.kind ? "lien en bio" : "sort complet en bio"}</span></div>
  </body></html>`;
}

let CARD = "";
const srv = http.createServer((q, r) => {
  if (q.url.startsWith("/__card")) { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return r.end(CARD); }
  const f = path.join(DOCS, decodeURIComponent(q.url.split("?")[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "Content-Type": f.endsWith(".css") ? "text/css" : f.endsWith(".woff2") ? "font/woff2" : "application/octet-stream" });
  r.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(4175, ok));
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(path.join(process.env.NODE_PATH || "", "playwright"))); }
const b = await chromium.launch();
const pg = await b.newPage();
for (const p of POSTS) {
  for (const [W, H, suf] of [[1080, 1350, "post"], [1080, 1920, "story"]]) {
    await pg.setViewportSize({ width: W, height: H });
    CARD = card(p, W, H);
    await pg.goto("http://localhost:4175/__card?" + p.file + suf);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(OUT, `${p.file}-${suf}.png`) });
  }
}
await b.close(); srv.close();
console.log(fs.readdirSync(OUT).length + " visuels");
