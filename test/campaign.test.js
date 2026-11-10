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
  assert.equal(advise(full).bench[3].title, 'Vends Abo');
  assert.equal(advise({ ...full, units: { ...units, f: { ...units.f, shiny: true } } }).bench[3], null);
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
  assert.equal(KT.leagueNote(mode(CAMP)), 'Kanto · Légende · tout jouer sous 65 %');
  assert.equal(KT.leagueNote(mode({}, 'canela')), 'Cap sur Cramois’Île · Normal');
  const state = save => ({ advice: advise(save), stats: { torre: modes.torre, camp }, mode: mode(save), floor: save.round + 1 });
  const head = KT.headHtml(state({ ...CAMP, round: 13 }));
  assert.match(head, /Kanto · Légende/);
  assert.match(head, /Morgane.*combat 16 · dans 2/s);
  assert.match(KT.headHtml(state({ ...CAMP, round: 15 })), /Tout jouer : combat difficile\./);
  assert.match(KT.headHtml(state({ ...CAMP, round: 3, attempts: 1 })), /Tout jouer : combat rejoué\./);
  assert.match(KT.headHtml({ ...state(CAMP), mode: mode(CAMP, 'safari') }), /Pas de statistiques publiques pour cette aventure/);
  // Champion à choisir : la manche entière, taux moyen ; couleur au taux moins la pénalité (48,5 − 20 : ▼ en Légende).
  const open = league => KT.headHtml({ ...state({ ...CAMP, round: 12, gymOrder: [], league }), mode: mode({ league, gymOrder: [] }) });
  assert.match(open(1), /Erika ou Koga ou Morgane<\/span><span class="kt-rate mid">● 48,5 %/);
  assert.match(open(3), /kt-rate bad">▼ 48,5 %/);
  // Table d'arrêts sans arrêt reconnu (libellés de l'API changés) : dit comme tel, pas « aventure sans statistiques ».
  const renamed = { ...camp, stops: camp.stops.map(x => ({ ...x, stop: x.stop.replace(':', ':X ') })) };
  assert.match(KT.headHtml({ ...state(CAMP), stats: { torre: modes.torre, camp: renamed } }), /Aucun combat de Kanto dans les statistiques publiques/);
});

test('panneau : Nuzlocke sans conseils, invite neutre sans partie', () => {
  const ui = { tab: 'tour' };
  const base = { stats: { torre: modes.torre, camp }, error: null, mode: KT.TOWER_MODE, floor: null, advice: null, save: null };
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
  const base = { error: null, failed: [], campBroken: true };
  assert.equal(KT.alertHtml({ ...base, mode: KT.TOWER_MODE }), '');
  assert.match(KT.alertHtml({ ...base, mode: mode(CAMP) }), /statistiques de campagne au format inattendu\)<\/strong>En campagne, seuls l’économie/);
  const both = KT.alertHtml({ ...base, mode: mode(CAMP), error: 'lang.json : réseau', failed: ['lang'] });
  assert.match(both, /lang\.json : réseau ; campana\.json : statistiques de campagne/);
  assert.match(both, /En campagne, seuls l’économie.*nommés par leur identifiant/);
});

test('en-tête de la Tour sans aucun arrêt : format de l’API, pas « cette aventure »', () => {
  const head = KT.headHtml({ advice: null, stats: { torre: { ...modes.torre, stops: [] } }, mode: KT.TOWER_MODE, floor: 5 });
  assert.match(head, /Aucun boss de la Tour dans les statistiques publiques/);
});
