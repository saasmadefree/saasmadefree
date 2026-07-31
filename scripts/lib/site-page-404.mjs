import { escapeHtml, renderLayout } from './site-html.mjs';

/**
 * Page 404, servie par Cloudflare Pages pour toute URL sans fichier
 * correspondant — à condition qu'un `404.html` existe à la racine de la sortie.
 *
 * Sans ce fichier, Pages renvoyait la page racine avec un statut **200** pour
 * n'importe quel chemin : `/en/tools/zzz-inexistant/` répondait 200, tout
 * comme les fiches retirées du catalogue. C'est un « soft 404 » — Google
 * indexe l'URL, la considère comme du contenu dupliqué de l'accueil, et le
 * budget de crawl part dans un espace d'URL infini. Sur un site dont tout
 * l'intérêt est la couverture programmatique, c'est un vrai coût.
 *
 * `noindex` en plus du statut : la balise protège même si un intermédiaire
 * réécrit le code de statut.
 */
export function render404Page({ ui, enPath, langs }) {
  const s = ui.site;
  const n = s.notFound;
  const links = langs
    .map((lang) => `<a href="/${lang}/">${escapeHtml(s.directoryLabel)} (${lang})</a>`)
    .join(' · ');

  const main = `    <h1>${escapeHtml(n.heading)}</h1>
    <p class="lede">${escapeHtml(n.body)}</p>
    <p>${links}</p>`;

  return renderLayout({
    lang: 'en',
    path: '/404',
    title: n.titleTag,
    description: n.metaDescription,
    alternates: [],
    jsonLd: [],
    main,
    ui,
    homeHref: enPath,
    extraHead: '<meta name="robots" content="noindex">',
  });
}
