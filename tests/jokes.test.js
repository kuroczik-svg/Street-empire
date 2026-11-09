// Tests für die Spruch-Bibliothek (Kumpel-Sammlung + FSK-16-Edition)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JOKES, EXTRAS, NEXT_CALLS } from '../src/jokes.js';
import { COMMENT_DATA, fullLibrary } from './helpers.js';
import { Commentator, buildContext, jokeCandidates, LEVEL_POOLS } from '../src/commentator.js';
import { createGame, addTurn, dart, checkoutSuggestion } from '../src/engine.js';
import { GameSession } from '../src/session.js';
import { FORBIDDEN } from './commentator.test.js';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
const text = (e) => (typeof e === 'string' ? e : e.t);
const allEntries = (table) => Object.values(table).flatMap((t) => (Array.isArray(t) ? t : Object.values(t).flat()));

const names3 = [{ id: 'lukas', name: 'Lukas' }, { id: 'wowa', name: 'Wowa' }, { id: 'markus', name: 'Markus' }];
function game(players = names3, over = {}) {
  return createGame({
    players, order: players.map((p) => p.id), startingPlayerId: players[0].id,
    startScore: 301, dartsPerTurn: 3, outMode: 'double', orderConfirmed: true, ...over,
  });
}

describe('Bibliothek', () => {
  test('180er-Sprüche gibt es ausschließlich in der 180er-Kategorie', () => {
    const re = /hundertachtzig|\b180\b|eighty/i;
    for (const [cat, table] of Object.entries(JOKES)) {
      if (cat === 'max') continue;
      for (const e of allEntries(table)) assert.doesNotMatch(text(e), re, `${cat}: ${text(e)}`);
    }
    for (const e of [...allEntries(EXTRAS), ...allEntries(NEXT_CALLS)]) assert.doesNotMatch(text(e), re);
  });
  test('Sprüche enthalten keine festen Punktzahlen – Zahlen kommen aus der Engine', () => {
    const { max, ...rest } = JOKES; // bei der 180 ist „Triple 20“ immer richtig
    for (const e of [...allEntries(rest), ...allEntries(EXTRAS), ...allEntries(NEXT_CALLS)]) {
      assert.doesNotMatch(text(e), /\d{2,}/, text(e));
    }
  });
  test('Jeder Aufruf des nächsten Spielers nennt ihn beim Namen', () => {
    for (const e of allEntries(NEXT_CALLS)) assert.match(text(e), /\{next\}/, text(e));
  });
  test('Sprüche mit „die anderen beiden“ / „zwei“ nur bei genau 3 Spielern', () => {
    for (const e of [...allEntries(JOKES), ...allEntries(EXTRAS), ...allEntries(NEXT_CALLS)]) {
      if (/\bbeiden\b|anderen zwei/.test(text(e))) assert.equal(e.players, 3, text(e));
    }
  });
});

describe('Situationsabhängige Sprüche', () => {
  test('Bust, während ein Gegner kurz vor dem Sieg steht, wird aufgegriffen', () => {
    for (const humor of ['freundlich', 'frech', 'gnadenlos']) {
      let g = game();
      g = addTurn(g, [dart(3, 20), dart(3, 20), dart(3, 20)]).game; // Lukas 121
      g = addTurn(g, [dart(1, 1), dart(1, 1), dart(1, 1)]).game;
      g = addTurn(g, [dart(1, 1), dart(1, 1), dart(1, 1)]).game;
      g = addTurn(g, [dart(3, 20), dart(1, 20), dart(1, 1)]).game; // Lukas 40
      g = addTurn(g, [dart(1, 1), dart(1, 1), dart(1, 1)]).game;
      // Markus 295 → kann nicht überwerfen; daher eigenes Spiel mit kleinem Rest
      const g2 = game(names3, { startScore: 101 });
      let h = addTurn(g2, [dart(3, 20), dart(0, 0), dart(0, 0)]).game; // Lukas 41
      h = addTurn(h, [dart(1, 1), dart(0, 0), dart(0, 0)]).game; // Wowa 100
      const r = addTurn(h, [dart(3, 20), dart(3, 20), dart(0, 0)]); // Markus überwirft (120 > 101)
      const ctx = buildContext(r.before, r.after, r.result, h.config);
      assert.equal(ctx.rivalBust, true);
      assert.equal(ctx.rival.name, 'Lukas');
      const out = new Commentator({ humor, rng: seeded(5), library: fullLibrary() }).comment(ctx);
      assert.match(out.text, /Lukas/, out.text);
      assert.match(out.text, /\b41\b/, out.text);
      assert.ok(g);
    }
  });
  test('Bust-Spruch mit eigener Schlagzeile: kein doppeltes „Bust!“', () => {
    for (let seed = 1; seed < 60; seed++) {
      const c = new Commentator({ humor: 'gnadenlos', rng: seeded(seed), library: fullLibrary() });
      const out = c.comment({
        category: 'bust', bust: true, points: 0, remaining: 32, bustReason: 'nicht mit einem Doppel beendet',
        player: { id: 'l', name: 'Lukas' }, next: { id: 'w', name: 'Wowa', remaining: 200, bestTurn: 0 },
        playerCount: 3, dartsPerTurn: 3, bustDart: { mult: 1, value: 2 },
      });
      const heads = out.text.match(/\b(BUST|Bust|ABGESCHMISSEN|Abgeschmissen|Überworfen)\b/g) || [];
      assert.ok(heads.length <= 1, out.text);
      assert.match(out.text, /Kein Doppel zum Schluss/);
      assert.match(out.text, /alter Stand bleibt: 32/);
    }
  });
});

describe('Zufallstest: viele komplette Spiele', () => {
  test('Ansagen sind immer vollständig, korrekt befüllt und ohne Füllsätze', () => {
    const rnd = seeded(99);
    const rd = (n) => Math.floor(rnd() * n);
    let games = 0;
    for (const humor of ['freundlich', 'frech', 'gnadenlos']) {
      for (const count of [2, 3, 4]) {
        for (let rep = 0; rep < 8; rep++) {
          const players = ['Lukas', 'Wowa', 'Markus', 'Anna'].slice(0, count).map((n) => ({ id: n.toLowerCase(), name: n, nickname: rep % 2 ? '' : `${n}-Maschine` }));
          const s = new GameSession(game(players, { outMode: ['single', 'double', 'master'][rep % 3] }), { commentator: new Commentator({ humor, rng: seeded(rep + 1), library: fullLibrary(), maleWordingOk: rep % 2 === 0 }) });
          for (let i = 0; i < 2000 && !s.state.finished; i++) {
            const me = s.activePlayer;
            const route = me.remaining <= 170 && rnd() < 0.3 ? checkoutSuggestion(me.remaining, s.game.config.outMode, 3) : null;
            const darts = route ? route.slice() : [0, 1, 2].map(() => {
              const roll = rnd();
              if (roll < 0.08) return dart(0, 0);
              if (roll < 0.12) return dart(rd(2) + 1, 25);
              return dart(roll < 0.35 ? 3 : roll < 0.45 ? 2 : 1, rd(20) + 1);
            });
            for (const d of darts) {
              const r = s.addDart(d);
              if (r.action !== 'committed') continue;
              const t = r.announcement.text;
              assert.doesNotMatch(t, /\{|\}|undefined|NaN/, t);
              for (const f of FORBIDDEN) assert.doesNotMatch(t, f, t);
              const st = s.state;
              const p = st.byId[r.result.playerId];
              if (!r.result.checkout) {
                assert.ok(t.includes(String(p.remaining)), `Rest fehlt: ${t}`);
                assert.ok(t.includes(st.byId[st.activePlayerId].name), `Nächster fehlt: ${t}`);
              }
              if (r.result.points !== 180) assert.doesNotMatch(t, /HUNDERTACHTZIG|EIGHTY/i, t);
              else assert.match(t, /HUNDERTACHTZIG/, t);
              // Feste Zahlen aus der Kommentarbibliothek müssen zum echten Spielstand passen
              if (t.includes('Mit 24 Punkten')) assert.equal(r.result.points, 24, t);
              if (t.includes('Noch 34 Punkte bis zum Sieg')) assert.ok(st.players.some((x) => x.remaining === 34 && x.id === st.activePlayerId), t);
              if (/120 Punkte (vorhin|rausgehauen)/.test(t)) assert.ok(st.log.some((l) => l.type === 'turn' && l.points === 120), t);
              if (humor !== 'gnadenlos') assert.doesNotMatch(t, /Scheiße|SCHEISSE|Fresse|verarschen|Hölle/i, t);
              if (count !== 3) assert.doesNotMatch(t, /\bbeiden\b|anderen zwei/, t);
              break;
            }
          }
          assert.equal(s.state.finished, true, 'Spiel muss enden');
          games++;
        }
      }
    }
    assert.equal(games, 72);
  });
});
