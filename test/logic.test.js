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

const names = KT.namer(data, lang);
// Étage 57, 38 pièces, niveau 8 : Minidraco 2★ et Goupix 2★ posés, 2 Caninos et 1 Rattata sur le banc.
const S57 = {
  ...save, round: 1056, gold: 38, level: 8, xp: 3, hp: 62, items: ['hp-up', 'iron', 'calcium'],
  shop: ['growlithe', 'aerodactyl', 'magmar', 'rattata', 'ekans'], shopShiny: [false, false, false, false, false],
  units: {
    a: { id: 'a', line: 'dratini', star: 2 }, b: { id: 'b', line: 'growlithe', star: 1 }, c: { id: 'c', line: 'growlithe', star: 1 },
    d: { id: 'd', line: 'vulpix', star: 2 }, e: { id: 'e', line: 'rattata', star: 1 },
  },
  board: { 29: 'a', 31: 'd' }, bench: ['b', 'c', 'e', null, null, null, null, null, null], anchor: {},
  tower: { boons: ['nugget'], offer: { ids: ['nugget', 'leftovers', 'flute'] } },
};
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
  assert.equal(KT.namer(null, null).item('leftovers'), 'leftovers');
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

test('compo cible : meilleur trio pondéré, remplissage par types et unités possédées', () => {
  const a = advise(S57);
  assert.deepEqual(a.target.core, ['aerodactyl', 'dratini', 'growlithe']);
  assert.deepEqual(a.target.fillers, ['vulpix', 'magmar', 'rattata']);
  assert.equal(KT.progress(a.game, 'dratini'), '★★');
  assert.equal(KT.progress(a.game, 'growlithe'), '2/3');
  assert.equal(KT.progress(a.game, 'aerodactyl'), '0/3');
});

test('compo cible : inertie de 5 points', () => {
  const stops = [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }];
  const cores = lo => [
    { stop: '10:brock', core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 80 },
    { stop: '10:brock', core: ['pidgey', 'rattata', 'spearow'], n: 50, win: 90, lo },
  ];
  const game = KT.readGame({ ...save, round: 1009, level: 3, units: {}, board: {}, bench: [], shop: [] });
  const t = lo => ({ ...torre, stops, cores: cores(lo) });
  assert.equal(KT.targetComp(t(77), data, game, null).key, 'abra+onix+zubat');
  assert.equal(KT.targetComp(t(77), data, game, 'pidgey+rattata+spearow').key, 'pidgey+rattata+spearow');
  assert.equal(KT.targetComp(t(70), data, game, 'pidgey+rattata+spearow').key, 'abra+onix+zubat');
});

test('boutique : ★ 3ᵉ copie et cœur, ◆ si l’or, ✕ hors compo', () => {
  const a = advise(S57);
  assert.deepEqual(a.shop.map(brief), ['do Achète', 'do Achète', 'opt Si l’or', 'opt Si l’or', 'no Ignore']);
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
  assert.equal(brief(advise({ ...S57, round: 1059, level: 9 }).xp), 'do Monte');
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

test('objets : recette idéale, sinon garder ; fusion immédiate en tout jouer', () => {
  const a = advise(S57);
  assert.deepEqual(a.bag.map(brief), ['opt Garde', 'do → Caninos', 'do → Caninos']);
  assert.match(a.bag[1].why, /Cuiller Tordue/);
  assert.equal(a.bag[1].title, a.bag[2].title);
  const allIn = advise({ ...S57, round: 1059 });
  assert.deepEqual(allIn.bag.map(brief), ['do → Minidraco', 'do → Caninos', 'do → Caninos']);
  const impossible = advise({ ...S57, round: 1059, items: ['iron'] });
  assert.notEqual(impossible.bag[0].level, 'do');
  const magnet = advise({ ...S57, level: 4, items: ['magnet'], units: { ...S57.units, e: { id: 'e', line: 'ekans', star: 1, items: ['leftovers'] } } });
  assert.equal(brief(magnet.bag[0]), 'do Retire de Abo');
});

test('récompense d’objet : prendre ce qui complète la recette idéale', () => {
  const a = advise({ ...S57, itemReward: ['protein', 'carbos', 'zinc'] });
  assert.deepEqual(a.reward.map(brief), [null, 'do Prends', null]);
  assert.match(a.reward[1].why, /complète/);
});

test('bénédictions : PV bas, puis Fortune jusqu’à 3, puis voie la plus avancée', () => {
  const choose = (boons, ids, hp = 62) => advise({ ...S57, hp, tower: { boons, offer: { ids } } }).offer.map(brief);
  assert.deepEqual(choose(['nugget'], ['nugget', 'leftovers', 'flute']), ['do Prends', null, null]);
  assert.deepEqual(choose(['nugget'], ['nugget', 'leftovers', 'flute'], 30), [null, 'do Prends', null]);
  assert.deepEqual(choose(['nugget', 'fbag', 'coincase', 'ash'], ['nugget', 'leftovers', 'flute']), [null, 'do Prends', null]);
  assert.deepEqual(choose(['nugget', 'fbag', 'coincase'], ['egg', 'flute', 'team']), [null, 'do Prends', null]);
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
});

test('ancrage : conseillé si la compo vise une forme ancrée non encore choisie', () => {
  const target = { core: ['dratini-a0', 'aerodactyl', 'growlithe'], fillers: [] };
  const game = KT.readGame(S57);
  assert.equal(KT.anchorAdvice(target, game, names)[0].title, 'Ancre Minidraco (fiche du Pokémon)');
  assert.deepEqual(KT.anchorAdvice(target, { ...game, anchor: { dratini: 0 } }, names), []);
  assert.deepEqual(KT.anchorAdvice(target, KT.readGame({ ...S57, units: {}, board: {}, bench: [] }), names), []);
});

test('formation : code KT1 (rangée 0 = avant, porteur côté choisi)', () => {
  assert.equal(advise(S57).code,
    'KT1;r41;xm=tower;xn=Plan%20kanto-overlay;growlithe:1:3:scope-lens.twisted-spoon.assault-vest;aerodactyl:1:2;'
    + 'dratini:2:4:choice-band.focus-sash.scope-lens;rattata:1:1;vulpix:2:21;magmar:1:23');
  assert.match(advise(S57, { side: 'right' }).code, /vulpix:2:27;magmar:1:25$/);
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
