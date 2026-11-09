// DART BUDDY – Kommentarbibliothek v1.0 (data/comments.de.json) einbinden
// ------------------------------------------------------------
// data/comments.de.json ist die MASSGEBLICHE Sammlung der 81 Sprüche
// (31 vom Dartabend + 50 FSK-16). Dieses Modul übersetzt ihr Format in die
// Töpfe des Kommentators. Es berechnet keine Punkte und ändert keinen Spielstand.
//
// Regeln aus der Bibliothek (README-kommentarbibliothek.md):
//   * Leistungsstufen: poor 0–25, mid 26–59, good 60–99, excellent 100–179,
//     perfect180 = genau 180 bei 3 Pfeilen. Bei 6 Pfeilen wird auf 3 Pfeile normiert;
//     eine 180 mit 6 Pfeilen löst KEINEN 180er-Spruch aus.
//   * Alle Bedingungen in `when` müssen zutreffen. Fehlen Kontextdaten oder ist eine
//     Bedingung unbekannt, ist der Spruch NICHT zulässig.
//   * minHumorLevel frech → frech + gnadenlos, gnadenlos → nur gnadenlos.
// Zusätzliche Sicherheitsregel der App: Sprüche über „die beiden“ / „ihr anderen zwei“
// kommen nur bei genau 3 Spielern (bei 4 Spielern wäre es sachlich falsch).

import { S } from './jokes.js';

export const COMMENT_FORMAT_VERSION = 1;
export const EVENTS = ['throw', 'bust', 'win', 'turn_start', 'invalid_input', 'correction'];
export const TIERS = ['poor', 'mid', 'good', 'excellent', 'perfect180', 'any', 'bust', 'win'];

const SCORE_CATEGORIES = ['zero', 'low', 'mid', 'solid', 'good', 'ton', 'big', 'max'];
const LEVEL_POOL = { freundlich: 'f', frech: 'k', gnadenlos: 'x' };
const NEAR_WIN = 50; // „kurz vor dem Sieg“: höchstens 50 Rest und auscheckbar

/** Auf 3 Pfeile normierte Punkte einer Aufnahme. */
export function normalizedPoints(points, dartsPerTurn) {
  return dartsPerTurn === 6 ? points / 2 : points;
}

/** Leistungsstufe nach Bibliotheksregeln. */
export function tierOf(points, dartsPerTurn) {
  if (dartsPerTurn === 3 && points === 180) return 'perfect180';
  const n = normalizedPoints(points, dartsPerTurn);
  if (n <= 25) return 'poor';
  if (n <= 59) return 'mid';
  if (n <= 99) return 'good';
  return 'excellent';
}

/**
 * Bedingungen je Ereignis. `c` ist der Kontext aus buildContext().
 * Für turn_start beziehen sich Spieler-Angaben auf den NÄCHSTEN Spieler.
 * Rückgabe undefined = Kontextdaten fehlen → nicht zulässig.
 */
const CONDITIONS = {
  pointsMax: (c, v) => c.points <= v,
  pointsExact: (c, v) => c.points === v,
  remainingMax: (c, v, ev) => (ev === 'turn_start' ? c.next && c.next.remaining <= v : c.remaining <= v),
  remainingExact: (c, v, ev) => (ev === 'turn_start' ? c.next && c.next.remaining === v : c.remaining === v),
  playersAtLeast: (c, v) => c.playerCount >= v,
  maxDartsExact: (c, v) => c.dartsPerTurn === v,
  outRuleExact: (c, v) => c.outMode === v,
  priorLowTurn: (c, v) => (c.prevPoints === null || c.prevPoints === undefined ? undefined : (tierOf(c.prevPoints, c.dartsPerTurn) === 'poor') === v),
  hasEarlier120: (c, v) => (Array.isArray(c.earlierPoints) ? c.earlierPoints.includes(120) === v : undefined),
  previousTurnPointsExact: (c, v) => (c.next && c.next.prevPoints !== null && c.next.prevPoints !== undefined ? c.next.prevPoints === v : undefined),
  opponentNameRequired: (c, v) => !!c.opponentName === v,
  opponentNearWin: (c, v, ev) => (ev === 'turn_start' ? !!(c.next && c.next.nearWinOpponent) : !!c.nearWinOpponent) === v,
  otherPlayerNameExact: (c, v) => Array.isArray(c.otherNames) && c.otherNames.some((n) => n.toLowerCase() === String(v).toLowerCase()),
  leaderNameRequired: (c, v, ev) => !!(ev === 'turn_start' ? c.next && c.next.leaderName : c.leaderIsOther && c.leaderName) === v,
  lastDartMissed: (c, v) => (typeof c.lastDartMissed === 'boolean' ? c.lastDartMissed === v : undefined),
  hasTriple: (c, v) => (typeof c.hasTripleHit === 'boolean' ? c.hasTripleHit === v : undefined),
  tripleOvershot: (c, v) => !!(c.bustReason === 'überworfen' && c.bustDart && c.bustDart.mult === 3) === v,
  reason: (c, v) => c.reason === v,
  previousPlayerPointsMin: (c, v) => !c.bust && c.points >= v,
  previousPlayerNameRequired: (c, v) => !!c.player === v,
  maleWordingOk: (c, v) => (typeof c.maleWordingOk === 'boolean' ? c.maleWordingOk === v : undefined),
  // claimMagic: Die App weiß nicht, ob jemand „zaubern“ angekündigt hat → Daten fehlen → nie zulässig.
};

/** Platzhalter der Bibliothek → Platzhalter des Kommentators (je Ereignis). */
function convertText(text, event) {
  let t = text;
  if (event === 'turn_start') {
    t = t.replace(/\{name\}/g, '{next}').replace(/\{leaderName\}/g, '{nextLeader}').replace(/\{previousPlayerName\}/g, '{prevPlayer}');
    // Der Aufruf muss den nächsten Spieler immer beim Namen nennen
    if (!t.includes('{next}')) t = `{next}! ${t}`;
  } else {
    t = t.replace(/\{leaderName\}/g, '{leader}').replace(/\{opponentName\}/g, '{opponent}').replace(/\{previousPlayerName\}/g, '{prevPlayer}');
  }
  return t;
}

/**
 * Prüft die Datei und übersetzt sie.
 * @returns {{ok:boolean, errors:string[], warnings:string[], count:number, tables:object, ids:string[]}}
 */
export function convertCommentData(data) {
  const errors = [];
  const warnings = [];
  const tables = { JOKES: {}, NEXT_CALLS: {}, INVALID: {}, CORRECTION: {} };
  for (const cat of [...SCORE_CATEGORIES, 'bust', 'win']) tables.JOKES[cat] = {};
  if (!data || !Array.isArray(data.comments)) {
    return { ok: false, errors: ['Kommentarbibliothek: Feld „comments“ fehlt.'], warnings, count: 0, tables, ids: [] };
  }
  if (data.schemaVersion !== COMMENT_FORMAT_VERSION) warnings.push(`Unbekannte schemaVersion ${data.schemaVersion} – versuche trotzdem zu laden.`);
  const seen = new Set();
  let count = 0;
  const push = (table, key, pool, entry) => {
    table[key] = table[key] || {};
    (table[key][pool] = table[key][pool] || []).push(entry);
  };

  for (const c of data.comments) {
    const id = c && c.id;
    if (!id || seen.has(id)) {
      errors.push(`Spruch ohne oder mit doppelter ID: ${id}`);
      continue;
    }
    seen.add(id);
    if (!EVENTS.includes(c.event) || !TIERS.includes(c.tier) || typeof c.text !== 'string' || !c.text.trim()) {
      errors.push(`${id}: ungültiges Ereignis, Stufe oder leerer Text.`);
      continue;
    }
    const pool = LEVEL_POOL[c.minHumorLevel];
    if (!pool) {
      errors.push(`${id}: unbekannte Humor-Stufe „${c.minHumorLevel}“.`);
      continue;
    }
    const when = c.when || {};
    const unknown = Object.keys(when).filter((k) => !CONDITIONS[k]);
    if (unknown.length) warnings.push(`${id}: Bedingung ${unknown.join(', ')} kann die App nicht prüfen – Spruch bleibt inaktiv.`);

    const ev = c.event;
    const tier = c.tier;
    const needsThree = /\bbeiden\b|anderen zwei/i.test(c.text);
    const predicate = (ctx) => {
      if (unknown.length) return false;
      if (needsThree && ctx.playerCount !== 3) return false;
      if (ev === 'throw' && tier !== 'any' && ctx.tier !== tier) return false;
      for (const [k, v] of Object.entries(when)) {
        const r = CONDITIONS[k](ctx, v, ev);
        if (r !== true) return false; // false oder undefined (Daten fehlen)
      }
      return true;
    };
    const text = convertText(c.text, ev);
    const headline =
      (ev === 'bust' && /^(BUST|ABGESCHMISSEN)!/.test(c.text)) || (tier === 'perfect180' && /^HUNDERTACHTZIG!/.test(c.text));
    const entry = S(text, { id, when: predicate, situational: Object.keys(when).length > 0, ...(headline ? { headline: true } : {}) });
    count++;

    if (ev === 'throw') {
      const cats = tier === 'perfect180' ? ['max'] : SCORE_CATEGORIES;
      for (const cat of cats) push(tables.JOKES, cat, pool, entry);
    } else if (ev === 'bust') push(tables.JOKES, 'bust', pool, entry);
    else if (ev === 'win') push(tables.JOKES, 'win', pool, entry);
    else if (ev === 'turn_start') (tables.NEXT_CALLS[pool] = tables.NEXT_CALLS[pool] || []).push(entry);
    else if (ev === 'invalid_input') push(tables.INVALID, when.reason || 'any', pool, entry);
    else if (ev === 'correction') (tables.CORRECTION[pool] = tables.CORRECTION[pool] || []).push(entry);
  }
  return { ok: errors.length === 0, errors, warnings, count, tables, ids: [...seen] };
}

/** Kontextbegriff „kurz vor dem Sieg“ – exportiert, damit buildContext dieselbe Grenze nutzt. */
export const NEAR_WIN_MAX = NEAR_WIN;
