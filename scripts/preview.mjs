// Pages d'aperçu autonomes du panneau, une par état : le userscript inline, l'API et la sauvegarde simulées.
// Usage : node scripts/preview.mjs → build/preview-<état>.html, puis render-html.sh sur chaque page (commande imprimée).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const KT = require(`${root}kanto-overlay.user.js`);
const script = readFileSync(`${root}kanto-overlay.user.js`, 'utf8');
const torre = JSON.parse(readFileSync(`${root}test/fixtures/campana.json`, 'utf8')).modes.torre;

const STATES = {
  nominal: { round: 1057, api: 'ok' },
  'boss-difficile': { round: 1195, api: 'ok' },
  'sans-sauvegarde': { round: null, api: 'ok' },
  chargement: { round: 1057, api: 'pending' },
  erreur: { round: 1057, api: 'error' },
  'sans-donnee': { round: 1999, api: 'ok' },
};

// Seuls les boss et les trios affichés restent dans la page (taille d'URL data: limitée).
const stops = torre.stops.filter(s => {
  const floor = Number(s.stop.split(':')[0]);
  return !s.stop.endsWith(':elite') && (floor <= 200 || floor >= 990);
});
const cores = [...new Set(torre.cores.map(c => c.stop))].flatMap(stop => KT.topCores(torre.cores, stop));
const data = { from: torre.from, to: torre.to, stops, cores };

mkdirSync(`${root}build`, { recursive: true });
const pages = {};
for (const [name, s] of Object.entries(STATES)) {
  const save = s.round === null ? null : JSON.stringify({ round: s.round });
  const stub = `
const store = new Map(${JSON.stringify(save === null ? [] : [[KT.SAVE_KEY, save]])});
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } });
const api = ${JSON.stringify(s.api)};
const payload = JSON.stringify(${JSON.stringify({ modes: { torre: data } })});
window.fetch = () => api === 'pending' ? new Promise(() => {})
  : Promise.resolve(new Response(api === 'ok' ? payload : '', { status: api === 'ok' ? 200 : 429 }));
`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu ${name}</title>
<style>body{margin:0;min-height:100vh;background:#141a33;color:#eef1ff;font:16px system-ui;display:grid;place-items:center}</style></head>
<body><p>Jeu (fond simulé) · état « ${name} »</p>
<script>${stub}</script>
<script>${script}</script></body></html>`;
  pages[name] = html;
  const out = `${root}build/preview-${name}.html`;
  writeFileSync(out, html);
  console.log(`bash ~/.claude/skills/ui-design/scripts/render-html.sh ${out}`);
}

// Largeur étroite : Chrome headless met la page en page sur ~500 px au minimum, d'où des iframes de 412 px.
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const frames = ['nominal', 'erreur']
  .map(n => `<iframe title="${n}" width="412" height="860" srcdoc="${attr(pages[n])}"></iframe>`).join('');
const narrow = `${root}build/preview-etroit.html`;
writeFileSync(narrow, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu étroit</title>
<style>body{margin:0;padding:16px;display:flex;gap:16px;background:#888}iframe{border:0}</style></head><body>${frames}</body></html>`);
console.log(`bash ~/.claude/skills/ui-design/scripts/render-html.sh ${narrow} --sizes 1440x900`);
