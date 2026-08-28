// Benchmark against popular npm diff libraries, end-to-end from raw strings.
// Usage: npm run build && node bench/compare.mjs
//
// Compared libraries (each driven through its own idiomatic API):
//   - diff (jsdiff): diffWordsWithSpace / diffChars / diffLines
//   - diff-match-patch: diff_main, both default (1s timeout heuristics, may
//     return non-minimal scripts) and exact (Diff_Timeout = 0)
//   - fast-myers-diff: diff() consumed to completion; word row receives our
//     tokenizer's output since it has no tokenizer of its own
//
// Caveats, in fairness to the others:
//   - diff-match-patch has no built-in word mode, so word rows omit it
//   - fast-myers-diff emits index ranges rather than text entries, so it
//     does less output work than everyone else
//   - jsdiff and fast-myers-diff char rows operate on UTF-16 code units,
//     ours on full code points (surrogate-pair safe)
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { diff, tokenize } from '../dist/index.js';

const require = createRequire(import.meta.url);
const jsdiff = require('diff');
const fmd = require('fast-myers-diff');
const DMP = require('diff-match-patch');

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

function editLines(rng, text, editCount) {
  const lines = text.split('\n');
  for (let e = 0; e < editCount; e++) {
    const pos = Math.floor(rng() * lines.length);
    lines[pos] = 'CHANGED LINE ' + e;
  }
  return lines.join('\n');
}

function measure(fn, runs) {
  fn(); // warmup
  const times = [];
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function fmt(ms) {
  return ms >= 100 ? ms.toFixed(0) + ' ms' : ms >= 10 ? ms.toFixed(1) + ' ms' : ms.toFixed(2) + ' ms';
}

const versions = {
  self: require('../package.json').version,
  jsdiff: require('diff/package.json').version,
  dmp: require('diff-match-patch/package.json').version,
  fmd: require('fast-myers-diff/package.json').version,
};

const rng = makeRng(20260828);
const base = makeText(rng, 8000);
const edited = applyEdits(rng, base, 10);
const wcA = makeText(rng, 1500);
const wcB = makeText(makeRng(999), 1500);
const linesA = makeText(rng, 8000);
const linesB = editLines(rng, linesA, 10);

const dmpExact = new DMP();
dmpExact.Diff_Timeout = 0;
const dmpDefault = new DMP();

const consume = iterable => { for (const _ of iterable) { /* drain */ } };

console.log(`node ${process.version} | string-diff ${versions.self} vs diff(jsdiff) ${versions.jsdiff}, diff-match-patch ${versions.dmp}, fast-myers-diff ${versions.fmd}\n`);

const rows = [
  {
    name: `word diff, 44 KB text, 10 edits`,
    runs: 30,
    candidates: {
      self: () => diff(base, edited),
      jsdiff: () => jsdiff.diffWordsWithSpace(base, edited),
      dmpDefault: null,
      dmpExact: null,
      fmd: () => consume(fmd.diff(tokenize(base), tokenize(edited))),
    },
  },
  {
    name: `char diff, 44 KB text, 10 edits`,
    runs: 30,
    candidates: {
      self: () => diff(base, edited, { mode: 'char' }),
      jsdiff: () => jsdiff.diffChars(base, edited),
      dmpDefault: () => dmpDefault.diff_main(base, edited),
      dmpExact: () => dmpExact.diff_main(base, edited),
      fmd: () => consume(fmd.diff(base, edited)),
    },
  },
  {
    name: `line diff, 44 KB text, 10 changed lines`,
    runs: 30,
    candidates: {
      self: () => diff(linesA, linesB, { mode: 'line' }),
      jsdiff: () => jsdiff.diffLines(linesA, linesB),
      dmpDefault: null,
      dmpExact: null,
      fmd: () => consume(fmd.diff(tokenize(linesA, 'line'), tokenize(linesB, 'line'))),
    },
  },
  {
    name: `char diff, ~8 KB completely different (worst case)`,
    runs: 5,
    candidates: {
      self: () => diff(wcA, wcB, { mode: 'char' }),
      jsdiff: () => jsdiff.diffChars(wcA, wcB),
      dmpDefault: () => dmpDefault.diff_main(wcA, wcB),
      dmpExact: () => dmpExact.diff_main(wcA, wcB),
      fmd: () => consume(fmd.diff(wcA, wcB)),
    },
  },
];

console.log('| scenario | string-diff | jsdiff | diff-match-patch (default) | diff-match-patch (exact) | fast-myers-diff |');
console.log('|---|---|---|---|---|---|');
for (const row of rows) {
  const cells = [];
  let selfMs = 0;
  for (const key of ['self', 'jsdiff', 'dmpDefault', 'dmpExact', 'fmd']) {
    const fn = row.candidates[key];
    if (fn === null) {
      cells.push('—');
      continue;
    }
    const ms = measure(fn, row.runs);
    if (key === 'self') selfMs = ms;
    cells.push(key === 'self' ? `**${fmt(ms)}**` : `${fmt(ms)} (${(ms / selfMs).toFixed(1)}×)`);
  }
  console.log(`| ${row.name} | ${cells.join(' | ')} |`);
}
