// Tests: „Dauerhaft zuhören“ – nur Wurfansagen zählen, Gespräche werden komplett ausgeblendet
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyContinuous, FRAGMENT_TIMEOUT_MS } from '../src/listenFilter.js';
import { createGame } from '../src/engine.js';
import { GameSession } from '../src/session.js';
import { Commentator } from '../src/commentator.js';
import { fullLibrary, seeded } from './helpers.js';

const P3 = [{ id: 'lukas', name: 'Lukas' }, { id: 'wowa', name: 'Wowa' }, { id: 'markus', name: 'Markus' }];
const game = (over = {}) => createGame({ players: P3, order: ['lukas', 'wowa', 'markus'], startingPlayerId: 'lukas', startScore: 301, dartsPerTurn: 3, outMode: 'double', orderConfirmed: true, ...over });
const session = (over) => new GameSession(game(over), { commentator: new Commentator({ humor: 'gnadenlos', rng: seeded(), library: fullLibrary() }) });
const rest = (s) => Object.fromEntries(s.state.players.map((p) => [p.id, p.remaining]));

// Typische Sätze am Dartabend – NICHTS davon darf gezählt werden
export const GESPRAECH = [
  'Wer will noch ein Bier?',
  'Ich hol mir noch zwei Bier',
  'Ich nehm zwei',
  'Um 20 Uhr müssen wir los',
  'Das war Runde drei oder?',
  'Hast du 5 Euro für die Pizza',
  'Mein Bruder ist 18 geworden',
  'Alter, was war das denn',
  'Markus, du bist so schlecht heute',
  'Mach mal die Musik lauter',
  'Wie spät ist es?',
  'Noch zwei Runden, dann gehen wir',
  'Ich hab drei Kinder',
  'Gib mir mal die Pfeile',
  'Lukas wirft wie meine Oma',
  'Haha, sehr gut',
  'Pizza kommt in zehn Minuten',
  'Das waren bestimmt 20 Punkte',
  'Ich glaub ich hab 100 Euro verloren',
  'Ey Wowa, du bist dran',
  'Prost!',
  'Wer hat gewonnen?',
  'Zwei Bier bitte',
  'Kannst du mal das Licht anmachen',
  'Gestern hab ich 180 gesehen im Fernsehen',
  'Eins, zwei, drei, vier',
  'acht',
  'zwanzig',
  'drei',
];

describe('Filter: einzelne Äußerungen', () => {
  test('Wurfansagen werden erkannt', () => {
    for (const t of ['17, 2, Triple 13', 'Doppel 20, 5, 12', '18 18 20', 'Triple 16', 'Bullseye', 'Single Bull', 'äh, 20 und 5 und 1', 'dreimal Triple 20', 'Hundertachtzig', 'T20 T19 D12', '20, daneben, 5']) {
      const c = classifyContinuous(t);
      assert.equal(c.kind, 'darts', t);
    }
  });
  test('Gesprächssätze mit Wörtern außer Zahlen werden ignoriert', () => {
    for (const t of GESPRAECH.slice(0, 25)) assert.equal(classifyContinuous(t).kind, 'ignore', t);
  });
  test('„Bull“ allein klingt nach Dart → Rückfrage; unklares Gerede → stumm', () => {
    assert.equal(classifyContinuous('Triple 20, Triple 20, Bull').kind, 'ask');
    assert.equal(classifyContinuous('60').kind, 'ignore');
  });
});

describe('Sitzung im Dauer-Modus', () => {
  test('Ein ganzer Abend Gerede ändert keinen einzigen Punkt und keinen Spieler', () => {
    const s = session();
    let t = 0;
    for (const g of GESPRAECH) {
      const r = s.inputContinuous(g, (t += 1000));
      assert.equal(r.action, 'ignore', g);
      assert.equal(r.silent, true, `${g} – keine Ansage`);
    }
    assert.deepEqual(rest(s), { lukas: 301, wowa: 301, markus: 301 });
    assert.equal(s.state.activePlayerId, 'lukas');
    assert.equal(s.pending.length, 0);
    assert.equal(s.game.events.length, 0);
  });

  test('Wurfansagen mitten im Gespräch werden sofort gebucht', () => {
    const s = session();
    s.inputContinuous('Wer will noch ein Bier?', 0);
    const r = s.inputContinuous('17, 2, Triple 13', 1000);
    assert.equal(r.action, 'committed');
    assert.equal(rest(s).lukas, 243);
    s.inputContinuous('Boah Lukas, nicht schlecht', 2000);
    assert.equal(s.inputContinuous('Doppel 20, 5, 12', 3000).action, 'committed');
    assert.deepEqual(rest(s), { lukas: 243, wowa: 244, markus: 301 });
  });

  test('Angesagte Teile werden zusammengesetzt („17, 2“ … „4“)', () => {
    const s = session();
    const r1 = s.inputContinuous('17, 2', 0);
    assert.equal(r1.action, 'wait');
    assert.equal(r1.silent, true, 'keine Rückfrage per Sprache im Dauer-Modus');
    s.inputContinuous('Alter, gib mal das Bier', 2000); // Gerede dazwischen
    assert.equal(s.pending.length, 2);
    const r2 = s.inputContinuous('vier', 4000);
    assert.equal(r2.action, 'committed');
    assert.equal(r2.result.points, 23);
  });

  test('Einzelne nackte Zahl beginnt keine Aufnahme (Gesprächsfetzen)', () => {
    const s = session();
    assert.equal(s.inputContinuous('acht', 0).action, 'ignore');
    assert.equal(s.pending.length, 0);
    // danach eine echte Ansage – die „acht“ hat nichts verfälscht
    assert.equal(s.inputContinuous('17 2', 1000).action, 'wait');
    assert.equal(s.inputContinuous('4', 2000).result.points, 23);
  });

  test('Einzelner Pfeil mit Feldwort darf beginnen („Triple 20“ … „20, 19“)', () => {
    const s = session();
    assert.equal(s.inputContinuous('Triple 20', 0).action, 'wait');
    assert.equal(s.inputContinuous('20, 19', 3000).result.points, 99);
  });

  test('Eine beiläufige Zahl darf NIE einen Bust auslösen', () => {
    const s = session({ startScore: 10 });
    assert.equal(s.inputContinuous('zwanzig', 0).action, 'ignore');
    assert.equal(rest(s).lukas, 10);
    assert.equal(s.game.events.length, 0);
  });

  test('Ausnahme: nackte Zahl, die genau auscheckt (Single-Out)', () => {
    const s = session({ startScore: 20, outMode: 'single' });
    const r = s.inputContinuous('zwanzig', 0);
    assert.equal(r.action, 'committed');
    assert.equal(r.result.checkout, true);
  });

  test('Angefangene Ansage verfällt nach der Wartezeit', () => {
    const s = session();
    s.inputContinuous('17, 2', 0);
    assert.equal(s.expireFragment(FRAGMENT_TIMEOUT_MS - 1), false);
    assert.equal(s.expireFragment(FRAGMENT_TIMEOUT_MS + 1), true);
    assert.equal(s.pending.length, 0);
    // eine spätere Einzelzahl vervollständigt NICHTS mehr
    assert.equal(s.inputContinuous('4', FRAGMENT_TIMEOUT_MS + 2000).action, 'ignore');
    assert.equal(s.game.events.length, 0);
  });

  test('Abgelaufenes Bruchstück + neue volle Ansage → nur die neue zählt', () => {
    const s = session();
    s.inputContinuous('Triple 5', 0);
    const r = s.inputContinuous('17, 2, Triple 13', FRAGMENT_TIMEOUT_MS + 5000);
    assert.equal(r.result.points, 58);
  });

  test('Bruchstück + volle Ansage (zu viele Pfeile) → Bruchstück war Gerede, volle Ansage zählt', () => {
    const s = session();
    s.inputContinuous('Triple 5', 0);
    const r = s.inputContinuous('17, 2, Triple 13', 2000);
    assert.equal(r.action, 'committed');
    assert.equal(r.result.points, 58);
  });

  test('Von Hand ergänzte Pfeile verfallen nicht', () => {
    const s = session();
    s.inputContinuous('17, 2', 0);
    s.addDart({ mult: 1, value: 1 }, { autoCommit: false });
    assert.equal(s.expireFragment(FRAGMENT_TIMEOUT_MS * 3), false);
    assert.equal(s.pending.length, 3);
  });

  test('„Rückgängig“ als eigener Satz funktioniert, in einem Satz versteckt nicht', () => {
    const s = session();
    s.inputContinuous('17, 2, Triple 13', 0);
    assert.equal(s.inputContinuous('Ich glaub das müssen wir rückgängig machen oder so', 1000).action, 'ignore');
    assert.equal(rest(s).lukas, 243);
    assert.equal(s.inputContinuous('rückgängig', 2000).action, 'undone');
    assert.equal(rest(s).lukas, 301);
  });
});
