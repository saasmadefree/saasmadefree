import { escapeHtml } from './site-html.mjs';

// Newsletter SmartLetter (spec D13, Task A9).
//
// Le formulaire poste directement depuis le navigateur vers l'API SmartLetter
// (service du propriétaire, dépôt lead-magnet), et SEULEMENT à l'envoi : rien
// ne part au chargement de la page. Pas de proxy par notre Worker : toutes les
// inscriptions arriveraient de la même IP, et la limite de SmartLetter
// (5 inscriptions par IP et par 10 minutes) deviendrait globale.
//
// Sans clé au build, aucun formulaire n'est rendu, ni enveloppe vide : jamais
// un formulaire mort.

export const SMARTLETTER_SIGNUPS_URL = 'https://api.smartletter.ai/signups';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Configuration lue dans l'environnement du build : `SMARTLETTER_SIGNUPS_KEY`
 * (clé de type `signups`) et `SMARTLETTER_SEGMENT_ID` (optionnel, UUID).
 *
 * La clé finit en clair dans le HTML public (attribut data-key) : c'est voulu
 * et sans risque, une clé `signups` est publique par conception — elle ne sait
 * qu'inscrire une adresse en double opt-in, rien d'autre. Elle n'est pour
 * autant jamais journalisée, ni ici ni dans les messages d'erreur.
 *
 * Un segment mal formé fait échouer le build : sinon chaque inscription
 * reviendrait en 422, sans que personne ne s'en aperçoive.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{key: string, segmentId: string|null}|null} null sans clé
 */
export function newsletterConfig(env = process.env) {
  const key = (env.SMARTLETTER_SIGNUPS_KEY ?? '').trim();
  if (!key) return null;
  const segmentId = (env.SMARTLETTER_SEGMENT_ID ?? '').trim() || null;
  if (segmentId && !UUID.test(segmentId)) {
    throw new Error('SMARTLETTER_SEGMENT_ID doit être un UUID (segment SmartLetter), ou rester vide.');
  }
  return { key, segmentId };
}

/**
 * Le formulaire d'inscription, en deux variantes : `hero` (accueil, sous le
 * sous-titre : promesse puis formulaire) et `footer` (bas de fiche : une
 * section discrète dont la promesse est le titre). Balisage de la maquette
 * direction-3-airy (form.newsletter[data-newsletter], .nl-row, .nl-note,
 * .newsletter-status).
 *
 * `action="#"` : sans JavaScript, rien ne part vers SmartLetter (l'envoi
 * natif d'un formulaire ne porte pas la clé Bearer et finirait sur une page
 * d'erreur de l'API). Seul site.js envoie, en JSON.
 *
 * Pas de `novalidate` : le navigateur valide l'adresse avant tout envoi
 * (required, type=email, 320 caractères au plus comme l'API). Les messages
 * d'état voyagent en data-msg-* ; scripts/assets/site.js les lit et n'écrit
 * que du texte.
 *
 * @param {object} opts
 * @param {string} opts.lang
 * @param {object} opts.ui - table de traduction de la langue (ui.site.newsletter)
 * @param {{key: string, segmentId: string|null}|null} opts.config - newsletterConfig()
 * @param {'hero'|'footer'} opts.variant
 * @returns {string} '' sans configuration, ou si la langue n'a pas encore ses textes
 */
export function renderNewsletterForm({ lang, ui, config, variant }) {
  const n = ui?.site?.newsletter;
  if (!config || !n) return '';
  const id = `nl-email-${variant}`;
  const segment = config.segmentId ? ` data-segment="${escapeHtml(config.segmentId)}"` : '';

  const form = (indent) => `<form class="newsletter" data-newsletter action="#" method="post"
${indent}  data-endpoint="${SMARTLETTER_SIGNUPS_URL}" data-key="${escapeHtml(config.key)}" data-lang="${escapeHtml(lang)}"${segment}
${indent}  data-msg-confirm="${escapeHtml(n.confirmInbox)}" data-msg-rate="${escapeHtml(n.rateLimited)}"
${indent}  data-wait-one="${escapeHtml(n.waitOne)}" data-wait-other="${escapeHtml(n.waitOther)}" data-wait-unknown="${escapeHtml(n.waitUnknown)}"
${indent}  data-msg-invalid="${escapeHtml(n.invalidEmail)}" data-msg-retry="${escapeHtml(n.tryAgain)}">
${indent}  <label for="${id}" class="visually-hidden">${escapeHtml(n.label)}</label>
${indent}  <div class="nl-row">
${indent}    <input type="email" id="${id}" name="email" required maxlength="320" autocomplete="email" placeholder="${escapeHtml(n.placeholder)}">
${indent}    <button type="submit">${escapeHtml(n.submit)}</button>
${indent}  </div>
${indent}  <p class="nl-note">${escapeHtml(n.note)}</p>
${indent}  <p class="newsletter-status" role="status" aria-live="polite"></p>
${indent}</form>`;

  if (variant === 'hero') {
    return `<p class="nl-lead">${escapeHtml(n.promise)}</p>
      ${form('      ')}`;
  }
  return `    <section class="nl-block" aria-labelledby="nl-heading">
      <h2 id="nl-heading" class="nl-h">${escapeHtml(n.promise)}</h2>
      ${form('      ')}
    </section>`;
}
