// DART BUDDY – der freche Kommentator
// ------------------------------------------------------------
// Trennung der Verantwortung:
//   * Alle Zahlen (Punkte, Rest, Führung, Abstände) kommen deterministisch aus
//     der Engine und werden in feste Satzbausteine eingesetzt.
//   * Der Kommentator wählt nur den Spruch – abwechslungsreich, ohne
//     Wiederholungen, abgestimmt auf Leistung, Spielsituation und Humor-Stufe.
// So kann ein Spruch nie eine falsche Zahl „erfinden“.

import { checkoutSuggestion, dartLabel, dartSpeech } from './engine.js';
import { JOKES, EXTRAS, NEXT_CALLS, CORRECTION } from './jokes.js';

export { JOKES, EXTRAS, NEXT_CALLS };

export const HUMOR_LEVELS = ['freundlich', 'frech', 'gnadenlos'];

export const HUMOR_LABELS = {
  freundlich: 'Freundlich – lockere Witze',
  frech: 'Frech – ordentliche Sticheleien',
  gnadenlos: 'Gnadenlos – FSK-16-Dartabend',
};

// Welche Spruch-Töpfe pro Humor-Stufe verwendet werden (der erste ist der Haupttopf).
// f = freundlich, c = frech, g = gnadenlos, k = Kumpel-Sammlung, x = FSK-16-Edition
export const LEVEL_POOLS = {
  freundlich: ['f'],
  frech: ['c', 'k', 'f'],
  gnadenlos: ['x', 'k', 'g', 'c'],
};
const PRIMARY_WEIGHT = 0.6; // Chance für den Haupttopf
const SITUATION_WEIGHT = 0.65; // Chance für einen passenden Situations-Spruch

const REST_CALLS = ['Noch {rest}!', 'Rest {rest}!', 'Bleiben {rest}!', 'Noch {rest} übrig!'];

// ------------------------------------------------------------

export function classifyTurn(result) {
  if (result.checkout) return 'win';
  if (result.bust) return 'bust';
  const p = result.points;
  if (p === 180) return 'max';
  if (p >= 140) return 'big';
  if (p >= 100) return 'ton';
  if (p >= 60) return 'good';
  if (p >= 45) return 'solid';
  if (p >= 20) return 'mid';
  if (p >= 1) return 'low';
  return 'zero';
}

const ENERGY = { zero: 1, low: 1, mid: 1, solid: 2, good: 2, ton: 3, big: 3, max: 4, bust: 2, win: 4 };

/** Streckt einen Namen für den Jubel: „Wowa“ → „WOOOOWAAAA“. */
export function shoutName(name) {
  const up = String(name).toUpperCase();
  const firstVowel = up.search(/[AEIOUÄÖÜY]/);
  if (firstVowel < 0) return `${up}!!!`;
  let out = up.slice(0, firstVowel + 1) + up[firstVowel].repeat(3) + up.slice(firstVowel + 1);
  if (/[AEIOUÄÖÜY]$/.test(out)) out += out[out.length - 1].repeat(3);
  return out;
}

/**
 * Leitet aus Zustand vor und nach der Aufnahme den Spielkontext ab.
 * Alle Werte stammen aus der Engine – Sprüche setzen sie nur ein.
 * @param {{hadQuestion?: boolean}} [extra] – z. B. ob bei dieser Aufnahme nachgefragt werden musste
 */
export function buildContext(before, after, result, config, extra = {}) {
  const pid = result.playerId;
  const player = after.byId[pid];
  const n = after.players.length;
  const nextId = after.activePlayerId;
  const next = nextId ? after.byId[nextId] : null;

  const rankBefore = before.standings.ranks[pid];
  const rankAfter = after.standings.ranks[pid];
  const leadersBefore = before.players.filter((p) => before.standings.ranks[p.id] === 1);
  const leadersAfter = after.players.filter((p) => after.standings.ranks[p.id] === 1);
  const gameUnderway = before.players.some((p) => p.remaining < config.startScore);
  const leader = leadersAfter.length === 1 && gameUnderway ? leadersAfter[0] : null;

  const leaderChange =
    n > 1 && gameUnderway && !result.checkout && leadersAfter.length === 1 &&
    leadersAfter[0].id === pid && !leadersBefore.some((p) => p.id === pid);
  const prevLeader = leaderChange ? leadersBefore[0] : null;

  const lastBefore = n > 2 && rankBefore === n;
  const comeback = !result.checkout && lastBefore && rankAfter < n && result.points >= 40;
  const lastPlace = !result.checkout && n > 2 && rankBefore === n && rankAfter === n && result.points < 40;

  let close = null;
  if (n > 1 && !result.checkout) {
    const [a, b] = after.standings.order.map((id) => after.byId[id]);
    const diff = b.remaining - a.remaining;
    if ((a.id === pid || b.id === pid) && diff <= 20 && a.remaining <= 170) close = { a, b, diff };
  }

  const dartsLeft = config.dartsPerTurn >= 3 ? 3 : config.dartsPerTurn;
  const route = !result.checkout && player.remaining <= 180 ? checkoutSuggestion(player.remaining, config.outMode, dartsLeft) : null;
  const finishRange = !result.checkout && !result.bust && result.remainingBefore > 170 && player.remaining <= 170 && !!route;
  const oneDart = !result.checkout && !!route && route.length === 1 && !finishRange;

  // Der gefährlichste Gegner: wer (außer dem Werfer) am wenigsten Rest hat
  const others = after.players.filter((p) => p.id !== pid);
  const rival = others.length ? others.reduce((a, b) => (b.remaining < a.remaining ? b : a)) : null;
  const rivalCanFinish = !!rival && rival.remaining <= 170 && !!checkoutSuggestion(rival.remaining, config.outMode, dartsLeft);
  const rivalBust = result.bust && rivalCanFinish && rival.remaining <= 100;
  const rivalLow = !result.bust && !result.checkout && result.points < 40 && rivalCanFinish && rival.remaining <= 100 && player.remaining - rival.remaining >= 60;

  // Eigene Vorgeschichte des Werfers (aus dem Zustand VOR dieser Aufnahme)
  const prevTurns = before.log.filter((l) => l.type === 'turn' && l.playerId === pid);
  const prevTurn = prevTurns[prevTurns.length - 1] || null;
  const counted = result.darts.filter((_, i) => !result.ignored.includes(i));
  const isMiss = (d) => d.mult === 0;
  const lastDart = counted[counted.length - 1] || null;

  return {
    category: classifyTurn(result),
    player: { id: pid, name: player.name, nickname: player.nickname },
    next: next
      ? {
          id: next.id,
          name: next.name,
          nickname: next.nickname,
          remaining: next.remaining,
          bestTurn: next.stats.highestTurn,
          isLast: n > 2 && after.standings.ranks[next.id] === n,
        }
      : null,
    points: result.points,
    thrown: result.thrown,
    remaining: player.remaining,
    bust: result.bust,
    bustReason: result.bustReason,
    bustDart: result.bust ? result.darts[result.endedAfter] : null,
    checkout: result.checkout,
    darts: result.darts,
    lastDart,
    hasMiss: counted.some(isMiss),
    hasTripleHit: counted.some((d) => d.mult === 3),
    thirdOnlyMiss: counted.length === 3 && isMiss(counted[2]) && !isMiss(counted[0]) && !isMiss(counted[1]),
    turnsBefore: before.byId[pid].stats.turns,
    prevPoints: prevTurn ? prevTurn.points : null,
    prevHadMiss: !!prevTurn && prevTurn.darts.some((d, i) => isMiss(d) && !prevTurn.ignored.includes(i)),
    bestBefore: before.byId[pid].stats.highestTurn,
    leaderChange,
    prevLeader: prevLeader ? { id: prevLeader.id, name: prevLeader.name } : null,
    leaderId: leader ? leader.id : null,
    leaderName: leader ? leader.name : null,
    leaderRest: leader ? leader.remaining : null,
    leaderIsOther: !!leader && leader.id !== pid,
    rival: rival ? { id: rival.id, name: rival.name, remaining: rival.remaining } : null,
    rivalBust,
    rivalLow,
    comeback,
    lastPlace,
    close: close ? { a: close.a.name, b: close.b.name, diff: close.diff } : null,
    finishRange,
    oneDart,
    route,
    rankAfter,
    playerCount: n,
    dartsPerTurn: config.dartsPerTurn,
    outMode: config.outMode,
    hadQuestion: !!extra.hadQuestion,
  };
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

const entryText = (e) => (typeof e === 'string' ? e : e.t);

/** Prüft, ob ein Spruch in der aktuellen Situation passt. */
export function isEligible(entry, ctx) {
  if (typeof entry === 'string') return true;
  if (entry.min !== undefined && ctx.points < entry.min) return false;
  if (entry.max !== undefined && ctx.points > entry.max) return false;
  if (entry.players !== undefined && ctx.playerCount !== entry.players) return false;
  if (entry.when) {
    try {
      if (!entry.when(ctx)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Alle Sprüche, die bei dieser Humor-Stufe und Situation in Frage kommen. */
export function jokeCandidates(table, humor, ctx) {
  const out = [];
  for (const key of LEVEL_POOLS[humor] || LEVEL_POOLS.frech) {
    for (const e of (table && table[key]) || []) if (isEligible(e, ctx)) out.push({ e, pool: key });
  }
  return out;
}

/**
 * Der Kommentator. Merkt sich bereits benutzte Sprüche, um Wiederholungen zu vermeiden.
 */
export class Commentator {
  constructor({ humor = 'frech', rng = Math.random, memorySize = 80 } = {}) {
    this.humor = HUMOR_LEVELS.includes(humor) ? humor : 'frech';
    this.rng = rng;
    this.memorySize = memorySize;
    this.recent = [];
    this.lastRestCall = -1;
  }

  setHumor(h) {
    if (HUMOR_LEVELS.includes(h)) this.humor = h;
  }

  pick(list) {
    return list[Math.floor(this.rng() * list.length) % list.length];
  }

  remember(tpl) {
    this.recent.push(tpl);
    if (this.recent.length > this.memorySize) this.recent.shift();
  }

  /**
   * Wählt einen passenden Spruch ohne Wiederholung.
   * Situations-Sprüche (mit Bedingung) werden bevorzugt, dann der Haupttopf der Humor-Stufe.
   * @returns {object|string|null} der gewählte Eintrag
   */
  pickEntry(table, ctx) {
    const all = jokeCandidates(table, this.humor, ctx);
    if (!all.length) return null;
    let fresh = all.filter((c) => !this.recent.includes(entryText(c.e)));
    if (!fresh.length) {
      // Alles schon gehört: Gedächtnis für diese Sprüche leeren, den letzten aber nicht sofort wiederholen
      const texts = all.map((c) => entryText(c.e));
      const last = this.recent[this.recent.length - 1];
      this.recent = this.recent.filter((t) => !texts.includes(t));
      fresh = all.filter((c) => entryText(c.e) !== last);
      if (!fresh.length) fresh = all;
    }
    const situational = fresh.filter((c) => typeof c.e === 'object' && c.e.when);
    const primaryKey = LEVEL_POOLS[this.humor][0];
    const primary = fresh.filter((c) => c.pool === primaryKey);
    let source = fresh;
    if (situational.length && this.rng() < SITUATION_WEIGHT) source = situational;
    else if (primary.length && this.rng() < PRIMARY_WEIGHT) source = primary;
    const chosen = this.pick(source).e;
    this.remember(entryText(chosen));
    return chosen;
  }

  /** Kompatibilität: Text eines passenden Spruchs. */
  pickJoke(table, ctx = {}) {
    const e = this.pickEntry(table, ctx);
    return e ? entryText(e) : null;
  }

  rotating(list, key) {
    let i = Math.floor(this.rng() * list.length) % list.length;
    if (list.length > 1 && i === this[key]) i = (i + 1) % list.length;
    this[key] = i;
    return list[i];
  }

  displayName(p) {
    if (p.nickname && this.rng() < 0.5) return p.nickname;
    return p.name;
  }

  /** Kurzer Spruch nach einer Korrektur (z. B. vertauschte Spieler). */
  correctionQuip() {
    return this.pickJoke(CORRECTION, { points: 0, playerCount: 0 }) || 'Korrigiert!';
  }

  /**
   * Erzeugt die komplette Ansage nach einer Aufnahme.
   * Reihenfolge: Schlagzeile (Zahlen) → Spruch → Rest → Extra → nächster Spieler.
   * @returns {{text:string, parts:string[], energy:number, category:string}}
   */
  comment(ctx) {
    const name = this.displayName(ctx.player);
    const routeText = ctx.route ? ctx.route.map(dartSpeech).join(', ') : '';
    const vars = {
      name,
      NAME: ctx.player.name.toUpperCase(),
      SHOUT: shoutName(ctx.player.name),
      rest: ctx.remaining,
      pts: ctx.points,
      leader: ctx.leaderName,
      leaderRest: ctx.leaderRest,
      rival: ctx.rival && ctx.rival.name,
      rivalRest: ctx.rival && ctx.rival.remaining,
      prevBest: ctx.bestBefore,
      route: routeText,
      next: ctx.next && ctx.next.name,
      nextBest: ctx.next && ctx.next.bestTurn,
    };
    const parts = [];
    const cat = ctx.category;
    const joke = this.pickEntry(JOKES[cat], ctx);
    const jokeText = joke ? fill(entryText(joke), vars) : '';
    const jokeIsHeadline = !!(joke && typeof joke === 'object' && joke.headline);

    // 1. Schlagzeile – deterministische Zahlen
    if (cat === 'win') {
      parts.push(`Checkout ${ctx.points}!${/HAT GEWONNEN/.test(jokeText) ? '' : ` ${ctx.player.name.toUpperCase()} HAT GEWONNEN!`}`);
    } else if (cat === 'bust') {
      const reason = ctx.bustReason === 'nicht mit einem Doppel beendet' ? 'Kein Doppel zum Schluss!'
        : ctx.bustReason === 'nicht mit Doppel oder Triple beendet' ? 'Kein Doppel oder Triple zum Schluss!'
          : ctx.bustReason === 'Rest 1 ist nicht checkbar' ? 'Rest 1 geht nicht!' : '';
      const head = jokeIsHeadline ? '' : fill(this.pick(['Abgeschmissen, {name}!', 'Überworfen, {name}!', 'Bust! {name}, das war zu viel!']), vars);
      if (head) parts.push(head + (reason ? ` ${reason}` : ''));
      else if (reason) {
        // Spruch übernimmt die Schlagzeile, der Grund folgt direkt danach
        parts.push(jokeText);
        parts.push(reason);
      }
    } else if (cat === 'max') {
      if (!jokeIsHeadline) parts.push(`HUNDERTACHTZIG, ${ctx.player.name.toUpperCase()}!`);
    } else {
      const heads = ctx.points === 0
        ? ['Null Punkte, {name}!', '{name}: null Punkte!']
        : ctx.points === 100
          ? ['Hundert Punkte, {name}!', 'Die Ton für {name}! Hundert!']
          : ['{pts} Punkte, {name}!', '{name} mit {pts}!', '{pts} für {name}!'];
      parts.push(fill(this.pick(heads), vars));
    }

    // 2. Spruch
    if (jokeText && !parts.includes(jokeText)) parts.push(jokeText);

    // 3. Rest
    if (cat === 'bust') parts.push(`Dein alter Stand bleibt: ${ctx.remaining}!`);
    else if (cat !== 'win') parts.push(fill(this.rotating(REST_CALLS, 'lastRestCall'), vars));

    // 4. höchstens ein Extra zur Spielsituation (wichtigstes zuerst)
    if (cat !== 'win') {
      let extra = null;
      const take = (table, v = vars) => {
        const t = this.pickJoke(table, ctx);
        return t ? fill(t, v) : null;
      };
      if (ctx.leaderChange) extra = take(EXTRAS.leaderChange, { ...vars, prev: ctx.prevLeader.name });
      if (!extra && ctx.rivalBust) extra = take(EXTRAS.rivalBust);
      if (!extra && ctx.rivalLow) extra = take(EXTRAS.rivalLow);
      if (!extra && ctx.comeback) extra = take(EXTRAS.comeback);
      if (!extra && ctx.close) {
        const tpl = take(EXTRAS.close);
        const factual = ctx.close.diff === 0
          ? `Gleichstand zwischen ${ctx.close.a} und ${ctx.close.b}!`
          : `Nur ${ctx.close.diff} Punkte zwischen ${ctx.close.a} und ${ctx.close.b}!`;
        extra = tpl ? `${tpl} ${factual}` : factual;
      }
      if (!extra && ctx.finishRange) extra = take(EXTRAS.finishRange);
      if (!extra && ctx.oneDart) extra = take(EXTRAS.oneDart);
      if (!extra && ctx.lastPlace && this.rng() < 0.5) extra = take(EXTRAS.lastPlace);
      if (extra && extra.trim()) parts.push(extra.trim());
    }

    // 5. Nächster Spieler
    if (ctx.next && cat !== 'win') {
      const call = this.pickJoke(NEXT_CALLS, ctx) || '{next}, du bist dran!';
      parts.push(fill(call, vars));
    }

    return { text: parts.join(' '), parts, energy: ENERGY[cat], category: cat };
  }
}

/** Formatiert einen Checkout-Weg für die Anzeige: „T20 · T19 · D12“ */
export function formatRoute(route) {
  return route ? route.map(dartLabel).join(' · ') : '';
}
