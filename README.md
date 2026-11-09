# kanto-overlay

Panneau flottant, non officiel, pour la **Tour de combat** de [Kanto Tactics](https://einoow.com/playables/kanto-tactics/) :
- prochain boss (nom, étage, taux de victoire, taux au premier essai, nombre moyen d'essais) ;
- les 3 meilleurs trios contre ce boss (au moins 20 combats) ;
- une **compo cible** choisie pour les 9 prochains combats (environ 20 étages) en partant de ton équipe, et des **conseils lus sur
  ta partie** : quoi acheter, actualiser ou non, acheter de l'XP ou non, quoi vendre, quels objets fusionner et sur qui, quelle
  récompense et quelle bénédiction prendre, quand ancrer une forme ;
- la compo cible écrite dans le **Planificateur** du jeu à chaque changement, sous le nom « Plan kanto-overlay », et activée :
  ses ombres s'affichent sur le plateau. Le panneau liste les Pokémon à poser ou à déplacer (« Pose Caninos — avant, colonne 4 ») ;
- un bouton **Copier la formation** : le même code `KT1;…`, pour le partager ou le coller à la main (Planificateur → Coller un code)
  si l'écriture automatique échoue ;
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
- **Compo suivante** : le même calcul sur les 9 combats d'après (« Ensuite · étages 80–100 » sous la compo cible), affiché quand
  le trio diffère. On la prépare avec le surplus : ◆ en boutique pour ses Pokémon après ceux de la compo cible et son actualisation,
  sans passer sous le palier ni en tout jouer, et pas de « Vends » pour eux au banc tant que l'or suffit aux ★ de la compo cible.
- **Économie** : intérêts plafonnés à +3 en Tour, donc palier de 30 pièces (50 avec la voie Fortune complète). On ne dépense que le
  surplus, sauf en **tout jouer** : combat de l'étage sous 45 % de victoires, ou PV sous 40.
- **Objets** : tout objet complet ou composant du sac va tout de suite sur un Pokémon de la compo. Un composant seul donne déjà son
  effet et fusionne sur le Pokémon avec le suivant ; deux composants du sac pour le même Pokémon sont donnés en paire, avec l'ordre
  de pose quand il compte. Priorité à la recette idéale de chaque lignée (meilleurs couples Pokémon/objet de la Tour), sinon par
  rôle : offensif au porteur puis aux attaquants, défensif au tank puis à la mêlée. 3 objets au plus par Pokémon ; « Garde »
  seulement quand toute la compo est pleine. La récompense d'objet se choisit d'après ce qui reste à compléter après ces conseils.
- **Bénédictions** : PV bas → soins ; sinon voie Fortune jusqu'à 3, puis la voie la plus avancée. **Sceaux** : règles par catégorie.
- **Formation** : la compo cible dans la limite du niveau. Chaque Pokémon a sa zone : tank au premier rang, porteur à distance dans
  le coin choisi (bouton « Porteur »), mêlée devant, distance au fond. Un Pokémon déjà dans sa zone garde sa case ; les autres
  prennent la première case libre (avant depuis le centre, fond depuis le coin). Les déplacements sont listés dans l'ordre où les
  faire : d'abord ceux qui libèrent une case, puis les poses, en remplaçant un Pokémon hors formation si le plateau est plein.
- **Planificateur** : quand la formation change, le script ouvre le Planificateur depuis la barre du jeu, supprime l'ancien
  « Plan kanto-overlay », colle le code et referme ; on voit l'écran s'ouvrir un instant et le jeu joue son bruit de clic. La CSP
  du site empêche d'atteindre les plans du jeu autrement que par son interface. Supprimer avant de coller évite que la limite de
  10 plans par mode efface un de tes plans. Rien n'est fait pendant un glisser, une saisie dans le panneau, une modale du jeu ou
  quand le Planificateur est déjà ouvert (nouvel essai 2 s plus tard) ; en affichage portrait, où le bouton de la barre ouvre un
  menu, le panneau invite à copier le code. Si l'interface du jeu a changé, le panneau le signale et le bouton Copier reste.
- **Shinies** : une lignée est shiny quand sa copie de meilleure étoile l'est (la fusion transmet le shiny) ; elle porte « shiny »
  dans la compo cible, ajoute 2 points au trio, départage porteur, tank (+10 % de PV) et remplissage, et s'écrit `ligne:2s:…` dans
  le code KT1. Une unité shiny n'est pas proposée à la vente jusqu'à l'étage 120.

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
le script (seuils d'XP, plafond d'intérêts, voies et noms des bénédictions, coût, types et portée de 24 lignées, effet d'un shiny :
+10 % de PV, dégâts et défenses, transmis par la fusion). La liste des shinies à saisir par tranche d'étages vient d'un guide et n'est
pas vérifiée.

Projet de fan, sans lien avec Einoow, Nintendo, Game Freak, Creatures ni The Pokémon Company.

## Développement

```sh
node --test test/          # logique : étage, boss, trios, noms, compo cible, économie, boutique, objets, bénédictions, code KT1, Planificateur
node scripts/preview.mjs   # pages d'aperçu par état dans build/, puis la commande de rendu imprimée
```

Maquettes validées : `docs/design/mockups/2026-11-05-panneau-tour.html`, `docs/design/mockups/2026-11-05-conseils.html`.
