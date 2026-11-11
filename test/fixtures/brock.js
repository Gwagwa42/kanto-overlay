'use strict';
// Statistiques de la Tour réduites à des combats contre Pierre à 50 % de victoires, et parties jouées contre lui, communes aux
// tests et aux pages d'aperçu.
const { torre } = require('./campana.json').modes;
const save = require('./save-tower.json');

const brockStop = floor => ({ stop: `${floor}:brock`, n: 100, win: 50, lo: 45, first: 50, tries: 2 });
// Pierre à l'étage 10 ; trio noté contre lui (50 combats, 90 %), de borne basse lo.
const BROCK = [brockStop(10)];
const brockCore = (core, lo = 80) => ({ stop: BROCK[0].stop, core, n: 50, win: 90, lo });
const brockStats = (cores, extra = {}) => ({ ...torre, stops: BROCK, cores, ...extra });
// Étages 10 à 27 : la compo cible se joue sur 10–18 (trio Abra + Onix + Nosferapti), la compo suivante sur 19–27 (later :
// [trio, borne basse]).
const twoWindows = later => {
  const stops = Array.from({ length: 18 }, (_, i) => brockStop(10 + i));
  const cores = stops.flatMap((s, i) => (i < 9
    ? [{ stop: s.stop, core: ['abra', 'onix', 'zubat'], n: 50, win: 90, lo: 80 }]
    : later.map(([core, lo]) => ({ stop: s.stop, core, n: 50, win: 90, lo }))));
  return { ...torre, stops, cores };
};

// Partie à l'étage 10 : niveau 3, boutique, plateau et sac vides, sauf ce que game précise.
const brockSave = game => ({ ...save, round: 1009, level: 3, shop: [], board: {}, items: [], ...game });
// Unités possédées : stars, lignée → étoile de l'unité, qui prend la lignée pour identifiant ; hors de board, elle est au banc.
const ownedGame = (stars, board = {}) => ({
  board, bench: Object.keys(stars).filter(id => !Object.values(board).includes(id)),
  units: Object.fromEntries(Object.entries(stars).map(([line, star]) => [line, { id: line, line, star }])),
});
// Partie de graine 7 (runSeed) à l'étage 10, niveau 3, sans unité ni boutique ; le sac reste celui de la sauvegarde.
const EMPTY10 = { ...save, round: 1009, level: 3, units: {}, board: {}, bench: [], shop: [], runSeed: 7 };
// Même partie à l'étage 5, niveau 4 : trio Abra + Onix + Nosferapti à trouver (twoWindows), Abo ★ pour seul complément ;
// Chenipan et Roucool ne servent que la compo des étages 19–27.
const NEXT_SHOP = {
  ...EMPTY10, round: 1004, level: 4, xp: 0, units: { e: { id: 'e', line: 'ekans', star: 1 } }, bench: ['e'],
  shop: ['caterpie', 'pidgey', 'ekans', null, null],
};

module.exports = { brockStop, BROCK, brockCore, brockStats, twoWindows, brockSave, ownedGame, EMPTY10, NEXT_SHOP };
