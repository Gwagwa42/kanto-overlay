'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const torre = require('./fixtures/campana.json').modes.torre;
const ids = require('./fixtures/ids.json');

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
});

test('prochain boss : élites ignorées, étage courant inclus', () => {
  assert.equal(KT.nextBossStop(torre.stops, 1).stop, '5:brock');
  assert.equal(KT.nextBossStop(torre.stops, 58).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 59).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 60).stop, '60:zapdos');
  assert.equal(KT.nextBossStop(torre.stops, 200).stop, '200:mewtwo2');
  assert.equal(KT.nextBossStop(torre.stops, 995).stop, '995:giovanni');
  assert.equal(KT.nextBossStop(torre.stops, 996), null);
  assert.equal(KT.nextBossStop(torre.stops, 1000), null);
  assert.equal(KT.lastBossFloor(torre.stops), 995);
  const s = KT.nextBossStop(torre.stops, 58);
  assert.deepEqual([s.floor, s.boss], [60, 'zapdos']);
});

test('forme des données de la Tour', () => {
  assert.equal(KT.isTowerData(torre), true);
  assert.equal(KT.isTowerData(undefined), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [] }), false);
  assert.equal(KT.isTowerData({ ...torre, from: undefined }), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [{ stop: '5:brock', win: 50, first: 40 }] }), false);
  assert.equal(KT.isTowerData({ ...torre, cores: [{ stop: '5:brock', core: 'abra', n: 30, win: 90 }] }), false);
  const ok = { stop: '5:brock', win: 50, first: 40, tries: 2 };
  assert.equal(KT.isTowerData({ ...torre, stops: [ok, null] }), false);
  assert.equal(KT.isTowerData({ ...torre, cores: [null] }), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [ok, { ...ok, stop: 'brock' }] }), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [{ ...ok, stop: '9:elite' }] }), false);
  assert.equal(KT.isTowerData({ ...torre, stops: [ok, { ...ok, stop: '200:mewtwo2' }] }), true);
});

test('trios : au moins 20 combats, triés par victoires puis combats, 3 au plus', () => {
  const top = KT.topCores(torre.cores, '60:zapdos');
  assert.deepEqual(top.map(c => c.core.join('+')), ['aerodactyl+dratini+growlithe', 'dratini+growlithe+magmar', 'kabuto+shellder+staryu']);
  assert.ok(KT.topCores(torre.cores, '5:brock', 50).every(c => c.n >= 20));
  const tie = [
    { stop: 'x', core: ['a'], n: 20, win: 90 },
    { stop: 'x', core: ['b'], n: 40, win: 90 },
    { stop: 'x', core: ['c'], n: 19, win: 100 },
    { stop: 'y', core: ['d'], n: 99, win: 99 },
  ];
  assert.deepEqual(KT.topCores(tie, 'x').map(c => c.core[0]), ['b', 'a']);
});

test('noms français des lignes, formes ancrées et id inconnu', () => {
  assert.equal(KT.lineName('dratini'), 'Minidraco');
  assert.equal(KT.lineName('dratini-a0'), 'Minidraco ⚓');
  assert.equal(KT.lineName('nidoran-a1'), 'Nidorino ⚓');
  assert.equal(KT.lineName('aerodactyl-a1'), 'aerodactyl-a1');
  assert.equal(KT.lineName('giovanni'), 'Miaouss de Giovanni');
  assert.equal(KT.lineName('inconnu'), 'inconnu');
  assert.equal(KT.bossName('zapdos'), 'Électhor');
  assert.equal(KT.bossName('inconnu'), 'inconnu');
});

test('tous les ids de l’API (V41) ont un nom français', () => {
  assert.deepEqual(ids.lines.filter(id => KT.lineName(id) === id), []);
  assert.deepEqual(ids.bosses.filter(id => KT.bossName(id) === id), []);
});

test('tranches du guide', () => {
  assert.deepEqual([KT.guideFor(1).from, KT.guideFor(1).to], [1, 40]);
  assert.deepEqual([KT.guideFor(41).from, KT.guideFor(80).to], [41, 80]);
  assert.equal(KT.guideFor(160).to, 160);
  assert.deepEqual([KT.guideFor(161).from, KT.guideFor(999).to], [161, Infinity]);
  assert.deepEqual(KT.guideFor(500).shinies, []);
});

test('niveaux de taux et formats français', () => {
  assert.equal(KT.rateLevel(70).cls, 'good');
  assert.equal(KT.rateLevel(69.9).cls, 'mid');
  assert.equal(KT.rateLevel(40).cls, 'mid');
  assert.equal(KT.rateLevel(39.9).cls, 'bad');
  assert.equal(KT.pct(96), '96,0 %');
  assert.equal(KT.shortDate('2026-10-31'), '31 oct.');
});
