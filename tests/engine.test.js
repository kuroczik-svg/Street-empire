import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  dart, dartValue, isValidDart, scoreTurn, createGame, computeState, addTurn, undoLast,
  editTurn, swapTurnPlayers, setNextPlayer, effectiveOrder, validateConfig, checkoutSuggestion,
  isFinishingDart, deleteEvent,
} from '../src/engine.js';

const S = (v) => dart(1, v);
const D = (v) => dart(2, v);
const T = (v) => dart(3, v);
const MISS = dart(0, 0);
const BULL = dart(1, 25);
const BULLSEYE = dart(2, 25);

function makeGame(overrides = {}) {
  const players = [
    { id: 'lukas', name: 'Lukas' },
    { id: 'wowa', name: 'Wowa' },
    { id: 'markus', name: 'Markus' },
  ];
  return createGame({
    players,
    order: ['lukas', 'wowa', 'markus'],
    startingPlayerId: 'lukas',
    startScore: 301,
    dartsPerTurn: 3,
    outMode: 'double',
    orderConfirmed: true,
    ...overrides,
  }, { id: 'g1', now: 0 });
}

describe('Dart-Werte', () => {
  test('Addition einfacher Felder', () => {
    assert.equal([S(17), S(2), S(4)].reduce((a, d) => a + dartValue(d), 0), 23);
    assert.equal([S(18), S(18), S(20)].reduce((a, d) => a + dartValue(d), 0), 56);
  });
  test('Double und Triple', () => {
    assert.equal(dartValue(D(20)), 40);
    assert.equal(dartValue(T(13)), 39);
    assert.equal(dartValue(T(16)), 48);
    assert.equal(dartValue(T(20)), 60);
    assert.equal([S(17), S(2), T(13)].reduce((a, d) => a + dartValue(d), 0), 58);
    assert.equal([D(20), S(5), S(12)].reduce((a, d) => a + dartValue(d), 0), 57);
  });
  test('Bull und Bullseye', () => {
    assert.equal(dartValue(BULL), 25);
    assert.equal(dartValue(BULLSEYE), 50);
  });
  test('ungültige Felder werden abgelehnt', () => {
    assert.equal(isValidDart({ mult: 3, value: 25 }), false);
    assert.equal(isValidDart({ mult: 1, value: 21 }), false);
    assert.equal(isValidDart({ mult: 2, value: 0 }), false);
    assert.equal(isValidDart({ mult: 4, value: 5 }), false);
    assert.throws(() => dart(3, 25));
  });
  test('Finish-Felder je Out-Modus', () => {
    assert.equal(isFinishingDart(D(10), 'double'), true);
    assert.equal(isFinishingDart(BULLSEYE, 'double'), true);
    assert.equal(isFinishingDart(T(10), 'double'), false);
    assert.equal(isFinishingDart(T(10), 'master'), true);
    assert.equal(isFinishingDart(S(10), 'master'), false);
    assert.equal(isFinishingDart(S(10), 'single'), true);
  });
});

describe('Aufnahme-Wertung', () => {
  test('Beispiel aus dem Auftrag: 243 − (17+2+4) = 220', () => {
    const r = scoreTurn(243, [S(17), S(2), S(4)], 'double', 3);
    assert.equal(r.points, 23);
    assert.equal(r.remainingAfter, 220);
    assert.equal(r.bust, false);
  });
  test('Bust durch Überwerfen: Stand vom Beginn der Aufnahme bleibt', () => {
    const r = scoreTurn(40, [S(20), S(19), D(1)], 'double', 3);
    assert.equal(r.bust, true);
    assert.equal(r.remainingAfter, 40);
    assert.equal(r.points, 0);
    assert.equal(r.bustReason, 'Rest 1 ist nicht checkbar');
  });
  test('Bust bei Rest 1 im Double-Out', () => {
    const r = scoreTurn(21, [S(20)], 'double', 3);
    assert.equal(r.bust, true);
    assert.equal(r.remainingAfter, 21);
  });
  test('Rest 1 ist im Single-Out erlaubt', () => {
    const r = scoreTurn(21, [S(20), MISS, MISS], 'single', 3);
    assert.equal(r.bust, false);
    assert.equal(r.remainingAfter, 1);
  });
  test('Bust: auf 0 ohne Doppel im Double-Out', () => {
    const r = scoreTurn(40, [S(20), S(20)], 'double', 3);
    assert.equal(r.bust, true);
    assert.equal(r.remainingAfter, 40);
  });
  test('Überwurf beendet die Aufnahme, weitere Pfeile werden ignoriert', () => {
    const r = scoreTurn(30, [T(20), S(5), S(5)], 'double', 3);
    assert.equal(r.bust, true);
    assert.deepEqual(r.ignored, [1, 2]);
    assert.equal(r.remainingAfter, 30);
  });
  test('Checkout mit Doppel', () => {
    const r = scoreTurn(40, [D(20)], 'double', 3);
    assert.equal(r.checkout, true);
    assert.equal(r.remainingAfter, 0);
    assert.equal(r.points, 40);
  });
  test('Checkout mit Bullseye im Double-Out', () => {
    const r = scoreTurn(110, [T(20), BULLSEYE], 'double', 3);
    assert.equal(r.checkout, true);
  });
  test('Master-Out: Triple zum Schluss erlaubt, Single nicht', () => {
    assert.equal(scoreTurn(60, [T(20)], 'master', 3).checkout, true);
    assert.equal(scoreTurn(20, [S(20)], 'master', 3).bust, true);
  });
  test('Single-Out: jedes Feld checkt aus', () => {
    assert.equal(scoreTurn(20, [S(20)], 'single', 3).checkout, true);
  });
  test('Mehr Pfeile als vereinbart werden abgelehnt', () => {
    assert.throws(() => scoreTurn(301, [S(1), S(1), S(1), S(1)], 'double', 3), /Zu viele Pfeile/);
    assert.doesNotThrow(() => scoreTurn(301, [S(1), S(1), S(1), S(1), S(1), S(1)], 'double', 6));
    assert.throws(() => scoreTurn(301, Array(7).fill(S(1)), 'double', 6), /Zu viele Pfeile/);
  });
});

describe('Spielvorbereitung', () => {
  test('Spiel startet nur mit bestätigter Reihenfolge und Startspieler', () => {
    const base = {
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      order: ['a', 'b'],
      startingPlayerId: 'b',
      startScore: 301,
      dartsPerTurn: 3,
      outMode: 'double',
      orderConfirmed: true,
    };
    assert.deepEqual(validateConfig(base), []);
    assert.throws(() => createGame({ ...base, orderConfirmed: false }), /bestätigt/);
    assert.throws(() => createGame({ ...base, startingPlayerId: null }), /beginnt/);
    assert.throws(() => createGame({ ...base, order: ['a'] }), /Reihenfolge/);
    assert.throws(() => createGame({ ...base, players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'a' }] }), /doppelt/);
    assert.throws(() => createGame({ ...base, dartsPerTurn: 4 }), /3 oder 6/);
  });
  test('Effektive Reihenfolge beginnt beim Startspieler', () => {
    const g = makeGame({ startingPlayerId: 'wowa' });
    assert.deepEqual(effectiveOrder(g.config), ['wowa', 'markus', 'lukas']);
    assert.equal(computeState(g).activePlayerId, 'wowa');
  });
});

describe('Spielablauf', () => {
  test('Spielerwechsel nach jeder Aufnahme, reihum', () => {
    let g = makeGame();
    assert.equal(computeState(g).activePlayerId, 'lukas');
    g = addTurn(g, [S(20), S(20), S(20)]).game;
    assert.equal(computeState(g).activePlayerId, 'wowa');
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    assert.equal(computeState(g).activePlayerId, 'markus');
    g = addTurn(g, [S(5), S(5), S(5)]).game;
    const st = computeState(g);
    assert.equal(st.activePlayerId, 'lukas');
    assert.equal(st.byId.lukas.remaining, 241);
    assert.equal(st.byId.wowa.remaining, 298);
    assert.equal(st.byId.markus.remaining, 286);
    assert.equal(st.round, 2);
  });
  test('Spielerwechsel auch nach Bust', () => {
    let g = makeGame({ startScore: 40 });
    g = addTurn(g, [S(20), S(20), S(1)]).game;
    const st = computeState(g);
    assert.equal(st.byId.lukas.remaining, 40);
    assert.equal(st.activePlayerId, 'wowa');
    assert.equal(st.byId.lukas.stats.busts, 1);
  });
  test('Checkout beendet das Spiel und erkennt den Sieger', () => {
    let g = makeGame({ startScore: 40 });
    const r = addTurn(g, [D(20)]);
    assert.equal(r.result.checkout, true);
    assert.equal(r.after.finished, true);
    assert.equal(r.after.winnerId, 'lukas');
    assert.equal(r.after.activePlayerId, null);
    assert.throws(() => addTurn(r.game, [S(1)]), /beendet/);
  });
  test('Statistik: Durchschnitt pro Aufnahme, höchster Wurf, 180er', () => {
    let g = makeGame({ startScore: 501 });
    g = addTurn(g, [T(20), T(20), T(20)]).game; // lukas 180
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    g = addTurn(g, [S(20), S(20), S(20)]).game; // lukas 60
    const s = computeState(g).byId.lukas.stats;
    assert.equal(s.turns, 2);
    assert.equal(s.average, 120);
    assert.equal(s.highestTurn, 180);
    assert.equal(s.count180, 1);
    assert.equal(s.threeDartAverage, 120);
  });
});

describe('Korrekturen', () => {
  test('Rückgängig stellt den Stand exakt wieder her', () => {
    let g = makeGame();
    g = addTurn(g, [S(17), S(2), S(4)]).game;
    const { game: g2, removed } = undoLast(g);
    assert.equal(removed.playerId, 'lukas');
    const st = computeState(g2);
    assert.equal(st.byId.lukas.remaining, 301);
    assert.equal(st.activePlayerId, 'lukas');
  });
  test('Korrektur einer alten Aufnahme zieht nicht doppelt ab', () => {
    let g = makeGame();
    g = addTurn(g, [S(20), S(20), S(20)]).game; // lukas 241 (falsch erkannt, war T20 T20 T20 → 121)
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    g = addTurn(g, [S(5), S(5), S(5)]).game;
    g = addTurn(g, [S(10), S(10), S(10)]).game; // lukas 211
    const firstId = g.events[0].id;
    const res = editTurn(g, firstId, { darts: [T(20), T(20), T(20)] });
    assert.equal(res.applied, true);
    const st = computeState(res.game);
    assert.equal(st.byId.lukas.remaining, 301 - 180 - 30);
    // nochmal dieselbe Korrektur: Ergebnis bleibt identisch (idempotent)
    const res2 = editTurn(res.game, firstId, { darts: [T(20), T(20), T(20)] });
    assert.equal(computeState(res2.game).byId.lukas.remaining, 91);
    assert.equal(res.game.events.length, 4);
  });
  test('Korrektur kann eine spätere Aufnahme zum Bust machen – alles wird neu berechnet', () => {
    let g = makeGame({ startScore: 101 });
    g = addTurn(g, [S(20), S(20), S(1)]).game; // lukas 60
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    g = addTurn(g, [S(20), S(20), S(18)]).game; // lukas 2
    assert.equal(computeState(g).byId.lukas.remaining, 2);
    const res = editTurn(g, g.events[0].id, { darts: [T(20), S(20), S(1)] }); // lukas 20 → später 58 > 20 → bust
    const st = computeState(res.game);
    assert.equal(st.byId.lukas.remaining, 20);
    assert.equal(st.log[3].bust, true);
  });
  test('Korrektur, durch die das Spiel früher endet, braucht Bestätigung', () => {
    let g = makeGame({ startScore: 101 });
    g = addTurn(g, [S(20), S(20), S(1)]).game; // lukas 60
    g = addTurn(g, [S(1), S(1), S(1)]).game; // wowa 98
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    g = addTurn(g, [S(1), S(1), S(1)]).game; // lukas 57
    // Wowas Aufnahme war in Wahrheit ein Checkout (T20, 1, D20 = 101)
    const wowaId = g.events[1].id;
    const res = editTurn(g, wowaId, { darts: [T(20), S(1), D(20)] });
    assert.equal(res.applied, false);
    assert.deepEqual(res.orphaned, [2, 3]);
    assert.equal(res.game, g);
    const forced = editTurn(g, wowaId, { darts: [T(20), S(1), D(20)] }, { dropOrphans: true });
    const st = computeState(forced.game);
    assert.equal(st.finished, true);
    assert.equal(st.winnerId, 'wowa');
    assert.equal(forced.game.events.length, 2);
  });
  test('Korrektur der Spielerzuordnung: vertauschte Spieler', () => {
    let g = makeGame();
    g = addTurn(g, [T(20), T(20), T(20)]).game; // als Lukas gebucht – war Wowa
    g = addTurn(g, [S(1), S(1), S(1)]).game; // als Wowa gebucht – war Lukas
    const [a, b] = g.events;
    const res = swapTurnPlayers(g, a.id, b.id);
    const st = computeState(res.game);
    assert.equal(st.byId.wowa.remaining, 121);
    assert.equal(st.byId.lukas.remaining, 298);
    // Lukas und Wowa haben je eine Aufnahme – Markus ist dran
    assert.equal(st.activePlayerId, 'markus');
  });
  test('Spielerzuordnung einzeln ändern und nächsten Spieler manuell festlegen', () => {
    let g = makeGame();
    g = addTurn(g, [S(20), S(20), S(20)]).game;
    const res = editTurn(g, g.events[0].id, { playerId: 'markus' });
    let st = computeState(res.game);
    assert.equal(st.byId.markus.remaining, 241);
    assert.equal(st.byId.lukas.remaining, 301);
    assert.equal(st.log[0].outOfTurn, true);
    // Markus hat schon geworfen, Lukas noch nicht → Lukas ist dran
    assert.equal(st.activePlayerId, 'lukas');
    const g2 = setNextPlayer(res.game, 'wowa');
    st = computeState(g2);
    assert.equal(st.activePlayerId, 'wowa');
    assert.equal(computeState(undoLast(g2).game).activePlayerId, 'lukas');
    // nach Wowas Aufnahme ist wieder Lukas (wenigste Aufnahmen) dran
    assert.equal(computeState(addTurn(g2, [S(1), S(1), S(1)]).game).activePlayerId, 'lukas');
  });
  test('Einzelne Aufnahme löschen', () => {
    let g = makeGame();
    g = addTurn(g, [S(20), S(20), S(20)]).game;
    g = addTurn(g, [S(1), S(1), S(1)]).game;
    const g2 = deleteEvent(g, g.events[0].id);
    assert.equal(computeState(g2).byId.lukas.remaining, 301);
    assert.equal(computeState(g2).byId.wowa.remaining, 298);
  });
  test('Korrektur mit zu vielen Pfeilen wird abgelehnt', () => {
    let g = makeGame();
    g = addTurn(g, [S(20), S(20), S(20)]).game;
    assert.throws(() => editTurn(g, g.events[0].id, { darts: [S(1), S(1), S(1), S(1)] }), /Zu viele/);
  });
});

describe('Checkout-Wege', () => {
  test('liefert gültige Wege, die exakt aufgehen und mit Doppel enden', () => {
    for (let r = 2; r <= 170; r++) {
      const route = checkoutSuggestion(r, 'double', 3);
      if ([159, 162, 163, 165, 166, 168, 169].includes(r)) {
        assert.equal(route, null, `kein Checkout für ${r}`);
        continue;
      }
      assert.ok(route, `Weg für ${r}`);
      assert.equal(route.reduce((a, d) => a + dartValue(d), 0), r);
      assert.equal(isFinishingDart(route[route.length - 1], 'double'), true);
    }
    assert.equal(checkoutSuggestion(171, 'double', 3), null);
    assert.equal(checkoutSuggestion(1, 'double', 3), null);
  });
  test('bevorzugt kurze Wege', () => {
    assert.equal(checkoutSuggestion(40, 'double').length, 1);
    assert.equal(checkoutSuggestion(170, 'double').length, 3);
    assert.deepEqual(checkoutSuggestion(170, 'double').map((d) => d.mult * d.value), [60, 60, 50]);
  });
});
