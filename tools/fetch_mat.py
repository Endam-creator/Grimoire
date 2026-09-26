#!/usr/bin/env python3
"""Récupère la carte du Mat (arcane 0) pour compléter le tarot de Jean Dodal.

Usage, depuis le dossier grimoire-site :
    python3 tools/fetch_mat.py

Cherche sur Wikimedia Commons une reproduction ancienne du Mat (tarot de Marseille).
Préfère le domaine public ; à défaut, accepte une licence CC BY ou CC BY-SA
(le site affiche alors l'auteur et la licence sous le tirage).
Écrit images-src/tarot/00.jpg et ajoute l'entrée "00" dans images-src/tarot/credits.json.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "images-src", "tarot")
UA = {"User-Agent": "GrimoireDeMinuit/1.0 (https://grimoire.endam-digital.com; tarot fetch script)"}
QUERIES = ["Jean Dodal Tarot trump 00", "Jean Dodal Le Mat", "Tarot de Marseille Le Mat", "Tarot Noblet Le Fou",
           "Tarot de Marseille Conver Le Mat", "Tarot de Marseille Fool", "Marseille tarot Le Mat 18th century"]
PD = re.compile(r"(public domain|^pd\b|pd-|cc0)", re.I)
OK = re.compile(r"^cc[- ]by(-sa)?[- ]", re.I)

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.read()

def api(**p):
    p.update(format="json", formatversion="2")
    return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))

def info(title):
    pg = api(action="query", titles=title, prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=600)["query"]["pages"][0]
    return (pg.get("imageinfo") or [None])[0]

def clean(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()

def main():
    seen, pd, cc = set(), [], []
    for q in QUERIES:
        for h in api(action="query", list="search", srsearch=q, srnamespace=6, srlimit=8)["query"]["search"]:
            t = h["title"]
            if t in seen or not re.search(r"\.(jpe?g|png|tiff?)$", t, re.I): continue
            seen.add(t)
            if not re.search(r"(mat|fou|fool|\b0+\b|trump 00)", t, re.I): continue
            ii = info(t)
            if not ii: continue
            md = ii.get("extmetadata", {})
            lic = clean(md.get("LicenseShortName", {}).get("value"))
            art = clean(md.get("Artist", {}).get("value"))[:120]
            row = (t, ii, lic, art)
            print(f"  · {t}  [{lic}]")
            (pd if PD.search(lic) else cc if OK.search(lic) else []).append(row)
            time.sleep(0.2)
    pick = (pd or cc or [None])[0]
    if not pick:
        print("Aucune image libre du Mat trouvée."); return 1
    t, ii, lic, art = pick
    with open(os.path.join(OUT, "00.jpg"), "wb") as f:
        f.write(get(ii.get("thumburl") or ii["url"]))
    cp = os.path.join(OUT, "credits.json")
    cred = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else {}
    cred["00"] = {"commons": t, "page": ii.get("descriptionurl", ""), "license": lic, "artist": art}
    json.dump(cred, open(cp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nLe Mat enregistré : {t}\nLicence : {lic}\nAuteur : {art or '-'}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
