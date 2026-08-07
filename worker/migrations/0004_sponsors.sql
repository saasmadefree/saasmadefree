-- Emplacements sponsors : état commercial. La créa (nom, domaine, tagline)
-- vit dans data/sponsors.json et passe par une revue git — elle n'entre
-- jamais en base, et n'est donc jamais injectée dans une page depuis D1.
CREATE TABLE IF NOT EXISTS sponsor_slots (
  slot           TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,      -- 'rail' | 'tape'
  status         TEXT NOT NULL,      -- 'open' | 'reserved' | 'paid'
  session_id     TEXT,
  reserved_until TEXT,
  starts_on      TEXT,
  ends_on        TEXT
);

CREATE TABLE IF NOT EXISTS sponsor_orders (
  session_id   TEXT PRIMARY KEY,
  slot         TEXT NOT NULL,
  months       INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  email        TEXT,
  name         TEXT,
  domain       TEXT,
  tagline      TEXT,
  -- Écrits par le webhook : 'paid' (encaissé ET emplacement attribué) ou
  -- 'unassigned' (encaissé sans emplacement — à trancher à la main, c'est la
  -- requête à surveiller). 'refunded' se pose à la main après remboursement.
  status       TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsor_orders_slot ON sponsor_orders(slot);
CREATE INDEX IF NOT EXISTS idx_sponsor_slots_status ON sponsor_slots(status);
