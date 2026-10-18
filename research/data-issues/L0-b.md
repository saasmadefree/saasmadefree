# Data issues, batch L0-b (checked 2026-10-18)

## calendly
- Duplicate confirmed: `cal-com` and `cal-diy` are the same product. Evidence:
  - `data/projects/cal-com.json` has `repo: calcom/cal.diy` and name "Cal.com", but that repo is Cal.diy (https://github.com/calcom/cal.diy: "a fork of Cal.com with all enterprise/commercial code removed", MIT).
  - `data/projects/cal-diy.json` has name "Cal.diy", homepage https://cal.diy, `repo: null`. The cal.diy site says its "Edit this page" links point to `calcom/cal.diy` (https://cal.diy).
  - Opening https://github.com/calcom/cal.com showed the cal.diy README, so the old repo name now resolves to Cal.diy. Pinggy reports Cal.com moved its production code to a private repo on 15 April 2026 and relicensed the public code as MIT under the name Cal.diy (https://pinggy.io/blog/self_hosted_calendly_alternatives/). Single secondary source.
- Current name is Cal.diy (repo `calcom/cal.diy`, homepage https://cal.diy). Commercial Cal.com (https://cal.com) is a separate hosted product, free plan then Teams at $12 per user per month billed yearly (https://cal.com/pricing).
- Used once, under slug `cal-com` (it carries the stats for the right repo), name "Cal.diy". Controller merges by hand.
- Cal.diy README says "strictly recommended for personal, non-production use". The Pinggy post says the referenced Docker image did not exist on 18 August 2026; not rechecked.
- `cal-com` categories include `tasks`, which looks wrong for a scheduler.
- The Calendly tool entry lists `cal-diy` in `alternatives`; should point to the merged slug.

## trello
- The tool entry lists only `plane` (a software-team tool, not a simple board). Boards-first candidates added: wekan, planka, kan.
- `taiga` repo is split (taiga-back, taiga-front); I used `taigaio/taiga-back`.

## asana
- Slug `platform` (hcengineering/platform, Huly): README says the repo is "no longer actively maintained", development moved to https://github.com/Platform-Collective/platform, and the hosted Huly service has shut down (https://github.com/hcengineering/platform). Repo and homepage in `data/projects/platform.json` need review.

## duolingo-super
- `librelingo`: repo archived by its owner on 2026-06-19, forks suggested (https://github.com/LibreLingo/LibreLingo).
- No open-source project covers the Duolingo course experience; candidates are partial at best.

## zendesk
- `peppermint`: repo archived by its owner on 2026-07-17 (https://github.com/Peppermint-Lab/peppermint).

## hootsuite
- `shoutify` archived in May 2023 per https://postiz.com/blog/open-source-social-media-scheduler (repo page not opened).
- The same blog lists Postiz twice with two different repos (gitroomhq/postiz-app and itzcull/social-scheduler); I kept gitroomhq/postiz-app (existing slug).

## adobe-acrobat-pro
- `pdfding`: GitHub repo archived 2026-08-29, project moved to https://codeberg.org/mrmn/PdfDing (https://github.com/mrmn2/PdfDing). Repo field kept as the GitHub one; the live forge is Codeberg.
- https://openalternative.co/alternatives/adobe-acrobat and `/duolingo` returned no usable content; evidence for those slugs is the repo pages.

## capcut
- `opencut`: README says it is being rewritten, previous version at opencut-app/opencut-classic (https://github.com/OpenCut-app/OpenCut).
- `ffmpeg` GitHub repo is a mirror; contributions go to the project's Forgejo (https://github.com/FFmpeg/FFmpeg).
- `kdenlive` GitHub repo is a mirror of KDE Invent (https://github.com/KDE/kdenlive).

## smartsheet
- `seatable` repo page says part of the source "will be uploaded to GitHub later" and lists a proprietary component; open-source status is partial (https://github.com/seatable/seatable). `nocodb` licence is the Sustainable Use License per its repo page, not an OSI licence.
- `n8n` (zapier) is also Sustainable Use License (fair-code), not OSI open source.
