// Feuille de style unique, émise une seule fois vers dist/assets/site.css.
//
// Direction : clair, dense, technique. Le monospace porte toute la donnée
// (prix, verdicts, catégories, compteurs) parce que c'est ce que le lecteur
// vient scanner ; un grotesque système porte les titres. Le verdict est un
// badge plein, pas un tiret discret : c'est l'information qu'on doit voir
// d'un seul coup d'œil dans une liste de cent lignes.

/** Palette fermée du spec 2026-08-04 (§2 clair, §5 sombre). Unique source des
 *  deux thèmes : SITE_CSS est généré depuis cette table, et
 *  tests/site-contrast.test.mjs vérifie chaque paire AA. Toute couleur absente
 *  d'ici n'a pas le droit d'exister dans la feuille. */
export const TOKENS = {
  light: {
    paperDesk: '#e8e0cc', paperDeskWeave: '#e6ddc7', paperFolder: '#e0cfa2',
    paperSheet: '#f7f2e3', paperBright: '#fdfaf0', paperCartouche: '#f0e9d5',
    ink: '#2b2317', ink2: '#4a4132', ink3: '#5d5445',
    pen: '#2d3a52', hl: '#f3ecc9',
    stampYes: '#2f5d33', stampKinda: '#6b4600', stampNo: '#9c2a1c', stampDate: '#28522c',
  },
  dark: {
    // Papier bistre du §5 — valeurs de départ, à ajuster JUSQU'À ce que
    // tests/site-contrast.test.mjs passe ; le test est l'arbitre, pas l'œil.
    paperDesk: '#171410', paperDeskWeave: '#1a1713', paperFolder: '#241e14',
    paperSheet: '#211d15', paperBright: '#2a251b', paperCartouche: '#262117',
    ink: '#e8e0cc', ink2: '#c9bda0', ink3: '#a89a79',
    pen: '#a9bcdf', hl: '#3a3320',
    stampYes: '#8fc79a', stampKinda: '#dfaa55', stampNo: '#e8998a', stampDate: '#84bd8f',
  },
};

export const SITE_CSS = `:root{
  --paper:#faf9f6; --card:#ffffff; --ink:#16150f; --muted:#6b6a5e; --rule:#e5e2d8;
  --yes:#15803d; --kinda:#b45309; --no:#be123c;
  --on-accent:#ffffff;
  --accent:#15803d;
  --measure:36rem; --wide:48rem; --focus:#1d4ed8;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
}
/* Le thème suit le système par défaut, sauf si le lecteur a choisi. Le
   :not([data-theme="light"]) est ce qui laisse un choix explicite « clair »
   l'emporter sur un système en sombre. */
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#111110; --card:#1a1917; --ink:#f2f0e9; --muted:#9c9a8d; --rule:#2c2a25;
    --yes:#22c55e; --kinda:#f59e0b; --no:#fb7185; --on-accent:#0d0d0c;
    --accent:#22c55e; --focus:#93c5fd;
  }
}
:root[data-theme="dark"]{
  --paper:#111110; --card:#1a1917; --ink:#f2f0e9; --muted:#9c9a8d; --rule:#2c2a25;
  --yes:#22c55e; --kinda:#f59e0b; --no:#fb7185; --on-accent:#0d0d0c;
  --accent:#22c55e; --focus:#93c5fd;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font:400 15px/1.6 var(--mono);
  padding:clamp(1.25rem,4vw,2.5rem) 0;
}
/* Le padding horizontal vit ici et non plus sur body : .col-main doit occuper
   toute la largeur de la fenêtre pour que 100cqw vaille exactement 100vw quand
   aucun rail n'est affiché. 67rem = 62rem de texte + 2 × 2.5rem de padding, ce
   qui reproduit la mesure actuelle au pixel près sur grand écran. */
.page{max-width:67rem;margin:0 auto;padding-inline:clamp(1rem,5vw,2.5rem)}
.shell{display:grid;grid-template-columns:1fr;justify-content:center}
.col-main{container-type:inline-size;min-width:0}
a{color:inherit;text-underline-offset:.18em;text-decoration-thickness:.06em}
a:hover{text-decoration-thickness:.14em}
:focus-visible{outline:2px solid var(--focus);outline-offset:.2em}

.skip-link{position:absolute;left:-999px;width:1px;height:1px;overflow:hidden;
  background:var(--ink);color:var(--paper);padding:.6em 1em;z-index:10;border-radius:.3em}
.skip-link:focus{position:fixed;left:1rem;top:1rem;width:auto;height:auto;overflow:visible}

/* ---------- chrome ---------- */
/* Barre de navigation pleine largeur, sa propre ligne au-dessus de tout le
   reste. Trois masses bien séparées, plutôt qu'une seule rangée au poids
   uniforme : la marque (plus de présence) ; les liens de navigation, groupés
   entre eux ; puis, mis à l'écart par un espace net, le bloc de contrôles
   (langue, thème, GitHub) — voir docs/design-fixes-report.md. */
.site-header{display:flex;align-items:center;justify-content:space-between;gap:.8rem 1.75rem;
  flex-wrap:wrap;padding-bottom:1rem;margin-bottom:clamp(2rem,6vh,3.5rem);
  border-bottom:1px solid var(--rule)}
.brand{font-family:var(--sans);font-weight:800;letter-spacing:-.02em;
  text-decoration:none;font-size:1.2rem;color:var(--ink);flex:none}
.header-left{display:flex;align-items:baseline;gap:1.6rem;flex-wrap:wrap;min-width:0}
.header-groups{display:flex;align-items:center;gap:1rem 1.25rem;flex-wrap:wrap}
.nav-links{list-style:none;display:flex;gap:1.2rem;padding:0;margin:0;font-size:.85rem;flex-wrap:wrap}
.nav-links a{text-decoration:none;color:var(--ink)}
.nav-links a:hover{text-decoration:underline}
/* Le bloc de contrôles se détache des liens de navigation par un filet
   vertical discret plutôt que par la seule marge, pour que l'œil le lise
   comme un groupe à part (langue, thème, dépôt) et non comme une suite de
   liens supplémentaires. Le filet disparaît quand le groupe retombe seul sur
   sa ligne, en écran étroit, où il n'aurait plus rien à séparer. */
.header-controls{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.github-btn{display:inline-flex;align-items:center;gap:.35em;font-size:.8rem;
  padding:.35em .8em;border:1px solid var(--rule);border-radius:.4em;
  text-decoration:none;color:var(--ink);font-weight:600}
.github-btn:hover{border-color:var(--ink)}
/* Bascule de thème : icône seule, nom accessible porté par aria-label (voir
   site-html.mjs / site.js) — un bouton rond compact plutôt qu'une pilule à
   libellé, qui allonge la rangée sans rien dire qu'une icône ne dise déjà. */
.theme-toggle{display:inline-flex;align-items:center;justify-content:center;
  width:2.1rem;height:2.1rem;padding:0;border-radius:999px;border:1px solid var(--rule);
  background:var(--card);color:var(--muted);font-size:1rem;flex:none}
.theme-toggle:hover:not(:disabled){border-color:var(--ink);color:var(--ink);opacity:1}
.theme-icon::before{content:"\\25D0";line-height:1}
:root[data-theme="dark"] .theme-icon::before{content:"\\25D1"}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .theme-icon::before{content:"\\25D1"}
}
/* Sélecteur de langue : un contrôle compact à contour, pas une paire de
   liens nus. L'état actif est un fond et un poids de trait discrets — jamais
   le bloc plein qui se lisait comme une erreur entre "Source" et "Français". */
.lang-switch{display:inline-flex;gap:.15rem;font-size:.78rem;color:var(--muted);
  border:1px solid var(--rule);border-radius:999px;padding:.2rem;background:var(--card)}
.lang-switch a,.lang-switch [aria-current]{padding:.28em .7em;border-radius:999px;
  text-decoration:none;line-height:1.1}
.lang-switch a{color:var(--muted)}
.lang-switch a:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 6%,transparent)}
.lang-switch [aria-current]{background:color-mix(in srgb,var(--ink) 9%,transparent);
  color:var(--ink);font-weight:700}

.breadcrumb{font-size:.8rem;color:var(--muted);margin:0 0 1.6rem}
.breadcrumb a{color:var(--muted)}

/* ---------- titres ---------- */
h1{font-family:var(--sans);font-weight:800;margin:0 0 .8rem;
  font-size:clamp(2rem,1.1rem + 3.6vw,3.6rem);line-height:1.03;
  letter-spacing:-.035em;max-width:20ch;text-wrap:balance}
h1 .blank{color:var(--accent);border-bottom:.12em solid var(--accent);padding:0 .12em}
h1 em{font-style:normal;color:var(--muted)}
/* 2rem est le rythme "de liaison" par défaut entre sections qui ne forment
   pas un groupe explicite (voir plus bas .tool-intro / .tool-block-prompt
   pour les intervalles volontairement plus grands qui marquent une vraie
   frontière de groupe sur la fiche outil). */
h2{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
  font-weight:700;margin:2rem 0 .8rem}
section:first-of-type > h2:first-child{margin-top:0}
p{margin:0 0 .9rem;max-width:var(--wide)}
.tagline{color:var(--muted);margin:0 0 clamp(1rem,2.5vh,1.5rem);max-width:var(--measure)}
.lede{max-width:var(--measure);color:var(--muted);margin:0 0 clamp(2rem,5vh,3rem)}

/* ---------- accueil : en-tête centré ---------- */
.hero-h1{margin:0 auto .8rem;text-align:center}
.hero-sub{margin:0 auto clamp(2rem,5vh,3rem);text-align:center}

/* ---------- verdicts ---------- */
.badge{display:inline-block;font-size:.68rem;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;padding:.32em .7em .3em;border-radius:.3em;
  color:var(--on-accent);white-space:nowrap;line-height:1.25}
.badge.yes{background:var(--yes)} .badge.kinda{background:var(--kinda)} .badge.no{background:var(--no)}
.badge-lg{font-size:.85rem;padding:.5em 1em .48em;flex:none}

/* ---------- recherche façon terminal + volet de suggestions ---------- */
search{display:block;margin:0}
.search-combo{position:relative;z-index:40;max-width:38rem;margin:0 auto clamp(1.5rem,4vh,2.25rem)}
/* z-index sur le conteneur, pas seulement sur le panneau : la classe
   d'apparition .r laisse un transform résiduel, qui crée un contexte
   d'empilement sur CHAQUE bloc. Le z-index du panneau restait donc
   enfermé dans celui de la recherche, et les pastilles — plus loin dans
   le DOM — passaient devant. */
.field label{display:block;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin:0 0 .5rem}
.search-shell{position:relative;display:flex;align-items:center;gap:.6rem;background:var(--card);
  border:1px solid var(--rule);border-radius:.45em;padding:.75em 2.5rem .75em .9em;
  box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 5%,transparent)}
.search-shell::before{content:">";color:var(--accent);font-weight:700;flex:none}
.search-shell:focus-within{border-color:var(--accent)}
input[type=search]{font:inherit;border:0;background:transparent;color:var(--ink);
  width:100%;padding:0;outline:none;font-size:.95rem}
input[type=search]::placeholder{color:var(--muted)}
input[type=search]::-webkit-search-cancel-button{display:none}
.search-clear{position:absolute;right:.7rem;top:50%;transform:translateY(-50%);
  background:transparent;border:0;color:var(--muted);font-size:1.15rem;line-height:1;
  padding:.15em .4em;border-radius:.3em;cursor:pointer}
.search-clear:hover{color:var(--ink)}
.search-panel{position:absolute;top:calc(100% + .5rem);left:0;right:0;z-index:30;
  background:var(--card);border:1px solid var(--rule);border-radius:.6em;
  box-shadow:0 16px 32px -12px rgba(0,0,0,.35);max-height:26rem;overflow-y:auto;
  padding:.35rem;text-align:left}
.search-option{display:flex;align-items:center;gap:.6rem;padding:.55em .7em;
  border-radius:.4em;cursor:pointer;font-size:.88rem}
.search-option:hover,.search-option[aria-selected="true"]{
  background:color-mix(in srgb,var(--ink) 7%,transparent)}
.search-option-icon{width:20px;height:20px;border-radius:.25em;flex:none;object-fit:contain}
.search-option-name{font-weight:600;flex:none}
.search-option-meta{margin-left:auto;color:var(--muted);font-size:.78rem;
  white-space:nowrap;display:flex;align-items:center;gap:.35em}
.search-option-viewall{border-top:1px solid var(--rule);margin-top:.3rem;
  padding-top:.7em;color:var(--muted);justify-content:flex-start}
.search-empty{padding:.8em .7em;color:var(--muted);font-size:.85rem}

/* ---------- pastilles de catégorie et de verdict ---------- */
.chips-nav{margin:0 0 clamp(1.75rem,4vh,2.5rem);text-align:center}
.chips{max-width:none;display:flex;flex-wrap:wrap;justify-content:center;gap:.45rem;list-style:none;padding:0;margin:0}
.chips a,.chip{display:inline-flex;align-items:center;gap:.4em;text-decoration:none;
  font:inherit;font-size:.8rem;padding:.4em .8em;border:1px solid var(--rule);border-radius:999px;
  background:var(--card);color:var(--ink);white-space:nowrap;cursor:pointer}
.chips a:hover,.chip:hover{border-color:var(--ink)}
.chips a[aria-current],.chip[aria-pressed="true"],.chip.is-active{
  background:var(--ink);color:var(--paper);border-color:var(--ink)}
.chip-all-categories{font-weight:600;color:var(--accent);border-color:var(--accent)}
.verdict-chips{display:flex;flex-wrap:wrap;gap:.45rem;margin:0 0 1rem}

/* ---------- bandeau-ticker et bandeau de chiffres, pleine largeur ---------- */
/* Sortent volontairement du conteneur .page pour occuper toute la largeur de la
   piste centrale, avec leur propre fond et des filets horizontaux. Le débord est
   ancré sur .col-main (container-type:inline-size) et non sur la fenêtre : sans
   rails, .col-main occupe toute la fenêtre et 100cqw vaut 100vw ; avec rails, le
   bandeau s'arrête à la gouttière au lieu de passer dessous. */
.ticker-band,.figures-band{
  width:100cqw;margin-left:calc(50% - 50cqw);margin-right:calc(50% - 50cqw);
  background:color-mix(in srgb,var(--ink) 4%,var(--paper));
  border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);
  padding:1.5rem 0;margin-top:clamp(1.75rem,4vh,2.5rem);margin-bottom:clamp(1.75rem,4vh,2.5rem)}
.ticker-marquee{overflow:hidden;width:100%}
.ticker-track{display:inline-flex;gap:0;white-space:nowrap}
.ticker-item{font-size:.82rem;color:var(--muted);padding:.3em 1rem;
  border-right:1px solid var(--rule);font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:no-preference){
  .ticker-track{animation:ticker-scroll 240s linear infinite}
}
@keyframes ticker-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.mrr-figure{max-width:62rem;margin:1.2rem auto 0;padding:0 clamp(1rem,5vw,2.5rem);
  display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;
  gap:.3rem 1rem;text-align:center}
.mrr-label{width:100%;text-align:center;font-size:.72rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted);font-weight:700}
.mrr-digits{display:inline-flex;align-items:baseline;gap:.2rem;font-family:var(--mono);
  font-weight:800;font-size:clamp(1.8rem,1rem + 3vw,3rem);color:var(--ink)}
.digit-box{display:inline-flex;align-items:center;justify-content:center;min-width:1ch;
  padding:.02em .14em;background:color-mix(in srgb,var(--ink) 7%,transparent);
  border-radius:.15em;color:var(--accent)}
.mrr-suffix{font-size:.45em;color:var(--muted);margin-left:.35em;align-self:flex-end}
.mrr-unavailable{max-width:none;color:var(--muted);font-size:.85rem}

.figures-list{list-style:none;margin:0 auto;padding:0 clamp(1rem,5vw,2.5rem);
  max-width:62rem;display:grid;grid-template-columns:repeat(5,1fr);gap:1rem 1.5rem;text-align:center}
.figure{display:flex;flex-direction:column;gap:.35rem}
.figure-value{font-family:var(--sans);font-weight:800;letter-spacing:-.02em;
  font-size:clamp(1.3rem,.9rem + 1.6vw,2rem);font-variant-numeric:tabular-nums}
.figure-caption{font-size:.7rem;color:var(--muted);letter-spacing:.02em}
@media (max-width:44rem){.figures-list{grid-template-columns:repeat(2,1fr)}}

/* ---------- en-tête de liste ---------- */
.list-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;
  gap:.5rem 1.5rem;margin:0 0 1rem}
.list-heading{font-family:var(--sans);font-weight:800;letter-spacing:-.02em;
  text-transform:none;color:var(--ink);font-size:clamp(1.3rem,.9rem + 1.3vw,1.8rem);margin:0}
.rank-note{color:var(--muted);font-size:.85rem;margin:0;text-align:right;max-width:26rem}
@media (max-width:36rem){.rank-note{text-align:left}}

/* ---------- la liste ---------- */
.table-scroll{overflow-x:auto;margin:0 0 1.5rem;border:1px solid var(--rule);
  border-radius:.5em;background:var(--card)}
table{width:100%;border-collapse:collapse;min-width:40rem}
caption{text-align:left;color:var(--muted);font-size:.8rem;margin:0 0 .6rem;caption-side:top}
th,td{text-align:left;padding:.7em .9em;border-bottom:1px solid var(--rule);vertical-align:middle}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
thead th{font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);
  font-weight:700;background:color-mix(in srgb,var(--ink) 3%,transparent)}
tbody tr:hover{background:color-mix(in srgb,var(--ink) 3%,transparent)}
tbody th{font-weight:600}
tbody th a{text-decoration:none}
/* Le favicon de chaque ligne : alt vide et aria-hidden implicite — c'est une
   décoration, le nom de l'outil est juste à côté et porte déjà l'information. */
tbody th a{display:inline-flex;align-items:center;gap:.55em}
.row-favicon{width:20px;height:20px;border-radius:.25em;flex:none;object-fit:contain;
  background:color-mix(in srgb,var(--ink) 6%,transparent)}
tbody th a:hover{text-decoration:underline}
tbody tr[hidden]{display:none}
.rank{color:var(--muted);font-variant-numeric:tabular-nums;font-size:.8rem;width:1%;
  padding-right:0;white-space:nowrap}
.price,.votes{font-variant-numeric:tabular-nums;white-space:nowrap}
.votes{color:var(--muted);font-size:.9rem}
.cat{white-space:nowrap;font-size:.9rem}

/* Numérotation du classement : un compteur CSS se renumérote tout seul quand la
   recherche masque des lignes, ce qu'un numéro écrit dans le HTML ne ferait pas. */
#tool-rows{counter-reset:rank}
#tool-rows tr:not([hidden]){counter-increment:rank}
#tool-rows tr:not([hidden]) .rank::before{content:counter(rank,decimal-leading-zero)}

#no-results{color:var(--muted)}

/* ---------- fiche ---------- */
/* Groupe 1 : titre, méta, résumé — une seule unité, resserrée. Le badge de
   verdict est mis en relation avec le titre : la rangée épouse la largeur de
   son contenu (favicon + h1 + badge) au lieu de s'étirer sur toute la
   largeur de .page, ce qui évite l'écart qui se creusait entre un h1 replié
   sur deux lignes et un badge plaqué au bord de la fenêtre. */
.tool-intro{margin-bottom:clamp(2.5rem,6vh,3.75rem)}
.tool-title-row{display:flex;flex-wrap:wrap;align-items:center;gap:.5em .85em;
  width:fit-content;max-width:100%;margin:0 0 .5rem}
.tool-favicon{border-radius:.35em;flex:none;background:var(--card);border:1px solid var(--rule)}
.tool-title-row h1{margin:0;flex:0 1 auto;min-width:0}

dl.meta-row{display:flex;flex-wrap:wrap;gap:1.2rem 2rem;margin:0 0 1.4rem;
  padding:1rem 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.meta-item{display:flex;flex-direction:column;gap:.25rem;min-width:6rem}
.meta-item dt{font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);font-weight:700}
.meta-item dd{margin:0;font-weight:600;font-size:.95rem}
.meta-item dd a{text-decoration:none}
.meta-item dd a:hover{text-decoration:underline}
/* La source du prix est une légende du prix, pas du résumé qui suit : elle
   vit maintenant sous la valeur, dans la même case "Prix" du méta-tableau —
   voir renderMetaRow dans site-page-tool.mjs. */
.meta-item .price-source{display:block;margin-top:.35rem;font-size:.72rem;
  font-weight:400;color:var(--muted)}
.meta-item .price-source a{color:inherit}
.verdict-summary{max-width:var(--measure)}

/* Groupe 2 : le prompt est sa propre unité — un espace net avant et après le
   distingue du groupe 1 au-dessus et de "pourquoi on paie encore" en
   dessous, plutôt que le même intervalle uniforme partout. Les marges de
   blocs adjacents se fusionnent au maximum (règle CSS standard), donc fixer
   .tool-block-prompt sur les deux bords suffit à l'isoler sans avoir à
   toucher les sections voisines. */
.tool-block-prompt{margin:clamp(2.75rem,6vh,4rem) 0 clamp(2.75rem,6vh,4rem)}
.prompt-block{position:relative;margin:0 0 .5rem}
.prompt-header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
  gap:.6rem 1rem;margin:0 0 .6rem}
.prompt-label{margin:0;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:700}
.prompt-actions{display:flex;flex-wrap:wrap;gap:.5rem}
.prompt-actions .copy-btn,.agent-btn{
  font-size:.78rem;padding:.45em .85em;border-radius:.35em;border:1px solid var(--rule);
  background:var(--card);color:var(--ink);text-decoration:none;font-weight:600}
.prompt-actions .copy-btn:hover:not(:disabled),.agent-btn:hover{
  border-color:var(--ink);opacity:1;background:color-mix(in srgb,var(--ink) 5%,var(--card))}
.prompt-caption{color:var(--muted);font-size:.82rem;margin:.7rem 0 0;max-width:var(--measure)}
pre{background:var(--card);border:1px solid var(--rule);border-radius:.5em;
  padding:1rem 1.1rem;overflow-x:auto;font-size:.82rem;line-height:1.65;
  font-family:var(--mono);white-space:pre-wrap;word-break:break-word;margin:0}
button{font:inherit;font-size:.85rem;padding:.55em 1.1em;border:1px solid var(--ink);
  background:var(--ink);color:var(--paper);border-radius:.35em;cursor:pointer;font-weight:600}
button:disabled{opacity:.5;cursor:default}
@media (prefers-reduced-motion:no-preference){button{transition:opacity .15s ease}}
button:hover:not(:disabled){opacity:.85}
.status{font-size:.82rem;color:var(--muted);margin:.6rem 0 0;min-height:1.2em}

/* ---------- deux colonnes : ce que tu perds / alternatives existantes ---------- */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:2rem 2.5rem;align-items:start}
.two-col>div:only-child{grid-column:1 / -1}
@media (max-width:44rem){.two-col{grid-template-columns:1fr}}
.lose-mark{color:var(--no);font-weight:700;margin-right:.4em}
.lose-list{list-style:none;padding:0}
/* L'entrée n'a qu'un nom, une licence et un lien (le schéma ne porte pas de
   description — voir data/tools/*.json) : une rangée dense et réglée plutôt
   qu'une carte à padding généreux qui donnerait l'impression d'un contenu
   manquant. Même famille visuelle que .breadcrumb / details : un filet, pas
   un cadre. */
.priorart-cards{list-style:none;padding:0;margin:0}
.priorart-card{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;
  gap:.3em 1em;padding:.5em 0;border-bottom:1px solid var(--rule)}
.priorart-card:first-child{border-top:1px solid var(--rule)}
.priorart-card a{font-weight:600;text-decoration:none}
.priorart-card a:hover{text-decoration:underline}
.priorart-license{color:var(--muted);font-size:.78rem;white-space:nowrap}

/* ---------- outils proches ---------- */
.related-cards{list-style:none;padding:0;margin:0 0 1rem;
  display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
@media (max-width:44rem){.related-cards{grid-template-columns:1fr}}
.related-card{border:1px solid var(--rule);border-radius:.5em;background:var(--card)}
.related-card:hover{border-color:var(--ink)}
.related-card a{display:flex;flex-direction:column;align-items:flex-start;gap:.4rem;
  padding:1rem;text-decoration:none;color:inherit}
.related-card img{border-radius:.3em}
.related-card-name{font-weight:700}
.related-card-meta{color:var(--muted);font-size:.8rem}

/* ---------- vote et partage ---------- */
.vote-row{display:flex;flex-wrap:wrap;align-items:center;gap:.8rem;margin:0 0 .8rem}
.vote-btn{font-size:1rem;padding:.8em 1.5em}
.vote-count-badge{font-weight:400;opacity:.85;margin-left:.3em}
.share-x-btn{display:inline-flex;align-items:center;font-size:.85rem;padding:.7em 1.2em;
  border-radius:.4em;border:1px solid var(--rule);background:var(--card);color:var(--ink);
  text-decoration:none;font-weight:600}
.share-x-btn:hover{border-color:var(--ink)}

/* ---------- annuaire des catégories ---------- */
ul.category-cards{list-style:none;padding:0;margin:0 0 2rem;
  display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.9rem}
.category-card{border:1px solid var(--rule);border-radius:.5em;background:var(--card)}
.category-card:hover{border-color:var(--ink)}
.category-card a{display:flex;justify-content:space-between;align-items:center;gap:.6rem;
  padding:.9em 1.1em;text-decoration:none;color:inherit}
.category-card-count{color:var(--muted);font-size:.82rem;white-space:nowrap}

details{border-top:1px solid var(--rule);padding:.85rem 0}
details:last-of-type{border-bottom:1px solid var(--rule)}
summary{cursor:pointer;font-weight:600}
summary::marker{color:var(--muted)}
details p{margin:.7rem 0 0;color:var(--muted);max-width:var(--measure)}

ul{padding-left:1.1rem;max-width:var(--wide)}
li{margin:0 0 .35rem}
ul.plain{list-style:none;padding:0}

.related-list{display:flex;flex-direction:column;gap:.9rem;list-style:none;padding:0;margin:0 0 1rem}
.related-list .name{font-weight:600;margin-right:.6em}
.related-list p{margin:.2rem 0 0;color:var(--muted);max-width:var(--measure)}

.vote-section{border-top:1px solid var(--rule);padding-top:1.3rem;margin-top:2.4rem}
.vote-count{color:var(--muted);margin:0 0 .8rem}

.site-footer .credit{margin-left:auto}
footer.site-footer{margin-top:clamp(2.5rem,7vh,4rem);padding-top:1.2rem;
  border-top:1px solid var(--rule);display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;
  font-size:.82rem;color:var(--muted)}

.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

@media (prefers-reduced-motion:no-preference){
  .r{opacity:0;transform:translateY(.35rem);animation:rise .5s cubic-bezier(.16,1,.3,1) forwards}
  @keyframes rise{to{opacity:1;transform:none}}
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
  padding:.7rem .8rem;border:1px solid var(--rule);border-radius:.4rem;
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
  border:1px solid var(--rule);border-radius:.35em;background:var(--card);font-size:.78rem}
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
.sp-inv-buy{margin-left:auto;font-size:.68rem;line-height:1;padding:.4em .7em;border-radius:.3em;
  border:1px solid var(--ink);background:transparent;color:var(--ink);
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
.sp-inv-buy:hover:not(:disabled){opacity:1;background:color-mix(in srgb,var(--ink) 8%,transparent)}
/* Une région live par compartiment, sous la liste : les puces s'enroulent en
   ligne, un message posé dans l'une d'elles casserait la mise en page. Vide,
   elle ne prend aucune place — mais elle existe dès le HTML servi, sinon
   l'annonce ne serait pas faite. */
.sp-inv-status{margin:0 0 1.4rem;font-size:.82rem;color:var(--muted);max-width:var(--measure)}
.sp-inv-status:empty{margin:0}

.sp-duration{border:1px solid var(--rule);border-radius:.5em;background:var(--card);
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
  border-radius:0 .4em .4em 0;max-width:var(--measure)}

/* .sp-ladder réutilise les règles génériques de \`table\`/\`caption\`/\`th,td\`
   définies plus haut (bordures de cellule, en-tête en petites capitales) —
   seules largeur et enveloppe sont propres à ce tableau compact à deux
   colonnes, qui n'a pas besoin des 40rem prévus pour la liste principale. */
.sp-ladder{min-width:0;width:100%;border:1px solid var(--rule);border-radius:.5em;background:var(--card)}
.sp-ladder td:last-child,.sp-ladder th:last-child{text-align:right;font-variant-numeric:tabular-nums}

.sp-contact{display:inline-flex;align-items:center;gap:.4em;font-size:.9rem;font-weight:700;
  padding:.6em 1.1em;border:1px solid var(--ink);border-radius:.35em;
  background:var(--ink);color:var(--paper);text-decoration:none}
@media (prefers-reduced-motion:no-preference){.sp-contact{transition:opacity .15s ease}}
.sp-contact:hover{opacity:.85}

/* ---------- page stats ---------- */
.stats-page{max-width:var(--wide);margin:0 auto}
.stats-intro{color:var(--muted);max-width:var(--measure)}
.stats-error{color:var(--no);font-weight:600}
.stat-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.8rem;margin:1.6rem 0}
.stat-tile{background:var(--card);border:1px solid var(--rule);border-radius:.5em;padding:1rem;display:flex;flex-direction:column;gap:.2rem}
.stat-value{font-size:1.9rem;font-weight:800;font-family:var(--sans);letter-spacing:-.02em}
.stat-label{color:var(--muted);font-size:.82rem}
.stat-note{color:var(--muted);font-size:.72rem;line-height:1.4}
.stats-section{margin:2rem 0}
.stats-note{color:var(--muted);font-size:.85rem;max-width:var(--measure)}
#views-chart{width:100%;height:auto;background:var(--card);border:1px solid var(--rule);border-radius:.5em}
.bar-list,.crawler-list{display:flex;flex-direction:column;gap:.35rem}
.bar-row{display:grid;grid-template-columns:minmax(8rem,14rem) 1fr auto;gap:.6rem;align-items:center;font-size:.85rem}
.bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{background:color-mix(in srgb,var(--ink) 7%,transparent);border-radius:999px;height:.55rem;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--accent);border-radius:999px}
.bar-fill.yes{background:var(--yes)}.bar-fill.kinda{background:var(--kinda)}.bar-fill.no{background:var(--no)}
.bar-value{color:var(--muted);font-variant-numeric:tabular-nums}
.crawler-row{display:grid;grid-template-columns:minmax(9rem,16rem) 1fr auto;gap:.6rem;align-items:baseline;font-size:.85rem;border-bottom:1px dashed var(--rule);padding:.3rem 0}
.crawler-vendor{color:var(--muted);font-size:.75rem;margin-left:.4rem}
.crawler-counts{color:var(--muted);font-variant-numeric:tabular-nums}
.stats-empty{color:var(--muted);font-style:italic}

`;
