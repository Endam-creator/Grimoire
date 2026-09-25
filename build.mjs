// Générateur du site statique « Le Grimoire de Minuit »
import fs from "fs";
import path from "path";
import vm from "vm";
import http from "http";
import crypto from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const ROOT = process.cwd();
const SITE = "https://grimoire.endam-digital.com";
const RAW = path.join(ROOT, "build-raw");
const OUT = path.join(ROOT, "docs");
const TODAY = new Date().toISOString().slice(0, 10);
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const mk = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, s) => { mk(path.dirname(p)); fs.writeFileSync(p, s); };

/* ---------- données ---------- */
const SLUG_JS = `
function gmSlug(s){return String(s).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/œ/g,"oe").replace(/æ/g,"ae").replace(/[’']/g,"-").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").replace(/^(le|la|les|l)-/,"")}
SPELLS.forEach(function(s){s.slug=gmSlug(s.n)});
RIT.forEach(function(r){r.slug=gmSlug(r.n)});
SAB.forEach(function(s){s.slug=s.id});
`;
const dataFiles = ["spells1.js", "spells2.js", "spells3.js", "history.js", "practice.js", "samhain.js", "sources.js", "ingredients.js", "images.js"];
const dataSrc = dataFiles.map((f) => fs.readFileSync(path.join(ROOT, "src", f), "utf8")).join("\n") + "\n" + SLUG_JS;
const ctx = { window: {} };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(dataSrc, ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "dossiers.js"), "utf8"), ctx);
const { CHAPTERS, SPELLS, RIT, SAB, TOOLS, RECIPES, ERAS, FIGURES, GLOSS, DOSSIERS, INGREDIENTS, IMGMETA, IMGPLACE } = ctx;

/* ---------- illustrations (images-src/ -> assets/img/*.webp) ---------- */
const sharp = require("sharp");
const IMGSRC = path.join(ROOT, "images-src");
const CREDITS = fs.existsSync(path.join(IMGSRC, "credits.json")) ? JSON.parse(fs.readFileSync(path.join(IMGSRC, "credits.json"), "utf8")) : {};
const IMG = {};
for (const [key, meta] of Object.entries(IMGMETA)) {
  const c = CREDITS[key]; if (!c) continue;
  const f = path.join(IMGSRC, c.file); if (!fs.existsSync(f)) continue;
  const md = await sharp(f).metadata();
  const w = Math.min(1400, md.width), h = Math.round(md.height * w / md.width);
  IMG[key] = { src: `/assets/img/${key}.webp`, src2: `/assets/img/${key}-700.webp`, w, h, cap: meta.cap, page: c.page, file: f };
}
async function writeImages(dest) {
  mk(path.join(dest, "assets/img"));
  for (const [key, im] of Object.entries(IMG)) {
    await sharp(im.file).resize({ width: im.w }).webp({ quality: 78 }).toFile(path.join(dest, `assets/img/${key}.webp`));
    await sharp(im.file).resize({ width: Math.min(700, im.w) }).webp({ quality: 74 }).toFile(path.join(dest, `assets/img/${key}-700.webp`));
  }
}
function fig(key, cls = "plate") {
  const im = IMG[key]; if (!im) return "";
  return `<figure class="${cls}"><img src="${im.src2}" srcset="${im.src2} 700w, ${im.src} ${im.w}w" sizes="(max-width: 760px) 100vw, 900px" width="${im.w}" height="${im.h}" loading="lazy" decoding="async" alt="${esc(im.cap)}"><figcaption>${esc(im.cap)} <a href="${im.page}" target="_blank" rel="noopener">Domaine public, Wikimedia Commons</a></figcaption></figure>`;
}
const IMGPUB = Object.fromEntries(Object.entries(IMG).map(([k, v]) => [k, { src: v.src, src2: v.src2, w: v.w, h: v.h, cap: v.cap, page: v.page }]));

/* ---------- ingrédients : sorts qui les utilisent ---------- */
const nrm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const hasKw = (txt, kws) => kws.some((k) => new RegExp("(^|[^a-z])" + k.replace(/[()]/g, "\\$&") + "([^a-z]|$)").test(txt));
for (const ing of INGREDIENTS) {
  ing.spells = SPELLS.filter((s) => hasKw(nrm(s.ing.join(" | ") + " | " + s.steps.join(" | ")), ing.k));
  ing.recipes = RECIPES.filter((r) => hasKw(nrm(r.n + " " + r.ing), ing.k));
}
const INGBYSPELL = {};
for (const ing of INGREDIENTS) for (const s of ing.spells) (INGBYSPELL[s.id] = INGBYSPELL[s.id] || []).push(ing);
const CH = Object.fromEntries(CHAPTERS.map((c, i) => [c.id, { ...c, idx: i }]));
const ORDER = SPELLS.slice().sort((a, b) => CH[a.ch].idx - CH[b.ch].idx);
for (const arr of [SPELLS, RIT]) {
  const seen = new Set();
  for (const x of arr) { if (seen.has(x.slug)) throw new Error("slug en double " + x.slug); seen.add(x.slug); }
}

/* ---------- polices auto-hébergées ---------- */
const FONTS = [
  ["im-fell-english-sc", ["400"]],
  ["im-fell-english", ["400", "400-italic"]],
  ["spectral", ["300", "300-italic", "400", "400-italic", "600"]],
  ["ibm-plex-mono", ["400", "500"]],
  ["caveat", ["500", "600"]],
];
function buildFonts(dest) {
  let css = "";
  mk(path.join(dest, "assets/fonts"));
  for (const [pkg, variants] of FONTS) {
    const dir = path.dirname(require.resolve(`@fontsource/${pkg}/package.json`));
    for (const v of variants) {
      for (const sub of ["latin-ext", "latin"]) {
        const f = path.join(dir, `${sub}-${v}.css`);
        if (!fs.existsSync(f)) continue;
        let c = fs.readFileSync(f, "utf8");
        c = c.replace(/url\(\.\/files\/([^)]+?\.woff2)\) format\('woff2'\)(, url\([^)]+\) format\('woff'\))?/g, (m, file) => {
          fs.copyFileSync(path.join(dir, "files", file), path.join(dest, "assets/fonts", file));
          return `url(/assets/fonts/${file}) format('woff2')`;
        });
        css += c + "\n";
      }
    }
  }
  write(path.join(dest, "assets/fonts.css"), css);
}

/* ---------- gabarit ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NAV = [
  ["/livre-des-ombres/", "Livre des Ombres", "livre", true], ["/sorts/", "Sorts", "sorts"], ["/atelier/", "Atelier", "atelier"],
  ["/rituels/", "Rituels", "rituels"], ["/sabbats/", "Sabbats", "sabbats"], ["/outils/", "Outils", "outils"], ["/recettes/", "Recettes", "recettes"],
  ["/divination/", "Divination", "divination"], ["/correspondances/", "Correspondances", "correspondances"], ["/dossiers/", "Dossiers", "dossiers"], ["/histoire/", "Histoire", "histoire"],
  ["/figures/", "Figures", "figures"], ["/glossaire/", "Glossaire", "glossaire"],
];
const SECTION = { sort: "sorts", rituel: "rituels", sabbat: "sabbats", dossier: "dossiers" };
const MOONICON = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2Z" fill="none" stroke="#d9a95b" stroke-width="1.4"/><circle cx="18.5" cy="6" r="1" fill="#d9a95b"/></svg>`;
let VER = "1";
const GOATCOUNTER = "grimoire-endam";
const NEWSLETTER = "grimoiredeminuit"; // compte Buttondown (vide = formulaire masqué) // compte GoatCounter (vide = désactivé)
const ANALYTICS = GOATCOUNTER ? `<script data-goatcounter="https://${GOATCOUNTER}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : "";

function header(page) {
  const cur = SECTION[page] || page;
  return `<header class="topbar"><div class="topbar-in">
<a class="brand" href="/" aria-label="Le Grimoire de Minuit, accueil">${MOONICON}<span>Le Grimoire de Minuit</span></a>
<nav class="nav" aria-label="Sections">${NAV.map(([h, t, k, hl]) => `<a${hl ? ' class="hl"' : ""} href="${h}"${k === cur ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
</div></header>`;
}
function footer() {
  const col = (t, l) => `<div><h2>${t}</h2><ul>${l.map(([h, x]) => `<li><a href="${h}">${x}</a></li>`).join("")}</ul></div>`;
  return `<footer class="site-foot">
<div><a class="brand" href="/">${MOONICON}<span>Le Grimoire de Minuit</span></a><p>Un grimoire en ligne de sorcellerie : histoire, sorts, rituels et traditions, rassemblés et réécrits en français. Contenu à visée culturelle. Un projet <a href="https://endam-digital.com" style="color:var(--gold)">Endam Digital</a>.</p></div>
${col("Pratiquer", [["/livre-des-ombres/", "Livre des Ombres"], ["/sorts/", "Tous les sorts"], ["/atelier/", "Atelier du sorcier"], ["/rituels/", "Rituels"], ["/sabbats/", "Roue de l’année"]])}
${col("Savoir", [["/outils/", "Outils"], ["/recettes/", "Recettes"], ["/divination/", "Divination & tarot"], ["/correspondances/", "Correspondances"], ["/ingredients/", "Plantes & pierres"]])}
${col("Culture", [["/dossiers/", "Dossiers : Salem, vaudou"], ["/histoire/", "Histoire"], ["/figures/", "Figures"], ["/glossaire/", "Glossaire"], ["/a-propos/", "À propos & sources"], ["/mentions-legales/", "Mentions légales"]])}
</footer>`;
}
function crumbs(list) {
  return `<nav class="crumbs" aria-label="Fil d’Ariane">${list.map(([h, t], i) => (i ? '<span aria-hidden="true">›</span>' : "") + (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join("")}</nav>`;
}
function crumbsLD(list) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: list.map(([h, t], i) => ({ "@type": "ListItem", position: i + 1, name: t, item: SITE + (h || list.url) })) };
}
function head(num, title, intro) {
  return `<div class="chap-head"><p class="chap-num">${num}</p><div><h1>${title}</h1>${intro ? `<p>${intro}</p>` : ""}</div></div>`;
}
function shell({ url, page, id = "", title, desc, body, ld = [], type = "website" }) {
  const full = SITE + url;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${full}">
<meta name="theme-color" content="#15121d">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Le Grimoire de Minuit">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${full}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/fonts.css?v=${VER}">
<link rel="stylesheet" href="/assets/style.css?v=${VER}">
${ld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body data-page="${page}"${id ? ` data-id="${id}"` : ""}>
${header(page)}
<main class="wrap" id="haut">
${body}
${footer()}
</main>
<div class="toast" id="toast" hidden></div>
${ANALYTICS}
<script defer src="/assets/data.js?v=${VER}"></script>
<script defer src="/assets/app.js?v=${VER}"></script>
</body>
</html>`;
}

/* ---------- blocs réutilisés ---------- */
const RULES = `<div class="rules" aria-label="Les règles du grimoire">
<div><b>Ne nuis à personne</b><p>« Fais ce que tu veux, si tu ne nuis à personne. » C’est le Rede wiccan, popularisé par Doreen Valiente en 1964.</p></div>
<div><b>Le triple retour</b><p>Selon la tradition, ce que l’on envoie nous revient trois fois. Lance avec soin.</p></div>
<div><b>Le libre arbitre</b><p>On ne force jamais la volonté d’autrui. On agit sur soi, sur une situation, jamais sur le cœur d’un autre.</p></div>
<div><b>Le feu se surveille</b><p>Une bougie ne reste jamais seule. Les plantes toxiques ne se touchent pas. La magie ne remplace pas un médecin.</p></div></div>`;
const WARN = `<div class="warn" role="note"><span class="ico" aria-hidden="true">✠</span><div><h2 class="t4" style="color:var(--bone);font-family:var(--fell);font-size:20px;margin-bottom:6px">Précautions de la bonne sorcière</h2><ul>
<li>Ne laisse jamais une bougie, un fagot ou un charbon ardent sans surveillance. Garde un verre d’eau à portée de main.</li>
<li>Belladone, datura, mandragore, aconit, if et digitale entraient dans les légendaires « onguents de sorcière ». Ce sont des poisons mortels : ne les cueille pas, ne les ingère jamais.</li>
<li>Dilue toujours les huiles essentielles, et évite-les près des enfants, des femmes enceintes et des animaux. L’armoise est déconseillée pendant la grossesse.</li>
<li>La sauge blanche est surexploitée et sacrée pour plusieurs peuples autochtones d’Amérique. Le romarin, le laurier ou le thym la remplacent très bien.</li>
<li>Un rituel accompagne une démarche. Il ne remplace ni un médecin, ni un avocat, ni la police en cas de danger.</li></ul></div></div>`;
const CHAPWORD = { samhain: "rituel de Samhain et d’Halloween", protection: "sort de protection", purification: "sort de purification", liaison: "sort de liaison", amour: "sort d’amour", prosperite: "sort de prospérité", bienetre: "sort de bien-être", reves: "sort pour les rêves", divination: "divination", glamour: "sort de glamour", elements: "sort des éléments", lune: "magie lunaire", sceaux: "magie des sceaux" };
const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…");
const howto = (name, desc, supplies, steps, url) => ({ "@context": "https://schema.org", "@type": "HowTo", name, description: desc, inLanguage: "fr", url: SITE + url, supply: supplies.map((x) => ({ "@type": "HowToSupply", name: x })), step: steps.map((t, i) => ({ "@type": "HowToStep", position: i + 1, text: t })) });

/* ---------- pages ---------- */
const pages = [];
const add = (p) => pages.push(p);

add({ url: "/", page: "home", title: "Le Grimoire de Minuit — sorts, rituels et Livre des Ombres", desc: `Un grimoire de sorcellerie en français : ${SPELLS.length} sorts détaillés, ${RIT.length} rituels, les 8 sabbats, la lune du jour, le tarot, les correspondances et l’histoire des sorcières.`,
  ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: "Le Grimoire de Minuit", url: SITE + "/", inLanguage: "fr", description: "Grimoire de sorcellerie en ligne : sorts, rituels, sabbats et histoire." }],
  body: `<section class="hero">
<div><p class="label">Grimoire complet · histoire, rituels &amp; sortilèges</p>
<h1 style="margin-top:14px">Le Grimoire de Minuit<em>un Livre des Ombres à feuilleter, des bûchers d’hier aux sorcières d’aujourd’hui</em></h1>
<p class="lede">Des tablettes de liaison grecques aux bouteilles de sorcière enterrées sous les seuils anglais, du Petit Albert des colporteurs à la Wicca de Gerald Gardner, ce grimoire rassemble ce que les sorcières ont écrit, pratiqué et transmis. Ouvre le Livre des Ombres, compose tes sorts, trace ton cercle et suis la roue de l’année.</p>
<div class="hero-links"><a class="btn" href="/livre-des-ombres/">Ouvrir le Livre des Ombres</a><a class="btn ghost" href="/atelier/">Composer un sort</a><a class="btn ghost" href="/histoire/">Lire l’histoire</a></div>
<div class="hero-count" id="hero-count"></div></div>
<aside class="moon-card" aria-labelledby="moon-title"><p class="label"><span id="moon-title">La lune, ce soir</span><span id="moon-date"></span></p>
<div class="moon-fig"><svg id="moon-svg" viewBox="-4 -4 108 108" role="img" aria-label="Phase actuelle de la lune"></svg></div>
<p class="moon-name" id="moon-name"></p><p class="moon-meta" id="moon-meta"></p><p class="moon-advice" id="moon-advice"></p><div class="tonight" id="tonight" aria-label="Sorts conseillés ce soir"></div></aside>
</section>
<section class="chap"><div class="chap-head"><p class="chap-num">Le Livre</p><div><h2>Treize chapitres de sorts</h2><p>Chaque sort a sa page : le moment, les ingrédients, le rituel pas à pas, l’incantation, les variantes et son histoire.</p></div></div>
<div class="body-col"><div class="chapcards" id="chapcards"></div><div class="cta-line"><a class="btn" href="/livre-des-ombres/">Feuilleter le livre</a><a class="btn ghost" href="/sorts/">Voir tous les sorts</a></div></div></section>
${fig(IMGPLACE.home, "plate wide")}
<section class="chap"><div class="body-col" style="margin-left:0"><div class="sabteaser" id="sabteaser"></div></div></section>
${NL()}
<section class="chap" style="border-bottom:0"><div class="chap-head"><p class="chap-num">Explorer</p><div><h2>Tout le grimoire</h2></div></div>
<div class="body-col"><div class="explore">
<a href="/atelier/"><b>L’atelier</b><span>Générateur de sorts et forge à sigils</span></a>
<a href="/rituels/"><b>Les rituels</b><span>Cercle, autel, dédicace, esbat…</span></a>
<a href="/sabbats/"><b>Les sabbats</b><span>La roue de l’année et ses huit fêtes</span></a>
<a href="/divination/"><b>La divination</b><span>Tarot, flamme, cire et feuilles de thé</span></a>
<a href="/correspondances/"><b>Les correspondances</b><span>Jours, couleurs, plantes, pierres, lunes</span></a>
<a href="/recettes/"><b>Les recettes</b><span>Sel noir, eau de lune, encens, huiles</span></a>
<a href="/dossiers/"><b>Les dossiers</b><span>Les sorcières de Salem, le vaudou</span></a>
<a href="/histoire/"><b>L’histoire</b><span>Quatre mille ans de magie et de procès</span></a>
<a href="/figures/"><b>Les figures</b><span>De Circé à Doreen Valiente</span></a>
</div></div></section>` });

add({ url: "/livre-des-ombres/", page: "livre", title: "Le Livre des Ombres — grimoire de sorts à feuilleter | Le Grimoire de Minuit", desc: `Feuillette un Livre des Ombres de ${SPELLS.length} sorts : protection, amour, prospérité, bannissement, divination, magie lunaire. Recherche par ingrédient, lune ou niveau.`,
  body: `<section class="chap first" id="livre" style="border-bottom:0">
${head("Le Livre", "Le Livre des Ombres", "Treize chapitres, près de soixante sorts tirés de la magie populaire européenne, de la Wicca et de la sorcellerie moderne américaine. Feuillette-le page par page, ou cherche dans l’index.")}
${RULES}
<div class="bookbar">
<input id="q" type="search" placeholder="Chercher un sort, un ingrédient…" aria-label="Chercher dans le Livre des Ombres">
<select id="f-moon" aria-label="Filtrer par lune"><option value="">Toutes les lunes</option><option value="nouvelle">Nouvelle lune</option><option value="croissante">Lune croissante</option><option value="pleine">Pleine lune</option><option value="décroissante">Lune décroissante</option></select>
<select id="f-lvl" aria-label="Filtrer par niveau"><option value="">Tous niveaux</option><option value="1">Novice</option><option value="2">Initiée</option><option value="3">Adepte</option></select>
<div class="seg" role="group" aria-label="Affichage"><button type="button" id="v-book" aria-pressed="true">Feuilleter</button><button type="button" id="v-idx" aria-pressed="false">Index</button></div>
<span class="bookcount" id="bookcount"></span></div>
<div id="bookview"><div class="book-stage"><div class="tabs" id="tabs" aria-label="Chapitres du livre"></div>
<div class="book" id="book" tabindex="0" aria-label="Livre des Ombres, utilise les flèches pour tourner les pages"><div class="ribbon" aria-hidden="true"></div><div class="spread" id="spread" aria-live="polite"></div></div></div>
<div class="booknav"><button class="btn ghost small" type="button" id="prev">← Page précédente</button><span class="pos" id="pos"></span><button class="btn small" type="button" id="next">Page suivante →</button></div></div>
<div id="idxview" hidden></div></section>` });

add({ url: "/sorts/", page: "sorts", title: `Tous les sorts de sorcellerie (${SPELLS.length}) — index par chapitre | Le Grimoire de Minuit`, desc: `Index des ${SPELLS.length} sorts du Livre des Ombres : protection, purification, liens, amour, prospérité, bien-être, rêves, divination, glamour, éléments, lune et sceaux.`,
  ld: [crumbsLD(Object.assign([["/", "Accueil"], ["/sorts/", "Sorts"]], { url: "/sorts/" }))],
  body: `${crumbs([["/", "Accueil"], [null, "Sorts"]])}<section class="chap first" style="border-bottom:0">${head("Les Sorts", "Tous les sorts du grimoire", "Choisis un chapitre, puis un sort. Chaque page détaille le moment idéal, les ingrédients, le rituel pas à pas, l’incantation et l’histoire du sort.")}
${RULES}<div class="idx" id="spell-index"></div></section>` });

for (const s of ORDER) {
  const c = CH[s.ch], url = `/sorts/${s.slug}/`;
  const desc = clip(`${s.sub}. ${s.n} : ingrédients, rituel pas à pas, incantation, variantes et histoire. Lune ${s.moon.toLowerCase()}, ${s.day.toLowerCase()}.`);
  const cr = [["/", "Accueil"], ["/sorts/", "Sorts"], [`/sorts/#${c.id}`, c.n], [null, s.n]];
  add({ url, page: "sort", id: s.id, type: "article", title: `${s.n} — ${CHAPWORD[s.ch]} | Le Grimoire de Minuit`, desc,
    ld: [howto(s.n, s.sub, s.ing, s.steps, url), crumbsLD(Object.assign(cr.slice(0, 3).concat([[url, s.n]]), { url }))],
    body: `${crumbs(cr)}<section class="chap first" style="border-bottom:0">
<div class="book-stage solo"><div class="book"><div class="ribbon" aria-hidden="true"></div><div class="spread" id="spread"></div></div></div>
<div class="prevnext" id="prevnext"></div>
<div class="related"><h2 class="t26" id="related-t" style="font-size:26px;margin-bottom:16px"></h2><div class="linkgrid" id="related"></div></div>
${(INGBYSPELL[s.id] || []).length ? `<div class="related"><h2 class="t26" style="font-size:26px;margin-bottom:14px">Les ingrédients de ce sort</h2><div class="ingchips">${INGBYSPELL[s.id].map((i) => `<a href="/ingredients/${i.slug}/">${esc(i.n)}</a>`).join("")}</div></div>` : ""}
<div class="cta-line"><a class="btn" href="/livre-des-ombres/#sort-${s.id}">Ouvrir dans le Livre des Ombres</a><a class="btn ghost" href="/atelier/">Composer mon propre sort</a></div>${NL()}</section>` });
}

add({ url: "/atelier/", page: "atelier", title: "Générateur de sorts et forge à sigils | Le Grimoire de Minuit", desc: "Compose ton propre sort selon les correspondances traditionnelles (lune, jour, couleur, herbes, pierres) et crée ton sigil avec la méthode d’Austin Osman Spare.",
  body: `${crumbs([["/", "Accueil"], [null, "Atelier"]])}<section class="chap first" style="border-bottom:0">${head("L’Atelier", "L’atelier du sorcier", "Quand tu connais les règles, tu peux écrire tes propres sorts. Un générateur assemble les correspondances traditionnelles, et une forge transforme une phrase en sigil.")}
<div class="body-col"><div class="forge"><div><p class="label">Générateur</p><h2 style="font-size:34px;margin-top:6px">Compose ton sort</h2><p class="intro">Choisis une intention et un geste. Le grimoire rassemble le moment, la couleur, les herbes et la pierre, puis écrit la formule.</p>
<div class="field"><label class="label" for="f-name">Ton prénom (facultatif)</label><input id="f-name" type="text" placeholder="ex. Cédric" maxlength="40" autocomplete="off"></div>
<div class="field"><span class="label" id="lbl-int">Intention</span><div class="chips" id="chips-int" role="group" aria-labelledby="lbl-int"></div></div>
<div class="field"><span class="label" id="lbl-form">Geste</span><div class="chips" id="chips-form" role="group" aria-labelledby="lbl-form"></div></div></div>
<div><article class="recipe" id="recipe" aria-live="polite"></article><div class="actions"><button class="btn" type="button" id="copy-spell">Copier le sort</button></div></div></div>
<div class="sigil"><div><p class="label">Méthode d’Austin Osman Spare</p><h2 class="sub" style="font-size:30px;margin-top:6px;margin-bottom:12px">La forge à sigils</h2>
<p class="subintro" style="margin:0">Écris ton intention au présent et en positif. La forge retire les voyelles et les lettres en double, puis relie les lettres restantes sur la roue de l’alphabet. Recopie le sigil à la main, charge-le, puis brûle-le et oublie-le. <a href="/sorts/sigil/">Lire le sort du sigil</a>.</p>
<div class="field"><label class="label" for="sig-in">Ton intention</label><input id="sig-in" type="text" value="Je suis serein et confiant" maxlength="80" autocomplete="off"></div><div class="sigil-steps" id="sig-steps"></div></div>
<div class="sigil-out"><svg id="sig-svg" viewBox="0 0 400 400" role="img" aria-label="Sigil généré"></svg></div></div></div></section>` });

add({ url: "/rituels/", page: "rituels", title: `Rituels de sorcellerie pas à pas (${RIT.length}) | Le Grimoire de Minuit`, desc: "Monter son autel, tracer le cercle, auto-dédicace, consacrer ses outils, esbat de pleine lune, gâteaux et vin, bénir une maison : les rituels fondamentaux, étape par étape.",
  body: `${crumbs([["/", "Accueil"], [null, "Rituels"]])}<section class="chap first" style="border-bottom:0">${head("Les Rituels", "Rituels, pas à pas", "Les sorts ont besoin d’un cadre. Voici les rituels fondamentaux de la sorcellerie moderne, avec le matériel, chaque étape et les paroles à dire.")}<div class="body-col">${fig(IMGPLACE.rituels)}<div class="linkgrid" id="rit-index"></div></div></section>` });
for (const r of RIT) {
  const url = `/rituels/${r.slug}/`, cr = [["/", "Accueil"], ["/rituels/", "Rituels"], [null, r.n]];
  add({ url, page: "rituel", id: r.id, type: "article", title: `${r.n} — rituel de sorcellerie pas à pas | Le Grimoire de Minuit`, desc: clip(r.intro),
    ld: [howto(r.n, r.intro, r.kit, r.steps.map((s) => s[0] + " : " + s[1] + (s[2] ? " « " + s[2] + " »" : "")), url), crumbsLD(Object.assign([["/", "Accueil"], ["/rituels/", "Rituels"], [url, r.n]], { url }))],
    body: `${crumbs(cr)}<section class="chap first" style="border-bottom:0"><div id="rit-panel"></div><div class="prevnext" id="prevnext" style="margin-top:48px"></div><div class="cta-line"><a class="btn ghost" href="/rituels/">Tous les rituels</a><a class="btn ghost" href="/livre-des-ombres/">Le Livre des Ombres</a></div></section>` });
}

add({ url: "/sabbats/", page: "sabbats", title: "La roue de l’année : les 8 sabbats des sorcières | Le Grimoire de Minuit", desc: "Samhain, Yule, Imbolc, Ostara, Beltane, Litha, Lughnasadh et Mabon : dates, histoire, correspondances, rituels et recettes des huit sabbats de la roue de l’année.",
  body: `${crumbs([["/", "Accueil"], [null, "Sabbats"]])}<section class="chap first" style="border-bottom:0">${head("Les Sabbats", "La roue de l’année", "Huit fêtes rythment l’année des sorcières : les solstices et équinoxes, et les quatre grandes fêtes celtiques entre eux. Le trait doré marque aujourd’hui (dates de l’hémisphère nord).")}
<div class="wheel-grid body-col"><div class="wheel" id="wheel"><svg viewBox="0 0 400 400" aria-hidden="true" id="wheel-svg"></svg><div class="wheel-center"><div><span class="label">Aujourd’hui</span><b id="today-label"></b></div></div></div><div class="sab-detail" id="sab-detail" aria-live="polite"></div></div>
<div class="body-col"><nav class="sabrow" id="sabrow" aria-label="Les huit sabbats"></nav>${fig(IMGPLACE.sabbats)}</div></section>` });
for (const sb of SAB) {
  const url = `/sabbats/${sb.slug}/`;
  add({ url, page: "sabbat", id: sb.id, type: "article", title: sb.more ? `${sb.n} 2026 : rituels de la nuit du 31 octobre, sorts et histoire d’Halloween | Le Grimoire de Minuit` : `${sb.n} (${sb.when.replace(/ · .*/, "")}) — histoire, rituels et recette | Le Grimoire de Minuit`, desc: sb.more ? "Comment célébrer Samhain le 31 octobre : la nuit heure par heure, 8 sorts traditionnels (bougie à la fenêtre, repas muet, noix dans le feu, miroir de minuit), l’histoire d’Halloween et les recettes." : clip(`${sb.n}, ${sb.alias.toLowerCase()} : ${sb.t[0]}`),
    ld: [{ "@context": "https://schema.org", "@type": "Article", headline: `${sb.n} : histoire, correspondances et rituels`, inLanguage: "fr", url: SITE + url, image: SITE + "/assets/og.png", author: { "@type": "Organization", name: "Endam Digital" } }, crumbsLD(Object.assign([["/", "Accueil"], ["/sabbats/", "Sabbats"], [url, sb.n]], { url }))],
    body: `${crumbs([["/", "Accueil"], ["/sabbats/", "Sabbats"], [null, sb.n]])}<section class="chap first" style="border-bottom:0"><div class="body-col" style="margin-left:0;max-width:900px"><div class="sab-detail solo" id="sab-detail"></div><nav class="sabrow" id="sabrow" aria-label="Les huit sabbats"></nav></div>${NL()}</section>` });
}

const simple = (url, page, crumb, title, desc, inner) => add({ url, page, title, desc, body: `${crumbs([["/", "Accueil"], [null, crumb]])}<section class="chap first" style="border-bottom:0">${inner}</section>` });
simple("/outils/", "outils", "Outils", "Les outils de la sorcière : athamé, baguette, chaudron… | Le Grimoire de Minuit", "Athamé, baguette, calice, pentacle, chaudron, balai, boline, bougies, Livre des Ombres : rôle, élément et alternative bon marché pour chaque outil de sorcellerie.",
  `${head("Les Outils", "Les outils de la sorcière", "La plupart viennent des grimoires de magie cérémonielle de la Renaissance, comme la Clavicule de Salomon, repris par Gerald Gardner. Aucun n’est obligatoire.")}<div class="cards body-col" id="tools"></div>`);
simple("/recettes/", "recettes", "Recettes", "Recettes de sorcière : sel noir, eau de lune, encens, huiles | Le Grimoire de Minuit", "Sel noir, eau de lune, eau solaire, encens de protection, huiles magiques, eau de rose, vinaigre des quatre voleurs : les préparations de base du grimoire.",
  `${head("L’Officine", "Recettes du grimoire", "Sels, eaux, encens et huiles : les préparations de base qu’on garde en réserve, dans des bocaux étiquetés et datés.")}<div class="recs body-col" id="recs"></div>`);
simple("/divination/", "divination", "Divination", "Divination : tirage de tarot, flamme, cire et feuilles de thé | Le Grimoire de Minuit", "Tire trois cartes du tarot de Marseille, découvre les 22 arcanes majeurs, le langage de la flamme des bougies et le dictionnaire des formes pour lire le thé et la cire.",
  `${head("La Divination", "Lire les signes", "Le tarot, la flamme, la cire, les feuilles de thé. Pose une question claire, respire, et laisse venir la première impression.")}
<div class="body-col"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Tirage des trois cartes</h2><p class="subintro">Pense à ta question, puis tire trois arcanes majeurs du tarot de Marseille : le passé, le présent, l’avenir. Une carte renversée nuance ou retourne son sens.</p>
<div class="actions" style="margin-bottom:22px"><button class="btn" type="button" id="draw">Tirer les cartes</button></div><div class="tarot" id="tarot"></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les vingt-deux arcanes majeurs</h2><div class="arcana" id="arcana"></div></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Le langage de la flamme</h2><p class="subintro">Pendant un sort de bougie, les sorcières observent la flamme, la fumée et la cire. Vérifie d’abord qu’il n’y a ni courant d’air ni mèche trop longue.</p><div class="tbl-wrap"><table><thead><tr><th>Signe</th><th>Ce qu’on y lit</th></tr></thead><tbody id="candle"></tbody></table></div></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Dictionnaire des formes</h2><p class="subintro">Pour lire les feuilles de thé, le marc de café ou la cire figée dans l’eau froide. Voir aussi <a href="/sorts/tasse-de-the/">la tasse de thé</a> et <a href="/sorts/ceromancie/">la céromancie</a>.</p><div class="symgrid" id="symbols"></div></div></div>`);
simple("/correspondances/", "correspondances", "Correspondances", "Tables de correspondances magiques : jours, couleurs, plantes, pierres | Le Grimoire de Minuit", "Les correspondances de la sorcellerie : jours et planètes, éléments, couleurs des bougies, 30 plantes, 24 pierres, phases de la lune et pleines lunes de l’année.",
  `${head("Les Tables", "Tables de correspondances", "Le français garde la trace des planètes : lundi est le jour de la Lune, mardi de Mars, mercredi de Mercure, jeudi de Jupiter, vendredi de Vénus. Ces correspondances anciennes sont la grammaire de tous les sorts.")}
<div class="body-col"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les jours et les astres</h2><div class="tbl-wrap"><table><thead><tr><th>Jour</th><th>Astre</th><th>Couleurs</th><th>Pour…</th><th>Pierre</th></tr></thead><tbody id="days"></tbody></table></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les éléments</h2><p class="subintro">Au XVIᵉ siècle, le médecin Paracelse leur associe des esprits : gnomes, sylphes, salamandres et ondines.</p><div class="tbl-wrap"><table><thead><tr><th>Élément</th><th>Direction</th><th>Saison</th><th>Outils</th><th>Signes</th><th>Pour…</th><th>Esprits</th></tr></thead><tbody id="elements"></tbody></table></div></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les couleurs des bougies</h2><div class="swatches" id="colors"></div></div>
<div class="block corr-grid"><div><h2 class="sub" style="font-size:30px;margin-bottom:22px">L’herbier</h2><dl class="herb" id="herbs"></dl></div><div><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les pierres</h2><dl class="herb" id="stones"></dl></div></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les phases de la lune</h2><div class="phases" id="phases"></div></div>
<div class="block"><h2 class="sub" style="font-size:30px;margin-bottom:22px">Les pleines lunes de l’année</h2><p class="subintro">Les noms traditionnels de l’almanach nord-américain, que les sorcières utilisent pour leurs esbats.</p><div class="moons" id="moons"></div></div></div>`);
simple("/histoire/", "histoire", "Histoire", "Histoire de la sorcellerie : de l’Antiquité à la Wicca | Le Grimoire de Minuit", "Code d’Hammurabi, Malleus Maleficarum, procès de North Berwick, Pendle, Salem, affaire des poisons, Anna Göldi, Gerald Gardner : quatre mille ans d’histoire de la sorcellerie.",
  `${head("L’Histoire", "Une histoire de la sorcellerie", "Quatre mille ans de magie, de peur et de renouveau. Pendant des siècles, la sorcière a été à la fois une guérisseuse de village, une figure de légende et une accusée.")}
<div class="body-col"><div class="stat-row" aria-label="La chasse aux sorcières en chiffres"><div class="stat"><b>≈ 1450–1750</b><span>les trois siècles des grands procès en Europe</span></div><div class="stat"><b>40 à 60 000</b><span>exécutions selon les estimations d’historiens les plus citées</span></div><div class="stat"><b>≈ 80 %</b><span>de femmes parmi les personnes condamnées</span></div></div><div id="eras"></div></div>`);
simple("/figures/", "figures", "Figures", "Sorcières célèbres : mythes, accusées et fondatrices | Le Grimoire de Minuit", "Hécate, Circé, Baba Yaga, Morgane, Agnes Sampson, La Voisin, Tituba, Marie Laveau, Gerald Gardner, Doreen Valiente, Starhawk : les grandes figures de la sorcellerie.",
  `${head("Les Figures", "Magiciennes, accusées &amp; fondatrices", "Des déesses et héroïnes des mythes, des femmes bien réelles jugées pour sorcellerie, et celles et ceux qui ont fait renaître la sorcellerie au XXᵉ siècle.")}<div class="body-col"><div class="tabrow" id="fig-tabs" role="group" aria-label="Filtrer les figures"></div><div class="cards" id="figs"></div></div>`);
simple("/glossaire/", "glossaire", "Glossaire", "Glossaire de la sorcellerie : athamé, esbat, sigil, coven… | Le Grimoire de Minuit", "Les mots de la sorcellerie expliqués simplement : athamé, besom, coven, deosil, esbat, handfasting, pentacle, Rede, sabbat, sigil, skyclad, widdershins et bien d’autres.",
  `${head("Le Glossaire", "Les mots du métier", "Pour lire les vieux grimoires comme les livres modernes, en français comme en anglais.")}<dl class="gloss body-col" id="gloss"></dl>`);
simple("/a-propos/", "apropos", "À propos", "À propos et sources | Le Grimoire de Minuit", "Le Grimoire de Minuit rassemble et réécrit en français des sources historiques et des pratiques de la sorcellerie moderne. Précautions et liste des sources.",
  `${head("À propos", "À propos du grimoire", "")}<div class="body-col about"><p>Le Grimoire de Minuit est un projet d’<a href="https://endam-digital.com">Endam Digital</a>. Il rassemble l’histoire de la sorcellerie européenne, les pratiques de la sorcellerie moderne (Wicca, sorcellerie solitaire, magie populaire) et les traditions qui les nourrissent, réécrites en français à partir de sources historiques et de sites de référence français et américains.</p><p>Les rituels et les sorts relèvent de traditions et de croyances. Ils sont présentés pour leur intérêt culturel, historique et personnel, sans prétention scientifique.</p>
<div style="margin-block:36px">${WARN}</div><h2 class="sub" style="font-size:30px;margin-bottom:22px">Sources</h2><ul class="sources" id="sources-list"></ul></div>`);


/* ---------- dossiers ---------- */
function block(bk) {
  if (bk.p) return `<p>${esc(bk.p)}</p>`;
  if (bk.note) return `<aside class="dnote">${esc(bk.note)}</aside>`;
  if (bk.quote) return `<blockquote class="dquote"><p>« ${esc(bk.quote)} »</p><cite>${esc(bk.by)}</cite></blockquote>`;
  if (bk.timeline) return `<ol class="timeline dtl">${bk.timeline.map((x) => `<li><span class="yr">${esc(x[0])}</span><div><h3 class="t21">${esc(x[1])}</h3><p>${esc(x[2])}</p></div></li>`).join("")}</ol>`;
  if (bk.people) return `<div class="people">${bk.people.map((x) => `<div class="person"><p class="label">${esc(x[1])} 1692</p><h3>${esc(x[0])}</h3><p>${esc(x[2])}</p></div>`).join("")}</div>`;
  if (bk.cards) return `<div class="dcards">${bk.cards.map((x) => `<div class="dcard"><h3>${esc(x[0])}</h3><p class="dsub">${esc(x[1])}</p><p>${esc(x[2])}</p></div>`).join("")}</div>`;
  return "";
}
add({ url: "/dossiers/", page: "dossiers", title: "Dossiers : les sorcières de Salem, le vaudou | Le Grimoire de Minuit", desc: "Les grands dossiers du Grimoire de Minuit : l’affaire des sorcières de Salem en 1692 et le vaudou, du Bénin à Haïti et à La Nouvelle-Orléans.",
  body: `${crumbs([["/", "Accueil"], [null, "Dossiers"]])}<section class="chap first" style="border-bottom:0">${head("Les Dossiers", "Les grands dossiers", "Des enquêtes longues pour comprendre les affaires et les traditions qui ont façonné l’image de la sorcière.")}
<div class="body-col dlist">${DOSSIERS.map((d) => `<a class="dteaser" href="/dossiers/${d.slug}/"><p class="label">${esc(d.kicker)}</p><h2>${esc(d.n)}</h2><p>${esc(d.dek)}</p><span class="btn small">Lire le dossier →</span></a>`).join("")}</div></section>` });
for (const d of DOSSIERS) {
  const url = `/dossiers/${d.slug}/`, other = DOSSIERS.filter((x) => x !== d);
  add({ url, page: "dossier", id: d.slug, type: "article", title: `${d.title} | Le Grimoire de Minuit`, desc: d.desc,
    ld: [{ "@context": "https://schema.org", "@type": "Article", headline: d.n, description: d.desc, inLanguage: "fr", url: SITE + url, image: SITE + "/assets/og.png", author: { "@type": "Organization", name: "Endam Digital" }, publisher: { "@type": "Organization", name: "Le Grimoire de Minuit" } }, crumbsLD(Object.assign([["/", "Accueil"], ["/dossiers/", "Dossiers"], [url, d.n]], { url }))],
    body: `${crumbs([["/", "Accueil"], ["/dossiers/", "Dossiers"], [null, d.n]])}
<article class="dossier">
<header class="dhead"><p class="label">${esc(d.kicker)}</p><h1>${esc(d.n)}</h1><p class="dek">${esc(d.dek)}</p></header>
<div class="stat-row dfacts">${d.facts.map((f) => `<div class="stat"><b>${esc(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>
<div class="dgrid">
<nav class="dtoc" aria-label="Sommaire"><p class="label">Sommaire</p><ol>${d.sections.map((s) => `<li><a href="#${s.id}">${esc(s.h)}</a></li>`).join("")}</ol></nav>
<div class="dbody"><p class="dlede">${esc(d.lede)}</p>
${fig(((IMGPLACE.dossier || {})[d.slug] || [])[0])}
${d.sections.map((s, i) => `${i === 3 ? fig(((IMGPLACE.dossier || {})[d.slug] || [])[1]) : ""}<section class="dsec" id="${s.id}"><h2>${esc(s.h)}</h2>${s.body.map(block).join("\n")}</section>`).join("\n")}
<section class="dsec"><h2>Sources</h2><ul class="sources" style="columns:1">${d.sources.map((x) => `<li><a href="${x[1]}" target="_blank" rel="noopener">${esc(x[0])}</a> — ${esc(x[2])}</li>`).join("")}</ul></section>
<div class="cta-line">${other.map((o) => `<a class="btn" href="/dossiers/${o.slug}/">Lire aussi : ${esc(o.n)}</a>`).join("")}<a class="btn ghost" href="/histoire/">L’histoire de la sorcellerie</a></div>
</div></div></article>` });
}


/* ---------- lettre d'information ---------- */
function NL() {
  if (!NEWSLETTER) return "";
  return `<section class="nl" aria-labelledby="nl-t"><div><p class="label">Lettre du samedi</p><h2 id="nl-t">Un sort chaque samedi, dans ta boîte mail</h2><p>Un sort, une légende et la lune de la semaine. Gratuit, sans publicité, désinscription en un clic.</p></div>
<form action="https://buttondown.com/api/emails/embed-subscribe/${NEWSLETTER}" method="post" target="_blank" class="nl-form"><label class="label" for="nl-mail">Ton adresse e-mail</label><div><input id="nl-mail" type="email" name="email" required placeholder="sorciere@exemple.fr" autocomplete="email"><button class="btn" type="submit">Je m’abonne</button></div><p class="nl-legal">Adresse utilisée uniquement pour la lettre, via Buttondown. <a href="/mentions-legales/">Données personnelles</a>.</p></form></section>`;
}

/* ---------- ingrédients ---------- */
const ITYPES = [["Plantes & épices", ["Plante", "Épice", "Fruit", "Produit"]], ["Pierres", ["Pierre"]], ["Minéraux & outils", ["Minéral", "Outil"]]];
add({ url: "/ingredients/", page: "ingredients", title: "Plantes, pierres et ingrédients de sorcellerie : usages et sorts | Le Grimoire de Minuit", desc: "Romarin, lavande, laurier, sel, cannelle, armoise, améthyste, quartz rose, tourmaline noire… Usages magiques, histoire et tous les sorts du grimoire qui utilisent chaque ingrédient.",
  body: `${crumbs([["/", "Accueil"], [null, "Plantes & pierres"]])}<section class="chap first" style="border-bottom:0">${head("L’Herbier", "Plantes, pierres &amp; ingrédients", "Les ingrédients les plus utilisés du grimoire : leurs correspondances, leur histoire, et tous les sorts où ils apparaissent.")}
<div class="body-col">${ITYPES.map(([lab, ts]) => `<h2 class="sub" style="font-size:30px;margin:40px 0 18px">${lab}</h2><div class="linkgrid">${INGREDIENTS.filter((i) => ts.includes(i.t)).map((i) => `<a class="lcard" href="/ingredients/${i.slug}/"><b>${esc(i.n)}</b><span>${esc(i.use)}</span><em>${i.spells.length} sort${i.spells.length > 1 ? "s" : ""}${i.el ? " · " + esc(i.el) : ""}</em></a>`).join("")}</div>`).join("")}</div></section>` });
for (const i of INGREDIENTS) {
  const url = `/ingredients/${i.slug}/`;
  add({ url, page: "ingredient", id: i.slug, type: "article", title: `${i.n} en sorcellerie : usages magiques et sorts | Le Grimoire de Minuit`, desc: clip(`${i.n} en magie : ${i.use.toLowerCase()} ${i.h[0]}`),
    ld: [crumbsLD(Object.assign([["/", "Accueil"], ["/ingredients/", "Plantes & pierres"], [url, i.n]], { url }))],
    body: `${crumbs([["/", "Accueil"], ["/ingredients/", "Plantes & pierres"], [null, i.n]])}<section class="chap first" style="border-bottom:0">
<div class="chap-head"><p class="chap-num">${esc(i.t)}</p><div><h1>${esc(i.n)}</h1>${i.lat ? `<p class="dek" style="margin-top:6px">${esc(i.lat)}</p>` : ""}</div></div>
<div class="body-col"><div class="corr ingcorr"><div><span class="label">Usages magiques</span>${esc(i.use)}</div><div><span class="label">Élément</span>${esc(i.el || "—")}</div><div><span class="label">Astre</span>${esc(i.pl || "—")}</div></div>
<div class="dbody" style="margin-top:28px">${i.h.map((p) => `<p class="ingp">${esc(p)}</p>`).join("")}${i.warn ? `<aside class="dnote"><b>Attention.</b> ${esc(i.warn)}</aside>` : ""}</div>
<h2 class="sub" style="font-size:30px;margin:48px 0 18px">${i.spells.length ? `Les ${i.spells.length} sort${i.spells.length > 1 ? "s" : ""} du grimoire avec ${i.t === "Pierre" ? "la pierre" : "l’ingrédient"} « ${esc(i.n.toLowerCase())} »` : "Dans le grimoire"}</h2>
${i.spells.length ? `<div class="linkgrid">${i.spells.map((s) => `<a class="lcard" href="/sorts/${s.slug}/"><b>${esc(s.n)}</b><span>${esc(s.sub)}</span><em>${esc(CH[s.ch].n)}</em></a>`).join("")}</div>` : `<p class="subintro">Aucun sort n’utilise encore cet ingrédient.</p>`}
${i.recipes.length ? `<h2 class="sub" style="font-size:30px;margin:48px 0 18px">Recettes</h2><div class="linkgrid">${i.recipes.map((r) => `<a class="lcard" href="/recettes/"><b>${esc(r.n)}</b><span>${esc(r.u)}</span><em>${esc(r.c)}</em></a>`).join("")}</div>` : ""}
<div class="cta-line"><a class="btn ghost" href="/ingredients/">Tous les ingrédients</a><a class="btn ghost" href="/correspondances/">Tables de correspondances</a></div></div></section>` });
}

/* ---------- mentions légales ---------- */
add({ url: "/mentions-legales/", page: "legal", title: "Mentions légales | Le Grimoire de Minuit", desc: "Mentions légales, hébergement, statistiques et données personnelles du site Le Grimoire de Minuit.",
  body: `${crumbs([["/", "Accueil"], [null, "Mentions légales"]])}<section class="chap first" style="border-bottom:0">${head("Mentions", "Mentions légales", "")}
<div class="body-col dbody legal">
<h2>Éditeur</h2><p>Le site <b>grimoire.endam-digital.com</b> est un projet personnel et non commercial publié sous la marque <b>Endam Digital</b>. Conformément à l’article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique, l’éditeur, qui agit à titre non professionnel, a choisi de ne pas publier ses coordonnées personnelles ; son identité a été communiquée à l’hébergeur.</p>
<p>Contact : par le <a href="https://github.com/Endam-creator/Grimoire/issues" target="_blank" rel="noopener">formulaire de signalement du dépôt GitHub</a> du site.</p>
<h2>Hébergement</h2><p>GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. <a href="https://github.com" target="_blank" rel="noopener">github.com</a></p>
<h2>Statistiques de visite</h2><p>Le site mesure sa fréquentation avec <b>GoatCounter</b>, un outil qui ne dépose aucun cookie, n’enregistre pas d’adresse IP complète et ne suit pas les visiteurs d’un site à l’autre. Aucune bannière de consentement n’est donc nécessaire.</p>
<h2>Lettre d’information</h2><p>Si tu t’abonnes à la lettre du samedi, ton adresse e-mail est conservée par le service <b>Buttondown</b> uniquement pour t’envoyer la lettre. Tu peux te désabonner à tout moment par le lien présent dans chaque envoi. Conformément au RGPD, tu peux demander l’accès à tes données ou leur suppression en écrivant par le contact ci-dessus.</p>
<h2>Polices et ressources</h2><p>Les polices de caractères sont hébergées sur le site lui-même : aucune donnée n’est transmise à un service tiers comme Google Fonts lors de la consultation.</p>
<h2>Propriété intellectuelle</h2><p>Les textes du site sont rédigés pour Le Grimoire de Minuit à partir des sources citées sur la page <a href="/a-propos/">À propos</a>. Les illustrations sont des œuvres du domaine public, reproduites depuis Wikimedia Commons ; leurs références sont indiquées sous chaque image.</p>
<h2>Avertissement</h2><p>Les contenus du site ont une visée culturelle, historique et récréative. Les rituels et les sorts relèvent de traditions et de croyances et ne remplacent en aucun cas un avis médical, juridique ou psychologique.</p>
</div></section>` });

add({ url: "/404.html", page: "404", title: "Page introuvable | Le Grimoire de Minuit", desc: "Cette page s’est évaporée comme une fumée d’encens.", noindex: true,
  body: `<section class="lost"><p class="label">Erreur 404</p><h1>Cette page s’est évaporée</h1><p>Comme une fumée d’encens, la page que tu cherches a disparu. Le sort a peut-être été déplacé dans un autre chapitre.</p><div class="hero-links" style="justify-content:center"><a class="btn" href="/">Retour à l’accueil</a><a class="btn ghost" href="/sorts/">Tous les sorts</a></div></section>` });

/* ---------- écriture ---------- */
rm(RAW); rm(OUT); mk(RAW);
const appSrc = fs.readFileSync(path.join(ROOT, "src/app.js"), "utf8");
const styleSrc = fs.readFileSync(path.join(ROOT, "assets/style.css"), "utf8");
VER = crypto.createHash("md5").update(dataSrc + appSrc + styleSrc).digest("hex").slice(0, 8);
buildFonts(RAW);
await writeImages(RAW);
write(path.join(RAW, "assets/data.js"), dataSrc + "\nwindow.IMG=" + JSON.stringify(IMGPUB) + ";\nwindow.INGLINK=" + JSON.stringify(Object.fromEntries(INGREDIENTS.map((i) => [nrm(i.n), i.slug]))) + ";");
write(path.join(RAW, "assets/app.js"), appSrc);
write(path.join(RAW, "assets/style.css"), styleSrc);
const esb = require("esbuild");
for (const f of ["assets/app.js", "assets/data.js", "assets/style.css"]) { const p = path.join(RAW, f); const r = await esb.transform(fs.readFileSync(p, "utf8"), { loader: f.endsWith(".css") ? "css" : "js", minify: true, charset: "utf8" }); fs.writeFileSync(p, r.code); }
for (const p of pages) {
  let html = shell(p);
  if (p.noindex) html = html.replace("<link rel=\"canonical\"", '<meta name="robots" content="noindex">\n<link rel="canonical"');
  const file = p.url.endsWith(".html") ? p.url : p.url + "index.html";
  write(path.join(RAW, file), html);
}

/* ---------- pré-rendu ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (u.endsWith("/")) u += "index.html";
  const f = path.join(RAW, u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(fs.readFileSync(path.join(RAW, "404.html"))); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(4173, r));
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(path.join(process.env.NODE_PATH || "", "playwright"))); }
const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const errors = [];
fs.cpSync(RAW, OUT, { recursive: true });
for (const p of pages) {
  const pg = await ctxB.newPage();
  pg.on("pageerror", (e) => errors.push(p.url + " : " + e.message));
  await pg.goto("http://localhost:4173" + p.url, { waitUntil: "load" });
  await pg.waitForTimeout(80);
  let html = await pg.evaluate(() => "<!doctype html>\n" + document.documentElement.outerHTML);
  html = html.replace(/ class="(turnR|turnL)"/g, "").replace(/class="spread (turnR|turnL)"/g, 'class="spread"');
  const file = p.url.endsWith(".html") ? p.url : p.url + "index.html";
  write(path.join(OUT, file), html);
  await pg.close();
}

/* ---------- image de partage, icônes ---------- */
const fontsCss = fs.readFileSync(path.join(RAW, "assets/fonts.css"), "utf8");
const og = await ctxB.newPage();
await og.setViewportSize({ width: 1200, height: 630 });
await og.goto("http://localhost:4173/");
await og.setContent(`<html><head><base href="http://localhost:4173/"><style>${fontsCss}
body{margin:0;width:1200px;height:630px;background:#15121d;background-image:radial-gradient(ellipse 70% 60% at 80% 20%,rgba(217,169,91,.18),transparent 60%);color:#e9e0cc;font-family:Spectral,Georgia,serif;display:grid;grid-template-columns:1fr 360px;align-items:center;padding:0 80px;box-sizing:border-box}
.k{font-family:'IBM Plex Mono',monospace;font-size:20px;letter-spacing:.18em;text-transform:uppercase;color:#8a8095}
h1{font-family:'IM Fell English SC',Georgia,serif;font-weight:400;font-size:92px;line-height:1;margin:18px 0 0}
p{font-family:'IM Fell English',Georgia,serif;font-style:italic;font-size:34px;color:#d9a95b;margin:18px 0 0}
.u{font-family:'IBM Plex Mono',monospace;font-size:20px;color:#b6ab97;margin-top:44px}
svg{width:320px;height:320px;filter:drop-shadow(0 0 60px rgba(233,224,204,.25))}
</style></head><body><div><div class="k">${SPELLS.length} sorts · ${RIT.length} rituels · 8 sabbats</div><h1>Le Grimoire<br>de Minuit</h1><p>Livre des Ombres, rituels &amp; histoire des sorcières</p><div class="u">grimoire.endam-digital.com</div></div>
<svg viewBox="-4 -4 108 108"><defs><radialGradient id="g" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#f4ecd8"/><stop offset="1" stop-color="#cdbf9f"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="#221d2e" stroke="#3a3249"/><path d="M50,0 A50,50 0 0 1 50,100 A30,50 0 0 1 50,0Z" fill="url(#g)"/></svg></body></html>`);
await og.waitForTimeout(400);
await og.screenshot({ path: path.join(OUT, "assets/og.png") });
const FAV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15121d"/><path d="M40 12A22 22 0 1 0 52 42 17 17 0 0 1 40 12Z" fill="#d9a95b"/><circle cx="46" cy="18" r="2.5" fill="#e9e0cc"/></svg>`;
write(path.join(OUT, "favicon.svg"), FAV);
await og.setViewportSize({ width: 180, height: 180 });
await og.setContent(`<body style="margin:0">${FAV.replace("<svg ", '<svg width="180" height="180" ')}</body>`);
await og.screenshot({ path: path.join(OUT, "apple-touch-icon.png") });
await browser.close();
server.close();

/* ---------- fichiers GitHub Pages ---------- */
write(path.join(OUT, "CNAME"), "grimoire.endam-digital.com\n");
write(path.join(OUT, ".nojekyll"), "");
write(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const prio = (u) => (u === "/" ? "1.0" : /^\/(livre-des-ombres|sorts|rituels|sabbats|dossiers)\/$/.test(u) || u.startsWith("/dossiers/") ? "0.9" : u.startsWith("/sorts/") ? "0.8" : "0.7");
write(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${SITE}${p.url}</loc><lastmod>${TODAY}</lastmod><priority>${prio(p.url)}</priority></url>`).join("\n")}\n</urlset>\n`);
rm(RAW);
console.log(`${pages.length} pages générées dans docs/`);
if (errors.length) { console.log("ERREURS JS :\n" + errors.join("\n")); process.exitCode = 1; }
