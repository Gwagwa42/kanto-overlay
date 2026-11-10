'use strict';
// Aides communes aux tests : conseils d'une sauvegarde sur les fixtures data.json et lang.json, sans compo précédente,
// porteur à distance à gauche. extra porte au moins stats (mode de campana.json) et mode (modeContext de la partie).
const KT = require('../kanto-overlay.user.js');
const data = require('./fixtures/data.json');
const lang = require('./fixtures/lang.json');

const adviseOn = (save, extra) => KT.advise({ data, lang, save, previous: null, side: 'left', ...extra });

module.exports = { adviseOn };
