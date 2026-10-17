// Génère le site public statique (accueil, fiches, pages de catégorie) dans
// dist/, à partir des mêmes données que le feed (scripts/build-feed.mjs, qui
// doit avoir tourné juste avant — voir npm run build). Aucune dépendance,
// aucun framework : uniquement du Node ESM qui écrit du HTML/CSS/JS brut.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadData } from './lib/load-data.mjs';
import { alternativesFor, replacedTools, toolDateModified } from './lib/site-alternatives.mjs';
import {
  SITE_ORIGIN, fetchVoteCounts, fetchStats, fetchSponsorSlots, siteLanguages, toolsForLang, sortTools,
  categoriesForLang, topCategoriesByCount, langsForCategory, catalogueFigures, mrrDestroyed,
} from './lib/site-data.mjs';
import { fetchFavicons } from './lib/site-favicons.mjs';
import { buildSitemap } from './lib/site-seo.mjs';
import { renderHomePage } from './lib/site-page-home.mjs';
import { renderCategoryPage } from './lib/site-page-category.mjs';
import { renderCategoriesIndexPage } from './lib/site-page-categories-index.mjs';
import { renderSponsorPage } from './lib/site-page-sponsor.mjs';
import { renderToolPage } from './lib/site-page-tool.mjs';
import { renderProjectPage, projectPages, relatedProjects, projectDateModified } from './lib/site-page-project.mjs';
import {
  renderComparePage, buildComparePages, compareLinksFor, compareDateModified, compareCategory,
} from './lib/site-page-compare.mjs';
import { renderStatsPage } from './lib/site-page-stats.mjs';
import { renderRootPage } from './lib/site-page-root.mjs';
import { render404Page } from './lib/site-page-404.mjs';
import { sponsorContext, renderSponsorSlots, selectSponsors } from './lib/site-sponsors.mjs';
import { ASSET_FILES, ASSET_DIR, assetUrl } from './lib/site-assets.mjs';

const OUT = 'dist';

// Le nettoyage de dist/ vit dans build-feed.mjs, PREMIER maillon de
// `npm run build` : nettoyer ici, en deuxième position, effaçait le feed et
// le public/ écrits juste avant (404 sur /privacy en production). La garantie
// « une fiche retirée disparaît du site » tient tant que le site se construit
// via `npm run build` — jamais en lançant build-site seul.
// L'accueil ne montre que les catégories les plus peuplées, avec un chip
// "Toutes les catégories →" vers la liste complète (/{lang}/categories/) —
// voir docs/design-fixes-report.md. Recalculé à chaque build (jamais une
// liste figée), donc reste correct pendant que le catalogue change de forme.
const HOME_TOP_CATEGORIES = 12;

async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
}

function homeAlternates(langs) {
  return langs.map((lang) => ({ lang, path: `/${lang}/` }));
}

function xDefaultOf(alternates) {
  if (alternates.length === 0) return null;
  return (alternates.find((a) => a.lang === 'en') ?? alternates[0]).path;
}

function buildToolViews(tools, i18n, lang, voteCounts, projects, today) {
  const list = toolsForLang(tools, lang).map((tool) => ({
    ...tool,
    tagline: i18n.get(`${lang}/${tool.slug}`).tagline,
    path: `/${lang}/tools/${tool.slug}`,
    // Noms des alternatives libres affichables (ni archivées ni inactives),
    // dans l'ordre éditorial : la ligne « Alternatives gratuites » des cartes
    // et la liste « Alternatives populaires » de l'accueil.
    alternativeNames: alternativesFor(tool, projects, today).map(({ project }) => project.name),
  }));
  return sortTools(list, voteCounts);
}

function voteCountFor(voteCounts, slug) {
  if (!voteCounts) return null;
  return Object.prototype.hasOwnProperty.call(voteCounts, slug) ? voteCounts[slug] : 0;
}

async function main() {
  const data = await loadData(process.cwd());
  const { tools, i18n, ui, categories, agents, projects, projectI18n, compare, compareI18n } = data;

  // Date du build : c'est elle qui décide qu'un placement sponsor est actif
  // (un placement échu disparaît au prochain build, sans aucune action —
  // d'où le build planifié quotidien, voir le plan 2), et c'est elle que
  // l'accueil affiche en « État arrêté le » dans sa cartouche. Calculée UNE
  // fois ici, jamais dans un gabarit : toutes les pages d'un même build
  // portent la même date.
  const today = new Date().toISOString().slice(0, 10);


  const voteCounts = await fetchVoteCounts();
  if (voteCounts) {
    console.log(`Compteurs de votes récupérés en direct pour ${Object.keys(voteCounts).length} slug(s).`);
  } else {
    console.log('Service de vote injoignable au build — tri sur pagePriority, aucun compteur affiché.');
  }

  // Chiffres d'audience (page /sponsor, section « ce qu'on mesure ») — même
  // discipline que voteCounts ci-dessus : null si le service ne répond pas,
  // jamais un zéro qui se ferait passer pour une donnée.
  const stats = await fetchStats();
  if (stats) {
    console.log(`Chiffres d'audience récupérés en direct (visiteurs-jours 7 j : ${stats.visitors7d}).`);
  } else {
    console.log("Service d'analytics injoignable au build — page /sponsor sans chiffre d'audience.");
  }

  // Disponibilité en direct des emplacements sponsors (page /sponsor,
  // tableau d'inventaire) — même discipline que voteCounts/stats ci-dessus :
  // un paiement encaissé côté Worker peut précéder de plusieurs minutes le
  // commit de la créa dans data/sponsors.json, et l'inventaire doit refléter
  // le paiement pendant cette fenêtre plutôt que de vendre le même slot deux
  // fois à un rang de prix trop bas.
  const sponsorSlotsLive = await fetchSponsorSlots();
  if (sponsorSlotsLive) {
    console.log(`Disponibilité des emplacements sponsors récupérée en direct pour ${Object.keys(sponsorSlotsLive).length} slot(s).`);
  } else {
    console.log('Service de disponibilité sponsors injoignable au build — inventaire /sponsor replié sur data/sponsors.json.');
  }

  // Domaines des sponsors actifs au jour du build (`today` ci-dessus) : ils
  // n'ont pas de fiche catalogue, donc pas de slug — fetchFavicons les indexe
  // par domaine (extraDomains / byDomain) plutôt que par slug (bySlug).
  const { domains: sponsorDomains } = selectSponsors(data.sponsors.placements, today);

  // Icônes des outils et des sponsors, récupérées une fois au build et mises
  // en cache sous un dossier ignoré par git (voir .gitignore) : une
  // reconstruction locale ne refait jamais la requête réseau, et un échec de
  // récupération ne casse jamais le build — voir scripts/lib/site-favicons.mjs.
  const { bySlug: favicons, byDomain: sponsorFavicons, stats: faviconStats } = await fetchFavicons(tools, {
    cacheDir: join('.cache', 'favicons'),
    outDir: join(OUT, 'assets', 'favicons'),
    extraDomains: sponsorDomains,
  });
  // fetched/cached/placeholder comptent des domaines résolus (dédupliqués :
  // un domaine partagé par un outil et un sponsor n'est compté qu'une fois),
  // alors que total compte des entités (un outil, un domaine de sponsor) —
  // les trois premiers ne s'additionnent donc pas forcément à total dès qu'un
  // domaine est partagé. D'où la phrase séparée plutôt que "P en repli sur N".
  console.log(
    `Icônes : ${faviconStats.fetched} domaine(s) récupéré(s), ${faviconStats.cached} depuis le cache, ` +
    `${faviconStats.placeholder} en repli — ${faviconStats.total} outil(s)/sponsor(s) au total.`
  );

  const langs = siteLanguages(tools);
  if (langs.length === 0) {
    throw new Error("Aucune langue n'est déclarée par une fiche data/tools/*.json — rien à générer.");
  }

  // Chiffres réels du catalogue et dépense mensuelle représentée par les
  // votes enregistrés (état récapitulatif de l'accueil) — voir
  // la règle d'honnêteté du projet : jamais un chiffre inventé, et `null`
  // plutôt qu'un zéro qui se ferait passer pour une donnée quand le service
  // de vote n'a pas répondu.
  const figures = catalogueFigures(tools, langs, i18n.size);
  const mrrTotal = mrrDestroyed(tools, voteCounts);

  const sitemapPages = [{ path: '/' }, { path: '/privacy' }];

  // ---- page racine ------------------------------------------------------
  const enPath = langs.includes('en') ? '/en/' : `/${langs[0]}/`;
  const rootUi = ui.get('en') ?? ui.get(langs[0]);
  await writeText(
    join(OUT, 'index.html'),
    renderRootPage({ ui: rootUi, enPath, otherLangs: langs.filter((l) => `/${l}/` !== enPath) })
  );

  // ---- 404 ---------------------------------------------------------------
  // Cloudflare Pages sert ce fichier, avec un vrai statut 404, pour toute URL
  // sans fichier correspondant. Sans lui, Pages renvoyait la page racine en
  // 200 pour n'importe quel chemin — voir scripts/lib/site-page-404.mjs.
  await writeText(join(OUT, '404.html'), render404Page({ ui: rootUi, enPath, langs }));

  // ---- par langue : accueil, fiches, catégories --------------------------
  const homeAlt = homeAlternates(langs);
  const homeXDefault = xDefaultOf(homeAlt);
  let toolPageCount = 0;
  let categoryPageCount = 0;
  let projectPageCount = 0;
  let comparePageCount = 0;

  // Pages projet /{lang}/oss/{slug} : une par langue publiée où le texte
  // existe (Ruling 20). Calculées une fois, AVANT les fiches : le lien d'une
  // fiche vers une page projet se décide sur ce même ensemble, donc une fiche
  // ne lie jamais une page absente ou gardée hors index.
  const projectPlan = projectPages({ projects, projectI18n, tools, langs, today });
  const indexableProjectPaths = new Set(projectPlan.filter((page) => page.indexable).map((page) => page.path));
  const projectIndexableIn = (lang) => (project) => indexableProjectPaths.has(`/${lang}/oss/${project.slug}`);

  // Comparatifs /{lang}/compare/{a}-vs-{b} : un seul plan, d'où dérivent les
  // pages, le sitemap et les liens « Comparisons » des fiches et des pages
  // projet — un lien ne vise donc jamais un comparatif absent. Seulement les
  // paires de data/compare.json (spec D4) ; un côté inconnu casse le build.
  const comparePlan = buildComparePages({ compare, compareI18n, tools, projects, langs, today });
  const comparisonsOf = (lang, kind, slug) => compareLinksFor(comparePlan, { lang, kind, slug, ui: ui.get(lang) });

  // Répartition des verdicts sur tout le catalogue — voir site-page-stats.mjs,
  // bloc « catalogue en chiffres » : un seul calcul, partagé par toutes les
  // langues, jamais recopié à la main.
  const verdictCounts = { yes: 0, kinda: 0, no: 0 };
  for (const tool of tools.values()) verdictCounts[tool.verdict] += 1;

  for (const lang of langs) {
    const langUi = ui.get(lang);
    // On teste `site.brand` et non la simple présence de `site` : depuis que la
    // page /stats existe dans les sept langues, les sept ui.json portent un bloc
    // `site` — réduit à { footer, stats } pour les cinq non publiées. Tester la
    // présence du bloc laissait donc passer une locale incomplète, et le build
    // cassait plus loin sur un `ui.site.skipToContent` indéfini, avec une
    // TypeError opaque au lieu du message qui dit quoi faire. `brand` est la
    // sentinelle : elle n'existe que dans un bloc site complet.
    if (!langUi?.site?.brand) {
      throw new Error(
        `data/i18n/${lang}/ui.json ne porte pas les chaînes du site — impossible de générer les pages en ${lang}. ` +
        'Ajouter le bloc "site" complet (voir data/i18n/en/ui.json) avant de déclarer cette langue dans markets.'
      );
    }

    // Icônes des sponsors, indexées par domaine (sponsorFavicons, calculé plus
    // haut) : un sponsor n'a pas de fiche catalogue, donc pas de slug. Un
    // domaine dont la récupération a échoué retombe sur PLACEHOLDER_PATH —
    // voir renderCard/renderTapeItem dans site-sponsors.mjs.
    //
    // Le contexte est gardé en plus du balisage : la page /sponsor (tâche 8) a
    // besoin de savoir quels slots sont pris pour son tableau d'inventaire.
    //
    // `liveSlots` entre ICI, et nulle part ailleurs : sponsorContext croise
    // data/sponsors.json et la charge utile du Worker en une seule occupation
    // (mergeOccupancy), dont dérivent à la fois les cartes/bandeaux et le
    // tableau d'inventaire. Deux croisements séparés faisaient annoncer deux
    // prix différents pour le même emplacement sur la même page.
    const sponsorCtx = sponsorContext({
      placements: data.sponsors.placements, today, lang, ui: langUi,
      favicons: sponsorFavicons, sponsorHref: `/${lang}/sponsor`,
      liveSlots: sponsorSlotsLive,
    });
    const sponsorSlots = renderSponsorSlots(sponsorCtx);

    const toolViews = buildToolViews(tools, i18n, lang, voteCounts, projects, today);
    const categorySlugs = categoriesForLang(tools, lang);
    const topCategorySlugs = topCategoriesByCount(tools, lang, HOME_TOP_CATEGORIES);
    const homePath = `/${lang}/`;

    // Accueil — seulement les catégories les plus peuplées (topCategorySlugs) ;
    // categorySlugs (toutes) sert à la page /categories/ juste après.
    await writeText(
      join(OUT, lang, 'index.html'),
      renderHomePage({
        lang, path: homePath, toolViews, topCategorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
        ui: langUi, alternates: homeAlt, xDefaultPath: homeXDefault, sponsorSlots, buildDate: today,
      })
    );
    sitemapPages.push({ path: homePath });

    // Page "toutes les catégories" — cible du dernier chip de l'accueil.
    const allCategoriesPath = `${homePath}categories/`;
    const allCategoriesAlt = langs.map((l) => ({ lang: l, path: `/${l}/categories/` }));
    const countsBySlug = Object.fromEntries(
      categorySlugs.map((slug) => [slug, toolViews.filter((t) => t.category === slug).length])
    );
    await writeText(
      join(OUT, lang, 'categories', 'index.html'),
      renderCategoriesIndexPage({
        lang, path: allCategoriesPath, categorySlugs, categories, countsBySlug,
        ui: langUi, alternates: allCategoriesAlt, xDefaultPath: xDefaultOf(allCategoriesAlt), homePath, sponsorSlots,
      })
    );
    sitemapPages.push({ path: allCategoriesPath });

    // Page /sponsor — la page qui vend les emplacements. Elle porte elle
    // aussi ses rails et ses bandeaux (sponsorSlots) : ce n'est pas une
    // exception au reste du site. sponsorCtx (le contexte, pas le balisage
    // déjà rendu) lui sert en plus à savoir quel slot de l'inventaire est pris.
    const sponsorPath = `/${lang}/sponsor`;
    const sponsorAlt = langs.map((l) => ({ lang: l, path: `/${l}/sponsor` }));
    await writeText(
      join(OUT, lang, 'sponsor', 'index.html'),
      renderSponsorPage({
        lang, path: sponsorPath, ui: langUi, alternates: sponsorAlt,
        xDefaultPath: xDefaultOf(sponsorAlt), homePath,
        sponsors: sponsorCtx, sponsorSlots, figures, stats,
      })
    );
    sitemapPages.push({ path: sponsorPath });

    // Page stats — coquille build-time, chiffres vivants côté client.
    const statsPath = `${homePath}stats/`;
    const statsAlt = langs.map((l) => ({ lang: l, path: `/${l}/stats/` }));
    await writeText(
      join(OUT, lang, 'stats', 'index.html'),
      renderStatsPage({
        lang, path: statsPath, ui: langUi, alternates: statsAlt,
        xDefaultPath: xDefaultOf(statsAlt), homePath,
        toolCount: tools.size, verdictCounts,
      })
    );
    sitemapPages.push({ path: statsPath });

    // Catégories
    for (const categorySlug of categorySlugs) {
      const catLangs = langsForCategory(tools, categorySlug);
      const catAlt = catLangs.map((l) => ({ lang: l, path: `/${l}/categories/${categorySlug}` }));
      const catPath = `/${lang}/categories/${categorySlug}`;
      const catToolViews = toolViews.filter((t) => t.category === categorySlug);
      await writeText(
        join(OUT, lang, 'categories', categorySlug, 'index.html'),
        renderCategoryPage({
          lang, path: catPath, categorySlug, categories, toolViews: catToolViews, voteCounts, favicons,
          ui: langUi, alternates: catAlt, xDefaultPath: xDefaultOf(catAlt), homePath, sponsorSlots,
        })
      );
      sitemapPages.push({ path: catPath });
      categoryPageCount += 1;
    }

    // Fiches outil
    for (const tool of toolsForLang(tools, lang)) {
      const i18nEntry = i18n.get(`${lang}/${tool.slug}`);
      const toolAlt = tool.markets.map((l) => ({ lang: l, path: `/${l}/tools/${tool.slug}` }));
      const toolPath = `/${lang}/tools/${tool.slug}`;
      const relatedTools = tool.relatedSlugs
        .map((slug) => tools.get(slug))
        .filter((related) => related && related.markets.includes(lang))
        .map((related) => ({
          slug: related.slug, name: related.name, verdict: related.verdict,
          pricing: related.pricing, category: related.category,
          path: `/${lang}/tools/${related.slug}`,
        }));

      await writeText(
        join(OUT, lang, 'tools', tool.slug, 'index.html'),
        renderToolPage({
          lang, path: toolPath, tool, i18nEntry, categories,
          ui: langUi, alternates: toolAlt, xDefaultPath: xDefaultOf(toolAlt), homePath,
          categoryPath: `/${lang}/categories/${tool.category}`,
          relatedTools, voteCount: voteCountFor(voteCounts, tool.slug), favicons, agents, sponsorSlots,
          // Date du verdict (build) et date de fraîcheur des chiffres GitHub :
          // la même date unique que l'accueil, calculée dans main().
          buildDate: today,
          projects, projectI18n, today,
          // Lien vers /{lang}/oss/{slug} seulement si cette page est indexable
          // (spec D7) ; sinon la fiche renvoie au site du projet.
          projectIndexable: projectIndexableIn(lang),
          comparisons: comparisonsOf(lang, 'tool', tool.slug),
        })
      );
      // Une fiche est toujours dans le sitemap (Ruling 2), datée de son
      // relevé le plus récent (prix ou chiffres GitHub affichés), comme
      // WebPage.dateModified dans la page.
      sitemapPages.push({ path: toolPath, lastmod: toolDateModified(tool, alternativesFor(tool, projects, today)) });
      toolPageCount += 1;
    }

    // Pages projet de la langue. Une page non indexable (projet inactif, ou
    // cité par aucune fiche) est écrite en noindex,follow et reste hors
    // sitemap (spec D7).
    for (const page of projectPlan.filter((entry) => entry.lang === lang)) {
      const { project } = page;
      const category = project.categories[0];
      const html = renderProjectPage({
        lang, path: page.path, project, i18nEntry: page.i18nEntry,
        replaced: replacedTools(project.slug, tools),
        related: relatedProjects(project, projects, today),
        ui: langUi, alternates: page.alternates, xDefaultPath: page.xDefaultPath, homePath,
        categories, categoryPath: categorySlugs.includes(category) ? `/${lang}/categories/${category}` : null,
        buildDate: today, today, indexable: page.indexable,
        projectIndexable: projectIndexableIn(lang), projectI18n, sponsorSlots,
        comparisons: comparisonsOf(lang, 'project', project.slug),
      });
      await writeText(join(OUT, lang, 'oss', project.slug, 'index.html'), html);
      if (page.indexable) {
        const lastmod = projectDateModified(project);
        sitemapPages.push(lastmod ? { path: page.path, lastmod } : { path: page.path });
      }
      projectPageCount += 1;
    }

    // Comparatifs de la langue. Un côté projet inactif (archivé, ou sans
    // commit depuis un an) : page écrite en noindex,follow, hors sitemap.
    for (const page of comparePlan.filter((entry) => entry.lang === lang)) {
      const withText = (side) => ({
        ...side, i18n: (side.kind === 'tool' ? i18n : projectI18n).get(`${lang}/${side.entity.slug}`),
      });
      const category = compareCategory(page.left);
      const html = renderComparePage({
        lang, path: page.path, left: withText(page.left), right: withText(page.right), i18nEntry: page.i18nEntry,
        ui: langUi, alternates: page.alternates, xDefaultPath: page.xDefaultPath, homePath,
        categories, categoryPath: categorySlugs.includes(category) ? `/${lang}/categories/${category}` : null,
        buildDate: today, today, indexable: page.indexable,
        projectIndexable: projectIndexableIn(lang), sponsorSlots,
      });
      await writeText(join(OUT, lang, 'compare', page.key, 'index.html'), html);
      if (page.indexable) {
        const lastmod = compareDateModified(page.left, page.right);
        sitemapPages.push(lastmod ? { path: page.path, lastmod } : { path: page.path });
      }
      comparePageCount += 1;
    }
  }

  // ---- artefacts partagés -------------------------------------------------
  // Sous /assets/v/<empreinte>/ et nulle part ailleurs (voir site-assets.mjs) :
  // le contenu écrit est exactement celui dont l'empreinte a été calculée.
  for (const [name, text] of Object.entries(ASSET_FILES)) {
    await writeText(join(OUT, ...ASSET_DIR.split('/').filter(Boolean), name), text);
  }
  // privacy.html est statique dans public/ (copié par build-feed) : on le
  // réécrit pour qu'il charge la feuille versionnée, comme toutes les pages.
  const privacy = await readFile(join('public', 'privacy.html'), 'utf8');
  await writeText(join(OUT, 'privacy.html'), privacy.replace('href="/assets/site.css"', `href="${assetUrl('site.css')}"`));
  await writeText(join(OUT, 'sitemap.xml'), buildSitemap(sitemapPages));
  console.log(
    `Site écrit dans ${OUT}/ — ${langs.length} langue(s), ${toolPageCount} fiche(s), ` +
    `${categoryPageCount} page(s) de catégorie, ${projectPageCount} page(s) projet, ` +
    `${comparePageCount} comparatif(s), ` +
    `${sitemapPages.length} URL(s) dans le sitemap (${SITE_ORIGIN}).`
  );
}

await main();
