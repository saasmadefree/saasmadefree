import { loadData, compileValidators } from './lib/load-data.mjs';
import { validateAll } from './lib/validate-rules.mjs';

const today = new Date().toISOString().slice(0, 10);
const data = await loadData(process.cwd());
const validators = compileValidators('schema');
const errors = validateAll(data, validators, today);

if (errors.length > 0) {
  console.error(`${errors.length} problème(s) détecté(s) :\n`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`${data.tools.size} fiche(s), ${data.i18n.size} traduction(s), ${data.agents.length} agent(s) — tout est valide.`);
