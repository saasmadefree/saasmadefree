import { escapeHtml, renderLayout, verdictBadge } from './site-html.mjs';

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

  // Le tampon réutilise le composant verdict "no" (badge-lg) : de l'encre
  // --stamp-no posée sur un constat administratif, pas un verdict d'outil —
  // c'est l'usage prévu par le spec §4 (« dossier vide tamponné »), aucune
  // couleur nouvelle. Défense en profondeur : si la clé venait à manquer,
  // pas de tampon plutôt qu'une chaîne "undefined" affichée au lecteur.
  const stampBadge = n?.stamp ? `    ${verdictBadge('no', n.stamp, 'badge-lg')}\n` : '';

  const main = `${stampBadge}    <h1>${escapeHtml(n.heading)}</h1>
    <p class="lede">${escapeHtml(n.body)}</p>
    <p>${links}</p>`;

  // Volontairement sans sponsors : un annonceur ne paie pas pour une page
  // d'erreur ni pour un stub de redirection. renderLayout laisse `sponsorSlots`
  // à null par défaut, il suffit de ne pas le passer.
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
