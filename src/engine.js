// DART BUDDY – regelbasierte Dart-Engine
// ------------------------------------------------------------
// Rein deterministisch, ohne DOM, ohne Zufall. Der Spielstand wird
// ausschließlich aus der gespeicherten Ereignisliste (Event-Sourcing)
// neu berechnet. Dadurch kann jede Korrektur den Stand vollständig und
// korrekt neu aufbauen – nichts wird jemals doppelt abgezogen.

export const OUT_MODES = Object.freeze({
  single: 'Single-Out',
  double: 'Double-Out',
  master: 'Master-Out',
});

export const MISS = Object.freeze({ mult: 0, value: 0 });

/** Erzeugt einen Dart. mult: 0 = daneben, 1 = Single, 2 = Doppel, 3 = Triple. value: 1–20 oder 25 (Bull). */
export function dart(mult, value) {
  const d = { mult, value: mult === 0 ? 0 : value };
  if (!isValidDart(d)) throw new Error(`Ungültiger Dart: ${mult}x${value}`);
  return d;
}

export function isValidDart(d) {
  if (!d || typeof d !== 'object') return false;
  const { mult, value } = d;
  if (!Number.isInteger(mult) || !Number.isInteger(value)) return false;
  if (mult === 0) return value === 0;
  if (value >= 1 && value <= 20) return mult >= 1 && mult <= 3;
  if (value === 25) return mult === 1 || mult === 2; // Single Bull 25, Bullseye 50
  return false;
}

export function dartValue(d) {
  return d.mult * d.value;
}

/** Kurzbezeichnung für die Anzeige: T20, D16, 17, Bull, Bullseye, – */
export function dartLabel(d) {
  if (d.mult === 0) return '0';
  if (d.value === 25) return d.mult === 2 ? 'Bullseye' : 'Bull';
  if (d.mult === 3) return `T${d.value}`;
  if (d.mult === 2) return `D${d.value}`;
  return String(d.value);
}

/** Bezeichnung für die Sprachausgabe. */
export function dartSpeech(d) {
  if (d.mult === 0) return 'daneben';
  if (d.value === 25) return d.mult === 2 ? 'Bullseye' : 'Single Bull';
  if (d.mult === 3) return `Triple ${d.value}`;
  if (d.mult === 2) return `Doppel ${d.value}`;
  return String(d.value);
}

export function isFinishingDart(d, outMode) {
  if (d.mult === 0) return false;
  if (outMode === 'single') return true;
  if (outMode === 'double') return d.mult === 2;
  if (outMode === 'master') return d.mult === 2 || d.mult === 3;
  throw new Error(`Unbekannter Out-Modus: ${outMode}`);
}

/** Kleinster Rest, von dem aus man noch auschecken kann. */
function minFinish(outMode) {
  return outMode === 'single' ? 1 : 2;
}

/**
 * Wertet eine Aufnahme aus.
 * @returns {{
 *   darts: object[], thrown: number, points: number, bust: boolean, bustReason: string|null,
 *   checkout: boolean, remainingBefore: number, remainingAfter: number,
 *   ended: boolean, endedAfter: number, ignored: number[]
 * }}
 */
export function scoreTurn(remaining, darts, outMode, dartsPerTurn) {
  if (!Array.isArray(darts)) throw new Error('Darts müssen als Liste übergeben werden.');
  if (darts.length > dartsPerTurn) {
    throw new Error(`Zu viele Pfeile: ${darts.length} statt maximal ${dartsPerTurn}.`);
  }
  darts.forEach((d, i) => {
    if (!isValidDart(d)) throw new Error(`Pfeil ${i + 1} ist ungültig.`);
  });

  let rem = remaining;
  let thrown = 0;
  let bust = false;
  let bustReason = null;
  let checkout = false;
  let endedAfter = -1;
  const ignored = [];

  for (let i = 0; i < darts.length; i++) {
    if (endedAfter >= 0) {
      ignored.push(i);
      continue;
    }
    const v = dartValue(darts[i]);
    thrown += v;
    const next = rem - v;
    if (next < 0) {
      bust = true;
      bustReason = 'überworfen';
      endedAfter = i;
    } else if (next === 0) {
      if (isFinishingDart(darts[i], outMode)) {
        checkout = true;
        rem = 0;
      } else {
        bust = true;
        bustReason = outMode === 'double' ? 'nicht mit einem Doppel beendet' : 'nicht mit Doppel oder Triple beendet';
      }
      endedAfter = i;
    } else if (next < minFinish(outMode)) {
      bust = true;
      bustReason = 'Rest 1 ist nicht checkbar';
      endedAfter = i;
    } else {
      rem = next;
    }
  }

  const remainingAfter = bust ? remaining : rem;
  return {
    darts: darts.map((d) => ({ ...d })),
    thrown,
    points: bust ? 0 : remaining - remainingAfter,
    bust,
    bustReason,
    checkout,
    remainingBefore: remaining,
    remainingAfter,
    ended: endedAfter >= 0,
    endedAfter,
    ignored,
  };
}

// ------------------------------------------------------------
// Spielverwaltung
// ------------------------------------------------------------

let idCounter = 0;
export function makeId(prefix = 'id') {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Validiert die Spielkonfiguration. Das Spiel darf nur mit eindeutig festgelegter
 * Reihenfolge und bestätigtem ersten Spieler beginnen.
 */
export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['Keine Konfiguration angegeben.'];
  const { players, order, startingPlayerId, startScore, dartsPerTurn, outMode, orderConfirmed } = config;

  if (!Array.isArray(players) || players.length < 1) errors.push('Mindestens ein Spieler wird benötigt.');
  else if (players.length > 12) errors.push('Maximal 12 Spieler.');
  else {
    const names = new Set();
    players.forEach((p, i) => {
      const n = (p.name || '').trim();
      if (!n) errors.push(`Spieler ${i + 1} hat keinen Namen.`);
      const key = n.toLowerCase();
      if (n && names.has(key)) errors.push(`Der Name „${n}“ ist doppelt vergeben.`);
      names.add(key);
      if (!p.id) errors.push(`Spieler ${i + 1} hat keine ID.`);
    });
  }
  if (!Number.isInteger(startScore) || startScore < 2 || startScore > 9999) {
    errors.push('Der Startwert muss eine ganze Zahl zwischen 2 und 9999 sein.');
  }
  if (dartsPerTurn !== 3 && dartsPerTurn !== 6) errors.push('Pfeile pro Aufnahme: 3 oder 6.');
  if (!OUT_MODES[outMode]) errors.push('Out-Modus muss single, double oder master sein.');

  if (Array.isArray(players) && Array.isArray(order)) {
    const ids = new Set(players.map((p) => p.id));
    const orderSet = new Set(order);
    if (order.length !== players.length || orderSet.size !== order.length || order.some((id) => !ids.has(id))) {
      errors.push('Die Reihenfolge muss jeden Spieler genau einmal enthalten.');
    }
  } else {
    errors.push('Die Reihenfolge fehlt.');
  }
  if (!startingPlayerId || !Array.isArray(order) || !order.includes(startingPlayerId)) {
    errors.push('Es muss festgelegt werden, wer beginnt.');
  }
  if (orderConfirmed !== true) errors.push('Reihenfolge und erster Spieler müssen bestätigt werden.');
  return errors;
}

export function createGame(config, { id, now } = {}) {
  const errors = validateConfig(config);
  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.validationErrors = errors;
    throw err;
  }
  return {
    id: id || makeId('game'),
    createdAt: now ?? Date.now(),
    config: structuredCloneSafe(config),
    events: [],
  };
}

function structuredCloneSafe(v) {
  return JSON.parse(JSON.stringify(v));
}

/** Tatsächliche Wurfreihenfolge: beginnt mit dem Startspieler, dann reihum. */
export function effectiveOrder(config) {
  const { order, startingPlayerId } = config;
  const start = order.indexOf(startingPlayerId);
  return order.slice(start).concat(order.slice(0, start));
}

export function nextPlayerId(config, playerId) {
  const { order } = config;
  const i = order.indexOf(playerId);
  return order[(i + 1) % order.length];
}

function emptyStats() {
  return {
    turns: 0,
    darts: 0,
    pointsScored: 0,
    highestTurn: 0,
    busts: 0,
    count180: 0,
    count100plus: 0,
    count140plus: 0,
    checkout: null,
  };
}

/**
 * Berechnet den gesamten Spielstand aus der Ereignisliste.
 * Ereignistypen:
 *   { type: 'turn', id, playerId, darts: [...] }
 *   { type: 'setNext', id, playerId }   – manuelle Korrektur, wer als Nächstes wirft
 */
export function computeState(game) {
  const { config } = game;
  const players = {};
  config.players.forEach((p) => {
    players[p.id] = {
      id: p.id,
      name: p.name,
      nickname: p.nickname || '',
      remaining: config.startScore,
      stats: emptyStats(),
    };
  });

  let active = config.startingPlayerId;
  let finished = false;
  let winnerId = null;
  const log = [];
  const orphaned = [];
  let round = 1;
  let turnsInRound = 0;
  const playerCount = config.order.length;
  const eff = effectiveOrder(config);
  // Wer die wenigsten Aufnahmen hat, ist dran; bei Gleichstand gilt die feste Reihenfolge ab Startspieler.
  // So bleibt die Reihenfolge auch nach Umbuchungen (vertauschte Spieler) korrekt.
  const pickNext = () => {
    let best = eff[0];
    for (const id of eff) if (players[id].stats.turns < players[best].stats.turns) best = id;
    return best;
  };

  game.events.forEach((ev, index) => {
    if (finished) {
      orphaned.push(index);
      return;
    }
    if (ev.type === 'setNext') {
      active = ev.playerId;
      log.push({ index, type: 'setNext', playerId: ev.playerId, id: ev.id });
      return;
    }
    if (ev.type !== 'turn') return;
    const p = players[ev.playerId];
    if (!p) throw new Error(`Unbekannter Spieler im Verlauf: ${ev.playerId}`);
    const result = scoreTurn(p.remaining, ev.darts, config.outMode, config.dartsPerTurn);
    const s = p.stats;
    s.turns += 1;
    s.darts += result.ended ? result.endedAfter + 1 : ev.darts.length;
    s.pointsScored += result.points;
    s.highestTurn = Math.max(s.highestTurn, result.points);
    if (result.bust) s.busts += 1;
    if (result.points === 180) s.count180 += 1;
    if (result.points >= 100) s.count100plus += 1;
    if (result.points >= 140) s.count140plus += 1;
    p.remaining = result.remainingAfter;
    log.push({
      index,
      type: 'turn',
      id: ev.id,
      playerId: ev.playerId,
      round,
      outOfTurn: ev.playerId !== active,
      ...result,
    });
    turnsInRound += 1;
    if (turnsInRound >= playerCount) {
      round += 1;
      turnsInRound = 0;
    }
    if (result.checkout) {
      s.checkout = result.points;
      finished = true;
      winnerId = p.id;
      active = null;
    } else {
      active = pickNext();
    }
  });

  const list = config.order.map((id) => players[id]);
  list.forEach((p) => {
    const s = p.stats;
    s.average = s.turns ? round2(s.pointsScored / s.turns) : 0; // Ø pro Aufnahme
    s.threeDartAverage = s.darts ? round2((s.pointsScored / s.darts) * 3) : 0;
  });

  return {
    players: list,
    byId: players,
    activePlayerId: active,
    finished,
    winnerId,
    log,
    orphaned,
    round,
    standings: standings(list),
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

/** Platzierung nach Restpunkten (weniger ist besser). Gleichstand = gleicher Platz. */
export function standings(playerList) {
  const sorted = [...playerList].sort((a, b) => a.remaining - b.remaining);
  const ranks = {};
  sorted.forEach((p, i) => {
    if (i > 0 && p.remaining === sorted[i - 1].remaining) ranks[p.id] = ranks[sorted[i - 1].id];
    else ranks[p.id] = i + 1;
  });
  return { order: sorted.map((p) => p.id), ranks };
}

/** Vorschau einer (noch nicht gebuchten) Aufnahme für den aktiven Spieler. */
export function previewTurn(game, darts) {
  const state = computeState(game);
  if (state.finished) throw new Error('Das Spiel ist bereits beendet.');
  const p = state.byId[state.activePlayerId];
  return scoreTurn(p.remaining, darts, game.config.outMode, game.config.dartsPerTurn);
}

/**
 * Bucht eine Aufnahme für den aktuell aktiven Spieler.
 * Gibt ein NEUES Spielobjekt zurück (unveränderlich), plus Ergebnis und Zustände.
 */
export function addTurn(game, darts, { id } = {}) {
  const before = computeState(game);
  if (before.finished) throw new Error('Das Spiel ist bereits beendet.');
  const playerId = before.activePlayerId;
  // validiert Pfeilanzahl und Werte, wirft bei Fehlern
  scoreTurn(before.byId[playerId].remaining, darts, game.config.outMode, game.config.dartsPerTurn);
  const event = { type: 'turn', id: id || makeId('turn'), playerId, darts: darts.map((d) => ({ mult: d.mult, value: d.value })) };
  const next = { ...game, events: [...game.events, event] };
  const after = computeState(next);
  const result = after.log[after.log.length - 1];
  return { game: next, result, before, after };
}

/** Macht das letzte Ereignis rückgängig. */
export function undoLast(game) {
  if (!game.events.length) return { game, removed: null };
  const removed = game.events[game.events.length - 1];
  return { game: { ...game, events: game.events.slice(0, -1) }, removed };
}

function findEventIndex(game, eventId) {
  const i = game.events.findIndex((e) => e.id === eventId);
  if (i < 0) throw new Error('Eintrag nicht gefunden.');
  return i;
}

/**
 * Korrigiert eine bereits gebuchte Aufnahme (Werte und/oder Spielerzuordnung).
 * Der Spielstand wird vollständig neu berechnet. Falls durch die Korrektur das
 * Spiel früher endet, werden die betroffenen späteren Einträge in `orphaned`
 * gemeldet und nur mit dropOrphans=true entfernt.
 */
export function editTurn(game, eventId, { darts, playerId } = {}, { dropOrphans = false } = {}) {
  const index = findEventIndex(game, eventId);
  const old = game.events[index];
  if (old.type !== 'turn') throw new Error('Nur Aufnahmen können korrigiert werden.');
  const updated = { ...old };
  if (darts) {
    if (darts.length > game.config.dartsPerTurn) {
      throw new Error(`Zu viele Pfeile: ${darts.length} statt maximal ${game.config.dartsPerTurn}.`);
    }
    darts.forEach((d, i) => {
      if (!isValidDart(d)) throw new Error(`Pfeil ${i + 1} ist ungültig.`);
    });
    updated.darts = darts.map((d) => ({ mult: d.mult, value: d.value }));
  }
  if (playerId) {
    if (!game.config.order.includes(playerId)) throw new Error('Unbekannter Spieler.');
    updated.playerId = playerId;
  }
  const events = game.events.slice();
  events[index] = updated;
  let next = { ...game, events };
  const state = computeState(next);
  if (state.orphaned.length) {
    if (!dropOrphans) return { game, state: computeState(game), orphaned: state.orphaned, applied: false };
    next = { ...next, events: next.events.filter((_, i) => !state.orphaned.includes(i)) };
  }
  return { game: next, state: computeState(next), orphaned: state.orphaned, applied: true };
}

/** Tauscht die Spielerzuordnung zweier Aufnahmen (z. B. versehentlich vertauschte Spieler). */
export function swapTurnPlayers(game, eventIdA, eventIdB, opts = {}) {
  const a = game.events[findEventIndex(game, eventIdA)];
  const b = game.events[findEventIndex(game, eventIdB)];
  if (a.type !== 'turn' || b.type !== 'turn') throw new Error('Nur Aufnahmen können getauscht werden.');
  const step1 = editTurn(game, eventIdA, { playerId: b.playerId }, { dropOrphans: true });
  return editTurn(step1.game, eventIdB, { playerId: a.playerId }, opts);
}

/** Löscht eine einzelne Aufnahme aus dem Verlauf. */
export function deleteEvent(game, eventId) {
  const index = findEventIndex(game, eventId);
  return { ...game, events: game.events.filter((_, i) => i !== index) };
}

/** Legt manuell fest, wer als Nächstes wirft (wird als Ereignis protokolliert). */
export function setNextPlayer(game, playerId) {
  if (!game.config.order.includes(playerId)) throw new Error('Unbekannter Spieler.');
  const state = computeState(game);
  if (state.finished) throw new Error('Das Spiel ist bereits beendet.');
  if (state.activePlayerId === playerId) return game;
  return { ...game, events: [...game.events, { type: 'setNext', id: makeId('next'), playerId }] };
}

// ------------------------------------------------------------
// Checkout-Wege
// ------------------------------------------------------------

const ALL_DARTS = (() => {
  const list = [];
  for (let v = 20; v >= 1; v--) list.push({ mult: 3, value: v });
  for (let v = 20; v >= 1; v--) list.push({ mult: 1, value: v });
  list.push({ mult: 1, value: 25 });
  for (let v = 20; v >= 1; v--) list.push({ mult: 2, value: v });
  list.push({ mult: 2, value: 25 });
  return list;
})();

const DOUBLE_PREF = [20, 16, 18, 12, 10, 8, 14, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 25];
function finisherRank(d) {
  if (d.mult === 2) return DOUBLE_PREF.indexOf(d.value);
  if (d.mult === 3) return 30 + (20 - d.value);
  return 60 + (d.value === 25 ? 0 : 20 - d.value);
}
function setupRank(d) {
  // Einfache Felder zum Stellen sind beliebt, Triple 20/19 zum Punkten
  if (d.mult === 3) return 20 - d.value + (d.value >= 17 ? 0 : 10);
  if (d.mult === 1) return d.value === 25 ? 35 : 5 + (20 - d.value);
  return 40 + (d.value === 25 ? 0 : 20 - d.value);
}

const checkoutCache = new Map();

/** Liefert einen sinnvollen Checkout-Weg (Liste von Darts) oder null. */
export function checkoutSuggestion(remaining, outMode, dartsLeft = 3) {
  const key = `${remaining}|${outMode}|${dartsLeft}`;
  if (checkoutCache.has(key)) return checkoutCache.get(key);
  let best = null;
  let bestScore = Infinity;
  const finishers = ALL_DARTS.filter((d) => isFinishingDart(d, outMode));
  const consider = (route) => {
    const last = route[route.length - 1];
    let score = route.length * 1000 + finisherRank(last) * 3;
    for (let i = 0; i < route.length - 1; i++) score += setupRank(route[i]);
    if (score < bestScore) {
      bestScore = score;
      best = route;
    }
  };
  if (remaining >= 1 && remaining <= 180 && dartsLeft >= 1) {
    for (const f of finishers) if (dartValue(f) === remaining) consider([f]);
    if (dartsLeft >= 2) {
      for (const a of ALL_DARTS) {
        const r = remaining - dartValue(a);
        if (r < minFinish(outMode)) continue;
        for (const f of finishers) if (dartValue(f) === r) consider([a, f]);
      }
    }
    if (dartsLeft >= 3 && !best) {
      for (const a of ALL_DARTS) {
        const r1 = remaining - dartValue(a);
        if (r1 < minFinish(outMode) + 1) continue;
        for (const b of ALL_DARTS) {
          const r2 = r1 - dartValue(b);
          if (r2 < minFinish(outMode)) continue;
          for (const f of finishers) if (dartValue(f) === r2) consider([a, b, f]);
        }
      }
    }
  }
  checkoutCache.set(key, best);
  return best;
}
