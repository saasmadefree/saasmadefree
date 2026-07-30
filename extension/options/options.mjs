import { renderTemplate } from '../lib/template.mjs';

const t = (key) => chrome.i18n.getMessage(key);
const $ = (id) => document.getElementById(id);

function applyStaticLabels() {
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
}

// Restaure ce qui a déjà été enregistré, pour que rouvrir la page d'options
// ne présente jamais un formulaire vide alors qu'un agent perso est déjà actif.
async function restoreSaved(form) {
  const stored = await chrome.storage.local.get(['lang', 'customAgent']);
  $('lang').value = stored.lang ?? 'auto';
  if (stored.customAgent) {
    form.elements.name.value = stored.customAgent.name ?? '';
    form.elements.template.value = stored.customAgent.template ?? '';
  }
}

async function main() {
  applyStaticLabels();

  const form = $('custom-agent');
  const status = $('status');

  await restoreSaved(form);

  $('lang').addEventListener('change', async (event) => {
    await chrome.storage.local.set({ lang: event.target.value });
    status.textContent = t('optionsSaved');
  });

  // Validation avant enregistrement, jamais après : un modèle avec une
  // variable hors liste blanche (ou mal formée, comme {Prompt} ou
  // {prompt-url}) doit être refusé ici, pas découvert au premier clic sur
  // « Send » dans le panneau, où il produirait un lien cassé en silence.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const template = form.elements.template.value.trim();
    try {
      renderTemplate(template, { prompt: 'test', prompt_url: 'https://x.test', lang: 'en', slug: 'x' });
    } catch (error) {
      // renderTemplate() jette toujours en français (voir template.mjs) : on
      // reconstruit le message dans la langue de l'utilisateur à partir des
      // variables brutes qu'il attache à l'erreur, avec repli sur le message
      // français si la clé de traduction manque.
      const localized = t('optionsBadTemplate');
      status.textContent = localized
        ? localized.replace('{vars}', (error.unknownVars ?? []).join(', '))
        : error.message;
      return;
    }
    await chrome.storage.local.set({
      customAgent: { name: form.elements.name.value.trim() || 'Custom', template },
    });
    status.textContent = t('optionsSaved');
  });

  $('clear-hidden').addEventListener('click', async () => {
    await chrome.storage.local.set({ hiddenSlugs: [] });
    status.textContent = t('optionsSaved');
  });
}

main();
