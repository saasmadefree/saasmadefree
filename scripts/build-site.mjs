// Génère le site public statique (accueil, fiches, pages de catégorie) dans
// dist/, à partir des mêmes données que le feed (scripts/build-feed.mjs, qui
// doit avoir tourné juste avant — voir npm run build). Aucune dépendance,
// aucun framework : uniquement du Node ESM qui écrit du HTML/CSS/JS brut.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadData } from './lib/load-data.mjs';
import {
  alternativesFor, replacedTools, toolDateModified, popularAlternatives, indexable, POPULAR_LIMIT,
} from './lib/site-alternatives.mjs';
import {
  SITE_ORIGIN, fetchVoteCounts, fetchStats, fetchSponsorSlots, siteLanguages, toolsForLang, sortTools,
  categoriesForLang, topCategoriesByCount, langsForCategory, catalogueFigures, mrrDestroyed,
} from './lib/site-data.mjs';
import { fetchFavicons } from './lib/site-favicons.mjs';
import { buildSitemaps, listSitemapEntries, languageVersions, pageFile } from './lib/site-seo.mjs';
import { renderHomePage } from './lib/site-page-home.mjs';
import { renderCategoryPage, categoryProjects, categoryIndexable } from './lib/site-page-category.mjs';
import { renderCategoriesIndexPage } from './lib/site-page-categories-index.mjs';
import {
  renderCollectionPage, collectionTools, collectionPath, COLLECTION_KINDS,
} from './lib/site-page-collection.mjs';
import { renderAlternativesHub, hubPath } from './lib/site-page-alternatives-hub.mjs';
import { renderSponsorPage } from './lib/site-page-sponsor.mjs';
import { renderToolPage } from './lib/site-page-tool.mjs';
import { newsletterConfig, renderNewsletterForm } from './lib/site-newsletter.mjs';
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

/** Écrit une page à l'endroit d'où Cloudflare Pages sert son URL en 200
 *  (pageFile) : `/en/tools/x` → en/tools/x.html, `/en/` → en/index.html. */
async function writePage(path, html) {
  await writeText(join(OUT, ...pageFile(path).split('/')), html);
}

function xDefaultOf(alternates) {
  if (alternates.length === 0) return null;
  return (alternates.find((a) => a.lang === 'en') ?? alternates[0]).path;
}

/** La plus récente de dates 'YYYY-MM-DD' (comparaison binaire), null sans date. */
function latestOf(dates) {
  const known = dates.filter(Boolean);
  return known.length ? known.reduce((max, d) => (d > max ? d : max)) : null;
}

/** Entrée de sitemap, lastmod seulement quand elle est connue. */
function sitemapEntry(kind, path, lastmod = null) {
  return lastmod ? { kind, path, lastmod } : { kind, path };
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

  // Newsletter SmartLetter (spec D13) : sans SMARTLETTER_SIGNUPS_KEY, aucun
  // formulaire n'est rendu. La clé n'est jamais journalisée : on dit
  // seulement si elle est là.
  const newsletter = newsletterConfig(process.env);
  console.log(newsletter
    ? `Newsletter SmartLetter : formulaire rendu${newsletter.segmentId ? ', avec segment' : ''}.`
    : 'Newsletter SmartLetter : SMARTLETTER_SIGNUPS_KEY absente, aucun formulaire rendu.');


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

  // Entrées de sitemap, par type (buildSitemaps). La racine n'y est pas :
  // c'est une redirection (meta refresh) vers /en/, pas une page à indexer.
  const sitemapPages = [sitemapEntry('pages', '/privacy')];

  // ---- page racine ------------------------------------------------------
  const enPath = langs.includes('en') ? '/en/' : `/${langs[0]}/`;
  const rootUi = ui.get('en') ?? ui.get(langs[0]);
  await writePage(
    '/',
    renderRootPage({ ui: rootUi, enPath, otherLangs: langs.filter((l) => `/${l}/` !== enPath) })
  );

  // ---- 404 ---------------------------------------------------------------
  // Cloudflare Pages sert ce fichier, avec un vrai statut 404, pour toute URL
  // sans fichier correspondant. Sans lui, Pages renvoyait la page racine en
  // 200 pour n'importe quel chemin — voir scripts/lib/site-page-404.mjs.
  await writeText(join(OUT, '404.html'), render404Page({ ui: rootUi, enPath, langs }));

  // ---- par langue : accueil, fiches, catégories --------------------------
  const homeAlt = languageVersions(langs, (l) => `/${l}/`);
  const homeXDefault = xDefaultOf(homeAlt);
  let toolPageCount = 0;
  let categoryPageCount = 0;
  let projectPageCount = 0;
  let comparePageCount = 0;
  // Pages de liste (catégories, collections, hub) écrites en noindex,follow
  // faute d'atteindre 3 éléments (spec D7) : comptées pour le journal du build.
  let noindexListCount = 0;
  let collectionPageCount = 0;

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

  // Vues des fiches de chaque langue, calculées AVANT la boucle : la porte D7
  // d'une page de liste dans une langue décide de son hreflang dans TOUTES
  // les autres (Ruling 29). Une version noindex n'est citée par aucune.
  const toolViewsByLang = new Map(langs.map((l) => [l, buildToolViews(tools, i18n, l, voteCounts, projects, today)]));
  const viewsIn = (l, category) => toolViewsByLang.get(l).filter((t) => t.category === category);
  const categoryGate = (category) => (l) => categoryIndexable(viewsIn(l, category), categoryProjects(viewsIn(l, category), projects, today));
  const collectionGate = (kind) => (l) => indexable.list(collectionTools(kind, toolViewsByLang.get(l), { projects, today }));
  const hubGate = (l) => indexable.list(toolViewsByLang.get(l));
  // Date réelle de chaque fiche (prix ou chiffres GitHub), une fois : la
  // lastmod d'une page de liste est la plus récente de ses fiches.
  const toolLastmod = new Map([...tools.values()].map((tool) => [tool.slug, toolDateModified(tool, alternativesFor(tool, projects, today))]));
  const lastmodOf = (views) => latestOf(views.map((t) => toolLastmod.get(t.slug)));

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
    if (newsletter && !langUi.site.newsletter) {
      throw new Error(
        `data/i18n/${lang}/ui.json ne porte pas site.newsletter alors que SMARTLETTER_SIGNUPS_KEY est définie. ` +
        'Ajouter le bloc (voir data/i18n/en/ui.json) : sans lui, la langue n’aurait pas de formulaire.'
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

    const toolViews = toolViewsByLang.get(lang);
    const categorySlugs = categoriesForLang(tools, lang);
    const topCategorySlugs = topCategoriesByCount(tools, lang, HOME_TOP_CATEGORIES);
    const homePath = `/${lang}/`;

    // Accueil — seulement les catégories les plus peuplées (topCategorySlugs) ;
    // categorySlugs (toutes) sert à la page /categories/ juste après.
    await writePage(
      homePath,
      renderHomePage({
        lang, path: homePath, toolViews, topCategorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
        ui: langUi, alternates: homeAlt, xDefaultPath: homeXDefault, sponsorSlots, buildDate: today,
        newsletter: renderNewsletterForm({ lang, ui: langUi, config: newsletter, variant: 'hero' }),
      })
    );
    sitemapPages.push(sitemapEntry('pages', homePath, lastmodOf(toolViews)));

    // Page "toutes les catégories" — cible du dernier chip de l'accueil.
    const allCategoriesPath = `${homePath}categories/`;
    const allCategoriesAlt = languageVersions(langs, (l) => `/${l}/categories/`);
    const countsBySlug = Object.fromEntries(
      categorySlugs.map((slug) => [slug, toolViews.filter((t) => t.category === slug).length])
    );
    // Projets classés par chaque page de catégorie : calculés une fois, pour
    // le répertoire (nombre de projets), la page elle-même et sa porte D7.
    const rankedByCategory = new Map(categorySlugs.map((slug) => [
      slug, categoryProjects(toolViews.filter((t) => t.category === slug), projects, today),
    ]));
    const projectCountsBySlug = Object.fromEntries(
      categorySlugs.map((slug) => [slug, rankedByCategory.get(slug).length])
    );
    await writePage(
      allCategoriesPath,
      renderCategoriesIndexPage({
        lang, path: allCategoriesPath, categorySlugs, categories, countsBySlug, projectCountsBySlug,
        ui: langUi, alternates: allCategoriesAlt, xDefaultPath: xDefaultOf(allCategoriesAlt), homePath, sponsorSlots,
      })
    );
    sitemapPages.push(sitemapEntry('lists', allCategoriesPath, lastmodOf(toolViews)));

    // Page /sponsor — la page qui vend les emplacements. Elle porte elle
    // aussi ses rails et ses bandeaux (sponsorSlots) : ce n'est pas une
    // exception au reste du site. sponsorCtx (le contexte, pas le balisage
    // déjà rendu) lui sert en plus à savoir quel slot de l'inventaire est pris.
    const sponsorPath = `/${lang}/sponsor`;
    const sponsorAlt = languageVersions(langs, (l) => `/${l}/sponsor`);
    await writePage(
      sponsorPath,
      renderSponsorPage({
        lang, path: sponsorPath, ui: langUi, alternates: sponsorAlt,
        xDefaultPath: xDefaultOf(sponsorAlt), homePath,
        sponsors: sponsorCtx, sponsorSlots, figures, stats,
      })
    );
    sitemapPages.push(sitemapEntry('pages', sponsorPath));

    // Page stats — coquille build-time, chiffres vivants côté client.
    const statsPath = `${homePath}stats/`;
    const statsAlt = languageVersions(langs, (l) => `/${l}/stats/`);
    await writePage(
      statsPath,
      renderStatsPage({
        lang, path: statsPath, ui: langUi, alternates: statsAlt,
        xDefaultPath: xDefaultOf(statsAlt), homePath,
        toolCount: tools.size, verdictCounts,
      })
    );
    sitemapPages.push(sitemapEntry('pages', statsPath));

    // Pages de liste (catégories, collections, hub) et leur porte D7.
    const listPages = [];

    // Catégories
    for (const categorySlug of categorySlugs) {
      const catLangs = langsForCategory(tools, categorySlug);
      const catAlt = languageVersions(
        catLangs.filter((l) => langs.includes(l)), (l) => `/${l}/categories/${categorySlug}`, categoryGate(categorySlug),
      );
      const catPath = `/${lang}/categories/${categorySlug}`;
      const catToolViews = toolViews.filter((t) => t.category === categorySlug);
      await writePage(
        catPath,
        renderCategoryPage({
          lang, path: catPath, categorySlug, categories, toolViews: catToolViews, voteCounts, favicons,
          ui: langUi, alternates: catAlt, xDefaultPath: xDefaultOf(catAlt), homePath, sponsorSlots,
          projects, projectI18n, buildDate: today, today, projectIndexable: projectIndexableIn(lang),
        })
      );
      // Moins de 3 éléments (SaaS et projets confondus) : noindex,follow,
      // hors sitemap (spec D7). L'URL, elle, ne change pas.
      listPages.push({
        path: catPath, indexable: categoryIndexable(catToolViews, rankedByCategory.get(categorySlug)), lastmod: lastmodOf(catToolViews),
      });
      categoryPageCount += 1;
    }

    // Collections /{lang}/collections/{kind} (spec D5) : toutes les langues
    // publiées, noindex sous 3 éléments.
    for (const kind of COLLECTION_KINDS) {
      const items = collectionTools(kind, toolViews, { projects, today });
      const colPath = collectionPath(lang, kind);
      const colAlt = languageVersions(langs, (l) => collectionPath(l, kind), collectionGate(kind));
      await writePage(
        colPath,
        renderCollectionPage({
          kind, lang, path: colPath, items, categories, voteCounts, favicons,
          ui: langUi, alternates: colAlt, xDefaultPath: xDefaultOf(colAlt), homePath, sponsorSlots, buildDate: today,
        })
      );
      listPages.push({ path: colPath, indexable: indexable.list(items), lastmod: lastmodOf(items) });
      collectionPageCount += 1;
    }

    // Hub A–Z /{lang}/alternatives/ : chaque fiche de la langue avec son
    // nombre d'alternatives affichables (le même que celui des cartes).
    const hubAlt = languageVersions(langs, hubPath, hubGate);
    await writePage(
      hubPath(lang),
      renderAlternativesHub({
        lang, path: hubPath(lang), tools: toolViews,
        counts: Object.fromEntries(toolViews.map((t) => [t.slug, t.alternativeNames.length])),
        ui: langUi, alternates: hubAlt, xDefaultPath: xDefaultOf(hubAlt), homePath, sponsorSlots, buildDate: today,
      })
    );
    listPages.push({ path: hubPath(lang), indexable: indexable.list(toolViews), lastmod: lastmodOf(toolViews) });

    // Pages de liste de la langue → sitemap, par la seule porte D7 testée
    // (listSitemapEntries) : une page noindex n'y entre jamais.
    sitemapPages.push(...listSitemapEntries(listPages).map(({ path, lastmod }) => sitemapEntry('lists', path, lastmod)));
    noindexListCount += listPages.filter((page) => !page.indexable).length;

    // Fiches outil. Le bloc newsletter du bas de fiche est le même sur toutes
    // les fiches d'une langue : rendu une fois.
    const toolNewsletter = renderNewsletterForm({ lang, ui: langUi, config: newsletter, variant: 'footer' });
    for (const tool of toolsForLang(tools, lang)) {
      const i18nEntry = i18n.get(`${lang}/${tool.slug}`);
      const toolAlt = languageVersions(tool.markets.filter((l) => langs.includes(l)), (l) => `/${l}/tools/${tool.slug}`);
      const toolPath = `/${lang}/tools/${tool.slug}`;
      const relatedTools = tool.relatedSlugs
        .map((slug) => tools.get(slug))
        .filter((related) => related && related.markets.includes(lang))
        .map((related) => ({
          slug: related.slug, name: related.name, verdict: related.verdict,
          pricing: related.pricing, category: related.category,
          path: `/${lang}/tools/${related.slug}`,
        }));

      await writePage(
        toolPath,
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
          // « People also look for alternatives to… » : calculé par fiche,
          // même catégorie d'abord, puis le classement global (Ruling 26).
          popularTools: popularAlternatives(toolViews, lang, POPULAR_LIMIT, { current: tool }),
          newsletter: toolNewsletter,
        })
      );
      // Une fiche est toujours dans le sitemap (Ruling 2), datée de son
      // relevé le plus récent (prix ou chiffres GitHub affichés), comme
      // WebPage.dateModified dans la page.
      sitemapPages.push(sitemapEntry('tools', toolPath, toolLastmod.get(tool.slug)));
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
      await writePage(page.path, html);
      if (page.indexable) {
        sitemapPages.push(sitemapEntry('projects', page.path, projectDateModified(project)));
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
      await writePage(page.path, html);
      if (page.indexable) {
        sitemapPages.push(sitemapEntry('compare', page.path, compareDateModified(page.left, page.right)));
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
  // Un sitemap par type et leur index (robots.txt pointe sur l'index).
  // /sitemap.xml reste servi, avec le même index : c'est l'adresse déjà
  // déclarée à la Search Console, elle ne doit pas tomber en 404.
  const sitemaps = buildSitemaps(sitemapPages);
  for (const file of sitemaps.files) await writeText(join(OUT, file.name), file.xml);
  await writeText(join(OUT, 'sitemap-index.xml'), sitemaps.index);
  await writeText(join(OUT, 'sitemap.xml'), sitemaps.index);
  console.log(
    `Site écrit dans ${OUT}/ — ${langs.length} langue(s), ${toolPageCount} fiche(s), ` +
    `${categoryPageCount} page(s) de catégorie, ${projectPageCount} page(s) projet, ` +
    `${comparePageCount} comparatif(s), ${collectionPageCount} collection(s), ${langs.length} hub(s) A–Z, ` +
    `${noindexListCount} page(s) de liste en noindex, ` +
    `${sitemapPages.length} URL(s) dans les sitemaps (${sitemaps.files.map((f) => `${f.name} ${f.count}`).join(', ')}, ${SITE_ORIGIN}).`
  );
}

await main();
