// Benchmark: legacy Hirschberg LCS vs Myers O(ND), same inputs.
// Usage: npm run build && node bench/bench.mjs
//
// Both sides are timed end-to-end from raw strings: the legacy pipeline is
// splitIntoTokens + legacyDiff (exactly what the old web app executed), the
// new pipeline is diff() including tokenization and interning.
import { performance } from 'node:perf_hooks';
import { splitIntoTokens, legacyDiff } from './legacy-hirschberg.mjs';
import { diff } from '../dist/index.js';

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const WORDS = ('the quick brown fox jumps over lazy dog lorem ipsum dolor sit amet ' +
  'consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore').split(' ');

function makeText(rng, wordCount) {
  const out = [];
  for (let i = 0; i < wordCount; i++) {
    out.push(WORDS[Math.floor(rng() * WORDS.length)]);
    out.push(rng() < 0.1 ? '.\n' : ' ');
  }
  return out.join('');
}

function applyEdits(rng, text, editCount) {
  const words = text.split(' ');
  for (let e = 0; e < editCount; e++) {
    const pos = Math.floor(rng() * words.length);
    const op = rng();
    if (op < 0.34) words.splice(pos, 1);
    else if (op < 0.67) words.splice(pos, 0, 'EDITED' + e);
    else words[pos] = 'CHANGED' + e;
  }
  return words.join(' ');
}

async function measure(fn, runs) {
  const times = [];
  await fn(); // warmup
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((x, y) => x - y);
  return times[Math.floor(times.length / 2)];
}

const rng = makeRng(20260828);
const scenarios = [];

{
  const base = makeText(rng, 8000);
  scenarios.push({
    name: 'large text (~44 KB), 10 small edits',
    a: base,
    b: applyEdits(rng, base, 10),
    legacyRuns: 3,
    newRuns: 50,
  });
}
{
  const base = makeText(rng, 8000);
  scenarios.push({
    name: 'large text (~44 KB), 100 scattered edits',
    a: base,
    b: applyEdits(rng, base, 100),
    legacyRuns: 3,
    newRuns: 20,
  });
}
{
  const base = makeText(rng, 8000);
  const mid = Math.floor(base.length / 2);
  scenarios.push({
    name: 'large text (~44 KB), one clustered edit',
    a: base,
    b: base.slice(0, mid) + ' REPLACED SECTION HERE ' + base.slice(mid + 40),
    legacyRuns: 3,
    newRuns: 100,
  });
}
{
  scenarios.push({
    name: 'completely different medium text (~8 KB)',
    a: makeText(rng, 1500),
    b: makeText(makeRng(999), 1500),
    legacyRuns: 3,
    newRuns: 10,
  });
}

console.log(`node ${process.version}\n`);
console.log('| scenario | legacy Hirschberg LCS | Myers (this package) | speedup |');
console.log('|---|---|---|---|');
for (const s of scenarios) {
  const legacyMs = await measure(() => legacyDiff(splitIntoTokens(s.a), splitIntoTokens(s.b)), s.legacyRuns);
  const myersMs = await measure(() => diff(s.a, s.b), s.newRuns);
  const speedup = legacyMs / myersMs;
  const speedupLabel = speedup >= 10 ? speedup.toFixed(0) : speedup.toFixed(1);
  console.log(`| ${s.name} | ${legacyMs.toFixed(1)} ms | ${myersMs.toFixed(2)} ms | **${speedupLabel}×** |`);
}
