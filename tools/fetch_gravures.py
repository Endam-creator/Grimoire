#!/usr/bin/env python3
"""Télécharge des œuvres anciennes du domaine public pour illustrer les 12 chapitres de sorts.

Usage, depuis le dossier grimoire-site :
    python3 tools/fetch_gravures.py

Pour chaque chapitre, cherche l'œuvre visée sur Wikimedia Commons et garde jusqu'à
3 candidates sous licence domaine public. Écrit :
    images-src/candidats/<chapitre>-<n>.jpg   (900 px de large)
    images-src/candidats/candidats.json       (titre, page Commons, licence, auteur)
Le tri final se fait ensuite : rien n'est publié sur le site par ce script.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "images-src", "candidats")
UA = {"User-Agent": "GrimoireDeMinuit/1.0 (https://grimoire.endam-digital.com; illustrations des chapitres)"}
PD = re.compile(r"(public domain|^pd\b|pd-|cc0)", re.I)

# chapitre -> recherches, de la plus précise à la plus large
WANT = {
    "protection":   ["Dürer Knight Death and the Devil engraving", "Ritter, Tod und Teufel Dürer"],
    "purification": ["Schongauer Saint Anthony tormented by demons engraving", "Schongauer Temptation of Saint Anthony"],
    "liaison":      ["Waterhouse Circe Invidiosa", "Circe Invidiosa 1892"],
    "amour":        ["Evelyn De Morgan The Love Potion", "De Morgan Love Potion 1903"],
    "prosperite":   ["Quentin Matsys The Moneylender and his Wife", "Massys moneylender wife Louvre"],
    "bienetre":     ["Hortus sanitatis woodcut herbs", "Hortus sanitatis 1491 woodcut"],
    "reves":        ["Fuseli The Nightmare 1781 Detroit", "John Henry Fuseli The Nightmare"],
    "divination":   ["Waterhouse The Crystal Ball 1902", "John William Waterhouse Crystal Ball"],
    "glamour":      ["Rossetti Lady Lilith Delaware", "Dante Gabriel Rossetti Lady Lilith"],
    "elements":     ["Arcimboldo Autumn 1573 Louvre", "Arcimboldo four seasons Autumn"],
    "lune":         ["Caspar David Friedrich Two Men Contemplating the Moon", "Friedrich Zwei Männer in Betrachtung des Mondes"],
    "sceaux":       ["Dürer Melencolia I engraving", "Melencolia I Albrecht Dürer"],
}

def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == 2: raise
            time.sleep(2)

def api(**p):
    p.update(format="json", formatversion="2")
    return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))

def clean(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()

def info(title):
    pg = api(action="query", titles=title, prop="imageinfo", iiprop="url|extmetadata|size", iiurlwidth=900)["query"]["pages"][0]
    return (pg.get("imageinfo") or [None])[0]

def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for key, queries in WANT.items():
        print(f"\n{key}")
        got, seen = [], set()
        for q in queries:
            if len(got) >= 3: break
            try:
                hits = api(action="query", list="search", srsearch=q, srnamespace=6, srlimit=10)["query"]["search"]
            except Exception as e:
                print("  recherche impossible :", e); continue
            for h in hits:
                if len(got) >= 3: break
                t = h["title"]
                if t in seen or not re.search(r"\.(jpe?g|png|tiff?)$", t, re.I): continue
                seen.add(t)
                try: ii = info(t)
                except Exception: continue
                if not ii: continue
                md = ii.get("extmetadata", {})
                lic = clean(md.get("LicenseShortName", {}).get("value"))
                if not PD.search(lic): continue
                n = len(got) + 1
                fn = f"{key}-{n}.jpg"
                try:
                    with open(os.path.join(OUT, fn), "wb") as f:
                        f.write(get(ii.get("thumburl") or ii["url"]))
                except Exception as e:
                    print("  téléchargement raté :", t, e); continue
                got.append({"file": fn, "commons": t, "page": ii.get("descriptionurl", ""), "license": lic,
                            "artist": clean(md.get("Artist", {}).get("value"))[:120],
                            "title": clean(md.get("ObjectName", {}).get("value"))[:160],
                            "date": clean(md.get("DateTimeOriginal", {}).get("value"))[:60]})
                print(f"  {fn} ← {t}")
                time.sleep(0.3)
        meta[key] = got
        if not got: print("  (rien trouvé)")
    json.dump(meta, open(os.path.join(OUT, "candidats.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    total = sum(len(v) for v in meta.values())
    print(f"\n{total} images enregistrées dans images-src/candidats/")
    return 0

if __name__ == "__main__":
    sys.exit(main())
