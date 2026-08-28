# @krkarma777/string-diff

Blazing-fast text diff powered by **Myers' O(ND) algorithm** with token interning and typed arrays. Zero dependencies, TypeScript-first, works in Node and browsers.

Compared to the naive LCS dynamic-programming approach this repo used to ship, typical diffs are **~1,000× faster** (see [benchmarks](#benchmarks)) — because Myers' algorithm scales with the *size of the change* (D), not the size of the inputs.

## Features

- **Shortest edit script, guaranteed** — the exact Myers algorithm with the linear-space divide-and-conquer refinement (the same family git uses). No heuristic cutoffs; output is verified optimal against a reference DP in the test suite.
- **Extreme constant-factor tuning** — every token is interned to an integer once, so the hot loops compare `Int32Array` elements instead of strings; search state lives in two preallocated typed-array scratch buffers reused across the whole recursion (zero GC pressure); common prefixes/suffixes are stripped in O(N).
- **Unicode-aware tokenization** — `word` mode splits on Unicode letter/digit properties, so Korean, Japanese, and other non-ASCII scripts diff by word instead of collapsing into one opaque blob. `char` mode is code-point safe (no surrogate splitting).
- **Fully synchronous, zero dependencies** — no worker gymnastics, no async overhead, ~4.7 KB ESM before gzip.

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
| `mode` | `'word' \| 'char' \| 'line'` | `'word'` | tokenization granularity |

- `word` — runs of Unicode letters/digits/underscore, whitespace runs, symbol runs
- `char` — individual code points (surrogate-pair safe)
- `line` — lines with their terminators attached

### `diffTokens(aTokens, bTokens)`

Lower-level API: diff two pre-tokenized `string[]` sequences with any tokenization you like.

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

Versus the Hirschberg LCS implementation this repository previously shipped (`node bench/bench.mjs`, Node v24, Apple Silicon; both pipelines timed end-to-end from raw strings, tokenization included):

| scenario | legacy Hirschberg LCS | Myers (this package) | speedup |
|---|---|---|---|
| large text (~44 KB), 10 small edits | 1,075.8 ms | 1.04 ms | **1,038×** |
| large text (~44 KB), 100 scattered edits | 1,213.2 ms | 1.23 ms | **989×** |
| large text (~44 KB), one clustered edit | 0.7 ms | 0.52 ms | **1.3×** |
| completely different medium text (~8 KB) | 53.6 ms | 26.9 ms | **2.0×** |

Why the gap: LCS dynamic programming always fills an N×M table — ~300 million cells for the first scenario — no matter how similar the inputs are. Myers explores O((N+M)·D) states, where D is the number of edits, so a 10-word change in a 44 KB document stays in the microsecond-to-millisecond range. The last row is Myers' honest worst case (D ≈ N+M): still ahead, but only just — if you routinely diff completely unrelated inputs, no shortest-edit-script algorithm will save you.

## How it works

1. **Tokenize** the inputs (`word`, `char`, or `line`).
2. **Strip** the common token prefix/suffix in O(N) *before* anything else, so a localized edit in a large document skips nearly all downstream work.
3. **Intern** the remaining tokens into dense integer ids — the entire search then runs over two `Int32Array`s, never touching strings. (`char` mode skips tokens and interning entirely: it scans code points straight into an `Int32Array` — the code point *is* the id — and every output text is a single slice of the original input.)
4. **Myers middle-snake search**: forward and backward D-paths meet in the middle, recursing on the two halves — O((N+M)·D) time, O(N+M) space, with both direction-state arrays allocated exactly once.
5. **Rebuild** merged `equal`/`delete`/`insert` entries from the changed-token flags.

## Demo

```sh
npm run build
open demo/index.html
```

## Development

```sh
npm test          # node:test — unit + 1,100 fuzz round-trips + 300 optimality checks
npm run typecheck
npm run build     # tsup → ESM + CJS + IIFE + .d.ts
npm run bench     # requires npm run build first
```

## References

- Myers, E. W. — [An O(ND) Difference Algorithm and Its Variations](http://www.xmailserver.org/diff2.pdf) (1986)
- Hunt & McIlroy — [An Algorithm for Differential File Comparison](https://www.cs.dartmouth.edu/~doug/diff.pdf)
- Neil Fraser — [Diff Strategies](https://neil.fraser.name/writing/diff/)
- Google — [diff-match-patch](https://github.com/google/diff-match-patch)

## License

[MIT](LICENSE)
