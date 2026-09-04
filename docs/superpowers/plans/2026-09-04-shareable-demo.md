# Shareable v1.2 Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose every v1.2 diff option in the hosted demo, preserve comparisons in shareable URL hashes, and report entry/change-range statistics from one diff call.

**Architecture:** A dependency-free classic script, `demo/state.js`, owns pure URL-state and entry-summary behavior through the `StringDiffDemoState` global. `demo/index.html` remains responsible for DOM interaction, library calls, rendering, error display, and same-document URL updates so GitHub Pages and direct `file://` usage continue to work.

**Tech Stack:** Browser HTML/CSS/JavaScript, `URLSearchParams`, Node.js `node:test`, `node:vm`, existing IIFE library bundle

## Global Constraints

- Keep the package and demo at zero runtime dependencies.
- Preserve Node.js 16 compatibility for the published library.
- Preserve direct `file://` execution of `demo/index.html` after `npm run demo`.
- Keep the existing unified inline diff result; side-by-side rendering is deferred.
- Keep the existing dark visual direction; this work adds controls and hierarchy without redesigning the page.
- Do not change the public library API in this work.
- Do not publish externally or implement issue #17 as part of these changes.

## PR Boundary

- Suggested branch: `feature/shareable-demo`
- PR title: `feat: add shareable v1.2 demo controls`
- Base: the merged repository-readiness change

---

### Task 1: Build the URL state codec with TDD

**Files:**
- Create: `test/demo-state.test.ts`
- Create: `demo/state.js`

**Interfaces:**
- Consumes: browser and Node.js implementations of `URLSearchParams`.
- Produces: `StringDiffDemoState.DEFAULT_STATE`, `StringDiffDemoState.encodeState(state)`, and `StringDiffDemoState.decodeState(hash)`.

- [ ] **Step 1: Write the failing codec tests**

Create `test/demo-state.test.ts` with this content:

```ts
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

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

interface DemoStateApi {
  DEFAULT_STATE: Readonly<DemoState>;
  encodeState(state: DemoState): string;
  decodeState(hash: string): DemoState;
}

const expectedDefault: DemoState = {
  a: "committer_list_per_month[date + '-' + log[i].author] = 1;",
  b: "var date_author = date + '-' + log[i].author;",
  mode: 'word',
  locale: '',
  refine: false,
  heuristic: false,
  ignoreCase: false,
  ignoreWhitespace: false,
};

function loadApi(): DemoStateApi {
  const source = readFileSync(new URL('../demo/state.js', import.meta.url), 'utf8');
  const context: Record<string, unknown> = { URLSearchParams };
  runInNewContext(source, context, { filename: 'demo/state.js' });
  const api = context.StringDiffDemoState as DemoStateApi | undefined;
  assert.ok(api, 'state.js must expose StringDiffDemoState');
  return api;
}

test('demo state: missing hash values use the current defaults', () => {
  const api = loadApi();
  assert.deepEqual({ ...api.DEFAULT_STATE }, expectedDefault);
  assert.deepEqual({ ...api.decodeState('') }, expectedDefault);
});

test('demo state: every option survives an encode/decode round-trip', () => {
  const api = loadApi();
  const state: DemoState = {
    a: 'Original',
    b: 'Changed',
    mode: 'intl-word',
    locale: 'ja',
    refine: true,
    heuristic: true,
    ignoreCase: true,
    ignoreWhitespace: true,
  };

  assert.deepEqual({ ...api.decodeState(`#${api.encodeState(state)}`) }, state);
});

test('demo state: Unicode, emoji, whitespace, and line breaks round-trip exactly', () => {
  const api = loadApi();
  const state: DemoState = {
    ...expectedDefault,
    a: '안녕하세요  세계\n👨‍👩‍👧',
    b: 'こんにちは 世界\n👨‍👩‍👦',
    mode: 'grapheme',
  };

  assert.deepEqual({ ...api.decodeState(api.encodeState(state)) }, state);
});

test('demo state: invalid modes and boolean spellings fall back safely', () => {
  const api = loadApi();
  const decoded = api.decodeState('#a=&b=&mode=unknown&refine=true&heuristic=0&ignoreCase=yes');

  assert.deepEqual({ ...decoded }, {
    ...expectedDefault,
    a: '',
    b: '',
  });
});

test('demo state: false flags and empty locale are omitted deterministically', () => {
  const api = loadApi();
  assert.equal(api.encodeState({ ...expectedDefault, a: '', b: '' }), 'a=&b=&mode=word');
});
```

- [ ] **Step 2: Run the codec tests and verify RED**

Run:

```sh
node --test test/demo-state.test.ts
```

Expected: FAIL with `ENOENT` for `demo/state.js`. The failure must come from the missing production module, not a TypeScript or test syntax error.

- [ ] **Step 3: Implement the minimal codec**

Create `demo/state.js` with this content:

```js
(function exposeDemoState(root) {
  'use strict';

  const VALID_MODES = new Set(['word', 'char', 'line', 'intl-word', 'grapheme']);

  const DEFAULT_STATE = Object.freeze({
    a: "committer_list_per_month[date + '-' + log[i].author] = 1;",
    b: "var date_author = date + '-' + log[i].author;",
    mode: 'word',
    locale: '',
    refine: false,
    heuristic: false,
    ignoreCase: false,
    ignoreWhitespace: false,
  });

  function encodeState(state) {
    const params = new URLSearchParams();
    params.set('a', state.a);
    params.set('b', state.b);
    params.set('mode', state.mode);
    if (state.locale !== '') params.set('locale', state.locale);
    if (state.refine) params.set('refine', '1');
    if (state.heuristic) params.set('heuristic', '1');
    if (state.ignoreCase) params.set('ignoreCase', '1');
    if (state.ignoreWhitespace) params.set('ignoreWhitespace', '1');
    return params.toString();
  }

  function decodeState(hash) {
    const payload = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(payload);
    const requestedMode = params.get('mode');

    return {
      a: params.has('a') ? params.get('a') : DEFAULT_STATE.a,
      b: params.has('b') ? params.get('b') : DEFAULT_STATE.b,
      mode: VALID_MODES.has(requestedMode) ? requestedMode : DEFAULT_STATE.mode,
      locale: params.get('locale') ?? DEFAULT_STATE.locale,
      refine: params.get('refine') === '1',
      heuristic: params.get('heuristic') === '1',
      ignoreCase: params.get('ignoreCase') === '1',
      ignoreWhitespace: params.get('ignoreWhitespace') === '1',
    };
  }

  root.StringDiffDemoState = Object.freeze({
    DEFAULT_STATE,
    encodeState,
    decodeState,
  });
})(globalThis);
```

- [ ] **Step 4: Run the codec tests and verify GREEN**

Run:

```sh
node --test test/demo-state.test.ts
npm run typecheck
```

Expected: 5 demo-state tests pass and the repository typecheck exits 0.

- [ ] **Step 5: Commit the codec**

```sh
git add demo/state.js test/demo-state.test.ts
git commit -m "feat: add demo URL state codec"
```

Expected: one commit with the pure state module and its tests.

---

### Task 2: Add entry and change-range statistics with TDD

**Files:**
- Modify: `test/demo-state.test.ts`
- Modify: `demo/state.js`

**Interfaces:**
- Consumes: an array of `{ operation: 'equal' | 'insert' | 'delete', text: string }` entries returned by `StringDiff.diff`.
- Produces: `StringDiffDemoState.summarizeEntries(entries)`, returning `{ entryCount, changedEntryCount, rangeCount }`.

- [ ] **Step 1: Extend the test interface and add failing statistics tests**

Add these types above `DemoStateApi` in `test/demo-state.test.ts`:

```ts
interface DemoEntry {
  operation: 'equal' | 'insert' | 'delete';
  text: string;
}

interface DemoStats {
  entryCount: number;
  changedEntryCount: number;
  rangeCount: number;
}
```

Add this method to `DemoStateApi`:

```ts
summarizeEntries(entries: DemoEntry[]): DemoStats;
```

Append these tests:

```ts
test('demo stats: empty and equal-only results contain no changed ranges', () => {
  const api = loadApi();
  assert.deepEqual({ ...api.summarizeEntries([]) }, {
    entryCount: 0,
    changedEntryCount: 0,
    rangeCount: 0,
  });
  assert.deepEqual({ ...api.summarizeEntries([{ operation: 'equal', text: 'same' }]) }, {
    entryCount: 1,
    changedEntryCount: 0,
    rangeCount: 0,
  });
});

test('demo stats: a pure insertion or deletion is one changed range', () => {
  const api = loadApi();
  assert.deepEqual({ ...api.summarizeEntries([{ operation: 'insert', text: 'new' }]) }, {
    entryCount: 1,
    changedEntryCount: 1,
    rangeCount: 1,
  });
  assert.deepEqual({ ...api.summarizeEntries([{ operation: 'delete', text: 'old' }]) }, {
    entryCount: 1,
    changedEntryCount: 1,
    rangeCount: 1,
  });
});

test('demo stats: adjacent delete and insert entries form one replacement range', () => {
  const api = loadApi();
  assert.deepEqual({ ...api.summarizeEntries([
    { operation: 'equal', text: 'before' },
    { operation: 'delete', text: 'old' },
    { operation: 'insert', text: 'new' },
    { operation: 'equal', text: 'after' },
  ]) }, {
    entryCount: 4,
    changedEntryCount: 2,
    rangeCount: 1,
  });
});

test('demo stats: equal entries separate changed ranges', () => {
  const api = loadApi();
  assert.deepEqual({ ...api.summarizeEntries([
    { operation: 'delete', text: 'one' },
    { operation: 'insert', text: 'first' },
    { operation: 'equal', text: ' shared ' },
    { operation: 'delete', text: 'two' },
    { operation: 'insert', text: 'second' },
  ]) }, {
    entryCount: 5,
    changedEntryCount: 4,
    rangeCount: 2,
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```sh
node --test test/demo-state.test.ts
```

Expected: the five codec tests pass and the four new tests fail because `api.summarizeEntries` is not a function.

- [ ] **Step 3: Implement the minimal statistics pass**

Add this function before the global export in `demo/state.js`:

```js
function summarizeEntries(entries) {
  let changedEntryCount = 0;
  let rangeCount = 0;
  let insideChange = false;

  for (const entry of entries) {
    if (entry.operation === 'equal') {
      insideChange = false;
      continue;
    }
    changedEntryCount++;
    if (!insideChange) {
      rangeCount++;
      insideChange = true;
    }
  }

  return {
    entryCount: entries.length,
    changedEntryCount,
    rangeCount,
  };
}
```

Add `summarizeEntries` to the exported object so it becomes:

```js
root.StringDiffDemoState = Object.freeze({
  DEFAULT_STATE,
  encodeState,
  decodeState,
  summarizeEntries,
});
```

- [ ] **Step 4: Run the state tests and verify GREEN**

Run:

```sh
node --test test/demo-state.test.ts
npm test
```

Expected: all 9 demo-state tests pass, then the complete suite passes.

- [ ] **Step 5: Commit the statistics behavior**

```sh
git add demo/state.js test/demo-state.test.ts
git commit -m "feat: summarize demo diff entries"
```

Expected: one commit containing the tested single-pass summary.

---

### Task 3: Add the v1.2 controls and URL-aware rendering

**Files:**
- Create: `test/demo-contract.test.ts`
- Modify: `demo/index.html:1-218`
- Modify: `CHANGELOG.md:1-7`

**Interfaces:**
- Consumes: `StringDiff.diff`, `StringDiffDemoState.DEFAULT_STATE`, `decodeState`, `encodeState`, and `summarizeEntries`.
- Produces: five selectable modes, locale-aware option construction, four boolean controls, automatic shared-state rendering, inline errors, and visible timing/entry/range statistics.

- [ ] **Step 1: Write the failing HTML contract tests**

Create `test/demo-contract.test.ts` with this content:

```ts
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../demo/index.html', import.meta.url), 'utf8');

test('demo contract: exposes all v1.2 modes, options, and status regions', () => {
  for (const mode of ['word', 'char', 'line', 'intl-word', 'grapheme']) {
    assert.match(html, new RegExp(`<option value="${mode}"`));
  }
  for (const id of [
    'locale', 'refine', 'heuristic', 'ignore-case', 'ignore-whitespace',
    'status', 'time', 'entry-count', 'changed-entry-count', 'range-count', 'error',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="error"[^>]*role="alert"/);
});

test('demo contract: loads state before wiring every option into diff', () => {
  const stateScript = html.indexOf('<script src="./state.js"></script>');
  const inlineScript = html.indexOf('const { DEFAULT_STATE');
  assert.ok(stateScript >= 0, 'state.js script is missing');
  assert.ok(inlineScript > stateScript, 'state.js must load before the inline app');

  for (const assignment of [
    'mode: state.mode',
    'refine: state.refine',
    'heuristic: state.heuristic',
    'ignoreCase: state.ignoreCase',
    'ignoreWhitespace: state.ignoreWhitespace',
    'options.locale = state.locale',
  ]) {
    assert.ok(html.includes(assignment), `missing diff option wiring: ${assignment}`);
  }
  assert.match(html, /StringDiff\.diff\(state\.a, state\.b, options\)/);
  assert.ok(html.includes('history.replaceState'));
  assert.ok(html.includes('decodeState(location.hash)'));
  assert.ok(html.includes('summarizeEntries(entries)'));
});

test('demo contract: retains responsive single-column behavior', () => {
  assert.match(html, /@media \(max-width: 640px\)/);
  assert.match(html, /\.inputs\s*\{\s*grid-template-columns:\s*1fr;/);
});
```

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```sh
node --test test/demo-contract.test.ts
```

Expected: FAIL because the current HTML lacks the Segmenter modes, ignore controls, state script, and status/error regions.

- [ ] **Step 3: Update the page metadata and subtitle**

Replace the three mode-limited descriptions with these exact strings:

```html
<meta name="description" content="Compare two strings by word, character, line, locale-aware word, or grapheme — differences highlighted instantly. Built on @krkarma777/string-diff, a fast, zero-dependency Myers diff library for JavaScript & TypeScript.">
```

```html
<meta property="og:description" content="Compare strings by word, character, line, locale-aware word, or grapheme — Myers O(ND), zero dependencies, Unicode-safe (Korean, CJK, emoji), ~2.9 kB min+gzip.">
```

```html
"description": "Online text diff tool that compares two strings by word, character, line, locale-aware word, or grapheme using the Myers O(ND) shortest edit script algorithm. Zero dependencies, Unicode-safe.",
```

Replace the subtitle with:

```html
<p class="sub">Compare strings by word, character, line, locale-aware word, or grapheme · exact Myers diff · zero dependencies</p>
```

- [ ] **Step 4: Add the exact layout styles**

Keep the existing color variables, body, heading, textarea, result, and footer styles. Replace the existing `.controls`, `button`, `select`, `label.opt`, and `#time` rules with this block, then keep the existing `#result` block after it:

```css
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0;
  }
  .control-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .primary-controls { align-items: flex-end; }
  .field { display: flex; flex-direction: column; gap: 6px; margin: 0; }
  .field > span {
    color: var(--muted);
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .options {
    padding: 10px 12px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  button {
    padding: 10px 22px;
    background: var(--accent);
    color: #0b0d12;
    font-weight: 600;
    font-size: 14px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.1); }
  select,
  input[type="text"] {
    padding: 9px 10px;
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
  }
  select:focus,
  input[type="text"]:focus { outline: none; border-color: var(--accent); }
  input[type="text"]:disabled { color: var(--muted); opacity: 0.65; }
  #locale { width: 120px; }
  label.opt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 13px;
    text-transform: none;
    letter-spacing: 0;
    margin: 0;
    cursor: pointer;
  }
  label.opt input { accent-color: var(--accent); }
  .status {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .error {
    margin: 0 0 8px;
    padding: 10px 12px;
    color: var(--del-text);
    background: var(--del-bg);
    border: 1px solid var(--del-text);
    border-radius: 8px;
    font-size: 13px;
  }
  [hidden] { display: none !important; }
```

Extend the existing mobile media rule to this exact block:

```css
  @media (max-width: 640px) {
    .inputs { grid-template-columns: 1fr; }
    .primary-controls { align-items: stretch; }
    .primary-controls > button,
    .primary-controls > .field { width: 100%; }
    .primary-controls select,
    .primary-controls input[type="text"] { width: 100%; }
  }
```

- [ ] **Step 5: Replace the controls and result prelude**

Replace the current `.controls` block, timing span, and result prelude with:

```html
  <div class="controls">
    <div class="control-group primary-controls">
      <button id="compare" type="button">Compare</button>
      <label class="field" for="mode">
        <span>Mode</span>
        <select id="mode">
          <option value="word" selected>word</option>
          <option value="char">char</option>
          <option value="line">line</option>
          <option value="intl-word">intl-word</option>
          <option value="grapheme">grapheme</option>
        </select>
      </label>
      <label class="field" for="locale">
        <span>Locale</span>
        <input id="locale" type="text" placeholder="runtime default" autocomplete="off" disabled>
      </label>
    </div>
    <div class="control-group options" role="group" aria-label="Diff options">
      <label class="opt"><input type="checkbox" id="refine"> refine</label>
      <label class="opt"><input type="checkbox" id="heuristic"> heuristic</label>
      <label class="opt"><input type="checkbox" id="ignore-case"> ignore case</label>
      <label class="opt"><input type="checkbox" id="ignore-whitespace"> ignore whitespace</label>
    </div>
  </div>

  <div id="status" class="status" role="status" aria-live="polite" hidden>
    <span id="time"></span>
    <span id="entry-count"></span>
    <span id="changed-entry-count"></span>
    <span id="range-count"></span>
  </div>
  <div id="error" class="error" role="alert" hidden></div>
  <div id="result"><span class="empty">Press Compare to see the diff.</span></div>
```

- [ ] **Step 6: Replace the demo scripts with state-aware rendering**

Replace the two current script blocks at the bottom of the page with:

```html
<script src="./string-diff.min.js"></script>
<script src="./state.js"></script>
<script>
  const { DEFAULT_STATE, decodeState, encodeState, summarizeEntries } = StringDiffDemoState;
  const $ = id => document.getElementById(id);
  const SEGMENTER_MODES = new Set(['intl-word', 'grapheme']);

  function syncLocaleControl() {
    $('locale').disabled = !SEGMENTER_MODES.has($('mode').value);
  }

  function applyState(state) {
    $('a').value = state.a;
    $('b').value = state.b;
    $('mode').value = state.mode;
    $('locale').value = state.locale;
    $('refine').checked = state.refine;
    $('heuristic').checked = state.heuristic;
    $('ignore-case').checked = state.ignoreCase;
    $('ignore-whitespace').checked = state.ignoreWhitespace;
    syncLocaleControl();
  }

  function readState() {
    return {
      a: $('a').value,
      b: $('b').value,
      mode: $('mode').value,
      locale: $('locale').value.trim(),
      refine: $('refine').checked,
      heuristic: $('heuristic').checked,
      ignoreCase: $('ignore-case').checked,
      ignoreWhitespace: $('ignore-whitespace').checked,
    };
  }

  function buildOptions(state) {
    const options = {
      mode: state.mode,
      refine: state.refine,
      heuristic: state.heuristic,
      ignoreCase: state.ignoreCase,
      ignoreWhitespace: state.ignoreWhitespace,
    };
    if (state.locale !== '') options.locale = state.locale;
    return options;
  }

  function replaceHash(state) {
    const hash = `#${encodeState(state)}`;
    try {
      history.replaceState(null, '', hash);
    } catch {
      location.hash = hash;
    }
  }

  function render(updateUrl = true) {
    const state = readState();
    const result = $('result');

    try {
      const options = buildOptions(state);
      const t0 = performance.now();
      const entries = StringDiff.diff(state.a, state.b, options);
      const elapsed = performance.now() - t0;
      const stats = summarizeEntries(entries);

      result.textContent = '';
      if (entries.length === 0) {
        const span = document.createElement('span');
        span.className = 'empty';
        span.textContent = 'Both strings are empty.';
        result.appendChild(span);
      }
      for (const entry of entries) {
        const span = document.createElement('span');
        if (entry.operation === 'delete') span.className = 'del';
        else if (entry.operation === 'insert') span.className = 'ins';
        span.textContent = entry.text;
        result.appendChild(span);
      }

      $('time').textContent = `${elapsed.toFixed(2)} ms`;
      $('entry-count').textContent = `${stats.entryCount} ${stats.entryCount === 1 ? 'entry' : 'entries'}`;
      $('changed-entry-count').textContent = `${stats.changedEntryCount} changed`;
      $('range-count').textContent = `${stats.rangeCount} ${stats.rangeCount === 1 ? 'range' : 'ranges'}`;
      $('status').hidden = false;
      $('error').hidden = true;
      $('error').textContent = '';
      if (updateUrl) replaceHash(state);
    } catch (caught) {
      result.textContent = '';
      $('status').hidden = true;
      $('error').textContent = caught instanceof Error ? caught.message : String(caught);
      $('error').hidden = false;
    }
  }

  $('mode').addEventListener('change', syncLocaleControl);
  $('compare').addEventListener('click', () => render(true));

  const hasSharedState = location.hash.length > 1;
  applyState(hasSharedState ? decodeState(location.hash) : DEFAULT_STATE);
  if (hasSharedState) render(false);
</script>
```

- [ ] **Step 7: Record the user-visible demo change**

Insert this section after the changelog introduction and before the `1.2.0` section:

```markdown
## [Unreleased]

### Added
- The hosted demo now exposes every v1.2 diff mode and option, restores comparisons from shareable URL hashes, and reports entry and changed-range counts alongside timing.
```

- [ ] **Step 8: Run contract and state tests and verify GREEN**

Run:

```sh
node --test test/demo-contract.test.ts test/demo-state.test.ts
npm test
npm run typecheck
```

Expected: 3 contract tests and 9 state tests pass; the complete test suite and typecheck also pass.

- [ ] **Step 9: Commit the integrated demo UI**

```sh
git add demo/index.html test/demo-contract.test.ts CHANGELOG.md
git commit -m "feat: expose shareable v1.2 demo controls"
```

Expected: one commit containing the UI, URL integration, visible errors, and contract tests.

---

### Task 4: Verify the complete demo PR

**Files:**
- Verify: `demo/index.html`
- Verify: `demo/state.js`
- Verify: `test/demo-state.test.ts`
- Verify: `test/demo-contract.test.ts`

**Interfaces:**
- Consumes: the complete demo implementation from Tasks 1-3.
- Produces: evidence that the branch is safe to review and deploy through the existing Pages workflow.

- [ ] **Step 1: Build the browser bundle and run every automated gate**

Run:

```sh
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run perf:smoke
npm run demo
git status --short -- coverage demo/string-diff.min.js
```

Expected: every npm command exits 0. The final Git command prints nothing because coverage output and the copied demo bundle are ignored.

- [ ] **Step 2: Verify the direct-file browser workflow**

Open `demo/index.html` directly from the filesystem. Verify all of the following:

1. The default page waits for Compare and locale is disabled.
2. Each of `word`, `char`, `line`, `intl-word`, and `grapheme` produces output.
3. Locale becomes enabled only for `intl-word` and `grapheme`.
4. `refine`, `heuristic`, `ignore case`, and `ignore whitespace` reach the comparison.
5. A successful comparison updates the hash and displays time, entries, changed entries, and ranges.
6. Opening the copied URL in a new tab restores all fields and runs automatically.
7. Locale `not_a_locale` produces an inline error, hides stale statistics, and leaves the prior hash unchanged.
8. At 640 px and below, the input columns and primary controls stack without horizontal overflow.

- [ ] **Step 3: Record verification evidence in the PR description**

Use this checklist:

```markdown
## Verification

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run test:coverage`
- [x] `npm run build`
- [x] `npm run perf:smoke`
- [x] Direct `file://` demo check
- [x] Shared URL round-trip check
- [x] Narrow viewport check
```

Expected: the branch is ready for the `feat: add shareable v1.2 demo controls` PR. Do not add a version bump because the public package API is unchanged.
