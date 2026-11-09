// DART BUDDY – Spielsitzung
// ------------------------------------------------------------
// Bündelt Engine, Eingabe-Steuerung und Kommentator zu einem Ablauf:
//   Würfe erkennen → Punkte berechnen → Spruch → Rest → nächster Spieler.
// Wird von der Oberfläche UND vom Abnahmetest verwendet (kein DOM).

import { computeState, addTurn, undoLast, editTurn, swapTurnPlayers, setNextPlayer, deleteEvent, isValidDart, dartLabel } from './engine.js';
import { handleTextInput, acceptCandidate, evaluatePending, fillWithMisses, missingQuestion } from './turnInput.js';
import { Commentator, buildContext } from './commentator.js';

export class GameSession {
  /**
   * @param {object} game – Spielobjekt aus createGame()
   * @param {{commentator?: Commentator, confirmBeforeCommit?: boolean}} [opts]
   */
  constructor(game, { commentator, confirmBeforeCommit = false } = {}) {
    this.game = game;
    this.pending = [];
    this.candidate = null; // auf Bestätigung wartende Pfeile
    this.awaitingCommit = false; // vollständige Aufnahme wartet auf Bestätigung
    this.commentator = commentator || new Commentator();
    this.confirmBeforeCommit = confirmBeforeCommit;
    this.lastAnnouncement = null;
  }

  get state() {
    return computeState(this.game);
  }

  get activePlayer() {
    const s = this.state;
    return s.activePlayerId ? s.byId[s.activePlayerId] : null;
  }

  evaluation() {
    return evaluatePending(this.game, this.pending);
  }

  /** Verarbeitet eine Sprach-/Texteingabe. */
  input(text) {
    if (this.state.finished) return { action: 'ignore', message: 'Das Spiel ist vorbei – starte eine Revanche!' };
    const r = handleTextInput(this.game, this.pending, text);
    this.candidate = null;
    switch (r.action) {
      case 'undo':
        return this.undo();
      case 'confirm':
        this.candidate = r.candidate;
        return { action: 'confirm', message: r.message, candidate: r.candidate };
      case 'wait':
        this.pending = r.pending;
        return { action: 'wait', message: r.message };
      case 'commit':
        this.pending = r.pending;
        return this.maybeCommit();
      default:
        return { action: r.action, message: r.message };
    }
  }

  /** Antwort auf „Habe ich richtig verstanden?“ */
  confirmCandidate(yes) {
    if (!this.candidate) return { action: 'ignore', message: '' };
    const cand = this.candidate;
    this.candidate = null;
    if (!yes) return { action: 'ask', message: 'Okay, dann bitte nochmal ansagen.' };
    const r = acceptCandidate(this.game, this.pending, cand);
    if (r.action === 'ask') return r;
    this.pending = r.pending;
    if (r.action === 'commit') return this.maybeCommit();
    return { action: 'wait', message: r.message };
  }

  /** Manuelle Eingabe eines einzelnen Pfeils. Bucht automatisch, wenn die Aufnahme vollständig ist. */
  addDart(d, { autoCommit = true } = {}) {
    if (this.state.finished) return { action: 'ignore', message: 'Das Spiel ist vorbei.' };
    if (!isValidDart(d)) return { action: 'ask', message: 'Ungültiges Feld.' };
    const ev = this.evaluation();
    if (ev.status === 'complete') {
      return { action: 'ask', message: 'Die Aufnahme ist schon vollständig – erst buchen oder einen Pfeil löschen.' };
    }
    this.pending = this.pending.concat([{ mult: d.mult, value: d.value }]);
    const ev2 = this.evaluation();
    if (ev2.status === 'complete' && autoCommit) return this.maybeCommit();
    return { action: 'wait', message: ev2.status === 'complete' ? '' : missingQuestion(this.pending.length, this.game.config.dartsPerTurn) };
  }

  removePendingDart() {
    this.pending = this.pending.slice(0, -1);
    this.awaitingCommit = false;
  }

  clearPending() {
    this.pending = [];
    this.candidate = null;
    this.awaitingCommit = false;
  }

  /** Restliche Pfeile als Fehlwurf werten und buchen (nach Bestätigung). */
  finishWithMisses() {
    if (!this.pending.length && this.state.finished) return { action: 'ignore', message: '' };
    this.pending = fillWithMisses(this.game, this.pending);
    return this.commit();
  }

  maybeCommit() {
    if (this.confirmBeforeCommit) {
      this.awaitingCommit = true;
      return { action: 'review', message: `${this.pending.map(dartLabel).join(', ')} – buchen?` };
    }
    return this.commit();
  }

  /** Bucht die gesammelte Aufnahme für den aktiven Spieler. */
  commit() {
    const ev = this.evaluation();
    if (ev.status !== 'complete') {
      return { action: 'wait', message: missingQuestion(this.pending.length, this.game.config.dartsPerTurn) };
    }
    // Pfeile nach Bust/Checkout bleiben gespeichert, werden von der Engine aber als „ignoriert“ markiert.
    const { game, result, before, after } = addTurn(this.game, this.pending);
    this.game = game;
    this.pending = [];
    this.candidate = null;
    this.awaitingCommit = false;
    const ctx = buildContext(before, after, result, game.config);
    const announcement = this.commentator.comment(ctx);
    this.lastAnnouncement = announcement;
    return { action: 'committed', result, announcement, context: ctx, finished: after.finished };
  }

  /** Rückgängig: erst unvollständige Eingabe verwerfen, sonst letzte Aufnahme löschen. */
  undo() {
    if (this.pending.length || this.candidate) {
      this.clearPending();
      return { action: 'undone', message: 'Eingabe verworfen – bitte neu ansagen.' };
    }
    const { game, removed } = undoLast(this.game);
    if (!removed) return { action: 'ignore', message: 'Es gibt nichts rückgängig zu machen.' };
    this.game = game;
    const s = this.state;
    const who = removed.type === 'turn' ? s.byId[removed.playerId].name : '';
    return {
      action: 'undone',
      removed,
      message: removed.type === 'turn'
        ? `Aufnahme von ${who} gelöscht. ${s.byId[s.activePlayerId].name} ist wieder dran.`
        : `Spielerwechsel zurückgenommen. ${s.byId[s.activePlayerId].name} ist dran.`,
    };
  }

  /** Korrigiert eine gebuchte Aufnahme (Werte und/oder Spieler). */
  correctTurn(eventId, { darts, playerId } = {}, { force = false } = {}) {
    const r = editTurn(this.game, eventId, { darts, playerId }, { dropOrphans: force });
    if (r.applied) {
      this.game = r.game;
      this.clearPending();
    }
    return r;
  }

  swapPlayers(eventIdA, eventIdB, { force = false } = {}) {
    const r = swapTurnPlayers(this.game, eventIdA, eventIdB, { dropOrphans: force });
    if (r.applied) {
      this.game = r.game;
      this.clearPending();
    }
    return r;
  }

  deleteTurn(eventId) {
    this.game = deleteEvent(this.game, eventId);
    this.clearPending();
  }

  setNext(playerId) {
    this.game = setNextPlayer(this.game, playerId);
    this.clearPending();
  }
}
