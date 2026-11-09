'use strict';
// Fixtures : extraits réduits de l'API publique (campana.json : stops, trios des étages 5, 35–105 et 200, lines, holders n ≥ 20 ;
// data.json et lang.json?lang=fr : champs utilisés) et une sauvegarde Tour v11 d'une partie de test.
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
const advise = (s, extra = {}) => KT.advise({ torre, data, lang, save: s, previous: null, side: 'left', ...extra });
const brief = m => m && `${m.level} ${m.label}`;

test('étage lu dans la sauvegarde Tour (round − 1000 + 1)', () => {
  assert.equal(KT.floorFromSave(JSON.stringify({ round: 1000 })), 1);
  assert.equal(KT.floorFromSave(JSON.stringify({ round: 1057 })), 58);
  assert.equal(KT.floorFromSave(JSON.stringify({ round: 1199.5 })), 200);
  assert.equal(KT.floorFromSave(JSON.stringify({ round: 3 })), 1);
});

test('sauvegarde absente, corrompue ou sans round → null', () => {
  assert.equal(KT.floorFromSave(null), null);
  assert.equal(KT.floorFromSave('{pas du json'), null);
  assert.equal(KT.floorFromSave('null'), null);
  assert.equal(KT.floorFromSave(JSON.stringify({ round: '1057' })), null);
  assert.equal(KT.floorFromSave(JSON.stringify({ floor: 58 })), null);
  assert.equal(KT.parseSave('[1]'), null);
  assert.equal(KT.parseSave(JSON.stringify({ round: 1057 })), null);
  assert.equal(KT.floorFromSave(JSON.stringify({ round: 1057, units: 'v10' })), 58);
});

test('prochain boss : élites ignorées, étage courant inclus', () => {
  assert.equal(KT.nextBossStop(torre.stops, 1).stop, '5:brock');
  assert.equal(KT.nextBossStop(torre.stops, 58).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 60).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 200).stop, '200:mewtwo2');
  assert.equal(KT.nextBossStop(torre.stops, 996), null);
  assert.equal(KT.lastBossFloor(torre.stops), 995);
});

test('3 prochains combats, élites comprises, poids = 100 − victoires', () => {
  const s = KT.nextStops(torre.stops, 57);
  assert.deepEqual(s.map(x => x.stop), ['59:elite', '60:zapdos', '64:elite']);
  assert.equal(s[1].weight, 100 - s[1].win);
  assert.ok(s.every(x => x.weight >= 1));
});

test('forme des données : Tour, données de jeu, langue', () => {
  assert.equal(KT.isTowerData(torre), true);
  assert.equal(KT.isTowerData(undefined), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [] }), false);
  assert.equal(KT.isTowerData({ ...torre, rules: undefined }), false);
  assert.equal(KT.isTowerData({ ...torre, cores: [{ stop: '5:brock', core: ['abra'], n: 30, win: 90 }] }), false);
  assert.equal(KT.isTowerData({ ...torre, holders: [{ line: 'abra', id: 'leftovers', n: 30 }] }), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [{ stop: '9:elite', win: 50, first: 40, tries: 2 }] }), false);
  const ok = { stop: '5:brock', win: 50, first: 40, tries: 2 };
  assert.equal(KT.isTowerData({ ...torre, stops: [ok, null] }), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [ok, { ...ok, stop: 'brock' }] }), false);
  assert.equal(KT.isTowerData({ ...torre, cores: [null] }), false);
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
  assert.equal(KT.goldFloor([]), 30);
  assert.equal(KT.goldFloor(['nugget', 'fbag', 'team']), 30);
  assert.equal(KT.goldFloor(['flute', 'vitamins', 'item']), 30);
  assert.equal(KT.goldFloor(['nugget', 'fbag', 'coincase']), 50);
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
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const cores = lo => [
    { stop: '10:brock', core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 80 },
    { stop: '10:brock', core: ['pidgey', 'rattata', 'spearow'], n: 50, win: 90, lo },
  ];
  // Niveau 6 : les coûts 1 à 3 des deux trios sont trouvables.
  const game = KT.readGame({ ...save, round: 1009, level: 6, units: {}, board: {}, bench: [], shop: [] });
  const t = lo => ({ ...torre, stops, cores: cores(lo) });
  assert.equal(KT.targetComp(t(51), data, game, null).key, 'abra+onix+zubat');
  assert.equal(KT.targetComp(t(51), data, game, 'pidgey+rattata+spearow').key, 'pidgey+rattata+spearow');
  assert.equal(KT.targetComp(t(49), data, game, 'pidgey+rattata+spearow').key, 'abra+onix+zubat');
});

test('compo cible : −10 points par lignée du trio à trouver dont le coût ne sort pas à ce niveau', () => {
  const stops = KT.nextStops([{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }], 10);
  const cores = [
    { stop: '10:brock', core: ['giovanni', 'koga', 'samurai'], n: 50, win: 90, lo: 80 },
    { stop: '10:brock', core: ['onix', 'rhyhorn', 'kabuto'], n: 50, win: 90, lo: 55 },
  ];
  const game = (level, units = {}) => KT.readGame({ ...save, round: 1009, level, units, board: {}, bench: Object.keys(units), shop: [] });
  const score = g => KT.coreScore(cores[0].core, stops, new Map(), g, data);
  // Coût 5 : 6 % au niveau 8, 17 % au niveau 9 ; une lignée possédée garde son bonus.
  assert.deepEqual([score(game(8)), score(game(9)), score(game(8, { g: { id: 'g', line: 'giovanni', star: 1 } }))], [-30, 0, -10]);
  const key = g => KT.targetComp({ ...torre, stops, cores }, data, g, null).key;
  // Niveau 8 : 80 − 30 contre 55 (coûts 3 et 4 trouvables) ; niveau 9 : 80 contre 55.
  assert.equal(key(game(8)), 'kabuto+onix+rhyhorn');
  assert.equal(key(game(9)), 'giovanni+koga+samurai');
});

test('compo cible : 9 prochains combats, élites comprises', () => {
  assert.deepEqual(advise(S57).target.stops.map(s => s.stop),
    ['59:elite', '60:zapdos', '64:elite', '65:erika', '69:elite', '70:gengar', '74:elite', '75:koga', '79:elite']);
});

test('compo cible : inertie seulement dans la même partie (runSeed)', () => {
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const cores = [
    { stop: '10:brock', core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 80 },
    { stop: '10:brock', core: ['pidgey', 'rattata', 'spearow'], n: 50, win: 90, lo: 60 },
  ];
  const s = { ...save, round: 1009, level: 3, units: {}, board: {}, bench: [], shop: [], runSeed: 7 };
  const at = previous => KT.advise({ torre: { ...torre, stops, cores }, data, lang, save: s, previous, side: 'left' }).target.key;
  assert.equal(at({ key: 'pidgey+rattata+spearow', run: 7 }), 'pidgey+rattata+spearow');
  assert.equal(at({ key: 'pidgey+rattata+spearow', run: 8 }), 'abra+onix+zubat');
  // Valeur des versions précédentes (clé seule) : rattachée à aucune partie.
  assert.equal(at('pidgey+rattata+spearow'), 'abra+onix+zubat');
  assert.equal(KT.advise({ torre, data, lang, save: s, previous: null, side: 'left' }).run, 7);
});

test('compléments : possédés par puissance (coût, étoiles) et types, boutique pour les places libres, carte plus forte à part', () => {
  // Trio Roucool + Piafabec + Abra.
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const trio = { stop: '10:brock', core: ['pidgey', 'spearow', 'abra'], n: 50, win: 90, lo: 80 };
  const units = (...list) => Object.fromEntries(list.map(([line, star]) => [line, { id: line, line, star }]));
  const comp = (level, own, shop, cores = [trio]) => {
    const t = KT.targetComp({ ...torre, stops, cores }, data,
      KT.readGame({ ...save, round: 1009, level, units: own, board: Object.fromEntries(Object.keys(own).map((id, i) => [28 + i, id])), bench: [], shop }), null);
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
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const cores = [
    // Inertie : abra 70 + 30 = 100 ; possession : pidgey 50 + 60 = 110 (80 avec l'ancien bonus de 5).
    { stop: '10:brock', core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 70 },
    { stop: '10:brock', core: ['pidgey', 'rattata', 'spearow'], n: 50, win: 90, lo: 50 },
  ];
  const units = Object.fromEntries(['pidgey', 'rattata', 'spearow'].map(line => [line, { id: line, line, star: 2 }]));
  const game = KT.readGame({ ...save, round: 1009, level: 3, units, board: { 0: 'pidgey', 1: 'rattata', 2: 'spearow' }, bench: [], shop: [] });
  assert.equal(KT.targetComp({ ...torre, stops, cores }, data, game, 'abra+onix+zubat').key, 'pidgey+rattata+spearow');
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
  // Niveau 8, 5 places : Rattata est déjà hors compo, Magmar vaut plus que Carapuce ★★ ; sous le niveau visé, il passe après l'XP.
  assert.equal(why(advise({ ...S57, level: 8, gold: 60, units: { ...S57.units, ...own }, bench: ['b', 'c', 'e', ...Object.keys(own), null, null] }).shop[2]),
    'no Ignore : plus fort que Carapuce ; l’or va d’abord à l’XP');
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
  const a = KT.advise({ torre: null, data: null, lang: null, save: S57, previous: null, side: 'left' });
  assert.equal(a.target, null);
  assert.deepEqual(a.shop.map(brief), ['do Achète', null, null, null, null]);
  assert.equal(a.reroll, null);
  assert.deepEqual(a.bag, [null, null, null]);
  assert.equal(a.code, null);
});

const why = m => m && `${brief(m)} : ${m.why}`;

test('XP : niveau visé par étage, sans passer sous le palier ; niveau entier en tout jouer', () => {
  assert.deepEqual([5, 6, 11, 12, 20, 29, 30, 44, 45, 64, 65].map(KT.levelGoal), [0, 5, 5, 6, 7, 7, 8, 8, 9, 9, 10]);
  // Le niveau visé ne dépasse jamais le niveau ouvert (9, puis 10 à l'étage 60) : sinon ni XP ni actualisation ne seraient conseillées.
  for (let floor = 1; floor <= 200; floor++) assert.ok(KT.levelGoal(floor) <= (floor >= 60 ? 10 : 9), `étage ${floor}`);
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

test('actualiser : lignée introuvable à ce niveau → XP ; fusion à une copie cherchée', () => {
  // Étage 5, sans niveau visé. Trio Onix + Kabuto + Rhinocorne à trouver, niveau 3 : les coûts 3 et 4 ne sortent pas.
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const t = { ...torre, stops, cores: [{ stop: '10:brock', core: ['onix', 'kabuto', 'rhyhorn'], n: 50, win: 90, lo: 80 }] };
  const empty = { ...save, round: 1004, level: 3, xp: 0, gold: 40, units: {}, board: {}, bench: [], shop: [], attempts: 0 };
  const lost = advise(empty, { torre: t });
  assert.equal(why(lost.reroll), 'no Garde l’or : Onix (coût 3 : 0 %) au niveau 3 : à chercher au niveau 6');
  assert.equal(why(lost.xp), 'do Monte : rien à chercher en boutique à ce niveau ; 8 XP avant le niveau 4');
  // Trio complet en ★★ : rien à chercher, sauf la lignée à une copie d'une fusion.
  const units = Object.fromEntries(['onix', 'kabuto', 'rhyhorn'].map(line => [line, { id: line, line, star: 2 }]));
  const full = { ...empty, level: 4, units, board: { 28: 'onix', 29: 'kabuto', 30: 'rhyhorn' } };
  assert.deepEqual([advise(full, { torre: t }).reroll, brief(advise(full, { torre: t }).xp)], [null, 'do Monte']);
  const pair = { ...full, units: { ...units, a: { id: 'a', line: 'rattata', star: 1 }, b: { id: 'b', line: 'rattata', star: 1 } }, bench: ['a', 'b'] };
  const rolled = advise(pair, { torre: t });
  assert.equal(why(rolled.reroll), 'do Actualise : cherche Rattata (coût 1 : 60 %) au niveau 4');
  assert.equal(why(rolled.xp), 'no Attends : l’or va d’abord à l’actualisation');
  // Étage 62, niveau 9 : Rattata (coût 1) sort à 6 %, et à 4 % au niveau 10. Monter ne le rend pas trouvable : aucun conseil
  // d'actualisation, l'or va à l'XP. Au niveau 10, le maximum, tout ce qui sort en boutique se cherche.
  const high = level => advise({ ...pair, round: 1061, level, gold: 60 }, { torre: { ...t, stops: [{ ...stops[0], stop: '64:brock' }], cores: [{ ...t.cores[0], stop: '64:brock' }] } });
  assert.deepEqual([high(9).reroll, brief(high(9).xp)], [null, 'do Monte']);
  assert.equal(why(high(10).reroll), 'do Actualise : cherche Onix (coût 3 : 24 %), Kabuto (coût 4 : 42 %), Rhinocorne (coût 4 : 42 %), Rattata (coût 1 : 4 %) au niveau 10');
});

test('lignée du trio inconnue des données : ni malus, ni actualisation pour elle, pas d’erreur', () => {
  const stops = KT.nextStops([{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }], 5);
  const core = ['newmon', 'pidgey', 'spearow'];
  const game = KT.readGame({ ...save, round: 1004, level: 9, units: {}, board: {}, bench: [], shop: [] });
  // Roucool et Piafabec (coût 1 : 6 % au niveau 9) coûtent 10 points chacun ; la lignée sans coût connu, rien.
  assert.equal(KT.coreScore(core, stops, new Map(), game, data), -20);
  const a = advise({ ...save, round: 1004, level: 9, xp: 0, gold: 60, attempts: 0, units: {}, board: {}, bench: [], shop: [] },
    { torre: { ...torre, stops, cores: [{ stop: '10:brock', core, n: 50, win: 90, lo: 80 }] } });
  assert.equal(a.target.key, 'newmon+pidgey+spearow');
  assert.equal(why(a.reroll), 'do Actualise : cherche Roucool (coût 1 : 6 %), Piafabec (coût 1 : 6 %) au niveau 9');
  // Tout jouer : aucune chance n'est lue, la lignée inconnue se cherche comme les autres.
  const own = Object.fromEntries(['pidgey', 'spearow'].map(line => [line, { id: line, line, star: 3 }]));
  const allIn = advise({ ...save, round: 1004, level: 9, xp: 0, gold: 10, hp: 30, attempts: 0, units: own, board: {}, bench: ['pidgey', 'spearow'], shop: [] },
    { torre: { ...torre, stops, cores: [{ stop: '10:brock', core, n: 50, win: 90, lo: 80 }] } });
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
  assert.equal(KT.floorRange(a.next.stops), 'étages 80–100');
  assert.equal(advise(EMPTY10, { torre: twoWindows([[['abra', 'onix', 'zubat'], 80]]) }).next, null);
  // Tranche suivante sans trio d'au moins 20 combats, ou sans combat.
  const empty = twoWindows([]);
  assert.equal(advise(EMPTY10, { torre: empty }).next, null);
  assert.equal(advise(EMPTY10, { torre: { ...empty, stops: empty.stops.slice(0, 9) } }).next, null);
});

test('compo suivante : inertie de 30 points dans la même partie', () => {
  const t = lo => twoWindows([[['caterpie', 'pidgey', 'rattata'], 80], [['ekans', 'spearow', 'zubat'], lo]]);
  const previous = { key: 'abra+onix+zubat', run: 7, next: 'ekans+spearow+zubat' };
  assert.equal(advise(EMPTY10, { torre: t(51) }).next.key, 'caterpie+pidgey+rattata');
  assert.equal(advise(EMPTY10, { torre: t(51), previous }).next.key, 'ekans+spearow+zubat');
  assert.equal(advise(EMPTY10, { torre: t(49), previous }).next.key, 'caterpie+pidgey+rattata');
  assert.equal(advise(EMPTY10, { torre: t(51), previous: { ...previous, run: 8 } }).next.key, 'caterpie+pidgey+rattata');
});

test('boutique : ◆ pour la compo suivante après ceux de la compo cible, jamais sous le palier ni en tout jouer', () => {
  // Étage 5 (aucun niveau visé), niveau 4 : trio Abra + Onix + Nosferapti à trouver, Abo ★ possédé pour seul complément ;
  // Chenipan et Roucool ne servent que la compo des étages 19–27.
  const t = twoWindows([[['caterpie', 'pidgey', 'rattata'], 80]]);
  const base = {
    ...EMPTY10, round: 1004, level: 4, xp: 0, units: { e: { id: 'e', line: 'ekans', star: 1 } }, bench: ['e'],
    shop: ['caterpie', 'pidgey', 'ekans', null, null],
  };
  const at = (gold, extra = {}) => advise({ ...base, gold, ...extra }, { torre: t });
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

// S57_4 : porteur Minidraco ★★ physique (idéal Bandeau Choix, Ceinture Force, Lentilscope), attaquants Goupix ★★ spécial (idéal
// Lunettes Choix, Lentilscope, Vive Griffe) et Caninos physique (idéal Lentilscope, Bandeau Choix, Ceinture Force) ; aucun tank.
// À venir : Ptéra (cœur cible non possédé), Leveinard et Lokhlass (compo suivante).
const withItems = (items, held = {}) => ({
  ...S57_4, items, units: Object.fromEntries(Object.entries(S57.units).map(([k, u]) => [k, held[k] ? { ...u, items: held[k] } : u])),
});
// Trois objets mixtes, qui conviennent à tous les attaquants.
const FULL3 = ['life-orb', 'scope-lens', 'shell-bell'];
const titles = a => a.bag.map(m => m && `${m.title} — ${m.why}`);

test('profil de lignée lu sur les objets portés en Tour', () => {
  const p = KT.lineProfiles(torre, data);
  assert.deepEqual(p.get('snorlax').tank, true);
  assert.deepEqual(p.get('machop'), { tank: true, special: false });
  assert.deepEqual(p.get('abra'), { tank: false, special: true });
  assert.deepEqual(p.get('dratini'), { tank: false, special: false });
  assert.deepEqual(p.get('growlithe'), { tank: false, special: false });
  assert.equal(p.get('inconnu'), undefined);
});

test('objet qui convient au profil : stat d’attaque, défensif au tank, offensif à l’attaquant', () => {
  const ok = (profile, ids) => ids.map(id => KT.suits(data, profile, id));
  const phys = { tank: false, special: false };
  assert.deepEqual(ok(phys, ['choice-band', 'life-orb', 'scope-lens', 'razor-fang', 'choice-specs', 'twisted-spoon', 'leftovers']),
    [true, true, true, true, false, false, false]);
  const spec = { tank: false, special: true };
  assert.deepEqual(ok(spec, ['choice-specs', 'quick-claw', 'twisted-spoon', 'choice-band', 'razor-fang', 'protector']),
    [true, true, true, false, false, false]);
  // Casque Brut : recette PV Plus + Protéine, mais stats PV Plus + Fer (inherits).
  const tank = { tank: true, special: false };
  assert.deepEqual(ok(tank, ['leftovers', 'rocky-helmet', 'razor-fang', 'choice-band', 'twisted-spoon']), [true, true, true, false, false]);
  assert.equal(KT.suits(data, null, 'choice-band'), true);
});

test('objets : paire idéale, composant seul vers sa recette, composant gardé pour une lignée à venir', () => {
  const a = advise(S57_4);
  assert.deepEqual(a.bag.map(m => m.title), ['PV Plus → Minidraco', 'Garde Fer', 'Calcium → Goupix']);
  assert.match(a.bag[0].why, /PV tout de suite ; plus tard avec Carbone : Ceinture Force, meilleur objet de sa lignée en Tour$/);
  assert.equal(a.bag[1].why, 'Cuiller Tordue pour Lokhlass, à venir');
  assert.match(a.bag[2].why, /tout de suite ; plus tard avec Calcium : Lunettes Choix, meilleur objet de sa lignée en Tour$/);
  assert.deepEqual(advise(withItems(['emblem-fire'])).bag, [null]);
});

test('objets : un complément possédé est porteur, même faible', () => {
  // S57 au niveau 8 : Rattata ★ entre dans la compo faute de mieux, et Poudre Métal (Fer + Zinc) est un de ses objets idéaux.
  const a = advise(S57);
  assert.deepEqual(a.bag.map(m => m.title), ['PV Plus → Minidraco', 'Fer → Rattata', 'Calcium → Goupix']);
  assert.match(a.bag[1].why, /plus tard avec Zinc : Poudre Métal, meilleur objet de sa lignée en Tour$/);
});

test('objets : complet hors liste idéale seulement à qui il convient', () => {
  assert.deepEqual(titles(advise(withItems(['eviolite', 'life-orb']))), [
    'Garde Poudre Métal — aucun Pokémon de la compo n’en profite', 'Orbe Vie → Minidraco — objet offensif pour ton porteur',
  ]);
  // Spécial à Goupix, physique à Minidraco ; Cuiller Tordue (Atq. Spé. + Défense) à Goupix, jamais à un physique.
  assert.deepEqual(advise(withItems(['choice-specs', 'razor-fang', 'twisted-spoon'])).bag.map(m => m.title),
    ['Lunettes Choix → Goupix', 'Croc Rasoir → Minidraco', 'Cuiller Tordue → Goupix']);
  // Minidraco et Caninos pleins : Bandeau Choix ne va pas à Goupix (spécial), il attend Ptéra.
  const band = advise(withItems(['choice-band'], { a: FULL3, b: FULL3 })).bag[0];
  assert.deepEqual([band.title, band.why], ['Garde Bandeau Choix', 'pour Ptéra, à venir']);
  assert.deepEqual(advise(withItems(['leftovers', 'leftovers'])).bag.map(brief), ['opt Garde', 'opt Garde']);
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
  assert.deepEqual([brief(none.bag[0]), none.bag[0].why], ['opt Garde', 'Lentilscope pour Ptéra, à venir']);
  const protector = advise(withItems(['protector'], { a: FULL3, b: FULL3, d: FULL3 })).bag[0];
  assert.deepEqual([brief(protector), protector.why], ['opt Garde', 'toute la compo a 3 objets']);
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
  const bare = KT.advise({ torre: { ...torre, holders: torre.holders.filter(h => KT.baseLine(h.line) !== 'vulpix') }, data, lang,
    save: withItems(['magnet'], { d: ['emblem-fire', 'choice-band'] }), previous: null, side: 'left' });
  assert.deepEqual(bare.bag, [null]);
  // Minidraco (Restes, contraire) se vide : Orbe Vie va ailleurs.
  const after = advise(withItems(['magnet', 'life-orb'], { a: ['leftovers'] }));
  assert.deepEqual(after.bag.map(m => m.title), ['Aimant sur Minidraco', 'Orbe Vie → Goupix']);
  // Rattata posé, hors des deux compos, porte des objets : l'Aimant les récupère.
  const stray = { ...withItems(['magnet']), units: { ...S57.units, e: { ...S57.units.e, items: ['life-orb'] } }, board: { ...S57.board, 50: 'e' },
    bench: ['b', 'c', null, null, null, null, null, null, null] };
  const m = advise(stray).bag[0];
  assert.deepEqual([m.title, m.why], ['Aimant sur Rattata', 'hors des compos : récupère ses objets']);
});

test('Aimant : un tank qui porte un objet de la stat contraire est dit « spécial sur un physique »', () => {
  const t = { ...torre, stops: [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }],
    cores: [{ stop: '10:brock', core: ['geodude', 'bulbasaur', 'abra'], n: 50, win: 90, lo: 80 }] };
  const a = KT.advise({ torre: t, data, lang, side: 'left', previous: null, save: {
    ...save, round: 1009, level: 3, shop: [], bench: ['g'], board: {}, items: ['magnet'],
    units: { g: { id: 'g', line: 'geodude', star: 1, items: ['twisted-spoon'] } },
  } });
  assert.equal(a.bag[0].why, 'retire Cuiller Tordue (spécial sur un physique)');
});

test('récompense d’objet : sans Pokémon de la compo, prépare une lignée à venir', () => {
  const a = advise({ ...S57, units: {}, board: {}, bench: [], itemReward: ['carbos'] });
  assert.deepEqual([brief(a.reward[0]), a.reward[0].why], ['do Prends', 'Lentilscope pour Ptéra, à venir']);
});

test('formation : un tank à distance (Onix) passe au premier rang avant la mêlée', () => {
  const t = { ...torre, stops: [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }],
    cores: [{ stop: '10:brock', core: ['onix', 'machop', 'abra'], n: 50, win: 90, lo: 80 }] };
  const code = KT.advise({ torre: t, data, lang, side: 'left', previous: null, save: {
    ...save, round: 1009, level: 2, shop: [], bench: ['o', 'z'], board: {}, items: [],
    units: { o: { id: 'o', line: 'onix', star: 2 }, z: { id: 'z', line: 'zubat', star: 1 } },
  } }).code;
  assert.match(code, /;onix:2:3/);
});

test('objets : une copie gardée par composant à venir, pas d’Aimant si la fusion suffit, effet contraire tu', () => {
  // Cuiller Tordue de Lokhlass demande un Fer : les deux autres vont aux Pokémon possédés.
  assert.deepEqual(advise(withItems(['iron', 'iron', 'iron'])).bag.map(brief), ['opt Garde', 'do → Minidraco', 'do → Goupix']);
  // Minidraco plein porte une Protéine seule : la Protéine du sac fusionne en Bandeau Choix, l'Aimant ne sert pas.
  const lone = advise(withItems(['magnet', 'protein', 'protein'], { a: ['life-orb', 'shell-bell', 'protein'] }));
  assert.deepEqual(lone.bag.map(m => m && m.title), [null, 'Protéine → Minidraco', 'Protéine → Goupix']);
  // Protéine seule sur Goupix (spécial) : son effet n'est pas annoncé, seule la recette compte.
  assert.equal(lone.bag[2].why, 'plus tard avec Carbone : Lentilscope, meilleur objet de sa lignée en Tour');
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
  const t = { ...torre, stops: [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }],
    cores: [{ stop: '10:brock', core: ['geodude', 'bulbasaur', 'abra'], n: 50, win: 90, lo: 80 }] };
  const a = KT.advise({ torre: t, data, lang, side: 'left', previous: null, save: {
    ...save, round: 1009, level: 3, shop: [], bench: ['g'], board: {}, items: ['magnet'],
    units: { g: { id: 'g', line: 'geodude', star: 1, items: ['life-orb'] } },
  } });
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

test('objets visés : lus sur l’état final des conseils du sac, portés d’abord', () => {
  const aimsOf = save => Object.fromEntries(advise(save).aims.map(x => [x.unit.line, x.aims.map(y => `${y.id}:${y.state}:${y.missing.join('+')}`)]));
  // Lu après les conseils du sac : PV Plus posé sur Minidraco (Ceinture Force), Protéine sur Caninos (Bandeau Choix), Calcium sur
  // Goupix (Lunettes Choix) ; ce qui est posé ailleurs manque.
  assert.deepEqual(aimsOf(withItems(['hp-up', 'calcium', 'protein'], { a: ['choice-band'] })), {
    dratini: ['choice-band:worn:', 'focus-sash:missing:carbos', 'scope-lens:missing:protein+carbos'],
    vulpix: ['choice-specs:missing:calcium', 'scope-lens:missing:protein+carbos', 'quick-claw:missing:carbos'],
    growlithe: ['scope-lens:missing:carbos', 'choice-band:missing:protein', 'focus-sash:missing:hp-up+carbos'],
  });
  // Lentilscope au sac : posée sur Caninos (rang 1 de ses idéaux), la section le dit prête pour lui seul.
  const lens = aimsOf(withItems(['scope-lens']));
  assert.deepEqual([lens.growlithe[0], lens.dratini[2]], ['scope-lens:ready:', 'scope-lens:missing:protein+carbos']);
  // Objets portés qui conviennent d'abord.
  assert.deepEqual(aimsOf(withItems([], { a: FULL3 })).dratini, ['life-orb:worn:', 'scope-lens:worn:', 'shell-bell:worn:']);
  // Protéine + Carbone : Lentilscope prête pour Minidraco (porteur, servi d'abord), plus pour les suivants.
  const ready = aimsOf(withItems(['protein', 'carbos']));
  assert.equal(ready.dratini[2], 'scope-lens:ready:');
  assert.equal(ready.vulpix[1], 'scope-lens:missing:protein+carbos');
});

test('objets idéaux : 3 objets complets de la lignée exacte, ≥ 20 combats, par borne basse, qui conviennent', () => {
  const phys = { tank: false, special: false };
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
  const noData = KT.advise({ torre, data: null, lang, save: { ...S57, tower: { boons: [], offer: { ids: ['piggy-bank', 'flute'] } } }, previous: null, side: 'left' });
  assert.deepEqual([noData.unknownOffer, noData.offer.map(brief)], [[], [null, 'do Prends']]);
  // Offre mêlée : un sceau de combat en tout jouer passe devant une bénédiction hors voie.
  assert.deepEqual(choose(['team', 'poke-flute'], { round: 1059 }), [null, 'do Prends']);
});

test('ancrage : conseillé si la compo vise une forme ancrée non encore choisie', () => {
  const target = { core: ['dratini-a0', 'aerodactyl', 'growlithe'], fillers: [] };
  const twins = { ...S57, units: { ...S57.units, a: { id: 'a', line: 'dratini', star: 1 }, f: { id: 'f', line: 'dratini', star: 1 } }, bench: [...S57.bench.slice(0, 3), 'f'] };
  const game = KT.readGame(twins);
  assert.equal(KT.anchorAdvice(target, game, names)[0].title, 'Ancre Minidraco (fiche du Pokémon)');
  assert.deepEqual(KT.anchorAdvice(target, KT.readGame(S57), names), []);
  const pair2 = { ...S57, units: { ...S57.units, f: { id: 'f', line: 'dratini', star: 2 } }, bench: [...S57.bench.slice(0, 3), 'f'] };
  assert.equal(KT.anchorAdvice(target, KT.readGame(pair2), names).length, 1);
  assert.deepEqual(KT.anchorAdvice(target, { ...game, anchor: { dratini: 0 } }, names), []);
  assert.deepEqual(KT.anchorAdvice(target, KT.readGame({ ...S57, units: {}, board: {}, bench: [] }), names), []);
});

test('formation : code KT1 trié par cellule, Pokémon bien placé gardé, porteur côté choisi', () => {
  // S57 : Minidraco (case 29 → cellule 1, mêlée au premier rang) garde sa case ; Goupix (31 → 3, distance au premier rang) part
  // au fond ; Rattata (tank, au banc) prend le centre de l'avant, puis Ptéra, Caninos et Abo (mêlée) les cases libres depuis le centre.
  assert.equal(advise(S57).code,
    'KT1;r41;xm=tower;xn=Plan%20kanto-overlay;dratini:2:1:choice-band.focus-sash.scope-lens;aerodactyl:1:2;'
    + 'rattata:1:3:eviolite.rocky-helmet.leftovers;growlithe:1:4:scope-lens.choice-band.focus-sash;ekans:1:5;'
    + 'vulpix:2:21:choice-specs.scope-lens.quick-claw;magmar:1:23');
  assert.match(advise(S57, { side: 'right' }).code, /magmar:1:25;vulpix:2:27:choice-specs.scope-lens.quick-claw$/);
});

test('formation : case de la sauvegarde → cellule KT1 (côté joueur = cases 28 à 55)', () => {
  assert.deepEqual([38, 28, 55, 27, 56, undefined].map(KT.boardCell), [10, 0, 27, null, null, null]);
});

test('formation : dans la limite du niveau, cœur possédé d’abord', () => {
  const units = advise({ ...S57, level: 2 }).code.split(';').slice(4).map(u => u.split(':')[0]);
  assert.deepEqual(units.sort(), ['dratini', 'growlithe']);
});

test('formation : une seule unité par cellule, niveaux 3 à 9, pour chaque zone du porteur', () => {
  for (const side of ['left', 'center', 'right']) {
    for (let level = 3; level <= 9; level++) {
      const cells = advise({ ...S57, level }, { side }).code.split(';').slice(4).map(u => Number(u.split(':')[2]));
      assert.equal(new Set(cells).size, cells.length, `niveau ${level}, ${side}`);
      assert.ok(cells.every(c => c >= 0 && c <= 27));
    }
  }
});

const BENCH = ids => [...ids, ...Array(9 - ids.length).fill(null)];
const moves = (save, extra) => advise(save, extra).moves.map(m => `${m.title} — ${m.why}`);

test('déplacements : d’abord libérer la case, puis poser depuis le banc', () => {
  // S57 : Goupix (distance) quitte la case avant-colonne 4 pour Rattata (tank) ; Caninos (mêlée) est posé à côté.
  assert.deepEqual(moves(S57), ['Déplace Goupix — avant, colonne 4 → fond, colonne 1', 'Pose Rattata — avant, colonne 4', 'Pose Caninos — avant, colonne 5']);
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
    ['Pose Caninos — avant, colonne 3', 'Pose Goupix — fond, colonne 1 ; range Rattata au banc']);
  // Caninos ★★ au banc, Caninos ★ posé : la copie posée n'est pas dans la formation, elle libère la place.
  const twins = { ...S57, level: 2, units: { ...S57.units, c: { id: 'c', line: 'growlithe', star: 2 } }, board: { 29: 'a', 30: 'b' }, bench: BENCH(['c', 'd', 'e']) };
  assert.deepEqual(moves(twins), ['Pose Caninos — avant, colonne 4 ; range Caninos au banc']);
});

test('déplacements rejoués comme le jeu : échange, occupant déplacé, Pokémon rangé hors des cases visées', () => {
  // Nosferapti (mêlée, fond colonne 1) et Abra (distance, avant colonne 4) échangent leurs cases : une seule consigne.
  const t = { ...torre, stops: [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }],
    cores: [{ stop: '10:brock', core: ['zubat', 'abra', 'pidgey'], n: 50, win: 90, lo: 80 }] };
  const swap = KT.advise({ torre: t, data, lang, side: 'left', previous: null, save: {
    ...save, round: 1009, level: 2, shop: [], bench: [], board: { 49: 'z', 31: 'x' },
    units: { z: { id: 'z', line: 'zubat', star: 1 }, x: { id: 'x', line: 'abra', star: 1 } },
  } });
  assert.deepEqual(swap.moves.map(m => `${m.title} — ${m.why}`), ['Déplace Nosferapti — fond, colonne 1 → avant, colonne 4 (échange avec Abra)']);
  // Goupix va sur la case de Rattata, qui passe sur l'ancienne case de Goupix : Caninos y est posé à la place de Rattata.
  assert.deepEqual(moves({ ...S57, level: 4, board: { 29: 'a', 30: 'd', 49: 'e' }, bench: BENCH(['b', 'c']) }),
    ['Déplace Goupix — avant, colonne 3 → fond, colonne 1', 'Pose Caninos — avant, colonne 3, à la place de Rattata']);
  // Plateau plein : Goupix prend la case de Rattata ; Caninos fait ranger Abo, pas un Pokémon dont la case sert à une pose.
  const units = { ...S57.units, f: { id: 'f', line: 'ekans', star: 1 }, h: { id: 'h', line: 'pidgey', star: 1 } };
  assert.deepEqual(moves({ ...S57, level: 4, units, board: { 29: 'a', 49: 'e', 31: 'f', 50: 'h' }, bench: BENCH(['b', 'c', 'd']) }),
    ['Pose Goupix — fond, colonne 1, à la place de Rattata', 'Pose Caninos — avant, colonne 3 ; range Abo au banc']);
});

test('formation : porteur à distance dans la zone choisie du fond, gardé s’il y est déjà', () => {
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const t = { ...torre, stops, cores: [{ stop: '10:brock', core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 80 }] };
  const at = (cell, side) => KT.advise({
    torre: t, data, lang, side, previous: null,
    save: { ...save, round: 1009, level: 3, units: { x: { id: 'x', line: 'abra', star: 2 } }, board: { [cell]: 'x' }, bench: [], shop: [] },
  });
  assert.deepEqual(at(29, 'left').moves.map(m => m.why), ['avant, colonne 2 → fond, colonne 1']);
  assert.deepEqual(at(29, 'right').moves.map(m => m.why), ['avant, colonne 2 → fond, colonne 7']);
  // Fond, colonne 3 : dans le coin gauche (gardé), hors du coin droit.
  assert.deepEqual(at(51, 'left').moves, []);
  assert.match(at(51, 'left').code, /abra:2:23/);
  assert.deepEqual(at(51, 'right').moves.map(m => m.why), ['fond, colonne 3 → fond, colonne 7']);
  // Centre : colonnes 3 à 5 du fond, colonne 4 d'abord ; fond colonne 3 est dans la zone, gardé.
  assert.deepEqual(at(29, 'center').moves.map(m => m.why), ['avant, colonne 2 → fond, colonne 4']);
  assert.deepEqual(at(51, 'center').moves, []);
  // Psykokwak et Goupix (distance) déjà au fond en colonnes 1 et 3 : le porteur reste dans le coin (colonne 2), pas en colonne 5.
  const corner = KT.advise({
    torre: { ...t, cores: [{ stop: '10:brock', core: ['abra', 'psyduck', 'vulpix'], n: 50, win: 90, lo: 80 }] }, data, lang, side: 'left', previous: null,
    save: {
      ...save, round: 1009, level: 3, shop: [], bench: ['x'], board: { 49: 'o', 51: 'v' },
      units: { x: { id: 'x', line: 'abra', star: 2 }, o: { id: 'o', line: 'psyduck', star: 1 }, v: { id: 'v', line: 'vulpix', star: 1 } },
    },
  });
  assert.deepEqual(corner.moves.map(m => `${m.title} — ${m.why}`), ['Pose Abra — fond, colonne 2']);
  // Centre : Psykokwak et Goupix (distance) se placent ensuite une colonne sur deux autour du porteur, colonnes 2 puis 6.
  const center = KT.advise({
    torre: { ...t, cores: [{ stop: '10:brock', core: ['abra', 'psyduck', 'vulpix'], n: 50, win: 90, lo: 80 }] }, data, lang, side: 'center', previous: null,
    save: { ...save, round: 1009, level: 3, shop: [], bench: ['x', 'v'], board: {}, units: { x: { id: 'x', line: 'abra', star: 2 }, v: { id: 'v', line: 'vulpix', star: 1 } } },
  });
  assert.deepEqual(center.moves.map(m => `${m.title} — ${m.why}`), ['Pose Abra — fond, colonne 4', 'Pose Goupix — fond, colonne 6']);
});

// Unités de S57 remplacées ou ajoutées ; shiny : +10 % (makeUnit du jeu), transmis par la fusion.
const withUnits = (units, extra = {}) => ({ ...S57, units: { ...S57.units, ...units }, ...extra });
// Porteur lu sur l'objet : Orbe Vie (offensif, pas dans les idéaux de S57) va au porteur.
const carry = s => advise({ ...s, items: ['life-orb'] }).bag[0].title;

test('shiny : lignée shiny si sa copie de meilleure étoile l’est, +2 points au trio', () => {
  const shiny = withUnits({ b: { ...S57.units.b, shiny: true } });
  assert.equal(KT.shinyLine(KT.readGame(shiny), 'growlithe'), true);
  assert.equal(KT.shinyLine(KT.readGame(S57), 'growlithe'), false);
  // Minidraco 2★ normal et 1★ shiny : pas de 2★ shiny annoncé (ni « s » dans le code KT1), et le 2★ reste le porteur.
  const lower = withUnits({ x: { id: 'x', line: 'dratini', star: 1, shiny: true } }, { bench: ['b', 'c', 'e', 'x', null, null, null, null, null] });
  assert.equal(KT.shinyLine(KT.readGame(lower), 'dratini'), false);
  assert.match(advise(lower).code, /;dratini:2:\d+:/);
  assert.equal(carry(lower), 'Orbe Vie → Minidraco');
  const stops = KT.nextStops(torre.stops, 57);
  const core = ['aerodactyl', 'dratini', 'growlithe'];
  assert.equal(KT.coreScore(core, stops, new Map(), KT.readGame(shiny), data) - KT.coreScore(core, stops, new Map(), KT.readGame(S57), data), 2);
});

test('shiny : « s » après l’étoile dans le code KT1', () => {
  assert.match(advise(withUnits({ a: { ...S57.units.a, shiny: true } })).code, /;dratini:2s:\d+:choice-band\.focus-sash\.scope-lens;/);
});

test('shiny : départage le porteur, le tank et le remplissage', () => {
  // Minidraco et Caninos à 2★ : le shiny devient porteur.
  const lay = { board: { ...S57.board, 30: 'b' }, bench: [null, 'c', 'e', null, null, null, null, null, null] };
  const g2 = { b: { ...S57.units.b, star: 2 } };
  assert.equal(carry(withUnits(g2, lay)), 'Orbe Vie → Minidraco');
  assert.equal(carry(withUnits({ b: { ...g2.b, shiny: true } }, lay)), 'Orbe Vie → Caninos');
  // Deux tanks : Racaillou 1★ shiny (1056 × 1,1 PV) passe devant Bulbizarre 1★ (1084 PV) pour Protecteur, hors de leurs idéaux.
  const t = { ...torre, stops: [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }],
    cores: [{ stop: '10:brock', core: ['geodude', 'bulbasaur', 'abra'], n: 50, win: 90, lo: 80 }] };
  const tank = shiny => KT.advise({ torre: t, data, lang, side: 'left', previous: null, save: {
    ...save, round: 1009, level: 3, shop: [], bench: ['g', 'b'], board: {}, items: ['protector'],
    units: { g: { id: 'g', line: 'geodude', star: 1, shiny }, b: { id: 'b', line: 'bulbasaur', star: 1 } },
  } }).bag[0];
  assert.deepEqual([tank(false).title, tank(false).why], ['Protecteur → Bulbizarre', 'objet défensif pour un tank']);
  assert.equal(tank(true).title, 'Protecteur → Racaillou');
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
  assert.ok(KT.GOLD_RULES.some(r => r.includes('+3 au plus') && r.includes('30 pièces')));
  assert.ok(KT.GOLD_RULES.every(r => !r.includes('+5')));
  assert.ok(KT.GOLD_RULES.some(r => r.includes('XP jusqu’au niveau visé (5 dès l’étage 6, 6 dès l’étage 12, 7 dès l’étage 20, 8 dès l’étage 30, 9 dès l’étage 45, 10 dès l’étage 65)')));
  assert.ok(KT.GOLD_RULES.some(r => r === 'Tout jouer sur un combat sous 45 % de victoires, sous 40 PV, ou sur un étage rejoué à partir de l’étage 50.'));
});

test('en-tête du panneau : raison du tout jouer', () => {
  const head = s => headHtml({ advice: advise(s), torre, floor: KT.floorFromSave(JSON.stringify(s)) });
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
