// Feuille de style unique, émise une seule fois vers dist/assets/site.css.
//
// Direction « Le Dossier instruit » (spec 2026-08-04) : le site est un dossier
// administratif — kraft tramé du bureau, feuillets réglés, chemises à onglet,
// tampons encrés, annotations au stylo du contrôleur. Trois familles système,
// trois rôles : le monospace est la machine à écrire (corps, valeurs, prix),
// l'imprimé condensé porte étiquettes, tampons et en-têtes, le serif italique
// est la main du contrôleur. Le monde est imprimé : rien n'y bouge — la seule
// exception est le bandeau sponsor, une obligation contractuelle déjà couverte
// par prefers-reduced-motion.

/** Palette fermée du spec 2026-08-04 (§2 clair, §5 sombre). Unique source des
 *  deux thèmes : SITE_CSS est généré depuis cette table (via cssVars), et
 *  tests/site-contrast.test.mjs vérifie chaque paire AA. Toute couleur absente
 *  d'ici n'a pas le droit d'exister dans la feuille. */
export const TOKENS = {
  light: {
    paperDesk: '#e8e0cc', paperDeskWeave: '#e6ddc7', paperFolder: '#e0cfa2',
    paperSheet: '#f7f2e3', paperBright: '#fdfaf0', paperCartouche: '#f0e9d5',
    ink: '#2b2317', ink2: '#4a4132', ink3: '#5d5445',
    pen: '#2d3a52', hl: '#f3ecc9',
    stampYes: '#2f5d33', stampKinda: '#6b4600', stampNo: '#9c2a1c', stampDate: '#28522c',
    // Utilitaires décoratifs (spec §2 : bruns utilitaires, métal, réglure de
    // feuillet) — jamais porteurs de texte, donc hors contrainte AA.
    line: '#b6a988', lineStrong: '#8b7f68', paperRule: '#f5efdf',
    metal: '#8a8069', metal2: '#948a72',
  },
  dark: {
    // Papier bistre du §5 — valeurs de départ, à ajuster JUSQU'À ce que
    // tests/site-contrast.test.mjs passe ; le test est l'arbitre, pas l'œil.
    paperDesk: '#171410', paperDeskWeave: '#1a1713', paperFolder: '#241e14',
    paperSheet: '#211d15', paperBright: '#2a251b', paperCartouche: '#262117',
    ink: '#e8e0cc', ink2: '#c9bda0', ink3: '#a89a79',
    pen: '#a9bcdf', hl: '#3a3320',
    stampYes: '#8fc79a', stampKinda: '#dfaa55', stampNo: '#e8998a', stampDate: '#84bd8f',
    // Filets et métal assombris dans l'esprit bistre — décoratifs eux aussi.
    line: '#4a3f2c', lineStrong: '#6b5c3f', paperRule: '#242016',
    metal: '#66604e', metal2: '#79715c',
  },
};

// Chaque token DOIT avoir un nom de variable : la table jette si une clé de
// TOKENS n'est pas mappée, ce qui garantit que « chaque valeur des deux thèmes
// est émise » (garde-fou de tests/site-styles.test.mjs) ne dérive jamais.
const VAR_NAMES = {
  paperDesk: 'paper-desk', paperDeskWeave: 'paper-weave', paperFolder: 'paper-folder',
  paperSheet: 'paper-sheet', paperBright: 'paper-bright', paperCartouche: 'paper-cartouche',
  paperRule: 'paper-rule',
  ink: 'ink', ink2: 'ink-2', ink3: 'ink-3', pen: 'pen', hl: 'hl',
  stampYes: 'stamp-yes', stampKinda: 'stamp-kinda', stampNo: 'stamp-no', stampDate: 'stamp-date',
  line: 'line', lineStrong: 'line-strong', metal: 'metal', metal2: 'metal-2',
};

function cssVars(theme) {
  return Object.entries(theme).map(([key, value]) => {
    const name = VAR_NAMES[key];
    if (!name) throw new Error(`token TOKENS.${key} sans variable CSS dans VAR_NAMES`);
    return `--${name}:${value};`;
  }).join('');
}

// Nota sur les ombres : elles restent écrites en rgba(43,35,23,…) — c'est
// --ink clair (#2b2317) rendu translucide. Une ombre de papier est portée par
// la lumière du bureau, pas par le thème : elle reste bistre sombre même sur
// le papier de nuit, où elle se fait simplement discrète.

// Trame commune des feuillets réglés du dossier : fond rayé + bordure, la
// matière posée identique sur .registry, .sheet et pre — le corps d'un
// feuillet, qu'il porte un tableau, une pièce ou du code. Un seul endroit
// change les trois plutôt que trois copies à faire dériver une à une.
// SHEET_SHADOW est la première ombre de papier, commune aux trois ; .registry
// et .sheet lui ajoutent une seconde ombre plus large (SHEET_SHADOW_LIFTED) —
// pre n'en porte qu'une, il ne « flotte » pas au-dessus du feuillet qui le
// contient.
const SHEET_TRAME = 'background:var(--paper-sheet) repeating-linear-gradient(0deg,var(--paper-sheet) 0 4px,var(--paper-rule) 4px 8px);border:1px solid var(--line-strong)';
const SHEET_SHADOW = 'box-shadow:0 2px 0 rgba(43,35,23,.06)';
const SHEET_SHADOW_LIFTED = `${SHEET_SHADOW},0 10px 20px rgba(43,35,23,.13)`;

export const SITE_CSS = `:root{${cssVars(TOKENS.light)}
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --cond:"Avenir Next Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif;
  --hand:Georgia,"Times New Roman",serif;
  /* Alias des sections conservées (coquille, sponsors, stats) : des références
     vers les tokens du dossier, jamais des littéraux — les deux thèmes coulent
     au travers sans réécrire un CSS couvert par ~1 000 lignes de tests. */
  --paper:var(--paper-desk);--card:var(--paper-sheet);--muted:var(--ink-3);
  --rule:var(--line);--yes:var(--stamp-yes);--kinda:var(--stamp-kinda);--no:var(--stamp-no);
  /* Les encres de verdict ne servent que le verdict : la marque des graphiques
     de /stats (stats.js lit --accent au canvas) passe au stylo du contrôleur. */
  --accent:var(--pen);
  --sans:var(--cond);
  --measure:36rem;--wide:48rem;
}
/* Le thème suit le système par défaut, sauf si le lecteur a choisi. Le
   :not([data-theme="light"]) est ce qui laisse un choix explicite « clair »
   l'emporter sur un système en sombre. */
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${cssVars(TOKENS.dark)}}}
:root[data-theme="dark"]{${cssVars(TOKENS.dark)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
/* Le bureau : kraft tramé en bandes verticales de 6px — la seule « texture »
   autorisée, entre deux tons de la palette. Les chiffres s'alignent partout
   (tabular-nums) : c'est un document de service, pas une brochure. */
body{
  margin:0;color:var(--ink);
  background:var(--paper-desk) repeating-linear-gradient(90deg,var(--paper-desk) 0 6px,var(--paper-weave) 6px 12px);
  font:400 15px/1.62 var(--mono);font-variant-numeric:tabular-nums;
  padding:clamp(1.25rem,4vw,2.5rem) 0;
}
/* Le padding horizontal vit ici et non plus sur body : .col-main doit occuper
   toute la largeur de la fenêtre pour que 100cqw vaille exactement 100vw quand
   aucun rail n'est affiché. 67rem = 62rem de texte + 2 × 2.5rem de padding, ce
   qui reproduit la mesure actuelle au pixel près sur grand écran. */
.page{max-width:67rem;margin:0 auto;padding-inline:clamp(1rem,5vw,2.5rem)}
.shell{display:grid;grid-template-columns:1fr;justify-content:center}
.col-main{container-type:inline-size;min-width:0}
/* Le souligné de repos est pointillé — un renvoi de dossier ; il devient plein
   au survol (spec §7 : les états sont des marquages, jamais du mouvement). */
a{color:inherit;text-decoration:underline dotted;text-decoration-thickness:.07em;
  text-underline-offset:.2em;text-decoration-color:var(--line-strong)}
a:hover{text-decoration-style:solid;text-decoration-color:currentColor}
:focus-visible{outline:2px solid var(--pen);outline-offset:2px}

.skip-link{position:absolute;left:-999px;width:1px;height:1px;overflow:hidden;
  background:var(--ink);color:var(--paper-bright);padding:.6em 1em;z-index:10}
.skip-link:focus{position:fixed;left:1rem;top:1rem;width:auto;height:auto;overflow:visible}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* ---------- titres ---------- */
/* Le h1 reste en machine à écrire : c'est l'objet de la demande, tapé sur le
   formulaire, pas un slogan. Les h2 sont l'imprimé condensé des têtes de
   rubrique du service. */
h1{font-size:clamp(1.5rem,1.1rem + 1.8vw,2.1rem);line-height:1.36;font-weight:700;
  letter-spacing:-.01em;margin:0 0 .6rem;text-wrap:balance}
h2{font-family:var(--cond);font-size:1.05rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.18em;margin:2rem 0 .8rem}
section:first-of-type > h2:first-child{margin-top:0}
p{margin:0 0 .9rem;max-width:var(--wide)}
.tagline{color:var(--ink-2);font-size:.85rem;margin:0 0 .8rem;max-width:var(--measure)}
.lede{max-width:var(--measure);color:var(--muted);margin:0 0 clamp(2rem,5vh,3rem)}
.hero-h1{max-width:34ch}
.hero-sub{max-width:58ch;color:var(--ink-2)}
/* La ligne à remplir du formulaire héro : un cadre de saisie avec sa ligne
   d'écriture (l'ombre interne basse), le nom attendu en main de contrôleur. */
h1 .blank,.hero-blank{display:inline-block;min-width:8ch;border:1.5px solid var(--line-strong);
  background:var(--paper-sheet);box-shadow:inset 0 -3px 0 var(--line);
  padding:0 .5em .1em;line-height:1.4;vertical-align:-2px}
h1 .blank em,.hero-blank em{font-family:var(--hand);font-style:italic;font-size:.9em;
  letter-spacing:.08em;color:var(--ink-3)}
/* Les trois feuillets du bordereau (héro, cadre recherche, état récapitulatif)
   sont posés l'un sous l'autre sur le bureau : .sheet fournit la matière
   (cadre, réglure), ces règles ne fixent que l'espace — le rythme vertical
   qui vivait dans les composants disparus (.search-combo seul, .figures-band). */
.hero{padding:1.6rem 1.6rem 1rem}
.hero,.search-frame,.recap{margin:0 0 clamp(1.5rem,4vh,2.25rem)}
/* La lede fait 3-4 lignes : jamais de rotation sur un paragraphe de plus de
   deux lignes (spec §7). */
.hero .pen-note{transform:none}

/* ---------- chrome : bandeau de service, marque, cartouche ---------- */
.service-band{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.4rem 1.2rem;
  font-family:var(--cond);font-size:.68rem;font-weight:700;letter-spacing:.28em;
  text-transform:uppercase;color:var(--ink-2);padding:.75rem 0 .6rem;
  border-bottom:1px solid var(--line)}
.site-masthead,.site-header{display:flex;flex-wrap:wrap;align-items:center;gap:.9rem 1rem;
  padding:1rem 0 0}
/* La marque au coin : un cachet carré à double filet (les deux inset), comme
   frappé sur la couverture du dossier. */
.brand-mark{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;
  border:2px solid var(--ink);box-shadow:inset 0 0 0 3px var(--paper-desk),inset 0 0 0 4px var(--ink);
  font-family:var(--cond);font-weight:700;font-size:.7rem;letter-spacing:.06em;flex:none}
.brand{font-family:var(--cond);font-weight:700;font-size:1.05rem;text-transform:uppercase;
  letter-spacing:.15em;white-space:nowrap;text-decoration:none;color:var(--ink)}
.nav-links{list-style:none;display:flex;align-items:baseline;gap:.9rem;padding:0;
  margin:0 0 0 auto;font-family:var(--cond);font-size:.76rem;font-weight:600;
  text-transform:uppercase;letter-spacing:.13em;flex-wrap:wrap}
/* La langue active est passée au surligneur (--hl est un fond, jamais une
   encre) : le lecteur voit d'un coup d'œil sur quel exemplaire il est. */
.lang-switch{display:inline-flex;align-items:baseline;gap:.6rem;font-family:var(--cond);
  font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.13em;color:var(--muted)}
.lang-switch a{color:var(--muted)}
.lang-switch a:hover{color:var(--ink)}
.lang-switch [aria-current]{color:var(--ink);background:var(--hl);box-shadow:0 0 0 3px var(--hl);
  text-decoration:none;font-weight:700}
/* Bascule de thème : un petit cachet carré, aria-label porté par le bouton
   (voir site-html.mjs / site.js). Les glyphes suivent le thème résolu. */
.theme-toggle{display:inline-flex;align-items:center;justify-content:center;
  width:2.1rem;height:2.1rem;padding:0;border:2px solid var(--ink);border-radius:0;
  background:var(--paper-bright);color:var(--ink);font-size:1rem;flex:none;cursor:pointer;
  box-shadow:2px 2px 0 rgba(43,35,23,.22)}
.theme-toggle:hover:not(:disabled){background:var(--paper-cartouche)}
.theme-icon::before{content:"\\25D0";line-height:1}
:root[data-theme="dark"] .theme-icon::before{content:"\\25D1"}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .theme-icon::before{content:"\\25D1"}
}
.github-btn{display:inline-flex;align-items:center;gap:.35em;border:2px solid var(--ink);
  padding:.45em .9em;font-family:var(--cond);font-size:.72rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.16em;white-space:nowrap;text-decoration:none;
  color:var(--ink);box-shadow:2px 2px 0 rgba(43,35,23,.25)}
.github-btn:hover{background:var(--paper-cartouche)}
/* Le double filet d'imprimé qui clôt l'en-tête, puis la cartouche de
   références accrochée dessous (chaque cellule porte un fait calculé). */
.head-rule{border-top:3px solid var(--ink);border-bottom:1px solid var(--ink);height:6px;
  margin:.9rem 0 0}
.ref-strip{display:flex;flex-wrap:wrap;border:1px solid var(--line-strong);border-top:0;
  background:var(--paper-cartouche);box-shadow:0 3px 8px rgba(43,35,23,.10);
  margin:0 0 clamp(1.5rem,4vh,2.25rem)}
.ref-cell{padding:.5rem 1rem .55rem;border-right:1px dotted var(--line);
  display:flex;flex-direction:column;gap:1px}
.ref-cell:last-child{border-right:0}
.ref-lbl{font-family:var(--cond);font-size:.6rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.2em;color:var(--muted)}
.ref-val{font-size:.82rem;font-weight:700;white-space:nowrap}
.breadcrumb{font-size:.8rem;color:var(--ink-2);margin:0 0 1.4rem}
.breadcrumb a{color:inherit}

/* ---------- cadre de recherche + volet de suggestions ---------- */
search{display:block;margin:0}
.search-combo{position:relative;z-index:40;max-width:38rem;margin:0 0 clamp(1.5rem,4vh,2.25rem)}
.search-frame{border:1px solid var(--line-strong);background:var(--paper-sheet);
  padding:.9rem 1.1rem 1rem;box-shadow:0 3px 10px rgba(43,35,23,.12)}
/* L'étiquette du champ est le cartouche « Cadre n — … » de la maquette. */
.field label{display:inline-block;font-family:var(--cond);font-size:.62rem;font-weight:700;
  letter-spacing:.24em;text-transform:uppercase;color:var(--ink-2);
  border:1px solid var(--line);background:var(--paper-cartouche);padding:4px 10px;margin:0 0 .7rem}
.search-shell{position:relative;display:flex;align-items:center;gap:.9rem}
/* Le champ est une ligne pointillée de formulaire, pas une boîte : elle passe
   au trait plein en encre stylo quand le contrôleur écrit dedans (le focus
   reste visible sans boîte bleue du navigateur). */
input[type=search]{flex:1;min-width:0;width:100%;font:inherit;color:var(--ink);
  background:transparent;border:0;border-bottom:2px dotted var(--ink-3);border-radius:0;
  padding:.35em 2rem .35em .1em;outline:none}
input[type=search]::placeholder{font-family:var(--hand);font-style:italic;color:var(--ink-3);opacity:1}
input[type=search]::-webkit-search-cancel-button{display:none}
.search-shell:focus-within input[type=search]{border-bottom:2px solid var(--pen)}
.search-clear{position:absolute;right:.2rem;top:50%;transform:translateY(-50%);
  background:transparent;border:0;box-shadow:none;color:var(--muted);
  font-size:1.15rem;line-height:1;padding:.15em .4em;cursor:pointer}
.search-clear:hover{color:var(--ink)}
.search-panel{position:absolute;top:calc(100% + .4rem);left:0;right:0;z-index:30;
  background:var(--paper-bright);border:1px solid var(--line-strong);
  box-shadow:0 10px 22px rgba(43,35,23,.22);max-height:26rem;overflow-y:auto;
  padding:.35rem;text-align:left}
.search-option{display:flex;align-items:center;gap:.6rem;padding:.55em .7em;
  cursor:pointer;font-size:.85rem}
.search-option:hover,.search-option[aria-selected="true"]{background:var(--paper-cartouche)}
.search-option[aria-selected="true"]{box-shadow:inset 2px 0 0 var(--pen)}
.search-option-icon{width:20px;height:20px;flex:none;object-fit:contain}
.search-option-name{font-weight:700;flex:none}
.search-option-meta{margin-left:auto;color:var(--muted);font-size:.76rem;
  white-space:nowrap;display:flex;align-items:center;gap:.35em}
.search-option-viewall{border-top:1px solid var(--line);margin-top:.3rem;
  padding-top:.7em;color:var(--muted);justify-content:flex-start}
.search-empty{padding:.8em .7em;color:var(--muted);font-size:.85rem}

/* ---------- pastilles de catégorie et cases-filtres du verdict ---------- */
.chips-nav{margin:0 0 clamp(1.5rem,4vh,2rem)}
.chips{max-width:none;display:flex;flex-wrap:wrap;gap:.45rem;list-style:none;padding:0;margin:0}
.chips a,.chip{display:inline-flex;align-items:center;gap:.4em;text-decoration:none;
  font-family:var(--cond);font-size:.72rem;font-weight:600;text-transform:uppercase;
  letter-spacing:.12em;padding:.4em .8em;border:1px solid var(--line-strong);border-radius:0;
  box-shadow:none;background:var(--paper-sheet);color:var(--ink);white-space:nowrap;cursor:pointer}
.chips a:hover,.chip:hover{border-color:var(--ink);background:var(--paper-cartouche)}
/* La rubrique retenue est encrée pleine, comme l'onglet d'une pièce. */
.chips a[aria-current],.chip[aria-pressed="true"],.chip.is-active{
  background:var(--ink);color:var(--paper-sheet);border-color:var(--ink)}
.chip-all-categories{font-weight:700}
.verdict-chips{display:flex;flex-wrap:wrap;gap:.45rem;margin:0 0 1rem}
/* Les filtres de verdict sont des cases de bordereau : l'état coché est un
   marquage (fond cartouche + filet stylo), jamais un changement de couleur
   seul — spec §7. */
.verdict-chip{display:inline-flex;align-items:center;gap:.45em;font-family:var(--cond);
  font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.14em;
  color:var(--ink);border:1px solid var(--line-strong);border-radius:0;box-shadow:none;
  background:var(--paper-sheet);padding:.4em .8em;cursor:pointer}
.verdict-chip:hover{border-color:var(--ink)}
/* color répété à dessein : .chip.is-active (rubrique encrée pleine, plus
   haut) pose color:paper-sheet à spécificité égale — sans ce color, la case
   active affichait du papier sur du papier (recette navigateur 2026-08-12). */
.verdict-chip.is-active{background:var(--paper-cartouche);color:var(--ink);box-shadow:inset 2px 0 0 var(--pen)}

/* ---------- tête de section du registre ---------- */
.list-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;
  gap:.5rem 1.5rem;margin:0 0 .8rem;border-bottom:2px solid var(--ink);padding-bottom:.5rem}
.list-head h2{margin:0}
.rank-note{color:var(--muted);font-size:.8rem;margin:0;text-align:right;max-width:26rem}
@media (max-width:36rem){.rank-note{text-align:left}}

/* ---------- le registre ---------- */
/* .registry se pose sur le .table-scroll existant (site.js lit .cat/.price
   dans les lignes — crochets conservés). La feuille est réglée : la trame
   horizontale de 4px est celle des feuillets du dossier. */
.table-scroll{overflow-x:auto;margin:0 0 1.5rem}
.registry{${SHEET_TRAME};${SHEET_SHADOW_LIFTED}}
.registry table{min-width:40rem}
table{width:100%;border-collapse:collapse}
caption{text-align:left;color:var(--muted);font-size:.78rem;padding:.6rem .8rem 0;caption-side:top}
th,td{text-align:left;padding:.6em .8em;border-bottom:1px solid var(--line);vertical-align:middle}
td+td,th+th{border-left:1px dotted var(--line)}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
thead th,thead td{font-family:var(--cond);font-size:.66rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-2);font-weight:700;
  border-bottom:2px solid var(--ink);white-space:nowrap}
tbody th{font-weight:700}
/* Le favicon de chaque ligne : alt vide — décoration, le nom porte déjà
   l'information. */
tbody th a{display:inline-flex;align-items:center;gap:.55em;text-decoration:none}
tbody th a:hover{text-decoration:underline dotted}
.row-favicon{width:20px;height:20px;flex:none;object-fit:contain}
tbody tr[hidden]{display:none}
#tool-rows tr:hover td,#tool-rows tr:hover th{background:var(--paper-cartouche)}
.rank{color:var(--ink-3);font-variant-numeric:tabular-nums;font-size:.78rem;
  letter-spacing:.06em;width:1%;padding-right:0;white-space:nowrap}
.price,.votes{font-variant-numeric:tabular-nums;white-space:nowrap}
.votes{color:var(--muted);font-size:.85rem}
.cat{white-space:nowrap;font-size:.85rem;color:var(--ink-3)}

/* Numérotation du registre : un compteur CSS suit le DOM après re-tri (votes)
   et filtrage (recherche) par site.js — un numéro écrit dans le HTML au build
   deviendrait faux. Ces numéros sont un ordre de lecture, pas une cote : la
   cote stable d'un outil est son slug (code-barres). */
#tool-rows{counter-reset:row}
#tool-rows tr:not([hidden]){counter-increment:row}
#tool-rows td.rank::before{content:counter(row,decimal-leading-zero)}
#no-results{color:var(--muted)}

/* ---------- tampons, cachets ---------- */
/* Un tampon est une bordure de sa propre encre (currentColor) : la couleur ne
   se pose jamais en aplat sous du texte, et les encres de verdict ne colorent
   que le verdict. Rotations ≤ 8°, réservées aux tampons. */
.stamp{display:inline-block;border:3px solid currentColor;outline:1px solid currentColor;
  outline-offset:2px;font-family:var(--cond);font-weight:700;text-transform:uppercase;
  text-align:center;white-space:nowrap}
.stamp-verif{color:var(--ink-2);font-size:.66rem;letter-spacing:.2em;padding:7px 11px;
  transform:rotate(4deg)}
.stamp-sub{display:block;font-size:.56rem;letter-spacing:.18em;margin-top:6px;
  padding-top:5px;border-top:1px solid currentColor}
/* Le tampon verdict S'APPELLE .badge : site.js fait row.querySelector('.badge')
   et le test verdictBadge existant reste vert. En ligne de registre c'est le
   petit mot cacheté ; en chemise, .badge-lg le passe au grand format. */
.badge{display:inline-block;border:1.5px solid currentColor;font-family:var(--cond);
  font-size:.64rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  padding:2px 7px 1px;transform:rotate(-2deg);white-space:nowrap;background:none;line-height:1.4}
.badge.yes{color:var(--stamp-yes)}
.badge.kinda{color:var(--stamp-kinda)}
.badge.no{color:var(--stamp-no)}
.badge-lg{border-width:3px;outline:1px solid currentColor;outline-offset:2px;
  font-size:1.3rem;letter-spacing:.3em;padding:12px 8px 10px 20px;transform:rotate(-6deg);
  line-height:1.15;text-align:center;flex:none}
/* Tampon dateur rond — encre verte d'archive, réservé à la date du relevé de
   prix (pricing.checkedOn) : un seul porteur de cette date par page. */
.date-ring{width:98px;height:98px;border:2px solid var(--stamp-date);border-radius:50%;
  display:inline-flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;color:var(--stamp-date);font-family:var(--cond);font-size:.56rem;
  font-weight:700;letter-spacing:.15em;text-transform:uppercase;line-height:1.55;
  transform:rotate(7deg);position:relative;flex:none}
.date-ring::before{content:"";position:absolute;inset:7px;border:1px solid var(--stamp-date);border-radius:50%}
.date-ring strong{font-size:.82rem;letter-spacing:.06em;white-space:nowrap;margin:1px 0}

/* ---------- la main du contrôleur ---------- */
/* Tout ce qui est en --pen est ce qu'un contrôleur aurait écrit à la main —
   et rien d'autre. Rotations ≤ 1.5°, jamais sur plus de deux lignes. */
.pen-line{display:inline-block;font-family:var(--hand);font-style:italic;color:var(--pen);
  font-size:.85rem;line-height:1.55;transform:rotate(-.5deg)}
.pen-note{font-family:var(--hand);font-style:italic;color:var(--pen);font-size:.85rem;
  line-height:1.55;margin:0 0 .85rem;padding-left:15px;position:relative;
  transform:rotate(-.6deg);max-width:var(--measure)}
.pen-note::before{content:"\\2014";position:absolute;left:0;top:0}
.paraphe{display:inline-block;font-family:var(--hand);font-style:italic;color:var(--pen);
  font-size:1.3rem;font-weight:700;letter-spacing:.05em;transform:rotate(-6deg);
  border-bottom:2px solid var(--pen);padding:0 6px 2px;margin-left:10px}
/* Le souligné main porte un second trait translucide : un double passage de
   stylo, pas une ombre portée (spec §2). */
.hand-underline{border-bottom:2px solid var(--pen);
  box-shadow:0 2px 0 color-mix(in srgb,var(--pen) 30%,transparent)}

/* ---------- cases à cocher du dossier ---------- */
/* Deux échelles, deux encres (spec §2) : la petite coche de suivi est au stylo
   (.pen-check), la grande case du verdict est imprimée et cochée à l'encre
   noire de la machine (.check-box, croix --ink). */
.pen-check{display:inline-block;width:12px;height:12px;border:1.5px solid var(--ink);
  background:var(--paper-bright);position:relative;flex:none;vertical-align:-1px}
.pen-check::after{content:"";position:absolute;left:1px;top:-5px;width:13px;height:7px;
  border-left:2px solid var(--pen);border-bottom:2px solid var(--pen);transform:rotate(-48deg)}
.verdict-checks{display:flex;flex-wrap:wrap;gap:.75rem 2.2rem;margin:.8rem 0 .6rem}
.check-item{display:inline-flex;align-items:center;gap:11px;font-family:var(--cond);
  font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:var(--ink)}
.check-box{width:21px;height:21px;border:2px solid var(--ink);background:var(--paper-bright);
  position:relative;flex:none}
.is-checked .check-box::before,.is-checked .check-box::after{content:"";position:absolute;
  left:-3px;right:-3px;top:calc(50% - 1.5px);height:3px;background:var(--ink)}
.is-checked .check-box::before{transform:rotate(44deg)}
.is-checked .check-box::after{transform:rotate(-47deg)}

/* ---------- chemise à onglet (fiche) ---------- */
.folder{position:relative;background:var(--paper-folder) repeating-linear-gradient(0deg,rgba(43,35,23,.035) 0 2px,rgba(43,35,23,0) 2px 5px);
  border:1px solid var(--line-strong);padding:2rem 2.2rem 1.6rem 2.75rem;margin:2.1rem 0 2.9rem}
.folder-tab{position:absolute;bottom:100%;left:26px;background:var(--paper-folder);
  border:1px solid var(--line-strong);border-bottom:0;border-radius:7px 7px 0 0;
  padding:7px 20px 5px;font-family:var(--cond);font-size:.66rem;font-weight:700;
  letter-spacing:.18em;text-transform:uppercase;color:var(--ink);white-space:nowrap;
  max-width:calc(100% - 26px);overflow:hidden;text-overflow:ellipsis}
.folder-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:1.6rem}
.folder-id{flex:1;min-width:min(100%,300px)}
.folder-stamps{display:flex;align-items:center;gap:1.4rem;flex:none;padding:10px 8px 0 0}
.folder-foot{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem 1.1rem;margin:1.6rem 0 0;
  padding-top:1rem;border-top:1px dashed var(--line-strong)}

/* ---------- artefacts physiques ---------- */
/* Trombone, perforations, code-barres : CSS pur, toujours aria-hidden, jamais
   posés sur du texte (le padding gauche de .folder réserve la marge des
   œillets). Le code-barres superpose trois trames de barres — c'est la cote
   imprimée du dossier, pas un décor gratuit. */
.paper-clip{position:absolute;top:-20px;right:15%;width:24px;height:38px;z-index:2;transform:rotate(3deg)}
.paper-clip::before{content:"";position:absolute;inset:0;border:3.5px solid var(--metal);
  border-radius:12px;box-shadow:1px 2px 3px rgba(43,35,23,.25)}
.paper-clip::after{content:"";position:absolute;left:6px;right:6px;top:12px;bottom:-10px;
  border:3.5px solid var(--metal-2);border-radius:9px}
.hole{position:absolute;left:10px;width:13px;height:13px;border-radius:50%;
  background:var(--paper-desk);border:1px solid var(--line);
  box-shadow:inset 0 1px 2px rgba(43,35,23,.28)}
.hole-a{top:24%}
.hole-b{top:70%}
.barcode{display:inline-block;width:168px;height:26px;
  background:repeating-linear-gradient(90deg,var(--ink) 0 2px,transparent 2px 7px),repeating-linear-gradient(90deg,var(--ink) 0 1px,transparent 1px 5px),repeating-linear-gradient(90deg,transparent 0 9px,var(--ink) 9px 12px,transparent 12px 19px)}
.barcode-label{font-family:var(--cond);font-size:.56rem;font-weight:700;letter-spacing:.3em;
  text-transform:uppercase;color:var(--ink-2)}

/* ---------- feuillets et pièces ---------- */
.sheet{${SHEET_TRAME};position:relative;${SHEET_SHADOW_LIFTED}}
.piece-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}
/* L'onglet encré plein de la pièce, coin coupé au massicot. */
.piece-tab{display:inline-block;background:var(--ink);color:var(--paper-sheet);
  font-family:var(--cond);font-size:.66rem;font-weight:700;letter-spacing:.2em;
  text-transform:uppercase;padding:8px 26px 8px 16px;
  clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%)}
.piece-head+.sheet{border-top:2px solid var(--ink)}
.piece-no{font-family:var(--cond);font-size:.66rem;font-weight:700;letter-spacing:.12em;
  color:var(--ink-2);border:1px solid var(--line-strong);background:var(--paper-cartouche);padding:2px 6px}
/* Rythme des pièces : c'est l'onglet encré (h2.piece-tab) qui rythme la page,
   pas la marge d'imprimé du h2 — annulée dans la tête de pièce. Le feuillet
   .piece-body rend au papier réglé la marge intérieure que la maquette donnait
   à chaque pièce (ef-prompt/ef-losswrap/ef-why). */
.piece{margin:0 0 2.6rem}
.piece-head h2{margin:0}
.piece-body{padding:1.25rem 1.5rem}
/* Le résumé au filet de verdict (maquette ef-resume) : seul le filet en marge
   porte l'encre du tampon — jamais le texte lui-même (spec §2). */
.verdict-summary{border-left:3px solid var(--ink);padding:.15rem 0 .15rem 1.2rem;
  max-width:var(--wide);margin:0 0 .9rem}
.verdict-summary.yes{border-left-color:var(--stamp-yes)}
.verdict-summary.kinda{border-left-color:var(--stamp-kinda)}
.verdict-summary.no{border-left-color:var(--stamp-no)}

/* ---------- fiche : signalétique ---------- */
.meta-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.1rem 1.5rem;
  margin:0 0 1.4rem;border-top:1px solid var(--line-strong);padding-top:1.2rem}
@media (max-width:56rem){.meta-row{grid-template-columns:repeat(2,minmax(0,1fr))}}
.meta-item{display:flex;flex-direction:column;min-width:0}
.meta-item dt{display:flex;align-items:center;gap:7px;font-family:var(--cond);font-size:.62rem;
  letter-spacing:.18em;text-transform:uppercase;color:var(--muted);font-weight:700}
/* Chaque valeur repose sur sa ligne de champ pointillée, comme remplie au
   guichet. */
.meta-item dd{margin:6px 0 0;padding:0 0 5px;border-bottom:1px dotted var(--line-strong);
  font-size:.9rem;font-weight:600}
.meta-item dd a{text-decoration:none}
.meta-item dd a:hover{text-decoration:underline dotted}
.meta-item .price-source{display:block;margin-top:.35rem;font-size:.72rem;
  font-weight:400;color:var(--muted)}

/* ---------- boutons d'imprimé ---------- */
/* Contour d'encre et ombre au plomb — l'état pressé/survolé est un fond
   cartouche, un marquage sans mouvement. */
button,.copy-btn,.agent-btn,.share-x-btn{display:inline-block;font-family:var(--cond);
  font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.15em;
  border:2px solid var(--ink);border-radius:0;background:transparent;color:var(--ink);
  padding:.7em 1.1em;cursor:pointer;text-decoration:none;
  box-shadow:2px 2px 0 rgba(43,35,23,.22)}
button:hover:not(:disabled),.agent-btn:hover,.share-x-btn:hover{background:var(--paper-cartouche)}
button:disabled{opacity:.5;cursor:default}
.vote-btn{background:var(--ink);color:var(--paper-sheet);font-size:.8rem;padding:.9em 1.4em}
.vote-btn:hover:not(:disabled){background:var(--ink-2);color:var(--paper-sheet)}

/* ---------- pièce A : le prompt ---------- */
.tool-block-prompt{margin:clamp(2.75rem,6vh,4rem) 0}
.prompt-block{position:relative;margin:0 0 .5rem}
.prompt-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
  gap:.6rem 1rem;margin:0 0 .6rem}
.prompt-label{margin:0;font-family:var(--cond);font-size:.66rem;letter-spacing:.2em;
  text-transform:uppercase;color:var(--ink-2);font-weight:700}
.prompt-actions{display:flex;flex-wrap:wrap;gap:.6rem}
.prompt-caption{color:var(--muted);font-size:.8rem;margin:.7rem 0 0;max-width:var(--measure)}
pre{${SHEET_TRAME};padding:1rem 1.2rem;overflow-x:auto;font-size:.85rem;
  line-height:1.8;font-family:var(--mono);white-space:pre-wrap;word-break:break-word;margin:0;
  ${SHEET_SHADOW}}
.status{font-size:.8rem;color:var(--muted);margin:.6rem 0 0;min-height:1.2em}

/* ---------- pièces B et C : listes contrôlées, deux colonnes ---------- */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:2rem 2.5rem;align-items:start}
.two-col>div:only-child{grid-column:1 / -1}
@media (max-width:44rem){.two-col{grid-template-columns:1fr}}
.lose-list{list-style:none;padding:0;margin:0;max-width:var(--wide)}
.lose-list li{display:flex;gap:.8em;align-items:flex-start;padding:.75em 0;
  border-bottom:1px dotted var(--line);margin:0}
.lose-list li:last-child{border-bottom:0}
.priorart-cards{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:.9rem}
.priorart-card{display:flex;flex-direction:column;gap:.3rem;border:2px solid var(--ink);
  background:var(--paper-sheet);padding:.9em 1.2em;min-width:min(100%,12rem);
  box-shadow:3px 3px 0 rgba(43,35,23,.2)}
.priorart-card a{font-weight:700;text-decoration:none}
.priorart-card a:hover{text-decoration:underline dotted}
.priorart-license{color:var(--ink-2);font-family:var(--cond);font-size:.62rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.18em;white-space:nowrap}

/* ---------- outils proches ---------- */
.related-cards{list-style:none;padding:0;margin:0 0 1rem;
  display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
@media (max-width:44rem){.related-cards{grid-template-columns:1fr}}
.related-card{border:1px solid var(--line-strong);background:var(--paper-sheet)}
.related-card:hover{border-color:var(--ink)}
.related-card a{display:flex;flex-direction:column;align-items:flex-start;gap:.4rem;
  padding:1rem;text-decoration:none;color:inherit}
.related-card-name{font-weight:700}
.related-card-meta{color:var(--muted);font-size:.8rem}
.related-list{display:flex;flex-direction:column;gap:.9rem;list-style:none;padding:0;margin:0 0 1rem}
.related-list .name{font-weight:700;margin-right:.6em}
.related-list p{margin:.2rem 0 0;color:var(--muted);max-width:var(--measure)}

/* ---------- questions ---------- */
details{border-bottom:1px solid var(--line);padding:.85rem 0}
details:first-of-type{border-top:2px solid var(--ink)}
summary{cursor:pointer;font-weight:700}
summary::marker{color:var(--ink-2)}
details p{margin:.7rem 0 0;color:var(--ink-2);max-width:var(--wide)}

ul{padding-left:1.1rem;max-width:var(--wide)}
li{margin:0 0 .35rem}
ul.plain{list-style:none;padding:0}

/* ---------- répertoire des rubriques ---------- */
/* Liste dense à points de conduite, pas une grille de cartes décorative
   (spec §4) : le nom, la ligne pointillée, le compte. Toute la ligne est
   cliquable — c'est le <a> qui porte le flex, .category-row (le <li>) ne
   garde que la bordure et l'espacement verticaux. */
.category-list{list-style:none;padding:0;margin:0 0 2rem;max-width:var(--wide)}
.category-row{border-bottom:1px dotted var(--line);margin:0}
.category-row a{display:flex;align-items:baseline;gap:.5rem;padding:.45em 0;
  text-decoration:none;font-weight:600}
.category-row a:hover{text-decoration:underline dotted}
.leader{flex:1;min-width:2rem;border-bottom:1px dotted var(--line-strong);
  align-self:flex-end;margin:0 .2em .35em}
.category-count{color:var(--muted);font-size:.8rem;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}

/* ---------- état récapitulatif (accueil) ---------- */
.recap{display:flex;flex-wrap:wrap;align-items:center;gap:1.2rem 2rem;padding:1.2rem 1.5rem 1.3rem}
.recap-figures{display:flex;flex-wrap:wrap}
.recap-figure{padding:4px 1.4rem 4px 0;margin-right:1.4rem;border-right:1px dotted var(--line)}
.recap-figure:last-child{border-right:0;margin-right:0}
.recap-label{font-family:var(--cond);font-size:.64rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.18em;color:var(--muted)}
.recap-value{display:block;font-size:1.3rem;font-weight:700;margin-top:3px;white-space:nowrap}
.recap-value-sm{font-size:.9rem;padding-top:7px}
/* Repli quand le service de vote est muet au build : du texte à la taille des
   mentions du récap, pas un artefact. */
.recap-unavailable{color:var(--muted);font-size:.8rem;margin:0}
.recap-stamps{display:flex;align-items:center;gap:1.2rem;margin-left:auto;padding:4px 6px}

/* ---------- signature du bordereau ---------- */
.sign-row{display:flex;flex-wrap:wrap;align-items:center;gap:1.4rem 2.75rem;
  border-top:2px solid var(--ink);margin:2rem 0 0;padding:1.4rem 0 0}
.sign-text{flex:1;min-width:min(100%,280px)}
.sign-note{margin:0 0 .7rem;font-size:.9rem;max-width:56ch}

/* ---------- bordereau de suivi des pièces (fiche) ---------- */
/* overflow-x : la table du bordereau (~410px incompressible : lettre, libellé,
   coche, renvoi) est la seule table de fiche sans conteneur défilant — à
   320px elle imposait un défilement horizontal à toute la page (recette
   navigateur du 2026-08-12). Le débord défile dans sa propre boîte, jamais
   dans celle de la page (spec §6). */
.tracking-slip{margin:0 0 1.5rem;overflow-x:auto}
.tracking-slip table{min-width:0}

/* ---------- récépissé de vote ---------- */
/* Le cadre du visiteur : double filet d'encre (bordure + outline rentré),
   comme un volet détachable au bas du formulaire. */
.vote-section,.receipt{border:2px solid var(--ink);outline:1px solid var(--ink);
  outline-offset:-7px;background:var(--paper-sheet);padding:1.5rem 1.75rem;
  margin-top:2.4rem;box-shadow:0 8px 18px rgba(43,35,23,.14)}
.receipt-label{font-family:var(--cond);font-size:.6rem;font-weight:700;letter-spacing:.24em;
  text-transform:uppercase;color:var(--ink-2);margin:0 0 .7rem}
.vote-row{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem;margin:0 0 .8rem}
.vote-count-badge{font-weight:400;font-variant-numeric:tabular-nums;margin-left:.3em}
.vote-count{color:var(--muted);margin:0 0 .8rem}

/* ---------- pied de page ---------- */
footer.site-footer{margin-top:clamp(2.5rem,7vh,4rem);padding-top:1rem;
  border-top:1px dashed var(--line-strong);display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;
  font-size:.76rem;color:var(--ink-2);letter-spacing:.06em}
.site-footer .credit{margin-left:auto}

/* ---------- sous 40rem : les artefacts rentrent dans le flux ---------- */
/* Jamais de chevauchement de texte en étroit (spec §6) : les artefacts
   débordants disparaissent ou se posent à plat, et le registre devient une
   pile de chemises — une par ligne, l'en-tête relégué hors écran pour les
   lecteurs d'écran. */
@media (max-width:40rem){
  .paper-clip,.hole{display:none}
  .date-ring{transform:none;margin:0}
  /* flex:1 1 100% : sans lui, l'item se dimensionne à son contenu (tampon +
     dateur côte à côte ≈ 353px) et DÉBORDE de .folder-top au lieu de replier
     ses enfants — le flex-wrap ne mord que si l'item est d'abord contraint
     (recette navigateur à 320px, 2026-08-12). */
  .folder-stamps{position:static;flex-direction:row;flex-wrap:wrap;flex:1 1 100%;min-width:0}
  .pen-note{transform:none}
  .registry table,.registry thead,.registry tbody,.registry tr,.registry td,.registry th{display:block}
  .registry table{min-width:0}
  .registry thead{position:absolute;left:-9999px}
  .registry tr{border:1px solid var(--paper-folder);background:var(--paper-sheet);
    margin:0 0 10px;padding:8px 12px}
  .registry td,.registry th{border-bottom:0;border-left:0;padding:.2em 0}
  .registry td.rank{display:none}
}

/* ---------- emplacements sponsors ---------- */
/* Aucune couleur saturée ici : le vert/ambre/rouge appartient au verdict et à
   lui seul (principe 1). Un bloc sponsor est du papier, de l'encre, un filet —
   c'est aussi ce qui l'empêche de ressembler à une bannière publicitaire. */

/* Par défaut les rails sont masqués et le repli affiché : c'est l'état des
   petits écrans, donc celui de la majorité du trafic. */
.sp-rail{display:none}
/* Le repli n'a plus de titre (décision du propriétaire : le mot "Sponsors"
   n'apparaît nulle part) — le filet supérieur suffit à le détacher du pied de
   page. La règle .sp-fallback-h est partie avec le <h2>. */
.sp-fallback{margin:clamp(2rem,5vh,3rem) 0 0;border-top:1px solid var(--rule);padding-top:1.2rem}
.sp-fallback-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem}
@media (max-width:26rem){.sp-fallback-grid{grid-template-columns:1fr}}

@media (min-width:84rem){
  /* 84rem = 62rem de texte + 2 × 9rem de rail minimum + les gouttières. Les
     pistes sont élastiques : elles grandissent jusqu'à 13rem au lieu de laisser
     un vide sur les grands écrans. */
  .shell{grid-template-columns:minmax(9rem,13rem) minmax(0,74rem) minmax(9rem,13rem);
    column-gap:1.75rem}
  .col-main{grid-column:2}
  .sp-left{grid-column:1;grid-row:1}
  .sp-right{grid-column:3;grid-row:1}
  /* sticky et non fixed : le rail reste une piste de grille, donc il continue
     de réserver sa place et le contenu ne passe jamais dessous. align-self est
     obligatoire — sans lui la piste s'étire sur toute la hauteur de la grille
     et rien ne colle jamais. */
  .sp-rail{display:flex;flex-direction:column;gap:.75rem;
    position:sticky;top:1rem;align-self:start;
    max-height:calc(100dvh - 2rem);overflow-y:auto;overscroll-behavior:contain}
  .sp-fallback{display:none}
}

/* overflow-wrap:anywhere n'est pas décoratif. Le schéma autorise un nom de
   32 caractères ; la piste minimale d'un rail fait 9rem, soit une boîte de
   contenu d'environ 116px — une quinzaine de caractères. Un nom de marque en
   un seul mot de 32 caractères (un composé allemand est le cas évident)
   n'offre aucune occasion de coupure : il débordait de la carte, et comme
   .sp-rail pose overflow-y:auto son overflow-x calculé passe à auto — le rail
   gagnait une barre de défilement horizontale et le nom était tronqué. Même
   arithmétique dans la grille à deux colonnes du repli à 390px. */
.sp-card{display:flex;flex-direction:column;gap:.35rem;flex:1 1 0;min-height:6.5rem;
  padding:.7rem .8rem;border:1px solid var(--rule);
  background:var(--card);text-decoration:none;font-size:.8rem;overflow-wrap:anywhere}
.sp-card.open{border-style:dashed;background:none;justify-content:center;text-align:center}
/* Emplacement vendu dont la créa n'est pas encore commitée : ni carte de
   sponsor (on n'a ni nom ni icône à afficher), ni carte libre (il n'est plus
   vendable). Pas un lien non plus — voir renderCard. Même filet neutre que le
   reste de la feuille, aucune couleur saturée : le badge de verdict garde le
   vert/ambre/rouge pour lui seul. */
.sp-card.taken{justify-content:center;text-align:center}
.sp-taken-label{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);font-weight:700}
.sp-icon{border-radius:.25rem}
.sp-name{font-weight:700;color:var(--ink)}
.sp-tagline{color:var(--muted);line-height:1.35}
.sp-open-label{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
.sp-price{font-size:1.15rem;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
.sp-per{color:var(--muted);font-size:.72rem}
.sp-cta{color:var(--ink);text-decoration:underline;font-size:.72rem}

/* Bandeaux : frères de .shell, donc pleine largeur sans aucune technique de
   débord, et sans jamais croiser les rails. */
.sponsor-tape{width:100%;background:color-mix(in srgb,var(--ink) 4%,var(--paper));
  border-block:1px solid var(--rule);padding:.5rem 0;overflow:hidden}
.sp-tape-marquee{overflow:hidden;width:100%}
.sp-tape-track{display:inline-flex;gap:0;white-space:nowrap}
.sp-tape-item{display:inline-flex;align-items:center;gap:.4rem;padding:.25em 1rem;
  border-right:1px solid var(--rule);font-size:.78rem;color:var(--muted);text-decoration:none}
/* Pas d'opacity ici : empilée sur --muted (déjà proche du plancher AA contre
   le fond du bandeau), elle faisait passer la tagline sous 4,5:1 dans les
   deux thèmes (3,26:1 clair / 4,39:1 sombre). --muted seul suffit à la rendre
   plus discrète que le nom tout en restant lisible — voir le rapport de
   tâche pour les ratios recalculés. */
.sp-tape-item .sp-tape-tagline{color:var(--muted)}
.sp-tape-item.live span:first-of-type{color:var(--ink);font-weight:700}
/* Place vendue sans créa commitée : même traitement discret que la carte de
   rail équivalente (.sp-card.taken), et ce n'est pas un lien. */
.sp-tape-item.taken{letter-spacing:.1em;text-transform:uppercase;font-size:.68rem}
@media (prefers-reduced-motion:no-preference){
  .sp-tape-track{animation:sp-tape-scroll 120s linear infinite}
}
@keyframes sp-tape-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
/* En mouvement réduit, la piste ne défile pas : elle se replie sur plusieurs
   lignes et reste entièrement lisible. Un sponsor payant ne doit pas disparaître
   pour ces lecteurs — c'est une obligation contractuelle autant qu'une exigence
   d'accessibilité. */
@media (prefers-reduced-motion:reduce){
  .sp-tape-track{flex-wrap:wrap;white-space:normal;animation:none}
  .sp-tape-marquee{overflow:visible}
  /* La moitié dupliquée n'existe que pour boucler l'animation. Repliée en
     mouvement réduit, elle ferait apparaître chaque sponsor deux fois — on la
     retire donc du rendu. Le sélecteur vise l'attribut porté par chaque lien
     (voir renderTapeItem dans site-sponsors.mjs), puisqu'aucun élément
     n'englobe la seconde moitié : c'est cet attribut, individuel, qui a
     remplacé le wrapper .sp-tape-dup initialement prévu. */
  .sp-tape-item[inert]{display:none}
}

/* ---------- page /sponsor ---------- */
/* Même filet neutre que le reste de la feuille : aucune couleur saturée ici
   non plus, le badge de verdict garde le vert/ambre/rouge pour lui seul. */
.sp-figures{list-style:none;margin:1rem 0 0;padding:0;display:flex;flex-wrap:wrap;
  gap:.5rem 1.75rem;font-size:.85rem;color:var(--muted)}
.sp-figures strong{color:var(--ink);font-weight:800;font-variant-numeric:tabular-nums}

/* Grille à colonnes auto-remplies, et non plus un flex qui s'enroule : le
   nombre de lignes ne dépend alors QUE de la largeur disponible, jamais du
   contenu des cases. C'est ce qui supprime le décalage de mise en page au
   moment où le script dévoile vingt-huit boutons — sans lui, les puces
   s'élargissaient, se répartissaient autrement, et toute la page glissait
   vers le bas. Même intention que le min-width de .sp-inv-price, un cran
   au-dessus. */
.sp-inv{list-style:none;margin:0 0 1.4rem;padding:0;
  display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:.5rem}
/* min-height calé sur la hauteur d'une puce QUI PORTE un bouton : la ligne ne
   change donc pas de taille quand le script en dévoile un, ni quand un
   \`slot_taken\` en retire un au clic. Sans elle, retirer le bouton d'une seule
   ligne rétrécissait sa case et faisait bouger toute la grille sous les yeux
   de l'acheteur, au pire moment. */
.sp-inv-item{display:flex;align-items:center;gap:.4em;padding:.3em .7em;min-height:2.1rem;
  border:1px solid var(--rule);background:var(--card);font-size:.78rem}
.sp-inv-item.open{border-style:dashed}
.sp-inv-slot{font-family:var(--mono);font-weight:700;color:var(--ink)}
.sp-inv-state{font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
/* Même traitement numérique que .sp-price : les chiffres restent alignés
   quand le rafraîchissement client (site.js) remplace un montant par un
   autre, aucune couleur saturée. min-width fige la largeur du badge sur le
   montant le plus long jamais affiché ("1 800 $US"/"1 259 $US", 9
   caractères — voir RAIL_LADDER_USD en fr) : sans elle, le badge s'élargit
   d'un cran quand le rafraîchissement client remplit un span vide. Un enfant
   de .sp-inv-item (display:inline-flex) est un flex item, donc min-width
   s'applique même si <span> reste inline par défaut. */
.sp-inv-price{font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;min-width:9ch}
/* Le prix d'une place défilante libre, dans son propre span pour que le
   rafraîchissement client puisse le remplacer sans réécrire la ligne. */
.sp-tape-price{font-variant-numeric:tabular-nums}
/* Le bouton d'achat, posé dans la puce de l'emplacement. Contour d'encre
   plutôt qu'aplat : vingt boutons pleins feraient un mur, et surtout aucune
   couleur saturée n'entre ici — le vert/ambre/rouge reste au badge de verdict
   (principe 1). Il est rendu \`hidden\` et n'apparaît que si site.js l'active. */
.sp-inv-buy{margin-left:auto;font-size:.68rem;line-height:1;padding:.4em .7em;
  border:1px solid var(--ink);background:transparent;color:var(--ink);
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.sp-inv-buy:hover:not(:disabled){opacity:1;background:color-mix(in srgb,var(--ink) 8%,transparent)}
/* Une région live par compartiment, sous la liste : les puces s'enroulent en
   ligne, un message posé dans l'une d'elles casserait la mise en page. Vide,
   elle ne prend aucune place — mais elle existe dès le HTML servi, sinon
   l'annonce ne serait pas faite. */
.sp-inv-status{margin:0 0 1.4rem;font-size:.82rem;color:var(--muted);max-width:var(--measure)}
.sp-inv-status:empty{margin:0}

.sp-duration{border:1px solid var(--rule);background:var(--card);
  padding:.7rem 1rem .9rem;margin:0 0 1.4rem;max-width:var(--measure)}
.sp-duration legend{font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;
  color:var(--muted);font-weight:700;padding:0 .4em}
.sp-duration-options{display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
.sp-duration-options label{display:inline-flex;align-items:center;gap:.45em;font-size:.85rem}
.sp-duration-note{margin:.7rem 0 0;font-size:.8rem;color:var(--muted)}
.sp-noscript{margin:0 0 1.4rem;font-size:.85rem;color:var(--muted);max-width:var(--measure)}
/* Retour depuis Stripe. Un filet d'encre en marge, comme une annotation de
   dossier — pas un bandeau vert de confirmation : cette page ne confirme
   aucun paiement, elle en accuse le retour. */
.sp-paid-note{margin:0 0 clamp(2rem,5vh,3rem);padding:.9rem 1.1rem;font-size:.85rem;
  background:var(--card);border:1px solid var(--rule);border-left:3px solid var(--ink);
  max-width:var(--measure)}

/* .sp-ladder réutilise les règles génériques de \`table\`/\`caption\`/\`th,td\`
   définies plus haut (bordures de cellule, en-tête en petites capitales) —
   seules largeur et enveloppe sont propres à ce tableau compact à deux
   colonnes, qui n'a pas besoin des 40rem prévus pour la liste principale. */
.sp-ladder{min-width:0;width:100%;border:1px solid var(--rule);background:var(--card)}
.sp-ladder td:last-child,.sp-ladder th:last-child{text-align:right;font-variant-numeric:tabular-nums}
/* Sous ~26rem, les en-têtes du barème (« Prochain slot / 30 jours ») doivent
   pouvoir se replier : en nowrap ils poussaient la page au-delà du viewport
   dès que le libellé s'allonge de 30 % (recette d'expansion du 2026-08-12). */
@media (max-width:26rem){.sp-ladder th,.sp-ladder td{white-space:normal;overflow-wrap:anywhere}}

.sp-contact{display:inline-flex;align-items:center;gap:.4em;font-size:.9rem;font-weight:700;
  padding:.6em 1.1em;border:1px solid var(--ink);
  background:var(--ink);color:var(--paper);text-decoration:none}
.sp-contact:hover{opacity:.85}

/* ---------- page stats ---------- */
.stats-page{max-width:var(--wide);margin:0 auto}
.stats-intro{color:var(--muted);max-width:var(--measure)}
.stats-error{color:var(--no);font-weight:600}
.stat-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.8rem;margin:1.6rem 0}
.stat-tile{background:var(--card);border:1px solid var(--rule);padding:1rem;display:flex;flex-direction:column;gap:.2rem}
.stat-value{font-size:1.9rem;font-weight:800;font-family:var(--sans);letter-spacing:-.02em}
.stat-label{color:var(--muted);font-size:.82rem}
.stat-note{color:var(--muted);font-size:.72rem;line-height:1.4}
.stats-section{margin:2rem 0}
.stats-note{color:var(--muted);font-size:.85rem;max-width:var(--measure)}
#views-chart{width:100%;height:auto;background:var(--card);border:1px solid var(--rule);border-radius:.5em}
.bar-list,.crawler-list{display:flex;flex-direction:column;gap:.35rem}
.bar-row{display:grid;grid-template-columns:minmax(8rem,14rem) 1fr auto;gap:.6rem;align-items:center;font-size:.85rem}
.bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{background:color-mix(in srgb,var(--ink) 7%,transparent);height:.55rem;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--accent)}
.bar-fill.yes{background:var(--yes)}.bar-fill.kinda{background:var(--kinda)}.bar-fill.no{background:var(--no)}
.bar-value{color:var(--muted);font-variant-numeric:tabular-nums}
.crawler-row{display:grid;grid-template-columns:minmax(9rem,16rem) 1fr auto;gap:.6rem;align-items:baseline;font-size:.85rem;border-bottom:1px dashed var(--rule);padding:.3rem 0}
.crawler-vendor{color:var(--muted);font-size:.75rem;margin-left:.4rem}
.crawler-counts{color:var(--muted);font-variant-numeric:tabular-nums}
.stats-empty{color:var(--muted);font-style:italic}

/* ---------- page privacy ---------- */
/* public/privacy.html est statique, hors gabarit renderLayout, mais reste du
   papier du même dossier : un encadré feuillet pour le résumé en tête, une
   date de mise à jour discrète. Aucune couleur saturée, même registre que le
   reste de la feuille. */
.box{background:var(--paper-cartouche);border:1px solid var(--line);padding:1rem 1.2rem}
.updated{color:var(--muted);font-size:.8rem}

`;
