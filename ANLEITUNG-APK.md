# DART BUDDY – APK selbst bauen

Dieses Paket enthält **alles**, was für die Android-App nötig ist. Es gibt zwei Wege:

- **Weg A – automatisch über GitHub** (nichts installieren, empfohlen)
- **Weg B – selbst am Computer** (Windows, Mac oder Linux)

---

## Weg A: GitHub baut die APK

1. Projektordner in ein GitHub-Repository hochladen (oder das bestehende Repo
   `kuroczik-svg/Street-empire` verwenden).
2. Jeder Push startet automatisch den Workflow **„Android APK“**
   (`.github/workflows/android-apk.yml`). Er führt alle Tests aus, baut die APK und prüft die Signatur.
3. Nach ca. 3 Minuten liegt die APK unter **Releases → „DART BUDDY – neueste APK“** →
   `DartBuddy.apk`. Direkt am Handy herunterladen.

Manuell starten: Repo → **Actions** → „Android APK“ → **Run workflow**.

---

## Weg B: Selbst bauen

### 1. Einmalig installieren

| Programm | Version | Download |
|---|---|---|
| **Node.js** | 22 oder neuer | https://nodejs.org |
| **Android Studio** (bringt Android-SDK und Java 21 mit) | aktuell | https://developer.android.com/studio |

Nach der Installation von Android Studio einmal öffnen und den Einrichtungsassistenten
durchlaufen lassen (lädt das Android-SDK).

### 2a. Bauen mit Android Studio (am einfachsten)

1. ZIP entpacken, im entpackten Ordner eine Kommandozeile öffnen
   (Windows: im Ordner in die Adresszeile `cmd` tippen, Enter).
2. Einmal ausführen:
   ```
   npm ci
   npm run android:sync
   ```
3. Android Studio → **Open** → den Unterordner **`android`** auswählen.
4. Warten, bis „Gradle sync“ fertig ist (beim ersten Mal einige Minuten).
5. Menü **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
6. Fertig: `android/app/build/outputs/apk/debug/app-debug.apk`
   (Android Studio zeigt unten rechts „locate“).

Mit Handy per USB verbunden (Entwickleroptionen + USB-Debugging an) geht auch einfach ▶ **Run**.

### 2b. Bauen nur mit der Kommandozeile

Voraussetzung: Umgebungsvariable `ANDROID_HOME` zeigt auf das Android-SDK
(Android Studio: *Settings → Languages & Frameworks → Android SDK* zeigt den Pfad)
und Java 21 ist installiert (`JAVA_HOME`).

```
npm ci
npm test                 # optional: 145 Tests
npm run android:apk      # baut die APK
```

Ergebnis: `android/app/build/outputs/apk/debug/app-debug.apk`

Unter Mac/Linux ggf. vorher: `chmod +x android/gradlew`
Unter Windows statt `npm run android:apk`:
```
npm run android:sync
cd android
gradlew.bat assembleDebug
```

### 3. Signatur prüfen (optional)

```
node scripts/check-apk-signature.mjs android/app/build/outputs/apk/debug/app-debug.apk
```
Meldet „OK“, wenn die APK mit dem festen DART-BUDDY-Schlüssel signiert ist – nur dann lässt
sie sich über eine bereits installierte Version drüberinstallieren.

---

## Wichtige Dateien

| Datei/Ordner | Zweck |
|---|---|
| `index.html`, `styles.css`, `src/` | die App selbst |
| `data/comments.de.json` | Kommentarbibliothek (81 Sprüche) |
| `vendor/capacitor.js` | Capacitor-Laufzeit – **nötig für Mikrofon/Sprachausgabe in der App** |
| `capacitor.config.json` | App-Name und Kennung (`de.dartbuddy.moderator`) |
| `android/` | Android-Projekt (Gradle) |
| `android/app/dartbuddy-debug.keystore` | fester Signaturschlüssel (Passwort `android`) – **nicht verlieren/ändern**, sonst lassen sich Updates nicht mehr installieren |
| `package.json`, `package-lock.json` | Abhängigkeiten (Capacitor + Sprach-Plugins), Befehle |
| `scripts/` | Web-App kopieren, Icons erzeugen, Signatur prüfen |
| `.github/workflows/android-apk.yml` | automatischer Build auf GitHub |
| `tests/` | automatische Tests |

Nicht enthalten (wird automatisch erzeugt): `node_modules/` (durch `npm ci`),
`www/` und `android/app/src/main/assets/public` (durch `npm run android:sync`).

**Nach jeder Änderung an der App** (z. B. Sprüche in `src/jokes.js` oder `data/comments.de.json`)
immer erst `npm run android:sync` ausführen, dann neu bauen.

---

## Hinweise

- Das ist eine **Test-Version (Debug-Build)**. Für den Google Play Store braucht es einen
  Release-Build mit eigenem, geheimem Schlüssel.
- Der Test-Schlüssel liegt bewusst im Projekt, damit jeder Build gleich signiert ist.
  Für eine öffentliche Veröffentlichung einen neuen, privaten Schlüssel anlegen.
- Die Spracherkennung nutzt den Google-Sprachdienst des Handys (bei fast allen
  Android-Geräten vorhanden).
