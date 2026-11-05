// ==UserScript==
// @name         Kanto Tactics — panneau Tour
// @namespace    https://github.com/Gwagwa42/kanto-overlay
// @version      1.0.1
// @description  Prochain boss, meilleurs trios et conseils pour la Tour de combat de Kanto Tactics (données publiques einoow.com).
// Pages d'entrée qui chargent l'application du jeu ; le jeu change de mode sans changer d'adresse.
// @match        https://einoow.com/playables/kanto-tactics/*
// @match        https://einoow.com/
// @match        https://einoow.com/?*
// @match        https://einoow.com/kanto-tactics
// @match        https://einoow.com/kanto-tactics?*
// @match        https://einoow.com/tower
// @match        https://einoow.com/tower?*
// @match        https://einoow.com/pvp
// @match        https://einoow.com/pvp?*
// @match        https://einoow.com/duo
// @match        https://einoow.com/duo?*
// @match        https://einoow.com/nuzlocke
// @match        https://einoow.com/nuzlocke?*
// @noframes
// @grant        none
// @inject-into  content
// @run-at       document-idle
// @homepageURL  https://github.com/Gwagwa42/kanto-overlay
// @updateURL    https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js
// @downloadURL  https://raw.githubusercontent.com/Gwagwa42/kanto-overlay/main/kanto-overlay.user.js
// ==/UserScript==
'use strict';

const KT = (() => {
  const API = 'https://einoow.com/api/meta/kanto/campana.json';
  const SAVE_KEY = 'kanto-tactics-save-tower';
  const UI_KEY = 'kt-overlay:ui';
  // Le jeu numérote les manches de la Tour à partir de 1000 : étage = round − 1000 + 1 (assets/route-*.js).
  const ROUND_BASE = 1000;
  const MIN_FIGHTS = 20;

  // Lignes d'évolution par identifiant de l'API ; « -aN » = forme ancrée au stade N.
  const LINES = {
    abra: ['Abra', 'Kadabra', 'Alakazam'], aerodactyl: ['Ptéra'], articuno: ['Artikodin'],
    bellsprout: ['Chétiflor', 'Boustiflor', 'Empiflor'], bulbasaur: ['Bulbizarre', 'Herbizarre', 'Florizarre'],
    caterpie: ['Chenipan', 'Chrysacier', 'Papilusion'], chansey: ['Leveinard'],
    charmander: ['Salamèche', 'Reptincel', 'Dracaufeu'], clefairy: ['Mélofée', 'Mélodelfe'], cubone: ['Osselait', 'Ossatueur'],
    diglett: ['Taupiqueur', 'Triopikeur'], ditto: ['Métamorph'], doduo: ['Doduo', 'Dodrio'],
    dratini: ['Minidraco', 'Draco', 'Dracolosse'], drowzee: ['Soporifik', 'Hypnomade'], eevee: ['Évoli'],
    ekans: ['Abo', 'Arbok'], electabuzz: ['Élektek'], exeggcute: ['Noeunoeuf', 'Noadkoko'], farfetchd: ['Canarticho'],
    flareon: ['Pyroli'], gastly: ['Fantominus', 'Spectrum', 'Ectoplasma'], geodude: ['Racaillou', 'Gravalanch', 'Grolem'],
    giovanni: ['Miaouss de Giovanni', 'Persian de Giovanni'], goldeen: ['Poissirène', 'Poissoroy'],
    grimer: ['Tadmorv', 'Grotadmorv'], growlithe: ['Caninos', 'Arcanin'], hitmonchan: ['Tygnon'], hitmonlee: ['Kicklee'],
    horsea: ['Hypotrempe', 'Hypocéan'], jigglypuff: ['Rondoudou', 'Grodoudou'], jolteon: ['Voltali'], jynx: ['Lippoutou'],
    kabuto: ['Kabuto', 'Kabutops'], kangaskhan: ['Kangourex'], koffing: ['Smogo', 'Smogogo'],
    koga: ['Smogo de Koga', 'Smogogo de Koga'], krabby: ['Krabby', 'Krabboss'], lapras: ['Lokhlass'],
    lickitung: ['Excelangue'], machop: ['Machoc', 'Machopeur', 'Mackogneur'], magikarp: ['Magicarpe', 'Léviator'],
    magmar: ['Magmar'], magnemite: ['Magnéti', 'Magnéton'], mankey: ['Férosinge', 'Colossinge'],
    meowth: ['Miaouss', 'Persian'], mew: ['Mew'], mewtwo: ['Mewtwo'], moltres: ['Sulfura'], mrmime: ['M. Mime'],
    nidoran: ['Nidoran♂', 'Nidorino', 'Nidoking'], nidoranf: ['Nidoran♀', 'Nidorina', 'Nidoqueen'],
    oddish: ['Mystherbe', 'Ortide', 'Rafflesia'], omanyte: ['Amonita', 'Amonistar'], onix: ['Onix'],
    paras: ['Paras', 'Parasect'], pidgey: ['Roucool', 'Roucoups', 'Roucarnage'], pikachu: ['Pikachu', 'Raichu'],
    pinsir: ['Scarabrute'], poliwag: ['Ptitard', 'Têtarte', 'Tartard'], ponyta: ['Ponyta', 'Galopa'], porygon: ['Porygon'],
    psyduck: ['Psykokwak', 'Akwakwak'], rattata: ['Rattata', 'Rattatac'], rhyhorn: ['Rhinocorne', 'Rhinoféros'],
    samurai: ['Scarabrute du Samouraï'], sandshrew: ['Sabelette', 'Sablaireau'], scyther: ['Insécateur'],
    seel: ['Otaria', 'Lamantine'], shellder: ['Kokiyas', 'Crustabri'], slowpoke: ['Ramoloss', 'Flagadoss'],
    snorlax: ['Ronflex'], spearow: ['Piafabec', 'Rapasdepic'], squirtle: ['Carapuce', 'Carabaffe', 'Tortank'],
    staryu: ['Stari', 'Staross'], tangela: ['Saquedeneu'], tauros: ['Tauros'], tentacool: ['Tentacool', 'Tentacruel'],
    vaporeon: ['Aquali'], venonat: ['Mimitoss', 'Aéromite'], voltorb: ['Voltorbe', 'Électrode'], vulpix: ['Goupix', 'Feunard'],
    weedle: ['Aspicot', 'Coconfort', 'Dardargnan'], zapdos: ['Électhor'], zubat: ['Nosferapti', 'Nosferalto'],
  };

  const BOSSES = {
    aerodactyl: 'Ptéra', agatha: 'Agatha', arcanine: 'Arcanin', aves: 'Oiseaux légendaires', blaine: 'Auguste',
    brock: 'Pierre', bruno: 'Aldo', campeon: 'Maître de la Ligue', capitan: 'Capitaine', cientifico: 'Scientifique',
    cloyster: 'Crustabri', ditto: 'Métamorph', dragonite: 'Dracolosse', erika: 'Erika', gengar: 'Ectoplasma',
    giovanni: 'Giovanni', giovanni2: 'Giovanni (revanche)', gyarados: 'Léviator', iniciales: 'Pokémon de départ',
    karateka: 'Karatéka', koga: 'Koga', lance: 'Peter', lapras: 'Lokhlass', lorelei: 'Olga', machamp: 'Mackogneur',
    magneton: 'Magnéton', marowak: 'Ossatueur', mew: 'Mew', mewtwo2: 'Mewtwo', missingno: 'MissingNo.', misty: 'Ondine',
    onix: 'Onix', pescador: 'Pêcheur', recluta: 'Sbire Rocket', rhydon: 'Rhinoféros', rival: 'Rival', sabrina: 'Morgane',
    snorlax: 'Ronflex', surge: 'Major Bob', zapdos: 'Électhor',
  };

  // Conseils du guide (non vérifiés) par tranche d'étages.
  const GUIDE = [
    { to: 40, shinies: ['Bulbizarre', 'Mystherbe', 'Chétiflor', 'Nidorino', 'Amonita'], advice: 'Les prendre quand ils passent, sans actualiser exprès.' },
    { to: 80, shinies: ['Minidraco', 'Ptéra', 'Nidorino', 'Amonita'], advice: 'Priorité à ceux qui complètent l’équipe.' },
    { to: 120, shinies: ['Leveinard', 'Minidraco', 'Kabuto', 'Lokhlass', 'Kokiyas'], advice: 'Acheter seulement si l’économie reste saine.' },
    { to: 160, shinies: ['Ptéra', 'Leveinard', 'Minidraco'], advice: 'Un shiny hors composition ne mérite plus d’investissement.' },
    { to: Infinity, shinies: [], advice: 'Aucun farming de shinies : victoire et survie avant la collection.' },
  ];
  const GOLD_RULES = [
    'Intérêts : +1 pièce par tranche de 10, +5 au plus → garder 50 pièces si l’équipe tient.',
    'Actualisation à 2 pièces : ne pas en enchaîner pour un shiny.',
    'Dépenser avant un boss difficile, reconstituer après une victoire facile.',
  ];

  function floorFromSave(raw) {
    if (raw == null) return null;
    let save;
    try {
      save = JSON.parse(raw);
    } catch (e) {
      if (e instanceof SyntaxError) return null;
      throw e;
    }
    const round = save?.round;
    if (!Number.isFinite(round)) return null;
    return Math.max(1, Math.floor(round) - ROUND_BASE + 1);
  }

  function parseStop(stop) {
    const [floor, boss] = stop.split(':');
    return { floor: Number(floor), boss };
  }

  // Forme minimale de .modes.torre dont dépend le panneau ; sinon le format de l'API a changé.
  function isTowerData(t) {
    return Array.isArray(t?.stops) && Array.isArray(t.cores)
      && typeof t.from === 'string' && typeof t.to === 'string'
      && t.stops.every(s => typeof s?.stop === 'string' && /^\d+:\w+$/.test(s.stop) && [s.win, s.first, s.tries].every(Number.isFinite))
      && t.stops.some(s => !s.stop.endsWith(':elite'))
      && t.cores.every(c => typeof c?.stop === 'string' && Array.isArray(c.core) && Number.isFinite(c.n) && Number.isFinite(c.win));
  }

  function lastBossFloor(stops) {
    return Math.max(...stops.map(s => parseStop(s.stop)).filter(p => p.boss !== 'elite').map(p => p.floor));
  }

  function nextBossStop(stops, floor) {
    let best = null;
    for (const s of stops) {
      const p = parseStop(s.stop);
      if (p.boss === 'elite' || p.floor < floor) continue;
      if (!best || p.floor < best.floor) best = { ...s, ...p };
    }
    return best;
  }

  function topCores(cores, stop, limit = 3) {
    return cores
      .filter(c => c.stop === stop && c.n >= MIN_FIGHTS)
      .sort((a, b) => b.win - a.win || b.n - a.n)
      .slice(0, limit);
  }

  function lineName(id) {
    const m = /^(.+)-a(\d+)$/.exec(id);
    const names = LINES[m ? m[1] : id];
    if (!names) return id;
    if (!m) return names[0];
    const stage = names[Number(m[2])];
    return stage ? `${stage} ⚓` : id;
  }

  const bossName = id => BOSSES[id] ?? id;

  function guideFor(floor) {
    let from = 1;
    for (const g of GUIDE) {
      if (floor <= g.to) return { ...g, from };
      from = g.to + 1;
    }
    throw new RangeError(`étage invalide : ${floor}`);
  }

  function rateLevel(win) {
    if (win >= 70) return { cls: 'good', sym: '▲' };
    if (win < 40) return { cls: 'bad', sym: '▼' };
    return { cls: 'mid', sym: '●' };
  }

  const pct = x => `${x.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const shortDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return { API, SAVE_KEY, UI_KEY, GUIDE, GOLD_RULES, floorFromSave, isTowerData, lastBossFloor, nextBossStop, topCores, lineName, bossName, guideFor, rateLevel, pct, shortDate };
})();

const CSS = `
:host { all: initial; }
.kt { --kt-surface:#fff; --kt-surface-2:#eef1fa; --kt-text:#141a33; --kt-muted:#4a5378; --kt-border:#c9cfe6; --kt-control:#737c9c;
  --kt-focus:#0072b2; --kt-good-bg:#0072b2; --kt-good-fg:#fff; --kt-bad-bg:#f0e442; --kt-bad-fg:#141a33; --kt-mid-bg:#dfe3f2; --kt-mid-fg:#141a33;
  --kt-space-1:4px; --kt-space-2:8px; --kt-space-3:12px; --kt-space-4:16px; --kt-radius:12px; --kt-font:system-ui,-apple-system,"Segoe UI",sans-serif;
  position: fixed; z-index: 2147483647; width: 320px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; box-sizing: border-box;
  background: var(--kt-surface); color: var(--kt-text); border: 1px solid var(--kt-border); border-radius: var(--kt-radius);
  box-shadow: 0 8px 24px rgb(0 0 0 / .35); font: 14px/1.4 var(--kt-font); font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: dark) {
  .kt { --kt-surface:#141a33; --kt-surface-2:#1e2647; --kt-text:#eef1ff; --kt-muted:#aab3d6; --kt-border:#33406e; --kt-control:#7a86b8;
    --kt-focus:#56b4e9; --kt-good-bg:#56b4e9; --kt-good-fg:#141a33; --kt-mid-bg:#2c3660; --kt-mid-fg:#eef1ff; }
}
.kt * { box-sizing: border-box; }
.kt-bar { display: flex; align-items: center; gap: var(--kt-space-2); padding: var(--kt-space-2) var(--kt-space-3); background: var(--kt-surface-2); cursor: move; touch-action: none; user-select: none; }
.kt-title { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kt-src { font-size: 12px; color: var(--kt-muted); min-width: 6.5ch; text-align: center; }
.kt-btn { min-width: 28px; height: 28px; border: 1px solid var(--kt-control); border-radius: 8px; background: var(--kt-surface); color: var(--kt-text); font: inherit; cursor: pointer; }
.kt-floor { width: 56px; height: 28px; border: 1px solid var(--kt-control); border-radius: 8px; background: var(--kt-surface); color: var(--kt-text); font: inherit; text-align: center; }
.kt-floor.is-empty { border-color: var(--kt-focus); border-width: 2px; }
.kt-btn:focus-visible, .kt-floor:focus-visible, .kt a:focus-visible, .kt summary:focus-visible { outline: 2px solid var(--kt-focus); outline-offset: 2px; }
.kt-body { padding: var(--kt-space-3); display: grid; gap: var(--kt-space-3); }
.kt p { margin: 0; }
.kt-label { font-size: 12px; color: var(--kt-muted); }
.kt-boss { font-size: 18px; font-weight: 700; }
.kt-boss small { font-size: 14px; font-weight: 400; color: var(--kt-muted); }
.kt-stats { display: flex; flex-wrap: wrap; gap: var(--kt-space-2); align-items: center; font-size: 12px; color: var(--kt-muted); }
.kt-rate { display: inline-block; padding: 2px var(--kt-space-2); border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.kt-rate.good { background: var(--kt-good-bg); color: var(--kt-good-fg); }
.kt-rate.bad { background: var(--kt-bad-bg); color: var(--kt-bad-fg); }
.kt-rate.mid { background: var(--kt-mid-bg); color: var(--kt-mid-fg); }
.kt-cores { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--kt-space-1); }
.kt-cores li { display: grid; grid-template-columns: 1fr auto; gap: 0 var(--kt-space-2); padding: var(--kt-space-2); background: var(--kt-surface-2); border-radius: 8px; }
.kt-cores .n { grid-column: 1; font-size: 12px; color: var(--kt-muted); }
.kt-cores .kt-rate { grid-row: 1 / span 2; grid-column: 2; align-self: center; }
.kt-guide { border-top: 1px solid var(--kt-border); padding-top: var(--kt-space-2); }
.kt-guide summary { font-weight: 600; cursor: pointer; min-height: 24px; }
.kt-guide p, .kt-guide ul { margin: var(--kt-space-1) 0 0; font-size: 12px; }
.kt-guide ul { padding-left: var(--kt-space-4); }
.kt-msg { padding: var(--kt-space-2) var(--kt-space-3); border-radius: 8px; background: var(--kt-surface-2); }
.kt-msg strong { display: block; }
.kt-foot { padding: var(--kt-space-2) var(--kt-space-3); font-size: 12px; color: var(--kt-muted); border-top: 1px solid var(--kt-border); }
.kt-foot a { color: inherit; white-space: nowrap; }
.kt.is-collapsed .kt-body, .kt.is-collapsed .kt-foot { display: none; }
`;

function mount() {
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const ui = { x: null, y: 16, collapsed: false, guide: true, ...JSON.parse(localStorage.getItem(KT.UI_KEY) ?? '{}') };
  const state = { floor: null, source: 'manuel', lastRaw: undefined, lastAuto: null, data: null, error: null };

  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
<div class="kt" role="complementary" aria-label="Aide Tour Kanto Tactics">
  <div class="kt-bar">
    <span class="kt-title">Étage</span>
    <button class="kt-btn" data-act="dec" aria-label="Étage précédent">−</button>
    <input class="kt-floor" inputmode="numeric" aria-label="Étage courant" placeholder="?">
    <button class="kt-btn" data-act="inc" aria-label="Étage suivant">+</button>
    <span class="kt-src"></span>
    <button class="kt-btn" data-act="toggle"></button>
  </div>
  <div class="kt-body"></div>
  <div class="kt-foot"></div>
</div>`;
  document.body.append(host);
  const panel = root.querySelector('.kt');
  const input = root.querySelector('.kt-floor');
  const body = root.querySelector('.kt-body');
  const foot = root.querySelector('.kt-foot');
  const toggle = root.querySelector('[data-act="toggle"]');
  const src = root.querySelector('.kt-src');

  const saveUi = () => localStorage.setItem(KT.UI_KEY, JSON.stringify(ui));

  // Ancré à droite tant que le panneau n'a pas été déplacé, puis gardé dans la fenêtre.
  function place() {
    panel.style.top = `${Math.max(0, Math.min(ui.y, window.innerHeight - 40))}px`;
    if (ui.x === null) {
      panel.style.left = '';
      panel.style.right = '16px';
      return;
    }
    panel.style.right = 'auto';
    panel.style.left = `${Math.max(0, Math.min(ui.x, window.innerWidth - panel.offsetWidth))}px`;
  }

  function guideHtml(floor) {
    const g = KT.guideFor(floor);
    const range = g.to === Infinity ? `étages ${g.from} et plus` : `étages ${g.from}–${g.to}`;
    const shinies = g.shinies.length
      ? `Shinies à saisir : ${esc(g.shinies.join(', '))}. ${esc(g.advice)} (conseil non vérifié, effet sans doute cosmétique).`
      : esc(g.advice);
    return `<details class="kt-guide"${ui.guide ? ' open' : ''}><summary>Conseils du guide · ${range}</summary>
<p>${shinies}</p><ul>${KT.GOLD_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>`;
  }

  function contentHtml() {
    if (state.error) {
      const more = state.floor
        ? 'Les conseils du guide restent affichés ci-dessous.'
        : 'Saisis l’étage pour afficher les conseils du guide.';
      return `<p class="kt-msg" role="alert"><strong>Données indisponibles (${esc(state.error)})</strong>Réessaie en rechargeant la page dans quelques minutes. ${more}</p>${state.floor ? guideHtml(state.floor) : ''}`;
    }
    if (!state.data) return '<p class="kt-msg" role="status">Chargement des statistiques de la Tour…</p>';
    if (!state.floor) return '<p class="kt-msg"><strong>Aucune partie Tour en cours</strong>Lance une partie Tour, ou saisis l’étage dans le champ ci-dessus.</p>';
    const stop = KT.nextBossStop(state.data.stops, state.floor);
    if (!stop) {
      return `<p class="kt-msg"><strong>Aucun boss connu après l’étage ${KT.lastBossFloor(state.data.stops)}</strong>Les statistiques publiques s’arrêtent là.</p>`;
    }
    const dist = stop.floor - state.floor;
    const lvl = KT.rateLevel(stop.win);
    const cores = KT.topCores(state.data.cores, stop.stop);
    const coresHtml = cores.length
      ? `<ol class="kt-cores">${cores.map(c => {
        const l = KT.rateLevel(c.win);
        return `<li><span>${esc(c.core.map(KT.lineName).join(' · '))}</span><span class="kt-rate ${l.cls}">${l.sym} ${KT.pct(c.win)}</span><span class="n">${c.n} combats</span></li>`;
      }).join('')}</ol>`
      : '<p class="kt-msg">Aucun trio n’a encore 20 combats sur ce boss.</p>';
    return `<div><p class="kt-label">Prochain boss</p>
<p class="kt-boss">${esc(KT.bossName(stop.boss))} <small>· étage ${stop.floor}, ${dist ? `dans ${dist}` : 'en cours'}</small></p>
<p class="kt-stats"><span class="kt-rate ${lvl.cls}">${lvl.sym} ${KT.pct(stop.win)} victoires</span> 1er essai ${KT.pct(stop.first)} · ${stop.tries.toLocaleString('fr-FR')} essais</p></div>
<div><p class="kt-label">Meilleurs trios (≥ 20 combats)</p>${coresHtml}</div>${guideHtml(state.floor)}`;
  }

  function render() {
    panel.classList.toggle('is-collapsed', ui.collapsed);
    toggle.textContent = ui.collapsed ? '▸' : '▾';
    toggle.setAttribute('aria-label', ui.collapsed ? 'Déplier le panneau' : 'Replier le panneau');
    toggle.setAttribute('aria-expanded', String(!ui.collapsed));
    src.textContent = state.source;
    if (root.activeElement !== input) input.value = state.floor ?? '';
    input.classList.toggle('is-empty', !state.floor);
    body.innerHTML = contentHtml();
    foot.hidden = !state.data;
    if (state.data) {
      foot.innerHTML = `Du ${esc(KT.shortDate(state.data.from))} au ${esc(KT.shortDate(state.data.to))} · Data: <a href="https://einoow.com" target="_blank" rel="noopener">Kanto Tactics · einoow.com</a>`;
    }
    place();
  }

  function setManual(floor) {
    state.floor = Number.isInteger(floor) && floor >= 1 ? floor : null;
    state.source = 'manuel';
    render();
  }

  function pollSave() {
    const raw = localStorage.getItem(KT.SAVE_KEY);
    if (raw === state.lastRaw) return;
    state.lastRaw = raw;
    const f = KT.floorFromSave(raw);
    if (f === state.lastAuto) return;
    state.lastAuto = f;
    if (f !== null) {
      state.floor = f;
      state.source = 'auto';
    } else if (state.source === 'auto') {
      state.floor = null;
      state.source = 'manuel';
    }
    render();
  }

  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'dec') setManual(Math.max(1, (state.floor ?? 2) - 1));
    if (act === 'inc') setManual((state.floor ?? 0) + 1);
    if (act === 'toggle') {
      ui.collapsed = !ui.collapsed;
      saveUi();
      render();
    }
  });
  input.addEventListener('change', () => setManual(Number.parseInt(input.value, 10)));
  // Le Shadow DOM ne fait que recibler les événements : sans cet arrêt, les écouteurs du jeu en remontée recevraient
  // les chiffres tapés. Alt+K passe, pour replier le panneau depuis le champ.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    input.addEventListener(type, e => {
      if (!(e.altKey && e.code === 'KeyK')) e.stopPropagation();
    });
  }
  root.addEventListener('toggle', e => {
    if (!e.target.matches('.kt-guide') || ui.guide === e.target.open) return;
    ui.guide = e.target.open;
    saveUi();
  }, true);
  window.addEventListener('keydown', e => {
    if (!e.altKey || e.code !== 'KeyK') return;
    e.preventDefault();
    ui.collapsed = !ui.collapsed;
    saveUi();
    render();
  });
  window.addEventListener('resize', place);

  const bar = root.querySelector('.kt-bar');
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button, input')) return;
    const dx = e.clientX - panel.offsetLeft;
    const dy = e.clientY - panel.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      ui.x = ev.clientX - dx;
      ui.y = ev.clientY - dy;
      place();
    };
    bar.addEventListener('pointermove', move);
    // Fin du glisser, relâché ou annulé.
    bar.addEventListener('lostpointercapture', () => {
      bar.removeEventListener('pointermove', move);
      saveUi();
    }, { once: true });
  });
  // Alternative au glisser (WCAG 2.5.7) : double-clic sur la barre → panneau remis en haut à droite.
  bar.addEventListener('dblclick', e => {
    if (e.target.closest('button, input')) return;
    ui.x = null;
    ui.y = 16;
    saveUi();
    place();
  });

  render();
  pollSave();
  setInterval(pollSave, 2000);

  if (!navigator.onLine) {
    state.error = 'hors ligne';
    render();
    return;
  }
  fetch(KT.API)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json().catch(e => {
        if (e instanceof SyntaxError) throw new Error('format inattendu');
        throw e instanceof TypeError ? new Error('réseau') : e;
      });
    }, e => {
      // fetch ne rejette qu'avec TypeError en cas d'échec réseau.
      throw e instanceof TypeError ? new Error('réseau') : e;
    })
    .then(json => {
      if (!KT.isTowerData(json?.modes?.torre)) throw new Error('format inattendu');
      state.data = json.modes.torre;
      render();
    })
    .catch(err => {
      state.error = err.message;
      render();
    });
}

if (typeof module !== 'undefined') module.exports = KT;
else mount();
