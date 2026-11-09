// DART BUDDY – Parser für gesprochene / getippte Wurfansagen (Deutsch)
// ------------------------------------------------------------
// Grundsatz: Lieber nachfragen als raten. Unbekannte Wörter, mehrdeutige
// Angaben ("Bull") und unmögliche Felder ("Triple 25", "60") werden nicht
// stillschweigend übernommen, sondern als Problem gemeldet.

import { MISS } from './engine.js';

const ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const TEENS = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** Deutsches Zahlwort für 0–999 (ohne Leerzeichen, wie man es spricht). */
export function germanNumberWord(n) {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return TENS[t];
    const one = o === 1 ? 'ein' : ONES[o];
    return `${one}und${TENS[t]}`;
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h === 1 ? 'hundert' : `${ONES[h]}hundert`;
  return rest === 0 ? head : head + germanNumberWord(rest);
}

/** Normalisierung für Vergleiche: Kleinbuchstaben, ß→ss, Umlaute→ae/oe/ue. */
export function normalizeWord(w) {
  return w
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue');
}

const NUMBER_WORDS = (() => {
  const m = new Map();
  for (let n = 0; n <= 180; n++) {
    m.set(normalizeWord(germanNumberWord(n)), n);
    if (n >= 100) m.set(normalizeWord('ein' + germanNumberWord(n)), n);
  }
  m.set('zwo', 2);
  m.set('eins', 1);
  m.set('einhundert', 100);
  return m;
})();

const TRIPLE = new Set(['triple', 'tripple', 'tripel', 'trippel', 'treble', 'trible', 'dreifach', 'dreifache', 'dreifachen', 't', 'tr']);
const DOUBLE = new Set(['doppel', 'doppelt', 'doppelte', 'doppelten', 'double', 'dabbel', 'dabel', 'dobble', 'zweifach', 'zweifache', 'd', 'db']);
const SINGLE = new Set(['single', 'singel', 'einfach', 'einfache', 'einfachen', 's', 'einzel']);
const MISS_WORDS = new Set(['daneben', 'miss', 'fehlwurf', 'fehl', 'vorbei', 'nix', 'nichts', 'niete', 'garnix', 'nullnummer']);
const BULLSEYE = new Set(['bullseye', 'bullsaj', 'bullsai', 'bullsei', 'bullseyes']);
const BULL = new Set(['bull', 'bulls', 'bul', 'boll', 'bullen']);
const INNER = new Set(['inneres', 'innere', 'inner', 'innen', 'rotes', 'rote']);
const OUTER = new Set(['aeusseres', 'aeussere', 'outer', 'aussen', 'gruenes', 'gruene', 'halbes', 'halbe']);
const REPEAT_WORDS = new Map([
  ['einmal', 1],
  ['zweimal', 2],
  ['dreimal', 3],
  ['viermal', 4],
  ['fuenfmal', 5],
  ['sechsmal', 6],
]);
const FILLER = new Set([
  'und', 'komma', 'plus', 'dann', 'ein', 'eine', 'einen', 'der', 'die', 'das', 'den', 'dem',
  'aeh', 'aehm', 'oeh', 'hm', 'hmm', 'also', 'danach', 'zuerst', 'erst', 'erste', 'erster', 'ersten',
  'zweite', 'zweiter', 'dritte', 'dritter', 'letzte', 'letzter', 'pfeil', 'pfeile', 'wurf', 'dart',
  'darts', 'buddy', 'feld', 'auf', 'im', 'in', 'ne', 'n', 'nen', 'hey', 'ok', 'okay', 'so', 'jetzt',
  'mit', 'noch', 'mal', 'x', 'geworfen', 'treffer', 'getroffen', 'bitte', 'aufnahme', 'punkt', 'punkte',
]);
const UNDO_PHRASES = ['rueckgaengig', 'zurueck', 'korrektur', 'loeschen', 'storno', 'stornieren', 'undo'];
const NEGATIVE_PHRASES = [['kein', 'treffer'], ['nicht', 'getroffen'], ['gar', 'nichts']];

export function tokenize(text) {
  let t = String(text || '');
  t = t.replace(/bull['’`´]?s[\s-]*eye/gi, ' bullseye ');
  t = t.replace(/(\d)\s*[x×]\s*/gi, '$1 mal ');
  // Buchstaben-Zahl-Kombinationen trennen: T20 -> T 20, 20er bleibt 20
  t = t.replace(/([a-zäöüß])(\d)/gi, '$1 $2').replace(/(\d)([a-zäöüß])/gi, '$1 $2');
  t = t.replace(/[.,;:!?+/\\()\[\]{}"'„“”‚‘’\-–—_*#]/g, ' ');
  return t
    .split(/\s+/)
    .map((w) => normalizeWord(w.trim()))
    .filter(Boolean)
    .filter((w) => w !== 'er'); // "20er"
}

function readNumber(tok) {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  if (NUMBER_WORDS.has(tok)) return NUMBER_WORDS.get(tok);
  return null;
}

function describeField(mult, value) {
  if (mult === 3) return `Triple ${value}`;
  if (mult === 2) return `Doppel ${value}`;
  return String(value);
}

/**
 * Parst eine Ansage.
 * @param {string} text
 * @param {{maxDarts?: number}} [opts]
 * @returns {{
 *   kind: 'darts'|'chatter'|'command'|'empty',
 *   darts: {mult:number,value:number}[],
 *   issues: {type:string, message:string}[],
 *   unknownWords: string[],
 *   needsConfirmation: boolean,
 *   command?: string,
 *   text: string
 * }}
 */
export function parseThrowInput(text, { maxDarts = 3 } = {}) {
  const tokens = tokenize(text);
  const out = { kind: 'darts', darts: [], issues: [], unknownWords: [], needsConfirmation: false, text: String(text || '') };
  if (!tokens.length) return { ...out, kind: 'empty' };

  // Sprachbefehle
  const meaningful = tokens.filter((t) => !FILLER.has(t));
  if (meaningful.length && meaningful.length <= 2 && meaningful.some((t) => UNDO_PHRASES.includes(t))) {
    return { ...out, kind: 'command', command: 'undo' };
  }

  let pendingMult = null; // 1, 2, 3
  let pendingRepeat = 1;
  let pendingBullSide = null; // 'inner' | 'outer'
  let dartTokens = 0;
  let total180 = false;

  const push = (d) => {
    for (let k = 0; k < pendingRepeat; k++) out.darts.push({ ...d });
    pendingRepeat = 1;
    pendingMult = null;
    pendingBullSide = null;
  };
  const issue = (type, message) => out.issues.push({ type, message });

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const nextTok = tokens[i + 1];

    // "kein Treffer", "nicht getroffen", "gar nichts"
    const neg = NEGATIVE_PHRASES.find(([a, b]) => tok === a && nextTok === b);
    if (neg) {
      dartTokens++;
      push(MISS);
      i++;
      continue;
    }

    if (REPEAT_WORDS.has(tok)) {
      pendingRepeat = REPEAT_WORDS.get(tok);
      dartTokens++;
      continue;
    }
    if (TRIPLE.has(tok)) {
      if (pendingMult) issue('double_modifier', 'Zwei Feldangaben hintereinander.');
      pendingMult = 3;
      dartTokens++;
      continue;
    }
    if (DOUBLE.has(tok)) {
      if (pendingMult) issue('double_modifier', 'Zwei Feldangaben hintereinander.');
      pendingMult = 2;
      dartTokens++;
      continue;
    }
    if (SINGLE.has(tok)) {
      if (pendingMult) issue('double_modifier', 'Zwei Feldangaben hintereinander.');
      pendingMult = 1;
      dartTokens++;
      continue;
    }
    if (INNER.has(tok) && (BULL.has(nextTok) || BULLSEYE.has(nextTok))) {
      pendingBullSide = 'inner';
      continue;
    }
    if (OUTER.has(tok) && BULL.has(nextTok)) {
      pendingBullSide = 'outer';
      continue;
    }
    if (MISS_WORDS.has(tok)) {
      if (pendingMult !== null) issue('invalid_field', 'Feldangabe ohne Zahl vor „daneben“.');
      dartTokens++;
      push(MISS);
      continue;
    }
    if (BULLSEYE.has(tok)) {
      dartTokens++;
      if (pendingMult === 1) {
        issue('ambiguous_bull', '„Single Bullseye“ ist widersprüchlich – Single Bull (25) oder Bullseye (50)?');
        pendingMult = null;
        pendingRepeat = 1;
        continue;
      }
      if (pendingMult === 3) issue('invalid_field', 'Triple Bull gibt es nicht.');
      push({ mult: 2, value: 25 });
      continue;
    }
    if (BULL.has(tok)) {
      dartTokens++;
      // "Bull 25" / "Bull 50" / "Bull fünfzig"
      const n = nextTok !== undefined ? readNumber(nextTok) : null;
      if (pendingMult === 3) {
        issue('invalid_field', 'Triple Bull gibt es nicht – Single Bull (25) oder Bullseye (50)?');
        pendingMult = null;
        pendingRepeat = 1;
        continue;
      }
      if (n === 25 || n === 50) {
        if ((n === 25 && pendingMult === 2) || (n === 50 && pendingMult === 1)) {
          issue('ambiguous_bull', 'Widersprüchliche Bull-Angabe – 25 oder 50?');
          pendingMult = null;
          pendingRepeat = 1;
          i++;
          continue;
        }
        push({ mult: n === 50 ? 2 : 1, value: 25 });
        i++;
        continue;
      }
      if (pendingMult === 2 || pendingBullSide === 'inner') {
        push({ mult: 2, value: 25 });
        continue;
      }
      if (pendingMult === 1 || pendingBullSide === 'outer') {
        push({ mult: 1, value: 25 });
        continue;
      }
      issue('ambiguous_bull', '„Bull“ ist nicht eindeutig: Single Bull (25) oder Bullseye (50)?');
      pendingRepeat = 1;
      continue;
    }

    const n = readNumber(tok);
    if (n !== null) {
      // Wiederholung: "2 mal 20", "3x T20"
      if (nextTok === 'mal' && n >= 1 && n <= maxDarts && pendingMult === null) {
        pendingRepeat = n;
        dartTokens++;
        i++;
        continue;
      }
      dartTokens++;
      if (pendingMult !== null) {
        if (n >= 1 && n <= 20) push({ mult: pendingMult, value: n });
        else if (n === 25 && pendingMult === 1) push({ mult: 1, value: 25 });
        else if (n === 25 && pendingMult === 2) push({ mult: 2, value: 25 });
        else if (n === 50 && pendingMult !== 3) push({ mult: 2, value: 25 });
        else {
          issue('invalid_field', `${describeField(pendingMult, n)} gibt es nicht auf der Scheibe.`);
          pendingMult = null;
          pendingRepeat = 1;
        }
        continue;
      }
      if (n === 0) push(MISS);
      else if (n >= 1 && n <= 20) push({ mult: 1, value: n });
      else if (n === 25) push({ mult: 1, value: 25 });
      else if (n === 50) push({ mult: 2, value: 25 });
      else if (n === 180) total180 = true;
      else {
        let hint = '';
        if (n % 3 === 0 && n / 3 <= 20) hint = ` Meinst du Triple ${n / 3}?`;
        else if (n % 2 === 0 && n / 2 <= 20) hint = ` Meinst du Doppel ${n / 2}?`;
        issue('invalid_number', `${n} ist kein einzelnes Feld.${hint} Bitte die Pfeile einzeln ansagen.`);
        pendingRepeat = 1;
      }
      continue;
    }

    if (FILLER.has(tok)) continue;
    out.unknownWords.push(tok);
  }

  if (pendingMult !== null) {
    const name = pendingMult === 3 ? 'Triple' : pendingMult === 2 ? 'Doppel' : 'Single';
    issue('dangling_modifier', `„${name}“ – aber welche Zahl?`);
  }

  // "Hundertachtzig" als einzige Angabe = 3 × Triple 20 (einzige Möglichkeit)
  if (total180) {
    if (out.darts.length === 0 && out.issues.length === 0) {
      out.darts = [
        { mult: 3, value: 20 },
        { mult: 3, value: 20 },
        { mult: 3, value: 20 },
      ];
    } else {
      issue('invalid_number', '180 ist kein einzelnes Feld. Bitte die Pfeile einzeln ansagen.');
    }
  }

  // Gespräch oder Wurfansage?
  const unknown = out.unknownWords.length;
  if (dartTokens === 0 && !total180) {
    return { ...out, kind: unknown ? 'chatter' : 'empty', darts: [] };
  }
  if (unknown >= 2 || (unknown >= 1 && unknown >= dartTokens)) {
    return { ...out, kind: 'chatter', darts: [] };
  }
  if (unknown === 1) out.needsConfirmation = true;
  if (out.darts.length > maxDarts) {
    issue('too_many', `${out.darts.length} Pfeile erkannt, erlaubt sind ${maxDarts} pro Aufnahme.`);
  }
  if (out.issues.length) out.needsConfirmation = true;
  return out;
}

/** Wandelt Kurzschreibweise (z. B. für Korrekturen) in Darts um: "T20 5 D10", "Bull", "0". */
export function parseShorthand(text, opts) {
  return parseThrowInput(text, opts);
}
