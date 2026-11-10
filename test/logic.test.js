'use strict';
// Fixtures : extraits réduits de l'API publique (campana.json, modes.torre : stops, trios des étages 5, 35–105 et 200 et holders
// n ≥ 20 de la copie du 31 octobre au 4 novembre 2026 ; lines et stars, avec l'écart de victoire d, de celle du 31 octobre au
// 8 novembre ; modes.camp : voir campaign.test.js ; data.json et lang.json?lang=fr : champs utilisés) et une sauvegarde Tour v11
// d'une partie de test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const { headHtml } = KT;
const torre = require('./fixtures/campana.json').modes.torre;
const data = require('./fixtures/data.json');
const lang = require('./fixtures/lang.json');
const save = require('./fixtures/save-tower.json');
const ids = require('./fixtures/ids.json');

const names = KT.namer(lang);
// Étage 57, 38 pièces, niveau 8 : scénario commun avec la maquette et les pages d'aperçu.
const S57 = require('./fixtures/s57.js');
// S57 au niveau 4 : la compo se réduit au trio et à Goupix ★★, Rattata reste hors compo.
const S57_4 = { ...S57, level: 4, xp: 0 };
const advise = (s, extra = {}) => KT.advise({ mode: T, stats: torre, data, lang, save: s, previous: null, side: 'left', ...extra });
const brief = m => m && `${m.level} ${m.label}`;
const T = KT.TOWER_MODE;
const floorAt = raw => KT.floorFromSave(raw, T);
const readGame = s => KT.readGame(s, T);

// Combat de test : Pierre à l'étage 10, 50 % de victoires ; trio noté contre lui (50 combats, 90 %), de borne basse lo.
const BROCK = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
const brockCore = (core, lo = 80) => ({ stop: BROCK[0].stop, core, n: 50, win: 90, lo });
// Statistiques de la Tour réduites au combat contre Pierre et à ces trios.
const brockStats = (cores, extra = {}) => ({ ...torre, stops: BROCK, cores, ...extra });
// Conseils à l'étage 10 pour une compo réduite à ce trio : niveau 3, boutique, plateau et sac vides, sauf ce que game précise.
const brockAdvice = (core, game, extra = {}) => advise({ ...save, round: 1009, level: 3, shop: [], board: {}, items: [], ...game },
  { stats: brockStats([brockCore(core)]), ...extra });
// Trio et unités possédées, boutique vide : le porteur est l'attaquant possédé du trio le plus étoilé. stars : lignée → étoile de
// l'unité possédée, qui prend la lignée pour identifiant ; hors du plateau, elle est au banc.
const trioAdvice = (core, stars, { board = {}, level = 3, side = 'left', lines = data.lines } = {}) => brockAdvice(core, {
  level, board, bench: Object.keys(stars).filter(id => !Object.values(board).includes(id)),
  units: Object.fromEntries(Object.entries(stars).map(([line, star]) => [line, { id: line, line, star }])),
}, { side, data: { ...data, lines } });
// Code KT1 → cellule de chaque lignée.
const cellsOf = code => Object.fromEntries(code.split(';').slice(4).map(u => u.split(':')).map(([line, , cell]) => [line, Number(cell)]));

test('étage lu dans la sauvegarde Tour (round − 1000 + 1)', () => {
  assert.equal(floorAt(JSON.stringify({ round: 1000 })), 1);
  assert.equal(floorAt(JSON.stringify({ round: 1057 })), 58);
  assert.equal(floorAt(JSON.stringify({ round: 1199.5 })), 200);
  assert.equal(floorAt(JSON.stringify({ round: 3 })), 1);
});

test('sauvegarde absente, corrompue ou sans round → null', () => {
  assert.equal(floorAt(null), null);
  assert.equal(floorAt('{pas du json'), null);
  assert.equal(floorAt('null'), null);
  assert.equal(floorAt(JSON.stringify({ round: '1057' })), null);
  assert.equal(floorAt(JSON.stringify({ floor: 58 })), null);
  assert.equal(KT.parseSave('[1]'), null);
  assert.equal(KT.parseSave(JSON.stringify({ round: 1057 })), null);
  assert.equal(floorAt(JSON.stringify({ round: 1057, units: 'v10' })), 58);
});

test('prochain boss : élites ignorées, étage courant inclus', () => {
  assert.equal(KT.nextBossStop(torre.stops, 1, T).stop, '5:brock');
  assert.equal(KT.nextBossStop(torre.stops, 58, T).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 60, T).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 200, T).stop, '200:mewtwo2');
  assert.equal(KT.nextBossStop(torre.stops, 996, T), null);
  assert.equal(KT.lastBossFloor(torre.stops, T), 995);
});

test('3 prochains combats, élites comprises, poids = 100 − victoires', () => {
  const s = KT.nextStops(torre.stops, 57, 3, T);
  assert.deepEqual(s.map(x => x.stop), ['59:elite', '60:zapdos', '64:elite']);
  assert.equal(s[1].weight, 100 - s[1].win);
  assert.ok(s.every(x => x.weight >= 1));
});

test('forme des données : Tour, données de jeu, langue', () => {
  assert.equal(KT.isStatsData(torre), true);
  assert.equal(KT.isStatsData(undefined), false);
  assert.equal(KT.isStatsData({ ...torre, stops: [] }), false);
  assert.equal(KT.isStatsData({ ...torre, rules: undefined }), false);
  assert.equal(KT.isStatsData({ ...torre, cores: [{ stop: '5:brock', core: ['abra'], n: 30, win: 90 }] }), false);
  assert.equal(KT.isStatsData({ ...torre, holders: [{ line: 'abra', id: 'leftovers', n: 30 }] }), false);
  assert.equal(KT.isStatsData({ ...torre, stops: [{ stop: '9:elite', win: 50, first: 40, tries: 2 }] }), false);
  const ok = { stop: '5:brock', n: 100, win: 50, first: 40, tries: 2 };
  assert.equal(KT.isStatsData({ ...torre, stops: [ok, null] }), false);
  assert.equal(KT.isStatsData({ ...torre, stops: [ok, { ...ok, stop: 'brock' }] }), false);
  assert.equal(KT.isStatsData({ ...torre, cores: [null] }), false);
  // Écarts de victoire lus dans les notes (lines : d sur ne combats ; stars : intervalle et taux attendu) : chaque champ
  // manquant signale un format changé.
  const line = { line: 'abra', ne: 400, lo: 60, d: 1 };
  const star = { line: 'abra', star: 2, lo: 60, hi: 70, exp: 65 };
  assert.equal(KT.isStatsData({ ...torre, lines: [line], stars: [star] }), true);
  for (const key of ['ne', 'lo', 'd']) assert.equal(KT.isStatsData({ ...torre, lines: [{ ...line, [key]: undefined }] }), false, key);
  for (const key of ['star', 'lo', 'hi', 'exp']) assert.equal(KT.isStatsData({ ...torre, stars: [{ ...star, [key]: undefined }] }), false, key);
  assert.equal(KT.isStatsData({ ...torre, stars: undefined }), false);
  assert.equal(KT.isGameData(data), true);
  assert.equal(KT.isGameData({ ...data, recipes: [['a', 'b']] }), false);
  assert.equal(KT.isGameData({ ...data, lines: { abra: { c: 1 } } }), false);
  assert.equal(KT.isLang(lang), true);
  assert.equal(KT.isLang({ ...lang, seals: null }), false);
});

test('trios : au moins 20 combats, triés par victoires puis combats, 3 au plus', () => {
  const top = KT.topCores(torre.cores, '60:zapdos');
  assert.deepEqual(top.map(c => c.core.join('+')), ['aerodactyl+dratini+growlithe', 'dratini+growlithe+magmar', 'kabuto+shellder+staryu']);
  const tie = [
    { stop: 'x', core: ['a'], n: 20, win: 90 },
    { stop: 'x', core: ['b'], n: 40, win: 90 },
    { stop: 'x', core: ['c'], n: 19, win: 100 },
  ];
  assert.deepEqual(KT.topCores(tie, 'x').map(c => c.core[0]), ['b', 'a']);
});

test('noms français : lang.json, formes ancrées, personnages, id inconnu', () => {
  assert.equal(names.line('dratini'), 'Minidraco');
  assert.equal(names.line('dratini-a0'), 'Minidraco ⚓');
  assert.equal(names.line('nidoran-a1'), 'Nidorino ⚓');
  assert.equal(names.line('aerodactyl-a1'), 'aerodactyl-a1');
  assert.equal(names.line('giovanni'), 'Miaouss de Giovanni');
  assert.equal(names.line('inconnu'), 'inconnu');
  assert.equal(names.item('leftovers'), 'Restes');
  assert.equal(names.stage('dratini', 1), 'Draco');
  assert.equal(KT.namer(null).item('leftovers'), 'leftovers');
  assert.equal(KT.bossName('zapdos'), 'Électhor');
  assert.equal(KT.bossName('inconnu'), 'inconnu');
});

test('tous les ids de l’API (V41) ont un nom français', () => {
  assert.deepEqual(ids.lines.filter(id => names.line(id) === id), []);
  assert.deepEqual(ids.bosses.filter(id => KT.bossName(id) === id), []);
});

test('toute lignée de la Tour a coût, types et portée (data.json ou table v41)', () => {
  const lines = [...new Set([...ids.lines, ...torre.lines.map(l => l.line)].map(KT.baseLine))];
  assert.deepEqual(lines.filter(b => !KT.lineInfo(data, b)), []);
  assert.equal(KT.lineInfo(data, 'krabby').c, 1);
  assert.equal(KT.lineInfo(data, 'dratini'), data.lines.dratini);
});

test('palier d’or : 30 en Tour, 50 avec la voie Fortune complète', () => {
  assert.equal(KT.goldFloor([], T), 30);
  assert.equal(KT.goldFloor(['nugget', 'fbag', 'team'], T), 30);
  assert.equal(KT.goldFloor(['flute', 'vitamins', 'item'], T), 30);
  assert.equal(KT.goldFloor(['nugget', 'fbag', 'coincase'], T), 50);
});

test('tout jouer : combat de l’étage sous 45 %, ou PV sous 40', () => {
  const at = (round, hp) => advise({ ...S57, round, hp }).eco;
  assert.equal(at(1056, 62).allIn, false);
  assert.equal(at(1056, 62).nextWall.floor, 60);
  assert.equal(at(1056, 62).spend, 8);
  assert.equal(at(1059, 62).spend, 38);
  assert.equal(at(1059, 62).allIn, true);
  assert.equal(at(1056, 39).allIn, true);
});

test('tout jouer : étage rejoué à partir de l’étage 50', () => {
  const at = (round, attempts) => advise({ ...S57, round, attempts }).eco;
  assert.deepEqual([at(1056, 1).allIn, at(1056, 1).retry, at(1056, 1).spend], [true, true, 38]);
  assert.deepEqual([at(1056, 0).allIn, at(1056, 0).retry], [false, false]);
  assert.equal(at(1049, 1).allIn, true);
  assert.equal(at(1048, 1).allIn, false);
});

test('compo cible : meilleur trio pondéré, remplissage par puissance', () => {
  const a = advise(S57);
  assert.deepEqual(a.target.core, ['aerodactyl', 'dratini', 'growlithe']);
  // Niveau 8, 5 places : Goupix ★★ et Rattata ★ possédés, puis Magmar (coût 3) et Abo (coût 2) de la boutique.
  assert.deepEqual(a.target.fillers, ['vulpix', 'rattata', 'magmar', 'ekans']);
  assert.deepEqual(a.target.upgrades, []);
  assert.match(a.shop[1].detail, /Ptéra · Minidraco · Caninos : 96,1 % contre Électhor 60 \(51 combats, au moins 86,0 %\)/);
  assert.equal(KT.progress(a.game, 'dratini'), '★★');
  assert.equal(KT.progress(a.game, 'growlithe'), '2/3');
  assert.equal(KT.progress(a.game, 'aerodactyl'), '0/3');
});

test('compo cible : inertie de 30 points', () => {
  const cores = lo => [
    brockCore(['abra', 'onix', 'zubat']),
    brockCore(['pidgey', 'rattata', 'spearow'], lo),
  ];
  // Niveau 6 : les coûts 1 à 3 des deux trios sont trouvables.
  const game = readGame({ ...save, round: 1009, level: 6, units: {}, board: {}, bench: [], shop: [] });
  const t = lo => brockStats(cores(lo));
  assert.equal(KT.targetComp(t(51), data, game, null).key, 'abra+onix+zubat');
  assert.equal(KT.targetComp(t(51), data, game, 'pidgey+rattata+spearow').key, 'pidgey+rattata+spearow');
  assert.equal(KT.targetComp(t(49), data, game, 'pidgey+rattata+spearow').key, 'abra+onix+zubat');
});

test('compo cible : −10 points par lignée du trio à trouver dont le coût ne sort pas à ce niveau', () => {
  const stops = KT.nextStops(BROCK, 10, 3, T);
  const cores = [
    brockCore(['giovanni', 'koga', 'samurai']),
    brockCore(['onix', 'rhyhorn', 'kabuto'], 55),
  ];
  const game = (level, units = {}) => readGame({ ...save, round: 1009, level, units, board: {}, bench: Object.keys(units), shop: [] });
  const score = g => KT.coreScore(cores[0].core, stops, new Map(), g, data);
  // Coût 5 : 6 % au niveau 8, 17 % au niveau 9 ; une lignée possédée garde son bonus.
  assert.deepEqual([score(game(8)), score(game(9)), score(game(8, { g: { id: 'g', line: 'giovanni', star: 1 } }))], [-30, 0, -10]);
  const key = g => KT.targetComp(brockStats(cores), data, g, null).key;
  // Niveau 8 : 80 − 30 contre 55 (coûts 3 et 4 trouvables) ; niveau 9 : 80 contre 55.
  assert.equal(key(game(8)), 'kabuto+onix+rhyhorn');
  assert.equal(key(game(9)), 'giovanni+koga+samurai');
});

test('compo cible : 9 prochains combats, élites comprises', () => {
  assert.deepEqual(advise(S57).target.stops.map(s => s.stop),
    ['59:elite', '60:zapdos', '64:elite', '65:erika', '69:elite', '70:gengar', '74:elite', '75:koga', '79:elite']);
});

test('compo cible : inertie seulement dans la même partie (runSeed)', () => {
  const cores = [
    brockCore(['abra', 'onix', 'zubat']),
    brockCore(['pidgey', 'rattata', 'spearow'], 60),
  ];
  const s = { ...save, round: 1009, level: 3, units: {}, board: {}, bench: [], shop: [], runSeed: 7 };
  const at = previous => advise(s, { stats: brockStats(cores), previous }).target.key;
  assert.equal(at({ key: 'pidgey+rattata+spearow', run: 7 }), 'pidgey+rattata+spearow');
  assert.equal(at({ key: 'pidgey+rattata+spearow', run: 8 }), 'abra+onix+zubat');
  // Valeur des versions précédentes (clé seule) : rattachée à aucune partie.
  assert.equal(at('pidgey+rattata+spearow'), 'abra+onix+zubat');
  assert.equal(advise(s).run, 7);
});

test('compléments : possédés par puissance (coût, étoiles) et types, boutique pour les places libres, carte plus forte à part', () => {
  // Trio Roucool + Piafabec + Abra.
  const trio = brockCore(['pidgey', 'spearow', 'abra']);
  const units = (...list) => Object.fromEntries(list.map(([line, star]) => [line, { id: line, line, star }]));
  // Sans statistiques de lignée, aucun coût n'est décalé : la note est la puissance seule.
  const comp = (level, own, shop, cores = [trio]) => {
    const t = KT.targetComp(brockStats(cores, { lines: [] }), data,
      readGame({ ...save, round: 1009, level, units: own, board: Object.fromEntries(Object.keys(own).map((id, i) => [28 + i, id])), bench: [], shop }), null);
    return [t.fillers, t.upgrades, t.replaced];
  };
  // Niveau 4, une place : Abo ★★ (coût 2) vaut plus que Rattata ★★ (coût 1) ; l'unité possédée la prend même sans type commun.
  assert.deepEqual(comp(4, units(['rattata', 2], ['ekans', 2]), []), [['ekans'], [], []]);
  assert.deepEqual(comp(4, units(['ekans', 1]), []), [['ekans'], [], []]);
  // Le plan garde l'unité possédée quand la boutique change ; une carte de coût 4 vaut plus qu'un coût 1 ★, moins qu'un coût 1 ★★.
  assert.deepEqual(comp(4, units(['rattata', 1]), ['rhyhorn']), [['rattata'], ['rhyhorn'], ['rattata']]);
  assert.deepEqual(comp(4, units(['rattata', 1]), ['caterpie']), [['rattata'], [], []]);
  assert.deepEqual(comp(4, units(['rattata', 2]), ['rhyhorn']), [['rattata'], [], []]);
  // Miaouss et Mélofée : même coût, même type. À égalité de note, la carte ne remplace pas l'unité possédée.
  assert.deepEqual(comp(4, units(['meowth', 1]), ['clefairy']), [['meowth'], [], []]);
  // Place libre : la boutique la remplit ; à égalité, la lignée qui figure dans un trio gagnant de la fenêtre, puis le nom.
  assert.deepEqual(comp(5, units(['rattata', 1]), ['doduo']), [['rattata', 'doduo'], [], []]);
  assert.deepEqual(comp(4, {}, ['clefairy', 'meowth']), [['clefairy'], [], []]);
  assert.deepEqual(comp(4, {}, ['clefairy', 'meowth'], [trio, { ...trio, core: ['meowth', 'abra', 'pidgey'] }]), [['meowth'], [], []]);
});

test('compléments : l’écart de victoire rétréci (400 combats fictifs) décale le coût d’un cran, dès 2,5 points', () => {
  const cores = [brockCore(['pidgey', 'spearow', 'abra'])];
  const stat = (line, d, ne) => ({ line, n: ne, ne, win: 80, lo: 79, d });
  const comp = (lines, own, shop = []) => {
    const t = KT.targetComp(brockStats(cores, { lines }), data, readGame({
      ...save, round: 1009, level: 4, units: own, board: Object.fromEntries(Object.keys(own).map((id, i) => [28 + i, id])), bench: [], shop,
    }), null);
    return [t.fillers, t.upgrades];
  };
  const own = (...list) => Object.fromEntries(list.map(([id, line, star, shiny = false]) => [id, { id, line, star, shiny }]));
  // Chenipan (coût 1), Mimitoss (coût 2) et Scarabrute (coût 3) n'ont aucun type du trio ; à égalité de note, le nom
  // départage (Chenipan avant Mimitoss). Sur 4 000 combats, ±6 rétrécit à ±5,5 : Chenipan fort (coût 2 : 1,35) passe devant
  // Mimitoss faible (coût 1 : 1). Sur 40 combats, ±6 rétrécit à ±0,5 : aucun décalage.
  const weak = stat('venonat', -6, 4000);
  const pair = own(['c', 'caterpie', 1], ['v', 'venonat', 1]);
  assert.deepEqual(comp([stat('caterpie', 6, 4000), weak], pair), [['caterpie'], []]);
  assert.deepEqual(comp([stat('caterpie', 6, 40), stat('venonat', -6, 40)], pair), [['venonat'], []]);
  // Seuil de 2,5 points, des deux côtés : ±2,8 sur 4 000 combats (±2,55) décale d'un cran, ±2,6 (±2,36) ne décale pas.
  assert.deepEqual(comp([stat('caterpie', 2.8, 4000)], pair), [['caterpie'], []]);
  assert.deepEqual(comp([stat('caterpie', 2.6, 4000)], pair), [['venonat'], []]);
  assert.deepEqual(comp([stat('venonat', -2.8, 4000)], pair), [['caterpie'], []]);
  assert.deepEqual(comp([stat('venonat', -2.6, 4000)], pair), [['venonat'], []]);
  // Un cran au plus : Chenipan à +30 vaut un coût 2 (1,35), pas plus que Scarabrute neutre (1,7).
  assert.deepEqual(comp([stat('caterpie', 30, 4000)], own(['c', 'caterpie', 1], ['p', 'pinsir', 1])), [['pinsir'], []]);
  // Un coût 1 ★★ neutre (1,9) reste devant un coût 2 ★ fort (coût 3 : 1,7).
  assert.deepEqual(comp([stat('venonat', 6, 4000)], own(['c', 'caterpie', 2], ['v', 'venonat', 1])), [['caterpie'], []]);
  // Forme ancrée possédée : ses statistiques, rétrécies vers l'écart de sa lignée de base. Bien jouée (+11 sur 4 000 combats,
  // base à −6), elle reste forte (+9,5) ; peu jouée (+30 sur 40 combats), une base très faible (−20) la tire sous zéro
  // (−13,8 : un cran perdu) ; sans ligne propre, elle prend l'écart de sa base.
  const anchored = [stat('caterpie', -6, 4000), stat('caterpie-a0', 11, 4000), weak];
  assert.deepEqual(comp(anchored, own(['c', 'caterpie-a0', 1], ['v', 'venonat', 1])), [['caterpie'], []]);
  assert.deepEqual(comp([stat('caterpie', -20, 4000), stat('caterpie-a1', 30, 40), weak], own(['c', 'caterpie-a1', 1], ['v', 'venonat', 1])), [['venonat'], []]);
  assert.deepEqual(comp([stat('caterpie', 6, 4000), weak], own(['c', 'caterpie-a1', 1], ['v', 'venonat', 1])), [['caterpie'], []]);
  // Deux copies de même étoile, ancrée et non : la note lit la forme de la copie que la formation pose (la shiny, sinon la
  // forme non ancrée par l'identifiant), quel que soit l'ordre des copies sur le plateau.
  const both = [['c', 'caterpie', 1], ['d', 'caterpie-a0', 1], ['v', 'venonat', 1]];
  assert.deepEqual(comp(anchored, own(...both)), [['venonat'], []]);
  assert.deepEqual(comp(anchored, own(...[...both].reverse())), [['venonat'], []]);
  const shinyAnchored = [['c', 'caterpie', 1], ['d', 'caterpie-a0', 1, true], ['v', 'venonat', 1]];
  assert.deepEqual(comp(anchored, own(...shinyAnchored)), [['caterpie'], []]);
  assert.deepEqual(comp(anchored, own(...[...shinyAnchored].reverse())), [['caterpie'], []]);
  // Une carte de boutique est notée sur sa lignée de base : Chenipan fort est conseillé à la place de Mimitoss possédé.
  assert.deepEqual(comp([stat('caterpie', 6, 4000), weak], own(['v', 'venonat', 1]), ['caterpie']), [['venonat'], ['caterpie']]);
});

test('compléments : à l’étage 72, les unités fortes possédées passent avant les coûts 1 de la boutique', () => {
  const units = Object.fromEntries([['giovanni', 2], ['koga', 2], ['samurai', 2], ['chansey', 1], ['dratini', 2], ['aerodactyl', 1], ['rhyhorn', 2], ['onix', 2]]
    .map(([line, star]) => [line, { id: line, line, star }]));
  const late = {
    ...S57, round: 1071, level: 8, units, board: Object.fromEntries(Object.keys(units).map((id, i) => [28 + i, id])), bench: Array(9).fill(null),
    shop: ['rattata', 'pidgey', 'dratini', 'weedle', 'lapras'], items: [],
  };
  const a = advise(late, { previous: { key: 'giovanni+koga+samurai', run: late.runSeed ?? null, next: null } });
  assert.equal(a.target.key, 'giovanni+koga+samurai');
  assert.deepEqual(a.target.fillers, ['dratini', 'rhyhorn', 'onix', 'chansey', 'aerodactyl']);
  // Rattata, Roucool et Aspicot hors compo ; Lokhlass (coût 4) ne vaut pas plus que Leveinard ★ et Ptéra ★ déjà possédés.
  // Niveau 8 pour un niveau 10 visé : la copie de Minidraco passe après l'XP.
  assert.deepEqual(a.shop.map(m => m.why), ['hors compo cible', 'hors compo cible', 'complément de la compo ; l’or va d’abord à l’XP',
    'hors compo cible', 'hors compo cible']);
  assert.deepEqual([a.target.upgrades, a.target.replaced], [[], []]);
});

test('compo cible : un trio monté en ★★ l’emporte sur l’inertie d’un trio non possédé', () => {
  const cores = [
    // Inertie : abra 70 + 30 = 100 ; possession : pidgey 50 + 60 = 110 (80 avec l'ancien bonus de 5).
    brockCore(['abra', 'onix', 'zubat'], 70),
    brockCore(['pidgey', 'rattata', 'spearow'], 50),
  ];
  const units = Object.fromEntries(['pidgey', 'rattata', 'spearow'].map(line => [line, { id: line, line, star: 2 }]));
  const game = readGame({ ...save, round: 1009, level: 3, units, board: { 0: 'pidgey', 1: 'rattata', 2: 'spearow' }, bench: [], shop: [] });
  assert.equal(KT.targetComp(brockStats(cores), data, game, 'abra+onix+zubat').key, 'pidgey+rattata+spearow');
});

test('achat d’une carte ★ : les autres pastilles de la boutique ne changent pas', () => {
  const before = advise(S57);
  assert.equal(brief(before.shop[0]), 'do Achète');
  const bought = {
    ...S57, gold: S57.gold - KT.lineInfo(data, 'growlithe').c, shop: [null, ...S57.shop.slice(1)],
    units: { ...S57.units, z: { id: 'z', line: 'growlithe', star: 1 } }, bench: ['b', 'c', 'e', 'z', null, null, null, null, null],
  };
  const after = advise(bought, { previous: { key: before.target.key, run: before.run, next: before.next.key } });
  assert.equal(after.target.key, before.target.key);
  assert.equal(after.next.key, before.next.key);
  assert.deepEqual(after.shop.slice(1).map(brief), before.shop.slice(1).map(brief));
});

test('boutique : ★ 3ᵉ copie, cœur et place libre, ◆ si l’or, ✕ hors compo', () => {
  const a = advise(S57);
  // Niveau 8, 4 lignées possédées : après Caninos et Ptéra (★, 8 pièces), Magmar (3) et Abo (2) remplissent deux places libres.
  // Rattata, déjà possédé, attend le surplus : il reste 25 pièces.
  assert.deepEqual(a.shop.map(brief), ['do Achète', 'do Achète', 'do Achète', 'no Ignore', 'do Achète']);
  assert.match(a.shop[0].why, /3ᵉ copie/);
  assert.match(a.shop[1].why, /cœur/);
  assert.deepEqual([a.shop[2].why, a.shop[4].why], ['place libre sur le plateau', 'place libre sur le plateau']);
  assert.match(a.shop[3].why, /^complément de la compo ; garde 30 pièces/);
  assert.equal(brief(advise({ ...S57, gold: 60 }).shop[3]), 'opt Si l’or');
  // Une place libre ne passe pas devant un ★ du trio : avec 7 pièces, Ptéra (4) manque d'or après Caninos (4).
  assert.deepEqual(advise({ ...S57, gold: 7 }).shop.slice(1, 3).map(brief), ['opt Si l’or', 'no Ignore']);
  // Niveau 9 (niveau visé atteint), 6 lignées possédées pour 6 places de compléments : Magmar (coût 3) vaut plus que Rattata ★,
  // qui reste dans la compo tant que Magmar n'est pas acheté ; Abo ne vaut pas mieux.
  const own = Object.fromEntries(['oddish', 'squirtle', 'geodude', 'machop'].map(line => [line, { id: line, line, star: 2 }]));
  const nine = advise({ ...S57, level: 9, gold: 60, units: { ...S57.units, ...own }, bench: ['b', 'c', 'e', ...Object.keys(own), null, null] });
  assert.deepEqual([nine.target.upgrades, nine.target.replaced], [['magmar'], ['rattata']]);
  assert.deepEqual(nine.shop.slice(2).map(why), ['opt Si l’or : plus fort que Rattata', 'opt Si l’or : renforce le plateau de la compo', 'no Ignore : hors compo cible']);
  // Niveau 8, 5 places : Rattata est déjà hors compo. Sans statistiques, Magmar (coût 3) vaut plus que Carapuce ★★ ; sous le
  // niveau visé, il passe après l'XP. Avec celles de la fixture, Magmar (écart −4,6) perd un coût et Carapuce (+2,6) en gagne un.
  const eight = { ...S57, level: 8, gold: 60, units: { ...S57.units, ...own }, bench: ['b', 'c', 'e', ...Object.keys(own), null, null] };
  assert.equal(why(advise(eight, { stats: { ...torre, lines: [] } }).shop[2]), 'no Ignore : plus fort que Carapuce ; l’or va d’abord à l’XP');
  assert.equal(why(advise(eight).shop[2]), 'no Ignore : hors compo cible');
  const shiny = advise({ ...S57, shopShiny: [false, false, true, false, false] });
  assert.equal(shiny.shop[2].title, 'Achète Magmar shiny');
});

test('boutique : ★ seulement si l’or suffit, de gauche à droite ; le reste ne compte pas dans l’or engagé', () => {
  const a = advise({ ...S57, gold: 5 });
  assert.deepEqual(a.shop.slice(0, 2).map(brief), ['do Achète', 'opt Si l’or']);
  assert.match(a.shop[1].why, /il manque de l’or/);
  assert.equal(advise({ ...S57, gold: 5, round: 1059 }).reroll, null);
});

test('vendre faute d’or pour un ★, et XP avant actualiser', () => {
  // Niveau 4, 3 pièces : Caninos (4, 3ᵉ copie) et Ptéra (4, cœur) passent en ◆ faute d'or, Rattata hors compo est à vendre.
  const poor = advise({ ...S57_4, gold: 3 });
  assert.deepEqual(poor.shop.slice(0, 2).map(brief), ['opt Si l’or', 'opt Si l’or']);
  assert.deepEqual([brief(poor.bench[2]), poor.bench[2].why], ['no Vends', 'il manque de l’or pour un achat conseillé']);
  // 47 pièces, 4 XP manquants : ★ (13) puis XP (4) laissent 30 ; pas d'actualisation avant le niveau 9.
  const lvl = advise({ ...S57, gold: 47, xp: 92 });
  assert.deepEqual([brief(lvl.xp), lvl.xp.why, brief(lvl.reroll), lvl.reroll.why],
    ['do Monte', 'niveau 9 pour 4 pièces', 'no Garde l’or', 'd’abord le niveau 9']);
});

test('boutique sans statistiques : seules les 3ᵉ copies sont marquées', () => {
  const a = KT.advise({ mode: T, stats: null, data: null, lang: null, save: S57, previous: null, side: 'left' });
  assert.equal(a.target, null);
  assert.deepEqual(a.shop.map(brief), ['do Achète', null, null, null, null]);
  assert.equal(a.reroll, null);
  assert.deepEqual(a.bag, [null, null, null]);
  assert.equal(a.code, null);
});

const why = m => m && `${brief(m)} : ${m.why}`;

test('XP : niveau visé par étage, sans passer sous le palier ; niveau entier en tout jouer', () => {
  assert.deepEqual([5, 6, 11, 12, 20, 29, 30, 44, 45, 64, 65].map(f => KT.levelGoal(f, T)), [0, 5, 5, 6, 7, 7, 8, 8, 9, 9, 10]);
  // Le niveau visé ne dépasse jamais le niveau ouvert (9, puis 10 à l'étage 60) : sinon ni XP ni actualisation ne seraient conseillées.
  for (let floor = 1; floor <= 200; floor++) assert.ok(KT.levelGoal(floor, T) <= (floor >= 60 ? 10 : 9), `étage ${floor}`);
  // S57 : niveau 8 à l'étage 57, niveau 9 visé. Les ★ (13) laissent 25 pièces sur 38.
  assert.equal(why(advise(S57).xp), 'no Attends : garde 30 pièces pour les intérêts');
  assert.equal(why(advise({ ...S57, gold: 60 }).xp), 'do Monte : niveau 9 visé à cet étage ; 61 XP avant le niveau 9');
  assert.equal(why(advise({ ...S57, xp: 92, gold: 47 }).xp), 'do Monte : niveau 9 pour 4 pièces');
  assert.equal(brief(advise({ ...S57, xp: 92 }).xp), 'no Attends');
  // Niveau 7 à 4 XP du niveau 8, niveau 9 visé : le surplus (16 pièces sur 59, après les ★) reste engagé au-delà de ces 4 pièces,
  // la copie de Rattata attend.
  const two = advise({ ...S57, level: 7, xp: 36, gold: 59 });
  assert.deepEqual([why(two.xp), why(two.shop[3])], ['do Monte : niveau 8 pour 4 pièces', 'no Ignore : complément de la compo ; l’or va d’abord à l’XP']);
  // Tout jouer : un complément trop cher manque d'or, il n'y a plus de palier à garder.
  assert.equal(why(advise({ ...S57, gold: 13, hp: 30 }).shop[3]), 'no Ignore : complément de la compo ; il manque de l’or');
  // Niveau maximal : 9 avant l'étage 60, 10 ensuite (étage 62, hors tout jouer).
  assert.equal(advise({ ...S57, level: 9 }).xp, null);
  assert.equal(brief(advise({ ...S57, round: 1061, level: 9, xp: 118, gold: 60 }).xp), 'do Monte');
  assert.equal(advise({ ...S57, round: 1061, level: 10, xp: 0, gold: 60 }).xp, null);
  // Tout jouer (Électhor, étage 60) : le niveau entier ou rien.
  assert.equal(advise({ ...S57, round: 1059, level: 9 }).xp, null);
  assert.equal(why(advise({ ...S57, round: 1059, level: 9, xp: 118 }).xp), 'do Monte : tout jouer : niveau 10 pour 4 pièces');
});

test('actualiser : après le niveau visé, pour une lignée trouvable, sans passer sous le palier', () => {
  assert.equal(why(advise(S57).reroll), 'no Garde l’or : d’abord le niveau 9');
  // Niveau 9, le maximum à l'étage 57 : trio cherché jusqu'à ★★★. Sur 46 pièces, les ★ (13) et Rattata ◆ (1) laissent 32.
  const nine = gold => advise({ ...S57, level: 9, gold }).reroll;
  assert.equal(why(nine(46)), 'do Actualise : cherche Ptéra (coût 4 : 36 %), Minidraco (coût 4 : 36 %), Caninos (coût 4 : 36 %) au niveau 9');
  assert.equal(why(nine(45)), 'no Garde l’or : tu passerais sous 30 pièces');
  assert.equal(why(advise({ ...S57, gold: 31, round: 1059 }).reroll), 'do Actualise : tout jouer : chercher les copies de la compo');
  assert.equal(advise({ ...S57, gold: 9, round: 1059 }).reroll, null);
});

// Trio Giovanni + Koga + Samouraï (coût 5) possédé en ★★ à l'étage 78, 120 pièces, boutique sans intérêt.
const late = (level, extra = {}) => {
  const units = Object.fromEntries(['giovanni', 'koga', 'samurai'].map(line => [line, { id: line, line, star: 2 }]));
  return {
    ...S57, round: 1077, level, xp: 0, gold: 120, units, board: { 28: 'giovanni', 29: 'koga', 30: 'samurai' }, bench: Array(9).fill(null),
    shop: [null, null, null, null, null], items: [], ...extra,
  };
};
const LATE_TRIO = { previous: { key: 'giovanni+koga+samurai', run: S57.runSeed ?? null, next: null } };

test('or en trop : XP quand rien n’est à chercher, puis ★★★ du trio au niveau maximal', () => {
  // Niveau 8, niveau 10 visé : l'XP passe avant tout.
  const eight = advise(late(8), LATE_TRIO);
  assert.equal(eight.target.key, 'giovanni+koga+samurai');
  assert.deepEqual([why(eight.xp), why(eight.reroll)], ['do Monte : niveau 10 visé à cet étage ; 96 XP avant le niveau 9', null]);
  // Étage 62, niveau 9 : niveau visé atteint, rien à chercher sous le niveau maximal, l'or va au niveau 10.
  const nine = advise(late(9, { round: 1061 }), LATE_TRIO);
  assert.deepEqual([why(nine.xp), why(nine.reroll)], ['do Monte : rien à chercher en boutique à ce niveau ; 120 XP avant le niveau 10', null]);
  // Niveau 10 : plus d'XP, les ★★★ du trio se cherchent (coût 5 : 20 %).
  const ten = advise(late(10), LATE_TRIO);
  assert.equal(ten.xp, null);
  assert.equal(why(ten.reroll), 'do Actualise : cherche Miaouss de Giovanni (coût 5 : 20 %), Smogo de Koga (coût 5 : 20 %), Scarabrute du Samouraï (coût 5 : 20 %) au niveau 10');
});

test('niveau maximal : pas de ★★★ cherchée pour une lignée du trio qu’elle affaiblit nettement (intervalles disjoints)', () => {
  // Écart de victoire d ± demi-largeur de l'intervalle à 95 %, autour d'un taux attendu de 70 %.
  const star = (n, d, half) => ({ line: 'giovanni', star: n, n: 1000, win: 70 + d, lo: 70 + d - half, hi: 70 + d + half, exp: 70, d });
  const giovanni = (...stars) => ({ stats: { ...torre, stars: [...torre.stars.filter(s => s.line !== 'giovanni'), ...stars] }, ...LATE_TRIO });
  const others = 'Smogo de Koga (coût 5 : 20 %), Scarabrute du Samouraï (coût 5 : 20 %) au niveau 10';
  const all = `do Actualise : cherche Miaouss de Giovanni (coût 5 : 20 %), ${others}`;
  // ★★ à +4 ± 1, ★★★ à 0 ± 1 : au mieux +1 contre au moins +3.
  const clear = giovanni(star(2, 4, 1), star(3, 0, 1));
  const ten = advise(late(10), clear);
  assert.deepEqual(ten.target.flat, ['giovanni']);
  assert.equal(why(ten.reroll), `do Actualise : cherche ${others}`);
  // Intervalles qui se chevauchent (± 2,5), ou ★★★ sans statistiques : la ★★★ se cherche.
  assert.equal(why(advise(late(10), giovanni(star(2, 4, 2.5), star(3, 0, 2.5))).reroll), all);
  assert.deepEqual(advise(late(10), giovanni(star(2, 4, 1))).target.flat, []);
  // Deux copies ★★ : la 3ᵉ donne la ★★★ sans actualisation dédiée, elle reste cherchée.
  const pair = late(10, { units: { ...late(10).units, g2: { id: 'g2', line: 'giovanni', star: 2 } }, bench: ['g2', ...Array(8).fill(null)] });
  assert.equal(why(advise(pair, clear).reroll), all);
});

test('actualiser : lignée introuvable à ce niveau → XP ; fusion à une copie cherchée', () => {
  // Étage 5, sans niveau visé. Trio Onix + Kabuto + Rhinocorne à trouver, niveau 3 : les coûts 3 et 4 ne sortent pas. Sans
  // statistiques d'étoile, la ★★★ du trio se cherche au niveau maximal.
  const t = brockStats([brockCore(['onix', 'kabuto', 'rhyhorn'])], { stars: [] });
  const empty = { ...save, round: 1004, level: 3, xp: 0, gold: 40, units: {}, board: {}, bench: [], shop: [], attempts: 0 };
  const lost = advise(empty, { stats: t });
  assert.equal(why(lost.reroll), 'no Garde l’or : Onix (coût 3 : 0 %) au niveau 3 : à chercher au niveau 6');
  assert.equal(why(lost.xp), 'do Monte : rien à chercher en boutique à ce niveau ; 8 XP avant le niveau 4');
  // Trio complet en ★★ : rien à chercher, sauf la lignée à une copie d'une fusion.
  const units = Object.fromEntries(['onix', 'kabuto', 'rhyhorn'].map(line => [line, { id: line, line, star: 2 }]));
  const full = { ...empty, level: 4, units, board: { 28: 'onix', 29: 'kabuto', 30: 'rhyhorn' } };
  assert.deepEqual([advise(full, { stats: t }).reroll, brief(advise(full, { stats: t }).xp)], [null, 'do Monte']);
  const pair = { ...full, units: { ...units, a: { id: 'a', line: 'rattata', star: 1 }, b: { id: 'b', line: 'rattata', star: 1 } }, bench: ['a', 'b'] };
  const rolled = advise(pair, { stats: t });
  assert.equal(why(rolled.reroll), 'do Actualise : cherche Rattata (coût 1 : 60 %) au niveau 4');
  assert.equal(why(rolled.xp), 'no Attends : l’or va d’abord à l’actualisation');
  // Étage 62, niveau 9 : Rattata (coût 1) sort à 6 %, et à 4 % au niveau 10. Monter ne le rend pas trouvable : aucun conseil
  // d'actualisation, l'or va à l'XP. Au niveau 10, le maximum, tout ce qui sort en boutique se cherche.
  const high = level => advise({ ...pair, round: 1061, level, gold: 60 }, { stats: { ...t, stops: [{ ...BROCK[0], stop: '64:brock' }], cores: [{ ...t.cores[0], stop: '64:brock' }] } });
  assert.deepEqual([high(9).reroll, brief(high(9).xp)], [null, 'do Monte']);
  assert.equal(why(high(10).reroll), 'do Actualise : cherche Onix (coût 3 : 24 %), Kabuto (coût 4 : 42 %), Rhinocorne (coût 4 : 42 %), Rattata (coût 1 : 4 %) au niveau 10');
});

test('lignée du trio inconnue des données : ni malus, ni actualisation pour elle, pas d’erreur', () => {
  const stops = KT.nextStops(BROCK, 5, 3, T);
  const core = ['newmon', 'pidgey', 'spearow'];
  const game = readGame({ ...save, round: 1004, level: 9, units: {}, board: {}, bench: [], shop: [] });
  // Roucool et Piafabec (coût 1 : 6 % au niveau 9) coûtent 10 points chacun ; la lignée sans coût connu, rien.
  assert.equal(KT.coreScore(core, stops, new Map(), game, data), -20);
  const a = advise({ ...save, round: 1004, level: 9, xp: 0, gold: 60, attempts: 0, units: {}, board: {}, bench: [], shop: [] },
    { stats: brockStats([brockCore(core)]) });
  assert.equal(a.target.key, 'newmon+pidgey+spearow');
  assert.equal(why(a.reroll), 'do Actualise : cherche Roucool (coût 1 : 6 %), Piafabec (coût 1 : 6 %) au niveau 9');
  // Tout jouer : aucune chance n'est lue, la lignée inconnue se cherche comme les autres.
  const own = Object.fromEntries(['pidgey', 'spearow'].map(line => [line, { id: line, line, star: 3 }]));
  const allIn = advise({ ...save, round: 1004, level: 9, xp: 0, gold: 10, hp: 30, attempts: 0, units: own, board: {}, bench: ['pidgey', 'spearow'], shop: [] },
    { stats: brockStats([brockCore(core)]) });
  assert.equal(why(allIn.reroll), 'do Actualise : tout jouer : chercher les copies de la compo');
});

test('vendre : unité du banc hors compo et sans paire, banc presque plein', () => {
  assert.deepEqual(advise(S57).bench.filter(Boolean), []);
  const full = {
    ...S57, level: 4,
    units: {
      ...S57.units, f: { id: 'f', line: 'ekans', star: 1 }, g: { id: 'g', line: 'zubat', star: 1 }, h: { id: 'h', line: 'zubat', star: 1 },
      i: { id: 'i', line: 'pidgey', star: 1 }, j: { id: 'j', line: 'pidgey', star: 1 },
    },
    bench: ['b', 'c', 'e', 'f', 'g', 'h', 'i', 'j', null],
  };
  const marks = advise(full).bench;
  assert.equal(brief(marks[3]), 'no Vends');
  assert.equal(marks[3].title, 'Vends Abo');
  assert.equal(marks[4], null);
  // Leveinard, de la compo suivante, reste au banc ; sauf s'il manque de l'or pour un ★ de la compo cible.
  const kept = { ...full, units: { ...full.units, f: { id: 'f', line: 'chansey', star: 1 } } };
  assert.equal(advise(kept).next.key, 'chansey+dratini+lapras');
  assert.equal(advise(kept).bench[3], null);
  const sold = advise({ ...kept, gold: 3 }).bench[3];
  assert.deepEqual([brief(sold), sold.why], ['no Vends', 'il manque de l’or pour un achat conseillé']);
});

// Combats aux étages 10 à 27 : la compo cible se joue sur 10–18, la compo suivante sur 19–27.
const twoWindows = later => {
  const stops = Array.from({ length: 18 }, (_, i) => ({ stop: `${10 + i}:brock`, n: 100, win: 50, lo: 45, first: 50, tries: 2 }));
  const cores = stops.flatMap((s, i) => (i < 9
    ? [{ stop: s.stop, core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 80 }]
    : later.map(([core, lo]) => ({ stop: s.stop, core, n: 50, win: 90, lo }))));
  return { ...torre, stops, cores };
};
const EMPTY10 = { ...save, round: 1009, level: 3, units: {}, board: {}, bench: [], shop: [], runSeed: 7 };

test('compo suivante : trio des combats 10 à 18, absent s’il est déjà la compo cible', () => {
  const a = advise(S57);
  assert.equal(a.next.key, 'chansey+dratini+lapras');
  assert.equal(KT.floorRange(a.next.stops, T), 'étages 80–100');
  assert.equal(advise(EMPTY10, { stats: twoWindows([[['abra', 'onix', 'zubat'], 80]]) }).next, null);
  // Tranche suivante sans trio d'au moins 20 combats, ou sans combat.
  const empty = twoWindows([]);
  assert.equal(advise(EMPTY10, { stats: empty }).next, null);
  assert.equal(advise(EMPTY10, { stats: { ...empty, stops: empty.stops.slice(0, 9) } }).next, null);
});

test('compo suivante : inertie de 30 points dans la même partie', () => {
  const t = lo => twoWindows([[['caterpie', 'pidgey', 'rattata'], 80], [['ekans', 'spearow', 'zubat'], lo]]);
  const previous = { key: 'abra+onix+zubat', run: 7, next: 'ekans+spearow+zubat' };
  assert.equal(advise(EMPTY10, { stats: t(51) }).next.key, 'caterpie+pidgey+rattata');
  assert.equal(advise(EMPTY10, { stats: t(51), previous }).next.key, 'ekans+spearow+zubat');
  assert.equal(advise(EMPTY10, { stats: t(49), previous }).next.key, 'caterpie+pidgey+rattata');
  assert.equal(advise(EMPTY10, { stats: t(51), previous: { ...previous, run: 8 } }).next.key, 'caterpie+pidgey+rattata');
});

test('boutique : ◆ pour la compo suivante après ceux de la compo cible, jamais sous le palier ni en tout jouer', () => {
  // Étage 5 (aucun niveau visé), niveau 4 : trio Abra + Onix + Nosferapti à trouver, Abo ★ possédé pour seul complément ;
  // Chenipan et Roucool ne servent que la compo des étages 19–27.
  const t = twoWindows([[['caterpie', 'pidgey', 'rattata'], 80]]);
  const base = {
    ...EMPTY10, round: 1004, level: 4, xp: 0, units: { e: { id: 'e', line: 'ekans', star: 1 } }, bench: ['e'],
    shop: ['caterpie', 'pidgey', 'ekans', null, null],
  };
  const at = (gold, extra = {}) => advise({ ...base, gold, ...extra }, { stats: t });
  // 32 pièces : Abo (2, compo cible) passe avant Chenipan (1) malgré sa place ; Chenipan ferait passer sous 30.
  const a = at(32);
  assert.deepEqual(a.shop.slice(0, 3).map(brief), ['no Ignore', 'no Ignore', 'opt Si l’or']);
  assert.equal(a.shop[0].why, 'compo des étages 19–27 ; garde 30 pièces pour les intérêts');
  // 33 pièces : Abo (2), puis Chenipan (1) en gardant 30 ; Roucool ne passe plus, et il ne reste rien pour actualiser.
  const b = at(33);
  assert.deepEqual([...b.shop.slice(0, 3).map(brief), brief(b.reroll)], ['opt Si l’or', 'no Ignore', 'opt Si l’or', 'no Garde l’or']);
  assert.equal(b.shop[0].why, 'prépare la compo des étages 19–27');
  assert.match(b.shop[0].detail, /^Chenipan · Roucool · Rattata : /);
  // 35 pièces : Abo (2), l'actualisation (2) pour le trio à trouver, puis Chenipan (1) ; Roucool (1) passerait sous 30 avec elle.
  const c = at(35);
  assert.deepEqual([...c.shop.slice(0, 3).map(brief), brief(c.reroll)], ['opt Si l’or', 'no Ignore', 'opt Si l’or', 'do Actualise']);
  assert.equal(c.shop[1].why, 'compo des étages 19–27 ; l’or va d’abord à l’actualisation pour la compo cible');
  assert.equal(at(60, { hp: 30 }).shop[0].why, 'tout jouer : l’or va à la compo cible');
  // 3ᵉ copie d'une lignée de la compo suivante : même motif, même règle d'or.
  const third = { units: { ...base.units, x: { id: 'x', line: 'caterpie', star: 1 }, y: { id: 'y', line: 'caterpie', star: 1 } }, bench: ['e', 'x', 'y'] };
  assert.equal(at(60, third).shop[0].why, 'prépare la compo des étages 19–27');
  assert.equal(brief(at(60, { ...third, hp: 30 }).shop[0]), 'no Ignore');
  // Sous le niveau visé (étage 10, niveau 5 visé), l'XP passe avant : Chenipan attend.
  assert.equal(at(40, { round: 1009 }).shop[0].why, 'compo des étages 19–27 ; l’or va d’abord à l’XP');
});

// S57_4 : porteur Minidraco ★★ physique (idéal Bandeau Choix, Ceinture Force, Lentilscope), attaquants Goupix ★★ lanceur (idéal
// Lunettes Choix, Vive Griffe, Cuiller Tordue) et Caninos physique (idéal Lentilscope, Bandeau Choix, Ceinture Force) ; aucun tank.
// À venir : Ptéra (cœur cible non possédé), Leveinard et Lokhlass (compo suivante).
const withItems = (items, held = {}) => ({
  ...S57_4, items, units: Object.fromEntries(Object.entries(S57.units).map(([k, u]) => [k, held[k] ? { ...u, items: held[k] } : u])),
});
// Trois objets qui conviennent aux attaquants physiques de la compo (Minidraco, Caninos).
const FULL3 = ['life-orb', 'scope-lens', 'shell-bell'];
// Goupix porte déjà Cuiller Tordue (Calcium + Fer), un de ses objets idéaux : le Fer ne lui sert plus.
const SPOON = { d: ['twisted-spoon'] };
const titles = a => a.bag.map(m => m && `${m.title} — ${m.why}`);

test('profil de lignée : tank lu sur les objets portés en Tour, stats d’attaque lues sur la capacité', () => {
  const p = KT.lineProfiles(torre, data);
  assert.deepEqual(p.get('snorlax').tank, true);
  assert.deepEqual(p.get('machop'), { tank: true, basic: true, atk: true, spa: false });
  assert.deepEqual(p.get('dratini'), { tank: false, basic: true, atk: true, spa: false });
  // Lanceurs : capacité spéciale, Attaque sous l'Atq. Spé. à tous les stades.
  assert.deepEqual(p.get('abra'), { tank: false, basic: false, atk: false, spa: true });
  assert.deepEqual(p.get('oddish'), { tank: false, basic: false, atk: false, spa: true });
  // Carapuce : capacité spéciale, mais ses attaques de base comptent.
  assert.deepEqual(p.get('squirtle'), { tank: false, basic: true, atk: true, spa: true });
  // Magicarpe n'a plus d'Attaque que d'Atq. Spé. qu'en Léviator, dernier stade, dont la capacité suit surtout l'Attaque (0,7 / 0,3).
  assert.deepEqual(p.get('magikarp'), { tank: false, basic: true, atk: true, spa: false });
  // Lignées v41 absentes de data.json : table LINES_V41.
  assert.deepEqual(p.get('drowzee'), { tank: false, basic: false, atk: false, spa: true });
  assert.deepEqual(p.get('goldeen'), { tank: false, basic: true, atk: true, spa: false });
  assert.equal(p.get('inconnu'), undefined);
});

test('profil de lignée : une lignée à deux formes ou inconnue suit la stat que ses objets portés lui donnent le plus', () => {
  const worn = rows => KT.lineProfiles({ holders: rows.map(([line, id, n]) => ({ line, id, n, lo: 50 })) }, data);
  const p = worn([['charmander', 'choice-specs', 30], ['charmander', 'choice-band', 20], ['growlithe', 'choice-band', 30],
    ['venonat', 'choice-specs', 30], ['nouveau', 'choice-specs', 30], ['oddish', 'choice-band', 30]]);
  assert.deepEqual(p.get('charmander'), { tank: false, basic: true, atk: false, spa: true });
  assert.deepEqual(p.get('growlithe'), { tank: false, basic: true, atk: true, spa: false });
  // Mimitoss (v41, deux formes) et une lignée inconnue : lues comme une lignée à deux formes.
  assert.deepEqual(p.get('venonat'), { tank: false, basic: true, atk: false, spa: true });
  assert.deepEqual(p.get('nouveau'), { tank: false, basic: true, atk: false, spa: true });
  // Une seule forme : les objets portés n'y changent rien (Mystherbe avec Bandeau Choix reste un lanceur).
  assert.deepEqual(p.get('oddish'), { tank: false, basic: false, atk: false, spa: true });
  // Deux formes sans objet d'attaque porté : l'Attaque. Deux formes sur d'autres axes (Ronflex : PV contre Défense) : sa capacité.
  const q = worn([['charmander', 'leftovers', 30], ['snorlax', 'choice-specs', 30], ['tangela4', 'leftovers', 30], ['jigglypuff', 'leftovers', 30]]);
  assert.deepEqual([q.get('charmander').atk, q.get('charmander').spa], [true, false]);
  assert.deepEqual([q.get('snorlax').atk, q.get('snorlax').spa], [true, false]);
  // Seuil des attaques de base : Saquedeneu (0,90) les compte, Rondoudou (0,76) non.
  assert.deepEqual([q.get('tangela4').basic, q.get('jigglypuff').basic], [true, false]);
  // Stade sans échelle de capacité : la lignée est lue comme inconnue, sur ses objets portés.
  const bare = { ...data, lines: { ...data.lines, oddish: { ...data.lines.oddish, stars: data.lines.oddish.stars.map(s => ({ stats: s.stats })) } } };
  const r = KT.lineProfiles({ holders: [{ line: 'oddish', id: 'choice-band', n: 30, lo: 50 }] }, bare);
  assert.deepEqual(r.get('oddish'), { tank: false, basic: true, atk: true, spa: false });
});

test('objet qui convient au profil : stat d’attaque qui sert, défensif au tank, offensif à l’attaquant', () => {
  const ok = (profile, ids) => ids.map(id => KT.suits(data, profile, id));
  const phys = { tank: false, basic: true, atk: true, spa: false };
  assert.deepEqual(ok(phys, ['choice-band', 'life-orb', 'scope-lens', 'razor-fang', 'choice-specs', 'twisted-spoon', 'leftovers']),
    [true, true, true, true, false, false, false]);
  // Lanceur : pas d'Attaque seule ; Orbe Vie et Lentilscope donnent les deux stats (le critique se juge dans topHolders).
  const caster = { tank: false, basic: false, atk: false, spa: true };
  assert.deepEqual(ok(caster, ['choice-specs', 'quick-claw', 'twisted-spoon', 'life-orb', 'scope-lens', 'choice-band', 'razor-fang', 'protector']),
    [true, true, true, true, true, false, false, false]);
  // Capacité spéciale et attaques de base qui comptent (Carapuce) : les deux stats et le critique.
  const both = { tank: false, basic: true, atk: true, spa: true };
  assert.deepEqual(ok(both, ['choice-band', 'choice-specs', 'scope-lens']), [true, true, true]);
  // Lignée à deux formes jouée en spécial (Salamèche) : pas d'Attaque seule, le critique reste.
  const flexSpec = { tank: false, basic: true, atk: false, spa: true };
  assert.deepEqual(ok(flexSpec, ['choice-band', 'choice-specs', 'scope-lens']), [false, true, true]);
  // Casque Brut : recette PV Plus + Protéine, mais stats PV Plus + Fer (inherits).
  const tank = { tank: true, basic: true, atk: true, spa: false };
  assert.deepEqual(ok(tank, ['leftovers', 'rocky-helmet', 'razor-fang', 'choice-band', 'twisted-spoon']), [true, true, true, false, false]);
  assert.equal(KT.suits(data, null, 'choice-band'), true);
});

test('objets idéaux d’un lanceur : pas de Lentilscope, même bien classé chez les joueurs', () => {
  const p = KT.lineProfiles(torre, data);
  const top = (line, profile) => KT.topHolders(torre, data, line, profile).map(h => h.id);
  assert.deepEqual(top('vulpix', null), ['choice-specs', 'scope-lens', 'quick-claw']);
  assert.deepEqual(top('vulpix', p.get('vulpix')), ['choice-specs', 'quick-claw', 'twisted-spoon']);
  // Pikachu, tireur : ses attaques de base comptent, Lentilscope reste.
  assert.ok(top('pikachu', p.get('pikachu')).includes('scope-lens'));
  // Déjà porté, Lentilscope n'est pas contraire (Atq. Spé. et vitesse) : pas d'Aimant pour lui seul.
  assert.deepEqual(advise(withItems(['magnet'], { d: ['scope-lens'] })).bag, [null]);
});

test('objets : un composant dont la stat ne sert pas le Pokémon attend au sac l’autre composant de la recette', () => {
  // Orbe Vie (Protéine + Calcium) en tête des objets de Goupix, lanceur : la Protéine seule ne lui apporte rien.
  const orb = { ...torre, holders: [...torre.holders, { line: 'vulpix', id: 'life-orb', n: 500, lo: 99 }] };
  const bag = (items, held = {}) => titles(advise(withItems(items, { a: FULL3, b: FULL3, ...held }), { stats: orb }));
  assert.deepEqual(bag(['protein']), ['Garde Protéine — pour Goupix, avec Calcium : Orbe Vie']);
  const pair = 'Protéine + Calcium → Goupix — Orbe Vie, meilleur objet de sa lignée en Tour';
  assert.deepEqual(bag(['protein', 'calcium']), [pair, pair]);
  assert.deepEqual(bag(['protein'], { d: ['calcium'] }), ['Protéine → Goupix — fusionne avec Calcium : Orbe Vie, meilleur objet de sa lignée en Tour']);
  // Le Calcium, qui le sert, se pose seul.
  assert.match(bag(['calcium'])[0], /^Calcium → Goupix — .* tout de suite ; plus tard avec Protéine : Orbe Vie, meilleur objet de sa lignée en Tour$/);
  // Minidraco, physique : la Protéine seule lui sert, elle se pose.
  assert.equal(advise(withItems(['protein'])).bag[0].title, 'Protéine → Minidraco');
  // Récompense : le Calcium, qui se pose seul, passe avant la Protéine, qui attendrait au sac ; seule offerte, elle se prend.
  const reward = offer => advise({ ...withItems([], { a: FULL3, b: FULL3 }), itemReward: offer }, { stats: orb }).reward.map(m => m && `${m.title} — ${m.why}`);
  assert.deepEqual(reward(['protein', 'calcium']), [null, 'Prends Calcium — entame Orbe Vie pour Goupix']);
  assert.deepEqual(reward(['protein', 'zinc']), ['Prends Protéine — Orbe Vie pour Goupix, avec Calcium', null]);
});

test('objets : paire idéale, composant seul vers sa recette, composant gardé pour une lignée à venir', () => {
  const a = advise(S57_4);
  assert.deepEqual(a.bag.map(m => m.title), ['PV Plus → Minidraco', 'Calcium + Fer → Goupix', 'Calcium + Fer → Goupix']);
  assert.match(a.bag[0].why, /PV tout de suite ; plus tard avec Carbone : Ceinture Force, meilleur objet de sa lignée en Tour$/);
  assert.equal(a.bag[1].why, 'Cuiller Tordue, meilleur objet de sa lignée en Tour');
  const b = advise(withItems(S57.items, SPOON));
  assert.deepEqual(b.bag.map(m => m.title), ['PV Plus → Minidraco', 'Garde Fer', 'Calcium → Goupix']);
  assert.equal(b.bag[1].why, 'Cuiller Tordue pour Lokhlass, à venir');
  assert.match(b.bag[2].why, /tout de suite ; plus tard avec Calcium : Lunettes Choix, meilleur objet de sa lignée en Tour$/);
  assert.deepEqual(advise(withItems(['emblem-fire'])).bag, [null]);
});

test('objets : une 2ᵉ copie du composant seul posé n’attend pas sa fusion', () => {
  // Le premier Fer entame Cuiller Tordue sur Goupix ; la recette n'attend plus que le Calcium : le deuxième Fer va à Lokhlass,
  // à venir, le troisième n'a plus de recette.
  const bag = titles(advise(withItems(['iron', 'iron', 'iron'])));
  assert.match(bag[0], /^Fer → Goupix — /);
  assert.deepEqual(bag.slice(1), ['Garde Fer — Cuiller Tordue pour Lokhlass, à venir', 'Garde Fer — hors des meilleurs objets de la compo']);
});

test('objets : un complément possédé est porteur, même faible', () => {
  // S57 au niveau 8 : Rattata ★ entre dans la compo faute de mieux, et Poudre Métal (Fer + Zinc) est un de ses objets idéaux.
  const a = advise({ ...S57, units: withItems([], SPOON).units });
  assert.deepEqual(a.bag.map(m => m.title), ['PV Plus → Minidraco', 'Fer → Rattata', 'Calcium → Goupix']);
  assert.match(a.bag[1].why, /plus tard avec Zinc : Poudre Métal, meilleur objet de sa lignée en Tour$/);
});

test('objets : seuls les objets idéaux sont posés, le reste attend au sac', () => {
  // Orbe Vie convient à Minidraco, mais n'est l'objet idéal d'aucun Pokémon de la compo.
  assert.deepEqual(titles(advise(withItems(['eviolite', 'life-orb']))), [
    'Garde Poudre Métal — hors des meilleurs objets de la compo', 'Garde Orbe Vie — hors des meilleurs objets de la compo',
  ]);
  assert.deepEqual(titles(advise(withItems(['choice-specs', 'razor-fang', 'twisted-spoon'], SPOON))), [
    'Lunettes Choix → Goupix — meilleur objet de sa lignée en Tour', 'Garde Croc Rasoir — hors des meilleurs objets de la compo',
    'Garde Cuiller Tordue — pour Lokhlass, à venir',
  ]);
  // Minidraco et Caninos pleins : Bandeau Choix ne va pas à Goupix (spécial) ; Minidraco, possédé, passe avant Ptéra à venir.
  const band = advise(withItems(['choice-band'], { a: FULL3, b: FULL3 }));
  assert.deepEqual([band.bag[0].title, band.bag[0].why], ['Garde Bandeau Choix', 'pour Minidraco, sans place libre']);
  assert.ok(band.aims[0].aims.some(y => y.id === 'choice-band' && y.state === 'ready'));
  assert.deepEqual(advise(withItems(['leftovers', 'leftovers'])).bag.map(brief), ['opt Garde', 'opt Garde']);
  // Copie en trop d'un objet idéal que seul Goupix vise.
  assert.equal(advise(withItems(['quick-claw'], { d: ['quick-claw'] })).bag[0].why, 'déjà sur Goupix');
});

test('objets : composant seul hors des recettes idéales, retiré par l’Aimant ; fusion idéale avant les autres poses', () => {
  // PV Plus seul sur Goupix n'entre dans aucune de ses recettes : les Calcium (Lunettes Choix) l'attendent, l'Aimant le retire.
  const blocked = withItems(['calcium', 'calcium'], { d: ['hp-up'] });
  const why = items => advise({ ...blocked, items }).bag.map(m => m && m.why);
  assert.deepEqual(why(['calcium', 'calcium']), ['pour Goupix, bloqué par PV Plus seul', 'pour Goupix, bloqué par PV Plus seul']);
  assert.deepEqual(titles(advise({ ...blocked, items: ['magnet', 'calcium', 'calcium'] })), [
    'Aimant sur Goupix — retire PV Plus ; Lunettes Choix prêt au sac',
    'Garde Calcium — pour Goupix, après l’Aimant', 'Garde Calcium — pour Goupix, après l’Aimant',
  ]);
  // Un seul Calcium : la recette n'est pas prête, pas d'Aimant. Un objet complet se pose sans fusionner : pas d'Aimant non plus.
  assert.deepEqual(why(['magnet', 'calcium']), [null, 'pour Goupix, bloqué par PV Plus seul']);
  assert.deepEqual(titles(advise({ ...blocked, items: ['magnet', 'choice-specs'] })),
    [null, 'Lunettes Choix → Goupix — meilleur objet de sa lignée en Tour']);
  // Protéine seule sur Minidraco, dans ses recettes : PV Plus (Ceinture Force) attend sa fusion.
  assert.equal(advise(withItems(['hp-up'], { a: ['protein'], b: FULL3, d: FULL3 })).bag[0].why, 'pour Minidraco, une fois Protéine fusionné');
  // Ceinture Force, autre objet idéal du Pokémon vidé, attend elle aussi l'Aimant.
  const emptied = advise(withItems(['magnet', 'choice-band', 'focus-sash'], { a: ['life-orb', 'shell-bell', 'hp-up'], b: FULL3 }));
  assert.equal(emptied.bag[2].why, 'pour Minidraco, après l’Aimant');
  // Minidraco porte une Protéine seule : Carbone la fusionne en Lentilscope, puis PV Plus, posé après, entame Ceinture Force,
  // quel que soit l'ordre du sac.
  const held = { a: ['protein'], b: FULL3, d: FULL3 };
  const order = items => advise(withItems(items, held)).bag.map(m => `${m.title} : ${m.why.match(/Lentilscope|Ceinture Force/)?.[0]}`);
  assert.deepEqual(order(['hp-up', 'carbos']), ['PV Plus → Minidraco : Ceinture Force', 'Carbone → Minidraco : Lentilscope']);
  assert.deepEqual(order(['carbos', 'hp-up']), ['Carbone → Minidraco : Lentilscope', 'PV Plus → Minidraco : Ceinture Force']);
  assert.match(advise(withItems(['hp-up', 'carbos'], held)).bag[0].why, /\(après Carbone\)$/);
  // Paire déjà donnée à Minidraco, puis PV Plus seul complété par Carbone : la Protéine vue entre les deux entame Lentilscope.
  const late = advise(withItems(['protein', 'protein', 'hp-up', 'protein', 'carbos'], { b: FULL3, d: FULL3 })).bag;
  assert.equal(late[3].title, 'Protéine → Minidraco');
});

test('objets : chaque composant conseillé pour une seule recette ; après une paire, l’ordre de pose est donné', () => {
  const a = advise(withItems(['protein', 'hp-up', 'carbos']));
  assert.deepEqual(a.bag.map(m => m.title), ['Protéine + Carbone → Minidraco', 'PV Plus → Minidraco', 'Protéine + Carbone → Minidraco']);
  assert.match(a.bag[1].why, /\(après Protéine \+ Carbone\)$/);
  const two = advise(withItems(['protein', 'hp-up', 'carbos', 'carbos'])).bag;
  assert.deepEqual(two.map(m => m.title), ['Protéine + Carbone → Minidraco', 'PV Plus + Carbone → Caninos', 'Protéine + Carbone → Minidraco', 'PV Plus + Carbone → Caninos']);
});

test('objets : jamais de 4ᵉ objet ; « Garde » quand toute la compo est pleine', () => {
  const full = advise(withItems(['protein', 'carbos'], { a: FULL3 }));
  assert.ok(full.bag.every(m => m.label !== '→ Minidraco'));
  const none = advise(withItems(['protein'], { a: FULL3, b: FULL3, d: FULL3 }));
  assert.deepEqual([brief(none.bag[0]), none.bag[0].why], ['opt Garde', 'pour Minidraco, sans place libre']);
  const claw = advise(withItems(['quick-claw'], { a: FULL3, b: FULL3, d: FULL3 })).bag[0];
  assert.deepEqual([brief(claw), claw.why], ['opt Garde', 'pour Goupix, sans place libre']);
  // Composant seul sur un Pokémon déjà à 3 objets : la fusion ne prend pas de place.
  const fuse = advise(withItems(['carbos'], { a: ['protein', 'life-orb', 'shell-bell'], b: FULL3, d: FULL3 })).bag[0];
  assert.deepEqual([fuse.title, fuse.why], ['Carbone → Minidraco', 'fusionne avec Protéine : Lentilscope, meilleur objet de sa lignée en Tour']);
  const nobody = advise({ ...S57, items: ['protein'], units: {}, board: {}, bench: [] }).bag[0];
  assert.deepEqual([brief(nobody), nobody.why], ['opt Garde', 'Lentilscope pour Ptéra, à venir']);
});

test('objets : composant qui fusionne avec celui déjà porté en objet idéal, copie qui porte des objets prioritaire', () => {
  const a = advise(withItems(['carbos'], { a: ['protein'] }));
  assert.deepEqual([a.bag[0].title, a.bag[0].why], ['Carbone → Minidraco', 'fusionne avec Protéine : Lentilscope, meilleur objet de sa lignée en Tour']);
  // Deux Caninos ★ au banc : celui qui porte la Protéine est le porteur retenu.
  assert.equal(advise(withItems(['carbos'], { c: ['protein'] })).bag[0].title, 'Carbone → Caninos');
});

test('Aimant : objet contraire au profil, puis objet idéal prêt au sac, gardé pour l’après', () => {
  const wrong = advise(withItems(['magnet'], { a: ['leftovers'] })).bag[0];
  assert.deepEqual([brief(wrong), wrong.title, wrong.why], ['do Retire de Minidraco', 'Aimant sur Minidraco', 'retire Restes (défensif sur un attaquant)']);
  const spec = advise(withItems(['magnet'], { d: ['choice-band'] })).bag[0];
  assert.equal(spec.why, 'retire Bandeau Choix (physique sur un spécial)');
  // Minidraco plein sans Bandeau Choix : les deux Protéine attendent l'Aimant.
  const ready = advise(withItems(['magnet', 'protein', 'protein'], { a: FULL3 }));
  assert.deepEqual(titles(ready), [
    'Aimant sur Minidraco — retire Orbe Vie ; Bandeau Choix prêt au sac',
    'Garde Protéine — pour Minidraco, après l’Aimant', 'Garde Protéine — pour Minidraco, après l’Aimant',
  ]);
  // Rien de contraire ni de prêt : pas d'Aimant, même sur un Pokémon hors compo.
  const idle = { ...withItems(['magnet']), units: { ...S57.units, e: { ...S57.units.e, items: ['leftovers'] } } };
  assert.deepEqual(advise(idle).bag, [null]);
});

test('Aimant : deux Aimants, emblème porté, Pokémon vidé qui ne reçoit rien, Pokémon posé hors des compos', () => {
  // Deux Pokémon pleins visent Bandeau Choix, une seule paire de Protéine : le 2ᵉ Aimant ne réserve rien de plus.
  const two = advise(withItems(['magnet', 'magnet', 'protein', 'protein'], { a: FULL3, b: FULL3 }));
  assert.deepEqual(two.bag.map(brief), ['do Retire de Minidraco', null, 'opt Garde', 'opt Garde']);
  // Un emblème n'est pas un objet contraire, même sans profil de lignée.
  assert.deepEqual(advise(withItems(['magnet'], { a: ['emblem-fire'] })).bag, [null]);
  const bare = KT.advise({ mode: T, stats: { ...torre, holders: torre.holders.filter(h => KT.baseLine(h.line) !== 'vulpix') }, data, lang,
    save: withItems(['magnet'], { d: ['emblem-fire', 'choice-band'] }), previous: null, side: 'left' });
  assert.deepEqual(bare.bag, [null]);
  // Minidraco (Restes, contraire) se vide : Ceinture Force, son 2ᵉ objet idéal, va à Caninos (3ᵉ).
  const after = advise(withItems(['magnet', 'focus-sash'], { a: ['leftovers'] }));
  assert.deepEqual(after.bag.map(m => m.title), ['Aimant sur Minidraco', 'Ceinture Force → Caninos']);
  // Rattata posé, hors des deux compos, porte des objets : l'Aimant les récupère.
  const stray = { ...withItems(['magnet']), units: { ...S57.units, e: { ...S57.units.e, items: ['life-orb'] } }, board: { ...S57.board, 50: 'e' },
    bench: ['b', 'c', null, null, null, null, null, null, null] };
  const m = advise(stray).bag[0];
  assert.deepEqual([m.title, m.why], ['Aimant sur Rattata', 'hors des compos : récupère ses objets']);
});

test('Aimant : un tank qui porte un objet de la stat contraire est dit « spécial sur un physique »', () => {
  const a = brockAdvice(['geodude', 'bulbasaur', 'abra'], {
    bench: ['g'], items: ['magnet'],
    units: { g: { id: 'g', line: 'geodude', star: 1, items: ['twisted-spoon'] } },
  });
  assert.equal(a.bag[0].why, 'retire Cuiller Tordue (spécial sur un physique)');
});

test('récompense d’objet : sans Pokémon de la compo, prépare une lignée à venir', () => {
  const a = advise({ ...S57, units: {}, board: {}, bench: [], itemReward: ['carbos'] });
  assert.deepEqual([brief(a.reward[0]), a.reward[0].why], ['do Prends', 'Lentilscope pour Ptéra, à venir']);
});

test('formation : un tank à distance (Onix) passe au premier rang avant la mêlée', () => {
  const code = brockAdvice(['onix', 'machop', 'abra'], {
    level: 2, bench: ['o', 'z'],
    units: { o: { id: 'o', line: 'onix', star: 2 }, z: { id: 'z', line: 'zubat', star: 1 } },
  }).code;
  assert.match(code, /;onix:2:3/);
});

test('objets : une copie gardée par composant à venir, pas d’Aimant si la fusion suffit', () => {
  // Cuiller Tordue de Lokhlass demande un Fer : un seul est gardé pour elle.
  assert.deepEqual(advise(withItems(['iron', 'iron', 'iron'], SPOON)).bag.map(m => m.why), [
    'Cuiller Tordue pour Lokhlass, à venir', 'hors des meilleurs objets de la compo', 'hors des meilleurs objets de la compo',
  ]);
  // Minidraco plein porte une Protéine seule : la Protéine du sac fusionne en Bandeau Choix, l'Aimant ne sert pas.
  const lone = advise(withItems(['magnet', 'protein', 'protein'], { a: ['life-orb', 'shell-bell', 'protein'] }));
  assert.deepEqual(lone.bag.map(m => m && m.title), [null, 'Protéine → Minidraco', 'Protéine → Caninos']);
  assert.match(lone.bag[2].why, /Attaque tout de suite ; plus tard avec Carbone : Lentilscope, meilleur objet de sa lignée en Tour$/);
});

test('objets visés et Aimant : objet gardé après l’Aimant prêt pour lui seul, emblème jamais retiré, motifs exacts', () => {
  const aims = save => Object.fromEntries(advise(save).aims.map(x => [x.unit.line, x.aims.map(y => `${y.id}:${y.state}`)]));
  // Bandeau Choix complet gardé pour Minidraco après l'Aimant : prêt pour lui, pas « manque Protéine ».
  const band = withItems(['magnet', 'choice-band'], { a: ['life-orb', 'shell-bell', 'hp-up'] });
  assert.equal(advise(band).bag[1].why, 'pour Minidraco, après l’Aimant');
  assert.ok(aims(band).dratini.includes('choice-band:ready'));
  // Deux Protéine gardées pour Minidraco : Caninos ne les compte pas.
  const proteins = aims(withItems(['magnet', 'protein', 'protein'], { a: ['life-orb', 'shell-bell', 'hp-up'] }));
  assert.ok(proteins.dratini.includes('choice-band:ready'));
  assert.ok(proteins.growlithe.includes('choice-band:missing'));
  // Composant seul porté sans son complément au sac : l'Aimant fait place à Lentilscope ; un emblème n'est jamais retiré.
  const lens = advise(withItems(['magnet', 'scope-lens'], { a: ['life-orb', 'shell-bell', 'carbos'] })).bag[0];
  assert.equal(lens.why, 'retire Orbe Vie ; Lentilscope prêt au sac');
  const emblem = advise(withItems(['magnet', 'scope-lens'], { a: ['emblem-fire', 'choice-band', 'focus-sash'] })).bag[0];
  assert.equal(emblem, null);
});

test('Aimant : un objet offensif mixte sur un tank est dit « offensif sur un tank »', () => {
  const a = brockAdvice(['geodude', 'bulbasaur', 'abra'], {
    bench: ['g'], items: ['magnet'],
    units: { g: { id: 'g', line: 'geodude', star: 1, items: ['life-orb'] } },
  });
  assert.equal(a.bag[0].why, 'retire Orbe Vie (offensif sur un tank)');
});

test('vente : Pokémon hors des deux compos qui porte des objets, gardé s’il sert à la compo suivante', () => {
  const lay = {
    ...S57_4, units: { ...S57.units, e: { ...S57.units.e, items: ['protein'] }, f: { id: 'f', line: 'lapras', star: 1, items: ['iron'] } },
    bench: ['b', 'c', 'e', 'f', null, null, null, null, null],
  };
  const a = advise(lay);
  assert.deepEqual([brief(a.bench[2]), a.bench[2].why], ['no Vends', 'hors des compos : il rend ses objets au sac']);
  assert.equal(a.bench[3], null);
});

test('objets visés : les objets idéaux, lus sur l’état final des conseils du sac', () => {
  const aimsOf = save => Object.fromEntries(advise(save).aims.map(x => [x.unit.line, x.aims.map(y => `${y.id}:${y.state}:${y.missing.join('+')}`)]));
  // Lu après les conseils du sac : PV Plus posé sur Minidraco (Ceinture Force), Protéine sur Caninos (Bandeau Choix), Calcium sur
  // Goupix (Lunettes Choix) ; ce qui est posé ailleurs manque.
  assert.deepEqual(aimsOf(withItems(['hp-up', 'calcium', 'protein'], { a: ['choice-band'] })), {
    dratini: ['choice-band:worn:', 'focus-sash:missing:carbos', 'scope-lens:missing:protein+carbos'],
    vulpix: ['choice-specs:missing:calcium', 'quick-claw:missing:carbos', 'twisted-spoon:missing:iron'],
    growlithe: ['scope-lens:missing:carbos', 'choice-band:missing:protein', 'focus-sash:missing:hp-up+carbos'],
  });
  // Lentilscope au sac : posée sur Caninos (rang 1 de ses idéaux), la section le dit prête pour lui seul.
  const lens = aimsOf(withItems(['scope-lens']));
  assert.deepEqual([lens.growlithe[0], lens.dratini[2]], ['scope-lens:ready:', 'scope-lens:missing:protein+carbos']);
  // Orbe Vie et Grelot Coque, portés mais hors des objets idéaux, ne sont pas visés.
  assert.deepEqual(aimsOf(withItems([], { a: FULL3 })).dratini,
    ['choice-band:missing:protein+protein', 'focus-sash:missing:hp-up+carbos', 'scope-lens:worn:']);
  // Protéine + Carbone : Lentilscope prête pour Minidraco (porteur, servi d'abord), plus pour les suivants.
  const ready = aimsOf(withItems(['protein', 'carbos']));
  assert.equal(ready.dratini[2], 'scope-lens:ready:');
  assert.equal(ready.growlithe[0], 'scope-lens:missing:protein+carbos');
});

test('objets idéaux : 3 objets complets de la lignée exacte, ≥ 20 combats, par borne basse, qui conviennent', () => {
  const phys = { tank: false, basic: true, atk: true, spa: false };
  assert.deepEqual(KT.topHolders(torre, data, 'dratini', phys).map(h => h.id), ['choice-band', 'focus-sash', 'scope-lens']);
  assert.deepEqual(KT.topHolders(torre, data, 'inconnu', phys), []);
  // Composant, moins de 20 combats, forme ancrée, objet contraire : écartés même avec la meilleure borne basse.
  const holders = [
    { line: 'dratini', id: 'leftovers', n: 20, lo: 50 }, { line: 'dratini', id: 'iron', n: 99, lo: 90 },
    { line: 'dratini', id: 'choice-band', n: 19, lo: 90 }, { line: 'dratini-a1', id: 'focus-sash', n: 99, lo: 90 },
    { line: 'dratini', id: 'twisted-spoon', n: 99, lo: 95 },
  ];
  assert.deepEqual(KT.topHolders({ holders }, data, 'dratini', null).map(h => h.id), ['twisted-spoon', 'leftovers']);
  assert.deepEqual(KT.topHolders({ holders }, data, 'dratini', phys), []);
});

test('récompense d’objet : compléter la recette idéale, sinon préparer celle d’une lignée à venir', () => {
  const a = advise({ ...S57_4, itemReward: ['protein', 'carbos', 'zinc'] });
  assert.deepEqual(a.reward.map(brief), [null, 'do Prends', null]);
  assert.equal(a.reward[1].why, 'complète Ceinture Force sur Minidraco');
  const later = advise({ ...S57_4, itemReward: ['iron', 'zinc'] });
  assert.deepEqual([brief(later.reward[0]), later.reward[0].why], ['do Prends', 'Cuiller Tordue pour Lokhlass, à venir']);
});

test('bénédictions : PV bas, puis Fortune jusqu’à 3, puis voie la plus avancée', () => {
  const choose = (boons, ids, hp = 62) => advise({ ...S57, hp, tower: { boons, offer: { ids } } }).offer.map(brief);
  assert.deepEqual(choose(['nugget'], ['nugget', 'leftovers', 'flute']), ['do Prends', null, null]);
  assert.deepEqual(choose(['nugget'], ['nugget', 'leftovers', 'flute'], 30), [null, 'do Prends', null]);
  assert.deepEqual(choose(['nugget', 'fbag', 'coincase', 'ash'], ['nugget', 'leftovers', 'flute']), [null, 'do Prends', null]);
  assert.deepEqual(choose(['nugget', 'fbag', 'coincase'], ['egg', 'flute', 'team']), [null, 'do Prends', null]);
  // Voie déjà complète : plus de « 4 sur 3 ».
  const full = advise({ ...S57, tower: { boons: ['flute', 'vitamins', 'item'], offer: { ids: ['flute', 'amulet', 'team'] } } }).offer[0];
  assert.deepEqual([full.why, full.detail], ['meilleur effet immédiat', '']);
  assert.equal(advise({ ...S57, tower: { boons: [], offer: { ids: ['nugget'] } } }).offer[0].title, 'Prends Maxi Pépite');
  const unknown = advise({ ...S57, tower: { boons: [], offer: { ids: ['nouvelle', 'flute'] } } });
  assert.deepEqual(unknown.unknownOffer, ['nouvelle']);
  assert.deepEqual(unknown.offer.map(brief), [null, 'do Prends']);
});

test('sceaux : économie tôt, combat en tout jouer, risque évité avec peu de PV', () => {
  const choose = (ids, extra = {}) => advise({ ...S57, ...extra, tower: { boons: [], offer: { ids } } }).offer.map(brief);
  assert.deepEqual(choose(['piggy-bank', 'poke-flute']), ['do Prends', null]);
  assert.deepEqual(choose(['piggy-bank', 'poke-flute'], { round: 1059 }), [null, 'do Prends']);
  assert.deepEqual(choose(['rocket-loan', 'poke-flute'], { hp: 30 }), ['no Évite', 'do Prends']);
  assert.deepEqual(choose(['rocket-loan', 'life-orb'], { hp: 30 }), ['no Évite', 'no Évite']);
  const risky = advise({ ...S57, hp: 30, tower: { boons: [], offer: { ids: ['rocket-loan', 'life-orb'] } } }).offer;
  assert.notEqual(risky[0].title, risky[1].title);
  // Sans data.json, un sceau n'est pas présenté comme une bénédiction inconnue.
  const noData = KT.advise({ mode: T, stats: torre, data: null, lang, save: { ...S57, tower: { boons: [], offer: { ids: ['piggy-bank', 'flute'] } } }, previous: null, side: 'left' });
  assert.deepEqual([noData.unknownOffer, noData.offer.map(brief)], [[], [null, 'do Prends']]);
  // Offre mêlée : un sceau de combat en tout jouer passe devant une bénédiction hors voie.
  assert.deepEqual(choose(['team', 'poke-flute'], { round: 1059 }), [null, 'do Prends']);
});

test('ancrage : conseillé si la compo vise une forme ancrée non encore choisie', () => {
  const target = { core: ['dratini-a0', 'aerodactyl', 'growlithe'], fillers: [] };
  const twins = { ...S57, units: { ...S57.units, a: { id: 'a', line: 'dratini', star: 1 }, f: { id: 'f', line: 'dratini', star: 1 } }, bench: [...S57.bench.slice(0, 3), 'f'] };
  const game = readGame(twins);
  assert.equal(KT.anchorAdvice(target, game, names)[0].title, 'Ancre Minidraco (fiche du Pokémon)');
  assert.deepEqual(KT.anchorAdvice(target, readGame(S57), names), []);
  const pair2 = { ...S57, units: { ...S57.units, f: { id: 'f', line: 'dratini', star: 2 } }, bench: [...S57.bench.slice(0, 3), 'f'] };
  assert.equal(KT.anchorAdvice(target, readGame(pair2), names).length, 1);
  assert.deepEqual(KT.anchorAdvice(target, { ...game, anchor: { dratini: 0 } }, names), []);
  assert.deepEqual(KT.anchorAdvice(target, readGame({ ...S57, units: {}, board: {}, bench: [] }), names), []);
});

test('formation : code KT1 trié par cellule, Pokémon bien placé gardé, porteur côté choisi', () => {
  // S57 : Minidraco (case 29 → cellule 1, mêlée au premier rang) garde sa case ; Goupix (31 → 3, portée 3 au premier rang) part
  // en 3ᵉ rangée, Magmar (portée 3) deux colonnes plus loin ; Rattata (tank, au banc) prend le centre de l'avant, puis Ptéra,
  // Caninos et Abo (mêlée) les cases libres depuis le centre.
  assert.equal(advise(S57).code,
    'KT1;r41;xm=tower;xn=Plan%20kanto-overlay;dratini:2:1:choice-band.focus-sash.scope-lens;aerodactyl:1:2;'
    + 'rattata:1:3:eviolite.rocky-helmet.leftovers;growlithe:1:4:scope-lens.choice-band.focus-sash;ekans:1:5;'
    + 'vulpix:2:14:choice-specs.quick-claw.twisted-spoon;magmar:1:16');
  assert.match(advise(S57, { side: 'right' }).code, /magmar:1:18;vulpix:2:20:choice-specs.quick-claw.twisted-spoon$/);
});

test('formation : case de la sauvegarde → cellule KT1 (côté joueur = cases 28 à 55)', () => {
  assert.deepEqual([38, 28, 55, 27, 56, undefined].map(KT.boardCell), [10, 0, 27, null, null, null]);
});

test('formation : dans la limite du niveau, cœur possédé d’abord', () => {
  const units = advise({ ...S57, level: 2 }).code.split(';').slice(4).map(u => u.split(':')[0]);
  assert.deepEqual(units.sort(), ['dratini', 'growlithe']);
});

// Cellule de chaque lignée d'un code KT1.

test('formation : une seule unité par cellule, niveaux 3 à 10, pour chaque zone du porteur', () => {
  for (const side of ['left', 'center', 'right']) {
    for (let level = 3; level <= 10; level++) {
      const cells = Object.values(cellsOf(advise({ ...S57, level }, { side }).code));
      assert.equal(new Set(cells).size, cells.length, `niveau ${level}, ${side}`);
      assert.ok(cells.every(c => c >= 0 && c <= 27));
    }
  }
});

const BENCH = ids => [...ids, ...Array(9 - ids.length).fill(null)];
const moves = (save, extra) => advise(save, extra).moves.map(m => `${m.title} — ${m.why}`);

test('déplacements : d’abord libérer la case, puis poser depuis le banc', () => {
  // S57 : Goupix (portée 3) quitte la case avant-colonne 4 pour Rattata (tank) ; Caninos (mêlée) est posé à côté.
  assert.deepEqual(moves(S57), ['Déplace Goupix — avant, colonne 4 → 3ᵉ rangée, colonne 1', 'Pose Rattata — avant, colonne 4', 'Pose Caninos — avant, colonne 5']);
  assert.ok(advise(S57).moves.every(m => m.level === 'do' && m.label === ''));
  // Déjà bien placé partout : aucun déplacement.
  assert.deepEqual(moves({ ...S57, level: 2, board: { 29: 'a', 31: 'b' }, bench: BENCH(['c', 'd', 'e']) }), []);
});

test('déplacements : remplacer l’occupant hors formation, ranger au banc faute de place, copie en double comptée', () => {
  // Niveau 3 (Minidraco, Caninos, Ptéra) : Rattata, hors formation, occupe la case de Caninos.
  assert.deepEqual(moves({ ...S57, level: 3, board: { 29: 'a', 31: 'd', 30: 'e' }, bench: BENCH(['b', 'c']) }),
    ['Pose Caninos — avant, colonne 3, à la place de Rattata']);
  // Niveau 4, 3 posés : la 1ʳᵉ pose prend la place libre, la 2ᵉ fait ranger Rattata.
  const f = { id: 'f', line: 'ekans', star: 1 };
  assert.deepEqual(moves({ ...S57, level: 4, units: { ...S57.units, f }, board: { 29: 'a', 31: 'e', 32: 'f' }, bench: BENCH(['b', 'c', 'd']) }),
    ['Pose Caninos — avant, colonne 3', 'Pose Goupix — 3ᵉ rangée, colonne 1 ; range Rattata au banc']);
  // Caninos ★★ au banc, Caninos ★ posé : la copie posée n'est pas dans la formation, elle libère la place.
  const twins = { ...S57, level: 2, units: { ...S57.units, c: { id: 'c', line: 'growlithe', star: 2 } }, board: { 29: 'a', 30: 'b' }, bench: BENCH(['c', 'd', 'e']) };
  assert.deepEqual(moves(twins), ['Pose Caninos — avant, colonne 4 ; range Caninos au banc']);
});

test('déplacements rejoués comme le jeu : échange, occupant déplacé, Pokémon rangé hors des cases visées', () => {
  // Nosferapti (mêlée, fond colonne 1) et Abra (distance, avant colonne 4) échangent leurs cases : une seule consigne.
  const swap = brockAdvice(['zubat', 'abra', 'pidgey'], {
    level: 2, bench: [], board: { 49: 'z', 31: 'x' },
    units: { z: { id: 'z', line: 'zubat', star: 1 }, x: { id: 'x', line: 'abra', star: 1 } },
  });
  assert.deepEqual(swap.moves.map(m => `${m.title} — ${m.why}`), ['Déplace Nosferapti — fond, colonne 1 → avant, colonne 4 (échange avec Abra)']);
  // Goupix va sur la case de Rattata (42 → 3ᵉ rangée, colonne 1), qui passe sur l'ancienne case de Goupix : Caninos y est posé à
  // la place de Rattata.
  assert.deepEqual(moves({ ...S57, level: 4, board: { 29: 'a', 30: 'd', 42: 'e' }, bench: BENCH(['b', 'c']) }),
    ['Déplace Goupix — avant, colonne 3 → 3ᵉ rangée, colonne 1', 'Pose Caninos — avant, colonne 3, à la place de Rattata']);
  // Plateau plein : Goupix prend la case de Rattata ; Caninos fait ranger Abo, pas un Pokémon dont la case sert à une pose.
  const units = { ...S57.units, f: { id: 'f', line: 'ekans', star: 1 }, h: { id: 'h', line: 'pidgey', star: 1 } };
  assert.deepEqual(moves({ ...S57, level: 4, units, board: { 29: 'a', 42: 'e', 31: 'f', 50: 'h' }, bench: BENCH(['b', 'c', 'd']) }),
    ['Pose Goupix — 3ᵉ rangée, colonne 1, à la place de Rattata', 'Pose Caninos — avant, colonne 3 ; range Abo au banc']);
});

const sortedCells = code => Object.values(cellsOf(code)).sort((a, b) => a - b);

test('formation : rangée = portée, 4 et plus au fond, sans colonne commune derrière l’avant', () => {
  // Kicklee (portée 2), Goupix (3), Abra (4, porteur) et Stari (5, complément) : 2ᵉ rangée, 3ᵉ rangée, fond.
  const spread = trioAdvice(['abra', 'hitmonlee', 'vulpix'], { abra: 2, hitmonlee: 1, vulpix: 1, staryu: 1 }, { level: 4 });
  assert.deepEqual(cellsOf(spread.code), { hitmonlee: 9, vulpix: 18, abra: 21, staryu: 27 });
  // Portée nulle dans les données : mêlée, à l'avant.
  const lines = { ...data.lines, vulpix: { ...data.lines.vulpix, range: 0 } };
  assert.equal(cellsOf(trioAdvice(['abra', 'hitmonlee', 'vulpix'], { vulpix: 1 }, { lines }).code).vulpix, 3);
});

test('formation : portée v41 de la définition propre, Smogo à l’avant, Chétiflor en 2ᵉ rangée', () => {
  const cells = cellsOf(trioAdvice(['koffing', 'bellsprout', 'zubat'], { koffing: 1, bellsprout: 1, zubat: 2 }).code);
  assert.ok(cells.koffing < 7, `Smogo case ${cells.koffing}`);
  assert.ok(cells.bellsprout >= 7 && cells.bellsprout < 14, `Chétiflor case ${cells.bellsprout}`);
});

test('formation : rangée pleine, débordement derrière, puis devant', () => {
  const all = ids => Object.fromEntries(ids.map(id => [id, 1]));
  // 8 unités de mêlée : la 8ᵉ en 2ᵉ rangée, depuis le centre.
  const melee = ['rattata', 'pidgey', 'zubat', 'caterpie', 'weedle', 'machop', 'diglett', 'geodude'];
  assert.deepEqual(sortedCells(trioAdvice(melee.slice(0, 3), all(melee), { level: 8 }).code), [0, 1, 2, 3, 4, 5, 6, 10]);
  // 8 unités de portée 3 : la 8ᵉ au fond, dans la première colonne de la zone (toutes les colonnes sont déjà prises).
  const ranged = ['vulpix', 'psyduck', 'oddish', 'gastly', 'squirtle', 'magnemite', 'jynx', 'magmar'];
  assert.deepEqual(sortedCells(trioAdvice(ranged.slice(0, 3), all(ranged), { level: 8 }).code), [14, 15, 16, 17, 18, 19, 20, 21]);
  // Les mêmes en portée 4 : le fond est plein, la 8ᵉ passe devant, en 3ᵉ rangée, dans la première colonne de la zone.
  const lines = { ...data.lines, ...Object.fromEntries(ranged.map(id => [id, { ...data.lines[id], range: 4 }])) };
  assert.deepEqual(sortedCells(trioAdvice(ranged.slice(0, 3), all(ranged), { level: 8, lines }).code), [14, 21, 22, 23, 24, 25, 26, 27]);
});

// Abra, portée 4 : au fond ; seul sur le plateau, à la case cell.
const abraAt = (cell, side) => trioAdvice(['abra', 'onix', 'zubat'], { abra: 2 }, { board: { [cell]: 'abra' }, side });
const said = a => a.moves.map(m => `${m.title} — ${m.why}`);

test('formation : porteur à distance au fond, dans les colonnes de la zone choisie', () => {
  assert.deepEqual(abraAt(29, 'left').moves.map(m => m.why), ['avant, colonne 2 → fond, colonne 1']);
  assert.deepEqual(abraAt(29, 'right').moves.map(m => m.why), ['avant, colonne 2 → fond, colonne 7']);
  // Centre : colonnes 3 à 5 du fond, colonne 4 d'abord.
  assert.deepEqual(abraAt(29, 'center').moves.map(m => m.why), ['avant, colonne 2 → fond, colonne 4']);
});

test('formation : porteur déjà sur une case de sa zone, gardé', () => {
  // Fond, colonne 3 : dans le coin gauche et au centre (gardé), hors du coin droit.
  assert.deepEqual(abraAt(51, 'left').moves, []);
  assert.match(abraAt(51, 'left').code, /abra:2:23/);
  assert.deepEqual(abraAt(51, 'center').moves, []);
  assert.deepEqual(abraAt(51, 'right').moves.map(m => m.why), ['fond, colonne 3 → fond, colonne 7']);
});

test('formation : colonnes déjà prises par une unité à distance évitées', () => {
  // Pikachu et Voltali (portée 4) déjà au fond en colonnes 1 et 3 : le porteur reste dans le coin (colonne 2), pas en colonne 5.
  const corner = trioAdvice(['abra', 'pikachu', 'jolteon'], { abra: 2, pikachu: 1, jolteon: 1 }, { board: { 49: 'pikachu', 51: 'jolteon' } });
  assert.deepEqual(said(corner), ['Pose Abra — fond, colonne 2']);
  // Centre : Psykokwak (à acheter) et Goupix, portée 3, évitent la colonne 4 du porteur : colonnes 2 puis 6 de la 3ᵉ rangée.
  const center = trioAdvice(['abra', 'psyduck', 'vulpix'], { abra: 2, vulpix: 1 }, { side: 'center' });
  assert.deepEqual(cellsOf(center.code), { psyduck: 15, vulpix: 19, abra: 24 });
  assert.deepEqual(said(center), ['Pose Goupix — 3ᵉ rangée, colonne 6', 'Pose Abra — fond, colonne 4']);
});

test('formation : porteur de portée 3 en 3ᵉ rangée, dans sa zone', () => {
  // Goupix ★★ ; déjà en 3ᵉ rangée colonne 3 (case 44), il la garde à gauche.
  const carry3 = (board, side) => trioAdvice(['vulpix', 'onix', 'zubat'], { vulpix: 2 }, { board, side });
  assert.deepEqual(said(carry3({}, 'right')), ['Pose Goupix — 3ᵉ rangée, colonne 7']);
  assert.deepEqual(said(carry3({ 44: 'vulpix' }, 'left')), []);
  assert.deepEqual(said(carry3({ 44: 'vulpix' }, 'right')), ['Déplace Goupix — 3ᵉ rangée, colonne 3 → 3ᵉ rangée, colonne 7']);
});

// Unités de S57 remplacées ou ajoutées ; shiny : +10 % (makeUnit du jeu), transmis par la fusion.
const withUnits = (units, extra = {}) => ({ ...S57, units: { ...S57.units, ...units }, ...extra });
// Les objets visés suivent l'ordre des porteurs : le porteur vient en tête.
const carry = s => advise(s).aims[0].unit.id;

test('shiny : lignée shiny si sa copie de meilleure étoile l’est, +2 points au trio', () => {
  const shiny = withUnits({ b: { ...S57.units.b, shiny: true } });
  assert.equal(KT.shinyLine(readGame(shiny), 'growlithe'), true);
  assert.equal(KT.shinyLine(readGame(S57), 'growlithe'), false);
  // Minidraco 2★ normal et 1★ shiny : pas de 2★ shiny annoncé (ni « s » dans le code KT1), et le 2★ reste le porteur.
  const lower = withUnits({ x: { id: 'x', line: 'dratini', star: 1, shiny: true } }, { bench: ['b', 'c', 'e', 'x', null, null, null, null, null] });
  assert.equal(KT.shinyLine(readGame(lower), 'dratini'), false);
  assert.match(advise(lower).code, /;dratini:2:\d+:/);
  assert.equal(carry(lower), 'a');
  const stops = KT.nextStops(torre.stops, 57, 3, T);
  const core = ['aerodactyl', 'dratini', 'growlithe'];
  assert.equal(KT.coreScore(core, stops, new Map(), readGame(shiny), data) - KT.coreScore(core, stops, new Map(), readGame(S57), data), 2);
});

test('shiny : « s » après l’étoile dans le code KT1', () => {
  assert.match(advise(withUnits({ a: { ...S57.units.a, shiny: true } })).code, /;dratini:2s:\d+:choice-band\.focus-sash\.scope-lens;/);
});

test('shiny : départage le porteur, le tank et le remplissage', () => {
  // Minidraco et Caninos à 2★ : le shiny devient porteur.
  const lay = { board: { ...S57.board, 30: 'b' }, bench: [null, 'c', 'e', null, null, null, null, null, null] };
  const g2 = { b: { ...S57.units.b, star: 2 } };
  assert.equal(carry(withUnits(g2, lay)), 'a');
  assert.equal(carry(withUnits({ b: { ...g2.b, shiny: true } }, lay)), 'b');
  // Deux tanks : Racaillou 1★ shiny (1056 × 1,1 PV) passe devant Bulbizarre 1★ (1084 PV).
  const tanks = shiny => brockAdvice(['geodude', 'bulbasaur', 'abra'], {
    bench: ['g', 'b'],
    units: { g: { id: 'g', line: 'geodude', star: 1, shiny }, b: { id: 'b', line: 'bulbasaur', star: 1 } },
  }).aims.map(x => x.unit.id);
  assert.deepEqual(tanks(false), ['b', 'g']);
  assert.deepEqual(tanks(true), ['g', 'b']);
  // Remplissage : Goupix et Pyroli 1★ ont le même coût et le même type ; le shiny passe devant.
  const fill = shiny => withUnits({ d: { id: 'd', line: 'vulpix', star: 1, shiny }, m: { id: 'm', line: 'flareon', star: 1 } },
    { level: 4, shop: [], bench: ['b', 'c', 'e', 'm', null, null, null, null, null] });
  assert.deepEqual(advise(fill(false)).target.fillers, ['flareon']);
  assert.deepEqual(advise(fill(true)).target.fillers, ['vulpix']);
});

test('shiny : pas de « Vends » jusqu’à l’étage 120, boutique sans raison shiny si la lignée l’est déjà', () => {
  const full = withUnits({
    f: { id: 'f', line: 'ekans', star: 1, shiny: true }, g: { id: 'g', line: 'zubat', star: 1 }, h: { id: 'h', line: 'zubat', star: 1 },
    i: { id: 'i', line: 'pidgey', star: 1 }, j: { id: 'j', line: 'pidgey', star: 1 },
  }, { level: 4, bench: ['b', 'c', 'e', 'f', 'g', 'h', 'i', 'j', null] });
  assert.equal(advise(full).bench[3], null);
  assert.equal(advise({ ...full, round: 1199 }).bench[3].title, 'Vends Abo');
  // Goupix 2★ normal (remplissage) : une carte 1★ shiny ne change pas la copie jouée.
  // 45 pièces : les ★ (9) et l'XP (4) laissent 32.
  const above = withUnits({}, { gold: 45, shop: ['vulpix', 'aerodactyl', 'magmar', 'rattata', 'ekans'], shopShiny: [true, false, false, false, false] });
  assert.deepEqual([brief(advise(above).shop[0]), advise(above).shop[0].why], ['opt Si l’or', 'renforce le plateau de la compo']);
  const owned = withUnits({ m: { id: 'm', line: 'magmar', star: 1, shiny: true } },
    { shopShiny: [false, false, true, false, false], bench: ['b', 'c', 'e', 'm', null, null, null, null, null] });
  // Magmar reste dans la compo : seule la raison shiny disparaît.
  assert.deepEqual([brief(advise(owned).shop[2]), advise(owned).shop[2].why], ['no Ignore', 'complément de la compo ; garde 30 pièces pour les intérêts']);
});

// Faux Cache Storage et faux fetch : la file `replies` donne les réponses (Error = rejet de fetch, textError = rejet de la
// lecture du corps) ; `sent` garde l'en-tête If-None-Match de chaque requête.
function fakeEnv(now) {
  const store = new Map();
  const env = {
    now,
    replies: [],
    sent: [],
    caches: { open: async () => ({ match: async url => store.get(url)?.clone(), put: async (url, res) => { store.set(url, res); } }) },
    fetch: async (url, init) => {
      env.sent.push(init?.headers?.['If-None-Match'] ?? null);
      const r = env.replies.shift();
      if (r instanceof Error) throw r;
      const res = new Response(r.body ?? null, { status: r.status, headers: r.etag ? { etag: r.etag } : {} });
      if (r.textError) res.text = async () => { throw r.textError; };
      return res;
    },
  };
  return env;
}
const URL_T = 'https://einoow.com/api/meta/kanto/lang.json?lang=fr';
const accept = j => j?.ok === true;
const hour = 3600 * 1000;

test('loadJson : cache d’une heure, revalidation 304 sans W/', async () => {
  const env = fakeEnv(0);
  env.replies.push({ status: 200, body: '{"ok":true,"v":1}', etag: 'W/"e1"' });
  assert.deepEqual((await KT.loadJson(URL_T, accept, env)).json, { ok: true, v: 1 });
  env.now = hour - 1;
  assert.equal((await KT.loadJson(URL_T, accept, env)).stale, false);
  assert.equal(env.sent.length, 1);
  env.now = hour;
  env.replies.push({ status: 304 });
  const r = await KT.loadJson(URL_T, accept, env);
  assert.deepEqual([env.sent[1], r.json.v, r.at, r.stale], ['"e1"', 1, hour, false]);
});

test('loadJson : copie gardée si erreur, format invalide ou corps coupé ; une tentative par heure', async () => {
  for (const reply of [{ status: 429 }, new TypeError('NetworkError'), { status: 200, body: '{"autre":1}' },
    { status: 200, body: '{"ok":true}', textError: new TypeError('coupé') }]) {
    const env = fakeEnv(0);
    env.replies.push({ status: 200, body: '{"ok":true,"v":1}' });
    await KT.loadJson(URL_T, accept, env);
    env.now = 2 * hour;
    env.replies.push(reply);
    const r = await KT.loadJson(URL_T, accept, env);
    assert.deepEqual([r.stale, r.json.v], [true, 1]);
    env.now = 2 * hour + 1;
    const again = await KT.loadJson(URL_T, accept, env);
    assert.deepEqual([env.sent.length, again.stale], [2, true]);
  }
});

test('loadJson : copie d’un autre format ignorée, écriture en cache refusée signalée', async () => {
  const env = fakeEnv(0);
  env.replies.push({ status: 200, body: '{"ok":true,"v":1}' });
  await KT.loadJson(URL_T, accept, env);
  const strict = j => j?.v === 2;
  env.replies.push({ status: 200, body: '{"ok":true,"v":2}' });
  assert.equal((await KT.loadJson(URL_T, strict, env)).json.v, 2);
  const full = fakeEnv(0);
  full.caches = { open: async () => ({ match: async () => undefined, put: async () => { throw new DOMException('quota', 'QuotaExceededError'); } }) };
  full.replies.push({ status: 200, body: '{"ok":true}' });
  assert.equal((await KT.loadJson(URL_T, accept, full)).uncached, true);
});

test('loadJson : sans copie, erreurs en clair ; cache absent ou refusé signalé', async () => {
  for (const [reply, msg] of [[{ status: 429 }, /HTTP 429/], [new TypeError('x'), /réseau/], [{ status: 200, body: '{"autre":1}' }, /format inattendu/]]) {
    const env = fakeEnv(0);
    env.replies.push(reply);
    await assert.rejects(KT.loadJson(URL_T, accept, env), msg);
  }
  const blocked = { ...fakeEnv(0), caches: { open: async () => { throw new DOMException('insecure', 'SecurityError'); } } };
  await assert.rejects(KT.loadJson(URL_T, accept, blocked), /navigation privée/);
  await assert.rejects(KT.loadJson(URL_T, accept, { ...fakeEnv(0), caches: undefined }), /navigation privée/);
});

test('cache : frais moins d’une heure', () => {
  assert.equal(KT.isFresh(1000, 1000), true);
  assert.equal(KT.isFresh(0, 3600 * 1000 - 1), true);
  assert.equal(KT.isFresh(0, 3600 * 1000), false);
  assert.equal(KT.isFresh(NaN, 0), false);
  assert.equal(KT.isFresh(2000, 1000), false);
});

test('tranches et règles d’or corrigées', () => {
  assert.deepEqual([KT.guideFor(1).from, KT.guideFor(1).to], [1, 40]);
  assert.deepEqual([KT.guideFor(41).from, KT.guideFor(80).to], [41, 80]);
  assert.deepEqual([KT.guideFor(161).from, KT.guideFor(999).to], [161, Infinity]);
  assert.ok(KT.goldRules(KT.TOWER_MODE).some(r => r.includes('+3 au plus') && r.includes('30 pièces')));
  assert.ok(KT.goldRules(KT.TOWER_MODE).every(r => !r.includes('+5')));
  assert.ok(KT.goldRules(KT.TOWER_MODE).some(r => r.includes('XP jusqu’au niveau visé (5 dès l’étage 6, 6 dès l’étage 12, 7 dès l’étage 20, 8 dès l’étage 30, 9 dès l’étage 45, 10 dès l’étage 65)')));
  assert.ok(KT.goldRules(KT.TOWER_MODE).some(r => r === 'Tout jouer sur un combat sous 45 % de victoires, sous 40 PV, ou sur un étage rejoué à partir de l’étage 50.'));
});

test('en-tête du panneau : raison du tout jouer', () => {
  const head = s => headHtml({ advice: advise(s), stats: { torre }, mode: KT.TOWER_MODE, floor: floorAt(JSON.stringify(s)) });
  assert.match(head({ ...S57, attempts: 1 }), /Tout jouer : étage rejoué\./);
  assert.match(head({ ...S57, attempts: 1, hp: 30 }), /Tout jouer : PV sous 40\./);
  assert.match(head({ ...S57, round: 1059 }), /Tout jouer : combat difficile\./);
  assert.match(head(S57), /Étage 60 \(Électhor, 40,8 %\) : tout jouer\./);
});

test('en-tête : pages d’entrée du jeu couvertes, autres pages exclues', () => {
  const header = require('node:fs').readFileSync(require.resolve('../kanto-overlay.user.js'), 'utf8');
  // Motifs @match : « * » = n'importe quelle suite de caractères, correspondance de l'URL entière.
  const patterns = [...header.matchAll(/^\/\/\s*@match\s+(\S+)\s*$/gm)]
    .map(m => new RegExp(`^${m[1].replace(/[.?+^$()[\]{}|\\/]/g, '\\$&').replace(/\*/g, '.*')}$`));
  assert.equal(patterns.length, 13);
  const covered = url => patterns.some(p => p.test(url));
  for (const page of ['', 'kanto-tactics', 'tower', 'pvp', 'duo', 'nuzlocke']) {
    for (const query of ['', '?ref=x']) assert.ok(covered(`https://einoow.com/${page}${query}`), `/${page}${query}`);
  }
  assert.ok(covered('https://einoow.com/playables/kanto-tactics/index.html'));
  for (const url of ['https://einoow.com/towers', 'https://einoow.com/devblog', 'https://einoow.com/api/meta/kanto/campana.json',
    'https://einoow.com/games/autre']) assert.ok(!covered(url), url);
  assert.match(header, /^\/\/ @noframes$/m);
});

test('niveaux de taux et formats français', () => {
  assert.equal(KT.rateLevel(70).cls, 'good');
  assert.equal(KT.rateLevel(69.9).cls, 'mid');
  assert.equal(KT.rateLevel(40).cls, 'mid');
  assert.equal(KT.rateLevel(39.9).cls, 'bad');
  assert.equal(KT.pct(96), '96,0 %');
  assert.equal(KT.shortDate('2026-10-31'), '31 oct.');
});

test('options du panneau : valeurs inconnues ramenées aux défauts, valeurs connues gardées', () => {
  const ui = { theme: 'bogus', width: 'wide', text: 'huge', alpha: '75', side: 'nowhere', tab: 'zzz', pins: { no: false } };
  KT.checkUi(ui);
  assert.deepEqual(ui, { theme: 'auto', width: 'wide', text: 'normal', alpha: '90', side: 'left', tab: 'tour', pins: { do: true, opt: true, no: false } });
  const ok = { theme: 'light', width: 'compact', text: 'small', alpha: '85', side: 'center', tab: 'boss', pins: { do: true, opt: false, no: true } };
  KT.checkUi(ok);
  assert.deepEqual(ok, { theme: 'light', width: 'compact', text: 'small', alpha: '85', side: 'center', tab: 'boss', pins: { do: true, opt: false, no: true } });
  // Compteur de l'onglet Tour : conseils ★ et ◆ plus bénédictions inconnues, nom accessible accordé.
  const a = advise(S57);
  const count = n => KT.tabsHtml({ advice: n }, { tab: 'tour' }).match(/aria-label="Tour (\d+) conseils?"/)?.[1];
  const base = Number(count(a));
  assert.ok(base > 1);
  assert.equal(Number(count({ ...a, unknownOffer: ['x', 'y'] })), base + 2);
  const one = { ...a, shop: [], reroll: null, xp: null, bench: [], bag: [], reward: [], offer: [], anchor: [], moves: [], unknownOffer: ['x'] };
  assert.match(KT.tabsHtml({ advice: one }, { tab: 'tour' }), /aria-label="Tour 1 conseil"/);
  // Chaque zone du porteur a son option, dans l'ordre de la table des zones.
  assert.deepEqual(KT.OPTIONS.find(o => o.key === 'side').values, [['left', 'Coin gauche'], ['center', 'Centre'], ['right', 'Coin droit']]);
});
