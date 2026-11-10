# kanto-overlay

Panneau flottant, non officiel, pour la **Tour de combat** et la **campagne** (aventure Kanto aux trois difficultés, autres
aventures) de [Kanto Tactics](https://einoow.com/playables/kanto-tactics/) :
- prochain boss (nom, étage ou combat, taux de victoire, taux au premier essai, nombre moyen d'essais) ;
- les 3 meilleurs trios contre ce boss (au moins 20 combats) ;
- une **compo cible** choisie pour les 9 prochains combats (environ 20 étages) en partant de ton équipe, et des **conseils lus sur
  ta partie** : quoi acheter, actualiser ou non, acheter de l'XP ou non, quoi vendre, quels objets fusionner et sur qui, lesquels retirer, quelle
  récompense et quelle bénédiction prendre, quand ancrer une forme ;
- la compo cible écrite dans le **Planificateur** du jeu à chaque changement, sous le nom « Plan kanto-overlay », et activée :
  ses ombres s'affichent sur le plateau. Le panneau liste les Pokémon à poser ou à déplacer (« Pose Caninos », avant, colonne 4) ;
- un bouton **Copier la formation** : le même code `KT1;…`, pour le partager ou le coller à la main (Planificateur → Coller un code)
  si l'écriture automatique échoue ;
- les règles d'or (intérêts, actualisation, tout jouer, shinies en Tour) du mode et de la difficulté en cours.

Les conseils apparaissent aussi en **pastilles** sur le jeu : ★ fais-le, ◆ si l'or le permet, ✕ évite. Survoler une pastille (ou la
sélectionner au clavier) affiche la raison ; cliquer une pastille n'achète rien.

En tête du panneau, toujours visibles : l'or à dépenser au-dessus du palier, l'alerte « tout jouer » et le prochain boss avec son
taux de victoire. Dessous, quatre onglets : **Tour** (les conseils ★ et ◆, les ✕ regroupés sous « N à éviter »), **Compo** (compo
cible, compo suivante, objets visés, copie de la formation), **Boss** (taux, premier essai, essais moyens, meilleurs trios) et
**Règles** (règles d'or de la tranche). Replié, le panneau garde l'étage, l'or à dépenser et le premier conseil ★.

Le menu ⚙ règle le thème (auto, clair, sombre), les pastilles affichées par niveau, la largeur (320 ou 380 px), la taille du texte,
l'opacité du fond (100, 90 ou 85 % : en deçà, le texte secondaire passe sous un contraste de 4,5:1 sur les zones claires du jeu en
thème sombre, sombres en thème clair) et la zone du porteur dans la formation. Les réglages sont gardés dans le navigateur.

Pages où il s'affiche : les pages d'entrée du jeu, `https://einoow.com/` et `/kanto-tactics`, `/tower`, `/pvp`, `/duo`, `/nuzlocke`
(avec ou sans `?…`), ainsi que `https://einoow.com/playables/kanto-tactics/…`. Le jeu change de mode sans changer d'adresse : le panneau
est présent dans tous les modes, les pastilles seulement quand la partie conseillée est affichée (barre de progression de la Tour
ou de la campagne).

La partie est lue toutes les 2 s dans la sauvegarde du jeu (`localStorage`) écrite en dernier (`savedAt`) : Tour
(`kanto-tactics-save-tower`), Kanto (`kanto-tactics-save`) ou une autre aventure (`kanto-tactics-save-adv-<aventure>`). Le Nuzlocke
(`kanto-tactics-save-nuzlocke`) n'a pas de conseils : le panneau le dit plutôt que de conseiller la dernière partie Kanto. Sans
partie, on saisit l'étage (ou le combat) avec − / + ou dans le champ. `Alt+K` replie le panneau ; on le déplace par sa barre de titre, et un double-clic sur cette
barre le remet en haut à droite.

## Comment les conseils sont choisis

- **Compo cible** : parmi les trios d'au moins 20 combats des 9 prochains combats (élites comprises, environ 20 étages), celui dont la
  borne basse du taux de victoire (intervalle à 95 %) est la meilleure, pondérée par la difficulté de chaque combat, avec un bonus pour
  les Pokémon que tu possèdes déjà et un malus de 10 points par Pokémon à trouver dont le coût sort à moins de 15 % en boutique à ton
  niveau. Elle ne change que pour un gain d'au moins 30 points, et repart de zéro à chaque nouvelle partie.
  Le reste du plateau est rempli par tes unités les mieux notées, puis par la boutique pour les places restantes (★ « place libre »).
  La note d'une unité est sa puissance, `(1 + 0,35 × (coût − 1))` × 1, 1,9 ou 3,6 selon l'étoile, plus 0,25 par type renforcé et
  0,5 par seuil de type franchi. Le coût gagne ou perd un cran, un seul, selon l'écart de victoire de la lignée dans le mode (champ
  `d` de l'API : taux de victoire moins le taux attendu sur les mêmes combats), rétréci par 400 combats fictifs : un cran dès
  2,5 points. Sur les 85 lignées de base (novembre 2026), 3 gagnent un coût (Mystherbe, Nidoran♀, Carapuce) et 18 en perdent un
  (dont Salamèche, Pikachu, Magmar, Roucool, Abra). On lit l'écart de la forme possédée, rétréci vers celui de sa lignée de
  base pour une forme ancrée, et celui de la lignée de base pour une carte de boutique. À égalité, l'unité possédée, la shiny,
  puis la lignée qui gagne le plus dans les trios de ces combats. Une carte de boutique mieux notée qu'un de tes compléments est conseillée en ◆ (« plus fort que Rattata ») : elle
  n'entre dans la compo qu'une fois achetée, pour que le plan ne change pas à chaque actualisation. Un complément possédé reçoit
  des objets comme les autres Pokémon de la compo.
- **Compo suivante** : le même calcul sur les 9 combats d'après (« Ensuite · étages 80–100 » sous la compo cible), affiché quand
  le trio diffère. On la prépare avec le surplus : ◆ en boutique pour ses Pokémon après ceux de la compo cible et son actualisation,
  sans passer sous le palier ni en tout jouer, et pas de « Vends » pour eux au banc tant que l'or suffit aux ★ de la compo cible.
- **Économie** : intérêts plafonnés à +3 en Tour, donc palier de 30 pièces (50 avec la voie Fortune complète). On ne dépense que le
  surplus, sauf en **tout jouer** : combat de l'étage sous 45 % de victoires, PV sous 40, ou étage rejoué après une défaite à partir
  de l'étage 50 (une nouvelle défaite y coûte 12 PV et plus, et supprime les intérêts de la manche).
- **Or au-dessus du palier** : il ne rapporte rien, il est dépensé dans cet ordre.
  1. Les achats ★ : trio, 3ᵉ copie, shiny qui devient la meilleure copie, place libre. Eux seuls peuvent faire passer sous le
     palier : une place vide ou un Pokémon du trio manquant coûte plus qu'un intérêt.
  2. L'XP jusqu'au niveau visé : 5 dès l'étage 6, 6 dès 12, 7 dès 20, 8 dès 30, 9 dès 45, 10 dès 65. La Tour ne donne que 1 XP
     par étage : le niveau s'achète. Tant qu'il n'est pas atteint, le surplus y va par tranches de 4 pièces : pas d'actualisation,
     et les ◆ n'ont que le reste.
  3. Les ◆ de la compo cible.
  4. L'actualisation, s'il y a quelque chose à chercher dont le coût sort à 15 % ou plus à ton niveau : un Pokémon du trio sous ★★,
     ou un Pokémon de la compo qui a 2 copies ★ ou 2 copies ★★. Au niveau maximal, le trio se cherche jusqu'à ★★★ et le seuil de
     15 % ne vaut plus : l'or n'a pas d'autre emploi. Seule exception, le trio ne cherche plus la ★★★ d'une forme
     qu'elle affaiblit nettement dans le mode (intervalles à 95 % disjoints : 16 formes en novembre 2026, dont Hypotrempe, Ptitard,
     Psykokwak, Kabuto, Rhinocorne) ; deux copies ★★ font encore chercher la troisième. Une lignée trouvable seulement plus
     haut est annoncée (« Kabuto (coût 4 : 12 %) au niveau 7 : à chercher au niveau 8 ») ; un coût 1 ou 2, qui sort de moins en moins, ne donne aucun conseil.
  5. Les ◆ de la compo suivante.
  6. L'XP avec ce qui reste, jusqu'au niveau maximal (9, puis 10 à partir de l'étage 60).
- **Profil de chaque lignée** : lu sur les objets qu'elle porte dans le mode (Tour ou campagne). Elle est tank si la moitié au moins de leurs composants
  sont défensifs (PV Plus, Fer, Zinc), spéciale si le Calcium l'emporte sur la Protéine, physique sinon. Exemples : Ronflex et Machop
  tanks, Minidraco et Caninos attaquants physiques, Abra et Goupix attaquants spéciaux.
- **Objets** : un objet ne va qu'à un Pokémon à qui il convient. Jamais un objet d'Atq. Spé. à un physique ni d'Attaque à un spécial
  (les objets mixtes, comme Orbe Vie et Lentilscope, vont aux deux) ; au moins la moitié de défensif pour un tank, d'offensif pour
  un attaquant. Les composants pris en compte sont ceux qui donnent ses stats à l'objet (Casque Brut : PV et Défense).
  - Pose : chaque Pokémon de la compo ne reçoit que ses objets idéaux, les 3 meilleurs couples Pokémon/objet de sa lignée dans le mode
    qui conviennent à son profil. L'objet complet, ou un composant de l'une de ces recettes, va tout de suite sur lui. Un
    composant seul donne déjà son effet et fusionne sur le Pokémon avec le suivant ; deux composants du sac pour le même Pokémon
    sont donnés en paire, avec l'ordre de pose quand il compte. Un objet complet idéal de plusieurs Pokémon va à celui qui le
    classe le plus haut ; un composant, au premier dans l'ordre porteur, tanks, attaquants. 3 objets au plus. Un objet idéal
    qu'un Pokémon de la compo ne peut pas recevoir attend au sac pour lui, avant toute lignée à venir, avec la raison : plus de
    place, après l'Aimant, composant seul à fusionner d'abord, ou bloqué par un composant seul hors de ses recettes. Le reste
    attend aussi (« Garde Orbe Vie — hors des meilleurs objets de la compo »).
  - Préparation : un composant qui n'entre dans aucune recette idéale d'un Pokémon possédé reste au sac s'il entre dans celle
    d'un Pokémon du cœur cible pas encore acheté ou du cœur de la compo suivante, une copie par composant demandé (« Garde Fer
    — Cuiller Tordue pour Lokhlass, à venir »). La récompense d'objet vise ce qui reste à compléter, puis ces recettes à venir.
  - Retrait : l'Aimant du sac va sur un Pokémon de la compo qui porte un objet contraire à son profil, sinon sur un Pokémon plein
    dont un objet idéal attend au sac (l'objet, ou ses composants, est alors gardé pour lui), ou sur un Pokémon bloqué par un
    composant seul hors de ses recettes idéales quand les deux composants d'une recette idéale attendent au sac (un objet
    complet se pose sans Aimant), enfin sur un Pokémon posé hors des deux compos qui porte des objets. Au banc, un tel Pokémon est à vendre : il rend ses objets au sac.
  - « Objets visés », dans l'onglet Compo : pour chaque Pokémon de la compo, ses 3 objets idéaux, portés (✓), prêts au sac (●) ou
    avec les composants qui manquent (○).
- **Bénédictions** : PV bas → soins ; sinon voie Fortune jusqu'à 3, puis la voie la plus avancée. **Sceaux** : règles par catégorie.
- **Formation** : la compo cible dans la limite du niveau, sur les 4 rangées. La rangée d'un Pokémon est sa portée : portée 1 à
  l'avant, 2 en 2ᵉ rangée, 3 en 3ᵉ, 4 et 5 au fond. Le plateau est en hexagones et les deux camps se touchent : de là, il atteint la
  première rangée ennemie sans avancer. Les tanks que tu possèdes (profil) restent à l'avant quelle que soit leur portée. Une
  rangée pleine déborde sur celle de derrière, puis sur celle de devant.
  - Colonnes : à l'avant, depuis le centre, tanks d'abord. Derrière, le porteur à distance prend les colonnes de la zone choisie
    (option Porteur à distance du menu ⚙ : coin gauche, centre ou coin droit ; aucune statistique publique ne départage ces
    placements), puis les autres une colonne sur deux depuis cette zone. Une unité à distance évite la colonne d'une autre,
    quelle que soit sa rangée : sur deux rangées voisines, deux cases de la même colonne se touchent. Posées depuis le banc,
    4 unités à distance ne se touchent pas (3 avec la zone centre) ; au-delà, ou autour d'une unité qui garde sa case, elles
    peuvent se toucher.
  - Un Pokémon déjà sur sa rangée garde sa case ; le porteur à distance, seulement dans les colonnes de sa zone. Les déplacements
    sont listés dans l'ordre où les faire : d'abord ceux qui libèrent une case, puis les poses, en remplaçant un Pokémon hors
    formation si le plateau est plein.
- **Planificateur** : quand la formation change, le script ouvre le Planificateur depuis la barre du jeu, supprime l'ancien
  « Plan kanto-overlay », colle le code et referme ; on voit l'écran s'ouvrir un instant et le jeu joue son bruit de clic. La CSP
  du site empêche d'atteindre les plans du jeu autrement que par son interface. Au-delà de 10 plans par mode, le jeu efface le
  plus ancien : le script supprime donc l'ancien plan avant de coller, et ne colle rien si tu as déjà 10 plans dans ce mode (le panneau te
  demande d'en supprimer un). Rien n'est fait pendant un glisser, quand le focus est dans le panneau, sous une modale du jeu ou
  quand le Planificateur est déjà ouvert (nouvel essai 2 s plus tard) ; en affichage portrait, où le bouton de la barre ouvre un
  menu, le panneau invite à copier le code. Si l'interface du jeu a changé, le panneau le signale et le bouton Copier reste.
- **Shinies** : une lignée est shiny quand sa copie de meilleure étoile l'est (la fusion transmet le shiny) ; elle porte « shiny »
  dans la compo cible, ajoute 2 points au trio, départage porteur, tank (+10 % de PV) et remplissage, et s'écrit `ligne:2s:…` dans
  le code KT1. Une unité shiny n'est pas proposée à la vente : jusqu'à l'étage 120 en Tour, sur toute la campagne.

### Campagne

Mêmes conseils qu'en Tour, sur les combats de l'aventure en cours, avec les règles de la campagne relevées dans le code du jeu :
- **Combats** : le combat N est la manche N − 1 de la sauvegarde. Les statistiques `modes.camp` mêlent toutes les aventures ; le
  panneau garde les combats de la tienne (table relevée dans le jeu pour Kanto, Cap sur Cramois'Île et « Je te choisis ! »). Une
  manche aux variantes tirées au sort (combat 11 : Marin, Gentleman ou Pêcheur) compte chacune selon sa part des combats. Aux
  4ᵉ, 5ᵉ et 6ᵉ badges, le champion est celui que tu as choisi (`gymOrder`), sinon un de ceux qui restent.
- **Boss** (Kanto) : les 8 badges, le Conseil 4, le Maître de la Ligue et Mewtwo ; dans les autres aventures, chaque combat.
- **Économie** : intérêts plafonnés à +4, donc palier de 40 pièces ; 2 XP gratuites par combat, niveau 9 au plus. Niveaux visés
  (choix de jeu, d'après la taille des équipes des champions) : 4 dès le combat 4, 5 dès 8, 6 dès 12, 7 dès 16, 8 dès 24, 9 dès 30.
  Sur un combat obligatoire (badge, Ligue, boss), une deuxième défaite ne rapporte plus d'intérêts : un combat rejoué se joue à fond
  dès le premier échec. Ni bénédiction ni sceau.
- **Difficulté** : lue dans la sauvegarde (Normal, Vétéran, Légende) et affichée en tête du panneau. Les taux de l'API mêlent les
  trois ; or le jeu renforce les adversaires (textes du jeu, roster-*.js : en Vétéran, rivaux +5 % à toutes les stats, équipes
  variées et objets ; au-delà, as à une étoile de plus, objets combinés, boucliers et rage des boss, selon l'aventure). Le panneau
  retire donc 10 puis 20 points au taux de chaque combat : « tout jouer » sous 55 puis 65 %, couleur des taux en conséquence,
  niveaux visés avancés d'un puis de deux combats, et poids des combats dans la compo cible relevés d'autant, ce qui resserre
  l'écart entre combats faciles et murs (80 % contre 30 % : 20 contre 70 en Normal, 40 contre 90 en Légende). Ces écarts sont un
  choix de jeu : aucune statistique publique ne sépare les difficultés.
- **Partie lue** : celle du mode à l'écran (barre de la Tour, de la campagne, vies du Nuzlocke), la plus récente à l'accueil. Entre
  deux aventures, le jeu ne réécrit la sauvegarde qu'à la première action : jusque-là, le panneau garde l'aventure précédente.
- **Champion à choisir** (4ᵉ et 5ᵉ badges) : l'en-tête montre la manche entière (« Erika ou Koga ou Morgane », taux moyen
  pondéré par les choix des joueurs), l'onglet Boss le taux de chacun, puis les trios contre le plus joué.
- **Aventures sans statistiques** (Parc Safari, Nuit à Lavanville, Team Rocket : le jeu charge leurs manches par un module chiffré)
  : compo sans trio, faite de tes meilleures unités puis de la boutique, avec objets, formation et Planificateur.
- **Planificateur** : le code est écrit en mode aventure (`xm=adv`).

## Installation (Firefox)

1. Installer [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/).
2. Ouvrir <https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js>, puis cliquer sur **Installer**.
   Les mises à jour suivent automatiquement (`@updateURL`).

## Données

Data: Kanto Tactics · [einoow.com](https://einoow.com) — API publique `https://einoow.com/api/meta/kanto/` : `campana.json`
(statistiques de la Tour et de la campagne), `data.json` (lignées, objets, recettes, types, sceaux), `lang.json?lang=fr` (noms et effets des objets, sceaux,
types). Conformément à ses conditions, chaque source est gardée **une heure** dans le Cache Storage du navigateur, puis revalidée
(`ETag`) ; en cas d'erreur, la dernière copie sert et le pied du panneau en donne la date.

L'API publique s'arrête aux règles 40 alors que la Tour tourne en 41 : quelques règles relevées dans le code du jeu sont écrites dans
le script (seuils d'XP, 1 XP gratuite par étage, chances de chaque coût en boutique par niveau, plafond d'intérêts, intérêts perdus
sur une deuxième défaite au même étage, voies et noms des bénédictions, coût, types et portée de 24 lignées, effet d'un shiny :
+10 % de PV, dégâts et défenses, transmis par la fusion). La puissance d'une unité et le seuil de 15 % sont ceux des robots du jeu.
L'écart de victoire `d` corrige la difficulté du combat, pas le niveau du joueur : une lignée que choisissent surtout les bons
joueurs paraît plus forte qu'elle n'est, d'où le décalage borné à un cran et les 400 combats fictifs. Le profil physique ou
spécial reste lu sur les objets : en v41, une quinzaine de lignées (Staross, Salamèche, Caninos, Sulfura…) changent d'attaque
selon la stat que leur donnent leurs objets, alors que `data.json` (règles 40) leur prête une seule attaque.
La courbe de niveaux visés est un choix de jeu : aucune statistique publique ne donne le niveau des joueurs en Tour. La liste des
shinies à saisir par tranche d'étages vient d'un guide et n'est pas vérifiée.
`modes.camp` ne dit ni l'aventure ni la difficulté d'un combat (`difficulty: "todas"`) : deux aventures qui partagent un arrêt
(`1:Pokémon salvajes`, `9:Pokémon salvajes` pour Kanto et « Je te choisis ! », peut-être d'autres avec les aventures chiffrées)
y sont confondues, et la table des arrêts de Cap sur
Cramois'Île et de « Je te choisis ! » ne couvre que les manches relevées dans le code du jeu.

Projet de fan, sans lien avec Einoow, Nintendo, Game Freak, Creatures ni The Pokémon Company.

## Développement

```sh
node --test test/          # logique : étage, boss, trios, noms, compo cible, économie, boutique, objets, bénédictions, code KT1, Planificateur, campagne
node scripts/preview.mjs   # pages d'aperçu par état dans build/, puis la commande de rendu imprimée
```

Maquette validée du panneau : `docs/design/mockups/2026-11-09-refonte.html` (onglets, options, verre clair et sombre) ; captures
`docs/design/captures/refonte-*.webp`.
