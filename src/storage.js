// DART BUDDY – persistente Speicherung (localStorage) und Statistik
// ------------------------------------------------------------
// Gespeichert werden immer die Roh-Ereignisse eines Spiels. Alle Statistiken
// werden daraus berechnet – so gibt es keine doppelten oder veralteten Zähler,
// auch wenn ein Sieg nachträglich korrigiert oder rückgängig gemacht wird.

import { computeState } from './engine.js';

const KEYS = {
  current: 'dartbuddy.current.v1',
  history: 'dartbuddy.history.v1',
  profiles: 'dartbuddy.profiles.v1',
  settings: 'dartbuddy.settings.v1',
  customJokes: 'dartbuddy.jokes.custom.v1',
  hiddenJokes: 'dartbuddy.jokes.hidden.v1',
  commentMemory: 'dartbuddy.comment-history.v1',
};

export const DEFAULT_SETTINGS = Object.freeze({
  humor: 'frech',
  speechOn: true,
  volume: 1,
  voiceURI: '',
  voiceStyle: 'kumpel',
  micMode: 'always', // 'always' (dauerhaft zuhören) | 'button' | 'wake'
  wakeWord: 'buddy',
  confirmBeforeCommit: false,
  showCheckout: true,
  maleWordingOk: true, // „Männerrunde“: Sprüche wie „Der Mann kann tatsächlich Dart spielen!“
  settingsVersion: 3,
});

const MAX_HISTORY = 300;

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export function createStore(storage) {
  let s = storage;
  if (!s) {
    try {
      s = globalThis.localStorage;
      s.setItem('dartbuddy.probe', '1');
      s.removeItem('dartbuddy.probe');
    } catch {
      s = memoryStorage();
    }
  }
  const read = (k, fallback) => {
    try {
      const raw = s.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (k, v) => {
    try {
      s.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  };

  return {
    loadSettings: () => {
      const saved = { ...read(KEYS.settings, {}) };
      // v2: „Männerrunde“ ist jetzt standardmäßig an – alten gespeicherten Standardwert einmalig übernehmen
      if ((saved.settingsVersion || 1) < 2) delete saved.maleWordingOk;
      // v3: „Dauerhaft zuhören“ ist jetzt der Standard
      if ((saved.settingsVersion || 1) < 3) delete saved.micMode;
      return { ...DEFAULT_SETTINGS, ...saved, settingsVersion: DEFAULT_SETTINGS.settingsVersion };
    },
    saveSettings: (v) => write(KEYS.settings, v),

    loadCurrentGame: () => read(KEYS.current, null),
    saveCurrentGame: (g) => write(KEYS.current, g),
    clearCurrentGame: () => s.removeItem(KEYS.current),

    loadHistory: () => read(KEYS.history, []),
    /** Speichert ein beendetes Spiel bzw. entfernt es, falls es (durch Korrektur) nicht mehr beendet ist. */
    syncGameToHistory(game) {
      const list = read(KEYS.history, []);
      const idx = list.findIndex((g) => g.id === game.id);
      let finished = false;
      try {
        finished = computeState(game).finished;
      } catch {
        finished = false;
      }
      if (finished) {
        if (idx >= 0) list[idx] = game;
        else list.unshift(game);
        while (list.length > MAX_HISTORY) list.pop();
      } else if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        return;
      }
      write(KEYS.history, list);
    },
    deleteHistoryGame(id) {
      write(KEYS.history, read(KEYS.history, []).filter((g) => g.id !== id));
    },
    clearHistory: () => write(KEYS.history, []),

    loadCommentMemory: () => read(KEYS.commentMemory, []),
    saveCommentMemory: (list) => write(KEYS.commentMemory, list),

    loadCustomJokes: () => read(KEYS.customJokes, []),
    saveCustomJokes: (list) => write(KEYS.customJokes, list),
    loadHiddenJokes: () => read(KEYS.hiddenJokes, []),
    saveHiddenJokes: (list) => write(KEYS.hiddenJokes, list),

    loadProfiles: () => read(KEYS.profiles, []),
    saveProfiles: (p) => write(KEYS.profiles, p),

    clearAll() {
      Object.values(KEYS).forEach((k) => s.removeItem(k));
    },
  };
}

/** Findet oder erstellt ein Profil anhand des Namens (Groß-/Kleinschreibung egal). */
export function ensureProfile(profiles, name, nickname, makeId) {
  const key = name.trim().toLowerCase();
  let p = profiles.find((x) => x.name.toLowerCase() === key);
  if (!p) {
    p = { id: makeId('profile'), name: name.trim(), nickname: nickname || '', createdAt: Date.now() };
    profiles.push(p);
  } else if (nickname !== undefined && nickname !== null) {
    p.nickname = nickname;
  }
  return p;
}

/**
 * Aggregiert Statistiken über alle beendeten Spiele.
 * Spieler werden über profileId (falls vorhanden) oder den Namen zugeordnet.
 */
export function aggregateStats(history) {
  const table = new Map();
  const keyOf = (cfgPlayer) => cfgPlayer.profileId || `name:${cfgPlayer.name.toLowerCase()}`;
  for (const game of history) {
    let st;
    try {
      st = computeState(game);
    } catch {
      continue;
    }
    if (!st.finished) continue;
    for (const cp of game.config.players) {
      const k = keyOf(cp);
      if (!table.has(k)) {
        table.set(k, {
          key: k,
          name: cp.name,
          games: 0,
          wins: 0,
          turns: 0,
          points: 0,
          darts: 0,
          bestTurn: 0,
          bestCheckout: 0,
          bestGameAverage: 0,
          count180: 0,
          busts: 0,
        });
      }
      const row = table.get(k);
      const ps = st.byId[cp.id].stats;
      row.name = cp.name;
      row.games += 1;
      if (st.winnerId === cp.id) row.wins += 1;
      row.turns += ps.turns;
      row.points += ps.pointsScored;
      row.darts += ps.darts;
      row.bestTurn = Math.max(row.bestTurn, ps.highestTurn);
      if (ps.checkout) row.bestCheckout = Math.max(row.bestCheckout, ps.checkout);
      row.bestGameAverage = Math.max(row.bestGameAverage, ps.average);
      row.count180 += ps.count180;
      row.busts += ps.busts;
    }
  }
  return [...table.values()]
    .map((r) => ({
      ...r,
      average: r.turns ? Math.round((r.points / r.turns) * 100) / 100 : 0,
      winRate: r.games ? Math.round((r.wins / r.games) * 100) : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.average - a.average);
}
