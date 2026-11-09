// DART BUDDY – Eingabe-Steuerung für eine Aufnahme
// ------------------------------------------------------------
// Verbindet Parser und Engine: sammelt erkannte Pfeile, entscheidet ob
// gebucht, nachgefragt oder ignoriert wird. Keine DOM-Abhängigkeit.

import { computeState, scoreTurn, dartLabel } from './engine.js';
import { parseThrowInput } from './parser.js';

/**
 * Bewertet die bisher gesammelten Pfeile der laufenden Aufnahme.
 * status:
 *   'empty'     – noch nichts erfasst
 *   'partial'   – weniger Pfeile als vereinbart, Aufnahme nicht vorzeitig beendet
 *   'complete'  – Pfeilzahl erreicht oder Aufnahme durch Bust/Checkout beendet
 *   'too_many'  – mehr Pfeile als erlaubt
 */
export function evaluatePending(game, pending) {
  const { dartsPerTurn, outMode } = game.config;
  const state = computeState(game);
  if (state.finished) return { status: 'finished', preview: null, missing: 0 };
  const player = state.byId[state.activePlayerId];
  if (pending.length > dartsPerTurn) {
    return { status: 'too_many', preview: null, missing: 0, player };
  }
  if (!pending.length) return { status: 'empty', preview: null, missing: dartsPerTurn, player };
  const preview = scoreTurn(player.remaining, pending, outMode, dartsPerTurn);
  if (preview.ended || pending.length === dartsPerTurn) {
    return { status: 'complete', preview, missing: 0, player };
  }
  return { status: 'partial', preview, missing: dartsPerTurn - pending.length, player };
}

const ORDINAL = ['erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste'];

export function missingQuestion(pendingLength, dartsPerTurn) {
  const missing = dartsPerTurn - pendingLength;
  if (missing <= 0) return '';
  if (missing === 1) return `Was war der ${ORDINAL[pendingLength] || 'letzte'} Pfeil?`;
  return `Mir fehlen noch ${missing} Pfeile – sag sie an oder tippe „Rest daneben“.`;
}

/**
 * Verarbeitet eine Sprach- oder Texteingabe für die laufende Aufnahme.
 * @returns {{action: 'ignore'|'ask'|'confirm'|'wait'|'commit'|'undo', pending: object[],
 *            candidate?: object[], message: string, parsed: object}}
 *   ignore  – Gespräch erkannt, nichts übernommen
 *   ask     – unklar/unmöglich, gezielte Rückfrage, nichts übernommen
 *   confirm – vermutlich Wurf, aber ein unbekanntes Wort dabei → bestätigen lassen
 *   wait    – Pfeile übernommen, Aufnahme noch unvollständig → Rückfrage nach Rest
 *   commit  – Aufnahme vollständig, kann gebucht werden
 *   undo    – Sprachbefehl „rückgängig“
 */
export function handleTextInput(game, pending, text) {
  const { dartsPerTurn } = game.config;
  const parsed = parseThrowInput(text, { maxDarts: dartsPerTurn });

  if (parsed.kind === 'empty') {
    return { action: 'ignore', pending, parsed, message: 'Nichts verstanden – sag die Pfeile bitte nochmal an.' };
  }
  if (parsed.kind === 'chatter') {
    return { action: 'ignore', pending, parsed, message: 'Klang nach Gequatsche – nichts gezählt.' };
  }
  if (parsed.kind === 'command') {
    return { action: 'undo', pending, parsed, message: '' };
  }
  const blocking = parsed.issues.filter((i) => i.type !== 'too_many');
  if (blocking.length) {
    return { action: 'ask', pending, parsed, message: `${blocking[0].message} Bitte nochmal ansagen.` };
  }

  const combined = pending.concat(parsed.darts);
  if (combined.length > dartsPerTurn) {
    // Zusätzliche Pfeile nach einem Bust/Checkout dürfen ignoriert werden – sonst nachfragen.
    const firstPart = combined.slice(0, dartsPerTurn);
    const ev = evaluatePending(game, firstPart);
    const endedEarly = ev.preview && ev.preview.ended && ev.preview.endedAfter < dartsPerTurn - 1;
    if (!endedEarly) {
      return {
        action: 'ask',
        pending,
        parsed,
        message: `Ich habe ${combined.length} Pfeile gehört (${combined.map(dartLabel).join(', ')}), erlaubt sind ${dartsPerTurn}. Bitte die Aufnahme nochmal ansagen.`,
      };
    }
    return finish(game, firstPart, parsed);
  }

  if (parsed.needsConfirmation) {
    return {
      action: 'confirm',
      pending,
      candidate: parsed.darts,
      parsed,
      message: `Habe ich richtig verstanden: ${parsed.darts.map(dartLabel).join(', ')}?`,
    };
  }
  return finish(game, combined, parsed);
}

function finish(game, combined, parsed) {
  const ev = evaluatePending(game, combined);
  if (ev.status === 'complete') {
    return { action: 'commit', pending: combined, parsed, message: '', evaluation: ev };
  }
  if (ev.status === 'partial') {
    return {
      action: 'wait',
      pending: combined,
      parsed,
      message: missingQuestion(combined.length, game.config.dartsPerTurn),
      evaluation: ev,
    };
  }
  return { action: 'ignore', pending: combined, parsed, message: '' };
}

/** Füllt die restlichen Pfeile mit Fehlwürfen auf (nach Bestätigung durch den Spieler). */
export function fillWithMisses(game, pending) {
  const out = pending.slice();
  while (out.length < game.config.dartsPerTurn) out.push({ mult: 0, value: 0 });
  return out;
}

/** Übernimmt einen bestätigten Kandidaten (nach „Habe ich richtig verstanden?“). */
export function acceptCandidate(game, pending, candidate) {
  const combined = pending.concat(candidate);
  if (combined.length > game.config.dartsPerTurn) {
    return { action: 'ask', pending, message: `Das wären ${combined.length} Pfeile – erlaubt sind ${game.config.dartsPerTurn}. Bitte nochmal ansagen.` };
  }
  return finish(game, combined, null);
}
