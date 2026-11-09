// Gemeinsame Test-Hilfen: lädt die maßgebliche Kommentarbibliothek.
import { readFileSync } from 'node:fs';
import { buildLibrary } from '../src/library.js';

export const COMMENT_DATA = JSON.parse(readFileSync(new URL('../data/comments.de.json', import.meta.url), 'utf8'));
export const fullLibrary = (custom = [], hidden = []) => buildLibrary(custom, hidden, COMMENT_DATA);

export function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
