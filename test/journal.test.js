'use strict';
// Journal des combats et écart appris sur les résultats du joueur, sur les fixtures de la Tour et de la campagne.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const { adviseOn } = require('./helpers.js');
const { brockCore, brockStats } = require('./fixtures/brock.js');
const { modes } = require('./fixtures/campana.json');
const tower = require('./fixtures/save-tower.json');
const kanto = require('./fixtures/save-kanto.json');

const T = KT.TOWER_MODE;
// Combat de test : Pierre à l'étage 10, 50 % de victoires ; un trio noté contre lui.
const stats = brockStats([brockCore(['squirtle', 'oddish', 'horsea'])]);
const S10 = { ...tower, round: 1009, attempts: 0, runSeed: 7, streak: 2 };
const advice = adviseOn(S10, { mode: T, stats });
const after = change => JSON.stringify({ ...S10, ...change });
// n combats à 50 % attendus, dont wins gagnés, en Tour.
const fights = (n, wins, extra = {}) => Array.from({ length: n }, (_, i) => ({ r: 1, k: 'tower', f: 10, p: 50, w: Number(i < wins), ...extra }));
// Ligne de S10 : étage 10, niveau 4 pour 5 visé, 29 pièces, 89 PV, préréglages normaux.
const S10_ENTRY = { r: 7, k: 'tower', f: 10, p: 50, w: 1, c: 1, l: 4, g: 5, o: 29, h: 89, v: KT.VERSION, s: ['normal', 'normal', 'normal', 'normal'] };

test('résultat d’un combat : lu sur la série, nul sans combat fini ou sur une autre partie', () => {
  assert.equal(KT.fightWon(S10, after({ round: 1010, streak: 3 }), null, T), true);
  assert.equal(KT.fightWon(S10, after({ attempts: 1, streak: -1 }), null, T), false);
  assert.equal(KT.fightWon({ ...S10, streak: -2 }, after({ round: 1010, streak: 1 }), null, T), true);
  assert.equal(KT.fightWon({ ...S10, streak: -2 }, after({ attempts: 2, streak: -3 }), null, T), false);
  // Défaite permise en campagne : la partie avance quand même.
  const camp = KT.modeContext(KT.CAMPAIGN, kanto, 'kanto');
  assert.equal(KT.fightWon(kanto, JSON.stringify({ ...kanto, round: kanto.round + 1, streak: -1 }), null, camp), false);
  // Sauvegarde restaurée aux bords de la série (1 → −1 → 1, −1 → 1 → −1) : ni manche ni essai de plus, pas un combat.
  assert.equal(KT.fightWon({ ...S10, round: 1009, attempts: 1, streak: -1 }, after({ round: 1009, attempts: 0, streak: 1 }), null, T), null);
  assert.equal(KT.fightWon({ ...S10, round: 1010, attempts: 0, streak: 1 }, after({ round: 1009, attempts: 0, streak: -1 }), null, T), null);
  assert.equal(KT.fightWon(S10, after({ gold: 3 }), null, T), null);
  // Série revenue en arrière (sauvegarde restaurée) : pas un combat.
  assert.equal(KT.fightWon(S10, after({ streak: 1 }), null, T), null);
  assert.equal(KT.fightWon(S10, after({ runSeed: 8, streak: 0 }), null, T), null);
  assert.equal(KT.fightWon({ ...S10, runSeed: undefined }, after({ streak: 3 }), null, T), null);
  assert.equal(KT.fightWon(null, after({ streak: 3 }), null, T), null);
});

test('défaite finale : confirmée en Tour par la liste des parties finies, jamais en campagne', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const runs = JSON.stringify([{ seed: 7, reached: 10, floor: 9 }, { seed: 3, reached: 44 }]);
  assert.equal(KT.fightWon(S10, null, runs, T), false);
  // Partie abandonnée ou relancée : pas de ligne à cet étage pour cette partie.
  assert.equal(KT.fightWon(S10, null, JSON.stringify([{ seed: 7, reached: 4 }]), T), null);
  assert.equal(KT.fightWon(S10, null, null, T), null);
  assert.equal(KT.fightWon(S10, null, '{', T), null);
  assert.equal(warn.mock.callCount(), 1);
  const camp = KT.modeContext(KT.CAMPAIGN, kanto, 'kanto');
  assert.equal(KT.fightWon(kanto, null, runs, camp), null);
});

test('ligne de journal : taux attendu, trio posé ou non, rien sans taux public', () => {
  assert.deepEqual(KT.fightEntry(advice, stats, true), S10_ENTRY);
  const early = adviseOn(S10, { mode: KT.withStrategy(T, { ...KT.STRATEGY_DEFAULTS, pace: 'early' }), stats });
  assert.deepEqual(KT.fightEntry(early, stats, true).s, ['early', 'normal', 'normal', 'normal']);
  const benched = adviseOn({ ...S10, board: { 38: 'u1' }, bench: ['u2', 'u5', 'u6'] }, { mode: T, stats });
  assert.equal(KT.fightEntry(benched, stats, false).c, 0);
  assert.equal(KT.fightEntry(adviseOn({ ...S10, round: 1010 }, { mode: T, stats }), stats, true), null);
  // Campagne en Légende : taux public moins 20 points, clé par aventure et difficulté.
  const camp = KT.modeContext(KT.CAMPAIGN, kanto, 'kanto');
  const entry = KT.fightEntry(adviseOn(kanto, { mode: camp, stats: modes.camp }), modes.camp, true);
  const here = KT.nextStops(modes.camp.stops, 5, 1, camp)[0];
  assert.deepEqual([entry.k, entry.f, entry.p], ['kanto:3', 5, Math.round(10 * Math.max(1, here.fightWin - 20)) / 10]);
});

test('combat noté : une ligne par combat fini, rien sans conseil ni combat', () => {
  const state = { save: S10, advice, stats, runsRaw: null };
  assert.equal(KT.notedFight({ ...state, afterRaw: after({ gold: 1 }) }), null);
  assert.equal(KT.notedFight({ ...state, advice: null, afterRaw: after({ round: 1010, streak: 3 }) }), null);
  assert.deepEqual(KT.notedFight({ ...state, afterRaw: after({ round: 1010, streak: 3 }) }), S10_ENTRY);
  // Taux public de moins de 20 combats : pas de ligne.
  const thin = { ...stats, stops: [{ ...stats.stops[0], n: 19 }] };
  assert.equal(KT.notedFight({ ...state, stats: thin, afterRaw: after({ round: 1010, streak: 3 }) }), null);
});

test('journal : 300 combats au plus par mode et difficulté, sans évincer les autres modes', () => {
  const entry = { r: 7, k: 'tower', f: 10, p: 50, w: 1 };
  assert.deepEqual(KT.addFight([], entry), [entry]);
  const camp = fights(5, 5, { k: 'kanto:3' });
  // 302 combats de Tour numérotés par leur étage (journal d'une autre version) : les 3 plus anciens sortent.
  const old = fights(302, 0).map((f, i) => ({ ...f, f: i }));
  const full = KT.addFight([...camp, ...old], entry);
  const towers = full.filter(f => f.k === 'tower');
  assert.deepEqual([full.length, full.filter(f => f.k === 'kanto:3').length, towers.length, towers[0].f, full.at(-1)], [305, 5, 300, 3, entry]);
});

test('journal relu : illisible ou d’un autre format, repris à vide ou sans la ligne', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  assert.deepEqual(KT.readJournal(null), []);
  assert.equal(warn.mock.callCount(), 0);
  assert.deepEqual(KT.readJournal('{'), []);
  assert.deepEqual(KT.readJournal('{"v":1}'), []);
  assert.equal(warn.mock.callCount(), 2);
  assert.deepEqual(KT.readJournal('[]'), []);
  assert.equal(warn.mock.callCount(), 2);
  assert.deepEqual(KT.readJournal(JSON.stringify([{ k: 'tower', p: 50, w: 1 }, { k: 'tower', p: 'x', w: 1 }, null])), [{ k: 'tower', p: 50, w: 1 }]);
  assert.equal(warn.mock.callCount(), 3);
});

test('écart appris : rétréci par 50 combats fictifs, borné à 20 points, par mode et difficulté', () => {
  // 100 combats à 50 % : écart type de la somme 5 ; 55 victoires, +5 sur 150 combats comptés, soit 3 points.
  assert.equal(KT.ownResults(fights(100, 55), T).shift, 3);
  assert.equal(KT.ownResults(fights(100, 50), T).shift, 0);
  // 30 victoires : −20 sur 150, soit −13 points.
  const low = KT.ownResults(fights(100, 30), T);
  assert.deepEqual([low.n, low.wins, low.expected, low.spread, low.shift], [100, 30, 50, 5, -13]);
  assert.equal(KT.ownResults(fights(100, 70), T).shift, 13);
  // Peu de combats : 4 défaites sur 4 pèsent 4 points ; un combat de plus déplace l'écart de 1 point au plus ici.
  assert.equal(KT.ownResults(fights(4, 0), T).shift, -4);
  assert.equal(KT.ownResults(fights(5, 0), T).shift, -5);
  // Borne : 100 défaites donneraient −33.
  assert.equal(KT.ownResults(fights(100, 0), T).shift, -20);
  assert.equal(KT.ownResults(fights(100, 100), T).shift, 20);
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
  assert.deepEqual([weak.penalty, weak.ownPenalty], [13, 13]);
  // Pierre à 50 % : pas un mur au seuil de 45 %, un mur une fois le taux compté 13 points plus bas.
  assert.equal(adviseOn(S10, { mode: poll([]), stats }).eco.allIn, false);
  assert.equal(adviseOn(S10, { mode: weak, stats }).eco.allIn, true);
  assert.ok(KT.goldRules(weak).includes('Tout jouer sur un étage sous 58 % de victoires (plus 13 points d’après tes résultats), sous 40 PV, ou sur un étage rejoué à partir de l’étage 50.'));
  assert.ok(KT.goldRules(poll(fights(100, 70))).some(r => r.includes('sous 32 % de victoires (moins 13 points d’après tes résultats)')));
  const camp = KT.withResults(KT.modeContext(KT.CAMPAIGN, kanto, 'kanto'), fights(100, 30, { k: 'kanto:3' }));
  assert.deepEqual([camp.leaguePenalty, camp.ownPenalty, camp.penalty], [20, 13, 33]);
  assert.ok(KT.goldRules(camp).some(r => r.includes('(Légende : 45 % plus 20 points, les taux publics mêlant les trois difficultés ; plus 13 points d’après tes résultats)')));
  // En-tête : le seuil déplacé est dit en Tour aussi, et seulement quand un écart est compté.
  const head = mode => KT.headHtml({ advice: null, stats: { torre: stats }, mode, floor: 10 });
  assert.match(head(weak), /Tour · tout jouer sous 58 %/);
  assert.doesNotMatch(head(poll([])), /tout jouer sous/);
});

test('bilan de l’onglet Règles : vide, sans écart, écart compté, avec et sans le trio', () => {
  assert.match(KT.resultsNote(T, [])[0], /^Aucun combat noté/);
  assert.deepEqual(KT.resultsNote(T, fights(100, 50)), [
    '50 victoires pour 50 attendues (± 9,8) sur 100 combats, 1 partie.',
    'Aucun écart compté : les taux publics sont gardés tels quels.',
  ]);
  const split = [...fights(60, 20, { c: 1 }), ...fights(40, 10, { c: 0, r: 2 })];
  assert.deepEqual(KT.resultsNote(T, split), [
    '30 victoires pour 50 attendues (± 9,8) sur 100 combats, 2 parties.',
    'Trio de la compo cible posé : 20 victoires pour 30 attendues (± 7,6) sur 60 combats. Sans lui : 10 victoires pour 20 attendues (± 6,2) sur 40 combats.',
    'Les taux publics comptent 13 points de moins pour toi : seuil de « tout jouer », couleurs, poids des combats.',
  ]);
  // Au niveau visé ou en dessous : seulement sur les lignes qui notent un niveau visé, et quand les deux cas existent ; les
  // étages sans niveau visé (g = 0) et les lignes sans niveau lisible ne comptent pas.
  const paced = [...fights(30, 20, { l: 6, g: 6 }), ...fights(20, 5, { l: 5, g: 6, r: 2 }), ...fights(10, 10, { l: 3, g: 0 }), ...fights(5, 0, { l: null, g: 6 }), ...fights(35, 15)];
  assert.ok(KT.resultsNote(T, paced).includes('Au niveau visé : 20 victoires pour 15 attendues (± 5,4) sur 30 combats. En dessous : 5 victoires pour 10 attendues (± 4,4) sur 20 combats.'));
  assert.ok(!KT.resultsNote(T, fights(30, 20, { l: 6, g: 6 })).some(n => n.startsWith('Au niveau visé')));
  const html = KT.panelHtml({ mode: T, floor: 10, fights: fights(1, 1), stats: { torre: stats }, advice: null, failed: [], error: null }, { ...KT.UI_DEFAULTS, tab: 'rules' });
  assert.match(html, /Tes résultats<\/span><span>Tour<\/span>.*1 victoire pour 0,5 attendues \(± 1\) sur 1 combat, 1 partie\./s);
  assert.match(html, /Les taux publics comptent 1 point de plus pour toi/);
});

test('version notée au journal : celle de l’en-tête du script', () => {
  const header = require('node:fs').readFileSync(require.resolve('../kanto-overlay.user.js'), 'utf8').match(/^\/\/ @version\s+(\S+)$/m)[1];
  assert.equal(KT.VERSION, header);
});
