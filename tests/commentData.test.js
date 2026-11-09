// Tests: Kommentarbibliothek v1.0 (data/comments.de.json) im Zusammenspiel mit der Dart-Engine
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { convertCommentData, tierOf } from '../src/commentData.js';
import { Commentator, buildContext, jokeCandidates, classifyTurn } from '../src/commentator.js';
import { createGame, addTurn, dart } from '../src/engine.js';
import { GameSession } from '../src/session.js';
import { COMMENT_DATA, fullLibrary, seeded } from './helpers.js';

const text = (e) => (typeof e === 'string' ? e : e.t);
const byId = (id) => COMMENT_DATA.comments.find((c) => c.id === id);
const P3 = [{ id: 'lukas', name: 'Lukas' }, { id: 'wowa', name: 'Wowa' }, { id: 'markus', name: 'Markus' }];
const game = (players = P3, over = {}) => createGame({ players, order: players.map((p) => p.id), startingPlayerId: players[0].id, startScore: 301, dartsPerTurn: 3, outMode: 'double', orderConfirmed: true, ...over });
const T = (v) => dart(3, v);
const S = (v) => dart(1, v);
const D = (v) => dart(2, v);
const M = dart(0, 0);
/** Kontext nach einer Folge von Aufnahmen (letzte wird ausgewertet). */
function ctxAfter(turns, g = game()) {
  let r;
  for (const t of turns) {
    r = addTurn(g, t);
    g = r.game;
  }
  return { ctx: buildContext(r.before, r.after, r.result, g.config), game: g };
}
const ids = (table, humor, ctx) => jokeCandidates(table, humor, ctx).map((c) => c.e.id).filter(Boolean);

describe('Datei', () => {
  test('81 Sprüche (31 + 50), alle übersetzbar, keine Fehler', () => {
    const conv = convertCommentData(COMMENT_DATA);
    assert.equal(COMMENT_DATA.comments.length, 81);
    assert.equal(COMMENT_DATA.comments.filter((c) => c.origin === 'original').length, 31);
    assert.equal(COMMENT_DATA.comments.filter((c) => c.origin === 'fsk16').length, 50);
    assert.deepEqual(conv.errors, []);
    assert.equal(conv.count, 81);
    // einzige unbekannte Bedingung: claimMagic (App weiß nicht, ob jemand „zaubern“ angekündigt hat)
    assert.deepEqual(conv.warnings.map((w) => w.split(':')[0]), ['original-08']);
  });
  test('kaputte Datei wird sauber gemeldet', () => {
    assert.equal(convertCommentData({}).ok, false);
    assert.equal(convertCommentData({ schemaVersion: 1, comments: [{ id: 'a', event: 'quatsch', tier: 'any', text: 'x', minHumorLevel: 'frech' }] }).ok, false);
  });
});

describe('Leistungsstufen', () => {
  test('Grenzen 0–25 / 26–59 / 60–99 / 100–179 / 180', () => {
    assert.equal(tierOf(25, 3), 'poor');
    assert.equal(tierOf(26, 3), 'mid');
    assert.equal(tierOf(59, 3), 'mid');
    assert.equal(tierOf(60, 3), 'good');
    assert.equal(tierOf(100, 3), 'excellent');
    assert.equal(tierOf(179, 3), 'excellent');
    assert.equal(tierOf(180, 3), 'perfect180');
  });
  test('6 Pfeile: auf 3 Pfeile normiert, 180 ist KEINE perfekte 180', () => {
    assert.equal(tierOf(180, 6), 'good');
    assert.equal(tierOf(50, 6), 'poor');
    assert.equal(classifyTurn({ points: 180 }, 6), 'good');
    assert.equal(classifyTurn({ points: 180 }, 3), 'max');
    let g = game(P3, { dartsPerTurn: 6, startScore: 501 });
    const r = addTurn(g, [T(20), T(20), T(20), M, M, M]);
    const ctx = buildContext(r.before, r.after, r.result, g.config);
    const out = new Commentator({ humor: 'gnadenlos', rng: seeded(), library: fullLibrary() }).comment(ctx);
    assert.doesNotMatch(out.text, /HUNDERTACHTZIG|EIGHTY/, out.text);
    assert.match(out.text, /180/); // die Punkte werden trotzdem korrekt angesagt
  });
  test('perfekte 180 nur bei echter 180 mit 3 Pfeilen', () => {
    const lib = fullLibrary();
    const { ctx } = ctxAfter([[T(20), T(20), T(20)]]);
    assert.deepEqual(ids(lib.JOKES.max, 'gnadenlos', ctx).sort(), ['fsk16-39', 'fsk16-40']);
    const { ctx: c2 } = ctxAfter([[T(20), T(20), T(19)]]);
    assert.ok(!ids(lib.JOKES.big, 'gnadenlos', c2).some((i) => i === 'fsk16-39' || i === 'fsk16-40'));
  });
});

describe('Ereignis vor Punktzahl & Humor', () => {
  test('bei Bust nur Bust-Sprüche, bei Sieg nur Sieg-Sprüche', () => {
    const lib = fullLibrary();
    const bustIds = new Set(COMMENT_DATA.comments.filter((c) => c.event === 'bust').map((c) => c.id));
    for (const cat of ['zero', 'low', 'mid', 'solid', 'good', 'ton', 'big', 'max']) {
      for (const pool of Object.values(lib.JOKES[cat])) for (const e of pool) assert.ok(!bustIds.has(e.id), `${e.id} in ${cat}`);
    }
    assert.ok(Object.values(lib.JOKES.bust).flat().some((e) => e.id === 'fsk16-41'));
    assert.ok(Object.values(lib.JOKES.win).flat().some((e) => e.id === 'fsk16-48'));
  });
  test('frech: nur ältere Texte (original), gnadenlos: alle; freundlich: keine Bibliothekstexte', () => {
    const lib = fullLibrary();
    const { ctx } = ctxAfter([[S(5), S(1), S(2)]]); // 8 Punkte → poor
    const frech = ids(lib.JOKES.low, 'frech', ctx);
    const gnadenlos = ids(lib.JOKES.low, 'gnadenlos', ctx);
    assert.ok(frech.length && frech.every((i) => i.startsWith('original')));
    assert.ok(gnadenlos.some((i) => i.startsWith('fsk16')) && gnadenlos.some((i) => i.startsWith('original')));
    assert.deepEqual(ids(lib.JOKES.low, 'freundlich', ctx), []);
  });
});

describe('Kontexttreue', () => {
  test('„Mit 24 Punkten holst du Markus …“ nur bei genau 24 Punkten, Markus im Spiel und Gegner kurz vor dem Sieg', () => {
    const lib = fullLibrary();
    const g = game(P3, { startScore: 101 });
    // Markus auf 41 (auscheckbar, ≤ 50), dann Lukas 24 Punkte
    const turns = [[S(1), M, M], [S(1), M, M], [T(20), M, M], [S(20), S(2), S(2)]];
    const { ctx } = ctxAfter(turns, g);
    assert.equal(ctx.points, 24);
    assert.equal(ctx.nearWinOpponent, 'Markus');
    assert.ok(ids(lib.JOKES.low, 'frech', ctx).includes('original-17'));
    const { ctx: c2 } = ctxAfter([[S(1), M, M], [S(1), M, M], [T(20), M, M], [S(20), S(2), S(3)]], g);
    assert.ok(!ids(lib.JOKES.mid, 'frech', c2).includes('original-17'), '25 Punkte ≠ 24');
  });
  test('„Vorhin 120 Punkte …“ nur, wenn es wirklich einen 120er gab', () => {
    const lib = fullLibrary();
    const with120 = ctxAfter([[T(20), T(20), M], [S(1), M, M], [S(1), M, M], [S(5), S(1), M]]).ctx;
    const without = ctxAfter([[T(20), T(19), M], [S(1), M, M], [S(1), M, M], [S(5), S(1), M]]).ctx;
    assert.ok(ids(lib.JOKES.low, 'frech', with120).includes('original-07'));
    assert.ok(!ids(lib.JOKES.low, 'frech', without).includes('original-07'));
  });
  test('Aufruf „Zeig mal, ob deine 120 Punkte …“ nur, wenn der Nächste zuletzt genau 120 hatte', () => {
    const lib = fullLibrary();
    const yes = ctxAfter([[T(20), T(20), M], [S(1), M, M], [S(1), M, M]]).ctx; // nächster: Lukas (120)
    const no = ctxAfter([[T(20), T(19), M], [S(1), M, M], [S(1), M, M]]).ctx;
    assert.equal(yes.next.name, 'Lukas');
    assert.ok(ids(lib.NEXT_CALLS, 'frech', yes).includes('original-06'));
    assert.ok(!ids(lib.NEXT_CALLS, 'frech', no).includes('original-06'));
  });
  test('„Dart-Ganove … Doppel 17“ nur bei genau 34 Rest, Double-Out, 3 Spielern – und nennt den richtigen Spieler', () => {
    const lib = fullLibrary();
    const g = game(P3, { startScore: 101 });
    // Lukas 67 Punkte → 34 Rest; dann Wowa, Markus → nächster ist Lukas mit 34
    const { ctx } = ctxAfter([[T(20), S(7), M], [S(1), M, M], [S(1), M, M]], g);
    assert.equal(ctx.next.name, 'Lukas');
    assert.equal(ctx.next.remaining, 34);
    assert.ok(ids(lib.NEXT_CALLS, 'frech', ctx).includes('original-10'));
    const single = ctxAfter([[T(20), S(7), M], [S(1), M, M], [S(1), M, M]], game(P3, { startScore: 101, outMode: 'single' })).ctx;
    assert.ok(!ids(lib.NEXT_CALLS, 'frech', single).includes('original-10'));
  });
  test('Warnschuss nur, wenn der dritte Pfeil daneben ging (3 Pfeile)', () => {
    const lib = fullLibrary();
    assert.ok(ids(lib.JOKES.mid, 'frech', ctxAfter([[S(20), S(20), M]]).ctx).includes('original-23'));
    assert.ok(!ids(lib.JOKES.mid, 'frech', ctxAfter([[S(20), M, S(20)]]).ctx).includes('original-23'));
  });
  test('Triple-Bust: „Triple waren größer als dein Rest“ nur, wenn ein Triple überworfen hat', () => {
    const lib = fullLibrary();
    const g = game(P3, { startScore: 40 });
    const triple = ctxAfter([[T(20), M, M]], g).ctx;
    const single = ctxAfter([[S(20), S(20), S(1)]], g).ctx;
    assert.ok(ids(lib.JOKES.bust, 'frech', triple).includes('original-12'));
    assert.ok(!ids(lib.JOKES.bust, 'frech', single).includes('original-12'));
  });
  test('„claimMagic“ kann die App nicht wissen → Spruch kommt nie', () => {
    const lib = fullLibrary();
    for (const pts of [[S(20), S(5), S(5)], [S(10), S(10), S(10)]]) {
      assert.ok(!ids(lib.JOKES.mid, 'gnadenlos', ctxAfter([pts]).ctx).includes('original-08'));
    }
  });
  test('„Der Mann …“ nur mit Einstellung Männerrunde', () => {
    const lib = fullLibrary();
    const { ctx } = ctxAfter([[T(20), S(5), S(5)]]); // 70 → good
    assert.ok(!ids(lib.JOKES.good, 'gnadenlos', { ...ctx, maleWordingOk: false }).includes('fsk16-24'));
    assert.ok(ids(lib.JOKES.good, 'gnadenlos', { ...ctx, maleWordingOk: true }).includes('fsk16-24'));
  });
  test('„die anderen beiden“ nie bei 4 Spielern (Sicherheitsregel der App)', () => {
    const lib = fullLibrary();
    const P4 = [...P3, { id: 'anna', name: 'Anna' }];
    const { ctx } = ctxAfter([[T(20), T(20), T(20)]], game(P4));
    assert.ok(!ids(lib.JOKES.max, 'gnadenlos', ctx).includes('fsk16-40'));
    assert.ok(ids(lib.JOKES.max, 'gnadenlos', ctx).includes('fsk16-39'));
  });
});

describe('Ansage und Freigabe', () => {
  test('Aufrufe (turn_start) nennen immer den NÄCHSTEN Spieler', () => {
    const lib = fullLibrary();
    for (const e of lib.NEXT_CALLS.k.concat(lib.NEXT_CALLS.x || [])) assert.match(text(e), /\{next\}/, text(e));
    const c = new Commentator({ humor: 'frech', rng: seeded(3), library: lib });
    const { ctx } = ctxAfter([[S(1), S(1), S(1)]]);
    for (let i = 0; i < 15; i++) {
      const out = c.comment(ctx);
      assert.match(out.parts[out.parts.length - 1], /Wowa/, out.text);
    }
  });
  test('ungültige Eingabe: Spruch, aber keine Punkte, kein Spielerwechsel', () => {
    const s = new GameSession(game(), { commentator: new Commentator({ humor: 'frech', rng: seeded(), library: fullLibrary() }) });
    const r = s.input('1, 2, 3, 4');
    assert.equal(r.action, 'ask');
    assert.equal(r.reason, 'too_many_darts');
    assert.match(r.quip, /Maschinenpistole|vierten Pfeil/);
    const r2 = s.input('Triple 20, Bull');
    assert.equal(r2.reason, 'ambiguous');
    assert.match(r2.quip, /Bahnhof/);
    assert.equal(s.state.activePlayerId, 'lukas');
    assert.equal(s.state.byId.lukas.remaining, 301);
    assert.equal(s.game.events.length, 0);
  });
  test('Korrektur-Spruch erst nach Neuberechnung, mit dem Namen des korrigierten Spielers', () => {
    const s = new GameSession(game(), { commentator: new Commentator({ humor: 'frech', rng: seeded(9), library: fullLibrary() }) });
    s.input('20 20 20');
    const id = s.game.events[0].id;
    s.correctTurn(id, { darts: [T(20), S(20), S(20)] });
    assert.equal(s.state.byId.lukas.remaining, 201);
    const quips = new Set(Array.from({ length: 6 }, () => s.correctionQuip(id)));
    assert.ok([...quips].some((q) => /Lukas, na endlich! Die Zahlen haben wir jetzt eingefangen/.test(q)), [...quips].join(' | '));
    for (const q of quips) assert.doesNotMatch(q, /\{/);
  });
  test('Wiederholungssperre: keine Wiederholung innerhalb von acht Sprüchen, Historie exportierbar', () => {
    const c = new Commentator({ humor: 'gnadenlos', rng: seeded(4), library: fullLibrary() });
    const { ctx } = ctxAfter([[S(5), S(1), S(2)]]);
    const seen = [];
    for (let i = 0; i < 30; i++) {
      const out = c.comment(ctx);
      seen.push(out.parts[1]);
    }
    for (let i = 0; i < seen.length; i++) {
      const window = seen.slice(Math.max(0, i - 8), i);
      assert.ok(!window.includes(seen[i]), `Wiederholung: ${seen[i]}`);
    }
    const mem = c.exportMemory();
    const c2 = new Commentator({ humor: 'gnadenlos', rng: seeded(4), library: fullLibrary() });
    c2.importMemory(mem);
    assert.ok(!mem.slice(-8).includes(c2.comment(ctx).parts[1]));
  });
});
