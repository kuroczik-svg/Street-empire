// DART BUDDY – Spruch-Bibliothek
// ------------------------------------------------------------
// Hier stehen ALLE Sprüche. Neue Sprüche einfach in den passenden Topf eintragen.
//
// Töpfe je Humor-Stufe:
//   f = freundlich   c = frech   g = gnadenlos (Grundstock)
//   k = Kumpel-Sammlung (Sprüche vom Dartabend Markus/Lukas/Wowa) – bei frech und gnadenlos
//   x = FSK-16-Edition – nur bei gnadenlos
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
  k: ['Moment, Jungs, hier ist ja mehr Durcheinander als auf einem Bahnhof!'],
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
// KUMPEL-SAMMLUNG – Sprüche vom Dartabend mit Markus, Lukas und Wowa
// (Topf „k“: bei frech und gnadenlos)
// =====================================================================

const MAX_THREE_DARTS = (c) => c.dartsPerTurn === 3;

const K_BAD = [
  S('{name}, hast du die Pfeile geworfen oder die Scheibe nur vorsichtig gestreichelt?', { max: 30 }),
  S('Du wolltest zaubern? Alter, bei deinen Würfen braucht selbst der Zauberstab erstmal ein Bier!', { max: 44 }),
  S('Triple kann man werfen, muss man aber auch treffen, ne?', { max: 44, when: (c) => !c.hasTripleHit }),
  S('Du spielst Dart wie ein Bagger mit plattem Reifen – es geht vorwärts, aber verdammt langsam!', { min: 20, max: 59 }),
  S('{name}, was war das denn? Hast du mit geschlossenen Augen geworfen oder hat die Scheibe Angst vor dir?', { max: 25 }),
  S('Du wirfst die Pfeile, als müsstest du die Scheibe bezahlen, wenn du sie richtig triffst! Ein bisschen mehr Mut, mein Freund!', { max: 44 }),
  S('Mit der Punktzahl erschreckst du höchstens eine Fliege auf der Dartscheibe!', { max: 25 }),
  S('Hast du gerade mit den Pfeilen gewürfelt oder tatsächlich auf die Scheibe gezielt? {leader} lacht sich wahrscheinlich gerade kaputt!', { max: 30, when: (c) => c.leaderIsOther }),
  S('Mit {pts} Punkten holst du {leader} höchstens ein, wenn der zwischendurch einschläft! Die Scheibe hat heute echt Glück mit dir!', { min: 1, max: 44, when: (c) => c.leaderIsOther && c.remaining - c.leaderRest >= 60 }),
  S('Vorhin {prevBest} Punkte rausgehauen und jetzt wirfst du, als hättest du die Brille zu Hause vergessen?', { max: 35, when: (c) => c.bestBefore >= 100 }),
];
const K_WARNSCHUSS = S('Der dritte Pfeil war wohl ein Warnschuss für die Tapete! Die Scheibe hat jedenfalls nichts davon mitbekommen!', { when: (c) => c.thirdOnlyMiss });
const K_VERSTAENDIGUNG = S('{name}, na endlich! Die Zahlen haben wir jetzt eingefangen. Die Pfeile waren schneller als die Verständigung!', { when: (c) => c.hadQuestion });
const K_GOOD = [
  S('{name}, du legst ja los wie ein Profi! Hat dir jemand heimlich Zielwasser in die Cola gekippt?', { min: 60, when: (c) => c.turnsBefore === 0 }),
  S('Eben noch Pfeile spazieren getragen und jetzt spielst du wie Phil Taylor auf Koffein!', { min: 60, when: (c) => c.prevPoints !== null && c.prevPoints < 30 }),
  S('Die Scheibe hat schon gedacht, du wirfst mit Gummibärchen! Jetzt kommst du langsam in Fahrt!', { min: 45, max: 99, when: (c) => c.prevPoints !== null && c.prevPoints < 30 }),
  S('{name}, solide, endlich mal ohne Tapetenschaden!', { min: 45, max: 99, when: (c) => c.prevHadMiss && !c.hasMiss }),
  S('Die anderen beiden können schon mal anfangen, Ausreden zu sammeln!', { min: 60, players: 3, when: (c) => c.rankAfter === 1 }),
];
const K_TON = [
  S('Alter, du hast doch nur drei Pfeile und keine Maschinenpistole!', { when: MAX_THREE_DARTS }),
  S('Alter, hast du heimlich einen vierten Pfeil eingepackt?', { when: MAX_THREE_DARTS }),
];

for (const cat of ['zero', 'low', 'mid', 'solid', 'good', 'ton', 'big']) JOKES[cat].k = [K_VERSTAENDIGUNG];
JOKES.zero.k.push(...K_BAD);
JOKES.low.k.push(...K_BAD, K_WARNSCHUSS);
JOKES.mid.k.push(...K_BAD, K_WARNSCHUSS);
JOKES.solid.k.push(...K_BAD, ...K_GOOD, K_WARNSCHUSS);
JOKES.good.k.push(...K_GOOD, K_WARNSCHUSS);
JOKES.ton.k.push(...K_GOOD, ...K_TON);
JOKES.big.k.push(...K_GOOD, ...K_TON);
JOKES.bust.k = [
  S('{name}, die Triple waren größer als dein Rest, das tut doppelt weh!', { when: (c) => c.bustReason === 'überworfen' && c.bustDart && c.bustDart.mult === 3 }),
];
EXTRAS.oneDart.k = [
  S('{name}, du alter Dart-Ganove! Noch {rest} Punkte bis zum Sieg! {route}, und die anderen beiden dürfen dir die Krone aufsetzen!', { players: 3 }),
];
NEXT_CALLS.k = [
  'Na, dann schauen wir mal, ob {next} die Scheibe trifft oder nur die Wand dekoriert!',
  '{next}, nicht einschlafen an der Scheibe!',
  S('{next}, jetzt aber Gas geben, sonst brauchst du heute noch Stützräder für deine Pfeile!', { when: (c) => c.next.isLast }),
  S('{next}, zeig mal, ob deine {nextBest} Punkte vorhin Können waren oder ein Betriebsunfall!', { when: (c) => c.next.bestTurn >= 100 }),
  S('{leader} steht schon mit einem Bein auf dem Siegerpodest! {next}, jetzt musst du aber den Turbo einschalten!', { when: (c) => c.leaderId && c.leaderId !== c.next.id && c.leaderRest <= 80 && c.next.remaining - c.leaderRest >= 80 }),
  S('{next}, willst du noch mitspielen oder {leader} gleich den Pokal polieren?', { when: (c) => c.leaderId && c.leaderId !== c.next.id && c.leaderRest <= 60 && c.next.remaining - c.leaderRest >= 100 }),
  S('{next}, jetzt zeig den beiden mal, dass du nicht nur zum Biertrinken gekommen bist!', { players: 3 }),
  S('{next}, zeig den beiden mal, wo der Hammer hängt!', { players: 3 }),
  S('{name} hat gerade die Messlatte hochgelegt! {next}, was machen deine drei Pfeile?', { min: 100, when: (c) => MAX_THREE_DARTS(c) && !c.bust }),
];

// =====================================================================
// FSK-16-EDITION – 50 Sprüche (Topf „x“: nur Humor-Stufe gnadenlos)
// =====================================================================

// 1. Katastrophale Würfe – 0 bis 25 Punkte
const X_KATASTROPHE = [
  S('{name}, was zur Hölle war das?! Selbst ein besoffener Maulwurf hätte die Scheibe besser gefunden!'),
  S('Alter, bei deinem Talent braucht die Dartscheibe keinen Schutz. Die Wand dahinter schon!'),
  S('{name}, deine Pfeile haben offenbar gekündigt. Wegen mangelnder Führung!'),
  S('Meine Fresse, {name}! Du triffst so wenig, selbst die Scheibe hat Langeweile!'),
  S('Das war kein Dartwurf, das war eine öffentliche Hinrichtung deiner eigenen Statistik!'),
  S('{name}, wenn Scheiße werfen olympisch wäre, hätten wir gerade Gold gesehen!'),
  S('Die gute Nachricht: Alle Pfeile sind wieder da. Die schlechte: Talent war nicht dabei!'),
  S('{name}, hast du die Augen zu oder ist das wirklich dein Ernst?'),
  S('Alter Schwede! Der Pfeil hat mehr Orientierung verloren als ein Navi im Kuhstall!'),
  S('{name}, dein Punktestand bewegt sich langsamer als ein Rentner auf Glatteis!'),
].map((e) => ({ ...e, max: 25 }));

// 2. Mittelmäßige Würfe – 26 bis 59 Punkte
const X_MITTEL = [
  S("{name}, das war wie Sex mit Socken: technisch möglich, aber beeindruckt hat's keinen!"),
  S('Na immerhin! Für drei Pfeile und zwei funktionierende Augen war das ganz akzeptabel!', { when: MAX_THREE_DARTS }),
  S('{name}, du bist der lebende Beweis, dass man auch ohne große Leistung beschäftigt aussehen kann!'),
  S('Alter, das war kein Angriff auf die Scheibe. Das war eine höfliche Anfrage!'),
  S("{name}, bei dir weiß man nie: Wird's ein guter Wurf oder wieder ein Arbeitsunfall?"),
  S("Scheiße, Mann! Du spielst wie WLAN mit einem Balken. Irgendwas kommt an, aber Freude macht's nicht!"),
  S('Das war so mittelmäßig, selbst deine Gegner wissen nicht, ob sie lachen oder klatschen sollen!'),
  S('{name}, du machst Fortschritte! Noch ungefähr drei Leben und du bist Profi!'),
  S('Junge, du wirfst so vorsichtig, als müsstest du die Löcher in der Scheibe später selbst zuspachteln!'),
  S("{name}, der Wurf war wie lauwarmes Bier. Geht runter, aber keiner feiert's!"),
].map((e) => ({ ...e, min: 26, max: 59 }));

// 3. Gute Würfe – 60 bis 99 Punkte
const X_GUT = [
  S('Holla, die Waldfee! {name} hat offenbar kurz sein Talent wiedergefunden!'),
  S('Verdammte Axt! Wer hat denn hier plötzlich den Profi-Modus eingeschaltet?'),
  S('{name}, ich wollte dich gerade wieder verarschen, aber jetzt fehlen mir die Argumente!'),
  S('Leck mich am Ärmel! Der Mann kann tatsächlich Dart spielen! Ruft die Zeitung!'),
  S('Junge, Junge! {name} hat gerade bewiesen, dass auch blinde Hühner manchmal mit Maschinengewehren treffen!'),
  S('Na sieh einer an! Eben noch Kreisklasse und jetzt plötzlich Champions League!'),
  S('{name}, wenn du so weitermachst, müssen die anderen beiden ihre Ausreden schon mal aufwärmen!', { players: 3 }),
  S('Alter! Wer hat dir denn heimlich Zielwasser in die Blutbahn geschmuggelt?'),
  S('Das war verdammt ordentlich! Die Scheibe hat gerade zum ersten Mal Respekt vor dir!'),
  S('{name}, pass auf! Wenn du noch besser wirst, verlangen die anderen eine Dopingkontrolle!'),
];

// 4. Überragende Würfe – 100 bis 179 Punkte
const X_UEBERRAGEND = [
  S('WAS ZUR HÖLLE?! {name}, hast du gerade deine Seele an den Dart-Teufel verkauft?'),
  S('Heilige Scheiße! Die anderen suchen gerade den versteckten Profi unter deiner Verkleidung!'),
  S('{name}, du krankes Dart-Monster! Die Scheibe hat gerade innerlich ihre Kündigung geschrieben!'),
  S('Alter, hör auf damit! Die anderen wollten einen gemütlichen Abend und keinen öffentlichen Abriss!'),
  S('Meine Fresse, {name}! Das war so präzise, selbst ein Chirurg würde nervös werden!'),
  S('JUNGE! Was hast du denn gefrühstückt? Dartpfeile mit Schießpulver?'),
  S('{name}, die anderen können schon mal den Notruf für ihr Selbstbewusstsein wählen!'),
  S('Verdammte Hacke! Wenn das so weitergeht, braucht die Scheibe einen Anwalt!'),
];

// 5. Die legendäre 180 – kommt ausschließlich bei einer echten 180
const X_180 = [
  S('HUNDERTACHTZIG! ACH DU HEILIGE SCHEISSE! {NAME}, DU BIST DOCH NICHT MEHR GANZ NORMAL! DIE SCHEIBE BRAUCHT JETZT THERAPIE!', { headline: true }),
  S('ONE HUNDRED AND EIGHTYYYY! LECK MICH FETT! {name}, die anderen beiden können ihre Pfeile einpacken und dich einfach anbeten!', { players: 3 }),
];

// 6. Bust – überworfen oder ungültig ausgecheckt
const X_BUST = [
  S('BUST! {name}, du hast gerade einen perfekten Plan genommen und mit Anlauf in die Scheiße geritten!', { headline: true }),
  S('HAHAHA! {name}, das war wie mit Vollgas gegen eine geschlossene Garagentür!'),
  S('ABGESCHMISSEN! Glückwunsch, {name}! Drei Pfeile geworfen und exakt nichts erreicht. Das muss man auch erst mal schaffen!', { headline: true, when: MAX_THREE_DARTS }),
  S('{name}, du warst so nah am Ziel und hast dich dann selbst aus dem Spiel gekegelt! Ganz großes Kino!'),
  S('BUST! Alter, dein Kopf wollte gewinnen, aber deine Hand hatte offenbar einen anderen Vertrag unterschrieben!', { headline: true }),
];

// 7. Checkout, Sieg und letzte Nerven
const X_FINISH_NERVEN = [
  S('{name}, jetzt zittern die anderen! Du riechst den Sieg schon, und die beiden riechen nur noch ihre Niederlage!', { players: 3 }),
];
const X_SIEG = [
  S('DOPPEL GETROFFEN! DAS DING IST DURCH! {name}, du verdammter Dart-König! Die anderen dürfen jetzt deine Pfeile polieren!', { when: (c) => c.lastDart && c.lastDart.mult === 2 }),
  S("GAME OVER, IHR PFEIFEN! {NAME} HAT GEWONNEN! Für die anderen gibt's heute nur noch Trostbier und dumme Ausreden!"),
  S('{name}, du hast sie gerade komplett zerlegt! Die beiden brauchen jetzt erstmal ein Bier und einen Termin beim Sportpsychologen!', { players: 3 }),
  S("WIR HABEN EINEN SIEGER! {NAME}, WAS FÜR EIN VERDAMMTER ABEND! Und ihr anderen zwei: Vielleicht versucht ihr's nächstes Mal mit ZIELEN!", { players: 3 }),
];

JOKES.zero.x = X_KATASTROPHE;
JOKES.low.x = X_KATASTROPHE;
JOKES.mid.x = [...X_KATASTROPHE, ...X_MITTEL];
JOKES.solid.x = X_MITTEL;
JOKES.good.x = X_GUT;
JOKES.ton.x = X_UEBERRAGEND;
JOKES.big.x = X_UEBERRAGEND;
JOKES.max.x = X_180;
JOKES.bust.x = X_BUST;
JOKES.win.x = X_SIEG;
EXTRAS.finishRange.x = X_FINISH_NERVEN;
EXTRAS.oneDart.x = X_FINISH_NERVEN;

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

/** Anzahl der Sprüche der Sammlungen (für Tests/Übersicht). */
export const COLLECTION_COUNTS = {
  kumpel: K_BAD.length + K_GOOD.length + K_TON.length + 3 /* Warnschuss, Verständigung, Triple-Bust */ + 1 /* Ganove */ + 9 /* Aufrufe */ + 1 /* Bahnhof */,
  fsk16: X_KATASTROPHE.length + X_MITTEL.length + X_GUT.length + X_UEBERRAGEND.length + X_180.length + X_BUST.length + X_FINISH_NERVEN.length + X_SIEG.length,
};
