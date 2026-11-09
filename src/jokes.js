// DART BUDDY – Spruch-Bibliothek
// ------------------------------------------------------------
// Hier stehen ALLE Sprüche. Neue Sprüche einfach in den passenden Topf eintragen.
//
// Töpfe je Humor-Stufe:
//   f = freundlich   c = frech   g = gnadenlos (Grundstock)
//   k = frech-Sprüche der Kommentarbibliothek (data/comments.de.json) – bei frech und gnadenlos
//   x = gnadenlos/FSK 16 – nur bei gnadenlos
//
// Ein Eintrag ist entweder ein Text oder ein Objekt mit Bedingungen:
//   S('Text', { min, max, players, when, headline })
//     min/max   – nur bei dieser Punktzahl der Aufnahme
//     players   – nur bei genau dieser Spielerzahl (z. B. 3 für „die anderen beiden“)
//     when(ctx) – nur in dieser Spielsituation (Kontext siehe commentator.js → buildContext)
//     headline  – ersetzt die Standard-Schlagzeile (z. B. „BUST! …“), damit nichts doppelt kommt
//
// Platzhalter: {name} {NAME} {SHOUT} {pts} {rest} {next} {leader} {leaderRest}
//              {rival} {rivalRest} {prevBest} {nextBest} {route} {prev}
// Zahlen kommen IMMER aus der Engine – Sprüche dürfen keine festen Punktzahlen enthalten.

/** Spruch mit Bedingungen. */
export const S = (t, opts = {}) => ({ t, ...opts });

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

export const EXTRAS = {
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

export const NEXT_CALLS = {
  f: [
    '{next}, du bist dran!',
    'Auf geht es, {next}!',
    '{next}, ran an die Scheibe!',
    'Bühne frei für {next}!',
    '{next}, zeig was du kannst!',
    'Weiter geht es mit {next}!',
  ],
  c: [],
  g: [],
};

// =====================================================================
// Weitere Aufrufe für den nächsten Spieler und Korrektur-Sprüche
// =====================================================================

NEXT_CALLS.c.push('{next}, die Scheibe wartet!', 'Auf geht es, {next} – enttäusch uns nicht!');
NEXT_CALLS.g.push('{next}, mach es kurz und schmerzlos!', '{next}, jetzt bitte keine Peinlichkeiten!');

export const CORRECTION = {
  f: ['Alles klar, ist korrigiert!', 'Kein Problem, ist korrigiert!'],
  c: ['Korrigiert! Ordnung muss sein.'],
  g: ['Korrigiert. Ihr seid ein Haufen Chaoten.'],
  x: ['Wer hat hier eigentlich wann geworfen? Ihr seid ein verdammter Haufen Chaoten!'],
};

// Neue Situations-Extras: Reaktion auf die anderen Spieler
EXTRAS.rivalBust = {
  f: ['Schade – und {rival} braucht nur noch {rivalRest}!'],
  c: ['Und das, während {rival} nur noch {rivalRest} braucht! Timing ist alles, {name}!', '{rival} sagt danke – bei {rivalRest} Rest kommt das wie gerufen!'],
  g: ['{rival} braucht nur noch {rivalRest} und du schmeißt ab, {name}! Netter kann man dem Gegner den Sieg nicht schenken.'],
};
EXTRAS.rivalLow = {
  f: ['{rival} ist schon bei {rivalRest} – da musst du jetzt ran, {name}!'],
  c: ['{rival} steht bei {rivalRest} – und du sammelst hier Kleingeld, {name}!'],
  g: ['{rival} braucht noch {rivalRest}. Du brauchst ein Wunder, {name}.'],
};
EXTRAS.oneDart = {
  f: ['{name}, jetzt fehlt nur noch {route}!'],
  c: ['{route} – und {name} ist durch!'],
  g: ['{route}, {name}. Ein Pfeil. Bitte nicht wieder versemmeln.'],
};

// =====================================================================
// Die 81 Sprüche der Kommentarbibliothek v1.0 (31 vom Dartabend + 50 FSK-16)
// stehen NICHT hier, sondern maßgeblich in data/comments.de.json
// (eingebunden über src/commentData.js).
// =====================================================================

// Eigene FSK-16-Ergänzungen für Situationen mit anderen Spielern
EXTRAS.rivalBust.x = [
  'Herzlichen Glückwunsch, {name}! Du hast {rival} gerade den roten Teppich ausgerollt – bei {rivalRest} Rest!',
  '{rival} steht bei {rivalRest} und du verkackst es mit einem Bust, {name}! Schadenfreude ist die schönste Freude!',
];
EXTRAS.rivalLow.x = [
  '{rival} braucht nur noch {rivalRest}, und du verballerst hier die Zeit, {name}! Pack schon mal das Portemonnaie für die nächste Runde Bier aus!',
];
EXTRAS.leaderChange.x = ['Thronwechsel, verdammt nochmal! {prev}, schwing deinen Hintern vom Sofa, {name} sitzt jetzt drauf!'];
NEXT_CALLS.x = ['{next}, beweg deinen Hintern an die Scheibe!', '{next}, Schluss mit Bier – ran an die verdammte Scheibe!'];
