# KATA, le coach de Lyarà

Tableau de bord personnel pour **Lyarà**, Moine Marche-vent sur EU-Archimonde (World of Warcraft : Midnight).
Tout tient dans **un seul fichier** `index.html` : HTML, CSS, JavaScript et icônes SVG intégrés, sans bibliothèque, sans police ni image externe.

- Les données du personnage viennent **en direct de raider.io** (seul site contacté, en lecture).
- La **recherche de la saison** (guides, cibles, règles d'action) est intégrée au fichier. Elle est datée (« Recherche du 28/09 ») et n'est jamais présentée comme une donnée en direct.
- Hors ligne, KATA affiche l'équipement du 21/08 (snapshot) et la dernière progression connue de la recherche, clairement étiquetés.
- Tes coches et réglages restent **dans ton navigateur** (localStorage). Rien n'est envoyé ailleurs.
- À chaque passage en direct, KATA note une ligne par jour dans un **journal local** (ilvl, cote, raid, Coffre, tier, enchants ; 120 jours au plus). Il sert à « Depuis ta dernière visite », aux petites courbes des jauges et au « rythme mesuré » de la projection. Hors ligne, rien n'est noté. Exporter / Importer (Réglages) inclut le journal.

> Note : les noms de champs raider.io utilisés sont supposés (API non documentée pour certains champs). Les constantes de jeu (heure du reset, seuils du Grand Coffre…) sont modifiables dans le bloc `CONFIG` de `src/js/00-kata.js` et affichées avec leur niveau de confiance.

## Ouvrir KATA

**En ligne (GitHub Pages)** : <https://mehdi-mameri.github.io/malenia.github.io/lyara-ww/>
La navigation utilise l'ancre de l'URL (`#now`, `#week`, `#gear`, `#analyse`, `#guide`) : les liens directs fonctionnent, par exemple `…/lyara-ww/#gear`.
Liens vers une fiche : `…/lyara-ww/#gear?slot=back` ouvre l'emplacement Dos, `…/lyara-ww/#week?donjon=aof` la fiche d'un donjon (sigle ou nom). Le bouton Retour du navigateur ferme la fiche ouverte.
La page est publique pour qui connaît l'adresse ; elle demande seulement aux moteurs de recherche de ne pas l'indexer.

**Sur iPhone (écran d'accueil)**

- Safari : ouvre l'adresse, touche **Partager**, puis **Sur l'écran d'accueil**.
- Chrome (iOS 16.4 ou plus) : ouvre l'adresse, touche **Partager** (en haut à droite), puis **Ajouter à l'écran d'accueil**.

L'icône « KATA » lance la page en plein écran. Attention : en mode écran d'accueil, iOS garde des données séparées de celles de l'onglet du navigateur. Utilise **Réglages › Exporter / Importer** pour passer tes coches de l'un à l'autre.

**Sur ordinateur** : ouvre `index.html` directement dans le navigateur (double-clic), ou utilise l'adresse en ligne. Chrome sur iPhone n'ouvre pas les fichiers locaux de façon fiable : passe par l'adresse en ligne.

## Mettre à jour la recherche et reconstruire

1. Remplace `data/research-data.json` par la nouvelle version (même structure, voir `DATA_CONTRACT.md` du projet de recherche).
2. Depuis ce dossier, lance :

   ```sh
   node build.mjs
   ```

   Il faut Node.js 18 ou plus. Si `esbuild` est disponible (il l'est après `npm install` à la racine du dépôt), le JavaScript et le CSS sont minifiés ; sinon seuls les commentaires sont retirés.
3. Le script vérifie le JSON, la syntaxe du JavaScript et les règles de sécurité (pas de `innerHTML` hors de `10-dom.js`, pas de gestionnaire `on…=`, pas d'URL externe, pas d'emoji…), recalcule les empreintes de la politique de sécurité (CSP), écrit `index.html` et affiche les tailles. Il s'arrête avec un code d'erreur si quelque chose ne va pas.
4. Publie : le workflow GitHub Pages du dépôt copie `lyara-ww/index.html` dans le site à chaque push sur `main`/`master`.

Options : `node build.mjs --out /chemin/fichier.html` écrit ailleurs ; `--no-minify` garde le code lisible (débogage).

**Ne modifie jamais `index.html` à la main** : il est régénéré à chaque build.

## Organisation des sources

```
build.mjs              assemblage → index.html (CSP, tailles, contrôles)
src/template.html      <head>, squelette, marqueurs <!--INLINE:…-->
src/icons.svg          sprite d'icônes (<symbol id="i-…">)
src/assets/            icône d'écran d'accueil (PNG 180×180) et favicon SVG
src/css/NN-nom.css     concaténés dans l'ordre des numéros
src/js/NN-nom.js       concaténés dans l'ordre des numéros, un seul <script>, tout sous l'objet global KATA
data/research-data.json
```

Plages de numéros : `00–39` socle (données, routeur, feuilles, copie, diagnostic) · `40–49` moteur et « Maintenant » · `50–59` « Semaine » · `60–69` « Stuff » · `70–79` provenance (confiance, débats, sources) et « Analyse » · `80–89` « Guide » et « Réglages » · `99` démarrage.

## En cas de souci

Touche la barre d'état (sous le nom) pour voir l'état des données, puis **Diagnostic** : champs reçus de raider.io, requêtes (statut, durée) et erreurs éventuelles.
