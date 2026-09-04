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

test('demo contract: oversized shared state waits for an explicit comparison', () => {
  assert.match(
    html,
    /const \{[^}]*shouldAutoRender[^}]*\} = StringDiffDemoState;/,
    'shouldAutoRender must be loaded from the demo-only state API',
  );
  assert.match(
    html,
    /const sharedState = hasSharedState \? decodeState\(location\.hash\) : null;/,
    'decoded shared state must be retained for the automatic-render decision',
  );
  assert.match(
    html,
    /if \(shouldAutoRender\(sharedState\)\) \{\s*render\(false\);\s*\} else \{/,
    'automatic render must be guarded without restricting explicit Compare clicks',
  );
  assert.ok(html.includes(
    'This shared comparison is too large to run automatically. Press Compare to run it.',
  ));
});

test('demo contract: retains responsive single-column behavior', () => {
  assert.match(html, /@media \(max-width: 640px\)/);
  assert.match(html, /\.inputs\s*\{\s*grid-template-columns:\s*1fr;/);
});

test('demo contract: locale input fills the mobile control width', () => {
  assert.match(
    html,
    /@media \(max-width: 640px\) \{[\s\S]*?\.primary-controls input\[type="text"\] \{ width: 100%; \}\s*\.primary-controls #locale \{ width: 100%; \}\s*\}/,
  );
});
