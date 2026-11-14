// ==UserScript==
// @name         Kanto Tactics — panneau Tour et campagne
// @namespace    https://github.com/Gwagwa42/kanto-overlay
// @version      2.12.0
// @description  Tour de combat et campagne (aventures, trois difficultés) de Kanto Tactics : prochain boss, meilleurs trios, et conseils d'achat, d'objets, de formation et de bénédictions lus sur ta partie (données publiques einoow.com).
// Pages d'entrée qui chargent l'application du jeu ; le jeu change de mode sans changer d'adresse.
// @match        https://einoow.com/playables/kanto-tactics/*
// @match        https://einoow.com/
// @match        https://einoow.com/?*
// @match        https://einoow.com/kanto-tactics
// @match        https://einoow.com/kanto-tactics?*
// @match        https://einoow.com/tower
// @match        https://einoow.com/tower?*
// @match        https://einoow.com/pvp
// @match        https://einoow.com/pvp?*
// @match        https://einoow.com/duo
// @match        https://einoow.com/duo?*
// @match        https://einoow.com/nuzlocke
// @match        https://einoow.com/nuzlocke?*
// @noframes
// @grant        none
// @inject-into  content
// @run-at       document-idle
// @homepageURL  https://github.com/Gwagwa42/kanto-overlay
// @updateURL    https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js
// @downloadURL  https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js
// ==/UserScript==
'use strict';

const KT = (() => {
  // Version du script, notée dans le journal des combats ; égale à @version (un test le vérifie) : GM_info n'est pas garanti
  // avec @grant none.
  const VERSION = '2.12.0';
  const API = 'https://einoow.com/api/meta/kanto/';
  const SOURCES = { stats: `${API}campana.json`, data: `${API}data.json`, lang: `${API}lang.json?lang=fr` };
  const CACHE_NAME = 'kt-overlay';
  // Conditions de l'API : au plus une requête par heure, avec un cache côté client.
  const CACHE_MAX_AGE = 3600 * 1000;
  // Sauvegardes du jeu (store-*.js) : seule celle de la partie jouée est réécrite, d'où le savedAt le plus récent (latestSave).
  // Le Nuzlocke, non pris en charge, en fait partie : il est dit tel quel plutôt que de recevoir les conseils de la dernière
  // partie Kanto.
  const SAVE_TOWER = 'kanto-tactics-save-tower';
  const SAVE_KANTO = 'kanto-tactics-save';
  const SAVE_ADV = 'kanto-tactics-save-adv-';
  const SAVE_NUZLOCKE = 'kanto-tactics-save-nuzlocke';
  // Le Nuzlocke a la barre de progression de la campagne ; ses vies, à la place des PV, le distinguent (GameLayer-*.js).
  const NUZLOCKE_HUD = '.topbar .nz-lives';
  const UI_KEY = 'kt-overlay:ui';
  // Nom du plan dans le Planificateur du jeu : il distingue le plan du panneau des plans du joueur.
  const PLAN_NAME = 'Plan kanto-overlay';
  // Le jeu numérote les manches de la Tour à partir de 1000 : étage = round − 1000 + 1 (assets/route-*.js).
  const ROUND_BASE = 1000;
  const MIN_FIGHTS = 20;
  // Difficulté de la campagne (league de la sauvegarde) : l'API mélange les trois (difficulty « todas »), ses taux surestiment
  // Vétéran et Légende. Points retirés au taux de chaque combat par cran de difficulté (choix de jeu, aucune statistique par
  // difficulté) : « tout jouer » sous 45, 55 puis 65 % en stratégie normale. Les niveaux visés avancent avec la pénalité
  // (advanceOf).
  const LEAGUES = { 1: 'Normal', 2: 'Vétéran', 3: 'Légende' };
  const LEAGUE_PENALTY = 10;
  // Stratégie réglable dans le menu ⚙ (choix de jeu, aucune statistique ne les départage), mêmes champs qu'OPTIONS ; le
  // troisième élément de chaque valeur rejoint le mode (withStrategy). Valeurs normales :
  // - pace : facteur sur l'étage de chaque niveau visé (levelGoals des règles du mode) ;
  // - hardWin, lowHp : « tout jouer » sous ce taux de victoire du combat (%) ou sous ces PV ;
  // - horizon, inertia : combats vus d'avance (9 ≈ 20 étages, élites comprises) et gain minimal pour changer de trio ;
  // - ownedBonus : par Pokémon possédé, puis encore à ★★ ; aussi le malus d'un Pokémon à trouver introuvable à ton niveau.
  //   En normal, un trio monté en ★★ (+60) l'emporte sur l'inertie.
  const STRATEGY = [
    { key: 'pace', label: 'Niveaux visés', values: [['early', 'Plus tôt', { pace: 0.75 }], ['normal', 'Normal', { pace: 1 }], ['late', 'Plus tard', { pace: 1.25 }]], def: 'normal' },
    { key: 'allIn', label: 'Tout jouer', values: [['careful', 'Prudent', { hardWin: 50, lowHp: 50 }], ['normal', 'Normal', { hardWin: 45, lowHp: 40 }], ['bold', 'Audacieux', { hardWin: 40, lowHp: 30 }]], def: 'normal' },
    { key: 'comp', label: 'Compo cible', values: [['reactive', 'Réactive', { horizon: 6, inertia: 15 }], ['normal', 'Normale', { horizon: 9, inertia: 30 }], ['stable', 'Stable', { horizon: 12, inertia: 45 }]], def: 'normal' },
    { key: 'owned', label: 'Bonus des Pokémon possédés', values: [['low', 'Faible', { ownedBonus: 5 }], ['normal', 'Normal', { ownedBonus: 10 }], ['high', 'Fort', { ownedBonus: 20 }]], def: 'normal' },
  ];
  const STRATEGY_DEFAULTS = Object.fromEntries(STRATEGY.map(o => [o.key, o.def]));
  // Shiny : +10 % de PV, dégâts et défenses (makeUnit du jeu) ; bonus de trio bien sous une copie possédée et sous l'inertie.
  const SHINY_BONUS = 2;
  const SHINY_HP = 1.1;
  // Pas de « Vends » pour un shiny jusqu'à cet étage (choix de jeu : tranches du guide où on les ramasse sans condition d'économie).
  const SHINY_KEEP_TO = 120;
  // Règles de la Tour v41 lues dans le code du jeu (route-*.js) : absentes de l'API publique.
  const XP_TO_NEXT = [0, 2, 4, 8, 12, 16, 24, 40, 96, 120];
  const XP_COST = 4;
  const REROLL_COST = 2;
  const BASE_INTEREST = 3;
  const FORTUNE_INTEREST = 2;
  const PATH_SIZE = 3;
  // Chances (%) des coûts 1 à 5 en boutique selon le niveau du joueur.
  const SHOP_ODDS = {
    1: [100, 0, 0, 0, 0], 2: [100, 0, 0, 0, 0], 3: [75, 25, 0, 0, 0], 4: [60, 30, 10, 0, 0], 5: [50, 36, 13, 1, 0],
    6: [36, 42, 19, 3, 0], 7: [22, 32, 34, 12, 0], 8: [14, 22, 32, 26, 6], 9: [6, 14, 27, 36, 17], 10: [4, 10, 24, 42, 20],
  };
  // Boutique (route-*.js, gm et pm) : SHOP_SLOTS cases ; chaque lignée a SHOP_COPIES[coût − 1] exemplaires, moins 3^(★−1)
  // par copie possédée, et une case tire sa lignée au poids des exemplaires restants.
  const SHOP_SLOTS = 5;
  const SHOP_COPIES = [26, 22, 20, 13, 9];
  // Repêchage de la Tour (shop-*.js, Tt) : à chaque boutique, avec cette chance, une case devient une lignée possédée tirée
  // au hasard ; la voie Élevage complète ajoute BREED_REDRAW.
  const TOWER_REDRAW = 0.15;
  const BREED_REDRAW = 0.2;
  // Chance (%) de voir une copie cherchée à partir de laquelle une actualisation se conseille : une copie pour 20 pièces en
  // moyenne (choix de jeu).
  const REROLL_CHANCE = 10;
  // Chance d'un coût en boutique sous laquelle un Pokémon du trio à trouver vaut un malus (seuil des robots du jeu, engine-*.js).
  const FINDABLE = 15;
  // Niveau 10 ouvert à partir de cet étage.
  const LEVEL_10_FROM = 60;
  // Niveau visé à partir d'un étage (choix de jeu) : la Tour ne donne que 1 XP par étage, le niveau s'achète. Chaque niveau
  // est visé un étage avant un saut de la puissance adverse (table ry de route-*.js, même formule que unitPower) : 4,8 à
  // l'étage 5, 7,6 puis 10,7 aux étages 11 et 12, 17,8 puis 22,3 aux étages 21 et 22, 26,4 puis 31,3 aux étages 29 et 30,
  // 32,9 puis 38,3 aux étages 44 et 45 ; le niveau 10 dès qu'il s'ouvre (37,4 puis 42,5 aux étages 59 et 60). Les autres
  // sauts ne déplacent aucun niveau : celui de l'étage 15 (10,9 puis 14,7) tombe entre les niveaux 6 et 7, ceux des boss
  // des étages 35 et 55 retombent à l'étage suivant.
  const LEVEL_GOALS = [[5, 5], [11, 6], [21, 7], [29, 8], [44, 9], [60, 10]];
  // Campagne Kanto (choix de jeu) : 2 XP gratuites par combat, niveau 9 au plus ; un niveau au moins égal à la taille de
  // l'équipe du champion : Pierre 2, Ondine 3, Major Bob 4, 4ᵉ badge 5, 5ᵉ 6, 6ᵉ 8, Conseil 4 et Mewtwo 9 (route-*.js).
  const CAMPAIGN_LEVEL_GOALS = [[4, 4], [8, 5], [12, 6], [16, 7], [24, 8], [30, 9]];
  // Un étage rejoué se joue à fond à partir de celui-ci (choix de jeu). Dès le premier étage, une nouvelle défaite sur un étage
  // rejoué supprime les intérêts et réduit le revenu de base (Oh, route-*.js) ; à partir d'ici, elle coûte aussi 12 PV et plus.
  const RETRY_ALL_IN_FROM = 50;
  // Puissance d'une unité selon son coût et son étoile (estimation des robots du jeu, engine-*.js) ; un point de traitGain
  // vaut TRAIT_WEIGHT.
  const COST_POWER = 0.35;
  const STAR_POWER = [1, 1.9, 3.6];
  const TRAIT_WEIGHT = 0.25;
  // Écart de victoire d'une forme (lines.d : taux de victoire moins taux attendu sur les ne combats qui en ont un ; corrigé de
  // la difficulté des combats, pas du niveau des joueurs), rétréci par LINE_PRIOR combats fictifs, le seuil minFlag de l'API.
  // À partir de SHIFT_GAP points, la forme gagne ou perd un coût, un seul : SHIFT_GAP vaut environ le quart de l'étendue de d
  // entre les lignées d'un même coût (−5,3 à +5,1, novembre 2026). Au-delà d'un cran, un biais de sélection (qui joue la
  // lignée) pèserait autant que le coût.
  const LINE_PRIOR = 400;
  const SHIFT_GAP = 2.5;
  // Force d'une lignée sur le prochain combat (lineStrength, en points), bornée à NEXT_FIGHT_CAP et comptée NEXT_FIGHT_WEIGHT
  // par point dans la note d'un complément : ±0,2 par lignée, 0,4 au plus entre deux, à peine plus qu'un cran de coût (0,35)
  // et seulement entre une lignée parmi les plus fortes du combat et une parmi les plus faibles. La moitié des lignées d'un combat s'écartent de plus de 5 points (fixture du 10 novembre 2026),
  // un sur dix de plus de 20. Un complément du conseil précédent garde FILLER_INERTIA : il faut 10 points d'écart sur le
  // prochain combat pour le remplacer, sinon le plan, les objets visés et le Planificateur changeraient à chaque combat.
  const NEXT_FIGHT_WEIGHT = 0.01;
  const NEXT_FIGHT_CAP = 20;
  const FILLER_INERTIA = 0.1;
  const MAX_ITEMS = 3;
  // Composants défensifs ; Protéine (Attaque), Calcium (Atq. Spé.) et Carbone (vitesse d'attaque) sont offensifs.
  const DEFENSE = ['hp-up', 'iron', 'zinc'];
  // Composant d'attaque → stat du profil (attackKit) qu'il augmente.
  const ATTACK = { protein: 'atk', calcium: 'spa' };
  // Attaque rapportée à l'Atq. Spé. à partir de laquelle les attaques de base d'une lignée comptent (attackKit) : mages,
  // soutiens et Voltorbe vont de 0,31 à 0,76, les autres rôles de 0,90 à 2,35 (data.json, novembre 2026).
  const BASIC_RATIO = 0.83;
  // Part de composants défensifs dans les objets qu'une lignée porte en Tour à partir de laquelle elle est un tank : Ronflex 0,94,
  // Machop 0,56, Caninos 0,48, Minidraco 0,40 (campana.json, novembre 2026).
  const TANK_SHARE = 0.5;
  // Bénédictions de la Tour v41 (absentes de l'API) → voie (null : hors voie) et nom ; ordre = préférence à égalité.
  const BOONS = {
    coincase: ['fortune', 'Boîte Jetons'], nugget: ['fortune', 'Maxi Pépite'], fbag: ['fortune', 'Sac de Jetons'],
    flute: ['combat', 'Poké Flûte'], vitamins: ['combat', 'Sac de vitamines'], item: ['combat', 'Cadeau'],
    ash: ['endure', 'Cendre Sacrée'], hpup: ['endure', 'PV Plus'], leftovers: ['endure', 'Restes'],
    moonstone: ['breed', 'Pierre Lune'], candy: ['breed', 'Super Bonbon'], expshare: ['breed', 'Multi Exp'], egg: ['breed', 'Œuf Mystère'],
    master: ['legend', 'Master Ball'], trail: ['legend', 'Piste Légendaire'],
    amulet: [null, 'Pièce Rune'], team: [null, 'Entraînement d’équipe'], potion: [null, 'Potion Max'], wonder: [null, 'Échange Miracle'],
  };
  const boonPath = id => BOONS[id]?.[0] ?? null;
  const HEAL_BOONS = ['potion', 'hpup', 'leftovers', 'ash'];
  const PATH_ORDER = ['fortune', 'combat', 'endure', 'breed', 'legend'];
  const PATH_NAMES = { fortune: 'Fortune', combat: 'Combat', endure: 'Endurance', breed: 'Élevage', legend: 'Légende' };
  const PATH_BONUS = {
    fortune: 'intérêts max +2 : palier 50 pièces au lieu de 30', combat: 'bouclier de 10 % au début de chaque combat',
    endure: '+20 PV max', breed: '+20 % d’affinité en boutique', legend: 'cadeaux de colosse avec +1★',
  };

  const BOSSES = {
    aerodactyl: 'Ptéra', agatha: 'Agatha', arcanine: 'Arcanin', aves: 'Oiseaux légendaires', blaine: 'Auguste',
    brock: 'Pierre', bruno: 'Aldo', campeon: 'Maître de la Ligue', capitan: 'Capitaine', cientifico: 'Scientifique',
    cloyster: 'Crustabri', ditto: 'Métamorph', dragonite: 'Dracolosse', elite: 'Élite', erika: 'Erika', gengar: 'Ectoplasma',
    giovanni: 'Giovanni', giovanni2: 'Giovanni (revanche)', gyarados: 'Léviator', iniciales: 'Pokémon de départ',
    karateka: 'Karatéka', koga: 'Koga', lance: 'Peter', lapras: 'Lokhlass', lorelei: 'Olga', machamp: 'Mackogneur',
    magneton: 'Magnéton', marowak: 'Ossatueur', mew: 'Mew', mewtwo2: 'Mewtwo', missingno: 'MissingNo.', misty: 'Ondine',
    onix: 'Onix', pescador: 'Pêcheur', recluta: 'Sbire Rocket', rhydon: 'Rhinoféros', rival: 'Rival', sabrina: 'Morgane',
    snorlax: 'Ronflex', surge: 'Major Bob', zapdos: 'Électhor',
  };

  // Campagne : modes.camp de l'API mélange les aventures, sous des arrêts « N:Libellé » (N = manche + 1, libellé = fin du nom
  // espagnol de la manche jouée, après le dernier « · »). Arrêts possibles de chaque aventure, relevés dans les manches du jeu
  // (route-*.js, ul) ; les événements n'ont pas de statistiques. Safari, Lavanda et Rocket chargent leurs manches par un module
  // chiffré : absentes, elles reçoivent une compo sans trio (targetComp). Méthode de relevé : README, Développement. bosses :
  // manches boss: du jeu (badge, Ligue, Mewtwo, chefs d'aventure) ; sans liste, chaque combat compte comme boss. canLose : boss
  // que le jeu laisse perdre sans les rejouer (canLose: de la manche). gyms : manches des champions dont l'ordre suit gymOrder
  // de la sauvegarde. shopLines, shopOut : boutique de l'aventure quand elle n'est pas celle de Kanto (ul de route-*.js :
  // Cramois'Île retire les 22 lignées de Cc et ajoute les 22 de wc) ; celles de Safari, Lavanda et Rocket sont chiffrées,
  // comptées comme celle de Kanto. levelGoals : niveaux visés de l'aventure, à la place de ceux de la campagne Kanto. events :
  // options des événements à choix (eventMarks), dans l'ordre des cartes du jeu.
  const ADVENTURES = {
    kanto: {
      name: 'Kanto',
      stops: {
        1: ['Pokémon salvajes'], 2: ['Bosque Verde', 'Pikachu salvaje'], 4: ['Brock'], 5: ['Pokémon salvajes'],
        6: ['Team Rocket', 'Montañero', 'Cazabichos'], 7: ['Rival Azul'], 8: ['Misty'], 9: ['Pokémon salvajes'],
        11: ['Marinero', 'Caballero', 'Pescador'], 12: ['Teniente Surge'], 13: ['Montañero', 'Pokémaníaco', 'Entrenadora'],
        15: ['Recluta'], 16: ['Erika', 'Koga', 'Sabrina'], 17: ['Médium', 'Recluta'], 18: ['Pescador', 'Ornitólogo', 'Calvo', 'Entrenadora'],
        20: ['Erika', 'Koga', 'Sabrina'], 21: ['Nadador', 'Ornitólogo'], 23: ['Recluta', 'Científico', 'Malabarista'],
        24: ['Erika', 'Koga', 'Sabrina'], 25: ['Ladrón', 'Científico'], 26: ['Blaine'], 27: ['Pescador', 'Nadador', 'Calvo'],
        28: ['Giovanni'], 29: ['Rival Azul'], 30: ['Entrenador Guay', 'Ornitólogo'], 31: ['Karateka', 'Domador', 'Malabarista', 'Entrenador Guay'],
        33: ['Lorelei'], 34: ['Bruno'], 35: ['Agatha'], 36: ['Lance'], 37: ['Azul'], 38: ['Mewtwo'],
      },
      bosses: [4, 8, 12, 16, 20, 24, 26, 28, 33, 34, 35, 36, 37, 38],
      gyms: { 16: 0, 20: 1, 24: 2 },
    },
    canela: {
      name: 'Cap sur Cramois’Île',
      stops: {
        1: ['Bajada'], 2: ['Motero'], 4: ['Pokémon salvajes'], 6: ['Macarra'], 8: ['Jefe de los moteros'], 9: ['Playa'],
        10: ['Nadadora'], 12: ['Nadador'], 14: ['Pareja de nadadores'], 16: ['Entrada'], 17: ['Corrientes'], 19: ['Articuno'],
        20: ['Atrapados en el hielo'], 21: ['Puerto'], 22: ['Científico'], 24: ['Ladrón'], 27: ['Rival Azul'], 29: ['Sótano'],
        30: ['El fósil despierta'],
      },
      bosses: [8, 19, 27, 29, 30],
      canLose: [19],
      // Niveau égal à la taille de l'équipe adverse (route-*.js : 4 unités au combat 6, 5 au 8, 6 au 14, 8 au 24) ; 7 dès
      // Artikodin pour étaler l'achat avant le saut du combat 24. Aucun 9 : aucune équipe n'en aligne autant.
      levelGoals: [[6, 4], [8, 5], [14, 6], [19, 7], [24, 8]],
      // Événements choice de route-*.js (Is) : coût en PV (hpCost), en pièces (goldCost), XP gagnée, Pokémon reçu (mon) ;
      // detail : ligne de preuve de la bulle.
      events: {
        5: [{ name: 'Excelangue', mon: 'lickitung' }, { name: 'Canarticho', mon: 'farfetchd', xp: 2 }],
        13: [{ name: 'Traverser maintenant', xp: 4, hpCost: 6 },
          { name: 'Attendre la marée basse', goldCost: 4, detail: 'Marée basse : pas de pluie aux combats 14 et 16.' }],
        23: [{ name: 'Fossile Hélix', mon: 'omanyte', detail: 'L’autre fossile se réveille au combat 30 : Kabutops ★3.' },
          { name: 'Fossile Dôme', mon: 'kabuto', detail: 'L’autre fossile se réveille au combat 30 : Amonistar ★3.' }],
        26: [{ name: 'Lire le journal', xp: 6, hpCost: 5 }, { name: 'Emporter le carnet' }],
      },
      shopLines: [13, 14, 12, 11, 6],
      shopOut: ['squirtle', 'caterpie', 'rattata', 'magikarp', 'zubat', 'oddish', 'gastly', 'poliwag', 'ekans', 'jigglypuff', 'paras', 'eevee',
        'slowpoke', 'scyther', 'hitmonlee', 'hitmonchan', 'jynx', 'seel', 'cubone', 'chansey', 'staryu', 'tauros'],
    },
    inicio: {
      name: 'Je te choisis !',
      stops: {
        1: ['Pokémon salvajes'], 2: ['Hierba alta'], 3: ['Rival Azul'], 4: ['La bandada de Spearow'], 6: ['¡El Team Rocket!'],
        9: ['Pokémon salvajes'], 10: ['El enjambre'], 11: ['Cazabichos'], 13: ['El Samurái'],
      },
    },
    safari: { name: 'Parc Safari' },
    lavanda: { name: 'Nuit à Lavanville' },
    rocket: { name: 'Team Rocket' },
  };
  // Champions des manches gyms, dans l'ordre de gymOrder (noms de la sauvegarde → libellés des arrêts).
  const GYM_LABELS = { erika: 'Erika', koga: 'Koga', sabrina: 'Sabrina' };
  const CAMP_NAMES = {
    'Pokémon salvajes': 'Pokémon sauvages', 'Bosque Verde': 'Forêt de Jade', 'Pikachu salvaje': 'Pikachu sauvage', Brock: 'Pierre',
    Montañero: 'Montagnard', Cazabichos: 'Scout', 'Rival Azul': 'Rival', Misty: 'Ondine', Marinero: 'Marin', Caballero: 'Gentleman',
    Pescador: 'Pêcheur', 'Teniente Surge': 'Major Bob', Pokémaníaco: 'Pokémaniac', Entrenadora: 'Dresseuse', Recluta: 'Sbire Rocket',
    Sabrina: 'Morgane', Ornitólogo: 'Ornithologue', Calvo: 'Chauve', Nadador: 'Nageur', Científico: 'Scientifique',
    Malabarista: 'Jongleur', Ladrón: 'Voleur', Blaine: 'Auguste', 'Entrenador Guay': 'Topdresseur', Karateka: 'Karatéka',
    Domador: 'Dompteur', Lorelei: 'Olga', Bruno: 'Aldo', Lance: 'Peter', Azul: 'Maître de la Ligue',
    Bajada: 'Descente', Motero: 'Motard', Macarra: 'Loubard', 'Jefe de los moteros': 'Chef des motards', Playa: 'Plage',
    Nadadora: 'Nageuse', 'Pareja de nadadores': 'Couple de nageurs', Entrada: 'Entrée', Corrientes: 'Courants',
    Articuno: 'Artikodin', 'Atrapados en el hielo': 'Pris dans la glace', Puerto: 'Port', Sótano: 'Sous-sol',
    'El fósil despierta': 'Le fossile s’éveille', 'Hierba alta': 'Hautes herbes', 'La bandada de Spearow': 'La nuée de Piafabec',
    '¡El Team Rocket!': 'La Team Rocket !', 'El enjambre': 'L’essaim', 'El Samurái': 'Le Samouraï',
  };
  // Lignes d'évolution par identifiant de l'API ; « -aN » = forme ancrée au stade N.
  const LINES = {
    abra: ['Abra', 'Kadabra', 'Alakazam'], aerodactyl: ['Ptéra'], articuno: ['Artikodin'],
    bellsprout: ['Chétiflor', 'Boustiflor', 'Empiflor'], bulbasaur: ['Bulbizarre', 'Herbizarre', 'Florizarre'],
    caterpie: ['Chenipan', 'Chrysacier', 'Papilusion'], chansey: ['Leveinard'],
    charmander: ['Salamèche', 'Reptincel', 'Dracaufeu'], clefairy: ['Mélofée', 'Mélodelfe'], cubone: ['Osselait', 'Ossatueur'],
    diglett: ['Taupiqueur', 'Triopikeur'], ditto: ['Métamorph'], doduo: ['Doduo', 'Dodrio'],
    dratini: ['Minidraco', 'Draco', 'Dracolosse'], drowzee: ['Soporifik', 'Hypnomade'], eevee: ['Évoli'],
    ekans: ['Abo', 'Arbok'], electabuzz: ['Élektek'], exeggcute: ['Noeunoeuf', 'Noadkoko'], farfetchd: ['Canarticho'],
    flareon: ['Pyroli'], gastly: ['Fantominus', 'Spectrum', 'Ectoplasma'], geodude: ['Racaillou', 'Gravalanch', 'Grolem'],
    giovanni: ['Miaouss de Giovanni', 'Persian de Giovanni'], goldeen: ['Poissirène', 'Poissoroy'],
    grimer: ['Tadmorv', 'Grotadmorv'], growlithe: ['Caninos', 'Arcanin'], hitmonchan: ['Tygnon'], hitmonlee: ['Kicklee'],
    horsea: ['Hypotrempe', 'Hypocéan'], jigglypuff: ['Rondoudou', 'Grodoudou'], jolteon: ['Voltali'], jynx: ['Lippoutou'],
    kabuto: ['Kabuto', 'Kabutops'], kangaskhan: ['Kangourex'], koffing: ['Smogo', 'Smogogo'],
    koga: ['Smogo de Koga', 'Smogogo de Koga'], krabby: ['Krabby', 'Krabboss'], lapras: ['Lokhlass'],
    lickitung: ['Excelangue'], machop: ['Machoc', 'Machopeur', 'Mackogneur'], magikarp: ['Magicarpe', 'Léviator'],
    magmar: ['Magmar'], magnemite: ['Magnéti', 'Magnéton'], mankey: ['Férosinge', 'Colossinge'],
    meowth: ['Miaouss', 'Persian'], mew: ['Mew'], mewtwo: ['Mewtwo'], moltres: ['Sulfura'], mrmime: ['M. Mime'],
    nidoran: ['Nidoran♂', 'Nidorino', 'Nidoking'], nidoranf: ['Nidoran♀', 'Nidorina', 'Nidoqueen'],
    oddish: ['Mystherbe', 'Ortide', 'Rafflesia'], omanyte: ['Amonita', 'Amonistar'], onix: ['Onix'],
    paras: ['Paras', 'Parasect'], pidgey: ['Roucool', 'Roucoups', 'Roucarnage'], pikachu: ['Pikachu', 'Raichu'],
    pinsir: ['Scarabrute'], poliwag: ['Ptitard', 'Têtarte', 'Tartard'], ponyta: ['Ponyta', 'Galopa'], porygon: ['Porygon'],
    psyduck: ['Psykokwak', 'Akwakwak'], rattata: ['Rattata', 'Rattatac'], rhyhorn: ['Rhinocorne', 'Rhinoféros'],
    samurai: ['Scarabrute du Samouraï'], sandshrew: ['Sabelette', 'Sablaireau'], scyther: ['Insécateur'],
    seel: ['Otaria', 'Lamantine'], shellder: ['Kokiyas', 'Crustabri'], slowpoke: ['Ramoloss', 'Flagadoss'],
    snorlax: ['Ronflex'], spearow: ['Piafabec', 'Rapasdepic'], squirtle: ['Carapuce', 'Carabaffe', 'Tortank'],
    staryu: ['Stari', 'Staross'], tangela: ['Saquedeneu'], tauros: ['Tauros'], tentacool: ['Tentacool', 'Tentacruel'],
    vaporeon: ['Aquali'], venonat: ['Mimitoss', 'Aéromite'], voltorb: ['Voltorbe', 'Électrode'], vulpix: ['Goupix', 'Feunard'],
    weedle: ['Aspicot', 'Coconfort', 'Dardargnan'], zapdos: ['Électhor'], zubat: ['Nosferapti', 'Nosferalto'],
  };

  // Lignées de la Tour v41 absentes de data.json (l'API publique s'arrête aux règles 40), relevées dans le code du jeu
  // (route-*.js, roster) : utilisées seulement quand data.json ne connaît pas la lignée. hit : stats d'attaque qui la servent
  // (attackKit). 'atk' : ses attaques de base comptent (tout rôle sauf mage, soutien et spécial) ; aucune de ces lignées n'a
  // de capacité physique sans cela, d'où basic lu sur 'atk'. 'spa' : une capacité suit l'Atq. Spé. Absent pour Chétiflor et
  // Mimitoss, à deux formes. range : celle de la définition propre de la lignée (_s), qui l'emporte sur sa ligne de base
  // (Smogo, tank de mêlée ; Chétiflor, portée 2).
  const LINES_V41 = {
    bellsprout: { c: 2, t: ['grass', 'poison'], s: [69, 70, 71], range: 2 },
    clefairy: { c: 2, t: ['normal'], s: [35, 36], range: 3, hit: ['spa'] },
    doduo: { c: 2, t: ['normal', 'flying'], s: [84, 85], range: 1, hit: ['atk'] },
    drowzee: { c: 3, t: ['psychic'], s: [96, 97], range: 3, hit: ['spa'] },
    farfetchd: { c: 2, t: ['normal', 'flying'], s: [83], range: 1, hit: ['atk'] },
    goldeen: { c: 1, t: ['water'], s: [118, 119], range: 1, hit: ['atk'] },
    grimer: { c: 3, t: ['poison'], s: [88, 89], range: 1, hit: ['atk'] },
    horsea: { c: 2, t: ['water'], s: [116, 117], range: 3, hit: ['atk', 'spa'] },
    kabuto: { c: 4, t: ['rock', 'water'], s: [140, 141], range: 1, hit: ['atk', 'spa'] },
    kangaskhan: { c: 4, t: ['normal'], s: [115], range: 1, hit: ['atk'] },
    koffing: { c: 2, t: ['poison'], s: [109, 110], range: 1, hit: ['atk', 'spa'] },
    krabby: { c: 1, t: ['water'], s: [98, 99], range: 1, hit: ['atk'] },
    lickitung: { c: 3, t: ['normal'], s: [108], range: 1, hit: ['atk'] },
    mankey: { c: 1, t: ['fighting'], s: [56, 57], range: 1, hit: ['atk'] },
    meowth: { c: 2, t: ['normal'], s: [52, 53], range: 1, hit: ['atk'] },
    mrmime: { c: 3, t: ['psychic'], s: [122], range: 3, hit: ['spa'] },
    nidoranf: { c: 1, t: ['poison', 'ground'], s: [29, 30, 31], range: 1, hit: ['atk', 'spa'] },
    omanyte: { c: 4, t: ['rock', 'water'], s: [138, 139], range: 3, hit: ['atk', 'spa'] },
    pinsir: { c: 3, t: ['bug'], s: [127], range: 1, hit: ['atk'] },
    porygon: { c: 3, t: ['normal'], s: [137], range: 3, hit: ['spa'] },
    spearow: { c: 1, t: ['normal', 'flying'], s: [21, 22], range: 1, hit: ['atk'] },
    tangela: { c: 3, t: ['grass'], s: [114], range: 1, hit: ['atk', 'spa'] },
    tentacool: { c: 3, t: ['water', 'poison'], s: [72, 73], range: 3, hit: ['spa'] },
    venonat: { c: 2, t: ['bug', 'poison'], s: [48, 49], range: 3 },
  };
  const lineInfo = (data, base) => data?.lines[base] ?? LINES_V41[base];
  // Règles de chaque mode lues dans le code du jeu (route-*.js, règles 41). Campagne : base 5 et intérêts plafonnés à +4 (wh),
  // 2 XP gratuites par manche (eh), niveau 9 au plus (ih), pas de bénédiction ni de sceau. Sur un combat obligatoire (badge,
  // Ligue, boss), la défaite qui suit un premier échec ne rapporte plus d'intérêts (Rm) : tout jouer dès le premier essai raté.
  // attempts ne dépasse 0 que sur ces combats : une manche ordinaire perdue avance quand même, et l'avance remet attempts à 0
  // (shop-*.js).
  // hud : barre de progression du mode affiché, qui montre les pastilles ; xm : mode du code KT1 (teamCode-*.js : pvp, tower, adv).
  // shopLines : lignées en boutique par coût (Tour : 77, vérifiées par al de route-*.js ; Kanto : les 56 lignées de base,
  // copiées par Tl avant que lu n'y ajoute les formes PvP) ; shopOut : lignées hors de la boutique (Tour : les 5 légendaires de vl) ;
  // redraw : chance du repêchage.
  const TOWER = {
    id: 'tower', stats: 'torre', name: 'Tour', where: 'en Tour', label: 'Étage', unit: 'étage', units: 'étages', the: 'l’étage', at: 'à l’étage', here: 'à cet étage', xm: 'tower', hud: '.topbar .rtrack.tw',
    interest: BASE_INTEREST, levelGoals: LEVEL_GOALS, levelCap: floor => (floor >= LEVEL_10_FROM ? 10 : 9),
    retryFrom: RETRY_ALL_IN_FROM, shinyKeepTo: SHINY_KEEP_TO, shopLines: [19, 21, 20, 14, 3],
    shopOut: ['articuno', 'zapdos', 'moltres', 'mew', 'mewtwo'], redraw: TOWER_REDRAW, floorOf: round => Math.max(1, Math.floor(round) - ROUND_BASE + 1),
    // Morceaux des règles d'or propres au mode (goldRules) ; hasLeague : le mode a des difficultés, qui durcissent le seuil de
    // « tout jouer ».
    fortuneNote: ` (+${FORTUNE_INTEREST} avec la voie Fortune complète)`, streakNote: '', xpNote: '', retryNote: `sur un étage rejoué à partir de l’étage ${RETRY_ALL_IN_FROM}`, wallNote: 'un étage', hasLeague: false,
  };
  const CAMPAIGN = {
    id: 'campaign', stats: 'camp', name: 'Campagne', where: 'en campagne', label: 'Combat', unit: 'combat', units: 'combats', the: 'le combat', at: 'au combat', here: 'à ce combat', xm: 'adv',
    hud: '.topbar .rtrack:not(.tw):not(.pt-track)', interest: 4, levelGoals: CAMPAIGN_LEVEL_GOALS, levelCap: () => 9,
    retryFrom: 1, shinyKeepTo: Infinity, shopLines: [14, 13, 12, 11, 6], shopOut: [], redraw: 0, floorOf: round => Math.max(1, Math.floor(round) + 1),
    fortuneNote: '', streakNote: ' Série : +1 pièce par victoire à partir de la 2ᵉ de suite.', xpNote: ' La campagne donne 2 XP par combat.', retryNote: 'sur un combat rejoué', wallNote: 'un boss rejoué tant qu’il est perdu', hasLeague: true,
  };

  // Contexte de la partie : règles du mode, aventure (sa table d'arrêts, ou null), difficulté et stratégie normale
  // (withStrategy). Sans league (sauvegarde d'avant les difficultés), Normal ; une valeur hors de 1 à 3 est signalée en console et comptée Normal.
  function modeContext(rules, save = {}, adventure = null) {
    const known = [1, 2, 3].includes(save.league);
    if (rules === CAMPAIGN && !known && save.league !== undefined) console.warn('kanto-overlay : difficulté inconnue, comptée Normal', save.league);
    const league = rules === CAMPAIGN && known ? save.league : 1;
    const leaguePenalty = (league - 1) * LEAGUE_PENALTY;
    const adv = adventure ? ADVENTURES[adventure] ?? null : null;
    return withStrategy({
      ...rules, shopLines: adv?.shopLines ?? rules.shopLines, shopOut: adv?.shopOut ?? rules.shopOut,
      baseGoals: adv?.levelGoals ?? rules.levelGoals, adventure, adv, league,
      leaguePenalty, ownPenalty: 0, penalty: leaguePenalty, advance: advanceOf(rules, leaguePenalty),
      gymOrder: Array.isArray(save.gymOrder) ? save.gymOrder : [],
    }, STRATEGY_DEFAULTS);
  }

  // Combats d'avance des niveaux visés dans un mode à difficultés : un par LEAGUE_PENALTY points de pénalité (difficulté moins
  // écart appris), de 0 à 2 ; la Tour n'en a pas.
  const advanceOf = (rules, penalty) => (rules.hasLeague ? Math.max(0, Math.min(2, Math.round(penalty / LEAGUE_PENALTY))) : 0);

  // Mode avec la stratégie choisie (choice : clé de STRATEGY → valeur connue, l'objet ui passé par checkUi) ; les niveaux visés repartent de ceux des
  // règles (baseGoals), pour qu'un nouveau choix remplace le précédent. Un niveau n'est pas visé avant l'étage où le jeu
  // l'autorise : visé plus tôt, le niveau 10 de la Tour bloquerait l'actualisation jusqu'à l'étage 60.
  function withStrategy(mode, choice) {
    const params = Object.assign({}, ...STRATEGY.map(o => o.values.find(([v]) => v === choice[o.key])[2]));
    const unlocked = level => (level === 10 ? LEVEL_10_FROM : 1);
    const levelGoals = mode.baseGoals.map(([from, level]) => [Math.max(unlocked(level), Math.round(from * params.pace)), level]);
    return { ...mode, ...params, levelGoals, strategy: STRATEGY.map(o => choice[o.key]) };
  }
  const TOWER_MODE = modeContext(TOWER);

  // Clé de sauvegarde → mode ; null pour une clé hors des modes du panneau (Nuzlocke compris, rendu non pris en charge).
  function saveMode(key) {
    if (key === SAVE_TOWER) return { rules: TOWER, adventure: null };
    if (key === SAVE_KANTO) return { rules: CAMPAIGN, adventure: 'kanto' };
    if (key.startsWith(SAVE_ADV) && !key.endsWith('-prev')) return { rules: CAMPAIGN, adventure: key.slice(SAVE_ADV.length) };
    return null;
  }

  // Sauvegarde de la partie jouée en dernier (savedAt le plus récent ; 0 sans savedAt, version antérieure) : { key, raw, mode },
  // mode null pour le Nuzlocke ; null sans sauvegarde. shown : mode à l'écran ('tower', 'campaign' : Kanto et autres
  // aventures, 'nuzlocke'), ou null (accueil) pour tous. Le jeu ne réécrit une partie reprise qu'à sa première action :
  // sans shown, une Tour reprise afficherait la dernière campagne. memo : clé → { raw, save }, pour ne relire que les
  // sauvegardes changées. storage : localStorage, injectable.
  function latestSave(storage, shown = null, memo = new Map()) {
    let best = null;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      const kind = key === SAVE_NUZLOCKE ? null : saveMode(key);
      if (!kind && key !== SAVE_NUZLOCKE) continue;
      if (shown !== null && (kind?.rules.id ?? 'nuzlocke') !== shown) continue;
      const raw = storage.getItem(key);
      if (memo.get(key)?.raw !== raw) memo.set(key, { raw, save: parseRound(raw), mode: undefined });
      const { save } = memo.get(key);
      const at = Number.isFinite(save?.savedAt) ? save.savedAt : 0;
      if (save && (!best || at > best.at)) best = { key, raw, save, at, kind };
    }
    if (!best) return null;
    const entry = memo.get(best.key);
    if (entry.mode === undefined) entry.mode = best.kind && modeContext(best.kind.rules, best.save, best.kind.adventure);
    return { key: best.key, raw: best.raw, mode: entry.mode };
  }

  // Mode à l'écran d'après la barre du haut ; null hors partie (accueil, combat, transition). Le Nuzlocke passe avant la
  // campagne, dont il a la barre.
  function shownMode(doc) {
    if (doc.querySelector(NUZLOCKE_HUD)) return 'nuzlocke';
    if (doc.querySelector(TOWER.hud)) return TOWER.id;
    if (doc.querySelector(CAMPAIGN.hud)) return CAMPAIGN.id;
    return null;
  }

  // Nouvel état du panneau après une lecture : prev { mode, saveKey, lastAuto, floor, source }, found : latestSave, shown : mode
  // à l'écran, choice : stratégie choisie (objet ui), appliquée au mode, fights : journal des combats, dont l'écart appris rejoint
  // la pénalité du mode (withResults). Sans sauvegarde du mode à l'écran, son mode quand même (libellés, règles), et le Nuzlocke dit non pris en
  // charge. L'étage saisi à la main tient jusqu'à ce que la sauvegarde change d'étage, et tombe avec un changement de partie.
  function pollState(prev, found, shown, choice, fights) {
    let { mode } = prev;
    if (found?.mode) mode = found.mode;
    else if (!found && shown === TOWER.id) mode = TOWER_MODE;
    else if (!found && shown === CAMPAIGN.id && mode.id !== CAMPAIGN.id) mode = modeContext(CAMPAIGN, {}, 'kanto');
    mode = withResults(withStrategy(mode, choice), fights);
    const saveKey = found?.key;
    let { lastAuto, floor, source } = prev;
    if (saveKey !== prev.saveKey) lastAuto = undefined;
    const f = found?.mode ? floorFromSave(found.raw, mode) : null;
    if (f !== lastAuto) {
      lastAuto = f;
      if (f !== null) [floor, source] = [f, 'auto'];
      else if (source === 'auto') [floor, source] = [null, 'manuel'];
    }
    const unsupported = found ? found.mode === null : shown === 'nuzlocke';
    return { mode, unsupported, saveKey, lastAuto, floor, source, save: found?.mode ? parseSave(found.raw) : null };
  }

  const levelGoal = (floor, mode) => mode.levelGoals
    .reduce((goal, [from, level]) => (floor + mode.advance >= from ? level : goal), 0);
  const maxLevel = (floor, mode) => mode.levelCap(floor);
  // Chance (%) de voir le coût de la lignée dans une case de boutique à ce niveau ; 0 pour un coût ou un niveau inconnu.
  const shopOdds = (data, level, base) => SHOP_ODDS[level]?.[lineInfo(data, base)?.c - 1] ?? 0;
  const findable = (data, level, base) => shopOdds(data, level, base) >= FINDABLE;

  // Chance (%) qu'une actualisation au niveau level montre au moins une copie de l'une des lignées bases (gm, pm, Tt du jeu).
  // Une case tire son coût dans SHOP_ODDS, puis sa lignée au poids des exemplaires restants : SHOP_COPIES du coût moins
  // 3^(★−1) par copie possédée, aucun pour une lignée possédée en ★★★ ; une lignée hors de la boutique du mode (shopOut) ne
  // sort pas. Le repêchage remplace ensuite une case par une lignée possédée qui peut encore sortir. Approximations : les
  // cases d'une même boutique sont tirées avec remise, le repêchage compte comme une case de plus alors qu'il en remplace
  // une (moins d'un point d'écart) ; en Tour, les lignées bannies de la semaine restent comptées, et les sceaux de boutique
  // (Ojo de Cazador ×1,3 pour tes lignées, Mercado Alto +8 points de coût 4…) ne le sont pas.
  function rerollChance(game, data, level, bases) {
    const cost = base => lineInfo(data, base)?.c;
    const odds = base => shopOdds(data, level, base) / 100;
    // Exemplaires restants de chaque lignée possédée.
    const owned = new Map([...new Set(game.units.map(u => baseLine(u.line)))].map(base => [base, bestStar(game, base) >= 3 ? 0
      : SHOP_COPIES[cost(base) - 1] - unitsOf(game, base).reduce((sum, u) => sum + 3 ** (u.star - 1), 0)]));
    const left = base => owned.get(base) ?? SHOP_COPIES[cost(base) - 1];
    const sold = base => !game.mode.shopOut.includes(base);
    const pool = c => game.mode.shopLines[c - 1] * SHOP_COPIES[c - 1]
      - [...owned].filter(([b]) => cost(b) === c && sold(b)).reduce((sum, [, n]) => sum + SHOP_COPIES[c - 1] - n, 0);
    const drawable = base => cost(base) !== undefined && sold(base) && odds(base) > 0 && left(base) > 0;
    const sought = bases.filter(drawable);
    const perSlot = sought.reduce((sum, b) => sum + odds(b) * left(b) / pool(cost(b)), 0);
    const redrawn = [...owned.keys()].filter(drawable);
    const redraw = game.mode.redraw + (pathCount(game.boons, 'breed') >= PATH_SIZE ? BREED_REDRAW : 0);
    const redrawHit = redrawn.length ? redraw * sought.filter(b => owned.has(b)).length / redrawn.length : 0;
    return 100 * (1 - (1 - perSlot) ** SHOP_SLOTS * (1 - redrawHit));
  }
  const unitPower = (cost, star) => (1 + COST_POWER * (cost - 1)) * STAR_POWER[star - 1];

  // Conseils du guide (non vérifiés) par tranche d'étages.
  const GUIDE = [
    { to: 40, shinies: ['Bulbizarre', 'Mystherbe', 'Chétiflor', 'Nidorino', 'Amonita'], advice: 'Les prendre quand ils passent, sans actualiser exprès.' },
    { to: 80, shinies: ['Minidraco', 'Ptéra', 'Nidorino', 'Amonita'], advice: 'Priorité à ceux qui complètent l’équipe.' },
    { to: 120, shinies: ['Leveinard', 'Minidraco', 'Kabuto', 'Lokhlass', 'Kokiyas'], advice: 'Acheter seulement si l’économie reste saine.' },
    { to: 160, shinies: ['Ptéra', 'Leveinard', 'Minidraco'], advice: 'Un shiny hors composition ne mérite plus d’investissement.' },
    { to: Infinity, shinies: [], advice: 'Aucun farming de shinies : victoire et survie avant la collection.' },
  ];
  const leagueLabel = mode => `${mode.adv?.name ?? mode.adventure} · ${LEAGUES[mode.league]}`;

  // En-tête : aventure et difficulté en campagne, Tour sinon, et seuil de « tout jouer » déplacé par la pénalité du mode
  // (raison dans l'onglet Règles).
  function leagueNote(mode) {
    const where = mode.hasLeague ? leagueLabel(mode) : mode.name;
    return mode.penalty ? `${where} · tout jouer sous ${mode.hardWin + mode.penalty} %` : where;
  }

  function goldRules(mode) {
    const goals = mode.levelGoals.map(([from, level]) => `${level} dès ${mode.the} ${Math.max(1, from - mode.advance)}`).join(', ');
    const hard = mode.hardWin + mode.penalty;
    const notes = [];
    if (mode.hasLeague) {
      notes.push(mode.leaguePenalty ? `${LEAGUES[mode.league]} : ${mode.hardWin} % plus ${mode.leaguePenalty} points, les taux publics mêlant les trois difficultés`
        : LEAGUES[mode.league]);
    }
    if (mode.ownPenalty) notes.push(`${mode.ownPenalty > 0 ? 'plus' : 'moins'} ${Math.abs(mode.ownPenalty)} points d’après tes résultats`);
    return [
      `Intérêts : +1 pièce par tranche de 10, +${mode.interest} au plus ${mode.where} → garder ${10 * mode.interest} pièces${mode.fortuneNote}.${mode.streakNote}`,
      `L’or au-dessus du palier ne rapporte rien : XP jusqu’au niveau visé (${goals}), puis actualisation si elle montre une copie cherchée à ${REROLL_CHANCE} % ou plus, puis XP.${mode.xpNote}`,
      `Actualisation à ${REROLL_COST} pièces : ne pas en enchaîner pour un shiny.`,
      `Tout jouer sur ${mode.wallNote} sous ${hard} % de victoires${notes.length ? ` (${notes.join(' ; ')})` : ''}, sous ${mode.lowHp} PV, ou ${mode.retryNote}.`,
    ];
  }

  const isObject = o => o !== null && typeof o === 'object' && !Array.isArray(o);

  // Valeur JSON du stockage ; null si elle est absente ou illisible.
  function parseJson(raw) {
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw e;
    }
  }

  // Sauvegarde avec un round numérique (assez pour l'étage), sinon null.
  function parseRound(raw) {
    const save = parseJson(raw);
    return isObject(save) && Number.isFinite(save.round) ? save : null;
  }

  // Forme lue par readGame ; sinon autre version de sauvegarde, sans conseils (l'étage reste lu par floorFromSave).
  function parseSave(raw) {
    const save = parseRound(raw);
    return save && isObject(save.units) && isObject(save.board ?? {}) && Array.isArray(save.bench ?? []) ? save : null;
  }

  const coreKey = core => [...core].sort().join('+');

  // Étage (Tour) ou combat (campagne) de la sauvegarde.
  function floorFromSave(raw, mode) {
    const save = parseRound(raw);
    return save && mode.floorOf(save.round);
  }

  // « 16:Erika », « 2:Pikachu salvaje » : le libellé d'un arrêt de campagne contient des espaces.
  function parseStop(stop) {
    const at = stop.indexOf(':');
    return { floor: Number(stop.slice(0, at)), boss: stop.slice(at + 1) };
  }

  // Forme minimale d'un mode de campana.json (torre, camp) dont dépend le panneau ; sinon le format de l'API a changé.
  function isStatsData(t) {
    return Array.isArray(t?.stops) && Array.isArray(t.cores) && Array.isArray(t.lines) && Array.isArray(t.holders)
      && typeof t.from === 'string' && typeof t.to === 'string' && Number.isFinite(t.rules)
      && t.stops.every(s => typeof s?.stop === 'string' && /^\d+:.+$/.test(s.stop) && [s.n, s.win, s.first, s.tries].every(Number.isFinite))
      && t.stops.some(s => !s.stop.endsWith(':elite'))
      && t.cores.every(c => typeof c?.stop === 'string' && Array.isArray(c.core) && [c.n, c.win, c.lo].every(Number.isFinite))
      && t.lines.every(l => typeof l?.line === 'string' && [l.lo, l.ne, l.d].every(Number.isFinite))
      && Array.isArray(t.stars) && t.stars.every(s => typeof s?.line === 'string' && [s.star, s.lo, s.hi, s.exp].every(Number.isFinite))
      && t.holders.every(h => typeof h?.line === 'string' && typeof h.id === 'string' && [h.n, h.lo].every(Number.isFinite));
  }

  function isGameData(d) {
    return isObject(d?.lines) && isObject(d.items) && Array.isArray(d.recipes) && isObject(d.traits) && isObject(d.seals)
      && Object.values(d.lines).every(l => Number.isFinite(l?.c) && Array.isArray(l.t) && Array.isArray(l.s) && Number.isFinite(l.range))
      && Object.values(d.traits).every(t => Array.isArray(t?.th))
      && d.recipes.every(r => Array.isArray(r) && r.length === 3);
  }

  const isLang = l => isObject(l?.items) && isObject(l.seals);

  const isFresh = (at, now) => Number.isFinite(at) && now - at >= 0 && now - at < CACHE_MAX_AGE;

  // Arrêts de ce mode : tous en Tour ; en campagne, ceux de l'aventure (aucun sans table d'arrêts) et, à une manche de
  // champion dont gymOrder fixe le choix, celui-là seul. share : part des combats de la manche (ses variantes sont tirées au
  // sort ; à une manche de champion pas encore choisi, c'est la part de chaque champion dans les choix des joueurs) ;
  // fightWin : taux de victoire de la manche, moyenne de ses variantes pondérée par share ; fight : libellés de ses variantes.
  // Calculés une fois par couple (arrêts de l'API, mode) : le rendu et chaque conseil les relisent plusieurs fois.
  const modeStopsMemo = new WeakMap();
  function modeStops(stops, mode) {
    if (!modeStopsMemo.has(stops)) modeStopsMemo.set(stops, new WeakMap());
    const memo = modeStopsMemo.get(stops);
    if (!memo.has(mode)) memo.set(mode, readModeStops(stops, mode));
    return memo.get(mode);
  }

  function readModeStops(stops, mode) {
    const parsed = stops.map(s => ({ ...s, ...parseStop(s.stop) }));
    if (mode.id === TOWER.id) return parsed.map(s => ({ ...s, share: 1, fightWin: s.win, fight: [s.boss] }));
    const table = mode.adv?.stops;
    if (!table) return [];
    // Champion d'une manche gyms : celui de gymOrder une fois choisi, sinon un de ceux qui restent (le dernier n'a pas le choix).
    const order = mode.gymOrder.map(g => GYM_LABELS[g]);
    const slot = s => mode.adv.gyms?.[s.floor];
    const gymOk = s => slot(s) === undefined || (order[slot(s)] ? order[slot(s)] === s.boss : !order.includes(s.boss));
    const kept = parsed.filter(s => table[s.floor]?.includes(s.boss) && gymOk(s));
    const sum = (map, s, v) => map.set(s.floor, (map.get(s.floor) ?? 0) + v);
    const fights = new Map();
    for (const s of kept) sum(fights, s, s.n);
    const shared = kept.map(s => ({ ...s, share: s.n / fights.get(s.floor) }));
    const wins = new Map();
    for (const s of shared) sum(wins, s, s.share * s.win);
    return shared.map(s => ({ ...s, fightWin: wins.get(s.floor), fight: kept.filter(x => x.floor === s.floor).map(x => x.boss) }));
  }

  // Tour : tout sauf les élites ; campagne : boss de l'aventure (bosses), ou chaque combat sans liste de boss.
  const isBoss = (s, mode) => (mode.id === TOWER.id ? s.boss !== 'elite' : mode.adv?.bosses?.includes(s.floor) ?? true);
  // Combat où un taux bas fait tout jouer : chaque étage de la Tour ; en campagne, un boss que le jeu fait rejouer tant qu'il
  // est perdu (sans canLose). Une manche ordinaire ou un boss canLose perdus avancent quand même : l'or garde ses intérêts.
  const mustWin = (s, mode) => mode.id === TOWER.id || (isBoss(s, mode) && !mode.adv?.canLose?.includes(s.floor));

  // -Infinity quand le mode n'a aucun arrêt (aventure sans table, ou libellés de l'API changés).
  function lastBossFloor(stops, mode) {
    return Math.max(...modeStops(stops, mode).filter(s => isBoss(s, mode)).map(s => s.floor));
  }

  // Prochain boss : la variante la plus jouée de sa manche, avec variants, toutes ses variantes (champion à choisir, tirage).
  function nextBossStop(stops, floor, mode) {
    const all = modeStops(stops, mode);
    let best = null;
    for (const s of all) {
      if (!isBoss(s, mode) || s.floor < floor) continue;
      if (!best || s.floor < best.floor || (s.floor === best.floor && s.n > best.n)) best = s;
    }
    return best && { ...best, variants: all.filter(s => s.floor === best.floor).sort((a, b) => b.n - a.n) };
  }

  // Arrêts des n prochains combats notés après les skip premiers (élites comprises, toutes les variantes d'une manche), pondérés
  // par leur difficulté (taux moins la pénalité du mode) et par leur part des combats de la manche.
  function nextStops(stops, floor, n, mode, skip = 0) {
    const ahead = modeStops(stops, mode).filter(s => s.floor >= floor).sort((a, b) => a.floor - b.floor);
    const floors = [...new Set(ahead.map(s => s.floor))].slice(skip, skip + n);
    return ahead.filter(s => floors.includes(s.floor))
      .map(s => ({ ...s, weight: s.share * Math.max(1, 100 - (s.win - mode.penalty)) }));
  }
  const totalWeight = stops => stops.reduce((sum, st) => sum + st.weight, 0);

  function topCores(cores, stop, limit = 3) {
    return cores
      .filter(c => c.stop === stop && c.n >= MIN_FIGHTS)
      .sort((a, b) => b.win - a.win || b.n - a.n)
      .slice(0, limit);
  }

  const baseLine = id => id.replace(/-a\d+$/, '');
  const anchorStage = id => {
    const m = /-a(\d+)$/.exec(id);
    return m ? Number(m[1]) : null;
  };

  // Pokémon : table LINES (lang.json, règles 40, n'a pas les Pokémon ajoutés en v41) ; objets et sceaux : lang.json.
  function namer(lang) {
    function line(id) {
      const names = LINES[baseLine(id)];
      if (!names) return id;
      const n = anchorStage(id);
      if (n === null) return names[0];
      return names[n] ? `${names[n]} ⚓` : id;
    }
    return {
      line,
      stage: (base, n) => LINES[base]?.[n] ?? base,
      item: id => lang?.items[id]?.name ?? id,
      effect: id => lang?.items[id]?.short ?? null,
      seal: id => lang?.seals[id]?.name ?? id,
    };
  }

  const bossName = id => BOSSES[id] ?? CAMP_NAMES[id] ?? id;
  // Nom d'une manche : ses variantes, quand le tirage au sort en laisse plusieurs.
  const fightName = s => s.fight.map(bossName).join(' ou ');

  function guideFor(floor) {
    let from = 1;
    for (const g of GUIDE) {
      if (floor <= g.to) return { ...g, from };
      from = g.to + 1;
    }
    throw new RangeError(`étage invalide : ${floor}`);
  }

  function rateLevel(win) {
    if (win >= 70) return { cls: 'good', sym: '▲' };
    if (win < 40) return { cls: 'bad', sym: '▼' };
    return { cls: 'mid', sym: '●' };
  }

  // État de partie normalisé à partir d'une sauvegarde Tour ou campagne (format v11) ; mode : modeContext de la partie.
  function readGame(save, mode) {
    const placed = [...Object.entries(save.board ?? {}).map(([cell, id]) => ({ id, cell: Number(cell) })),
      ...(save.bench ?? []).map((id, slot) => ({ id, slot })).filter(p => p.id)];
    const units = placed.map(p => ({ ...save.units[p.id], ...p })).filter(u => typeof u.line === 'string');
    return {
      mode, floor: mode.floorOf(save.round),
      gold: save.gold, level: save.level, xp: save.xp, hp: save.hp,
      // Défaites déjà subies à cet étage.
      attempts: save.attempts ?? 0,
      units,
      bench: save.bench ?? [],
      shop: save.shop ?? [],
      shopShiny: save.shopShiny ?? [],
      bag: save.items ?? [],
      reward: Array.isArray(save.itemReward) ? save.itemReward : [],
      boons: save.tower?.boons ?? [],
      // Boîte Jetons : une actualisation gratuite par étage ; le jeu note dans tower.cf la manche (round) où elle a servi
      // (nx, route-*.js ; action reroll, pvpNet-*.js).
      freeReroll: (save.tower?.boons ?? []).includes('coincase') && save.tower.cf !== save.round,
      offer: save.tower?.offer?.ids ?? [],
      anchor: save.anchor ?? {},
      // Événement de la manche encore sans choix (event de la sauvegarde, store-*.js) : kind 'choice' (événement de
      // l'aventure) ou 'center', avec center 'care', 'top' ou 'full' ; null sinon.
      event: save.event?.round === save.round && save.event.picked === null ? { kind: save.event.kind, center: save.event.center ?? null } : null,
    };
  }

  const unitsOf = (game, base) => game.units.filter(u => baseLine(u.line) === base);
  // Copie posée en premier d'une lignée : meilleure étoile, shiny, la plus équipée, déjà posée, puis la forme, pour un ordre
  // qui ne dépend pas de la place des copies dans la sauvegarde.
  const fieldOrder = (x, y) => y.star - x.star || Number(!!y.shiny) - Number(!!x.shiny) || (y.items?.length ?? 0) - (x.items?.length ?? 0)
    || Number(y.cell !== undefined) - Number(x.cell !== undefined) || x.line.localeCompare(y.line);
  const bestStar = (game, base) => Math.max(0, ...unitsOf(game, base).map(u => u.star));
  // Lignée shiny : sa copie de meilleure étoile l'est (celle que décrivent la progression et le code KT1).
  const shinyLine = (game, base) => unitsOf(game, base).some(u => u.shiny && u.star === bestStar(game, base));
  const copies = (game, base, star) => unitsOf(game, base).filter(u => u.star === star).length;
  const ones = (game, base) => copies(game, base, 1);
  // Deux copies de cette étoile, sous ★★★ : la 3ᵉ les fusionne en une copie de l'étoile suivante.
  const pairAt = (game, base, star) => star < 3 && copies(game, base, star) === 2;
  const pathCount = (boons, path) => boons.filter(b => boonPath(b) === path).length;

  function goldFloor(boons, mode) {
    return 10 * (mode.interest + (pathCount(boons, 'fortune') >= PATH_SIZE ? FORTUNE_INTEREST : 0));
  }

  // « Tout jouer » : le combat courant est un mur à gagner (mustWin ; taux de la manche sous hardWin plus la pénalité du mode :
  // difficulté et résultats du joueur), les PV sont sous lowHp, ou le combat est rejoué (retryFrom du mode). nextWall : premier
  // mur des combats à venir, à gagner ou non.
  function economy(game, stops) {
    const { mode } = game;
    const here = stops.find(s => s.floor === game.floor);
    const floor = goldFloor(game.boons, mode);
    const hard = mode.hardWin + mode.penalty;
    const lowHp = game.hp < mode.lowHp;
    const retry = game.attempts > 0 && game.floor >= mode.retryFrom;
    const allIn = lowHp || retry || (here !== undefined && here.fightWin < hard && mustWin(here, mode));
    const nextWall = stops.find(s => s.fightWin < hard) ?? null;
    return { gold: game.gold, floor, spend: allIn ? game.gold : Math.max(0, game.gold - floor), allIn, lowHp, retry, nextWall };
  }

  // Journal des combats joués avec le panneau ouvert : { r: partie (runSeed), k: la Tour, ou l'aventure et sa difficulté (cellOf), f: étage ou
  // combat, p: taux attendu en % (taux public moins la pénalité de difficulté), w: 1 gagné, c: 1 si le trio de la compo
  // cible était posé à la dernière lecture avant le combat (2 s au plus), absent sans trio ; à cette lecture, l: niveau,
  // g: niveau visé, o: or, h: PV ; v: VERSION, s: préréglages de stratégie dans l'ordre de STRATEGY }. Les lignes écrites
  // avant la 2.11.0 n'ont ni l, g, o, h, v ni s. Par clé k, les plus anciens sortent au-delà de JOURNAL_MAX : l'écart suit
  // le niveau du joueur et les rééquilibrages du jeu.
  const JOURNAL_KEY = 'kt-overlay:journal';
  const JOURNAL_MAX = 300;
  // Parties de Tour finies, écrites par le jeu à la défaite finale (towerRuns-*.js) : seed et étage atteint.
  const TOWER_RUNS_KEY = 'kanto-tactics:tower-runs';
  // Combats fictifs sans écart ajoutés à ceux du joueur : un combat de plus déplace l'écart de 2 points au plus, et 300
  // combats joués exactement aux taux publics laissent un écart de 2,5 points en écart type.
  const OWN_PRIOR = 50;
  // Écart compté au plus, en points : le journal ne note pas tous les combats (dernier combat d'une campagne), et un seuil de
  // « tout jouer » proche de 100 % ferait tout jouer en permanence.
  const OWN_MAX = 20;

  const parseList = raw => {
    const list = parseJson(raw);
    return Array.isArray(list) ? list : null;
  };

  // Un journal illisible repart à vide, une ligne d'un autre format est écartée ; les deux sont signalés en console.
  function readJournal(raw) {
    const list = parseList(raw);
    if (raw != null && !list) console.warn('kanto-overlay : journal des combats illisible, repris à vide');
    const fights = (list ?? []).filter(f => typeof f?.k === 'string' && Number.isFinite(f.p) && (f.w === 0 || f.w === 1));
    if (list && fights.length < list.length) console.warn('kanto-overlay : lignes du journal d’un autre format écartées', list.length - fights.length);
    return fights;
  }

  const cellOf = mode => (mode.id === TOWER.id ? TOWER.id : `${mode.adventure}:${mode.league}`);

  // Résultat du combat joué depuis la sauvegarde before : true gagné, false perdu, null sans combat fini. Le jeu change
  // streak à chaque combat (un de plus ou 1 après une victoire, un de moins ou −1 après une défaite), avance d'une manche après
  // une victoire ou une défaite permise, et compte un essai de plus sinon : une série qui change sans cela, sauvegarde
  // restaurée par exemple, n'est pas un combat. Pendant le combat et son résultat, le jeu réécrit la série d'avant
  // (store-*.js) : le dernier combat d'une partie n'est donc pas vu avant que le jeu supprime la sauvegarde. Seule la Tour
  // confirme alors la défaite finale, par sa liste de parties finies. afterRaw : la même sauvegarde relue, runsRaw :
  // TOWER_RUNS_KEY.
  function fightWon(before, afterRaw, runsRaw, mode) {
    if (!Number.isFinite(before?.runSeed) || !Number.isFinite(before.streak)) return null;
    const after = parseRound(afterRaw);
    if (after?.runSeed === before.runSeed) {
      const advanced = after.round > before.round;
      if (advanced && after.streak === Math.max(1, before.streak + 1)) return true;
      return (advanced || after.attempts > before.attempts) && after.streak === Math.min(-1, before.streak - 1) ? false : null;
    }
    if (mode.id !== TOWER.id) return null;
    const runs = parseList(runsRaw);
    if (runsRaw != null && !runs) console.warn('kanto-overlay : parties de Tour finies illisibles, défaite finale non notée');
    const ended = (runs ?? []).some(r => r?.seed === before.runSeed && r.reached === mode.floorOf(before.round));
    return ended ? false : null;
  }

  // Ligne de journal du combat que advice conseillait ; null sans taux public d'au moins MIN_FIGHTS combats pour ce combat
  // (un taux de 100 % sur 14 combats ferait d'une défaite un écart).
  function fightEntry(advice, stats, won) {
    const { game, target } = advice;
    const here = stats ? modeStops(stats.stops, game.mode).filter(s => s.floor === game.floor) : [];
    if (here.reduce((n, s) => n + s.n, 0) < MIN_FIGHTS) return null;
    const core = target?.core ?? [];
    const placed = new Set(game.units.filter(u => u.cell !== undefined).map(u => baseLine(u.line)));
    const p = Math.round(10 * Math.min(99, Math.max(1, here[0].fightWin - game.mode.leaguePenalty))) / 10;
    return {
      r: advice.run, k: cellOf(game.mode), f: game.floor, p, w: Number(won),
      ...(core.length ? { c: Number(core.every(id => placed.has(baseLine(id)))) } : {}),
      l: game.level, g: levelGoal(game.floor, game.mode), o: game.gold, h: game.hp, v: VERSION, s: game.mode.strategy,
    };
  }

  // Ligne du combat fini depuis la dernière lecture de la sauvegarde, ou null. save et advice : ceux d'avant la relecture.
  function notedFight({ save, advice, stats, afterRaw, runsRaw }) {
    if (!advice) return null;
    const won = fightWon(save, afterRaw, runsRaw, advice.game.mode);
    return won === null ? null : fightEntry(advice, stats, won);
  }

  // Journal avec cette ligne, sans les plus anciens combats de la même clé (cellOf) au-delà de JOURNAL_MAX : les combats de
  // la Tour n'évincent pas ceux d'une aventure.
  function addFight(fights, entry) {
    const old = new Set(fights.filter(f => f.k === entry.k).slice(0, 1 - JOURNAL_MAX));
    return [...fights.filter(f => !old.has(f)), entry];
  }

  // Bilan des combats de la Tour, ou de l'aventure et de sa difficulté : victoires, victoires attendues (somme des taux), écart type de cette
  // somme, et shift, l'écart moyen en points (résultat moins taux attendu), rétréci par OWN_PRIOR combats sans écart et borné
  // à OWN_MAX. Sans seuil : un écart compté à partir d'un seuil sauterait de 0 à 10 points sur un seul combat. followed,
  // other : avec ou sans le trio posé ; onPace, behind : au niveau visé ou en dessous, sur les lignes qui notent un niveau
  // visé (g au-dessus de 0).
  function ownResults(fights, mode) {
    const mine = fights.filter(f => f.k === cellOf(mode));
    const paced = f => Number.isFinite(f.l) && f.g > 0;
    const tally = list => ({
      n: list.length, wins: list.reduce((s, f) => s + f.w, 0), expected: list.reduce((s, f) => s + f.p / 100, 0),
      spread: Math.sqrt(list.reduce((s, f) => s + f.p * (100 - f.p) / 1e4, 0)),
    });
    const all = tally(mine);
    const gap = Math.round(100 * (all.wins - all.expected) / (all.n + OWN_PRIOR));
    return {
      ...all, runs: new Set(mine.map(f => f.r)).size, shift: Math.max(-OWN_MAX, Math.min(OWN_MAX, gap)),
      followed: tally(mine.filter(f => f.c === 1)), other: tally(mine.filter(f => f.c === 0)),
      onPace: tally(mine.filter(f => paced(f) && f.l >= f.g)), behind: tally(mine.filter(f => paced(f) && f.l < f.g)),
    };
  }

  // Mode dont la pénalité suit les résultats du joueur : ses taux comptent shift points de plus ou de moins que les taux
  // publics, pour le seuil de « tout jouer », la couleur des taux, le poids des combats dans la compo cible et l'avance des
  // niveaux visés (advanceOf).
  function withResults(mode, fights) {
    const { shift } = ownResults(fights, mode);
    // 0 - shift : un écart nul donne 0 et non −0, que Object.is et deepStrictEqual distinguent.
    const penalty = mode.leaguePenalty - shift;
    return { ...mode, ownPenalty: 0 - shift, penalty, advance: advanceOf(mode, penalty) };
  }

  const decimal = x => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

  // Phrases du bilan affiché dans l'onglet Règles.
  function resultsNote(mode, fights) {
    const r = ownResults(fights, mode);
    if (!r.n) return ['Aucun combat noté : le panneau note le résultat de chaque combat joué avec lui, puis compare tes victoires aux taux publics.'];
    const line = t => `${t.wins} ${t.wins > 1 ? 'victoires' : 'victoire'} pour ${decimal(t.expected)} attendues (± ${decimal(1.96 * t.spread)}) sur ${t.n} ${t.n > 1 ? 'combats' : 'combat'}`;
    const notes = [`${line(r)}, ${r.runs} ${r.runs > 1 ? 'parties' : 'partie'}.`];
    if (r.followed.n && r.other.n) notes.push(`Trio de la compo cible posé : ${line(r.followed)}. Sans lui : ${line(r.other)}.`);
    if (r.onPace.n && r.behind.n) notes.push(`Au niveau visé : ${line(r.onPace)}. En dessous : ${line(r.behind)}.`);
    notes.push(r.shift
      ? `Les taux publics comptent ${Math.abs(r.shift)} ${Math.abs(r.shift) > 1 ? 'points' : 'point'} de ${r.shift > 0 ? 'plus' : 'moins'} pour toi : seuil de « tout jouer », couleurs, poids des combats.`
      : 'Aucun écart compté : les taux publics sont gardés tels quels.');
    return notes;
  }

  const findLine = (stats, id) => stats.lines.find(l => l.line === id);

  // Écart de victoire rétréci d'une forme : vers 0 pour la lignée de base, vers celui de sa lignée de base pour une forme
  // ancrée, souvent peu jouée ; 0 sans statistiques.
  function shrunkGap(stats, id) {
    const shrink = (s, prior) => (s.d * s.ne + prior * LINE_PRIOR) / (s.ne + LINE_PRIOR);
    const base = findLine(stats, baseLine(id));
    const prior = base ? shrink(base, 0) : 0;
    const own = id === baseLine(id) ? undefined : findLine(stats, id);
    return own ? shrink(own, prior) : prior;
  }

  // Coût gagné (+1) ou perdu (−1) par une forme selon son écart de victoire rétréci, 0 sous SHIFT_GAP points.
  function costShift(stats, id) {
    const gap = shrunkGap(stats, id);
    return Math.abs(gap) >= SHIFT_GAP ? Math.sign(gap) : 0;
  }

  // ★★★ nettement moins forte que ★★ pour cette forme exacte (identifiant du trio) : intervalles à 95 % de l'API disjoints,
  // ramenés à l'écart de victoire (taux − attendu). Sans statistiques aux deux étoiles, la ★★★ se cherche.
  function flatThirdStar(stats, id) {
    const at = star => stats.stars.find(s => s.line === id && s.star === star);
    const [two, three] = [at(2), at(3)];
    return Boolean(two && three) && three.hi - three.exp < two.lo - two.exp;
  }

  // Note d'un trio : borne basse de son taux, en moyenne pondérée par la difficulté sur les combats qui ont des trios notés (un
  // combat sans statistiques, manche peu jouée de campagne, laisserait sinon les bonus de possession l'emporter ; 0 sans
  // aucun), plus ces bonus. Une lignée à trouver dont le coût, connu, ne sort pas assez au niveau du joueur coûte ce qu'une
  // lignée possédée rapporte.
  function coreScore(core, stops, coresByStop, game, data) {
    const { ownedBonus } = game.mode;
    const rated = stops.filter(st => coresByStop.get(st.stop)?.size);
    const total = totalWeight(rated);
    const key = coreKey(core);
    const stat = total ? rated.reduce((s, st) => s + st.weight * (coresByStop.get(st.stop).get(key)?.lo ?? 0), 0) / total : 0;
    const owned = core.reduce((s, id) => {
      const base = baseLine(id);
      const star = bestStar(game, base);
      if (star === 0) return s - (lineInfo(data, base) && !findable(data, game.level, base) ? ownedBonus : 0);
      return s + ownedBonus + (star >= 2 ? ownedBonus : 0) + (shinyLine(game, base) ? SHINY_BONUS : 0);
    }, 0);
    return stat + owned;
  }

  // Trios d'au moins MIN_FIGHTS combats de chaque combat, par clé de trio ; index des trios de l'API construit une fois par liste.
  const coresMemo = new WeakMap();
  function coresIndex(cores) {
    if (!coresMemo.has(cores)) {
      const index = new Map();
      for (const c of cores) {
        if (c.n < MIN_FIGHTS) continue;
        if (!index.has(c.stop)) index.set(c.stop, new Map());
        index.get(c.stop).set(coreKey(c.core), c);
      }
      coresMemo.set(cores, index);
    }
    return coresMemo.get(cores);
  }
  const coresAt = (stats, stops) => new Map(stops.map(st => [st.stop, coresIndex(stats.cores).get(st.stop) ?? new Map()]));

  // Force de chaque lignée de base sur une fenêtre de combats : écart, pondéré par la difficulté des combats, entre le taux de
  // victoire des trios où elle figure (pondéré par leurs combats) et celui du combat. Un combat sans trio pour elle compte zéro.
  function lineStrength(coresByStop, stops) {
    const total = totalWeight(stops);
    const strength = new Map();
    for (const st of stops) {
      const sums = new Map();
      for (const c of coresByStop.get(st.stop).values()) {
        for (const base of new Set(c.core.map(baseLine))) {
          const sum = sums.get(base) ?? { n: 0, win: 0 };
          sum.n += c.n;
          sum.win += c.n * c.win;
          sums.set(base, sum);
        }
      }
      for (const [base, x] of sums) strength.set(base, (strength.get(base) ?? 0) + (st.weight * (x.win / x.n - st.win)) / total);
    }
    return strength;
  }

  // Seuils de type franchis ou approchés en ajoutant une lignée à l'équipe.
  function traitGain(data, chosen, base) {
    const counts = new Map();
    for (const b of chosen) for (const t of lineInfo(data, b)?.t ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    let gain = 0;
    for (const t of lineInfo(data, base)?.t ?? []) {
      const n = (counts.get(t) ?? 0) + 1;
      if (data.traits[t]?.th.includes(n)) gain += 2;
      else if (counts.has(t)) gain += 1;
    }
    return gain;
  }

  // Meilleur trio sur une fenêtre de combats (+inertia du mode pour le trio précédent), avec sa preuve : le trio sur le combat le plus
  // dur où il a des statistiques.
  function bestCore(coresByStop, data, game, stops, previousKey) {
    const candidates = new Map();
    for (const m of coresByStop.values()) for (const [key, c] of m) candidates.set(key, c.core);
    if (!candidates.size) return null;
    let best = null;
    for (const [key, core] of candidates) {
      const score = coreScore(core, stops, coresByStop, game, data) + (key === previousKey ? game.mode.inertia : 0);
      if (!best || score > best.score) best = { key, core: [...core], score };
    }
    const proof = [...stops].sort((a, b) => b.weight - a.weight)
      .map(st => ({ st, c: coresByStop.get(st.stop).get(best.key) })).find(x => x.c);
    return { key: best.key, core: best.core, stops, proof };
  }

  // Compléments du trio core jusqu'au niveau (fillers) : les lignées possédées les mieux notées ; la boutique ne complète que
  // les places restantes, sinon le plan changerait à chaque actualisation. Note : puissance (une carte de boutique vaut une ★ ;
  // deux copies de la meilleure étoile, que la 3ᵉ fusionnera et que l'actualisation cherche, valent l'étoile suivante), au
  // coût décalé par costShift de la forme possédée (la lignée de base pour une carte), types apportés à la compo, force sur
  // le prochain combat (nextFight, NEXT_FIGHT_WEIGHT) et inertie des compléments du conseil précédent (previous,
  // FILLER_INERTIA) ; les égalités restantes sont départagées par possédée, shiny, puis la plus forte sur ces combats
  // (strength). upgrades : cartes de boutique mieux notées qu'un complément possédé, inertie comprise (achetée, la carte doit
  // le remplacer), à acheter pour le remplacer ; replaced : ces compléments.
  function fillersOf(stats, data, game, core, { strength, nextFight, previous }) {
    const known = b => lineInfo(data, b) && !core.includes(b);
    const mine = [...new Set(game.units.map(u => baseLine(u.line)))].filter(known);
    const cards = [...new Set(game.shop.filter(Boolean))].filter(b => known(b) && !mine.includes(b));
    const owned = b => Number(bestStar(game, b) > 0);
    // Forme de la copie posée (fieldOrder, comme holdersOf) : la note décrit l'unité que la formation place.
    const form = b => unitsOf(game, b).sort(fieldOrder)[0]?.line ?? b;
    const shift = new Map([...mine, ...cards].map(b => [b, costShift(stats, form(b))]));
    const star = b => {
      const best = Math.max(1, bestStar(game, b));
      return pairAt(game, b, best) ? best + 1 : best;
    };
    // Meilleures lignées de chaque liste, une liste après l'autre, jusqu'au niveau.
    const fill = pools => {
      const chosen = [...core];
      const score = b => unitPower(lineInfo(data, b).c + shift.get(b), star(b)) + TRAIT_WEIGHT * traitGain(data, chosen, b)
        + NEXT_FIGHT_WEIGHT * Math.max(-NEXT_FIGHT_CAP, Math.min(NEXT_FIGHT_CAP, nextFight.get(b) ?? 0))
        + (previous.includes(b) ? FILLER_INERTIA : 0);
      for (const pool of pools) {
        while (chosen.length < game.level) {
          const next = pool
            .filter(b => !chosen.includes(b))
            .sort((a, b) => score(b) - score(a) || owned(b) - owned(a) || Number(shinyLine(game, b)) - Number(shinyLine(game, a))
              || (strength.get(b) ?? 0) - (strength.get(a) ?? 0) || a.localeCompare(b))[0];
          if (!next) break;
          chosen.push(next);
        }
      }
      return chosen.slice(core.length);
    };
    const fillers = fill([mine, cards]);
    const mixed = fill([[...mine, ...cards]]);
    const upgrades = mixed.filter(b => cards.includes(b) && !fillers.includes(b));
    // Autant de compléments possédés que de cartes, les moins bien notés.
    const replaced = upgrades.length ? fillers.filter(b => owned(b) && !mixed.includes(b)).slice(-upgrades.length) : [];
    return { fillers, upgrades: upgrades.slice(0, replaced.length), replaced };
  }

  // Compo cible : le meilleur trio et ses compléments (fillersOf). previous : { key, fillers } du conseil précédent de la même
  // partie, ou null. flat : lignées du trio dont la ★★★ est nettement moins forte que la ★★ (flatThirdStar) ; strength :
  // lineStrength sur ces combats, qui classe aussi les porteurs (holdersOf).
  function targetComp(stats, data, game, previous) {
    const stops = nextStops(stats.stops, game.floor, game.mode.horizon, game.mode);
    const coresByStop = coresAt(stats, stops);
    // En campagne, sans trio noté sur ces combats (aventure sans table d'arrêts, Canela aux manches sans statistiques), la
    // compo se fait sans trio : tes meilleures unités, puis la boutique.
    const best = bestCore(coresByStop, data, game, stops, previous?.key)
      ?? (game.mode.id === TOWER.id ? null : { key: null, core: [], stops, proof: null });
    if (!best) return null;
    const strength = lineStrength(coresByStop, stops);
    // Toutes les variantes du prochain combat (champions possibles d'une manche), pondérées par leur part. Sans trio d'au moins
    // MIN_FIGHTS combats sur ce combat, la carte est vide : rien ne change.
    const nextFight = lineStrength(coresByStop, stops.filter(st => st.floor === stops[0].floor));
    const { fillers, upgrades, replaced } = fillersOf(stats, data, game, best.core.map(baseLine), { strength, nextFight, previous: previous?.fillers ?? [] });
    if (!best.core.length && !fillers.length) return null;
    const flat = best.core.filter(id => flatThirdStar(stats, id)).map(baseLine);
    return { ...best, fillers, upgrades, replaced, flat, strength };
  }

  // Trio des horizon combats suivants (10 à 18 en normal), à préparer avec le surplus ; null s'il est déjà la compo cible.
  // previous : { next } du conseil précédent de la même partie, ou null.
  function nextComp(stats, data, game, target, previous) {
    const stops = nextStops(stats.stops, game.floor, game.mode.horizon, game.mode, game.mode.horizon);
    const next = bestCore(coresAt(stats, stops), data, game, stops, previous?.next);
    return next && next.key !== target.key ? next : null;
  }

  const floorRange = (stops, mode) => `${mode.units} ${stops[0].floor}–${stops.at(-1).floor}`;

  const targetBases = target => (target ? [...target.core.map(baseLine), ...target.fillers] : []);
  const nextBases = next => (next ? next.core.map(baseLine) : []);

  function progress(game, base) {
    const star = bestStar(game, base);
    return star >= 2 ? '★'.repeat(star) : `${ones(game, base)}/3`;
  }

  // Marque : { level: 'do' | 'opt' | 'no', label, title, why, detail } ; label = texte de la pastille, vide = conseil du panneau
  // seul ; detail = ligne de preuve de la bulle.
  const mark = (level, label, title, why, detail = '') => ({ level, label, title, why, detail });

  const proofText = (p, names) => (p ? `${p.c.core.map(names.line).join(' · ')} : ${pct(p.c.win)} contre ${bossName(p.st.boss)} ${p.st.floor} (${p.c.n} combats, au moins ${pct(p.c.lo)})` : '');

  // Cartes de la boutique (null pour une case vide) et ce que la compo en attend.
  function shopCards(game, target, next, data, names) {
    const wanted = targetBases(target);
    const core = target ? target.core.map(baseLine) : [];
    const later = nextBases(next);
    const upgrades = target?.upgrades ?? [];
    return game.shop.map((base, i) => base && {
      base, name: names.line(base), cost: lineInfo(data, base)?.c, triple: pairAt(game, base, 1),
      inTarget: wanted.includes(base) || upgrades.includes(base), inCore: core.includes(base), inNext: later.includes(base), shiny: game.shopShiny[i],
      // Lignée de la compo pas encore possédée : elle remplit une place libre du plateau.
      fills: wanted.includes(base) && bestStar(game, base) === 0, upgrade: upgrades.includes(base),
    }).map(c => c && { ...c, stronger: c.upgrade ? `plus fort que ${target.replaced.map(names.line).join(', ')}` : '' });
  }

  // Les fonctions de marques de la boutique lisent shop = { cards, marks, game, target, next, data, eco, names } (spend) et
  // remplissent marks, une case par carte ; left : or restant, qu'elles renvoient diminué de ce qu'elles engagent.
  const keepFloor = eco => `garde ${eco.floor} pièces pour les intérêts`;

  // ★ du trio, des 3ᵉ copies et des shinies, de gauche à droite ; ne s'arrêtent pas au palier. Un ★ que l'or ne couvre pas
  // devient un ◆ « dès que possible » (short).
  function starMarks(shop, left) {
    const { cards, marks, game, target, names } = shop;
    const proof = proofText(target?.proof, names);
    let short = false;
    cards.forEach((c, i) => {
      if (!c) return;
      let buy = null;
      if (c.triple && (c.inTarget || !target)) {
        buy = [c.name, c.inCore ? '3ᵉ copie, passe ★★ ; cœur de la compo cible' : '3ᵉ copie, passe ★★', c.inCore ? proof : ''];
      } else if (c.inCore) buy = [c.name, 'cœur de la compo cible', proof];
      // +10 % tout de suite seulement si la carte devient la meilleure copie de sa lignée.
      else if (c.shiny && c.inTarget && bestStar(game, c.base) <= 1 && !shinyLine(game, c.base)) buy = [`${c.name} shiny`, '+10 % PV, défenses et dégâts'];
      if (!buy) return;
      const [name, why, detail = ''] = buy;
      // Coût inconnu (données de jeu indisponibles) : le conseil ne peut pas vérifier l'or.
      if (c.cost !== undefined && c.cost > left) {
        short = true;
        marks[i] = mark('opt', 'Si l’or', `Achète ${name} dès que possible`, `${why} ; il manque de l’or`, detail);
        return;
      }
      left -= c.cost ?? 0;
      marks[i] = mark('do', 'Achète', `Achète ${name}`, why, detail);
    });
    return { left, short };
  }

  // ★ des places libres, après les ★ ci-dessus : une copie par lignée (spend la saute quand un ★ manque d'or).
  function freeSlotMarks({ cards, marks }, left) {
    const filled = new Set();
    cards.forEach((c, i) => {
      if (!c || marks[i] !== undefined || !c.fills || filled.has(c.base) || c.cost > left) return;
      filled.add(c.base);
      left -= c.cost ?? 0;
      marks[i] = mark('do', 'Achète', `Achète ${c.name}`, 'place libre sur le plateau');
    });
    return left;
  }

  // ◆ de la compo cible (compléments, cartes plus fortes, 3ᵉ copies hors compo) qui gardent le palier ; en tout jouer, qui
  // tiennent dans l'or restant.
  function targetOptMarks({ cards, marks, eco }, left) {
    cards.forEach((c, i) => {
      if (!c || marks[i] !== undefined) return;
      const fits = c.cost !== undefined && (eco.allIn ? c.cost <= left : left - c.cost >= eco.floor);
      if (!(c.inTarget || (c.triple && !c.inNext)) || !fits) return;
      left -= c.cost;
      let why = 'renforce le plateau de la compo';
      if (c.triple) why = '3ᵉ copie hors compo';
      else if (c.upgrade) why = c.stronger;
      marks[i] = mark('opt', 'Si l’or', eco.allIn ? `${c.name} si l’or suffit` : `${c.name} si l’or reste ≥ ${eco.floor}`, why);
    });
    return left;
  }

  // ◆ de la compo suivante (hors tout jouer, après l'actualisation conseillée, qui coûte rerollCost), puis ✕ pour le reste, avec
  // le motif de l'or : l'XP réservée (xpCost) quand la carte tenait sans elle, sinon le palier.
  function restMarks(shop, left, xpCost, rerollCost) {
    const { cards, marks, game, eco, next, names } = shop;
    const hold = cost => {
      if (eco.allIn) return 'il manque de l’or';
      const beforeXp = cost !== undefined && left + xpCost - cost >= eco.floor && left - cost < eco.floor;
      return beforeXp ? 'l’or va d’abord à l’XP' : keepFloor(eco);
    };
    cards.forEach((c, i) => {
      if (!c || marks[i] !== undefined) return;
      if (c.inNext && !c.inTarget) {
        const range = floorRange(next.stops, game.mode);
        const fits = c.cost !== undefined && left - c.cost >= eco.floor;
        if (!eco.allIn && fits && left - c.cost - rerollCost >= eco.floor) {
          left -= c.cost;
          marks[i] = mark('opt', 'Si l’or', `${c.name} si l’or reste ≥ ${eco.floor}`, `prépare la compo des ${range}`, proofText(next.proof, names));
          return;
        }
        let why = `compo des ${range} ; ${hold(c.cost)}`;
        if (eco.allIn) why = 'tout jouer : l’or va à la compo cible';
        else if (fits) why = `compo des ${range} ; l’or va d’abord à l’actualisation pour la compo cible`;
        marks[i] = mark('no', 'Ignore', `Ignore ${c.name}`, why);
        return;
      }
      marks[i] = mark('no', 'Ignore', `Ignore ${c.name}`, c.inTarget ? `${c.upgrade ? c.stronger : 'complément de la compo'} ; ${hold(c.cost)}` : 'hors compo cible');
    });
    return left;
  }

  // Dépenses du tour, dans l'ordre où l'or leur va : ★ de la boutique, ★ des places libres, XP réservée (xpMark), ◆ de la
  // compo cible, actualisation (rerollMark), ◆ de la compo suivante. L'or que ni un achat ni une actualisation n'engage va au
  // niveau suivant (spareXp). L'actualisation gratuite de la Boîte Jetons se conseille toujours, après les achats, sans
  // engager d'or. Sans compo cible, seules les 3ᵉ copies sont marquées. short : un ★ a été rétrogradé faute d'or (déclenche
  // « Vends »).
  function spend(game, target, next, data, eco, names) {
    const cards = shopCards(game, target, next, data, names);
    const shop = { cards, marks: cards.map(() => undefined), game, target, next, data, eco, names };
    const stars = starMarks(shop, game.gold);
    let left = stars.short ? stars.left : freeSlotMarks(shop, stars.left);
    const xp = xpMark(game, eco, left);
    left -= xp.cost;
    let ordinary = null;
    if (target) {
      left = targetOptMarks(shop, left);
      ordinary = rerollMark(shop, left);
      left = restMarks(shop, left, xp.cost, ordinary?.level === 'do' ? REROLL_COST : 0);
    }
    // L'or d'une actualisation payante conseillée reste réservé derrière la gratuite : elle se conseillera à la lecture suivante.
    const paid = ordinary?.level === 'do';
    const free = `gratuite à cet étage (Boîte Jetons), après les achats${paid ? ` ; puis payante : ${ordinary.why}` : ''}`;
    const reroll = game.freeReroll ? mark('do', 'Actualise', 'Actualise', free) : ordinary;
    return { shop: shop.marks.map(m => m ?? null), xp: xp.spare ? spareXp(game, eco, left, paid) : xp.mark, reroll, short: stars.short };
  }

  // Lignées de la compo qui valent une actualisation : trio sous ★★ (sous ★★★ au niveau maximal, sauf ★★★ nettement moins
  // forte, target.flat), et toute lignée qui a 2 copies ★ (la 3ᵉ donne la ★★) ou 2 copies ★★ (la 3ᵉ ★★ donne la ★★★).
  function seekLines(game, target) {
    const core = target.core.map(baseLine);
    const top = game.level >= maxLevel(game.floor, game.mode);
    const coreStar = base => (top && !target.flat.includes(base) ? 3 : 2);
    return targetBases(target).filter(base => bestStar(game, base) < 3
      && ((core.includes(base) && bestStar(game, base) < coreStar(base)) || pairAt(game, base, 1) || pairAt(game, base, 2)));
  }

  // Marque de l'actualisation, renvoyée sans toucher shop.marks ; shop : contexte de spend, avec une compo cible. left : or
  // restant après les achats conseillés. Hors tout jouer, le niveau visé passe avant l'actualisation, qui ne se conseille
  // qu'à REROLL_CHANCE de voir une copie cherchée (rerollChance) ; au niveau maximal, où l'or n'a plus d'autre emploi, à
  // toute chance. Sinon, le premier niveau où cette chance est atteinte est annoncé ; sans un tel niveau, ou pour une
  // lignée de coût inconnu, aucun conseil.
  function rerollMark(shop, left) {
    const { game, target, data, eco, names } = shop;
    const wanted = seekLines(game, target);
    if (!wanted.length) return null;
    if (eco.allIn) return left >= REROLL_COST ? mark('do', 'Actualise', 'Actualise', 'tout jouer : chercher les copies de la compo') : null;
    const seek = wanted.filter(base => lineInfo(data, base));
    const keep = why => mark('no', 'Garde l’or', 'N’actualise pas', why);
    const goal = levelGoal(game.floor, game.mode);
    if (game.level < goal) return keep(`d’abord le niveau ${goal}`);
    const top = maxLevel(game.floor, game.mode);
    const chance = level => rerollChance(game, data, level, seek);
    const visible = level => seek.filter(base => rerollChance(game, data, level, [base]) > 0).map(names.line).join(', ');
    const odds = x => `${x < 1 ? 'moins de 1' : Math.round(x)} % par actualisation`;
    const now = chance(game.level);
    if (game.level >= top ? now === 0 : now < REROLL_CHANCE) {
      // Le niveau maximal n'est annoncé qu'à REROLL_CHANCE : toute chance y suffit faute d'autre emploi de l'or, pas parce
      // que l'actualisation y vaut mieux.
      const reach = Array.from({ length: Math.max(0, top - game.level) }, (_, i) => game.level + 1 + i).find(level => chance(level) >= REROLL_CHANCE);
      if (!reach) return null;
      const here = now > 0 ? visible(game.level) : seek.map(names.line).join(', ');
      const there = visible(reach);
      const state = now > 0 ? `${here} : ${odds(now)} au niveau ${game.level}` : `${here} ${seek.length > 1 ? 'ne sortent' : 'ne sort'} pas au niveau ${game.level}`;
      return keep(`${state} ; à chercher au niveau ${reach}${there === here ? '' : ` pour ${there}`} : ${odds(chance(reach))}`);
    }
    if (left - REROLL_COST < eco.floor) return keep(`tu passerais sous ${eco.floor} pièces`);
    return mark('do', 'Actualise', 'Actualise', `cherche ${visible(game.level)} : ${odds(now)} au niveau ${game.level}`);
  }

  const buyXp = why => mark('do', 'Monte', 'Achète de l’XP', why);
  const waitXp = why => mark('no', 'Attends', 'N’achète pas d’XP', why);
  const missingXp = game => XP_TO_NEXT[game.level] - game.xp;

  // Renvoie la marque et l'or qu'elle engage. left : or restant après les achats conseillés. Sous le niveau visé, tout le
  // surplus utile à ce niveau est engagé : les ◆ de la boutique passent après. Niveau visé atteint et niveau suivant à plus
  // d'un achat : spare, la décision attend l'actualisation (spareXp), car l'XP passe alors après elle.
  function xpMark(game, eco, left) {
    if (game.level >= maxLevel(game.floor, game.mode)) return { mark: null, cost: 0 };
    const missing = missingXp(game);
    const toLevel = Math.ceil(missing / XP_COST) * XP_COST;
    if (eco.allIn) {
      return left >= toLevel
        ? { mark: buyXp(`tout jouer : niveau ${game.level + 1} pour ${toLevel} pièces`), cost: toLevel }
        : { mark: null, cost: 0 };
    }
    if (left - XP_COST < eco.floor) return { mark: waitXp(keepFloor(eco)), cost: 0 };
    const quick = `niveau ${game.level + 1} pour ${XP_COST} pièces`;
    const goal = levelGoal(game.floor, game.mode);
    if (game.level < goal) {
      const toGoal = XP_TO_NEXT.slice(game.level, goal).reduce((sum, xp) => sum + xp, 0) - game.xp;
      const cost = Math.min(Math.ceil(toGoal / XP_COST), Math.floor((left - eco.floor) / XP_COST)) * XP_COST;
      return { mark: buyXp(missing <= XP_COST ? quick : `niveau ${goal} visé ${game.mode.here} ; ${missing} XP avant le niveau ${game.level + 1}`), cost };
    }
    if (missing <= XP_COST) return { mark: buyXp(quick), cost: XP_COST };
    return { mark: null, cost: 0, spare: true };
  }

  // Suite de xpMark (spare) : l'or que l'actualisation conseillée n'engage pas va au niveau suivant. left : or restant après
  // tous les achats conseillés ; rerolling : une actualisation payante est conseillée.
  function spareXp(game, eco, left, rerolling) {
    if (rerolling) return waitXp('l’or va d’abord à l’actualisation');
    if (left - XP_COST < eco.floor) return waitXp(keepFloor(eco));
    return buyXp(`rien à chercher en boutique à ce niveau ; ${missingXp(game)} XP avant le niveau ${game.level + 1}`);
  }

  function sellMarks(game, target, next, names, short) {
    if (!target) return game.bench.map(() => null);
    // Faute d'or pour un ★ de la compo cible, la compo suivante n'est plus gardée.
    const wanted = [...targetBases(target), ...(short ? [] : nextBases(next))];
    const free = game.bench.filter(id => !id).length;
    return game.bench.map(id => {
      const u = id && game.units.find(x => x.id === id);
      if (!u) return null;
      const base = baseLine(u.line);
      const shinyKept = u.shiny && game.floor <= game.mode.shinyKeepTo;
      // Vendu, il rend ses objets au sac : seulement s'il ne sert ni à la compo cible ni à la suivante.
      if (u.items?.length && !shinyKept && ![...targetBases(target), ...nextBases(next)].includes(base)) {
        return mark('no', 'Vends', `Vends ${names.line(u.line)}`, 'hors des compos : il rend ses objets au sac');
      }
      const paired = game.units.some(x => x.id !== u.id && baseLine(x.line) === base && x.star === u.star);
      if (wanted.includes(base) || paired || shinyKept || (free > 1 && !short)) return null;
      const forGold = free > 1 || nextBases(next).includes(base);
      return mark('no', 'Vends', `Vends ${names.line(u.line)}`, forGold ? 'il manque de l’or pour un achat conseillé' : 'hors compo, libère le banc');
    });
  }

  function recipeBook(data) {
    const make = new Map();
    const parts = new Map();
    for (const [a, b, full] of data.recipes) {
      make.set(`${a}+${b}`, full);
      make.set(`${b}+${a}`, full);
      parts.set(full, [a, b]);
    }
    return { make, parts };
  }

  // Autre composant de la recette d'un objet complet.
  const otherPart = (book, full, id) => {
    const [a, b] = book.parts.get(full);
    return a === id ? b : a;
  };

  const itemKind = (data, id) => data.items[id]?.k;

  // Composants qui donnent ses stats à un objet : inherits de l'API, qui diffère parfois de la recette (Casque Brut : PV Plus +
  // Fer, recette PV Plus + Protéine) ; vide pour les objets Choix, dont la recette porte la stat.
  function itemParts(data, id) {
    if (itemKind(data, id) === 'part') return [id];
    if (itemKind(data, id) !== 'full') return [];
    const item = data.items[id];
    return item.inherits?.length ? item.inherits.flatMap(x => Array(x.n).fill(x.part)) : item.recipe ?? [];
  }

  // Stats d'attaque qui servent une lignée de base, d'après les règles du jeu (roster-*.js) : l'Attaque porte les attaques de
  // base de tous et les capacités physiques, l'Atq. Spé. les capacités spéciales, soins et boucliers. L'échelle de la capacité
  // du dernier stade (scale), celui que la lignée vise, dit laquelle elle suit : la plus forte des deux, les deux à égalité.
  // basic : ses attaques de base comptent, quand l'Attaque d'un stade au moins atteint BASIC_RATIO fois son Atq. Spé.
  // (Magicarpe n'y arrive qu'en Léviator) ; l'API ne publie pas le rôle. flex : lignée à deux formes, qui prend la capacité
  // physique ou spéciale selon la stat que ses objets donnent le plus. Une lignée inconnue de data.json et de LINES_V41, ou
  // sans échelle au dernier stade, ou sans Attaque ni Atq. Spé. à un stade, est traitée de même, faute de capacité connue.
  // Deux formes sur d'autres axes (Ramoloss : Défense contre Déf. Spé. ; Nidoqueen : Attaque contre Défense) : les stats des
  // deux capacités comptent, approximation faute de lire la forme jouée sur les seuls objets d'attaque.
  function attackKit(data, base) {
    const info = lineInfo(data, base);
    if (info?.hit) return { basic: info.hit.includes('atk'), atk: info.hit.includes('atk'), spa: info.hit.includes('spa'), flex: false };
    const stars = info?.stars ?? [];
    const last = stars[stars.length - 1];
    const moves = [last?.move, last?.flex?.phys, last?.flex?.spec].filter(Boolean);
    const known = moves.length > 0 && moves.every(m => [m.scale?.atk, m.scale?.spa].every(Number.isFinite))
      && stars.every(s => [s.stats?.atk, s.stats?.spa].every(Number.isFinite));
    if (!known) return { basic: true, flex: true };
    const basic = stars.some(s => s.stats.atk >= BASIC_RATIO * s.stats.spa);
    const leads = (own, other) => moves.some(m => m.scale[own] > 0 && m.scale[own] >= m.scale[other]);
    return { basic, atk: basic || leads('atk', 'spa'), spa: leads('spa', 'atk'), flex: ['atk', 'spa'].every(x => last.flex?.axes?.includes(x)) };
  }

  // Profil de chaque lignée de base. tank : lu sur les objets qu'elle porte dans le mode (pondérés par le nombre de combats),
  // quand la part de composants défensifs atteint TANK_SHARE ; data.json ne sépare pas tanks et attaquants. basic, atk, spa :
  // attackKit. Une lignée à deux formes n'est servie que par une stat, celle que ces objets portés lui donnent le plus
  // (Calcium contre Protéine, l'Attaque à égalité) : des objets des deux stats la feraient changer de capacité.
  function lineProfiles(stats, data) {
    const sums = new Map();
    for (const h of stats.holders) {
      const parts = itemParts(data, h.id);
      if (!parts.length) continue;
      const base = baseLine(h.line);
      const sum = sums.get(base) ?? { n: 0, def: 0, atk: 0, spa: 0 };
      const count = list => parts.filter(p => list.includes(p)).length;
      sum.n += h.n;
      sum.def += (h.n * count(DEFENSE)) / parts.length;
      for (const [part, stat] of Object.entries(ATTACK)) sum[stat] += h.n * count([part]);
      sums.set(base, sum);
    }
    return new Map([...sums].map(([base, x]) => {
      const kit = attackKit(data, base);
      const [atk, spa] = kit.flex ? [x.atk >= x.spa, x.spa > x.atk] : [kit.atk, kit.spa];
      return [base, { tank: x.def / x.n >= TANK_SHARE, basic: kit.basic, atk, spa }];
    }));
  }

  // Composant d'attaque dont la stat ne sert pas la lignée : seul, il ne lui apporte rien, et il ferait changer de capacité
  // une lignée à deux formes.
  const idlePart = (profile, id) => profile !== null && ATTACK[id] !== undefined && !profile[ATTACK[id]];

  // Ce qu'un objet complet a de contraire à la lignée, null sinon : aucune des stats d'attaque qu'il donne ne la sert (Orbe
  // Vie donne les deux, il sert toujours).
  function wasted(data, profile, id) {
    const given = itemParts(data, id).filter(p => ATTACK[p]);
    if (!given.length || !given.every(p => idlePart(profile, p))) return null;
    return given.includes('protein') ? 'physique sur un spécial' : 'spécial sur un physique';
  }

  // Objet complet qui convient au profil : rien de contraire (wasted), au moins la moitié de composants défensifs pour un
  // tank, offensifs pour un attaquant. Sans profil, tout convient.
  function suits(data, profile, id) {
    if (!profile) return true;
    const parts = itemParts(data, id);
    if (!parts.length || wasted(data, profile, id)) return false;
    const def = parts.filter(p => DEFENSE.includes(p)).length;
    return profile.tank ? def * 2 >= parts.length : def * 2 <= parts.length;
  }

  // Ce qu'un objet porté contraire au profil a de faux, pour le conseil d'Aimant.
  const misfit = (data, profile, id) => wasted(data, profile, id) ?? (profile.tank ? 'offensif sur un tank' : 'défensif sur un attaquant');

  // Critique (Lentilscope) pour un lanceur, dont les attaques de base ne comptent pas : il ne touche une capacité que si elle
  // le dit, ce que l'API ne publie pas. L'objet n'est pas visé, sans être contraire : il donne aussi de l'Atq. Spé. et de la
  // vitesse, et porté il n'appelle pas l'Aimant.
  const idleCrit = (data, profile, id) => profile !== null && !profile.basic && data.items[id].stat === 'crit';

  // Meilleurs objets complets portés dans le mode par cette lignée exacte et qui conviennent à son profil, critique d'un lanceur
  // écarté : une forme ancrée (-aN) ne compte que pour elle-même ; le repli sur la lignée de base est dans idealItems.
  function topHolders(stats, data, line, profile) {
    return stats.holders
      .filter(h => h.line === line && h.n >= MIN_FIGHTS && itemKind(data, h.id) === 'full' && suits(data, profile, h.id) && !idleCrit(data, profile, h.id))
      .sort((a, b) => b.lo - a.lo).slice(0, MAX_ITEMS);
  }

  function idealItems(stats, data, line, profile) {
    const own = topHolders(stats, data, line, profile);
    return (own.length ? own : topHolders(stats, data, baseLine(line), profile)).map(h => h.id);
  }

  // Portée inconnue ou nulle : mêlée.
  const rangeOf = (data, base) => Math.max(1, lineInfo(data, base)?.range ?? 1);

  // Porteurs : un Pokémon possédé par lignée de la compo cible (fieldOrder). Rôles lus sur le profil de la lignée : porteur
  // (attaquant du cœur le mieux classé), tanks (aux PV max d'abord), puis les autres attaquants (★, shiny, force sur les combats
  // de la compo cible, lineStrength, puis coût : sans trio sur ces combats, la force manque, et l'ordre de la compo mêle les types).
  function holdersOf(stats, data, game, target, profiles) {
    const own = targetBases(target)
      .map(b => unitsOf(game, b).sort(fieldOrder)[0])
      .filter(Boolean);
    const profile = u => profiles.get(baseLine(u.line)) ?? null;
    const strength = u => target.strength.get(baseLine(u.line)) ?? 0;
    const cost = u => lineInfo(data, baseLine(u.line))?.c ?? 0;
    const rank = (a, b) => b.star - a.star || Number(!!b.shiny) - Number(!!a.shiny) || strength(b) - strength(a) || cost(b) - cost(a);
    const hp = u => (lineInfo(data, baseLine(u.line))?.stars?.[u.star - 1]?.stats.hp ?? 0) * (u.shiny ? SHINY_HP : 1);
    const tanks = own.filter(u => profile(u)?.tank).sort((a, b) => hp(b) - hp(a));
    const attackers = own.filter(u => !tanks.includes(u)).sort(rank);
    const carry = attackers.find(u => target.core.some(id => baseLine(id) === baseLine(u.line)));
    return [['carry', carry], ...tanks.map(u => ['tank', u]), ...attackers.filter(u => u !== carry).map(u => ['atk', u])]
      .filter(([, u]) => u)
      .map(([role, u]) => ({ role, unit: u, profile: profile(u), ideal: idealItems(stats, data, u.line, profile(u)) }));
  }

  // Lignées du cœur cible non possédées et du cœur de la compo suivante : leurs recettes idéales se préparent au sac.
  function futureLines(stats, data, target, next, holders, profiles, names) {
    const owned = new Set(holders.map(h => baseLine(h.unit.line)));
    return [...target.core, ...(next?.core ?? [])].filter(id => !owned.has(baseLine(id)) && owned.add(baseLine(id)))
      .map(id => ({ base: baseLine(id), who: names.line(baseLine(id)), ideal: idealItems(stats, data, id, profiles.get(baseLine(id)) ?? null) }));
  }

  const bestWhy = mode => `meilleur objet de sa lignée ${mode.where}`;

  // Objets du sac libres : ni posés par un conseil (★), ni gardés pour un Pokémon ou une lignée à venir.
  const freeBag = (bag, marks, reserved) => bag.filter((id, i) => marks[i]?.level !== 'do' && !reserved.has(i));

  // État des conseils du sac, partagé par itemMarks, magnetMarks, placePart et keepMarks. hs : porteurs (holdersOf) avec on, leurs objets
  // à la fin des conseils de ce passage ; slots : places libres ; lone : composant seul porté ; loneAt : case du sac du
  // composant seul conseillé dans ce passage ; after : paire à poser avant ; held : objets du sac gardés pour lui après
  // l'Aimant ; emptied : vidé par un Aimant de ce passage. reserved : cases du sac gardées pour un Pokémon précis (après
  // l'Aimant) ou pour une lignée à venir. needs : composants encore à réunir pour chaque recette idéale des lignées à venir,
  // une copie gardée par composant demandé.
  function itemState(data, game, holders, book, future, names) {
    const hs = holders.map(h => {
      const on = [...(h.unit.items ?? [])];
      const lone = on.find(id => itemKind(data, id) === 'part') ?? null;
      return { ...h, on, who: names.line(h.unit.line), slots: MAX_ITEMS - on.length, lone, loneAt: null, after: null, held: [], emptied: false };
    });
    const needs = future.flatMap(x => x.ideal.map(f => ({ x, f, left: [...(book.parts.get(f) ?? [])] })));
    return { data, game, book, names, future, hs, needs, marks: game.bag.map(() => null), reserved: new Set(), best: bestWhy(game.mode) };
  }

  const idealTo = (h, full) => h.ideal.includes(full) && !h.on.includes(full);
  const fusedWith = (s, h, id) => s.book.make.get(`${h.lone}+${id}`);
  // Objets du sac de ce type pas encore conseillés.
  const pendingIn = (s, k) => s.game.bag.map((id, i) => ({ id, i })).filter(x => s.marks[x.i] === null && itemKind(s.data, x.id) === k);
  // Recettes idéales encore à faire du Pokémon qui contiennent ce composant.
  const recipesWith = (s, h, id) => h.ideal.filter(f => idealTo(h, f) && s.book.parts.get(f)?.includes(id));
  // Recettes idéales où ce composant manque encore. Une copie du composant seul du Pokémon ne sert que si une autre recette
  // idéale le demande après sa fusion (deux recettes au moins qui le contiennent), ou si la recette le demande deux fois.
  function missingIn(s, h, id) {
    const all = recipesWith(s, h, id);
    if (id !== h.lone || all.length >= 2) return all;
    return all.filter(f => otherPart(s.book, f, id) === id);
  }
  // Pokémon de la compo qui attendent cet objet, ou un objet idéal où ce composant manque.
  const takers = (s, id) => s.hs.filter(h => idealTo(h, id) || missingIn(s, h, id).length);
  // Composant seul porté qui entre dans une recette idéale encore à faire ; sinon il bloque le Pokémon (Aimant).
  const keptLone = (s, h) => recipesWith(s, h, h.lone).length > 0;

  const putMark = (s, i, h, title, why) => {
    s.marks[i] = mark('do', `→ ${h.who}`, title, why);
  };
  const pendingAfter = h => (h.after ? ` (après ${h.after})` : '');
  const putPair = (s, i, j, h, a, b, why) => {
    const both = `${s.names.item(a)} + ${s.names.item(b)}`;
    putMark(s, i, h, `${both} → ${h.who}`, why + pendingAfter(h));
    putMark(s, j, h, `${both} → ${h.who}`, why + pendingAfter(h));
    h.after = both;
  };
  const putAlone = (s, i, h, id, why) => {
    putMark(s, i, h, `${s.names.item(id)} → ${h.who}`, why + pendingAfter(h));
    h.slots -= 1;
    h.on.push(id);
    Object.assign(h, { lone: id, loneAt: i });
  };
  // Fusion avec le composant seul du Pokémon : s'il a été conseillé dans ce passage, les deux bulles annoncent la paire. Sinon
  // ce composant se pose avant tout autre conseillé ensuite au Pokémon, qui fusionnerait à sa place avec le composant porté.
  const putFused = (s, i, h, id, why) => {
    const made = fusedWith(s, h, id);
    if (h.loneAt !== null) putPair(s, h.loneAt, i, h, h.lone, id, why);
    else {
      putMark(s, i, h, `${s.names.item(id)} → ${h.who}`, `fusionne avec ${s.names.item(h.lone)} : ${why}`);
      h.after = s.names.item(id);
    }
    h.on[h.on.indexOf(h.lone)] = made;
    Object.assign(h, { lone: null, loneAt: null });
  };

  // Paire idéale du sac : recette idéale d'un Pokémon libre, sans paire dans ce passage, dont l'autre composant attend dans le sac.
  function idealPair(s, free, id, i) {
    const waiting = pendingIn(s, 'part');
    for (const h of free.filter(x => !x.after)) {
      for (const f of recipesWith(s, h, id)) {
        const j = waiting.find(p => p.i !== i && p.id === otherPart(s.book, f, id))?.i;
        if (j !== undefined) return { h, f, ab: s.book.parts.get(f), j };
      }
    }
    return null;
  }

  // Composant, première règle qui s'applique : complète une recette idéale, paire idéale du sac, entame une recette idéale
  // d'un Pokémon que sa stat sert, attend un Pokémon de la compo qui ne peut pas le recevoir (motif dans keepMarks), reste au
  // sac pour la recette idéale d'une lignée à venir.
  function placePart(s, id, i) {
    const { names, best } = s;
    const done = s.hs.find(h => h.lone && idealTo(h, fusedWith(s, h, id)));
    if (done) return putFused(s, i, done, id, `${names.item(fusedWith(s, done, id))}, ${best}`);
    const free = s.hs.filter(h => h.slots > 0 && !h.lone);
    const duo = idealPair(s, free, id, i);
    if (duo) {
      putPair(s, i, duo.j, duo.h, ...duo.ab, `${names.item(duo.f)}, ${best}`);
      duo.h.slots -= 1;
      duo.h.on.push(duo.f);
      return;
    }
    const begun = free.filter(h => !idlePart(h.profile, id)).map(h => ({ h, f: recipesWith(s, h, id)[0] })).find(x => x.f);
    if (begun) {
      const other = names.item(otherPart(s.book, begun.f, id));
      return putAlone(s, i, begun.h, id, `${names.effect(id) ?? 'son effet'} tout de suite ; plus tard avec ${other} : ${names.item(begun.f)}, ${best}`);
    }
    if (takers(s, id).length) return;
    const later = s.needs.find(n => n.left.includes(id));
    if (later) {
      later.left.splice(later.left.indexOf(id), 1);
      s.reserved.add(i);
      s.marks[i] = mark('opt', 'Garde', `Garde ${names.item(id)}`, `${names.item(later.f)} pour ${later.x.who}, à venir`);
    }
  }

  // Aimant : sur un Pokémon de la compo qui porte un objet contraire à son profil, puis sur un Pokémon plein dont un objet
  // idéal attend au sac (complet, ou ses deux composants), ou sur un Pokémon bloqué par un composant seul hors de ses recettes
  // idéales dont les deux composants d'une recette idéale attendent au sac (un objet complet se pose sans fusionner), enfin
  // sur un Pokémon posé hors des deux compos qui porte des objets (au banc, la vente les rend : sellMarks). Il rend tous ses
  // objets au sac : le Pokémon ne reçoit plus rien dans ce passage, les conseils suivent au passage d'après.
  function magnetMarks(s, target) {
    const { data, game, book, names } = s;
    const count = id => freeBag(game.bag, s.marks, s.reserved).filter(x => x === id).length;
    const inBag = f => {
      const [a, b] = book.parts.get(f) ?? [];
      return count(f) > 0 || (a !== undefined && (a === b ? count(a) >= 2 : count(a) > 0 && count(b) > 0));
    };
    // Un composant porté convient s'il entre dans un objet complet qui convient.
    const fits = (h, id) => (itemKind(data, id) === 'part'
      ? [...book.parts].some(([f, ab]) => ab.includes(id) && suits(data, h.profile, f))
      : itemKind(data, id) === 'full' && suits(data, h.profile, id));
    const wrong = h => h.on.find(id => ['part', 'full'].includes(itemKind(data, id)) && !fits(h, id));
    const swap = h => {
      const bad = wrong(h);
      if (bad) return { why: `retire ${names.item(bad)} (${misfit(data, h.profile, bad)})`, ready: null };
      // Une recette que le composant seul porté complète par fusion avec un composant du sac n'a pas besoin de place.
      const fusable = x => h.lone !== null && book.parts.get(x)?.includes(h.lone) && count(otherPart(book, x, h.lone)) > 0;
      const blocked = h.lone && !keptLone(s, h);
      const ready = x => !h.on.includes(x) && !fusable(x) && inBag(x) && (h.slots === 0 || count(x) === 0);
      const f = (h.slots === 0 || blocked) && h.ideal.find(ready);
      const out = f && (blocked ? h.lone : h.on.find(x => ['part', 'full'].includes(itemKind(data, x)) && !h.ideal.includes(x)));
      return out ? { why: `retire ${names.item(out)} ; ${names.item(f)} prêt au sac`, ready: f } : null;
    };
    const wanted = [...targetBases(target), ...s.future.map(x => x.base)];
    const strays = game.units.filter(u => u.items?.length && boardCell(u.cell) !== null && !wanted.includes(baseLine(u.line)));
    const targets = [...s.hs.filter(wrong), ...s.hs.filter(h => !wrong(h))];
    for (const { i } of game.bag.map((id, j) => ({ id, i: j })).filter(x => x.id === 'magnet')) {
      // Calculé à chaque Aimant : l'objet réservé par le précédent n'est plus au sac.
      const m = targets.map(h => ({ h, ...swap(h) })).find(x => x.why);
      if (!m) {
        const u = strays.shift();
        if (u) s.marks[i] = mark('do', `Retire de ${names.line(u.line)}`, `Aimant sur ${names.line(u.line)}`, 'hors des compos : récupère ses objets');
        continue;
      }
      targets.splice(targets.indexOf(m.h), 1);
      s.marks[i] = mark('do', `Retire de ${m.h.who}`, `Aimant sur ${m.h.who}`, m.why);
      Object.assign(m.h, { slots: 0, lone: null, emptied: true });
      // L'objet prêt attend l'Aimant au sac : le complet s'il y est, sinon ses deux composants.
      if (!m.ready) continue;
      const keep = id => {
        const j = pendingIn(s, itemKind(data, id)).find(x => x.id === id).i;
        s.marks[j] = mark('opt', 'Garde', `Garde ${names.item(id)}`, `pour ${m.h.who}, après l’Aimant`);
        s.reserved.add(j);
        m.h.held.push(id);
      };
      if (count(m.ready) > 0) keep(m.ready);
      else book.parts.get(m.ready).forEach(keep);
    }
  }

  // « Garde » sur ce qui reste au sac, avec ce qui empêche le Pokémon qui l'attend de le recevoir. Avec des places libres et sans
  // composant seul, il ne reste que le composant dont la stat ne le sert pas (idlePart) : il se pose avec l'autre composant de
  // la recette.
  function keepMarks(s) {
    const { names } = s;
    const obstacle = (h, id) => {
      if (h.emptied) return 'après l’Aimant';
      if (h.slots === 0) return 'sans place libre';
      if (h.lone) return keptLone(s, h) ? `une fois ${names.item(h.lone)} fusionné` : `bloqué par ${names.item(h.lone)} seul`;
      const f = recipesWith(s, h, id)[0];
      return `avec ${names.item(otherPart(s.book, f, id))} : ${names.item(f)}`;
    };
    for (const { id, i } of [...pendingIn(s, 'full'), ...pendingIn(s, 'part')]) {
      // Le motif cite d'abord le Pokémon qui peut encore le recevoir, avec l'autre composant de la recette.
      const all = takers(s, id);
      const stuck = all.find(h => h.slots > 0 && !h.lone) ?? all[0];
      const later = s.future.find(x => x.ideal.includes(id));
      const worn = s.hs.find(h => h.ideal.includes(id) && h.on.includes(id));
      let why = 'aucun Pokémon de la compo possédé';
      if (stuck) why = `pour ${stuck.who}, ${obstacle(stuck, id)}`;
      else if (later) why = `pour ${later.who}, à venir`;
      else if (worn) why = `déjà sur ${worn.who}`;
      else if (s.hs.length) why = 'hors des meilleurs objets de la compo';
      s.marks[i] = mark('opt', 'Garde', `Garde ${names.item(id)}`, why);
    }
  }

  // Un Pokémon de la compo ne reçoit que ses objets idéaux (idealItems) : l'objet complet, ou un composant de l'un d'eux, va
  // tout de suite sur lui. Un composant posé seul donne déjà son effet et fusionne avec le prochain composant posé sur ce
  // Pokémon ; celui dont la stat ne le sert pas (idlePart : Protéine sur un spécial) attend au sac l'autre composant de la
  // recette. Ce qui n'entre dans aucun objet idéal reste au sac. Chaque objet du sac est conseillé une fois ;
  // l'état de chaque porteur (objets, places, composant seul) suit les conseils, et une seule paire par Pokémon et par passage
  // (l'ordre de pose ne serait plus clair). future : lignées à venir (futureLines), pour qui un composant reste au sac.
  // Renvoie aussi cet état final, pour le choix de la récompense.
  function itemMarks(data, game, holders, book, target, future, names) {
    if (!target) return { marks: game.bag.map(() => null), holders: [], reserved: new Set() };
    const s = itemState(data, game, holders, book, future, names);
    magnetMarks(s, target);
    // Objets complets : au Pokémon qui le classe le plus haut dans ses objets idéaux.
    for (const { id, i } of pendingIn(s, 'full')) {
      const h = s.hs.filter(x => x.slots > 0 && idealTo(x, id)).sort((a, b) => a.ideal.indexOf(id) - b.ideal.indexOf(id))[0];
      if (!h) continue;
      putMark(s, i, h, `${names.item(id)} → ${h.who}`, s.best);
      h.slots -= 1;
      h.on.push(id);
    }
    // Jusqu'à ce qu'un tour ne pose plus rien : une fusion libère le composant seul d'un Pokémon qu'un composant vu plus tôt
    // dans le sac attendait.
    let left;
    do {
      left = pendingIn(s, 'part').length;
      for (const { id, i } of pendingIn(s, 'part')) if (s.marks[i] === null) placePart(s, id, i);
    } while (pendingIn(s, 'part').length < left);
    keepMarks(s);
    return { marks: s.marks, holders: s.hs, reserved: s.reserved };
  }

  // Objets visés par Pokémon de la compo : ses objets idéaux, 3 au plus. Lu sur l'état
  // final des porteurs (itemMarks) : porté (worn), prêt (ready) ou composants manquants (missing). Prêt : posé ou fusionné par
  // les conseils de ce passage, gardé pour lui après l'Aimant, ou réunissable avec ses composants seuls et le sac libre (ni posé
  // ni réservé), partagé dans l'ordre des porteurs.
  function aimsOf(data, game, items, book) {
    const pool = freeBag(game.bag, items.marks, items.reserved);
    const take = (list, id) => {
      const k = list.indexOf(id);
      if (k >= 0) list.splice(k, 1);
      return k >= 0;
    };
    return items.holders.map(h => {
      const on = h.unit.items ?? [];
      const own = [...h.held, ...h.on.filter(id => itemKind(data, id) === 'part')];
      const aims = h.ideal.map(id => {
        if (on.includes(id)) return { id, state: 'worn', missing: [] };
        if (h.on.includes(id) || take(own, id) || take(pool, id)) return { id, state: 'ready', missing: [] };
        // Composants pris seulement si l'objet est réunissable : un objet incomplet ne prive pas le Pokémon suivant.
        const [o, p] = [[...own], [...pool]];
        const missing = (book.parts.get(id) ?? []).filter(x => !take(o, x) && !take(p, x));
        if (missing.length) return { id, state: 'missing', missing };
        own.splice(0, own.length, ...o);
        pool.splice(0, pool.length, ...p);
        return { id, state: 'ready', missing };
      });
      return { unit: h.unit, aims };
    });
  }

  // Récompense : d'après l'état des porteurs après les conseils du sac (composants seuls et places restantes), puis les
  // recettes idéales des lignées à venir.
  function offerMarks(book, game, hs, future, names) {
    if (!game.reward.length) return [];
    const BEST = bestWhy(game.mode);
    const value = id => [...hs.flatMap(h => h.ideal.filter(f => !h.on.includes(f)).map(f => {
      const ab = book.parts.get(f) ?? [];
      if (f === id) return h.slots > 0 && { s: 3, why: `${BEST} pour ${h.who}` };
      if (!ab.includes(id)) return null;
      const other = otherPart(book, f, id);
      if (h.lone === other) return { s: 2, why: `complète ${names.item(f)} sur ${h.who}` };
      if (h.slots === 0 || h.lone) return null;
      // Un composant dont la stat ne sert pas le Pokémon attendra l'autre au sac (idlePart) : il passe après celui qui se pose.
      return idlePart(h.profile, id) ? { s: 0.75, why: `${names.item(f)} pour ${h.who}, avec ${names.item(other)}` }
        : { s: 1, why: `entame ${names.item(f)} pour ${h.who}` };
    })), ...future.flatMap(x => x.ideal.filter(f => f === id || book.parts.get(f)?.includes(id))
      .map(f => ({ s: 0.5, why: `${names.item(f)} pour ${x.who}, à venir` })))]
      .filter(Boolean).sort((a, b) => b.s - a.s)[0] ?? { s: 0 };
    const values = game.reward.map(value);
    const best = Math.max(...values.map(v => v.s));
    const first = values.findIndex(v => v.s === best);
    return game.reward.map((id, i) => (best > 0 && i === first ? mark('do', 'Prends', `Prends ${names.item(id)}`, values[i].why) : null));
  }

  function boonScore(id, game) {
    const path = boonPath(id);
    const tie = Object.keys(BOONS).indexOf(id) / 100;
    if (game.hp < game.mode.lowHp && HEAL_BOONS.includes(id)) return 100 - tie;
    if (path === 'fortune' && pathCount(game.boons, 'fortune') < PATH_SIZE) return 90 - tie;
    if (path && pathCount(game.boons, path) < PATH_SIZE) return 50 + 10 * pathCount(game.boons, path) - PATH_ORDER.indexOf(path) - tie;
    return 10 - tie;
  }

  function sealScore(seal, game, eco) {
    // Même échelle que boonScore (Fortune 90, voie 50–70, autre 10) : une offre peut mêler sceaux et bénédictions.
    if (seal.cat === 'risk') return eco.lowHp ? -1 : 0;
    if (['eco', 'shop', 'xp'].includes(seal.cat)) return game.floor < 81 && !eco.lowHp && !eco.allIn ? 60 : 20;
    if (['combat', 'board', 'role'].includes(seal.cat)) return eco.allIn || game.floor >= 81 ? 60 : 40;
    return 20;
  }

  function offerChoiceMarks(data, game, eco, names) {
    const unknown = [];
    const scored = game.offer.map(id => {
      if (Object.hasOwn(BOONS, id)) return { id, s: boonScore(id, game) };
      const seal = data?.seals[id];
      if (seal) return { id, s: sealScore(seal, game, eco), seal: true };
      // Sans data.json, un sceau n'est pas « inconnu » : seules ses données manquent.
      if (data) unknown.push(id);
      return null;
    });
    const best = Math.max(...scored.filter(Boolean).map(x => x.s));
    const marks = scored.map(x => {
      if (!x) return null;
      if (best > 0 && x.s === best && scored.find(y => y?.s === best) === x) {
        const path = boonPath(x.id);
        const open = path !== null && pathCount(game.boons, path) < PATH_SIZE;
        const why = x.seal ? 'sceau le plus utile pour ta situation'
          : game.hp < game.mode.lowHp && HEAL_BOONS.includes(x.id) ? `PV bas (${game.hp})`
            : open ? `voie ${PATH_NAMES[path]} : ${pathCount(game.boons, path) + 1} sur ${PATH_SIZE}` : 'meilleur effet immédiat';
        const detail = !x.seal && open ? `À ${PATH_SIZE} : ${PATH_BONUS[path]}.` : '';
        return mark('do', 'Prends', `Prends ${x.seal ? names.seal(x.id) : BOONS[x.id][1]}`, why, detail);
      }
      return x.s < 0 ? mark('no', 'Évite', `Évite ${names.seal(x.id)}`, `risqué avec ${game.hp} PV`) : null;
    });
    return { marks, unknown };
  }

  // Cartes du centre Pokémon selon center (zh de route-*.js) : soins à 6 pièces, grisés en dessous ; entraînement +8 XP pour
  // 8 PV. Les PV rendus changent selon le mode (Lh) ; la règle n'en dépend pas.
  const TRAIN = { name: 'Entraînement', xp: 8, hpCost: 8 };
  const CENTER = {
    care: [{ name: 'Repos' }, { name: 'Soins', goldCost: 6 }],
    top: [{ name: 'Repos' }, TRAIN],
    full: [TRAIN, { name: 'Pourboire' }],
  };
  const elide = name => (/^[aeiouyâéèêîô]/i.test(name) ? `qu’${name}` : `que ${name}`);

  // Pokémon offert : la lignée du trio de la compo cible qui a le moins de copies, puis celle du trio de la compo suivante,
  // puis la plus forte sur les combats de la compo cible (lineStrength) ; à égalité, celle qui donne de l'XP.
  function monChoice(game, options, target, next, names) {
    const core = comp => (comp ? comp.core.map(baseLine) : []);
    const name = o => names.line(o.mon);
    const copies = o => unitsOf(game, o.mon).length;
    const other = o => options.find(x => x !== o);
    const tests = [
      [o => Number(core(target).includes(o.mon)), o => `${name(o)}, du trio de la compo cible`],
      [o => (core(target).includes(o.mon) ? -copies(o) : 0), o => `${name(o)}, du trio de la compo cible : ${copies(o)} copie${copies(o) > 1 ? 's' : ''}`],
      [o => Number(core(next).includes(o.mon)), o => `${name(o)}, du trio de la compo suivante`],
      [o => target?.strength.get(o.mon) ?? 0, o => `${name(o)}, plus fort ${elide(name(other(o)))} (${floorRange(target.stops, game.mode)})`],
      [o => o.xp ?? 0, o => `même force, +${o.xp} XP`],
    ];
    for (const [score, why] of tests) {
      const [a, b] = options.map(score);
      if (a !== b) {
        const o = options[a > b ? 0 : 1];
        return { o, why: why(o) };
      }
    }
    return null;
  }

  // XP contre PV : l'XP tant que les PV restent au moins à lowHp après son coût et que le niveau est sous le plafond.
  function xpChoice(game, xp, rest) {
    const { lowHp } = game.mode;
    const cap = maxLevel(game.floor, game.mode);
    const after = game.hp - xp.hpCost;
    if (game.level >= cap) return { o: rest, why: `niveau ${cap} atteint : l’XP ne sert plus` };
    if (game.hp <= xp.hpCost) return { o: rest, why: `${xp.name} : il faut plus de ${xp.hpCost} PV, tu en as ${game.hp}` };
    if (after < lowHp) return { o: rest, why: `${xp.name} : PV ${game.hp} → ${after}, sous le seuil de ${lowHp}` };
    return { o: xp, why: `+${xp.xp} XP ; PV ${game.hp} → ${after}, seuil ${lowHp}` };
  }

  // Événements à choix de l'aventure (events) et centres Pokémon : une carte conseillée, jamais une carte que le jeu grise
  // (pièces sous goldCost, PV au plus hpCost). Seulement dans une aventure qui décrit ses événements : les cartes du centre
  // y sont relevées, pas ailleurs.
  function eventMarks(game, target, next, names) {
    const { event, mode } = game;
    if (!event || !mode.adv?.events) return [];
    const options = event.kind === 'choice' ? mode.adv.events[game.floor] : event.kind === 'center' ? CENTER[event.center] : null;
    if (!options) return [];
    const off = o => (o.goldCost ?? 0) > game.gold || (o.hpCost !== undefined && game.hp <= o.hpCost);
    const xp = options.find(o => o.xp && !o.mon);
    let pick;
    if (options.some(o => o.mon)) pick = monChoice(game, options, target, next, names);
    else if (xp) pick = xpChoice(game, xp, options.find(o => o !== xp));
    else {
      const paid = options.find(o => o.goldCost);
      const free = options.find(o => o !== paid);
      pick = game.hp < mode.lowHp ? { o: paid, why: `PV ${game.hp}, sous le seuil de ${mode.lowHp}` }
        : { o: free, why: `PV ${game.hp}, pas sous le seuil de ${mode.lowHp} : garde tes pièces` };
    }
    // Seule une carte payante peut être retenue puis grisée : une carte à PV ne l'est qu'au-dessus de lowHp.
    if (pick && off(pick.o)) {
      const shut = pick.o;
      const open = options.find(o => !off(o));
      pick = open && { o: open, why: `${shut.name} : ${shut.goldCost} pièces, tu en as ${game.gold}` };
    }
    return options.map(o => (pick?.o === o ? mark('do', 'Prends', `Prends ${o.name}`, pick.why, o.detail ?? '') : null));
  }

  function anchorAdvice(target, game, names) {
    if (!target) return [];
    return target.core.flatMap(id => {
      const n = anchorStage(id);
      const base = baseLine(id);
      // L'ancrage prend effet à la prochaine fusion : conseillé quand elle est imminente (2 copies au même ★).
      const own = unitsOf(game, base);
      const imminent = own.some(u => own.filter(v => v.star === u.star).length >= 2);
      if (n === null || game.anchor[base] === n || !imminent) return [];
      return [mark('do', '', `Ancre ${names.stage(base, n)} (fiche du Pokémon)`, 'forme gagnante de la compo, avant sa prochaine fusion')];
    });
  }

  // La sauvegarde indexe le plateau sur 8 rangées × 7 : les 4 rangées ennemies (cases 0-27), puis les tiennes de l'avant au fond
  // (28-55). La cellule KT1 (0-27, rangée × 7 + colonne, rangée 0 = avant, doc de l'API) est donc la case de la sauvegarde − 28.
  const COLS = 7;
  const ENEMY_CELLS = 4 * COLS;
  // Colonnes de l'avant, depuis le centre.
  const CENTER_OUT = [3, 2, 4, 1, 5, 0, 6];
  const boardCell = cell => (Number.isInteger(cell) && cell >= ENEMY_CELLS && cell < 2 * ENEMY_CELLS ? cell - ENEMY_CELLS : null);
  const rowOf = cell => Math.floor(cell / COLS);
  const colOf = cell => cell % COLS;
  const cellAt = (row, col) => row * COLS + col;
  // Plateau en hexagones, rangées impaires décalées vers la droite (route-*.js) ; la rangée 0 de la cellule KT1 est la 5ᵉ du
  // plateau, de même parité. Deux cases sont collées à une distance de 1.
  const cube = cell => {
    const r = rowOf(cell);
    const x = colOf(cell) - (r - (r & 1)) / 2;
    return [x, r, -x - r];
  };
  const touching = (a, b) => {
    const q = cube(b);
    return Math.max(...cube(a).map((v, i) => Math.abs(v - q[i]))) === 1;
  };

  // Capacités qui dépendent des voisins, relevées dans le code du jeu (roster-*.js, route-*.js). Mew (Métronome, move.kind de
  // data.json) copie la capacité de l'allié collé de plus grande valeur, coût × 3^(étoile − 1), à l'étoile de Mew, sauf ces genres
  // de capacités ; à égalité, celui de plus petite case. Le choix est fait à l'installation du combat, avant que les assassins
  // ne quittent leur case. Ramoloss (Mur Lumière) protège aussi chaque allié collé : le centre de l'avant lui revient. Le Séisme
  // de Grolem (Racaillou ★★★ ; Éboulement, à ★★, ne touche pas les alliés) inflige 25 % de ses dégâts aux alliés collés, et les
  // assassins quittent leur case dès le début du combat (bond, tunnel, vol, ruée) : ils partent des bords du plateau, colonnes
  // 0, 1, 5 et 6 (1, 2, 6 et 7 dans le panneau). La colonne 0 d'abord : à l'avant, elle touche deux cases alliées, la colonne 6
  // trois (rangées impaires décalées vers la droite).
  const UNCOPIED = new Set(['metronome', 'transform', 'splash', 'teleport']);
  const ALLY_SHIELD = new Set(['slowpoke']);
  const ALLY_QUAKE = { geodude: 3 };
  const OPENERS = new Set(['aerodactyl', 'diglett', 'doduo', 'ekans', 'pidgey', 'scyther', 'zubat']);
  const moveKind = (data, base, star) => lineInfo(data, base)?.stars?.[star - 1]?.move?.kind;
  const EDGE_OUT = [0, 6, 1, 5, 2, 4, 3];
  const EDGE_COLS = [0, 1, 5, 6];

  // Zones du porteur à distance : ses colonnes préférées sur sa rangée, et ordre de remplissage des rangées derrière l'avant (une
  // colonne sur deux d'abord, pour espacer les unités face aux attaques de zone).
  const CARRY_ZONES = {
    left: { name: 'coin gauche', cols: [0, 1, 2], order: [0, 2, 4, 6, 1, 5, 3] },
    center: { name: 'centre', cols: [2, 3, 4], order: [3, 1, 5, 0, 6, 2, 4] },
    right: { name: 'coin droit', cols: [4, 5, 6], order: [6, 4, 2, 0, 5, 1, 3] },
  };

  const TABS = [['tour', 'Tour'], ['compo', 'Compo'], ['boss', 'Boss'], ['rules', 'Règles']];
  const capital = s => s[0].toUpperCase() + s.slice(1);
  // Options du menu ⚙, dans l'ordre affiché : clé de l'objet ui, valeurs [valeur, libellé], valeur par défaut. checks : cases à
  // cocher, ui[key] associe chaque valeur à un booléen (pastilles : un niveau de conseil, précédé de son symbole). STRATEGY,
  // en dernier, s'affiche sous son titre et ajoute à chaque valeur ses paramètres.
  const OPTIONS = [
    { key: 'theme', label: 'Thème', values: [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']], def: 'auto' },
    { key: 'pins', label: 'Pastilles sur le jeu', type: 'checks', values: [['do', 'Faire'], ['opt', 'Si l’or'], ['no', 'Éviter']], def: { do: true, opt: true, no: true } },
    { key: 'width', label: 'Largeur', values: [['compact', 'Compacte'], ['wide', 'Large']], def: 'compact' },
    { key: 'text', label: 'Texte', values: [['small', 'Petit'], ['normal', 'Normal'], ['large', 'Grand']], def: 'normal' },
    { key: 'alpha', label: 'Fond', values: [['100', 'Opaque'], ['90', '90 %'], ['85', '85 %']], def: '90' },
    { key: 'side', label: 'Porteur à distance (formation)', values: Object.entries(CARRY_ZONES).map(([k, z]) => [k, capital(z.name)]), def: 'left' },
    ...STRATEGY,
  ];
  // Valeurs inconnues du stockage (modifié à la main, version antérieure) ramenées aux valeurs par défaut : une zone de porteur
  // inconnue ferait échouer la formation à chaque lecture de la sauvegarde.
  function checkUi(ui) {
    for (const o of OPTIONS) {
      if (o.type === 'checks') ui[o.key] = Object.fromEntries(Object.entries(o.def).map(([v, d]) => [v, typeof ui[o.key]?.[v] === 'boolean' ? ui[o.key][v] : d]));
      else if (!o.values.some(([v]) => v === ui[o.key])) ui[o.key] = o.def;
    }
    if (!TABS.some(([t]) => t === ui.tab)) ui.tab = 'tour';
    // Compléments du conseil précédent : un tableau de lignées, sinon l'inertie lirait des sous-chaînes ou lèverait une erreur.
    if (isObject(ui.target) && !(Array.isArray(ui.target.fillers) && ui.target.fillers.every(f => typeof f === 'string'))) ui.target.fillers = [];
  }

  // Plateau en cours de pose : cases prises, colonnes occupées derrière l'avant (sur deux rangées voisines, deux cases de la
  // même colonne se touchent). place : première liste de zonesOf(u) qui a une case libre ; pour une unité à distance, la
  // première case de cette liste hors d'une colonne occupée et qui convient (apart), sinon hors d'une colonne occupée.
  function newBoard(zonesOf, apart = () => true) {
    const taken = new Set();
    const backCols = new Set();
    const put = (u, cell) => {
      u.cell = cell;
      taken.add(cell);
      if (rowOf(cell) > 0) backCols.add(colOf(cell));
    };
    const spaced = c => rowOf(c) === 0 || !backCols.has(colOf(c));
    const place = u => {
      const free = zonesOf(u).map(cells => cells.filter(c => !taken.has(c))).find(cells => cells.length);
      put(u, (u.row > 0 ? free.find(c => spaced(c) && apart(c)) ?? free.find(spaced) : undefined) ?? free[0]);
    };
    return { taken, put, spaced, place, zonesOf };
  }

  // Valeur d'une unité de la formation : son coût × 3^(étoile − 1), le prix des copies qu'elle a fusionnées.
  const unitValue = (data, u) => lineInfo(data, u.base).c * 3 ** (u.star - 1);

  // Grolem avant les assassins : ceux-ci quittent leur case, le bord compte moins pour eux.
  const frontRank = u => {
    if (ALLY_SHIELD.has(u.base)) return 0;
    if (OPENERS.has(u.base)) return 4;
    if (u.star >= ALLY_QUAKE[u.base]) return 3;
    return u.role === 'tank' ? 1 : 2;
  };

  // Pose des unités sur un plateau vide : un Pokémon déjà sur une case de sa première liste la garde ; les autres se posent
  // dans l'ordre first, l'avant (frontRank), puis derrière, le porteur d'abord. apart : voir newBoard.
  function arrange(units, zonesOf, first = [], apart = undefined) {
    const board = newBoard(zonesOf, apart);
    const stay = units.filter(u => zonesOf(u)[0].includes(u.from));
    for (const u of stay) board.put(u, u.from);
    const rest = units.filter(u => !first.includes(u));
    const carryFirst = (a, b) => Number(b.role === 'carry') - Number(a.role === 'carry');
    const order = [...first, ...rest.filter(u => u.row === 0).sort((a, b) => frontRank(a) - frontRank(b)), ...rest.filter(u => u.row > 0).sort(carryFirst)];
    for (const u of order) if (!stay.includes(u)) board.place(u);
    return board;
  }

  // Formation KT1 : la compo cible dans la limite du niveau (cœur possédé d'abord pour la coupe). La rangée d'un Pokémon est sa
  // portée, 1 à l'avant, 4 et plus au fond : les deux camps se touchent sur un plateau en hexagones, il atteint de là la première
  // rangée ennemie. Un tank possédé (le rôle vient de holdersOf) reste à l'avant quelle que soit sa portée. Colonnes : depuis le
  // centre à l'avant, Ramoloss d'abord, puis les tanks et les autres, enfin les assassins et Grolem ★★★ depuis les bords ;
  // derrière, dans l'ordre de la zone choisie (coin gauche, centre ou coin droit), le porteur d'abord dans les colonnes de cette
  // zone, en évitant la colonne de tout Pokémon déjà posé derrière l'avant. Déjà sur une case de sa première
  // liste, un Pokémon la garde ; rangée pleine, il passe derrière, puis devant. Mew se place en dernier (placeMimic). dive :
  // parade aux assassins adverses, qui prime sur la zone du porteur : guard choisit sur une première pose la case du porteur
  // et celle de l'appât, puis la pose reprend avec ces deux cases en tête de leurs listes ; les autres se placent autour, et
  // un assassin débordé derrière l'avant y revient quand l'appât libère sa case. Mew n'entre pas dans la parade : sa case suit
  // celle de son modèle, et porteur, il n'est pas couvert. unit : l'unité possédée (porteur de holdersOf), from : sa cellule,
  // 'bench', ou null s'il n'est pas possédé ; bait, guarded : l'appât et le porteur qu'il couvre.
  function formation(target, game, data, holders, side, dive = false) {
    const stars = id => bestStar(game, baseLine(id));
    const kept = new Set([...[...target.core].sort((a, b) => stars(b) - stars(a)), ...target.fillers].slice(0, game.level));
    const units = [...target.core, ...target.fillers].filter(id => kept.has(id)).map(id => {
      const base = baseLine(id);
      const h = holders.find(x => baseLine(x.unit.line) === base);
      const role = h?.role ?? null;
      return {
        line: id, base, star: Math.max(1, stars(id)), shiny: shinyLine(game, base), items: h ? h.ideal : [], role,
        row: role === 'tank' ? 0 : Math.min(rangeOf(data, base), 4) - 1,
        unit: h?.unit ?? null, from: h ? boardCell(h.unit.cell) ?? 'bench' : null,
      };
    });
    const zone = CARRY_ZONES[side];
    const rows = [0, 1, 2, 3];
    const center = cellAt(0, 3);
    // Le centre n'est réservé qu'à un Ramoloss possédé : un Pokémon posé ne bouge pas pour un Ramoloss encore à acheter.
    const shield = units.some(u => u.row === 0 && ALLY_SHIELD.has(u.base) && u.from !== null);
    const edge = u => u.row === 0 && (OPENERS.has(u.base) || u.star >= ALLY_QUAKE[u.base]);
    // Première liste (case gardée) : à l'avant, le centre seul pour Ramoloss, et le reste de la rangée pour les autres quand il
    // est là ; les colonnes du bord pour les assassins et Grolem ★★★.
    const zones = u => {
      const onEdge = edge(u);
      const cols = u.row > 0 ? zone.order : onEdge ? EDGE_OUT : CENTER_OUT;
      const cells = [...rows.slice(u.row), ...rows.slice(0, u.row).reverse()].map(r => cols.map(c => cellAt(r, c)));
      if (u.row > 0) return u.role === 'carry' ? [cells[0].filter(c => zone.cols.includes(colOf(c))), ...cells] : cells;
      if (ALLY_SHIELD.has(u.base)) return [[center], ...cells];
      if (onEdge) return [cells[0].filter(c => EDGE_COLS.includes(colOf(c))), ...cells];
      return shield ? [cells[0].filter(c => c !== center), ...cells] : cells;
    };
    const mimic = units.find(u => moveKind(data, u.base, u.star) === 'metronome');
    const others = units.filter(u => u !== mimic);
    let board = arrange(others, zones);
    const parade = dive ? guard(others, board.taken, zone, data) : null;
    if (parade) {
      const pinned = new Map([[parade.carry, parade.spot], [parade.bait, parade.cell]]);
      // Comme guard pour sa case : plus au fond que le porteur, une unité à distance ne le touche pas si elle peut (l'assassin arrivé
      // sur elle se retournerait vers lui).
      const apart = c => rowOf(c) <= rowOf(parade.spot) || !touching(c, parade.spot);
      board = arrange(others, u => (pinned.has(u) ? [[pinned.get(u)], ...zones(u)] : zones(u)), [...pinned.keys()], apart);
      parade.carry.guarded = true;
      parade.bait.bait = true;
    }
    if (mimic) placeMimic(mimic, others, board, data);
    // Doc de l'API : unités triées par cellule.
    return units.sort((a, b) => a.cell - b.cell);
  }

  // Mew, posé après les autres unités (units) sur board : une case collée à l'allié qu'il copiera (copies : sa lignée), dans
  // ses listes de board.zonesOf (sa rangée, puis derrière, puis devant) ; sans allié à copier ni case libre collée, il se place
  // comme les autres. Modèles par valeur décroissante (unitValue), capacité connue (les lignées v41 hors de data.json n'en ont
  // pas) et copiable : le premier qui a une case libre collée. Les modèles mieux classés n'en ont aucune : Mew ne les touchera pas.
  function placeMimic(mimic, units, board, data) {
    const cells = board.zonesOf(mimic);
    const kind = u => moveKind(data, u.base, mimic.star);
    const near = model => cells.map(list => list.filter(c => !board.taken.has(c) && touching(c, model.cell))).find(list => list.length);
    const model = units.filter(u => kind(u) && !UNCOPIED.has(kind(u)))
      .sort((a, b) => unitValue(data, b) - unitValue(data, a) || a.cell - b.cell).find(near);
    const keep = list => list.includes(mimic.from) && !board.taken.has(mimic.from) && board.spaced(mimic.from);
    if (model) {
      const list = near(model);
      board.put(mimic, keep(list) ? mimic.from : list.find(board.spaced) ?? list[0]);
      mimic.copies = model.base;
    } else if (keep(cells[0])) board.put(mimic, mimic.from);
    else board.place(mimic);
  }

  // Parade aux assassins adverses, relevée dans le moteur (route-*.js) : Insécateur (leap), Doduo (rush) et Abo (stealth)
  // visent le Pokémon le plus au fond (backmost : rangée, puis PV restants les plus bas ; Abo, dans la moitié du plateau par
  // où il entre, la colonne 4 comptant dans les deux) ; Nosferapti (flyover) vise le plus au fond de la colonne la plus proche
  // de la sienne. Un appât strictement plus au fond que le porteur à distance, dans chaque moitié où se trouve le porteur,
  // prend donc l'assaut : au fond, colonne 4 d'abord puis du côté du porteur, si possible sans le toucher (l'assassin se
  // retournerait vers lui). Le porteur du fond avance d'une rangée, dans sa zone d'abord, hors de la colonne 4 s'il le peut.
  // Appât, parmi les Pokémon possédés : un Pokémon déjà plus au fond que le porteur, dans la formation ou sur le plateau (du
  // bon côté, il ne bouge pas ; de l'autre, il y vient), sinon le tank de moindre valeur (unitValue) quand il en reste un
  // devant, sinon l'unité de mêlée de plus grande valeur quand il en reste une devant, sinon l'unité à distance de plus grande
  // valeur. Ni Ramoloss (son mur couvre l'avant) ni un assassin (il quitte sa case). units : posées sans parade, sans Mew ;
  // taken : leurs cases ; zone : CARRY_ZONES du côté du porteur ; data : lu par unitValue. Renvoie { carry, spot, bait, cell } :
  // le porteur, l'appât et leurs cases, que formation pose avant les autres ; null sans porteur à distance, sans appât ou
  // sans case pour l'un des deux.
  function guard(units, taken, zone, data) {
    const carry = units.find(u => u.role === 'carry' && u.row > 0);
    if (!carry) return null;
    const free = (row, cols) => cols.map(c => cellAt(row, c)).filter(c => !taken.has(c) || c === carry.cell);
    // Case du plateau qu'un Pokémon garde : la parade déjà posée ne donne aucun déplacement.
    const held = (u, ok) => typeof u.from === 'number' && (u.from === u.cell || !taken.has(u.from) || u.from === carry.cell) && ok(u.from);
    let spot = carry.cell;
    if (held(carry, c => rowOf(c) === 1 || rowOf(c) === 2)) spot = carry.from;
    else if (rowOf(spot) === 3) {
      const lone = c => !units.some(u => u !== carry && rowOf(u.cell) > 0 && colOf(u.cell) === colOf(c));
      const apart = c => !units.some(u => u !== carry && rowOf(u.cell) === 3 && touching(c, u.cell));
      // Hors de la colonne 4 (l'appât, qui devrait s'y tenir, le toucherait) et sans toucher une unité du fond, d'abord.
      const best = cells => cells.find(c => lone(c) && apart(c) && colOf(c) !== 3) ?? cells.find(c => lone(c) && apart(c)) ?? cells.find(lone) ?? cells[0];
      spot = best(free(2, zone.order.filter(c => zone.cols.includes(c)))) ?? best(free(2, zone.order));
      if (spot === undefined) return null;
    }
    const side = Math.sign(colOf(spot) - 3);
    const covers = c => colOf(c) === 3 || (side !== 0 && Math.sign(colOf(c) - 3) === side);
    const owned = units.filter(u => u !== carry && u.from !== null && !OPENERS.has(u.base));
    const pool = owned.filter(u => !ALLY_SHIELD.has(u.base)).sort((x, y) => unitValue(data, y) - unitValue(data, x));
    const deeper = pool.filter(u => rowOf(u.cell) > rowOf(spot));
    const kept = pool.find(u => u.cell !== u.from && held(u, c => rowOf(c) > rowOf(spot) && covers(c)));
    // set : appât déjà du bon côté, qui garde sa case.
    const set = deeper.find(u => covers(u.cell)) ?? kept;
    const front = pool.filter(u => rowOf(u.cell) === 0);
    // Ramoloss compte parmi ceux qui restent devant.
    const stays = owned.filter(u => rowOf(u.cell) === 0);
    const spareTank = stays.filter(u => u.role === 'tank').length > 1 ? front.filter(u => u.role === 'tank').at(-1) : null;
    const melee = stays.length > 1 ? front.find(u => u.role !== 'tank') : null;
    const ranged = pool.find(u => rowOf(u.cell) > 0);
    const bait = set ?? deeper[0] ?? spareTank ?? melee ?? ranged;
    if (!bait) return null;
    if (set) return { carry, spot, bait, cell: bait === kept ? kept.from : bait.cell };
    const cells = free(3, CENTER_OUT).filter(covers);
    const cell = cells.find(c => !touching(c, spot)) ?? cells[0];
    return cell === undefined ? null : { carry, spot, bait, cell };
  }

  const ROW_NAMES = ['avant', '2ᵉ rangée', '3ᵉ rangée', 'fond'];
  const spot = cell => `${ROW_NAMES[rowOf(cell)]}, colonne ${colOf(cell) + 1}`;

  // Déplacements vers la formation (conseils du panneau seul), dans l'ordre où les faire, rejoués sur une table case → occupant :
  // le jeu échange deux Pokémon quand on en pose un sur l'autre, si bien qu'un Pokémon arrivé par échange n'a plus de consigne.
  // D'abord les Pokémon posés mal placés (celui dont la case cible est libre avant les autres), puis les poses depuis le banc :
  // sur la case d'un Pokémon hors formation, elle le remplace ; faute de place libre, elle fait ranger au banc un Pokémon hors
  // formation qui n'est la cible d'aucune pose.
  function moveAdvice(units, game, names) {
    const onBoard = game.units.filter(u => boardCell(u.cell) !== null);
    const at = new Map(onBoard.map(u => [boardCell(u.cell), u]));
    const cellOf = unit => [...at].find(([, v]) => v === unit)?.[0];
    const mine = new Set(units.map(f => f.unit).filter(Boolean));
    const note = u => (u.copies ? `, collé à ${names.line(u.copies)} dont il copie la capacité` : '')
      + (u.bait ? ', appât des assassins adverses' : '') + (u.guarded ? ', moins au fond que l’appât' : '');
    const marks = [];
    const pending = () => units.filter(f => typeof f.from === 'number' && cellOf(f.unit) !== f.cell);
    for (let left = pending(); left.length; left = pending()) {
      const u = left.find(f => !left.some(g => g !== f && cellOf(g.unit) === f.cell)) ?? left[0];
      const from = cellOf(u.unit);
      const other = at.get(u.cell);
      const swap = other && mine.has(other) ? ` (échange avec ${names.line(other.line)})` : '';
      marks.push(mark('do', '', `Déplace ${names.line(u.base)}`, `${spot(from)} → ${spot(u.cell)}${swap}${note(u)}`));
      at.set(u.cell, u.unit);
      if (other) at.set(from, other);
      else at.delete(from);
    }
    let room = game.level - onBoard.length;
    const poses = units.filter(f => f.from === 'bench').sort((a, b) => Number(at.has(b.cell)) - Number(at.has(a.cell)));
    const targets = new Set(poses.map(f => f.cell));
    for (const u of poses) {
      const there = at.get(u.cell);
      let why = '';
      if (there) why = `, à la place de ${names.line(there.line)}`;
      else if (room > 0) room -= 1;
      else {
        const spare = [...at].filter(([, v]) => !mine.has(v));
        const [cell, out] = spare.find(([c]) => !targets.has(c)) ?? spare[0];
        why = ` ; range ${names.line(out.line)} au banc`;
        at.delete(cell);
      }
      at.set(u.cell, u.unit);
      marks.push(mark('do', '', `Pose ${names.line(u.base)}`, `${spot(u.cell)}${note(u)}${why}`));
    }
    return marks;
  }
  function kt1Code(units, rules, mode) {
    const parts = units.map(u => `${u.line}:${u.star}${u.shiny ? 's' : ''}:${u.cell}${u.items.length ? `:${u.items.join('.')}` : ''}`);
    return ['KT1', `r${rules}`, `xm=${mode.xm}`, `xn=${encodeURIComponent(PLAN_NAME)}`, ...parts].join(';');
  }

  // stats : le mode de campana.json de la partie (torre ou camp) ; mode : modeContext de la partie. previous : { key, run, next,
  // fillers } du dernier conseil (trio et compléments de la compo cible, trio de la compo suivante) ; l'inertie ne vaut que
  // dans la même partie (runSeed).
  // dive : le joueur a signalé des assassins adverses pour ce combat (formation, guard).
  function advise({ stats, data, lang, save, previous, side, mode, dive = false }) {
    const names = namer(lang);
    const game = readGame(save, mode);
    const run = save.runSeed ?? null;
    const stops = stats ? nextStops(stats.stops, game.floor, 3, mode) : [];
    const eco = economy(game, stops);
    const same = previous?.run === run ? previous : null;
    const target = stats && data ? targetComp(stats, data, game, same) : null;
    const next = target ? nextComp(stats, data, game, target, same) : null;
    const spent = spend(game, target, next, data, eco, names);
    const choice = offerChoiceMarks(data, game, eco, names);
    const profiles = target ? lineProfiles(stats, data) : null;
    const holders = target ? holdersOf(stats, data, game, target, profiles) : [];
    const book = target ? recipeBook(data) : null;
    const future = target ? futureLines(stats, data, target, next, holders, profiles, names) : [];
    const items = itemMarks(data, game, holders, book, target, future, names);
    const units = target ? formation(target, game, data, holders, side, dive) : [];
    const guarded = units.find(u => u.guarded);
    return {
      game, eco, target, next, names, run,
      shop: spent.shop,
      reroll: spent.reroll,
      xp: spent.xp,
      bench: sellMarks(game, target, next, names, spent.short),
      bag: items.marks,
      reward: offerMarks(book, game, items.holders, future, names),
      aims: target ? aimsOf(data, game, items, book) : [],
      offer: choice.marks,
      event: eventMarks(game, target, next, names),
      unknownOffer: choice.unknown,
      anchor: anchorAdvice(target, game, names),
      moves: moveAdvice(units, game, names),
      // Parade posée : lignées de l'appât et du porteur couvert ; null sans parade (pas demandée, ou impossible).
      guard: guarded ? { bait: units.find(u => u.bait).base, carry: guarded.base } : null,
      dive,
      code: target ? kt1Code(units, stats.rules, mode) : null,
    };
  }

  // Cache Storage d'une heure (conditions de l'API), revalidé par ETag ; une réponse au format inattendu n'écrase jamais la
  // copie gardée. env = { caches, fetch, now } : globaux du navigateur, injectables pour les tests.
  async function loadJson(url, accept, env) {
    if (!env.caches) throw new Error('cache du navigateur indisponible : navigation privée ou stockage bloqué');
    let cache;
    try {
      cache = await env.caches.open(CACHE_NAME);
    } catch (e) {
      // Firefox refuse le Cache Storage en navigation privée ou quand le stockage du site est bloqué.
      if (e instanceof DOMException) throw new Error('cache du navigateur indisponible : navigation privée ou stockage bloqué');
      throw e;
    }
    const found = await cache.match(url);
    // Une copie d'un autre format (version précédente du script) compte comme absente.
    const hitJson = found ? await found.clone().json().catch(e => {
      if (e instanceof SyntaxError) return null;
      throw e;
    }) : null;
    const hit = hitJson !== null && accept(hitJson) ? found : null;
    const at = Number(hit?.headers.get('x-kt-at'));
    // x-kt-at date la copie ; x-kt-try date la dernière tentative ratée (une requête par heure, même en échec).
    const keep = async (body, etag, fetchedAt, triedAt = '') => {
      try {
        await cache.put(url, new Response(body, { headers: { 'content-type': 'application/json', etag: etag ?? '', 'x-kt-at': String(fetchedAt), 'x-kt-try': String(triedAt) } }));
        return true;
      } catch (e) {
        // Quota dépassé ou stockage refusé : la réponse reste valable, seule la mise en cache échoue.
        if (e instanceof DOMException) return false;
        throw e;
      }
    };
    if (hit && (isFresh(at, env.now) || isFresh(Number(hit.headers.get('x-kt-try') || NaN), env.now))) {
      return { json: hitJson, at, stale: !isFresh(at, env.now) };
    }
    // L'API ne reconnaît pas la forme faible W/"…" que reçoit le navigateur (réponse compressée) : même étiquette, sans le préfixe.
    const etag = hit?.headers.get('etag')?.replace(/^W\//, '');
    const stale = async reason => {
      if (!hit) throw new Error(reason);
      await keep(JSON.stringify(hitJson), hit.headers.get('etag'), at, env.now);
      return { json: hitJson, at, stale: true };
    };
    let res;
    let body;
    try {
      res = await env.fetch(url, etag ? { headers: { 'If-None-Match': etag } } : {});
      body = res.ok ? await res.text() : null;
    } catch (e) {
      // fetch et la lecture du corps ne rejettent qu'avec TypeError en cas d'échec réseau.
      if (e instanceof TypeError) return stale('réseau');
      throw e;
    }
    if (res.status === 304 && hit) {
      const cached = await keep(JSON.stringify(hitJson), etag, env.now);
      return { json: hitJson, at: env.now, stale: false, uncached: !cached };
    }
    if (!res.ok) return stale(`HTTP ${res.status}`);
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      if (e instanceof SyntaxError) return stale('format inattendu');
      throw e;
    }
    if (!accept(json)) return stale('format inattendu');
    const cached = await keep(body, res.headers.get('etag'), env.now);
    return { json, at: env.now, stale: false, uncached: !cached };
  }

  const pct = x => `${x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const shortDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return {
    SOURCES, UI_KEY, PLAN_NAME, BOONS, TOWER, CAMPAIGN, TOWER_MODE, NUZLOCKE_HUD, leagueLabel, lineInfo, loadJson, goldRules, leagueNote, modeContext, withStrategy, STRATEGY, STRATEGY_DEFAULTS, latestSave, shownMode, pollState,
    VERSION, JOURNAL_KEY, TOWER_RUNS_KEY, readJournal, fightWon, fightEntry, notedFight, addFight, ownResults, withResults, resultsNote,
    parseSave, floorFromSave, isStatsData, isGameData, isLang, isFresh, lastBossFloor, nextBossStop, nextStops, topCores, isBoss, mustWin,
    baseLine, namer, bossName, fightName, guideFor, rateLevel, readGame, goldFloor, levelGoal, rerollChance, coreScore, targetComp, progress, shinyLine, anchorAdvice, advise, pct, shortDate,
    boardCell, touching, topHolders, lineProfiles, suits, floorRange, CARRY_ZONES, coreKey, TABS, OPTIONS, checkUi,
  };
})();

const CSS = `
:host { all: initial; }
/* Jetons : couleurs, ombres, espacements, rayons et tailles de texte. Thème sombre par défaut, clair par data-scheme. */
.kt-root {
  /* Pastilles : couleurs Okabe-Ito fixes, posées sur le jeu toujours sombre ; bord sombre + liseré blanc = contraste sur les deux fonds */
  --kp-do-bg:#0072b2; --kp-do-fg:#fff; --kp-opt-bg:#fff; --kp-opt-fg:#141a33; --kp-no-bg:#f0e442; --kp-no-fg:#141a33;
  --kp-edge:#141a33; --kp-ring:#fff; --kp-focus:#56b4e9; --kp-shadow:0 2px 6px rgb(0 0 0 / .35);
  --kt-glass:rgb(16 20 38 / var(--kt-alpha)); --kt-blur:16px;
  --kt-text:#f1f3ff; --kt-muted:#c6cdee; --kt-line:rgb(255 255 255 / .12); --kt-control:rgb(255 255 255 / .38);
  --kt-raised:rgb(255 255 255 / .07); --kt-raised-2:rgb(255 255 255 / .12); --kt-scrim:rgb(0 0 0 / .18);
  /* Accent en texte distinct de l'accent en aplat : 4,5:1 jusqu'au fond 85 %, sur surface surélevée, même sur un pixel blanc du jeu. */
  --kt-accent:#56b4e9; --kt-accent-fg:#0b1020; --kt-accent-text:#8fd0f5; --kt-focus:#56b4e9;
  --kt-good-bg:#56b4e9; --kt-good-fg:#0b1020; --kt-bad-bg:#f0e442; --kt-bad-fg:#141a33; --kt-mid-bg:rgb(255 255 255 / .14); --kt-mid-fg:#f1f3ff;
  --kt-coin:#e8b931; --kt-coin-edge:#b9851b;
  --kt-shadow:0 12px 32px rgb(0 0 0 / .45), inset 0 0 0 1px rgb(255 255 255 / .06);
  --kt-font:system-ui,-apple-system,"Segoe UI",sans-serif;
  color-scheme: dark; --kt-alpha:.9; --kt-size:14px; --kt-width:320px;
  --kt-fs-xs:calc(var(--kt-size) - 3px); --kt-fs-s:calc(var(--kt-size) - 2px); --kt-fs-m:calc(var(--kt-size) - 1px); --kt-fs-l:calc(var(--kt-size) + 2px);
  --kt-s0:2px; --kt-s1:4px; --kt-s15:6px; --kt-s2:8px; --kt-s3:12px; --kt-s4:16px; --kt-r-in:6px; --kt-r-ctl:8px; --kt-r-card:10px; --kt-r-box:14px;
  /* Hauteurs : barre, contrôle (≥ 24 px, WCAG 2.5.8), contrôle intérieur, ligne repliable, bouton principal, symbole, icône. */
  --kt-h-bar:44px; --kt-h-ctl:28px; --kt-h-in:26px; --kt-h-row:32px; --kt-h-main:36px; --kt-h-sym:20px; --kt-h-icon:16px;
  /* Pastilles et bulles : cible de 24 px (WCAG 2.5.8), texte fixe (posé sur le jeu, hors de l'option Texte). */
  --kp-h:24px; --kp-fs:12px; --kp-tip-w:240px; --kp-tip-fs:12px; --kp-tip-title:13px; }
.kt-root[data-scheme="light"] { color-scheme: light;
  --kt-glass:rgb(250 251 255 / var(--kt-alpha)); --kt-text:#141a33; --kt-muted:#3a4266; --kt-line:rgb(20 26 51 / .12);
  --kt-control:rgb(20 26 51 / .45); --kt-raised:rgb(20 26 51 / .05); --kt-raised-2:rgb(20 26 51 / .09);
  --kt-accent:#0072b2; --kt-accent-fg:#fff; --kt-accent-text:#004f7a; --kt-focus:#0072b2;
  --kt-good-bg:#0072b2; --kt-good-fg:#fff; --kt-mid-bg:rgb(20 26 51 / .08); --kt-mid-fg:#141a33;
  --kt-shadow:0 12px 32px rgb(0 0 0 / .3), inset 0 0 0 1px rgb(255 255 255 / .5); }
/* Options Fond, Texte, Largeur. 85 % est le plancher : à 80 %, le texte secondaire d'une surface surélevée tombe à 4,3:1 sur un
   pixel blanc (sombre) ou noir (clair) du jeu. */
.kt-root[data-alpha="100"] { --kt-alpha:1; }
.kt-root[data-alpha="85"] { --kt-alpha:.85; }
.kt-root[data-text="small"] { --kt-size:13px; }
.kt-root[data-text="large"] { --kt-size:16px; }
.kt-root[data-width="wide"] { --kt-width:380px; }

/* Panneau */
/* Colonne dont seuls le contenu de l'onglet et le menu défilent : barre, or et boss restent visibles. */
.kt { position: fixed; z-index: 2147483647; display: flex; flex-direction: column; width: var(--kt-width); max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: hidden; box-sizing: border-box;
  background: var(--kt-glass); backdrop-filter: blur(var(--kt-blur)) saturate(1.2); color: var(--kt-text); border-radius: var(--kt-r-box);
  box-shadow: var(--kt-shadow); font: var(--kt-size)/1.4 var(--kt-font); font-variant-numeric: tabular-nums; }
.kt * { box-sizing: border-box; }
.kt p { margin: 0; }
.kt button { font: inherit; color: inherit; }
.kt-bar { display: flex; align-items: center; gap: var(--kt-s1); min-height: var(--kt-h-bar); padding: 0 var(--kt-s2) 0 var(--kt-s3); cursor: move; touch-action: none; user-select: none; }
.kt-lbl { font-size: var(--kt-fs-s); color: var(--kt-muted); margin-right: var(--kt-s1); }
.kt-stepper { display: inline-flex; align-items: center; height: var(--kt-h-ctl); border: 1px solid var(--kt-control); border-radius: var(--kt-r-ctl); flex: none; }
.kt-stepper button { width: var(--kt-h-in); height: var(--kt-h-in); border: 0; background: none; color: var(--kt-muted); cursor: pointer; border-radius: var(--kt-r-ctl); }
.kt-floor { width: calc(var(--kt-h-in) + var(--kt-s3) + var(--kt-s0)); height: var(--kt-h-in); border: 0; border-inline: 1px solid var(--kt-line); background: none; color: var(--kt-text); font: 700 var(--kt-fs-l) var(--kt-font); text-align: center; }
.kt-floor::placeholder { color: var(--kt-muted); }
.kt-floor.is-empty { outline: 2px solid var(--kt-focus); outline-offset: -2px; }
.kt-src { font-size: var(--kt-fs-xs); color: var(--kt-muted); padding: var(--kt-s0) var(--kt-s15); border-radius: 999px; background: var(--kt-raised); margin-left: var(--kt-s1); }
.kt-sp { flex: 1; }
.kt-ibtn { width: var(--kt-h-ctl); height: var(--kt-h-ctl); display: grid; place-items: center; border: 0; border-radius: var(--kt-r-ctl); background: none; color: var(--kt-muted); cursor: pointer; flex: none; }
.kt-ibtn:hover, .kt-ibtn[aria-expanded="true"][data-act="menu"] { background: var(--kt-raised-2); color: var(--kt-text); }
.kt-ibtn svg { width: var(--kt-h-icon); height: var(--kt-h-icon); }
.kt button:focus-visible, .kt-floor:focus-visible, .kt a:focus-visible, .kt summary:focus-visible, .kt-opts input:focus-visible + span, .kt-dive input:focus-visible + span { outline: 2px solid var(--kt-focus); outline-offset: 2px; }
.kt-sum { display: none; align-items: center; gap: var(--kt-s2); min-width: 0; font-size: var(--kt-fs-m); }
.kt-sum b { color: var(--kt-accent-text); }
.kt-sum .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt.is-collapsed .kt-sum { display: flex; }
.kt.is-collapsed :is(.kt-lbl, .kt-src, [data-act="menu"], .kt-alert, .kt-opts, .kt-body, .kt-status, .kt-foot) { display: none; }
.kt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.kt-coin { width: var(--kt-h-icon); height: var(--kt-h-icon); border-radius: 999px; background: var(--kt-coin); box-shadow: inset 0 0 0 2px var(--kt-coin-edge); flex: none; }

/* En-tête : or et prochain boss */
.kt-bar, .kt-alert, .kt-status, .kt-foot { flex: none; }
.kt-body { display: flex; flex-direction: column; gap: var(--kt-s3); min-height: 0; padding: 0 0 var(--kt-s3); }
.kt-head, .kt-tabs { flex: none; }
/* minmax(0, 1fr) : une ligne longue sans retour (« à éviter ») s'ellipse au lieu d'élargir la grille hors du panneau. */
.kt-head, .kt-panel { grid-template-columns: minmax(0, 1fr); }
.kt-head { display: grid; gap: var(--kt-s2); padding: 0 var(--kt-s3); }
.kt-gold { display: flex; align-items: center; gap: var(--kt-s2); }
.kt-gold b { font-size: var(--kt-fs-l); }
.kt-gold .spend { font-size: var(--kt-fs-l); font-weight: 700; color: var(--kt-accent-text); }
.kt-gold .m { font-size: var(--kt-fs-s); color: var(--kt-muted); margin-left: auto; white-space: nowrap; }
.kt-warn { display: flex; gap: var(--kt-s2); align-items: center; font-size: var(--kt-fs-s); padding: var(--kt-s15) var(--kt-s2); border-radius: var(--kt-r-ctl); background: var(--kt-raised); }
/* Carte avec taux : texte à gauche, taux sur deux rangées à droite (prochain boss, trios). */
.kt-card-rate { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0 var(--kt-s2); padding: var(--kt-s2); border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-card-rate .kt-rate { grid-row: 1 / span 2; grid-column: 2; }
.kt-boss { padding: var(--kt-s2) var(--kt-s3); }
.kt-boss .n { font-weight: 700; font-size: var(--kt-fs-l); }
.kt-boss .w { font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-rate { display: inline-flex; gap: var(--kt-s1); align-items: center; padding: var(--kt-s0) var(--kt-s2); border-radius: 999px; font-size: var(--kt-fs-s); font-weight: 700; white-space: nowrap; }
.kt-rate.good { background: var(--kt-good-bg); color: var(--kt-good-fg); }
.kt-rate.bad { background: var(--kt-bad-bg); color: var(--kt-bad-fg); }
.kt-rate.mid { background: var(--kt-mid-bg); color: var(--kt-mid-fg); }

/* Onglets */
.kt-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--kt-s0); margin: 0 var(--kt-s3); padding: var(--kt-s0); border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-tabs button { height: var(--kt-h-ctl); display: flex; align-items: center; justify-content: center; gap: var(--kt-s1); border: 0; border-radius: var(--kt-r-in); background: none; color: var(--kt-muted); font-size: var(--kt-fs-m); font-weight: 600; cursor: pointer; }
.kt-tabs button[aria-selected="true"] { background: var(--kt-accent); color: var(--kt-accent-fg); }
/* Chiffre en --kt-text : en --kt-muted sur --kt-raised-2, il tomberait à 4,3:1 au fond 85 %. */
.kt-tabs .count { min-width: var(--kt-h-icon); height: var(--kt-h-icon); padding: 0 var(--kt-s1); border-radius: 999px; background: var(--kt-raised-2); color: var(--kt-text); font-size: var(--kt-fs-xs); display: inline-grid; place-items: center; }
.kt-tabs button[aria-selected="true"] .count { background: var(--kt-scrim); }
.kt-panel { display: grid; align-content: start; gap: var(--kt-s3); min-height: 0; overflow: auto; padding: var(--kt-s0) var(--kt-s3); }
.kt-label { display: flex; justify-content: space-between; gap: var(--kt-s2); font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-msg { padding: var(--kt-s2) var(--kt-s3); border-radius: var(--kt-r-card); background: var(--kt-raised); font-size: var(--kt-fs-m); }
.kt-msg strong { display: block; }

/* Conseils */
.kt-todo { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-s0); }
.kt-todo li { display: grid; grid-template-columns: var(--kt-h-sym) 1fr; gap: var(--kt-s2); padding: var(--kt-s15) var(--kt-s2); border-radius: var(--kt-r-ctl); }
.kt-todo .t { font-weight: 600; font-size: var(--kt-fs-m); }
.kt-todo .why { display: block; font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-sym { display: inline-grid; place-items: center; width: var(--kt-h-sym); height: var(--kt-h-sym); border-radius: 999px; font-size: var(--kt-fs-xs); font-weight: 700; border: 1px solid var(--kp-edge); flex: none; }
.kt-avoid { border-top: 1px solid var(--kt-line); }
.kt-avoid summary { display: flex; align-items: center; gap: var(--kt-s2); min-height: var(--kt-h-row); padding: 0 var(--kt-s2); font-size: var(--kt-fs-m); color: var(--kt-muted); cursor: pointer; list-style: none; }
.kt-avoid summary::-webkit-details-marker { display: none; }
.kt-avoid summary::before { content: "▸"; width: var(--kt-h-sym); text-align: center; }
.kt-avoid[open] summary::before { content: "▾"; }
.kt-avoid .k { color: var(--kt-text); font-weight: 600; white-space: nowrap; }
.kt-avoid .l { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt-avoid[open] .l { display: none; }

/* Compo */
.kt-comp { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--kt-s1); }
.kt-comp li { display: inline-flex; align-items: center; gap: var(--kt-s15); min-height: var(--kt-h-in); padding: 0 var(--kt-s2); border-radius: var(--kt-r-ctl); background: var(--kt-raised); font-size: var(--kt-fs-s); }
.kt-comp li.core { font-weight: 700; box-shadow: inset 0 0 0 1px var(--kt-accent); }
.kt-comp .p { color: var(--kt-muted); font-weight: 400; }
.kt-comp .sh { padding: 0 var(--kt-s1); border-radius: 999px; background: var(--kt-bad-bg); color: var(--kt-bad-fg); font-size: var(--kt-fs-xs); font-weight: 700; }
.kt-copy { height: var(--kt-h-main); border: 0; border-radius: var(--kt-r-ctl); background: var(--kt-accent); color: var(--kt-accent-fg); font-weight: 700; cursor: pointer; }
.kt-hint { font-size: var(--kt-fs-s); color: var(--kt-muted); }

/* Objets visés */
.kt-aims { border-top: 1px solid var(--kt-line); padding-top: var(--kt-s2); font-size: var(--kt-fs-s); }
.kt-aims summary { font-weight: 600; cursor: pointer; min-height: var(--kp-h); }
.kt-aims > ul { list-style: none; margin: var(--kt-s1) 0 0; padding: 0; display: grid; gap: var(--kt-s2); }
.kt-aims .who { font-weight: 700; }
.kt-aims ul ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-s0); }
.kt-aims ul ul li { display: grid; grid-template-columns: var(--kt-h-icon) 1fr; gap: var(--kt-s1); }
.kt-aims .st { text-align: center; }
.kt-aims .why { color: var(--kt-muted); }

/* Boss */
.kt-big { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--kt-s2); }
.kt-big p { padding: var(--kt-s2); border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-big b { display: block; font-size: var(--kt-fs-l); }
.kt-big span { font-size: var(--kt-fs-xs); color: var(--kt-muted); }
.kt-cores { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-s1); }
.kt-cores .names { font-size: var(--kt-fs-m); font-weight: 600; }
.kt-cores .n { font-size: var(--kt-fs-xs); color: var(--kt-muted); }
.kt-cores .mine { color: var(--kt-accent-text); font-weight: 600; }

/* Règles */
.kt-rules { margin: 0; padding-left: var(--kt-s4); display: grid; gap: var(--kt-s15); font-size: var(--kt-fs-m); }

/* Options */
.kt-opts { display: grid; gap: var(--kt-s3); min-height: 0; overflow: auto; padding: var(--kt-s3); border-top: 1px solid var(--kt-line); }
.kt-opts[hidden] { display: none; }
.kt-opts h2 { margin: 0; font-size: var(--kt-fs-m); }
.kt-opts fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--kt-s15); min-width: 0; }
.kt-opts legend { padding: 0; margin-bottom: var(--kt-s15); font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: var(--kt-s0); padding: var(--kt-s0); border-radius: var(--kt-r-ctl); background: var(--kt-raised); }
.kt-seg label, .kt-checks label { position: relative; cursor: pointer; }
.kt-opts input, .kt-dive input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
.kt-seg span { min-height: var(--kt-h-in); display: grid; place-items: center; padding: 0 var(--kt-s1); border-radius: var(--kt-r-in); font-size: var(--kt-fs-s); font-weight: 600; color: var(--kt-muted); text-align: center; }
.kt-seg input:checked + span { background: var(--kt-raised-2); color: var(--kt-text); box-shadow: inset 0 0 0 1px var(--kt-control); }
.kt-checks { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--kt-s2); }
.kt-dive { grid-template-columns: 1fr; }
.kt-checks span { min-height: var(--kt-h-ctl); display: flex; align-items: center; gap: var(--kt-s15); padding: 0 var(--kt-s2); border-radius: var(--kt-r-ctl); background: var(--kt-raised); font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-checks span::before { content: ""; width: var(--kt-h-icon); height: var(--kt-h-icon); border-radius: var(--kt-s1); border: 1px solid var(--kt-control); flex: none; }
.kt-checks input:checked + span { color: var(--kt-text); }
.kt-checks input:checked + span::before { background: var(--kt-accent); border-color: var(--kt-accent); box-shadow: inset 0 0 0 3px var(--kt-glass); }

.kt-alert { padding: 0 var(--kt-s3) var(--kt-s3); }
.kt-alert:empty, .kt-status:empty { display: none; }
.kt-status { padding: 0 var(--kt-s3) var(--kt-s2); font-size: var(--kt-fs-s); color: var(--kt-muted); overflow-wrap: anywhere; }
.kt-status code { font-size: var(--kt-fs-s); user-select: all; }
.kt-foot { padding: var(--kt-s2) var(--kt-s3); font-size: var(--kt-fs-xs); color: var(--kt-muted); border-top: 1px solid var(--kt-line); }
.kt-foot a { color: inherit; white-space: nowrap; }
.kt.is-menu :is(.kt-body, .kt-alert, .kt-status, .kt-foot) { display: none; }

/* Pastilles */
.kp-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.kp { position: fixed; display: inline-flex; align-items: center; gap: var(--kt-s1); height: var(--kp-h); min-width: var(--kp-h); padding: 0 var(--kt-s2); translate: -50% 0;
  border-radius: 999px; border: 1px solid var(--kp-edge); font: 700 var(--kp-fs)/1 var(--kt-font); white-space: nowrap; cursor: help;
  pointer-events: auto; box-shadow: 0 0 0 1px var(--kp-ring), var(--kp-shadow); }
.kp[hidden] { display: none; }
/* Cible étroite (case d'objet, banc) : symbole seul, verbe gardé pour les lecteurs d'écran. */
.kp.is-compact { justify-content: center; padding: 0 var(--kt-s1); }
.kp.is-compact .kp-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.kp-do, .kt-sym.kp-do { background: var(--kp-do-bg); color: var(--kp-do-fg); }
.kp-opt, .kt-sym.kp-opt { background: var(--kp-opt-bg); color: var(--kp-opt-fg); }
.kp-no, .kt-sym.kp-no { background: var(--kp-no-bg); color: var(--kp-no-fg); }
.kp:focus-visible { outline: 2px solid var(--kp-focus); outline-offset: 2px; }

/* Bulles */
.kp-tip { display: none; position: absolute; left: 50%; translate: -50% 0; bottom: calc(100% + var(--kt-s2)); width: var(--kp-tip-w); padding: var(--kt-r-card) var(--kt-s3);
  border-radius: var(--kt-r-box); background: var(--kt-glass); backdrop-filter: blur(var(--kt-blur)); color: var(--kt-text);
  font: 400 var(--kp-tip-fs)/1.45 var(--kt-font); white-space: normal; text-align: left; box-shadow: var(--kt-shadow); }
.kp.is-below .kp-tip { bottom: auto; top: calc(100% + var(--kt-s2)); }
/* Près d'un bord, la bulle s'aligne sur la pastille au lieu de se centrer (sinon coupée par la fenêtre). */
.kp.is-left .kp-tip { left: 0; translate: 0 0; }
.kp.is-right .kp-tip { left: auto; right: 0; translate: 0 0; }
.kp:hover .kp-tip, .kp:focus-visible .kp-tip { display: block; }
/* La pastille survolée ou sélectionnée passe devant ses voisines, bulle comprise. */
.kp:hover, .kp:focus-visible { z-index: 1; }
.kp.is-dismissed .kp-tip { display: none; }
.kp-tip strong { display: block; font-size: var(--kp-tip-title); margin-bottom: var(--kt-s0); }
.kp-tip .m { display: block; margin-top: var(--kt-s1); color: var(--kt-muted); }
@media (prefers-reduced-motion: no-preference) {
  .kt-tabs button, .kt-seg span, .kt-ibtn { transition: background-color .12s, color .12s; }
}
`;

const SYM = { do: '★', opt: '◆', no: '✕' };
const LEVEL_NAME = { do: 'À faire', opt: 'Si l’or le permet', no: 'À éviter' };
// Cibles du jeu (DOM v41) par groupe de conseils ; les modales masquent les autres groupes.
const TARGETS = {
  shop: { sel: '.cards .cardwrap', modal: false },
  bench: { sel: '.bench .slot', modal: false },
  bag: { sel: '.it-slot', modal: false, by: (el, i) => el.matches(`[data-islot="${i}"]`) },
  xp: { sel: 'button.btn-lvl', modal: false },
  reroll: { sel: 'button.btn-roll', modal: false },
  reward: { sel: '.modal.itemreward .ir-card', modal: true },
  offer: { sel: '.modal.tboon .ev-card', modal: true },
  event: { sel: '.modal.evround .ev-card', modal: true },
};
const COMPACT_BELOW = 64;
// Demi-largeur de la bulle (240 px) : en deçà du bord, elle s'aligne sur la pastille.
const TIP_HALF = 120;

const ICON = {
  gear: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
};

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// Conseils de partie seulement à l'étage ou au combat de la sauvegarde : saisi à la main, il ne sert qu'au prochain boss.
const onSaveFloor = state => state.save !== null && state.floor === KT.floorFromSave(state.lastRaw, state.mode);
// Statistiques du mode de la partie (torre ou camp de campana.json) ; null avant leur chargement ou sans elles.
const modeStats = state => state.stats?.[state.mode.stats] ?? null;
const UNSUPPORTED = '<p class="kt-msg"><strong>Nuzlocke : pas de conseils</strong>Le panneau conseille la Tour et les aventures de la campagne.</p>';


const allMarks = a => [...a.event, ...a.shop, a.reroll, a.xp, ...a.bench, ...a.bag, ...a.reward, ...a.offer, ...a.anchor, ...a.moves].filter(Boolean);
const LEVEL_ORDER = { do: 0, opt: 1, no: 2 };
// Un conseil par titre (la même consigne peut viser plusieurs cases du jeu), du plus pressant au moins pressant.
// Calculé une fois par conseil : l'onglet Tour, son compteur et le résumé replié le lisent à chaque rendu.
const marksOf = new WeakMap();
function sortedMarks(a) {
  if (!marksOf.has(a)) {
    const seen = new Set();
    marksOf.set(a, allMarks(a).sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]).filter(m => !seen.has(m.title) && seen.add(m.title)));
  }
  return marksOf.get(a);
}
// Lignes de l'onglet Tour hors « à éviter » : conseils ★ et ◆, puis bénédictions inconnues.
const todoCount = a => sortedMarks(a).filter(m => m.level !== 'no').length + a.unknownOffer.length;
const symHtml = level => `<span class="kt-sym kp-${level}" role="img" aria-label="${LEVEL_NAME[level]}">${SYM[level]}</span>`;
const markHtml = m => `<li>${symHtml(m.level)}<span><span class="t">${esc(m.title)}</span><span class="why">${esc(m.why)}</span></span></li>`;

function noAdviceHtml(state) {
  if (state.unsupported) return UNSUPPORTED;
  return state.save && !onSaveFloor(state)
    ? `<p class="kt-msg">Conseils de partie masqués : ta partie est ${state.mode.at} ${KT.floorFromSave(state.lastRaw, state.mode)}.</p>`
    : '<p class="kt-msg">Les conseils de partie apparaissent dès qu’une partie Tour ou campagne est lancée.</p>';
}

function tourHtml(state, ui) {
  const a = state.advice;
  if (!a) return noAdviceHtml(state);
  const marks = sortedMarks(a);
  const lines = marks.filter(m => m.level !== 'no').map(markHtml);
  for (const id of a.unknownOffer) lines.push(`<li><span></span><span><span class="t">Bénédiction inconnue (${esc(id)})</span><span class="why">pas de conseil</span></span></li>`);
  const avoid = marks.filter(m => m.level === 'no');
  const todo = lines.length ? `<ol class="kt-todo" aria-label="Conseils">${lines.join('')}</ol>` : '<p class="kt-msg">Rien à faire pour l’instant.</p>';
  return `${todo}${avoid.length ? `<details class="kt-avoid"${ui.avoid ? ' open' : ''}><summary id="kt-avoid-sum"><span class="k">${avoid.length} à éviter</span>
<span class="l">${esc(avoid.map(m => m.title).join(' · '))}</span></summary><ol class="kt-todo">${avoid.map(markHtml).join('')}</ol></details>` : ''}`;
}

// Objets visés (maquette 2026-11-09-objets-vises) : symbole décoratif, l'état est dit par le libellé.
const AIM_SYM = { worn: '✓', ready: '●', missing: '○' };
function aimsHtml(a, ui) {
  const rows = a.aims.filter(x => x.aims.length).map(x => {
    const items = x.aims.map(y => {
      const state = { worn: 'porté', ready: 'prêt au sac' }[y.state] ?? `manque ${y.missing.map(a.names.item).join(', ')}`;
      return `<li><span class="st" aria-hidden="true">${AIM_SYM[y.state]}</span><span>${esc(a.names.item(y.id))} <span class="why">— ${esc(state)}</span></span></li>`;
    });
    return `<li><span class="who">${esc(a.names.line(x.unit.line))}</span><ul>${items.join('')}</ul></li>`;
  });
  return rows.length ? `<details class="kt-aims"${ui.aims ? ' open' : ''}><summary id="kt-aims-sum">Objets visés</summary><ul>${rows.join('')}</ul></details>` : '';
}

// Assassins adverses vus sur le plateau : case à cocher par combat, puis la parade posée ou la raison de son absence.
function diveHtml(state) {
  const a = state.advice;
  let note = 'Coche si l’adversaire en aligne : ils plongent sur ton Pokémon le plus au fond.';
  if (a.dive) {
    note = a.guard ? `Appât au fond : ${esc(a.names.line(a.guard.bait))}. Porteur couvert : ${esc(a.names.line(a.guard.carry))}. Garde-le hors de la colonne d’un Nosferapti.`
      : 'Pas de parade : aucun porteur à distance à couvrir, aucun Pokémon à envoyer au fond, ou plus de case libre.';
  }
  return `<div class="kt-checks kt-dive"><label><input type="checkbox" name="dive" id="kt-dive" aria-describedby="kt-dive-note"${a.dive ? ' checked' : ''}><span>Assassins adverses : Insécateur, Doduo, Abo, Nosferapti</span></label></div>
<p class="kt-hint" id="kt-dive-note">${note}</p>`;
}

function compoHtml(state, ui) {
  const a = state.advice;
  if (!a) return noAdviceHtml(state);
  if (!a.target) {
    if (!modeStats(state) || !state.data) return '<p class="kt-msg">Pas de compo cible : données indisponibles (voir l’alerte).</p>';
    return a.game.mode.id === KT.TOWER.id ? `<p class="kt-msg">Aucun trio d’au moins 20 combats sur les prochains ${a.game.mode.units}.</p>`
      : '<p class="kt-msg">Pas de compo cible : aucune unité ni carte en boutique.</p>';
  }
  const t = a.target;
  const { mode } = a.game;
  // Une manche aux variantes tirées au sort a plusieurs arrêts : un seul nom par manche.
  const bosses = [...new Map(t.stops.filter(s => KT.isBoss(s, mode)).map(s => [s.floor, `${KT.fightName(s)} ${s.floor}`])).values()];
  let span = bosses.length > 1 ? `${bosses[0]} → ${bosses.at(-1)}` : bosses[0] ?? '';
  if (!t.core.length) span = 'sans trio : pas de statistiques sur ces combats';
  const chip = (id, core) => {
    const base = KT.baseLine(id);
    return `<li${core ? ' class="core"' : ''}>${esc(a.names.line(id))} <span class="p">${KT.progress(a.game, base)}</span>${KT.shinyLine(a.game, base) ? ' <span class="sh">shiny</span>' : ''}</li>`;
  };
  return `<p class="kt-label"><span>Compo cible</span><span>${esc(span)}</span></p>
<ul class="kt-comp">${t.core.map(id => chip(id, true)).join('')}${t.fillers.map(id => chip(id, false)).join('')}</ul>
${a.next ? `<p class="kt-label"><span>Ensuite</span><span>${esc(KT.floorRange(a.next.stops, mode))}</span></p><ul class="kt-comp">${a.next.core.map(id => chip(id, false)).join('')}</ul>` : ''}
${aimsHtml(a, ui)}
${diveHtml(state)}
<button class="kt-copy" id="kt-copy" data-act="copy">Copier la formation</button>
<p class="kt-hint">Porteur à distance : rangée de sa portée, ${KT.CARRY_ZONES[ui.side].name} (options ⚙).</p>`;
}

// Prochain boss du mode de la partie : stats null avant leur chargement, stop null sans boss à venir.
function nextBossOf(state) {
  const stats = modeStats(state);
  return { stats, stop: stats && KT.nextBossStop(stats.stops, state.floor, state.mode) };
}

// Taux coloré au taux moins la pénalité du mode (difficulté et résultats du joueur), comme le seuil de « tout jouer ».
function rateHtml(win, mode, label = '') {
  const l = KT.rateLevel(win - mode.penalty);
  return `<span class="kt-rate ${l.cls}">${l.sym} ${KT.pct(win)}${label}</span>`;
}

function bossTabHtml(state) {
  const { stats, stop } = nextBossOf(state);
  if (!stats) return '<p class="kt-msg">Statistiques indisponibles.</p>';
  // L'en-tête dit déjà qu'aucun boss n'est connu après cet étage.
  if (!stop) return '<p class="kt-msg">Pas de trio à afficher.</p>';
  const names = KT.namer(state.lang);
  const mine = state.advice?.target?.key;
  const cores = KT.topCores(stats.cores, stop.stop);
  const coresHtml = cores.length
    ? `<ol class="kt-cores">${cores.map(c => {
      const own = KT.coreKey(c.core) === mine ? ' · <span class="mine">ta compo cible</span>' : '';
      return `<li class="kt-card-rate"><span class="names">${esc(c.core.map(names.line).join(' · '))}</span>${rateHtml(c.win, state.mode)}<span class="n">${c.n} combats${own}</span></li>`;
    }).join('')}</ol>`
    : '<p class="kt-msg">Aucun trio n’a encore 20 combats sur ce boss.</p>';
  // Manche à plusieurs variantes (champion à choisir, tirage) : leurs taux, puis les chiffres de la plus jouée.
  const variants = stop.variants.length > 1
    ? `<p class="kt-msg">${esc(stop.variants.map(v => `${KT.bossName(v.boss)} ${KT.pct(v.win)}`).join(' · '))}. Chiffres et trios contre ${esc(KT.bossName(stop.boss))}, le plus joué.</p>` : '';
  return `${variants}<div class="kt-big"><p><b>${KT.pct(stop.win)}</b><span>victoires</span></p><p><b>${KT.pct(stop.first)}</b><span>au 1er essai</span></p>
<p><b>${stop.tries.toLocaleString('fr-FR')}</b><span>essais en moyenne</span></p></div>
<p class="kt-label"><span>Meilleurs trios</span><span>≥ 20 combats</span></p>${coresHtml}`;
}

// Le guide des shinies par tranche d'étages ne vaut que pour la Tour.
function rulesHtml(state) {
  const where = state.mode.hasLeague ? KT.leagueLabel(state.mode) : state.mode.name;
  const rules = `<ul class="kt-rules">${KT.goldRules(state.mode).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
<p class="kt-label"><span>Tes résultats</span><span>${esc(where)}</span></p>
<ul class="kt-rules">${KT.resultsNote(state.mode, state.fights).map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
  if (state.mode.id !== KT.TOWER.id) return `<p class="kt-label"><span>Règles d’or</span><span>${esc(state.mode.adv?.name ?? state.mode.name)}</span></p>${rules}`;
  const g = KT.guideFor(state.floor);
  const range = g.to === Infinity ? `étages ${g.from} et plus` : `étages ${g.from}–${g.to}`;
  const shinies = g.shinies.length
    ? `Shinies à saisir : ${esc(g.shinies.join(', '))}. ${esc(g.advice)} (conseil non vérifié ; un shiny a +10 % de PV, de défenses et de dégâts).`
    : esc(g.advice);
  return `<p class="kt-label"><span>Règles d’or</span><span>${range}</span></p><p class="kt-msg">${shinies}</p>
${rules}`;
}

// Pas de prochain boss : fin des statistiques (last), ou aucun arrêt du mode (-Infinity) : Tour ou aventure dont les libellés
// ont changé dans l'API, aventure sans table d'arrêts.
function noBossHtml(mode, last) {
  const msg = (title, text) => `<p class="kt-msg"><strong>${esc(title)}</strong>${esc(text)}</p>`;
  if (last !== -Infinity) return msg(`Aucun boss connu après ${mode.the} ${last}`, 'Les statistiques publiques s’arrêtent là.');
  if (mode.id === KT.TOWER.id) return msg('Aucun boss de la Tour dans les statistiques publiques', 'Le format de l’API a sans doute changé.');
  if (mode.adv?.stops) return msg(`Aucun combat de ${mode.adv.name} dans les statistiques publiques`, 'Le format de l’API a sans doute changé : compo sans trio, avec tes meilleures unités.');
  return msg('Pas de statistiques publiques pour cette aventure', 'La compo cible se fait sans trio, avec tes meilleures unités.');
}

// En-tête toujours visible : or à dépenser, alerte « tout jouer », prochain boss.
function headHtml(state) {
  const parts = [];
  const { mode } = state;
  const e = state.advice?.eco;
  if (e) {
    parts.push(`<p class="kt-gold"><span class="kt-coin" aria-hidden="true"></span>Or <b>${e.gold}</b> → <span class="spend">${e.spend} à dépenser</span><span class="m">palier ${e.floor} · +${e.floor / 10}</span></p>`);
    let wall = '';
    if (e.allIn) wall = `Tout jouer : ${e.lowHp ? `PV sous ${mode.lowHp}` : e.retry ? `${mode.unit} rejoué` : 'combat difficile'}.`;
    else if (e.nextWall) wall = `${mode.label} ${e.nextWall.floor} (${esc(KT.fightName(e.nextWall))}, ${KT.pct(e.nextWall.fightWin)}) : ${KT.mustWin(e.nextWall, mode) ? 'tout jouer' : 'perdable sans rejouer, garde le palier'}.`;
    if (wall) parts.push(`<p class="kt-warn"><span class="kt-sym kp-no" aria-hidden="true">▼</span>${wall}</p>`);
  }
  if (mode.hasLeague || mode.ownPenalty) parts.push(`<p class="kt-hint">${esc(KT.leagueNote(mode))}</p>`);
  const { stats, stop } = nextBossOf(state);
  if (stop) {
    const dist = stop.floor - state.floor;
    parts.push(`<div class="kt-boss kt-card-rate"><span class="n">${esc(KT.fightName(stop))}</span>${rateHtml(stop.fightWin, mode, '<span class="kt-sr"> de victoires</span>')}
<span class="w">${mode.unit} ${stop.floor} · ${dist ? `dans ${dist}` : 'en cours'}</span></div>`);
  } else if (stats) {
    parts.push(noBossHtml(mode, KT.lastBossFloor(stats.stops, mode)));
  }
  return parts.length ? `<div class="kt-head">${parts.join('')}</div>` : '';
}

function tabsHtml(state, ui) {
  const count = state.advice ? todoCount(state.advice) : 0;
  return `<div class="kt-tabs" role="tablist" aria-label="Sections">${KT.TABS.map(([id, name]) => {
    const on = id === ui.tab;
    // Nom accessible sur l'onglet (aria-label ignoré sur un span) ; il commence par le texte visible (WCAG 2.5.3).
    const counted = id === 'tour' && count;
    const badge = counted ? ` <span class="count" aria-hidden="true">${count}</span>` : '';
    const label = counted ? ` aria-label="${name} ${count} conseil${count > 1 ? 's' : ''}"` : '';
    return `<button role="tab" id="kt-tab-${id}" data-act="tab" data-tab="${id}" aria-selected="${on}" aria-controls="kt-tabpanel" tabindex="${on ? 0 : -1}"${label}>${name}${badge}</button>`;
  }).join('')}</div>`;
}

const TAB_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);
const TAB_HTML = { tour: tourHtml, compo: compoHtml, boss: bossTabHtml, rules: rulesHtml };

// Onglet visé par une touche sur la liste d'onglets (motif ARIA tablist : flèches, Début, Fin) ; undefined pour une autre touche.
function tabForKey(key, current) {
  const i = KT.TABS.findIndex(([t]) => t === current);
  const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: KT.TABS.length - 1 }[key];
  return to === undefined ? undefined : KT.TABS[(to + KT.TABS.length) % KT.TABS.length][0];
}

// Touche gardée par le panneau, non transmise au jeu. on : 'input' (champ), 'tab' (onglet) ou null. Dans un champ, toutes sauf
// Alt+K, qui replie le panneau ; sur un onglet, ses seules touches (Échap qui ferme une bulle et les raccourcis du jeu remontent).
const keptByPanel = (on, e) => (on === 'input' ? !(e.altKey && e.code === 'KeyK') : on === 'tab' && TAB_KEYS.has(e.key));

// Sections repliables → clé de ui qui garde leur état entre deux rendus et deux sessions.
const FOLDS = { 'kt-avoid': 'avoid', 'kt-aims': 'aims' };
const foldKey = classList => FOLDS[Object.keys(FOLDS).find(c => classList?.contains(c))];

// Option changée dans le menu : case à cocher d'une option checks, sinon bouton radio.
function setOption(ui, { name, value, checked }) {
  if (KT.OPTIONS.find(o => o.key === name)?.type === 'checks') ui[name][value] = checked;
  else ui[name] = value;
}

function panelHtml(state, ui) {
  if (!state.stats && !state.error) return '<div class="kt-panel"><p class="kt-msg" role="status">Chargement des statistiques…</p></div>';
  if (state.unsupported) return `<div class="kt-panel">${UNSUPPORTED}</div>`;
  if (!state.floor) return `<div class="kt-panel"><p class="kt-msg"><strong>Aucune partie en cours</strong>Les conseils d’achat apparaissent dès qu’une partie Tour ou campagne est lancée ; tu peux aussi saisir ${state.mode.the} ci-dessus.</p></div>`;
  return `${headHtml(state)}${tabsHtml(state, ui)}
<div class="kt-panel" role="tabpanel" id="kt-tabpanel" aria-labelledby="kt-tab-${ui.tab}">${TAB_HTML[ui.tab](state, ui)}</div>`;
}

// Panneau replié : l'or à dépenser et le premier conseil ★.
function summaryHtml(state) {
  const a = state.advice;
  if (!a) return '';
  const first = sortedMarks(a).find(m => m.level === 'do');
  return `<span class="kt-coin" role="img" aria-label="Or à dépenser"></span><b>${a.eco.spend}</b>${first ? `${symHtml('do')}<span class="t" title="${esc(first.title)}">${esc(first.title)}</span>` : ''}`;
}

function optionsHtml(ui) {
  const seg = o => `<fieldset><legend>${o.label}</legend><div class="kt-seg">${o.values.map(([v, name]) =>
    `<label><input type="radio" name="${o.key}" value="${v}"${ui[o.key] === v ? ' checked' : ''}><span>${name}</span></label>`).join('')}</div></fieldset>`;
  const checks = o => `<fieldset><legend>${o.label}</legend><div class="kt-checks">${o.values.map(([v, name]) =>
    `<label><input type="checkbox" name="${o.key}" value="${v}"${ui[o.key][v] ? ' checked' : ''}><span>${SYM[v]} ${name}</span></label>`).join('')}</div></fieldset>`;
  const html = list => list.map(o => (o.type === 'checks' ? checks(o) : seg(o))).join('');
  return `<h2>Options</h2>${html(KT.OPTIONS.filter(o => !KT.STRATEGY.includes(o)))}<h2>Stratégie</h2>${html(KT.STRATEGY)}<p class="kt-hint">Seuils choisis : onglet Règles.</p>
<p class="kt-hint">Alt+K replie le panneau ; double-clic sur la barre pour le remettre en haut à droite.</p>`;
}

// Statistiques de campagne refusées : signalées seulement pendant une partie de campagne, la Tour n'en a pas besoin.
function alertHtml(state) {
  const camp = state.campBroken && state.mode.id !== KT.TOWER.id;
  const errors = [state.error, camp && 'campana.json : statistiques de campagne au format inattendu'].filter(Boolean);
  if (!errors.length) return '';
  const effects = [];
  if (state.failed.some(k => k !== 'lang')) effects.push('Sans ces données, pas de compo cible : seuls l’économie et les évolutions sont conseillées.');
  else if (camp) effects.push('En campagne, seuls l’économie et les évolutions sont conseillées.');
  if (state.failed.includes('lang')) effects.push('Les objets et les sceaux sont nommés par leur identifiant.');
  return `<p class="kt-msg"><strong>Données indisponibles (${esc(errors.join(' ; '))})</strong>${effects.join(' ')} Recharge la page dans une heure.</p>`;
}

function footHtml(state) {
  const cached = state.stale ? ` · copie du ${esc(new Date(state.stale).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}` : '';
  const uncached = state.uncached ? ' · non gardé en cache' : '';
  const stats = modeStats(state);
  return `Du ${esc(KT.shortDate(stats.from))} au ${esc(KT.shortDate(stats.to))}${cached}${uncached} · Data: <a href="https://einoow.com" target="_blank" rel="noopener">Kanto Tactics · einoow.com</a>`;
}

function statusHtml(state) {
  if (state.copied !== null) {
    return state.copied.ok ? 'Code copié : colle-le dans Planificateur → Coller un code.'
      : `Copie refusée par le navigateur : sélectionne le code et copie-le.<br><code>${esc(state.advice?.code ?? '')}</code>`;
  }
  const p = state.planner;
  const code = state.advice?.code;
  if (!code) return '';
  if (p.code !== code) {
    return isPortrait()
      ? 'Planificateur non mis à jour en affichage portrait : copie le code et colle-le dans Planificateur → Coller un code.' : '';
  }
  return p.error ? `Planificateur non mis à jour (${esc(p.error)}) : copie le code et colle-le dans Planificateur → Coller un code.`
    : `Planificateur à jour : « ${esc(KT.PLAN_NAME)} » est le plan actif.`;
}

// Planificateur du jeu. La CSP du site (script-src 'self') oblige Violentmonkey à injecter le script en contexte content,
// d'où le store des plans est hors d'atteinte : le plan passe par l'interface, comme à la main (Coller un code). Les anciens
// plans du panneau (même nom) sont supprimés avant le collage, et rien n'est collé quand 10 plans restent : chaque collage
// crée un plan, et au-delà de 10 plans par mode le jeu évince le plus ancien non actif, qui serait un plan du joueur.
// Sélecteurs relevés dans le code du jeu (règles 41).
const PLANNER = {
  chip: '.pln-inbar .pln-chip',
  veil: '.pln-veil',
  input: '.pln-paste input',
  paste: '.pln-paste button',
  error: '.pln-err',
  item: '.pln-list li',
  name: '.pln-name',
  del: '.pln-btn.del',
};
const PLANNER_MAX_PLANS = 10;
const PLANNER_WAIT_MS = 3000;
// Le premier affichage charge le module du Planificateur à la demande.
const PLANNER_OPEN_MS = 10000;
// Interface du jeu différente de celle relevée : affichée dans le panneau, le bouton Copier reste le recours.
class PlannerError extends Error {}
// En portrait, le bouton du Planificateur ouvre un menu au lieu du Planificateur.
const isPortrait = () => document.documentElement.dataset.layout === 'portrait';
// Requête dans le Planificateur ouvert, refaite à chaque fois : React a pu remplacer les nœuds entre deux étapes.
const inPlanner = sel => document.querySelector(`${PLANNER.veil} ${sel}`);

// Attend que test() rende une valeur vraie, vérifiée à chaque image ; rejette avec message après ms.
function waitFor(test, message, ms = PLANNER_WAIT_MS) {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const v = test();
      if (v) resolve(v);
      else if (performance.now() - start > ms) reject(new PlannerError(message));
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

// Colle code dans le Planificateur de la partie affichée, dont hud est la barre de progression. Rend false sans rien toucher
// quand ce n'est pas le moment : pas de partie de ce mode à l'écran, modale du jeu ou Planificateur déjà ouverts, écran
// portrait. Rejette avec PlannerError si l'interface du jeu ne répond pas comme prévu ou si 10 plans du joueur remplissent
// déjà le mode. Le Planificateur est refermé et le focus rendu.
async function pastePlan(code, hud) {
  const chip = document.querySelector(PLANNER.chip);
  if (!document.querySelector(hud) || !chip || document.querySelector(PLANNER.veil) || document.querySelector('.modal')
    || isPortrait()) return false;
  // Le Planificateur prend le focus à l'ouverture et ne le rend pas.
  const back = document.activeElement;
  chip.click();
  try {
    await waitFor(() => document.querySelector(PLANNER.veil), 'le Planificateur ne s’ouvre pas', PLANNER_OPEN_MS);
    const items = () => [...document.querySelectorAll(`${PLANNER.veil} ${PLANNER.item}`)];
    const stale = () => items().find(li => li.querySelector(PLANNER.name)?.textContent === KT.PLAN_NAME);
    for (let li = stale(); li; li = stale()) {
      const del = li.querySelector(PLANNER.del);
      if (!del) throw new PlannerError('bouton Supprimer introuvable');
      del.click();
      await waitFor(() => !li.isConnected, 'ancien plan non supprimé');
    }
    if (items().length >= PLANNER_MAX_PLANS) throw new PlannerError(`${PLANNER_MAX_PLANS} plans déjà enregistrés dans ce mode, supprimes-en un`);
    const field = await waitFor(() => inPlanner(PLANNER.input), 'champ Coller un code introuvable');
    // Setter natif : le même dans les deux contextes d'injection, sans passer par celui que React pose sur le champ.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, code);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const button = await waitFor(() => !inPlanner(PLANNER.paste)?.disabled && inPlanner(PLANNER.paste), 'bouton Coller un code introuvable');
    button.click();
    // Le jeu ne vide le champ que si le code est accepté.
    const pasted = await waitFor(() => (inPlanner(PLANNER.error) ? 'refusé' : inPlanner(PLANNER.input)?.value === '' && 'collé'), 'collage sans réponse');
    if (pasted === 'refusé') throw new PlannerError('code refusé par le jeu');
  } finally {
    // Un clic sur le voile lui-même ferme le Planificateur ; cherché à nouveau, React a pu remplacer le nœud.
    document.querySelector(PLANNER.veil)?.click();
    back?.focus?.({ preventScroll: true });
  }
  return true;
}

// Tente code une seule fois dans le Planificateur, même en échec, pour ne pas le rouvrir toutes les 2 s : l'erreur reste dans
// planner jusqu'au prochain changement de compo. Rend true quand planner a changé. Une erreur autre que PlannerError (bug du
// script) est notée puis relancée.
async function syncPlanner(planner, code, paste) {
  if (!code || code === planner.code || planner.running) return false;
  planner.running = true;
  let pasted;
  try {
    pasted = await paste(code);
    planner.error = null;
  } catch (e) {
    planner.error = e.message;
    if (!(e instanceof PlannerError)) throw e;
    console.warn('kanto-overlay : Planificateur', e);
  } finally {
    planner.running = false;
    if (pasted !== false) planner.code = code;
  }
  return pasted !== false;
}

// Pastilles : nœuds de l'overlay posés sur les éléments du jeu, jamais insérés dans le jeu (un clic n'y achète rien). hud() :
// barre de progression du mode de la partie conseillée ; sans elle à l'écran, les pastilles sont masquées.
function pinLayer(layer, hud) {
  let lastPins = null;
  let pins = [];
  // show : niveaux affichés (option Pastilles), { do, opt, no } → booléen.
  function paint(a, show) {
    const sig = JSON.stringify([show, a && Object.keys(TARGETS).map(g => a[g])]);
    if (sig === lastPins) {
      position();
      return;
    }
    lastPins = sig;
    layer.replaceChildren();
    pins = [];
    if (!a) return;
    let n = 0;
    for (const [group, t] of Object.entries(TARGETS)) {
      const marks = Array.isArray(a[group]) ? a[group] : [a[group]];
      marks.forEach((m, i) => {
        if (!m || !m.label || !show[m.level]) return;
        const pin = document.createElement('span');
        pin.className = `kp kp-${m.level}`;
        pin.tabIndex = 0;
        pin.setAttribute('role', 'note');
        const tipId = `kp-tip-${n++}`;
        pin.setAttribute('aria-describedby', tipId);
        pin.innerHTML = `${SYM[m.level]} <span class="kp-text">${esc(m.label)}</span><span class="kp-tip" id="${tipId}" role="tooltip"><strong>${esc(m.title)}</strong>${esc(m.why)}${m.detail ? `<span class="m">${esc(m.detail)}</span>` : ''}</span>`;
        pin.addEventListener('mouseleave', () => pin.matches(':focus') || pin.classList.remove('is-dismissed'));
        pin.addEventListener('blur', () => pin.matches(':hover') || pin.classList.remove('is-dismissed'));
        layer.append(pin);
        pins.push({ pin, t, i });
      });
    }
    position();
  }

  function position() {
    const shown = document.querySelector(hud()) !== null;
    const modal = document.querySelector('.modal') !== null;
    const found = new Map();
    for (const { pin, t, i } of pins) {
      if (!found.has(t.sel)) found.set(t.sel, [...document.querySelectorAll(t.sel)]);
      const all = found.get(t.sel);
      const el = t.by ? all.find(e => t.by(e, i)) : all[i];
      const r = el?.getBoundingClientRect();
      const show = shown && t.modal === modal && r !== undefined && r.width > 0 && r.height > 0;
      pin.hidden = !show;
      if (!show) continue;
      pin.style.left = `${r.left + r.width / 2}px`;
      pin.style.top = `${Math.max(0, r.top - 12)}px`;
      pin.classList.toggle('is-below', r.top < window.innerHeight / 2);
      pin.classList.toggle('is-compact', r.width < COMPACT_BELOW);
      const x = r.left + r.width / 2;
      pin.classList.toggle('is-left', x < TIP_HALF);
      pin.classList.toggle('is-right', x > window.innerWidth - TIP_HALF);
    }
  }

  return { paint, position };
}

// Sources indépendantes : sans data.json ou lang.json, le prochain boss et les trios restent affichés. campana.json est
// accepté avec la Tour seule : sans modes.camp valide, la campagne n'a que les conseils d'économie.
const SOURCE_FILES = [
  ['stats', 'campana.json', KT.SOURCES.stats, j => KT.isStatsData(j?.modes?.torre),
    j => ({ torre: j.modes.torre, camp: KT.isStatsData(j.modes.camp) ? j.modes.camp : null })],
  ['data', 'data.json', KT.SOURCES.data, KT.isGameData, j => j],
  ['lang', 'lang.json', KT.SOURCES.lang, KT.isLang, j => j],
];

// Champs de l'état tirés du chargement : results, issus de Promise.allSettled sur loadJson, dans l'ordre de SOURCE_FILES.
function sourcesState(results) {
  const loaded = { stats: null, data: null, lang: null, failed: [], uncached: false };
  const errors = [];
  const stale = [];
  results.forEach((r, i) => {
    const [key, file, , , pick] = SOURCE_FILES[i];
    if (r.status === 'rejected') {
      loaded.failed.push(key);
      errors.push(`${file} : ${r.reason.message}`);
      return;
    }
    loaded[key] = pick(r.value.json);
    if (r.value.stale) stale.push(r.value.at);
    if (r.value.uncached) loaded.uncached = true;
  });
  return {
    ...loaded, campBroken: loaded.stats !== null && !loaded.stats.camp, error: errors.length ? errors.join(' ; ') : null,
    stale: stale.length ? Math.min(...stale) : null,
  };
}

async function loadSources(state) {
  const env = { caches: globalThis.caches, fetch: (...a) => fetch(...a), now: Date.now() };
  const results = await Promise.allSettled(SOURCE_FILES.map(([, , url, accept]) => KT.loadJson(url, accept, env)));
  Object.assign(state, sourcesState(results));
}

// Gabarit du panneau et calque des pastilles. Au montage, les parties sont vides et render les remplit ; les pages d'aperçu le
// remplissent elles-mêmes et le rendent sans script. look : attributs data-* lus par les jetons CSS (applyLook) ; opts : HTML
// du menu ouvert, null s'il est fermé ; floor : étage ou combat affiché, null sans partie.
function shellHtml({ look = {}, label = 'Étage', floor = null, src = '', sum = '', alert = '', opts = null, body = '', status = '', foot = '', collapsed = false } = {}) {
  const data = Object.entries(look).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const panel = ['kt', collapsed && 'is-collapsed', opts !== null && 'is-menu'].filter(Boolean).join(' ');
  return `<style>${CSS}</style>
<div class="kt-root"${data}>
<div class="${panel}" role="complementary" aria-label="Aide Kanto Tactics">
  <div class="kt-bar">
    <span class="kt-lbl">${esc(label)}</span>
    <span class="kt-stepper"><button data-act="dec" aria-label="${esc(label)} précédent">−</button><input class="kt-floor${floor ? '' : ' is-empty'}" inputmode="numeric" aria-label="${esc(label)} courant" placeholder="?"${floor ? ` value="${floor}"` : ''}><button data-act="inc" aria-label="${esc(label)} suivant">+</button></span>
    <span class="kt-src">${esc(src)}</span>
    <span class="kt-sum">${sum}</span>
    <span class="kt-sp"></span>
    <button class="kt-ibtn" data-act="menu" aria-label="Options" aria-expanded="${opts !== null}" aria-controls="kt-opts">${ICON.gear}</button>
    <button class="kt-ibtn" data-act="toggle" data-collapsed="${collapsed}" aria-label="${collapsed ? 'Déplier le panneau' : 'Replier le panneau'}" aria-expanded="${!collapsed}">${collapsed ? ICON.down : ICON.up}</button>
  </div>
  <div class="kt-alert" role="alert">${alert}</div>
  <form class="kt-opts" id="kt-opts" aria-label="Options"${opts === null ? ' hidden' : ''}>${opts ?? ''}</form>
  <div class="kt-body">${body}</div>
  <p class="kt-status" role="status">${status}</p>
  <div class="kt-foot"${foot ? '' : ' hidden'}>${foot}</div>
</div>
<div class="kp-layer"></div>
</div>`;
}

// Combat en cours (sauvegarde, partie et étage) : les assassins adverses cochés (ui.dive) ne valent que pour lui.
const fightKey = state => `${state.saveKey}:${state.save?.runSeed ?? ''}:${state.floor}`;
const diveOn = (ui, state) => ui.dive === fightKey(state);
// Réglages du panneau hors options du menu (checkUi les complète) : position, replié, sections ouvertes, conseil précédent
// (target, rememberedTarget), combat aux assassins adverses.
const UI_DEFAULTS = { x: null, y: 16, collapsed: false, avoid: false, aims: true, target: null, dive: null };

// Conseils de la partie à l'écran : null hors de l'étage de sa sauvegarde, ou tant qu'aucune source n'a répondu. ui.target :
// le conseil précédent, pour l'inertie des trios et des compléments.
function adviceOf(state, ui) {
  return onSaveFloor(state) && (state.stats || state.error)
    ? KT.advise({ stats: modeStats(state), data: state.data, lang: state.lang, save: state.save, previous: ui.target, side: ui.side, mode: state.mode, dive: diveOn(ui, state) })
    : null;
}

// ui.target après le conseil a : trio et compléments de la compo cible, trio de la compo suivante et partie, gardés pour
// l'inertie du conseil suivant. Renvoie target lui-même s'il ne change pas (rien à réécrire dans le stockage) ou sans compo cible.
function rememberedTarget(a, target) {
  if (!a?.target) return target;
  const next = { key: a.target.key, run: a.run, next: a.next?.key ?? null, fillers: a.target.fillers };
  const same = ['key', 'run', 'next'].every(k => next[k] === target?.[k]) && next.fillers.join('+') === target.fillers?.join('+');
  return same ? target : next;
}

function mount() {
  const ui = { ...UI_DEFAULTS, ...JSON.parse(localStorage.getItem(KT.UI_KEY) ?? '{}') };
  KT.checkUi(ui);
  const state = { floor: null, source: 'manuel', lastRaw: undefined, lastAuto: undefined, save: null, saveKey: undefined, mode: KT.withStrategy(KT.TOWER_MODE, ui), unsupported: false, stats: null, campBroken: false, data: null, lang: null, failed: [], error: null, stale: null, uncached: false, advice: null, fights: KT.readJournal(localStorage.getItem(KT.JOURNAL_KEY)), copied: null, planner: { code: null, error: null, running: false } };

  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = shellHtml();
  document.body.append(host);
  const look = root.querySelector('.kt-root');
  const panel = root.querySelector('.kt');
  const opts = root.querySelector('.kt-opts');
  const menu = root.querySelector('[data-act="menu"]');
  const summary = root.querySelector('.kt-sum');
  const layer = root.querySelector('.kp-layer');
  const input = root.querySelector('.kt-floor');
  const body = root.querySelector('.kt-body');
  const foot = root.querySelector('.kt-foot');
  const toggle = root.querySelector('[data-act="toggle"]');
  const src = root.querySelector('.kt-src');
  const status = root.querySelector('.kt-status');
  const alertBox = root.querySelector('.kt-alert');
  const pins = pinLayer(layer, () => state.mode.hud);
  const label = root.querySelector('.kt-lbl');
  const steps = { dec: root.querySelector('[data-act="dec"]'), inc: root.querySelector('[data-act="inc"]') };

  let lastHtml = null;
  let lastSummary = '';
  let menuOpen = false;
  let lastStatus = '';
  let lastAlert = '';
  let lastFoot = '';

  const saveUi = () => localStorage.setItem(KT.UI_KEY, JSON.stringify(ui));

  // Thème, largeur, taille du texte et opacité : attributs lus par les jetons CSS ; « auto » suit le système.
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  function applyLook() {
    look.dataset.scheme = ui.theme === 'auto' ? (dark.matches ? 'dark' : 'light') : ui.theme;
    look.dataset.width = ui.width;
    look.dataset.text = ui.text;
    look.dataset.alpha = ui.alpha;
  }
  dark.addEventListener('change', applyLook);

  // Ancré à droite tant que le panneau n'a pas été déplacé, puis gardé dans la fenêtre.
  function place() {
    panel.style.top = `${Math.max(0, Math.min(ui.y, window.innerHeight - 40))}px`;
    if (ui.x === null) {
      panel.style.left = '';
      panel.style.right = '16px';
      return;
    }
    panel.style.right = 'auto';
    panel.style.left = `${Math.max(0, Math.min(ui.x, window.innerWidth - panel.offsetWidth))}px`;
  }

  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      pins.position();
    });
  };

  function compute() {
    const code = state.advice?.code;
    state.advice = adviceOf(state, ui);
    // Case d'un autre combat oubliée : une sauvegarde sans runSeed la retrouverait au même étage d'une autre partie.
    if (state.advice && ui.dive !== null && !diveOn(ui, state)) {
      ui.dive = null;
      saveUi();
    }
    if (state.advice?.code !== code) state.copied = null;
    const target = rememberedTarget(state.advice, ui.target);
    if (target !== ui.target) {
      ui.target = target;
      saveUi();
    }
  }

  function render() {
    panel.classList.toggle('is-collapsed', ui.collapsed);
    panel.classList.toggle('is-menu', menuOpen);
    opts.hidden = !menuOpen;
    menu.setAttribute('aria-expanded', String(menuOpen));
    if (toggle.dataset.collapsed !== String(ui.collapsed)) {
      toggle.dataset.collapsed = String(ui.collapsed);
      toggle.innerHTML = ui.collapsed ? ICON.down : ICON.up;
    }
    toggle.setAttribute('aria-label', ui.collapsed ? 'Déplier le panneau' : 'Replier le panneau');
    toggle.setAttribute('aria-expanded', String(!ui.collapsed));
    src.textContent = state.source;
    if (label.textContent !== state.mode.label) {
      label.textContent = state.mode.label;
      input.setAttribute('aria-label', `${state.mode.label} courant`);
      steps.dec.setAttribute('aria-label', `${state.mode.label} précédent`);
      steps.inc.setAttribute('aria-label', `${state.mode.label} suivant`);
    }
    if (root.activeElement !== input) input.value = state.floor ?? '';
    input.classList.toggle('is-empty', !state.floor);
    // Réécrire seulement ce qui change : un focus ou une bulle ouverte survit aux réécritures de la sauvegarde.
    const html = panelHtml(state, ui);
    if (html !== lastHtml) {
      // Le focus clavier (onglet, sections repliables, bouton Copier) et le défilement de l'onglet survivent à la réécriture,
      // qui suit chaque changement de la sauvegarde.
      const focused = body.contains(root.activeElement) ? root.activeElement.id : '';
      const scrolled = body.querySelector('.kt-panel')?.scrollTop ?? 0;
      body.innerHTML = html;
      lastHtml = html;
      if (focused) root.getElementById(focused)?.focus();
      const panelEl = body.querySelector('.kt-panel');
      if (panelEl) panelEl.scrollTop = scrolled;
    }
    const sum = summaryHtml(state);
    if (sum !== lastSummary) {
      summary.innerHTML = sum;
      lastSummary = sum;
    }
    const alert = alertHtml(state);
    if (alert !== lastAlert) {
      alertBox.innerHTML = alert;
      lastAlert = alert;
    }
    foot.hidden = !modeStats(state);
    if (!foot.hidden) {
      const footer = footHtml(state);
      if (footer !== lastFoot) {
        foot.innerHTML = footer;
        lastFoot = footer;
      }
    }
    const statusText = statusHtml(state);
    if (statusText !== lastStatus) {
      status.innerHTML = statusText;
      lastStatus = statusText;
    }
    place();
    pins.paint(state.advice, ui.pins);
  }

  // Le voile du Planificateur couperait un geste en cours sur le plateau ou le focus posé dans le panneau. Sans pointerup
  // (relâché hors de la fenêtre), la perte de focus de la fenêtre libère le drapeau.
  let pointerHeld = false;
  window.addEventListener('pointerdown', () => { pointerHeld = true; }, true);
  for (const type of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(type, () => { pointerHeld = false; }, true);
  function plannerTick() {
    if (pointerHeld || root.activeElement !== null) return;
    syncPlanner(state.planner, state.advice?.code, code => pastePlan(code, state.mode.hud)).then(changed => changed && render(), err => {
      render();
      throw err;
    });
  }

  function setManual(floor) {
    state.floor = Number.isInteger(floor) && floor >= 1 ? floor : null;
    state.source = 'manuel';
    compute();
    render();
  }

  // Partie du mode à l’écran (la plus récente à l’accueil) : la Tour, Kanto ou une autre aventure ; le Nuzlocke n’a pas de conseils.
  // Sauvegardes déjà lues (latestSave) ; mode à l'écran gardé quand la barre du haut disparaît le temps d'un combat ou d'une
  // modale, sinon le panneau basculerait sur la sauvegarde la plus récente de tous les modes.
  const saves = new Map();
  let shown = null;
  function pollSave() {
    const now = KT.shownMode(document) ?? shown;
    const found = KT.latestSave(localStorage, now, saves);
    const raw = found?.raw ?? null;
    if (raw === state.lastRaw && now === shown) return;
    shown = now;
    state.lastRaw = raw;
    const fight = KT.notedFight({
      save: state.save, advice: state.advice, stats: modeStats(state),
      afterRaw: state.saveKey ? localStorage.getItem(state.saveKey) : null, runsRaw: localStorage.getItem(KT.TOWER_RUNS_KEY),
    });
    if (fight) {
      // Journal relu avant l'ajout : un autre onglet du jeu a pu y écrire.
      state.fights = KT.addFight(KT.readJournal(localStorage.getItem(KT.JOURNAL_KEY)), fight);
      try {
        localStorage.setItem(KT.JOURNAL_KEY, JSON.stringify(state.fights));
      } catch (e) {
        // Stockage plein ou refusé : le combat compte jusqu'au suivant, qui relit le journal ; la lecture de la sauvegarde continue.
        if (!(e instanceof DOMException)) throw e;
        console.warn('kanto-overlay : journal des combats non écrit', e.name);
      }
    }
    Object.assign(state, KT.pollState(state, found, shown, ui, state.fights));
    compute();
    render();
  }

  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'dec') setManual(Math.max(1, (state.floor ?? 2) - 1));
    if (act === 'inc') setManual((state.floor ?? 0) + 1);
    if (act === 'toggle') collapse();
    if (act === 'menu') {
      menuOpen = !menuOpen;
      if (menuOpen) opts.innerHTML = optionsHtml(ui);
      render();
    }
    if (act === 'tab') showTab(e.target.closest('[data-tab]').dataset.tab);
    if (act === 'copy' && state.advice?.code) {
      navigator.clipboard.writeText(state.advice.code).then(() => {
        // Vider puis réécrire : un lecteur d'écran n'annonce pas un statut dont le texte ne change pas.
        status.textContent = '';
        lastStatus = '';
        state.copied = { ok: true };
        requestAnimationFrame(render);
      }, () => {
        state.copied = { ok: false };
        render();
      });
    }
  });
  input.addEventListener('change', () => setManual(Number.parseInt(input.value, 10)));
  // Replier ferme aussi le menu : déplié, le panneau revient aux onglets.
  function collapse() {
    ui.collapsed = !ui.collapsed;
    menuOpen = false;
    saveUi();
    render();
  }
  // Échap dans le menu ou sur le bouton ⚙ le ferme et rend le focus au bouton.
  for (const el of [opts, menu]) {
    el.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !menuOpen) return;
      e.stopPropagation();
      menuOpen = false;
      render();
      menu.focus();
    });
  }
  // Onglet choisi gardé entre deux sessions.
  function showTab(tab) {
    ui.tab = tab;
    saveUi();
    render();
  }
  // Onglets au clavier (motif ARIA tablist) : flèches, Début et Fin.
  panel.addEventListener('keydown', e => {
    if (!e.target.matches('[role="tab"]')) return;
    const tab = tabForKey(e.key, ui.tab);
    if (tab === undefined) return;
    e.preventDefault();
    showTab(tab);
    root.getElementById(`kt-tab-${tab}`).focus();
  });
  opts.addEventListener('change', e => {
    const { name } = e.target;
    setOption(ui, e.target);
    saveUi();
    applyLook();
    const strategic = KT.STRATEGY.some(o => o.key === name);
    if (strategic) state.mode = KT.withStrategy(state.mode, ui);
    if (name === 'side' || strategic) compute();
    render();
  });
  opts.addEventListener('submit', e => e.preventDefault());
  body.addEventListener('change', e => {
    if (e.target.name !== 'dive') return;
    ui.dive = e.target.checked ? fightKey(state) : null;
    saveUi();
    compute();
    render();
  });
  // Le Shadow DOM ne fait que recibler les événements : sans cet arrêt, les écouteurs du jeu en remontée recevraient
  // les chiffres tapés et les flèches des onglets et des options. Alt+K passe, pour replier le panneau depuis un champ.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    panel.addEventListener(type, e => {
      let on = null;
      if (e.target.matches('input')) on = 'input';
      else if (e.target.matches('[role="tab"]')) on = 'tab';
      if (keptByPanel(on, e)) e.stopPropagation();
    });
  }
  root.addEventListener('toggle', e => {
    const key = foldKey(e.target.classList);
    if (!key || ui[key] === e.target.open) return;
    ui[key] = e.target.open;
    saveUi();
  }, true);
  // Échap ferme la bulle (WCAG 1.4.13) ; sur une pastille sélectionnée, la touche ne remonte pas au jeu (modales).
  layer.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !e.target.closest('.kp')) return;
    e.target.closest('.kp').classList.add('is-dismissed');
    e.stopPropagation();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      for (const pin of layer.querySelectorAll('.kp:hover')) pin.classList.add('is-dismissed');
      return;
    }
    if (!e.altKey || e.code !== 'KeyK') return;
    e.preventDefault();
    collapse();
  });
  window.addEventListener('resize', () => {
    place();
    schedule();
  });
  window.addEventListener('scroll', schedule, true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  const bar = root.querySelector('.kt-bar');
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button, input')) return;
    const dx = e.clientX - panel.offsetLeft;
    const dy = e.clientY - panel.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      ui.x = ev.clientX - dx;
      ui.y = ev.clientY - dy;
      place();
    };
    bar.addEventListener('pointermove', move);
    // Fin du glisser, relâché ou annulé.
    bar.addEventListener('lostpointercapture', () => {
      bar.removeEventListener('pointermove', move);
      saveUi();
    }, { once: true });
  });
  // Alternative au glisser (WCAG 2.5.7) : double-clic sur la barre → panneau remis en haut à droite.
  bar.addEventListener('dblclick', e => {
    if (e.target.closest('button, input')) return;
    ui.x = null;
    ui.y = 16;
    saveUi();
    place();
  });

  applyLook();
  render();
  pollSave();
  setInterval(() => {
    pollSave();
    plannerTick();
  }, 2000);

  loadSources(state).then(() => {
    compute();
    render();
  }).catch(err => {
    // Erreur de traitement (pas de chargement) : affichée plutôt que de laisser « Chargement… » indéfiniment.
    state.error = `traitement : ${err.message}`;
    render();
  });
}

// Les tests et l'aperçu reçoivent aussi le pilote du Planificateur (joué sur un faux DOM), le rendu et les événements du panneau.
if (typeof module !== 'undefined') {
  module.exports = {
    ...KT, pastePlan, syncPlanner, statusHtml, tabsHtml, headHtml, panelHtml, alertHtml, optionsHtml, summaryHtml, footHtml, shellHtml,
    PlannerError, tabForKey, keptByPanel, foldKey, setOption, diveHtml, fightKey, diveOn, UI_DEFAULTS, modeStats, adviceOf, rememberedTarget,
    SOURCE_FILES, sourcesState,
  };
} else mount();
