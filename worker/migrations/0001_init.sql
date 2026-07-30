CREATE TABLE IF NOT EXISTS votes (
  ip_hash TEXT NOT NULL,
  slug    TEXT NOT NULL,
  day     TEXT NOT NULL,
  PRIMARY KEY (ip_hash, slug, day)
);

CREATE INDEX IF NOT EXISTS idx_votes_slug ON votes(slug);

CREATE TABLE IF NOT EXISTS rate (
  ip_hash TEXT NOT NULL,
  minute  TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, minute)
);
