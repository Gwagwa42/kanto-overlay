'use strict';
// Scénario commun aux tests et aux pages d'aperçu (maquette 2026-11-05-conseils) : étage 57, 38 pièces, niveau 8,
// Minidraco 2★ et Goupix 2★ posés, 2 Caninos et 1 Rattata sur le banc.
const save = require('./save-tower.json');

module.exports = {
  ...save, round: 1056, gold: 38, level: 8, xp: 35, hp: 62, items: ['hp-up', 'iron', 'calcium'],
  shop: ['growlithe', 'aerodactyl', 'magmar', 'rattata', 'ekans'], shopShiny: [false, false, false, false, false],
  units: {
    a: { id: 'a', line: 'dratini', star: 2 }, b: { id: 'b', line: 'growlithe', star: 1 }, c: { id: 'c', line: 'growlithe', star: 1 },
    d: { id: 'd', line: 'vulpix', star: 2 }, e: { id: 'e', line: 'rattata', star: 1 },
  },
  board: { 29: 'a', 31: 'd' }, bench: ['b', 'c', 'e', null, null, null, null, null, null], anchor: {},
  tower: { boons: ['nugget'], offer: null },
};
