export const FEED_ORIGIN = 'https://saasmadefree.com';
export const FEED_BASE = `${FEED_ORIGIN}/feed/v1`;
export const VOTE_ENDPOINT = 'https://votes.saasmadefree.com/api/v1/vote';
export const REFRESH_ALARM = 'refresh-feed';
export const REFRESH_PERIOD_MINUTES = 1440;
export const LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl'];

export const GITHUB_ISSUE_URL = 'https://github.com/saasmadefree/saasmadefree/issues/new';

export function pickLang(uiLanguage) {
  const base = String(uiLanguage ?? 'en').toLowerCase().split('-')[0];
  return LANGS.includes(base) ? base : 'en';
}
