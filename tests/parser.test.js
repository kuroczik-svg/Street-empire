import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseThrowInput, germanNumberWord } from '../src/parser.js';
import { dartValue } from '../src/engine.js';

const sum = (darts) => darts.reduce((a, d) => a + dartValue(d), 0);
const p = (t, o) => parseThrowInput(t, o);

describe('Beispiele aus dem Auftrag', () => {
  test('„17, 2, Triple 13“ = 58', () => {
    const r = p('17, 2, Triple 13');
    assert.equal(r.kind, 'darts');
    assert.equal(r.needsConfirmation, false);
    assert.deepEqual(r.darts, [{ mult: 1, value: 17 }, { mult: 1, value: 2 }, { mult: 3, value: 13 }]);
    assert.equal(sum(r.darts), 58);
  });
  test('„Doppel 20, 5, 12“ = 57 (Doppel gilt nur für die nächste Zahl)', () => {
    const r = p('Doppel 20, 5, 12');
    assert.deepEqual(r.darts, [{ mult: 2, value: 20 }, { mult: 1, value: 5 }, { mult: 1, value: 12 }]);
    assert.equal(sum(r.darts), 57);
  });
  test('„18, 18, 20“ = 56', () => assert.equal(sum(p('18, 18, 20').darts), 56));
  test('„Triple 16“ = 48', () => assert.equal(sum(p('Triple 16').darts), 48));
  test('„Bullseye“ = 50', () => assert.deepEqual(p('Bullseye').darts, [{ mult: 2, value: 25 }]));
  test('„Single Bull“ = 25', () => assert.deepEqual(p('Single Bull').darts, [{ mult: 1, value: 25 }]));
});

describe('Varianten der Spracherkennung', () => {
  test('Zahlwörter', () => {
    assert.equal(sum(p('siebzehn zwei triple dreizehn').darts), 58);
    assert.equal(sum(p('zwanzig, zwo, achtzehn').darts), 40);
  });
  test('Schreibweisen von Triple und Doppel', () => {
    assert.equal(sum(p('Tripel 20 Trippel 19 Treble 18').darts), 171);
    assert.equal(sum(p('Double 16, doppelt 8, dreifach 5').darts), 63);
    assert.equal(sum(p('T20 T19 D12').darts), 141);
    assert.equal(sum(p('t20, d16, s5').darts), 97);
    assert.equal(sum(p('Triple-20 Triple-20 Triple-20').darts), 180);
  });
  test('Bull-Varianten', () => {
    assert.deepEqual(p("Bull's Eye").darts, [{ mult: 2, value: 25 }]);
    assert.deepEqual(p('Bulls Eye').darts, [{ mult: 2, value: 25 }]);
    assert.deepEqual(p('Doppel Bull').darts, [{ mult: 2, value: 25 }]);
    assert.deepEqual(p('Bull 25').darts, [{ mult: 1, value: 25 }]);
    assert.deepEqual(p('25').darts, [{ mult: 1, value: 25 }]);
    assert.deepEqual(p('50').darts, [{ mult: 2, value: 25 }]);
    assert.deepEqual(p('äußeres Bull').darts, [{ mult: 1, value: 25 }]);
    assert.deepEqual(p('inneres Bull').darts, [{ mult: 2, value: 25 }]);
  });
  test('Fehlwürfe', () => {
    assert.equal(sum(p('20, daneben, 5').darts), 25);
    assert.equal(p('20, daneben, 5').darts.length, 3);
    assert.equal(p('null null null').darts.length, 3);
    assert.equal(p('kein Treffer').darts.length, 1);
  });
  test('Wiederholungen', () => {
    assert.equal(sum(p('dreimal Triple 20').darts), 180);
    assert.equal(sum(p('2 mal 20 und 5').darts), 45);
    assert.equal(sum(p('3x T20').darts), 180);
    assert.equal(p('zweimal 18 und 20').darts.length, 3);
  });
  test('„Hundertachtzig“ = 3× Triple 20', () => {
    assert.equal(sum(p('Hundertachtzig!').darts), 180);
    assert.equal(sum(p('180').darts), 180);
  });
  test('Füllwörter und Aktivierungswort stören nicht', () => {
    const r = p('Dart Buddy: äh, 17 und dann 2 und Triple 13');
    assert.equal(r.kind, 'darts');
    assert.equal(r.needsConfirmation, false);
    assert.equal(sum(r.darts), 58);
  });
});

describe('Gespräch vs. Wurf', () => {
  test('Beiläufige Gespräche mit Zahlen werden NICHT gezählt', () => {
    for (const t of [
      'Ich hol mir noch zwei Bier',
      'Wer will noch ein Bier? Ich nehm zwei',
      'Um 20 Uhr müssen wir los',
      'Das war Runde drei oder?',
      'Hast du 5 Euro für die Pizza',
      'Mein Bruder ist 18 geworden',
      'Ich muss morgen um sieben aufstehen',
    ]) {
      const r = p(t);
      assert.equal(r.kind, 'chatter', `„${t}“ sollte als Gespräch gelten`);
      assert.deepEqual(r.darts, []);
    }
  });
  test('Text ohne Zahlen ist Gespräch', () => {
    assert.equal(p('Boah ist das heiß hier').kind, 'chatter');
  });
  test('Ein einzelnes unbekanntes Wort → Rückfrage statt Raten', () => {
    const r = p('17, 2, Triple 13 Wahnsinn');
    assert.equal(r.kind, 'darts');
    assert.equal(r.needsConfirmation, true);
  });
  test('Sprachbefehl rückgängig', () => {
    assert.equal(p('Rückgängig').kind, 'command');
    assert.equal(p('Buddy, zurück').command, 'undo');
  });
});

describe('Unklare und unmögliche Angaben', () => {
  test('„Bull“ allein ist mehrdeutig', () => {
    const r = p('20, 20, Bull');
    assert.equal(r.needsConfirmation, true);
    assert.equal(r.issues[0].type, 'ambiguous_bull');
  });
  test('Triple 25 gibt es nicht', () => {
    const r = p('Triple 25');
    assert.equal(r.issues[0].type, 'invalid_field');
    assert.equal(r.darts.length, 0);
  });
  test('60 ist kein Einzelfeld – Hinweis auf Triple 20', () => {
    const r = p('60');
    assert.equal(r.issues[0].type, 'invalid_number');
    assert.match(r.issues[0].message, /Triple 20/);
  });
  test('Triple ohne Zahl', () => {
    const r = p('20, 19, Triple');
    assert.equal(r.issues[0].type, 'dangling_modifier');
  });
  test('Zu viele Pfeile werden gemeldet', () => {
    const r = p('1 2 3 4', { maxDarts: 3 });
    assert.ok(r.issues.some((i) => i.type === 'too_many'));
  });
  test('Triple 21 ist ungültig', () => {
    assert.equal(p('Triple 21').issues[0].type, 'invalid_field');
  });
});

test('Zahlwörter-Generator', () => {
  assert.equal(germanNumberWord(17), 'siebzehn');
  assert.equal(germanNumberWord(21), 'einundzwanzig');
  assert.equal(germanNumberWord(180), 'hundertachtzig');
});
