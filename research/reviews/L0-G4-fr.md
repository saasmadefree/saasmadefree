# Review L0-G4-fr (lang, fr)
Date: 2026-10-18 · Sample: 25/25 (L0, 100 %) · Picks: smartsheet, zendesk, hootsuite, asana, adobe-acrobat-pro, redmine, zammad, uvdesk, osticket, frappe-helpdesk, chatwoot, freescout, postiz-app, mixpost, trypost, socioboard, threaduler, operately, platform, worklenz, taiga, stirling-pdf, bentopdf, pdfsam, pdfarranger
Verdict: RETURN

Scope: tool files = `alternativesIntro`, `alternativeNotes`, `faq[4]`, `faq[5]`; project files = whole file.
Reference = data/i18n/en (passed L0-G4 after re-review round 2) + data/projects, data/tools.

Pre-checks: `npm run validate` green (530 fiches, 1060 traductions, 255 projets). Every slug has its research/sources file.
Grep over all 25 fr files: no "vous/votre/vos", no "feature(s)" or "self-hosted" in prose, no star count, no year/date.

Point-by-point:
1. Facts. Every fr field was compared sentence by sentence with the en version: figures (Zammad 2 cores / 6 GB / +4 GB /
   40 agents / 6 cores, PostgreSQL 15, Redis 7; Stirling 50+ tools, 5 users, Team/Enterprise gates; BentoPDF 79 dollars;
   TryPost 13 networks, 80+ MCP tools; Operately 5 to 100; Huly 2 vCPU / 8 GB, 4 vCPU / 16 GB; FreeScout 33 languages,
   PHP 7.4; osTicket PHP 8.2-8.4, MySQL 5.5; UVdesk PHP 8.1, MySQL 5.7.23, 4 GB; Taiga Docker 19.03; Worklenz Node 20,
   PostgreSQL 15; Redmine 11 steps; Mixpost PHP 8.2, $299) all match. Prices keep USD. The only fr-only addition is
   operately `description` "Le modèle est de type open core", which matches data/projects/operately.json
   (`licenseKind: open-core`): accepted, and an improvement on the en text.
2. Native French. Mostly natural, tutoiement throughout, glossary respected (auto-hébergé, formule, appli, dépôt,
   fonctionnalité, sauvegarde...). One sentence reads as machine-translated (blocking, below); several minor calques (notes).
3. Licence honesty. No project of the non-OSI list in this batch. Open-core: Chatwoot (enterprise directory licence stated),
   Mixpost (Lite/Pro split stated), Operately and Stirling PDF (called "open core"). None is called "open source"/"libre".
   Operately's en tagline says "Open-source"; the fr tagline correctly drops it. Pass.
4. Ruling 47: no stars, creation or commit dates in prose. Pass.
5. All 5 fr intros name `alternatives[0]` in the first sentence (OpenProject, Zammad, Postiz, Leantime, Stirling PDF),
   105-118 words. `faq[4].q` is the fixed fr question in all 5 tools. Pass.
6. Mixpost price check. Not an inconsistency. "299 $" (hootsuite `alternativeNotes.mixpost`, mixpost `strengths[2]`) is the
   one-time Pro self-hosted licence, same as en "$299", sourced to https://mixpost.app/pricing (fetched today: "$299
   one-time. No recurring fees."). data/projects/mixpost.json `hosted.priceFrom: 29 USD` is the hosted Cloud plan, sourced
   to https://mixpost.app/cloud (fetched today: "Spark ... $29 / month"). Two different products; both correct. Pass.
   (The zendesk files contain no Mixpost price.)

| Slug | 1 Sources | 2 Limits | 3 Winner | 4 Calque | 5 FAQ | 6 Language |
|---|---|---|---|---|---|---|
| smartsheet | pass | n/a | pass | pass | pass | pass |
| zendesk | pass | n/a | pass | pass | pass | pass |
| hootsuite | pass | n/a | pass | pass | pass | pass |
| asana | pass | n/a | pass | pass | pass | pass |
| adobe-acrobat-pro | pass | n/a | pass | pass | pass | pass |
| redmine | pass | pass | n/a | pass | n/a | pass |
| zammad | pass | pass | n/a | pass | n/a | pass |
| uvdesk | pass | pass | n/a | pass | n/a | pass |
| osticket | pass | pass | n/a | pass | n/a | pass |
| frappe-helpdesk | pass | pass | n/a | pass | n/a | pass |
| chatwoot | pass | pass | n/a | pass | n/a | pass |
| freescout | pass | pass | n/a | pass | n/a | pass |
| postiz-app | pass | pass | n/a | pass | n/a | pass |
| mixpost | pass | pass | n/a | pass | n/a | pass |
| trypost | pass | pass | n/a | pass | n/a | DEFECT |
| socioboard | pass | pass | n/a | pass | n/a | pass |
| threaduler | pass | pass | n/a | pass | n/a | pass |
| operately | pass | pass | n/a | pass | n/a | pass |
| platform | pass | pass | n/a | pass | n/a | pass |
| worklenz | pass | pass | n/a | pass | n/a | pass |
| taiga | pass | pass | n/a | pass | n/a | pass |
| stirling-pdf | pass | pass | n/a | pass | n/a | pass |
| bentopdf | pass | pass | n/a | pass | n/a | pass |
| pdfsam | pass | pass | n/a | pass | n/a | pass |
| pdfarranger | pass | pass | n/a | pass | n/a | pass |

## Blocking defects
- trypost · 6 · `strengths[0]`: "Publie sur 13 réseaux par leurs API officielles, sans simple rappel en solution de repli".
  Word-for-word calque of "with no reminder-only fallback"; a French reader cannot tell what "simple rappel" refers to.
  Fix: "Publie vraiment sur 13 réseaux par leurs API officielles : il ne se contente jamais de te rappeler de poster à la
  main". Blocking: yes.

## Notes (non-blocking)
- platform · `description` calls the project "Huly (fork communautaire)", while data/projects/platform.json `name` and fr
  asana `alternativeNotes.platform` use "Huly (community fork)". Pick one form for the proper name (the data name, since the
  page title shows it), e.g. "Huly (community fork), le fork communautaire du Platform Collective…".
- operately · `strengths[2]` "Une ligne de commande et une API…": a CLI is "un outil en ligne de commande" (as the
  description says), not "une ligne de commande".
- pdfarranger · `limits[0]` agreement: "aucune modification de texte, aucun remplissage de formulaires, aucune signature
  décrits". Fix: "…ni signature : le README n'en décrit aucune" or "aucune … n'est décrite".
- pdfarranger · `description`, `strengths[2]` "la page des releases": prefer "la page des versions publiées" (or "des
  téléchargements").
- mixpost · `strengths[2]` "Pro coûte un paiement unique de 299 $": awkward. "Pro se paie une seule fois, 299 $ pour un
  domaine, sans abonnement mensuel par utilisateur".
- adobe-acrobat-pro · `alternativesIntro` "BentoPDF est le choix confidentialité": calque of "the privacy pick". "BentoPDF
  est le meilleur choix pour la confidentialité".
- asana · `alternativesIntro` "si seul le cumul des objectifs t'intéresse": "goal roll-up" reads oddly as "cumul". "si tu
  veux seulement la remontée des objectifs vers ceux de l'entreprise".
- stirling-pdf · `tagline` "PDF auto-hébergé : plus de 50 outils…": the subject is the toolbox, not "PDF". "Boîte à outils
  PDF auto-hébergée : …" (as bentopdf does).
- frappe-helpdesk · `description`, `strengths[2]` "script d'installation facile": calque of the script name "easy-install".
  "le script easy-install" or "un script d'installation rapide".
- bentopdf · `description` / `limits[0]` "option en même origine", "fichiers en même origine": "same-origin" calque. "servis
  depuis ton propre domaine".
- smartsheet · `alternativesIntro` "si la finance attend une feuille de calcul": "si le service financier attend…" reads
  more naturally.
- Light anglicisms accepted as dev jargon but worth a pass: postiz-app "le frontend", taiga "backend, frontend", "reverse
  proxy". Not repeated enough to block.
- Consistency only: mixpost and chatwoot (open-core in data) never use the words "open core" in their project files, while
  operately and stirling-pdf do. The facts are stated either way, so licence honesty passes.

## Verdict changes (new-tool only)
- none

## Fix round 1
- trypost strengths[0]: now "Publie vraiment sur 13 réseaux par leurs API officielles : il ne se contente jamais de te rappeler de poster à la main".
- Also fixed (notes): platform "Huly (community fork)", operately CLI wording, pdfarranger agreement and "versions publiées", mixpost price wording, adobe/asana/smartsheet intros, stirling-pdf tagline, frappe-helpdesk script, bentopdf same-origin.

## Re-review round 1
Date: 2026-10-18 · Scope: the 1 original blocking defect + spot-check of the batch-wide pass.
- trypost strengths[0]: FIXED. "Publie vraiment sur 13 réseaux par leurs API officielles : il ne se contente jamais de te rappeler de poster à la main" is clear French and carries the en fact (real API publishing, no reminder-only fallback); 13 networks and official APIs kept.

Spot-check of the apostrophe and wording pass (10 of the 98 fr files changed at 2026-10-18 07:00, picked with node -e and Math.random): projects/platform, stirling-pdf, waistline, seonaut, opencut, open-seo, redmine, automatisch; tools/asana, mailchimp (scoped keys). Each read side by side with en. No straight apostrophe left, no ’ inside a URL, command, env var or file name (docker compose up, ENCRYPTION_KEY, .ee., .nvmrc, seonaut.org, opencut.app intact), no broken text, no changed fact, tutoiement kept. Files from this group in the sample: platform ("Huly (community fork)" now used as the proper name, consistent with asana note), stirling-pdf (tagline now "Boîte à outils PDF auto-hébergée", open core, 5 users, Team/Enterprise gates intact), redmine (eleven steps, READ COMMITTED, GPL v2 intact), tools/asana.

New blocking defects: none.

Verdict: PASS
