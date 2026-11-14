# kanto-overlay : panneau Tour et campagne de Kanto Tactics (userscript Violentmonkey)

Usage, règles des conseils, données de l'API einoow et développement : `README.md`.

## Carte
- `kanto-overlay.user.js` : le script entier, en-tête `==UserScript==` compris (`@version`, `@match`, `@updateURL`). Il exporte ses
  fonctions pour Node (`module.exports`, fin du fichier) : les tests et l'aperçu le chargent par `require`.
- `test/*.test.js` : tests `node --test` ; `test/helpers.js` : `adviseOn`, les conseils d'une sauvegarde sur les fixtures.
- `test/fixtures/` : réponses enregistrées de l'API, sauvegardes de partie, et scénarios `s57.js` (celui de la maquette
  `2026-11-05-conseils`) et `brock.js`, partagés avec `scripts/preview.mjs` : les modifier change aussi les pages d'aperçu.
- `scripts/preview.mjs` : pages d'aperçu dans `build/` (ignoré par git).
- `docs/design/` : maquettes de la skill `ui-design` (`mockups/`), captures de l'aperçu et du jeu réel (`captures/`).

## Vérifications
- `node --test test/` → `fail 0`.
- Changement visible du panneau : `node scripts/preview.mjs`, puis `render-html.sh` (skill `ui-design`, hors sandbox) sur
  `build/panel-<état>.html`. Les pages `build/preview-<état>.html` passent par un serveur sur 127.0.0.1, injoignable sous sandbox :
  Mathieu les ouvre (README § Développement).

## Conventions
- Version : `@version` et `const VERSION` (début du script) montent ensemble, un test les compare. Elles montent à chaque changement de
  comportement fusionné sur `main` (fix : patch, feat : mineure), pas pour un refactor : Violentmonkey ne propose la mise à jour
  (`@updateURL` sur `main`) que si la version augmente.
- Branches `feat/slug`, `fix/slug`, `docs/slug`, `refactor/issue-N-slug` (plusieurs issues : `refactor/issues-A-B`).
- Commits en français, « Domaine : description #N » (`#N` quand une issue existe) ; « Revue N : … » pour les corrections de relecture,
  « docs : … » pour la doc, la version entre parenthèses dans le commit qui la monte.
- Les modules du jeu se lisent en statique, jamais exécutés (README § Développement).
