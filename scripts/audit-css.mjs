// Inventaire croisé du CSS et du HTML généré.
//
// Le seul juge de « cette règle sert-elle encore ? » est dist/, pas la
// mémoire. Le script lit toutes les classes réellement émises par le site,
// toutes celles déclarées par la feuille, et rend les deux écarts :
//
//   MORTES   — déclarées dans SITE_CSS, jamais posées sur un élément.
//              Elles pèsent sur le budget et, pire, elles restent dans la
//              cascade : c'est ce qui a fait écraser .vb-* par .verdict-chip.
//   NUES     — posées dans le balisage, jamais déclarées. Un élément sans
//              style, qu'aucun test ne voit passer.
//
// Usage :  node scripts/audit-css.mjs           (résumé)
//          node scripts/audit-css.mjs --list    (toutes les classes)

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { SITE_CSS } from './lib/site-styles.mjs';

const OUT = 'dist';

/** Les classes qu'un fichier HTML pose réellement sur des éléments. */
function classesInHtml(html) {
  const found = new Set();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const cls of m[1].trim().split(/\s+/)) if (cls) found.add(cls);
  }
  return found;
}

/** Les classes que la feuille déclare comme cible d'au moins une règle.
 *
 *  On ne lit QUE le texte des sélecteurs — la portion avant chaque `{`. Lire
 *  la feuille entière ferait passer `url(/fonts/bricolage-grotesque-latin.woff2)` pour une
 *  classe `woff2`, et le `.5rem` d'une déclaration pour une classe `5rem`.
 *
 *  Les @keyframes sont retirés d'abord : `from`, `to` et les pourcentages ne
 *  sont pas des sélecteurs, et le corps d'une frame ressemble à une règle. */
function classesInCss(css) {
  // Les commentaires d'abord : cette feuille est très commentée, et ses
  // commentaires citent des chemins (`site-styles.test.mjs`, `.impeccable.md`)
  // et du code (`row.querySelector('.badge')`). Lus comme des sélecteurs, ils
  // inventaient des classes `mjs`, `md`, `querySelector` — du bruit qui
  // décrédibilise le rapport.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutFrames = withoutComments.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const found = new Set();
  for (const rule of withoutFrames.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selectors = rule[1];
    // Toutes les classes du sélecteur, y compris CHAÎNÉES : `.badge.yes`
    // déclare `badge` ET `yes`. Une regex qui exige un séparateur avant le
    // point ratait la seconde, et le rapport annonçait `yes` comme non
    // stylée alors qu'elle l'est.
    for (const m of selectors.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) found.add(m[1]);
  }
  return found;
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (extname(entry.name) === '.html') yield path;
  }
}

const used = new Set();
let pages = 0;
let toolPages = 0;
const TOOL_SAMPLE = 40;
for await (const file of htmlFiles(OUT)) {
  const isTool = /[\\/]tools[\\/]/.test(file);
  // Les 530 fiches sortent du même gabarit : un échantillon suffit. Mais il
  // doit être compté À PART — un compteur global commun sautait la totalité
  // des fiches dès que les autres pages l'avaient épuisé, et le rapport
  // déclarait mortes toutes les classes de la fiche outil.
  if (isTool) {
    if (toolPages >= TOOL_SAMPLE) continue;
    toolPages += 1;
  }
  for (const cls of classesInHtml(await readFile(file, 'utf8'))) used.add(cls);
  pages += 1;
}

// Troisième source, indispensable : les scripts client. Le volet de
// recherche, les graphiques de /stats et le rafraîchissement des votes créent
// leurs éléments à l'exécution — leurs classes n'apparaissent dans AUCUN
// fichier de dist/. Sans cette passe, le rapport les déclarait mortes et
// aurait conduit à supprimer des styles bel et bien utilisés.
const CLIENT_SCRIPTS = ['scripts/assets/site.js', 'scripts/assets/stats.js'];
let clientSource = '';
for (const path of CLIENT_SCRIPTS) clientSource += await readFile(path, 'utf8');
const usedByScript = new Set(
  [...clientSource.matchAll(/[-\w]+/g)].map((m) => m[0])
);

// Quatrième source : les gabarits eux-mêmes. Une classe peut n'être émise que
// sous condition — `recap-unavailable` quand le service de vote est muet,
// `sp-tape-tagline` quand une place est occupée. Absente de CE build ne veut
// pas dire morte. Si un gabarit sait l'écrire, elle vit.
const libDir = 'scripts/lib';
let templateSource = '';
for (const entry of await readdir(libDir)) {
  if (extname(entry) === '.mjs') templateSource += await readFile(join(libDir, entry), 'utf8');
}
// On ne retient que ce qui est écrit DANS un attribut class="…" : citer une
// classe dans un commentaire ne la rend pas vivante — c'est ce commentaire-ci
// qui en est la preuve.
const usedByTemplate = new Set();
for (const m of templateSource.matchAll(/class="([^"]*)"/g)) {
  for (const cls of m[1].split(/[\s${}()?:'`+]+/)) if (/^-?[_a-zA-Z][\w-]*$/.test(cls)) usedByTemplate.add(cls);
}

const declared = classesInCss(SITE_CSS);
const dead = [...declared]
  .filter((c) => !used.has(c) && !usedByScript.has(c) && !usedByTemplate.has(c))
  .sort();
const bare = [...used].filter((c) => !declared.has(c)).sort();

// Le défaut qui coûte le plus cher sur cette feuille : le MÊME sélecteur
// déclaré deux fois, à deux endroits. La seconde règle gagne en silence, et
// on passe une demi-heure à se demander pourquoi un réglage n'a pas d'effet.
// C'est la signature d'une feuille qui a changé de direction en route :
// `.hero-rot{justify-items:end}`, reliquat d'un correctif, écrasait
// `justify-items:center` posé plus haut.
//
// On signale aussi la même propriété déclarée deux fois dans UNE règle : même
// symptôme, même cause.
function selectorClashes(css) {
  const src = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

  // On marche les accolades pour connaître le CONTEXTE de chaque règle.
  // Sans lui, `.sp-rail` déclarée à la racine puis redéclarée dans une media
  // query passait pour un doublon — c'est au contraire du CSS correct. Le
  // vrai défaut, c'est le même sélecteur deux fois dans LE MÊME contexte :
  // là, la seconde règle gagne sans que personne l'ait décidé.
  const seen = new Map();
  const dupProps = [];
  const stack = [];
  let i = 0;
  let prelude = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      const head = prelude.trim().replace(/\s+/g, ' ');
      prelude = '';
      if (head.startsWith('@')) {
        stack.push(head);
        i += 1;
        continue;
      }
      // Règle ordinaire : on avale son corps jusqu'à l'accolade fermante.
      const end = src.indexOf('}', i);
      const body = src.slice(i + 1, end === -1 ? src.length : end);
      const key = `${stack.join(' ▸ ')}${stack.length ? ' ▸ ' : ''}${head}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      const props = [...body.matchAll(/(?:^|;)\s*([-a-z]+)\s*:/g)].map((m) => m[1]);
      const twice = props.filter((p, n) => props.indexOf(p) !== n);
      if (twice.length) dupProps.push(`${head} → ${[...new Set(twice)].join(', ')}`);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (ch === '}') { stack.pop(); prelude = ''; i += 1; continue; }
    prelude += ch;
    i += 1;
  }
  return {
    duplicated: [...seen].filter(([, n]) => n > 1).map(([sel, n]) => `${sel} (×${n})`),
    dupProps,
  };
}

const { duplicated, dupProps } = selectorClashes(SITE_CSS);

const list = process.argv.includes('--list');
console.log(`${pages} page(s) lues — ${used.size} classe(s) posées, ${declared.size} déclarées.`);
console.log(`\nMORTES (déclarées, jamais posées) : ${dead.length}`);
if (dead.length) console.log('  ' + (list ? dead.join('\n  ') : dead.join(', ')));
console.log(`\nNUES (posées, jamais déclarées) : ${bare.length}`);
if (bare.length) console.log('  ' + (list ? bare.join('\n  ') : bare.join(', ')));

console.log(`\nSÉLECTEURS EN DOUBLE (la seconde règle gagne en silence) : ${duplicated.length}`);
if (duplicated.length) console.log('  ' + duplicated.join('\n  '));
console.log(`\nPROPRIÉTÉ DÉCLARÉE DEUX FOIS DANS UNE RÈGLE : ${dupProps.length}`);
if (dupProps.length) console.log('  ' + dupProps.join('\n  '));

console.log(`\nFeuille : ${(Buffer.byteLength(SITE_CSS, 'utf8') / 1024).toFixed(1)} Ko`);
