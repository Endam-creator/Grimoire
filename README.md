# Le Grimoire de Minuit

Site statique de sorcellerie : Livre des Ombres (49 sorts), rituels, sabbats, divination, correspondances, histoire.
En ligne sur **https://grimoire.endam-digital.com** (GitHub Pages, dossier `docs/`).

## Mise en ligne (une seule fois)

1. **Créer le dépôt** sur GitHub, par exemple `grimoire` (public).
2. **Pousser le code** depuis ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Le Grimoire de Minuit"
   git branch -M main
   git remote add origin git@github.com:<ton-compte>/grimoire.git
   git push -u origin main
   ```
3. **Activer Pages** : Settings → Pages → *Build and deployment* → Source : **Deploy from a branch** → Branch : **main**, dossier **/docs** → Save.
4. **DNS** chez le registrar d'endam-digital.com : ajouter un enregistrement
   `CNAME` · nom **grimoire** · valeur **<ton-compte>.github.io.**
5. Retour dans Settings → Pages : le domaine personnalisé `grimoire.endam-digital.com` doit apparaître (il est lu depuis `docs/CNAME`). Attendre la vérification DNS, puis cocher **Enforce HTTPS**.
6. **Google Search Console** : ajouter la propriété `grimoire.endam-digital.com`, puis soumettre `https://grimoire.endam-digital.com/sitemap.xml`.

## Modifier le contenu

Tout le contenu est dans `src/` :

| Fichier | Contenu |
|---|---|
| `src/spells1.js`, `src/spells2.js` | chapitres et sorts du Livre des Ombres |
| `src/practice.js` | sabbats, rituels, outils, recettes, tarot, correspondances, glossaire, générateur |
| `src/history.js` | frise historique et figures |
| `src/sources.js` | sources |
| `src/app.js` | comportement des pages |
| `assets/style.css` | design |
| `build.mjs` | générateur (pages, SEO, sitemap, image de partage) |

Pour régénérer le site après une modification :
```bash
npm install
npx playwright install chromium
npm run build
```
Le site complet est réécrit dans `docs/` (pages pré-rendues pour Google, polices auto-hébergées, `sitemap.xml`, `robots.txt`, `CNAME`, `og.png`). Il suffit ensuite de commit + push.

Un nouveau sort ajouté dans `src/spells*.js` obtient automatiquement sa page `/sorts/<nom-du-sort>/`, son entrée dans le sitemap et ses données structurées.
