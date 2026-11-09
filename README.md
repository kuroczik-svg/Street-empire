# 🎯 DART BUDDY – Der freche KI-Dart-Moderator

Eine deutschsprachige, mobiloptimierte Dart-App (PWA), die als humorvoller Spielleiter funktioniert:
**rechnet wie ein Profi, hört zu wie ein Schiedsrichter und klopft Sprüche wie der frechste Kumpel am Dartabend.**

## Starten

```bash
npm start          # http://localhost:8080  (keine Abhängigkeiten nötig, Node ≥ 18)
npm test           # 145 automatisierte Tests (Engine, Parser, Kommentator, Speicher, Abnahmetest)
```

Optionaler Browser-Abnahmetest (Playwright + Chromium, simulierte Spracherkennung):

```bash
NODE_PATH=$(npm root -g) node tests/e2e/browser-acceptance.cjs [screenshot-ordner]
```

Für die Spracherkennung braucht es einen sicheren Kontext (`localhost` oder HTTPS) und einen Browser mit
Web Speech API (Chrome auf Android/Desktop, Safari auf iOS). **Manuelle Eingabe und Punkteberechnung
funktionieren immer – auch offline** (Service Worker).

## Ablauf

1. **Spielvorbereitung:** Anzahl Spieler → Namen (+ Spitznamen) → Startwert (301/501/701/eigener) →
   3 oder 6 Pfeile → Reihenfolge → wer beginnt → Single-/Double-/Master-Out.
   Der Start-Knopf ist gesperrt, bis Reihenfolge und erster Spieler **ausdrücklich bestätigt** sind.
2. **Würfe ansagen:** großen Mikrofonknopf tippen und „17, 2, Triple 13“ sagen – oder im
   Aktivierungswort-Modus „Buddy, Doppel 20, 5, 12“. Alternativ jederzeit per Tastenfeld.
3. Die App rechnet, sagt sofort einen frechen Spruch, den Rest und ruft den nächsten Spieler auf.

## Architektur

| Modul | Aufgabe |
|---|---|
| `src/engine.js` | **Regelbasierte Dart-Engine**: Werte, Bust, Double/Master-Out, Checkout, Spielerwechsel, Statistik, Checkout-Wege. Event-Sourcing: der Stand wird immer komplett aus den gespeicherten Eingaben neu berechnet → Korrekturen ziehen nie doppelt ab. |
| `src/parser.js` | **Deutsche Wurfansagen** → Darts. Erkennt Zahlwörter, Triple/Doppel-Varianten, Bull/Bullseye, „daneben“, „dreimal T20“, „Hundertachtzig“. Unterscheidet Wurfansagen von Gesprächen. |
| `src/turnInput.js` | Entscheidet: buchen, gezielt nachfragen, bestätigen lassen oder ignorieren. |
| `src/commentator.js` | **Kommentator**: Sprüche nach Leistung (0 / schwach / mittel / solide / gut / Ton / 140+ / 180 / Bust / Sieg), drei Humor-Stufen, keine Wiederholungen, Führungswechsel, Aufholjagd, knapper Spielstand, Finish-Bereich. Zahlen kommen **ausschließlich** aus der Engine. |
| `src/session.js` | Ablauf einer Partie (wird von UI *und* Abnahmetest genutzt). |
| `src/speech.js` | Sprachausgabe (Betonung je nach Energie, Stimmenwahl, Stile) und Spracherkennung (Knopf / Aktivierungswort; hört beim eigenen Sprechen nicht zu). |
| `src/storage.js` | Persistenz (localStorage), Historie, Profile, Siegerstatistik. |
| `src/app.js` | Oberfläche. |

## Sprüche & Humor-Stufen

**Die Bibliothek ist offen erweiterbar – direkt in der App:** 💬 *Sprüche-Bibliothek* (Kopfzeile,
Startseite oder Einstellungen):

- eigene Sprüche anlegen, bearbeiten, pausieren, löschen – mit Platzhaltern
  `[Name] [NAME] [Punkte] [Rest] [Nächster] [Führender] [Entthront]`, Live-Vorschau und „Probe hören“
- Situation wählen (Katastrophe 0–25, Mittel 26–59, Gut 60–99, Überragend 100–179, 180, Bust, Sieg,
  Finish-Bereich, Führungswechsel, Aufruf des Nächsten, Korrektur), Humor-Stufe und Spielerzahl
- **mehrere auf einmal einfügen** – auch direkt als Tabelle aus dem Chat; Nummern, Anführungszeichen
  und fehlende Namen („Meine Fresse, !“) werden automatisch bereinigt
- eingebaute Sprüche ausblenden
- **sichern & teilen** als JSON-Datei (Import überspringt Duplikate)

Eigene Sprüche werden getrennt gespeichert (bleiben bei App-Updates erhalten) und kommen etwas häufiger dran.
Regeln werden geprüft: 180er-Sprüche nur unter „Die 180“, „die beiden“ → nur bei 3 Spielern, Aufrufe
nennen immer den nächsten Spieler, Zahlen setzt die App ein. Logik: `src/library.js`, Oberfläche:
`src/jokesScreen.js`. Die eingebauten Sprüche stehen in `src/jokes.js`.

**Maßgebliche Kommentarbibliothek v1.0: `data/comments.de.json`** – 81 Sprüche (31 vom Dartabend +
50 FSK-16) mit IDs, Ereignissen (`throw`, `bust`, `win`, `turn_start`, `invalid_input`, `correction`),
Leistungsstufen und Kontextbedingungen. Regeln: `data/README-kommentarbibliothek.md`.
`src/commentData.js` setzt diese Regeln im Kommentator um:

- Stufen poor 0–25 / mid 26–59 / good 60–99 / excellent 100–179 / perfect180 (genau 180 **mit 3 Pfeilen**);
  bei 6 Pfeilen auf 3 Pfeile normiert, eine 180 mit 6 Pfeilen ist keine perfekte 180
- alle `when`-Bedingungen müssen zutreffen; fehlen Daten oder ist eine Bedingung unbekannt, kommt der Spruch nicht
  (z. B. `claimMagic` – die App weiß nicht, ob jemand „zaubern“ angekündigt hat)
- `turn_start` = Aufruf des nächsten Spielers (nennt ihn immer beim Namen), `invalid_input` = Spruch bei
  zu vielen Pfeilen/unklarer Ansage (ändert nie Punkte oder Spieler), `correction` = nach einer Korrektur
  (erst nach der Neuberechnung)
- `maleWordingOk` → Einstellung „Männerrunde“ (standardmäßig an; aus = solche Sprüche kommen nicht)
- Zusatzregel der App: „die anderen beiden“ nur bei genau 3 Spielern
- Spruch-Historie wird mit dem Spiel gespeichert (keine Wiederholung nach dem Neuladen)
- fehlt die Datei, läuft das Spiel mit den Grund-Sprüchen aus `src/jokes.js` weiter

| Humor-Stufe | Inhalt |
|---|---|
| 😊 Freundlich – lockere Witze | Grund-Sprüche „f“ |
| 😏 Frech – ordentliche Sticheleien | + Bibliothekssprüche mit `minHumorLevel: frech` |
| 😈 Gnadenlos – FSK-16-Dartabend | + alle Bibliothekssprüche (FSK-16-Stil) |

Der Kommentator wählt nach Punktzahl, Spielstand, Vorgeschichte und den zuletzt gesagten Sprüchen:
z. B. „Vorhin 170 Punkte rausgehauen …“, „Der dritte Pfeil war wohl ein Warnschuss …“ (nur wenn genau der
dritte Pfeil daneben ging), Reaktionen auf Gegner („… während Lukas nur noch 32 braucht“), Sprüche mit
„die anderen beiden“ nur bei genau drei Spielern, 180er-Sprüche ausschließlich bei einer echten 180.

## Fehlervermeidung (Auswahl)

- **Aktiver Spieler** ist immer eindeutig: wer die wenigsten Aufnahmen hat, ist dran (bei Gleichstand feste Reihenfolge). Nach einer Umbuchung (vertauschte Spieler) stimmt die Reihenfolge automatisch wieder; zusätzlich gibt es „Wer ist dran?“.
- **Gespräche** („Ich hol mir noch zwei Bier“) werden ignoriert; ein einzelnes unbekanntes Wort führt zu „Habe ich richtig verstanden …?“.
- **Unklares** („Bull“, „Triple 25“, „60“, „Triple“ ohne Zahl) wird nachgefragt, nie geraten.
- **Unvollständige Ansagen** → „Was war der dritte Pfeil?“ bzw. Knopf „Rest daneben“.
- **Zu viele Pfeile** werden abgelehnt; Pfeile nach Bust/Checkout werden markiert und nicht gewertet.
- **Korrekturen** (Werte, Spieler, Tausch, Löschen) berechnen alles neu; würde ein Spiel dadurch früher enden, wird nachgefragt.
- **Zurücksetzen/Beenden/Löschen** nur nach Bestätigung.
- Die Statistik wird aus den gespeicherten Spielen berechnet → ein rückgängig gemachter Sieg verschwindet auch aus der Statistik.

## Android-App (APK)

Das Android-Projekt liegt in `android/` (Capacitor 8). Die Android-WebView kann keine
Web-Spracherkennung – in der App laufen Mikrofon und Sprachausgabe deshalb über native Plugins
(`@capacitor-community/speech-recognition`, `@capacitor-community/text-to-speech`). `speech.js`
wählt automatisch: nativ in der App, Web Speech API im Browser.

**Automatisch über GitHub Actions** (`.github/workflows/android-apk.yml`): Jeder Push baut die APK.
Download danach unter *Releases → „DART BUDDY – neueste APK“* (direkt am Handy) oder als Artefakt am
Workflow-Lauf. Installation: APK öffnen, „Installation aus unbekannten Quellen“ erlauben.

**Lokal** (Android Studio bzw. Android-SDK + JDK 21 nötig):

```bash
npm ci
npm run android:apk      # → android/app/build/outputs/apk/debug/app-debug.apk
# oder: npm run android:sync && npx cap open android
```

Die App lädt `vendor/capacitor.js` (= `@capacitor/core/dist/capacitor.js`): Ohne diese Laufzeit
gibt es in der App kein `Capacitor.registerPlugin`, und Mikrofon/Sprachausgabe würden nicht nativ laufen.
`tests/e2e/android-bridge-e2e.cjs` prüft genau das mit der echten Android-Brücke und läuft bei jedem APK-Build.

Nach Änderungen an der Web-App immer `npm run android:sync` ausführen. Icons/Splash neu erzeugen:
`NODE_PATH=$(npm root -g) node scripts/android-icons.cjs .`

Die APK ist ein Debug-Build (zum Installieren und Testen). Für den Play Store braucht es einen
Release-Build mit eigenem Signaturschlüssel. iPhone: `npx cap add ios` auf einem Mac mit Xcode.

## Erweiterung: Online-KI für Sprüche

Der Kommentator arbeitet bewusst lokal (schnell, offline, keine erfundenen Zahlen). Er erhält einen
fertigen Kontext (`buildContext`) mit allen deterministischen Werten. Ein LLM-basierter Kommentator
könnte denselben Kontext bekommen und nur den Spruch-Teil liefern; Schlagzeile, Rest und nächster
Spieler bleiben regelbasiert. Ein API-Schlüssel gehört dabei auf einen eigenen Server, nicht in die App.
