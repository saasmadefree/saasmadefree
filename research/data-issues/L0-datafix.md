
## opensign
- hosted: free cloud tier stated in README only. opensignlabs.com/plans-pricing renders client-side and could not be read. priceFrom 0 taken from the README, source is the README.

## owncloud-ocis
- hosted left `{exists:false}` with no date: owncloud.com/pricing sells a Germany-hosted offer ("ownCloud.online", from 1,85 EUR/user/year shown), unclear if it runs Infinite Scale.

## spree-commerce
- hosted left `{exists:false}` with no date: Enterprise "Managed Private Cloud" exists, no public price.

## windmill
- hosted left `{exists:false}` with no date: Windmill Cloud exists, but the pricing page tabs do not render a cloud price in static HTML.

## wekan
- priceFrom 4.17 EUR is 50 EUR/year divided by 12 (wekan.fi/saas has no monthly price).

## thunderbird-appointment
- priceFrom 6 USD is the Thunderbird Pro bundle on tb.pro, shown with "Join Waitlist".

## automatisch
- automatisch.io says "affordable cloud solution" but shows no price or sign-up link (checked 2026-10-18). `hosted` left `{exists:false}` with no date.

## jan
- docs.jan.ai lists "Jan Web" (browser version) but no pricing page was found. `hosted` left `{exists:false}` with no date.

## kestra
- kestra.io/pricing sells a Cloud Edition by "Request Access" with no public price. `hosted` left `{exists:false}` with no date.

## libresign
- libresign.coop/pricing: "public pricing is not yet available" (commercial plans in preparation). `hosted` left `{exists:false}` with no date.

## n8n
- Text still says "open source" in `data/i18n/en/projects/n8n.json` strengths[3]; `licenseKind` is `fair-code` (Sustainable Use License). Needs a writer.

## ollama
- Pricing page shows a Free plan ($0, local plus starter cloud credits) and Pro $20. Kept `priceFrom: 20` (paid cloud subscription). Change to 0 if the controller counts the free cloud credits as a hosted tier.

## leantime, mixpost
- Prices taken at monthly billing (Leantime Pro $10/user/month, $8 billed yearly; Mixpost Cloud $29/month, $249/year).

## mautic
- Hosting at mautic.org/start-using-mautic/managed-mautic/ is run by Dropsolid, "our official trials and hosting partner" (from EUR 247.50/month billed yearly). Recorded as hosted; remove if only first-party hosting counts.

## gimp, inkscape
- `repo` stays null (no GitHub repo; GitLab only), so no stats. inkscape.org returned 403 to curl today (bot block), so `licenseSource` points to GitLab COPYING.
