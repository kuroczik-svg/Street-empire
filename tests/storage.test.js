import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, aggregateStats, ensureProfile } from '../src/storage.js';
import { createGame, addTurn, undoLast, dart } from '../src/engine.js';

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function finishedGame() {
  let g = createGame({
    players: [{ id: 'a', name: 'Anna', profileId: 'pa' }, { id: 'b', name: 'Ben', profileId: 'pb' }],
    order: ['a', 'b'], startingPlayerId: 'a', startScore: 40, dartsPerTurn: 3, outMode: 'double', orderConfirmed: true,
  });
  g = addTurn(g, [dart(1, 10), dart(0, 0), dart(0, 0)]).game; // Anna 30
  g = addTurn(g, [dart(2, 20)]).game; // Ben checkt aus
  return g;
}

test('Spielstand wird gespeichert und geladen', () => {
  const s = createStore(memory());
  const g = finishedGame();
  s.saveCurrentGame(g);
  assert.deepEqual(s.loadCurrentGame(), g);
  assert.equal(s.loadSettings().humor, 'frech');
});

test('Historie: beendetes Spiel wird einmal gespeichert, Rückgängig entfernt es wieder', () => {
  const s = createStore(memory());
  const g = finishedGame();
  s.syncGameToHistory(g);
  s.syncGameToHistory(g);
  assert.equal(s.loadHistory().length, 1);
  const stats = aggregateStats(s.loadHistory());
  const ben = stats.find((r) => r.name === 'Ben');
  assert.equal(ben.wins, 1);
  assert.equal(ben.bestCheckout, 40);
  s.syncGameToHistory(undoLast(g).game);
  assert.equal(s.loadHistory().length, 0);
});

test('Profile werden per Name gefunden', () => {
  const profiles = [];
  let n = 0;
  const id = () => `p${++n}`;
  const a = ensureProfile(profiles, 'Wowa', 'Die Maschine', id);
  const b = ensureProfile(profiles, 'wowa ', undefined, id);
  assert.equal(a, b);
  assert.equal(profiles.length, 1);
  assert.equal(b.nickname, 'Die Maschine');
});

test('Männerrunde ist standardmäßig an – auch nach Update alter Einstellungen; eigene Wahl bleibt danach erhalten', () => {
  const m = memory();
  const s = createStore(m);
  assert.equal(s.loadSettings().maleWordingOk, true);
  // alte Einstellungen (vor v2) mit gespeichertem false
  m.setItem('dartbuddy.settings.v1', JSON.stringify({ humor: 'gnadenlos', maleWordingOk: false }));
  const migrated = s.loadSettings();
  assert.equal(migrated.maleWordingOk, true);
  assert.equal(migrated.humor, 'gnadenlos');
  // bewusst ausgeschaltet (v2) → bleibt aus
  s.saveSettings({ ...migrated, maleWordingOk: false });
  assert.equal(s.loadSettings().maleWordingOk, false);
});
