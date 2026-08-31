// Guards against gross performance regressions in CI. Ceilings are set
// 50-100x above the measured medians (typical ~1 ms, heuristic worst ~8 ms,
// exact worst ~230 ms on Apple Silicon) so noisy shared runners stay green
// while an accidental complexity or allocation regression still fails.
import { performance } from 'node:perf_hooks';
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

function median(fn, runs) {
  fn();
  const times = [];
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const rng = makeRng(20260828);
const base = makeText(rng, 8000);
const edited = applyEdits(rng, base, 10);
const wcA = makeText(rng, 1500);
const wcB = makeText(makeRng(999), 1500);

const checks = [
  { name: 'word diff, 44KB, 10 edits', ceilingMs: 50, run: () => diff(base, edited), runs: 10 },
  { name: 'char diff, 44KB, 10 edits', ceilingMs: 50, run: () => diff(base, edited, { mode: 'char' }), runs: 10 },
  { name: 'heuristic worst case, 8KB char', ceilingMs: 1000, run: () => diff(wcA, wcB, { mode: 'char', heuristic: true }), runs: 5 },
  { name: 'exact worst case, 8KB char', ceilingMs: 5000, run: () => diff(wcA, wcB, { mode: 'char' }), runs: 2 },
];

let failed = false;
for (const check of checks) {
  const ms = median(check.run, check.runs);
  const ok = ms <= check.ceilingMs;
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${check.name}: ${ms.toFixed(2)} ms (ceiling ${check.ceilingMs} ms)`);
}
if (failed) {
  console.error('perf smoke failed: at least one scenario exceeded its ceiling');
  process.exit(1);
}
