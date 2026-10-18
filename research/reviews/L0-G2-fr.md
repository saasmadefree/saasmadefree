# Review L0-G2-fr (lang, fr)
Date: 2026-10-18 · Sample: 38/38 (100 %, batch L0) · Picks: dropbox-plus, shopify, canva, docusign, mailchimp (keys alternativesIntro, alternativeNotes, faq[4], faq[5]); nextcloud, seafile, opencloud, owncloud-ocis, syncthing, pydio-cells, woocommerce, bagisto, spree-commerce, prestashop, shopware, medusa, saleor, solidus, penpot, graphite, krita, inkscape, gimp, docuseal, documenso, opensign, libresign, wraft, listmonk, mautic, keila, plunk, dittofeed, notifuse, sendportal, phplist (whole file)
Verdict: RETURN

Method: every fr field read side by side with its en counterpart (the en text passed the L0-G2 gate, re-review round 2) and with data/projects / data/tools (licence, licenseKind, hosted, pricing, alternatives order). `npm run validate`: all valid. Greps over the 38 files: no "vous/votre/vos", no years, no stars, no em dashes; "libre(s)/librement" only in canva intro ("libres de droits") and opencloud strengths[3] (Apache 2.0), neither about a non-free project. Intro word counts: dropbox-plus 106, shopify 114, canva 102, docusign 106, mailchimp 111; each names alternatives[0] in its first sentence. FAQ 5 uses the fixed fr question in all five tools.

Column 1 here means "facts identical to en and data/", column 4 "calque of the English", column 6 "native French".

| Slug | 1 Facts | 2 Limits | 3 Winner | 4 Calque | 5 FAQ | 6 Language |
|---|---|---|---|---|---|---|
| dropbox-plus | DEFECT | pass | pass | pass | DEFECT | pass |
| shopify | pass | pass | pass | pass | pass | pass |
| canva | pass | pass | pass | pass | pass | pass |
| docusign | pass | pass | pass | pass | pass | pass |
| mailchimp | pass | pass | pass | pass | pass | pass |
| nextcloud | pass | pass | n/a | pass | n/a | pass |
| seafile | pass | pass | n/a | pass | n/a | pass |
| opencloud | pass | pass | n/a | DEFECT | n/a | DEFECT |
| owncloud-ocis | pass | pass | n/a | pass | n/a | pass |
| syncthing | pass | pass | n/a | pass | n/a | pass |
| pydio-cells | pass | pass | n/a | pass | n/a | pass |
| woocommerce | pass | pass | n/a | pass | n/a | pass |
| bagisto | pass | pass | n/a | pass | n/a | pass |
| spree-commerce | pass | pass | n/a | DEFECT | n/a | DEFECT |
| prestashop | pass | pass | n/a | pass | n/a | pass |
| shopware | pass | pass | n/a | pass | n/a | pass |
| medusa | pass | pass | n/a | pass | n/a | pass |
| saleor | pass | pass | n/a | pass | n/a | pass |
| solidus | pass | pass | n/a | pass | n/a | pass |
| penpot | pass | pass | n/a | pass | n/a | pass |
| graphite | pass | pass | n/a | pass | n/a | pass |
| krita | pass | pass | n/a | pass | n/a | pass |
| inkscape | pass | pass | n/a | pass | n/a | pass |
| gimp | pass | pass | n/a | pass | n/a | pass |
| docuseal | pass | pass | n/a | pass | n/a | pass |
| documenso | DEFECT | pass | n/a | DEFECT | n/a | DEFECT |
| opensign | pass | pass | n/a | pass | n/a | pass |
| libresign | pass | pass | n/a | pass | n/a | pass |
| wraft | pass | pass | n/a | pass | n/a | pass |
| listmonk | pass | pass | n/a | pass | n/a | pass |
| mautic | pass | pass | n/a | pass | n/a | pass |
| keila | pass | pass | n/a | pass | n/a | pass |
| plunk | pass | pass | n/a | DEFECT | n/a | DEFECT |
| dittofeed | pass | pass | n/a | pass | n/a | pass |
| notifuse | pass | pass | n/a | pass | n/a | pass |
| sendportal | pass | pass | n/a | pass | n/a | pass |
| phplist | pass | pass | n/a | pass | n/a | pass |

## Blocking defects
- dropbox-plus · 1/5 · `faq[5].a`: "un portable éteint, c'est une sauvegarde en moins". The en says "a switched-off laptop means no backup" (no copy is reachable). The fr makes Syncthing sound like a backup with one copy missing, which contradicts our Syncthing page ("ce n'est pas un outil de sauvegarde"). Blocking: yes.
  Fix: "… ni copie dans le cloud : si ton portable est éteint, aucune autre copie n'est disponible." (or "… tes fichiers ne sont nulle part ailleurs").
- opencloud · 4/6 · `description`: "Il y a peu de pièces mobiles" is the English idiom "few moving parts" word for word; French does not say it. And "Lis la documentation avant de t'engager sur les clients, l'édition de documents et le comportement de la synchro" reads as "commit to the clients": the object attaches to the wrong verb and the sentence is hard to parse. Blocking: yes.
  Fix: "L'ensemble reste simple, mais ta sauvegarde devient une sauvegarde de fichiers." and "Avant de te lancer, vérifie dans la documentation ce qu'il en est des clients, de l'édition de documents et de la synchro : le dépôt principal ne décrit que le backend."
- documenso · 1/4/6 · `description`: "ne sont qu'un effort de bonne foi" mistranslates "best-effort" (not guaranteed) as "good faith", which changes the meaning. `limits[3]`: "Tu portes la sécurité du réseau" is a calque of "self-hosters own network security". Blocking: yes.
  Fix: "… car les contrôles des requêtes sortantes, par exemple pour les webhooks, ne sont pas garantis." and "La sécurité du réseau est à ta charge : les contrôles des requêtes de webhook ne bloquent pas toutes les requêtes vers des adresses internes."
- spree-commerce · 4/6 · `description`: "si tu veux ton propre code et tes données et que tu peux fournir le travail Rails et TypeScript" renders "can staff the Rails and TypeScript work" literally; it sounds machine-made. Blocking: yes.
  Fix: "Spree peut remplacer Shopify si tu veux garder ton code et tes données, et si tu as des développeurs Rails et TypeScript."
- plunk · 4/6 · `description`: "Elle couvre trois métiers" ("three jobs") and "les formulaires de croissance de liste" ("list-growth forms") are literal calques; the second is not French. Blocking: yes.
  Fix: "Elle sert à trois choses : …" and "… comme les galeries de modèles ou les formulaires d'inscription pour faire grossir ta liste."

## Notes (non-blocking)
- Mixpost check (prompt point 6): consistent, no defect. data/i18n/{en,fr}/tools/hootsuite.json alternativeNotes.mixpost says Pro costs 299 $ as a one-time purchase. That is the self-hosted Pro licence, sourced in research/sources/projects/mixpost.json ("Pro costs $299 (one-time payment, 1 domain or subdomain)"). data/projects/mixpost.json `hosted.priceFrom` 29 USD is the separate Mixpost Cloud (mixpost.app/cloud). Two products, two prices; fr matches en. No zendesk fr text mentions Mixpost.
- Typography, 16 project files (krita, inkscape, gimp, docuseal, documenso, opensign, libresign, wraft, listmonk, mautic, keila, plunk, dittofeed, notifuse, sendportal, phplist): straight apostrophes (') where the other 22 files and ui.json use the typographic apostrophe (’). The same 16 files end strengths/limits items with a full stop, while the other 16 project files do not. Fix: one pass to ’ and one list style for the batch.
- seafile `description`: the en sentence "It stands in for Dropbox and similar tools when a team wants files on its own disks" is missing in fr. No fact is wrong; add "Il remplace Dropbox et les outils du même genre quand une équipe veut garder ses fichiers sur ses propres disques."
- shopify `alternativesIntro`: "Si tu vends beaucoup sans aide technique" is stronger than the en "more than a handful of items". Suggest "Si tu vends plus que quelques articles sans aide technique". "le paiement de confiance de Shopify" is a little literal ("trusted checkout"); "le paiement que tes clients connaissent déjà" reads better.
- canva `alternativesIntro`: "photos libres de droits sous licence" is self-contradictory. Use "photos de stock sous licence", which matches the canva note and FAQ 6.
- woocommerce `limits[2]` and prestashop `limits[1]`: "sont ton travail" is a calque of "are your job"; the rest of the batch says "sont à ta charge".
- bagisto `description`: "aucun frais de plateforme" → "pas de frais de plateforme" (frais is plural).
- wraft `description`: "avant de planifier un départ d'un service de signature" is clumsy → "avant de quitter un service de signature".
- mailchimp `alternativesIntro`: "Listmonk gagne" is literal ("wins"); "Listmonk est le meilleur choix" or "prends Listmonk".
- syncthing: "binaires de release", "builds macOS et Windows signés" keep English where "versions publiées" / "versions macOS et Windows signées" exist. Minor.
- docuseal and documenso `description` cite hosted plans from 20 $ and 25 $ while data/projects `hosted.priceFrom` is 0 for both (free tier). Both prices are sourced ("Hosted plan from 20 USD", "from 25 USD") and identical to en, so not a translation defect; flag for the next data pass.
- pydio-cells and opensign are `open-core` in data/projects, but neither the en nor the fr text names a paid edition. fr is consistent with the en that passed the gate; worth a word in a later data/content pass.
- Licence honesty: Notifuse is described as BUSL-1.1 for v40+, with explicit negations only ("n'est pas une licence open source reconnue par l'OSI", "pas un projet open source au sens strict"). No banned "open source"/"libre" claim found for the six listed projects.

## Fix round 1
- dropbox-plus faq[5].a: "une sauvegarde en moins" replaced by "si ton portable est éteint, tes fichiers ne sont nulle part ailleurs".
- opencloud description: "pièces mobiles" and the misattached "t'engager sur les clients" rewritten as proposed.
- documenso description: "effort de bonne foi" replaced by "ne sont pas garantis"; limits[3] now "La sécurité du réseau est à ta charge : …".
- spree-commerce description: "fournir le travail Rails et TypeScript" replaced by "si tu as des développeurs Rails et TypeScript".
- plunk description: "trois métiers" and "formulaires de croissance de liste" replaced by "trois choses" and "formulaires d'inscription pour faire grossir ta liste".
- Also fixed: apostrophes and list-item punctuation normalised batch-wide; seafile Dropbox sentence, shopify/canva/mailchimp intros, woocommerce/prestashop/bagisto/wraft wordings.

## Re-review round 1
Date: 2026-10-18 · Scope: the 5 original blocking defects + spot-check of the batch-wide pass.
- dropbox-plus faq[5].a: FIXED. "si ton portable est éteint, tes fichiers ne sont nulle part ailleurs" states the en fact (no other copy reachable); the "sauvegarde en moins" contradiction is gone.
- opencloud description: FIXED. "L’ensemble reste simple, mais ta sauvegarde devient une sauvegarde de fichiers" and "Avant de te lancer, vérifie dans la documentation ce qu’il en est des clients, de l’édition de documents et de la synchro : le dépôt principal ne décrit que le backend" are natural and match en.
- documenso description: FIXED. "ne sont pas garantis" renders best-effort correctly.
- documenso limits[3]: FIXED. "La sécurité du réseau est à ta charge : les contrôles des requêtes de webhook ne bloquent pas toutes les requêtes vers des adresses internes" = en "not a complete defence".
- spree-commerce description: FIXED. "si tu veux garder ton code et tes données, et si tu as des développeurs Rails et TypeScript".
- plunk description: FIXED. "Elle sert à trois choses" and "les formulaires d’inscription pour faire grossir ta liste".

Spot-check of the apostrophe and wording pass (10 of the 98 fr files changed at 2026-10-18 07:00, picked with node -e and Math.random): projects/platform, stirling-pdf, waistline, seonaut, opencut, open-seo, redmine, automatisch; tools/asana, mailchimp (scoped keys). Each read side by side with en. No straight apostrophe left, no ’ inside a URL, command, env var or file name (docker compose up, ENCRYPTION_KEY, .ee., .nvmrc, seonaut.org, opencut.app intact), no broken text, no changed fact, tutoiement kept.

New blocking defects: none.
Non-blocking, for a later pass: opencut tagline drops en "Free" ("Éditeur vidéo MIT…"; MIT implies it, no fact wrong); asana alternativesIntro "la remontée des objectifs vers ceux de l’entreprise" slightly expands en "goal roll-up"; opencut "voie d’auto-hébergement packagée" a little literal.

Verdict: PASS
