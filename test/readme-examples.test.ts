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
