// Feuille de style unique, émise une seule fois par le générateur vers
// dist/assets/site.css et partagée par toutes les pages. Elle prolonge la
// palette et la typographie de public/index.html (voir .impeccable.md) :
// papier chaud, encre, mesure généreuse, alignement à gauche, et la seule
// couleur saturée de toute l'interface reste le verdict lui-même.
export const SITE_CSS = `:root{
  --paper:#faf7f2; --ink:#17150f; --muted:#6f675a; --rule:#e3ddd2;
  --yes:#166534; --kinda:#a16207; --no:#9f1239;
  --measure:34rem; --wide:46rem; --focus:#2b6cb0;
}
@media (prefers-color-scheme:dark){
  :root{ --paper:#131210; --ink:#f2eee6; --muted:#9a9185; --rule:#2b2822;
         --yes:#4ade80; --kinda:#fbbf24; --no:#fb7185; --focus:#7cb3ff; }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font:400 clamp(1rem,0.94rem + 0.3vw,1.125rem)/1.65 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  padding:clamp(1.5rem,5vw,3.5rem) clamp(1.25rem,6vw,3rem);
}
.page{max-width:58rem;margin:0 auto}
a{color:inherit;text-underline-offset:.18em;text-decoration-thickness:.06em}
a:hover{text-decoration-thickness:.12em}
:focus-visible{outline:2px solid var(--focus);outline-offset:.2em}

.skip-link{
  position:absolute; left:-999px; top:auto; width:1px; height:1px; overflow:hidden;
  background:var(--ink); color:var(--paper); padding:.6em 1em; z-index:10; border-radius:.3em;
}
.skip-link:focus{ position:fixed; left:1rem; top:1rem; width:auto; height:auto; overflow:visible; }

.site-header{
  display:flex; align-items:center; justify-content:space-between; gap:1rem 2rem;
  flex-wrap:wrap; padding-bottom:1.4rem; margin-bottom:clamp(2rem,6vh,3.5rem);
  border-bottom:1px solid var(--rule);
}
.brand{font-weight:600; letter-spacing:.01em; text-decoration:none}
.lang-switch{display:flex; gap:.9rem; font-size:.85rem; color:var(--muted)}
.lang-switch a{color:var(--muted)}
.lang-switch [aria-current]{color:var(--ink); font-weight:600}

.breadcrumb{font-size:.85rem; color:var(--muted); margin:0 0 1.8rem}
.breadcrumb a{color:var(--muted)}

h1{
  font-weight:400; margin:0 0 .9rem;
  font-size:clamp(1.8rem,1.1rem + 2.6vw,3rem); line-height:1.1;
  letter-spacing:-.02em; max-width:26ch; text-wrap:balance;
}
h1 em{font-style:normal;color:var(--muted)}
h2{font-size:.8rem;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);
   font-weight:600;margin:2.6rem 0 .9rem}
h2:first-of-type{margin-top:0}
p{margin:0 0 1rem; max-width:var(--wide)}
.tagline{color:var(--muted); margin:0 0 clamp(2rem,5vh,3rem); max-width:var(--measure)}
.lede{max-width:var(--measure);color:var(--muted);margin:0 0 clamp(2.5rem,7vh,4rem)}

dl.verdicts{margin:0 0 1.6rem;max-width:44rem;
   display:grid;grid-template-columns:auto 1fr;gap:.7rem 1.4rem;align-items:baseline}
dl.verdicts dt{white-space:nowrap;font-weight:600;display:flex;align-items:baseline;gap:.55rem}
dl.verdicts dt i{width:1.6rem;height:.34rem;display:block;flex:none;transform:translateY(-.18em)}
dl.verdicts dt.yes{color:var(--yes)} dl.verdicts dt.yes i{background:var(--yes)}
dl.verdicts dt.kinda{color:var(--kinda)} dl.verdicts dt.kinda i{background:var(--kinda)}
dl.verdicts dt.no{color:var(--no)} dl.verdicts dt.no i{background:var(--no)}
dl.verdicts dd{margin:0;color:var(--muted); max-width:38rem}

.tally{max-width:var(--measure);color:var(--muted);font-size:.94rem;margin:0 0 clamp(2.5rem,6vh,4rem)}

.verdict{display:inline-flex;align-items:baseline;gap:.4em;font-weight:600;white-space:nowrap}
.verdict i{width:1rem;height:.3rem;display:inline-block;transform:translateY(-.15em);flex:none}
.verdict.yes{color:var(--yes)} .verdict.yes i{background:var(--yes)}
.verdict.kinda{color:var(--kinda)} .verdict.kinda i{background:var(--kinda)}
.verdict.no{color:var(--no)} .verdict.no i{background:var(--no)}

search{
  display:flex; gap:1.6rem; flex-wrap:wrap; margin:0 0 2rem;
  padding:1rem 0; border-top:1px solid var(--rule); border-bottom:1px solid var(--rule);
}
.field{display:flex; flex-direction:column; gap:.35rem; font-size:.85rem}
.field label{color:var(--muted)}
input[type=search], select{
  font:inherit; font-size:.95rem; padding:.5em .7em; border:1px solid var(--rule);
  border-radius:.25em; background:var(--paper); color:var(--ink); min-width:14rem;
}

.table-scroll{overflow-x:auto; margin:0 0 2rem}
table{width:100%; border-collapse:collapse; min-width:32rem}
caption{text-align:left; color:var(--muted); font-size:.85rem; margin-bottom:.6rem}
th,td{text-align:left; padding:.65em .9em .65em 0; border-bottom:1px solid var(--rule); vertical-align:baseline}
thead th{font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:600}
tbody th{font-weight:600}
tbody tr[hidden]{display:none}

#no-results{color:var(--muted)}

.prompt-block{position:relative; margin:0 0 .5rem}
pre{
  background:color-mix(in srgb, var(--ink) 5%, transparent);
  border:1px solid var(--rule); border-radius:.4em; padding:1rem 1.1rem;
  overflow-x:auto; font-size:.85rem; line-height:1.6;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  white-space:pre-wrap; word-break:break-word; margin:0;
}
button{
  font:inherit; font-size:.9rem; padding:.5em 1em; border:1px solid var(--ink);
  background:transparent; color:var(--ink); border-radius:.3em; cursor:pointer;
}
button:disabled{opacity:.5; cursor:default}
@media (prefers-reduced-motion:no-preference){ button{transition:opacity .15s ease} }
button:hover:not(:disabled){opacity:.8}
.copy-btn{margin-top:.7rem}
.status{font-size:.85rem; color:var(--muted); margin:.6rem 0 0; min-height:1.2em}

details{border-top:1px solid var(--rule); padding:.9rem 0}
details:last-of-type{border-bottom:1px solid var(--rule)}
summary{cursor:pointer; font-weight:600}
summary::marker{color:var(--muted)}
details p{margin:.7rem 0 0; color:var(--muted); max-width:var(--measure)}

ul{padding-left:1.15rem; max-width:var(--wide)}
li{margin:0 0 .4rem}
ul.plain{list-style:none; padding:0}

.related-list{display:flex; flex-direction:column; gap:1rem; list-style:none; padding:0; margin:0 0 1rem}
.related-list .name{font-weight:600; margin-right:.6em}
.related-list p{margin:.2rem 0 0; color:var(--muted); max-width:var(--measure)}

.vote-section{border-top:1px solid var(--rule); padding-top:1.4rem; margin-top:2.6rem}
.vote-count{color:var(--muted); margin:0 0 .8rem}

footer.site-footer{margin-top:clamp(3rem,8vh,5rem);padding-top:1.4rem;border-top:1px solid var(--rule);
  display:flex;flex-wrap:wrap;gap:.5rem 1.6rem;font-size:.9rem;color:var(--muted)}

.visually-hidden{
  position:absolute; width:1px;height:1px; padding:0;margin:-1px;
  overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
}

@media (prefers-reduced-motion:no-preference){
  .r{opacity:0;transform:translateY(.4rem);animation:rise .6s cubic-bezier(.16,1,.3,1) forwards}
  @keyframes rise{to{opacity:1;transform:none}}
}
`;
