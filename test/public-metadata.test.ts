import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const readText = (path: string): string => readFileSync(new URL(path, root), 'utf8');

const readme = readText('README.md');
const demo = readText('demo/index.html');
const manifest = JSON.parse(readText('package.json')) as { description: string };
const socialSource = readText('scripts/og-image.html');
const source = readText('src/index.ts');
const socialPng = readFileSync(new URL('demo/og-image.png', root));

const fiveModes = /word, character, line, locale-aware word, or grapheme/i;

function assertAdoptionClaims(name: string, text: string): void {
  assert.match(text, fiveModes, `${name} must name all five modes`);
  assert.match(text, /exact[^.!?]{0,100}by default/i, `${name} must qualify exactness as the default`);
  assert.match(text, /opt(?:ional|-in)[^.!?]{0,100}heuristic/i, `${name} must identify the heuristic as opt-in`);
  assert.match(text, /bound(?:ed|s)?(?:-search| search)/i, `${name} must describe bounded search`);
  assert.match(text, /non-minimal/i, `${name} must disclose that heuristic output may be non-minimal`);
}

function metaContent(attribute: 'name' | 'property', value: string): string {
  const tag = demo.match(new RegExp(`<meta\\s+[^>]*${attribute}="${value}"[^>]*>`))?.[0];
  assert.ok(tag, `missing ${attribute}="${value}" metadata`);
  const content = tag.match(/\bcontent="([^"]*)"/)?.[1];
  assert.ok(content, `missing content for ${attribute}="${value}"`);
  return content;
}

function visibleText(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsdocBefore(marker: string): string {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `missing source marker: ${marker}`);
  const end = source.lastIndexOf('*/', markerIndex);
  const start = source.lastIndexOf('/**', end);
  assert.ok(start >= 0 && end >= start, `missing JSDoc before: ${marker}`);
  return source.slice(start, end + 2);
}

test('README overview states the current adoption contract', () => {
  assertAdoptionClaims('README overview', readme);
  assert.match(readme, /zero dependencies/i);
  assert.match(readme, /~3\.9 kB min\+gzip/i);
});

test('every demo metadata surface states all modes and the exact/heuristic contract', () => {
  const jsonLdMatch = demo.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(jsonLdMatch, 'missing JSON-LD metadata');
  const jsonLd = JSON.parse(jsonLdMatch[1]) as { description: string };
  const subtitle = demo.match(/<p class="sub">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(subtitle, 'missing visible subtitle');

  const surfaces = new Map<string, string>([
    ['description', metaContent('name', 'description')],
    ['Open Graph description', metaContent('property', 'og:description')],
    ['Open Graph alt', metaContent('property', 'og:image:alt')],
    ['Twitter description', metaContent('name', 'twitter:description')],
    ['JSON-LD description', jsonLd.description],
    ['visible subtitle', visibleText(subtitle)],
  ]);

  for (const [name, text] of surfaces) {
    assertAdoptionClaims(name, text);
    assert.match(text, /zero dependencies/i, `${name} must state the runtime dependency count`);
    assert.match(text, /~3\.9 kB min\+gzip/i, `${name} must state the current browser size`);
    assert.doesNotMatch(text, /~2\.9 kB/i, `${name} must not retain the stale browser size`);
  }
});

test('current demo and social metadata use the verified browser size', () => {
  assert.match(demo, /~3\.9 kB min\+gzip/i);
  assert.doesNotMatch(demo, /~2\.9 kB/i);
  assert.match(socialSource, /~3\.9 kB/i);
  assert.doesNotMatch(socialSource, /~2\.9 kB/i);
});

test('package description covers all modes, behavior qualifications, and dependency count', () => {
  assertAdoptionClaims('package description', manifest.description);
  assert.match(manifest.description, /zero dependencies/i);
});

test('social-card source visibly includes the compact adoption claims', () => {
  const text = visibleText(socialSource);
  assert.match(text, /word\s*·\s*char\s*·\s*line\s*·\s*intl-word\s*·\s*grapheme/i);
  assert.match(text, /exact by default/i);
  assert.match(text, /optional heuristic/i);
  assert.match(text, /bounded search[^.]*may be non-minimal/i);
  assert.match(text, /0 dependencies/i);
  assert.match(text, /~3\.9 kB min\+gzip/i);
});

test('tracked social card is a 2560 by 1280 PNG', () => {
  assert.equal(socialPng.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(socialPng.readUInt32BE(16), 2560);
  assert.equal(socialPng.readUInt32BE(20), 1280);
});

test('public JSDoc qualifies exactness, normalized ranges, and token equality', () => {
  const diffDoc = jsdocBefore('export function diff(');
  assert.match(diffDoc, /shortest edit script[^.]*by default/i);
  assert.match(diffDoc, /heuristic: true[^.]*valid[^.]*non-minimal/i);

  const rangeDocs = [
    jsdocBefore('export type DiffRange'),
    jsdocBefore('export function diffRanges('),
  ].join('\n');
  assert.match(rangeDocs, /ignoreCase[^.]*ignoreWhitespace[^.]*disabled[^.]*default/i);
  assert.match(rangeDocs, /offsets[^.]*slice both original/i);
  assert.match(rangeDocs, /equal text[^.]*from `b`/i);
  assert.match(rangeDocs, /not guaranteed[^.]*slice both original/i);
  assert.match(rangeDocs, /callers[^.]*both disabled/i);

  const tokensDoc = jsdocBefore('export function diffTokens(');
  assert.match(tokensDoc, /exact string equality by default/i);
  assert.match(tokensDoc, /ignoreCase[^.]*ignoreWhitespace[^.]*normalize comparison/i);
});
