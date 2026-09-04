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
