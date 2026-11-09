// Tests für die erweiterbare Spruch-Bibliothek (eigene Sprüche in der App)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCustomJoke, buildLibrary, parsePastedJokes, exportLibrary, importLibrary,
  toInternal, toDisplay, builtInOverview, SITUATIONS,
} from '../src/library.js';
import { Commentator, jokeCandidates } from '../src/commentator.js';
import { JOKES } from '../src/jokes.js';
import { createStore } from '../src/storage.js';

function seeded(seed = 3) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
const ctx = (o = {}) => ({
  category: 'low', points: 18, remaining: 160, player: { id: 'm', name: 'Markus' },
  next: { id: 'l', name: 'Lukas', remaining: 200, bestTurn: 0 }, playerCount: 3, dartsPerTurn: 3, ...o,
});
const text = (e) => (typeof e === 'string' ? e : e.t);

describe('Eigene Sprüche prüfen', () => {
  test('Platzhalter werden übersetzt und zurückübersetzt', () => {
    assert.equal(toInternal('Meine Fresse, [Name]! Noch [Rest]!'), 'Meine Fresse, {name}! Noch {rest}!');
    assert.equal(toInternal('[nächster], los!'), '{next}, los!');
    assert.equal(toDisplay('{name} mit {pts}'), '[Name] mit [Punkte]');
  });
  test('gültiger Spruch', () => {
    const r = validateCustomJoke({ text: 'Meine Fresse, [Name]! Die Scheibe dreht sich aus Langeweile um!', situation: 'katastrophe', level: 'gnadenlos' });
    assert.equal(r.ok, true);
    assert.equal(r.joke.text, 'Meine Fresse, {name}! Die Scheibe dreht sich aus Langeweile um!');
    assert.equal(r.joke.players, 0);
  });
  test('Fehler werden verständlich gemeldet', () => {
    assert.match(validateCustomJoke({ text: '', situation: 'gut', level: 'frech' }).errors[0], /leer/);
    assert.match(validateCustomJoke({ text: 'Hi [Opa]', situation: 'gut', level: 'frech' }).errors[0], /Platzhalter/);
    assert.match(validateCustomJoke({ text: 'Hundertachtzig!', situation: 'gut', level: 'frech' }).errors[0], /180/);
    assert.match(validateCustomJoke({ text: 'Weiter, [Nächster]!', situation: 'sieg', level: 'frech' }).errors[0], /nächsten Spieler/);
    assert.equal(validateCustomJoke({ text: 'x', situation: 'quatsch', level: 'frech' }).ok, false);
  });
  test('„die beiden“ → nur bei 3 Spielern, Aufruf ohne Namen → Name wird ergänzt', () => {
    const r = validateCustomJoke({ text: 'Die beiden anderen können einpacken!', situation: 'gut', level: 'frech' });
    assert.equal(r.joke.players, 3);
    assert.ok(r.warnings.length);
    const n = validateCustomJoke({ text: 'beweg dich!', situation: 'naechster', level: 'frech' });
    assert.equal(n.joke.text, '{next}, beweg dich!');
  });
});

describe('Bibliothek zusammenbauen', () => {
  test('eigener Spruch landet in der richtigen Kategorie und Humor-Stufe', () => {
    const j = validateCustomJoke({ text: 'Mein eigener Spruch, [Name]!', situation: 'katastrophe', level: 'frech' }).joke;
    const lib = buildLibrary([j]);
    const has = (cat, humor, points) => jokeCandidates(lib.JOKES[cat], humor, ctx({ points })).some((c) => text(c.e) === j.text);
    assert.ok(has('low', 'frech', 18));
    assert.ok(has('low', 'gnadenlos', 18), 'freche Sprüche auch bei gnadenlos');
    assert.ok(!has('low', 'freundlich', 18), 'aber nicht bei freundlich');
    assert.ok(has('mid', 'frech', 25));
    assert.ok(!has('mid', 'frech', 30), 'katastrophal heißt höchstens 25 Punkte');
    // eingebaute Bibliothek bleibt unverändert
    assert.ok(!JOKES.low.c.some((e) => text(e) === j.text));
  });
  test('deaktivierte eigene und ausgeblendete eingebaute Sprüche kommen nicht', () => {
    const j = validateCustomJoke({ text: 'Pausiert, [Name]!', situation: 'gut', level: 'frech', enabled: false }).joke;
    const hiddenText = JOKES.good.c[0];
    const lib = buildLibrary([j], [hiddenText]);
    const texts = jokeCandidates(lib.JOKES.good, 'frech', ctx({ points: 70 })).map((c) => text(c.e));
    assert.ok(!texts.includes(j.text));
    assert.ok(!texts.includes(hiddenText));
  });
  test('der Kommentator verwendet eigene Sprüche – mit korrekt eingesetzten Werten', () => {
    const j = validateCustomJoke({ text: 'Meine Fresse, [Name]! [Punkte] Punkte! Die Scheibe überlegt schon, ob sie sich aus Langeweile umdreht!', situation: 'katastrophe', level: 'gnadenlos' }).joke;
    const c = new Commentator({ humor: 'gnadenlos', rng: seeded(4), library: buildLibrary([j]) });
    let heard = false;
    for (let i = 0; i < 20 && !heard; i++) {
      const out = c.comment(ctx());
      if (out.text.includes('Meine Fresse, Markus! 18 Punkte! Die Scheibe überlegt')) heard = true;
      assert.doesNotMatch(out.text, /\{|\[/);
    }
    assert.ok(heard, 'eigener Spruch wurde gesagt');
  });
  test('[Führender] kommt nur, wenn jemand anderes führt', () => {
    const j = validateCustomJoke({ text: '[Führender] lacht sich kaputt!', situation: 'katastrophe', level: 'frech' }).joke;
    const lib = buildLibrary([j]);
    const find = (o) => jokeCandidates(lib.JOKES.low, 'frech', ctx(o)).some((c) => text(c.e) === j.text);
    assert.equal(find({ leaderIsOther: false }), false);
    assert.equal(find({ leaderIsOther: true, leaderName: 'Lukas' }), true);
  });
  test('Übersicht der eingebauten Sprüche', () => {
    const g = builtInOverview();
    assert.ok(g.length >= 8);
    assert.ok(g.reduce((n, x) => n + x.items.length, 0) > 150);
    assert.equal(Object.keys(SITUATIONS).length, 11);
  });
});

describe('Einfügen, Sichern, Teilen', () => {
  test('eingefügte Tabelle aus dem Chat wird erkannt, fehlende Namen ergänzt', () => {
    const raw = `| Nr. | Spruch |
| --- | --- |
| 1   | „, was zur Hölle war das?! Selbst ein besoffener Maulwurf hätte die Scheibe besser gefunden!“ |
| 4   | „Meine Fresse, ! Du triffst so wenig, selbst die Scheibe hat Langeweile!“                     |
### Überschrift
2. "Alter, bei deinem Talent braucht die Dartscheibe keinen Schutz."
- Nicht einschlafen an der Scheibe!`;
    assert.deepEqual(parsePastedJokes(raw), [
      '[Name], was zur Hölle war das?! Selbst ein besoffener Maulwurf hätte die Scheibe besser gefunden!',
      'Meine Fresse, [Name]! Du triffst so wenig, selbst die Scheibe hat Langeweile!',
      'Alter, bei deinem Talent braucht die Dartscheibe keinen Schutz.',
      'Nicht einschlafen an der Scheibe!',
    ]);
  });
  test('Export und Import (ohne Duplikate)', () => {
    const a = validateCustomJoke({ text: 'Spruch A, [Name]!', situation: 'gut', level: 'frech' }).joke;
    const b = validateCustomJoke({ text: 'Spruch B!', situation: 'bust', level: 'gnadenlos' }).joke;
    const json = exportLibrary([a, b], ['versteckt']);
    const r = importLibrary(json, [a]);
    assert.equal(r.added, 1);
    assert.equal(r.skipped, 1);
    assert.equal(r.custom.length, 2);
    assert.deepEqual(r.hidden, ['versteckt']);
    assert.match(importLibrary('kein json').errors[0], /JSON/);
    assert.match(importLibrary('{"a":1}').errors[0], /keine DART-BUDDY/);
  });
  test('eigene Sprüche werden dauerhaft gespeichert', () => {
    const m = new Map();
    const st = createStore({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) });
    const a = validateCustomJoke({ text: 'Bleibt, [Name]!', situation: 'gut', level: 'frech' }).joke;
    st.saveCustomJokes([a]);
    st.saveHiddenJokes(['x']);
    assert.deepEqual(st.loadCustomJokes(), [a]);
    assert.deepEqual(st.loadHiddenJokes(), ['x']);
  });
});
