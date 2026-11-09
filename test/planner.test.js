'use strict';
// Pilote du Planificateur joué sur un faux DOM qui reprend le comportement relevé dans le code du jeu (Planner-*.js, plans-*.js) :
// collage = nouveau plan actif et champ vidé, code invalide = .pln-err, au-delà de 10 plans par mode le plus ancien plan non
// actif est évincé, suppression sans confirmation, clic sur le voile = fermeture.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');

const CODE = 'KT1;r41;xm=tower;xn=Plan%20kanto-overlay;dratini:2:1';
let game;

class FakeInput {
  get value() { return this.raw; }
  set value(v) { this.raw = String(v); }
}

// Descripteurs plutôt que copie : isConnected et disabled restent des getters.
function el(props) {
  return Object.defineProperties({ querySelector: () => null, querySelectorAll: () => [], click() {} }, Object.getOwnPropertyDescriptors(props));
}

function fakeGame({ plans = [], active = null, hud = true, modal = false, layout = 'landscape', noDelete = false } = {}) {
  const g = { plans, active, open: false, opened: 0, typed: '', bad: false, focused: false };
  const field = Object.assign(Object.create(FakeInput.prototype), { raw: '', dispatchEvent: e => { if (e.type === 'input') g.typed = field.value; } });
  const paste = el({
    get disabled() { return !g.typed.trim(); },
    click() {
      if (!g.typed.startsWith('KT1;')) { g.bad = true; return; }
      const plan = { id: `p${g.plans.length}-${Date.now()}`, name: KT.PLAN_NAME };
      g.plans = [plan, ...g.plans];
      if (g.plans.length > 10) {
        const out = [...g.plans].reverse().find(p => p !== plan && p.id !== g.active);
        g.plans = g.plans.filter(p => p !== out);
      }
      g.active = plan.id;
      g.typed = '';
      field.raw = '';
    },
  });
  const item = plan => el({
    get isConnected() { return g.plans.includes(plan); },
    classList: { contains: c => c === 'on' && plan.id === g.active },
    querySelector: sel => (sel === '.pln-name' ? { textContent: plan.name }
      : sel === '.pln-btn.del' && !noDelete ? el({ click() { g.plans = g.plans.filter(p => p !== plan); } }) : null),
  });
  const veil = el({
    click() { g.open = false; },
    querySelector: sel => ({ '.pln-paste input': field, '.pln-paste button': paste, '.pln-err': g.bad ? el({}) : null })[sel] ?? null,
    querySelectorAll: sel => (sel === '.pln-list li' ? g.plans.map(item) : []),
  });
  // Ouverture au tick suivant, comme le rendu du module chargé à la demande.
  const chip = el({ click() { g.opened++; setTimeout(() => { g.open = true; }, 5); } });
  g.document = {
    documentElement: { dataset: { layout } },
    activeElement: { focus() { g.focused = true; } },
    querySelector: sel => ({
      '.topbar .rtrack.tw': hud ? el({}) : null,
      '.pln-inbar .pln-chip': chip,
      '.pln-veil': g.open ? veil : null,
      '.modal': modal ? el({}) : null,
    })[sel] ?? null,
  };
  return g;
}

function install(options) {
  game = fakeGame(options);
  globalThis.document = game.document;
  return game;
}

beforeEach(() => {
  globalThis.HTMLInputElement = FakeInput;
  globalThis.requestAnimationFrame = cb => setTimeout(cb, 0);
});

const playerPlans = n => Array.from({ length: n }, (_, i) => ({ id: `mine${i}`, name: `Plan ${i}` }));

test('planificateur : ancien plan du panneau supprimé avant le collage, aucun plan du joueur évincé à 10 plans', async () => {
  const mine = playerPlans(9);
  install({ plans: [{ id: 'old', name: KT.PLAN_NAME }, ...mine], active: 'old' });
  assert.equal(await KT.pastePlan(CODE), true);
  assert.deepEqual(game.plans.slice(1), mine);
  assert.equal(game.plans[0].name, KT.PLAN_NAME);
  assert.equal(game.active, game.plans[0].id);
  assert.equal(game.open, false);
  assert.equal(game.focused, true);
});

test('planificateur : code refusé → PlannerError, Planificateur refermé', async () => {
  install({ plans: playerPlans(2) });
  await assert.rejects(KT.pastePlan('pas un code'), e => e instanceof KT.PlannerError && e.message === 'code refusé par le jeu');
  assert.equal(game.open, false);
  assert.equal(game.plans.length, 2);
});

test('planificateur : bouton Supprimer absent → PlannerError, rien collé, Planificateur refermé', async () => {
  install({ plans: [{ id: 'old', name: KT.PLAN_NAME }], active: 'old', noDelete: true });
  await assert.rejects(KT.pastePlan(CODE), e => e instanceof KT.PlannerError && e.message === 'bouton Supprimer introuvable');
  assert.deepEqual(game.plans.map(p => p.id), ['old']);
  assert.equal(game.open, false);
});

test('planificateur : rien d’ouvert hors partie Tour, sous une modale, en portrait ou Planificateur déjà ouvert', async () => {
  for (const options of [{ hud: false }, { modal: true }, { layout: 'portrait' }]) {
    install(options);
    assert.equal(await KT.pastePlan(CODE), false);
    assert.equal(game.opened, 0);
  }
  install();
  game.open = true;
  assert.equal(await KT.pastePlan(CODE), false);
  assert.equal(game.opened, 0);
});

test('planificateur : statut du panneau', () => {
  install();
  const state = (planner, extra = {}) => ({ copied: null, advice: { code: CODE }, planner, ...extra });
  assert.match(KT.statusHtml(state({ code: CODE, error: null })), /Planificateur à jour : « Plan kanto-overlay » est le plan actif/);
  assert.match(KT.statusHtml(state({ code: CODE, error: 'code refusé par le jeu' })), /non mis à jour \(code refusé par le jeu\) : copie le code/);
  assert.equal(KT.statusHtml(state({ code: null, error: null })), '');
  assert.match(KT.statusHtml(state({ code: CODE, error: null }, { copied: { ok: true } })), /^Code copié/);
  install({ layout: 'portrait' });
  assert.match(KT.statusHtml(state({ code: null, error: null })), /non mis à jour en affichage portrait/);
});
