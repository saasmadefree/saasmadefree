import { SITE_ORIGIN } from './site-data.mjs';
import { assetUrl } from './site-assets.mjs';
import { hreflangFor } from './site-seo.mjs';

export const GITHUB_REPO_URL = 'https://github.com/saasmadefree/saasmadefree';
// Le cachet GitHub de l'en-tête : l'octicon « mark-github » inline, à
// l'encre courante. Le nom accessible est porté par l'aria-label du lien,
// d'où l'aria-hidden sur le dessin. Un texte « GitHub ↗ » à côté du
// monogramme et de la bascule de thème faisait un troisième mot en
// capitales pour le même geste ; l'icône seule suffit (23.08.2026).
const GITHUB_MARK_SVG = '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">'
  + '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>'
  + '</svg>';

export const CONTRIBUTING_URL = `${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`;

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

/** Un bloc <script type="application/ld+json"> ne doit jamais laisser passer une
 *  séquence "</script" en clair : elle romprait le bloc hors de tout contrôle du
 *  parseur JSON. On échappe "<" en <, ce que JSON.parse lit comme "<" normalement.
 *  JSON compact, sans indentation : l'ItemList de l'accueil (530 fiches)
 *  pesait 80 Ko de blancs (Task A8). */
export function jsonLdScript(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

const LANG_NAMES = {
  en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch',
  it: 'Italiano', pt: 'Português', nl: 'Nederlands',
};
export function languageName(lang) {
  return LANG_NAMES[lang] ?? lang;
}

/** Badge de verdict, partagé par la grille de cartes (accueil, catégories),
 *  la fiche et les cartes "outils proches" — une seule source de vérité pour
 *  le balisage, un modificateur optionnel (une classe de plus) pour une variante
 *  de mise en page. La forme (● ◐ ○) est posée par la feuille sur la
 *  classe du verdict : le badge porte toujours une forme ET un mot. */
export function verdictBadge(verdict, label, extraClass = '') {
  const cls = ['badge', verdict, extraClass].filter(Boolean).join(' ');
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

export function renderBreadcrumb(items) {
  const parts = items.map((item, i) => {
    if (i === items.length - 1) {
      return `<span aria-current="page">${escapeHtml(item.label)}</span>`;
    }
    // Étape sans page (catégorie absente dans la langue) : nommée, pas liée.
    if (!item.href) return `<span>${escapeHtml(item.label)}</span>`;
    return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
  });
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join(' <span aria-hidden="true">/</span> ')}</nav>`;
}

function renderLangSwitcher(alternates, currentLang, ui) {
  if (!alternates || alternates.length < 2) return '';
  const items = alternates
    // Le code à deux lettres, pas le nom complet : « English Français » pesait
    // 144px dans un en-tête qui n'en a que 888 quand les rails sont affichés,
    // et faisait replier les contrôles sur une deuxième ligne. Le nom complet
    // reste porté par le title du lien et par hreflang/lang, donc rien n'est
    // perdu pour qui a besoin de la forme longue.
    .map(({ lang, path }) => {
      const code = escapeHtml(lang.toUpperCase());
      const name = escapeHtml(languageName(lang));
      if (lang === currentLang) {
        return `<span aria-current="page" title="${name}">${code}</span>`;
      }
      return `<a href="${escapeHtml(path)}" hreflang="${lang}" lang="${lang}" title="${name}">${code}</a>`;
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
 * @param {Array<{lang:string,path:string,indexable?:boolean}>} [opts.alternates] - versions de langue
 *   générées (languageVersions) : toutes au sélecteur, les seules indexables au hreflang
 * @param {string|null} [opts.xDefaultPath] - gardé seulement s'il vise une version indexable (hreflangFor)
 * @param {Array<object>} [opts.jsonLd] - objets JSON-LD, un <script> par entrée
 * @param {string} opts.main - HTML interne de <main>, doit contenir le seul <h1> de la page
 * @param {object} opts.ui - table de traduction (doit contenir ui.site)
 * @param {string} opts.homeHref - lien de la marque dans l'en-tête
 * @param {string} [opts.extraHead] - balises additionnelles insérées dans <head>
 * @param {{tapeBottom:string,railLeft:string,railRight:string,fallback:string}|null} [opts.sponsorSlots] - balisage sponsor déjà rendu par renderSponsorSlots(), ou null pour aucun
 * @param {string|null} [opts.robots] - contenu de <meta name="robots"> (ex. "noindex,follow"),
 *   aucune balise si absent : une page indexable n'a pas besoin de le dire
 * @param {boolean} [opts.hasNewsletter] - la page porte le formulaire SmartLetter (spec D13) :
 *   la promesse du pied de page dit alors qu'une requête part vers SmartLetter à l'inscription
 */
export function renderLayout({
  lang, path, title, description, alternates = [], xDefaultPath = null,
  jsonLd = [], main, ui, homeHref, extraHead = '', sponsorSlots = null, robots = null,
  hasNewsletter = false,
}) {
  // Canonical = l'URL de la page elle-même, jamais une autre langue.
  const canonical = `${SITE_ORIGIN}${path}`;
  // hreflang : la règle unique de site-seo.mjs (Ruling 29), seulement entre
  // versions indexables. Le sélecteur de langue, lui, garde toutes les
  // versions générées : une page noindex reste une page à lire.
  const hreflang = hreflangFor({ alternates, xDefaultPath, robots });
  const hreflangLinks = hreflang.links
    .map(({ lang: l, path: p }) => `<link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${p}">`)
    .join('\n');
  const xDefaultLink = hreflang.xDefault
    ? `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${hreflang.xDefault}">`
    : '';
  const jsonLdBlocks = jsonLd.map(jsonLdScript).join('\n');
  const langSwitcher = renderLangSwitcher(alternates, lang, ui);

  const headLines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    robots ? `<meta name="robots" content="${escapeHtml(robots)}">` : '',
    `<link rel="canonical" href="${canonical}">`,
    hreflangLinks,
    xDefaultLink,
    '<link rel="icon" href="/icon.png">',
    `<link rel="stylesheet" href="${assetUrl('site.css')}">`,
    // Ce script est volontairement inline et synchrone, avant la feuille de
    // style : un thème appliqué après le premier rendu ferait clignoter la page
    // en clair avant de passer en sombre. C'est le seul script bloquant du site.
    // Il pose aussi la classe `js` sur <html> avant le premier rendu : la
    // newsletter (spec D13, Ruling 31) s'en sert pour réserver la place de son
    // bloc, rendu `hidden` au build, jusqu'à ce que site.js (différé) le
    // dévoile. Sans JavaScript, la classe n'existe pas et le bloc reste masqué.
    '<script>document.documentElement.classList.add("js");try{var t=localStorage.getItem("theme");'
      + 'if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}</script>',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${canonical}">`,
    extraHead,
    jsonLdBlocks,
  ].filter(Boolean).join('\n');

  const nav = ui.site.nav ?? {};
  // `footer.stats` plutôt qu'une nouvelle clé : le libellé existe déjà dans
  // les sept locales et désigne exactement la même page. Une clé de plus,
  // c'est sept traductions de plus à tenir pour le même mot.
  //
  // Retirés le 23.08.2026 : « Annuaire » (ui.site.directoryLabel), qui
  // pointait sur la même cible que la marque à trois centimètres, et
  // « Code source » (nav.source), doublon du bouton GitHub d'à côté et du
  // lien de pied de page. Les deux clés restent dans les données : le fil
  // d'Ariane et la 404 lisent toujours directoryLabel.
  const navLinks = [
    { href: CONTRIBUTING_URL, label: nav.submitTool },
    { href: `/${lang}/sponsor`, label: nav.sponsor },
    { href: `/${lang}/stats/`, label: ui.site.footer?.stats },
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
  // l'intérieur, leur pleine largeur passerait sous les rails. Le repli des
  // petits écrans se range sous le contenu, avant le pied de page.
  const sp = sponsorSlots ?? { tapeBottom: '', railLeft: '', railRight: '', fallback: '' };

  // Les rails n'existent que si la page en porte : l'accueil range les siens
  // dans la rangée sous le héros (spec D14) et rend la coquille sans eux. La
  // classe .has-rails est ce qui ouvre les trois pistes de grille au-delà de
  // 84rem — sans rails, la colonne de contenu garde toute la largeur.
  const hasRails = Boolean(sp.railLeft || sp.railRight);
  // « Cette page ne charge rien depuis un autre site » reste strictement vrai
  // partout. Sur une page qui porte le formulaire newsletter, la phrase dit en
  // plus la seule exception : une requête vers SmartLetter, à l'inscription
  // et jamais autrement (spec D13).
  const promiseText = [
    ui.site.footer?.promise,
    hasNewsletter ? ui.site.footer?.promiseNewsletter : null,
  ].filter(Boolean).join(' ');
  const promise = ui.site.footer?.promise
    ? `\n        <p>${escapeHtml(promiseText)}</p>`
    : '';

  // Maillage A7 : le hub A–Z et les deux collections, sur toutes les pages.
  // Seulement si la locale porte le libellé (les langues non publiées ont un
  // bloc `site` réduit) : jamais un lien sans texte.
  const footer = ui.site.footer ?? {};
  const meshLinks = [
    [`/${lang}/alternatives/`, footer.hub],
    [`/${lang}/collections/self-hosted`, footer.selfHosted],
    [`/${lang}/collections/build-tonight`, footer.buildTonight],
  ]
    .filter(([, label]) => label)
    .map(([href, label]) => `\n          <a href="${href}">${escapeHtml(label)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
${headLines}
</head>
<body>
<a class="skip-link" href="#main">${escapeHtml(ui.site.skipToContent)}</a>
<div class="shell${hasRails ? ' has-rails' : ''}">
  <div class="col-main">
    <div class="page">
      <header class="site-header">
        <a class="brand" href="${escapeHtml(homeHref)}"><span class="brand-mark" aria-hidden="true">S</span>${escapeHtml(ui.site.brand)}</a>
        <ul class="nav-links">${navLinks}</ul>
        <div class="header-controls">${langSwitcher}
          <button type="button" id="theme-toggle" class="theme-toggle" hidden
                  aria-label="${themeToggleLabel}"
                  data-label-dark="${escapeHtml(ui.site.themeToDark ?? 'Dark mode')}"
                  data-label-light="${escapeHtml(ui.site.themeToLight ?? 'Light mode')}">
            <span aria-hidden="true" class="theme-icon"></span>
          </button>
          <a class="github-btn" href="${GITHUB_REPO_URL}" aria-label="${escapeHtml(nav.github ?? 'GitHub')}">${GITHUB_MARK_SVG}</a>
        </div>
      </header>
      <main id="main">
${main}
      </main>
      ${sp.fallback}
      <footer class="site-footer">${promise}
        <p class="foot-links">
          <a href="${GITHUB_REPO_URL}">${escapeHtml(ui.site.footer.source)}</a>
          <a href="/${lang}/stats/">${escapeHtml(ui.site.footer.stats)}</a>${meshLinks}
          <a href="/privacy">${escapeHtml(ui.site.footer.privacy)}</a>
          <a href="mailto:privacy@saasmadefree.com">privacy@saasmadefree.com</a>
          <a class="credit" href="https://github.com/canivibecodeit/canivibecodeit" rel="noopener">${escapeHtml(ui.site.footer.credit ?? "")}</a>
        </p>
      </footer>
    </div>
  </div>
  ${sp.railLeft}
  ${sp.railRight}
</div>
${sp.tapeBottom}
<script src="${assetUrl('site.js')}" defer></script>
<script src="${assetUrl('beacon.js')}" defer></script>
</body>
</html>
`;
}
