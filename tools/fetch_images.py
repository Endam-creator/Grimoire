#!/usr/bin/env python3
"""Télécharge les illustrations du Grimoire (œuvres du domaine public) depuis Wikimedia.

Usage, depuis le dossier grimoire-site :
    python3 tools/fetch_images.py

Pour chaque article Wikipédia listé, le script récupère l'image principale,
vérifie sur Wikimedia Commons qu'elle est dans le domaine public, puis
l'enregistre dans images-src/ avec ses crédits dans images-src/credits.json.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "images-src")
UA = {"User-Agent": "GrimoireDeMinuit/1.0 (https://grimoire.endam-digital.com; image fetch script)"}

# clé -> (langue, article Wikipédia)
WANTED = {
    "goya-aquelarre":   ("en", "Witches' Sabbath (1798)"),
    "goya-vol":         ("en", "Witches' Flight"),
    "snap-apple":       ("en", "Snap-Apple Night"),
    "magic-circle":     ("en", "The Magic Circle (painting)"),
    "circe":            ("en", "Circe Offering the Cup to Ulysses"),
    "morgan":           ("en", "Morgan-le-Fay (painting)"),
    "hecate":           ("en", "The Triple Hecate"),
    "baba-yaga":        ("en", "Baba Yaga"),
    "salem":            ("en", "Salem witch trials"),
    "salem-examination":("en", "Examination of a Witch"),
    "malleus":          ("en", "Malleus Maleficarum"),
    "north-berwick":    ("en", "North Berwick witch trials"),
    "hopkins":          ("en", "Matthew Hopkins"),
    "la-voisin":        ("en", "Catherine Monvoisin"),
    "tarot":            ("en", "Tarot of Marseilles"),
    "kohler":           ("en", "Köhler's Medicinal Plants"),
    "marie-laveau":     ("en", "Marie Laveau"),
    "grandier":         ("en", "Urbain Grandier"),
}

# Recherche de secours sur Commons quand l'article n'a pas d'image principale
SEARCH = {
    "goya-aquelarre":   "Goya Aquelarre 1798 Lazaro Galdiano",
    "snap-apple":       "Snap-Apple Night Maclise",
    "magic-circle":     "Waterhouse The Magic Circle 1886",
    "morgan":           "Frederick Sandys Morgan le Fay",
    "hecate":           "William Blake Triple Hecate",
    "salem-examination":"Examination of a Witch Matteson",
    "la-voisin":        "Catherine Monvoisin La Voisin portrait",
    "hopkins":          "Discovery of Witches Hopkins 1647 frontispiece",
}

PD = re.compile(r"(public domain|^pd\b|pd-|cc0)", re.I)

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()

def api(lang, **params):
    params.update(format="json", formatversion="2")
    host = "commons.wikimedia.org" if lang == "commons" else f"{lang}.wikipedia.org"
    return json.loads(get(f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)))

def strip(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()

def main():
    os.makedirs(OUT, exist_ok=True)
    cp = os.path.join(OUT, "credits.json")
    credits = json.load(open(cp, encoding="utf-8")) if os.path.exists(cp) else {}
    for key, (lang, title) in WANTED.items():
        if key in credits:
            print(f"  = {key}: déjà là"); continue
        try:
            page = api(lang, action="query", titles=title, prop="pageimages", piprop="name")["query"]["pages"][0]
            name = page.get("pageimage")
            if (not name or key == "hopkins") and key in SEARCH:
                res = api("commons", action="query", list="search", srsearch=SEARCH[key], srnamespace=6, srlimit=5)
                hits = [h["title"][5:] for h in res["query"]["search"] if re.search(r"\.(jpe?g|png|tiff?)$", h["title"], re.I)]
                name = hits[0] if hits else None
            if not name:
                print(f"  ✗ {key}: pas d’image trouvée"); continue
            info = api("commons", action="query", titles="File:" + name, prop="imageinfo",
                       iiprop="url|extmetadata", iiurlwidth=1800)["query"]["pages"][0]
            if "imageinfo" not in info:
                print(f"  ✗ {key}: image absente de Commons ({name})"); continue
            ii = info["imageinfo"][0]; md = ii.get("extmetadata", {})
            lic = md.get("LicenseShortName", {}).get("value", "")
            if not PD.search(lic):
                print(f"  ✗ {key}: licence « {lic} », ignorée"); continue
            url = ii.get("thumburl") or ii["url"]
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ".jpg"
            data = get(url)
            fn = key + ext
            with open(os.path.join(OUT, fn), "wb") as f:
                f.write(data)
            credits[key] = {
                "file": fn, "commons": "File:" + name, "page": ii.get("descriptionurl", ""),
                "artist": strip(md.get("Artist", {}).get("value", "")),
                "title": strip(md.get("ObjectName", {}).get("value", "")) or name.rsplit(".", 1)[0],
                "date": strip(md.get("DateTimeOriginal", {}).get("value", "")),
                "license": lic,
            }
            print(f"  ✓ {key}: {name} ({len(data)//1024} Ko, {lic})")
            time.sleep(0.5)
        except Exception as e:
            print(f"  ✗ {key}: {e}")
    with open(os.path.join(OUT, "credits.json"), "w", encoding="utf-8") as f:
        json.dump(credits, f, ensure_ascii=False, indent=1)
    print(f"\n{len(credits)} images enregistrées dans images-src/")

if __name__ == "__main__":
    sys.exit(main())
