'use strict';
// Logique d'événements du panneau, isolée de mount : onglets au clavier, touches gardées, sections repliables, menu d'options.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const KT = require('../kanto-overlay.user.js');

test('onglets au clavier : flèches en boucle, Début, Fin, autre touche ignorée', () => {
  assert.equal(KT.tabForKey('ArrowRight', 'tour'), 'compo');
  assert.equal(KT.tabForKey('ArrowLeft', 'tour'), 'rules');
  assert.equal(KT.tabForKey('ArrowRight', 'rules'), 'tour');
  assert.equal(KT.tabForKey('Home', 'boss'), 'tour');
  assert.equal(KT.tabForKey('End', 'tour'), 'rules');
  assert.equal(KT.tabForKey('Enter', 'tour'), undefined);
});

test('touches gardées : tout dans un champ sauf Alt+K, seules les touches d’onglet sur un onglet', () => {
  const key = (k, extra = {}) => ({ key: k, code: `Key${k.toUpperCase()}`, altKey: false, ...extra });
  assert.equal(KT.keptByPanel('input', key('5')), true);
  assert.equal(KT.keptByPanel('input', key('k', { altKey: true })), false);
  assert.equal(KT.keptByPanel('tab', key('ArrowLeft')), true);
  assert.equal(KT.keptByPanel('tab', key('Escape')), false);
  assert.equal(KT.keptByPanel(null, key('ArrowLeft')), false);
});

test('sections repliables : classe → clé de l’état gardé', () => {
  const classes = (...list) => ({ contains: c => list.includes(c) });
  assert.equal(KT.foldKey(classes('kt-avoid')), 'avoid');
  assert.equal(KT.foldKey(classes('kt-aims', 'x')), 'aims');
  assert.equal(KT.foldKey(classes('kt-todo')), undefined);
  assert.equal(KT.foldKey(undefined), undefined);
});

test('assassins adverses : case par combat, parade posée ou raison de son absence', () => {
  const names = { line: id => ({ geodude: 'Racaillou', abra: 'Abra' }[id]) };
  const off = KT.diveHtml({ advice: { dive: false, guard: null, names } });
  assert.match(off, /<input type="checkbox" name="dive" id="kt-dive" aria-describedby="kt-dive-note"><span>Assassins adverses : Insécateur, Doduo, Abo, Nosferapti/);
  assert.match(off, /Coche si l’adversaire en aligne/);
  const on = KT.diveHtml({ advice: { dive: true, guard: { bait: 'geodude', carry: 'abra' }, names } });
  assert.match(on, /name="dive" id="kt-dive" aria-describedby="kt-dive-note" checked>/);
  assert.match(on, /Appât au fond : Racaillou\. Porteur couvert : Abra\./);
  // La case ne vaut que pour le combat où elle a été cochée : même sauvegarde, même partie, même étage.
  const fight = { saveKey: 'kanto-tactics-save', save: { runSeed: 7 }, floor: 12 };
  const ui = { dive: KT.fightKey(fight) };
  assert.equal(KT.diveOn(ui, fight), true);
  assert.equal(KT.diveOn(ui, { ...fight, floor: 13 }), false);
  assert.equal(KT.diveOn(ui, { ...fight, save: { runSeed: 8 } }), false);
  assert.equal(KT.diveOn(ui, { ...fight, saveKey: 'kanto-tactics-save-tower' }), false);
  assert.equal(KT.diveOn({ dive: null }, fight), false);
  // Sauvegarde de Tour sans runSeed : l'étage seul.
  assert.equal(KT.fightKey({ saveKey: 'kanto-tactics-save-tower', save: {}, floor: 57 }), 'kanto-tactics-save-tower::57');
  assert.match(KT.diveHtml({ advice: { dive: true, guard: null, names } }), /Pas de parade/);
});

test('menu d’options : bouton radio, case de pastille, rendu dans l’ordre de la table', () => {
  const ui = { theme: 'auto', pins: { do: true, opt: true, no: true } };
  KT.checkUi(ui);
  KT.setOption(ui, { name: 'theme', value: 'dark', checked: true });
  KT.setOption(ui, { name: 'pins', value: 'no', checked: false });
  assert.deepEqual([ui.theme, ui.pins], ['dark', { do: true, opt: true, no: false }]);
  const legends = [...KT.optionsHtml(ui).matchAll(/<legend>([^<]+)<\/legend>/g)].map(m => m[1]);
  assert.deepEqual(legends, KT.OPTIONS.map(o => o.label));
  assert.match(KT.optionsHtml(ui), /name="pins" value="no"><span>✕ Éviter/);
  // Préréglages de stratégie sous leur titre, après les options d'affichage.
  assert.match(KT.optionsHtml(ui), /Porteur à distance \(formation\)<\/legend>.*<h2>Stratégie<\/h2><fieldset><legend>Niveaux visés<\/legend>/s);
  assert.match(KT.optionsHtml(ui), /name="allIn" value="normal" checked><span>Normal/);
  // Pastilles absentes ou partielles du stockage : cochées par défaut.
  const old = { pins: { opt: false } };
  KT.checkUi(old);
  assert.deepEqual(old.pins, { do: true, opt: false, no: true });
  // Valeur non booléenne ou niveau inconnu (stockage modifié à la main) : ramenés aux défauts.
  const odd = { pins: { do: 'false', x: 1 } };
  KT.checkUi(odd);
  assert.deepEqual(odd.pins, { do: true, opt: true, no: true });
});
