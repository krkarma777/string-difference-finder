export type DiffMode = 'word' | 'char' | 'line';

/**
 * Word tokens are runs of Unicode letters/marks/digits/underscore, so that
 * non-ASCII scripts (Korean, Japanese, ...) split into words instead of
 * collapsing into a single opaque token like the ASCII-only \w would.
 */
const WORD_PATTERN = /[\p{L}\p{M}\p{N}_]+|\s+|[^\s\p{L}\p{M}\p{N}_]+/gu;

export function tokenize(text: string, mode: DiffMode = 'word'): string[] {
  if (text.length === 0) return [];
  switch (mode) {
    case 'word':
      return text.match(WORD_PATTERN) ?? [];
    case 'char':
      return [...text];
    case 'line':
      return text.split(/(?<=\n)/);
  }
}
