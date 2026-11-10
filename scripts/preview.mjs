// Pages d'aperçu, deux par état. preview-<état>.html : le userscript inline sur un décor qui reprend les classes du jeu (boutique,
// banc, objets, modales), l'API, le Cache Storage et la sauvegarde simulés ; trop lourde pour une URL data:, elle s'ouvre servie en
// local (README, Développement). panel-<état>.html : le panneau seul, statique, rendu par render-html.sh (commande imprimée).
// Usage : node scripts/preview.mjs → build/preview-<état>.html et build/panel-<état>.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const KT = require(`${root}kanto-overlay.user.js`);
const script = readFileSync(`${root}kanto-overlay.user.js`, 'utf8');
const modes = require(`${root}test/fixtures/campana.json`).modes;
const data = require(`${root}test/fixtures/data.json`);
const lang = require(`${root}test/fixtures/lang.json`);

// Scénario commun avec les tests et la maquette.
const S57 = require(`${root}test/fixtures/s57.js`);
const MODALS = { ...S57, itemReward: ['protein', 'carbos', 'zinc'], tower: { boons: ['nugget'], offer: { ids: ['nugget', 'leftovers', 'flute'] } } };

// Maquette 2026-11-06-shiny : Minidraco shiny dans la compo, Rattata shiny sur un banc plein (pas de « Vends » avant l'étage 121).
const SHINY = {
  ...S57,
  units: {
    ...S57.units, a: { ...S57.units.a, shiny: true }, e: { ...S57.units.e, shiny: true },
    // Lignées hors compo déjà dans la page (trios affichés, boutique) : même compo que la maquette, page allégée.
    f: { id: 'f', line: 'shellder', star: 1 }, g: { id: 'g', line: 'shellder', star: 1 }, h: { id: 'h', line: 'staryu', star: 1 },
    i: { id: 'i', line: 'staryu', star: 1 }, j: { id: 'j', line: 'ekans', star: 1 },
  },
  bench: ['b', 'c', 'e', 'f', 'g', 'h', 'i', 'j', null],
};

// Campagne Kanto en Légende, combat 15 (Sbire Rocket), Morgane choisie au 4ᵉ badge : seuils durcis de 20 points ; Safari, aventure
// sans table d'arrêts : compo sans trio.
const CAMP = { ...S57, mode: 'campaign', round: 14, league: 3, gymOrder: ['sabrina', 'koga'], level: 6, gold: 47, tower: undefined };
const SAVE_KANTO = 'kanto-tactics-save';

const STATES = {
  conseils: { save: S57, api: 'ok', tip: true },
  campagne: { save: CAMP, key: SAVE_KANTO, api: 'ok', tip: true },
  'campagne-compo': { save: CAMP, key: SAVE_KANTO, api: 'ok', ui: { tab: 'compo' } },
  'campagne-regles': { save: CAMP, key: SAVE_KANTO, api: 'ok', ui: { tab: 'rules' } },
  'aventure-sans-stats': { save: { ...CAMP, league: 1, gymOrder: [] }, key: 'kanto-tactics-save-adv-safari', api: 'ok', ui: { tab: 'compo' } },
  // Leveinard et Lokhlass, de la compo suivante, en boutique : avec des places libres, ce sont des compléments de la compo cible
  // (★ « place libre »). Le ◆ « prépare la compo » n'a pas de scénario sur ces données : sans place libre, les cartes de la compo
  // suivante y deviennent des cartes plus fortes de la compo cible ; le test « boutique : ◆ pour la compo suivante… » le couvre.
  'compo-suivante': { save: { ...S57, gold: 40, shop: ['chansey', 'lapras', 'magmar', 'rattata', 'ekans'] }, api: 'ok', tip: true, ui: { tab: 'compo' } },
  shiny: { save: SHINY, api: 'ok', ui: { tab: 'compo' } },
  // Onglets, menu ⚙ et panneau replié (maquette 2026-11-09-refonte).
  'onglet-boss': { save: S57, api: 'ok', ui: { tab: 'boss' } },
  'onglet-regles': { save: S57, api: 'ok', ui: { tab: 'rules' } },
  'a-eviter-ouvert': { save: S57, api: 'ok', ui: { avoid: true } },
  options: { save: S57, api: 'ok', menu: true, ui: { pins: { no: false } } },
  replie: { save: S57, api: 'ok', tip: true, ui: { collapsed: true } },
  'large-grand-85': { save: S57, api: 'ok', ui: { width: 'wide', text: 'large', alpha: '85' } },
  modales: { save: MODALS, api: 'ok', modal: true },
  'boss-difficile': { save: { ...S57, round: 1195 }, api: 'ok', ui: { tab: 'boss' } },
  'sans-sauvegarde': { save: null, api: 'ok' },
  'sans-donnee': { save: { ...S57, round: 1998 }, api: 'ok' },
  'donnees-partielles': { save: S57, api: 'partial' },
  chargement: { save: S57, api: 'pending' },
  erreur: { save: S57, api: 'error' },
};

// Seules les données lues par ces états restent dans la page, qui porte déjà les 160 Ko du script : le mode de la partie,
// l'autre réduit à un arrêt (campana.json est refusé sans la Tour).
function slim(s, key) {
  const camp = key !== undefined;
  const mode = camp ? KT.latestSave({ length: 1, key: () => key, getItem: () => JSON.stringify(s) }).mode : KT.TOWER_MODE;
  const stats = modes[mode.stats];
  const floor = mode.floorOf(s.round);
  // Compo cible et compo suivante : les 18 prochains combats ; les 6 meilleurs trios de chaque combat gardent leurs
  // statistiques sur tous ces combats, pour un score identique à celui des données complètes. Tour : boss des étages 196 à 200.
  const next = KT.nextStops(stats.stops, floor, 18, mode).map(x => x.stop);
  const stops = stats.stops.filter(x => {
    const f = Number(x.stop.split(':')[0]);
    return next.includes(x.stop) || (!camp && f >= 196 && f <= 200);
  });
  const played = stats.cores.filter(c => next.includes(c.stop) && c.n >= 20);
  const best = new Set(next.flatMap(st => played.filter(c => c.stop === st).sort((a, b) => b.lo - a.lo).slice(0, 6).map(c => `${c.core}`)));
  const boss = KT.nextBossStop(stats.stops, floor, mode)?.stop;
  const cores = [...played.filter(c => best.has(`${c.core}`)),
    ...(camp ? [boss] : ['60:zapdos', '200:mewtwo2']).flatMap(st => KT.topCores(stats.cores, st))];
  const lines = new Set([...cores.flatMap(c => c.core), ...s.shop, ...Object.values(s.units).map(u => u.line)].map(KT.baseLine));
  const slimmed = {
    rules: stats.rules, from: stats.from, to: stats.to, stops, cores: [...new Map(cores.map(c => [`${c.stop}|${c.core}`, c])).values()],
    lines: stats.lines.filter(l => lines.has(KT.baseLine(l.line))),
    stars: stats.stars.filter(x => lines.has(KT.baseLine(x.line))),
    // Tous les objets portés par ces lignées : le profil de chaque lignée (lineProfiles) se lit sur eux.
    holders: stats.holders.filter(h => lines.has(KT.baseLine(h.line))),
  };
  const torre = camp ? { ...modes.torre, stops: modes.torre.stops.slice(0, 1), cores: [], lines: [], stars: [], holders: [] } : slimmed;
  return {
    modes: camp ? { torre, camp: slimmed } : { torre },
    data: {
      ...data, lines: Object.fromEntries([...lines].filter(b => data.lines[b]).map(b => [b, data.lines[b]])),
      seals: {},
    },
    lang: { items: lang.items, seals: {} },
  };
}

const card = (name, cost) => `<div class="cardwrap"><button class="card"><span class="cname">${name}</span><span class="cost">${cost}</span></button></div>`;
const decor = (s, modal) => `
<div class="topbar">${s.mode === 'campaign' ? `<div class="rtrack ph-gyms"><span>Combat ${s.round + 1}</span></div>`
  : `<div class="rtrack tw"><span class="st-place-l">Étage ${s.round - 999}</span></div>`}</div>
<div class="bottom">
  <div class="items">${s.items.map((id, i) => `<div class="it-slot" data-islot="${i}">${lang.items[id]?.name ?? id}</div>`).join('')}</div>
  <div class="bench">${s.bench.map(id => `<div class="slot">${id ? KT.namer(lang).line(s.units[id].line) : ''}</div>`).join('')}</div>
  <div class="shop"><div class="shop-btns"><button class="btn-lvl">Acheter XP</button><button class="btn-roll">Actualiser</button></div>
  <div class="cards">${s.shop.map(b => (b ? card(KT.namer(lang).line(b), KT.lineInfo(data, b).c) : '<div class="cardwrap"></div>')).join('')}</div></div>
</div>
${modal ? `<div class="modals"><div class="modal itemreward"><div class="ir-cards">${s.itemReward.map(id => `<button class="ir-card">${lang.items[id].name}</button>`).join('')}</div></div>
<div class="modal evround tboon"><div class="ev-cards">${s.tower.offer.ids.map(id => `<button class="ev-card">${KT.BOONS[id][1]}</button>`).join('')}</div></div></div>` : ''}`;

const STYLE = `body{margin:0;min-height:100vh;background:#2b3a2a;color:#eef1ff;font:14px system-ui}
.topbar{position:absolute;top:16px;left:50%;translate:-50%;background:#1b2448;padding:4px 16px;border-radius:8px}
.bottom{position:absolute;left:24px;right:380px;bottom:16px;display:grid;gap:16px}
.items{display:flex;gap:8px}.it-slot{width:104px;height:36px;border-radius:18px;background:#3a4a8c;display:grid;place-items:center;font-size:12px}
.bench{display:grid;grid-template-columns:repeat(9,1fr);gap:4px}.slot{height:52px;border-radius:8px;background:#2a345e;display:grid;place-items:end center;font-size:12px;padding-bottom:4px}
.shop{display:grid;grid-template-columns:112px 1fr;gap:12px;background:#1b2448;border-radius:12px;padding:12px}
.shop-btns{display:grid;gap:8px}.shop-btns button{height:44px;border:0;border-radius:8px;background:#3a4a8c;color:#eef1ff;font:600 12px system-ui}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.card{width:100%;height:96px;border:0;border-radius:8px;background:#dfe2ee;color:#1b2448;display:grid;align-content:end;justify-items:start;padding:8px;font:700 12px system-ui}
.modals{position:absolute;inset:0;background:rgb(0 0 0/.6);display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;padding:0 380px 0 24px}
.modal{background:#232c55;border-radius:12px;padding:32px 16px 16px}.ir-cards,.ev-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.ir-card,.ev-card{height:120px;border:0;border-radius:10px;background:#3a3f8c;color:#eef1ff;font:700 14px system-ui}`;

// Page « panneau seul » : le gabarit du script rempli comme le ferait render, dans un Shadow DOM déclaratif, sans le script ni
// les données (quelques dizaines de Ko) : render-html.sh la rend telle quelle. Les pastilles, posées sur le jeu, n'y sont pas ; le
// thème « auto » suit le système par une ligne de script.
const FAILED = { error: ['stats', 'data', 'lang'], partial: ['data'] };
const FILES = { stats: 'campana.json', data: 'data.json', lang: 'lang.json' };
function panelPage(name, s) {
  const ui = { ...KT.UI_DEFAULTS, ...s.ui };
  KT.checkUi(ui);
  const raw = s.save ? JSON.stringify(s.save) : null;
  const found = raw && KT.latestSave({ length: 1, key: () => s.key ?? 'kanto-tactics-save-tower', getItem: () => raw });
  const start = { mode: KT.TOWER_MODE, saveKey: undefined, lastAuto: undefined, floor: null, source: 'manuel' };
  const failed = FAILED[s.api] ?? [];
  const loaded = k => s.api !== 'pending' && !failed.includes(k);
  const state = {
    ...KT.pollState(start, found, null, ui), lastRaw: raw, stats: loaded('stats') ? { torre: modes.torre, camp: modes.camp } : null,
    campBroken: false, data: loaded('data') ? data : null, lang: loaded('lang') ? lang : null, failed, stale: null, uncached: false,
    error: failed.length ? failed.map(k => `${FILES[k]} : HTTP 429`).join(' ; ') : null, copied: null,
  };
  const stats = KT.modeStats(state);
  // Même condition que compute dans mount.
  state.advice = KT.onSaveFloor(state) && (state.stats || state.error)
    ? KT.advise({ stats, data: state.data, lang: state.lang, save: state.save, previous: null, side: ui.side, mode: state.mode })
    : null;
  // Plan collé dans le Planificateur : le statut du panneau synchronisé.
  state.planner = { code: state.advice?.code ?? null, error: null };
  const look = { scheme: ui.theme === 'auto' ? 'dark' : ui.theme, width: ui.width, text: ui.text, alpha: ui.alpha };
  const shell = KT.shellHtml({
    look, label: state.mode.label, floor: state.floor, src: state.source, sum: KT.summaryHtml(state), alert: KT.alertHtml(state),
    opts: s.menu ? KT.optionsHtml(ui) : null, body: KT.panelHtml(state, ui), status: KT.statusHtml(state),
    foot: stats ? KT.footHtml(state) : '', collapsed: ui.collapsed,
  });
  const auto = ui.theme === 'auto'
    ? `<script>if (!matchMedia('(prefers-color-scheme: dark)').matches) document.getElementById('kt').shadowRoot.querySelector('.kt-root').dataset.scheme = 'light';</script>`
    : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Panneau ${name}</title><style>${STYLE}</style></head>
<body><div id="kt"><template shadowrootmode="open">${shell}<style>.kt { top: 16px; right: 16px; }</style></template></div>
${auto}</body></html>`;
}

mkdirSync(`${root}build`, { recursive: true });
for (const [name, s] of Object.entries(STATES)) {
  const api = slim(s.save ?? S57, s.key);
  const payload = { [KT.SOURCES.stats]: { v: 1, modes: api.modes }, [KT.SOURCES.data]: api.data, [KT.SOURCES.lang]: api.lang };
  const stub = `
const store = new Map(${JSON.stringify([...(s.save ? [[s.key ?? 'kanto-tactics-save-tower', JSON.stringify(s.save)]] : []), ...(s.ui ? [[KT.UI_KEY, JSON.stringify(s.ui)]] : [])])});
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  get length() { return store.size; }, key: i => [...store.keys()][i] ?? null } });
const cacheStore = new Map();
Object.defineProperty(window, 'caches', { configurable: true, value: { open: async () => ({
  match: async url => cacheStore.get(url)?.clone(), put: async (url, res) => { cacheStore.set(url, res); } }) } });
const api = ${JSON.stringify(s.api)};
const payload = ${JSON.stringify(payload)};
// partial : seule data.json échoue (429).
const served = url => api === 'ok' || (api === 'partial' && url !== ${JSON.stringify(KT.SOURCES.data)});
window.fetch = url => api === 'pending' ? new Promise(() => {})
  : Promise.resolve(new Response(served(url) ? JSON.stringify(payload[url]) : '', { status: served(url) ? 200 : 429 }));
${s.menu ? `setTimeout(() => [...document.body.children].find(e => e.shadowRoot)?.shadowRoot.querySelector('[data-act="menu"]').click(), 50);` : ''}
${s.tip ? `setTimeout(() => { const r = [...document.body.children].find(e => e.shadowRoot)?.shadowRoot;
  r?.append(Object.assign(document.createElement('style'), { textContent: '.kp:nth-child(1) { z-index: 1; } .kp:nth-child(1) .kp-tip { display: block; }' })); }, 50);` : ''}
`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu ${name}</title><style>${STYLE}</style></head>
<body>${s.save ? decor(s.save, s.modal) : '<p style="padding:24px">Jeu (fond simulé) · aucune partie Tour</p>'}
<script>${stub}</script>
<script>${script}</script></body></html>`;
  writeFileSync(`${root}build/preview-${name}.html`, html);
  const panel = `${root}build/panel-${name}.html`;
  writeFileSync(panel, panelPage(name, s));
  console.log(`bash ~/.claude/skills/ui-design/scripts/render-html.sh ${panel} --sizes 1440x900`);
}
