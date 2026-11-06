'use strict';
// Fixtures : extraits réduits de l'API publique (campana.json : stops, trios des étages 5, 35–105 et 200, lines, holders n ≥ 20 ;
// data.json et lang.json?lang=fr : champs utilisés) et une sauvegarde Tour v11 d'une partie de test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const torre = require('./fixtures/campana.json').modes.torre;
const data = require('./fixtures/data.json');
const lang = require('./fixtures/lang.json');
const save = require('./fixtures/save-tower.json');
const ids = require('./fixtures/ids.json');

const names = KT.namer(lang);
// Étage 57, 38 pièces, niveau 8 : scénario commun avec la maquette et les pages d'aperçu.
const S57 = require('./fixtures/s57.js');
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

test('compo cible : meilleur trio pondéré, remplissage par les lignées qui renforcent ses types', () => {
  const a = advise(S57);
  assert.deepEqual(a.target.core, ['aerodactyl', 'dratini', 'growlithe']);
  assert.deepEqual(a.target.fillers, ['vulpix', 'magmar']);
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
  const game = KT.readGame({ ...save, round: 1009, level: 3, units: {}, board: {}, bench: [], shop: [] });
  const t = lo => ({ ...torre, stops, cores: cores(lo) });
  assert.equal(KT.targetComp(t(51), data, game, null).key, 'abra+onix+zubat');
  assert.equal(KT.targetComp(t(51), data, game, 'pidgey+rattata+spearow').key, 'pidgey+rattata+spearow');
  assert.equal(KT.targetComp(t(49), data, game, 'pidgey+rattata+spearow').key, 'abra+onix+zubat');
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

test('compléments : unités possédées avant la boutique, stables quand la boutique change', () => {
  // Niveau 4 : une place après le trio. Rattata (possédé, Normal) apporte moins que Doduo (boutique, Normal 2) mais passe avant.
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const cores = [{ stop: '10:brock', core: ['pidgey', 'spearow', 'abra'], n: 50, win: 90, lo: 80 }];
  const t = { ...torre, stops, cores };
  const base = { ...save, round: 1009, level: 4, units: { r: { id: 'r', line: 'rattata', star: 1 } }, board: { 0: 'r' }, bench: [] };
  const fill = shop => KT.targetComp(t, data, KT.readGame({ ...base, shop }), null).fillers;
  assert.deepEqual(fill(['doduo', 'ekans']), ['rattata']);
  assert.deepEqual(fill(['zubat', 'meowth']), ['rattata']);
  assert.deepEqual(KT.targetComp(t, data, KT.readGame({ ...base, units: {}, board: {}, shop: ['doduo'] }), null).fillers, ['doduo']);
  // Entre unités possédées, le gain de type passe avant les étoiles : Doduo ★ (gain 2) avant Rattata ★★ (gain 1).
  const both = { ...base, units: { r: { id: 'r', line: 'rattata', star: 2 }, d: { id: 'd', line: 'doduo', star: 1 } }, board: { 0: 'r', 1: 'd' }, shop: [] };
  assert.deepEqual(KT.targetComp(t, data, KT.readGame(both), null).fillers, ['doduo']);
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
  const after = advise(bought, { previous: { key: before.target.key, run: before.run } });
  assert.equal(after.target.key, before.target.key);
  assert.deepEqual(after.shop.slice(1).map(brief), before.shop.slice(1).map(brief));
});

test('boutique : ★ 3ᵉ copie et cœur, ◆ si l’or, ✕ hors compo', () => {
  const a = advise(S57);
  // Caninos et Ptéra (★, 8 pièces) laissent 30 : Magmar (3) ferait passer sous le palier.
  assert.deepEqual(a.shop.map(brief), ['do Achète', 'do Achète', 'no Ignore', 'no Ignore', 'no Ignore']);
  assert.match(a.shop[2].why, /^complément de la compo ; garde 30 pièces/);
  assert.equal(brief(advise({ ...S57, gold: 41 }).shop[2]), 'opt Si l’or');
  assert.match(a.shop[0].why, /3ᵉ copie/);
  assert.match(a.shop[1].why, /cœur/);
  const poor = advise({ ...S57, gold: 31 });
  assert.equal(brief(poor.shop[2]), 'no Ignore');
  const shiny = advise({ ...S57, shopShiny: [false, false, true, false, false] });
  assert.equal(brief(shiny.shop[2]), 'do Achète');
});

test('boutique : ★ seulement si l’or suffit, de gauche à droite ; le reste ne compte pas dans l’or engagé', () => {
  const a = advise({ ...S57, gold: 5 });
  assert.deepEqual(a.shop.slice(0, 2).map(brief), ['do Achète', 'opt Si l’or']);
  assert.match(a.shop[1].why, /il manque de l’or/);
  assert.equal(advise({ ...S57, gold: 5, round: 1059 }).reroll, null);
});

test('vendre faute d’or pour un ★, et XP avant actualiser', () => {
  // 3 pièces : Caninos (4, 3ᵉ copie) et Ptéra (4, cœur) passent en ◆ faute d'or, Rattata hors compo est à vendre.
  const poor = advise({ ...S57, gold: 3 });
  assert.deepEqual(poor.shop.slice(0, 2).map(brief), ['opt Si l’or', 'opt Si l’or']);
  assert.deepEqual([brief(poor.bench[2]), poor.bench[2].why], ['no Vends', 'il manque de l’or pour un achat conseillé']);
  // 42 pièces, 4 XP manquants : ★ (8) puis XP (4) laissent 30 ; actualiser passerait sous le palier.
  const lvl = advise({ ...S57, gold: 42, xp: 92 });
  assert.deepEqual([brief(lvl.xp), brief(lvl.reroll)], ['do Monte', 'no Garde l’or']);
});

test('boutique sans statistiques : seules les 3ᵉ copies sont marquées', () => {
  const a = KT.advise({ torre: null, data: null, lang: null, save: S57, previous: null, side: 'left' });
  assert.equal(a.target, null);
  assert.deepEqual(a.shop.map(brief), ['do Achète', null, null, null, null]);
  assert.equal(a.reroll, null);
  assert.equal(a.code, null);
});

test('actualiser et XP selon le palier et le tout jouer', () => {
  // Caninos et Ptéra (★, 8 pièces) passent avant : 38 − 8 − 2 < 30.
  assert.equal(brief(advise(S57).reroll), 'no Garde l’or');
  assert.equal(brief(advise({ ...S57, gold: 40 }).reroll), 'do Actualise');
  assert.equal(brief(advise({ ...S57, gold: 31, round: 1059 }).reroll), 'do Actualise');
  assert.equal(advise({ ...S57, gold: 9, round: 1059 }).reroll, null);
  assert.equal(brief(advise(S57).xp), 'no Attends');
  assert.equal(brief(advise({ ...S57, xp: 92, gold: 42 }).xp), 'do Monte');
  assert.equal(brief(advise({ ...S57, xp: 92 }).xp), 'no Attends');
  assert.equal(advise({ ...S57, level: 9 }).xp, null);
  assert.equal(advise({ ...S57, round: 1059, level: 9 }).xp, null);
  assert.equal(brief(advise({ ...S57, round: 1059, level: 9, xp: 118 }).xp), 'do Monte');
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
});

// S57 : porteur Minidraco ★★ (idéal Bandeau Choix, Ceinture Force, Lentilscope), tank Caninos (idéal Lentilscope, Cuiller
// Tordue, Veste de Combat), attaquant Goupix ★★.
const withItems = (items, held = {}) => ({
  ...S57, items, units: Object.fromEntries(Object.entries(S57.units).map(([k, u]) => [k, held[k] ? { ...u, items: held[k] } : u])),
});
const FULL3 = ['leftovers', 'life-orb', 'eviolite'];

test('objets : paire idéale, et composant seul équipé tout de suite vers sa recette', () => {
  const a = advise(S57);
  assert.deepEqual(a.bag.map(brief), ['do → Minidraco', 'do → Caninos', 'do → Caninos']);
  assert.match(a.bag[0].why, /PV tout de suite ; plus tard avec Carbone : Ceinture Force, meilleur objet de sa lignée en Tour$/);
  assert.match(a.bag[1].why, /Cuiller Tordue/);
  assert.equal(a.bag[1].title, a.bag[2].title);
  assert.equal(brief(advise(withItems(['iron'])).bag[0]), 'do → Caninos');
  assert.deepEqual(advise(withItems(['emblem-fire'])).bag, [null]);
  const magnet = advise({ ...S57, level: 4, items: ['magnet'], units: { ...S57.units, e: { id: 'e', line: 'ekans', star: 1, items: ['leftovers'] } } });
  assert.equal(brief(magnet.bag[0]), 'do Retire de Abo');
});

test('objets : complet hors liste idéale vers le rôle (défensif au tank, offensif au porteur)', () => {
  const a = advise(withItems(['eviolite', 'life-orb']));
  assert.deepEqual(a.bag.map(m => [brief(m), m.why]), [
    ['do → Caninos', 'objet défensif pour ton tank'], ['do → Minidraco', 'objet offensif pour ton porteur'],
  ]);
  // Idéal d'abord, quel que soit l'ordre du sac ; pas deux fois le même objet sur un Pokémon.
  const last = advise(withItems(['life-orb', 'choice-band'], { a: ['leftovers', 'eviolite'] }));
  assert.deepEqual(last.bag.map(brief), ['do → Goupix', 'do → Minidraco']);
  assert.deepEqual(advise(withItems(['leftovers', 'leftovers'])).bag.map(brief), ['do → Caninos', 'do → Minidraco']);
});

test('objets : porteur et tank pleins, l’objet va à un 3ᵉ Pokémon de la compo', () => {
  const m = advise(withItems(['choice-band'], { a: FULL3, b: FULL3 })).bag[0];
  assert.deepEqual([brief(m), m.why], ['do → Goupix', 'objet offensif pour un attaquant']);
});

test('objets : chaque composant conseillé pour une seule recette ; après une paire, l’ordre de pose est donné', () => {
  const a = advise(withItems(['protein', 'hp-up', 'carbos']));
  assert.deepEqual(a.bag.map(m => m.title), ['Protéine + Carbone → Minidraco', 'PV Plus → Minidraco', 'Protéine + Carbone → Minidraco']);
  assert.match(a.bag[1].why, /\(après Protéine \+ Carbone\)$/);
});

test('objets : jamais de 4ᵉ objet ; « Garde » seulement quand toute la compo est pleine', () => {
  const full = advise(withItems(['protein', 'carbos'], { a: FULL3 }));
  assert.ok(full.bag.every(m => m.label !== '→ Minidraco'));
  assert.deepEqual(full.bag.map(brief), ['do → Caninos', 'do → Caninos']);
  const none = advise(withItems(['protein'], { a: FULL3, b: FULL3, d: FULL3 }));
  assert.deepEqual([brief(none.bag[0]), none.bag[0].why], ['opt Garde', 'toute la compo a 3 objets']);
  // Composant seul sur un Pokémon déjà à 3 objets : la fusion ne prend pas de place.
  const fuse = advise(withItems(['carbos'], { a: ['protein', 'leftovers', 'eviolite'], b: FULL3, d: FULL3 })).bag[0];
  assert.deepEqual([fuse.title, fuse.why], ['Carbone → Minidraco', 'fusionne avec Protéine : Lentilscope, meilleur objet de sa lignée en Tour']);
  const nobody = advise({ ...S57, items: ['protein'], units: {}, board: {}, bench: [] }).bag[0];
  assert.deepEqual([brief(nobody), nobody.why], ['opt Garde', 'aucun Pokémon de la compo possédé']);
});

test('objets : composant porté réservé à une recette idéale, recette doublée annoncée, 2ᵉ paire après la 1ʳᵉ', () => {
  // Goupix porte Carbone (Lentilscope, Vive Griffe à faire) : Fer n’y fusionne pas en Pic Venin, il va seul au tank pour
  // Protecteur (Caninos a déjà Cuiller Tordue, sa seule recette idéale avec du Fer).
  const fer = advise(withItems(['iron'], { b: ['twisted-spoon'], d: ['carbos'] })).bag[0];
  assert.deepEqual([fer.title, fer.why], ['Fer → Caninos', '+20 % Défense tout de suite ; plus tard avec Fer : Protecteur, objet défensif pour ton tank']);
  const two = advise(withItems(['protein', 'hp-up', 'carbos', 'carbos'])).bag;
  assert.deepEqual(two.map(m => m.title), ['Protéine + Carbone → Minidraco', 'PV Plus + Carbone → Minidraco', 'Protéine + Carbone → Minidraco', 'PV Plus + Carbone → Minidraco']);
  assert.match(two[3].why, /^Ceinture Force, meilleur objet de sa lignée en Tour \(après Protéine \+ Carbone\)$/);
});

test('objets : composant qui fusionne avec celui déjà porté en objet idéal, copie qui porte des objets prioritaire', () => {
  const a = advise(withItems(['carbos'], { a: ['protein'] }));
  assert.deepEqual([a.bag[0].title, a.bag[0].why], ['Carbone → Minidraco', 'fusionne avec Protéine : Lentilscope, meilleur objet de sa lignée en Tour']);
  // Deux Caninos ★ au banc : celui qui porte la Protéine est le porteur retenu.
  assert.equal(advise(withItems(['carbos'], { c: ['protein'] })).bag[0].title, 'Carbone → Caninos');
});

test('objets : deux composants du sac qui fusionnent sur le même Pokémon annoncent la paire', () => {
  // Caninos garde une place après Restes et Protecteur : Fer y entame Cuiller Tordue, mais Zinc fusionne avec lui (Poudre Métal).
  const a = advise(withItems(['leftovers', 'protector', 'iron', 'zinc']));
  assert.deepEqual(a.bag.slice(2).map(m => [m.title, m.why]), [
    ['Fer + Zinc → Caninos', 'Poudre Métal, objet défensif pour ton tank'], ['Fer + Zinc → Caninos', 'Poudre Métal, objet défensif pour ton tank'],
  ]);
});

test('récompense d’objet : prendre ce qui complète la recette idéale', () => {
  const a = advise({ ...S57, itemReward: ['protein', 'carbos', 'zinc'] });
  assert.deepEqual(a.reward.map(brief), [null, 'do Prends', null]);
  assert.equal(a.reward[1].why, 'complète Ceinture Force sur Minidraco');
  // Lu après les conseils du sac : le Fer part dans Poudre Métal, le Calcium ne complète plus Cuiller Tordue.
  const after = advise({ ...withItems(['leftovers', 'protector', 'iron', 'zinc']), itemReward: ['calcium'] });
  assert.equal(after.reward[0].why, 'entame Lunettes Choix pour Goupix');
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

test('formation : code KT1 (rangée 0 = avant, porteur côté choisi)', () => {
  assert.equal(advise(S57).code,
    'KT1;r41;xm=tower;xn=Plan%20kanto-overlay;growlithe:1:3:scope-lens.twisted-spoon.assault-vest;aerodactyl:1:2;'
    + 'dratini:2:4:choice-band.focus-sash.scope-lens;vulpix:2:21:choice-specs.scope-lens.quick-claw;magmar:1:23');
  assert.match(advise(S57, { side: 'right' }).code, /vulpix:2:27:choice-specs.scope-lens.quick-claw;magmar:1:25$/);
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
