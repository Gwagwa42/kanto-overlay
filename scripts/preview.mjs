// Pages d'aperçu autonomes, une par état : le userscript inline sur un décor qui reprend les classes du jeu (boutique, banc,
// objets, modales), l'API, le Cache Storage et la sauvegarde simulés.
// Usage : node scripts/preview.mjs → build/preview-<état>.html, puis render-html.sh sur chaque page (commande imprimée).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const KT = require(`${root}kanto-overlay.user.js`);
const script = readFileSync(`${root}kanto-overlay.user.js`, 'utf8');
const torre = require(`${root}test/fixtures/campana.json`).modes.torre;
const data = require(`${root}test/fixtures/data.json`);
const lang = require(`${root}test/fixtures/lang.json`);

// Scénario commun avec les tests et la maquette.
const S57 = require(`${root}test/fixtures/s57.js`);
const MODALS = { ...S57, itemReward: ['protein', 'carbos', 'zinc'], tower: { boons: ['nugget'], offer: { ids: ['nugget', 'leftovers', 'flute'] } } };

const STATES = {
  conseils: { save: S57, api: 'ok', tip: true },
  modales: { save: MODALS, api: 'ok', modal: true },
  'boss-difficile': { save: { ...S57, round: 1195 }, api: 'ok' },
  'sans-sauvegarde': { save: null, api: 'ok' },
  'sans-donnee': { save: { ...S57, round: 1998 }, api: 'ok' },
  'donnees-partielles': { save: S57, api: 'partial' },
  chargement: { save: S57, api: 'pending' },
  erreur: { save: S57, api: 'error' },
};

// Seules les données lues par ces états restent dans la page (URL data: limitée à ~90 Ko de HTML).
function slim(s) {
  const stops = torre.stops.filter(x => {
    const f = Number(x.stop.split(':')[0]);
    return (f >= 55 && f <= 64) || (!x.stop.endsWith(':elite') && f <= 200);
  });
  const next = KT.nextStops(torre.stops, 57).map(x => x.stop);
  const cores = [...next.flatMap(st => torre.cores.filter(c => c.stop === st && c.n >= 20).sort((a, b) => b.lo - a.lo).slice(0, 6)),
    ...['60:zapdos', '200:mewtwo2'].flatMap(st => KT.topCores(torre.cores, st))];
  const lines = new Set([...cores.flatMap(c => c.core), ...s.shop, ...Object.values(s.units).map(u => u.line)].map(KT.baseLine));
  return {
    torre: {
      rules: torre.rules, from: torre.from, to: torre.to, stops, cores: [...new Map(cores.map(c => [`${c.stop}|${c.core}`, c])).values()],
      lines: torre.lines.filter(l => lines.has(KT.baseLine(l.line))),
      holders: torre.holders.filter(h => lines.has(KT.baseLine(h.line)) && h.n >= 20 && data.items[h.id]?.k === 'full')
        .sort((a, b) => b.lo - a.lo).filter((h, i, all) => all.findIndex(x => x.line === h.line && x.id === h.id) === i)
        .filter((h, i, all) => all.filter(x => x.line === h.line).indexOf(h) < 3),
    },
    data: {
      ...data, lines: Object.fromEntries([...lines].filter(b => data.lines[b]).map(b => [b, data.lines[b]])),
      seals: {},
    },
    lang: { items: lang.items, seals: {} },
  };
}

const card = (name, cost) => `<div class="cardwrap"><button class="card"><span class="cname">${name}</span><span class="cost">${cost}</span></button></div>`;
const decor = (s, modal) => `
<div class="topbar"><div class="rtrack tw"><span class="st-place-l">Étage ${s.round - 999}</span></div></div>
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

mkdirSync(`${root}build`, { recursive: true });
for (const [name, s] of Object.entries(STATES)) {
  const api = slim(s.save ?? S57);
  const payload = { [KT.SOURCES.torre]: { v: 1, modes: { torre: api.torre } }, [KT.SOURCES.data]: api.data, [KT.SOURCES.lang]: api.lang };
  const stub = `
const store = new Map(${JSON.stringify(s.save ? [[KT.SAVE_KEY, JSON.stringify(s.save)]] : [])});
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } });
const cacheStore = new Map();
Object.defineProperty(window, 'caches', { configurable: true, value: { open: async () => ({
  match: async url => cacheStore.get(url)?.clone(), put: async (url, res) => { cacheStore.set(url, res); } }) } });
const api = ${JSON.stringify(s.api)};
const payload = ${JSON.stringify(payload)};
// partial : seule data.json échoue (429).
const served = url => api === 'ok' || (api === 'partial' && url !== ${JSON.stringify(KT.SOURCES.data)});
window.fetch = url => api === 'pending' ? new Promise(() => {})
  : Promise.resolve(new Response(served(url) ? JSON.stringify(payload[url]) : '', { status: served(url) ? 200 : 429 }));
${s.tip ? `setTimeout(() => { const r = [...document.body.children].find(e => e.shadowRoot)?.shadowRoot;
  r?.append(Object.assign(document.createElement('style'), { textContent: '.kp:nth-child(1) { z-index: 1; } .kp:nth-child(1) .kp-tip { display: block; }' })); }, 50);` : ''}
`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu ${name}</title><style>${STYLE}</style></head>
<body>${s.save ? decor(s.save, s.modal) : '<p style="padding:24px">Jeu (fond simulé) · aucune partie Tour</p>'}
<script>${stub}</script>
<script>${script}</script></body></html>`;
  const out = `${root}build/preview-${name}.html`;
  writeFileSync(out, html);
  console.log(`bash ~/.claude/skills/ui-design/scripts/render-html.sh ${out} --sizes 1440x900`);
}
