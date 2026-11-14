'use strict';
// Campagne : aventure Kanto aux trois difficultés, autres aventures. Fixture : extrait de modes.camp (campana.json du
// 31 octobre au 9 novembre 2026, copie du 10) : tous les stops, lines et stars ; par stop, les 20 trios d'au moins 20 combats
// les plus joués ; les holders d'au moins 50 combats. Parties de test : une vraie sauvegarde Kanto (save-kanto.json), et la même
// avec l'équipe du scénario S57 au combat 15.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');
const { modes } = require('./fixtures/campana.json');
const data = require('./fixtures/data.json');
const { adviseOn } = require('./helpers.js');
const S57 = require('./fixtures/s57.js');

const camp = modes.camp;
// Vraie sauvegarde Kanto : Légende, combat 5, relevée le 10 novembre 2026.
const KANTO = require('./fixtures/save-kanto.json');
// Combat 15 (Sbire Rocket) : la sauvegarde Kanto avec l'équipe, la boutique et le sac de S57, Morgane choisie au 4ᵉ badge et
// Koga au 5ᵉ.
const TEAM = ['units', 'board', 'bench', 'shop', 'shopShiny', 'items', 'xp', 'hp', 'anchor'];
const CAMP = { ...KANTO, ...Object.fromEntries(TEAM.map(k => [k, S57[k]])), round: 14, gymOrder: ['sabrina', 'koga'], level: 6, gold: 47 };
const mode = (save, adventure = 'kanto') => KT.modeContext(KT.CAMPAIGN, save, adventure);
const advise = (save, adventure = 'kanto', extra = {}) => adviseOn(save, { stats: camp, mode: mode(save, adventure), ...extra });
// État du panneau dont chaque difficulté lit les statistiques mêlées de la fixture (camp) : les tests qui les emploient
// comparent les règles entre elles, pas les taux d'une difficulté.
const panelStats = (c = camp) => ({ torre: modes.torre, camp1: c, camp2: c, camp3: c });

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
  assert.deepEqual([found.mode.id, found.mode.adventure, found.mode.league, found.mode.stats, found.mode.penalty], ['campaign', 'kanto', 3, 'camp3', 0]);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save-tower': tower, 'kanto-tactics-save': { ...kanto, savedAt: 50 } })).mode.id, 'tower');
  const safari = KT.latestSave(storage({ 'kanto-tactics-save': kanto, 'kanto-tactics-save-adv-safari': { ...CAMP, savedAt: 300 } }));
  assert.deepEqual([safari.mode.adventure, safari.mode.adv.name], ['safari', 'Parc Safari']);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save': kanto, 'kanto-tactics-save-nuzlocke': { ...CAMP, savedAt: 400 } })).mode, null);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save-pvp': kanto, 'kanto-tactics-save-adv-x-prev': kanto })), null);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save': '{pas du json' })), null);
  // Mode à l'écran : une Tour reprise, pas encore réécrite, passe avant la campagne plus récente ; le Nuzlocke, sous la barre de
  // campagne, ne reçoit pas la partie Kanto.
  const both = storage({ 'kanto-tactics-save-tower': tower, 'kanto-tactics-save': kanto, 'kanto-tactics-save-nuzlocke': { ...CAMP, savedAt: 10 } });
  assert.equal(KT.latestSave(both, 'tower').key, 'kanto-tactics-save-tower');
  assert.equal(KT.latestSave(both, 'campaign').key, 'kanto-tactics-save');
  assert.deepEqual([KT.latestSave(both, 'nuzlocke').key, KT.latestSave(both, 'nuzlocke').mode], ['kanto-tactics-save-nuzlocke', null]);
  assert.equal(KT.latestSave(storage({ 'kanto-tactics-save': kanto }), 'tower'), null);
  // Sauvegarde relue seulement si sa chaîne change.
  const memo = new Map();
  KT.latestSave(both, null, memo);
  const kept = memo.get('kanto-tactics-save');
  KT.latestSave(both, null, memo);
  assert.equal(memo.get('kanto-tactics-save'), kept);
  // Difficulté hors de 1 à 3, ou Tour : Normal.
  assert.equal(mode({ league: 7 }).league, 1);
  assert.equal(KT.modeContext(KT.TOWER, { league: 3 }).penalty, 0);
});

test('vraie sauvegarde Kanto (Légende, combat 5) : lue, économie, compo et code KT1', () => {
  const raw = JSON.stringify(KANTO);
  const found = KT.latestSave(storage({ 'kanto-tactics-save': raw }));
  assert.deepEqual([found.mode.id, found.mode.adventure, found.mode.league, KT.floorFromSave(raw, found.mode)], ['campaign', 'kanto', 3, 5]);
  const a = advise(KT.parseSave(raw));
  assert.deepEqual([a.eco.floor, a.eco.spend, a.eco.allIn], [40, 0, false]);
  assert.deepEqual([a.target.core, a.target.fillers], [['bulbasaur', 'nidoran', 'oddish'], ['ponyta']]);
  assert.match(a.code, /^KT1;r41;xm=adv;xn=Plan%20kanto-overlay;nidoran:1:2;bulbasaur:2:3:/);
  assert.deepEqual(a.moves.map(m => `${m.title} — ${m.why}`), ['Déplace Mystherbe — 3ᵉ rangée, colonne 4 → 3ᵉ rangée, colonne 1']);
  // Ponyta a deux copies ★ : noté ★★ (coût 2 : 2,57), il n'est pas remplacé par Aspicot (coût 1, seuil Poison franchi : 1,5).
  assert.deepEqual([a.target.upgrades, a.target.replaced], [[], []]);
  assert.deepEqual([a.shop[4].title, a.shop[4].why], ['Ignore Aspicot', 'hors compo cible']);
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
  // Erika 54,4 % (100 424 combats), Koga 70,5 % (25 755), Morgane 27,7 % (56 018).
  assert.equal(gym[0].fightWin.toFixed(2), '48.47');
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
  // Cramois'Île : boss du jeu (manches boss:) ; sans table d'arrêts, aucun.
  assert.equal(KT.nextBossStop(camp.stops, 5, mode({}, 'canela')).stop, '8:Jefe de los moteros');
  assert.equal(KT.lastBossFloor(camp.stops, mode({}, 'safari')), -Infinity);
});

test('difficulté : poids et « tout jouer » sur le taux de la difficulté lue, sans points retirés', () => {
  // Les statistiques passées sont celles de la difficulté : mêmes poids et mêmes murs dans les trois.
  const at = league => KT.nextStops(camp.stops, 15, 1, mode({ league }))[0];
  assert.deepEqual([at(1).weight, at(3).weight], [100 - 82.5, 100 - 82.5]);
  // Morgane (27,7 %) au combat 16 : mur ; Sbire Rocket (82,5 %) n'en est pas un.
  const wall = advise({ ...CAMP, round: 15 }).eco;
  assert.deepEqual([wall.allIn, wall.nextWall.stop], [true, '16:Sabrina']);
  assert.equal(advise(CAMP).eco.allIn, false);
  // Combat 16 avant le choix du champion (Erika 54,4 %, Koga 70,5 %, Morgane 27,7 % : 48,5 % pour la manche) : au-dessus de
  // 45 %, dans chaque difficulté.
  const c16 = league => advise({ ...CAMP, round: 15, league, gymOrder: [] }).eco;
  assert.deepEqual([c16(1).allIn, c16(2).allIn, c16(3).allIn], [false, false, false]);
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
  // Or de série (Th du jeu) : en campagne seulement.
  const streak = 'Série : +1 pièce par victoire à partir de la 2ᵉ de suite.';
  assert.deepEqual([KT.goldRules(mode({})), KT.goldRules(KT.TOWER_MODE)].map(rules => rules.some(r => r.includes(streak))), [true, false]);
});

test('niveaux visés de campagne : un combat d’avance par cran de difficulté et par 10 points d’écart appris, de 0 à 2', () => {
  // 50 combats de Kanto en Vétéran attendus à 80 % : 40 victoires attendues ; l'écart est rétréci par 50 combats fictifs,
  // soit 6 points pour 6 victoires d'écart.
  const fights = (k, wins) => Array.from({ length: 50 }, (_, i) => ({ r: 1, k, f: 1, p: 80, w: Number(i < wins) }));
  const learned = wins => KT.withResults(mode({ league: 2 }), fights('kanto:2:dif', wins));
  // Vétéran (un combat) et un écart de 0, −6 puis +6 points : 1, 2 puis 0 combat d'avance.
  assert.deepEqual([learned(40).advance, learned(34).advance, learned(46).advance], [1, 2, 0]);
  assert.deepEqual([6, 10].map(f => KT.levelGoal(f, learned(34))), [5, 6]);
  assert.ok(KT.goldRules(learned(34)).some(r => r.includes('(4 dès le combat 2, 5 dès le combat 6,')));
  // La Tour n'avance jamais ses niveaux visés, même avec un écart appris défavorable.
  assert.equal(KT.withResults(KT.TOWER_MODE, fights('tower', 0)).advance, 0);
});

test('compo de campagne : trio des 9 prochains combats de l’aventure, code KT1 en mode aventure', () => {
  const a = advise(CAMP);
  // Pyroli · Ponyta · Goupix (Goupix ★★ possédé) : 48,9 contre 47,8 aux starters, plus forts sur les trois boss notés
  // (25,7 / 89,5 / 79,5 contre 19,3 / 79,6 / aucun) mais dont la note ne tient que de ces taux. Morgane, à 27,7 %, pèse
  // 72,3 ; Koga et Erika, 24,3 et 18,5.
  assert.deepEqual(a.target.core, ['flareon', 'ponyta', 'vulpix']);
  // 9 manches de combat de 15 à 25 : les événements (19, 22) n'ont pas de statistiques.
  assert.deepEqual([...new Set(a.target.stops.map(s => s.floor))], [15, 16, 17, 18, 20, 21, 23, 24, 25]);
  assert.match(a.code, /^KT1;r41;xm=adv;xn=Plan%20kanto-overlay;/);
  assert.equal(KT.floorRange(a.target.stops, a.game.mode), 'combats 15–25');
  // Objets idéaux lus sur les porteurs de campagne.
  assert.equal(a.bag[0].title, 'PV Plus → Minidraco');
  assert.match(a.bag[0].why, /Ceinture Force, meilleur objet de sa lignée en campagne$/);
});

test('objets de campagne : Mystherbe, lanceur, ne vise pas Lentilscope et ne reçoit pas la Protéine', () => {
  const top = profile => KT.topHolders(camp, data, 'oddish', profile).map(h => h.id);
  assert.deepEqual(top(null), ['quick-claw', 'choice-specs', 'scope-lens']);
  assert.deepEqual(top(KT.lineProfiles(camp, data).get('oddish')), ['quick-claw', 'choice-specs', 'choice-scarf']);
  // Mystherbe dans le trio des prochains combats, Protéine et Carbone au sac : seul le Carbone va sur lui.
  const cores = advise(CAMP).target.stops.map(s => ({ stop: s.stop, core: ['oddish', 'geodude', 'abra'], n: 500, win: 90, lo: 85 }));
  const a = advise({ ...CAMP, units: { o: { id: 'o', line: 'oddish', star: 2 } }, board: {}, bench: ['o'], shop: [], items: ['protein', 'carbos'] },
    'kanto', { stats: { ...camp, cores } });
  assert.deepEqual(a.target.core, ['oddish', 'geodude', 'abra']);
  assert.deepEqual(a.bag.map(m => m.title), ['Garde Protéine', 'Carbone → Mystherbe']);
  // La Protéine n'entre dans aucune recette idéale de Mystherbe : elle attend Racaillou, du même trio, pas encore acheté.
  assert.equal(a.bag[0].why, 'Casque Brut pour Racaillou, à venir');
  assert.match(a.bag[1].why, /plus tard avec Calcium : Vive Griffe, meilleur objet de sa lignée en campagne$/);
});

test('shiny : pas de « Vends » en campagne (38 combats, sous le seuil de la Tour comme sous shinyKeepTo)', () => {
  const units = { ...S57.units, f: { id: 'f', line: 'ekans', star: 1 }, g: { id: 'g', line: 'zubat', star: 1 },
    h: { id: 'h', line: 'zubat', star: 1 }, i: { id: 'i', line: 'pidgey', star: 1 }, j: { id: 'j', line: 'pidgey', star: 1 } };
  const full = { ...CAMP, level: 4, units, bench: ['b', 'c', 'e', 'f', 'g', 'h', 'i', 'j', null] };
  assert.equal(advise(full).bench[2].title, 'Vends Rattata');
  assert.equal(advise({ ...full, units: { ...units, e: { ...units.e, shiny: true } } }).bench[2], null);
});

test('aventure sans statistiques (Safari) : compo sans trio, tes meilleures unités', () => {
  const a = advise(CAMP, 'safari');
  assert.deepEqual([a.target.key, a.target.core, a.next], [null, [], null]);
  // Les deux Caninos ★ (coût 4) valent une ★★ : devant Goupix ★★ (coût 2).
  assert.deepEqual(a.target.fillers, ['dratini', 'growlithe', 'vulpix', 'rattata', 'magmar', 'aerodactyl']);
  assert.match(a.code, /xm=adv/);
  // Sans unité ni boutique : pas de compo.
  assert.equal(advise({ ...CAMP, units: {}, board: {}, bench: [], shop: [] }, 'safari').target, null);
});

test('aventure sans statistiques (Safari) : porteurs à égalité d’étoiles départagés par le coût, pas par l’ordre de la compo', () => {
  // Rattata (coût 1, type Normal de Roucool) passe devant Abo (coût 2) dans la compo ; les objets visent Abo d'abord.
  const units = { p: { id: 'p', line: 'pidgey', star: 2 }, r: { id: 'r', line: 'rattata', star: 1 }, e: { id: 'e', line: 'ekans', star: 1 } };
  const a = advise({ ...CAMP, level: 3, units, board: { 29: 'p', 30: 'r', 31: 'e' }, bench: [], shop: [], items: [] }, 'safari');
  assert.deepEqual(a.target.fillers, ['pidgey', 'rattata', 'ekans']);
  assert.deepEqual(a.aims.map(x => x.unit.line), ['pidgey', 'ekans', 'rattata']);
});

test('règles et en-tête de campagne : difficulté, seuils, combats', () => {
  const rules = KT.goldRules(mode(CAMP));
  assert.ok(rules.some(r => r.includes('+4 au plus en campagne → garder 40 pièces')));
  assert.ok(rules.some(r => r.includes('4 dès le combat 2') && r.includes('9 dès le combat 28') && r.includes('2 XP par combat')));
  assert.ok(rules.some(r => r.startsWith('Tout jouer sur un boss rejoué tant qu’il est perdu sous 45 % de victoires (Légende, taux déduits : toutes difficultés moins Normal et Vétéran)')));
  assert.ok(KT.goldRules(mode({ league: 2 })).some(r => r.includes('sous 45 % de victoires (taux de Vétéran)')));
  assert.equal(KT.leagueNote(mode(CAMP)), 'Kanto · Légende');
  assert.equal(KT.leagueNote(mode({}, 'canela')), 'Cap sur Cramois’Île · Normal');
  const state = save => ({ advice: advise(save), stats: panelStats(), mode: mode(save), floor: save.round + 1 });
  const head = KT.headHtml(state({ ...CAMP, round: 13 }));
  assert.match(head, /Kanto · Légende/);
  assert.match(head, /Morgane.*combat 16 · dans 2/s);
  assert.match(KT.headHtml(state({ ...CAMP, round: 15 })), /Tout jouer : combat difficile\./);
  assert.match(KT.headHtml(state({ ...CAMP, round: 3, attempts: 1 })), /Tout jouer : combat rejoué\./);
  assert.match(KT.headHtml({ ...state(CAMP), mode: mode(CAMP, 'safari') }), /Pas de statistiques publiques pour cette aventure/);
  // Champion à choisir : la manche entière, taux moyen ; couleur au taux moins la pénalité, l'écart appris (13 points : ▼).
  const open = (league, fights = []) => KT.headHtml({ ...state({ ...CAMP, round: 12, gymOrder: [], league }), mode: KT.withResults(mode({ league, gymOrder: [] }), fights) });
  assert.match(open(1), /Erika ou Koga ou Morgane<\/span><span class="kt-rate mid">● 48,5 %/);
  assert.match(open(3), /kt-rate mid">● 48,5 %/);
  const weak = Array.from({ length: 100 }, (_, i) => ({ r: 1, k: 'kanto:3:dif', f: 1, p: 50, w: Number(i < 30) }));
  assert.match(open(3, weak), /kt-rate bad">▼ 48,5 %/);
  // Table d'arrêts sans arrêt reconnu (libellés de l'API changés) : dit comme tel, pas « aventure sans statistiques ».
  const renamed = { ...camp, stops: camp.stops.map(x => ({ ...x, stop: x.stop.replace(':', ':X ') })) };
  assert.match(KT.headHtml({ ...state(CAMP), stats: panelStats(renamed) }), /Aucun combat de Kanto dans les statistiques publiques/);
});

test('panneau : Nuzlocke sans conseils, invite neutre sans partie', () => {
  const ui = { tab: 'tour' };
  const base = { stats: panelStats(), error: null, mode: KT.TOWER_MODE, floor: null, advice: null, save: null };
  assert.match(KT.panelHtml({ ...base, unsupported: true }, ui), /Nuzlocke : pas de conseils/);
  assert.match(KT.panelHtml({ ...base, unsupported: false, mode: mode({}) }, ui), /partie Tour ou campagne.*saisir le combat/);
});

test('mode à l’écran : barre du haut, Nuzlocke avant la campagne', () => {
  const doc = present => ({ querySelector: sel => (present.includes(sel) ? {} : null) });
  assert.equal(KT.shownMode(doc([KT.TOWER.hud])), 'tower');
  assert.equal(KT.shownMode(doc([KT.CAMPAIGN.hud])), 'campaign');
  assert.equal(KT.shownMode(doc([KT.CAMPAIGN.hud, KT.NUZLOCKE_HUD])), 'nuzlocke');
  assert.equal(KT.shownMode(doc([])), null);
});

test('lecture de la sauvegarde : mode, Nuzlocke, étage manuel oublié au changement de partie', () => {
  const poll = (prev, found, shown, choice = KT.STRATEGY_DEFAULTS) => KT.pollState(prev, found, shown, choice, []);
  const kanto = { key: 'kanto-tactics-save', raw: JSON.stringify(CAMP), mode: mode(CAMP) };
  const start = { mode: KT.TOWER_MODE, saveKey: undefined, lastAuto: undefined, floor: null, source: 'manuel' };
  const first = poll(start, kanto, 'campaign');
  assert.deepEqual([first.mode.id, first.floor, first.source, first.unsupported, first.save.round], ['campaign', 15, 'auto', false, 14]);
  // Étage saisi à la main, même partie au même combat : il tient.
  const typed = { ...first, floor: 30, source: 'manuel' };
  assert.deepEqual([poll(typed, kanto, 'campaign').floor, poll(typed, kanto, 'campaign').source], [30, 'manuel']);
  // Tour à l'étage 15 : autre partie, l'étage manuel tombe même si le numéro est le même.
  const tower = { key: 'kanto-tactics-save-tower', raw: JSON.stringify({ ...S57, round: 1014 }), mode: KT.TOWER_MODE };
  const swapped = poll(typed, tower, 'tower');
  assert.deepEqual([swapped.mode.id, swapped.floor, swapped.source], ['tower', 15, 'auto']);
  // Mode à l'écran sans sauvegarde : son mode quand même ; Nuzlocke dit non pris en charge.
  assert.equal(poll(first, null, 'tower').mode.id, 'tower');
  assert.deepEqual([poll(first, null, 'tower').floor, poll(first, null, 'tower').source], [null, 'manuel']);
  assert.equal(poll(swapped, null, 'campaign').mode.adventure, 'kanto');
  // Stratégie choisie appliquée au mode lu, sauvegarde ou non.
  const bold = { ...KT.STRATEGY_DEFAULTS, allIn: 'bold' };
  assert.deepEqual([poll(start, kanto, 'campaign', bold).mode.hardWin, poll(first, null, 'tower', bold).mode.hardWin], [40, 40]);
  assert.equal(poll(first, null, 'nuzlocke').unsupported, true);
  assert.equal(poll(first, { key: 'kanto-tactics-save-nuzlocke', raw: '{}', mode: null }, 'nuzlocke').unsupported, true);
});

test('alerte : campagne refusée signalée en campagne seulement, avec les autres effets', () => {
  const base = { error: null, failed: [], stats: { torre: modes.torre, camp1: null, camp2: null, camp3: null }, campError: 'campana.json : statistiques de campagne au format inattendu' };
  assert.equal(KT.alertHtml({ ...base, mode: KT.TOWER_MODE }), '');
  assert.match(KT.alertHtml({ ...base, mode: mode(CAMP) }), /statistiques de campagne au format inattendu\)<\/strong>En campagne, seuls l’économie/);
  const both = KT.alertHtml({ ...base, mode: mode(CAMP), error: 'lang.json : réseau', failed: ['lang'] });
  assert.match(both, /lang\.json : réseau ; campana\.json : statistiques de campagne/);
  assert.match(both, /En campagne, seuls l’économie.*nommés par leur identifiant/);
  // Vétéran indisponible : rien à signaler en Normal, dont les statistiques sont là.
  const normalOnly = { ...base, stats: { ...base.stats, camp1: camp }, campError: 'campana.json?dif=2 : HTTP 429' };
  assert.equal(KT.alertHtml({ ...normalOnly, mode: mode({ league: 1 }) }), '');
  assert.match(KT.alertHtml({ ...normalOnly, mode: mode({ league: 3 }) }), /campana\.json\?dif=2 : HTTP 429/);
});

// Fixture campana-dif.json : modes.camp de campana.json, ?dif=1 et ?dif=2 copiés le 14 novembre 2026 (31 octobre au
// 13 novembre) ; tous les stops, lines et stars ; les 20 trios les plus joués (au moins 20 combats) de chaque arrêt de Kanto et
// de Cramois'Île dans le fichier complet, et les mêmes trios dans les deux autres quand ils y sont ; les 8 objets les plus
// portés de chaque forme des lignées de ces trios.
const DIF = require('./fixtures/campana-dif.json');
// Chargement des trois fichiers de campana.json : résultats au format de Promise.allSettled, dans l'ordre de SOURCE_FILES.
const loaded = (files, json = {}) => KT.sourcesState(KT.SOURCE_FILES.map(([key]) => (files.includes(key)
  ? { status: 'fulfilled', value: { json: json[key] ?? { v: 1, modes: { torre: modes.torre, camp: DIF[key === 'stats' ? 'all' : key] } }, at: 1, stale: false } }
  : { status: 'rejected', reason: new Error('HTTP 429') })));

test('sources : une difficulté par fichier, Légende déduite, la Tour à part', () => {
  const s = loaded(['stats', 'normal', 'veteran', 'data', 'lang'], { data: {}, lang: {} });
  assert.deepEqual([s.stats.torre === modes.torre, s.stats.camp1 === DIF.normal, s.stats.camp2 === DIF.veteran, s.error, s.campError], [true, true, true, null, null]);
  assert.equal(s.stats.camp3.stops.find(x => x.stop === '30:El fósil despierta').n, 66277 - 46334 - 10171);
  // Vétéran en échec : Normal reste, Vétéran et Légende manquent ; la Tour ne compte pas l'échec.
  const v = loaded(['stats', 'normal', 'data', 'lang'], { data: {}, lang: {} });
  assert.deepEqual([v.stats.camp1 === DIF.normal, v.stats.camp2, v.stats.camp3, v.failed, v.error, v.campError], [true, null, null, [], null, 'campana.json?dif=2 : HTTP 429']);
  // Copie gardée d'un autre jour, ou d'avant que l'API publie ne, exp et first partout (fixture du 10 novembre) : pas de Légende.
  const why = 'Légende : copies de campana.json de jours différents ou d’un autre format';
  const old = loaded(['stats', 'normal', 'veteran', 'data', 'lang'], { data: {}, lang: {}, veteran: { modes: { camp: { ...DIF.veteran, to: '2026-11-12' } } } });
  assert.deepEqual([old.stats.camp3, old.campError], [null, why]);
  const bare = { ...DIF.veteran, cores: camp.cores.slice(0, 1).map(c => ({ ...c, stop: DIF.veteran.cores[0].stop })) };
  assert.equal(camp.cores[0].ne, undefined);
  assert.deepEqual(loaded(['stats', 'normal', 'veteran', 'data', 'lang'], { data: {}, lang: {}, veteran: { modes: { camp: bare } } }).stats.camp3, null);
  // campana.json en échec : ni Tour ni Légende, Normal et Vétéran restent ; l'échec compte pour la Tour.
  const noAll = loaded(['normal', 'veteran', 'data', 'lang'], { data: {}, lang: {} });
  assert.deepEqual([noAll.stats.torre, noAll.stats.camp1 === DIF.normal, noAll.stats.camp2 === DIF.veteran, noAll.stats.camp3, noAll.failed],
    [null, true, true, null, ['stats']]);
  assert.equal(loaded(['data', 'lang'], { data: {}, lang: {} }).stats, null);
  // Partie en Normal : l'échec de campana.json est dit, sans priver de compo cible.
  const normalAlert = KT.alertHtml({ ...noAll, mode: mode({ league: 1 }) });
  assert.match(normalAlert, /campana\.json : HTTP 429/);
  assert.doesNotMatch(normalAlert, /pas de compo cible|seuls l’économie/);
  // modes.camp illisible dans le fichier complet : dit en campagne, en tête de campError.
  const broken = loaded(['stats', 'normal', 'veteran', 'data', 'lang'], { data: {}, lang: {}, stats: { v: 1, modes: { torre: modes.torre, camp: {} } } });
  assert.deepEqual([broken.stats.camp3, broken.campError], [null, 'campana.json : statistiques de campagne au format inattendu']);
  // Copie périmée d'un fichier de difficulté : datée en campagne seulement.
  const staleVet = KT.sourcesState(KT.SOURCE_FILES.map(([key]) => ({ status: 'fulfilled', value: { json: key === 'stats' ? { v: 1, modes: { torre: modes.torre, camp: DIF.all } } : key === 'data' || key === 'lang' ? {} : { modes: { camp: DIF[key] } }, at: key === 'veteran' ? 5 : 1, stale: key === 'veteran' } })));
  assert.deepEqual([staleVet.stale, staleVet.campStale], [null, 5]);
});

test('Légende déduite : comptes soustraits, entrée manquante comptée en 9 combats gagnés, bornes recalculées', () => {
  const L = KT.legendStats(DIF.all, DIF.normal, DIF.veteran);
  // Fossile (30) : 66 277 combats à 24,5 %, 46 334 à 27,6 % en Normal, 10 171 à 25,4 % en Vétéran.
  const fossil = L.stops.find(x => x.stop === '30:El fósil despierta');
  const wins = 66277 * 0.245 - 46334 * 0.276 - 10171 * 0.254;
  assert.equal(fossil.n, 9772);
  assert.ok(Math.abs(fossil.win - 100 * wins / 9772) < 1e-9 && fossil.lo < fossil.win && fossil.win < fossil.hi);
  // Essais par victoire au centième, comme l'API ; d = win − exp ; bornes de Wilson sur ne.
  assert.equal(fossil.tries, Math.round(100 * 9772 / wins) / 100);
  assert.ok(Math.abs(fossil.d - (fossil.win - fossil.exp)) < 1e-9 && fossil.ne < fossil.n);
  const z = 1.96;
  const p = fossil.win / 100;
  const lo = 100 * (p + z * z / (2 * fossil.ne) - z * Math.sqrt(p * (1 - p) / fossil.ne + z * z / (4 * fossil.ne ** 2))) / (1 + z * z / fossil.ne);
  assert.ok(Math.abs(fossil.lo - lo) < 1e-9);
  // Total de Légende : 1,22 million de combats.
  assert.equal(L.total.n, DIF.all.total.n - DIF.normal.total.n - DIF.veteran.total.n);
  // Kabuto · Lokhlass · Amonita contre le fossile : 81 % en Normal, 14 % en Légende.
  const key = c => `${c.stop}|${KT.coreKey(c.core)}`;
  const klo = L.cores.find(c => key(c) === '30:El fósil despierta|kabuto+lapras+omanyte');
  assert.deepEqual([klo.n, Math.round(klo.win)], [518, 14]);
  // Trio absent de Vétéran (moins de 10 combats) : 9 combats gagnés retirés en plus de Normal.
  const vet = new Set(DIF.veteran.cores.map(key));
  const missing = DIF.all.cores.find(c => !vet.has(key(c)) && DIF.normal.cores.some(x => key(x) === key(c)));
  const inNormal = DIF.normal.cores.find(x => key(x) === key(missing));
  const deduced = L.cores.find(c => key(c) === key(missing));
  assert.equal(deduced.n, missing.n - inNormal.n - 9);
  assert.ok(Math.abs(deduced.win * deduced.n - Math.max(0, missing.n * missing.win - inNormal.n * inNormal.win - 900)) < 1e-6);
  // Entrée sans combat restant : retirée.
  const one = { ...DIF.all, stops: [{ ...DIF.all.stops[0], n: 30 }] };
  const sub = f => ({ ...f, stops: [{ ...f.stops[0], n: 15 }] });
  assert.deepEqual(KT.legendStats(one, sub(DIF.normal), sub(DIF.veteran)).stops, []);
});

test('en-tête de la Tour sans aucun arrêt : format de l’API, pas « cette aventure »', () => {
  const head = KT.headHtml({ advice: null, stats: { torre: { ...modes.torre, stops: [] } }, mode: KT.TOWER_MODE, floor: 5 });
  assert.match(head, /Aucun boss de la Tour dans les statistiques publiques/);
});

// Cap sur Cramois'Île en Normal : l'équipe de CAMP, sans champion à choisir.
const CANELA = { ...CAMP, league: 1, gymOrder: [], attempts: 0 };
const canela = (round, extra = {}) => ({ ...CANELA, round, hp: 60, gold: 31, ...extra });

test('Cramois’Île : boss du jeu, Artikodin perdable ; tout jouer seulement sur un boss à gagner', () => {
  const m = mode({}, 'canela');
  assert.deepEqual([8, 19, 24, 27, 29, 30].map(floor => KT.mustWin({ floor }, m)), [true, false, false, true, true, true]);
  // Kanto : Ondine (8) à gagner, Sbire Rocket (15) non ; Tour : chaque étage, élites comprises ; Je te choisis !, sans liste
  // de boss : chaque combat.
  assert.deepEqual([KT.mustWin({ floor: 8 }, mode({})), KT.mustWin({ floor: 15 }, mode({})), KT.mustWin({ floor: 59, boss: 'elite' }, KT.TOWER_MODE),
    KT.mustWin({ floor: 3 }, mode({}, 'inicio'))], [true, false, true, true]);
  // Voleur (24, 18,9 %) : mur perdable, l'or garde son palier ; le fossile (30, 25,1 %) : tout jouer.
  const head = round => KT.headHtml({ advice: advise(canela(round), 'canela'), stats: panelStats(), mode: mode(CANELA, 'canela'), floor: round + 1 });
  const thief = advise(canela(23), 'canela').eco;
  assert.deepEqual([thief.allIn, thief.spend, thief.nextWall.floor], [false, 0, 24]);
  assert.match(head(23), /Combat 24 \(Voleur, 18,9 %\) : perdable sans rejouer, garde le palier\./);
  assert.equal(advise(canela(29), 'canela').eco.allIn, true);
  assert.match(head(28), /Combat 30 \(Le fossile s’éveille, 25,1 %\) : tout jouer\./);
});

// Statistiques de Légende déduites de la fixture du 14 novembre 2026 (31 octobre au 13 novembre).
const LEGEND = KT.leagueStats(DIF.all, DIF.normal, DIF.veteran).camp3;
// Partie de Cramois'Île sans Pokémon, au niveau visé de chaque combat (Légende par défaut).
const freshCanela = (round, extra = {}) => {
  const league = extra.league ?? 3;
  return { ...CANELA, league, round, level: KT.levelGoal(round + 1, mode({ league }, 'canela')), units: {}, board: {}, bench: Array(9).fill(null),
    shop: Array(5).fill(null), items: [], hp: 60, gold: 31, ...extra };
};
const legendAt = (round, extra = {}) => advise(freshCanela(round, extra), 'canela', { stats: LEGEND });
// Malus d'un trio à trouver sur les combats notés de la compo cible : sa note moins la même sans bonus de possession.
function scarcity(save, core, stats, extra = {}) {
  const a = advise(save, 'canela', { stats, ...extra });
  const cores = new Map(a.target.stops.map(st => [st.stop, new Map(stats.cores.filter(c => c.stop === st.stop && c.n >= 20).map(c => [KT.coreKey(c.core), c]))]));
  const rated = KT.ratedStops(a.target.stops, cores);
  return KT.coreScore(core, rated, a.game, data) - KT.coreScore(core, rated, { ...a.game, mode: { ...a.game.mode, ownedBonus: 0 } }, data);
}

test('Cramois’Île en Légende : murs sur les vrais taux, trio des boss 27 à 30 dès le combat 13', () => {
  // Combat 25 : le Rival (27, 39,7 % en Légende) est le mur ; le Sous-sol (29, 78,8 %) n'en est pas un.
  const eco = legendAt(24).eco;
  assert.deepEqual([eco.nextWall.floor, Math.round(10 * eco.nextWall.fightWin) / 10, eco.allIn], [27, 39.7, false]);
  assert.equal(legendAt(28).eco.allIn, false);
  assert.equal(legendAt(29).eco.allIn, true);
  // Kabuto · Lokhlass · Amonita, coût 4 : au niveau visé du Rival (8), ils sortent assez ; plus de malus au combat 13.
  assert.deepEqual([12, 19, 24].map(r => legendAt(r).target.core), Array(3).fill(['kabuto', 'lapras', 'omanyte']));
  const klo = ['kabuto', 'lapras', 'omanyte'];
  // Combat 20 : malus nul au niveau visé du Rival (8), le joueur au niveau 7. Combat 9 : seul Artikodin, perdable, est noté ;
  // malus au niveau actuel (5), le fossile du combat 23 venant après lui.
  assert.deepEqual([scarcity(freshCanela(19), klo, LEGEND), scarcity(freshCanela(8), klo, LEGEND)], [0, -30]);
});

test('Cramois’Île : Pokémon offert par un événement d’ici au boss, jamais rare', () => {
  // Normal, Chef des motards (8) au niveau 5 : Excelangue (coût 3) sort à 13 %, mais le poste de garde (5) l'offre.
  const trio = ['lickitung', 'pidgey', 'spearow'];
  const at = (round, extra = {}) => scarcity(freshCanela(round, { league: 1, level: 5, ...extra }), trio, DIF.normal);
  // Au combat 5 : à venir tant que le choix n'est pas fait, que le jeu ait déjà écrit l'événement ou non.
  const pending = { event: { round: 4, kind: 'choice', picked: null } };
  const done = { event: { round: 4, kind: 'choice', picked: 1 } };
  assert.deepEqual([at(0), at(4, pending), at(4), at(4, done), at(5)], [0, 0, 0, -10, -10]);
  // Un événement n'offre qu'une de ses cartes : deux lignées rares du même événement, un seul malus évité (Kabuto, coût 4,
  // ajouté ici au poste de garde).
  const m = mode({ league: 1 }, 'canela');
  const both = { ...m, adv: { ...m.adv, events: { ...m.adv.events, 5: [...m.adv.events[5], { name: 'Kabuto', mon: 'kabuto' }] } } };
  const pair = ['lickitung', 'kabuto', 'pidgey'];
  assert.equal(scarcity(freshCanela(0, { league: 1, level: 5 }), pair, DIF.normal, { mode: both }), -10);
});

test('Cramois’Île : niveaux visés à la taille des équipes adverses, Kanto inchangé', () => {
  assert.deepEqual([5, 6, 8, 14, 19, 24, 30].map(f => KT.levelGoal(f, mode({}, 'canela'))), [0, 4, 5, 6, 7, 8, 8]);
  assert.ok(KT.goldRules(mode({}, 'canela')).some(r => r.includes('(4 dès le combat 6, 5 dès le combat 8, 6 dès le combat 14, 7 dès le combat 19, 8 dès le combat 24)')));
  assert.deepEqual([4, 8, 30].map(f => KT.levelGoal(f, mode({}))), [4, 5, 9]);
});

// Trios notés sur les combats de la compo cible d'une partie : [trio, taux, borne basse] chacun.
const coresOn = (save, ...cores) => ({ ...camp, cores: advise(save, 'canela').target.stops.flatMap(s => cores.map(([core, win, lo]) => ({ stop: s.stop, core, n: 500, win, lo }))) });
// Conseil de chaque carte d'un événement de Cramois'Île : « titre : raison », null sans pastille.
const eventPicks = (save, ...cores) => advise(save, 'canela', { stats: cores.length ? coresOn(save, ...cores) : camp }).event.map(m => m && `${m.title} : ${m.why}`);
const choiceAt = (round, extra = {}, event = {}) => canela(round, { ...extra, event: { round, kind: 'choice', picked: null, ...event } });
const centerAt = (center, extra = {}) => choiceAt(24, extra, { kind: 'center', center });
const KABUTO = [['kabuto', 'growlithe', 'vulpix'], 95, 90];

test('Cramois’Île, événements à Pokémon : trio de la compo cible, puis le plus fort ; à égalité, l’XP', () => {
  const lab = choiceAt(22);
  assert.deepEqual(eventPicks(lab, KABUTO), [null, 'Prends Fossile Dôme : Kabuto, du trio de la compo cible']);
  const fossil = advise(lab, 'canela', { stats: coresOn(lab, KABUTO) });
  assert.equal(fossil.event[1].detail, 'L’autre fossile se réveille au combat 30 : Amonistar ★3.');
  // La fenêtre d'événement bloque le jeu : son conseil passe en tête, panneau replié compris.
  assert.match(KT.summaryHtml({ advice: fossil }), /<span class="t" title="Prends Fossile Dôme">/);
  // Amonita, hors du trio retenu, figure dans un trio plus gagnant que ses combats : plus forte que Kabuto, sans trio.
  assert.deepEqual(eventPicks(lab, [['growlithe', 'vulpix', 'ponyta'], 95, 90], [['omanyte', 'abra', 'oddish'], 99, 40]),
    ['Prends Fossile Nautile : Amonita, plus fort que Kabuto (combats 24–30)', null]);
  // Les deux fossiles dans le trio : Kabuto ★★ tient 3 exemplaires, deux Amonita ★ en tiennent 2.
  const units = { ...CANELA.units, k: { id: 'k', line: 'kabuto', star: 2 }, o1: { id: 'o1', line: 'omanyte', star: 1 }, o2: { id: 'o2', line: 'omanyte', star: 1 } };
  const both = { ...lab, units, bench: ['b', 'c', 'e', 'k', 'o1', 'o2', null, null, null] };
  assert.deepEqual(eventPicks(both, [['kabuto', 'omanyte', 'vulpix'], 95, 90]), ['Prends Fossile Nautile : Amonita, du trio de la compo cible : 2 exemplaires', null]);
  // Troisième carte : le premier critère lit les trois cartes ; une carte qu'il écarte ne revient pas aux suivants.
  const labMode = mode(lab, 'canela');
  const amber = { ...labMode, adv: { ...labMode.adv, events: { ...labMode.adv.events, 23: [...labMode.adv.events[23], { name: 'Vieil Ambre', mon: 'aerodactyl' }] } } };
  const amberWhy = (save, core) => advise(save, 'canela', { mode: amber, stats: coresOn(save, [core, 95, 90]) }).event.map(x => x && x.why);
  assert.deepEqual(amberWhy(lab, ['aerodactyl', 'growlithe', 'vulpix']), [null, null, 'Ptéra, du trio de la compo cible']);
  assert.deepEqual(amberWhy(both, ['kabuto', 'omanyte', 'vulpix']), ['Amonita, du trio de la compo cible : 2 exemplaires', null, null]);
  // Carte sans Pokémon : hors de la comparaison (sans quoi le motif « plus fort que… » lirait son Pokémon absent). Seule face
  // à elle, une carte à Pokémon n'est conseillée que du trio d'une compo, aucun autre critère ne la comparant à rien.
  const leave = cards => ({ ...labMode, adv: { ...labMode.adv, events: { ...labMode.adv.events, 23: cards } } });
  const fossils = labMode.adv.events[23];
  const leaveWhy = (cards, ...cores) => advise(lab, 'canela', { mode: leave(cards), stats: coresOn(lab, ...cores) }).event.map(x => x && x.why);
  const stronger = [[['growlithe', 'vulpix', 'ponyta'], 95, 90], [['omanyte', 'abra', 'oddish'], 99, 40]];
  assert.deepEqual(leaveWhy([...fossils, { name: 'Partir' }], ...stronger), ['Amonita, plus fort que Kabuto (combats 24–30)', null, null]);
  assert.deepEqual(leaveWhy([fossils[0], { name: 'Partir' }], ...stronger), [null, null]);
  assert.deepEqual(leaveWhy([{ name: 'Partir' }, fossils[1]], KABUTO), [null, 'Kabuto, du trio de la compo cible']);
  // Poste de garde : ni Excelangue ni Canarticho dans un trio, Canarticho donne 2 XP.
  assert.deepEqual(eventPicks(choiceAt(4), KABUTO), [null, 'Prends Canarticho : même force, +2 XP']);
  // Excelangue dans le trio des combats d'après la compo cible : la compo suivante.
  const guard = choiceAt(4);
  const m = mode(guard, 'canela');
  const later = KT.nextStops(camp.stops, 5, m.horizon, m, m.horizon).map(s => ({ stop: s.stop, core: ['lickitung', 'abra', 'oddish'], n: 500, win: 95, lo: 90 }));
  const stats = coresOn(guard, KABUTO);
  assert.deepEqual(advise(guard, 'canela', { stats: { ...stats, cores: [...stats.cores, ...later] } }).event.map(x => x && x.why), ['Excelangue, du trio de la compo suivante', null]);
  // Seule face à une carte sans Pokémon, Excelangue reste conseillée du trio de la compo suivante.
  const alone = { ...m, adv: { ...m.adv, events: { ...m.adv.events, 5: [{ name: 'Partir' }, m.adv.events[5][0]] } } };
  assert.deepEqual(advise(guard, 'canela', { mode: alone, stats: { ...stats, cores: [...stats.cores, ...later] } }).event.map(x => x && x.why), [null, 'Excelangue, du trio de la compo suivante']);
});

test('Cramois’Île, XP contre PV et centre : seuil de PV, plafond de niveau, carte grisée jamais conseillée', () => {
  const tide = extra => eventPicks(choiceAt(12, extra));
  assert.deepEqual(tide({ hp: 60 }), ['Prends Traverser maintenant : +4 XP ; PV 60 → 54, seuil 40', null]);
  assert.deepEqual(tide({ hp: 44 }), [null, 'Prends Attendre la marée basse : Traverser maintenant : PV 44 → 38, sous le seuil de 40']);
  assert.deepEqual(tide({ level: 9 }), [null, 'Prends Attendre la marée basse : niveau 9 atteint : l’XP ne sert plus']);
  // Marée basse grisée sous 4 pièces ; journal grisé à 5 PV ou moins ; soins grisés sous 6 pièces.
  assert.deepEqual(tide({ hp: 44, gold: 2 }), ['Prends Traverser maintenant : Attendre la marée basse : 4 pièces, tu en as 2', null]);
  assert.deepEqual(eventPicks(choiceAt(25, { hp: 4 })), [null, 'Prends Emporter le carnet : Lire le journal : il faut plus de 5 PV, tu en as 4']);
  assert.deepEqual(eventPicks(centerAt('care', { hp: 30 })), [null, 'Prends Soins : PV 30, sous le seuil de 40']);
  assert.deepEqual(eventPicks(centerAt('care', { hp: 30, gold: 3 })), ['Prends Repos : Soins : 6 pièces, tu en as 3', null]);
  assert.deepEqual(eventPicks(centerAt('care')), ['Prends Repos : PV 60, pas sous le seuil de 40 : garde tes pièces', null]);
  assert.deepEqual(eventPicks(centerAt('top', { hp: 98 })), [null, 'Prends Entraînement : +8 XP ; PV 98 → 90, seuil 40']);
  // L'entraînement n'est jamais grisé : refusé au seuil de PV, sans « il faut plus de ».
  assert.deepEqual(eventPicks(centerAt('top', { hp: 6 })), ['Prends Repos : Entraînement : PV 6 → 1, sous le seuil de 40', null]);
  assert.deepEqual(eventPicks(centerAt('full', { hp: 100, level: 9 })), [null, 'Prends Pourboire : niveau 9 atteint : l’XP ne sert plus']);
});

test('Cramois’Île, événements : rien une fois la carte choisie, hors de la manche, ni hors d’une aventure qui les décrit', () => {
  assert.deepEqual(eventPicks(choiceAt(12, {}, { picked: 0 })), []);
  assert.deepEqual(eventPicks(choiceAt(12, {}, { round: 11 })), []);
  // Événement sans options relevées (Ayudante de Oak, combat 3) et centre de Kanto : pas de pastille.
  assert.deepEqual(eventPicks(choiceAt(2, {}, { kind: 'oak' })), []);
  assert.deepEqual(advise({ ...CAMP, event: { round: CAMP.round, kind: 'center', center: 'care', picked: null } }).event, []);
});
