import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT_DIR = 'dist';
const ZIP_PATH = `${OUT_DIR}/extension.zip`;
const FIXED_MTIME = '202601010000.00';

mkdirSync(OUT_DIR, { recursive: true });

// 1. Normaliser les horodatages : le ZIP les stocke, ils casseraient la reproductibilité.
const files = execFileSync('find', ['.', '-type', 'f', '-not', '-path', './.*'], {
  cwd: 'extension', encoding: 'utf8',
}).split('\n').filter(Boolean).sort();

for (const file of files) {
  execFileSync('touch', ['-t', FIXED_MTIME, file], { cwd: 'extension' });
}

// 2. Empaqueter dans un ordre déterministe. -X retire les métadonnées de plateforme.
// Chaque nom de fichier est protégé par des quotes simples ; les quotes simples
// éventuellement présentes dans un nom sont échappées pour ne pas casser la commande shell.
const quote = (f) => `'${f.replace(/'/g, `'\\''`)}'`;
execFileSync('sh', ['-c', `printf '%s\\n' ${files.map(quote).join(' ')} | zip -X -q -@ ../${ZIP_PATH}`], {
  cwd: 'extension',
});

const sha = createHash('sha256').update(readFileSync(ZIP_PATH)).digest('hex');
writeFileSync(`${ZIP_PATH}.sha256`, `${sha}  extension.zip\n`, 'utf8');

console.log(`${ZIP_PATH}\nSHA-256 ${sha}`);
