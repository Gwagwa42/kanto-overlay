# kanto-overlay

Panneau flottant, non officiel, pour la **Tour de combat** de [Kanto Tactics](https://einoow.com/playables/kanto-tactics/) :
- prochain boss (nom, étage, taux de victoire, taux au premier essai, nombre moyen d'essais) ;
- les 3 meilleurs trios contre ce boss (au moins 20 combats) ;
- les conseils d'un guide (shinies, gestion de l'or) pour la tranche d'étages en cours.

L'étage est lu dans la sauvegarde Tour du jeu (`localStorage`, clé `kanto-tactics-save-tower`), toutes les 2 s ; sinon on le saisit
avec − / + ou dans le champ. `Alt+K` replie le panneau ; on le déplace par sa barre de titre, et un double-clic sur cette barre le
remet en haut à droite.

## Installation (Firefox)

1. Installer [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/).
2. Ouvrir <https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js>, puis cliquer sur **Installer**.
   Les mises à jour suivent automatiquement (`@updateURL`).

## Données

Data: Kanto Tactics · [einoow.com](https://einoow.com) — API publique `https://einoow.com/api/meta/kanto/campana.json`, mise à jour
chaque jour, lue une fois par chargement de page (le cache HTTP du navigateur fait le reste). Les conseils sur les shinies viennent d'un
guide et ne sont pas vérifiés.

Projet de fan, sans lien avec Einoow, Nintendo, Game Freak, Creatures ni The Pokémon Company.

## Développement

```sh
node --test test/          # logique : étage, prochain boss, trios, noms, tranches du guide
node scripts/preview.mjs   # pages d'aperçu par état dans build/, puis la commande de rendu imprimée
```

Maquette validée : `docs/design/mockups/2026-11-05-panneau-tour.html`.
