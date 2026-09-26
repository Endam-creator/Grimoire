#!/usr/bin/env python3
"""Télécharge les 22 arcanes majeurs d'un tarot de Marseille ancien (domaine public).

Usage, depuis le dossier grimoire-site :
    python3 tools/fetch_tarot.py

Cherche d'abord le tarot de Jean Dodal (Lyon, vers 1701-1715), puis celui de
Nicolas Conver (Marseille, 1760), sur Wikimedia Commons. Les cartes sont
enregistrées dans images-src/tarot/00.jpg … 21.jpg, avec credits.json.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "images-src", "tarot")
UA = {"User-Agent": "GrimoireDeMinuit/1.0 (https://grimoire.endam-digital.com; tarot fetch)"}
PD = re.compile(r"(public domain|^pd\b|pd-|cc0)", re.I)
ROMAN = ["0","I","II","III","IIII","V","VI","VII","VIII","VIIII","X","XI","XII","XIII","XIIII","XV","XVI","XVII","XVIII","XVIIII","XX","XXI"]

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.read()

def api(**p):
    p.update(format="json", formatversion="2")
    return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))

def category_files(cat):
    files, cont = [], {}
    while True:
        r = api(action="query", list="categorymembers", cmtitle="Category:" + cat, cmtype="file", cmlimit=500, **cont)
        files += [m["title"] for m in r.get("query", {}).get("categorymembers", [])]
        if "continue" not in r: break
        cont = {"cmcontinue": r["continue"]["cmcontinue"]}
    return files

def search(q):
    r = api(action="query", list="search", srsearch=q, srnamespace=6, srlimit=20)
    return [h["title"] for h in r["query"]["search"]]

def pick(titles, n):
    """Trouve dans une liste de fichiers la carte numéro n (0 = le Mat / le Fou)."""
    for t in titles:
        base = t.lower()
        if not re.search(r"\.(jpe?g|png|tiff?)$", base): continue
        if "back" in base or "dos" in base: continue
        if n == 0:
            if re.search(r"(fol|fou|mat)\b", base) or re.search(r"(trump|atout|arcane)[ _-]?0?0\b", base): return t
        else:
            if re.search(r"(trump|atout|arcane|arcano|carte|card)[ _-]?0?%d\b" % n, base): return t
            if re.search(r"[ _-]0?%d[ _-]" % n, base) and ("dodal" in base or "conver" in base): return t
    return None

def main():
    os.makedirs(OUT, exist_ok=True)
    pools = []
    for cat in ["Tarot of Jean Dodal", "Jean Dodal Tarot", "Tarot de Marseille by Jean Dodal", "Tarot of Nicolas Conver", "Nicolas Conver Tarot", "Tarot de Marseille by Nicolas Conver"]:
        try:
            f = category_files(cat)
            if f: print(f"  catégorie « {cat} » : {len(f)} fichiers"); pools.append(f)
        except Exception as e:
            print(f"  catégorie « {cat} » : {e}")
    credits, found = {}, 0
    for n in range(22):
        title = None
        for pool in pools:
            title = pick(pool, n)
            if title: break
        if not title:
            for q in [f"Jean Dodal Tarot trump {n:02d}", f"Dodal tarot {ROMAN[n]}", f"Conver tarot {ROMAN[n]} 1760"]:
                title = pick(search(q), n)
                if title: break
                time.sleep(0.3)
        if not title:
            print(f"  ✗ {n:02d} : introuvable"); continue
        info = api(action="query", titles=title, prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=600)["query"]["pages"][0]
        ii = info["imageinfo"][0]; lic = ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")
        if not PD.search(lic):
            print(f"  ✗ {n:02d} : {title} — licence « {lic} », ignorée"); continue
        data = get(ii.get("thumburl") or ii["url"])
        with open(os.path.join(OUT, f"{n:02d}.jpg"), "wb") as f: f.write(data)
        credits[f"{n:02d}"] = {"commons": title, "page": ii.get("descriptionurl", ""), "license": lic}
        found += 1
        print(f"  ✓ {n:02d} : {title}")
        time.sleep(0.4)
    json.dump(credits, open(os.path.join(OUT, "credits.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n{found}/22 cartes enregistrées dans images-src/tarot/")

if __name__ == "__main__":
    sys.exit(main())
