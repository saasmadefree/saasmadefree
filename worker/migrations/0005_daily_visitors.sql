-- Jours-visiteurs conservés au-delà de la purge (20.08.2026).
--
-- `uniques` porte une ligne par visiteur×jour, mais elle est purgée à 45 jours
-- (UNIQUES_RETENTION_DAYS) : le total depuis l'origine y était donc perdu.
-- Cette table garde le DÉCOMPTE du jour, jamais les hachages — un entier par
-- date, rien qui puisse être recoupé avec quoi que ce soit.
--
-- Ce que ce total est, et ce qu'il n'est pas : c'est la somme des visiteurs
-- uniques QUOTIDIENS, pas un nombre de personnes. Le sel du hachage change
-- chaque jour (voir hash.mjs), donc la même personne revenue trois jours
-- compte trois fois — et c'est délibéré, c'est le prix d'un identifiant
-- irrecoupable. Le libellé de la page dit « jours-visiteurs », jamais
-- « visiteurs », parce que la seconde formulation serait fausse.
CREATE TABLE IF NOT EXISTS daily_visitors (
  day TEXT NOT NULL PRIMARY KEY,
  n   INTEGER NOT NULL DEFAULT 0
);
