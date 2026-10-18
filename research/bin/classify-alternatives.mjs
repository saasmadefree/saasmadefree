// Tri des candidats « alternative open source » par API de décision (règle
// utilisateur du 15/10/2026 : question fermée en masse → Jev puis OpenAI
// Decisions, jamais un LLM génératif). Lit research/alternatives/{slug}.json,
// écrit research/decisions/{slug}.json. N'écrit rien sous data/.
//
// Usage : node research/bin/classify-alternatives.mjs <slug> [<slug>…]
// Clés lues à l'exécution, jamais copiées : OPENAI_API_KEY depuis
// ~/Coding/ecommerce-data/.env.local, TYPESAFE_API_KEY depuis
// ~/.config/jev-mcp/credentials.env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const JEV_THRESHOLD = 0.3;
const DECISION_THRESHOLD = 0.5;

function readEnvKey(file, name) {
  const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} absent de ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
}

const openaiKey = readEnvKey(path.join(os.homedir(), 'Coding/ecommerce-data/.env.local'), 'OPENAI_API_KEY');
process.env.TYPESAFE_API_KEY ||= readEnvKey(path.join(os.homedir(), '.config/jev-mcp/credentials.env'), 'TYPESAFE_API_KEY');

const jevRoot = path.join(os.homedir(), 'Coding/mcp-server-jev/src');
const { createJevClient } = await import(path.join(jevRoot, 'client.mjs'));
const { classifyWithJev } = await import(path.join(jevRoot, 'classify.mjs'));
const evaluate = createJevClient({ apiKey: process.env.TYPESAFE_API_KEY });

function question(tool, coreLoop) {
  return `Paid SaaS: "${tool}". What people pay it for: ${coreLoop} Question: is the candidate below an open-source or self-hostable application (web, desktop or server) that a person could actually use INSTEAD of ${tool} for that job, or for a clear, substantial part of it? Partial replacements count as yes (for example a desktop video editor for a video app, a self-hosted rank tracker for an SEO suite). Answer no for: a code library or SDK only, a command-line utility with no end-user workflow, a closed paid service, a tutorial, or a tool for an unrelated job.`;
}

function candidateText(c) {
  return [
    `Name: ${c.name}`,
    c.repo ? `Repository: github.com/${c.repo}` : null,
    c.homepage ? `Homepage: ${c.homepage}` : null,
    `What it is: ${c.why}`,
    c.coreLoopCovered ? `What it covers: ${c.coreLoopCovered}` : null,
  ].filter(Boolean).join('\n');
}

async function decide(q, text) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const r = await fetch('https://api.openai.com/v1/decisions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-6-luna', input: text, questions: [{ type: 'predicate', name: 'alternative', instructions: q }] }),
    });
    if (r.ok) {
      const d = await r.json();
      return d.answers[0].probability;
    }
    if (attempt === 3) throw new Error(`decisions HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    await new Promise((res) => setTimeout(res, 1500 * attempt));
  }
}

for (const slug of process.argv.slice(2)) {
  const tool = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tools', `${slug}.json`), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/i18n/en/tools', `${slug}.json`), 'utf8'));
  const candidates = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/alternatives', `${slug}.json`), 'utf8'));
  const q = question(tool.name, en.coreLoopDIY);

  const jevOut = await classifyWithJev({
    purpose: q,
    items: candidates.map((c) => ({ id: c.slug.slice(0, 128), content: candidateText(c) })),
    classes: [
      { id: 'alternative', description: `Can replace the core use of ${tool.name}, fully or substantially.` },
      { id: 'other', description: 'Library, API wrapper, closed paid service, unrelated or too narrow.' },
    ],
    none: { id: 'undetermined', description: 'Not enough information to decide.' },
  }, evaluate);
  const jevBy = Object.fromEntries(jevOut.results.map((r) => [r.id, r]));

  const out = [];
  for (const c of candidates) {
    const j = jevBy[c.slug.slice(0, 128)];
    const jevP = j?.probabilities?.alternative ?? 0;
    // Tout ce qui pourrait être publié passe par Decisions : les positifs de
    // Jev au seuil 0,3 et ses cas « review ». Un rejet net de Jev s'arrête là.
    // Lot L0 = calibration (règle utilisateur : calibrer le seuil sur un jeu
    // étiqueté avant d'automatiser) : tout passe par Decisions, Jev est
    // seulement journalisé pour caler son seuil sur les lots suivants.
    const needsDecision = process.env.JEV_PREFILTER === '1' ? (jevP >= JEV_THRESHOLD || j?.review === true || !j) : true;
    const decisionP = needsDecision ? await decide(q, candidateText(c)) : null;
    const kept = decisionP !== null && decisionP >= DECISION_THRESHOLD;
    out.push({ slug: c.slug, name: c.name, fitGuess: c.fitGuess, jev: { p: jevP, review: j?.review ?? null, classId: j?.classId ?? null }, decision: decisionP, kept });
  }
  fs.mkdirSync(path.join(ROOT, 'research/decisions'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'research/decisions', `${slug}.json`), `${JSON.stringify({ tool: slug, checkedOn: new Date().toISOString().slice(0, 10), question: q, jevModel: jevOut.model, results: out }, null, 2)}\n`);
  console.log(`${slug}: ${out.filter((o) => o.kept).length}/${out.length} retenus — ${out.filter((o) => o.kept).map((o) => o.slug).join(', ')}`);
}
