# Adoption Readiness Design

**Date:** 2026-09-04  
**Status:** Awaiting written-spec review  
**Repository:** `@krkarma777/string-diff`

## Decision

Prepare the repository for external users, bring the hosted demo to feature parity with v1.2.0, and add adoption-oriented documentation as three independently reviewable changes.

The work is intentionally sequenced as:

1. Repository readiness
2. Demo state and feature parity
3. Adoption documentation

Semantic cleanup, unified patch output, algorithm research, external community posting, and a visual redesign are outside this design.

## Goals

- Stop generated coverage artifacts from changing the working tree.
- Give contributors precise setup, testing, benchmarking, issue, and pull-request guidance.
- Expose every public v1.2.0 diff mode and option in the hosted demo.
- Make a demo comparison reproducible through a shareable URL hash.
- Show useful output statistics without running the diff algorithm twice.
- Explain the package's positioning with reproducible, qualified performance claims.
- Provide prefilled live examples for Korean, Japanese, emoji, and whitespace handling.

## Global Constraints

- Keep the package and demo at zero runtime dependencies.
- Preserve Node.js 16 compatibility for the published library.
- Preserve direct `file://` execution of `demo/index.html` after `npm run demo`.
- Keep the existing unified inline diff result; side-by-side rendering is deferred.
- Keep the existing dark visual direction; this work adds controls and hierarchy without redesigning the page.
- Do not change the public library API in this work.
- Do not publish externally or implement issue #17 as part of these changes.

## Change 1: Repository Readiness

### Files

- Modify `.gitignore`.
- Remove tracked `coverage/tmp/*.json` files.
- Create `CONTRIBUTING.md`.
- Create `.github/ISSUE_TEMPLATE/bug_report.md`.
- Create `.github/ISSUE_TEMPLATE/feature_request.md`.
- Create `.github/pull_request_template.md`.

### Coverage hygiene

Add `coverage/` to `.gitignore` and remove all currently tracked c8 temporary JSON files. The verification command is `npm run test:coverage`, followed by `git status --short -- coverage`; the second command must return no coverage changes.

### Contribution guide

`CONTRIBUTING.md` will document:

- Node.js 24 for source tests and the existing Node 16/18/20/22 built-output compatibility checks.
- `npm ci` setup.
- The required local gate: `npm run typecheck`, `npm test`, and `npm run build`.
- The TDD expectation for behavior changes.
- The role of fuzz, optimality, oracle, and round-trip tests.
- `npm run bench` and `npm run perf:smoke` for performance-related work.
- A requirement to update `CHANGELOG.md` for user-visible changes.

### Templates

The bug template requests package/runtime versions, both input strings, the complete options object, expected entries, actual entries, and a minimal reproduction.

The feature template starts with the user problem and use case. An API proposal is optional. It also asks about alternatives and bundle/performance implications.

The pull-request template mirrors CI and asks authors to confirm type checking, tests, build output, performance measurements when relevant, and a changelog entry when relevant.

## Change 2: Demo State and Feature Parity

### File responsibilities

Create `demo/state.js` as a classic browser script with no imports. It exposes one global object, `StringDiffDemoState`, so the same file works from GitHub Pages and a local `file://` URL.

`demo/state.js` owns only pure state behavior:

```js
StringDiffDemoState.encodeState(state) // returns a hash payload without '#'
StringDiffDemoState.decodeState(hash) // returns a validated DemoState
StringDiffDemoState.summarizeEntries(entries) // returns DemoStats
StringDiffDemoState.DEFAULT_STATE
```

`demo/index.html` owns DOM lookup, control enablement, calls to `StringDiff.diff`, rendering, URL replacement, and visible errors.

### State model

```ts
type DemoMode = 'word' | 'char' | 'line' | 'intl-word' | 'grapheme';

interface DemoState {
  a: string;
  b: string;
  mode: DemoMode;
  locale: string;
  refine: boolean;
  heuristic: boolean;
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
}

interface DemoStats {
  entryCount: number;
  changedEntryCount: number;
  rangeCount: number;
}
```

The default input strings remain the current demo samples. The default mode is `word`; locale is empty; every boolean option is false.

### URL format

The hash payload uses `URLSearchParams`:

```text
#a=<original>&b=<changed>&mode=<mode>&locale=<locale>&refine=1&heuristic=1&ignoreCase=1&ignoreWhitespace=1
```

`a`, `b`, and `mode` are always encoded. Empty locale and false booleans are omitted. This keeps links deterministic and compact while preserving Unicode, emoji, whitespace, and line breaks.

Decoding applies an allowlist to `mode`. Missing or unknown modes use `word`. A boolean is true only when its value is exactly `1`; missing or malformed values are false. Missing string parameters use the current demo defaults, while explicitly encoded empty `a` or `b` values remain empty.

### Interaction flow

With no hash, the page shows the current sample inputs and waits for Compare.

With a non-empty hash:

1. Decode and validate state.
2. Populate every control.
3. Enable locale only for `intl-word` and `grapheme`.
4. Run the comparison automatically.
5. Render the entries, elapsed time, and statistics.

When the user presses Compare:

1. Read state from the controls.
2. Call `StringDiff.diff(a, b, options)` once and measure only that call.
3. Calculate statistics from the returned entries.
4. Render the result and statistics.
5. Replace the current hash with `history.replaceState` only after success. Use a same-document hash and fall back to assigning `location.hash` if a `file://` browser rejects `replaceState`.

Changing the mode immediately updates locale enablement but does not run a comparison.

### Statistics

- `entryCount` is the complete entry array length.
- `changedEntryCount` counts insert and delete entries.
- `rangeCount` counts contiguous changed regions separated by equal entries. An adjacent delete/insert replacement is one range.

The range count is derived from existing entries, so statistics do not alter timing or repeat the diff.

### UI

Keep the current dark palette and typography. Reorganize controls into two wrapping groups:

- Primary controls: Compare, mode, locale.
- Options: refine, heuristic, ignore case, ignore whitespace.

Place elapsed time, entry count, and range count in a compact status row above the result. Mark the status row with `aria-live="polite"` and the error region with `role="alert"`. At narrow widths, inputs and control groups stack vertically.

The first demo increment excludes side-by-side output, the large-input benchmark button, and a broad visual restyle.

### Error handling

Treat the hash as untrusted input. Invalid values fall back to defaults as defined above.

Wrap the library call in `try/catch`. On error, clear stale entries and statistics, then show the error's message in the alert region. Do not replace the hash when the comparison fails. This covers unsupported `Intl.Segmenter` runtimes and invalid locale identifiers without introducing special-case branches.

### Automated tests

Create `test/demo-state.test.ts`. It executes the real `demo/state.js` in a Node `vm` context and verifies:

- Default decoding.
- Full state encode/decode round-trip.
- Korean, Japanese, emoji, whitespace, and multiline round-trip.
- Unknown mode and malformed boolean fallback.
- Empty, equal-only, insertion, deletion, replacement, and separated-change statistics.

Create `test/demo-contract.test.ts`. It reads the real HTML and verifies the presence of the five mode values, locale control, four option controls, status and error regions, the state script, and all options passed to `StringDiff.diff`.

The tests use the existing `node:test` toolchain and add no dependency.

### Manual verification

- Run the demo from a local `file://` URL.
- Exercise every mode and option.
- Copy a generated URL into a new tab and confirm identical inputs, controls, and output.
- Verify the layout at desktop width and below 640 px.
- Verify an invalid locale shows an error and does not leave stale output.

## Change 3: Adoption Documentation

### Positioning section

Add a short `Why another diff library?` section to `README.md`. It will describe:

- Exact shortest-edit-script output by default.
- The explicit `heuristic` escape hatch for pathological input.
- Unicode-aware scanner and `Intl.Segmenter` modes.
- Text-entry and offset-range output APIs.
- Zero runtime dependencies and the measured package size.

Performance language must remain scoped to the repository's named benchmark scenarios. The section links to `npm run bench` and `bench/compare.mjs` so every number is reproducible. It does not claim universal superiority.

### Runnable examples

Add prefilled hosted-demo links for:

- Korean word replacement.
- Japanese `intl-word` replacement with `locale=ja`.
- Family emoji replacement in `grapheme` mode.
- Case and whitespace comparison using both ignore options.

These links reuse the URL hash format from Change 2, so no third-party sandbox or account is required. External community posting remains a follow-up activity after deployment.

### Release behavior

These changes do not alter the published library API and do not require an npm version bump. Merging the demo change to `master` triggers the existing GitHub Pages deployment.

## Verification Gate

Before declaring the work complete, run:

```sh
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run perf:smoke
git status --short -- coverage
```

Also inspect the built demo in a browser and verify the URL round-trip manually. No completion claim is made if any automated command fails, if coverage artifacts reappear in Git status, or if the browser checks fail.

## PR Boundaries

Each change is reviewable and reversible on its own:

1. `chore: prepare repository for contributors`
2. `feat: add shareable v1.2 demo controls`
3. `docs: add adoption guide and live examples`

The implementation plan must preserve these boundaries even when all changes are prepared in one local working session.
