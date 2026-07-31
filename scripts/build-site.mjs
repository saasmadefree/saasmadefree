// Génère le site public statique (accueil, fiches, pages de catégorie) dans
// dist/, à partir des mêmes données que le feed (scripts/build-feed.mjs, qui
// doit avoir tourné juste avant — voir npm run build). Aucune dépendance,
// aucun framework : uniquement du Node ESM qui écrit du HTML/CSS/JS brut.
import { mkdir, writeFile, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadData } from './lib/load-data.mjs';
import {
  SITE_ORIGIN, fetchVoteCounts, siteLanguages, toolsForLang, sortTools,
  categoriesForLang, langsForCategory,
} from './lib/site-data.mjs';
import { SITE_CSS } from './lib/site-styles.mjs';
import { buildSitemap } from './lib/site-seo.mjs';
import { renderHomePage } from './lib/site-page-home.mjs';
import { renderCategoryPage } from './lib/site-page-category.mjs';
import { renderToolPage } from './lib/site-page-tool.mjs';
import { renderRootPage } from './lib/site-page-root.mjs';

const OUT = 'dist';

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
  const { tools, i18n, ui, categories } = data;

  const voteCounts = await fetchVoteCounts();
  if (voteCounts) {
    console.log(`Compteurs de votes récupérés en direct pour ${Object.keys(voteCounts).length} slug(s).`);
  } else {
    console.log('Service de vote injoignable au build — tri sur pagePriority, aucun compteur affiché.');
  }

  const langs = siteLanguages(tools);
  if (langs.length === 0) {
    throw new Error("Aucune langue n'est déclarée par une fiche data/tools/*.json — rien à générer.");
  }

  const sitemapPages = [{ path: '/' }, { path: '/privacy' }];

  // ---- page racine ------------------------------------------------------
  const enPath = langs.includes('en') ? '/en/' : `/${langs[0]}/`;
  const rootUi = ui.get('en') ?? ui.get(langs[0]);
  await writeText(
    join(OUT, 'index.html'),
    renderRootPage({ ui: rootUi, enPath, otherLangs: langs.filter((l) => `/${l}/` !== enPath) })
  );

  // ---- par langue : accueil, fiches, catégories --------------------------
  const homeAlt = homeAlternates(langs);
  const homeXDefault = xDefaultOf(homeAlt);
  let toolPageCount = 0;
  let categoryPageCount = 0;

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
    const homePath = `/${lang}/`;

    // Accueil
    await writeText(
      join(OUT, lang, 'index.html'),
      renderHomePage({
        lang, path: homePath, toolViews, categorySlugs, categories, voteCounts,
        ui: langUi, alternates: homeAlt, xDefaultPath: homeXDefault,
      })
    );
    sitemapPages.push({ path: homePath });

    // Catégories
    for (const categorySlug of categorySlugs) {
      const catLangs = langsForCategory(tools, categorySlug);
      const catAlt = catLangs.map((l) => ({ lang: l, path: `/${l}/categories/${categorySlug}` }));
      const catPath = `/${lang}/categories/${categorySlug}`;
      const catToolViews = toolViews.filter((t) => t.category === categorySlug);
      await writeText(
        join(OUT, lang, 'categories', categorySlug, 'index.html'),
        renderCategoryPage({
          lang, path: catPath, categorySlug, categories, toolViews: catToolViews, voteCounts,
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
        .map((related) => ({ slug: related.slug, name: related.name, verdict: related.verdict, path: `/${lang}/tools/${related.slug}` }));

      await writeText(
        join(OUT, lang, 'tools', tool.slug, 'index.html'),
        renderToolPage({
          lang, path: toolPath, tool, i18nEntry, categories,
          ui: langUi, alternates: toolAlt, xDefaultPath: xDefaultOf(toolAlt), homePath,
          categoryPath: `/${lang}/categories/${tool.category}`,
          relatedTools, voteCount: voteCountFor(voteCounts, tool.slug),
        })
      );
      sitemapPages.push({ path: toolPath, lastmod: tool.pricing.checkedOn });
      toolPageCount += 1;
    }
  }

  // ---- artefacts partagés -------------------------------------------------
  await writeText(join(OUT, 'assets', 'site.css'), SITE_CSS);
  await cp(join('scripts', 'assets', 'site.js'), join(OUT, 'assets', 'site.js'));
  await writeText(join(OUT, 'sitemap.xml'), buildSitemap(sitemapPages));

  console.log(
    `Site écrit dans ${OUT}/ — ${langs.length} langue(s), ${toolPageCount} fiche(s), ` +
    `${categoryPageCount} page(s) de catégorie, ${sitemapPages.length} URL(s) dans le sitemap (${SITE_ORIGIN}).`
  );
}

await main();
