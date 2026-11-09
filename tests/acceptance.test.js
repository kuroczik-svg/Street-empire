// Abnahmetest (Punkt 11 des Auftrags):
// Komplettes Spiel mit Lukas, Wowa und Markus, 301, Double-Out, 3 Pfeile,
// vorher bestätigte Reihenfolge. Getestet werden normale Würfe, Double/Triple,
// Hintergrundgespräche, unvollständige Ansagen, vertauschte Spieler,
// Korrekturen, Bust und Sieg – über dieselbe GameSession, die auch die App nutzt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dart } from '../src/engine.js';
import { GameSession } from '../src/session.js';
import { Commentator } from '../src/commentator.js';
import { FORBIDDEN } from './commentator.test.js';

function seeded(seed = 2026) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

test('Abnahmetest: Lukas, Wowa und Markus spielen 301 Double-Out', () => {
  // --- Spielvorbereitung: Reihenfolge muss bestätigt sein ---
  const config = {
    players: [
      { id: 'lukas', name: 'Lukas' },
      { id: 'wowa', name: 'Wowa' },
      { id: 'markus', name: 'Markus' },
    ],
    order: ['lukas', 'wowa', 'markus'],
    startingPlayerId: 'lukas',
    startScore: 301,
    dartsPerTurn: 3,
    outMode: 'double',
    orderConfirmed: false,
  };
  assert.throws(() => createGame(config), /bestätigt/, 'ohne Bestätigung kein Spielstart');
  const game = createGame({ ...config, orderConfirmed: true });

  for (const humor of ['freundlich', 'frech', 'gnadenlos']) {
    const s = new GameSession(game, { commentator: new Commentator({ humor, rng: seeded() }) });
    const announcements = [];
    const rest = () => Object.fromEntries(s.state.players.map((p) => [p.id, p.remaining]));
    const active = () => s.state.activePlayerId;

    const say = (text) => {
      const r = s.input(text);
      if (r.action === 'committed') {
        announcements.push(r);
        checkAnnouncement(r, s);
      }
      return r;
    };

    // ===== Runde 1 =====
    assert.equal(active(), 'lukas');
    let r = say('Triple 20, 20, 19'); // 99
    assert.equal(r.action, 'committed', 'eindeutige Ansage wird sofort gebucht – keine Rückfrage');
    assert.equal(r.result.points, 99);
    assert.deepEqual(rest(), { lukas: 202, wowa: 301, markus: 301 });
    assert.equal(active(), 'wowa');

    // Hintergrundgespräch mit Zahlen – darf NICHT zählen
    r = say('Wer will noch ein Bier? Ich nehm zwei');
    assert.equal(r.action, 'ignore');
    assert.deepEqual(rest(), { lukas: 202, wowa: 301, markus: 301 });
    assert.equal(active(), 'wowa');
    assert.equal(s.pending.length, 0);

    r = say('Doppel 20, 5, 12'); // 57
    assert.equal(r.result.points, 57);
    assert.equal(rest().wowa, 244);

    // Sprachbefehl „rückgängig“ und erneute Ansage – kein doppelter Abzug
    r = say('rückgängig');
    assert.equal(r.action, 'undone');
    assert.equal(rest().wowa, 301);
    assert.equal(active(), 'wowa');
    r = say('Doppel 20, 5, 12');
    assert.equal(rest().wowa, 244);
    assert.equal(active(), 'markus');

    // Unvollständige Ansage → gezielte Nachfrage
    r = say('17, 2');
    assert.equal(r.action, 'wait');
    assert.match(r.message, /dritte Pfeil/);
    assert.equal(rest().markus, 301, 'noch nichts abgezogen');
    // Zwischendurch Gerede – wird ignoriert, angefangene Aufnahme bleibt erhalten
    r = say('Boah Markus, schon wieder so ein Ding');
    assert.equal(r.action, 'ignore');
    assert.equal(s.pending.length, 2);
    r = say('4');
    assert.equal(r.action, 'committed');
    assert.equal(r.result.points, 23);
    assert.equal(rest().markus, 278);
    assert.equal(active(), 'lukas');

    // ===== Runde 2 =====
    // Mehrdeutiges „Bull“ → Rückfrage statt Raten
    r = say('Triple 20, Triple 20, Bull');
    assert.equal(r.action, 'ask');
    assert.match(r.message, /25|50/);
    assert.equal(rest().lukas, 202);
    r = say('Triple 20, Triple 20, Bullseye'); // 170
    assert.equal(r.result.points, 170);
    assert.equal(rest().lukas, 32);

    // Versehentlich vertauschte Spieler: Markus wirft, gebucht wird aber Wowa ...
    assert.equal(active(), 'wowa');
    const wrong1 = say('18, 18, 20'); // eigentlich Markus: 56
    // ... und danach wirft Wowa, gebucht als Markus
    const wrong2 = say('Triple 19, 19, 1'); // eigentlich Wowa: 77
    assert.deepEqual(rest(), { lukas: 32, wowa: 188, markus: 201 });
    // Korrektur: Zuordnung tauschen → vollständige Neuberechnung
    const swap = s.swapPlayers(s.game.events.at(-2).id, s.game.events.at(-1).id);
    assert.equal(swap.applied, true);
    assert.deepEqual(rest(), { lukas: 32, wowa: 167, markus: 222 });
    assert.equal(active(), 'lukas', 'nach der Korrektur ist eindeutig Lukas dran');
    assert.ok(wrong1 && wrong2);

    // ===== Runde 3 =====
    // Bust: Lukas (32) beendet mit einfacher 2 statt Doppel
    r = say('20, 10, 2');
    assert.equal(r.result.bust, true);
    assert.match(r.announcement.text, /alter Stand bleibt: 32/);
    assert.equal(rest().lukas, 32);
    assert.equal(active(), 'wowa');

    // Falsch erkannt: 7 statt 17 – wird später korrigiert
    r = say('Triple 20, 20, 7'); // 87 (falsch)
    const misheard = s.game.events.at(-1).id;
    assert.equal(rest().wowa, 80);

    // Zu viele Pfeile angesagt → Rückfrage, nichts gebucht
    r = say('1, 2, 3, 4');
    assert.equal(r.action, 'ask');
    assert.equal(rest().markus, 222);
    assert.equal(active(), 'markus');

    r = say('Hundertachtzig!');
    assert.equal(r.result.points, 180);
    assert.match(r.announcement.text, /HUNDERTACHTZIG/);
    assert.equal(rest().markus, 42);

    // Korrektur der falsch erkannten Aufnahme: T20, 20, 17 = 97 → 167 − 97 = 70
    const corr = s.correctTurn(misheard, { darts: [dart(3, 20), dart(1, 20), dart(1, 17)] });
    assert.equal(corr.applied, true);
    assert.deepEqual(rest(), { lukas: 32, wowa: 70, markus: 42 });
    // nochmal dieselbe Korrektur → kein doppelter Abzug
    s.correctTurn(misheard, { darts: [dart(3, 20), dart(1, 20), dart(1, 17)] });
    assert.deepEqual(rest(), { lukas: 32, wowa: 70, markus: 42 });
    assert.equal(active(), 'lukas');

    // ===== Runde 4 =====
    // Unvollständig, dann „Rest daneben“ bestätigt
    r = say('16, 8');
    assert.equal(r.action, 'wait');
    r = s.finishWithMisses();
    assert.equal(r.action, 'committed');
    checkAnnouncement(r, s);
    assert.equal(rest().lukas, 8);
    assert.equal(active(), 'wowa');

    // Manuelle Eingabe: Wowa checkt 70 mit T10, D20 aus (zwei Pfeile reichen)
    r = s.addDart(dart(3, 10));
    assert.equal(r.action, 'wait');
    r = s.addDart(dart(2, 20));
    assert.equal(r.action, 'committed');
    checkAnnouncement(r, s);
    assert.equal(r.result.checkout, true);
    assert.equal(r.finished, true);
    assert.match(r.announcement.text, /WOWA HAT GEWONNEN/);
    const final = s.state;
    assert.equal(final.finished, true);
    assert.equal(final.winnerId, 'wowa');
    assert.deepEqual(rest(), { lukas: 8, wowa: 0, markus: 42 });

    // Nach Spielende wird nichts mehr gebucht
    r = say('20, 20, 20');
    assert.equal(r.action, 'ignore');

    // Statistik plausibel
    assert.equal(final.byId.wowa.stats.checkout, 70);
    assert.equal(final.byId.markus.stats.count180, 1);
    assert.equal(final.byId.lukas.stats.busts, 1);
    assert.equal(final.byId.lukas.stats.highestTurn, 170);

    // Keine Wiederholung des Spruchs in aufeinanderfolgenden Ansagen
    for (let i = 1; i < announcements.length; i++) {
      assert.notEqual(announcements[i].announcement.parts[1], announcements[i - 1].announcement.parts[1]);
    }
  }
});

function checkAnnouncement(r, s) {
  const { announcement: a, result, context } = r;
  for (const f of FORBIDDEN) assert.doesNotMatch(a.text, f, `Füllsatz in: ${a.text}`);
  const st = s.state;
  const p = st.byId[result.playerId];
  assert.ok(a.text.includes(p.name.toUpperCase()) || a.text.includes(p.name), `Name fehlt: ${a.text}`);
  if (!result.checkout) {
    assert.ok(a.text.includes(String(p.remaining)), `Rest ${p.remaining} fehlt: ${a.text}`);
    const next = st.byId[st.activePlayerId];
    assert.ok(a.text.includes(next.name), `Nächster Spieler fehlt: ${a.text}`);
    assert.equal(context.next.id, st.activePlayerId);
  }
  if (!result.bust && !result.checkout && result.points !== 180) {
    assert.ok(a.text.includes(String(result.points)) || (result.points === 100 && /Hundert/.test(a.text)) || (result.points === 0 && /Null/i.test(a.text)), `Punkte fehlen: ${a.text}`);
  }
}
