# kanto-overlay : panneau Tour et campagne de Kanto Tactics (userscript Violentmonkey)

Usage, règles des conseils, données de l'API einoow et développement : `README.md`. Ce fichier ne garde que ce qu'un agent doit savoir
en plus.

## Carte
- `kanto-overlay.user.js` : le script entier, en-tête `==UserScript==` compris (`@version`, `@match`, `@updateURL`).
- `test/*.test.js` : tests `node --test` ; `test/fixtures/` : réponses enregistrées de l'API et sauvegardes de partie ;
  `test/helpers.js` : `adviseOn`, les conseils d'une sauvegarde sur ces fixtures.
- `scripts/preview.mjs` : pages d'aperçu dans `build/` (ignoré par git), rendues selon README § Développement.
- `docs/design/` : maquettes (`mockups/`) et captures (`captures/`) de la skill `ui-design`.

## Vérifications
- `node --test test/` → `ℹ fail 0` (169 tests le 2026-11-14).
- Changement visible du panneau : `node scripts/preview.mjs`, puis rendu et capture comme le décrit README § Développement.

## Conventions
- `@version` monte à chaque changement du script fusionné sur `main` : Violentmonkey ne propose la mise à jour (`@updateURL` sur `main`)
  que si la version augmente.
- Branches `feat/slug`, `fix/slug`, `refactor/issue-N-slug` ; commits en français, `#N` en fin de ligne quand une issue existe.
- Les modules du jeu se lisent en statique, jamais exécutés (README § Développement).
