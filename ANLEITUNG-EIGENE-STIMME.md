# DART BUDDY mit eigener Stimme – der Piper-Weg

Ziel: Eine eigene Stimme (deine oder die eines Kumpels) trainieren, kostenlos und offline,
und DART BUDDY damit sprechen lassen.

**Grundregel:** Nur Stimmen von Menschen verwenden, die ausdrücklich zugestimmt haben.
Keine Promi-/Kommentatoren-Stimmen nachbauen.

## Überblick

| Schritt | Was | Wo | Zeit |
|---|---|---|---|
| 1 | Sätze einsprechen | PC mit Mikrofon (Piper Recording Studio) | 2–4 Stunden (auf mehrere Abende verteilbar) |
| 2 | Aufnahmen als Datensatz exportieren | PC | 10 Minuten |
| 3 | Stimme trainieren | Google Colab (kostenlose Grafikkarte im Browser) | einige Stunden, ggf. über mehrere Sitzungen |
| 4 | Stimme fürs Handy umwandeln | Google Colab | 5 Minuten |
| 5 | Stimme auf dem Handy installieren | App „SherpaTTS“ (F-Droid) | 10 Minuten |
| 6 | In DART BUDDY auswählen | Handy | 1 Minute |

**Was du brauchst:** PC (Windows mit WSL, Linux oder Mac) mit Python 3, ein ordentliches Mikrofon
(USB-Mikro oder gutes Headset – nicht das eingebaute Laptop-Mikro), einen Google-Account, ein Android-Handy.

---

## Schritt 1 – Sätze einsprechen (Piper Recording Studio)

```bash
git clone https://github.com/rhasspy/piper-recording-studio.git
cd piper-recording-studio
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
python3 -m piper_recording_studio
```

Dann im Browser **http://localhost:8000** öffnen, **Deutsch (de-DE)** wählen und loslegen.
Das Programm zeigt Satz für Satz an; es gibt rund 1.150 deutsche Sätze.

**Wie viel?** Mindestens **300–500 Sätze (ca. 30–60 Minuten Audio)**. Mehr = besser.

### Dart-Sätze dazunehmen (sehr empfehlenswert)
Damit die Stimme Wörter wie „Hundertachtzig“, „Triple“, „Bullseye“ und eure Namen sauber spricht,
lege im Ordner `prompts/` beim deutschen Sprachordner eine zusätzliche Datei an, z. B. `dart.txt`,
**ein Satz pro Zeile** (ohne Anführungszeichen):

```
Hundertachtzig! Das gibt es doch nicht!
Triple zwanzig, Triple neunzehn, Doppel zwölf.
Bullseye! Was für ein Finish!
Abgeschmissen, Markus! Dein alter Stand bleibt.
Lukas, du bist dran!
Wowa hat gewonnen!
Noch einhundertsiebzig. Checkout möglich.
Doppel sechzehn, und das Ding ist durch!
```

Tipp: Gern 50–100 solcher Sätze, auch Zahlen von 1 bis 180 und die Sprüche aus der Kommentarbibliothek.
Danach Recording Studio neu starten.

### Damit es gut klingt
- **Ruhiger Raum**, Fenster zu, kein Fernseher, keine Lüftung.
- **Immer gleicher Abstand** zum Mikrofon (ca. eine Handbreit).
- **Immer gleiche Stimmung.** Die Stimme lernt genau so zu klingen, wie du sprichst.
  Willst du einen aufgedrehten Kommentator, sprich **alle** Sätze mit Energie und Betonung.
- Versprecher? Satz einfach neu aufnehmen.
- Lieber mehrere kurze Sitzungen als eine lange (Stimme wird müde).

---

## Schritt 2 – Datensatz exportieren

```bash
sudo apt-get install ffmpeg
python3 -m pip install -r requirements_export.txt
python3 -m export_dataset output/<sprachordner>/ ~/dartbuddy-stimme
```

`<sprachordner>` ist der deutsche Ordner unter `output/` (z. B. `output/de-DE/`).
Ergebnis: ein Ordner mit `metadata.csv` und den WAV-Dateien (LJSpeech-Format, so wie Piper es braucht).
Diesen Ordner als **ZIP** packen, z. B. `dartbuddy-stimme.zip`, und in dein **Google Drive** hochladen.

---

## Schritt 3 – Trainieren auf Google Colab (kostenlos)

1. https://colab.research.google.com → **Neues Notebook**.
2. Menü **Laufzeit → Laufzeittyp ändern → T4-GPU** wählen.
3. Die folgenden Blöcke nacheinander als Zellen einfügen und ausführen.

**Zelle 1 – Google Drive verbinden (damit nichts verloren geht)**
```python
from google.colab import drive
drive.mount('/content/drive')
```

**Zelle 2 – Piper installieren**
```bash
!apt-get -qq install -y espeak-ng build-essential cmake ninja-build
!git clone https://github.com/OHF-voice/piper1-gpl.git
%cd piper1-gpl
!python3 -m pip install -e '.[train]'
!./build_monotonic_align.sh
!python3 setup.py build_ext --inplace
```

**Zelle 3 – Datensatz entpacken**
```bash
!mkdir -p /content/daten && unzip -q /content/drive/MyDrive/dartbuddy-stimme.zip -d /content/daten
!ls /content/daten
```
Prüfen, wo `metadata.csv` und die WAV-Dateien liegen, und die Pfade unten ggf. anpassen.

**Zelle 4 – deutsche Startstimme herunterladen**
Man trainiert nicht bei null, sondern **verfeinert eine fertige deutsche Stimme** (schneller, braucht weniger
Aufnahmen). Die Trainingsanleitung von Piper unterstützt dafür **Medium-Checkpoints**.
Wir nehmen die bekannte deutsche Stimme „Thorsten“ (Medium, 22.050 Hz) aus **rhasspy/piper-checkpoints**:
```bash
!wget -O /content/start.ckpt "https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/main/de/de_DE/thorsten/medium/epoch%3D3135-step%3D2702056.ckpt"
!ls -lh /content/start.ckpt
```
Die Datei sollte mehrere hundert MB groß sein. Klappt der Download nicht (Datei umbenannt), den Ordner
https://huggingface.co/datasets/rhasspy/piper-checkpoints/tree/main/de/de_DE/thorsten/medium öffnen,
die `.ckpt`-Datei anklicken, ihren Download-Link kopieren und oben einsetzen.

**Zelle 5 – Training starten**
```bash
!python3 -m piper.train fit \
  --data.voice_name "dartbuddy" \
  --data.csv_path /content/daten/metadata.csv \
  --data.audio_dir /content/daten/wav/ \
  --model.sample_rate 22050 \
  --data.espeak_voice "de" \
  --data.cache_dir /content/cache/ \
  --data.config_path /content/drive/MyDrive/piper/de_DE-dartbuddy-medium.onnx.json \
  --data.batch_size 16 \
  --trainer.max_epochs 2000 \
  --trainer.default_root_dir /content/drive/MyDrive/piper/training \
  --ckpt_path /content/start.ckpt
```
- `--data.audio_dir` muss auf den Ordner mit den WAV-Dateien zeigen (siehe Zelle 3).
- Kommt „out of memory“, `--data.batch_size` auf `8` senken.
- `2000` Epochen sind laut Piper-Anleitung ein bewährter Startwert für kleine Datensätze (unter 5 Stunden Audio).
- Die Checkpoints landen über `--trainer.default_root_dir` in deinem Google Drive. **Bricht Colab ab**
  (das passiert in der kostenlosen Version nach einigen Stunden), einfach Zellen 1–3 erneut ausführen und
  Zelle 5 mit dem **neuesten eigenen Checkpoint** statt `start.ckpt` starten
  (zu finden unter `MyDrive/piper/training/lightning_logs/version_*/checkpoints/`).
- Wird `--trainer.default_root_dir` nicht akzeptiert, die Option weglassen und den Ordner
  `lightning_logs` regelmäßig nach Google Drive kopieren.

**Wann ist es gut genug?** Zwischendurch exportieren (Schritt 4) und anhören. Oft klingt es nach einigen
hundert Epochen schon ordentlich – dann kann man abbrechen.

---

## Schritt 4 – Stimme exportieren und fürs Handy umwandeln

**Zelle 6 – nach ONNX exportieren** (Pfad zum neuesten Checkpoint einsetzen)
```bash
!mkdir -p /content/stimme
!python3 -m piper.train.export_onnx \
  --checkpoint "/content/drive/MyDrive/piper/training/lightning_logs/version_0/checkpoints/HIER.ckpt" \
  --output-file /content/stimme/de_DE-dartbuddy-medium.onnx
!cp /content/drive/MyDrive/piper/de_DE-dartbuddy-medium.onnx.json /content/stimme/
```

**Zelle 7 – Probe hören**
```python
!cd /content/stimme && echo "Hundertachtzig! Markus, du bist dran!" | python3 -m piper -m de_DE-dartbuddy-medium.onnx -f probe.wav
from IPython.display import Audio
Audio('/content/stimme/probe.wav')
```
(Funktioniert der Befehl nicht, `python3 -m piper --help` ansehen – die Kommandozeile kann sich zwischen
Versionen ändern.)

**Zelle 8 – für sherpa-onnx/SherpaTTS umwandeln**
Die Handy-App braucht das Modell mit zusätzlichen Infos und eine `tokens.txt`. Dafür gibt es ein Skript von sherpa-onnx:
```bash
%cd /content/stimme
!wget -q https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/scripts/piper/add_meta_data.py
!python3 -m pip install -q onnx iso639-lang
!python3 add_meta_data.py --name dartbuddy --kind medium --lang de_DE
!ls -l
```
Danach liegen im Ordner `de_DE-dartbuddy-medium.onnx` (jetzt mit Metadaten) und `tokens.txt`.
Meldet das Skript ein fehlendes Python-Paket, dieses mit `pip install` nachinstallieren und erneut ausführen.

**Zelle 9 – in Google Drive sichern**
```bash
!cp /content/stimme/de_DE-dartbuddy-medium.onnx /content/stimme/tokens.txt /content/drive/MyDrive/piper/
```
Beide Dateien aus Google Drive aufs Handy herunterladen.

---

## Schritt 5 – Stimme aufs Handy (App „SherpaTTS“)

1. **SherpaTTS** über **F-Droid** installieren: https://f-droid.org/de/packages/org.woheller69.ttsengine/
2. SherpaTTS öffnen → **Manage Languages** → **Install from SD Card**.
3. Sprachcode **`deu`** eingeben, als Namen z. B. **„DART BUDDY“**.
4. Die Datei **`de_DE-dartbuddy-medium.onnx`** auswählen, dann **`tokens.txt`** → **OK**.
5. Android-Einstellungen → (je nach Handy) *System / Bedienungshilfen* → **Text-in-Sprache-Ausgabe**
   → **Bevorzugte Engine: SherpaTTS**, Sprache Deutsch. Mit „Beispiel anhören“ testen.

---

## Schritt 6 – In DART BUDDY verwenden

DART BUDDY spricht über die Android-Sprachausgabe – mit SherpaTTS als bevorzugter Engine spricht die App
**automatisch mit deiner Stimme**. Unter **Einstellungen → Stimme** kannst du zusätzlich eine bestimmte Stimme wählen
und beim **Kommentator-Stil** Tempo/Tonhöhe anpassen („Aufgedreht“ macht sie schneller und höher).

Falls die Stimme in DART BUDDY nicht zu hören ist: in Einstellungen → Stimme „Automatisch (Deutsch)“ wählen und die App neu starten.

---

## Ehrliche Erwartungen

- Die Stimme klingt **erkennbar nach dir**, aber etwas gleichmäßiger als echt. Die Energie, mit der du aufnimmst,
  bestimmt, wie lebendig sie wird.
- Eine Stimme pro Modell. Für Markus, Lukas und Wowa je ein eigenes Training.
- Die kostenlose Colab-Grafikkarte ist begrenzt; Abbrüche sind normal – deshalb alles in Google Drive speichern.
- Hinweis der SherpaTTS-Entwickler: Wegen geplanter Google-Vorgaben für App-Entwickler könnte die App auf
  zertifizierten Android-Geräten ab 2026/2027 eingeschränkt sein. Die Stimmdateien (`.onnx` + `tokens.txt`) bleiben
  trotzdem nutzbar – zur Not kann DART BUDDY sie später auch direkt einbinden.

## Quellen

- Piper-Training: https://github.com/OHF-Voice/piper1-gpl (docs/TRAINING.md)
- Piper Recording Studio: https://github.com/rhasspy/piper-recording-studio
- Deutsche Start-Checkpoints: https://huggingface.co/datasets/rhasspy/piper-checkpoints
- Umwandlung für sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx (scripts/piper/add_meta_data.py)
- SherpaTTS: https://github.com/woheller69/ttsEngine · F-Droid: https://f-droid.org/de/packages/org.woheller69.ttsengine/
