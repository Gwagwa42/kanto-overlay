'use strict';
// Équipe adverse de campagne calculée comme le jeu (enemyTeam) et placement qui en découle (foePlan, formation). Graines
// choisies pour tirer chaque variante : runSeed 3 → Pierre de base, 1 → sa variante c ; 1 → Sbire Rocket au pont (Abo et
// Nosferapti), 2 → sa variante Montagnard ; 2 → Major Bob aux trois Voltorbe et Magnéti ★★.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const data = require('./fixtures/data.json');

const mode = (league = 1, gymOrder = [], adventure = 'kanto') => KT.modeContext(KT.CAMPAIGN, { league, gymOrder }, adventure);
const foes = (round, save = {}, m = mode()) => KT.enemyTeam({ runSeed: 3, starter: 'bulbasaur', round, ...save }, m, data);
const team = e => e.units.map(f => `${f.line}:${f.star}@${f.cell}`);

test('tirage du jeu (W de route-*.js) : mêmes valeurs qu’une transcription indépendante', () => {
  // Valeurs de la transcription Python de W, en arithmétique 32 bits explicite.
  assert.equal(KT.seededDraw('577056162|route|3'), 0.25174857839010656);
  assert.equal(KT.seededDraw('577056162|route|monteMoon'), 0.6169399791397154);
  assert.equal(KT.seededDraw('daily-2026-11-15|route|can-r17'), 0.6045098786707968);
});

test('équipe adverse : variante de la graine, vrais dresseurs en Vétéran et Légende, cases par rôle', () => {
  // Pierre : deux tanks à l'avant adverse (rangée 3), colonnes 4 puis 2 depuis le centre.
  assert.deepEqual(team(foes(3)), ['onix:2@25', 'geodude:1@23']);
  // Variante c : Onix seul à l'avant, au centre ; Taupiqueur, assassin, en 2ᵉ rangée.
  const c = foes(3, { runSeed: 1 });
  assert.deepEqual(team(c), ['onix:2@24', 'diglett:2@17']);
  assert.deepEqual([c.units[1].role, c.units[1].entry, c.probable], ['assassin', 'burrow', false]);
  // Vétéran : l'équipe des vrais dresseurs de la variante, marquée probable (règles chiffrées non comptées).
  const veteran = foes(3, { runSeed: 1 }, mode(2));
  assert.deepEqual([team(veteran), veteran.probable], [['onix:2@25', 'rhyhorn:1@23'], true]);
  // Événement, Tour, aventure non relevée : pas d'équipe.
  assert.equal(foes(2), null);
  assert.equal(KT.enemyTeam({ round: 1003 }, KT.TOWER_MODE, data), null);
  assert.equal(foes(3, {}, mode(1, [], 'safari')), null);
});

test('équipe adverse : rival selon ton starter, plafond d’étoiles, arène au rang choisi, clés de Cramois’Île', () => {
  // Rival : Salamèche face à Bulbizarre ; un seul ★★ au plus (cap), le starter du rival le garde.
  assert.deepEqual(team(foes(6)).map(x => x.split('@')[0]), ['rattata:1', 'charmander:2', 'charmander:1', 'pidgey:1', 'abra:1']);
  assert.equal(foes(6, { starter: 'squirtle' }).units.filter(f => f.line === 'bulbasaur').length, 2);
  // 4ᵉ badge : arène pas encore choisie, pas d'équipe ; Koga choisi, son équipe réduite à 5 Pokémon.
  assert.equal(foes(15), null);
  const koga = foes(15, {}, mode(1, ['koga']));
  assert.equal(koga.units.length, 5);
  assert.ok(koga.units.every(f => ['weedle', 'zubat', 'ekans', 'nidoran', 'oddish'].includes(f.line)));
  // Cramois'Île : la marée basse (clé low-tide) retire la pluie ; le Fossile Dôme réveille Amonistar au dernier combat.
  const canela = mode(1, [], 'canela');
  assert.equal(foes(13, {}, canela).weather, 'rain');
  assert.equal(foes(13, { keys: ['low-tide'] }, canela).weather, null);
  assert.equal(foes(29, {}, canela).units.find(f => f.star === 3).line, 'kabuto');
  assert.equal(foes(29, { keys: ['dome-fossil'] }, canela).units.find(f => f.star === 3).line, 'omanyte');
});

test('cases adverses (jm) : assassins en 2ᵉ rangée, entrée stealth ou rush aux bords, tireurs au fond', () => {
  const cells = KT.enemyCells([{ line: 'ekans', star: 1 }, { line: 'machop', star: 1 }, { line: 'ekans', star: 1 }, { line: 'zubat', star: 1 }, { line: 'abra', star: 1 }]);
  assert.deepEqual(cells.map(f => `${f.line}@${f.cell}`), ['machop@24', 'ekans@20', 'ekans@14', 'zubat@15', 'abra@10']);
});

test('plan contre l’adversaire : porteur loin des assassins et des frappeurs, tanks face aux frappeurs, zones', () => {
  // Pont : Rattata frappe en colonne 3 ; Abo entre par la colonne 7, Nosferapti ★★ en colonne 5 : porteur au coin gauche.
  const bridge = KT.foePlan(foes(5, { runSeed: 1 }), 'right', data);
  assert.deepEqual([bridge.side, bridge.hitCol, bridge.divers.map(f => f.line)], ['left', 2, ['zubat', 'ekans']]);
  // Sans menace d'un côté, la zone du menu ⚙ reste : Ondine n'aligne qu'un Magicarpe à l'avant, au centre.
  assert.equal(KT.foePlan(foes(7, { runSeed: 1 }), 'right', data).side, 'right');
  // Major Bob : Magnéti frappe en zone.
  assert.deepEqual(KT.foePlan(foes(11, { runSeed: 2 }), 'left', data).spread.map(f => f.line), ['magnemite']);
});

// Formation contre un plan : unités possédées (cell : cellule KT1, absente = au banc) et leurs rôles de holdersOf.
const unit = (id, line, star, cell) => ({ id, line, star, ...(cell === undefined ? { slot: 0 } : { cell: cell + 28 }) });
const lineup = (owned, roles, plan, side = 'left', dive = false) => {
  const game = { units: owned, level: owned.length };
  const holders = owned.map((u, i) => ({ role: roles[i], unit: u, ideal: [] }));
  const ids = owned.map(u => u.line);
  const units = KT.formation({ core: ids.slice(0, 3), fillers: ids.slice(3) }, game, data, holders, { side, dive, plan });
  return Object.fromEntries(units.map(u => [u.base, u.cell]));
};

test('formation contre l’adversaire : tank face aux frappeurs, attaquant face à la cible qu’il frappe le mieux', () => {
  const owned = [unit('a', 'squirtle', 2, 16), unit('b', 'geodude', 1, 5), unit('c', 'machop', 1)];
  const roles = ['carry', 'tank', 'atk'];
  // Sans plan, Racaillou garde sa case (colonne 6), Machoc prend le centre.
  assert.deepEqual(lineup(owned, roles, null), { squirtle: 16, geodude: 5, machop: 3 });
  // Pont : Rattata (Normal) en colonne 3, Sabelette (Sol) en colonne 5. Racaillou vient en colonne 3 ; Machoc (Combat, ×2
  // contre Normal) prend la colonne voisine du côté de Rattata.
  const plan = KT.foePlan(foes(5, { runSeed: 1 }), 'left', data);
  assert.deepEqual(lineup(owned, roles, plan), { squirtle: 16, geodude: 2, machop: 1 });
});

test('formation contre des attaques de zone : les unités à distance ne se touchent plus', () => {
  const owned = [unit('a', 'squirtle', 2, 15), unit('b', 'oddish', 1, 16), unit('c', 'vulpix', 1, 14), unit('d', 'geodude', 1, 3)];
  const roles = ['carry', 'atk', 'atk', 'tank'];
  const ranged = cells => Object.entries(cells).filter(([b]) => b !== 'geodude').map(([, c]) => c);
  const touch = cells => ranged(cells).some((a, i, all) => all.slice(i + 1).some(b => KT.touching(a, b)));
  // Sans plan, Mystherbe et Goupix gardent leurs cases collées au porteur.
  assert.equal(touch(lineup(owned, roles, null)), true);
  const spread = lineup(owned, roles, KT.foePlan(foes(11, { runSeed: 2 }), 'left', data));
  assert.equal(touch(spread), false);
  assert.equal(spread.squirtle, 15);
});
