# Review L0-G3-fr (lang, fr)
Date: 2026-10-18 · Sample: 31/31 (batch L0, 100 %) · Picks: trello, capcut, duolingo-super, calendly, zapier (keys alternativesIntro, alternativeNotes, faq[4], faq[5]); wekan, planka, kan, plane, openproject, leantime, vikunja, kdenlive, shotcut, openshot, opencut, flowblade, tymeslot, cal-com, calnode, easyappointments, thunderbird-appointment, cloudmeet, activepieces, n8n, windmill, automatisch, bytechef, huginn, kestra, node-red (whole file)
Verdict: PASS

Method: each fr field read next to its en counterpart (data/i18n/en, which passed the L0-G3 gate and its two re-reviews). Automated checks on all 26 project files: same keys and array lengths as en, same set of numbers as en (no number added, dropped or changed), no "vous/votre", no "feature", no "self-host", no stars, no years, no "créé en / lancé en", no "libre" meaning free software. Every "open source" occurrence checked by hand. Tool intros: word counts 100 / 119 / 102 / 119 / 109, all inside 60–120. URL opened: mixpost.app/pricing and mixpost.app/cloud (point 6 of the controller's list).

| Slug | 1 Sources | 2 Limits | 3 Winner | 4 Calque | 5 FAQ | 6 Language |
|---|---|---|---|---|---|---|
| trello | pass | n/a | pass (WeKan = alternatives[0]) | pass | pass | pass |
| capcut | pass | n/a | pass (Kdenlive) | pass | pass | pass |
| duolingo-super | pass | n/a | pass (no alternative, matches empty list) | pass | pass | pass |
| calendly | pass | n/a | pass (Tymeslot) | pass | pass | pass |
| zapier | pass | n/a | pass (Activepieces) | pass | pass | pass |
| wekan | pass | pass | n/a | pass | n/a | pass |
| planka | pass | pass | n/a | pass | n/a | pass |
| kan | pass | pass | n/a | pass | n/a | pass |
| plane | pass | pass | n/a | pass | n/a | pass |
| openproject | pass | pass | n/a | pass | n/a | pass |
| leantime | pass | pass | n/a | pass | n/a | pass |
| vikunja | pass | pass | n/a | pass | n/a | pass |
| kdenlive | pass | pass | n/a | pass | n/a | pass |
| shotcut | pass | pass | n/a | pass | n/a | pass |
| openshot | pass | pass | n/a | pass | n/a | pass |
| opencut | pass | pass | n/a | pass | n/a | pass |
| flowblade | pass | pass | n/a | pass | n/a | pass |
| tymeslot | pass | pass | n/a | pass | n/a | pass |
| cal-com | pass | pass | n/a | pass | n/a | pass |
| calnode | pass | pass | n/a | pass | n/a | pass |
| easyappointments | pass | pass | n/a | pass | n/a | pass |
| thunderbird-appointment | pass | pass | n/a | pass | n/a | pass |
| cloudmeet | pass | pass | n/a | pass | n/a | pass |
| activepieces | pass | pass | n/a | pass | n/a | pass (see notes) |
| n8n | pass | pass | n/a | pass | n/a | pass |
| windmill | pass | pass | n/a | pass | n/a | pass |
| automatisch | pass | pass | n/a | pass | n/a | pass |
| bytechef | pass | pass | n/a | pass | n/a | pass |
| huginn | pass | pass | n/a | pass | n/a | pass |
| kestra | pass | pass | n/a | pass | n/a | pass |
| node-red | pass | pass | n/a | pass | n/a | pass |

Licence honesty (point 3): n8n says "Le code n'est pas open source au sens de l'OSI" and "source-available, pas open source" (zapier intro, FAQ 5, note). PLANKA says "La licence n'est pas open source au sens de l'OSI" and "fair-code, pas open source" (trello intro). Open-core projects are described as such: Windmill ("n'est pas entièrement open source", proprietary code in the Community Edition), Activepieces, Automatisch and ByteChef (separate enterprise licence on ee files), Plane, Vikunja, OpenProject, Kestra (paid editions named).

Ruling 47 (point 4): no stars, creation dates or commit dates in prose. Kestra "Depuis la version 2.0" is a version number, as in en.

Mixpost (point 6): not inconsistent. hootsuite.json fr and en both say Pro is "299 $ en achat unique". That is the self-hosted Pro licence: mixpost.app/pricing shows "$299 one-time. No recurring fees. Self-hosted", and research/sources/projects/mixpost.json has that claim. data/projects/mixpost.json `hosted.priceFrom: 29` is Mixpost Cloud, and mixpost.app/cloud shows "$29" a month. Two different products, both sourced. Nothing to fix.

## Blocking defects
- none

## Notes (non-blocking)
- Apostrophes are mixed. 13 project files use the typographic ’ (wekan to tymeslot) and 13 use the straight ' (cal-com, calnode, easyappointments, thunderbird-appointment, cloudmeet, activepieces, n8n, windmill, automatisch, bytechef, huginn, kestra, node-red). Across data/i18n/fr/projects, 71 files have straight apostrophes. This is a one-script fix (normalize to ’ in string values), better done in code than by the writers.
- activepieces: the page says "un flow", "des flows", "une piece", "des pieces", while zapier `alternativesIntro` and `alternativeNotes.activepieces` say "pièces" and "flux". "pieces" in French prose reads like a missing accent. Pick one form: "pièces" (or « pieces » in quotes the first time, as the product's own word), and "flux" or "workflow". The same "flow(s)" appears in windmill, bytechef and kestra; for Kestra it is the product term and can stay, for the others "flux" or "workflow" reads better. Zapier, automatisch and node-red already say "flux".
- thunderbird-appointment `description`: "nos données ne listent aucune offre hébergée" carries over the en wording the L0-G3 re-review flagged ("our data lists no hosted offer"). Use node-red's form: "Aucune offre hébergée n'est décrite".
- n8n `description`: "listées ci-dessous" carries over the en "listed below" (L0-G3 note). It refers to page layout. "listées dans les limites" or drop it.
- kdenlive `strengths[5]`: "la fonction pour laquelle on utilise le plus les éditeurs de vidéo courte" is the unsourced generalisation the L0-G3 re-review asked to cut in en. Still there in both languages. Cut it in both.
- Small calques and redundancies, each easy to fix:
  - opencut `description`: "en pleine réécriture complète". Use "en pleine réécriture" or "réécrit de zéro".
  - tymeslot `limits[2]`: "les modifications d'une version modifiée". Use "si tu proposes une version modifiée en ligne, tu dois en publier le code".
  - calnode `tagline`: "API d'abord" calques "API-first". Use "pensée pour l'API".
  - calnode `limits[3]`: "Un déploiement égale un espace de travail". Use "Une installation = un espace de travail".
  - plane `bestFor`: "… sur son propre serveur et à l'aise avec les conteneurs" is missing "qui est" before "à l'aise".
  - kan `limits[2]`: "Fonctionnalités de kanban basique". Use "Un kanban basique : …".
  - trello `alternativesIntro`: "Tu perds … des invités qui connaissent déjà Trello" follows the en word for word. "le fait que tes invités connaissent déjà Trello" reads better.
- calendly `alternativesIntro` fr drops "dans les deux sens" (two-way sync) and "par email" (email reminders) from the en. Not wrong, only shorter. `alternativeNotes.tymeslot` keeps "dans les deux sens".
- Anglicisms that a French technical reader uses and can stay: build(s), worker, frontend/backend, endpoint(s), reverse proxy, chart Helm, low-code, round-robin, multi-tenant, packagée. Watch "multi-tenant" (calnode) and "packagée" (opencut). "multi-locataire" and "prête à installer" are clearer.
