import { describe, it, expect } from 'vitest';
import { AI_REFERRER_LABELS, REFERRER_LABELS } from '../src/ai-bots.mjs';
import { AI_REFERRERS, OTHER_REFERRERS } from '../../scripts/lib/site-beacon.mjs';

// Le client mappe les referrers vers des labels ; le worker valide leur
// appartenance à un Set. Deux fichiers, une seule vérité : ce test échoue si
// on ajoute un label d'un côté sans l'autre.
describe('parité des labels client/worker', () => {
  it('les labels IA du client sont exactement AI_REFERRER_LABELS', () => {
    expect(new Set(AI_REFERRERS.map((r) => r.label))).toEqual(AI_REFERRER_LABELS);
  });
  it('tout label du client est accepté par le worker', () => {
    for (const { label } of [...AI_REFERRERS, ...OTHER_REFERRERS]) {
      expect(REFERRER_LABELS.has(label), label).toBe(true);
    }
  });
});
