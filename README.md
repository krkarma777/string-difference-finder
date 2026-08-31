# @krkarma777/string-diff

[![npm version](https://img.shields.io/npm/v/%40krkarma777%2Fstring-diff)](https://www.npmjs.com/package/@krkarma777/string-diff)
[![CI](https://img.shields.io/github/actions/workflow/status/krkarma777/string-diff/ci.yml?branch=master&label=CI)](https://github.com/krkarma777/string-diff/actions/workflows/ci.yml)
[![weekly downloads](https://img.shields.io/npm/dw/%40krkarma777%2Fstring-diff)](https://www.npmjs.com/package/@krkarma777/string-diff)
[![total downloads](https://badgen.net/npm/dt/@krkarma777/string-diff?label=total%20downloads)](https://npm-stat.com/charts.html?package=%40krkarma777%2Fstring-diff)
[![minzipped size](https://img.shields.io/badge/min%2Bgzip-2.9%20kB-blue)](#how-it-works)
[![dependencies](https://img.shields.io/badge/dependencies-0-blue)](package.json)
[![types](https://img.shields.io/badge/types-included-blue)](dist/index.d.ts)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Fast **text diff** and **string comparison** library for JavaScript and TypeScript. Compare two strings by **word, character, or line** and get the guaranteed-shortest edit script (`equal` / `insert` / `delete`), powered by **Myers' O(ND) algorithm** on typed arrays. Zero dependencies, Unicode-safe (Korean, CJK, emoji), ~2.9 KB min+gzip in the browser.

Use it for text comparison UIs, document revision history, editor change tracking, test output diffing, or anywhere you need to highlight the difference between two strings — in Node.js or any browser. **[Try the live demo.](https://krkarma777.github.io/string-diff/)**

## Features

- **Shortest edit script, guaranteed** — the exact Myers algorithm with the linear-space divide-and-conquer refinement (the same family git uses). No heuristic cutoffs; output is verified optimal against a reference DP in the test suite.
- **Extreme constant-factor tuning** — every token is interned to an integer once, so the hot loops compare `Int32Array` elements instead of strings; search state lives in two preallocated typed-array scratch buffers reused across the whole recursion (zero GC pressure); common prefixes/suffixes are stripped in O(N).
- **Unicode-aware tokenization** — `word` mode splits on Unicode letter/digit properties, so Korean, Japanese, and other non-ASCII scripts diff by word instead of collapsing into one opaque blob. `char` mode is code-point safe (no surrogate splitting).
- **Fully synchronous, zero dependencies** — no worker gymnastics, no async overhead. ~2.9 KB min+gzip browser bundle.

## Install

```sh
npm install @krkarma777/string-diff
```

## Usage

```ts
import { diff } from '@krkarma777/string-diff';

diff('the quick fox', 'the slow fox');
// [
//   { operation: 'equal',  text: 'the ' },
//   { operation: 'delete', text: 'quick' },
//   { operation: 'insert', text: 'slow' },
//   { operation: 'equal',  text: ' fox' },
// ]

diff('안녕하세요 세계', '안녕하세요 지구');
// [
//   { operation: 'equal',  text: '안녕하세요 ' },
//   { operation: 'delete', text: '세계' },
//   { operation: 'insert', text: '지구' },
// ]
```

CommonJS works too:

```js
const { diff } = require('@krkarma777/string-diff');
```

Browser (IIFE bundle, global `StringDiff`):

```html
<script src="https://unpkg.com/@krkarma777/string-diff/dist/string-diff.min.js"></script>
<script>
  StringDiff.diff('a b c', 'a x c');
</script>
```

## API

### `diff(a, b, options?)`

Returns `DiffEntry[]` — the shortest edit script between `a` and `b`.

| option | type | default | description |
|---|---|---|---|
| `mode` | `'word' \| 'char' \| 'line' \| 'intl-word' \| 'grapheme'` | `'word'` | tokenization granularity |
| `locale` | `string \| string[]` | runtime locale | BCP 47 locale(s) for the `Intl.Segmenter` modes |
| `refine` | `boolean` | `false` | re-diff each delete/insert pair one level finer (`line`→word, `word`→char), e.g. `quick`→`quicker` reports just `+er` |
| `heuristic` | `boolean` | `false` | cap the search cost like git does, keeping pathological inputs fast (the 227 ms worst case below drops to ~8 ms, +8% edit-script size); output stays identical to exact mode while the edit distance is small |

- `word` — runs of Unicode letters/digits/underscore, whitespace runs, symbol runs
- `char` — individual code points (surrogate-pair safe)
- `line` — lines with their terminators attached
- `intl-word` — locale-aware words via `Intl.Segmenter`: splits unspaced scripts (Japanese, Chinese, Thai) that `word` mode sees as one token

  ```ts
  diff('私は猫が好きです', '私は犬が好きです', { mode: 'intl-word', locale: 'ja' });
  // equal '私は' · delete '猫' · insert '犬' · equal 'が好きです'
  ```

- `grapheme` — grapheme clusters via `Intl.Segmenter`: ZWJ emoji (👨‍👩‍👧) and combining sequences stay whole where `char` mode would split code points

The `Intl.Segmenter` modes are opt-in because they're slower than the scanner modes; they throw a clear `TypeError` on runtimes without `Intl.Segmenter` (Node < 16, older browsers).

### `diffRanges(a, b, options?)`

The same diff as offset tuples instead of text entries — for editors, highlighters, and anyone who wants to slice the originals themselves. Each `[aStart, aEnd, bStart, bEnd]` says `a[aStart, aEnd)` was replaced by `b[bStart, bEnd)` (either side may be empty for pure insertions/deletions; offsets are UTF-16 code units).

```ts
diffRanges('the quick fox', 'the slow fox');
// [[4, 9, 4, 8]]  — "quick" → "slow"
```

### `diffTokens(aTokens, bTokens, options?)`

Lower-level API: diff two pre-tokenized `string[]` sequences with any tokenization you like (`options.heuristic` supported).

### `tokenize(text, mode?)`

The built-in tokenizer, exported for reuse.

### `DiffEntry`

```ts
interface DiffEntry {
  operation: 'equal' | 'insert' | 'delete';
  text: string;
}
```

Within a changed region, `delete` always precedes `insert`, and adjacent tokens with the same operation are merged into a single entry. Concatenating all non-`insert` texts reproduces `a`; all non-`delete` texts reproduce `b`.

## Benchmarks

Against the popular npm diff libraries — [`diff` (jsdiff)](https://www.npmjs.com/package/diff) v9.0.0, [`diff-match-patch`](https://www.npmjs.com/package/diff-match-patch) v1.0.5, and [`fast-myers-diff`](https://www.npmjs.com/package/fast-myers-diff) v3.2.0 — each driven through its own idiomatic API, timed end-to-end from raw strings (`npm run bench`, Node v24, Apple Silicon, median of repeated runs; ratios are relative to this package):

| scenario | string-diff | jsdiff | diff-match-patch (default) | diff-match-patch (exact) | fast-myers-diff |
|---|---|---|---|---|---|
| word diff, 44 KB text, 10 edits | **0.97 ms** | 0.89 ms (0.9×) | — | — | 0.84 ms (0.9×) |
| char diff, 44 KB text, 10 edits | **0.62 ms** | 1.38 ms (2.2×) | 0.34 ms (0.5×) | 0.31 ms (0.5×) | 2.23 ms (3.6×) |
| line diff, 44 KB text, 10 changed lines | **0.27 ms** | 0.14 ms (0.5×) | — | — | 0.25 ms (1.0×) |
| char diff, ~8 KB completely different (worst case) | **233 ms** | 2,360 ms (10.1×) | 727 ms (3.1×) | 664 ms (2.9×) | 603 ms (2.6×) |

How to read this honestly:

- **On typical inputs every library here is sub-millisecond-ish** — the differences are fractions of a millisecond and won't matter to most applications.
- **The worst case is where libraries separate**, and it's the row that decides whether your UI freezes on pathological input: this package is 2.6–10× faster than everything tested, while still returning a provably minimal diff. If you'd rather trade minimality for speed there, `{ heuristic: true }` brings that row to ~8 ms (edit script ~8% larger) — still exact whenever the edit distance is small.
- `diff-match-patch` (default) trades exactness for speed by design — its documented timeout heuristics can return non-minimal diffs. This package never does.
- `fast-myers-diff` has no tokenizer and emits index ranges rather than text entries, so its rows do less output work (word/line rows reuse our tokenizer); `diff-match-patch` has no built-in word or line API.

Notes for fairness are in [`bench/compare.mjs`](bench/compare.mjs). For history: versus the Hirschberg LCS implementation this repository originally shipped, typical scenarios are **~1,000× faster** (`npm run bench:legacy`).

## How it works

1. **Scan, don't tokenize**: one pass over each input records token boundary offsets and a per-token FNV-1a hash (`word`: Unicode-property class runs, `line`: terminator-attached lines, `char`: the code point itself is the id) — no token substrings are ever materialized.
2. **Strip** the common token prefix/suffix, filtering with integer hash comparisons, so a localized edit in a large document skips nearly all downstream work.
3. **Intern** the remaining tokens into dense integer ids with an open-addressed hash table that reads characters straight out of the originals — the entire search then runs over two `Int32Array`s, never touching strings.
4. **Myers middle-snake search**: forward and backward D-paths meet in the middle, recursing on the two halves — O((N+M)·D) time, O(N+M) space, with both direction-state arrays allocated exactly once.
5. **Rebuild** merged `equal`/`delete`/`insert` entries from the changed-token flags; every output text is a single `slice` of the original input.

## Demo

Hosted: **[krkarma777.github.io/string-diff](https://krkarma777.github.io/string-diff/)** (deployed from `master` by CI).

Locally:

```sh
npm run demo
open demo/index.html
```

## Development

```sh
npm test              # node:test — unit + 1,100 fuzz round-trips + 300 optimality checks
npm run typecheck
npm run build         # tsup → ESM + CJS + IIFE + .d.ts
npm run bench         # vs jsdiff / diff-match-patch / fast-myers-diff (build first)
npm run bench:legacy  # vs the original Hirschberg LCS implementation
```

## Contributing

Issues and pull requests are welcome. Please run `npm run typecheck && npm test` before opening a PR — the suite includes fuzz round-trips and optimality checks against a reference implementation, so a passing run is a strong signal the change is safe.

## References

- Myers, E. W. — [An O(ND) Difference Algorithm and Its Variations](http://www.xmailserver.org/diff2.pdf) (1986)
- Hunt & McIlroy — [An Algorithm for Differential File Comparison](https://www.cs.dartmouth.edu/~doug/diff.pdf)
- Neil Fraser — [Diff Strategies](https://neil.fraser.name/writing/diff/)
- Google — [diff-match-patch](https://github.com/google/diff-match-patch)

## License

[MIT](LICENSE)
