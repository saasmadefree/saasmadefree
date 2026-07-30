import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGS } from '../scripts/lib/load-data.mjs';

// Contrat décrit dans CONTRIBUTING.md ("Adding an agent to the registry") :
// Chrome n'accepte, dans un nom de message _locales, que [A-Za-z0-9_@]
// (extensions/common/message_bundle.cc::IsValidName côté navigateur). Une
// seule clé hors de ce format ne fait pas juste échouer CETTE clé : elle fait
// échouer le chargement de tout le bundle de messages pour cette langue, en
// silence. `data/agents.json`, lui, autorise des runHint en kebab-case
// (`^[a-z0-9-]+$`), convertis au point d'usage par le popup
// (`agent.runHint.replace(/-/g, '_')`) — donc le tiret doit toujours être
// traduit en underscore avant d'atteindre `_locales`. C'est déjà venu à un
// commit de livrer une régression sur ce point précis ; ces deux vérifications
// remplacent la prose de CONTRIBUTING.md par un échec de test nommant
// précisément la clé et la langue fautives.

const MESSAGE_KEY_RE = /^[A-Za-z0-9_@]+$/;

function readMessages(lang) {
  const path = join('extension', '_locales', lang, 'messages.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('extension/_locales — noms de clés valides pour Chrome', () => {
  for (const lang of LANGS) {
    it(`toutes les clés de ${lang}/messages.json respectent ^[A-Za-z0-9_@]+$`, () => {
      const messages = readMessages(lang);
      const badKeys = Object.keys(messages).filter((key) => !MESSAGE_KEY_RE.test(key));
      expect(
        badKeys,
        `clé(s) de message invalide(s) dans extension/_locales/${lang}/messages.json : ` +
          `${badKeys.join(', ') || '(aucune)'} — Chrome refuserait de charger tout le bundle de cette langue.`
      ).toEqual([]);
    });
  }
});

describe('extension/_locales — chaque runHint de data/agents.json est traduit', () => {
  const agents = JSON.parse(readFileSync('data/agents.json', 'utf8'));
  const runHints = [...new Set(agents.map((agent) => agent.runHint))];

  for (const runHint of runHints) {
    const key = `runHint_${runHint.replace(/-/g, '_')}`;
    for (const lang of LANGS) {
      it(`extension/_locales/${lang}/messages.json a la clé "${key}" (runHint "${runHint}")`, () => {
        const messages = readMessages(lang);
        expect(
          Object.prototype.hasOwnProperty.call(messages, key),
          `clé manquante "${key}" dans extension/_locales/${lang}/messages.json — ` +
            `requise par le runHint "${runHint}" de data/agents.json.`
        ).toBe(true);
      });
    }
  }
});
