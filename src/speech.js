// DART BUDDY – Sprachein- und -ausgabe (Web Speech API)
// ------------------------------------------------------------
// Ausgabe: SpeechSynthesis mit deutschen Stimmen, Energie-Stufen für Betonung.
// Eingabe: SpeechRecognition (de-DE) im Knopf- oder Aktivierungswort-Modus.
// Die App hört sich beim Sprechen NICHT selbst zu – die Erkennung pausiert.

export const VOICE_STYLES = {
  stadion: { label: 'Stadionsprecher', rate: 1.0, pitch: 0.9 },
  kumpel: { label: 'Kumpel', rate: 1.08, pitch: 1.05 },
  aufgedreht: { label: 'Aufgedreht', rate: 1.2, pitch: 1.3 },
};

export class SpeechOut {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.enabled = true;
    this.volume = 1;
    this.voiceURI = '';
    this.style = 'kumpel';
    this.listeners = { start: [], end: [] };
    this.speaking = false;
    this.queueId = 0;
  }

  get supported() {
    return !!this.synth && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  on(evt, fn) {
    this.listeners[evt].push(fn);
  }

  emit(evt) {
    this.listeners[evt].forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  germanVoices() {
    if (!this.supported) return [];
    return this.synth.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
  }

  pickVoice() {
    const voices = this.germanVoices();
    if (!voices.length) return null;
    return voices.find((v) => v.voiceURI === this.voiceURI) || voices.find((v) => /de-DE/i.test(v.lang)) || voices[0];
  }

  stop() {
    if (!this.supported) return;
    this.queueId++;
    this.synth.cancel();
    if (this.speaking) {
      this.speaking = false;
      this.emit('end');
    }
  }

  /**
   * Spricht eine Ansage. parts werden einzeln gesprochen: die Schlagzeile mit
   * mehr Energie, laute Großbuchstaben-Teile noch lauter/höher.
   * @param {string|string[]} parts
   * @param {{energy?: number}} [opts]
   * @returns {Promise<void>}
   */
  speak(parts, { energy = 1 } = {}) {
    const list = (Array.isArray(parts) ? parts : [parts]).filter((p) => p && p.trim());
    if (!this.enabled || !this.supported || !list.length) return Promise.resolve();
    this.stop();
    const myId = ++this.queueId;
    const style = VOICE_STYLES[this.style] || VOICE_STYLES.kumpel;
    const voice = this.pickVoice();
    this.speaking = true;
    this.emit('start');

    return new Promise((resolve) => {
      let i = 0;
      let watchdog = null;
      const done = () => {
        clearTimeout(watchdog);
        if (myId === this.queueId) {
          this.speaking = false;
          this.emit('end');
        }
        resolve();
      };
      const next = () => {
        clearTimeout(watchdog);
        if (myId !== this.queueId) return resolve();
        if (i >= list.length) return done();
        const text = forSpeech(list[i]);
        const isShout = /[A-ZÄÖÜ]{4,}/.test(list[i]) || /!{1}/.test(list[i]);
        const boost = i === 0 ? energy * 0.06 : 0;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'de-DE';
        if (voice) u.voice = voice;
        u.volume = Math.max(0, Math.min(1, this.volume));
        u.rate = clamp(style.rate + boost + (isShout && energy >= 3 ? 0.08 : 0), 0.6, 1.6);
        u.pitch = clamp(style.pitch + boost * 1.5 + (isShout && energy >= 3 ? 0.15 : 0), 0.5, 2);
        u.onend = () => {
          i++;
          next();
        };
        u.onerror = () => {
          i++;
          next();
        };
        this.synth.speak(u);
        // Manche Browser feuern onend nicht zuverlässig – Sicherheitsnetz
        watchdog = setTimeout(() => {
          i++;
          next();
        }, 1500 + text.length * 110);
      };
      next();
    });
  }
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

/** Bereitet Text für die Sprachausgabe auf (Großbuchstaben nicht buchstabieren lassen). */
export function forSpeech(text) {
  return text
    .replace(/\b([A-ZÄÖÜ]{2,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase())
    .replace(/(.)\1{3,}/g, '$1$1$1')
    .replace(/\bT(\d{1,2})\b/g, 'Triple $1')
    .replace(/\bD(\d{1,2})\b/g, 'Doppel $1')
    .replace(/ · /g, ', ');
}

// ------------------------------------------------------------

export class SpeechIn {
  /**
   * @param {{onResult:(alternatives:string[])=>void, onInterim?:(t:string)=>void,
   *          onState?:(s:string)=>void, onError?:(msg:string)=>void}} handlers
   */
  constructor(handlers) {
    this.h = handlers;
    const Rec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
    this.Rec = Rec;
    this.rec = null;
    this.mode = 'button';
    this.wakeWord = 'buddy';
    this.listening = false;
    this.wantListening = false;
    this.paused = false;
    this.armedUntil = 0;
  }

  get supported() {
    return !!this.Rec;
  }

  setMode(mode, wakeWord) {
    const wasActive = this.wantListening;
    this.stop();
    this.mode = mode;
    if (wakeWord) this.wakeWord = wakeWord.toLowerCase();
    if (wasActive && mode === 'wake') this.start();
  }

  build() {
    const r = new this.Rec();
    r.lang = 'de-DE';
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = this.mode === 'wake';
    r.onstart = () => {
      this.listening = true;
      this.state();
    };
    r.onresult = (e) => this.handleResult(e);
    r.onerror = (e) => {
      const map = {
        'not-allowed': 'Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.',
        'service-not-allowed': 'Spracherkennung ist in diesem Browser nicht erlaubt.',
        network: 'Spracherkennung braucht Internet – nutze die manuelle Eingabe.',
        'audio-capture': 'Kein Mikrofon gefunden.',
      };
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (map[e.error]) {
        this.wantListening = false;
        this.h.onError?.(map[e.error]);
      }
    };
    r.onend = () => {
      this.listening = false;
      // Im Aktivierungswort-Modus dauerhaft weiterhören (außer pausiert)
      if (this.wantListening && this.mode === 'wake' && !this.paused) {
        setTimeout(() => this.safeStart(), 250);
      } else if (this.mode === 'button') {
        this.wantListening = false;
      }
      this.state();
    };
    return r;
  }

  safeStart() {
    if (!this.supported || this.listening) return;
    try {
      this.rec = this.build();
      this.rec.start();
    } catch (e) {
      // start() wirft, wenn schon aktiv – ignorieren
    }
  }

  start() {
    if (!this.supported) return;
    this.wantListening = true;
    this.paused = false;
    this.safeStart();
    this.state();
  }

  stop() {
    this.wantListening = false;
    if (this.rec) {
      try {
        this.rec.abort();
      } catch {}
    }
    this.listening = false;
    this.state();
  }

  toggle() {
    if (this.wantListening) this.stop();
    else this.start();
  }

  /** Während der eigenen Sprachausgabe nicht zuhören. */
  pause() {
    if (!this.wantListening) return;
    this.paused = true;
    if (this.rec) {
      try {
        this.rec.abort();
      } catch {}
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.wantListening && this.mode === 'wake') this.safeStart();
  }

  state() {
    this.h.onState?.(this.wantListening ? (this.mode === 'wake' ? (Date.now() < this.armedUntil ? 'armed' : 'wake') : 'listening') : 'idle');
  }

  handleResult(e) {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (!res.isFinal) {
        interim += res[0].transcript;
        continue;
      }
      const alts = [];
      for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
      this.handleFinal(alts);
    }
    if (interim) this.h.onInterim?.(interim);
  }

  handleFinal(alts) {
    if (this.mode === 'button') {
      this.h.onResult(alts);
      return;
    }
    // Aktivierungswort-Modus: nur Sätze nach "Buddy" zählen
    const ww = this.wakeWord;
    const now = Date.now();
    const withWake = alts.map((a) => {
      const low = a.toLowerCase();
      const i = low.lastIndexOf(ww);
      return i >= 0 ? a.slice(i + ww.length) : null;
    });
    const hit = withWake.findIndex((x) => x !== null);
    if (hit >= 0) {
      const rest = withWake.filter((x) => x !== null).map((x) => x.trim());
      if (rest.some((x) => x.length)) {
        this.armedUntil = 0;
        this.h.onResult(rest.filter((x) => x.length));
      } else {
        // Nur das Aktivierungswort gehört – die nächsten 8 Sekunden zählen
        this.armedUntil = now + 8000;
        this.h.onArmed?.();
      }
      this.state();
      return;
    }
    if (now < this.armedUntil) {
      this.armedUntil = 0;
      this.h.onResult(alts);
      this.state();
      return;
    }
    this.h.onIgnored?.(alts[0]);
  }
}
