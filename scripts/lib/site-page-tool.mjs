import { escapeHtml, renderLayout, renderBreadcrumb, verdictBadge } from './site-html.mjs';
import { categoryLabel, categoryEmoji, SITE_ORIGIN } from './site-data.mjs';
import {
  formatMoney, formatMonthlyPrice, formatDate, interpolate, pluralize, MONTHLY_BASES,
} from './site-format.mjs';
import {
  organizationJsonLd, faqPageJsonLd, breadcrumbJsonLd,
} from './site-seo.mjs';
import { PLACEHOLDER_PATH } from './site-favicons.mjs';
import { FEED_VERSION } from './feed.mjs';
// Le bouton "Open in <agent>" ne doit jamais réimplémenter la logique de
// résolution d'action de l'extension : on importe directement le module que
// l'extension elle-même utilise (voir extension/lib/template.mjs et
// extension/popup/popup.mjs). Le fichier est pur ESM sans API navigateur,
// donc réutilisable tel quel côté build Node.
import { resolveAction } from '../../extension/lib/template.mjs';

function sourceHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Un bouton par agent *vérifié* de data/agents.json (voir CONTRIBUTING.md :
 *  un agent "untested" ou "not-yet" n'est pas montré ici). L'action (url,
 *  deeplink ou presse-papier) est résolue une fois pour toutes au build avec
 *  la même fonction que l'extension, donc le bouton est un lien <a> qui
 *  fonctionne sans JavaScript — l'amélioration progressive (copie automatique
 *  du prompt avant de suivre le lien) est ajoutée par scripts/assets/site.js. */
function renderAgentButtons(agents, ctx, t) {
  return agents
    .filter((agent) => agent.status === 'verified')
    .map((agent) => {
      const action = resolveAction(agent, ctx);
      const url = action.url ?? agent.homepage;
      const label = interpolate(t.openInAgentTemplate, { name: agent.name });
      // "url" et "clipboard" ouvrent un nouvel onglet (la fiche reste ouverte
      // pour copier le prompt) ; "deeplink" navigue dans le même onglet, seul
      // moyen fiable de déclencher le gestionnaire de protocole personnalisé
      // de l'agent (cursor://…). Ce choix est déjà correct sans JavaScript —
      // l'amélioration progressive (scripts/assets/site.js) ne fait qu'ajouter
      // la copie automatique du prompt avant la navigation.
      const targetAttr = action.mode === 'deeplink' ? '' : ' target="_blank" rel="noopener noreferrer"';
      return `<a class="agent-btn" href="${escapeHtml(url)}" data-agent-id="${escapeHtml(agent.id)}" data-mode="${escapeHtml(action.mode)}"${targetAttr}
              data-copied-label="${escapeHtml(t.copiedButton)}" data-fail-label="${escapeHtml(t.copyFailed)}">${escapeHtml(label)}</a>`;
    })
    .join('\n          ');
}

function renderMetaRow(tool, lang, ui, categories, voteCount, categoryPath) {
  const t = ui.site.tool;
  const catLabel = categoryLabel(categories, tool.category, lang);
  const items = [];

  // La source et la date de vérification sont une légende du prix, pas du
  // paragraphe de résumé qui suit ailleurs sur la page : elles vivent donc
  // dans la même case que la valeur qu'elles justifient, pas au-dessus d'un
  // autre paragraphe où elles se liraient comme sa citation.
  const checkedOn = formatDate(tool.pricing.checkedOn, lang);
  const sourceLabel = sourceHost(tool.pricing.source);
  const priceSourceCaption = `<span class="price-source">${escapeHtml(t.priceSourceLabel)}: `
    + `<a href="${escapeHtml(tool.pricing.source)}">${escapeHtml(sourceLabel)}</a> &middot; `
    + `${escapeHtml(t.priceCheckedLabel)} ${escapeHtml(checkedOn)}</span>`;
  items.push([t.priceHeading, `${escapeHtml(formatMonthlyPrice(tool.pricing, lang))}${priceSourceCaption}`]);

  // "Ce qu'une année coûte" n'a de sens que pour un prix vraiment récurrent —
  // une fiche à paiement unique n'a pas de "coût annuel" à en déduire.
  if (MONTHLY_BASES.has(tool.pricing.basis)) {
    const yearly = formatMoney(tool.pricing.amount * 12, tool.pricing.currency, lang);
    items.push([t.yearCostLabel, `<span title="${escapeHtml(t.yearCostNote)}">${escapeHtml(yearly)}</span>`]);
  }

  items.push([t.buildTimeLabel, escapeHtml(ui.diyTimeEstimate?.[tool.diyTimeEstimate] ?? tool.diyTimeEstimate)]);

  const emoji = categoryEmoji(categories, tool.category);
  items.push([
    t.categoryMetaLabel,
    `<a href="${escapeHtml(categoryPath)}">${emoji ? `${emoji} ` : ''}${escapeHtml(catLabel)}</a>`,
  ]);

  const votesValue = voteCount === null
    ? escapeHtml(t.voteUnavailable)
    : escapeHtml(pluralize(voteCount, lang, t.voteCountOne, t.voteCountOther));
  items.push([t.votesMetaLabel, votesValue]);

  return items
    .map(([label, value]) => `        <div class="meta-item"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`)
    .join('\n');
}

export function renderToolPage({
  lang, path, tool, i18nEntry, categories, ui, alternates, xDefaultPath, homePath,
  categoryPath, relatedTools, voteCount, favicons, agents,
}) {
  const s = ui.site;
  const t = s.tool;
  const verdict = s.verdicts[tool.verdict];
  const catLabel = categoryLabel(categories, tool.category, lang);
  const catEmoji = categoryEmoji(categories, tool.category);
  const favicon = favicons?.[tool.slug] ?? PLACEHOLDER_PATH;

  const title = interpolate(t.titleTemplate, { name: tool.name });
  const description = interpolate(t.metaDescriptionTemplate, { name: tool.name });
  const h1 = interpolate(t.h1Template, { name: tool.name });

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: catLabel, href: categoryPath },
    { label: tool.name, href: path },
  ];

  const metaRow = renderMetaRow(tool, lang, ui, categories, voteCount, categoryPath);

  const whatYouLose = i18nEntry.whatYouLose
    .map((item) => `          <li><span class="lose-mark" aria-hidden="true">&minus;</span>${escapeHtml(item)}</li>`)
    .join('\n');

  const priorArt = tool.priorArt ?? [];
  const priorArtColumn = priorArt.length === 0 ? '' : `
      <div class="col-priorart">
        <h2 id="priorart-heading">${escapeHtml(t.priorArtHeading)}</h2>
        <ul class="priorart-cards">
${priorArt
  .map((item) => {
    const license = item.license
      ? `<span class="priorart-license">${escapeHtml(t.licenseLabel)}: ${escapeHtml(item.license)}</span>`
      : '';
    return `          <li class="priorart-card"><a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>${license}</li>`;
  })
  .join('\n')}
        </ul>
      </div>`;

  const faqItems = i18nEntry.faq
    .map(
      (entry) => `      <details>
        <summary>${escapeHtml(entry.q)}</summary>
        <p>${escapeHtml(entry.a)}</p>
      </details>`
    )
    .join('\n');

  const relatedSection = relatedTools.length === 0 ? '' : `
    <section aria-labelledby="related-heading">
      <h2 id="related-heading">${escapeHtml(t.relatedHeading)}</h2>
      <ul class="related-cards">
${relatedTools
  .map((r) => {
    const rv = s.verdicts[r.verdict];
    const rCatLabel = categoryLabel(categories, r.category, lang);
    const rFavicon = favicons?.[r.slug] ?? PLACEHOLDER_PATH;
    return `        <li class="related-card">
          <a href="${r.path}">
            <img src="${escapeHtml(rFavicon)}" alt="" width="28" height="28" loading="lazy">
            <span class="related-card-name">${escapeHtml(r.name)}</span>
            ${verdictBadge(r.verdict, rv.label)}
            <span class="related-card-meta">${escapeHtml(formatMonthlyPrice(r.pricing, lang))} &middot; ${escapeHtml(rCatLabel)}</span>
          </a>
        </li>`;
  })
  .join('\n')}
      </ul>
    </section>`;

  const voteBadge = voteCount === null
    ? `<span class="vote-count-badge" id="vote-count" hidden data-vote-slug="${tool.slug}" data-lang="${lang}" data-singular="${escapeHtml(t.voteCountOne)}" data-plural="${escapeHtml(t.voteCountOther)}"></span>`
    : `<span class="vote-count-badge" id="vote-count" data-vote-slug="${tool.slug}" data-lang="${lang}" data-singular="${escapeHtml(t.voteCountOne)}" data-plural="${escapeHtml(t.voteCountOther)}">(${escapeHtml(pluralize(voteCount, lang, t.voteCountOne, t.voteCountOther))})</span>`;

  const shareText = interpolate(t.shareTextTemplate, { name: tool.name, verdict: verdict.label });
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${SITE_ORIGIN}${path}`)}`;

  const promptUrl = `/feed/${FEED_VERSION}/${lang}/prompts/${tool.slug}.txt`;
  const agentCtx = {
    prompt: i18nEntry.prompt,
    prompt_url: `${SITE_ORIGIN}${promptUrl}`,
    lang,
    slug: tool.slug,
  };
  const agentButtons = renderAgentButtons(agents, agentCtx, t);

  const whyHeading = interpolate(t.whyPeopleStillPayHeadingTemplate, { moat: tool.moatType });

  const main = `    ${renderBreadcrumb(breadcrumbItems)}

    <div class="tool-intro">
      <div class="tool-title-row">
        <img class="tool-favicon" src="${escapeHtml(favicon)}" alt="" width="40" height="40">
        <h1>${escapeHtml(h1)}</h1>
        ${verdictBadge(tool.verdict, verdict.label, 'badge-lg')}
      </div>
      <p class="tagline">${catEmoji ? `${catEmoji} ` : ''}<a href="${categoryPath}">${escapeHtml(catLabel)}</a>${tool.subcategory ? ` — ${escapeHtml(tool.subcategory)}` : ''}</p>

      <dl class="meta-row">
${metaRow}
      </dl>

      <section aria-labelledby="verdict-heading">
        <h2 id="verdict-heading" class="visually-hidden">${escapeHtml(t.verdictHeading)}</h2>
        <p class="verdict-summary">${escapeHtml(i18nEntry.verdictSummary)}</p>
      </section>
    </div>

    <section aria-labelledby="prompt-heading" class="tool-block-prompt">
      <div class="prompt-block">
        <div class="prompt-header">
          <h2 id="prompt-heading" class="prompt-label">${escapeHtml(t.promptHeading)}</h2>
          <div class="prompt-actions">
            <button id="copy-prompt" class="copy-btn" type="button" hidden
              data-copied-label="${escapeHtml(t.copiedButton)}"
              data-fail-label="${escapeHtml(t.copyFailed)}">${escapeHtml(t.copyButton)}</button>
            ${agentButtons}
          </div>
        </div>
        <pre><code id="prompt-text">${escapeHtml(i18nEntry.prompt)}</code></pre>
      </div>
      <p class="prompt-caption">${escapeHtml(t.promptOpenCaption)}</p>
      <p class="status" id="copy-status" role="status" aria-live="polite"></p>
    </section>

    <section aria-labelledby="why-heading">
      <h2 id="why-heading">${escapeHtml(whyHeading)}</h2>
      <p>${escapeHtml(i18nEntry.whyPeopleStillPay)}</p>
    </section>

    <section aria-labelledby="lose-heading" class="two-col">
      <div class="col-lose">
        <h2 id="lose-heading">${escapeHtml(t.whatYouLoseHeading)}</h2>
        <ul class="lose-list">
${whatYouLose}
        </ul>
      </div>${priorArtColumn}
    </section>

    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading">${escapeHtml(t.faqHeading)}</h2>
${faqItems}
    </section>
${relatedSection}

    <section class="vote-section" aria-labelledby="vote-heading">
      <h2 id="vote-heading">${escapeHtml(t.voteHeading)}</h2>
      <div class="vote-row">
        <button id="vote-btn" class="vote-btn" type="button" data-slug="${tool.slug}"
          data-msg-thanks="${escapeHtml(t.voteThanks)}"
          data-msg-already="${escapeHtml(t.voteAlready)}"
          data-msg-error="${escapeHtml(t.voteError)}">${escapeHtml(t.voteButton)} ${voteBadge}</button>
        <a class="share-x-btn" href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.shareOnXLabel)}</a>
      </div>
      <p class="status" id="vote-status" role="status" aria-live="polite"></p>
    </section>`;

  return renderLayout({
    lang,
    path,
    title,
    description,
    alternates,
    xDefaultPath,
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd(breadcrumbItems),
      faqPageJsonLd(i18nEntry.faq),
    ],
    main,
    ui,
    homeHref: homePath,
  });
}
