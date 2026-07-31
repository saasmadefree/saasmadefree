import { escapeHtml, renderLayout, renderBreadcrumb } from './site-html.mjs';
import { categoryLabel, categoryEmoji } from './site-data.mjs';
import { formatMonthlyPrice, formatDate, interpolate, pluralize } from './site-format.mjs';
import {
  organizationJsonLd, faqPageJsonLd, breadcrumbJsonLd,
} from './site-seo.mjs';

function sourceHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function renderToolPage({
  lang, path, tool, i18nEntry, categories, ui, alternates, xDefaultPath, homePath,
  categoryPath, relatedTools, voteCount,
}) {
  const s = ui.site;
  const t = s.tool;
  const verdict = s.verdicts[tool.verdict];
  const catLabel = categoryLabel(categories, tool.category, lang);
  const catEmoji = categoryEmoji(categories, tool.category);

  const title = interpolate(t.titleTemplate, { name: tool.name });
  const description = interpolate(t.metaDescriptionTemplate, { name: tool.name });

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: catLabel, href: categoryPath },
    { label: tool.name, href: path },
  ];

  const price = formatMonthlyPrice(tool.pricing, lang);
  const checkedOn = formatDate(tool.pricing.checkedOn, lang);
  const sourceLabel = sourceHost(tool.pricing.source);
  const basisLabel = ui.pricingBasis?.[tool.pricing.basis] ?? tool.pricing.basis;

  const whatYouLose = i18nEntry.whatYouLose
    .map((item) => `          <li>${escapeHtml(item)}</li>`)
    .join('\n');

  const priorArt = tool.priorArt ?? [];
  const priorArtSection = priorArt.length === 0 ? '' : `
    <section aria-labelledby="priorart-heading">
      <h2 id="priorart-heading">${escapeHtml(t.priorArtHeading)}</h2>
      <ul>
${priorArt
  .map((item) => {
    const license = item.license
      ? ` — ${escapeHtml(t.licenseLabel)}: ${escapeHtml(item.license)}`
      : '';
    return `        <li><a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>${license}</li>`;
  })
  .join('\n')}
      </ul>
    </section>`;

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
      <ul class="related-list">
${relatedTools
  .map((r) => {
    const rv = s.verdicts[r.verdict];
    return `        <li><a href="${r.path}"><span class="name">${escapeHtml(r.name)}</span><span class="badge ${r.verdict}">${escapeHtml(rv.label)}</span></a></li>`;
  })
  .join('\n')}
      </ul>
    </section>`;

  const voteCountMarkup = voteCount === null
    ? `<p class="vote-count" id="vote-count" hidden data-vote-slug="${tool.slug}" data-lang="${lang}" data-singular="${escapeHtml(t.voteCountOne)}" data-plural="${escapeHtml(t.voteCountOther)}"></p>`
    : `<p class="vote-count" id="vote-count" data-vote-slug="${tool.slug}" data-lang="${lang}" data-singular="${escapeHtml(t.voteCountOne)}" data-plural="${escapeHtml(t.voteCountOther)}">${escapeHtml(pluralize(voteCount, lang, t.voteCountOne, t.voteCountOther))}</p>`;

  const main = `    ${renderBreadcrumb(breadcrumbItems)}
    <h1>${escapeHtml(tool.name)}</h1>
    <p class="tagline">${catEmoji ? `${catEmoji} ` : ''}<a href="${categoryPath}">${escapeHtml(catLabel)}</a>${tool.subcategory ? ` — ${escapeHtml(tool.subcategory)}` : ''}</p>

    <section aria-labelledby="verdict-heading">
      <h2 id="verdict-heading">${escapeHtml(t.verdictHeading)}</h2>
      <p><span class="badge ${tool.verdict}">${escapeHtml(verdict.label)}</span></p>
      <p>${escapeHtml(i18nEntry.verdictSummary)}</p>
    </section>

    <section aria-labelledby="price-heading">
      <h2 id="price-heading">${escapeHtml(t.priceHeading)}</h2>
      <p>${escapeHtml(price)} — ${escapeHtml(tool.pricing.plan)}, ${escapeHtml(basisLabel)}</p>
      <p class="status">${escapeHtml(t.priceSourceLabel)}: <a href="${escapeHtml(tool.pricing.source)}">${escapeHtml(sourceLabel)}</a> · ${escapeHtml(t.priceCheckedLabel)} ${escapeHtml(checkedOn)}</p>
    </section>

    <section aria-labelledby="lose-heading">
      <h2 id="lose-heading">${escapeHtml(t.whatYouLoseHeading)}</h2>
      <ul>
${whatYouLose}
      </ul>
    </section>

    <section aria-labelledby="why-heading">
      <h2 id="why-heading">${escapeHtml(t.whyPeopleStillPayHeading)}</h2>
      <p>${escapeHtml(i18nEntry.whyPeopleStillPay)}</p>
    </section>

    <section aria-labelledby="prompt-heading">
      <h2 id="prompt-heading">${escapeHtml(t.promptHeading)}</h2>
      <div class="prompt-block">
        <pre><code id="prompt-text">${escapeHtml(i18nEntry.prompt)}</code></pre>
        <button id="copy-prompt" class="copy-btn" type="button" hidden
          data-copied-label="${escapeHtml(t.copiedButton)}"
          data-fail-label="${escapeHtml(t.copyFailed)}">${escapeHtml(t.copyButton)}</button>
        <p class="status" id="copy-status" role="status" aria-live="polite"></p>
      </div>
    </section>
${priorArtSection}

    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading">${escapeHtml(t.faqHeading)}</h2>
${faqItems}
    </section>
${relatedSection}

    <section class="vote-section" aria-labelledby="vote-heading">
      <h2 id="vote-heading">${escapeHtml(t.voteHeading)}</h2>
      ${voteCountMarkup}
      <button id="vote-btn" type="button" data-slug="${tool.slug}"
        data-msg-thanks="${escapeHtml(t.voteThanks)}"
        data-msg-already="${escapeHtml(t.voteAlready)}"
        data-msg-error="${escapeHtml(t.voteError)}">${escapeHtml(t.voteButton)}</button>
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
