-- Analytics first-party (spec docs/superpowers/specs/2026-08-04-stats-page-design.md §7).
-- Uniquement des agrégats journaliers : jamais une ligne par requête, jamais
-- une URL référente ni un user-agent brut. `uniques` est la seule table à une
-- ligne par visiteur×jour ; son ip_hash (salé quotidien, voir hash.mjs) est
-- irréversible et non recoupable entre jours, et elle est purgée à 45 jours.
CREATE TABLE IF NOT EXISTS hits (
  day  TEXT NOT NULL,
  path TEXT NOT NULL,
  lang TEXT NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);

CREATE TABLE IF NOT EXISTS uniques (
  day     TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (day, ip_hash)
);

CREATE TABLE IF NOT EXISTS events (
  day     TEXT NOT NULL,
  kind    TEXT NOT NULL,
  subject TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, subject)
);

CREATE TABLE IF NOT EXISTS crawlers (
  day    TEXT NOT NULL,
  bot    TEXT NOT NULL,
  source TEXT NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, bot, source)
);
