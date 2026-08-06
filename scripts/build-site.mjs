// Génère le site public statique (accueil, fiches, pages de catégorie) dans
// dist/, à partir des mêmes données que le feed (scripts/build-feed.mjs, qui
// doit avoir tourné juste avant — voir npm run build). Aucune dépendance,
// aucun framework : uniquement du Node ESM qui écrit du HTML/CSS/JS brut.
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadData } from './lib/load-data.mjs';
import {
  SITE_ORIGIN, fetchVoteCounts, siteLanguages, toolsForLang, sortTools,
  categoriesForLang, topCategoriesByCount, langsForCategory, catalogueFigures, mrrDestroyed,
} from './lib/site-data.mjs';
import { fetchFavicons } from './lib/site-favicons.mjs';
import { SITE_CSS } from './lib/site-styles.mjs';
import { buildSitemap } from './lib/site-seo.mjs';
import { renderHomePage } from './lib/site-page-home.mjs';
import { renderCategoryPage } from './lib/site-page-category.mjs';
import { renderCategoriesIndexPage } from './lib/site-page-categories-index.mjs';
import { renderToolPage } from './lib/site-page-tool.mjs';
import { renderStatsPage } from './lib/site-page-stats.mjs';
import { renderRootPage } from './lib/site-page-root.mjs';
import { render404Page } from './lib/site-page-404.mjs';
import { renderBeaconScript } from './lib/site-beacon.mjs';

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

function buildToolViews(tools, i18n, lang, voteCounts) {
  const list = toolsForLang(tools, lang).map((tool) => ({
    ...tool,
    tagline: i18n.get(`${lang}/${tool.slug}`).tagline,
    path: `/${lang}/tools/${tool.slug}`,
  }));
  return sortTools(list, voteCounts);
}

function voteCountFor(voteCounts, slug) {
  if (!voteCounts) return null;
  return Object.prototype.hasOwnProperty.call(voteCounts, slug) ? voteCounts[slug] : 0;
}

async function main() {
  const data = await loadData(process.cwd());
  const { tools, i18n, ui, categories, agents } = data;

  const voteCounts = await fetchVoteCounts();
  if (voteCounts) {
    console.log(`Compteurs de votes récupérés en direct pour ${Object.keys(voteCounts).length} slug(s).`);
  } else {
    console.log('Service de vote injoignable au build — tri sur pagePriority, aucun compteur affiché.');
  }

  // Icônes des outils, récupérées une fois au build et mises en cache sous un
  // dossier ignoré par git (voir .gitignore) : une reconstruction locale ne
  // refait jamais la requête réseau, et un échec de récupération ne casse
  // jamais le build — voir scripts/lib/site-favicons.mjs.
  const { bySlug: favicons, stats: faviconStats } = await fetchFavicons(tools, {
    cacheDir: join('.cache', 'favicons'),
    outDir: join(OUT, 'assets', 'favicons'),
  });
  console.log(
    `Icônes : ${faviconStats.fetched} récupérée(s), ${faviconStats.cached} depuis le cache, ` +
    `${faviconStats.placeholder} en repli sur ${faviconStats.total} outil(s).`
  );

  const langs = siteLanguages(tools);
  if (langs.length === 0) {
    throw new Error("Aucune langue n'est déclarée par une fiche data/tools/*.json — rien à générer.");
  }

  // Chiffres réels du catalogue (bandeau "figures" de l'accueil) et dépense
  // mensuelle représentée par les votes enregistrés (bandeau-ticker) — voir
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

  // Répartition des verdicts sur tout le catalogue — voir site-page-stats.mjs,
  // bloc « catalogue en chiffres » : un seul calcul, partagé par toutes les
  // langues, jamais recopié à la main.
  const verdictCounts = { yes: 0, kinda: 0, no: 0 };
  for (const tool of tools.values()) verdictCounts[tool.verdict] += 1;

  for (const lang of langs) {
    const langUi = ui.get(lang);
    if (!langUi?.site) {
      throw new Error(
        `data/i18n/${lang}/ui.json ne porte pas de bloc "site" — impossible de générer les pages en ${lang}. ` +
        'Ajouter les chaînes du site (voir data/i18n/en/ui.json) avant de déclarer cette langue dans markets.'
      );
    }

    const toolViews = buildToolViews(tools, i18n, lang, voteCounts);
    const categorySlugs = categoriesForLang(tools, lang);
    const topCategorySlugs = topCategoriesByCount(tools, lang, HOME_TOP_CATEGORIES);
    const homePath = `/${lang}/`;

    // Accueil — seulement les catégories les plus peuplées (topCategorySlugs) ;
    // categorySlugs (toutes) sert à la page /categories/ juste après.
    await writeText(
      join(OUT, lang, 'index.html'),
      renderHomePage({
        lang, path: homePath, toolViews, topCategorySlugs, categories, voteCounts, favicons, figures, mrrTotal,
        ui: langUi, alternates: homeAlt, xDefaultPath: homeXDefault,
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
        ui: langUi, alternates: allCategoriesAlt, xDefaultPath: xDefaultOf(allCategoriesAlt), homePath,
      })
    );
    sitemapPages.push({ path: allCategoriesPath });

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
          ui: langUi, alternates: catAlt, xDefaultPath: xDefaultOf(catAlt), homePath,
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
          relatedTools, voteCount: voteCountFor(voteCounts, tool.slug), favicons, agents,
        })
      );
      sitemapPages.push({ path: toolPath, lastmod: tool.pricing.checkedOn });
      toolPageCount += 1;
    }
  }

  // ---- artefacts partagés -------------------------------------------------
  await writeText(join(OUT, 'assets', 'site.css'), SITE_CSS);
  await cp(join('scripts', 'assets', 'site.js'), join(OUT, 'assets', 'site.js'));
  await cp(join('scripts', 'assets', 'stats.js'), join(OUT, 'assets', 'stats.js'));
  await writeText(join(OUT, 'assets', 'beacon.js'), renderBeaconScript());
  await writeText(join(OUT, 'sitemap.xml'), buildSitemap(sitemapPages));
  console.log(
    `Site écrit dans ${OUT}/ — ${langs.length} langue(s), ${toolPageCount} fiche(s), ` +
    `${categoryPageCount} page(s) de catégorie, ${sitemapPages.length} URL(s) dans le sitemap (${SITE_ORIGIN}).`
  );
}

await main();
