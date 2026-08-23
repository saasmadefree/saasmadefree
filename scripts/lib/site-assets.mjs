// Les quatre assets partagés du site et leur URL versionnée par empreinte.
//
// Pages sert /assets/* avec `max-age=14400` et les pages HTML avec
// `max-age=0, must-revalidate`. Tant que les assets vivaient à un chemin
// fixe, un visiteur revenu dans les quatre heures d'un déploiement recevait
// le HTML neuf habillé de la feuille de style précédente : le 23.08.2026 la
// page /stats refaite s'est affichée en tuiles empilées, avec le graphe
// d'avant. L'empreinte dans le chemin clôt le sujet — un contenu qui change
// est une URL nouvelle, que le HTML toujours revalidé ne peut manquer, et
// public/_headers peut mettre /assets/v/* en cache un an, immuable.
//
// Une seule version pour les quatre fichiers, pas une par fichier : un
// déploiement qui touche site.css renouvelle aussi l'URL de stats.js, ce qui
// coûte trois petits téléchargements et épargne quatre dossiers à tenir. Le
// contenu est lu ICI, et build-site.mjs écrit exactement ce tableau : la
// version est calculée sur ce qui part en production, jamais sur autre chose.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SITE_CSS } from './site-styles.mjs';
import { renderBeaconScript } from './site-beacon.mjs';

const read = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8');

// Chart.js (MIT, voir NOTICE) est copié tel quel depuis node_modules : une
// bibliothèque se sert depuis notre origine comme une police, jamais depuis
// un CDN (principe 4). Seule la page /stats la charge, et seulement avant
// stats.js — les autres pages n'en paient pas un octet.
const vendor = (path) => readFileSync(new URL(`../../node_modules/${path}`, import.meta.url), 'utf8');

export const ASSET_FILES = Object.freeze({
  'site.css': SITE_CSS,
  'site.js': read('site.js'),
  'stats.js': read('stats.js'),
  'beacon.js': renderBeaconScript(),
  'chart.umd.js': vendor('chart.js/dist/chart.umd.js'),
});

export const ASSET_VERSION = createHash('sha256')
  .update(Object.entries(ASSET_FILES).map(([name, text]) => `${name}\0${text}`).join('\0'))
  .digest('hex')
  .slice(0, 10);

export const ASSET_DIR = `/assets/v/${ASSET_VERSION}`;

export function assetUrl(name) {
  if (!(name in ASSET_FILES)) throw new Error(`asset inconnu : ${name} (voir ASSET_FILES dans site-assets.mjs)`);
  return `${ASSET_DIR}/${name}`;
}
