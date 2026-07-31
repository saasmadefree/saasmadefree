import { escapeHtml, renderLayout, languageName } from './site-html.mjs';
import { organizationJsonLd } from './site-seo.mjs';

/**
 * "/" — pas une page de contenu par langue : un simple point d'entrée qui
 * redirige (balise meta refresh, fonctionne sans JS) vers /en/, avec un lien
 * de secours visible et une porte de sortie vers /fr/. Pas de hreflang ici :
 * ce n'est pas une variante linguistique d'une page, c'est l'aiguillage lui-même.
 */
export function renderRootPage({ ui, enPath, otherLangs }) {
  const r = ui.site.root;
  const otherLinks = otherLangs
    .map((lang) => `<a href="/${lang}/" hreflang="${lang}" lang="${lang}">${escapeHtml(languageName(lang))}</a>`)
    .join(' · ');

  const main = `    <h1>${escapeHtml(ui.site.brand)}</h1>
    <p>${escapeHtml(r.redirecting)}</p>
    <p><a href="${enPath}">${escapeHtml(r.continueLink)}</a></p>
    ${otherLinks ? `<p>${otherLinks}</p>` : ''}`;

  return renderLayout({
    lang: 'en',
    path: '/',
    title: r.titleTag,
    description: r.metaDescription,
    alternates: [],
    jsonLd: [organizationJsonLd()],
    main,
    ui,
    homeHref: enPath,
    extraHead: `<meta http-equiv="refresh" content="0; url=${enPath}">`,
  });
}
