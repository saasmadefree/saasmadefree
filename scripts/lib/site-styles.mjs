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
    // Le sol et les surfaces : un papier chaud très peu saturé, et du blanc
    // franc pour ce qui est posé dessus. Aucune trame — la matière du dossier
    // a disparu avec lui.
    paperDesk: '#f2f0ea', paperDeskWeave: '#f2f0ea', paperFolder: '#edeae0',
    paperSheet: '#fbfaf6', paperBright: '#ffffff', paperCartouche: '#e7e3d8',
    ink: '#12110d', ink2: '#55524a', ink3: '#6a6558',
    // `pen` était l'encre du contrôleur ; il ne reste que l'encre du texte,
    // qui sert aussi de marque aux graphiques de /stats via --accent. Le
    // verdict garde la couleur pour lui seul (principe 1).
    pen: '#12110d', hl: '#eae7de',
    // Les trois couleurs de verdict. En direction C elles servent AUSSI de
    // fond d'aplat : `onStamp` est l'encre qu'on pose dessus, et le couple est
    // vérifié en AA comme les autres.
    stampYes: '#17563a', stampKinda: '#8f5a0b', stampNo: '#8c2317',
    stampDate: '#55524a', onStamp: '#f6f4ee',
    // Utilitaires décoratifs — filets et gris de séparation, jamais porteurs
    // de texte, donc hors contrainte AA.
    line: '#d5d0c2', lineStrong: '#b3ac98', paperRule: '#fbfaf6',
    metal: '#a8a192', metal2: '#b7b0a0',
  },
  dark: {
    // Même construction inversée : sol quasi noir légèrement chaud, aplats de
    // verdict éclaircis qui portent une encre sombre (onStamp).
    paperDesk: '#14130f', paperDeskWeave: '#14130f', paperFolder: '#1f1d17',
    paperSheet: '#1c1a15', paperBright: '#24211a', paperCartouche: '#232019',
    ink: '#f0ede3', ink2: '#c3bdac', ink3: '#a39c88',
    pen: '#f0ede3', hl: '#262319',
    stampYes: '#58c98a', stampKinda: '#dfa53f', stampNo: '#ee7a66',
    stampDate: '#c3bdac', onStamp: '#14130f',
    line: '#35322a', lineStrong: '#4a463b', paperRule: '#1c1a15',
    metal: '#5e5849', metal2: '#6e6757',
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
  onStamp: 'on-stamp',
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
const SHEET_TRAME = 'background:var(--paper-sheet);border:1px solid var(--line)';
const SHEET_SHADOW = 'box-shadow:none';
const SHEET_SHADOW_LIFTED = SHEET_SHADOW;

/* Deux familles auto-hébergées, deux rôles, aucune requête vers un tiers : les
   woff2 vivent dans public/fonts/ et sont servis depuis notre propre origine
   (principe 4 du .impeccable.md, qu'une webfont de CDN aurait cassé). Archivo
   est une variable — un seul fichier couvre 400 à 800 — et DM Mono porte les
   chiffres, les prix, les étiquettes et le prompt. Les deux sont sous OFL 1.1,
   voir public/fonts/LICENSE.txt.

   font-display:swap est délibéré : la page doit être lisible avant que la
   police n'arrive. Les piles de repli sont choisies pour des métriques
   proches, pour que le remplacement ne fasse pas sauter la mise en page. */
const FONT_FACES = [
  ['Archivo', '100 900', 'archivo-latin', 'latin'],
  ['Archivo', '100 900', 'archivo-latin-ext', 'latinExt'],
  ['DM Mono', '400', 'dmmono-400-latin', 'latin'],
  ['DM Mono', '400', 'dmmono-400-latin-ext', 'latinExt'],
  ['DM Mono', '500', 'dmmono-500-latin', 'latin'],
  ['DM Mono', '500', 'dmmono-500-latin-ext', 'latinExt'],
];
const UNICODE_RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  latinExt: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};
const FONT_CSS = FONT_FACES.map(([family, weight, file, range]) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;`
  + `src:url(/fonts/${file}.woff2) format("woff2");unicode-range:${UNICODE_RANGES[range]}}`
).join('\n');

export const SITE_CSS = `${FONT_CSS}
:root{${cssVars(TOKENS.light)}
  --mono:"DM Mono",ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --cond:Archivo,"Helvetica Neue",Helvetica,Arial,sans-serif;
  --hand:Archivo,"Helvetica Neue",Helvetica,Arial,sans-serif;
  /* Alias des sections conservées (coquille, sponsors, stats) : des références
     vers les tokens du dossier, jamais des littéraux — les deux thèmes coulent
     au travers sans réécrire un CSS couvert par ~1 000 lignes de tests. */
  --paper:var(--paper-desk);--card:var(--paper-sheet);--muted:var(--ink-3);
  --rule:var(--line);--yes:var(--stamp-yes);--kinda:var(--stamp-kinda);--no:var(--stamp-no);
  /* Les encres de verdict ne servent que le verdict : la marque des graphiques
     de /stats (stats.js lit --accent au canvas) passe au stylo du contrôleur. */
  --accent:var(--pen);
  --sans:var(--cond);
  --measure:36rem;--wide:48rem;--rot-step-ms:1900;
}
/* Le thème suit le système par défaut, sauf si le lecteur a choisi. Le
   :not([data-theme="light"]) est ce qui laisse un choix explicite « clair »
   l'emporter sur un système en sombre. */
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${cssVars(TOKENS.dark)}}}
:root[data-theme="dark"]{${cssVars(TOKENS.dark)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
/* Direction « Le Verdict » : le sol est un aplat, sans trame ni matière. La
   prose est en Archivo — le monospace ne porte plus que les données. Les
   chiffres restent alignés partout : c'est un registre, pas une brochure.
   Le padding vertical part à zéro : les bandeaux sponsors sont désormais
   collés aux bords de la fenêtre, en pleine largeur. */
body{
  margin:0;color:var(--ink);background:var(--paper-desk);
  font:400 16px/1.6 var(--cond);font-variant-numeric:tabular-nums;
  padding:0;
}
/* Le padding horizontal vit ici et non plus sur body : .col-main doit occuper
   toute la largeur de la fenêtre pour que 100cqw vaille exactement 100vw quand
   aucun rail n'est affiché. 67rem = 62rem de texte + 2 × 2.5rem de padding, ce
   qui reproduit la mesure actuelle au pixel près sur grand écran. */
.page{max-width:74rem;margin:0 auto;padding-inline:clamp(1rem,5vw,2.5rem)}
.shell{display:grid;grid-template-columns:1fr;justify-content:center}
.col-main{container-type:inline-size;min-width:0;overflow-x:clip}
/* Le souligné de repos est pointillé — un renvoi de dossier ; il devient plein
   au survol (spec §7 : les états sont des marquages, jamais du mouvement). */
a{color:inherit;text-decoration:underline solid;text-decoration-thickness:.07em;
  text-underline-offset:.2em;text-decoration-color:var(--line-strong)}
a:hover{text-decoration-style:solid;text-decoration-color:currentColor}
:focus-visible{outline:2px solid var(--pen);outline-offset:2px}

.skip-link{position:absolute;left:-999px;width:1px;height:1px;overflow:hidden;
  background:var(--ink);color:var(--paper-bright);padding:.6em 1em;z-index:10}
.skip-link:focus{position:fixed;left:1rem;top:1rem;width:auto;height:auto;overflow:visible}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* ---------- titres ---------- */
/* Direction « Le Verdict » : le titre est une affirmation, en Archivo lourd et
   serré. Le clamp part de 1.75rem (lisible à 320px sans casser un mot) et
   monte à 3.4rem sur grand écran. */
h1{font-size:clamp(1.75rem,1.15rem + 2.6vw,3.4rem);line-height:1.06;font-weight:800;
  letter-spacing:-.035em;margin:0 0 .6rem;text-wrap:balance}
h2{font-family:var(--cond);font-size:1.05rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.18em;margin:2rem 0 .8rem}
section:first-of-type > h2:first-child{margin-top:0}
p{margin:0 0 .9rem;max-width:var(--wide)}
.tagline{color:var(--ink-2);font-size:.85rem;margin:0 0 .8rem;max-width:var(--measure)}
.lede{max-width:44ch;color:var(--ink-2);font-size:1.125rem;line-height:1.55;
  margin:0 0 clamp(1.5rem,4vh,2.25rem)}
.hero-h1{max-width:none}

.hero{padding:clamp(2rem,6vh,3.5rem) 0 0;text-align:center}
.hero .lede{margin-inline:auto}
.hero .search-shell{text-align:left}

/* ---------- le titre à trou ----------
   « ____ Made Free », où le trou défile sur les fiches au verdict « oui ».

   inline-grid et non position:absolute : tous les noms occupent la MÊME
   cellule (grid-area:1/1), donc la boîte se dimensionne toute seule sur le
   plus long et le mot « Made » ne bouge jamais d'un nom à l'autre. En
   absolu, la boîte n'aurait eu aucune largeur et le titre aurait sauté. */
.hero-rot{display:inline-grid;justify-items:end;vertical-align:baseline;
  --rot-step:1.9s;--rot-total:calc(var(--rot-step) * var(--rot-count))}
.hero-rot-item{grid-area:1/1;white-space:nowrap;text-align:right;
  color:var(--stamp-yes);opacity:0;
  border-bottom:.07em solid var(--stamp-yes);padding-bottom:.04em;
  animation:hero-rot var(--rot-total) linear infinite}
@keyframes hero-rot{
  0%{opacity:0;transform:translateY(.18em)}
  2%,10%{opacity:1;transform:translateY(0)}
  12.5%,100%{opacity:0;transform:translateY(-.18em)}
}
/* Le prix barré qui suit le nom : ce que la fiche dit qu'on arrête de payer.
   Pas de filet vert dessous — ce n'est pas une ligne à remplir, c'est une
   étiquette. Calé à GAUCHE (l'inverse du nom), pour que le prix commence
   toujours juste après « Made Free » au lieu de flotter au bout de la boîte. */
.hero-made{display:inline}

/* ---------- les badges d'économie ----------
   Semés par site.js à chaque rotation, ils montent et s'effacent en 3 s. Le
   conteneur ne prend AUCUNE hauteur (height:0) : sinon il réserverait une
   bande vide sous le titre pour des éléments qui ne sont là qu'un instant. */
.hero-savings{position:relative;height:0;pointer-events:none}
.hero-savings-badge{position:absolute;left:50%;top:0;white-space:nowrap;
  font-family:var(--cond);font-size:1.05rem;font-weight:700;
  color:var(--stamp-yes);text-decoration:line-through;
  text-decoration-thickness:.08em;text-decoration-color:var(--ink-3);
  animation:hero-fly 3s cubic-bezier(.22,.7,.3,1) forwards}
@keyframes hero-fly{
  0%{opacity:0;transform:translate(calc(-50% + var(--drift, 0px)), .8rem) scale(.85)}
  14%{opacity:1;transform:translate(calc(-50% + var(--drift, 0px)), 0) scale(1)}
  70%{opacity:1}
  100%{opacity:0;transform:translate(calc(-50% + var(--drift, 0px)), -4.5rem) scale(1.02)}
}
/* Sans mouvement : un seul nom, posé. Le titre reste juste — il n'a jamais
   promis d'en montrer plusieurs. */
@media (prefers-reduced-motion:reduce){
  .hero-rot-item{animation:none;opacity:0}
  .hero-rot-item:first-child{opacity:1}
}


/* ---------- la recherche, dans le héro ---------- */
.hero .search-frame{margin:clamp(1.25rem,3vh,2rem) auto 0;max-width:34rem}
.hero .search-frame input[type=search]{font-size:1.05rem}
.hero,.search-frame,.recap{margin:0 0 clamp(1.5rem,4vh,2.25rem)}


/* ---------- chrome : bandeau de service, marque, cartouche ---------- */

.site-masthead,.site-header{display:flex;flex-wrap:wrap;align-items:center;
  justify-content:space-between;gap:.9rem 1.25rem;padding:1.3rem 0 1.1rem}
.header-left{display:flex;flex-wrap:wrap;align-items:center;gap:.7rem 1.5rem;min-width:0}
.header-groups{display:flex;align-items:center;margin-left:auto}
.header-controls{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1rem}
/* La marque au coin : un cachet carré à double filet (les deux inset), comme
   frappé sur la couverture du dossier. */
.brand-mark{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
  background:var(--ink);color:var(--paper-desk);border:0;box-shadow:none;
  font-family:var(--cond);font-weight:800;font-size:.68rem;letter-spacing:.04em;flex:none}
/* Le nom colle au carré : ils forment une seule marque, d'où le gap serré du
   groupe et non l'espacement de l'en-tête. */
.brand-lockup{display:inline-flex;align-items:center;gap:.55rem;min-width:0}
.brand{font-family:var(--cond);font-weight:800;font-size:1.1rem;text-transform:uppercase;
  letter-spacing:-.01em;white-space:nowrap;text-decoration:none;color:var(--ink)}
.nav-links{list-style:none;display:flex;align-items:baseline;gap:1.05rem;padding:0;
  margin:0;font-family:var(--cond);font-size:.74rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.1em;flex-wrap:wrap}
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
  width:2rem;height:2rem;padding:0;border:2px solid var(--ink);border-radius:0;
  background:none;color:var(--ink);font-size:.95rem;flex:none;cursor:pointer;
  box-shadow:none}
.theme-toggle:hover:not(:disabled){background:var(--paper-cartouche)}
.theme-icon::before{content:"\\25D0";line-height:1}
:root[data-theme="dark"] .theme-icon::before{content:"\\25D1"}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .theme-icon::before{content:"\\25D1"}
}
/* Le cachet GitHub : même gabarit carré que la bascule de thème (icône
   seule, nom porté par aria-label — voir site-html.mjs). */
.github-btn{display:inline-flex;align-items:center;justify-content:center;
  width:2rem;height:2rem;padding:0;border:2px solid var(--ink);flex:none;
  text-decoration:none;color:var(--ink);box-shadow:2px 2px 0 rgba(43,35,23,.25)}
.github-btn svg{display:block;width:1rem;height:1rem}
.github-btn:hover{background:var(--paper-cartouche)}
/* Le double filet d'imprimé qui clôt l'en-tête, puis la cartouche de
   références accrochée dessous (chaque cellule porte un fait calculé). */
.head-rule{border-top:2px solid var(--ink);height:0;margin:.9rem 0 0}
.ref-strip{display:flex;flex-wrap:wrap;gap:0 2.5rem;
  margin:.75rem 0 clamp(1.5rem,4vh,2.25rem)}
.ref-cell{padding:0;display:flex;align-items:baseline;gap:.5em}
.ref-cell:last-child{border-right:0}
.ref-strip .ref-lbl,.ref-strip .ref-val{margin:0}
.ref-lbl{font-family:var(--cond);font-size:.6rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.2em;color:var(--muted)}
.ref-val{font-size:.82rem;font-weight:700;white-space:nowrap}
.breadcrumb{font-size:.8rem;color:var(--ink-2);margin:0 0 1.4rem}
.breadcrumb a{color:inherit}

/* ---------- cadre de recherche + volet de suggestions ---------- */
search{display:block;margin:0}
.search-combo{position:relative;z-index:40;max-width:38rem;margin:0 0 clamp(1.5rem,4vh,2.25rem)}
.search-frame{border:2px solid var(--ink);background:var(--paper-bright);
  padding:1rem 1.2rem 1.1rem;box-shadow:none}
.search-frame .search-combo{margin-bottom:0}
/* L'étiquette du champ est le cartouche « Cadre n — … » de la maquette. */
.field label{display:inline-block;font-family:var(--mono);font-size:.62rem;font-weight:500;
  letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);
  border:0;background:none;padding:0;margin:0 0 .5rem}
.search-shell{position:relative;display:flex;align-items:center;gap:.9rem}
/* Le champ est une ligne pointillée de formulaire, pas une boîte : elle passe
   au trait plein en encre stylo quand le contrôleur écrit dedans (le focus
   reste visible sans boîte bleue du navigateur). */
input[type=search]{flex:1;min-width:0;width:100%;font:inherit;color:var(--ink);
  background:transparent;border:0;border-bottom:2px solid var(--line-strong);border-radius:0;
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
/* ---------- la bande de répartition ----------
   L'objet signature de la direction : les trois verdicts à l'échelle, en
   pleine largeur de la colonne. C'est le seul endroit du site où la couleur
   couvre une surface — et elle ne couvre que le verdict.

   Le débord : .col-main porte container-type:inline-size, donc 100cqw vaut
   la largeur de la colonne principale — la fenêtre entière quand aucun rail
   n'est affiché, la colonne seule quand ils le sont. La bande ne passe donc
   jamais sous un emplacement sponsor. Le 50% est relatif à la boîte de
   contenu de .page, ce qui annule exactement son padding.

   Le texte posé sur l'aplat est --on-stamp, dont le contraste contre les
   trois encres est vérifié par tests/site-contrast.test.mjs. */
.verdict-band{margin-inline:calc(50% - 50cqw);width:100cqw;
  margin-block:0 clamp(1.5rem,4vh,2.25rem)}
.vb-track{display:flex;min-height:clamp(10rem,22vh,15rem)}
.vb-seg{flex-basis:0;min-width:5.5rem;display:flex;flex-direction:column;
  justify-content:space-between;align-items:flex-start;gap:.5rem;
  border:0;cursor:pointer;text-align:left;color:var(--on-stamp);
  padding:clamp(.9rem,2vw,1.5rem) clamp(.7rem,1.6vw,1.6rem);
  font-family:var(--cond);overflow:hidden}
.vb-yes{background:var(--stamp-yes)}
.vb-kinda{background:var(--stamp-kinda)}
.vb-no{background:var(--stamp-no)}
.vb-share{font-family:var(--mono);font-size:.7rem;letter-spacing:.16em;opacity:.85}
.vb-count{font-size:clamp(1.9rem,1rem + 3.4vw,4rem);font-weight:800;line-height:.9;
  letter-spacing:-.045em}
.vb-label{font-size:clamp(.8rem,.6rem + .6vw,1.3rem);font-weight:700;
  text-transform:uppercase;letter-spacing:-.01em}
/* L'état actif est un liseré d'encre à l'intérieur du segment : pas une
   couleur de plus, et il survit à un mode lecture qui supprimerait les fonds. */
.vb-seg[aria-pressed="true"]{box-shadow:inset 0 0 0 4px var(--on-stamp)}
.vb-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
  gap:.5rem 1rem;padding:.55rem clamp(1rem,5vw,2.5rem);
  border-bottom:1px solid var(--line)}

/* Ce que le catalogue dit qu'on peut arrêter de payer : la seule figure de la
   page qui parle au portefeuille, donc elle est posée juste sous la bande. */
.vb-spend{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .6rem;
  margin:0;max-width:none;margin-left:auto}
.vb-spend-label{font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-3)}
.vb-spend-value{font-size:1.15rem;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
.vb-reset{font-family:var(--mono);font-size:.72rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink);background:none;cursor:pointer;
  border:1px solid var(--line-strong);padding:.35em .9em}
.vb-reset.is-active,.vb-reset[aria-pressed="true"]{background:var(--ink);color:var(--paper-desk);
  border-color:var(--ink)}

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
@media (min-width:52rem){.table-scroll{overflow-x:visible}}
.registry{border-top:2px solid var(--ink)}
.registry table{min-width:40rem}
/* Le verdict de chaque ligne, redit par un filet d'encre de verdict au bord
   gauche. La couleur ne dit jamais rien de neuf : le badge porte déjà le mot,
   et un mode lecture qui supprime les fonds ne fait perdre aucune information
   (principe 2 du .impeccable.md). */
#tool-rows tr[data-verdict="yes"] td.rank{box-shadow:inset 5px 0 0 var(--stamp-yes)}
#tool-rows tr[data-verdict="kinda"] td.rank{box-shadow:inset 5px 0 0 var(--stamp-kinda)}
#tool-rows tr[data-verdict="no"] td.rank{box-shadow:inset 5px 0 0 var(--stamp-no)}
table{width:100%;border-collapse:collapse}
caption{text-align:left;color:var(--ink-3);font-family:var(--mono);font-size:.72rem;
  padding:.55rem 0 .7rem;caption-side:top}
th,td{text-align:left;padding:.85em .8em;border-bottom:1px solid var(--line);vertical-align:middle}
td+td,th+th{border-left:0}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
/* L'en-tête colle en haut : sur 530 lignes, perdre le nom des colonnes au
   premier écran de défilement rendait le tableau illisible. */
thead th,thead td{position:sticky;top:0;z-index:2;background:var(--paper-desk);
  font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-2);font-weight:700;
  border-bottom:2px solid var(--ink);white-space:nowrap}
tbody th{font-weight:600;font-size:1rem;letter-spacing:-.01em}
/* Le favicon de chaque ligne : alt vide — décoration, le nom porte déjà
   l'information. */
tbody th a{display:inline-flex;align-items:center;gap:.55em;text-decoration:none}
tbody th a:hover{text-decoration:underline solid}
.row-favicon{width:20px;height:20px;flex:none;object-fit:contain}
tbody tr[hidden]{display:none}
#tool-rows tr:hover td,#tool-rows tr:hover th{background:var(--hl)}
.rank{color:var(--ink-3);font-variant-numeric:tabular-nums;font-size:.78rem;
  letter-spacing:.06em;width:1%;padding-right:0;white-space:nowrap}
.price,.votes{font-variant-numeric:tabular-nums;white-space:nowrap}
.cat{white-space:nowrap;font-family:var(--mono);font-size:.72rem;letter-spacing:.02em;
  text-transform:uppercase;color:var(--ink-3)}
.price{font-family:var(--mono);font-size:.95rem;white-space:nowrap}
.votes{font-family:var(--mono);font-size:.78rem;color:var(--ink-3);white-space:nowrap}
/* Un zéro ne mérite pas le poids d'un chiffre : le tiret marque la case
   comme lue, sans la remplir. */
.votes-none{color:var(--line-strong)}

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
.stamp{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:.15em .6em;
  font-family:var(--mono);font-weight:500;text-transform:uppercase;text-align:left;
  white-space:normal}
.stamp .stamp-sub{white-space:nowrap}
.stamp-verif{color:var(--ink-3);font-size:.66rem;letter-spacing:.14em;
  border-left:3px solid var(--ink);padding:.15em 0 .15em .7em}
.stamp-sub{display:inline;font-size:.66rem;letter-spacing:.08em;margin:0;
  padding:0;border:0;color:var(--ink)}
/* Le tampon verdict S'APPELLE .badge : site.js fait row.querySelector('.badge')
   et le test verdictBadge existant reste vert. En ligne de registre c'est le
   petit mot cacheté ; en chemise, .badge-lg le passe au grand format. */
/* Le verdict est écrit, pas cacheté : le mot en capitales lourdes, à la
   couleur de son encre. La couleur redouble le mot, elle ne le remplace
   jamais — un lecteur daltonien, ou un mode lecture sans couleur, lit
   « PRESQUE » tel quel. */
.badge{display:inline-block;font-family:var(--cond);font-size:.72rem;font-weight:800;
  letter-spacing:.04em;text-transform:uppercase;padding:0;border:0;
  white-space:nowrap;background:none;line-height:1.4}
.badge.yes{color:var(--stamp-yes)}
.badge.kinda{color:var(--stamp-kinda)}
.badge.no{color:var(--stamp-no)}
.badge-lg{font-size:clamp(2.2rem,1.2rem + 3.4vw,4rem);letter-spacing:-.04em;
  padding:0;line-height:.95;text-align:left;flex:none}
/* Tampon dateur rond — encre verte d'archive, réservé à la date du relevé de
   prix (pricing.checkedOn) : un seul porteur de cette date par page. */

/* ---------- la main du contrôleur ---------- */
/* Tout ce qui est en --pen est ce qu'un contrôleur aurait écrit à la main —
   et rien d'autre. Rotations ≤ 1.5°, jamais sur plus de deux lignes. */

.pen-note{font-family:var(--mono);font-size:.78rem;line-height:1.55;color:var(--ink-3);
  margin:0 0 .85rem;padding-left:1.1rem;position:relative;max-width:var(--measure)}
.pen-note::before{content:"\\2192";position:absolute;left:0;top:0;color:var(--ink-3)}
.paraphe{display:inline-block;font-family:var(--cond);color:var(--ink-3);
  font-size:.8rem;font-weight:800;letter-spacing:.22em;transform:none;
  border-bottom:2px solid var(--pen);padding:0 6px 2px;margin-left:10px}
/* Le souligné main porte un second trait translucide : un double passage de
   stylo, pas une ombre portée (spec §2). */
.hand-underline{border-bottom:2px solid var(--pen);
  box-shadow:0 2px 0 color-mix(in srgb,var(--pen) 30%,transparent)}

/* ---------- cases à cocher du dossier ---------- */
/* Deux échelles, deux encres (spec §2) : la petite coche de suivi est au stylo
   (.pen-check), la grande case du verdict est imprimée et cochée à l'encre
   noire de la machine (.check-box, croix --ink). */
.pen-check{display:inline-block;width:7px;height:7px;border:0;background:var(--ink);
  position:relative;flex:none;vertical-align:2px}
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
.folder{position:relative;margin-inline:calc(50% - 50cqw);width:100cqw;
  background:var(--stamp-kinda);color:var(--on-stamp);
  padding:clamp(1.4rem,3.5vw,2.4rem) clamp(1rem,5vw,2.5rem) clamp(1.2rem,3vw,1.9rem);
  margin-block:0 clamp(1.75rem,4vh,2.5rem)}
.folder-yes{background:var(--stamp-yes)}
.folder-kinda{background:var(--stamp-kinda)}
.folder-no{background:var(--stamp-no)}
/* Tout ce qui se pose sur l'aplat prend l'encre de l'aplat : sans ça, les
   couleurs de texte du papier (--ink, --muted) s'y appliquaient et tombaient
   sous le seuil AA. */
.folder h1,.folder a,.folder dd,.folder .tagline,.folder .stamp-sub,
.folder .check-item,.folder .badge,
.folder .meta-item dt,.folder .meta-item dd,.folder .meta-item dd a,
.folder .meta-item .price-source{color:var(--on-stamp)}
.folder .meta-item .price-source{opacity:1}
.folder a{text-decoration-color:var(--on-stamp)}
.folder .tagline,.folder dt,.folder .stamp-sub,.folder .price-source{opacity:1}
.folder .meta-item dd{border-bottom-color:rgba(255,255,255,.28)}
.folder .check-box{border-color:var(--on-stamp)}
.folder-cote{font-family:var(--mono);font-size:.66rem;letter-spacing:.18em;
  text-transform:uppercase;margin:0 0 1.1rem}
.folder-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:1.2rem 2rem}
.folder-id{flex:1;min-width:min(100%,300px)}
.folder-stamps{display:flex;flex-direction:column;align-items:flex-start;gap:.15rem;flex:none}

/* ---------- artefacts physiques ---------- */
/* Trombone, perforations, code-barres : CSS pur, toujours aria-hidden, jamais
   posés sur du texte (le padding gauche de .folder réserve la marge des
   œillets). Le code-barres superpose trois trames de barres — c'est la cote
   imprimée du dossier, pas un décor gratuit. */

/* ---------- feuillets et pièces ---------- */
.sheet{position:relative}
.piece-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem 1rem;margin:0 0 1rem}
/* L'onglet encré plein de la pièce, coin coupé au massicot. */
.piece-tab{display:block;flex:1 1 100%;min-width:0;max-width:100%;background:none;color:var(--ink);
  font-family:var(--cond);font-size:.9rem;font-weight:800;letter-spacing:.14em;
  text-transform:uppercase;padding:0 0 .45rem;border-bottom:2px solid var(--ink);
  clip-path:none}
.piece-head+.sheet{border-top:0}
.piece-no{font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;
  color:var(--ink-3);border:0;background:none;padding:0}
/* Rythme des pièces : c'est l'onglet encré (h2.piece-tab) qui rythme la page,
   pas la marge d'imprimé du h2 — annulée dans la tête de pièce. Le feuillet
   .piece-body rend au papier réglé la marge intérieure que la maquette donnait
   à chaque pièce (ef-prompt/ef-losswrap/ef-why). */
.piece{margin:0 0 2.6rem}
.piece-head h2{margin:0}
.piece-body{padding:0}
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
.meta-item dd{margin:6px 0 0;padding:0 0 5px;border-bottom:1px solid var(--line);
  font-size:.9rem;font-weight:600}
.meta-item dd a{text-decoration:none}
.meta-item dd a:hover{text-decoration:underline solid}
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

.prompt-actions{display:flex;flex-wrap:wrap;gap:.6rem}
.prompt-caption{color:var(--muted);font-size:.8rem;margin:.7rem 0 0;max-width:var(--measure)}
pre{background:var(--ink);color:var(--paper-desk);border:0;
  padding:1.35rem 1.5rem;overflow-x:auto;font-size:.85rem;
  line-height:1.8;font-family:var(--mono);white-space:pre-wrap;word-break:break-word;margin:0;
  ${SHEET_SHADOW}}
.status{font-size:.8rem;color:var(--muted);margin:.6rem 0 0;min-height:1.2em}

/* ---------- pièces B et C : listes contrôlées, deux colonnes ---------- */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:2rem 2.5rem;align-items:start}
.two-col>div:only-child{grid-column:1 / -1}
@media (max-width:44rem){.two-col{grid-template-columns:1fr}}
.lose-list{list-style:none;padding:0;margin:0;max-width:var(--wide)}
.lose-list li{display:flex;gap:.8em;align-items:flex-start;padding:.75em 0;
  border-bottom:1px solid var(--line);margin:0}
.lose-list li:last-child{border-bottom:0}
.priorart-cards{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:.9rem}
.priorart-card{display:flex;flex-direction:column;gap:.3rem;border:2px solid var(--ink);
  background:var(--paper-sheet);padding:.9em 1.2em;min-width:min(100%,12rem);
  box-shadow:3px 3px 0 rgba(43,35,23,.2)}
.priorart-card a{font-weight:700;text-decoration:none}
.priorart-card a:hover{text-decoration:underline solid}
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


/* ---------- questions ---------- */
details{border-bottom:1px solid var(--line);padding:.85rem 0}
details:first-of-type{border-top:2px solid var(--ink)}
summary{cursor:pointer;font-weight:700}
summary::marker{color:var(--ink-2)}
details p{margin:.7rem 0 0;color:var(--ink-2);max-width:var(--wide)}

ul{padding-left:1.1rem;max-width:var(--wide)}
li{margin:0 0 .35rem}

/* ---------- répertoire des rubriques ---------- */
/* Liste dense à points de conduite, pas une grille de cartes décorative
   (spec §4) : le nom, la ligne pointillée, le compte. Toute la ligne est
   cliquable — c'est le <a> qui porte le flex, .category-row (le <li>) ne
   garde que la bordure et l'espacement verticaux. */
.category-list{list-style:none;padding:0;margin:0 0 2rem;max-width:var(--wide)}
.category-row{border-bottom:1px solid var(--line);margin:0}
.category-row a{display:flex;align-items:baseline;gap:.5rem;padding:.45em 0;
  text-decoration:none;font-weight:600}
.category-row a:hover{text-decoration:underline solid}
.leader{flex:1;min-width:2rem;border-bottom:1px solid var(--line);
  align-self:flex-end;margin:0 .2em .35em}
.category-count{color:var(--muted);font-size:.8rem;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}

/* ---------- état récapitulatif (accueil) ---------- */
.recap{display:flex;flex-wrap:wrap;align-items:center;gap:1.2rem 2rem;
  padding:1.1rem 0 1.2rem;border-top:1px solid var(--line)}
.recap-figures{display:flex;flex-wrap:wrap}
.recap-figure{padding:4px 0;margin-right:2.6rem}
.recap-figure:last-child{margin-right:0}
.recap-label{font-family:var(--cond);font-size:.64rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.18em;color:var(--muted)}
.recap-value{display:block;font-size:1.6rem;font-weight:800;letter-spacing:-.03em;
  margin-top:3px;white-space:nowrap}
.recap-value-sm{font-size:.9rem;padding-top:7px}
/* Repli quand le service de vote est muet au build : du texte à la taille des
   mentions du récap, pas un artefact. */
.recap-unavailable{color:var(--muted);font-size:.8rem;margin:0}

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
.vote-section,.receipt{border:2px solid var(--ink);outline:0;
  background:none;padding:1.5rem 1.75rem;margin-top:2.4rem;box-shadow:none}
.receipt-label{font-family:var(--mono);font-size:.66rem;font-weight:500;letter-spacing:.16em;
  text-transform:uppercase;color:var(--ink-3);margin:0 0 .7rem}
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
  /* flex:1 1 100% : sans lui, l'item se dimensionne à son contenu (tampon +
     dateur côte à côte ≈ 353px) et DÉBORDE de .folder-top au lieu de replier
     ses enfants — le flex-wrap ne mord que si l'item est d'abord contraint
     (recette navigateur à 320px, 2026-08-12). */
  .folder-stamps{position:static;flex-direction:row;flex-wrap:wrap;flex:1 1 100%;min-width:0}
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
  /* height et non plus seulement max-height : les cinq blocs sont en
     flex:1 1 0, donc ils ne se répartissent une hauteur que si le rail en a
     une. Avec max-height seul, ils retombaient sur leur min-height et le
     rail s'arrêtait au tiers de l'écran. */
  .sp-rail{display:flex;flex-direction:column;gap:.75rem;
    position:sticky;top:1rem;align-self:start;
    height:calc(100dvh - 2rem);max-height:calc(100dvh - 2rem);
    overflow-y:auto;overscroll-behavior:contain}
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
.sp-card{display:flex;flex-direction:column;justify-content:center;gap:.55rem;
  flex:1 1 0;min-height:7rem;padding:1rem .9rem;border:2px solid var(--line-strong);
  background:var(--card);text-decoration:none;font-size:.8rem;overflow-wrap:anywhere}
/* Un emplacement libre est une offre affichée, pas un trou : le pointillé dit
   « à prendre », le prix est composé au même poids que les chiffres du
   catalogue, et l'appel à l'action est un bloc d'encre plein. */
.sp-card.open{border-style:dashed;background:none;justify-content:center;
  align-items:center;text-align:center;gap:.15rem}
/* Emplacement vendu dont la créa n'est pas encore commitée : ni carte de
   sponsor (on n'a ni nom ni icône à afficher), ni carte libre (il n'est plus
   vendable). Pas un lien non plus — voir renderCard. Même filet neutre que le
   reste de la feuille, aucune couleur saturée : le badge de verdict garde le
   vert/ambre/rouge pour lui seul. */
.sp-card.taken{justify-content:center;text-align:center}
.sp-taken-label{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);font-weight:700}
.sp-icon{width:40px;height:40px;border-radius:.3rem}
.sp-name{font-family:var(--cond);font-size:1.05rem;font-weight:800;letter-spacing:-.015em;
  color:var(--ink);line-height:1.15}
.sp-tagline{color:var(--ink-2);font-size:.82rem;line-height:1.4}
.sp-open-label{font-family:var(--mono);font-size:.6rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--ink-3);font-weight:500}
.sp-price{font-size:1.55rem;font-weight:800;letter-spacing:-.035em;line-height:1.1;
  color:var(--ink);font-variant-numeric:tabular-nums}
.sp-per{font-family:var(--mono);color:var(--ink-3);font-size:.66rem}
.sp-cta{margin-top:.45rem;font-family:var(--mono);font-size:.62rem;letter-spacing:.12em;
  text-transform:uppercase;text-decoration:none;
  background:var(--ink);color:var(--paper-desk);padding:.5em 1.1em}
.sp-card.open:hover .sp-cta{background:var(--ink-2)}

/* Bandeaux : frères de .shell, donc pleine largeur sans aucune technique de
   débord, et sans jamais croiser les rails. */
/* La barre est peinte en --ink et son texte en --paper-desk : elle s'inverse
   donc toute seule d'un thème à l'autre (encre sur papier le jour, papier sur
   encre la nuit), et le couple est celui dont le contraste est déjà vérifié
   par tests/site-contrast.test.mjs. */
.sponsor-tape{width:100%;background:var(--ink);color:var(--paper-desk);
  border-block:0;padding:.45rem 0;overflow:hidden}
.sp-tape-marquee{overflow:hidden;width:100%}
.sp-tape-track{display:inline-flex;gap:0;white-space:nowrap}
.sp-tape-item{display:inline-flex;align-items:center;gap:.5rem;padding:.25em 1.1rem;
  border-right:1px solid var(--ink-3);font-family:var(--mono);font-size:.72rem;
  letter-spacing:.02em;color:var(--paper-cartouche);text-decoration:none}
.sp-tape-price{color:var(--paper-desk);font-weight:500;font-variant-numeric:tabular-nums}
/* Une place libre est une offre à cliquer. Deux choses l'en empêchaient :
   rien ne signalait le lien, et la piste défile — la cible fuyait sous le
   curseur. La piste se met donc en pause dès qu'on la survole ou qu'on y
   entre au clavier, et la place survolée s'inverse pour devenir une cible
   franche. :focus-within couvre la navigation au clavier, qui ne survole
   jamais.

   Le signal au repos est le souligné pointillé, la convention de lien du
   site — et pas une flèche : un glyphe demandait un span aria-hidden, or
   c'est ce même attribut qui distingue la copie dupliquée de la piste de
   l'originale (voir renderTape). L'ajouter dans la moitié visible aurait
   cassé ce marqueur. */
.sp-tape-item.open{text-decoration:underline solid;text-underline-offset:.25em;
  text-decoration-color:var(--ink-3)}
.sponsor-tape:hover .sp-tape-track,
.sponsor-tape:focus-within .sp-tape-track{animation-play-state:paused}
.sp-tape-item.open:hover,.sp-tape-item.open:focus-visible{
  background:var(--paper-desk);color:var(--ink)}
.sp-tape-item.open:hover .sp-tape-price,
.sp-tape-item.open:focus-visible .sp-tape-price{color:var(--ink)}
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
/* 23.08.2026 : tuile = libellé condensé, gros chiffre, légende mono ; barres et
   aire tramées de points (demi-teinte d'imprimé), jamais un dégradé. */
.stats-page{max-width:var(--wide);margin:0 auto}
.stats-head{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem 2rem;
  flex-wrap:wrap;margin:0 0 1.1rem}
.stats-head h1{margin:0}
.stats-tagline,.stats-band,.stats-h{font-family:var(--cond);font-size:.62rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.18em;color:var(--muted);margin:0}
.stats-error{color:var(--no);font-weight:600;font-size:.85rem;margin:0 0 1rem}
.stats-band{display:flex;align-items:baseline;gap:.4rem 1rem;flex-wrap:wrap;margin:1.5rem 0 .55rem}
.stats-band span:empty{display:none}
.stats-band span+span{color:var(--ink-2);font-weight:600;letter-spacing:.1em}
.stats-band::after{content:"";flex:1;min-width:2rem;border-top:1px solid var(--rule);align-self:center}
.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem}
.stat-tile{background:var(--card);border:1px solid var(--rule);padding:.8rem .9rem .75rem;
  display:flex;flex-direction:column;gap:.3rem;min-width:0}
.stat-label{font-family:var(--cond);font-size:.6rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.18em;color:var(--muted);display:flex;align-items:center;gap:.45em;overflow-wrap:anywhere}
.stat-value{font-family:var(--cond);font-size:clamp(1.6rem,3.4vw,2.15rem);font-weight:800;
  letter-spacing:-.03em;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap}
.stat-caption{font-family:var(--mono);font-size:.68rem;color:var(--muted);line-height:1.35}
.stat-dot{width:.55rem;height:.55rem;flex:none}
.stat-dot.yes,.vs-yes{background:var(--stamp-yes)}.stat-dot.kinda,.vs-kinda{background:var(--stamp-kinda)}
.stat-dot.no,.vs-no{background:var(--stamp-no)}
.verdict-stack{display:flex;height:.45rem;margin-top:.55rem;border:1px solid var(--rule);background:var(--card)}
.verdict-stack span{height:100%}
.stats-sheet{background:var(--card);border:1px solid var(--rule);padding:.85rem .95rem .9rem;min-width:0}
.stats-page :is(.stat-grid,.stats-sheet,.stats-cols)+:is(.stats-sheet,.stats-cols){margin-top:.55rem}
.stats-sheet .stats-h{margin:0 0 .65rem}
.stats-sheet :is(.bar-list,.chip-list,.crawler-list)+.stats-h{margin-top:1.1rem}
.stats-h-aside{font-weight:600;letter-spacing:.08em;text-transform:none;margin-left:.5em}
.stats-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}
.views-chart{display:block;width:100%;height:auto}
.bar-list,.crawler-list,.chip-list{display:flex;flex-direction:column;gap:.3rem}
.chip-list{flex-direction:row;flex-wrap:wrap}
.bar-row{display:grid;grid-template-columns:minmax(6rem,11rem) 1fr auto;gap:.55rem;align-items:center;
  font-family:var(--mono);font-size:.72rem}
.bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-2)}
.bar-track{height:.5rem}
.bar-fill{display:block;height:100%;position:relative}
.bar-fill::before,.bar-fill::after{content:"";position:absolute;top:0;bottom:0;background:var(--accent)}
.bar-fill::before{left:0;right:0;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='2' cy='2' r='.9'/%3E%3C/svg%3E") 0 0/4px 4px}
.bar-fill::after{right:0;width:2px}
.bar-value{color:var(--muted);font-variant-numeric:tabular-nums;min-width:2.5em;text-align:right}
.stat-chip{display:inline-flex;align-items:center;gap:.4em;font-family:var(--mono);font-size:.7rem;
  padding:.22em .55em;border:1px solid var(--rule);background:var(--paper);color:var(--ink-2)}
.stat-chip b{font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums}
.crawler-row{display:grid;grid-template-columns:minmax(7rem,1fr) auto auto;gap:.3rem .8rem;align-items:baseline;
  font-family:var(--mono);font-size:.72rem;border-bottom:1px dashed var(--rule);padding:.3rem 0}
.crawler-row:last-child{border-bottom:0}
.crawler-name{color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.crawler-vendor{color:var(--muted);margin-left:.5em}
.crawler-counts,.crawler-seen{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.crawler-seen:empty{display:none}
.stats-empty{font-family:var(--mono);font-size:.72rem;color:var(--muted)}
.stats-empty::before{content:"— "}
.stats-notes{margin:1.6rem 0 0;padding-top:.9rem;border-top:1px solid var(--rule);
  font-family:var(--mono);font-size:.7rem;line-height:1.55;color:var(--muted);columns:2;column-gap:2.2rem}
.stats-notes .stats-h{column-span:all;margin:0 0 .6rem}
.stats-notes p{margin:0 0 .6rem;break-inside:avoid}
@media (max-width:40rem){
  .stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .stats-cols,.stats-notes{grid-template-columns:1fr;columns:1}
  .bar-row{grid-template-columns:minmax(4.5rem,7rem) 1fr auto}
  .crawler-row{grid-template-columns:1fr auto}
  .crawler-seen{grid-column:1/-1}
}

/* ---------- page privacy ---------- */
/* public/privacy.html est statique, hors gabarit renderLayout, mais reste du
   papier du même dossier : un encadré feuillet pour le résumé en tête, une
   date de mise à jour discrète. Aucune couleur saturée, même registre que le
   reste de la feuille. */
.box{background:var(--paper-cartouche);border:1px solid var(--line);padding:1rem 1.2rem}
.updated{color:var(--muted);font-size:.8rem}

`;
