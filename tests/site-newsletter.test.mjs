import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  newsletterConfig, renderNewsletterForm, SMARTLETTER_SIGNUPS_URL,
} from '../scripts/lib/site-newsletter.mjs';
import { renderHomePage } from '../scripts/lib/site-page-home.mjs';
import { renderLayout } from '../scripts/lib/site-html.mjs';

// Newsletter SmartLetter (spec D13, Task A9). Deux moitiés : le rendu au build
// (aucun formulaire sans clé, jamais un formulaire mort) et le client
// (scripts/assets/site.js exécuté dans happy-dom, `fetch` simulé : aucun test
// ne touche la vraie API).

const SITE_JS = readFileSync(join('scripts', 'assets', 'site.js'), 'utf8');
const UI = {
  en: JSON.parse(readFileSync(join('data', 'i18n', 'en', 'ui.json'), 'utf8')),
  fr: JSON.parse(readFileSync(join('data', 'i18n', 'fr', 'ui.json'), 'utf8')),
};
const KEY = 'sl_test_fixture_key';
const SEGMENT = '0b7e2f4c-1d3a-4c5b-9e8f-7a6b5c4d3e2f';
const CONFIG = { key: KEY, segmentId: null };

function parse(html) {
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  win.document.write(`<!doctype html><html><body>${html}</body></html>`);
  return win.document;
}

describe('newsletterConfig — configuration au build', () => {
  it('null sans clé, ou avec une clé vide', () => {
    expect(newsletterConfig({})).toBeNull();
    expect(newsletterConfig({ SMARTLETTER_SIGNUPS_KEY: '' })).toBeNull();
    expect(newsletterConfig({ SMARTLETTER_SIGNUPS_KEY: '   ', SMARTLETTER_SEGMENT_ID: SEGMENT })).toBeNull();
  });

  it('la clé seule, ou la clé et le segment', () => {
    expect(newsletterConfig({ SMARTLETTER_SIGNUPS_KEY: ` ${KEY} ` })).toEqual({ key: KEY, segmentId: null });
    expect(newsletterConfig({ SMARTLETTER_SIGNUPS_KEY: KEY, SMARTLETTER_SEGMENT_ID: SEGMENT }))
      .toEqual({ key: KEY, segmentId: SEGMENT });
  });

  it('refuse un segment qui n’est pas un UUID : chaque inscription finirait en 422', () => {
    expect(() => newsletterConfig({ SMARTLETTER_SIGNUPS_KEY: KEY, SMARTLETTER_SEGMENT_ID: 'newsletter' }))
      .toThrow(/SMARTLETTER_SEGMENT_ID/);
  });

  it('le message d’erreur ne contient jamais la clé', () => {
    try {
      newsletterConfig({ SMARTLETTER_SIGNUPS_KEY: KEY, SMARTLETTER_SEGMENT_ID: 'nope' });
    } catch (error) {
      expect(String(error.message)).not.toContain(KEY);
    }
  });
});

describe('renderNewsletterForm — rendu', () => {
  it('renders nothing without key', () => {
    for (const variant of ['hero', 'footer']) {
      expect(renderNewsletterForm({ lang: 'en', ui: UI.en, config: null, variant })).toBe('');
    }
  });

  it('hero form carries data-endpoint, data-key, data-lang and optional data-segment', () => {
    const form = parse(renderNewsletterForm({ lang: 'en', ui: UI.en, config: CONFIG, variant: 'hero' }))
      .querySelector('form.newsletter[data-newsletter]');
    expect(form).not.toBeNull();
    expect(form.dataset.endpoint).toBe('https://api.smartletter.ai/signups');
    expect(SMARTLETTER_SIGNUPS_URL).toBe('https://api.smartletter.ai/signups');
    expect(form.dataset.key).toBe(KEY);
    expect(form.dataset.lang).toBe('en');
    expect(form.hasAttribute('data-segment')).toBe(false);

    const withSegment = parse(renderNewsletterForm({ lang: 'fr', ui: UI.fr, config: { key: KEY, segmentId: SEGMENT }, variant: 'hero' }))
      .querySelector('form[data-newsletter]');
    expect(withSegment.dataset.segment).toBe(SEGMENT);
    expect(withSegment.dataset.lang).toBe('fr');
  });

  it('email input is required with autocomplete=email and an accessible name', () => {
    for (const variant of ['hero', 'footer']) {
      const doc = parse(renderNewsletterForm({ lang: 'en', ui: UI.en, config: CONFIG, variant }));
      const input = doc.querySelector('form[data-newsletter] input[name="email"]');
      expect(input.getAttribute('type')).toBe('email');
      expect(input.hasAttribute('required')).toBe(true);
      expect(input.getAttribute('autocomplete')).toBe('email');
      expect(input.getAttribute('maxlength')).toBe('320');
      const label = doc.querySelector(`label[for="${input.id}"]`);
      expect(label.textContent.trim()).toBe(UI.en.site.newsletter.label);
      // Validation HTML d'abord : pas de novalidate.
      expect(doc.querySelector('form').hasAttribute('novalidate')).toBe(false);
      expect(doc.querySelector('button[type="submit"]').textContent.trim()).toBe(UI.en.site.newsletter.submit);
      const status = doc.querySelector('.newsletter-status');
      expect(status.getAttribute('role')).toBe('status');
      expect(status.textContent).toBe('');
    }
  });

  it('hero : la promesse au-dessus du formulaire ; footer : la promesse en titre de section', () => {
    const hero = parse(renderNewsletterForm({ lang: 'en', ui: UI.en, config: CONFIG, variant: 'hero' }));
    expect(hero.querySelector('.nl-lead').textContent).toBe('One email a week: a paid app, the free alternatives, and the prompt to build it.');
    expect(hero.querySelector('.nl-note').textContent).toBe('Double opt-in. We send nothing until you confirm. Unsubscribe in one click.');
    const footer = parse(renderNewsletterForm({ lang: 'en', ui: UI.en, config: CONFIG, variant: 'footer' }));
    const section = footer.querySelector('section.nl-block');
    const h2 = section.querySelector('h2.nl-h');
    expect(section.getAttribute('aria-labelledby')).toBe(h2.id);
    expect(h2.textContent).toBe(UI.en.site.newsletter.promise);
    // Les deux variantes ont des id distincts.
    expect(hero.querySelector('input').id).not.toBe(footer.querySelector('input').id);
  });

  it('no subscriber count rendered', () => {
    for (const lang of ['en', 'fr']) {
      for (const variant of ['hero', 'footer']) {
        const html = renderNewsletterForm({ lang, ui: UI[lang], config: CONFIG, variant });
        const text = parse(html).body.textContent;
        expect(text).not.toMatch(/\d/);
        expect(html).not.toMatch(/subscriber|abonné/i);
      }
    }
  });

  it('la clé est échappée dans l’attribut', () => {
    const html = renderNewsletterForm({ lang: 'en', ui: UI.en, config: { key: 'a"b<c', segmentId: null }, variant: 'hero' });
    expect(html).toContain('data-key="a&quot;b&lt;c"');
  });

  it('textes en et fr présents, en tutoiement pour le français, sans le mot « Sponsor »', () => {
    const keys = ['promise', 'label', 'placeholder', 'submit', 'note', 'confirmInbox', 'rateLimited',
      'waitOne', 'waitOther', 'waitUnknown', 'invalidEmail', 'tryAgain'];
    for (const lang of ['en', 'fr']) {
      const n = UI[lang].site.newsletter;
      for (const key of keys) expect(typeof n[key], `${lang}.${key}`).toBe('string');
      expect(n.rateLimited).toContain('{wait}');
      expect(n.waitOther).toContain('{count}');
      expect(JSON.stringify(n)).not.toMatch(/sponsor/i);
    }
    expect(UI.en.site.newsletter.confirmInbox).toBe('Check your inbox to confirm.');
    expect(UI.fr.site.newsletter.promise).toMatch(/\btoi\b|\bte\b|\btu\b/);
    expect(UI.fr.site.newsletter.note).toMatch(/\btu\b/);
  });
});

describe('pied de page — promesse « aucune requête tierce » tenue', () => {
  const layout = (hasNewsletter) => renderLayout({
    lang: 'en', path: '/en/', title: 'T', description: 'D', main: '<h1>T</h1>', ui: UI.en, homeHref: '/en/', hasNewsletter,
  });

  it('sans formulaire, la promesse reste la phrase d’origine', () => {
    const footer = parse(layout(false)).querySelector('.site-footer > p').textContent;
    expect(footer).toBe(UI.en.site.footer.promise);
    expect(footer).not.toMatch(/SmartLetter/);
  });

  it('avec le formulaire, elle dit qu’une requête part vers SmartLetter à l’inscription seulement', () => {
    const footer = parse(layout(true)).querySelector('.site-footer > p').textContent;
    expect(footer).toContain(UI.en.site.footer.promise);
    expect(footer).toContain(UI.en.site.footer.promiseNewsletter);
    expect(UI.en.site.footer.promiseNewsletter).toMatch(/SmartLetter/);
    expect(UI.fr.site.footer.promiseNewsletter).toMatch(/SmartLetter/);
  });
});

// ---- client ----------------------------------------------------------------

const toolViews = Array.from({ length: 3 }, (_, i) => ({
  slug: `outil-${i}`, name: `Outil ${i}`, category: 'analytics', subcategory: null, tagline: `Accroche ${i}`,
  path: `/en/tools/outil-${i}`, pricing: { amount: 10 + i, currency: 'USD', basis: 'flat-monthly' },
  diyTimeEstimate: 'weekend', verdict: 'yes', pagePriority: 10 - i, alternativeNames: [],
}));

function homeHtml(config = CONFIG) {
  return renderHomePage({
    lang: 'en', path: '/en/', toolViews, topCategorySlugs: ['analytics'], categories: { analytics: { label: { en: 'Analytics' } } },
    voteCounts: {}, favicons: {}, mrrTotal: 0, ui: UI.en, alternates: [], xDefaultPath: null, sponsorSlots: null,
    figures: { toolsPublished: 3, categories: 1, languages: 1, totalMonthlyUsd: 1, replaceableMonthlyUsd: 1, prompts: 3 },
    newsletter: renderNewsletterForm({ lang: 'en', ui: UI.en, config, variant: 'hero' }),
  });
}

/** Monte l'accueil, exécute site.js. `respond(url, init)` fabrique la réponse
 *  de SmartLetter ; le flux des votes (premier parti) répond `{}`. */
function mount({ html = homeHtml(), respond = () => Promise.resolve(new Response('{"object":"signup","status":"pending"}', { status: 202 })) } = {}) {
  const href = 'https://saasmadefree.com/en/?utm_source=x&ref=y#top';
  const win = new Window({
    url: href,
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true },
  });
  const doc = win.document;
  doc.write(html);
  doc.close();
  const location = { search: '?utm_source=x&ref=y', hash: '#top', href, pathname: '/en/', origin: 'https://saasmadefree.com' };
  const calls = [];
  const fetchStub = (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://api.smartletter.ai/')) return respond(url, init);
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
  const run = new Function(
    'window', 'document', 'location', 'fetch', 'navigator', 'localStorage',
    'sessionStorage', 'setTimeout', 'URLSearchParams', 'Intl', 'URL', 'console', SITE_JS
  );
  run(win, doc, location, fetchStub, win.navigator, win.localStorage, win.sessionStorage,
    setTimeout, URLSearchParams, Intl, URL, console);

  const form = doc.querySelector('form[data-newsletter]');
  return {
    win, doc, form,
    signups: () => calls.filter((c) => c.url.startsWith('https://api.smartletter.ai/')),
    input: () => form.querySelector('input[name="email"]'),
    button: () => form.querySelector('button[type="submit"]'),
    status: () => form.querySelector('.newsletter-status').textContent,
    submit: (email = '  ada@example.com ') => {
      form.querySelector('input[name="email"]').value = email;
      form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    },
    flush: async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); },
  };
}

const headerOf = (init, name) => {
  const entry = Object.entries(init.headers).find(([k]) => k.toLowerCase() === name);
  return entry ? entry[1] : undefined;
};

describe('site.js — inscription SmartLetter', () => {
  it('no network request at page load', async () => {
    const page = mount();
    await page.flush();
    expect(page.signups()).toEqual([]);
  });

  it('posts {email, language, source_url without query} with Bearer key on submit only', async () => {
    const page = mount();
    page.submit();
    await page.flush();
    expect(page.signups()).toHaveLength(1);
    const [{ url, init }] = page.signups();
    expect(url).toBe('https://api.smartletter.ai/signups');
    expect(init.method).toBe('POST');
    expect(headerOf(init, 'authorization')).toBe(`Bearer ${KEY}`);
    expect(headerOf(init, 'content-type')).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      email: 'ada@example.com', language: 'en', source_url: 'https://saasmadefree.com/en/',
    });
    // Pas de cookie, pas d'identifiant : la requête ne porte que ce qui est listé.
    expect(init.credentials).toBe('omit');
  });

  it('envoie segment_id quand il est configuré', async () => {
    const page = mount({ html: homeHtml({ key: KEY, segmentId: SEGMENT }) });
    page.submit();
    await page.flush();
    expect(JSON.parse(page.signups()[0].init.body).segment_id).toBe(SEGMENT);
  });

  it('une Idempotency-Key aléatoire, différente à chaque soumission', async () => {
    const page = mount();
    page.submit();
    await page.flush();
    page.submit();
    await page.flush();
    const keys = page.signups().map(({ init }) => headerOf(init, 'idempotency-key'));
    expect(keys).toHaveLength(2);
    for (const k of keys) expect(k).toMatch(/^[0-9a-f-]{16,}$/i);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('validation HTML d’abord : une adresse invalide ne part pas', async () => {
    const page = mount();
    page.submit('pas-une-adresse');
    await page.flush();
    page.submit('');
    await page.flush();
    expect(page.signups()).toEqual([]);
  });

  it('202 → status text confirmInbox', async () => {
    const page = mount();
    page.submit();
    await page.flush();
    expect(page.status()).toBe('Check your inbox to confirm.');
    expect(page.input().value).toBe('');
    expect(page.button().disabled).toBe(false);
  });

  it('429 → status text uses retry-after minutes', async () => {
    const page = mount({ respond: () => Promise.resolve(new Response('{}', { status: 429, headers: { 'retry-after': '125' } })) });
    page.submit();
    await page.flush();
    expect(page.status()).toBe(UI.en.site.newsletter.rateLimited.replace('{wait}', '3 minutes'));
    // L'adresse reste dans le champ : le visiteur n'a pas à la retaper.
    expect(page.input().value.trim()).toBe('ada@example.com');
  });

  it('429 : une minute au singulier, et « a few minutes » sans retry-after', async () => {
    const one = mount({ respond: () => Promise.resolve(new Response('{}', { status: 429, headers: { 'retry-after': '40' } })) });
    one.submit();
    await one.flush();
    expect(one.status()).toBe(UI.en.site.newsletter.rateLimited.replace('{wait}', '1 minute'));

    const none = mount({ respond: () => Promise.resolve(new Response('{}', { status: 429 })) });
    none.submit();
    await none.flush();
    expect(none.status()).toBe(UI.en.site.newsletter.rateLimited.replace('{wait}', 'a few minutes'));
  });

  it('422 → adresse invalide', async () => {
    const page = mount({ respond: () => Promise.resolve(new Response('{}', { status: 422 })) });
    page.submit();
    await page.flush();
    expect(page.status()).toBe(UI.en.site.newsletter.invalidEmail);
  });

  it('tout autre statut → réessayer', async () => {
    const page = mount({ respond: () => Promise.resolve(new Response('{}', { status: 500 })) });
    page.submit();
    await page.flush();
    expect(page.status()).toBe(UI.en.site.newsletter.tryAgain);
  });

  it('network error → status text tryAgain, form re-enabled', async () => {
    const page = mount({ respond: () => Promise.reject(new TypeError('Failed to fetch')) });
    page.submit();
    await page.flush();
    expect(page.status()).toBe(UI.en.site.newsletter.tryAgain);
    expect(page.button().disabled).toBe(false);
    expect(page.form.hasAttribute('aria-busy')).toBe(false);
  });

  it('button disabled while pending', async () => {
    let resolve;
    const page = mount({ respond: () => new Promise((r) => { resolve = r; }) });
    page.submit();
    await page.flush();
    expect(page.button().disabled).toBe(true);
    expect(page.form.getAttribute('aria-busy')).toBe('true');
    // Un second envoi pendant l'attente ne part pas.
    page.submit();
    await page.flush();
    expect(page.signups()).toHaveLength(1);
    resolve(new Response('{}', { status: 202 }));
    await page.flush();
    expect(page.button().disabled).toBe(false);
    expect(page.status()).toBe('Check your inbox to confirm.');
  });

  it('sans formulaire (pas de clé), le script ne fait rien et ne casse pas', async () => {
    const page = mount({ html: homeHtml(null) });
    await page.flush();
    expect(page.form).toBeNull();
    expect(page.signups()).toEqual([]);
  });
});

// ---- intégration : accueil et fiche, données réelles -----------------------

describe('emplacements — accueil (hero) et bas de fiche (footer)', async () => {
  const { loadData } = await import('../scripts/lib/load-data.mjs');
  const { renderToolPage } = await import('../scripts/lib/site-page-tool.mjs');
  const data = await loadData(process.cwd());
  const lang = 'en';
  const ui = data.ui.get(lang);
  const tool = [...data.tools.values()].find((t) => t.markets.includes(lang));
  const toolPage = (newsletter) => parse(renderToolPage({
    lang, path: `/${lang}/tools/${tool.slug}`, tool,
    i18nEntry: data.i18n.get(`${lang}/${tool.slug}`), categories: data.categories, ui, alternates: [],
    xDefaultPath: null, homePath: `/${lang}/`, categoryPath: `/${lang}/categories/${tool.category}`,
    relatedTools: [], voteCount: 0, favicons: {}, agents: data.agents, sponsorSlots: null, buildDate: '2026-10-17',
    projects: data.projects, projectI18n: data.projectI18n, today: '2026-10-17', newsletter,
  }));

  it('accueil : la promesse et le formulaire suivent le sous-titre, dans le héros', () => {
    const doc = parse(homeHtml());
    const hero = doc.querySelector('.hero');
    const kids = [...hero.children].map((el) => el.className || el.tagName.toLowerCase());
    expect(kids.slice(0, 4)).toEqual(['h1', 'sub', 'nl-lead', 'newsletter']);
    expect(doc.querySelectorAll('form[data-newsletter]')).toHaveLength(1);
  });

  it('accueil sans clé : ni formulaire, ni promesse, ni mention de SmartLetter', () => {
    const html = homeHtml(null);
    expect(html).not.toContain('data-newsletter');
    expect(html).not.toContain('nl-lead');
    expect(html).not.toMatch(/SmartLetter|smartletter/);
  });

  it('fiche : le bloc newsletter est la dernière section de <main>', () => {
    const doc = toolPage(renderNewsletterForm({ lang, ui, config: CONFIG, variant: 'footer' }));
    const sections = doc.querySelectorAll('main > section');
    expect(sections[sections.length - 1].classList.contains('nl-block')).toBe(true);
    expect(doc.querySelectorAll('form[data-newsletter]')).toHaveLength(1);
    expect(doc.querySelector('.site-footer > p').textContent).toContain('SmartLetter');
  });

  it('fiche sans clé : aucune trace du formulaire', () => {
    const doc = toolPage(renderNewsletterForm({ lang, ui, config: null, variant: 'footer' }));
    expect(doc.querySelector('[data-newsletter], .nl-block')).toBeNull();
    expect(doc.documentElement.outerHTML).not.toMatch(/SmartLetter|smartletter/);
  });
});
