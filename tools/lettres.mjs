// Génère les lettres prêtes à coller dans Buttondown (social/lettres/AAAA-MM-JJ.md) à partir de src/lettres.js
import fs from "fs";
const w = {}; new Function("window", fs.readFileSync("src/spells1.js", "utf8") + fs.readFileSync("src/spells2.js", "utf8") + fs.readFileSync("src/spells3.js", "utf8") + fs.readFileSync("src/lettres.js", "utf8"))(w);
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[’']/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^(le|la|les|l)-/, "");
const SITE = "https://grimoire.endam-digital.com";
fs.mkdirSync("social/lettres", { recursive: true });
for (const l of w.LETTRES) {
  const sp = w.SPELLS.find((s) => s.id === l.sort);
  const body = l.corps.map((p) => (p.startsWith("« ") ? `> *${p}*` : p.replace(/(https:\/\/\S+?)([.,]?)$/, "[$1]($1)$2"))).join("\n\n");
  const md = `Objet : ${l.sujet}\n\n---\n\n${body}\n\n${sp ? `**Le sort complet, pas à pas :** [${sp.n}](${SITE}/sorts/${slug(sp.n)}/)\n\n` : ""}${l.corps.at(-1).includes("samedi prochain") ? "" : "À samedi prochain,\n"}*Le Grimoire de Minuit*\n\n---\n\n*Toutes les lettres sont archivées sur [${SITE.replace("https://", "")}/lettre](${SITE}/lettre/).*\n`;
  fs.writeFileSync(`social/lettres/${l.date}.md`, md);
}
console.log(w.LETTRES.length + " lettres écrites dans social/lettres/");
