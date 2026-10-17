// Feuille de style unique, émise une seule fois vers dist/assets/v/<empreinte>/site.css.
//
// Direction « La table de cuisine, aérée » (choix du propriétaire, 17/10/2026,
// maquettes docs/design/2026-10-17-refonte-alternatives/direction-3-airy-*.html).
// Spec du système : docs/superpowers/specs/2026-10-17-design-system.md.
//
// Un sol crème, de la typographie et des filets plutôt que des boîtes, une
// seule surface teintée sous la ligne de flottaison (le bloc « le construire
// soi-même ») et un seul élément gras par page : le panneau moutarde du
// verdict sur la fiche, aucun sur l'accueil. Le verdict et l'adéquation d'une
// alternative portent toujours une forme ET un mot : ● Oui / complet,
// ◐ Presque / partiel, ○ Pas encore / de niche — jamais la couleur seule.
//
// La feuille est écrite par sections : chaque section est une chaîne, et le
// commentaire qui l'explique vit ici, côté JavaScript, pour ne pas peser dans
// le budget en octets que verrouille tests/site-styles.test.mjs.

/** Les couleurs des deux thèmes. Unique source : SITE_CSS est généré depuis
 *  cette table, et tests/site-contrast.test.mjs vérifie chaque paire réellement
 *  posée (4,5:1 pour le texte, 3:1 pour les bordures de contrôle et le focus).
 *  Le nom de la variable CSS est la clé elle-même (`--ink2`, `--signInk`…).
 *
 *  Rôles : bg = sol crème ; panel = LA surface teintée (bloc « le construire ») ;
 *  card = feuille du prompt, champs ; ink / ink2 = texte ; rule = filets
 *  décoratifs seulement (jamais la seule limite d'un contrôle) ; field =
 *  bordures de champ et de contrôle ; tomato = liens ; btn / btnInk = l'unique
 *  bouton principal ; mustard + signInk / signInk2 = le panneau de verdict ;
 *  focus = l'anneau de focus. Aucune autre teinte. */
export const TOKENS = {
  light: {
    bg: '#fbf3e4', panel: '#f4e7cf', card: '#fffaf0', ink: '#2b2117', ink2: '#5d4f3f',
    rule: '#e3d3b5', field: '#8a7556', tomato: '#a8361b', btn: '#a8361b', btnInk: '#fffaf0',
    mustard: '#f2cd68', signInk: '#2b2117', signInk2: '#4f3f22', focus: '#1f5fbf',
  },
  dark: {
    bg: '#1b1611', panel: '#261e16', card: '#221b14', ink: '#f6ead6', ink2: '#cbbca5',
    rule: '#3b3128', field: '#8f7d66', tomato: '#ff9a7c', btn: '#f08a69', btnInk: '#1b1611',
    mustard: '#e3b951', signInk: '#1b1611', signInk2: '#43341a', focus: '#8ab8ff',
  },
};

/** L'échelle d'espacement (rem). Rythme : entre deux sections
 *  clamp(s8, 9cqi, s9) ; dans une section, titre → intro s3, intro → contenu
 *  s6 ; gouttière 16px (s4) jusqu'à 700px, 40px au-delà. */
export const SPACE = {
  s1: '.25rem', s2: '.5rem', s3: '.75rem', s4: '1rem', s5: '1.5rem',
  s6: '2rem', s7: '3rem', s8: '4.5rem', s9: '7rem',
};

const vars = (obj) => Object.entries(obj).map(([key, value]) => `--${key}:${value}`).join(';');

/* Deux familles auto-hébergées (public/fonts/, OFL 1.1, voir LICENSE.txt), un
   fichier variable chacune, sous-ensemble latin — le français y tient
   entièrement. Bricolage Grotesque porte les titres (650), le mot du verdict
   (750) et la marque (800) ; Atkinson Hyperlegible Next porte le texte (400,
   700). font-display:swap : la page se lit avant que la police n'arrive, sur
   une pile système aux métriques voisines. */
const FONT_CSS = [
  ['Bricolage Grotesque', '200 800', 'bricolage-grotesque-latin'],
  ['Atkinson Hyperlegible Next', '200 800', 'atkinson-hyperlegible-next-latin'],
].map(([family, weight, file]) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};`
  + `font-display:swap;src:url(/fonts/${file}.woff2) format("woff2");`
  + 'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,'
  + 'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}').join('\n');

/* Tokens. Le thème suit le système par défaut ; le :not([data-theme="light"])
   laisse un choix explicite « clair » l'emporter sur un système en sombre.
   --accent et --muted sont lus par scripts/assets/stats.js pour le graphique
   de /stats. */
const TOKENS_CSS = `:root{${vars(TOKENS.light)};color-scheme:light;${vars(SPACE)};--display:"Bricolage Grotesque","Avenir Next","Gill Sans Nova","Gill Sans","Trebuchet MS",sans-serif;--text:"Atkinson Hyperlegible Next","Avenir Next","Segoe UI",Verdana,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--measure:65ch;--r:14px;--r-lg:28px;--accent:var(--tomato);--muted:var(--ink2)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(TOKENS.dark)};color-scheme:dark}}
:root[data-theme="dark"]{${vars(TOKENS.dark)};color-scheme:dark}`;

/* Base : corps 17px/1.65, liens tomate soulignés, focus bleu de 3px partout.
   Les marges de flux n'ont que des sélecteurs d'élément : elles l'emportent
   sur les remises à zéro (p, h1…) mais jamais sur un composant à classe. */
const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1.0625rem/1.65 var(--text);overflow-wrap:break-word}
a{color:var(--tomato);text-underline-offset:.2em;text-decoration-thickness:1.5px}
a:hover{text-decoration-thickness:2.5px}
:focus-visible{outline:3px solid var(--focus);outline-offset:3px;border-radius:6px}
img,canvas{max-width:100%;vertical-align:middle}
button,input,select{font:inherit;color:inherit}
h1,h2,h3{margin:0;font-family:var(--display);font-weight:650;text-wrap:balance}
h1{font-size:clamp(1.85rem,4.2cqi,2.9rem);line-height:1.1;letter-spacing:-.025em;max-width:16em}
h2{font-size:clamp(1.35rem,2.8cqi,1.75rem);line-height:1.2;letter-spacing:-.015em}
h3{font-size:1.25rem;line-height:1.25;letter-spacing:-.01em}
p,ul,ol,dl,dd,figure,pre{margin:0}
:where(main) ul,:where(main) ol{padding-left:1.25rem}
main > * + *{margin-top:var(--s6)}
main > * + section{margin-top:clamp(var(--s8),9cqi,var(--s9))}
main section > * + *,.sheet > * + *,.stats-notes > * + *{margin-top:var(--s4)}
main > .crumbs + *{margin-top:var(--s3)}
:where(main) p,:where(main) li{max-width:var(--measure)}
code,pre{font-family:var(--mono);font-size:.875rem}
pre{white-space:pre-wrap;overflow-wrap:anywhere}
table{border-collapse:collapse;width:100%;font-size:.9375rem;line-height:1.4;font-variant-numeric:tabular-nums}
th,td{text-align:left;vertical-align:top;padding:var(--s3) var(--s4);border-bottom:1px solid var(--rule)}
th:first-child,td:first-child{padding-left:0}
thead th{font:700 .8125rem/1.3 var(--text);color:var(--ink2);border-bottom-color:var(--ink2)}
caption{text-align:left;font:700 .9375rem/1.4 var(--text);padding-bottom:var(--s2)}
details{border-top:1px solid var(--rule)}
details:last-of-type{border-bottom:1px solid var(--rule)}
summary{cursor:pointer;list-style:none;padding:var(--s5) 0;font:700 1.125rem/1.35 var(--display);display:flex;justify-content:space-between;gap:var(--s5)}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";font:400 1.4rem/1 var(--display);color:var(--ink2)}
details[open] > summary::after{content:"–"}
details > :not(summary){padding-bottom:var(--s5)}
.visually-hidden{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.skip-link{position:absolute;left:-999px;top:8px;background:var(--card);color:var(--ink);padding:var(--s2) var(--s4);border-radius:8px;z-index:9}
.skip-link:focus{left:16px}
.label{display:block;font:700 .8125rem/1.3 var(--text);letter-spacing:.04em;text-transform:uppercase;color:var(--ink2)}
.intro{color:var(--ink2);max-width:var(--measure)}
.lede{font-size:clamp(1.0625rem,2cqi,1.1875rem);line-height:1.65;max-width:var(--measure)}
.mark{display:inline-block;width:1.1em;margin-right:.15em;text-align:center}
.status{font:700 .875rem/1.4 var(--text)}
.status:empty{display:none}`;

/* Coquille. .col-main est le conteneur de requête nommé « page » : toutes les
   mises en page réagissent à la largeur de la colonne de contenu, pas à la
   fenêtre — avec des rails sponsors, la colonne est plus étroite que l'écran.
   Largeur maximale 1080px, gouttière 16px puis 40px. Les rails n'existent
   qu'au-delà de 84rem et seulement quand la page en porte (.has-rails) :
   l'accueil range ses emplacements dans la rangée sous le héros. */
const SHELL_CSS = `.shell{display:grid;grid-template-columns:minmax(0,1fr)}
.col-main{container-type:inline-size;container-name:page;min-width:0}
.page{max-width:1080px;margin:0 auto;padding-inline:16px}
@media (min-width:700px){.page{padding-inline:40px}}
.site-header{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s5);padding:var(--s5) 0}
.brand{display:flex;align-items:center;gap:.55rem;margin-right:auto;font:800 1.125rem/1 var(--display);letter-spacing:-.01em;color:var(--ink);text-decoration:none}
.brand-mark{width:1.85rem;height:1.85rem;border-radius:50%;background:var(--tomato);color:var(--bg);display:inline-grid;place-items:center;font-size:.9rem}
.nav-links{display:flex;flex-wrap:wrap;gap:0 var(--s4);margin:0;padding:0;list-style:none;font-size:.9375rem}
.nav-links a,.lang-switch a,.lang-switch span{display:inline-block;padding:.6rem 0;color:var(--ink);text-decoration:none}
.nav-links a:hover,.lang-switch a:hover,[aria-current="page"]{text-decoration:underline;text-decoration-color:var(--tomato)}
.header-controls{display:flex;align-items:center;gap:var(--s3)}
.lang-switch{display:flex;gap:var(--s3);font-size:.875rem;font-weight:700}
.theme-toggle,.github-btn{display:inline-grid;place-items:center;width:2.5rem;height:2.5rem;border:1px solid var(--field);border-radius:50%;background:transparent;color:var(--ink);cursor:pointer}
.theme-toggle:hover,.github-btn:hover{border-color:var(--ink)}
.theme-icon::before{content:"\\25D0";font-size:1.15rem;line-height:1}
:root[data-theme="dark"] .theme-icon::before{content:"\\25D1"}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .theme-icon::before{content:"\\25D1"}}
@media (max-width:520px){.site-header{column-gap:var(--s3)}.brand{font-size:1.03rem}.nav-links{order:3;width:100%}}
.ref-strip{display:flex;flex-wrap:wrap;gap:var(--s1) var(--s5);margin:0 0 var(--s4);font-size:.8125rem;color:var(--ink2)}
.ref-cell{display:flex;gap:var(--s2)}
.ref-lbl{font-weight:700}
.ref-val{margin:0}
.site-footer{margin-top:clamp(var(--s8),9cqi,var(--s9));padding:var(--s6) 0 var(--s7);border-top:1px solid var(--rule);font-size:.9375rem;color:var(--ink2);display:grid;gap:var(--s3)}
.site-footer p{max-width:var(--measure)}
.foot-links{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s5)}
.foot-links a{color:var(--ink2)}
.crumbs{font-size:.875rem;color:var(--ink2)}
.crumbs a{color:var(--ink2)}
.crumbs [aria-current]{text-decoration:none}`;

/* Badges de verdict (grille, fiche, outils proches) : une forme et un mot, à
   l'encre du texte. La forme est posée par ::before avec un texte alternatif
   vide : le lecteur d'écran lit le mot, pas « cercle noir ». */
const VERDICT_CSS = `.badge{display:inline-flex;align-items:baseline;flex:none;white-space:nowrap;font:700 .875rem/1.3 var(--text);color:var(--ink)}
.badge::before,.fit-tag::before,.vb-word::before{display:inline-block;width:1.1em;margin-right:.15em;text-align:center}
.badge.yes::before{content:"●" / ""}
.badge.kinda::before{content:"◐" / ""}
.badge.no::before{content:"○" / ""}
.badge-lg{font:750 clamp(1.6rem,5cqi,2.2rem)/1 var(--display);letter-spacing:-.02em}
.fit-tag{white-space:nowrap;font-weight:700}
.fit-tag[data-fit="full"]::before{content:"●" / ""}
.fit-tag[data-fit="partial"]::before{content:"◐" / ""}
.fit-tag[data-fit="niche"]::before{content:"○" / ""}`;

/* Composants de la fiche « alternatives » (A4), repris par A5 à A7 (voir la
   spec, §4) : en-tête de page (fil d'Ariane, eyebrow, H1, colonne du panneau
   de verdict moutarde et de sa légende « How we judge », lede, trois façons
   d'arrêter de payer), grille de faits, tableau comparatif dans son cadre
   défilant, fiches projet, bloc « le construire » (LA surface teintée :
   texte à gauche, prompt à droite), pertes, citation « pourquoi on paie »
   et sa note, FAQ, vote, outils liés, nuage de liens. Au-delà de 860px de
   conteneur, fiches projet, pertes, FAQ et bloc prompt passent sur deux
   colonnes, citation et note côte à côte ; la prose garde ses 65ch. */
const PAGE_CSS = `.page-head{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s6);padding-top:var(--s5)}
.eyebrow{margin:0 0 var(--s3);font-size:.9375rem;line-height:1.4;color:var(--ink2)}
.h1-tail{color:var(--ink2)}
.hand-underline{text-decoration:underline 2px var(--tomato);text-underline-offset:.14em}
.verdict-badge{align-self:start;background:var(--mustard);color:var(--signInk);border-radius:var(--r-lg) var(--r-lg) var(--r-lg) 6px;padding:var(--s5)}
.verdict-badge a{color:var(--signInk)}
.verdict-badge :focus-visible{outline-color:var(--signInk)}
.vb-q{font:700 .9375rem/1.4 var(--text)}
.vb-word{margin:var(--s3) 0 var(--s2);font:750 clamp(2.4rem,7cqi,3.1rem)/1 var(--display);letter-spacing:-.03em}
.vb-word::before{font-size:.6em;vertical-align:.12em}
.verdict-badge[data-verdict="yes"] .vb-word::before{content:"●" / ""}
.verdict-badge[data-verdict="kinda"] .vb-word::before{content:"◐" / ""}
.verdict-badge[data-verdict="no"] .vb-word::before{content:"○" / ""}
.vb-why{font-size:1.0625rem;line-height:1.45}
.vb-price{margin-top:var(--s5);padding-top:var(--s4);border-top:1px solid var(--signInk2);font-size:.9375rem;line-height:1.55}
.vb-price strong{font:800 1.125rem var(--display)}
.vb-meta{display:block;margin-top:var(--s1);color:var(--signInk2);font-size:.875rem}
@container page (min-width:780px){.page-head{grid-template-columns:minmax(0,1fr) 19rem;column-gap:var(--s8);padding-top:var(--s7)}.page-head > .vb-col{grid-column:2;grid-row:1 / span 3;margin-top:var(--s2)}.page-head > :not(.vb-col){grid-column:1}.vb-col > .verdict-badge{transform:rotate(1deg)}}
.head-text > * + *{margin-top:var(--s3)}
.tool-favicon{width:40px;height:40px;border-radius:50%;margin-right:var(--s2);vertical-align:-.1em}
.vb-col{display:grid;gap:var(--s4);align-self:start}
p.vb-meta{color:var(--signInk2)}
.vb-facts{display:flex;flex-wrap:wrap;gap:var(--s1) var(--s5);margin-top:var(--s4);font-size:.9375rem}
.vb-facts dt{font-weight:700;color:var(--signInk2)}
.vb-facts dd{margin:0}
.verdict-legend{font-size:.9375rem}
.verdict-legend summary{padding:var(--s3) 0;font-size:1rem}
.verdict-legend ul{list-style:none;padding:0;display:grid;gap:var(--s3)}
.verdict-legend [aria-current]{padding-left:var(--s3);border-left:3px solid var(--ink)}
.ways ol{list-style:none;margin:var(--s3) 0 0;padding:0}
.ways li{border-top:1px solid var(--rule)}
.ways li:last-child{border-bottom:1px solid var(--rule)}
.ways a{display:flex;gap:var(--s4);align-items:baseline;padding:var(--s4) 0;color:var(--ink);text-decoration:none}
.ways a:hover strong{text-decoration:underline;text-decoration-color:var(--tomato)}
.ways .n{font:700 1rem/1 var(--display);color:var(--ink2)}
.hint,.inactive-projects{font-size:.875rem;color:var(--ink2);max-width:var(--measure)}
.hint .fit-tag{color:var(--ink)}
.fact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr));gap:var(--s4) var(--s5);margin:0}
.fact-grid dt{font:700 .8125rem/1.3 var(--text);color:var(--ink2)}
.fact-grid dd{margin:var(--s1) 0 0}
.table-scroll{overflow-x:auto;overscroll-behavior-x:contain;max-width:100%}
.alt-table{min-width:860px}
.alt-table th,.alt-table td{padding:1.15rem 1rem}
.alt-table thead th{padding-top:0;padding-bottom:var(--s3)}
.alt-table tbody th{position:sticky;left:0;z-index:1;min-width:9rem;padding-right:var(--s5);background:var(--bg);font:700 1.0625rem/1.25 var(--display)}
.alt-table tbody th a{color:var(--ink);text-decoration-color:var(--tomato)}
.alt-table .num{text-align:right;white-space:nowrap}
.alt-table .sub{display:block;margin-top:var(--s1);font-size:.8125rem;color:var(--ink2)}
.alt-table tr.other-first > *{border-top:1px solid var(--ink2)}
.alt-card{max-width:var(--measure);padding:var(--s7) 0;border-top:1px solid var(--rule)}
.alt-card-meta{margin-top:var(--s2);font-size:.9375rem;color:var(--ink2)}
.alt-card-meta a{color:var(--ink2)}
.alt-card-what{margin-top:var(--s4);font-size:1.125rem;line-height:1.6}
.alt-card-note,.alt-card > :last-child{margin-top:var(--s3)}
.prompt-block{background:var(--card);border-radius:var(--r);padding:var(--s5)}
.prompt-block pre{max-height:20rem;overflow:auto;line-height:1.7}
.prompt-header,.prompt-actions{display:flex;flex-wrap:wrap;gap:var(--s3) var(--s4);align-items:center}
.prompt-header{justify-content:space-between;margin-bottom:var(--s4)}
.copy-btn{font:700 1rem/1 var(--display);background:var(--btn);color:var(--btnInk);border:0;border-radius:999px;padding:.8rem 1.3rem;cursor:pointer}
.agent-btn,.share-x-btn,.vote-btn,.show-more,.sp-inv-buy{display:inline-flex;align-items:center;gap:var(--s2);font:700 .9375rem/1 var(--text);color:var(--ink);background:transparent;border:1px solid var(--field);border-radius:999px;padding:.7rem 1.05rem;text-decoration:none;cursor:pointer}
.agent-btn:hover,.share-x-btn:hover,.vote-btn:hover,.show-more:hover,.sp-inv-buy:hover{border-color:var(--ink)}
.prompt-caption{font-size:.875rem;color:var(--ink2)}
.build{display:grid;gap:var(--s5) var(--s7);align-items:start;background:var(--panel);border-radius:var(--r-lg);padding:clamp(var(--s5),5cqi,var(--s8))}
.build-text > * + *,.build-prompt > * + *{margin-top:var(--s4)}
.lose-list li{display:flex;gap:var(--s4);align-items:baseline;padding:var(--s3) 0}
.lose-list li::before{content:"✕" / "";flex:none;width:1ch;font-size:.875rem;color:var(--ink2)}
.why{display:grid;gap:var(--s5) var(--s8);align-items:end}
.quote{margin:0;max-width:34em}
.quote p,.best-for{font:700 clamp(1.25rem,2.8cqi,1.6rem)/1.4 var(--display);letter-spacing:-.01em}
.quote-note{color:var(--ink2)}
.vote-row{display:flex;flex-wrap:wrap;gap:var(--s3)}
.vote-count-badge{font-weight:400;color:var(--ink2)}
.related-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:var(--s4)}
.related-card a,.related-card-static{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s3);height:100%;padding:var(--s4) var(--s5);border:1px solid var(--rule);border-radius:var(--r);color:var(--ink);text-decoration:none}
.related-card a:hover{border-color:var(--ink2)}
.related-card img{border-radius:50%}
.related-card-name{flex:1;font:650 1.0625rem/1.3 var(--display)}
.related-card-meta{width:100%;font-size:.875rem;color:var(--ink2)}
.faq{max-width:var(--measure)}
.link-cloud{display:flex;flex-wrap:wrap;gap:var(--s3) var(--s5);margin:var(--s5) 0 0;padding:0;list-style:none}
.link-cloud a{color:var(--ink);text-decoration-color:var(--rule)}
.link-cloud a:hover{text-decoration-color:var(--tomato)}
@container page (min-width:860px){.alt-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--s8)}.alt-card{max-width:none}.lose-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--s8)}.lose-list li{max-width:none}.build{grid-template-columns:minmax(0,2fr) minmax(0,3fr)}.why{grid-template-columns:minmax(0,3fr) minmax(0,2fr)}.why > :not(.quote,.quote-note){grid-column:1 / -1}.quote{max-width:none}.quote-note{padding-left:var(--s5);border-left:1px solid var(--rule)}.faq{max-width:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--s8)}.faq > :not(details){grid-column:1 / -1}.faq details{border-top:0;border-bottom:1px solid var(--rule)}.faq details:nth-of-type(-n+2){border-top:1px solid var(--rule)}}`;

/* Fiche projet /{lang}/oss/{slug} (A5) : composants de la fiche outil, sans
   panneau moutarde. Les faits prennent la colonne de droite de l'en-tête au
   lieu du verdict (cadre à filet, page calme) ; forces et limites se rangent
   côte à côte au-delà de 860px ; l'avis « projet inactif » est un encadré à
   bordure de contrôle, en texte gras, sans couleur. */
const PROJECT_CSS = `.project-notice{max-width:var(--measure);margin-top:var(--s5);padding:var(--s4) var(--s5);border:1px solid var(--field);border-radius:var(--r);font-weight:700}
.project-facts{align-self:start;padding:var(--s5);border:1px solid var(--rule);border-radius:var(--r-lg)}
.project-facts > * + *,.project-about > * + *{margin-top:var(--s4)}
.fact-grid .sub{display:block;font-size:.8125rem;color:var(--ink2)}
.related-card-what{width:100%;line-height:1.5}
main > .pro-con{display:grid;gap:var(--s8);margin-top:clamp(var(--s8),9cqi,var(--s9))}
.pro-con .lose-list{display:block}
.gain-list li::before{content:"✓" / ""}
@container page (min-width:780px){.project-head{grid-template-rows:auto auto 1fr}.project-head > .project-facts{grid-column:2;grid-row:1 / span 3}}
@container page (min-width:860px){main > .pro-con{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--s8)}}`;

/* Comparatif (A6) : mêmes composants que la fiche et la page projet. Le
   tableau n'a que trois colonnes (le critère, puis un côté chacune) : il tient
   dans 320px sans défiler, les valeurs longues passent à la ligne. Sur grand
   écran, le résumé se range à droite du titre et les deux colonnes du tableau
   occupent la largeur. */
const COMPARE_CSS = `.alt-table.compare-table{min-width:0;table-layout:fixed}
.compare-table th,.compare-table td{padding:1rem .5rem;overflow-wrap:anywhere}
.compare-table :is(th,td):first-child{padding-left:0}
.compare-table thead th:first-child{width:26%}
.compare-table thead th{font:650 1rem/1.3 var(--display);color:var(--ink)}
.compare-table thead .sub{font:400 .875rem/1.45 var(--text)}
.compare-table tbody th{min-width:0;font:700 .875rem/1.4 var(--text);color:var(--ink2)}
.compare-table .num{text-align:left}
.compare-summary > * + *{margin-top:var(--s4)}
@container page (min-width:780px){.compare-head{grid-template-columns:minmax(0,2fr) minmax(0,3fr);column-gap:var(--s8);align-items:end}.compare-head > .compare-summary{grid-column:2}.compare-table thead th:first-child{width:22%}.compare-table thead th{font-size:1.125rem}}`;

/* Accueil (maquette direction-3-airy-home.html, revue D14) : héros court,
   ligne de chiffres discrète, emplacement newsletter (Task A9), rangée
   sponsor, recherche, filtres + tri, légende des verdicts, grille de cartes
   3/2/1 colonnes, puis les deux listes de liens. Aucune teinte : la moutarde
   appartient à la fiche. Les pages de liste (catégories, collections, hub
   A–Z, Task A7) reprennent la grille et les lignes .links : .list-head pour
   leur en-tête, .az-list pour remplir la largeur en colonnes. */
const HOME_CSS = `.hero{padding-top:var(--s7)}
.hero > :not(.figures){max-width:44rem}
.hero > * + *{margin-top:var(--s4)}
.hero h1{max-width:12em}
.sub{font-size:clamp(1.0625rem,1.8cqi,1.1875rem);line-height:1.55;color:var(--ink2);max-width:var(--measure)}
.directory{margin-top:var(--s7)!important}
.figures{display:flex;flex-wrap:wrap;gap:var(--s1) var(--s4);margin-top:var(--s5)!important;padding:0;list-style:none;font-size:.875rem;color:var(--ink2)}
.figures li{max-width:none}
.figures strong{color:var(--ink)}
.search-frame{max-width:34rem}
.search-combo{position:relative}
.search-shell{position:relative;display:flex;align-items:center}
.search-shell::before{content:"";position:absolute;left:1.15rem;width:.8rem;height:.8rem;border:2px solid var(--ink2);border-radius:50%;pointer-events:none}
.search-shell input{width:100%;background:var(--card);border:1.5px solid var(--field);border-radius:999px;padding:.95rem 3rem;-webkit-appearance:none;appearance:none;text-overflow:ellipsis}
.search-shell input::placeholder{color:var(--ink2);opacity:1}
.search-shell input:focus-visible{outline-offset:2px;border-color:var(--ink)}
.search-clear{position:absolute;right:.4rem;width:2.5rem;height:2.5rem;border:0;border-radius:50%;background:transparent;color:var(--ink2);font-size:1.4rem;cursor:pointer}
.search-panel{position:absolute;z-index:5;left:0;right:0;margin-top:var(--s2);background:var(--card);border:1px solid var(--field);border-radius:var(--r);padding:var(--s2)}
.search-option{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s1) var(--s3);padding:var(--s2) var(--s3);border-radius:8px;cursor:pointer}
.search-option:hover,.search-option[aria-selected="true"]{background:var(--panel)}
.search-option[aria-selected="true"]{outline:2px solid var(--focus);outline-offset:-2px}
.search-option-icon{width:20px;height:20px;border-radius:50%}
.search-option-name{font-weight:700}
.search-option-meta{margin-left:auto;font-size:.8125rem;color:var(--ink2)}
.search-option-viewall{margin-top:var(--s1);border-top:1px solid var(--rule);font-weight:700;color:var(--tomato)}
.search-empty{padding:var(--s2) var(--s3);color:var(--ink2)}
.controls{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--s4) var(--s5);margin-top:var(--s5)!important}
.filters{display:flex;flex-wrap:wrap;gap:var(--s2)}
.verdict-chip{display:inline-flex;align-items:baseline;gap:var(--s1);font:400 .9375rem/1 var(--text);background:transparent;border:1px solid var(--ink2);border-radius:999px;padding:.6rem .95rem;cursor:pointer}
.verdict-chip:hover{border-color:var(--ink)}
.verdict-chip .c{color:var(--ink2)}
.verdict-chip.is-active{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.verdict-chip.is-active .c{color:var(--bg)}
.selects{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:var(--s2) var(--s3);font-size:.9375rem;color:var(--ink2)}
@container page (min-width:600px){.selects{grid-template-columns:auto minmax(0,16rem) auto minmax(0,12rem)}}
.selects select{width:100%;color:var(--ink);background:var(--card);border:1px solid var(--field);border-radius:999px;padding:.55rem .95rem}
.legend{display:flex;flex-wrap:wrap;gap:var(--s1) var(--s5);margin-top:var(--s4)!important;padding:0;list-style:none;font-size:.875rem;color:var(--ink2)}
.legend li{max-width:none}
.legend strong{color:var(--ink)}
.tool-grid{list-style:none;margin:var(--s5) 0 0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s4)}
@container page (min-width:600px){.tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container page (min-width:900px){.tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.card{position:relative;display:flex;flex-direction:column;gap:var(--s2);max-width:none!important;padding:var(--s5);border:1px solid var(--rule);border-radius:var(--r)}
.card:hover{border-color:var(--ink2)}
.card-top{display:flex;align-items:center;gap:var(--s3)}
.fav{flex:none;width:2rem;height:2rem;border-radius:50%;border:1px solid var(--rule);background:var(--card);object-fit:contain;padding:3px}
.card-name{flex:1;min-width:0;font:650 1.125rem/1.25 var(--display);letter-spacing:-.01em}
.card-name a{color:var(--ink);text-decoration:none}
.card-name a::after{content:"";position:absolute;inset:0;border-radius:var(--r)}
.card-name a:focus-visible{outline:none}
.card:has(.card-name a:focus-visible){outline:3px solid var(--focus);outline-offset:3px}
.card:hover .card-name a{text-decoration:underline;text-decoration-color:var(--tomato)}
.card .cat{margin-top:calc(var(--s1) * -1);padding-left:calc(2rem + var(--s3));font-size:.875rem;color:var(--ink2)}
.card .tagline{line-height:1.5}
.card .facts{display:flex;flex-wrap:wrap;gap:0 var(--s2);margin-top:auto;padding-top:var(--s3);font-size:.875rem;color:var(--ink2)}
.card .price{color:var(--ink);font-weight:700}
.card .votes:not(:has(.visually-hidden))::before{content:"·" / "";margin-right:var(--s2)}
.card .alts{padding-top:var(--s3);border-top:1px solid var(--rule);font-size:.875rem}
.card .alts span{color:var(--ink2)}
#no-results{color:var(--ink2)}
.show-more{margin-top:var(--s5)}
.start{display:grid;gap:var(--s8)}
.start > *,.page-head > *,.faq details,.two-col > *,.build > *,.why > *{margin-top:0}
@container page (min-width:820px){.start{grid-template-columns:1fr 1fr;column-gap:var(--s8)}}
.links{list-style:none;margin:var(--s5) 0 0;padding:0;border-top:1px solid var(--rule)}
.links li{max-width:none;border-bottom:1px solid var(--rule)}
.links a{display:flex;justify-content:space-between;gap:var(--s4);align-items:baseline;padding:var(--s3) 0;color:var(--ink);text-decoration:none}
.links a:hover .l-name{text-decoration:underline;text-decoration-color:var(--tomato)}
.l-meta{color:var(--ink2);font-size:.875rem;text-align:right}
.list-head{padding-top:var(--s7)}
.list-head > * + *{margin-top:var(--s3)}
.az-list{columns:15rem;column-gap:var(--s7)}
.az-list li{break-inside:avoid}
main > .az-sec + .az-sec{margin-top:var(--s7)}
.az-nav .link-cloud{gap:var(--s2) var(--s4);font:700 1.125rem/1 var(--display)}
.more{display:inline-block;margin-top:var(--s4);font-weight:700}`;

/* Sponsors : mêmes emplacements et même nombre qu'avant la refonte (spec
   D14), en style discret. Le repli (.sp-fallback) est une rangée à filets :
   c'est aussi la rangée sous le héros de l'accueil. Les rails ne s'affichent
   qu'au-delà de 84rem, collés (sticky, jamais fixed). Le bandeau du bas reste
   défilant — c'est ainsi qu'il est vendu — et s'arrête au survol, au focus et
   en mouvement réduit. Aucun mot « Sponsor » (décision du 06/08/2026). */
const SPONSOR_CSS = `.sp-rail{display:none}
.sp-fallback{margin-top:var(--s7);padding:var(--s4) 0;border-block:1px solid var(--rule)}
.sp-fallback-grid{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3) var(--s5)}
.sp-card{display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--s1) var(--s2);min-width:0;overflow-wrap:anywhere;font-size:.9375rem;color:var(--ink);text-decoration:none}
.sp-card.live:hover .sp-name{text-decoration:underline;text-decoration-color:var(--tomato)}
.sp-icon{width:20px;height:20px;border-radius:50%}
.sp-name{font-weight:700}
.sp-tagline{color:var(--ink2)}
.sp-card.live{order:-1}
.sp-card.open,.sp-card.taken{font-size:.8125rem;color:var(--ink2)}
.sp-card.open:hover{color:var(--ink)}
.sp-price{font-weight:700;color:var(--ink)}
.sp-cta{color:var(--tomato)}
.sponsor-tape{border-top:1px solid var(--rule);font-size:.8125rem;color:var(--ink2)}
.sp-tape-marquee{overflow:hidden;padding:var(--s3) 0}
.sp-tape-track{display:flex;width:max-content;animation:sp-tape-scroll 90s linear infinite}
.sponsor-tape:hover .sp-tape-track,.sponsor-tape:focus-within .sp-tape-track{animation-play-state:paused}
@keyframes sp-tape-scroll{to{transform:translateX(-50%)}}
.sp-tape-item{display:inline-flex;align-items:center;gap:var(--s2);padding-right:var(--s6);white-space:nowrap;color:var(--ink2);text-decoration:none}
.sp-tape-item.live{color:var(--ink)}
.sp-tape-item img{width:16px;height:16px;border-radius:50%}
.sp-tape-tagline{color:var(--ink2)}
.sp-tape-price{font-weight:700}
.sp-tape-static{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s5);max-width:1080px;margin:0 auto;padding:var(--s3) 16px}
.sp-more{font-size:.8125rem;font-weight:700}
@media (min-width:84rem){.shell.has-rails{grid-template-columns:minmax(9rem,13rem) minmax(0,1fr) minmax(9rem,13rem);column-gap:var(--s5);padding-inline:var(--s5)}.has-rails .col-main{grid-column:2;grid-row:1}.sp-rail{display:flex;flex-direction:column;position:sticky;top:0;align-self:start;max-height:100vh;overflow-y:auto;padding-block:var(--s7)}.sp-left{grid-column:1;grid-row:1}.sp-right{grid-column:3;grid-row:1}.sp-rail .sp-card{padding:var(--s3) 0;border-top:1px solid var(--rule)}.has-rails .sp-fallback{display:none}}`;

/* Pages existantes en attente de leur refonte (/sponsor,
   /stats, 404, confidentialité) : même contenu, nouvel habillage. La fiche
   outil n'y est plus (Task A4) : ses règles vivent dans PAGE_CSS. Ces règles
   disparaîtront avec les gabarits qui les portent. */
const LEGACY_CSS = `.two-col{display:grid;gap:var(--s6)}
@container page (min-width:780px){.two-col{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--s8)}}
.lose-list,.related-cards,.sp-figures,.sp-inv{list-style:none;padding:0!important}
.sp-figures{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s6)}
.sp-inv{display:grid;gap:0}
.sp-inv-item{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4);padding:var(--s3) 0;border-bottom:1px solid var(--rule)}
.sp-inv-slot{min-width:3ch;font-weight:700}
.sp-inv-state{color:var(--ink2)}
.sp-inv-price{font-weight:700}
.sp-inv-buy{margin-left:auto;padding:.5rem .9rem}
.sp-duration{margin:var(--s4) 0 0;padding:var(--s4);border:1px solid var(--field);border-radius:var(--r)}
.sp-duration-options{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s5)}
.sp-duration-note,.sp-noscript{font-size:.875rem;color:var(--ink2)}
.sp-contact{font-weight:700}
.stats-head > * + *{margin-top:var(--s3)}
.stats-tagline,.stats-error{color:var(--ink2)}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:var(--s4)}
.stat-tile{display:grid;gap:var(--s1);padding:var(--s4) var(--s5);border:1px solid var(--rule);border-radius:var(--r)}
.stat-label{font:700 .8125rem/1.3 var(--text);color:var(--ink2)}
.stat-value{font:650 1.75rem/1.1 var(--display);font-variant-numeric:tabular-nums}
.stat-caption{font-size:.8125rem;color:var(--ink2)}
.stat-dot::before{display:inline-block;width:1.1em;text-align:center}
.stat-dot.yes::before{content:"●" / ""}
.stat-dot.kinda::before{content:"◐" / ""}
.stat-dot.no::before{content:"○" / ""}
.stats-band{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--s2);padding-bottom:var(--s2);border-bottom:1px solid var(--ink2);font:700 .9375rem/1.4 var(--display)}
.stats-sheet{padding:var(--s5);border:1px solid var(--rule);border-radius:var(--r);min-width:0}
.stats-sheet > * + *{margin-top:var(--s4)}
.stats-h{font-size:1.125rem}
.stats-h-aside{font:400 .875rem var(--text);color:var(--ink2)}
.stats-cols{display:grid;gap:var(--s5)}
@container page (min-width:780px){.stats-cols{grid-template-columns:repeat(2,minmax(0,1fr))}}
.chart-box{position:relative;height:16rem}
.bar-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(3rem,40%) auto;gap:var(--s3);align-items:center;padding:var(--s1) 0;font-size:.875rem}
.bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{height:.5rem;border-radius:999px;background:var(--rule)}
.bar-fill{display:block;height:100%;border-radius:999px;background:var(--ink2)}
.bar-value{font-variant-numeric:tabular-nums}
.chip-list{display:flex;flex-wrap:wrap;gap:var(--s2)}
.stat-chip{padding:.3rem .7rem;border:1px solid var(--field);border-radius:999px;font-size:.875rem}
.crawler-row{display:flex;flex-wrap:wrap;gap:0 var(--s3);padding:var(--s2) 0;border-bottom:1px solid var(--rule);font-size:.875rem}
.crawler-name{font-weight:700}
.crawler-vendor,.crawler-seen,.stats-empty{color:var(--ink2)}
.crawler-counts{margin-left:auto;font-variant-numeric:tabular-nums}
.verdict-stack{display:flex;height:.75rem;margin-top:var(--s4);border-radius:999px;overflow:hidden;background:var(--rule)}
.vs-yes{background:var(--ink)}
.vs-kinda{background:var(--ink2)}
.vs-no{background:var(--field)}
.box{padding:var(--s5);background:var(--panel);border-radius:var(--r)}
.updated{color:var(--ink2);font-size:.875rem}
.sheet h1 + *{margin-top:var(--s4)}
body > .page{padding-block:var(--s7)}`;

/* Mouvement : les transitions d'état ne vivent qu'hors mouvement réduit ; en
   mouvement réduit, le bandeau se range en rangée fixe et sa moitié dupliquée
   (qui ne sert qu'à boucler) disparaît. */
const MOTION_CSS = `@media (prefers-reduced-motion:no-preference){a,button,.card{transition:border-color .15s,background-color .15s,color .15s}}
@media (prefers-reduced-motion:reduce){.sp-tape-track{animation:none;flex-wrap:wrap;width:auto;row-gap:var(--s2);padding-inline:16px}.sp-tape-item[inert]{display:none}.vb-col > .verdict-badge{transform:none}}`;

export const SITE_CSS = [
  FONT_CSS, TOKENS_CSS, BASE_CSS, SHELL_CSS, VERDICT_CSS, PAGE_CSS, PROJECT_CSS, COMPARE_CSS, HOME_CSS,
  SPONSOR_CSS, LEGACY_CSS, MOTION_CSS,
].join('\n') + '\n';
