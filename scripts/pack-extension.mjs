import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const OUT_DIR = 'dist';
const ZIP_PATH = `${OUT_DIR}/extension.zip`;
const FIXED_MTIME = '202601010000.00';
const FIXED_MODE = 0o644;

mkdirSync(OUT_DIR, { recursive: true });

// zip AJOUTE à une archive existante. Sans cette suppression, un fichier renommé
// laisse son ancienne entrée : l'archive ne correspond plus au source, sans erreur.
rmSync(ZIP_PATH, { force: true });

// Exclut tout composant de chemin commençant par un point, à n'importe quelle
// profondeur : un .DS_Store dans extension/icons/ entrerait sinon dans l'archive.
const files = execFileSync('find', ['.', '-type', 'f', '-not', '-path', '*/.*'], {
  cwd: 'extension', encoding: 'utf8',
}).split('\n').filter(Boolean).sort();

if (files.length === 0) {
  throw new Error('Aucun fichier à empaqueter dans extension/');
}

// Normaliser l'horodatage ET les permissions. -X ne retire pas les bits de mode :
// deux machines aux umask différents produiraient des archives différentes à
// source identique, ce qui viderait de sens la vérification de SHA-256 publiée.
for (const file of files) {
  chmodSync(join('extension', file), FIXED_MODE);
  execFileSync('touch', ['-t', FIXED_MTIME, file], { cwd: 'extension' });
}

// Liste passée par stdin : aucune commande shell construite, donc aucun risque
// de métacaractère dans un nom de fichier.
execFileSync('zip', ['-X', '-q', '-@', join('..', ZIP_PATH)], {
  cwd: 'extension',
  input: files.join('\n') + '\n',
});

const sha = createHash('sha256').update(readFileSync(ZIP_PATH)).digest('hex');
writeFileSync(`${ZIP_PATH}.sha256`, `${sha}  extension.zip\n`, 'utf8');

console.log(`${ZIP_PATH}\nSHA-256 ${sha}`);
