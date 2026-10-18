# Review L0-G1-fr (lang, fr)
Date: 2026-10-18 · Sample: 27/27 (batch L0, 100 %) · Picks: chatgpt, spotify-premium, ahrefs, myfitnesspal-premium, semrush (tools: alternativesIntro, alternativeNotes, faq[4], faq[5]); jan, ollama, open-webui, lobe-chat, anything-llm, cherry-studio, librechat, onyx, navidrome, jellyfin, koel, ampache, gonic, open-seo, serpbear, seonaut, seomacroscope, sparkyfitness, wger, opennutritracker, waistline, daily-value (projects: whole file)
Verdict: PASS

Method: every fr field read side by side with the en version that passed the Opus gate today (research/reviews/L0-G1.md),
and with `data/tools` / `data/projects` (licence, licenceKind, hosted, pricing). `npm run validate`: 0 errors.
Point 1 here means "same facts as the gated en text and as data/". I did not reopen the source URLs: the en gate
already checked them, and the fr text adds no number that the en text lacks.

| Slug | 1 Sources | 2 Limits | 3 Winner | 4 Calque | 5 FAQ | 6 Language |
|---|---|---|---|---|---|---|
| chatgpt | pass | n/a | pass (Jan = alternatives[0], 118 words) | pass | pass | pass |
| spotify-premium | pass (12,99 $ USD, as in data) | n/a | pass (Navidrome, 102 words) | pass | pass | pass |
| ahrefs | pass | n/a | pass (OpenSEO, 118 words) | pass | pass | pass |
| myfitnesspal-premium | pass (19,99 $) | n/a | pass (SparkyFitness, 117 words) | pass | pass | pass |
| semrush | pass (139,95 $ SEO Pro) | n/a | pass (OpenSEO, 107 words) | pass | pass | pass |
| jan | pass | pass | n/a | pass | n/a | pass |
| ollama | pass | pass | n/a | pass | n/a | pass |
| open-webui | pass (no "open source") | pass | n/a | pass | n/a | pass |
| lobe-chat | pass (no "open source", "pas de l'Apache pur") | pass | n/a | pass | n/a | pass |
| anything-llm | pass | pass | n/a | pass | n/a | pass |
| cherry-studio | pass (open-core stated) | pass | n/a | pass | n/a | pass |
| librechat | pass | pass | n/a | pass | n/a | pass |
| onyx | pass (open-core: ee directories) | pass | n/a | pass | n/a | pass |
| navidrome | pass | pass | n/a | pass | n/a | pass |
| jellyfin | pass | pass | n/a | pass | n/a | pass |
| koel | pass | pass | n/a | pass | n/a | pass |
| ampache | pass | pass | n/a | pass | n/a | pass |
| gonic | pass | pass | n/a | pass | n/a | pass |
| open-seo | pass (10 $ hosted, as in data) | pass | n/a | pass | n/a | pass |
| serpbear | pass | pass | n/a | pass | n/a | pass |
| seonaut | pass | pass | n/a | pass | n/a | pass |
| seomacroscope | pass | pass | n/a | pass | n/a | pass |
| sparkyfitness | pass ("pas open source", explicit negation) | pass | n/a | pass | n/a | pass |
| wger | pass | pass | n/a | pass | n/a | pass |
| opennutritracker | pass | pass | n/a | pass | n/a | pass |
| waistline | pass | pass | n/a | pass | n/a | pass |
| daily-value | pass | pass | n/a | pass | n/a | pass |

Checks that apply to the whole batch:
- `tu` throughout. No `vous`/`votre`, no "feature", no "self-hosted" in prose. Glossary terms are used: auto-hébergé, formule, synchro, appli, dépôt, continue de payer.
- Licence honesty: "open source" appears only in jan, librechat (about ClickHouse's project), seonaut, and sparkyfitness as an explicit negation. Open WebUI, LobeHub and SparkyFitness are never called open source or libre.
- Ruling 47: no stars, creation dates or commit dates in prose. serpbear and seomacroscope send the reader to the table, as the en text does. "projet récent" (daily-value) gives no date.
- FAQ 5 (faq[4]) uses the fixed fr question with the tool `name` in all 5 tools.
- Point 6 of the prompt (Mixpost 299 $): this is consistent. The hootsuite fr note says "Pro, à 299 $ en achat unique". That is the one-time self-hosted Pro licence. research/sources/projects/mixpost.json sources it ("Pro costs $299 (one-time payment…)", mixpost.app/pricing), and the en note says the same. The 29 USD in `data/projects/mixpost.json` `hosted.priceFrom` is the Mixpost Cloud price, a different offer. Not a defect.

## Blocking defects
None.

## Notes (non-blocking)
- chatgpt · `alternativesIntro` · « Elle accepte aussi ta propre clé OpenAI ou Anthropic, souvent moins chère que ChatGPT Plus » grammatically says the key is cheaper. Better: « …ta propre clé OpenAI ou Anthropic ; payer à l'usage revient souvent moins cher que ChatGPT Plus à 20 $ par mois pour un usage léger ».
- jellyfin, gonic · `description` · en "free-software" becomes « gratuit ». The "libre" nuance is lost, though the GPL licence is named just after. Optional: « logiciel libre ».
- navidrome · `limits[1]` · the path pattern is translated (« /ArtisteDeLAlbum/Album/Titre »). It is an example of tag fields, not a literal path, so this is acceptable. Keeping `/AlbumArtist/Album/Song` with a gloss would be more exact.
- ampache · `description` · « met en ligne une collection » reads as "publishes". « diffuse sur le web » would be closer to the meaning.
- myfitnesspal-premium · `alternativesIntro` · « continue de payer 19,99 $ » has no « par mois ». The en text has the same gap. spotify-premium says « par mois ».
- Several files · `strengths`/`limits` · some lists end items with a period and some do not (ampache, gonic, open-seo, serpbear, seonaut, seomacroscope, sparkyfitness, wger, waistline, opennutritracker). This copies the en files. Only cosmetic.
- ollama · « compute capability » kept in English. It is Nvidia's technical term, so this is acceptable.
