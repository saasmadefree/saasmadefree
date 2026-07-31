import { loadData } from './lib/load-data.mjs';

/**
 * Imprime la distribution réelle des verdicts, lue depuis data/tools/.
 *
 * Ce script existe parce que la distribution a été recopiée à la main dans
 * README.md et CONTRIBUTING.md, où elle a dérivé sans que rien ne le signale :
 * les documents annonçaient encore 30 % de "yes" sur un instantané de 125
 * fiches alors que le catalogue en comptait 240 et 16 %. Un annuaire dont
 * l'argument est l'honnêteté ne peut pas se permettre de publier un chiffre
 * faux sur lui-même — surtout faux dans le sens flatteur.
 *
 * Les documents renvoient donc vers `npm run stats` au lieu de citer un
 * nombre. Un chiffre qu'on calcule ne périme pas.
 */
const ORDER = ['yes', 'kinda', 'no'];

const data = await loadData(process.cwd());
const counts = new Map(ORDER.map((v) => [v, 0]));
for (const tool of data.tools.values()) {
  counts.set(tool.verdict, (counts.get(tool.verdict) ?? 0) + 1);
}

const total = data.tools.size;
const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 100));

console.log(`${total} fiche(s) publiée(s)\n`);
for (const verdict of ORDER) {
  const n = counts.get(verdict) ?? 0;
  console.log(`  ${verdict.padEnd(6)} ${String(n).padStart(4)}  ${String(pct(n)).padStart(3)} %`);
}

const langs = new Map();
for (const key of data.i18n.keys()) {
  const lang = key.split('/')[0];
  langs.set(lang, (langs.get(lang) ?? 0) + 1);
}
const byLang = [...langs].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(', ');
console.log(`\n${data.i18n.size} traduction(s) — ${byLang}`);
