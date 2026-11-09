// ==UserScript==
// @name         Kanto Tactics — panneau Tour
// @namespace    https://github.com/Gwagwa42/kanto-overlay
// @version      2.0.0
// @description  Tour de combat de Kanto Tactics : prochain boss, meilleurs trios, et conseils d'achat, d'objets, de formation et de bénédictions lus sur ta partie (données publiques einoow.com).
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
  const API = 'https://einoow.com/api/meta/kanto/';
  const SOURCES = { torre: `${API}campana.json`, data: `${API}data.json`, lang: `${API}lang.json?lang=fr` };
  const CACHE_NAME = 'kt-overlay';
  // Conditions de l'API : au plus une requête par heure, avec un cache côté client.
  const CACHE_MAX_AGE = 3600 * 1000;
  const SAVE_KEY = 'kanto-tactics-save-tower';
  const UI_KEY = 'kt-overlay:ui';
  // Nom du plan dans le Planificateur du jeu : il distingue le plan du panneau des plans du joueur.
  const PLAN_NAME = 'Plan kanto-overlay';
  // Le jeu numérote les manches de la Tour à partir de 1000 : étage = round − 1000 + 1 (assets/route-*.js).
  const ROUND_BASE = 1000;
  const MIN_FIGHTS = 20;
  const HARD_WIN = 45;
  const LOW_HP = 40;
  // Compo cible : combats vus d'avance (≈ 20 étages, élites comprises) et gain minimal pour changer de trio.
  const HORIZON = 9;
  const INERTIA = 30;
  // Par Pokémon possédé (+10, puis +10 à ★★) : un trio monté en ★★ (+60) l'emporte sur l'inertie.
  const OWNED_BONUS = 10;
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
  const MAX_ITEMS = 3;
  // Composants défensifs ; Protéine (Attaque), Calcium (Atq. Spé.) et Carbone (vitesse d'attaque) sont offensifs.
  const DEFENSE = ['hp-up', 'iron', 'zinc'];
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
  // (route-*.js, roster) : utilisées seulement quand data.json ne connaît pas la lignée.
  const LINES_V41 = {
    bellsprout: { c: 2, t: ['grass', 'poison'], s: [69, 70, 71], range: 1 },
    clefairy: { c: 2, t: ['normal'], s: [35, 36], range: 3 },
    doduo: { c: 2, t: ['normal', 'flying'], s: [84, 85], range: 1 },
    drowzee: { c: 3, t: ['psychic'], s: [96, 97], range: 3 },
    farfetchd: { c: 2, t: ['normal', 'flying'], s: [83], range: 1 },
    goldeen: { c: 1, t: ['water'], s: [118, 119], range: 1 },
    grimer: { c: 3, t: ['poison'], s: [88, 89], range: 1 },
    horsea: { c: 2, t: ['water'], s: [116, 117], range: 3 },
    kabuto: { c: 4, t: ['rock', 'water'], s: [140, 141], range: 1 },
    kangaskhan: { c: 4, t: ['normal'], s: [115], range: 1 },
    koffing: { c: 2, t: ['poison'], s: [109, 110], range: 3 },
    krabby: { c: 1, t: ['water'], s: [98, 99], range: 1 },
    lickitung: { c: 3, t: ['normal'], s: [108], range: 1 },
    mankey: { c: 1, t: ['fighting'], s: [56, 57], range: 1 },
    meowth: { c: 2, t: ['normal'], s: [52, 53], range: 1 },
    mrmime: { c: 3, t: ['psychic'], s: [122], range: 3 },
    nidoranf: { c: 1, t: ['poison', 'ground'], s: [29, 30, 31], range: 1 },
    omanyte: { c: 4, t: ['rock', 'water'], s: [138, 139], range: 3 },
    pinsir: { c: 3, t: ['bug'], s: [127], range: 1 },
    porygon: { c: 3, t: ['normal'], s: [137], range: 3 },
    spearow: { c: 1, t: ['normal', 'flying'], s: [21, 22], range: 1 },
    tangela: { c: 3, t: ['grass'], s: [114], range: 1 },
    tentacool: { c: 3, t: ['water', 'poison'], s: [72, 73], range: 3 },
    venonat: { c: 2, t: ['bug', 'poison'], s: [48, 49], range: 3 },
  };
  const lineInfo = (data, base) => data?.lines[base] ?? LINES_V41[base];

  // Conseils du guide (non vérifiés) par tranche d'étages.
  const GUIDE = [
    { to: 40, shinies: ['Bulbizarre', 'Mystherbe', 'Chétiflor', 'Nidorino', 'Amonita'], advice: 'Les prendre quand ils passent, sans actualiser exprès.' },
    { to: 80, shinies: ['Minidraco', 'Ptéra', 'Nidorino', 'Amonita'], advice: 'Priorité à ceux qui complètent l’équipe.' },
    { to: 120, shinies: ['Leveinard', 'Minidraco', 'Kabuto', 'Lokhlass', 'Kokiyas'], advice: 'Acheter seulement si l’économie reste saine.' },
    { to: 160, shinies: ['Ptéra', 'Leveinard', 'Minidraco'], advice: 'Un shiny hors composition ne mérite plus d’investissement.' },
    { to: Infinity, shinies: [], advice: 'Aucun farming de shinies : victoire et survie avant la collection.' },
  ];
  const GOLD_RULES = [
    'Intérêts : +1 pièce par tranche de 10, +3 au plus en Tour → garder 30 pièces (+2 avec la voie Fortune complète).',
    'Actualisation à 2 pièces : ne pas en enchaîner pour un shiny.',
    'Dépenser avant un boss difficile, reconstituer après une victoire facile.',
  ];

  const isObject = o => o !== null && typeof o === 'object' && !Array.isArray(o);

  // Sauvegarde avec un round numérique (assez pour l'étage), sinon null.
  function parseRound(raw) {
    if (raw == null) return null;
    let save;
    try {
      save = JSON.parse(raw);
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw e;
    }
    return isObject(save) && Number.isFinite(save.round) ? save : null;
  }

  // Forme lue par readGame ; sinon autre version de sauvegarde, sans conseils (l'étage reste lu par floorFromSave).
  function parseSave(raw) {
    const save = parseRound(raw);
    return save && isObject(save.units) && isObject(save.board ?? {}) && Array.isArray(save.bench ?? []) ? save : null;
  }

  const floorOf = round => Math.max(1, Math.floor(round) - ROUND_BASE + 1);
  const coreKey = core => [...core].sort().join('+');

  function floorFromSave(raw) {
    const save = parseRound(raw);
    return save && floorOf(save.round);
  }

  function parseStop(stop) {
    const [floor, boss] = stop.split(':');
    return { floor: Number(floor), boss };
  }

  // Forme minimale de .modes.torre dont dépend le panneau ; sinon le format de l'API a changé.
  function isTowerData(t) {
    return Array.isArray(t?.stops) && Array.isArray(t.cores) && Array.isArray(t.lines) && Array.isArray(t.holders)
      && typeof t.from === 'string' && typeof t.to === 'string' && Number.isFinite(t.rules)
      && t.stops.every(s => typeof s?.stop === 'string' && /^\d+:\w+$/.test(s.stop) && [s.win, s.first, s.tries].every(Number.isFinite))
      && t.stops.some(s => !s.stop.endsWith(':elite'))
      && t.cores.every(c => typeof c?.stop === 'string' && Array.isArray(c.core) && [c.n, c.win, c.lo].every(Number.isFinite))
      && t.lines.every(l => typeof l?.line === 'string' && Number.isFinite(l.lo))
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

  function lastBossFloor(stops) {
    return Math.max(...stops.map(s => parseStop(s.stop)).filter(p => p.boss !== 'elite').map(p => p.floor));
  }

  function nextBossStop(stops, floor) {
    let best = null;
    for (const s of stops) {
      const p = parseStop(s.stop);
      if (p.boss === 'elite' || p.floor < floor) continue;
      if (!best || p.floor < best.floor) best = { ...s, ...p };
    }
    return best;
  }

  // Les n prochains combats notés (élites comprises), pondérés par leur difficulté.
  function nextStops(stops, floor, n = 3) {
    return stops.map(s => ({ ...s, ...parseStop(s.stop) }))
      .filter(s => s.floor >= floor)
      .sort((a, b) => a.floor - b.floor)
      .slice(0, n)
      .map(s => ({ ...s, weight: Math.max(1, 100 - s.win) }));
  }

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

  const bossName = id => BOSSES[id] ?? id;

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

  // État de partie normalisé à partir de la sauvegarde Tour (format v11).
  function readGame(save) {
    const placed = [...Object.entries(save.board ?? {}).map(([cell, id]) => ({ id, cell: Number(cell) })),
      ...(save.bench ?? []).map((id, slot) => ({ id, slot })).filter(p => p.id)];
    const units = placed.map(p => ({ ...save.units[p.id], ...p })).filter(u => typeof u.line === 'string');
    return {
      floor: floorOf(save.round),
      gold: save.gold, level: save.level, xp: save.xp, hp: save.hp,
      units,
      bench: save.bench ?? [],
      shop: save.shop ?? [],
      shopShiny: save.shopShiny ?? [],
      bag: save.items ?? [],
      reward: Array.isArray(save.itemReward) ? save.itemReward : [],
      boons: save.tower?.boons ?? [],
      offer: save.tower?.offer?.ids ?? [],
      anchor: save.anchor ?? {},
    };
  }

  const unitsOf = (game, base) => game.units.filter(u => baseLine(u.line) === base);
  const bestStar = (game, base) => Math.max(0, ...unitsOf(game, base).map(u => u.star));
  // Lignée shiny : sa copie de meilleure étoile l'est (celle que décrivent la progression et le code KT1).
  const shinyLine = (game, base) => unitsOf(game, base).some(u => u.shiny && u.star === bestStar(game, base));
  const ones = (game, base) => unitsOf(game, base).filter(u => u.star === 1).length;
  const pathCount = (boons, path) => boons.filter(b => boonPath(b) === path).length;

  function goldFloor(boons) {
    return 10 * (BASE_INTEREST + (pathCount(boons, 'fortune') >= PATH_SIZE ? FORTUNE_INTEREST : 0));
  }

  // « Tout jouer » : le combat de l'étage courant est un mur, ou les PV sont bas.
  function economy(game, stops) {
    const here = stops.find(s => s.floor === game.floor);
    const floor = goldFloor(game.boons);
    const allIn = game.hp < LOW_HP || (here !== undefined && here.win < HARD_WIN);
    const nextWall = stops.find(s => s.win < HARD_WIN) ?? null;
    return { gold: game.gold, floor, spend: allIn ? game.gold : Math.max(0, game.gold - floor), allIn, lowHp: game.hp < LOW_HP, nextWall };
  }

  function lineLo(torre, id) {
    return torre.lines.find(l => l.line === id)?.lo ?? torre.lines.find(l => l.line === baseLine(id))?.lo ?? 0;
  }

  function coreScore(core, stops, coresByStop, game) {
    const total = stops.reduce((s, st) => s + st.weight, 0);
    const key = coreKey(core);
    const stat = stops.reduce((s, st) => s + st.weight * (coresByStop.get(st.stop)?.get(key)?.lo ?? 0), 0) / total;
    const owned = core.reduce((s, id) => {
      const star = bestStar(game, baseLine(id));
      return s + (star >= 1 ? OWNED_BONUS : 0) + (star >= 2 ? OWNED_BONUS : 0) + (shinyLine(game, baseLine(id)) ? SHINY_BONUS : 0);
    }, 0);
    return stat + owned;
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

  // Meilleur trio sur une fenêtre de combats (+INERTIA pour le trio précédent), avec sa preuve : le trio sur le combat le plus
  // dur où il a des statistiques.
  function bestCore(torre, game, stops, previousKey) {
    if (!stops.length) return null;
    const coresByStop = new Map(stops.map(st => [st.stop, new Map(torre.cores
      .filter(c => c.stop === st.stop && c.n >= MIN_FIGHTS)
      .map(c => [coreKey(c.core), c]))]));
    const candidates = new Map();
    for (const m of coresByStop.values()) for (const [key, c] of m) candidates.set(key, c.core);
    if (!candidates.size) return null;
    let best = null;
    for (const [key, core] of candidates) {
      const score = coreScore(core, stops, coresByStop, game) + (key === previousKey ? INERTIA : 0);
      if (!best || score > best.score) best = { key, core: [...core], score };
    }
    const proof = [...stops].sort((a, b) => b.weight - a.weight)
      .map(st => ({ st, c: coresByStop.get(st.stop).get(best.key) })).find(x => x.c);
    return { key: best.key, core: best.core, stops, proof };
  }

  function targetComp(torre, data, game, previousKey) {
    const best = bestCore(torre, game, nextStops(torre.stops, game.floor, HORIZON), previousKey);
    if (!best) return null;
    const chosen = best.core.map(baseLine);
    const pool = [...new Set([...game.units.map(u => baseLine(u.line)), ...game.shop.filter(Boolean)])].filter(b => lineInfo(data, b));
    // Remplissage jusqu'au niveau : lignées qui apportent un type à la compo, les unités possédées d'abord ; la boutique ne
    // complète que les places restantes.
    const owned = b => Number(bestStar(game, b) > 0);
    const fillers = [];
    while (chosen.length < game.level) {
      const next = pool
        .filter(b => !chosen.includes(b) && traitGain(data, chosen, b) > 0)
        .sort((a, b) => owned(b) - owned(a) || traitGain(data, chosen, b) - traitGain(data, chosen, a)
          || bestStar(game, b) - bestStar(game, a) || Number(shinyLine(game, b)) - Number(shinyLine(game, a))
          || lineLo(torre, b) - lineLo(torre, a) || a.localeCompare(b))[0];
      if (!next) break;
      chosen.push(next);
      fillers.push(next);
    }
    return { ...best, fillers };
  }

  // Trio des 9 combats suivants (10 à 18), à préparer avec le surplus ; null s'il est déjà la compo cible.
  function nextComp(torre, game, target, previousKey) {
    const next = bestCore(torre, game, nextStops(torre.stops, game.floor, 2 * HORIZON).slice(HORIZON), previousKey);
    return next && next.key !== target.key ? next : null;
  }

  const floorRange = stops => `étages ${stops[0].floor}–${stops.at(-1).floor}`;

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

  // Marques de la boutique et or restant. Priorités : ★ (de gauche à droite), puis l'or réservé par reserve(or restant)
  // (l'XP conseillée), puis les ◆ de la compo cible, puis l'actualisation, puis les ◆ de la compo suivante (hors tout jouer).
  // short : un ★ a été rétrogradé faute d'or (déclenche « Vends »).
  function shopMarks(game, target, next, data, eco, names, reserve) {
    const core = target ? target.core.map(baseLine) : [];
    const wanted = targetBases(target);
    const later = nextBases(next);
    const proof = proofText(target?.proof, names);
    let left = game.gold;
    let short = false;
    const buy = (cost, name, why, detail = '') => {
      // Coût inconnu (données de jeu indisponibles) : le conseil ne peut pas vérifier l'or.
      if (cost !== undefined && cost > left) {
        short = true;
        return mark('opt', 'Si l’or', `Achète ${name} dès que possible`, `${why} ; il manque de l’or`, detail);
      }
      left -= cost ?? 0;
      return mark('do', 'Achète', `Achète ${name}`, why, detail);
    };
    const cards = game.shop.map((base, i) => base && {
      base, name: names.line(base), cost: lineInfo(data, base)?.c, triple: ones(game, base) === 2,
      inTarget: wanted.includes(base), inCore: core.includes(base), inNext: later.includes(base), shiny: game.shopShiny[i],
    });
    const marks = cards.map(c => {
      if (!c) return null;
      if (c.triple && (c.inTarget || !target)) {
        return buy(c.cost, c.name, c.inCore ? '3ᵉ copie, passe ★★ ; cœur de la compo cible' : '3ᵉ copie, passe ★★', c.inCore ? proof : '');
      }
      if (c.inCore) return buy(c.cost, c.name, 'cœur de la compo cible', proof);
      // +10 % tout de suite seulement si la carte devient la meilleure copie de sa lignée.
      if (c.shiny && c.inTarget && bestStar(game, c.base) <= 1 && !shinyLine(game, c.base)) return buy(c.cost, `${c.name} shiny`, '+10 % PV, défenses et dégâts');
      return undefined;
    });
    left -= reserve(left);
    cards.forEach((c, i) => {
      if (!c || marks[i] !== undefined) return;
      if (!target) {
        marks[i] = null;
        return;
      }
      const fits = c.cost !== undefined && (eco.allIn ? c.cost <= left : left - c.cost >= eco.floor);
      if ((c.inTarget || (c.triple && !c.inNext)) && fits) {
        left -= c.cost;
        marks[i] = mark('opt', 'Si l’or', `${c.name} si l’or reste ≥ ${eco.floor}`, c.triple ? '3ᵉ copie hors compo' : 'renforce le plateau de la compo');
      }
    });
    // L'actualisation conseillée (voir rerollMark) passe avant la compo suivante.
    const reroll = target && targetIncomplete(game, target) && left - REROLL_COST >= eco.floor ? REROLL_COST : 0;
    cards.forEach((c, i) => {
      if (!c || marks[i] !== undefined) return;
      if (c.inNext && !c.inTarget) {
        const range = floorRange(next.stops);
        const fits = c.cost !== undefined && left - c.cost >= eco.floor;
        if (!eco.allIn && fits && left - c.cost - reroll >= eco.floor) {
          left -= c.cost;
          marks[i] = mark('opt', 'Si l’or', `${c.name} si l’or reste ≥ ${eco.floor}`, `prépare la compo des ${range}`, proofText(next.proof, names));
          return;
        }
        let why = `compo des ${range} ; garde ${eco.floor} pièces pour les intérêts`;
        if (eco.allIn) why = 'tout jouer : l’or va à la compo cible';
        else if (fits) why = `compo des ${range} ; l’or va d’abord à l’actualisation pour la compo cible`;
        marks[i] = mark('no', 'Ignore', `Ignore ${c.name}`, why);
        return;
      }
      marks[i] = mark('no', 'Ignore', `Ignore ${c.name}`, c.inTarget ? `complément de la compo ; garde ${eco.floor} pièces pour les intérêts` : 'hors compo cible');
    });
    return { marks, left, short };
  }

  function targetIncomplete(game, target) {
    return target.core.some(id => bestStar(game, baseLine(id)) < 2);
  }

  // committed : or des achats ★ déjà conseillés dans la boutique, à retirer avant d'actualiser ou de monter.
  function rerollMark(game, target, eco, left) {
    if (!target || !targetIncomplete(game, target)) return null;
    if (eco.allIn) return left >= REROLL_COST ? mark('do', 'Actualise', 'Actualise', 'tout jouer : chercher les copies de la compo') : null;
    if (left - REROLL_COST >= eco.floor) return mark('do', 'Actualise', 'Actualise', `surplus au-dessus de ${eco.floor} pièces après les achats`);
    return mark('no', 'Garde l’or', 'N’actualise pas', `tu passerais sous ${eco.floor} pièces`);
  }

  // Renvoie la marque et l'or qu'elle engage.
  function xpMark(game, eco, left) {
    const max = game.floor >= 60 ? 10 : 9;
    if (game.level >= max) return { mark: null, cost: 0 };
    const missing = XP_TO_NEXT[game.level] - game.xp;
    const toLevel = Math.ceil(missing / XP_COST) * XP_COST;
    if (eco.allIn) {
      return left >= toLevel
        ? { mark: mark('do', 'Monte', 'Achète de l’XP', `tout jouer : niveau ${game.level + 1} pour ${toLevel} pièces`), cost: toLevel }
        : { mark: null, cost: 0 };
    }
    if (missing <= XP_COST && left - XP_COST >= eco.floor) {
      return { mark: mark('do', 'Monte', 'Achète de l’XP', `niveau ${game.level + 1} pour ${XP_COST} pièces`), cost: XP_COST };
    }
    return { mark: mark('no', 'Attends', 'N’achète pas d’XP', `encore ${missing} XP ; l’XP gratuite arrive à chaque étage`), cost: 0 };
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
      const shinyKept = u.shiny && game.floor <= SHINY_KEEP_TO;
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

  // Composants qui donnent ses stats à un objet : inherits de l'API, qui diffère parfois de la recette (Casque Brut : PV Plus +
  // Fer, recette PV Plus + Protéine) ; vide pour les objets Choix, dont la recette porte la stat.
  function itemParts(data, id) {
    const item = data.items[id];
    if (item?.k === 'part') return [id];
    if (item?.k !== 'full') return [];
    return item.inherits?.length ? item.inherits.flatMap(x => Array(x.n).fill(x.part)) : item.recipe ?? [];
  }

  // Profil de chaque lignée de base, lu sur les objets qu'elle porte en Tour (pondérés par le nombre de combats) : tank si la
  // part de composants défensifs atteint TANK_SHARE, spéciale si le Calcium l'emporte sur la Protéine. Les stats de data.json
  // ne séparent pas tanks et attaquants, et data.json ne connaît pas toutes les lignées de la Tour.
  function lineProfiles(torre, data) {
    const sums = new Map();
    for (const h of torre.holders) {
      const parts = itemParts(data, h.id);
      if (!parts.length) continue;
      const base = baseLine(h.line);
      const sum = sums.get(base) ?? { n: 0, def: 0, atk: 0, spa: 0 };
      const count = list => parts.filter(p => list.includes(p)).length;
      sum.n += h.n;
      sum.def += (h.n * count(DEFENSE)) / parts.length;
      sum.atk += h.n * count(['protein']);
      sum.spa += h.n * count(['calcium']);
      sums.set(base, sum);
    }
    return new Map([...sums].map(([base, x]) => [base, { tank: x.def / x.n >= TANK_SHARE, special: x.spa > x.atk }]));
  }

  // Objet complet qui convient au profil : jamais la stat d'attaque contraire sans la sienne (Orbe Vie, Lentilscope restent
  // mixtes), au moins la moitié de composants défensifs pour un tank, offensifs pour un attaquant. Sans profil, tout convient.
  function suits(data, profile, id) {
    if (!profile) return true;
    const parts = itemParts(data, id);
    if (!parts.length) return false;
    const [own, other] = profile.special ? ['calcium', 'protein'] : ['protein', 'calcium'];
    if (parts.includes(other) && !parts.includes(own)) return false;
    const def = parts.filter(p => DEFENSE.includes(p)).length;
    return profile.tank ? def * 2 >= parts.length : def * 2 <= parts.length;
  }

  // Ce qu'un objet porté contraire au profil a de faux, pour le conseil d'Aimant.
  function misfit(data, profile, id) {
    const parts = itemParts(data, id);
    const [own, other] = profile.special ? ['calcium', 'protein'] : ['protein', 'calcium'];
    if (parts.includes(other) && !parts.includes(own)) return profile.special ? 'physique sur un spécial' : 'spécial sur un physique';
    return profile.tank ? 'offensif sur un tank' : 'défensif sur un attaquant';
  }

  // Meilleurs objets complets portés en Tour par cette lignée exacte et qui conviennent à son profil : une forme ancrée (-aN)
  // ne compte que pour elle-même ; le repli sur la lignée de base est dans idealItems.
  function topHolders(torre, data, line, profile) {
    return torre.holders.filter(h => h.line === line && h.n >= MIN_FIGHTS && data.items[h.id]?.k === 'full' && suits(data, profile, h.id))
      .sort((a, b) => b.lo - a.lo).slice(0, MAX_ITEMS);
  }

  function idealItems(torre, data, line, profile) {
    const own = topHolders(torre, data, line, profile);
    return (own.length ? own : topHolders(torre, data, baseLine(line), profile)).map(h => h.id);
  }

  // Portée inconnue : mêlée.
  const isRanged = (data, base) => (lineInfo(data, base)?.range ?? 1) > 1;

  // Porteurs : un Pokémon possédé par lignée de la compo cible (le plus étoilé, puis celui qui porte le plus d'objets, puis
  // posé). Rôles lus sur le profil de la lignée : porteur (attaquant du cœur le mieux classé), tanks (aux PV max d'abord),
  // puis les autres attaquants (★, puis lineLo).
  function holdersOf(torre, data, game, target, profiles) {
    const own = targetBases(target)
      .map(b => unitsOf(game, b).sort((x, y) => y.star - x.star || Number(!!y.shiny) - Number(!!x.shiny) || (y.items?.length ?? 0) - (x.items?.length ?? 0)
        || Number(y.cell !== undefined) - Number(x.cell !== undefined))[0])
      .filter(Boolean);
    const profile = u => profiles.get(baseLine(u.line)) ?? null;
    const rank = (a, b) => b.star - a.star || Number(!!b.shiny) - Number(!!a.shiny) || lineLo(torre, b.line) - lineLo(torre, a.line);
    const hp = u => (lineInfo(data, baseLine(u.line))?.stars?.[u.star - 1]?.stats.hp ?? 0) * (u.shiny ? SHINY_HP : 1);
    const tanks = own.filter(u => profile(u)?.tank).sort((a, b) => hp(b) - hp(a));
    const attackers = own.filter(u => !tanks.includes(u)).sort(rank);
    const carry = attackers.find(u => target.core.some(id => baseLine(id) === baseLine(u.line)));
    return [['carry', carry], ...tanks.map(u => ['tank', u]), ...attackers.filter(u => u !== carry).map(u => ['atk', u])]
      .filter(([, u]) => u)
      .map(([role, u]) => ({ role, unit: u, profile: profile(u), ideal: idealItems(torre, data, u.line, profile(u)) }));
  }

  // Lignées du cœur cible non possédées et du cœur de la compo suivante : leurs recettes idéales se préparent au sac.
  function futureLines(torre, data, target, next, holders, profiles, names) {
    const owned = new Set(holders.map(h => baseLine(h.unit.line)));
    return [...target.core, ...(next?.core ?? [])].filter(id => !owned.has(baseLine(id)) && owned.add(baseLine(id)))
      .map(id => ({ base: baseLine(id), who: names.line(baseLine(id)), ideal: idealItems(torre, data, id, profiles.get(baseLine(id)) ?? null) }));
  }

  const BEST = 'meilleur objet de sa lignée en Tour';
  const ROLE_WHY = {
    carry: 'objet offensif pour ton porteur', tank: 'objet défensif pour un tank', atk: 'objet offensif pour un attaquant',
  };

  // Tout objet complet ou composant va tout de suite sur un Pokémon de la compo à qui il convient : un composant posé seul donne
  // déjà son effet et fusionne avec le prochain composant posé sur ce Pokémon. Chaque objet du sac est conseillé une fois ;
  // l'état de chaque porteur (objets, places, composant seul) suit les conseils, et une seule paire par Pokémon et par passage
  // (l'ordre de pose ne serait plus clair). future : lignées à venir (futureLines), pour qui un composant reste au sac.
  // Renvoie aussi cet état final, pour le choix de la récompense.
  function itemMarks(data, game, holders, book, target, future, names) {
    const marks = game.bag.map(() => null);
    if (!target) return { marks, holders: [], reserved: new Set() };
    const kind = id => data.items[id]?.k;
    const hs = holders.map(h => {
      const on = [...(h.unit.items ?? [])];
      const lone = on.find(id => kind(id) === 'part') ?? null;
      // loneAt : case du sac du composant seul conseillé dans ce passage ; after : paire à poser avant.
      // held : objets du sac gardés pour lui après l'Aimant.
      return { ...h, on, who: names.line(h.unit.line), slots: MAX_ITEMS - on.length, lone, loneAt: null, after: null, held: [] };
    });
    // Cases du sac gardées pour un Pokémon précis (après l'Aimant) ou pour une lignée à venir.
    const reserved = new Set();
    // Un composant convient s'il entre dans un objet complet qui convient.
    const fits = (h, id) => (kind(id) === 'part'
      ? [...book.parts].some(([f, ab]) => ab.includes(id) && suits(data, h.profile, f))
      : kind(id) === 'full' && suits(data, h.profile, id));
    const ideal = (h, full) => h.ideal.includes(full) && !h.on.includes(full);
    const fused = (h, id) => book.make.get(`${h.lone}+${id}`);
    const pending = k => game.bag.map((id, i) => ({ id, i })).filter(x => marks[x.i] === null && kind(x.id) === k);
    const after = h => (h.after ? ` (après ${h.after})` : '');
    const put = (i, h, title, why) => {
      marks[i] = mark('do', `→ ${h.who}`, title, why);
    };
    const full = (i, h, id, why) => {
      put(i, h, `${names.item(id)} → ${h.who}`, why);
      h.slots -= 1;
      h.on.push(id);
    };
    const pair = (i, j, h, a, b, why) => {
      const both = `${names.item(a)} + ${names.item(b)}`;
      put(i, h, `${both} → ${h.who}`, why + after(h));
      put(j, h, `${both} → ${h.who}`, why + after(h));
      h.after = both;
    };
    const alone = (i, h, id, why) => {
      put(i, h, `${names.item(id)} → ${h.who}`, why + after(h));
      h.slots -= 1;
      h.on.push(id);
      Object.assign(h, { lone: id, loneAt: i });
    };
    // Fusion avec le composant seul du Pokémon : s'il a été conseillé dans ce passage, les deux bulles annoncent la paire.
    const fuse = (i, h, id, why) => {
      const made = fused(h, id);
      if (h.loneAt !== null) pair(h.loneAt, i, h, h.lone, id, why);
      else put(i, h, `${names.item(id)} → ${h.who}`, `fusionne avec ${names.item(h.lone)} : ${why}`);
      h.on[h.on.indexOf(h.lone)] = made;
      Object.assign(h, { lone: null, loneAt: null });
    };

    // Paire idéale du sac : recette idéale d'un Pokémon libre, sans paire dans ce passage, dont l'autre composant attend dans le sac.
    const idealPair = (free, id, i) => {
      const waiting = pending('part');
      for (const h of free.filter(x => !x.after)) {
        for (const f of h.ideal.filter(x => ideal(h, x) && book.parts.get(x)?.includes(id))) {
          const ab = book.parts.get(f);
          const j = waiting.find(p => p.i !== i && p.id === (ab[0] === id ? ab[1] : ab[0]))?.i;
          if (j !== undefined) return { h, f, ab, j };
        }
      }
      return null;
    };
    // Un composant seul qui entre dans une recette idéale encore à faire (porté ou conseillé) n'est détourné que faute de
    // place utile au rôle : le conseil reste le même une fois le composant posé.
    const kept = h => h.ideal.some(f => ideal(h, f) && book.parts.get(f)?.includes(h.lone));
    // Composants encore à réunir pour chaque recette idéale des lignées à venir : une copie gardée par composant demandé.
    const needs = future.flatMap(x => x.ideal.map(f => ({ x, f, left: [...(book.parts.get(f) ?? [])] })));
    // Composant, première règle qui s'applique : complète une recette idéale, paire idéale du sac, entame une recette idéale,
    // reste au sac pour la recette idéale d'une lignée à venir, fusion utile au rôle, recette doublée utile au rôle, fusion
    // utile au rôle d'un composant réservé, place sur un Pokémon à qui il convient.
    const placePart = (id, i) => {
      const done = hs.find(h => h.lone && ideal(h, fused(h, id)));
      if (done) return fuse(i, done, id, `${names.item(fused(done, id))}, ${BEST}`);
      const free = hs.filter(h => h.slots > 0 && !h.lone);
      const duo = idealPair(free, id, i);
      if (duo) {
        pair(i, duo.j, duo.h, ...duo.ab, `${names.item(duo.f)}, ${BEST}`);
        duo.h.slots -= 1;
        duo.h.on.push(duo.f);
        return;
      }
      // L'effet du composant seul n'est pas annoncé quand c'est la stat d'attaque contraire (Protéine seule sur un spécial).
      const contrary = h => h.profile !== null && id === (h.profile.special ? 'protein' : 'calcium');
      const now = h => (contrary(h) ? '' : `${names.effect(id) ?? 'son effet'} tout de suite ; `);
      const begun = free.map(h => ({ h, f: h.ideal.find(f => ideal(h, f) && book.parts.get(f)?.includes(id)) })).find(x => x.f);
      if (begun) {
        const [a, b] = book.parts.get(begun.f);
        return alone(i, begun.h, id, `${now(begun.h)}plus tard avec ${names.item(a === id ? b : a)} : ${names.item(begun.f)}, ${BEST}`);
      }
      const later = needs.find(n => n.left.includes(id));
      if (later) {
        later.left.splice(later.left.indexOf(id), 1);
        reserved.add(i);
        marks[i] = mark('opt', 'Garde', `Garde ${names.item(id)}`, `${names.item(later.f)} pour ${later.x.who}, à venir`);
        return;
      }
      const useful = list => list.find(h => fits(h, fused(h, id)) && !h.on.includes(fused(h, id)));
      const roleFuse = h => fuse(i, h, id, `${names.item(fused(h, id))}, ${ROLE_WHY[h.role]}`);
      const open = useful(hs.filter(h => h.lone && !kept(h)));
      if (open) return roleFuse(open);
      const twin = book.make.get(`${id}+${id}`);
      const double = free.find(h => fits(h, twin) && !h.on.includes(twin));
      if (double) return alone(i, double, id, `${now(double)}plus tard avec ${names.item(id)} : ${names.item(twin)}, ${ROLE_WHY[double.role]}`);
      const diverted = useful(hs.filter(h => h.lone && kept(h)));
      if (diverted) return roleFuse(diverted);
      const any = free.find(h => fits(h, id) && !contrary(h));
      if (any) alone(i, any, id, now(any).replace(/ ; $/, ''));
    };

    // Aimant : sur un Pokémon de la compo qui porte un objet contraire à son profil, puis sur un Pokémon plein dont un objet
    // idéal attend au sac (complet, ou ses deux composants), enfin sur un Pokémon posé hors des deux compos qui porte des objets
    // (au banc, la vente les rend : sellMarks). Il rend tous ses objets au sac : le Pokémon ne reçoit plus rien dans ce passage,
    // les conseils suivent au passage d'après.
    const count = id => pending(kind(id)).filter(x => x.id === id).length;
    const inBag = f => {
      const [a, b] = book.parts.get(f) ?? [];
      return count(f) > 0 || (a !== undefined && (a === b ? count(a) >= 2 : count(a) > 0 && count(b) > 0));
    };
    const wrong = h => h.on.find(id => ['part', 'full'].includes(kind(id)) && !fits(h, id));
    const swap = h => {
      const bad = wrong(h);
      if (bad) return { why: `retire ${names.item(bad)} (${misfit(data, h.profile, bad)})`, ready: null };
      // Une recette que le composant seul porté complète par fusion avec un composant du sac n'a pas besoin de place.
      const fusable = x => {
        const ab = h.lone ? book.parts.get(x) ?? [] : [];
        return ab.includes(h.lone) && count(ab[0] === h.lone ? ab[1] : ab[0]) > 0;
      };
      const f = h.slots === 0 && h.ideal.find(x => !h.on.includes(x) && !fusable(x) && inBag(x));
      const out = f && h.on.find(x => ['part', 'full'].includes(kind(x)) && !h.ideal.includes(x));
      return out ? { why: `retire ${names.item(out)} ; ${names.item(f)} prêt au sac`, ready: f } : null;
    };
    const wanted = [...targetBases(target), ...future.map(x => x.base)];
    const strays = game.units.filter(u => u.items?.length && boardCell(u.cell) !== null && !wanted.includes(baseLine(u.line)));
    const targets = [...hs.filter(wrong), ...hs.filter(h => !wrong(h))];
    for (const { i } of game.bag.map((id, j) => ({ id, i: j })).filter(x => x.id === 'magnet')) {
      // Calculé à chaque Aimant : l'objet réservé par le précédent n'est plus au sac.
      const s = targets.map(h => ({ h, ...swap(h) })).find(x => x.why);
      if (!s) {
        const u = strays.shift();
        if (u) marks[i] = mark('do', `Retire de ${names.line(u.line)}`, `Aimant sur ${names.line(u.line)}`, 'hors des compos : récupère ses objets');
        continue;
      }
      targets.splice(targets.indexOf(s.h), 1);
      marks[i] = mark('do', `Retire de ${s.h.who}`, `Aimant sur ${s.h.who}`, s.why);
      Object.assign(s.h, { slots: 0, lone: null });
      // L'objet prêt attend l'Aimant au sac : le complet s'il y est, sinon ses deux composants.
      if (!s.ready) continue;
      const keep = id => {
        const j = pending(kind(id)).find(x => x.id === id).i;
        marks[j] = mark('opt', 'Garde', `Garde ${names.item(id)}`, `pour ${s.h.who}, après l’Aimant`);
        reserved.add(j);
        s.h.held.push(id);
      };
      if (count(s.ready) > 0) keep(s.ready);
      else book.parts.get(s.ready).forEach(keep);
    }
    // Objets complets : recettes idéales d'abord (rang le plus haut), puis par rôle, en évitant un doublon sur un Pokémon.
    for (const { id, i } of pending('full')) {
      const h = hs.filter(x => x.slots > 0 && ideal(x, id)).sort((a, b) => a.ideal.indexOf(id) - b.ideal.indexOf(id))[0];
      if (h) full(i, h, id, BEST);
    }
    for (const { id, i } of pending('full')) {
      const free = hs.filter(x => x.slots > 0 && fits(x, id));
      const h = free.find(x => !x.on.includes(id)) ?? free[0];
      if (h) full(i, h, id, ROLE_WHY[h.role]);
    }
    for (const { id, i } of pending('part')) if (marks[i] === null) placePart(id, i);
    for (const { id, i } of [...pending('full'), ...pending('part')]) {
      const later = future.find(x => x.ideal.includes(id));
      let why = 'aucun Pokémon de la compo possédé';
      if (later) why = `pour ${later.who}, à venir`;
      else if (hs.length) why = hs.some(h => h.slots > 0) ? 'aucun Pokémon de la compo n’en profite' : 'toute la compo a 3 objets';
      marks[i] = mark('opt', 'Garde', `Garde ${names.item(id)}`, why);
    }
    return { marks, holders: hs, reserved };
  }

  // Objets visés par Pokémon de la compo : ceux qu'il porte et qui conviennent, puis ses objets idéaux, 3 au plus. Lu sur l'état
  // final des porteurs (itemMarks) : porté (worn), prêt (ready) ou composants manquants (missing). Prêt : posé ou fusionné par
  // les conseils de ce passage, gardé pour lui après l'Aimant, ou réunissable avec ses composants seuls et le sac libre (ni posé
  // ni réservé), partagé dans l'ordre des porteurs.
  function aimsOf(data, game, items, book) {
    const pool = game.bag.filter((id, i) => items.marks[i]?.level !== 'do' && !items.reserved.has(i));
    const take = (list, id) => {
      const k = list.indexOf(id);
      if (k >= 0) list.splice(k, 1);
      return k >= 0;
    };
    return items.holders.map(h => {
      const on = h.unit.items ?? [];
      const own = [...h.held, ...h.on.filter(id => data.items[id]?.k === 'part')];
      const worn = on.filter(id => data.items[id]?.k === 'full' && suits(data, h.profile, id));
      const aims = [...new Set([...worn, ...h.ideal])].slice(0, MAX_ITEMS).map(id => {
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
    const value = id => [...hs.flatMap(h => h.ideal.filter(f => !h.on.includes(f)).map(f => {
      const ab = book.parts.get(f) ?? [];
      if (f === id) return h.slots > 0 && { s: 3, why: `${BEST} pour ${h.who}` };
      if (!ab.includes(id)) return null;
      if (h.lone === (ab[0] === id ? ab[1] : ab[0])) return { s: 2, why: `complète ${names.item(f)} sur ${h.who}` };
      return h.slots > 0 && !h.lone && { s: 1, why: `entame ${names.item(f)} pour ${h.who}` };
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
    if (game.hp < LOW_HP && HEAL_BOONS.includes(id)) return 100 - tie;
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
          : game.hp < LOW_HP && HEAL_BOONS.includes(x.id) ? `PV bas (${game.hp})`
            : open ? `voie ${PATH_NAMES[path]} : ${pathCount(game.boons, path) + 1} sur ${PATH_SIZE}` : 'meilleur effet immédiat';
        const detail = !x.seal && open ? `À ${PATH_SIZE} : ${PATH_BONUS[path]}.` : '';
        return mark('do', 'Prends', `Prends ${x.seal ? names.seal(x.id) : BOONS[x.id][1]}`, why, detail);
      }
      return x.s < 0 ? mark('no', 'Évite', `Évite ${names.seal(x.id)}`, `risqué avec ${game.hp} PV`) : null;
    });
    return { marks, unknown };
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
  const ENEMY_CELLS = 28;
  const boardCell = cell => (Number.isInteger(cell) && cell >= ENEMY_CELLS && cell < 2 * ENEMY_CELLS ? cell - ENEMY_CELLS : null);
  const rowOf = cell => Math.floor(cell / 7);
  const colOf = cell => cell % 7;

  // Zones du porteur à distance : colonnes préférées au fond, et ordre de remplissage du fond (une colonne sur deux d'abord, pour
  // espacer les unités à distance face aux attaques de zone).
  const CARRY_ZONES = {
    left: { name: 'coin gauche', cols: [0, 1, 2], order: [0, 2, 4, 6, 1, 5, 3] },
    center: { name: 'centre', cols: [2, 3, 4], order: [3, 1, 5, 0, 6, 2, 4] },
    right: { name: 'coin droit', cols: [4, 5, 6], order: [6, 4, 2, 0, 5, 1, 3] },
  };

  const TABS = [['tour', 'Tour'], ['compo', 'Compo'], ['boss', 'Boss'], ['rules', 'Règles']];
  const capital = s => s[0].toUpperCase() + s.slice(1);
  // Options du menu ⚙ : clé de l'objet ui, valeurs [valeur, libellé] dans l'ordre affiché, valeur par défaut.
  const OPTIONS = [
    { key: 'theme', label: 'Thème', values: [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']], def: 'auto' },
    { key: 'width', label: 'Largeur', values: [['compact', 'Compacte'], ['wide', 'Large']], def: 'compact' },
    { key: 'text', label: 'Texte', values: [['small', 'Petit'], ['normal', 'Normal'], ['large', 'Grand']], def: 'normal' },
    { key: 'alpha', label: 'Fond', values: [['100', 'Opaque'], ['90', '90 %'], ['80', '80 %']], def: '90' },
    { key: 'side', label: 'Porteur à distance (formation)', values: Object.entries(CARRY_ZONES).map(([k, z]) => [k, capital(z.name)]), def: 'left' },
  ];
  // Valeurs inconnues du stockage (modifié à la main, version antérieure) ramenées aux valeurs par défaut : une zone de porteur
  // inconnue ferait échouer la formation à chaque lecture de la sauvegarde.
  function checkUi(ui) {
    for (const o of OPTIONS) if (!o.values.some(([v]) => v === ui[o.key])) ui[o.key] = o.def;
    if (!TABS.some(([t]) => t === ui.tab)) ui.tab = 'tour';
    ui.pins = { do: true, opt: true, no: true, ...ui.pins };
  }

  // Formation KT1 : la compo cible dans la limite du niveau (cœur possédé d'abord pour la coupe). Chaque Pokémon a ses cases
  // par préférence : tank au premier rang puis devant, porteur à distance dans la zone choisie du fond (coin gauche, centre ou
  // coin droit) puis au fond, mêlée devant (depuis le centre), distance au fond (depuis cette zone). Déjà sur une case de sa
  // première liste, il la garde ; sinon il prend la première case libre. unit : l'unité possédée (porteur de holdersOf), from :
  // sa cellule, 'bench', ou null s'il n'est pas possédé.
  function formation(target, game, data, holders, side) {
    const stars = id => bestStar(game, baseLine(id));
    const kept = new Set([...[...target.core].sort((a, b) => stars(b) - stars(a)), ...target.fillers].slice(0, game.level));
    const units = [...target.core, ...target.fillers].filter(id => kept.has(id)).map(id => {
      const base = baseLine(id);
      const h = holders.find(x => baseLine(x.unit.line) === base);
      return {
        line: id, base, star: Math.max(1, stars(id)), shiny: shinyLine(game, base), items: h ? h.ideal : [], role: h?.role ?? null, ranged: isRanged(data, base),
        unit: h?.unit ?? null, from: h ? boardCell(h.unit.cell) ?? 'bench' : null,
      };
    });
    const zone = CARRY_ZONES[side];
    const front = [0, 1].flatMap(r => [3, 2, 4, 1, 5, 0, 6].map(c => r * 7 + c));
    const back = [3, 2].flatMap(r => zone.order.map(c => r * 7 + c));
    const carryZone = back.filter(c => zone.cols.includes(colOf(c)));
    const zones = u => {
      if (u.role === 'tank') return [front.filter(c => rowOf(c) === 0), front];
      if (u.role === 'carry' && u.ranged) return [carryZone, back];
      return [u.ranged ? back : front];
    };
    const stay = new Set(units.filter(u => zones(u)[0].includes(u.from)));
    const taken = new Set([...stay].map(u => u.from));
    // Tanks d'abord, à distance compris (leur zone est l'avant), puis la mêlée, puis la distance porteur en tête.
    const tanks = units.filter(u => u.role === 'tank');
    const others = units.filter(u => u.role !== 'tank');
    const order = [...tanks, ...others.filter(u => !u.ranged), ...others.filter(u => u.ranged).sort((a, b) => Number(b.role === 'carry') - Number(a.role === 'carry'))];
    for (const u of order) {
      u.cell = stay.has(u) ? u.from : zones(u).flat().find(c => !taken.has(c));
      taken.add(u.cell);
    }
    // Doc de l'API : unités triées par cellule.
    return units.sort((a, b) => a.cell - b.cell);
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
    const marks = [];
    const pending = () => units.filter(f => typeof f.from === 'number' && cellOf(f.unit) !== f.cell);
    for (let left = pending(); left.length; left = pending()) {
      const u = left.find(f => !left.some(g => g !== f && cellOf(g.unit) === f.cell)) ?? left[0];
      const from = cellOf(u.unit);
      const other = at.get(u.cell);
      const swap = other && mine.has(other) ? ` (échange avec ${names.line(other.line)})` : '';
      marks.push(mark('do', '', `Déplace ${names.line(u.base)}`, `${spot(from)} → ${spot(u.cell)}${swap}`));
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
      marks.push(mark('do', '', `Pose ${names.line(u.base)}`, `${spot(u.cell)}${why}`));
    }
    return marks;
  }
  function kt1Code(units, rules) {
    const parts = units.map(u => `${u.line}:${u.star}${u.shiny ? 's' : ''}:${u.cell}${u.items.length ? `:${u.items.join('.')}` : ''}`);
    return ['KT1', `r${rules}`, 'xm=tower', `xn=${encodeURIComponent(PLAN_NAME)}`, ...parts].join(';');
  }

  // previous : { key, run, next } des derniers trios choisis (compo cible, compo suivante) ; l'inertie ne vaut que dans la même
  // partie (runSeed).
  function advise({ torre, data, lang, save, previous, side }) {
    const names = namer(lang);
    const game = readGame(save);
    const run = save.runSeed ?? null;
    const stops = torre ? nextStops(torre.stops, game.floor) : [];
    const eco = economy(game, stops);
    const same = previous?.run === run ? previous : null;
    const target = torre && data ? targetComp(torre, data, game, same?.key ?? null) : null;
    const next = target ? nextComp(torre, game, target, same?.next ?? null) : null;
    let xp;
    const shop = shopMarks(game, target, next, data, eco, names, left => {
      xp = xpMark(game, eco, left);
      return xp.cost;
    });
    const choice = offerChoiceMarks(data, game, eco, names);
    const profiles = target ? lineProfiles(torre, data) : null;
    const holders = target ? holdersOf(torre, data, game, target, profiles) : [];
    const book = target ? recipeBook(data) : null;
    const future = target ? futureLines(torre, data, target, next, holders, profiles, names) : [];
    const items = itemMarks(data, game, holders, book, target, future, names);
    const units = target ? formation(target, game, data, holders, side) : [];
    return {
      game, eco, target, next, names, run,
      shop: shop.marks,
      reroll: rerollMark(game, target, eco, shop.left),
      xp: xp.mark,
      bench: sellMarks(game, target, next, names, shop.short),
      bag: items.marks,
      reward: offerMarks(book, game, items.holders, future, names),
      aims: target ? aimsOf(data, game, items, book) : [],
      offer: choice.marks,
      unknownOffer: choice.unknown,
      anchor: anchorAdvice(target, game, names),
      moves: moveAdvice(units, game, names),
      code: target ? kt1Code(units, torre.rules) : null,
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
    SOURCES, SAVE_KEY, UI_KEY, PLAN_NAME, GOLD_RULES, BOONS, lineInfo, loadJson,
    parseSave, floorFromSave, isTowerData, isGameData, isLang, isFresh, lastBossFloor, nextBossStop, nextStops, topCores,
    baseLine, namer, bossName, guideFor, rateLevel, readGame, goldFloor, coreScore, targetComp, progress, shinyLine, anchorAdvice, advise, pct, shortDate,
    boardCell, topHolders, lineProfiles, suits, floorRange, CARRY_ZONES, coreKey, TABS, OPTIONS, checkUi,
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
  --kt-text:#f1f3ff; --kt-muted:#b4bcdf; --kt-line:rgb(255 255 255 / .12); --kt-control:rgb(255 255 255 / .38);
  --kt-raised:rgb(255 255 255 / .07); --kt-raised-2:rgb(255 255 255 / .12); --kt-scrim:rgb(0 0 0 / .18);
  /* Accent en texte (4,5:1 jusqu'au fond 80 % sur les zones claires du jeu) distinct de l'accent en aplat. */
  --kt-accent:#56b4e9; --kt-accent-fg:#0b1020; --kt-accent-text:#8fd0f5; --kt-focus:#56b4e9;
  --kt-good-bg:#56b4e9; --kt-good-fg:#0b1020; --kt-bad-bg:#f0e442; --kt-bad-fg:#141a33; --kt-mid-bg:rgb(255 255 255 / .14); --kt-mid-fg:#f1f3ff;
  --kt-coin:#e8b931; --kt-coin-edge:#b9851b;
  --kt-shadow:0 12px 32px rgb(0 0 0 / .45), inset 0 0 0 1px rgb(255 255 255 / .06);
  --kt-font:system-ui,-apple-system,"Segoe UI",sans-serif;
  --kt-alpha:.9; --kt-size:14px; --kt-width:320px;
  --kt-fs-xs:calc(var(--kt-size) - 3px); --kt-fs-s:calc(var(--kt-size) - 2px); --kt-fs-m:calc(var(--kt-size) - 1px); --kt-fs-l:calc(var(--kt-size) + 2px);
  --kt-s1:4px; --kt-s2:8px; --kt-s3:12px; --kt-s4:16px; --kt-r-ctl:8px; --kt-r-card:10px; --kt-r-box:14px; }
.kt-root[data-scheme="light"] {
  --kt-glass:rgb(250 251 255 / var(--kt-alpha)); --kt-text:#141a33; --kt-muted:#47507a; --kt-line:rgb(20 26 51 / .12);
  --kt-control:rgb(20 26 51 / .45); --kt-raised:rgb(20 26 51 / .05); --kt-raised-2:rgb(20 26 51 / .09);
  --kt-accent:#0072b2; --kt-accent-fg:#fff; --kt-accent-text:#004f7a; --kt-focus:#0072b2;
  --kt-good-bg:#0072b2; --kt-good-fg:#fff; --kt-mid-bg:rgb(20 26 51 / .08); --kt-mid-fg:#141a33;
  --kt-shadow:0 12px 32px rgb(0 0 0 / .3), inset 0 0 0 1px rgb(255 255 255 / .5); }
/* Options Fond, Texte, Largeur ; 80 % est le plancher : en deçà, le texte secondaire passe sous 4,5:1 sur les zones claires du jeu. */
.kt-root[data-alpha="100"] { --kt-alpha:1; }
.kt-root[data-alpha="80"] { --kt-alpha:.8; }
.kt-root[data-text="small"] { --kt-size:13px; }
.kt-root[data-text="large"] { --kt-size:16px; }
.kt-root[data-width="wide"] { --kt-width:380px; }

/* Panneau */
.kt { position: fixed; z-index: 2147483647; width: var(--kt-width); max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; box-sizing: border-box;
  background: var(--kt-glass); backdrop-filter: blur(var(--kt-blur)) saturate(1.2); color: var(--kt-text); border-radius: var(--kt-r-box);
  box-shadow: var(--kt-shadow); font: var(--kt-size)/1.4 var(--kt-font); font-variant-numeric: tabular-nums; }
.kt * { box-sizing: border-box; }
.kt p { margin: 0; }
.kt button { font: inherit; color: inherit; }
.kt-bar { display: flex; align-items: center; gap: var(--kt-s1); min-height: 44px; padding: 0 var(--kt-s2) 0 var(--kt-s3); cursor: move; touch-action: none; user-select: none; }
.kt-lbl { font-size: var(--kt-fs-s); color: var(--kt-muted); margin-right: var(--kt-s1); }
.kt-stepper { display: inline-flex; align-items: center; height: 28px; border: 1px solid var(--kt-control); border-radius: var(--kt-r-ctl); flex: none; }
.kt-stepper button { width: 26px; height: 26px; border: 0; background: none; color: var(--kt-muted); cursor: pointer; border-radius: var(--kt-r-ctl); }
.kt-floor { width: 40px; height: 26px; border: 0; border-inline: 1px solid var(--kt-line); background: none; color: var(--kt-text); font: 700 var(--kt-fs-l) var(--kt-font); text-align: center; }
.kt-floor.is-empty { outline: 2px solid var(--kt-focus); outline-offset: -2px; }
.kt-src { font-size: var(--kt-fs-xs); color: var(--kt-muted); padding: 2px 6px; border-radius: 999px; background: var(--kt-raised); margin-left: var(--kt-s1); }
.kt-sp { flex: 1; }
.kt-ibtn { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: var(--kt-r-ctl); background: none; color: var(--kt-muted); cursor: pointer; flex: none; }
.kt-ibtn:hover, .kt-ibtn[aria-expanded="true"][data-act="menu"] { background: var(--kt-raised-2); color: var(--kt-text); }
.kt-ibtn svg { width: 16px; height: 16px; }
.kt button:focus-visible, .kt-floor:focus-visible, .kt a:focus-visible, .kt summary:focus-visible, .kt-opts input:focus-visible + span { outline: 2px solid var(--kt-focus); outline-offset: 2px; }
.kt-sum { display: none; align-items: center; gap: var(--kt-s2); min-width: 0; font-size: var(--kt-fs-m); }
.kt-sum b { color: var(--kt-accent-text); }
.kt-sum .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt.is-collapsed .kt-sum { display: flex; }
.kt.is-collapsed :is(.kt-lbl, .kt-src, [data-act="menu"], .kt-alert, .kt-opts, .kt-body, .kt-status, .kt-foot) { display: none; }
.kt-coin { width: 14px; height: 14px; border-radius: 999px; background: var(--kt-coin); box-shadow: inset 0 0 0 2px var(--kt-coin-edge); flex: none; }

/* En-tête : or et prochain boss */
.kt-body { display: grid; gap: var(--kt-s3); padding: 0 0 var(--kt-s3); }
/* minmax(0, 1fr) : une ligne longue sans retour (« à éviter ») s'ellipse au lieu d'élargir la grille hors du panneau. */
.kt-body, .kt-head, .kt-panel { grid-template-columns: minmax(0, 1fr); }
.kt-head { display: grid; gap: var(--kt-s2); padding: 0 var(--kt-s3); }
.kt-gold { display: flex; align-items: center; gap: var(--kt-s2); }
.kt-gold b { font-size: var(--kt-fs-l); }
.kt-gold .spend { font-size: var(--kt-fs-l); font-weight: 700; color: var(--kt-accent-text); }
.kt-gold .m { font-size: var(--kt-fs-s); color: var(--kt-muted); margin-left: auto; white-space: nowrap; }
.kt-warn { display: flex; gap: var(--kt-s2); align-items: center; font-size: var(--kt-fs-s); padding: 6px var(--kt-s2); border-radius: var(--kt-r-ctl); background: var(--kt-raised); }
.kt-boss { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0 var(--kt-s2); padding: var(--kt-s2) var(--kt-s3); border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-boss .n { font-weight: 700; font-size: var(--kt-fs-l); }
.kt-boss .w { font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-boss .kt-rate { grid-row: 1 / span 2; grid-column: 2; }
.kt-rate { display: inline-flex; gap: var(--kt-s1); align-items: center; padding: 2px var(--kt-s2); border-radius: 999px; font-size: var(--kt-fs-s); font-weight: 700; white-space: nowrap; }
.kt-rate.good { background: var(--kt-good-bg); color: var(--kt-good-fg); }
.kt-rate.bad { background: var(--kt-bad-bg); color: var(--kt-bad-fg); }
.kt-rate.mid { background: var(--kt-mid-bg); color: var(--kt-mid-fg); }

/* Onglets */
.kt-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin: 0 var(--kt-s3); padding: 3px; border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-tabs button { height: 28px; display: flex; align-items: center; justify-content: center; gap: var(--kt-s1); border: 0; border-radius: 7px; background: none; color: var(--kt-muted); font-size: var(--kt-fs-m); font-weight: 600; cursor: pointer; }
.kt-tabs button[aria-selected="true"] { background: var(--kt-accent); color: var(--kt-accent-fg); }
.kt-tabs .count { min-width: 16px; height: 16px; padding: 0 var(--kt-s1); border-radius: 999px; background: var(--kt-raised-2); font-size: var(--kt-fs-xs); display: inline-grid; place-items: center; }
.kt-tabs button[aria-selected="true"] .count { background: var(--kt-scrim); }
.kt-panel { display: grid; gap: var(--kt-s3); padding: 0 var(--kt-s3); }
.kt-label { display: flex; justify-content: space-between; gap: var(--kt-s2); font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-msg { padding: var(--kt-s2) var(--kt-s3); border-radius: var(--kt-r-card); background: var(--kt-raised); font-size: var(--kt-fs-m); }
.kt-msg strong { display: block; }

/* Conseils */
.kt-todo { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.kt-todo li { display: grid; grid-template-columns: 20px 1fr; gap: var(--kt-s2); padding: 6px var(--kt-s2); border-radius: var(--kt-r-ctl); }
.kt-todo .t { font-weight: 600; font-size: var(--kt-fs-m); }
.kt-todo .why { display: block; font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-sym { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; font-size: var(--kt-fs-xs); font-weight: 700; border: 1px solid var(--kp-edge); flex: none; }
.kt-avoid { border-top: 1px solid var(--kt-line); }
.kt-avoid summary { display: flex; align-items: center; gap: var(--kt-s2); min-height: 32px; padding: 0 var(--kt-s2); font-size: var(--kt-fs-m); color: var(--kt-muted); cursor: pointer; list-style: none; }
.kt-avoid summary::-webkit-details-marker { display: none; }
.kt-avoid summary::before { content: "▸"; width: 20px; text-align: center; }
.kt-avoid[open] summary::before { content: "▾"; }
.kt-avoid .k { color: var(--kt-text); font-weight: 600; white-space: nowrap; }
.kt-avoid .l { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt-avoid[open] .l { display: none; }

/* Compo */
.kt-comp { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--kt-s1); }
.kt-comp li { display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 var(--kt-s2); border-radius: var(--kt-r-ctl); background: var(--kt-raised); font-size: var(--kt-fs-s); }
.kt-comp li.core { font-weight: 700; box-shadow: inset 0 0 0 1px var(--kt-accent); }
.kt-comp .p { color: var(--kt-muted); font-weight: 400; }
.kt-comp .sh { padding: 1px 5px; border-radius: 999px; background: var(--kt-bad-bg); color: var(--kt-bad-fg); font-size: var(--kt-fs-xs); font-weight: 700; }
.kt-copy { height: 36px; border: 0; border-radius: var(--kt-r-ctl); background: var(--kt-accent); color: var(--kt-accent-fg); font-weight: 700; cursor: pointer; }
.kt-hint { font-size: var(--kt-fs-s); color: var(--kt-muted); }

/* Objets visés */
.kt-aims { border-top: 1px solid var(--kt-line); padding-top: var(--kt-s2); font-size: var(--kt-fs-s); }
.kt-aims summary { font-weight: 600; cursor: pointer; min-height: 24px; }
.kt-aims > ul { list-style: none; margin: var(--kt-s1) 0 0; padding: 0; display: grid; gap: var(--kt-s2); }
.kt-aims .who { font-weight: 700; }
.kt-aims ul ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.kt-aims ul ul li { display: grid; grid-template-columns: 16px 1fr; gap: var(--kt-s1); }
.kt-aims .st { text-align: center; }
.kt-aims .why { color: var(--kt-muted); }

/* Boss */
.kt-big { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--kt-s2); }
.kt-big p { padding: var(--kt-s2); border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-big b { display: block; font-size: var(--kt-fs-l); }
.kt-big span { font-size: var(--kt-fs-xs); color: var(--kt-muted); }
.kt-cores { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-s1); }
.kt-cores li { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0 var(--kt-s2); padding: var(--kt-s2); border-radius: var(--kt-r-card); background: var(--kt-raised); }
.kt-cores .names { font-size: var(--kt-fs-m); font-weight: 600; }
.kt-cores .n { font-size: var(--kt-fs-xs); color: var(--kt-muted); }
.kt-cores .mine { color: var(--kt-accent-text); font-weight: 600; }
.kt-cores .kt-rate { grid-row: 1 / span 2; grid-column: 2; }

/* Règles */
.kt-rules { margin: 0; padding-left: var(--kt-s4); display: grid; gap: 6px; font-size: var(--kt-fs-m); }

/* Options */
.kt-opts { display: grid; gap: var(--kt-s3); padding: var(--kt-s3); border-top: 1px solid var(--kt-line); }
.kt-opts[hidden] { display: none; }
.kt-opts h2 { margin: 0; font-size: var(--kt-fs-m); }
.kt-opts fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 6px; min-width: 0; }
.kt-opts legend { padding: 0; margin-bottom: 6px; font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; padding: 2px; border-radius: var(--kt-r-ctl); background: var(--kt-raised); }
.kt-seg label, .kt-checks label { position: relative; cursor: pointer; }
.kt-opts input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; }
.kt-seg span { min-height: 26px; display: grid; place-items: center; padding: 0 var(--kt-s1); border-radius: 6px; font-size: var(--kt-fs-s); font-weight: 600; color: var(--kt-muted); text-align: center; }
.kt-seg input:checked + span { background: var(--kt-raised-2); color: var(--kt-text); box-shadow: inset 0 0 0 1px var(--kt-control); }
.kt-checks { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--kt-s2); }
.kt-checks span { min-height: 30px; display: flex; align-items: center; gap: 6px; padding: 0 var(--kt-s2); border-radius: var(--kt-r-ctl); background: var(--kt-raised); font-size: var(--kt-fs-s); color: var(--kt-muted); }
.kt-checks span::before { content: ""; width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--kt-control); flex: none; }
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
.kp { position: fixed; display: inline-flex; align-items: center; gap: var(--kt-s1); height: 22px; min-width: 22px; padding: 0 var(--kt-s2); translate: -50% 0;
  border-radius: 999px; border: 1px solid var(--kp-edge); font: 700 12px/1 var(--kt-font); white-space: nowrap; cursor: help;
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
.kp-tip { display: none; position: absolute; left: 50%; translate: -50% 0; bottom: calc(100% + var(--kt-s2)); width: 240px; padding: 10px var(--kt-s3);
  border-radius: var(--kt-s3); background: var(--kt-glass); backdrop-filter: blur(var(--kt-blur)); color: var(--kt-text);
  font: 400 12px/1.45 var(--kt-font); white-space: normal; text-align: left; box-shadow: var(--kt-shadow); }
.kp.is-below .kp-tip { bottom: auto; top: calc(100% + var(--kt-s2)); }
/* Près d'un bord, la bulle s'aligne sur la pastille au lieu de se centrer (sinon coupée par la fenêtre). */
.kp.is-left .kp-tip { left: 0; translate: 0 0; }
.kp.is-right .kp-tip { left: auto; right: 0; translate: 0 0; }
.kp:hover .kp-tip, .kp:focus-visible .kp-tip { display: block; }
/* La pastille survolée ou sélectionnée passe devant ses voisines, bulle comprise. */
.kp:hover, .kp:focus-visible { z-index: 1; }
.kp.is-dismissed .kp-tip { display: none; }
.kp-tip strong { display: block; font-size: 13px; margin-bottom: 2px; }
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
};
const TOWER_HUD = '.topbar .rtrack.tw';
const COMPACT_BELOW = 64;
// Demi-largeur de la bulle (240 px) : en deçà du bord, elle s'aligne sur la pastille.
const TIP_HALF = 120;

const PIN_NAME = { do: 'Faire', opt: 'Si l’or', no: 'Éviter' };
const ICON = {
  gear: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
};

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// Conseils de partie seulement à l'étage de la sauvegarde : un étage saisi à la main ne sert qu'au prochain boss.
const onSaveFloor = state => state.save !== null && state.floor === KT.floorFromSave(state.lastRaw);


const allMarks = a => [...a.shop, a.reroll, a.xp, ...a.bench, ...a.bag, ...a.reward, ...a.offer, ...a.anchor, ...a.moves].filter(Boolean);
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
  return state.save && !onSaveFloor(state)
    ? `<p class="kt-msg">Conseils de partie masqués : ta partie est à l’étage ${KT.floorFromSave(state.lastRaw)}.</p>`
    : '<p class="kt-msg">Les conseils de partie apparaissent dès qu’une partie Tour est lancée.</p>';
}

function tourHtml(state, ui) {
  const a = state.advice;
  if (!a) return noAdviceHtml(state);
  const marks = sortedMarks(a);
  const lines = marks.filter(m => m.level !== 'no').map(markHtml);
  for (const id of a.unknownOffer) lines.push(`<li><span></span><span><span class="t">Bénédiction inconnue (${esc(id)})</span><span class="why">pas de conseil</span></span></li>`);
  const avoid = marks.filter(m => m.level === 'no');
  const todo = lines.length ? `<ol class="kt-todo" aria-label="Conseils">${lines.join('')}</ol>` : '<p class="kt-msg">Rien à faire pour l’instant.</p>';
  return `${todo}${avoid.length ? `<details class="kt-avoid"${ui.avoid ? ' open' : ''}><summary><span class="k">${avoid.length} à éviter</span>
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
  return rows.length ? `<details class="kt-aims"${ui.aims ? ' open' : ''}><summary>Objets visés</summary><ul>${rows.join('')}</ul></details>` : '';
}

function compoHtml(state, ui) {
  const a = state.advice;
  if (!a) return noAdviceHtml(state);
  if (!a.target) return '<p class="kt-msg">Pas de compo cible sans les statistiques de la Tour.</p>';
  const t = a.target;
  const bosses = t.stops.filter(s => s.boss !== 'elite').map(s => `${KT.bossName(s.boss)} ${s.floor}`);
  const span = bosses.length > 1 ? `${bosses[0]} → ${bosses.at(-1)}` : bosses[0] ?? '';
  const chip = (id, core) => {
    const base = KT.baseLine(id);
    return `<li${core ? ' class="core"' : ''}>${esc(a.names.line(id))} <span class="p">${KT.progress(a.game, base)}</span>${KT.shinyLine(a.game, base) ? ' <span class="sh">shiny</span>' : ''}</li>`;
  };
  return `<p class="kt-label"><span>Compo cible</span><span>${esc(span)}</span></p>
<ul class="kt-comp">${t.core.map(id => chip(id, true)).join('')}${t.fillers.map(id => chip(id, false)).join('')}</ul>
${a.next ? `<p class="kt-label"><span>Ensuite</span><span>${esc(KT.floorRange(a.next.stops))}</span></p><ul class="kt-comp">${a.next.core.map(id => chip(id, false)).join('')}</ul>` : ''}
${aimsHtml(a, ui)}
<button class="kt-copy" id="kt-copy" data-act="copy">Copier la formation</button>
<p class="kt-hint">Porteur à distance : fond, ${KT.CARRY_ZONES[ui.side].name} (options ⚙).</p>`;
}

function bossTabHtml(state) {
  if (!state.torre) return '<p class="kt-msg">Statistiques de la Tour indisponibles.</p>';
  const stop = KT.nextBossStop(state.torre.stops, state.floor);
  // L'en-tête dit déjà qu'aucun boss n'est connu après cet étage.
  if (!stop) return '<p class="kt-msg">Pas de trio à afficher.</p>';
  const names = KT.namer(state.lang);
  const mine = state.advice?.target?.key;
  const cores = KT.topCores(state.torre.cores, stop.stop);
  const coresHtml = cores.length
    ? `<ol class="kt-cores">${cores.map(c => {
      const l = KT.rateLevel(c.win);
      const own = KT.coreKey(c.core) === mine ? ' · <span class="mine">ta compo cible</span>' : '';
      return `<li><span class="names">${esc(c.core.map(names.line).join(' · '))}</span><span class="kt-rate ${l.cls}">${l.sym} ${KT.pct(c.win)}</span><span class="n">${c.n} combats${own}</span></li>`;
    }).join('')}</ol>`
    : '<p class="kt-msg">Aucun trio n’a encore 20 combats sur ce boss.</p>';
  return `<div class="kt-big"><p><b>${KT.pct(stop.win)}</b><span>victoires</span></p><p><b>${KT.pct(stop.first)}</b><span>au 1er essai</span></p>
<p><b>${stop.tries.toLocaleString('fr-FR')}</b><span>essais en moyenne</span></p></div>
<p class="kt-label"><span>Meilleurs trios</span><span>≥ 20 combats</span></p>${coresHtml}`;
}

function rulesHtml(floor) {
  const g = KT.guideFor(floor);
  const range = g.to === Infinity ? `étages ${g.from} et plus` : `étages ${g.from}–${g.to}`;
  const shinies = g.shinies.length
    ? `Shinies à saisir : ${esc(g.shinies.join(', '))}. ${esc(g.advice)} (conseil non vérifié ; un shiny a +10 % de PV, de défenses et de dégâts).`
    : esc(g.advice);
  return `<p class="kt-label"><span>Règles d’or</span><span>${range}</span></p><p class="kt-msg">${shinies}</p>
<ul class="kt-rules">${KT.GOLD_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
}

// En-tête toujours visible : or à dépenser, alerte « tout jouer », prochain boss.
function headHtml(state) {
  const parts = [];
  const e = state.advice?.eco;
  if (e) {
    parts.push(`<p class="kt-gold"><span class="kt-coin" aria-hidden="true"></span>Or <b>${e.gold}</b> → <span class="spend">${e.spend} à dépenser</span><span class="m">palier ${e.floor} · +${e.floor / 10}</span></p>`);
    let wall = '';
    if (e.allIn) wall = e.lowHp ? 'Tout jouer : PV sous 40.' : 'Tout jouer : combat difficile.';
    else if (e.nextWall) wall = `Étage ${e.nextWall.floor} (${esc(KT.bossName(e.nextWall.boss))}, ${KT.pct(e.nextWall.win)}) : tout jouer.`;
    if (wall) parts.push(`<p class="kt-warn"><span class="kt-sym kp-no" aria-hidden="true">▼</span>${wall}</p>`);
  }
  const stop = state.torre && KT.nextBossStop(state.torre.stops, state.floor);
  if (stop) {
    const dist = stop.floor - state.floor;
    const lvl = KT.rateLevel(stop.win);
    parts.push(`<div class="kt-boss"><span class="n">${esc(KT.bossName(stop.boss))}</span><span class="kt-rate ${lvl.cls}" title="victoires">${lvl.sym} ${KT.pct(stop.win)}</span>
<span class="w">étage ${stop.floor} · ${dist ? `dans ${dist}` : 'en cours'}</span></div>`);
  } else if (state.torre) {
    parts.push(`<p class="kt-msg"><strong>Aucun boss connu après l’étage ${KT.lastBossFloor(state.torre.stops)}</strong>Les statistiques publiques s’arrêtent là.</p>`);
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
    const label = counted ? ` aria-label="${name} ${count} conseils"` : '';
    return `<button role="tab" id="kt-tab-${id}" data-act="tab" data-tab="${id}" aria-selected="${on}" aria-controls="kt-tabpanel" tabindex="${on ? 0 : -1}"${label}>${name}${badge}</button>`;
  }).join('')}</div>`;
}

const TAB_HTML = { tour: tourHtml, compo: compoHtml, boss: bossTabHtml, rules: state => rulesHtml(state.floor) };

function panelHtml(state, ui) {
  if (!state.torre && !state.error) return '<div class="kt-panel"><p class="kt-msg" role="status">Chargement des statistiques de la Tour…</p></div>';
  if (!state.floor) return '<div class="kt-panel"><p class="kt-msg"><strong>Aucune partie Tour en cours</strong>Les conseils d’achat apparaissent dès qu’une partie Tour est lancée ; tu peux aussi saisir l’étage ci-dessus.</p></div>';
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
  const pins = `<fieldset><legend>Pastilles sur le jeu</legend><div class="kt-checks">${Object.keys(SYM).map(l =>
    `<label><input type="checkbox" name="pins" value="${l}"${ui.pins[l] ? ' checked' : ''}><span>${SYM[l]} ${PIN_NAME[l]}</span></label>`).join('')}</div></fieldset>`;
  return `<h2>Options</h2>${seg(KT.OPTIONS[0])}${pins}${KT.OPTIONS.slice(1).map(seg).join('')}
<p class="kt-hint">Alt+K replie le panneau ; double-clic sur la barre pour le remettre en haut à droite.</p>`;
}

function alertHtml(state) {
  if (!state.error) return '';
  const effect = state.failed.some(k => k !== 'lang')
    ? 'Sans ces données, pas de compo cible : seuls l’économie et les évolutions sont conseillées.'
    : 'Les objets et les sceaux sont nommés par leur identifiant.';
  return `<p class="kt-msg"><strong>Données indisponibles (${esc(state.error)})</strong>${effect} Recharge la page dans une heure.</p>`;
}

function footHtml(state) {
  const cached = state.stale ? ` · copie du ${esc(new Date(state.stale).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}` : '';
  const uncached = state.uncached ? ' · non gardé en cache' : '';
  return `Du ${esc(KT.shortDate(state.torre.from))} au ${esc(KT.shortDate(state.torre.to))}${cached}${uncached} · Data: <a href="https://einoow.com" target="_blank" rel="noopener">Kanto Tactics · einoow.com</a>`;
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

// Colle code dans le Planificateur de la partie Tour affichée. Rend false sans rien toucher quand ce n'est pas le moment :
// pas de partie Tour à l'écran, modale du jeu ou Planificateur déjà ouverts, écran portrait. Rejette avec PlannerError si
// l'interface du jeu ne répond pas comme prévu ou si 10 plans du joueur remplissent déjà le mode. Le Planificateur est
// refermé et le focus rendu.
async function pastePlan(code) {
  const chip = document.querySelector(PLANNER.chip);
  if (!document.querySelector(TOWER_HUD) || !chip || document.querySelector(PLANNER.veil) || document.querySelector('.modal')
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
    if (items().length >= PLANNER_MAX_PLANS) throw new PlannerError(`${PLANNER_MAX_PLANS} plans Tour déjà enregistrés, supprimes-en un`);
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
async function syncPlanner(planner, code, paste = pastePlan) {
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

// Pastilles : nœuds de l'overlay posés sur les éléments du jeu, jamais insérés dans le jeu (un clic n'y achète rien).
function pinLayer(layer) {
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
    const tower = document.querySelector(TOWER_HUD) !== null;
    const modal = document.querySelector('.modal') !== null;
    const found = new Map();
    for (const { pin, t, i } of pins) {
      if (!found.has(t.sel)) found.set(t.sel, [...document.querySelectorAll(t.sel)]);
      const all = found.get(t.sel);
      const el = t.by ? all.find(e => t.by(e, i)) : all[i];
      const r = el?.getBoundingClientRect();
      const show = tower && t.modal === modal && r !== undefined && r.width > 0 && r.height > 0;
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

// Sources indépendantes : sans data.json ou lang.json, le prochain boss et les trios restent affichés.
async function loadSources(state) {
  const sources = [
    ['torre', 'campana.json', KT.SOURCES.torre, j => KT.isTowerData(j?.modes?.torre), j => j.modes.torre],
    ['data', 'data.json', KT.SOURCES.data, KT.isGameData, j => j],
    ['lang', 'lang.json', KT.SOURCES.lang, KT.isLang, j => j],
  ];
  const env = { caches: globalThis.caches, fetch: (...a) => fetch(...a), now: Date.now() };
  const results = await Promise.allSettled(sources.map(([, , url, accept]) => KT.loadJson(url, accept, env)));
  const errors = [];
  const stale = [];
  results.forEach((r, i) => {
    const [key, file, , , pick] = sources[i];
    if (r.status === 'rejected') {
      state.failed.push(key);
      errors.push(`${file} : ${r.reason.message}`);
      return;
    }
    state[key] = pick(r.value.json);
    if (r.value.stale) stale.push(r.value.at);
    if (r.value.uncached) state.uncached = true;
  });
  state.error = errors.length ? errors.join(' ; ') : null;
  state.stale = stale.length ? Math.min(...stale) : null;
}

function mount() {
  const ui = { x: null, y: 16, collapsed: false, avoid: false, aims: true, target: null, ...JSON.parse(localStorage.getItem(KT.UI_KEY) ?? '{}') };
  KT.checkUi(ui);
  const state = { floor: null, source: 'manuel', lastRaw: undefined, lastAuto: null, save: null, torre: null, data: null, lang: null, failed: [], error: null, stale: null, uncached: false, advice: null, copied: null, planner: { code: null, error: null, running: false } };

  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
<div class="kt-root">
<div class="kt" role="complementary" aria-label="Aide Tour Kanto Tactics">
  <div class="kt-bar">
    <span class="kt-lbl">Étage</span>
    <span class="kt-stepper"><button data-act="dec" aria-label="Étage précédent">−</button><input class="kt-floor" inputmode="numeric" aria-label="Étage courant" placeholder="?"><button data-act="inc" aria-label="Étage suivant">+</button></span>
    <span class="kt-src"></span>
    <span class="kt-sum"></span>
    <span class="kt-sp"></span>
    <button class="kt-ibtn" data-act="menu" aria-label="Options" aria-expanded="false" aria-controls="kt-opts">${ICON.gear}</button>
    <button class="kt-ibtn" data-act="toggle"></button>
  </div>
  <div class="kt-alert" role="alert"></div>
  <form class="kt-opts" id="kt-opts" aria-label="Options" hidden></form>
  <div class="kt-body"></div>
  <p class="kt-status" role="status"></p>
  <div class="kt-foot"></div>
</div>
<div class="kp-layer"></div>
</div>`;
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
  const pins = pinLayer(layer);

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
    state.advice = state.save && onSaveFloor(state) && (state.torre || state.error)
      ? KT.advise({ torre: state.torre, data: state.data, lang: state.lang, save: state.save, previous: ui.target, side: ui.side })
      : null;
    if (state.advice?.code !== code) state.copied = null;
    const a = state.advice;
    const next = a?.next?.key ?? null;
    if (a?.target && (a.target.key !== ui.target?.key || a.run !== ui.target?.run || next !== ui.target?.next)) {
      ui.target = { key: a.target.key, run: a.run, next };
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
    if (root.activeElement !== input) input.value = state.floor ?? '';
    input.classList.toggle('is-empty', !state.floor);
    // Réécrire seulement ce qui change : un focus ou une bulle ouverte survit aux réécritures de la sauvegarde.
    const html = panelHtml(state, ui);
    if (html !== lastHtml) {
      // Le focus clavier (onglet, bouton Copier) survit à la réécriture, qui suit chaque changement de la sauvegarde.
      const focused = body.contains(root.activeElement) ? root.activeElement.id : '';
      body.innerHTML = html;
      lastHtml = html;
      if (focused) root.getElementById(focused)?.focus();
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
    foot.hidden = !state.torre;
    if (state.torre) {
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
    syncPlanner(state.planner, state.advice?.code).then(changed => changed && render(), err => {
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

  function pollSave() {
    const raw = localStorage.getItem(KT.SAVE_KEY);
    if (raw === state.lastRaw) return;
    state.lastRaw = raw;
    state.save = KT.parseSave(raw);
    // L'étage saisi à la main tient jusqu'à ce que la sauvegarde change d'étage.
    const f = KT.floorFromSave(raw);
    if (f !== state.lastAuto) {
      state.lastAuto = f;
      if (f !== null) {
        state.floor = f;
        state.source = 'auto';
      } else if (state.source === 'auto') {
        state.floor = null;
        state.source = 'manuel';
      }
    }
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
  // Échap dans le menu le ferme et rend le focus au bouton ⚙.
  opts.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    menuOpen = false;
    render();
    menu.focus();
  });
  // Onglet choisi gardé entre deux sessions.
  function showTab(tab) {
    ui.tab = tab;
    saveUi();
    render();
  }
  // Onglets au clavier (motif ARIA tablist) : flèches, Début et Fin.
  panel.addEventListener('keydown', e => {
    if (!e.target.matches('[role="tab"]')) return;
    const i = KT.TABS.findIndex(([t]) => t === ui.tab);
    const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: KT.TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const tab = KT.TABS[(to + KT.TABS.length) % KT.TABS.length][0];
    showTab(tab);
    root.getElementById(`kt-tab-${tab}`).focus();
  });
  opts.addEventListener('change', e => {
    const { name, value, checked } = e.target;
    if (name === 'pins') ui.pins[value] = checked;
    else ui[name] = value;
    saveUi();
    applyLook();
    if (name === 'side') compute();
    render();
  });
  opts.addEventListener('submit', e => e.preventDefault());
  // Le Shadow DOM ne fait que recibler les événements : sans cet arrêt, les écouteurs du jeu en remontée recevraient
  // les chiffres tapés et les flèches des onglets et des options. Alt+K passe, pour replier le panneau depuis un champ.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    panel.addEventListener(type, e => {
      // Échap remonte depuis un onglet : la fenêtre s'en sert pour fermer la bulle survolée (WCAG 1.4.13).
      const passes = (e.altKey && e.code === 'KeyK') || (e.key === 'Escape' && e.target.matches('[role="tab"]'));
      if (e.target.matches('input, [role="tab"]') && !passes) e.stopPropagation();
    });
  }
  // Sections repliables : état gardé entre deux rendus et deux sessions.
  const FOLDS = { 'kt-avoid': 'avoid', 'kt-aims': 'aims' };
  root.addEventListener('toggle', e => {
    const key = FOLDS[Object.keys(FOLDS).find(c => e.target.classList?.contains(c))];
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

// Les tests reçoivent aussi le pilote du Planificateur, joué sur un faux DOM.
if (typeof module !== 'undefined') module.exports = { ...KT, pastePlan, syncPlanner, statusHtml, PlannerError };
else mount();
