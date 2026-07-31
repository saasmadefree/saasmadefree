// Feuille de style unique, émise une seule fois vers dist/assets/site.css.
//
// Direction : clair, dense, technique. Le monospace porte toute la donnée
// (prix, verdicts, catégories, compteurs) parce que c'est ce que le lecteur
// vient scanner ; un grotesque système porte les titres. Le verdict est un
// badge plein, pas un tiret discret : c'est l'information qu'on doit voir
// d'un seul coup d'œil dans une liste de cent lignes.
export const SITE_CSS = `:root{
  --paper:#faf9f6; --card:#ffffff; --ink:#16150f; --muted:#6b6a5e; --rule:#e5e2d8;
  --yes:#15803d; --kinda:#b45309; --no:#be123c;
  --on-accent:#ffffff;
  --accent:#15803d;
  --measure:36rem; --wide:48rem; --focus:#1d4ed8;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
}
@media (prefers-color-scheme:dark){
  :root{ --paper:#111110; --card:#1a1917; --ink:#f2f0e9; --muted:#9c9a8d; --rule:#2c2a25;
         --yes:#22c55e; --kinda:#f59e0b; --no:#fb7185; --on-accent:#0d0d0c;
         --accent:#22c55e; --focus:#93c5fd; }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font:400 15px/1.6 var(--mono);
  padding:clamp(1.25rem,4vw,2.5rem) clamp(1rem,5vw,2.5rem);
}
.page{max-width:62rem;margin:0 auto}
a{color:inherit;text-underline-offset:.18em;text-decoration-thickness:.06em}
a:hover{text-decoration-thickness:.14em}
:focus-visible{outline:2px solid var(--focus);outline-offset:.2em}

.skip-link{position:absolute;left:-999px;width:1px;height:1px;overflow:hidden;
  background:var(--ink);color:var(--paper);padding:.6em 1em;z-index:10;border-radius:.3em}
.skip-link:focus{position:fixed;left:1rem;top:1rem;width:auto;height:auto;overflow:visible}

/* ---------- chrome ---------- */
.site-header{display:flex;align-items:center;justify-content:space-between;gap:1rem 2rem;
  flex-wrap:wrap;padding-bottom:1rem;margin-bottom:clamp(2rem,6vh,3.5rem);
  border-bottom:1px solid var(--rule)}
.brand{font-weight:700;letter-spacing:-.01em;text-decoration:none;font-size:1rem}
.lang-switch{display:flex;gap:.6rem;font-size:.8rem;color:var(--muted)}
.lang-switch a{color:var(--muted);text-decoration:none;padding:.25em .6em;border-radius:999px}
.lang-switch a:hover{background:color-mix(in srgb,var(--ink) 7%,transparent)}
.lang-switch [aria-current]{background:var(--ink);color:var(--paper)}

.breadcrumb{font-size:.8rem;color:var(--muted);margin:0 0 1.6rem}
.breadcrumb a{color:var(--muted)}

/* ---------- titres ---------- */
h1{font-family:var(--sans);font-weight:800;margin:0 0 .8rem;
  font-size:clamp(2rem,1.1rem + 3.6vw,3.6rem);line-height:1.03;
  letter-spacing:-.035em;max-width:20ch;text-wrap:balance}
h1 .blank{color:var(--accent);border-bottom:.12em solid var(--accent);padding:0 .12em}
h1 em{font-style:normal;color:var(--muted)}
h2{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
  font-weight:700;margin:2.4rem 0 .8rem}
section:first-of-type > h2:first-child{margin-top:0}
p{margin:0 0 .9rem;max-width:var(--wide)}
.tagline{color:var(--muted);margin:0 0 clamp(1.75rem,4vh,2.5rem);max-width:var(--measure)}
.lede{max-width:var(--measure);color:var(--muted);margin:0 0 clamp(2rem,5vh,3rem)}
.tally{color:var(--muted);font-size:.85rem;margin:0 0 clamp(2rem,5vh,3rem)}

/* ---------- verdicts ---------- */
.badge{display:inline-block;font-size:.68rem;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;padding:.32em .7em .3em;border-radius:.3em;
  color:var(--on-accent);white-space:nowrap;line-height:1.25}
.badge.yes{background:var(--yes)} .badge.kinda{background:var(--kinda)} .badge.no{background:var(--no)}

dl.verdicts{margin:0 0 1.4rem;display:grid;grid-template-columns:auto 1fr;
  gap:.65rem 1.1rem;align-items:baseline;max-width:46rem}
dl.verdicts dt{white-space:nowrap}
dl.verdicts dd{margin:0;color:var(--muted);max-width:40rem;font-size:.92rem}

/* ---------- recherche façon terminal ---------- */
search{display:block;margin:0 0 1.4rem}
.field label{display:block;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin:0 0 .5rem}
.search-shell{display:flex;align-items:center;gap:.6rem;background:var(--card);
  border:1px solid var(--rule);border-radius:.45em;padding:.75em .9em;
  max-width:38rem;box-shadow:0 1px 0 color-mix(in srgb,var(--ink) 5%,transparent)}
.search-shell::before{content:">";color:var(--accent);font-weight:700;flex:none}
.search-shell:focus-within{border-color:var(--accent)}
input[type=search]{font:inherit;border:0;background:transparent;color:var(--ink);
  width:100%;padding:0;outline:none;font-size:.95rem}
input[type=search]::placeholder{color:var(--muted)}

/* ---------- pastilles de catégorie ---------- */
.chips{display:flex;flex-wrap:wrap;gap:.45rem;list-style:none;padding:0;
  margin:0 0 clamp(1.75rem,4vh,2.5rem)}
.chips a{display:inline-flex;align-items:center;gap:.4em;text-decoration:none;
  font-size:.8rem;padding:.4em .8em;border:1px solid var(--rule);border-radius:999px;
  background:var(--card);color:var(--ink);white-space:nowrap}
.chips a:hover{border-color:var(--ink)}
.chips a[aria-current]{background:var(--ink);color:var(--paper);border-color:var(--ink)}

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
.prompt-block{position:relative;margin:0 0 .5rem}
pre{background:var(--card);border:1px solid var(--rule);border-radius:.5em;
  padding:1rem 1.1rem;overflow-x:auto;font-size:.82rem;line-height:1.65;
  font-family:var(--mono);white-space:pre-wrap;word-break:break-word;margin:0}
button{font:inherit;font-size:.85rem;padding:.55em 1.1em;border:1px solid var(--ink);
  background:var(--ink);color:var(--paper);border-radius:.35em;cursor:pointer;font-weight:600}
button:disabled{opacity:.5;cursor:default}
@media (prefers-reduced-motion:no-preference){button{transition:opacity .15s ease}}
button:hover:not(:disabled){opacity:.85}
.copy-btn{margin-top:.7rem}
.status{font-size:.82rem;color:var(--muted);margin:.6rem 0 0;min-height:1.2em}

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

footer.site-footer{margin-top:clamp(2.5rem,7vh,4rem);padding-top:1.2rem;
  border-top:1px solid var(--rule);display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;
  font-size:.82rem;color:var(--muted)}

.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

@media (prefers-reduced-motion:no-preference){
  .r{opacity:0;transform:translateY(.35rem);animation:rise .5s cubic-bezier(.16,1,.3,1) forwards}
  @keyframes rise{to{opacity:1;transform:none}}
}
`;
