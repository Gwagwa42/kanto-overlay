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
- les règles d'or (intérêts, actualisation, tout jouer, shinies en Tour) du mode et de la difficulté en cours ;
- le **bilan de tes combats** : tes victoires comparées aux taux publics, qui corrige ces taux pour toi quand l'écart est établi
  (voir [Tes résultats](#tes-résultats)).

Les conseils apparaissent aussi en **pastilles** sur le jeu : ★ fais-le, ◆ si l'or le permet, ✕ évite. Survoler une pastille (ou la
sélectionner au clavier) affiche la raison ; cliquer une pastille n'achète rien.

En tête du panneau, toujours visibles : l'or à dépenser au-dessus du palier, l'alerte « tout jouer » et le prochain boss avec son
taux de victoire. Dessous, quatre onglets : **Tour** (les conseils ★ et ◆, les ✕ regroupés sous « N à éviter »), **Compo** (compo
cible, compo suivante, objets visés, copie de la formation, assassins adverses), **Boss** (taux, premier essai, essais moyens, meilleurs trios) et
**Règles** (règles d'or de la tranche, bilan de tes combats). Replié, le panneau garde l'étage, l'or à dépenser et le premier conseil ★.

Le menu ⚙ règle le thème (auto, clair, sombre), les pastilles affichées par niveau, la largeur (320 ou 380 px), la taille du texte,
l'opacité du fond (100, 90 ou 85 % : en deçà, le texte secondaire passe sous un contraste de 4,5:1 sur les zones claires du jeu en
thème sombre, sombres en thème clair) et la zone du porteur dans la formation. Sa partie Stratégie règle quatre préréglages
(voir [Stratégie](#stratégie)). Les réglages sont gardés dans le navigateur.

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

Les seuils cités ici sont ceux de la stratégie normale ; le menu ⚙ en change quatre ([Stratégie](#stratégie)).

- **Compo cible** : parmi les trios d'au moins 20 combats des 9 prochains combats (élites comprises, environ 20 étages), celui dont la
  borne basse du taux de victoire (intervalle à 95 %) est la meilleure, pondérée par la difficulté de chaque combat, avec un bonus pour
  les Pokémon que tu possèdes déjà et un malus de 10 points par Pokémon à trouver dont le coût sort à moins de 15 % en boutique à ton
  niveau. Elle ne change que pour un gain d'au moins 30 points, et repart de zéro à chaque nouvelle partie.
  Le reste du plateau est rempli par tes unités les mieux notées, puis par la boutique pour les places restantes (★ « place libre »).
  La note d'une unité est sa puissance, `(1 + 0,35 × (coût − 1))` × 1, 1,9 ou 3,6 selon l'étoile, plus 0,25 par type renforcé et
  0,5 par seuil de type franchi. Deux copies de ta meilleure étoile comptent pour l'étoile suivante, que la 3ᵉ copie donnera :
  deux Ponyta ★ ne sont pas remplacés par un Aspicot de la boutique. Le coût gagne ou perd un cran, un seul, selon l'écart de victoire de la lignée dans le mode (champ
  `d` de l'API : taux de victoire moins le taux attendu sur les mêmes combats), rétréci par 400 combats fictifs : un cran dès
  2,5 points. Sur les 85 lignées de base (novembre 2026), 3 gagnent un coût (Mystherbe, Nidoran♀, Carapuce) et 18 en perdent un
  (dont Salamèche, Pikachu, Magmar, Roucool, Abra). On lit l'écart de la forme possédée, rétréci vers celui de sa lignée de
  base pour une forme ancrée, et celui de la lignée de base pour une carte de boutique. La force de la lignée sur le prochain
  combat (victoires de ses trios d'au moins 20 combats moins celles du combat, sur toutes ses variantes à leur part, bornées
  à 20 points) ajoute 0,01 par point : ±0,2 par lignée, 0,4 au plus entre deux, à peine plus qu'un cran de coût. Un complément du conseil précédent, dans la
  même partie, garde 0,1 : il faut 10 points d'écart sur le prochain combat pour le remplacer, sinon le plan, les objets visés
  et le Planificateur changeraient à chaque combat. À égalité, l'unité possédée, la shiny, puis la lignée qui gagne le plus
  dans les trios de ces combats. Une carte de boutique mieux notée qu'un de tes compléments est conseillée en ◆ (« plus fort que Rattata ») : elle
  n'entre dans la compo qu'une fois achetée, pour que le plan ne change pas à chaque actualisation. Un complément possédé reçoit
  des objets comme les autres Pokémon de la compo.
- **Compo suivante** : le même calcul sur les 9 combats d'après (« Ensuite · étages 80–100 » sous la compo cible), affiché quand
  le trio diffère. On la prépare avec le surplus : ◆ en boutique pour ses Pokémon après ceux de la compo cible et son actualisation,
  sans passer sous le palier ni en tout jouer, et pas de « Vends » pour eux au banc tant que l'or suffit aux ★ de la compo cible.
- **Économie** : intérêts plafonnés à +3 en Tour, donc palier de 30 pièces (50 avec la voie Fortune complète). On ne dépense que le
  surplus, sauf en **tout jouer** : combat de l'étage sous 45 % de victoires, PV sous 40, ou étage rejoué après une défaite à partir
  de l'étage 50. Dans le jeu, une nouvelle défaite sur un étage rejoué supprime les intérêts de la manche et réduit son revenu de
  base dès le premier étage ; le seuil de 50 est un choix, pris là où cette défaite coûte aussi 12 PV et plus. Le revenu de base
  de la Tour monte de 4 pièces (étages 1 à 20) à 9 (à partir de l'étage 101), une défaite rapporte 2 pièces de plus, et la série
  de victoires ne rapporte rien.
- **Or au-dessus du palier** : il ne rapporte rien, il est dépensé dans cet ordre.
  1. Les achats ★ : trio, 3ᵉ copie, shiny qui devient la meilleure copie, place libre. Eux seuls peuvent faire passer sous le
     palier : une place vide ou un Pokémon du trio manquant coûte plus qu'un intérêt.
  2. L'XP jusqu'au niveau visé : 5 dès l'étage 5, 6 dès 11, 7 dès 21, 8 dès 29, 9 dès 44, 10 dès 60. Chaque niveau est visé
     un étage avant un saut de la puissance de l'équipe adverse, que le jeu fixe par étage (table `ry` de `route-*.js`, même
     formule que la puissance d'une unité) : 4,8 au boss de l'étage 5, de 7,6 à 10,7 entre les étages 11 et 12, de 17,8 à 22,3
     entre 21 et 22, de 26,4 à 31,3 entre 29 et 30, de 32,9 à 38,3 entre 44 et 45 ; le niveau 10 dès qu'il s'ouvre, à l'étage
     60. La Tour ne donne que 1 XP par étage : le niveau s'achète. Tant qu'il n'est pas atteint, le surplus y va par tranches de
     4 pièces : pas d'actualisation, et les ◆ n'ont que le reste.
  3. Les ◆ de la compo cible.
  4. L'actualisation, quand elle a au moins 10 % de chances de montrer une copie cherchée (une copie pour 20 pièces en
     moyenne) : un Pokémon du trio sous ★★, ou un Pokémon de la compo qui a 2 copies ★ ou 2 copies ★★. La chance suit les
     règles de la boutique du jeu. Chacune des 5 cases tire son coût selon ton niveau, puis sa lignée au poids des exemplaires
     restants : 26, 22, 20, 13 ou 9 par lignée selon le coût, moins 1, 3 ou 9 par copie ★, ★★ ou ★★★ que tu possèdes, et plus
     aucun pour une lignée que tu as en ★★★. La Tour compte 19, 21, 20, 14 et 3 lignées par coût, Kanto 14, 13, 12, 11 et 6. En
     Tour, le repêchage remplace en plus une case, 15 fois sur 100 (35 avec la voie Élevage complète), par une de tes lignées
     tirée au hasard. Exemple en Tour, au niveau 7 : une lignée de coût 3 dont tu as une copie sort à 8 % hors repêchage, 11 %
     avec lui si tu possèdes 4 lignées. Au niveau maximal, le trio se cherche jusqu'à ★★★ et toute chance suffit : l'or n'a
     pas d'autre emploi. Seule exception, le trio ne cherche plus la ★★★ d'une forme qu'elle affaiblit nettement dans le mode
     (intervalles à 95 % disjoints : 16 formes en novembre 2026, dont Hypotrempe, Ptitard, Psykokwak, Kabuto, Rhinocorne) ;
     deux copies ★★ font encore chercher la troisième. Sous 10 %, le premier niveau qui les donne est annoncé (« Kabuto : 4 %
     par actualisation au niveau 7 ; à chercher au niveau 9 ») ; sans un tel niveau, aucun conseil. Avec la Boîte Jetons,
     l'actualisation gratuite de chaque étage est toujours conseillée, après les achats.
  5. Les ◆ de la compo suivante.
  6. L'XP avec ce qui reste, jusqu'au niveau maximal (9, puis 10 à partir de l'étage 60).
- **Profil de chaque lignée** : tank ou attaquant, et les stats d'attaque qui la servent.
  - Tank : lu sur les objets qu'elle porte dans le mode (Tour ou campagne), quand la moitié au moins de leurs composants sont
    défensifs (PV Plus, Fer, Zinc). Exemples en Tour : Ronflex et Machop.
  - Stats d'attaque : lues dans `data.json`, selon les règles du jeu. L'Attaque porte les attaques de base de tous les Pokémon
    et les capacités physiques ; l'Atq. Spé. porte les capacités spéciales, les soins et les boucliers. La capacité du
    dernier stade dit laquelle sert la lignée : celle qu'elle suit le plus, les deux à égalité. L'Attaque sert aussi une
    lignée dont les attaques de base comptent : son Attaque atteint 0,83 fois son Atq. Spé. à un stade au moins. Mystherbe,
    Abra et Goupix sont des lanceurs (capacité spéciale, Attaque faible) : seule l'Atq. Spé. les sert. Minidraco et Machop ne
    sont servis que par l'Attaque ; Carapuce, tireur à capacité spéciale, par les deux.
  - Lignée à deux formes (Salamèche, Caninos, Stari, Sulfura… : capacité physique ou spéciale selon la stat que ses objets
    lui donnent le plus) : une seule stat la sert, celle que les joueurs lui donnent le plus dans le mode. Des objets des deux
    stats la feraient changer de capacité. Ramoloss, dont la forme suit la Défense ou la Déf. Spé., garde les stats de ses deux
    capacités.
- **Objets** : un objet ne va qu'à un Pokémon à qui il convient. S'il donne de l'Attaque ou de l'Atq. Spé., l'une des deux doit
  servir la lignée (Orbe Vie donne les deux, il va à tous). Le critique de Lentilscope ne touche que les attaques de base et
  les capacités qui le disent : il n'est pas visé pour un lanceur, mais un Lentilscope déjà porté reste (il donne aussi de
  l'Atq. Spé. et de la vitesse). Au moins la moitié de défensif pour un tank, d'offensif pour un
  attaquant. Les composants pris en compte sont ceux qui donnent ses stats à l'objet (Casque Brut : PV et Défense).
  - Pose : chaque Pokémon de la compo ne reçoit que ses objets idéaux, les 3 meilleurs couples Pokémon/objet de sa lignée dans le mode
    qui conviennent à son profil. L'objet complet, ou un composant de l'une de ces recettes, va tout de suite sur lui. Un
    composant seul donne déjà son effet et fusionne sur le Pokémon avec le suivant ; deux composants du sac pour le même Pokémon
    sont donnés en paire, avec l'ordre de pose quand il compte. Un composant dont la stat d'attaque ne sert pas le Pokémon ne
    se pose pas seul : il attend au sac l'autre composant de la recette (« Garde Protéine — pour Goupix, avec Calcium : Orbe
    Vie »). Un objet complet idéal de plusieurs Pokémon va à celui qui le
    classe le plus haut ; un composant, au premier que sa stat sert dans l'ordre porteur, tanks, attaquants (par étoiles, shiny, force de la
    lignée sur les combats de la compo cible, puis coût). 3 objets au plus.
    Un objet idéal qu'un Pokémon de la compo ne peut pas recevoir attend au sac pour lui, avant toute lignée à venir, avec la
    raison : plus de place, après l'Aimant, composant seul à fusionner d'abord, bloqué par un composant seul hors de ses
    recettes, ou à poser avec l'autre composant. Le reste
    attend aussi (« Garde Orbe Vie — hors des meilleurs objets de la compo »).
  - Préparation : un composant qui n'entre dans aucune recette idéale d'un Pokémon possédé reste au sac s'il entre dans celle
    d'un Pokémon du cœur cible pas encore acheté ou du cœur de la compo suivante, une copie par composant demandé (« Garde Fer
    — Cuiller Tordue pour Lokhlass, à venir »). La récompense d'objet vise ce qui reste à compléter, un composant
    qui se pose seul avant celui qui attendra l'autre au sac, puis ces recettes à venir.
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
    placements), puis les autres une colonne sur deux depuis cette zone. Une unité à distance évite la colonne de tout Pokémon
    déjà posé derrière l'avant, quelle que soit sa rangée : sur deux rangées voisines, deux cases de la même colonne se touchent.
    Posées depuis le banc, 4 unités à distance ne se touchent pas (3 avec la zone centre, moins si un Pokémon de mêlée déborde
    derrière l'avant ou sert d'appât au fond) ; au-delà, ou autour d'une unité qui garde sa case, elles peuvent se toucher.
  - Capacités qui dépendent des voisins (code du jeu ; deux cases sont collées quand leurs hexagones se touchent) :
    - Mew (Métronome) copie la capacité de l'allié collé qui vaut le plus (coût × 3 par étoile au-delà de la première) ; il
      se pose donc sur une case collée au Pokémon de plus grande valeur de la compo, sur sa rangée si elle le permet. Abra
      (Téléport), Métamorph (Morphing) et Magicarpe ★ (Trempette) ne se copient pas.
      Mew choisit sa copie à l'installation du combat, avant que les assassins ne partent.
    - Ramoloss (Mur Lumière) protège aussi chaque allié collé : une fois possédé, il prend le centre de l'avant, même si un
      autre Pokémon y est déjà.
    - Les assassins quittent leur case dès le début du combat (Ptéra, Taupiqueur, Doduo, Abo, Roucool, Insécateur,
      Nosferapti) : à l'avant, ils sont posés après les Pokémon qui restent, depuis les bords du plateau (colonnes 1, 7, 2,
      6…), et gardent une case des colonnes 1, 2, 6 ou 7.
    - Le Séisme de Grolem (Racaillou ★★★ ; Éboulement, à ★★, ne touche pas les alliés) inflige 25 % de ses dégâts aux alliés
      collés : il est posé au bord avant les assassins, colonne 1 d'abord (deux cases alliées collées, trois en colonne 7).
    - Les bonus de types ne dépendent pas des cases : seuls les Électrik électrocutent les ennemis collés, ce qui ne change
      rien pour une unité de mêlée, déjà à l'avant.
  - Assassins adverses (case de l'onglet Compo, à cocher quand l'adversaire affiché en aligne ; elle vaut pour le combat en
    cours et se vide au suivant). Le panneau ne lit pas l'équipe adverse : elle n'est ni dans la sauvegarde ni dans la page,
    le jeu la calcule à partir de la graine de la partie. Règles du moteur : Insécateur, Doduo et Abo plongent sur ton
    Pokémon le plus au fond (à rangée égale, celui qui a le moins de PV ; Abo, dans la moitié du plateau par où il entre, la
    colonne 4 comptant dans les deux) ; Nosferapti, sur le plus au fond de la colonne la plus proche de la sienne. La parade
    pose donc un appât plus au fond que le porteur à distance, dans la même moitié que lui : le porteur du fond avance en
    3ᵉ rangée, dans sa zone et hors de la colonne 4 s'il le peut, et l'appât prend le fond, colonne 4 d'abord, puis du côté
    du porteur, sur une case qui ne le touche pas quand il y en a une (l'assassin arrivé sur l'appât se retournerait vers
    son voisin). L'appât est un Pokémon que tu possèdes : celui qui est déjà plus au fond que le porteur (de l'autre côté, il est ramené du sien), sinon
    le tank de moindre valeur s'il en reste un devant, sinon l'unité de mêlée de plus grande valeur s'il en reste une devant,
    sinon l'unité à distance de plus grande valeur ; jamais Ramoloss ni un de tes assassins. La parade prime sur la zone du
    porteur et sur une case déjà occupée ; une parade déjà posée sur le plateau ne donne aucun déplacement. Les autres
    Pokémon se placent ensuite autour du porteur et de l'appât : celui qui débordait derrière un avant plein y revient quand
    l'appât libère sa case, et une unité à distance plus au fond que le porteur évite les cases qui le touchent. Sans porteur à
    distance, sans appât ou sans case libre, la formation ne change pas et le panneau le dit. Limites : contre Nosferapti,
    le porteur reste exposé s'il est le plus au fond de la colonne visée ; un porteur en colonne 4 touche son appât ; Mew,
    placé après les autres, collé à son modèle, n'est ni couvert ni appât (porteur, il n'a pas de parade) ; Taupiqueur (PV max les plus bas) et Roucool (plus grande valeur)
    visent sans regarder les cases.
  - Hors des cas ci-dessus, un Pokémon déjà sur sa rangée garde sa case ; le porteur à distance, seulement dans les colonnes de sa zone. Les déplacements
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

### Stratégie

Quatre préréglages du menu ⚙, « Normal » par défaut. Ce sont des choix de jeu : aucune statistique publique ne les départage.
Changer un préréglage recalcule tout de suite les conseils et les règles d'or.

| Réglage | Valeurs | Effet |
| --- | --- | --- |
| Niveaux visés | Plus tôt, Normal, Plus tard | Étage (ou combat) de chaque niveau visé × 0,75, 1 ou 1,25, arrondi. Tour plus tôt : 5 dès l'étage 4, 6 dès 8, 7 dès 16, 8 dès 22, 9 dès 33, 10 dès 60 ; plus tard : 6, 14, 26, 36, 55, 75. Campagne plus tôt : 3, 6, 9, 12, 18, 23 ; plus tard : 5, 10, 15, 20, 30, 38, sous la taille des équipes des champions (8 au 6ᵉ badge, 9 contre Mewtwo). Le niveau maximal ne change pas : le niveau 10 n'est jamais visé avant l'étage 60 en Tour. |
| Tout jouer | Prudent, Normal, Audacieux | Combat sous 50, 45 ou 40 % de victoires (plus la pénalité de difficulté en campagne et l'écart appris sur [tes résultats](#tes-résultats)), PV sous 50, 40 ou 30. Le combat rejoué ne change pas. |
| Compo cible | Réactive, Normale, Stable | Combats vus d'avance (6, 9 ou 12, la compo suivante sur autant d'après) et gain minimal pour changer de trio (15, 30 ou 45 points). |
| Bonus des Pokémon possédés | Faible, Normal, Fort | Points par Pokémon du trio possédé, puis encore à ★★ (5, 10 ou 20), et malus d'un Pokémon à trouver introuvable à ton niveau (autant). Avec Faible et une compo Stable, un trio ★★ possédé (+30) ne remplace plus le trio en cours (inertie 45) pour un écart de moins de 15 points. |

### Tes résultats

Le panneau note le résultat de chaque combat joué avec lui et apprend de l'écart entre tes victoires et les taux publics.

- **Journal** : à chaque combat fini, une ligne dans le navigateur (`localStorage`, clé `kt-overlay:journal`) : la partie, la
  Tour ou l'aventure et sa difficulté, l'étage ou le combat, le taux attendu (taux public, moins 10 ou 20 points en Vétéran et en Légende), le
  résultat, si le trio de la compo cible était posé à la dernière lecture avant le combat et, à cette lecture, ton niveau, le
  niveau visé, ton or et tes PV, avec la version du script et les quatre préréglages de stratégie (ces six champs manquent aux
  combats notés avant la version 2.11.0). Le résultat se lit dans la
  sauvegarde du jeu, relue toutes les 2 s : la série de victoires (`streak`) change à chaque combat, et la partie avance d'une
  manche ou compte un essai de plus. Le journal garde les 300 derniers combats de la Tour et de chaque aventure à chaque difficulté, pour suivre ton
  niveau et les rééquilibrages du jeu ; rien ne quitte le navigateur.
- **Bilan** (onglet Règles) : pour la Tour, ou pour l'aventure et la difficulté en cours, tes victoires, les victoires attendues (somme des taux) et la
  marge à 95 % sur cette somme, puis les mêmes chiffres avec et sans le trio de la compo cible posé, et au niveau visé ou en
  dessous. Ces lignes décrivent, sans départager : on s'écarte du conseil surtout quand la partie va déjà mal.
- **Écart appris** : la moyenne de (résultat − taux attendu), rétrécie par 50 combats fictifs sans écart et bornée à 20 points.
  Il s'ajoute à la pénalité de difficulté : seuil de « tout jouer », couleur des taux, poids des combats dans la compo cible et,
  en campagne, avance des niveaux visés.
  Avec 30 victoires pour 50 attendues sur 100 combats, les taux comptent 13 points de moins : tout jouer sous 58 % au lieu de
  45 %, ce que l'en-tête rappelle (« Tour · tout jouer sous 58 % »). Les taux affichés restent les taux publics. Il n'y a pas de
  seuil en deçà duquel l'écart serait ignoré : il ferait sauter les conseils d'une dizaine de points sur un seul combat. Un
  combat de plus déplace l'écart de 2 points au plus, et la chance seule en laisse environ 3 après 100 combats, 2,5 après 300.
- **Ce que le panneau n'apprend pas** : les préréglages de stratégie, le choix du trio et les objets restent fixés par les
  statistiques publiques. À quelques parties par semaine, les résultats d'un joueur ne départagent pas ces choix avant le
  rééquilibrage suivant du jeu.
- **Limites** : les combats d'une même partie se ressemblent (même équipe), la marge affichée est donc trop étroite. Le dernier
  combat d'une partie n'est noté qu'en Tour, où le jeu garde la liste des parties finies (`kanto-tactics:tower-runs`) ; en
  campagne, la sauvegarde disparaît à la défaite finale, à la victoire finale et à l'abandon, et ce combat manque au bilan : une
  défaite par partie perdue, une victoire par aventure finie. Un combat joué panneau fermé, à un étage saisi à la main ou sans
  taux public d'au moins 20 combats n'est pas noté. Pour repartir de zéro : supprimer la clé `kt-overlay:journal` dans le
  stockage du site, puis recharger la page.

### Campagne

Mêmes conseils qu'en Tour, sur les combats de l'aventure en cours, avec les règles de la campagne relevées dans le code du jeu :
- **Combats** : le combat N est la manche N − 1 de la sauvegarde. Les statistiques `modes.camp` mêlent toutes les aventures ; le
  panneau garde les combats de la tienne (table relevée dans le jeu pour Kanto, Cap sur Cramois'Île et « Je te choisis ! »). Une
  manche aux variantes tirées au sort (combat 11 : Marin, Gentleman ou Pêcheur) compte chacune selon sa part des combats. Aux
  4ᵉ, 5ᵉ et 6ᵉ badges, le champion est celui que tu as choisi (`gymOrder`), sinon un de ceux qui restent.
- **Boss** (Kanto) : les 8 badges, le Conseil 4, le Maître de la Ligue et Mewtwo ; dans les autres aventures, chaque combat.
- **Économie** : intérêts plafonnés à +4, donc palier de 40 pièces ; +1 pièce par victoire à partir de la 2ᵉ de suite ; 2 XP
  gratuites par manche, niveau 9 au plus. Niveaux visés
  (choix de jeu, d'après la taille des équipes des champions) : 4 dès le combat 4, 5 dès 8, 6 dès 12, 7 dès 16, 8 dès 24, 9 dès 30.
  Sur un combat obligatoire (badge, Ligue, boss), une deuxième défaite ne rapporte plus d'intérêts : un combat rejoué se joue à fond
  dès le premier échec. Ni bénédiction ni sceau.
- **Difficulté** : lue dans la sauvegarde (Normal, Vétéran, Légende) et affichée en tête du panneau. Les taux de l'API mêlent les
  trois ; or le jeu renforce les adversaires (textes du jeu, roster-*.js : en Vétéran, rivaux +5 % à toutes les stats, équipes
  variées et objets ; au-delà, as à une étoile de plus, objets combinés, boucliers et rage des boss, selon l'aventure). Le panneau
  retire donc 10 puis 20 points au taux de chaque combat : « tout jouer » sous 55 puis 65 %, couleur des taux en conséquence,
  poids des combats dans la compo cible relevés d'autant, ce qui resserre l'écart entre combats faciles et murs (80 % contre
  30 % : 20 contre 70 en Normal, 40 contre 90 en Légende), et niveaux visés avancés d'un combat par 10 points, de 0 à 2. Ces
  écarts sont un choix de jeu : aucune statistique publique ne sépare les difficultés. L'écart appris sur [tes
  résultats](#tes-résultats), compté par aventure et difficulté, corrige la pénalité : avec 6 victoires de moins qu'attendu sur
  50 combats en Vétéran, elle passe de 10 à 16 points, et les niveaux visés de 1 à 2 combats d'avance.
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

`data.json` s'arrête aux règles 40 alors que le jeu tourne en 41 : quelques règles relevées dans le code du jeu sont écrites dans
le script (seuils d'XP, 1 XP gratuite par étage, chances de chaque coût en boutique par niveau, exemplaires par lignée, lignées
en boutique par coût, repêchage, actualisation gratuite de la Boîte Jetons, plafond d'intérêts, intérêts perdus sur une
deuxième défaite au même étage, or de série en campagne, voies et noms des bénédictions, coût, types, portée et stats
d'attaque utiles de 24 lignées, effet d'un shiny : +10 % de PV, dégâts et défenses, transmis par la fusion, série de victoires
changée à chaque combat, sauvegarde supprimée à la défaite finale). La puissance d'une unité et le seuil de 15 % du malus de la
compo cible sont ceux des robots du jeu. Le script ignore l'XP de Multi Exp (+1 par manche et par exemplaire) et les lignées
bannies de la semaine en Tour, qui ne changent aucun conseil ou presque.
L'écart de victoire `d` corrige la difficulté du combat, pas le niveau du joueur : une lignée que choisissent surtout les bons
joueurs paraît plus forte qu'elle n'est, d'où le décalage borné à un cran et les 400 combats fictifs. L'API ne publie
ni le rôle d'une lignée (mage, tireur, tank…) ni les capacités qui peuvent être critiques. Que ses attaques de base comptent se
lit donc sur ses stats : le rapport de l'Attaque à l'Atq. Spé. va de 0,31 à 0,76 pour les mages et les soutiens, de 0,90 à 2,35
pour les autres rôles (novembre 2026), d'où le seuil de 0,83. Le critique n'est compté que pour les attaques de base.
La courbe de niveaux visés reste un choix de jeu : aucune statistique publique ne donne le niveau des joueurs, et la puissance
adverse ne dit que l'étage où le niveau suivant compte. La courbe des robots du jeu (`engine-*.js`) sert le PvP, dont
l'économie diffère (2 XP par manche, or de série). La liste des
shinies à saisir par tranche d'étages vient d'un guide et n'est pas vérifiée.
`modes.camp` ne dit ni l'aventure ni la difficulté d'un combat (`difficulty: "todas"`) : deux aventures qui partagent un arrêt
(`1:Pokémon salvajes`, `9:Pokémon salvajes` pour Kanto et « Je te choisis ! », peut-être d'autres avec les aventures chiffrées)
y sont confondues, et la table des arrêts de Cap sur
Cramois'Île et de « Je te choisis ! » ne couvre que les manches relevées dans le code du jeu.

Projet de fan, sans lien avec Einoow, Nintendo, Game Freak, Creatures ni The Pokémon Company.

## Développement

```sh
node --test test/          # logique : étage, boss, trios, noms, compo cible, économie, boutique, objets, bénédictions, code KT1, Planificateur, campagne, événements du panneau, journal des combats, parade aux assassins adverses
node scripts/preview.mjs   # deux pages par état dans build/, puis les commandes de rendu des pages panneau
```

`build/panel-<état>.html` montre le panneau seul, statique (environ 30 Ko) : `render-html.sh` (skill `ui-design`, lancé hors du
sandbox) la rend telle quelle. `build/preview-<état>.html` monte le vrai script sur un décor du jeu, pastilles comprises ; elle
pèse plus de 160 Ko, au-delà de ce qu'accepte une URL `data:`. Elle s'ouvre servie en local :
`python3 -m http.server 8765 --bind 127.0.0.1 --directory build`, puis `http://127.0.0.1:8765/preview-<état>.html` dans Chrome.

Les règles v41 absentes de l'API (`LINES_V41`, `ADVENTURES`, barèmes) se relèvent dans le code du jeu, en lecture statique :
`curl -sL https://einoow.com/playables/kanto-tactics/index.html` donne les modules `assets/*.js` (noms hachés, changés à chaque
version) ; les modules chargés à la demande se trouvent en suivant les `"./x.js"` des modules déjà téléchargés. Lignées et
capacités : `roster-*.js` ; règles de la Tour et lignées ajoutées : `route-*.js`, où la définition propre d'une lignée (`_s`)
l'emporte sur sa ligne de base (`role: o.role ?? e.role, range: o.range ?? e.range`). Manches de campagne : `route-*.js`, tables
`ul` (Kanto, Cap sur Cramois'Île, « Je te choisis ! ») ; un arrêt de `campana.json` vaut `manche + 1:` suivi de la fin du nom
espagnol de la manche, après le dernier « · ». Safari, Lavanville et Team Rocket chargent leurs manches par un module chiffré
(`start-*.js`). Ne pas exécuter les modules téléchargés.

Maquette validée du panneau : `docs/design/mockups/2026-11-09-refonte.html` (onglets, options, verre clair et sombre) ; captures
`docs/design/captures/refonte-*.webp`.
