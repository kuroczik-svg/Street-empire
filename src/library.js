// DART BUDDY – erweiterbare Spruch-Bibliothek
// ------------------------------------------------------------
// Eingebaute Sprüche (jokes.js) + eigene Sprüche der Spieler (in der App angelegt).
// Eigene Sprüche werden getrennt gespeichert und überleben App-Updates.
// Alles hier ist rein (kein DOM) und getestet.

import { JOKES, EXTRAS, NEXT_CALLS, CORRECTION, S } from './jokes.js';

export const LIBRARY_FORMAT = 'dartbuddy-sprueche';
export const LIBRARY_VERSION = 1;

/** Wo ein eigener Spruch eingesetzt wird. */
export const SITUATIONS = {
  katastrophe: { label: 'Katastrophaler Wurf (0–25 Punkte)', targets: [['J', 'zero'], ['J', 'low'], ['J', 'mid']], max: 25 },
  mittel: { label: 'Mittelmäßiger Wurf (26–59 Punkte)', targets: [['J', 'mid'], ['J', 'solid']], min: 26, max: 59 },
  gut: { label: 'Guter Wurf (60–99 Punkte)', targets: [['J', 'good']] },
  stark: { label: 'Überragender Wurf (100–179 Punkte)', targets: [['J', 'ton'], ['J', 'big']] },
  max180: { label: 'Die 180', targets: [['J', 'max']] },
  bust: { label: 'Bust (überworfen)', targets: [['J', 'bust']] },
  sieg: { label: 'Sieg / Checkout', targets: [['J', 'win']] },
  finish: { label: 'Kurz vor dem Sieg (Finish-Bereich)', targets: [['E', 'finishRange'], ['E', 'oneDart']] },
  fuehrung: { label: 'Führungswechsel', targets: [['E', 'leaderChange']] },
  naechster: { label: 'Aufruf des nächsten Spielers', targets: [['N']] },
  korrektur: { label: 'Nach einer Korrektur', targets: [['C']] },
};

/** Humor-Stufe → Topf. Freundliche Sprüche hört man bei freundlich+frech, freche bei frech+gnadenlos, FSK-16 nur bei gnadenlos. */
export const LEVEL_TO_POOL = { freundlich: 'f', frech: 'c', gnadenlos: 'x' };

/** Platzhalter, wie sie Spieler schreiben → interne Platzhalter. */
export const PLACEHOLDERS = [
  { token: '[Name]', key: 'name', hint: 'Werfer' },
  { token: '[NAME]', key: 'NAME', hint: 'Werfer in GROSS' },
  { token: '[Punkte]', key: 'pts', hint: 'Punkte der Aufnahme' },
  { token: '[Rest]', key: 'rest', hint: 'Restpunkte' },
  { token: '[Nächster]', key: 'next', hint: 'nächster Spieler' },
  { token: '[Führender]', key: 'leader', hint: 'wer vorne liegt' },
  { token: '[Entthront]', key: 'prev', hint: 'bisheriger Führender (nur Führungswechsel)' },
];

/** „Hallo [Name]“ → „Hallo {name}“. Unbekannte [Wörter] bleiben stehen und werden gemeldet. */
export function toInternal(text) {
  let t = String(text || '');
  for (const p of PLACEHOLDERS) t = t.split(p.token).join(`{${p.key}}`);
  // Groß/Klein tolerant: [name], [nächster], [naechster] …
  t = t.replace(/\[(name|punkte|rest|nächster|naechster|führender|fuehrender|entthront)\]/gi, (m, w) => {
    const k = { name: 'name', punkte: 'pts', rest: 'rest', 'nächster': 'next', naechster: 'next', 'führender': 'leader', fuehrender: 'leader', entthront: 'prev' }[w.toLowerCase()];
    return `{${k}}`;
  });
  return t;
}

/** „Hallo {name}“ → „Hallo [Name]“ (zum Anzeigen und Bearbeiten). */
export function toDisplay(text) {
  let t = String(text || '');
  for (const p of PLACEHOLDERS) t = t.split(`{${p.key}}`).join(p.token);
  return t.replace(/\{(\w+)\}/g, '[$1]');
}

const ALLOWED = new Set(['name', 'NAME', 'SHOUT', 'pts', 'rest', 'next', 'leader', 'prev', 'leaderRest', 'rival', 'rivalRest', 'prevBest', 'nextBest', 'route']);

/**
 * Prüft einen eigenen Spruch und bereitet ihn zum Speichern vor.
 * @returns {{ok:boolean, errors:string[], warnings:string[], joke?:object}}
 */
export function validateCustomJoke(input) {
  const errors = [];
  const warnings = [];
  const situation = input.situation;
  const level = input.level;
  let text = toInternal(String(input.text || '').trim().replace(/\s+/g, ' '));
  if (!text) errors.push('Der Spruch ist leer.');
  if (text.length > 300) errors.push('Der Spruch ist zu lang (max. 300 Zeichen).');
  if (!SITUATIONS[situation]) errors.push('Bitte eine Situation wählen.');
  if (!LEVEL_TO_POOL[level]) errors.push('Bitte eine Humor-Stufe wählen.');

  const unknown = (text.match(/\[[^\]]*\]/g) || []);
  if (unknown.length) errors.push(`Unbekannter Platzhalter: ${unknown.join(', ')}. Erlaubt: ${PLACEHOLDERS.map((p) => p.token).join(' ')}`);
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const bad = used.filter((k) => !ALLOWED.has(k));
  if (bad.length) errors.push(`Unbekannter Platzhalter: ${bad.map((b) => `{${b}}`).join(', ')}`);

  if (situation === 'naechster' && !used.includes('next')) {
    text = `{next}, ${text}`;
    warnings.push('Beim Aufruf muss der nächste Spieler genannt werden – „[Nächster], “ wurde vorangestellt.');
  }
  if (situation === 'sieg' && used.includes('next')) errors.push('Beim Sieg gibt es keinen nächsten Spieler – bitte [Nächster] entfernen.');
  if (used.includes('prev') && situation !== 'fuehrung') errors.push('[Entthront] gibt es nur beim Führungswechsel.');
  if (situation !== 'max180' && /hundertachtzig|\b180\b|eighty/i.test(text)) {
    errors.push('180er-Sprüche bitte unter „Die 180“ eintragen – sie dürfen nur bei einer echten 180 kommen.');
  }
  if (/\d{2,}/.test(text.replace(/\{\w+\}/g, '')) && situation !== 'max180') {
    warnings.push('Feste Zahlen im Spruch werden nicht geprüft – für Punkte/Rest besser [Punkte] und [Rest] verwenden.');
  }

  let players = Number(input.players) || 0;
  if (!players && /\b(beiden|anderen zwei|ihr zwei|euch zwei)\b/i.test(text)) {
    players = 3;
    warnings.push('Der Spruch spricht von „den beiden“ – er kommt deshalb nur bei genau 3 Spielern.');
  }

  if (errors.length) return { ok: false, errors, warnings };
  return {
    ok: true,
    errors,
    warnings,
    joke: {
      id: input.id || `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      situation,
      level,
      players,
      enabled: input.enabled !== false,
      createdAt: input.createdAt || Date.now(),
    },
  };
}

/** Bedingungen, damit Platzhalter immer einen Wert haben. */
function conditionFor(joke) {
  const needsLeader = /\{leader\}/.test(joke.text);
  if (!needsLeader) return undefined;
  if (joke.situation === 'naechster') return (c) => !!c.leaderId && c.next && c.leaderId !== c.next.id;
  return (c) => !!c.leaderIsOther;
}

/**
 * Baut die Bibliothek aus eingebauten und eigenen Sprüchen.
 * @param {object[]} custom – eigene Sprüche (validiert)
 * @param {string[]} hidden – Texte eingebauter Sprüche, die ausgeblendet sind
 */
export function buildLibrary(custom = [], hidden = []) {
  const hide = new Set(hidden);
  const copy = (table) => {
    const out = {};
    for (const [k, v] of Object.entries(table)) {
      out[k] = {};
      for (const [pool, list] of Object.entries(v)) out[k][pool] = list.filter((e) => !hide.has(typeof e === 'string' ? e : e.t));
    }
    return out;
  };
  const lib = {
    JOKES: copy(JOKES),
    EXTRAS: copy(EXTRAS),
    NEXT_CALLS: copy({ _: NEXT_CALLS })._,
    CORRECTION: copy({ _: CORRECTION })._,
  };
  for (const j of custom) {
    if (!j || j.enabled === false || !SITUATIONS[j.situation] || !LEVEL_TO_POOL[j.level]) continue;
    const sit = SITUATIONS[j.situation];
    const pool = LEVEL_TO_POOL[j.level];
    const entry = S(j.text, {
      custom: true,
      ...(sit.min !== undefined ? { min: sit.min } : {}),
      ...(sit.max !== undefined ? { max: sit.max } : {}),
      ...(j.players ? { players: j.players } : {}),
      ...(conditionFor(j) ? { when: conditionFor(j) } : {}),
    });
    for (const [kind, cat] of sit.targets) {
      const table = kind === 'J' ? lib.JOKES[cat] : kind === 'E' ? lib.EXTRAS[cat] : kind === 'N' ? lib.NEXT_CALLS : lib.CORRECTION;
      if (!table) continue;
      (table[pool] = table[pool] || []).push(entry);
    }
  }
  return lib;
}

/** Alle eingebauten Sprüche, gruppiert nach Situation (für die Anzeige in der App). */
export function builtInOverview() {
  const groups = [];
  const seen = new Set();
  const levelOf = (pool) => ({ f: 'freundlich', c: 'frech', g: 'gnadenlos', k: 'Kumpel-Sammlung', x: 'FSK 16' }[pool] || pool);
  const add = (label, table) => {
    const items = [];
    for (const [pool, list] of Object.entries(table)) {
      for (const e of list) {
        const t = typeof e === 'string' ? e : e.t;
        if (seen.has(`${label}|${t}`)) continue;
        seen.add(`${label}|${t}`);
        items.push({ text: t, level: levelOf(pool) });
      }
    }
    groups.push({ label, items });
  };
  add('Katastrophale und schwache Würfe', { ...merge(JOKES.zero, JOKES.low) });
  add('Mittelmäßige Würfe', merge(JOKES.mid, JOKES.solid));
  add('Gute Würfe', JOKES.good);
  add('Überragende Würfe', merge(JOKES.ton, JOKES.big));
  add('Die 180', JOKES.max);
  add('Bust', JOKES.bust);
  add('Sieg', JOKES.win);
  add('Spielsituationen', merge(...Object.values(EXTRAS)));
  add('Aufruf des nächsten Spielers', NEXT_CALLS);
  add('Nach einer Korrektur', CORRECTION);
  return groups;
}

function merge(...tables) {
  const out = {};
  for (const t of tables) for (const [k, v] of Object.entries(t)) out[k] = (out[k] || []).concat(v);
  return out;
}

/**
 * Liest eingefügten Text: eine Zeile = ein Spruch. Versteht auch Tabellen
 * („| 1 | „Spruch“ |“), Nummerierungen und Anführungszeichen.
 * Fehlende Namen (z. B. „, was war das?“ oder „Meine Fresse, !“) werden durch [Name] ersetzt.
 */
export function parsePastedJokes(raw) {
  const out = [];
  for (let line of String(raw || '').split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    if (/^\|?\s*-{3,}/.test(line)) continue; // Tabellen-Trenner
    if (line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (!cells.length) continue;
      line = cells.reduce((a, b) => (b.length > a.length ? b : a)); // längste Zelle = Spruch
    }
    line = line.replace(/^(\d+[.)]?|[-*•])\s+/, ''); // Nummer/Aufzählung
    line = line.replace(/^[„"“'‚»«]+|[“"”'‘«»]+$/g, '').trim();
    if (!line || /^(nr\.?|spruch|nummer)$/i.test(line) || line.length < 4) continue;
    if (/^#{1,6}\s/.test(line)) continue; // Überschriften
    // fehlende Namen ergänzen
    line = line.replace(/^,\s*/, '[Name], ');
    line = line.replace(/,\s*!/g, ', [Name]!');
    line = line.replace(/,\s*\?/g, ', [Name]?');
    out.push(line);
  }
  return out;
}

/** Export als JSON (zum Sichern oder Teilen mit anderen Handys). */
export function exportLibrary(custom, hidden) {
  return JSON.stringify({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, exportedAt: new Date().toISOString(), jokes: custom, hiddenBuiltIn: hidden }, null, 2);
}

/**
 * Import aus JSON. Doppelte Sprüche (gleicher Text + Situation) werden übersprungen.
 * @returns {{custom:object[], hidden:string[], added:number, skipped:number, errors:string[]}}
 */
export function importLibrary(json, custom = [], hidden = []) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return { custom, hidden, added: 0, skipped: 0, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  if (!data || data.format !== LIBRARY_FORMAT || !Array.isArray(data.jokes)) {
    return { custom, hidden, added: 0, skipped: 0, errors: ['Das ist keine DART-BUDDY-Sprüchedatei.'] };
  }
  const key = (j) => `${j.situation}|${j.text}`;
  const existing = new Set(custom.map(key));
  const next = custom.slice();
  let added = 0;
  let skipped = 0;
  const errors = [];
  for (const raw of data.jokes) {
    const r = validateCustomJoke({ ...raw, id: undefined });
    if (!r.ok) {
      skipped++;
      errors.push(`„${String(raw && raw.text).slice(0, 40)}…“: ${r.errors[0]}`);
      continue;
    }
    if (existing.has(key(r.joke))) {
      skipped++;
      continue;
    }
    existing.add(key(r.joke));
    next.push(r.joke);
    added++;
  }
  const hiddenNext = [...new Set([...hidden, ...(Array.isArray(data.hiddenBuiltIn) ? data.hiddenBuiltIn : [])])];
  return { custom: next, hidden: hiddenNext, added, skipped, errors };
}
