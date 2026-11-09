// DART BUDDY – Spielsitzung
// ------------------------------------------------------------
// Bündelt Engine, Eingabe-Steuerung und Kommentator zu einem Ablauf:
//   Würfe erkennen → Punkte berechnen → Spruch → Rest → nächster Spieler.
// Wird von der Oberfläche UND vom Abnahmetest verwendet (kein DOM).

import { computeState, addTurn, undoLast, editTurn, swapTurnPlayers, setNextPlayer, deleteEvent, isValidDart, dartLabel } from './engine.js';
import { handleTextInput, acceptCandidate, evaluatePending, fillWithMisses, missingQuestion } from './turnInput.js';
import { Commentator, buildContext } from './commentator.js';
import { classifyContinuous, FRAGMENT_TIMEOUT_MS } from './listenFilter.js';

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
    this.hadQuestion = false; // musste bei der laufenden Aufnahme nachgefragt werden?
    this.fragmentDeadline = 0; // Dauer-Modus: bis wann eine angefangene Ansage fortgesetzt werden kann
  }

  /**
   * Eingabe im Modus „Dauerhaft zuhören“: nur reine Wurfansagen zählen, alles
   * andere wird STUMM ignoriert (keine Rückfrage, keine Ansage).
   * @param {string} text
   * @param {number} [now] – Zeitstempel (für Tests)
   * @returns {{action: string, silent?: boolean, reason?: string, message?: string}}
   */
  inputContinuous(text, now = Date.now()) {
    if (this.state.finished) return { action: 'ignore', silent: true, reason: 'spielende' };
    const { dartsPerTurn } = this.game.config;
    const c = classifyContinuous(text, { maxDarts: dartsPerTurn });
    if (c.kind === 'ignore') return { action: 'ignore', silent: true, reason: c.reason };
    if (c.kind === 'command') return this.undo();
    if (c.kind === 'ask') {
      // klingt eindeutig nach Dart, ist aber unklar → gezielt nachfragen (wie beim Knopf)
      return this.input(text);
    }

    // Angefangene Ansage abgelaufen? Dann gilt sie als Gerede und wird verworfen.
    this.expireFragment(now);
    const continuing = this.pending.length > 0;
    // Einzelne nackte Zahl darf keine neue Aufnahme beginnen (fällt im Gespräch ständig)
    if (!continuing && c.darts.length === 1 && !c.strong) {
      const ev = evaluatePending(this.game, c.darts);
      // Ausnahme: Die Zahl checkt genau aus (z. B. Single-Out, Rest 20: „zwanzig“). Ein Bust durch
      // eine beiläufig gesagte Zahl darf dagegen NIE passieren.
      if (!(ev.preview && ev.preview.checkout)) return { action: 'ignore', silent: true, reason: 'einzelne Zahl' };
    }

    let r = handleTextInput(this.game, this.pending, text);
    if (r.action === 'ask' && r.reason === 'too_many_darts' && continuing) {
      // Das angefangene Stück war wohl Gerede – neue Ansage für sich allein werten
      r = handleTextInput(this.game, [], text);
    }
    if (r.action === 'commit') {
      this.pending = r.pending;
      this.fragmentDeadline = 0;
      return this.maybeCommit();
    }
    if (r.action === 'wait') {
      this.pending = r.pending;
      this.fragmentDeadline = now + FRAGMENT_TIMEOUT_MS;
      return { action: 'wait', silent: true, message: `${r.message} (wartet ${Math.round(FRAGMENT_TIMEOUT_MS / 1000)} s)` };
    }
    // alles andere (z. B. weiterhin zu viele Pfeile) → stumm ignorieren
    return { action: 'ignore', silent: true, reason: r.reason || r.action };
  }

  /**
   * Verwirft eine im Dauer-Modus angefangene, nicht fortgesetzte Ansage.
   * Von Hand eingetippte Pfeile verfallen nie.
   * @returns {boolean} ob etwas verworfen wurde
   */
  expireFragment(now = Date.now()) {
    if (this.fragmentDeadline && this.pending.length && now > this.fragmentDeadline) {
      this.pending = [];
      this.fragmentDeadline = 0;
      this.hadQuestion = false;
      return true;
    }
    return false;
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
    if (['ask', 'confirm', 'wait'].includes(r.action)) this.hadQuestion = true;
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
      case 'ask': {
        // Spruch zur ungültigen Eingabe – ändert weder Punkte noch den Spieler
        const st = this.state;
        const quip = r.reason
          ? this.commentator.invalidQuip?.(r.reason, {
              name: st.byId[st.activePlayerId].name,
              playerCount: st.players.length,
              dartsPerTurn: this.game.config.dartsPerTurn,
            })
          : null;
        return { action: 'ask', reason: r.reason, message: r.message, quip: quip || null };
      }
      default:
        return { action: r.action, message: r.message };
    }
  }

  /** Spruch nach einer Korrektur – erst NACH der Neuberechnung aufrufen. */
  correctionQuip(eventId) {
    const ev = this.game.events.find((e) => e.id === eventId);
    const st = this.state;
    return this.commentator.correctionQuip({
      name: ev && ev.playerId ? st.byId[ev.playerId].name : undefined,
      playerCount: st.players.length,
      dartsPerTurn: this.game.config.dartsPerTurn,
    });
  }

  /** Spruch-Historie zum Speichern/Laden zusammen mit dem Spiel. */
  exportCommentMemory() {
    return this.commentator.exportMemory ? this.commentator.exportMemory() : [];
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
    this.fragmentDeadline = 0; // von Hand ergänzt → verfällt nicht mehr
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
    this.fragmentDeadline = 0;
    this.hadQuestion = false;
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
    const ctx = buildContext(before, after, result, game.config, { hadQuestion: this.hadQuestion });
    this.hadQuestion = false;
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
