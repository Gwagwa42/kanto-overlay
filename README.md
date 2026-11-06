# kanto-overlay

Panneau flottant, non officiel, pour la **Tour de combat** de [Kanto Tactics](https://einoow.com/playables/kanto-tactics/) :
- prochain boss (nom, étage, taux de victoire, taux au premier essai, nombre moyen d'essais) ;
- les 3 meilleurs trios contre ce boss (au moins 20 combats) ;
- une **compo cible** choisie pour les 9 prochains combats (environ 20 étages) en partant de ton équipe, et des **conseils lus sur
  ta partie** : quoi acheter, actualiser ou non, acheter de l'XP ou non, quoi vendre, quels objets fusionner et sur qui, quelle
  récompense et quelle bénédiction prendre, quand ancrer une forme ;
- un bouton **Copier la formation** : code `KT1;…` à coller dans le Planificateur du jeu (Planificateur → Coller un code) ;
- les règles d'or (intérêts, actualisation, shinies) pour la tranche d'étages en cours.

Les conseils apparaissent aussi en **pastilles** sur le jeu : ★ fais-le, ◆ si l'or le permet, ✕ évite. Survoler une pastille (ou la
sélectionner au clavier) affiche la raison ; cliquer une pastille n'achète rien. La même liste figure dans le panneau.

Pages où il s'affiche : les pages d'entrée du jeu, `https://einoow.com/` et `/kanto-tactics`, `/tower`, `/pvp`, `/duo`, `/nuzlocke`
(avec ou sans `?…`), ainsi que `https://einoow.com/playables/kanto-tactics/…`. Le jeu change de mode sans changer d'adresse : le panneau
est présent dans tous les modes, les pastilles seulement quand la Tour est affichée.

La partie est lue dans la sauvegarde Tour du jeu (`localStorage`, clé `kanto-tactics-save-tower`), toutes les 2 s ; sans partie, on
saisit l'étage avec − / + ou dans le champ. `Alt+K` replie le panneau ; on le déplace par sa barre de titre, et un double-clic sur cette
barre le remet en haut à droite.

## Comment les conseils sont choisis

- **Compo cible** : parmi les trios d'au moins 20 combats des 9 prochains combats (élites comprises, environ 20 étages), celui dont la
  borne basse du taux de victoire (intervalle à 95 %) est la meilleure, pondérée par la difficulté de chaque combat, avec un bonus pour
  les Pokémon que tu possèdes déjà. Elle ne change que pour un gain d'au moins 30 points, et repart de zéro à chaque nouvelle partie.
  Le reste du plateau est rempli par les lignées qui renforcent ses types : tes unités d'abord, puis la boutique pour les places
  restantes.
- **Économie** : intérêts plafonnés à +3 en Tour, donc palier de 30 pièces (50 avec la voie Fortune complète). On ne dépense que le
  surplus, sauf en **tout jouer** : combat de l'étage sous 45 % de victoires, ou PV sous 40.
- **Objets** : tout objet complet ou composant du sac va tout de suite sur un Pokémon de la compo. Un composant seul donne déjà son
  effet et fusionne sur le Pokémon avec le suivant ; deux composants du sac pour le même Pokémon sont donnés en paire, avec l'ordre
  de pose quand il compte. Priorité à la recette idéale de chaque lignée (meilleurs couples Pokémon/objet de la Tour), sinon par
  rôle : offensif au porteur puis aux attaquants, défensif au tank puis à la mêlée. 3 objets au plus par Pokémon ; « Garde »
  seulement quand toute la compo est pleine. La récompense d'objet se choisit d'après ce qui reste à compléter après ces conseils.
- **Bénédictions** : PV bas → soins ; sinon voie Fortune jusqu'à 3, puis la voie la plus avancée. **Sceaux** : règles par catégorie.
- **Formation** : mêlée devant (tank au centre), distance au fond et espacée, porteur dans le coin choisi (bouton « Porteur »).

## Installation (Firefox)

1. Installer [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/).
2. Ouvrir <https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js>, puis cliquer sur **Installer**.
   Les mises à jour suivent automatiquement (`@updateURL`).

## Données

Data: Kanto Tactics · [einoow.com](https://einoow.com) — API publique `https://einoow.com/api/meta/kanto/` : `campana.json`
(statistiques de la Tour), `data.json` (lignées, objets, recettes, types, sceaux), `lang.json?lang=fr` (noms et effets des objets, sceaux,
types). Conformément à ses conditions, chaque source est gardée **une heure** dans le Cache Storage du navigateur, puis revalidée
(`ETag`) ; en cas d'erreur, la dernière copie sert et le pied du panneau en donne la date.

L'API publique s'arrête aux règles 40 alors que la Tour tourne en 41 : quelques règles relevées dans le code du jeu sont écrites dans
le script (seuils d'XP, plafond d'intérêts, voies et noms des bénédictions, coût, types et portée de 24 lignées). Les conseils sur
les shinies viennent d'un guide et ne sont pas vérifiés.

Projet de fan, sans lien avec Einoow, Nintendo, Game Freak, Creatures ni The Pokémon Company.

## Développement

```sh
node --test test/          # logique : étage, boss, trios, noms, compo cible, économie, boutique, objets, bénédictions, code KT1
node scripts/preview.mjs   # pages d'aperçu par état dans build/, puis la commande de rendu imprimée
```

Maquettes validées : `docs/design/mockups/2026-11-05-panneau-tour.html`, `docs/design/mockups/2026-11-05-conseils.html`.
