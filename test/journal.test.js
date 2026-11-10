'use strict';
// Journal des combats et écart appris sur les résultats du joueur, sur les fixtures de la Tour et de la campagne.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const { adviseOn } = require('./helpers.js');
const { modes } = require('./fixtures/campana.json');
const tower = require('./fixtures/save-tower.json');
const kanto = require('./fixtures/save-kanto.json');

const T = KT.TOWER_MODE;
// Combat de test : Pierre à l'étage 10, 50 % de victoires ; un trio noté contre lui.
const stats = { ...modes.torre, stops: [{ stop: '10:brock', n: 100, win: 50, lo: 45, first: 50, tries: 2 }], cores: [{ stop: '10:brock', core: ['squirtle', 'oddish', 'horsea'], n: 50, win: 90, lo: 80 }] };
const S10 = { ...tower, round: 1009, runSeed: 7, streak: 2 };
const advice = adviseOn(S10, { mode: T, stats });
const after = change => JSON.stringify({ ...S10, ...change });
// n combats à 50 % attendus, dont wins gagnés, en Tour.
const fights = (n, wins, extra = {}) => Array.from({ length: n }, (_, i) => ({ r: 1, k: 'tower', f: 10, p: 50, w: Number(i < wins), ...extra }));

test('résultat d’un combat : lu sur la série, nul sans combat fini ou sur une autre partie', () => {
  assert.equal(KT.fightWon(S10, after({ round: 1010, streak: 3 }), null, T), true);
  assert.equal(KT.fightWon(S10, after({ attempts: 1, streak: -1 }), null, T), false);
  assert.equal(KT.fightWon({ ...S10, streak: -2 }, after({ streak: 1 }), null, T), true);
  assert.equal(KT.fightWon({ ...S10, streak: -2 }, after({ streak: -3 }), null, T), false);
  assert.equal(KT.fightWon(S10, after({ gold: 3 }), null, T), null);
  // Série revenue en arrière (sauvegarde restaurée) : pas un combat.
  assert.equal(KT.fightWon(S10, after({ streak: 1 }), null, T), null);
  assert.equal(KT.fightWon(S10, after({ runSeed: 8, streak: 0 }), null, T), null);
  assert.equal(KT.fightWon({ ...S10, runSeed: undefined }, after({ streak: 3 }), null, T), null);
  assert.equal(KT.fightWon(null, after({ streak: 3 }), null, T), null);
});

test('défaite finale : confirmée en Tour par la liste des parties finies, jamais en campagne', () => {
  const runs = JSON.stringify([{ seed: 7, reached: 10, floor: 9 }, { seed: 3, reached: 44 }]);
  assert.equal(KT.fightWon(S10, null, runs, T), false);
  // Partie abandonnée ou relancée : pas de ligne à cet étage pour cette partie.
  assert.equal(KT.fightWon(S10, null, JSON.stringify([{ seed: 7, reached: 4 }]), T), null);
  assert.equal(KT.fightWon(S10, null, null, T), null);
  assert.equal(KT.fightWon(S10, null, '{', T), null);
  const camp = KT.modeContext(KT.CAMPAIGN, kanto, 'kanto');
  assert.equal(KT.fightWon(kanto, null, runs, camp), null);
});

test('ligne de journal : taux attendu, trio posé ou non, rien sans taux public', () => {
  assert.deepEqual(KT.fightEntry(advice, stats, true), { r: 7, k: 'tower', f: 10, p: 50, w: 1, c: 1 });
  const benched = adviseOn({ ...S10, board: { 38: 'u1' }, bench: ['u2', 'u5', 'u6'] }, { mode: T, stats });
  assert.equal(KT.fightEntry(benched, stats, false).c, 0);
  assert.equal(KT.fightEntry(adviseOn({ ...S10, round: 1010 }, { mode: T, stats }), stats, true), null);
  // Campagne en Légende : taux public moins 20 points, clé par aventure et difficulté.
  const camp = KT.modeContext(KT.CAMPAIGN, kanto, 'kanto');
  const entry = KT.fightEntry(adviseOn(kanto, { mode: camp, stats: modes.camp }), modes.camp, true);
  const here = KT.nextStops(modes.camp.stops, 5, 1, camp)[0];
  assert.deepEqual([entry.k, entry.f, entry.p], ['kanto:3', 5, Math.round(10 * Math.max(1, here.fightWin - 20)) / 10]);
});

test('journal : une ligne par combat fini, même tableau sinon, 400 lignes au plus', () => {
  const state = { save: S10, advice, stats, runsRaw: null };
  const none = [];
  assert.equal(KT.learn(none, { ...state, afterRaw: after({ gold: 1 }) }), none);
  assert.equal(KT.learn(none, { ...state, advice: null, afterRaw: after({ streak: 3 }) }), none);
  assert.deepEqual(KT.learn(none, { ...state, afterRaw: after({ streak: 3 }) }), [{ r: 7, k: 'tower', f: 10, p: 50, w: 1, c: 1 }]);
  const full = KT.learn(fights(400, 0), { ...state, afterRaw: after({ streak: 3 }) });
  assert.deepEqual([full.length, full.at(-1).w], [400, 1]);
});

test('journal relu : illisible ou d’un autre format, repris à vide ou sans la ligne', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  assert.deepEqual(KT.readJournal(null), []);
  assert.equal(warn.mock.callCount(), 0);
  assert.deepEqual(KT.readJournal('{'), []);
  assert.deepEqual(KT.readJournal('{"v":1}'), []);
  assert.equal(warn.mock.callCount(), 2);
  assert.deepEqual(KT.readJournal(JSON.stringify([{ k: 'tower', p: 50, w: 1 }, { k: 'tower', p: 'x', w: 1 }, null])), [{ k: 'tower', p: 50, w: 1 }]);
});

test('écart appris : nul dans la marge d’erreur, rétréci au-delà, par mode et difficulté', () => {
  // 100 combats à 50 % : écart type de la somme 5 ; 55 victoires, dans la marge.
  assert.equal(KT.ownResults(fights(100, 55), T).shift, 0);
  // 30 victoires : −20 sur 125 combats comptés, soit −16 points.
  const low = KT.ownResults(fights(100, 30), T);
  assert.deepEqual([low.n, low.wins, low.expected, low.spread, low.shift], [100, 30, 50, 5, -16]);
  assert.equal(KT.ownResults(fights(100, 70), T).shift, 16);
  // Sous 50 combats, aucun écart : 4 défaites sur 4, ou 40 sur 49.
  assert.equal(KT.ownResults(fights(4, 0), T).shift, 0);
  assert.equal(KT.ownResults(fights(49, 9), T).shift, 0);
  assert.equal(KT.ownResults(fights(50, 10), T).shift, -20);
  assert.equal(KT.ownResults([], T).shift, 0);
  // Les combats d'un autre mode ne comptent pas.
  assert.equal(KT.ownResults(fights(100, 30, { k: 'kanto:1' }), T).n, 0);
  const runs = [...fights(3, 3), ...fights(2, 0, { r: 2 })];
  assert.equal(KT.ownResults(runs, T).runs, 2);
});

test('écart appris : il déplace le seuil de « tout jouer » et s’ajoute à la pénalité de difficulté', () => {
  const poll = journal => KT.pollState({ mode: T, saveKey: undefined, lastAuto: undefined, floor: null, source: 'manuel' },
    { key: 'kanto-tactics-save-tower', raw: JSON.stringify(S10), mode: T }, 'tower', KT.STRATEGY_DEFAULTS, journal).mode;
  assert.deepEqual([poll([]).penalty, poll([]).ownPenalty], [0, 0]);
  const weak = poll(fights(100, 30));
  assert.deepEqual([weak.penalty, weak.ownPenalty], [16, 16]);
  // Pierre à 50 % : pas un mur au seuil de 45 %, un mur une fois le taux compté 16 points plus bas.
  assert.equal(adviseOn(S10, { mode: poll([]), stats }).eco.allIn, false);
  assert.equal(adviseOn({ ...S10, attempts: 0 }, { mode: weak, stats }).eco.allIn, true);
  assert.ok(KT.goldRules(weak).includes('Tout jouer sur un combat sous 61 % de victoires (plus 16 points d’après tes résultats), sous 40 PV, ou sur un étage rejoué à partir de l’étage 50.'));
  assert.ok(KT.goldRules(poll(fights(100, 70))).some(r => r.includes('sous 29 % de victoires (moins 16 points d’après tes résultats)')));
  const camp = KT.withResults(KT.modeContext(KT.CAMPAIGN, kanto, 'kanto'), fights(100, 30, { k: 'kanto:3' }));
  assert.deepEqual([camp.leaguePenalty, camp.ownPenalty, camp.penalty], [20, 16, 36]);
  assert.ok(KT.goldRules(camp).some(r => r.includes('(Légende : 45 % plus 20 points, les taux publics mêlant les trois difficultés ; plus 16 points d’après tes résultats)')));
});

test('bilan de l’onglet Règles : vide, dans la marge, écart compté, avec et sans le trio', () => {
  assert.match(KT.resultsNote(T, [])[0], /^Aucun combat noté/);
  assert.deepEqual(KT.resultsNote(T, fights(100, 55)), [
    '55 victoires pour 50 attendues (± 9,8) sur 100 combats, 1 partie.',
    'Écart dans la marge d’erreur : les taux publics sont gardés tels quels.',
  ]);
  const split = [...fights(60, 20, { c: 1 }), ...fights(40, 10, { c: 0, r: 2 })];
  assert.deepEqual(KT.resultsNote(T, split), [
    '30 victoires pour 50 attendues (± 9,8) sur 100 combats, 2 parties.',
    'Trio de la compo cible posé : 20 victoires pour 30 attendues (± 7,6) sur 60 combats. Sans lui : 10 victoires pour 20 attendues (± 6,2) sur 40 combats.',
    'Tu gagnes moins que les taux publics : ils comptent 16 points de moins pour toi (seuil de « tout jouer », couleurs, poids des combats).',
  ]);
  const html = KT.panelHtml({ mode: T, floor: 10, fights: fights(1, 1), stats: { torre: stats }, advice: null, failed: [], error: null }, { ...KT.UI_DEFAULTS, tab: 'rules' });
  assert.match(html, /Tes résultats<\/span><span>Tour<\/span>.*1 victoire pour 0,5 attendues \(± 1\) sur 1 combat, 1 partie\./s);
  assert.match(html, /Les taux publics sont gardés tels quels jusqu’à 50 combats\./);
});
