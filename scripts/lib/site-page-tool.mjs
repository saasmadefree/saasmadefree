import {
  escapeHtml, renderLayout, renderBreadcrumb, verdictBadge, stamp, dateRing, verdictChecks,
} from './site-html.mjs';
import { categoryLabel, categoryEmoji, SITE_ORIGIN } from './site-data.mjs';
import {
  formatMoney, formatMonthlyPrice, formatDate, formatStampDate, interpolate, pluralize,
  MONTHLY_BASES,
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
  categoryPath, relatedTools, voteCount, favicons, agents, sponsorSlots, buildDate,
}) {
  const s = ui.site;
  const t = s.tool;
  const d = s.dossier;
  const verdict = s.verdicts[tool.verdict];
  const catLabel = categoryLabel(categories, tool.category, lang);
  const catEmoji = categoryEmoji(categories, tool.category);
  const favicon = favicons?.[tool.slug] ?? PLACEHOLDER_PATH;

  const title = interpolate(t.titleTemplate, { name: tool.name });
  const description = interpolate(t.metaDescriptionTemplate, { name: tool.name });

  // La cote du dossier est le slug, stable et parlant — JAMAIS un numéro
  // séquentiel (spec §10.1 : le « n° 002 » de la maquette est un artefact de
  // specimen, pas une donnée ; un numéro d'ordre changerait à chaque insertion).
  const cote = `SMF·${tool.slug.toUpperCase()}`;

  // Le nom de l'outil est souligné à la main dans la question du titre
  // (maquette ef-us) : on découpe le gabarit autour de {name} pour envelopper
  // le nom seul, chaque morceau échappé séparément.
  const [h1Before, h1After] = String(t.h1Template).split('{name}');
  const h1 = h1After === undefined
    ? escapeHtml(interpolate(t.h1Template, { name: tool.name }))
    : `${escapeHtml(h1Before)}<span class="hand-underline">${escapeHtml(tool.name)}</span>${escapeHtml(h1After)}`;

  const breadcrumbItems = [
    { label: s.directoryLabel, href: homePath },
    { label: catLabel, href: categoryPath },
    { label: tool.name, href: path },
  ];

  const whyHeading = interpolate(t.whyPeopleStillPayHeadingTemplate, { moat: tool.moatType });

  // La table des pièces EST la liste des sections réellement rendues : le
  // bordereau de suivi et les renvois croisés en dérivent tous, donc aucun
  // renvoi ne peut pointer vers une pièce absente de la page.
  const pieces = [
    { letter: 'A', heading: t.promptHeading, id: 'prompt-heading' },
    { letter: 'B', heading: t.whatYouLoseHeading, id: 'lose-heading' },
    { letter: 'C', heading: whyHeading, id: 'why-heading' },
  ];
  const pieceLabel = (letter) => interpolate(d.pieceTemplate, { letter });

  const metaRow = renderMetaRow(tool, lang, ui, categories, voteCount, categoryPath);

  // ---- chemise ------------------------------------------------------------
  // L'onglet porte la rubrique, le tampon verdict est daté du build (la date à
  // laquelle le service a arrêté ce verdict), le dateur rond porte la SEULE
  // occurrence tamponnée de la date du relevé de prix (spec : un porteur par page).
  const folderStamps = `<div class="folder-stamps">
        <div>
          ${verdictBadge(tool.verdict, verdict.label, 'badge-lg')}
          <span class="stamp-sub">${escapeHtml(`${d.verdictRecordedOn} ${formatStampDate(buildDate)}`)}</span>
        </div>
        ${dateRing(d.verifiedOn, formatStampDate(tool.pricing.checkedOn))}
      </div>`;

  const folder = `    <div class="folder">
      <span class="folder-tab">${catEmoji ? `${catEmoji} ` : ''}${escapeHtml(catLabel)}</span>
      <span class="paper-clip" aria-hidden="true"></span>
      <span class="hole hole-a" aria-hidden="true"></span>
      <span class="hole hole-b" aria-hidden="true"></span>
      <div class="folder-top">
        <div class="folder-id">
          <h1><img class="tool-favicon" src="${escapeHtml(favicon)}" alt="" width="40" height="40"> ${h1}</h1>
          <p class="tagline">${catEmoji ? `${catEmoji} ` : ''}<a href="${categoryPath}">${escapeHtml(catLabel)}</a>${tool.subcategory ? ` — ${escapeHtml(tool.subcategory)}` : ''}</p>
        </div>
        ${folderStamps}
      </div>
      <dl class="meta-row">
${metaRow}
      </dl>
      ${verdictChecks(tool.verdict, s.verdicts, d.checkedNote)}
      <div class="folder-foot">
        <span class="barcode" aria-hidden="true"></span>
        <span class="barcode-label">${escapeHtml(`${cote} — ${tool.name}`)}</span>
      </div>
    </div>`;

  // ---- bordereau de suivi -------------------------------------------------
  // Une ligne par pièce rendue + la ligne Questions : le renvoi est la lettre
  // de pièce, la coche au stylo est décorative (le contenu suit juste après).
  const slipRows = [...pieces, { letter: 'Q', heading: t.faqHeading, id: 'faq-heading' }]
    .map(({ letter, heading, id }) => `            <tr>
              <th scope="row"><a href="#${id}">${escapeHtml(pieceLabel(letter))}</a></th>
              <td>${escapeHtml(heading)}</td>
              <td><span class="pen-check" aria-hidden="true"></span></td>
            </tr>`)
    .join('\n');

  const trackingSlip = `    <section class="tracking-slip" aria-labelledby="tracking-heading">
      <div class="piece-head">
        <h2 class="piece-tab" id="tracking-heading">${escapeHtml(d.trackingHeading)}</h2>
      </div>
      <div class="sheet">
        <table>
          <tbody>
${slipRows}
          </tbody>
        </table>
      </div>
    </section>`;

  // ---- pièces -------------------------------------------------------------
  // Chaque tête de pièce est l'onglet encré « Pièce X — Intitulé » : c'est le
  // h2 lui-même qui porte l'id d'ancre, cible unique des renvois croisés.
  const pieceHead = ({ letter, heading, id }, extra = '') => `      <div class="piece-head">
        <h2 class="piece-tab" id="${id}">${escapeHtml(`${pieceLabel(letter)} — ${heading}`)}</h2>${extra ? `
        ${extra}` : ''}
      </div>`;

  const promptUrl = `/feed/${FEED_VERSION}/${lang}/prompts/${tool.slug}.txt`;
  const agentCtx = {
    prompt: i18nEntry.prompt,
    prompt_url: `${SITE_ORIGIN}${promptUrl}`,
    lang,
    slug: tool.slug,
  };
  const agentButtons = renderAgentButtons(agents, agentCtx, t);

  const pieceA = `    <section aria-labelledby="prompt-heading" class="piece tool-block-prompt">
${pieceHead(pieces[0], stamp('verif', [d.receivedOn, formatStampDate(tool.pricing.checkedOn)]))}
      <div class="prompt-block">
        <div class="prompt-header">
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
    </section>`;

  // Chaque ligne de perte est numérotée B.n (maquette ef-lno) : des renvois de
  // lecture, pas une cote — la numérotation séquentielle interdite est celle
  // des dossiers, pas celle des lignes d'une même pièce.
  const whatYouLose = i18nEntry.whatYouLose
    .map((item, i) => `          <li><span class="pen-check" aria-hidden="true"></span><span class="piece-no">B.${i + 1}</span> <span>${escapeHtml(item)}</span></li>`)
    .join('\n');

  const priorArt = tool.priorArt ?? [];
  const priorArtColumn = priorArt.length === 0 ? '' : `
        <div class="col-priorart">
          <h3 id="priorart-heading">${escapeHtml(t.priorArtHeading)}</h3>
          <ul class="priorart-cards">
${priorArt
  .map((item) => {
    const license = item.license
      ? `<span class="priorart-license">${escapeHtml(t.licenseLabel)}: ${escapeHtml(item.license)}</span>`
      : '';
    return `            <li class="priorart-card"><a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>${license}</li>`;
  })
  .join('\n')}
          </ul>
        </div>`;

  const pieceB = `    <section aria-labelledby="lose-heading" class="piece">
${pieceHead(pieces[1])}
      <div class="sheet piece-body two-col">
        <div class="col-lose">
          <ul class="lose-list">
${whatYouLose}
          </ul>
        </div>${priorArtColumn}
      </div>
    </section>`;

  const pieceC = `    <section aria-labelledby="why-heading" class="piece">
${pieceHead(pieces[2])}
      <div class="sheet piece-body">
        <p>${escapeHtml(i18nEntry.whyPeopleStillPay)}</p>
      </div>
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

  // Le cadre du visiteur devient le récépissé détachable au bas du dossier :
  // mêmes crochets JS qu'avant, seule l'enveloppe change.
  const receipt = `    <section class="vote-section receipt" aria-labelledby="vote-heading">
      <p class="receipt-label">${escapeHtml(d.receiptHeading)}</p>
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

  // ---- assemblage : chemise, bordereau, résumé, pièces A→C, questions,
  // outils proches, récépissé — l'ordre du spec §4 amendé. Le renvoi au stylo
  // sous le résumé pointe vers la pièce B (les pertes motivent le verdict).
  const main = `    ${renderBreadcrumb(breadcrumbItems)}

${folder}

${trackingSlip}

    <section aria-labelledby="verdict-heading">
      <h2 id="verdict-heading" class="visually-hidden">${escapeHtml(t.verdictHeading)}</h2>
      <p class="verdict-summary ${tool.verdict}">${escapeHtml(i18nEntry.verdictSummary)}</p>
      <p class="pen-note"><a href="#${pieces[1].id}">${escapeHtml(`${pieceLabel(pieces[1].letter)} — ${pieces[1].heading}`)}</a></p>
    </section>

${pieceA}

${pieceB}

${pieceC}

    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading">${escapeHtml(t.faqHeading)}</h2>
${faqItems}
    </section>
${relatedSection}

${receipt}`;

  // La cartouche de références sous le filet de tête (renderLayout) : chaque
  // cellule est un fait du dossier — la cote, les deux dates, et des comptes
  // dérivés des données rendues (jamais des constantes recopiées à la main).
  const refCells = [
    [d.fileLabel, cote],
    [d.receivedOn, formatStampDate(tool.pricing.checkedOn)],
    [d.instructedOn, formatStampDate(buildDate)],
    [d.piecesAnnexed, String(pieces.length)],
    [t.faqHeading, String(i18nEntry.faq.length)],
  ];

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
    sponsorSlots,
    refCells,
  });
}
