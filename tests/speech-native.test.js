// Prüft die nativen Sprach-Adapter (App-Version) mit simulierten Capacitor-Plugins.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function installFakeCapacitor({ matchesQueue = [], deny = false } = {}) {
  const calls = { speak: [], start: 0, stop: 0 };
  const plugins = {
    TextToSpeech: {
      getSupportedVoices: async () => ({ voices: [{ lang: 'en-US', voiceURI: 'en' }, { lang: 'de-DE', voiceURI: 'de1', name: 'Deutsch' }] }),
      speak: async (o) => { calls.speak.push(o); },
      stop: async () => {},
    },
    SpeechRecognition: {
      checkPermissions: async () => ({ speechRecognition: deny ? 'denied' : 'prompt' }),
      requestPermissions: async () => ({ speechRecognition: deny ? 'denied' : 'granted' }),
      start: async () => {
        calls.start++;
        const next = matchesQueue.shift();
        if (next instanceof Error) throw next;
        return { matches: next || [] };
      },
      stop: async () => { calls.stop++; },
    },
  };
  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => true,
      isPluginAvailable: (n) => n in plugins,
      registerPlugin: (n) => plugins[n],
    },
  };
  return calls;
}

const tick = () => new Promise((r) => setTimeout(r, 20));

test('App: Sprachausgabe nutzt das native Plugin mit deutscher Stimme', async () => {
  const calls = installFakeCapacitor();
  const { createSpeechOut, NativeSpeechOut } = await import('../src/speech.js?out');
  const out = createSpeechOut();
  assert.ok(out instanceof NativeSpeechOut);
  await out.voicesLoaded;
  assert.equal(out.germanVoices().length, 1);
  out.voiceURI = 'de1';
  let started = 0, ended = 0;
  out.on('start', () => started++);
  out.on('end', () => ended++);
  await out.speak(['HUNDERTACHTZIG, MARKUS!', 'Noch 121!'], { energy: 4 });
  assert.equal(calls.speak.length, 2);
  assert.equal(calls.speak[0].lang, 'de-DE');
  assert.equal(calls.speak[0].voice, 1);
  assert.equal(calls.speak[0].text, 'Hundertachtzig, Markus!');
  assert.equal(started, 1);
  assert.equal(ended, 1);
});

test('App: Spracherkennung im Knopf-Modus liefert die Alternativen genau einmal', async () => {
  const calls = installFakeCapacitor({ matchesQueue: [['17 2 Triple 13', '17 2 trippel 13']] });
  const { createSpeechIn, NativeSpeechIn } = await import('../src/speech.js?in1');
  const results = [];
  const sin = createSpeechIn({ onResult: (a) => results.push(a) });
  assert.ok(sin instanceof NativeSpeechIn);
  sin.start();
  await tick();
  assert.deepEqual(results, [['17 2 Triple 13', '17 2 trippel 13']]);
  assert.equal(calls.start, 1);
  assert.equal(sin.wantListening, false);
});

test('App: Stille wird ignoriert, Aktivierungswort-Modus filtert Gespräche', async () => {
  installFakeCapacitor({ matchesQueue: [new Error('No match'), ['ich hol mir zwei bier'], ['Buddy Doppel 20 5 12']] });
  const { createSpeechIn } = await import('../src/speech.js?in2');
  const results = [];
  const errors = [];
  const sin = createSpeechIn({ onResult: (a) => results.push(a), onError: (e) => errors.push(e) });
  sin.setMode('wake', 'buddy');
  sin.start();
  await new Promise((r) => setTimeout(r, 900));
  sin.stop();
  assert.deepEqual(errors, []);
  assert.deepEqual(results, [['Doppel 20 5 12']]);
});

test('App: verweigertes Mikrofon gibt eine verständliche Meldung', async () => {
  installFakeCapacitor({ deny: true });
  const { createSpeechIn } = await import('../src/speech.js?in3');
  const errors = [];
  const sin = createSpeechIn({ onResult: () => {}, onError: (e) => errors.push(e) });
  sin.start();
  await tick();
  assert.match(errors[0], /verweigert/);
  assert.equal(sin.wantListening, false);
});
