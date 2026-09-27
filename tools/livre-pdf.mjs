// Génère « Mon Livre des Ombres » en PDF (A4) à partir des données du site.
// Usage : node tools/livre-pdf.mjs  (nécessite docs/ construit, pour les polices)
import fs from "fs";
import path from "path";
import http from "http";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const w = {};
for (const f of ["spells1", "spells2", "spells3", "practice", "samhain"]) new Function("window", fs.readFileSync(`src/${f}.js`, "utf8"))(w);
const { CHAPTERS, SPELLS, SAB, DAYS, COLORS, ELEMENTS, HERBS, STONES, MOONS, CANDLE, SYMBOLS, TAROT } = w;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const join = (x) => (Array.isArray(x) ? x.join(", ") : String(x || ""));
const STARS = (n) => "✦".repeat(n) + "✧".repeat(Math.max(0, 3 - n));
const LVL = ["", "Novice", "Initiée", "Confirmée"];
const MOON = `<svg viewBox="-4 -4 108 108" class="moon"><circle cx="50" cy="50" r="50" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M50,0 A50,50 0 0 1 50,100 A30,50 0 0 1 50,0Z" fill="currentColor" opacity=".85"/></svg>`;
const ORN = `<div class="orn">❧ ✦ ☙</div>`;

const byCh = (id) => SPELLS.filter((s) => s.ch === id);
const toc = CHAPTERS.map((c) => `<div class="tocch"><a href="#ch-${c.id}"><b>${c.r}.</b> ${esc(c.n)}</a><ul>${byCh(c.id).map((s) => `<li><a href="#s-${s.id}">${esc(s.n)}</a></li>`).join("")}</ul></div>`).join("");

function spell(s, c) {
  return `<section class="spell" id="s-${s.id}">
<div class="rh"><span>Chapitre ${c.r} · ${esc(c.n)}</span><span>${STARS(s.lvl)}</span></div>
<h2>${esc(s.n)}</h2><p class="sub">${esc(s.sub)}</p>
${s.m ? `<p class="marg">${esc(s.m)}</p>` : ""}
<div class="meta"><div><span>Lune</span>${esc(s.moon)}</div><div><span>Jour</span>${esc(s.day)}</div><div><span>Durée</span>${esc(s.dur)}</div><div><span>Niveau</span>${LVL[s.lvl] || ""}</div></div>
<h3>Il te faut</h3><ul class="ing">${s.ing.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
<h3>Le rituel</h3><ol class="rite">${s.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
<h3>Incantation</h3><p class="inc">${esc(s.inc).replace(/\n/g, "<br>")}</p>
${s.var && s.var.length ? `<h3>Variantes</h3><ul class="var">${s.var.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<h3>Après le sort</h3><p class="after">${esc(s.after)}</p>
${s.warn ? `<p class="warn"><b>Attention.</b> ${esc(s.warn)}</p>` : ""}
<h3>Histoire &amp; tradition</h3><p class="note">${esc(s.note)}</p>
</section>`;
}
const chapters = CHAPTERS.map((c) => `<section class="chap" id="ch-${c.id}" style="--c:${c.c}">
<p class="chnum">Chapitre</p><p class="roman">${c.r}</p><h1>${esc(c.n)}</h1>${ORN}<p class="chintro">${esc(c.i)}</p>
<ul class="chlist">${byCh(c.id).map((s) => `<li><a href="#s-${s.id}">${esc(s.n)}</a><span>${esc(s.sub)}</span></li>`).join("")}</ul></section>
${byCh(c.id).map((s) => spell(s, c)).join("\n")}`).join("\n");

const tbl = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const annexes = `<section class="chap" id="annexes" style="--c:#8c2f2a"><p class="chnum">Annexes</p><p class="roman">✦</p><h1>Les correspondances</h1>${ORN}<p class="chintro">Les tables que toute sorcière garde à portée de main : les jours, les couleurs, les éléments, les plantes, les pierres et les lunes. Elles permettent d’écrire ses propres sorts.</p></section>
<section class="annex"><h2>Les jours de la semaine</h2>${tbl(["Jour", "Astre", "Couleurs", "Pour", "Pierre"], DAYS.map((d) => [d[0], d[1] + " " + d[2], d[3], d[4], d[5]]))}
<h2>Les éléments</h2>${tbl(["Élément", "Direction", "Saison", "Outils", "Signes", "Domaines"], ELEMENTS.map((e) => [e[0], e[1], e[2], e[3], e[4], e[5]]))}</section>
<section class="annex"><h2>Les couleurs</h2>${tbl(["Couleur", "Usages"], COLORS.map((c) => [c[0], c[2]]))}
<h2>Les lunes de l’année</h2>${tbl(["Mois", "Nom", "Énergie"], MOONS.map((m) => [m[0], m[1], m[2]]))}</section>
<section class="annex"><h2>Les plantes</h2>${tbl(["Plante", "Usages magiques"], HERBS.map((h) => [h[0], h[1]]))}</section>
<section class="annex"><h2>Les pierres</h2>${tbl(["Pierre", "Usages magiques"], STONES.map((h) => [h[0], h[1]]))}</section>
<section class="annex"><h2>Le langage de la flamme</h2>${tbl(["Signe", "Ce qu’on y lit"], CANDLE.map((h) => [h[0], h[1]]))}</section>
<section class="annex"><h2>Les formes dans le thé et la cire</h2>${tbl(["Forme", "Sens"], SYMBOLS.map((h) => [h[0], h[1]]))}</section>
<section class="annex"><h2>Les vingt-deux arcanes majeurs</h2>${tbl(["", "Arcane", "À l’endroit", "Renversée"], TAROT.map((t) => [t[0], t[1], t[2], t[3]]))}</section>
<section class="chap" id="sabbats" style="--c:#6f5a2a"><p class="chnum">La roue de l’année</p><p class="roman">☉</p><h1>Les huit sabbats</h1>${ORN}<p class="chintro">Solstices, équinoxes et grandes fêtes celtiques : les huit jalons de l’année des sorcières (dates de l’hémisphère nord).</p></section>
${SAB.map((b) => `<section class="sab"><div class="rh"><span>La roue de l’année</span><span>${esc(b.when)}</span></div><h2>${esc(b.n)}</h2><p class="sub">${esc(b.alias || "")}</p>${b.t.map((p) => `<p>${esc(p)}</p>`).join("")}
<div class="meta sabmeta"><div><span>Couleurs</span>${esc(join(b.cols))}</div><div><span>Plantes</span>${esc(join(b.herbs))}</div><div><span>Pierres</span>${esc(join(b.stones))}</div><div><span>À table</span>${esc(join(b.food))}</div></div><div class="notes short"><span>Comment je l’ai fêté</span></div></section>`).join("\n")}`;

const blanks = `<section class="chap" id="mes-sorts" style="--c:#4a3a5c"><p class="chnum">Tes pages</p><p class="roman">✎</p><h1>Mes propres sorts</h1>${ORN}<p class="chintro">Un Livre des Ombres se transmet et se complète. Ces pages sont à toi : note les sorts que tu inventes, ceux qu’on t’a confiés, et ce qu’ils ont donné.</p></section>
${Array.from({ length: 10 }, () => `<section class="blank"><div class="rh"><span>Mes propres sorts</span><span>✦</span></div>
<div class="field big"><span>Nom du sort</span></div><div class="row3"><div class="field"><span>Date</span></div><div class="field"><span>Lune</span></div><div class="field"><span>Jour</span></div></div>
<div class="field"><span>Intention</span></div><div class="box h5"><span>Il me faut</span></div><div class="box h8"><span>Le rituel</span></div><div class="box h4"><span>Incantation</span></div><div class="box h4"><span>Ce qui s’est passé</span></div></section>`).join("\n")}
<section class="chap" id="journal" style="--c:#3c4a66"><p class="chnum">Tes pages</p><p class="roman">☾</p><h1>Journal des lunes</h1>${ORN}<p class="chintro">Une page par mois : la pleine lune, la nouvelle lune, et ce que tu as ressenti, rêvé, tiré ou lancé.</p></section>
${MOONS.map((m) => `<section class="blank"><div class="rh"><span>Journal des lunes</span><span>${esc(m[0])}</span></div><h2>${esc(m[1])}</h2><p class="sub">${esc(m[0])} · ${esc(m[2])}</p>
<div class="row3"><div class="field"><span>Nouvelle lune le</span></div><div class="field"><span>Pleine lune le</span></div><div class="field"><span>Signe</span></div></div>
<div class="box h6"><span>Mes intentions du mois</span></div><div class="box h6"><span>Rêves, signes, tirages</span></div><div class="box h6"><span>Bilan à la lune suivante</span></div></section>`).join("\n")}`;

function html(print) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="http://localhost:4181/"><link rel="stylesheet" href="/assets/fonts.css"><style>
@page{size:A4;margin:16mm 18mm 18mm;background:var(--paper);@bottom-center{content:counter(page);font-family:Georgia,serif;font-style:italic;font-size:8pt;color:#6b5540}}
@page :first{@bottom-center{content:none}}
.tight{font-size:9.4pt;line-height:1.33}.tight h3{margin:6pt 0 2pt}.tight .inc{font-size:11.5pt;padding:5pt 0}.tight .note::first-letter{font-size:2em}
.tight2{font-size:8.8pt;line-height:1.28}
:root{--ink:#2e2116;--ink2:#5a4230;--red:#8c2f2a;--rule:rgba(90,66,48,.35);--paper:${print ? "#fff" : "#efe4c8"}}
html{background:var(--paper);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;color:var(--ink);font-family:Spectral,Georgia,serif;font-size:10.2pt;line-height:1.42}
a{color:inherit;text-decoration:none}
h1,h2{font-family:'IM Fell English SC',Georgia,serif;font-weight:400;margin:0;line-height:1.05}
h3{font-family:'IM Fell English SC',Georgia,serif;font-weight:400;font-size:12.5pt;color:var(--red);margin:9pt 0 3pt;break-after:avoid}
section{break-before:page}
.rh{display:flex;justify-content:space-between;font-family:'IM Fell English',Georgia,serif;font-style:italic;font-size:9pt;color:var(--ink2);border-bottom:1px solid var(--rule);padding-bottom:4pt;margin-bottom:14pt}
.sub{font-family:'IM Fell English',Georgia,serif;font-style:italic;font-size:13pt;color:var(--ink2);margin:4pt 0 0}
.orn{text-align:center;color:var(--red);letter-spacing:.6em;font-size:13pt;margin:14pt 0}
.moon{width:90pt;height:90pt;color:var(--ink)}
/* couverture */
.cover{break-before:auto;height:248mm;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1.5pt double var(--ink2);padding:20mm}
.cover .k{font-family:'IBM Plex Mono',monospace;font-size:9pt;letter-spacing:.3em;text-transform:uppercase;color:var(--red)}
.cover h1{font-size:44pt;margin:18pt 0 6pt}.cover .t2{font-family:'IM Fell English',serif;font-style:italic;font-size:17pt;color:var(--ink2)}
.cover .foot{margin-top:auto;font-family:'IM Fell English SC',serif;font-size:12pt}.cover .foot small{display:block;font-family:'IBM Plex Mono',monospace;font-size:8pt;color:var(--ink2);margin-top:4pt;letter-spacing:.1em}
.owner{height:248mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.owner p{font-family:'IM Fell English',serif;font-style:italic;font-size:16pt}.owner .line{width:120mm;border-bottom:1px solid var(--ink2);height:28pt;margin:10pt auto}
/* intro */
.intro p{margin:0 0 8pt}.rules{display:grid;grid-template-columns:1fr 1fr;gap:10pt;margin:12pt 0}.rules div{border:1px solid var(--rule);padding:9pt 11pt}.rules b{font-family:'IM Fell English SC',serif;font-weight:400;color:var(--red);font-size:12pt;display:block}
.intro ul{padding-left:14pt}.intro li{margin-bottom:4pt}
.tocch{break-inside:avoid;margin-bottom:8pt}.tocch>a{font-family:'IM Fell English SC',serif;font-size:13pt;color:var(--red)}.tocch ul{margin:2pt 0 0;padding:0;list-style:none;columns:2;column-gap:14pt;font-size:9.8pt}.tocch li{padding:1pt 0}
/* chapitres */
.chap{text-align:center;padding-top:30mm}.chnum{font-family:'IBM Plex Mono',monospace;font-size:9pt;letter-spacing:.3em;text-transform:uppercase;color:var(--c,var(--red));margin:0}
.roman{font-family:'IM Fell English SC',serif;font-size:64pt;color:var(--c,var(--red));margin:6pt 0}.chap h1{font-size:34pt}
.chintro{font-family:'IM Fell English',serif;font-style:italic;font-size:13pt;max-width:130mm;margin:0 auto;color:var(--ink2)}
.chlist{list-style:none;padding:0;margin:18pt auto 0;max-width:130mm;text-align:left}.chlist li{border-bottom:1px dotted var(--rule);padding:5pt 0;display:flex;justify-content:space-between;gap:10pt}.chlist a{font-family:'IM Fell English SC',serif;font-size:12pt}.chlist span{font-style:italic;color:var(--ink2);font-size:9.5pt;text-align:right}
/* sorts */
.spell h2,.sab h2,.blank h2{font-size:26pt}
.marg{font-family:Caveat,cursive;font-size:15pt;color:var(--red);transform:rotate(-2deg);transform-origin:right center;margin:6pt 8pt 0 0;text-align:right}
.meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);margin:10pt 0 2pt}.meta div{padding:5pt 8pt;border-right:1px solid var(--rule);font-size:9.6pt}.meta div:last-child{border-right:0}
.meta span{display:block;font-family:'IBM Plex Mono',monospace;font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2)}
.sabmeta{grid-template-columns:1fr 1fr}.sabmeta div:nth-child(2){border-right:0}.sabmeta div:nth-child(-n+2){border-bottom:1px solid var(--rule)}
ul.ing{list-style:none;padding:0;margin:0;columns:2;column-gap:16pt}ul.ing li{padding-left:13pt;position:relative;break-inside:avoid;margin-bottom:2pt}ul.ing li::before{content:"❧";position:absolute;left:0;color:var(--red);font-size:9pt}
ol.rite{margin:0;padding:0;list-style:none;counter-reset:r}ol.rite li{counter-increment:r;display:grid;grid-template-columns:24pt 1fr;margin-bottom:4pt;break-inside:avoid}ol.rite li::before{content:counter(r,upper-roman)".";font-family:'IM Fell English SC',serif;color:var(--red);text-align:right;padding-right:6pt}
.inc{font-family:'IM Fell English',serif;font-style:italic;font-size:13pt;text-align:center;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:8pt 0;margin:4pt 0;break-inside:avoid}
.var{margin:0;padding-left:14pt;font-size:10pt}.after{font-style:italic;margin:0;font-size:10pt}.note{margin:0;font-size:10pt;color:var(--ink2)}
.note::first-letter{font-family:'IM Fell English SC',serif;font-size:2.4em;float:left;line-height:.8;padding:3pt 4pt 0 0;color:var(--red)}
.warn{border-left:2pt solid var(--red);padding-left:8pt;color:var(--red);font-size:9.6pt;margin:8pt 0 0}
.notes{margin-top:14pt;height:34mm;background:repeating-linear-gradient(transparent 0 21pt,var(--rule) 21pt 22pt);break-inside:avoid}.notes span,.box span,.field span{font-family:'IBM Plex Mono',monospace;font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2)}
.notes.short{height:28mm}
/* annexes */
.annex h2{font-size:20pt;margin:0 0 8pt}.annex h2:not(:first-child){margin-top:18pt}
table{width:100%;border-collapse:collapse;font-size:9pt}th{text-align:left;font-family:'IBM Plex Mono',monospace;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:var(--red);border-bottom:1pt solid var(--ink2);padding:4pt 5pt}
td{border-bottom:1px solid var(--rule);padding:4pt 5pt;vertical-align:top}td:first-child{font-family:'IM Fell English SC',serif;font-size:10.5pt;white-space:nowrap}tr{break-inside:avoid}
.sab p{margin:6pt 0}
/* pages vierges */
.field{border-bottom:1px solid var(--ink2);height:26pt;margin-top:10pt}.field.big{height:34pt}
.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:12pt}
.box{border:1px solid var(--rule);margin-top:10pt;padding:5pt 8pt;background-image:repeating-linear-gradient(transparent 0 21pt,var(--rule) 21pt 22pt);background-position:0 16pt;background-repeat:no-repeat;background-size:100% calc(100% - 16pt)}
.h4{height:32mm}.h5{height:38mm}.h6{height:56mm}.h8{height:72mm}
.colo{font-size:9.5pt}.colo p{margin:0 0 7pt}
</style></head><body>
<section class="cover">${MOON}<p class="k" style="margin-top:22pt">Le Grimoire de Minuit</p><h1>Livre des Ombres</h1><p class="t2">${SPELLS.length} sorts, rituels et correspondances<br>recueillis et mis en ordre</p>${ORN}<div class="foot">Édition de Samhain 2026<small>grimoire.endam-digital.com</small></div></section>
<section class="owner"><p>Ce livre appartient à</p><div class="line"></div><p style="font-size:12pt;margin-top:24pt">commencé le</p><div class="line" style="width:70mm"></div>${ORN}<p style="font-size:11pt;max-width:120mm">« Ne le prête qu’à qui sait le garder. »</p></section>
<section class="intro"><div class="rh"><span>Livre des Ombres</span><span>Avant de commencer</span></div><h2 style="font-size:26pt">Avant de commencer</h2>
<p style="margin-top:10pt">Un Livre des Ombres est le carnet personnel d’une sorcière : on y recopie les sorts qu’on a appris, on y note ceux qu’on invente, et ce qu’ils ont donné. Celui-ci rassemble ${SPELLS.length} sorts tirés de la magie populaire européenne, de la Wicca et de la sorcellerie moderne, classés en ${CHAPTERS.length} chapitres, avec les tables de correspondances, les huit sabbats et des pages à remplir.</p>
<p>Chaque sort indique le moment conseillé, les ingrédients, le rituel pas à pas, l’incantation, des variantes et son histoire. Les étoiles ✦ donnent le niveau : une pour les novices, trois pour les praticiennes confirmées.</p>
<div class="rules"><div><b>Ne nuis à personne</b>« Fais ce que tu veux, si tu ne nuis à personne. » C’est le Rede wiccan, popularisé par Doreen Valiente en 1964.</div><div><b>Le triple retour</b>Selon la tradition, ce que l’on envoie nous revient trois fois. Lance avec soin.</div><div><b>Le libre arbitre</b>On ne force jamais la volonté d’autrui. On agit sur soi, sur une situation, jamais sur le cœur d’un autre.</div><div><b>Le feu se surveille</b>Une bougie ne reste jamais seule. Les plantes toxiques ne se touchent pas.</div></div>
<h3>Précautions de la bonne sorcière</h3><ul><li>Ne laisse jamais une bougie, un fagot ou un charbon ardent sans surveillance. Garde un verre d’eau à portée de main.</li><li>Belladone, datura, mandragore, aconit, if et digitale entraient dans les légendaires « onguents de sorcière ». Ce sont des poisons mortels : ne les cueille pas, ne les ingère jamais.</li><li>Dilue toujours les huiles essentielles, et évite-les près des enfants, des femmes enceintes et des animaux. L’armoise est déconseillée pendant la grossesse.</li><li>La sauge blanche est surexploitée et sacrée pour plusieurs peuples autochtones d’Amérique. Le romarin, le laurier ou le thym la remplacent très bien.</li><li>Un rituel accompagne une démarche. Il ne remplace ni un médecin, ni un avocat, ni la police en cas de danger.</li></ul></section>
<section><div class="rh"><span>Livre des Ombres</span><span>Table des sortilèges</span></div><h2 style="font-size:26pt;margin-bottom:12pt">Table des sortilèges</h2>${toc}
<div class="tocch"><a href="#annexes"><b>✦</b> Les correspondances</a></div><div class="tocch"><a href="#sabbats"><b>☉</b> Les huit sabbats</a></div><div class="tocch"><a href="#mes-sorts"><b>✎</b> Mes propres sorts</a></div><div class="tocch"><a href="#journal"><b>☾</b> Journal des lunes</a></div></section>
${chapters}
${annexes}
${blanks}
<section class="colo"><div class="rh"><span>Livre des Ombres</span><span>Colophon</span></div><h2 style="font-size:22pt;margin-bottom:10pt">Colophon</h2>
<p>Ce Livre des Ombres est une édition du <b>Grimoire de Minuit</b>, un projet Endam Digital. Les textes ont été écrits à partir de l’histoire de la sorcellerie européenne, du folklore des îles Britanniques et de France, et des pratiques de la sorcellerie moderne. Retrouve les sources, l’histoire des sorcières et les dossiers sur <b>grimoire.endam-digital.com</b>.</p>
<p>Les sorts et rituels relèvent de traditions et de croyances. Ils sont présentés pour leur intérêt culturel, historique et personnel, sans prétention scientifique, et ne remplacent en aucun cas un avis médical, juridique ou psychologique.</p>
<p>© 2026 Le Grimoire de Minuit. Ce fichier est destiné à un usage personnel : tu peux l’imprimer autant de fois que tu le souhaites pour toi-même, mais pas le revendre ni le diffuser.</p>${ORN}</section>
</body></html>`;
}

const DOCS = path.join(ROOT, "docs");
const MIME = { ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => { const f = path.join(DOCS, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" }); r.end(fs.readFileSync(f)); });
await new Promise((r) => server.listen(4181, r));
const { chromium } = require("playwright");
const b = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const pg = await b.newPage();
await pg.goto("http://localhost:4181/assets/fonts.css");
const FOOT = (print) => `<div style="width:100%;text-align:center;font-family:Georgia,serif;font-style:italic;font-size:8pt;color:#6b5540;${print ? "" : "background:#efe4c8;-webkit-print-color-adjust:exact;"}padding:4mm 0"><span class="pageNumber"></span></div>`;
fs.mkdirSync("produits", { recursive: true });
for (const [print, name] of [[false, "Livre-des-Ombres-parchemin.pdf"], [true, "Livre-des-Ombres-impression.pdf"]]) {
  await pg.setContent(html(print), { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.emulateMedia({ media: "print" });
  const fixed = await pg.evaluate(() => {
    const px = (mm) => (mm * 96) / 25.4, maxH = px(297 - 16 - 18) - 4, out = [];
    document.body.style.width = "174mm";
    for (const el of document.querySelectorAll(".spell,.sab")) {
      for (const c of ["", "tight", "tight2"]) { if (c) el.classList.add(c); if (el.getBoundingClientRect().height <= maxH) break; if (c === "tight2") out.push(el.id); }
    }
    document.body.style.width = "";
    return out;
  });
  if (fixed.length) console.log("encore trop longs : " + fixed.join(", "));
  await pg.pdf({ path: `produits/${name}`, printBackground: true, preferCSSPageSize: true });
  console.log("écrit : produits/" + name);
}
await b.close(); server.close();
