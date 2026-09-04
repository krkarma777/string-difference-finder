# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- The hosted demo now exposes every v1.2 diff mode and option, restores comparisons from shareable URL hashes, and reports entry and changed-range counts alongside timing.

### Changed
- Shared demo comparisons over 16,000 combined input code units now wait for an explicit Compare click instead of running automatically.

## [1.2.0] - 2026-08-31

### Added
- Coverage gate in CI (c8, ~99% measured, floors enforced) and a
  performance smoke check guarding the hot paths against gross
  regressions. (#20)
- `intl-word` and `grapheme` modes via `Intl.Segmenter` (with a `locale`
  option): locale-aware word diffs for unspaced scripts (Japanese, Chinese,
  Thai) and cluster-safe character diffs (ZWJ emoji, combining sequences).
  `refine` drops `intl-word` pairs to grapheme granularity. (#15)
- `ignoreCase` and `ignoreWhitespace` options on `diff` and `diffTokens`:
  masked differences compare equal, with `equal` texts taken from `b` so
  non-delete concatenation always reproduces `b`. In `line` mode
  `ignoreWhitespace` compares trimmed lines; elsewhere whitespace runs
  match each other but presence still matters. (#16)

## [1.1.0] - 2026-08-31

### Added
- `diffRanges(a, b, options?)`: the diff as `[aStart, aEnd, bStart, bEnd]`
  code-unit offset tuples instead of text entries, for editors and
  highlighters that slice the originals themselves.
- Hosted demo at <https://krkarma777.github.io/string-diff/>,
  deployed from `master` by CI, with controls for the new options.
- `heuristic` option: caps the search cost per subproblem (the git xdiff
  strategy) so pathological inputs stay fast — the 8 KB completely-different
  worst case drops from ~217 ms to ~8 ms for an edit script ~8% above
  minimal. Output is identical to exact mode while the edit distance is
  under the cap. Also accepted by `diffTokens` via a new options argument.
- `refine` option: re-diffs each delete/insert pair one granularity finer
  (`line` pairs by word, `word` pairs by char), so `quick` → `quicker`
  reports the shared prefix as equal and just `+er` as the change.
- CI workflow: full test suite on Node 24 plus a compatibility matrix that
  smoke-tests the built ESM/CJS output on Node 16/18/20/22, backing the
  `engines: >=16` claim with an actual run.
- Release workflow publishing to npm via trusted publishing (OIDC) with
  provenance attestation.

## [1.0.1] - 2026-08-28

### Changed
- Word/line modes now use a fused scan pipeline: token boundaries and
  FNV-1a hashes are collected in one pass, interning runs through an
  open-addressed table reading straight out of the input strings, and every
  output text is a single slice — no token substrings are materialized.
- `char` mode bypasses tokenization entirely (code point scan straight into
  typed arrays, surrogate-pair-safe boundary handling).
- Common token prefix/suffix is stripped before interning.

### Performance
- Word diff on a 44 KB / 10-edit document: 1.24 ms → 0.97 ms.
- Char diff on the same document: 1.63 ms → 0.62 ms.
- Line diff: 0.33 ms → 0.27 ms.

### Documentation
- README benchmarks now compare against jsdiff, diff-match-patch, and
  fast-myers-diff end-to-end (`npm run bench`), with fairness caveats.
- npm search metadata: rewritten description and expanded keywords.

## [1.0.0] - 2026-08-28

### Added
- Initial release: Myers O(ND) shortest-edit-script diff with the
  linear-space middle-snake refinement, token interning to `Int32Array`,
  reusable scratch buffers, and Unicode-aware word/char/line tokenization.
- `diff(a, b, { mode })`, `diffTokens(aTokens, bTokens)`, and `tokenize`
  public API; ESM + CJS + browser IIFE builds with bundled type definitions.
- Verification suite: seeded fuzz round-trips and optimality checks against
  a reference LCS dynamic program.
