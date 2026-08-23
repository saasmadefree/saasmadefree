-- Pays des visites, par jour (20.08.2026).
--
-- Le code pays vient de la couche réseau (request.cf.country, posé par
-- Cloudflare), jamais du navigateur : le client ne peut donc ni le falsifier
-- ni avoir à l'envoyer. Deux lettres ISO, et rien d'autre — ni ville, ni
-- région, ni coordonnées.
--
-- Comme tout le reste de ces analytics, c'est un AGRÉGAT journalier : un
-- entier par (jour, pays). Jamais une ligne par requête, donc rien qui puisse
-- rapprocher un pays d'un visiteur, d'une page ou d'une heure.
--
-- La page /privacy liste ce qui est compté ; elle a été mise à jour dans le
-- même commit. Le site promet « ce que vous voyez sur /stats est tout ce
-- qu'on a » : ce compteur DOIT donc être affiché, pas seulement stocké.
CREATE TABLE IF NOT EXISTS countries (
  day     TEXT NOT NULL,
  country TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, country)
);
