// ==UserScript==
// @name         Kanto Tactics — panneau Tour
// @namespace    https://github.com/Gwagwa42/kanto-overlay
// @version      1.1.0
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
  // Le jeu numérote les manches de la Tour à partir de 1000 : étage = round − 1000 + 1 (assets/route-*.js).
  const ROUND_BASE = 1000;
  const MIN_FIGHTS = 20;
  const HARD_WIN = 45;
  const LOW_HP = 40;
  const INERTIA = 5;
  const OWNED_BONUS = 5;
  // Règles de la Tour v41 lues dans le code du jeu (route-*.js) : absentes de l'API publique.
  const XP_TO_NEXT = [0, 2, 4, 8, 12, 16, 24, 40, 96, 120];
  const XP_COST = 4;
  const REROLL_COST = 2;
  const BASE_INTEREST = 3;
  const FORTUNE_INTEREST = 2;
  const PATH_SIZE = 3;
  const MAX_ITEMS = 3;
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
      return s + (star >= 1 ? OWNED_BONUS : 0) + (star >= 2 ? OWNED_BONUS : 0);
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

  function targetComp(torre, data, game, previous) {
    const stops = nextStops(torre.stops, game.floor);
    if (!stops.length) return null;
    const coresByStop = new Map(stops.map(st => [st.stop, new Map(torre.cores
      .filter(c => c.stop === st.stop && c.n >= MIN_FIGHTS)
      .map(c => [coreKey(c.core), c]))]));
    const candidates = new Map();
    for (const m of coresByStop.values()) for (const [key, c] of m) candidates.set(key, c.core);
    if (!candidates.size) return null;
    let best = null;
    for (const [key, core] of candidates) {
      const score = coreScore(core, stops, coresByStop, game) + (key === previous ? INERTIA : 0);
      if (!best || score > best.score) best = { key, core: [...core], score };
    }
    const chosen = best.core.map(baseLine);
    const pool = [...new Set([...game.units.map(u => baseLine(u.line)), ...game.shop.filter(Boolean)])].filter(b => lineInfo(data, b));
    // Remplissage jusqu'au niveau : lignées qui apportent un type à la compo ; les unités possédées départagent.
    const fillers = [];
    while (chosen.length < game.level) {
      const next = pool
        .filter(b => !chosen.includes(b) && traitGain(data, chosen, b) > 0)
        .sort((a, b) => traitGain(data, chosen, b) - traitGain(data, chosen, a)
          || bestStar(game, b) - bestStar(game, a) || lineLo(torre, b) - lineLo(torre, a) || a.localeCompare(b))[0];
      if (!next) break;
      chosen.push(next);
      fillers.push(next);
    }
    // Preuve affichée dans les bulles : le trio sur le combat le plus dur où il a des statistiques.
    const proof = [...stops].sort((a, b) => b.weight - a.weight)
      .map(st => ({ st, c: coresByStop.get(st.stop).get(best.key) })).find(x => x.c);
    return { key: best.key, core: best.core, fillers, stops, proof };
  }

  const targetBases = target => (target ? [...target.core.map(baseLine), ...target.fillers] : []);

  function progress(game, base) {
    const star = bestStar(game, base);
    return star >= 2 ? '★'.repeat(star) : `${ones(game, base)}/3`;
  }

  // Marque : { level: 'do' | 'opt' | 'no', label, title, why, detail } ; label = texte de la pastille, vide = conseil du panneau
  // seul ; detail = ligne de preuve de la bulle.
  const mark = (level, label, title, why, detail = '') => ({ level, label, title, why, detail });

  function shopMarks(game, target, data, eco, names) {
    const core = target ? target.core.map(baseLine) : [];
    const wanted = targetBases(target);
    const p = target?.proof;
    const proof = p ? `${p.c.core.map(names.line).join(' · ')} : ${pct(p.c.win)} contre ${bossName(p.st.boss)} ${p.st.floor} (${p.c.n} combats, au moins ${pct(p.c.lo)})` : '';
    // Or restant après les achats ★ des cartes précédentes (de gauche à droite).
    let budget = game.gold;
    const buy = (cost, name, why, detail) => {
      // Coût inconnu (données de jeu indisponibles) : le conseil ne peut pas vérifier l'or.
      if (cost !== undefined && cost > budget) return mark('opt', 'Si l’or', `Achète ${name} dès que possible`, `${why} ; il manque de l’or`, detail);
      budget -= cost ?? 0;
      return mark('do', 'Achète', `Achète ${name}`, why, detail);
    };
    return game.shop.map((base, i) => {
      if (!base) return null;
      const name = names.line(base);
      const triple = ones(game, base) === 2;
      const inTarget = wanted.includes(base);
      const cost = lineInfo(data, base)?.c;
      const keepsFloor = (cost !== undefined && game.gold - cost >= eco.floor) || eco.allIn;
      if (triple && (inTarget || !target)) return buy(cost, name, core.includes(base) ? '3ᵉ copie, passe ★★ ; cœur de la compo cible' : '3ᵉ copie, passe ★★', core.includes(base) ? proof : '');
      if (core.includes(base)) return buy(cost, name, 'cœur de la compo cible', proof);
      if (game.shopShiny[i] && inTarget) return buy(cost, `${name} shiny`, '+10 % PV, défenses et dégâts');
      if (!target) return null;
      if ((inTarget || triple) && keepsFloor) {
        return mark('opt', 'Si l’or', `${name} si l’or reste ≥ ${eco.floor}`, triple ? '3ᵉ copie hors compo' : 'renforce le plateau de la compo');
      }
      return mark('no', 'Ignore', `Ignore ${name}`, inTarget ? `garde ${eco.floor} pièces pour les intérêts` : 'hors compo cible');
    });
  }

  function targetIncomplete(game, target) {
    return target.core.some(id => bestStar(game, baseLine(id)) < 2);
  }

  // committed : or des achats ★ déjà conseillés dans la boutique, à retirer avant d'actualiser ou de monter.
  function rerollMark(game, target, eco, committed) {
    if (!target || !targetIncomplete(game, target)) return null;
    const left = game.gold - committed;
    if (eco.allIn) return left >= REROLL_COST ? mark('do', 'Actualise', 'Actualise', 'tout jouer : chercher les copies de la compo') : null;
    if (left - REROLL_COST >= eco.floor) return mark('do', 'Actualise', 'Actualise', `surplus au-dessus de ${eco.floor} pièces après les achats`);
    return mark('no', 'Garde l’or', 'N’actualise pas', `tu passerais sous ${eco.floor} pièces`);
  }

  function xpMark(game, eco, committed) {
    const max = game.floor >= 60 ? 10 : 9;
    if (game.level >= max) return null;
    const missing = XP_TO_NEXT[game.level] - game.xp;
    const left = game.gold - committed;
    const toLevel = Math.ceil(missing / XP_COST) * XP_COST;
    if (eco.allIn) return left >= toLevel ? mark('do', 'Monte', 'Achète de l’XP', `tout jouer : niveau ${game.level + 1} pour ${toLevel} pièces`) : null;
    if (missing <= XP_COST && left - XP_COST >= eco.floor) return mark('do', 'Monte', 'Achète de l’XP', `niveau ${game.level + 1} pour ${XP_COST} pièces`);
    return mark('no', 'Attends', 'N’achète pas d’XP', `encore ${missing} XP ; l’XP gratuite arrive à chaque étage`);
  }

  function sellMarks(game, target, data, names, shop) {
    if (!target) return game.bench.map(() => null);
    const wanted = targetBases(target);
    const free = game.bench.filter(id => !id).length;
    const wantedCost = Math.min(Infinity, ...shop.map((m, i) => (m?.level === 'do' ? lineInfo(data, game.shop[i])?.c ?? Infinity : Infinity)));
    const short = game.gold < wantedCost && wantedCost !== Infinity;
    return game.bench.map(id => {
      const u = id && game.units.find(x => x.id === id);
      if (!u) return null;
      const base = baseLine(u.line);
      const paired = game.units.some(x => x.id !== u.id && baseLine(x.line) === base && x.star === u.star);
      if (wanted.includes(base) || paired || (free > 1 && !short)) return null;
      return mark('no', 'Vends', `Vends ${names.line(u.line)}`, free > 1 ? 'il manque de l’or pour un achat conseillé' : 'hors compo, libère le banc');
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

  function idealItems(torre, data, line) {
    const full = h => data.items[h.id]?.k === 'full';
    const pick = id => torre.holders.filter(h => h.line === id && h.n >= MIN_FIGHTS && full(h)).sort((a, b) => b.lo - a.lo);
    const list = pick(line).length ? pick(line) : pick(baseLine(line));
    return list.slice(0, MAX_ITEMS).map(h => h.id);
  }

  // Porteur (objets offensifs) et tank (portée 1, PV max) parmi les unités possédées de la compo cible.
  function holdersOf(torre, data, game, target) {
    const coreUnits = game.units.filter(u => target.core.some(id => baseLine(id) === baseLine(u.line)));
    const carry = [...coreUnits].sort((a, b) => b.star - a.star || lineLo(torre, b.line) - lineLo(torre, a.line))[0];
    const hp = u => lineInfo(data, baseLine(u.line))?.stars?.[u.star - 1]?.stats.hp ?? 0;
    const tank = game.units
      .filter(u => u !== carry && targetBases(target).includes(baseLine(u.line)) && lineInfo(data, baseLine(u.line))?.range === 1)
      .sort((a, b) => hp(b) - hp(a))[0];
    return [['carry', carry], ['tank', tank]].filter(([, u]) => u).map(([role, u]) => ({ role, unit: u, ideal: idealItems(torre, data, u.line) }));
  }

  function itemMarks(torre, data, game, target, eco, names) {
    const marks = game.bag.map(() => null);
    if (!target || !data) return marks;
    const book = recipeBook(data);
    const holders = holdersOf(torre, data, game, target);
    const bagCount = id => game.bag.filter(x => x === id).length;
    game.bag.forEach((id, i) => {
      const item = data.items[id];
      const name = names.item(id);
      if (id === 'magnet') {
        const wanted = targetBases(target);
        const off = game.units.find(u => u.items?.length && !wanted.includes(baseLine(u.line)));
        if (off) marks[i] = mark('do', `Retire de ${names.line(off.line)}`, `Aimant sur ${names.line(off.line)}`, 'récupère ses objets : il sort de la compo');
        return;
      }
      for (const h of holders) {
        const on = h.unit.items ?? [];
        if (on.length >= MAX_ITEMS && item?.k !== 'part') continue;
        const who = names.line(h.unit.line);
        if (item?.k === 'full' && h.ideal.includes(id) && !on.includes(id)) {
          marks[i] = mark('do', `→ ${who}`, `${name} → ${who}`, 'meilleur objet de sa lignée en Tour');
          return;
        }
        if (item?.k !== 'part') continue;
        for (const full of h.ideal.filter(f => !on.includes(f))) {
          const [a, b] = book.parts.get(full) ?? [];
          if (a !== id && b !== id) continue;
          const partner = a === id ? b : a;
          const ready = on.includes(partner) || bagCount(partner) >= (partner === id ? 2 : 1);
          if (ready) {
            marks[i] = mark('do', `→ ${who}`, `${names.item(a)} + ${names.item(b)} → ${who}`, `${names.item(full)}, meilleur objet de sa lignée en Tour`);
            return;
          }
        }
      }
      const carry = holders.find(h => h.role === 'carry');
      if (eco.allIn && item?.k === 'part' && carry) {
        const partner = game.bag.find((p, j) => j !== i && book.make.has(`${id}+${p}`));
        if (partner) {
          const who = names.line(carry.unit.line);
          marks[i] = mark('do', `→ ${who}`, `${name} → ${who}`, `tout jouer : ${names.item(book.make.get(`${id}+${partner}`))} tout de suite`);
          return;
        }
      }
      marks[i] = mark('opt', 'Garde', `Garde ${name}`, 'en attendant sa recette idéale');
    });
    return marks;
  }

  function offerMarks(torre, data, game, target, names) {
    if (!target || !data || !game.reward.length) return game.reward.map(() => null);
    const book = recipeBook(data);
    const holders = holdersOf(torre, data, game, target);
    const have = id => game.bag.includes(id) || holders.some(h => h.unit.items?.includes(id));
    const score = id => {
      let s = 0;
      for (const h of holders) {
        for (const full of h.ideal) {
          if (full === id) s = Math.max(s, 3);
          const [a, b] = book.parts.get(full) ?? [];
          if (a === id || b === id) s = Math.max(s, have(a === id ? b : a) ? 2 : 1);
        }
      }
      return s;
    };
    const scores = game.reward.map(score);
    const best = Math.max(...scores);
    return game.reward.map((id, i) => (best > 0 && scores[i] === best && scores.indexOf(best) === i
      ? mark('do', 'Prends', `Prends ${names.item(id)}`, best === 2 ? 'complète une recette idéale' : 'sert la recette idéale de ton porteur')
      : null));
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
      unknown.push(id);
      return null;
    });
    const best = Math.max(...scored.filter(Boolean).map(x => x.s));
    const marks = scored.map(x => {
      if (!x) return null;
      if (best > 0 && x.s === best && scored.find(y => y?.s === best) === x) {
        const path = boonPath(x.id);
        const why = x.seal ? 'sceau le plus utile pour ta situation'
          : game.hp < LOW_HP && HEAL_BOONS.includes(x.id) ? `PV bas (${game.hp})`
            : path ? `voie ${PATH_NAMES[path]} : ${pathCount(game.boons, path) + 1} sur ${PATH_SIZE}` : 'meilleur effet immédiat';
        const detail = !x.seal && path ? `À ${PATH_SIZE} : ${PATH_BONUS[path]}.` : '';
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
      // L'ancrage prend effet à la prochaine fusion : conseillé quand elle est imminente (2 copies à 1★).
      if (n === null || game.anchor[base] === n || ones(game, base) < 2) return [];
      return [mark('do', '', `Ancre ${names.stage(base, n)} (fiche du Pokémon)`, 'forme gagnante de la compo, avant sa prochaine fusion')];
    });
  }

  // Formation KT1 : cellule = rangée × 7 + colonne, rangée 0 = avant (doc de l'API).
  function formation(target, game, data, torre, side) {
    const ids = [...target.core, ...target.fillers];
    const holders = holdersOf(torre, data, game, target);
    const roleBase = role => {
      const h = holders.find(x => x.role === role);
      return h && baseLine(h.unit.line);
    };
    const carry = roleBase('carry');
    const tank = roleBase('tank');
    const units = ids.map(id => {
      const base = baseLine(id);
      const h = holders.find(x => baseLine(x.unit.line) === base);
      return { line: id, base, star: Math.max(1, bestStar(game, base)), items: h ? h.ideal : [], ranged: (lineInfo(data, base)?.range ?? 1) > 1 };
    });
    const front = units.filter(u => !u.ranged).sort((a, b) => Number(b.base === tank) - Number(a.base === tank));
    const back = units.filter(u => u.ranged).sort((a, b) => Number(b.base === carry) - Number(a.base === carry));
    const edge = side === 'right' ? [6, 4, 2, 0, 5, 1, 3] : [0, 2, 4, 6, 1, 5, 3];
    const place = (list, rows, cols) => list.map((u, i) => ({ ...u, cell: rows[Math.floor(i / 7)] * 7 + cols[i % 7] }));
    return [...place(front, [0, 1], [3, 2, 4, 1, 5, 0, 6]), ...place(back, [3, 2], edge)];
  }

  function kt1Code(units, rules) {
    const parts = units.map(u => `${u.line}:${u.star}:${u.cell}${u.items.length ? `:${u.items.join('.')}` : ''}`);
    return ['KT1', `r${rules}`, 'xm=tower', `xn=${encodeURIComponent('Plan kanto-overlay')}`, ...parts].join(';');
  }

  function advise({ torre, data, lang, save, previous, side }) {
    const names = namer(lang);
    const game = readGame(save);
    const stops = torre ? nextStops(torre.stops, game.floor) : [];
    const eco = economy(game, stops);
    const target = torre && data ? targetComp(torre, data, game, previous) : null;
    const shop = shopMarks(game, target, data, eco, names);
    const committed = shop.reduce((sum, m, i) => sum + (m?.level === 'do' ? lineInfo(data, game.shop[i])?.c ?? 0 : 0), 0);
    const choice = offerChoiceMarks(data, game, eco, names);
    return {
      game, eco, target, names,
      shop,
      reroll: rerollMark(game, target, eco, committed),
      xp: xpMark(game, eco, committed),
      bench: sellMarks(game, target, data, names, shop),
      bag: itemMarks(torre, data, game, target, eco, names),
      reward: offerMarks(torre, data, game, target, names),
      offer: choice.marks,
      unknownOffer: choice.unknown,
      anchor: anchorAdvice(target, game, names),
      code: target ? kt1Code(formation(target, game, data, torre, side), torre.rules) : null,
    };
  }

  // Cache Storage d'une heure (conditions de l'API), revalidé par ETag ; une réponse au format inattendu n'écrase jamais la
  // copie gardée. env = { caches, fetch, now } : globaux du navigateur, injectables pour les tests.
  async function loadJson(url, accept, env) {
    let cache;
    try {
      cache = await env.caches.open(CACHE_NAME);
    } catch (e) {
      // Firefox refuse le Cache Storage en navigation privée ou quand le stockage du site est bloqué.
      if (e instanceof DOMException) throw new Error('cache du navigateur indisponible : navigation privée ou stockage bloqué');
      throw e;
    }
    const hit = await cache.match(url);
    const at = Number(hit?.headers.get('x-kt-at'));
    const keep = async (body, etag) => {
      await cache.put(url, new Response(body, { headers: { 'content-type': 'application/json', etag: etag ?? '', 'x-kt-at': String(env.now) } }));
    };
    if (hit && isFresh(at, env.now)) return { json: await hit.json(), at, stale: false };
    // L'API ne reconnaît pas la forme faible W/"…" que reçoit le navigateur (réponse compressée) : même étiquette, sans le préfixe.
    const etag = hit?.headers.get('etag')?.replace(/^W\//, '');
    const stale = async reason => {
      if (!hit) throw new Error(reason);
      return { json: await hit.json(), at, stale: true };
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
      const cached = await hit.text();
      await keep(cached, etag);
      return { json: JSON.parse(cached), at: env.now, stale: false };
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
    await keep(body, res.headers.get('etag'));
    return { json, at: env.now, stale: false };
  }

  const pct = x => `${x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const shortDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return {
    SOURCES, SAVE_KEY, UI_KEY, GOLD_RULES, BOONS, lineInfo, loadJson,
    parseSave, floorFromSave, isTowerData, isGameData, isLang, isFresh, lastBossFloor, nextBossStop, nextStops, topCores,
    baseLine, namer, bossName, guideFor, rateLevel, readGame, goldFloor, targetComp, progress, anchorAdvice, advise, pct, shortDate,
  };
})();

const CSS = `
:host { all: initial;
  /* Pastilles : couleurs fixes, posées sur le jeu toujours sombre ; bord sombre + liseré blanc = contraste sur les deux fonds */
  --kp-do-bg:#0072b2; --kp-do-fg:#fff; --kp-opt-bg:#fff; --kp-opt-fg:#141a33; --kp-no-bg:#f0e442; --kp-no-fg:#141a33;
  --kp-edge:#141a33; --kp-ring:#fff; --kp-focus:#56b4e9; --kp-tip-bg:#141a33; --kp-tip-fg:#eef1ff; --kp-tip-muted:#aab3d6;
  --kt-space-1:4px; --kt-space-2:8px; --kt-space-3:12px; --kt-space-4:16px; --kt-font:system-ui,-apple-system,"Segoe UI",sans-serif; }
.kt { --kt-surface:#fff; --kt-surface-2:#eef1fa; --kt-text:#141a33; --kt-muted:#4a5378; --kt-border:#c9cfe6; --kt-control:#737c9c;
  --kt-focus:#0072b2; --kt-good-bg:#0072b2; --kt-good-fg:#fff; --kt-bad-bg:#f0e442; --kt-bad-fg:#141a33; --kt-mid-bg:#dfe3f2; --kt-mid-fg:#141a33;
  --kt-radius:12px;
  position: fixed; z-index: 2147483647; width: 320px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; box-sizing: border-box;
  background: var(--kt-surface); color: var(--kt-text); border: 1px solid var(--kt-border); border-radius: var(--kt-radius);
  box-shadow: 0 8px 24px rgb(0 0 0 / .35); font: 14px/1.4 var(--kt-font); font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: dark) {
  .kt { --kt-surface:#141a33; --kt-surface-2:#1e2647; --kt-text:#eef1ff; --kt-muted:#aab3d6; --kt-border:#33406e; --kt-control:#7a86b8;
    --kt-focus:#56b4e9; --kt-good-bg:#56b4e9; --kt-good-fg:#141a33; --kt-mid-bg:#2c3660; --kt-mid-fg:#eef1ff; }
}
.kt * { box-sizing: border-box; }
.kt-bar { display: flex; align-items: center; gap: var(--kt-space-2); padding: var(--kt-space-2) var(--kt-space-3); background: var(--kt-surface-2); cursor: move; touch-action: none; user-select: none; }
.kt-title { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt-src { font-size: 12px; color: var(--kt-muted); min-width: 6.5ch; text-align: center; }
.kt-btn { min-width: 28px; height: 28px; border: 1px solid var(--kt-control); border-radius: 8px; background: var(--kt-surface); color: var(--kt-text); font: inherit; cursor: pointer; }
.kt-floor { width: 56px; height: 28px; border: 1px solid var(--kt-control); border-radius: 8px; background: var(--kt-surface); color: var(--kt-text); font: inherit; text-align: center; }
.kt-floor.is-empty { border-color: var(--kt-focus); border-width: 2px; }
.kt-btn:focus-visible, .kt-floor:focus-visible, .kt a:focus-visible, .kt summary:focus-visible { outline: 2px solid var(--kt-focus); outline-offset: 2px; }
.kt-body { padding: var(--kt-space-3); display: grid; gap: var(--kt-space-3); }
.kt p { margin: 0; }
.kt-label { font-size: 12px; color: var(--kt-muted); }
.kt-boss { font-size: 18px; font-weight: 700; }
.kt-boss small { font-size: 14px; font-weight: 400; color: var(--kt-muted); }
.kt-stats { display: flex; flex-wrap: wrap; gap: var(--kt-space-2); align-items: center; font-size: 12px; color: var(--kt-muted); }
.kt-rate { display: inline-block; padding: 2px var(--kt-space-2); border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.kt-rate.good { background: var(--kt-good-bg); color: var(--kt-good-fg); }
.kt-rate.bad { background: var(--kt-bad-bg); color: var(--kt-bad-fg); }
.kt-rate.mid { background: var(--kt-mid-bg); color: var(--kt-mid-fg); }
.kt-cores { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-space-1); }
.kt-cores li { display: grid; grid-template-columns: 1fr auto; gap: 0 var(--kt-space-2); padding: var(--kt-space-2); background: var(--kt-surface-2); border-radius: 8px; }
.kt-cores .n { grid-column: 1; font-size: 12px; color: var(--kt-muted); }
.kt-cores .kt-rate { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
.kt-guide { border-top: 1px solid var(--kt-border); padding-top: var(--kt-space-2); }
.kt-guide summary { font-weight: 600; cursor: pointer; min-height: 24px; }
.kt-guide p, .kt-guide ul { margin: var(--kt-space-1) 0 0; font-size: 12px; }
.kt-guide ul { padding-left: var(--kt-space-4); }
.kt-msg { padding: var(--kt-space-2) var(--kt-space-3); border-radius: 8px; background: var(--kt-surface-2); }
.kt-msg strong { display: block; }
.kt-foot { padding: var(--kt-space-2) var(--kt-space-3); font-size: 12px; color: var(--kt-muted); border-top: 1px solid var(--kt-border); }
.kt-foot a { color: inherit; white-space: nowrap; }
.kt.is-collapsed .kt-body, .kt.is-collapsed .kt-foot { display: none; }
.kt-plan { display: grid; gap: var(--kt-space-2); }
.kt-comp { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--kt-space-1); }
.kt-comp li { padding: 2px var(--kt-space-2); border-radius: 8px; background: var(--kt-surface-2); font-size: 12px; }
.kt-comp li.core { font-weight: 700; }
.kt-comp .p { color: var(--kt-muted); font-weight: 400; }
.kt-eco { font-size: 12px; color: var(--kt-muted); }
.kt-eco b { color: var(--kt-text); }
.kt-todo { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-space-1); font-size: 12px; }
.kt-todo li { display: grid; grid-template-columns: 20px 1fr; gap: var(--kt-space-1); align-items: baseline; }
.kt-todo .why { color: var(--kt-muted); }
.kt-sym { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 999px; font-weight: 700; border: 1px solid var(--kp-edge); }
.kt-actions { display: flex; gap: var(--kt-space-2); }
.kt-copy { flex: 1; height: 32px; border: 0; border-radius: 8px; background: var(--kt-good-bg); color: var(--kt-good-fg); font: 600 14px var(--kt-font); cursor: pointer; }
.kt-side { height: 32px; padding: 0 var(--kt-space-2); font-size: 12px; }
.kt-copy:focus-visible { outline: 2px solid var(--kt-focus); outline-offset: 2px; }
.kt-copied { padding: 0 var(--kt-space-3) var(--kt-space-2); font-size: 12px; color: var(--kt-muted); overflow-wrap: anywhere; }
.kt-copied:empty { display: none; }
.kt-copied code { font-size: 12px; user-select: all; }
.kt.is-collapsed .kt-copied { display: none; }
.kp-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.kp { position: fixed; display: inline-flex; align-items: center; gap: var(--kt-space-1); height: 24px; min-width: 24px; padding: 0 var(--kt-space-2); translate: -50% 0;
  border-radius: 999px; border: 1px solid var(--kp-edge); font: 700 12px/1 var(--kt-font); white-space: nowrap; cursor: help;
  pointer-events: auto; box-shadow: 0 0 0 1px var(--kp-ring), 0 1px 3px rgb(0 0 0 / .4); }
.kp[hidden] { display: none; }
/* Cible étroite (case d'objet, banc) : symbole seul, verbe gardé pour les lecteurs d'écran. */
.kp.is-compact { justify-content: center; padding: 0 var(--kt-space-1); }
.kp.is-compact .kp-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.kp-do, .kt-sym.kp-do { background: var(--kp-do-bg); color: var(--kp-do-fg); }
.kp-opt, .kt-sym.kp-opt { background: var(--kp-opt-bg); color: var(--kp-opt-fg); }
.kp-no, .kt-sym.kp-no { background: var(--kp-no-bg); color: var(--kp-no-fg); }
.kp:focus-visible { outline: 2px solid var(--kp-focus); outline-offset: 2px; }
.kp-tip { display: none; position: absolute; left: 50%; translate: -50% 0; bottom: calc(100% + var(--kt-space-2)); width: 240px; padding: var(--kt-space-2) var(--kt-space-3);
  border-radius: 8px; background: var(--kp-tip-bg); color: var(--kp-tip-fg); font: 400 12px/1.4 var(--kt-font); white-space: normal;
  text-align: left; box-shadow: 0 8px 24px rgb(0 0 0 / .45); }
.kp.is-below .kp-tip { bottom: auto; top: calc(100% + var(--kt-space-2)); }
/* Près d'un bord, la bulle s'aligne sur la pastille au lieu de se centrer (sinon coupée par la fenêtre). */
.kp.is-left .kp-tip { left: 0; translate: 0 0; }
.kp.is-right .kp-tip { left: auto; right: 0; translate: 0 0; }
.kp:hover .kp-tip, .kp:focus-visible .kp-tip { display: block; }
/* La pastille survolée ou sélectionnée passe devant ses voisines, bulle comprise. */
.kp:hover, .kp:focus-visible { z-index: 1; }
.kp.is-dismissed .kp-tip { display: none; }
.kp-tip strong { display: block; font-size: 14px; margin-bottom: var(--kt-space-1); }
.kp-tip .m { display: block; margin-top: var(--kt-space-1); color: var(--kp-tip-muted); }
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

function mount() {
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const ui = { x: null, y: 16, collapsed: false, guide: true, side: 'left', target: null, ...JSON.parse(localStorage.getItem(KT.UI_KEY) ?? '{}') };
  const state = { floor: null, source: 'manuel', lastRaw: undefined, lastAuto: null, save: null, torre: null, data: null, lang: null, failed: [], error: null, stale: null, advice: null, copied: null };

  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
<div class="kt" role="complementary" aria-label="Aide Tour Kanto Tactics">
  <div class="kt-bar">
    <span class="kt-title">Étage</span>
    <button class="kt-btn" data-act="dec" aria-label="Étage précédent">−</button>
    <input class="kt-floor" inputmode="numeric" aria-label="Étage courant" placeholder="?">
    <button class="kt-btn" data-act="inc" aria-label="Étage suivant">+</button>
    <span class="kt-src"></span>
    <button class="kt-btn" data-act="toggle"></button>
  </div>
  <div class="kt-body"></div>
  <p class="kt-copied" role="status"></p>
  <div class="kt-foot"></div>
</div>
<div class="kp-layer"></div>`;
  document.body.append(host);
  const panel = root.querySelector('.kt');
  const layer = root.querySelector('.kp-layer');
  const input = root.querySelector('.kt-floor');
  const body = root.querySelector('.kt-body');
  const foot = root.querySelector('.kt-foot');
  const toggle = root.querySelector('[data-act="toggle"]');
  const src = root.querySelector('.kt-src');
  const status = root.querySelector('.kt-copied');

  const saveUi = () => localStorage.setItem(KT.UI_KEY, JSON.stringify(ui));

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

  function guideHtml(floor) {
    const g = KT.guideFor(floor);
    const range = g.to === Infinity ? `étages ${g.from} et plus` : `étages ${g.from}–${g.to}`;
    const shinies = g.shinies.length
      ? `Shinies à saisir : ${esc(g.shinies.join(', '))}. ${esc(g.advice)} (conseil non vérifié ; un shiny a +10 % de PV, de défenses et de dégâts).`
      : esc(g.advice);
    return `<details class="kt-guide"${ui.guide ? ' open' : ''}><summary>Règles d’or · ${range}</summary>
<p>${shinies}</p><ul>${KT.GOLD_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>`;
  }

  const allMarks = a => [...a.shop, a.reroll, a.xp, ...a.bench, ...a.bag, ...a.reward, ...a.offer, ...a.anchor].filter(Boolean);

  function todoHtml(a) {
    const order = { do: 0, opt: 1, no: 2 };
    const seen = new Set();
    const items = allMarks(a).sort((x, y) => order[x.level] - order[y.level]).filter(m => !seen.has(m.title) && seen.add(m.title));
    const lines = items.map(m => `<li><span class="kt-sym kp-${m.level}" role="img" aria-label="${LEVEL_NAME[m.level]}">${SYM[m.level]}</span><span>${esc(m.title)} <span class="why">— ${esc(m.why)}</span></span></li>`);
    for (const id of a.unknownOffer) lines.push(`<li><span></span><span>Bénédiction inconnue (${esc(id)}) <span class="why">— pas de conseil</span></span></li>`);
    return lines.length ? `<ol class="kt-todo" aria-label="Conseils">${lines.join('')}</ol>` : '';
  }

  function ecoHtml(a) {
    const e = a.eco;
    let wall = '';
    if (e.allIn) wall = e.lowHp ? ` Tout jouer : PV sous 40.` : ' Tout jouer : combat difficile.';
    else if (e.nextWall) wall = ` À l’étage ${e.nextWall.floor} (${esc(KT.bossName(e.nextWall.boss))}, ${KT.pct(e.nextWall.win)}) : tout jouer.`;
    return `<p class="kt-eco">Or <b>${e.gold}</b> · palier ${e.floor} (intérêts +${e.floor / 10}) → <b>${e.spend} à dépenser</b>.${wall}</p>`;
  }

  function planHtml(a) {
    if (!a.target) return `<div class="kt-plan">${ecoHtml(a)}${todoHtml(a)}</div>`;
    const t = a.target;
    const stops = t.stops.map(s => `${KT.bossName(s.boss)} ${s.floor}`).join(', ');
    const chip = (id, core) => `<li${core ? ' class="core"' : ''}>${esc(a.names.line(id))} <span class="p">${KT.progress(a.game, KT.baseLine(id))}</span></li>`;
    return `<div class="kt-plan"><p class="kt-label">Compo cible · ${esc(stops)}</p>
<ul class="kt-comp">${t.core.map(id => chip(id, true)).join('')}${t.fillers.map(id => chip(id, false)).join('')}</ul>
${ecoHtml(a)}${todoHtml(a)}
<div class="kt-actions"><button class="kt-copy" data-act="copy">Copier la formation</button>
<button class="kt-btn kt-side" data-act="side" aria-label="Côté du porteur dans la formation">Porteur : ${ui.side === 'left' ? 'gauche' : 'droite'}</button></div></div>`;
  }

  function bossHtml() {
    if (!state.torre) return '';
    const stop = KT.nextBossStop(state.torre.stops, state.floor);
    if (!stop) {
      return `<p class="kt-msg"><strong>Aucun boss connu après l’étage ${KT.lastBossFloor(state.torre.stops)}</strong>Les statistiques publiques s’arrêtent là.</p>`;
    }
    const dist = stop.floor - state.floor;
    const lvl = KT.rateLevel(stop.win);
    const names = KT.namer(state.lang);
    const cores = KT.topCores(state.torre.cores, stop.stop);
    const coresHtml = cores.length
      ? `<ol class="kt-cores">${cores.map(c => {
        const l = KT.rateLevel(c.win);
        return `<li><span>${esc(c.core.map(names.line).join(' · '))}</span><span class="kt-rate ${l.cls}">${l.sym} ${KT.pct(c.win)}</span><span class="n">${c.n} combats</span></li>`;
      }).join('')}</ol>`
      : '<p class="kt-msg">Aucun trio n’a encore 20 combats sur ce boss.</p>';
    return `<div><p class="kt-label">Prochain boss</p>
<p class="kt-boss">${esc(KT.bossName(stop.boss))} <small>· étage ${stop.floor}, ${dist ? `dans ${dist}` : 'en cours'}</small></p>
<p class="kt-stats"><span class="kt-rate ${lvl.cls}">${lvl.sym} ${KT.pct(stop.win)} victoires</span> 1er essai ${KT.pct(stop.first)} · ${stop.tries.toLocaleString('fr-FR')} essais</p></div>
${state.advice ? planHtml(state.advice) : ''}
<div><p class="kt-label">Meilleurs trios (≥ 20 combats)</p>${coresHtml}</div>`;
  }

  function contentHtml() {
    const effect = state.failed.some(k => k !== 'lang')
      ? 'Sans ces données, pas de compo cible : seuls l’économie et les évolutions sont conseillées.'
      : 'Les objets et les sceaux sont nommés par leur identifiant.';
    const alert = state.error
      ? `<p class="kt-msg" role="alert"><strong>Données indisponibles (${esc(state.error)})</strong>${effect} Recharge la page dans une heure.</p>`
      : '';
    if (state.error && !state.torre) {
      const more = state.floor ? '' : '<p class="kt-msg">Saisis l’étage pour afficher les règles d’or.</p>';
      return `${alert}${state.advice ? planHtml(state.advice) : ''}${more}${state.floor ? guideHtml(state.floor) : ''}`;
    }
    if (!state.torre) return '<p class="kt-msg" role="status">Chargement des statistiques de la Tour…</p>';
    if (!state.floor) return `${alert}<p class="kt-msg"><strong>Aucune partie Tour en cours</strong>Les conseils d’achat apparaissent dès qu’une partie Tour est lancée ; tu peux aussi saisir l’étage ci-dessus.</p>`;
    return `${alert}${bossHtml()}${guideHtml(state.floor)}`;
  }

  // Pastilles : nœuds de l'overlay posés sur les éléments du jeu, jamais insérés dans le jeu (un clic n'y achète rien).
  let lastHtml = null;
  let lastCopied = '';
  let lastPins = null;
  let pins = [];
  function paint() {
    const a = state.advice;
    const sig = JSON.stringify(a && Object.keys(TARGETS).map(g => a[g]));
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
        if (!m || !m.label) return;
        const pin = document.createElement('span');
        pin.className = `kp kp-${m.level}`;
        pin.tabIndex = 0;
        pin.setAttribute('role', 'note');
        const tipId = `kp-tip-${n++}`;
        pin.setAttribute('aria-describedby', tipId);
        pin.innerHTML = `${SYM[m.level]} <span class="kp-text">${esc(m.label)}</span><span class="kp-tip" id="${tipId}" role="tooltip"><strong>${esc(m.title)}</strong>${esc(m.why)}${m.detail ? `<span class="m">${esc(m.detail)}</span>` : ''}</span>`;
        for (const type of ['mouseleave', 'blur']) pin.addEventListener(type, () => pin.classList.remove('is-dismissed'));
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

  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      position();
    });
  };

  function compute() {
    const code = state.advice?.code;
    state.advice = state.save && (state.torre || state.error)
      ? KT.advise({ torre: state.torre, data: state.data, lang: state.lang, save: state.save, previous: ui.target, side: ui.side })
      : null;
    if (state.advice?.code !== code) state.copied = null;
    const key = state.advice?.target?.key ?? ui.target;
    if (key !== ui.target) {
      ui.target = key;
      saveUi();
    }
  }

  function render() {
    panel.classList.toggle('is-collapsed', ui.collapsed);
    toggle.textContent = ui.collapsed ? '▸' : '▾';
    toggle.setAttribute('aria-label', ui.collapsed ? 'Déplier le panneau' : 'Replier le panneau');
    toggle.setAttribute('aria-expanded', String(!ui.collapsed));
    src.textContent = state.source;
    if (root.activeElement !== input) input.value = state.floor ?? '';
    input.classList.toggle('is-empty', !state.floor);
    // Réécrire seulement ce qui change : un focus ou une bulle ouverte survit aux réécritures de la sauvegarde.
    const html = contentHtml();
    if (html !== lastHtml) {
      body.innerHTML = html;
      lastHtml = html;
    }
    foot.hidden = !state.torre;
    if (state.torre) {
      const cached = state.stale ? ` · copie du ${esc(new Date(state.stale).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}` : '';
      foot.innerHTML = `Du ${esc(KT.shortDate(state.torre.from))} au ${esc(KT.shortDate(state.torre.to))}${cached} · Data: <a href="https://einoow.com" target="_blank" rel="noopener">Kanto Tactics · einoow.com</a>`;
    }
    const copied = state.copied === null ? ''
      : state.copied.ok ? 'Code copié : colle-le dans Planificateur → Coller un code.'
        : `Copie refusée par le navigateur : sélectionne le code et copie-le.<br><code>${esc(state.advice?.code ?? '')}</code>`;
    if (copied !== lastCopied) {
      status.innerHTML = copied;
      lastCopied = copied;
    }
    place();
    paint();
  }

  function setManual(floor) {
    state.floor = Number.isInteger(floor) && floor >= 1 ? floor : null;
    state.source = 'manuel';
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
    if (act === 'toggle') {
      ui.collapsed = !ui.collapsed;
      saveUi();
      render();
    }
    if (act === 'side') {
      ui.side = ui.side === 'left' ? 'right' : 'left';
      saveUi();
      compute();
      render();
    }
    if (act === 'copy' && state.advice?.code) {
      navigator.clipboard.writeText(state.advice.code).then(() => {
        state.copied = { ok: true };
        render();
      }, () => {
        state.copied = { ok: false };
        render();
      });
    }
  });
  input.addEventListener('change', () => setManual(Number.parseInt(input.value, 10)));
  // Le Shadow DOM ne fait que recibler les événements : sans cet arrêt, les écouteurs du jeu en remontée recevraient
  // les chiffres tapés. Alt+K passe, pour replier le panneau depuis le champ.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    input.addEventListener(type, e => {
      if (!(e.altKey && e.code === 'KeyK')) e.stopPropagation();
    });
  }
  root.addEventListener('toggle', e => {
    if (!e.target.matches('.kt-guide') || ui.guide === e.target.open) return;
    ui.guide = e.target.open;
    saveUi();
  }, true);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      for (const pin of layer.querySelectorAll('.kp:hover, .kp:focus')) pin.classList.add('is-dismissed');
      return;
    }
    if (!e.altKey || e.code !== 'KeyK') return;
    e.preventDefault();
    ui.collapsed = !ui.collapsed;
    saveUi();
    render();
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

  render();
  pollSave();
  setInterval(pollSave, 2000);

  // Sources indépendantes : sans data.json ou lang.json, le prochain boss et les trios restent affichés.
  const sources = [
    ['torre', 'campana.json', KT.SOURCES.torre, j => KT.isTowerData(j?.modes?.torre), j => j.modes.torre],
    ['data', 'data.json', KT.SOURCES.data, KT.isGameData, j => j],
    ['lang', 'lang.json', KT.SOURCES.lang, KT.isLang, j => j],
  ];
  const env = { caches, fetch: (...a) => fetch(...a), now: Date.now() };
  Promise.allSettled(sources.map(([, , url, accept]) => KT.loadJson(url, accept, env))).then(results => {
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
    });
    state.error = errors.length ? errors.join(' ; ') : null;
    state.stale = stale.length ? Math.min(...stale) : null;
    compute();
    render();
  });
}

if (typeof module !== 'undefined') module.exports = KT;
else mount();
