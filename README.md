# 🎯 DART BUDDY – Der freche KI-Dart-Moderator

Eine deutschsprachige, mobiloptimierte Dart-App (PWA), die als humorvoller Spielleiter funktioniert:
**rechnet wie ein Profi, hört zu wie ein Schiedsrichter und klopft Sprüche wie der frechste Kumpel am Dartabend.**

## Starten

```bash
npm start          # http://localhost:8080  (keine Abhängigkeiten nötig, Node ≥ 18)
npm test           # 86 automatisierte Tests (Engine, Parser, Kommentator, Speicher, Abnahmetest)
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

## Fehlervermeidung (Auswahl)

- **Aktiver Spieler** ist immer eindeutig: wer die wenigsten Aufnahmen hat, ist dran (bei Gleichstand feste Reihenfolge). Nach einer Umbuchung (vertauschte Spieler) stimmt die Reihenfolge automatisch wieder; zusätzlich gibt es „Wer ist dran?“.
- **Gespräche** („Ich hol mir noch zwei Bier“) werden ignoriert; ein einzelnes unbekanntes Wort führt zu „Habe ich richtig verstanden …?“.
- **Unklares** („Bull“, „Triple 25“, „60“, „Triple“ ohne Zahl) wird nachgefragt, nie geraten.
- **Unvollständige Ansagen** → „Was war der dritte Pfeil?“ bzw. Knopf „Rest daneben“.
- **Zu viele Pfeile** werden abgelehnt; Pfeile nach Bust/Checkout werden markiert und nicht gewertet.
- **Korrekturen** (Werte, Spieler, Tausch, Löschen) berechnen alles neu; würde ein Spiel dadurch früher enden, wird nachgefragt.
- **Zurücksetzen/Beenden/Löschen** nur nach Bestätigung.
- Die Statistik wird aus den gespeicherten Spielen berechnet → ein rückgängig gemachter Sieg verschwindet auch aus der Statistik.

## Später als Android-/iPhone-App

Die App ist eine reine statische Web-App ohne Build-Schritt. Mit [Capacitor](https://capacitorjs.com/)
lässt sie sich direkt verpacken (`npx cap init`, `webDir` = Projektordner bzw. Kopie der Dateien,
`npx cap add android` / `ios`). Für native Spracherkennung kann `speech.js` gegen ein Capacitor-Plugin
ausgetauscht werden – die Schnittstelle (`onResult(alternativen[])`) bleibt gleich.

## Erweiterung: Online-KI für Sprüche

Der Kommentator arbeitet bewusst lokal (schnell, offline, keine erfundenen Zahlen). Er erhält einen
fertigen Kontext (`buildContext`) mit allen deterministischen Werten. Ein LLM-basierter Kommentator
könnte denselben Kontext bekommen und nur den Spruch-Teil liefern; Schlagzeile, Rest und nächster
Spieler bleiben regelbasiert. Ein API-Schlüssel gehört dabei auf einen eigenen Server, nicht in die App.
