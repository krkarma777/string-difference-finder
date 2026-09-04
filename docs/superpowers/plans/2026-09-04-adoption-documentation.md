# Adoption Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain the library's evidence-backed positioning and provide four verified, prefilled hosted-demo examples that exercise its Unicode and ignore-option strengths.

**Architecture:** `README.md` remains the single adoption surface. A small Node test treats the example URLs as executable documentation by parsing their hash payloads through the production `demo/state.js` codec, preventing the links from drifting from the demo contract.

**Tech Stack:** Markdown, hosted GitHub Pages demo URLs, Node.js `node:test`, Node.js `node:vm`

## Global Constraints

- Keep the package and demo at zero runtime dependencies.
- Preserve Node.js 16 compatibility for the published library.
- Preserve direct `file://` execution of `demo/index.html` after `npm run demo`.
- Keep the existing unified inline diff result; side-by-side rendering is deferred.
- Keep the existing dark visual direction; this work adds controls and hierarchy without redesigning the page.
- Do not change the public library API in this work.
- Do not publish externally or implement issue #17 as part of these changes.

## PR Boundary

- Suggested branch: `docs/adoption-guide`
- PR title: `docs: add adoption guide and live examples`
- Base: the merged shareable-demo change

---

### Task 1: Add the evidence-backed positioning section

**Files:**
- Modify: `README.md:12-25`
- Modify: `README.md:236-240`

**Interfaces:**
- Consumes: the benchmark data already documented in `README.md`, the commands in `package.json`, and the contribution guide from the repository-readiness change.
- Produces: an accurate overview of the library's explicit correctness/performance trade-off and a direct contributor-guide link.

- [ ] **Step 1: Run a failing content contract**

Run:

```sh
node -e "const s=require('node:fs').readFileSync('README.md','utf8'); for(const x of ['## Why another diff library?','Exact by default','Explicit escape hatch','Unicode-aware boundaries','UI-ready output','[contribution guide](CONTRIBUTING.md)']) if(!s.includes(x)) throw new Error('missing: '+x)"
```

Expected: FAIL with `missing: ## Why another diff library?`.

- [ ] **Step 2: Correct the opening summary and Unicode feature description**

Replace the opening paragraph with:

```markdown
Fast **text diff** and **string comparison** library for JavaScript and TypeScript. Compare two strings by **word, character, line, locale-aware word, or grapheme** and get an exact shortest edit script (`equal` / `insert` / `delete`), powered by **Myers' O(ND) algorithm** on typed arrays. Zero dependencies, Unicode-safe (Korean, CJK, emoji), ~2.9 KB min+gzip in the browser.
```

Replace the existing Unicode feature bullet with these two bullets:

```markdown
- **Unicode-aware boundaries** — `word` mode recognizes Unicode letter and digit runs, while opt-in `intl-word` mode uses `Intl.Segmenter` for unspaced scripts such as Japanese, Chinese, and Thai.
- **Grapheme-safe output** — `char` mode is code-point safe, and opt-in `grapheme` mode keeps ZWJ emoji and combining sequences together.
```

- [ ] **Step 3: Add the positioning section after Features**

Insert this section immediately before `## Install`:

```markdown
## Why another diff library?

This package is for applications that need predictable correctness without giving up a controlled response to pathological input:

- **Exact by default** — the normal path returns a shortest edit script, verified against a reference dynamic-programming implementation in the test suite.
- **Explicit escape hatch** — `{ heuristic: true }` trades minimality for bounded search work only when the caller chooses it; on the repository's ~8 KB completely-different character benchmark, it reduces roughly 233 ms to roughly 8 ms with an edit script about 8% larger.
- **Unicode-aware boundaries** — scanner modes cover fast Unicode-aware word, code-point, and line diffs; `Intl.Segmenter` modes add locale-aware words and grapheme clusters.
- **UI-ready output** — use merged text entries for rendering or `diffRanges()` for UTF-16 offsets without converting between output models.

Typical benchmark inputs are already around a millisecond across the compared libraries, so those differences rarely decide an application. See the [full benchmark table](#benchmarks) and [`bench/compare.mjs`](bench/compare.mjs), then reproduce it with `npm run bench` on the target environment.
```

- [ ] **Step 4: Link the contribution guide**

Replace the Contributing section's paragraph with:

```markdown
Issues and pull requests are welcome. See the [contribution guide](CONTRIBUTING.md) for the Node.js setup, TDD workflow, verification gate, and performance-testing requirements.
```

- [ ] **Step 5: Verify the content contract and repository tests**

Run:

```sh
node -e "const s=require('node:fs').readFileSync('README.md','utf8'); for(const x of ['## Why another diff library?','Exact by default','Explicit escape hatch','Unicode-aware boundaries','UI-ready output','[contribution guide](CONTRIBUTING.md)']) if(!s.includes(x)) throw new Error('missing: '+x)"
npm test
```

Expected: the content contract exits 0 with no output and the complete suite passes.

- [ ] **Step 6: Commit the positioning documentation**

```sh
git add README.md
git commit -m "docs: explain string-diff positioning"
```

Expected: one README-only commit with no unqualified performance claim.

---

### Task 2: Add tested prefilled demo links

**Files:**
- Create: `test/readme-examples.test.ts`
- Modify: `README.md:218-228`

**Interfaces:**
- Consumes: the URL hash contract implemented by `StringDiffDemoState.decodeState(hash)`.
- Produces: four links under the README Demo section whose decoded states exercise Korean word mode, Japanese `intl-word`, emoji `grapheme`, and combined ignore options.

- [ ] **Step 1: Write the failing executable-documentation test**

Create `test/readme-examples.test.ts` with this content:

```ts
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

interface DemoState {
  a: string;
  b: string;
  mode: string;
  locale: string;
  refine: boolean;
  heuristic: boolean;
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
}

interface DemoStateApi {
  decodeState(hash: string): DemoState;
}

function loadStateApi(): DemoStateApi {
  const source = readFileSync(new URL('../demo/state.js', import.meta.url), 'utf8');
  const context: Record<string, unknown> = { URLSearchParams };
  runInNewContext(source, context, { filename: 'demo/state.js' });
  const api = context.StringDiffDemoState as DemoStateApi | undefined;
  assert.ok(api);
  return api;
}

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const demoLinkPattern = /\[([^\]]+)\]\(https:\/\/krkarma777\.github\.io\/string-diff\/#([^)]+)\)/g;

test('README examples: four labeled demo links decode to the documented states', () => {
  const api = loadStateApi();
  const links = new Map<string, DemoState>();
  for (const match of readme.matchAll(demoLinkPattern)) {
    links.set(match[1], api.decodeState(match[2]));
  }

  const getState = (label: string): DemoState => {
    const state = links.get(label);
    assert.ok(state, `missing demo link: ${label}`);
    return { ...state };
  };

  assert.deepEqual(getState('Korean word replacement'), {
    a: '안녕하세요 세계',
    b: '안녕하세요 지구',
    mode: 'word',
    locale: '',
    refine: false,
    heuristic: false,
    ignoreCase: false,
    ignoreWhitespace: false,
  });
  assert.deepEqual(getState('Japanese locale-aware words'), {
    a: '私は猫が好きです',
    b: '私は犬が好きです',
    mode: 'intl-word',
    locale: 'ja',
    refine: false,
    heuristic: false,
    ignoreCase: false,
    ignoreWhitespace: false,
  });
  assert.deepEqual(getState('Grapheme-safe family emoji'), {
    a: 'Family: 👨‍👩‍👧',
    b: 'Family: 👨‍👩‍👦',
    mode: 'grapheme',
    locale: '',
    refine: false,
    heuristic: false,
    ignoreCase: false,
    ignoreWhitespace: false,
  });
  assert.deepEqual(getState('Ignore case and whitespace'), {
    a: 'Hello,   WORLD!\nNext line',
    b: 'hello, WORLD!\nNext line',
    mode: 'word',
    locale: '',
    refine: false,
    heuristic: false,
    ignoreCase: true,
    ignoreWhitespace: true,
  });
});
```

- [ ] **Step 2: Run the executable-documentation test and verify RED**

Run:

```sh
node --test test/readme-examples.test.ts
```

Expected: FAIL because the README does not yet contain four matching prefilled links.

- [ ] **Step 3: Add the exact links to the Demo section**

Insert this block after the hosted demo link and before `Locally:`:

```markdown
### Prefilled examples

- [Korean word replacement](https://krkarma777.github.io/string-diff/#a=%EC%95%88%EB%85%95%ED%95%98%EC%84%B8%EC%9A%94+%EC%84%B8%EA%B3%84&b=%EC%95%88%EB%85%95%ED%95%98%EC%84%B8%EC%9A%94+%EC%A7%80%EA%B5%AC&mode=word)
- [Japanese locale-aware words](https://krkarma777.github.io/string-diff/#a=%E7%A7%81%E3%81%AF%E7%8C%AB%E3%81%8C%E5%A5%BD%E3%81%8D%E3%81%A7%E3%81%99&b=%E7%A7%81%E3%81%AF%E7%8A%AC%E3%81%8C%E5%A5%BD%E3%81%8D%E3%81%A7%E3%81%99&mode=intl-word&locale=ja)
- [Grapheme-safe family emoji](https://krkarma777.github.io/string-diff/#a=Family%3A+%F0%9F%91%A8%E2%80%8D%F0%9F%91%A9%E2%80%8D%F0%9F%91%A7&b=Family%3A+%F0%9F%91%A8%E2%80%8D%F0%9F%91%A9%E2%80%8D%F0%9F%91%A6&mode=grapheme)
- [Ignore case and whitespace](https://krkarma777.github.io/string-diff/#a=Hello%2C+++WORLD%21%0ANext+line&b=hello%2C+WORLD%21%0ANext+line&mode=word&ignoreCase=1&ignoreWhitespace=1)
```

- [ ] **Step 4: Run the documentation test and verify GREEN**

Run:

```sh
node --test test/readme-examples.test.ts
npm test
npm run typecheck
```

Expected: the README example test passes, followed by the complete suite and typecheck.

- [ ] **Step 5: Commit the runnable examples**

```sh
git add README.md test/readme-examples.test.ts
git commit -m "docs: add verified live demo examples"
```

Expected: one commit containing four codec-verified links and their regression test.

---

### Task 3: Verify the complete documentation PR

**Files:**
- Verify: `README.md`
- Verify: `CONTRIBUTING.md`
- Verify: `demo/state.js`
- Verify: `test/readme-examples.test.ts`

**Interfaces:**
- Consumes: all three approved changes in sequence.
- Produces: evidence that the documentation is correct, executable, and does not alter the published package contents or version.

- [ ] **Step 1: Run the complete project gate**

Run:

```sh
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run perf:smoke
npm pack --dry-run
git status --short -- coverage demo/string-diff.min.js
```

Expected: every npm command exits 0; the final Git command prints nothing. The pack preview still contains only the configured `dist` package contents plus npm-required metadata, with no demo or documentation files added to the tarball.

- [ ] **Step 2: Review every performance statement against the benchmark table**

Confirm all of the following directly in `README.md`:

1. Exact output is described as the default.
2. Heuristic output is explicitly described as potentially non-minimal.
3. The ~233 ms and ~8 ms figures are scoped to the ~8 KB completely-different character scenario.
4. The ~8% edit-script increase is scoped to heuristic mode in that scenario.
5. Typical inputs are described as roughly millisecond-scale rather than as a universal performance win.
6. `npm run bench` and `bench/compare.mjs` are linked as reproduction paths.

- [ ] **Step 3: Record verification evidence in the PR description**

Use this checklist:

```markdown
## Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run test:coverage`
- [x] `npm run build`
- [x] `npm run perf:smoke`
- [x] `npm pack --dry-run`
- [x] Prefilled hashes decoded through `demo/state.js`
- [x] Performance language checked against the benchmark table
```

Expected: the branch is ready for the `docs: add adoption guide and live examples` PR. External community posting remains a separate manual follow-up after the demo deployment is live.
