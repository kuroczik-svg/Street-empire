import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeTurn } from '../src/turnDisplay.js';

test('erkannt: 17 + 2 + Triple 13 ergibt 58', () => {
  const d = describeTurn([{ mult: 1, value: 17 }, { mult: 1, value: 2 }, { mult: 3, value: 13 }]);
  assert.deepEqual(d.darts.map(x => x.label), ['17', '2', 'T13']);
  assert.deepEqual(d.darts.map(x => x.value), [17, 2, 39]);
  assert.equal(d.calculation, '17 + 2 + 39');
  assert.equal(d.thrown, 58);
  assert.equal(d.booked, 58);
});

test('Bust zeigt geworfene, aber null gebuchte Punkte', () => {
  const d = describeTurn([{ mult: 3, value: 20 }, { mult: 1, value: 20 }], {
    thrown: 80, points: 0, bust: true, ignored: [],
  });
  assert.equal(d.thrown, 80);
  assert.equal(d.booked, 0);
  assert.equal(d.bust, true);
});

test('Pfeile nach einem Checkout werden nicht zur Rechnung addiert', () => {
  const d = describeTurn([{ mult: 2, value: 20 }, { mult: 1, value: 15 }], {
    thrown: 40, points: 40, checkout: true, ignored: [1],
  });
  assert.equal(d.calculation, '40');
  assert.equal(d.darts[1].ignored, true);
  assert.equal(d.thrown, 40);
});

test('leere Aufnahme und vorläufige Aufnahme bleiben anzeigbar', () => {
  assert.equal(describeTurn([]).calculation, '0');
  assert.equal(describeTurn([{ mult: 1, value: 12 }]).thrown, 12);
});
