'use strict';
// Statistiques de la Tour réduites à des combats contre Pierre à 50 % de victoires, communes aux tests et aux pages d'aperçu.
const { torre } = require('./campana.json').modes;

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

module.exports = { brockStop, BROCK, brockCore, brockStats, twoWindows };
