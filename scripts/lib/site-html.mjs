import { SITE_ORIGIN } from './site-data.mjs';

export const GITHUB_REPO_URL = 'https://github.com/saasmadefree/saasmadefree';
export const CONTRIBUTING_URL = `${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`;

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

/** Un bloc <script type="application/ld+json"> ne doit jamais laisser passer une
 *  séquence "</script" en clair : elle romprait le bloc hors de tout contrôle du
 *  parseur JSON. On échappe "<" en <, ce que JSON.parse lit comme "<" normalement. */
export function jsonLdScript(data) {
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

const LANG_NAMES = {
  en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch',
  it: 'Italiano', pt: 'Português', nl: 'Nederlands',
};
export function languageName(lang) {
  return LANG_NAMES[lang] ?? lang;
}

/** Badge de verdict, partagé par la table de l'accueil, la ligne de titre
 *  d'une fiche et les cartes "outils proches" — une seule source de vérité
 *  pour le balisage, un modificateur optionnel (ex. "badge-lg") pour la
 *  variante agrandie de la fiche outil. */
export function verdictBadge(verdict, label, extraClass = '') {
  const cls = ['badge', verdict, extraClass].filter(Boolean).join(' ');
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

export function renderBreadcrumb(items) {
  const parts = items.map((item, i) => {
    if (i === items.length - 1) {
      return `<span aria-current="page">${escapeHtml(item.label)}</span>`;
    }
    return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
  });
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${parts.join(' <span aria-hidden="true">/</span> ')}</nav>`;
}

function renderLangSwitcher(alternates, currentLang, ui) {
  if (!alternates || alternates.length < 2) return '';
  const items = alternates
    .map(({ lang, path }) => {
      if (lang === currentLang) {
        return `<span aria-current="page">${escapeHtml(languageName(lang))}</span>`;
      }
      return `<a href="${escapeHtml(path)}" hreflang="${lang}" lang="${lang}">${escapeHtml(languageName(lang))}</a>`;
    })
    .join('\n      ');
  return `
    <nav class="lang-switch" aria-label="${escapeHtml(ui.site.languageSwitcherLabel)}">
      ${items}
    </nav>`;
}

/**
 * Coquille HTML partagée par toutes les pages générées.
 *
 * @param {object} opts
 * @param {string} opts.lang - langue de la page (attribut html[lang])
 * @param {string} opts.path - chemin absolu de la page (ex. "/en/tools/notion")
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {Array<{lang:string,path:string}>} [opts.alternates] - variantes de langue existantes
 * @param {string|null} [opts.xDefaultPath]
 * @param {Array<object>} [opts.jsonLd] - objets JSON-LD, un <script> par entrée
 * @param {string} opts.main - HTML interne de <main>, doit contenir le seul <h1> de la page
 * @param {object} opts.ui - table de traduction (doit contenir ui.site)
 * @param {string} opts.homeHref - lien de la marque dans l'en-tête
 * @param {string} [opts.extraHead] - balises additionnelles insérées dans <head>
 * @param {{tapeTop:string,tapeBottom:string,railLeft:string,railRight:string,fallback:string}|null} [opts.sponsorSlots] - balisage sponsor déjà rendu par renderSponsorSlots(), ou null pour aucun
 */
export function renderLayout({
  lang, path, title, description, alternates = [], xDefaultPath = null,
  jsonLd = [], main, ui, homeHref, extraHead = '', sponsorSlots = null,
}) {
  const canonical = `${SITE_ORIGIN}${path}`;
  const hreflangLinks = alternates
    .map(({ lang: l, path: p }) => `<link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${p}">`)
    .join('\n');
  const xDefaultLink = xDefaultPath
    ? `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${xDefaultPath}">`
    : '';
  const jsonLdBlocks = jsonLd.map(jsonLdScript).join('\n');
  const langSwitcher = renderLangSwitcher(alternates, lang, ui);

  const headLines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${canonical}">`,
    hreflangLinks,
    xDefaultLink,
    '<link rel="icon" href="/icon.png">',
    '<link rel="stylesheet" href="/assets/site.css">',
    // Ce script est volontairement inline et synchrone, avant la feuille de
    // style : un thème appliqué après le premier rendu ferait clignoter la page
    // en clair avant de passer en sombre. C'est le seul script bloquant du site.
    '<script>try{var t=localStorage.getItem("theme");'
      + 'if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}</script>',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${canonical}">`,
    extraHead,
    jsonLdBlocks,
  ].filter(Boolean).join('\n');

  const nav = ui.site.nav ?? {};
  const navLinks = [
    { href: homeHref, label: ui.site.directoryLabel },
    { href: CONTRIBUTING_URL, label: nav.submitTool },
    { href: `/${lang}/sponsor`, label: nav.sponsor },
    { href: GITHUB_REPO_URL, label: nav.source },
  ]
    .filter((item) => item.label)
    .map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`)
    .join('');
  // Nom accessible du bouton de thème résolu au build pour l'état initial
  // (clair par défaut) ; scripts/assets/site.js le recalcule à chaque bascule.
  // Le bouton reste `hidden` tant que le JS ne l'a pas activé (amélioration
  // progressive), donc ce libellé initial n'est jamais lu sans thème actif.
  const themeToggleLabel = escapeHtml(ui.site.themeToDark ?? 'Dark mode');

  // Balisage sponsor déjà rendu par site-sponsors.mjs et passé tel quel : ce
  // module ne connaît ni les slots, ni les prix, ni les placements. C'est ce
  // qui évite un cycle d'imports entre site-html.mjs et site-sponsors.mjs.
  //
  // Les rails sont écrits APRÈS .col-main dans le DOM et replacés par
  // grid-column : un lecteur d'écran et la tabulation atteignent ainsi le
  // contenu avant les sponsors. Les bandeaux sont frères de .shell — placés à
  // l'intérieur, leur pleine largeur passerait sous les rails.
  const sp = sponsorSlots ?? { tapeTop: '', tapeBottom: '', railLeft: '', railRight: '', fallback: '' };

  return `<!doctype html>
<html lang="${lang}">
<head>
${headLines}
</head>
<body>
<a class="skip-link" href="#main">${escapeHtml(ui.site.skipToContent)}</a>
${sp.tapeTop}
<div class="shell">
  <div class="col-main">
    <div class="page">
      <header class="site-header">
        <div class="header-left">
          <a class="brand" href="${escapeHtml(homeHref)}">${escapeHtml(ui.site.brand)}</a>
          <ul class="nav-links">${navLinks}</ul>
        </div>
        <div class="header-groups">
          <div class="header-controls">${langSwitcher}
            <button type="button" id="theme-toggle" class="theme-toggle" hidden
                    aria-label="${themeToggleLabel}"
                    data-label-dark="${escapeHtml(ui.site.themeToDark ?? 'Dark mode')}"
                    data-label-light="${escapeHtml(ui.site.themeToLight ?? 'Light mode')}">
              <span aria-hidden="true" class="theme-icon"></span>
            </button>
            <a class="github-btn" href="${GITHUB_REPO_URL}">${escapeHtml(nav.github ?? 'GitHub')} <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </header>
      <main id="main">
${main}
      </main>
      <footer class="site-footer">
        <a href="${GITHUB_REPO_URL}">${escapeHtml(ui.site.footer.source)}</a>
        <a href="/privacy">${escapeHtml(ui.site.footer.privacy)}</a>
        <a href="mailto:privacy@saasmadefree.com">privacy@saasmadefree.com</a>
        <a class="credit" href="https://github.com/canivibecodeit/canivibecodeit" rel="noopener">${escapeHtml(ui.site.footer.credit ?? "")}</a>
      </footer>
      ${sp.fallback}
    </div>
  </div>
  ${sp.railLeft}
  ${sp.railRight}
</div>
${sp.tapeBottom}
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}
