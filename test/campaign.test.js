'use strict';
// Campagne : aventure Kanto aux trois difficultés, autres aventures. Fixture : extrait de modes.camp (campana.json du
// 31 octobre au 9 novembre 2026, copie du 10) : tous les stops, lines et stars ; par stop, les 20 trios d'au moins 20 combats
// les plus joués ; les holders d'au moins 50 combats. Partie de test : le scénario S57 passé en campagne au combat 15.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const { modes } = require('./fixtures/campana.json');
const data = require('./fixtures/data.json');
const lang = require('./fixtures/lang.json');
const S57 = require('./fixtures/s57.js');

const camp = modes.camp;
// Combat 15 (Sbire Rocket) en Légende, Morgane choisie au 4ᵉ badge et Koga au 5ᵉ.
const CAMP = { ...S57, mode: 'campaign', round: 14, league: 3, gymOrder: ['sabrina', 'koga'], level: 6, gold: 47, tower: undefined };
const mode = (save, adventure = 'kanto') => KT.modeContext(KT.CAMPAIGN, save, adventure);
const advise = (save, adventure = 'kanto', extra = {}) =>
  KT.advise({ stats: camp, data, lang, save, previous: null, side: 'left', mode: mode(save, adventure), ...extra });

// localStorage simulé : clé → sauvegarde.
const storage = saves => {
  const entries = Object.entries(saves).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
  return { length: entries.length, key: i => entries[i]?.[0] ?? null, getItem: k => entries.find(([x]) => x === k)?.[1] ?? null };
};

test('sauvegarde lue : la plus récente parmi Tour, Kanto, autres aventures et Nuzlocke', () => {
  const tower = { ...S57, savedAt: 100 };
  const kanto = { ...CAMP, savedAt: 200 };
  const found = KT.latestSave(storage({ 'kanto-tactics-save-tower': tower, 'kanto-tactics-save': kanto, 'kanto-tactics-save-prev': { ...kanto, savedAt: 900 } }));
  assert.equal(found.key, 'kanto-tactics-save');
  assert.deepEqual([found.mode.id, found.mode.adventure, found.mode.league, found.mode.penalty], ['campaign', 'kanto', 3, 20]);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save-tower': tower, 'kanto-tactics-save': { ...kanto, savedAt: 50 } })).mode.id, 'tower');
  const safari = KT.latestSave(storage({ 'kanto-tactics-save': kanto, 'kanto-tactics-save-adv-safari': { ...CAMP, savedAt: 300 } }));
  assert.deepEqual([safari.mode.adventure, safari.mode.adv.name], ['safari', 'Parc Safari']);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save': kanto, 'kanto-tactics-save-nuzlocke': { ...CAMP, savedAt: 400 } })).mode, null);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save-pvp': kanto, 'kanto-tactics-save-adv-x-prev': kanto })), null);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save': '{pas du json' })), null);
  // Difficulté hors de 1 à 3, ou Tour : Normal.
  assert.equal(mode({ league: 7 }).league, 1);
  assert.equal(KT.modeContext(KT.TOWER, { league: 3 }).penalty, 0);
});

test('combat de campagne = manche + 1 ; statistiques de campagne acceptées', () => {
  assert.equal(KT.floorFromSave(JSON.stringify(CAMP), mode(CAMP)), 15);
  assert.equal(KT.floorFromSave(JSON.stringify({ round: 0 }), mode({})), 1);
  assert.equal(KT.isStatsData(camp), true);
  assert.equal(KT.isStatsData({ ...camp, stops: [{ stop: '16:Erika', win: 50, first: 40, tries: 2 }] }), false);
});

test('arrêts Kanto : ceux de l’aventure, variantes pondérées par leurs combats, champion fixé par gymOrder', () => {
  const s = KT.nextStops(camp.stops, 15, 3, mode({}));
  assert.deepEqual(s.map(x => x.stop), ['15:Recluta', '16:Erika', '16:Koga', '16:Sabrina', '17:Médium', '17:Recluta']);
  const gym = s.filter(x => x.floor === 16);
  assert.ok(Math.abs(gym.reduce((t, x) => t + x.share, 0) - 1) < 1e-9);
  assert.equal(gym[0].fightWin, gym.reduce((t, x) => t + x.share * x.win, 0));
  // Canela a aussi un combat 2 (Motard) : absent de Kanto.
  assert.deepEqual(KT.nextStops(camp.stops, 2, 1, mode({})).map(x => x.stop), ['2:Bosque Verde', '2:Pikachu salvaje']);
  assert.deepEqual(KT.nextStops(camp.stops, 1, 3, mode({}, 'canela')).map(x => x.stop), ['1:Bajada', '2:Motero', '4:Pokémon salvajes']);
  // Morgane au 4ᵉ badge : le 5ᵉ se joue contre Erika ou Koga, le 6ᵉ contre le dernier.
  const order = st => KT.nextStops(camp.stops, st, 1, mode({ gymOrder: ['sabrina'] })).map(x => x.boss);
  assert.deepEqual([order(16), order(20)], [['Sabrina'], ['Erika', 'Koga']]);
  assert.deepEqual(KT.nextStops(camp.stops, 24, 1, mode({ gymOrder: ['sabrina', 'koga'] })).map(x => x.boss), ['Erika']);
  assert.equal(KT.nextStops(camp.stops, 1, 3, mode({}, 'safari')).length, 0);
});

test('prochain boss de campagne : badges, Ligue et Mewtwo ; champion le plus joué tant qu’il n’est pas choisi', () => {
  assert.equal(KT.nextBossStop(camp.stops, 13, mode({})).stop, '16:Erika');
  assert.equal(KT.nextBossStop(camp.stops, 13, mode({ gymOrder: ['sabrina'] })).stop, '16:Sabrina');
  assert.equal(KT.nextBossStop(camp.stops, 29, mode({})).stop, '33:Lorelei');
  assert.equal(KT.lastBossFloor(camp.stops, mode({})), 38);
  // Sans liste de boss (Canela), chaque combat compte ; sans table d'arrêts, aucun.
  assert.equal(KT.nextBossStop(camp.stops, 5, mode({}, 'canela')).stop, '6:Macarra');
  assert.equal(KT.lastBossFloor(camp.stops, mode({}, 'safari')), -Infinity);
});

test('difficulté : poids et « tout jouer » sur le taux moins 10 points par cran', () => {
  const at = league => KT.nextStops(camp.stops, 15, 1, mode({ league }))[0];
  assert.equal(at(1).weight, 100 - 82.5);
  assert.equal(at(3).weight, 100 - (82.5 - 20));
  // Morgane (27,7 %) au combat 16 : mur en Légende comme en Normal ; Sbire Rocket (82,5 %) n'en est pas un.
  const wall = advise({ ...CAMP, round: 15 }).eco;
  assert.deepEqual([wall.allIn, wall.nextWall.stop], [true, '16:Sabrina']);
  assert.equal(advise(CAMP).eco.allIn, false);
  // Combat 16 avant le choix du champion (Erika 54,4 %, Koga 70,5 %, Morgane 27,7 % : 48,5 % pour la manche) : mur à
  // partir de Vétéran.
  const c16 = league => advise({ ...CAMP, round: 15, league, gymOrder: [] }).eco;
  assert.deepEqual([c16(1).allIn, c16(2).allIn, c16(3).allIn], [false, true, true]);
});

test('économie de campagne : palier 40 (+4), combat rejoué joué à fond dès le premier échec, niveau 9 au plus', () => {
  const a = advise(CAMP);
  assert.deepEqual([a.eco.floor, a.eco.spend], [40, 7]);
  assert.deepEqual([advise({ ...CAMP, attempts: 1, round: 3 }).eco.allIn, advise({ ...CAMP, attempts: 1, round: 3 }).eco.retry], [true, true]);
  // Niveaux visés : 4 dès le combat 4, un combat plus tôt par cran de difficulté.
  const goals = league => [3, 4, 7, 8, 29, 30].map(f => KT.levelGoal(f, mode({ league })));
  assert.deepEqual(goals(1), [0, 4, 4, 5, 8, 9]);
  assert.deepEqual(goals(2), [4, 4, 5, 5, 9, 9]);
  assert.equal(advise({ ...CAMP, level: 9, round: 37 }).xp, null);
});

test('compo de campagne : trio des 9 prochains combats de l’aventure, code KT1 en mode aventure', () => {
  const a = advise(CAMP);
  assert.deepEqual(a.target.core, ['flareon', 'ponyta', 'vulpix']);
  // 9 manches de combat de 15 à 25 : les événements (19, 22) n'ont pas de statistiques.
  assert.deepEqual([...new Set(a.target.stops.map(s => s.floor))], [15, 16, 17, 18, 20, 21, 23, 24, 25]);
  assert.match(a.code, /^KT1;r41;xm=adv;xn=Plan%20kanto-overlay;/);
  assert.equal(KT.floorRange(a.target.stops, a.game.mode), 'combats 15–25');
  // Objets idéaux lus sur les porteurs de campagne.
  assert.equal(a.bag[0].title, 'PV Plus → Minidraco');
  assert.match(a.bag[0].why, /Ceinture Force, meilleur objet de sa lignée en campagne$/);
});

test('aventure sans statistiques (Safari) : compo sans trio, tes meilleures unités', () => {
  const a = advise(CAMP, 'safari');
  assert.deepEqual([a.target.key, a.target.core, a.next], [null, [], null]);
  assert.deepEqual(a.target.fillers, ['dratini', 'vulpix', 'growlithe', 'rattata', 'magmar', 'aerodactyl']);
  assert.match(a.code, /xm=adv/);
  // Sans unité ni boutique : pas de compo.
  assert.equal(advise({ ...CAMP, units: {}, board: {}, bench: [], shop: [] }, 'safari').target, null);
});

test('règles et en-tête de campagne : difficulté, seuils, combats', () => {
  const rules = KT.goldRules(mode(CAMP));
  assert.ok(rules.some(r => r.includes('+4 au plus en campagne → garder 40 pièces')));
  assert.ok(rules.some(r => r.includes('4 dès le combat 2') && r.includes('9 dès le combat 28') && r.includes('2 XP par combat')));
  assert.ok(rules.some(r => r.startsWith('Tout jouer sur un combat sous 65 % de victoires (Légende')));
  assert.equal(KT.leagueNote(mode(CAMP)), 'Kanto · Légende : taux publics des trois difficultés, tout jouer sous 65 %');
  assert.equal(KT.leagueNote(mode({}, 'canela')), 'Cap sur Cramois’Île · Normal');
  const state = save => ({ advice: advise(save), stats: { torre: modes.torre, camp }, mode: mode(save), floor: save.round + 1 });
  const head = KT.headHtml(state({ ...CAMP, round: 13 }));
  assert.match(head, /Kanto · Légende/);
  assert.match(head, /Morgane.*combat 16 · dans 2/s);
  assert.match(KT.headHtml(state({ ...CAMP, round: 15 })), /Tout jouer : combat difficile\./);
  assert.match(KT.headHtml(state({ ...CAMP, round: 3, attempts: 1 })), /Tout jouer : combat rejoué\./);
  assert.match(KT.headHtml({ ...state(CAMP), mode: mode(CAMP, 'safari') }), /Pas de statistiques publiques pour cette aventure/);
});

test('panneau : Nuzlocke sans conseils, invite neutre sans partie', () => {
  const ui = { tab: 'tour' };
  const base = { stats: { torre: modes.torre, camp }, error: null, mode: KT.TOWER_MODE, floor: null, advice: null, save: null };
  assert.match(KT.panelHtml({ ...base, unsupported: true }, ui), /Nuzlocke : pas de conseils/);
  assert.match(KT.panelHtml({ ...base, unsupported: false, mode: mode({}) }, ui), /partie Tour ou campagne.*saisir le combat/);
});
