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
