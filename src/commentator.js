// DART BUDDY – der freche Kommentator
// ------------------------------------------------------------
// Trennung der Verantwortung:
//   * Alle Zahlen (Punkte, Rest, Führung, Abstände) kommen deterministisch aus
//     der Engine und werden in feste Satzbausteine eingesetzt.
//   * Der Kommentator wählt nur den Spruch – abwechslungsreich, ohne
//     Wiederholungen, abgestimmt auf Leistung, Spielsituation und Humor-Stufe.
// So kann ein Spruch nie eine falsche Zahl „erfinden“.

import { checkoutSuggestion, dartLabel } from './engine.js';

export const HUMOR_LEVELS = ['freundlich', 'frech', 'gnadenlos'];

// Welche Spruch-Töpfe pro Humor-Stufe verwendet werden
const LEVEL_POOLS = {
  freundlich: ['f'],
  frech: ['c', 'f'],
  gnadenlos: ['g', 'c'],
};
// Gewichtung: der erste Topf ist der „Haupttopf“ der Stufe
const PRIMARY_WEIGHT = 0.75;

export const JOKES = {
  zero: {
    f: [
      'Null Punkte – aber immerhin wurde niemand verletzt.',
      'Die Scheibe hat heute Ruhetag, {name}.',
      'Kopf hoch, das war bestimmt nur der Aufwärmwurf!',
      'Manchmal will die Scheibe einfach nicht. Nächste Runde wird besser!',
      'Die Wand bedankt sich herzlich für die Aufmerksamkeit.',
    ],
    c: [
      'Hast du die Pfeile geworfen oder nur böse angeguckt?',
      'Die Dartscheibe hat dich gerade eiskalt geghostet, {name}.',
      'Respekt, so konsequent danebenwerfen muss man erstmal schaffen.',
      'Das war kein Wurf, das war eine Wandrenovierung.',
      'Selbst der Kühlschrank hätte mehr getroffen – und der steht in der Küche.',
      'Die Pfeile wollten heute wohl lieber Freiheit statt Punkte.',
    ],
    g: [
      'Null. Nada. Niente. Weißt du überhaupt, wo die Scheibe hängt, {name}?',
      'Wenn Danebenwerfen olympisch wäre, hättest du jetzt Gold.',
      'Ich hab schon Tauben gesehen, die besser zielen – und die haben keine Arme.',
      'Bitte keine Pfeile mehr Richtung Fenster, {name}. Danke.',
      'Das Einzige, was du heute triffst, ist ein neuer Tiefpunkt.',
    ],
  },
  low: {
    f: [
      'Ein kleiner Schritt für die Menschheit – und ein noch kleinerer für {name}.',
      'Langsam, aber stetig – wie eine Schnecke mit Plan.',
      'Immerhin Punkte! Da geht noch mehr.',
      'Das war der Testlauf, oder {name}?',
    ],
    c: [
      'Hast du die Pfeile geworfen oder zur Scheibe getragen?',
      'Mit der Ausbeute bist du nächstes Jahr fertig.',
      'Das war so schwach, das WLAN hat mehr Balken.',
      'Ich hab echt Mitleid – und ich bin nur eine App.',
      'Zielwasser vergessen, {name}?',
      'Viel Haltung, wenig Ergebnis. Ballett wäre auch eine Option.',
    ],
    g: [
      'Mein Taschenrechner schläft gleich ein, {name}.',
      'Selbst mit verbundenen Augen wäre das keine Ausrede mehr.',
      'Bei dem Tempo schicke ich dir den Endstand per Post.',
      'Das war kein Wurf, das war ein Hilferuf.',
      'Die anderen gründen schon mal einen Fanclub – gegen dich.',
    ],
  },
  mid: {
    f: [
      'Solide Basis, da kommt bestimmt noch was!',
      'Nicht schlecht, Herr Specht!',
      'Okay, die Richtung stimmt schon mal.',
      'Ordentlich, aber das geht noch knackiger!',
    ],
    c: [
      'Mit gekochten Spaghetti hättest du wahrscheinlich genauso gut getroffen!',
      'Das ist der Wurf von jemandem, der schon ans nächste Bier denkt.',
      'Mittelmaß deluxe – mit extra Käse.',
      'Nicht gut, nicht schlecht – einfach da.',
      'Die Scheibe gähnt, aber sie lebt noch.',
      'Ganz okay – für einen Montagmorgen.',
    ],
    g: [
      'Du bist das stille Wasser unter den Dartspielern: still und ohne Geschmack.',
      'So mittel, das könnte als Normwert im Lexikon stehen.',
      'Die Pfeile sind angekommen. Mehr kann man dazu nicht sagen.',
      'Wow. Und jetzt das Ganze nochmal mit Absicht.',
      'Hätte, hätte, Triple-Kette.',
    ],
  },
  solid: {
    f: ['Saubere Sache!', 'Da kommt Bewegung rein!', 'Schön gezielt, weiter so!', 'Gute Aufnahme, {name}!'],
    c: [
      'Na also, geht doch! Wer hat dir denn die Brille geputzt?',
      'Ordentlich! Die Scheibe zuckt schon ein bisschen.',
      'Da hat jemand die Pfeile endlich richtig rum gehalten.',
      'Hoppla, das sieht ja fast nach Absicht aus!',
    ],
    g: [
      'Endlich mal ein Wurf, für den man sich nicht fremdschämen muss.',
      'Glück oder Talent? Ich tippe auf Glück.',
      'Selbst ein blindes Huhn trifft mal ein Korn.',
      'Nicht schlecht – die Erwartungen waren ja auch im Keller.',
    ],
  },
  good: {
    f: ['Starke Aufnahme!', 'Das kann sich sehen lassen!', 'Jetzt wird es ernst!', 'Sauber, die Scheibe hat es gespürt!'],
    c: [
      'Uiii, jetzt wird es warm hier drin!',
      'Da hat aber jemand heimlich trainiert!',
      'Die Scheibe schaut schon nervös zu dir rüber.',
      'Hast du den Pfeilen vorher was ins Ohr geflüstert?',
      'So langsam wird es unheimlich, {name}!',
    ],
    g: [
      'Wer bist du und was hast du mit {name} gemacht?',
      'Huch, kann ja doch was. Hätte ich echt nicht gedacht.',
      'Endlich! Ich wollte schon den Notarzt für deine Würfe rufen.',
      'Nicht schlecht für jemanden mit deiner Vorgeschichte.',
    ],
  },
  ton: {
    f: ['Klasse geworfen!', 'Dreistellig! Applaus!', 'Was für eine Aufnahme!', 'Das war richtig stark!'],
    c: [
      'Alter, wer hat dir denn heimlich Zielwasser gegeben?',
      'Dreistellig! Die Scheibe ruft gleich ihren Anwalt an.',
      'Jetzt aber bloß nicht abheben, {name}!',
      'Sag mal, hast du dir Profi-Pfeile ausgeliehen?',
      'Die anderen gucken schon ganz blass!',
    ],
    g: [
      'Okay, ich nehme alles zurück. Fast alles.',
      'Wer hat dich bestochen, {name}? Ich will auch was abhaben.',
      'Genieß es – das passiert dir nicht oft.',
      'Die anderen sollten jetzt Angst kriegen. Oder lachen, wenn du das nie wiederholst.',
    ],
  },
  big: {
    f: ['Gigantisch! Was für ein Wurf!', 'Das war Weltklasse!', 'Die Halle tobt!'],
    c: [
      'Alter Schwede! Das war ja fast schon unverschämt!',
      'Die Scheibe braucht gleich eine Raucherpause!',
      'Hast du heimlich bei den Profis gespickt?',
      'Das war so gut, ich muss mich kurz setzen. Und ich bin eine App!',
    ],
    g: [
      'Das war so gut, ich verlange einen Dopingtest.',
      'Die anderen können eigentlich direkt nach Hause gehen.',
      'Unfassbar. Und ich dachte, du kannst nur danebenwerfen.',
    ],
  },
  max: {
    f: ['Perfekte Aufnahme! Mehr geht nicht!', 'Das Maximum! Unglaublich, {name}!'],
    c: [
      'WAS ZUM TEUFEL! Die Dartscheibe überlegt gerade, ihren Job zu kündigen!',
      'Drei Mal Triple 20 – ruft sofort die Presse an!',
      'Das gibt es doch nicht! {name} im Profi-Modus!',
    ],
    g: [
      'Ich verlange sofort den Videobeweis!',
      '{name}, gib es zu: Die Pfeile sind mit Magneten präpariert!',
    ],
  },
  bust: {
    f: [
      'Schade, {name} – zu viel des Guten.',
      'Ganz knapp am Plan vorbei. Nächste Runde klappt es!',
      'Zu viel Power, {name}! Kommt vor.',
    ],
    c: [
      '{name}, du hast gerade mehr Punkte vernichtet als getroffen.',
      'Mathe ist nicht so dein Ding, oder {name}?',
      'Ein Taschenrechner hilft, {name}. Nur so als Tipp.',
      'Zu viel gewollt, gar nichts gekriegt!',
    ],
    g: [
      'Glückwunsch, {name}: Drei Pfeile für exakt null Fortschritt.',
      '{name} spielt heute offenbar rückwärts.',
      'So überflüssig wie ein Aschenbecher auf dem Motorrad.',
    ],
  },
  win: {
    f: ['Herzlichen Glückwunsch, {name}! Verdienter Sieg!', 'Was für ein Finish! Großartig gespielt!'],
    c: ['{SHOUT}! DIE MASCHINE! DIE DART-LEGENDE!', 'Einfach eiskalt ausgecheckt! Die Konkurrenz darf jetzt die Pfeile einsammeln!'],
    g: [
      '{SHOUT}! Die anderen dürfen jetzt die Scheibe putzen!',
      'Unglaublich – sogar {name} kann gewinnen! Ich bin sprachlos. Fast.',
    ],
  },
};

const EXTRAS = {
  leaderChange: {
    f: ['{name} geht in Führung!', 'Neue Nummer eins: {name}!'],
    c: ['{name} übernimmt die Führung! {prev}, das war es mit dem Thron!', 'Führungswechsel! {prev}, schau mal nach hinten – ach nee, nach vorne!'],
    g: ['{name} ist jetzt vorne. {prev}, du darfst ab jetzt den Rücken bewundern.', 'Thronsturz! {prev} wurde gerade eiskalt entmachtet.'],
  },
  comeback: {
    f: ['Die Aufholjagd läuft!', '{name} ist wieder voll im Spiel!'],
    c: ['{name} kommt von hinten wie ein Güterzug!', 'Achtung, Aufholjagd! Da wird es jemandem ganz warm!'],
    g: ['Die rote Laterne ist abgegeben – jemand anderes darf sie jetzt halten!', 'Comeback! Wer hätte das gedacht? Ich jedenfalls nicht.'],
  },
  close: {
    f: ['Kopf-an-Kopf-Rennen!', 'Spannender geht es kaum!'],
    c: ['Kopf an Kopf – hier wird gleich jemand nervös!', 'Das ist knapper als der Kühlschrank am Monatsende!'],
    g: ['So knapp – gleich fängt hier einer an zu schwitzen.', 'Eng, enger, Herzinfarkt!'],
  },
  lastPlace: {
    f: [],
    c: ['{name} hält weiter tapfer die rote Laterne.'],
    g: ['{name} bleibt Letzter – aber mit Leidenschaft!', 'Die rote Laterne steht {name} ausgezeichnet.'],
  },
  finishRange: {
    f: ['{name} ist im Finish-Bereich!'],
    c: ['Jetzt riecht es nach Checkout, {name}!'],
    g: ['Finish-Bereich, {name}. Jetzt bitte nicht wieder alles versemmeln.'],
  },
};

const NEXT_CALLS = [
  '{next}, du bist dran!',
  'Auf geht es, {next}!',
  '{next}, ran an die Scheibe!',
  'Bühne frei für {next}!',
  '{next}, zeig was du kannst!',
  'Weiter geht es mit {next}!',
];

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
 * Alle Werte stammen aus der Engine.
 */
export function buildContext(before, after, result, config) {
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

  const leaderChange =
    n > 1 &&
    gameUnderway &&
    !result.checkout &&
    leadersAfter.length === 1 &&
    leadersAfter[0].id === pid &&
    !leadersBefore.some((p) => p.id === pid);
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

  const route =
    !result.checkout && player.remaining <= 180 ? checkoutSuggestion(player.remaining, config.outMode, config.dartsPerTurn >= 3 ? 3 : config.dartsPerTurn) : null;
  const finishRange = !result.checkout && !result.bust && result.remainingBefore > 170 && player.remaining <= 170 && !!route;

  return {
    category: classifyTurn(result),
    player: { id: pid, name: player.name, nickname: player.nickname },
    next: next ? { id: next.id, name: next.name, nickname: next.nickname } : null,
    points: result.points,
    thrown: result.thrown,
    remaining: player.remaining,
    bust: result.bust,
    bustReason: result.bustReason,
    checkout: result.checkout,
    darts: result.darts,
    leaderChange,
    prevLeader: prevLeader ? { id: prevLeader.id, name: prevLeader.name } : null,
    comeback,
    lastPlace,
    close: close ? { a: close.a.name, b: close.b.name, diff: close.diff } : null,
    finishRange,
    route,
    rankAfter,
    playerCount: n,
  };
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/**
 * Der Kommentator. Merkt sich bereits benutzte Sprüche, um Wiederholungen zu vermeiden.
 */
export class Commentator {
  constructor({ humor = 'frech', rng = Math.random, memorySize = 60 } = {}) {
    this.humor = HUMOR_LEVELS.includes(humor) ? humor : 'frech';
    this.rng = rng;
    this.memorySize = memorySize;
    this.recent = []; // zuletzt verwendete Texte (Vorlagen)
    this.lastNextCall = -1;
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

  /** Wählt einen Spruch aus den Töpfen der aktuellen Humor-Stufe, ohne Wiederholung. */
  pickJoke(table) {
    const pools = LEVEL_POOLS[this.humor];
    const primary = table[pools[0]] || [];
    const secondary = pools[1] ? table[pools[1]] || [] : [];
    let source = primary;
    if (secondary.length && (!primary.length || this.rng() > PRIMARY_WEIGHT)) source = secondary;
    let fresh = source.filter((t) => !this.recent.includes(t));
    if (!fresh.length) {
      const all = primary.concat(secondary);
      fresh = all.filter((t) => !this.recent.includes(t));
      if (!fresh.length) {
        // alles schon einmal benutzt: Gedächtnis für diesen Topf leeren, aber den letzten nicht sofort wiederholen
        const last = this.recent[this.recent.length - 1];
        this.recent = this.recent.filter((t) => !all.includes(t));
        fresh = all.filter((t) => t !== last);
        if (!fresh.length) fresh = all;
      }
    }
    if (!fresh.length) return null;
    const tpl = this.pick(fresh);
    this.remember(tpl);
    return tpl;
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

  /**
   * Erzeugt die komplette Ansage nach einer Aufnahme.
   * Reihenfolge: Schlagzeile (Zahlen) → Spruch → Rest → Extra → nächster Spieler.
   * @returns {{text:string, parts:string[], energy:number, category:string}}
   */
  comment(ctx) {
    const name = this.displayName(ctx.player);
    const vars = { name, NAME: ctx.player.name.toUpperCase(), SHOUT: shoutName(ctx.player.name), rest: ctx.remaining };
    const parts = [];
    const cat = ctx.category;

    // 1. Schlagzeile – deterministische Zahlen
    if (cat === 'win') {
      parts.push(`Checkout ${ctx.points}! ${ctx.player.name.toUpperCase()} HAT GEWONNEN!`);
    } else if (cat === 'bust') {
      const head = fill(this.pick(['Abgeschmissen, {name}!', 'Überworfen, {name}!', 'Bust! {name}, das war zu viel!']), vars);
      const reason = ctx.bustReason === 'nicht mit einem Doppel beendet' ? ' Kein Doppel zum Schluss!' : ctx.bustReason === 'nicht mit Doppel oder Triple beendet' ? ' Kein Doppel oder Triple zum Schluss!' : ctx.bustReason === 'Rest 1 ist nicht checkbar' ? ' Rest 1 geht nicht!' : '';
      parts.push(head + reason);
    } else if (cat === 'max') {
      parts.push(`HUNDERTACHTZIG, ${ctx.player.name.toUpperCase()}!`);
    } else {
      const heads = ctx.points === 0
        ? ['Null Punkte, {name}!', '{name}: null Punkte!']
        : ctx.points === 100
          ? ['Hundert Punkte, {name}!', 'Die Ton für {name}! Hundert!']
          : ['{pts} Punkte, {name}!', '{name} mit {pts}!', '{pts} für {name}!'];
      parts.push(fill(this.pick(heads), { ...vars, pts: ctx.points }));
    }

    // 2. Spruch
    const joke = this.pickJoke(JOKES[cat]);
    if (joke) parts.push(fill(joke, vars));

    // 3. Rest
    if (cat === 'bust') parts.push(`Dein alter Stand bleibt: ${ctx.remaining}!`);
    else if (cat !== 'win') parts.push(fill(this.rotating(REST_CALLS, 'lastRestCall'), vars));

    // 4. höchstens ein Extra zur Spielsituation
    if (cat !== 'win') {
      let extra = null;
      if (ctx.leaderChange) extra = fill(this.pickJoke(EXTRAS.leaderChange) || '', { ...vars, prev: ctx.prevLeader.name });
      else if (ctx.comeback) extra = fill(this.pickJoke(EXTRAS.comeback) || '', vars);
      else if (ctx.close && ctx.close.diff <= 20) {
        const tpl = this.pickJoke(EXTRAS.close);
        const factual = ctx.close.diff === 0
          ? `Gleichstand zwischen ${ctx.close.a} und ${ctx.close.b}!`
          : `Nur ${ctx.close.diff} Punkte zwischen ${ctx.close.a} und ${ctx.close.b}!`;
        extra = tpl ? `${fill(tpl, vars)} ${factual}` : factual;
      } else if (ctx.finishRange) extra = fill(this.pickJoke(EXTRAS.finishRange) || '', vars);
      else if (ctx.lastPlace && this.rng() < 0.5) extra = fill(this.pickJoke(EXTRAS.lastPlace) || '', vars);
      if (extra && extra.trim()) parts.push(extra.trim());
    }

    // 5. Nächster Spieler
    if (ctx.next && cat !== 'win') {
      parts.push(fill(this.rotating(NEXT_CALLS, 'lastNextCall'), { next: ctx.next.name }));
    }

    return { text: parts.join(' '), parts, energy: ENERGY[cat], category: cat };
  }
}

/** Formatiert einen Checkout-Weg für die Anzeige: „T20 · T19 · D12“ */
export function formatRoute(route) {
  return route ? route.map(dartLabel).join(' · ') : '';
}
