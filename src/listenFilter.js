// DART BUDDY – Filter für „Dauerhaft zuhören“
// ------------------------------------------------------------
// Bei dauerhaft eingeschaltetem Mikrofon hört die App ALLES. Gezählt werden
// nur reine Wurfansagen – jedes Gesprächsstück wird stumm verworfen.
//
// Strenge Regeln (strenger als beim Mikrofonknopf):
//   1. Kein einziges unbekanntes Wort. „17, 2, Triple 13“ zählt,
//      „Ich hol mir noch zwei Bier“ oder „17 Euro“ nicht.
//      Erlaubt sind nur Zahlen, Feldwörter (Triple, Doppel, Bull …) und Füllwörter (und, äh …).
//   2. Eine einzelne nackte Zahl („acht“, „zwanzig“) beginnt KEINE neue Aufnahme –
//      solche Wörter fallen im Gespräch ständig. Sie zählt nur, um eine bereits
//      angefangene Aufnahme zu vervollständigen („17, 2“ … „4“).
//      Mit Feldwort („Triple 20“, „Doppel 16“, „Bullseye“, „daneben“) darf auch ein einzelner Pfeil beginnen.
//   3. Unklares oder Unmögliches wird nur dann nachgefragt, wenn es eindeutig
//      nach Dart klingt (Feldwort enthalten) – sonst stumm ignoriert.
//   4. Eine angefangene Aufnahme verfällt nach FRAGMENT_TIMEOUT_MS ohne Fortsetzung.

import { parseThrowInput } from './parser.js';

export const FRAGMENT_TIMEOUT_MS = 15000;

/** Wörter, die eindeutig nach Dart klingen. */
export const STRONG_WORDS = /\b(triple|tripel|trippel|treble|dreifach\w*|doppel\w*|double|dabbel|single|einfach\w*|bull\w*|daneben|fehlwurf|hundertachtzig|t\s?\d+|d\s?\d+)\b/i;

/**
 * Bewertet eine Äußerung im Dauer-Modus.
 * @returns {{kind: 'darts'|'command'|'ask'|'ignore', darts?: object[], strong?: boolean,
 *            reason?: string, message?: string, parsed: object}}
 */
export function classifyContinuous(text, { maxDarts = 3 } = {}) {
  const parsed = parseThrowInput(text, { maxDarts });
  if (parsed.kind === 'command') return { kind: 'command', parsed };
  if (parsed.kind !== 'darts') return { kind: 'ignore', reason: parsed.kind, parsed };
  if (parsed.unknownWords.length) return { kind: 'ignore', reason: 'gespräch', parsed };
  const strong = STRONG_WORDS.test(String(text));
  const blocking = parsed.issues.filter((i) => i.type !== 'too_many');
  if (blocking.length) {
    return strong
      ? { kind: 'ask', reason: 'ambiguous', message: `${blocking[0].message} Bitte nochmal ansagen.`, parsed }
      : { kind: 'ignore', reason: 'unklar', parsed };
  }
  if (!parsed.darts.length) return { kind: 'ignore', reason: 'leer', parsed };
  return { kind: 'darts', darts: parsed.darts, strong, parsed };
}

/** Bewertung für die Auswahl unter mehreren Erkennungs-Alternativen (höher = besser). */
export function continuousScore(text, opts) {
  const c = classifyContinuous(text, opts);
  if (c.kind === 'darts') return c.darts.length >= 2 || c.strong ? 4 : 3;
  if (c.kind === 'command') return 2.5;
  if (c.kind === 'ask') return 2;
  return 0;
}
