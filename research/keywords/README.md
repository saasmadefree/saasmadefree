# Search demand for "{tool} alternative(s)"

Measured on 2026-10-18 with the Semrush API, report `phrase_these` (columns keyword, volume, keyword_difficulty), 100 keywords per call.
- us: 4 keywords x 530 tools ("X alternative", "X alternatives", "free X alternative", "open source X alternative"); fr: 4 x 530 ("alternative X", "alternative à X", "X alternative", "X gratuit").
- es/de/pt(br)/it/nl: one probe per language on the top 100 tools by score (patterns in each file's `_meta.keywordPattern`).
- Units: 10 API units per keyword returned (absent keywords cost nothing). Total 25,950 units (us 12,570, fr 10,150, languages 3,230).
- Query names: lower-case `name` minus plan suffixes; every change is listed in `_meta.renamed` of each file. "tl;dv" became "tldv" (the ";" separates keywords in the API).
- A value of 0 with the key listed in `absent` means "not in Semrush", not "measured at zero". Volumes are monthly, Semrush rounding.
- Score = alts_us + 0.5 x alt_us + 3 x (alternative_fr + alternative_a_fr), see `../priority.json`.
- Rerun: rebuild the keyword lists from `data/tools/*.json` (same naming rules), call `phrase_these` per database in batches of 100, then recompute. No script is committed; the one-off scripts were kept in the session scratchpad.
- Caveats: "myfitnesspal alternative" (18,100 us) and "spotify alternatives" look inflated by non-tool intent. In `de`, "{q} alternative" is also the English phrase typed by German users, so the de total is an upper bound.
