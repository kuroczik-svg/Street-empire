import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Commentator, classifyTurn, JOKES, HUMOR_LEVELS, shoutName, buildContext } from '../src/commentator.js';
import { createGame, addTurn, dart } from '../src/engine.js';

export const FORBIDDEN = [/ich rechne/i, /einen moment/i, /ich prüfe/i, /ich berechne/i, /berechne das/i, /moment bitte/i];

function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function ctx(overrides = {}) {
  return {
    category: 'mid',
    player: { id: 'm', name: 'Markus', nickname: '' },
    next: { id: 'l', name: 'Lukas', nickname: '' },
    points: 38,
    remaining: 166,
    bust: false,
    checkout: false,
    leaderChange: false,
    comeback: false,
    lastPlace: false,
    close: null,
    finishRange: false,
    ...overrides,
  };
}

describe('Kategorien', () => {
  test('Einteilung nach Leistung', () => {
    assert.equal(classifyTurn({ points: 0 }), 'zero');
    assert.equal(classifyTurn({ points: 9 }), 'low');
    assert.equal(classifyTurn({ points: 38 }), 'mid');
    assert.equal(classifyTurn({ points: 50 }), 'solid');
    assert.equal(classifyTurn({ points: 85 }), 'good');
    assert.equal(classifyTurn({ points: 100 }), 'ton');
    assert.equal(classifyTurn({ points: 140 }), 'big');
    assert.equal(classifyTurn({ points: 180 }), 'max');
    assert.equal(classifyTurn({ points: 0, bust: true }), 'bust');
    assert.equal(classifyTurn({ points: 40, checkout: true }), 'win');
  });
  test('Jede Kategorie hat Sprüche für jede Humor-Stufe', () => {
    for (const [cat, table] of Object.entries(JOKES)) {
      for (const lvl of ['f', 'c', 'g']) assert.ok(table[lvl].length >= 2, `${cat}/${lvl}`);
    }
  });
});

describe('Ansagen', () => {
  test('enthalten Punkte, Namen, Rest und nächsten Spieler – ohne Füllsätze', () => {
    const c = new Commentator({ rng: seeded() });
    const out = c.comment(ctx());
    assert.match(out.text, /38/);
    assert.match(out.text, /Markus/);
    assert.match(out.text, /166/);
    assert.match(out.text, /Lukas/);
    for (const f of FORBIDDEN) assert.doesNotMatch(out.text, f);
    // Reihenfolge: Punkte vor Rest vor nächstem Spieler
    assert.ok(out.text.indexOf('38') < out.text.indexOf('166'));
    assert.ok(out.text.indexOf('166') < out.text.lastIndexOf('Lukas'));
  });
  test('Bust nennt den alten Stand', () => {
    const c = new Commentator({ rng: seeded() });
    const out = c.comment(ctx({ category: 'bust', bust: true, points: 0, remaining: 40, bustReason: 'überworfen' }));
    assert.match(out.text, /Abgeschmissen|Überworfen|Bust/);
    assert.match(out.text, /alter Stand bleibt: 40/);
  });
  test('Sieg wird groß gefeiert, kein nächster Spieler', () => {
    const c = new Commentator({ rng: seeded(), humor: 'frech' });
    const out = c.comment(ctx({ category: 'win', checkout: true, points: 40, remaining: 0, player: { id: 'w', name: 'Wowa', nickname: '' } }));
    assert.match(out.text, /WOWA HAT GEWONNEN/);
    assert.equal(out.energy, 4);
    assert.doesNotMatch(out.text, /Lukas/);
  });
  test('180 bekommt Sonderbehandlung', () => {
    const c = new Commentator({ rng: seeded() });
    const out = c.comment(ctx({ category: 'max', points: 180, remaining: 121 }));
    assert.match(out.text, /HUNDERTACHTZIG/);
  });
  test('Führungswechsel wird kommentiert', () => {
    const c = new Commentator({ rng: seeded() });
    const out = c.comment(ctx({ leaderChange: true, prevLeader: { id: 'l', name: 'Lukas' } }));
    assert.ok(out.parts.length >= 5);
    assert.match(out.parts[3], /Führung|Thron|vorne|Nummer eins|Führungswechsel|entmachtet/);
  });
  test('Knapper Spielstand nennt den exakten Abstand', () => {
    const c = new Commentator({ rng: seeded() });
    const out = c.comment(ctx({ close: { a: 'Markus', b: 'Lukas', diff: 6 } }));
    assert.match(out.text, /Nur 6 Punkte zwischen Markus und Lukas/);
  });
  test('Keine Wiederholung, solange der Topf nicht erschöpft ist', () => {
    for (const humor of HUMOR_LEVELS) {
      const c = new Commentator({ rng: seeded(7), humor });
      const pools = humor === 'freundlich' ? ['f'] : humor === 'frech' ? ['c', 'f'] : ['g', 'c'];
      const total = pools.reduce((n, k) => n + JOKES.mid[k].length, 0);
      const seen = new Set();
      for (let i = 0; i < total; i++) {
        const out = c.comment(ctx());
        assert.ok(!seen.has(out.parts[1]), `Wiederholung bei ${humor}: ${out.parts[1]}`);
        seen.add(out.parts[1]);
      }
    }
  });
  test('Humor-Stufe freundlich verwendet nur freundliche Sprüche', () => {
    const c = new Commentator({ rng: seeded(3), humor: 'freundlich' });
    for (let i = 0; i < 20; i++) {
      const out = c.comment(ctx({ category: 'low', points: 9 }));
      assert.ok(JOKES.low.f.some((t) => t.replace('{name}', 'Markus') === out.parts[1]), out.parts[1]);
    }
  });
  test('Spitzname wird manchmal benutzt', () => {
    const c = new Commentator({ rng: seeded(11) });
    const texts = Array.from({ length: 10 }, () => c.comment(ctx({ player: { id: 'm', name: 'Markus', nickname: 'Der Hammer' } })).text);
    assert.ok(texts.some((t) => t.includes('Der Hammer')));
  });
});

test('shoutName', () => {
  assert.equal(shoutName('Wowa'), 'WOOOOWAAAA');
});

test('Kontext erkennt Führungswechsel und Aufholjagd', () => {
  let g = createGame({
    players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    order: ['a', 'b', 'c'], startingPlayerId: 'a', startScore: 301, dartsPerTurn: 3, outMode: 'double', orderConfirmed: true,
  });
  const T = (v) => dart(3, v);
  const S = (v) => dart(1, v);
  g = addTurn(g, [S(20), S(20), S(20)]).game; // A 241
  g = addTurn(g, [S(1), S(1), S(1)]).game; // B 298
  const r = addTurn(g, [T(20), T(20), S(1)]); // C 180 → Führung, vorher Letzter
  const c = buildContext(r.before, r.after, r.result, g.config);
  assert.equal(c.leaderChange, true);
  assert.equal(c.prevLeader.name, 'A');
  assert.equal(c.comeback, true);
  assert.equal(c.next.name, 'A');
});
