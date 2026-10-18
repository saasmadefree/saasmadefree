# L0-G4 fix round 1: data issues for the controller

## platform (Huly)
- Checked today on the README of hcengineering/platform: "This repository is frozen and is no longer actively maintained",
  "Hosted Huly has shut down". Development continues in Platform-Collective/platform (a fork "developed independently").
- `data/projects/platform.json` `repo` should probably point to https://github.com/Platform-Collective/platform. The stars
  and last-commit figures now come from the frozen repo.
- A frozen repo may become "inactive" in the data pass. Consider whether Huly should stay in Asana's `alternatives`.
- research/data-issues/L0-p06.md is stale on both points (shutdown and frozen repo).

## socioboard
- The LICENSE file on master is GNU GPL v3 (api.github.com does not detect it). `license` in data should probably be GPL-3.0.

## threaduler
- README says X and Bluesky, but the roadmap still lists "add bsky integration" unchecked. Prose now says "claimed but unconfirmed".
