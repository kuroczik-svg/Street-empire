# DART BUDDY – Kommentarbibliothek v1.0

**Sprache:** Deutsch · **Voreinstellung:** `gnadenlos` (FSK-16-*Stil*, keine amtliche Altersfreigabe)  
**Umfang:** 81 Sprüche = 31 vorherige Dartabend-Sprüche + 50 neue, derbere Sprüche.

## Dateien

- `comments.de.json`: Die **einzige maßgebliche Sprüchesammlung** mit IDs, Texten, Ereignissen, Leistungsstufen und Kontextbedingungen.
- `commentEngine.mjs`: reine JavaScript-Auswahlfunktion; läuft in modernen Browsern/Node ohne zusätzliche Pakete. **Keine Dart-Punktelogik.**
- `tests/commentEngine.test.mjs`: automatisierte Auswahl- und Freigabetests.
- `package.json`: `npm test` für die Tests.

## Datenformat

```json
{
  "id": "fsk16-39",
  "origin": "fsk16",
  "event": "throw",
  "tier": "perfect180",
  "text": "HUNDERTACHTZIG! ... {name} ...",
  "minHumorLevel": "gnadenlos",
  "when": { "maxDartsExact": 3 }
}
```

- `event`: `throw`, `bust`, `win`, `turn_start`, `invalid_input`, `correction`.
- `tier`: `poor` (0–25), `mid` (26–59), `good` (60–99), `excellent` (100–179), `perfect180` (exakt 180 **bei 3 Pfeilen**); außerdem `any`, `bust`, `win`.
- Bei sechs Pfeilen werden die normalen Leistungsgrenzen auf drei Pfeile normiert; **180 bei sechs Pfeilen löst keinen perfekten-180er-Spruch aus**.
- `when`: zusätzliche Bedingungen, die **alle** zutreffen müssen. Fehlen erforderliche Kontextdaten, ist der Spruch nicht zulässig.
- `{name}`, `{leaderName}`, `{previousPlayerName}` und `{opponentName}` werden zur Laufzeit durch reale Namen ersetzt.
- Die Formulierungen der 31 Originalsprüche sind größtenteils unverändert. Eine feste Namensnennung wurde für flexible Spielernamen parametrisiert.

## Auswahlregeln

1. **Ereignis vor Punktzahl:** Bei `bust` und `win` kommen ausschließlich passende Sprüche infrage.
2. **Leistungsklasse:** 180er-Kommentare ausschließlich bei echten 180 Punkten mit drei Pfeilen. Für unbestätigte/unklare Zahlen **kein** normales `throw`-Ereignis auslösen.
3. **Kontexttreue:** Hinweise auf `34 Rest`, einen früheren `120er`, einen schlechten vorherigen Wurf, Triple, einen Führenden usw. nur, wenn sich der Umstand aus dem gespeicherten Spielverlauf ergibt.
4. **Humor:** `gnadenlos` erlaubt alle verfügbaren Texte, `frech` nur ältere Texte; `freundlich` ist derzeit ohne eigene Textbibliothek und verwendet gegebenenfalls neutrale Fallbacks.
5. **Keine unmittelbaren Wiederholungen:** Die letzten acht Spruch-IDs sind gesperrt, solange andere gültige Kandidaten verfügbar sind. Wenn alle gesperrt sind, wird die Sperre auf die letzte ID reduziert. Wenn nur ein unmittelbar wiederholbarer Kandidat existiert, folgt ein generischer Fallback statt einer Wiederholung.
6. **Abwechslung:** Kontextbezogene Sprüche erhalten bei der Auswahl das dreifache Gewicht gegenüber allgemeinen Sprüchen. Ein optionaler `rng`-Parameter erlaubt reproduzierbare Tests.
7. **Punkte sind Wahrheit:** Die separaten Dart-Regeln bestimmen den aktuellen Stand und Bust/Checkout. Das Kommentarmodul berechnet **keine** Punkte und verändert **keinen** Spielzustand.
8. **Klare Wurffreigabe:** `buildSpokenTurn` gibt die nächste Runde nur frei, wenn eine korrekte, persistierte Aufnahme (`turnCommitted: true`) und der nächste Spieler feststehen. Nach Sieg gibt es keine weitere Freigabe.

## Einbau in eine Web-App

Die JSON-Datei muss lokal im App-Bundle oder im PWA-Cache verfügbar sein. `fetch` unten funktioniert bei Offline-Betrieb nur, wenn die Datei zuvor von einem Service Worker zwischengespeichert wurde.

```js
import {selectComment, buildSpokenTurn} from './commentEngine.mjs';

const library = await fetch('./comments.de.json').then(r => {
  if (!r.ok) throw new Error('Kommentarbibliothek nicht geladen');
  return r.json();
});
let commentHistory = []; // In localStorage/IndexedDB zusammen mit dem Spiel speichern!

// NUR nachdem die Dart-Engine die Aufnahme bestätigt und gespeichert hat:
const ctx = {
  event: 'throw',
  playerName: 'Lukas', points: 69, remaining: 232,
  maxDarts: 3, playerCount: 3, outRule: 'double',
  otherPlayerNames: ['Markus', 'Wowa'],
  priorLowTurn: false, opponentNearWin: false
};
const result = selectComment({
  library, context: ctx, history: commentHistory,
  humorLevel: 'gnadenlos'
});
commentHistory = result.history;

const textToSpeak = buildSpokenTurn({
  comment: result, context: ctx,
  nextPlayerName: 'Wowa', turnCommitted: true
});
// Die browserseitige Sprachausgabe übernimmt eine separate TTS-Schicht.
console.log(textToSpeak);
```

**Wichtige Integration:** Die Spruchhistorie (`history`) muss beim Speichern/Laden des Spiels mitpersistiert werden. Ein `invalid_input`-Ereignis darf *niemals* die Punkte ändern oder den nächsten Spieler freigeben. `correction` darf erst nach deterministischem Neuberechnen der Dart-Engine kommen. Die Anwendung sollte vor dem Sprechen zuerst den bestätigten Spielzustand speichern.

## Testen

```bash
npm test
```

Die Tests prüfen die Kommentarauswahl. Eine vollständige Dartspiel-App einschließlich Mikrofoneingabe, TTS, Regel-Engine und Benutzeroberfläche ist **nicht** Teil dieses Modulpakets.
