// Browsertest „wie in der APK“: echte Capacitor-Android-Brücke (native-bridge.js) + echtes
// capacitor.js, nur die Android-Gegenseite (Plugins) wird simuliert.
// Chromium hat – wie die Android-WebView – eine eigene Web-Spracherkennung; der Test stellt
// sicher, dass die App trotzdem die NATIVEN Plugins benutzt.
//   NODE_PATH=$(npm root -g) node tests/e2e/android-bridge-e2e.cjs [screenshot-ordner]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const shots = process.argv[2];
const PORT = 8767;
const bridge = fs.readFileSync(path.join(root, 'node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js'), 'utf8');
const promise = (names) => names.map((name) => ({ name, rtype: 'promise' }));

const ANDROID = `
  window.__calls = [];
  window.__speechQueue = [];
  window.__spoken = [];
  window.androidBridge = {
    postMessage(json) {
      const call = JSON.parse(json);
      window.__calls.push(call.pluginId + '.' + call.methodName);
      const reply = (success, data, error) => setTimeout(() => window.androidBridge.onmessage({
        data: JSON.stringify({ callbackId: call.callbackId, pluginId: call.pluginId, methodName: call.methodName, success, data, error }),
      }), 15);
      const p = call.pluginId + '.' + call.methodName;
      if (p === 'SpeechRecognition.checkPermissions') return reply(true, { speechRecognition: 'prompt' });
      if (p === 'SpeechRecognition.requestPermissions') return reply(true, { speechRecognition: 'granted' });
      if (p === 'SpeechRecognition.start') {
        window.__lastStartOptions = call.options;
        const next = window.__speechQueue.shift();
        return next ? reply(true, { matches: next }) : reply(false, null, { message: 'No match' });
      }
      if (p === 'TextToSpeech.getSupportedVoices') return reply(true, { voices: [{ lang: 'en-US', name: 'English', voiceURI: 'en' }, { lang: 'de-DE', name: 'Deutsch', voiceURI: 'de1' }] });
      if (p === 'TextToSpeech.speak') { window.__spoken.push(call.options.text); window.__lastSpeakOptions = call.options; return reply(true, {}); }
      return reply(true, {});
    },
  };
  ${bridge}
  window.Capacitor.PluginHeaders = ${JSON.stringify([
    { name: 'SpeechRecognition', methods: promise(['available', 'start', 'stop', 'getSupportedLanguages', 'isListening', 'checkPermissions', 'requestPermissions', 'removeAllListeners']) },
    { name: 'TextToSpeech', methods: promise(['speak', 'stop', 'getSupportedLanguages', 'getSupportedVoices', 'isLanguageSupported', 'openInstall']) },
  ])};
`;

(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) } });
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  // Teil 1: Mikrofonknopf
  await ctx.addInitScript(`try { if (!localStorage.getItem('dartbuddy.settings.v1')) localStorage.setItem('dartbuddy.settings.v1', JSON.stringify({ micMode: 'button', settingsVersion: 3 })); } catch (e) {}`);
  await ctx.addInitScript(ANDROID);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/`);

  const env = await page.evaluate(() => ({
    native: window.Capacitor.isNativePlatform(),
    platform: window.Capacitor.getPlatform(),
    webSpeechExists: !!(window.webkitSpeechRecognition || window.SpeechRecognition),
    registerPlugin: typeof window.Capacitor.registerPlugin,
  }));
  console.log('Umgebung:', env);
  assert.equal(env.native, true);
  assert.equal(env.platform, 'android');
  assert.equal(env.registerPlugin, 'function', 'capacitor.js muss registerPlugin bereitstellen');

  await page.click('text=Neues Spiel');
  await page.fill('[data-field=name][data-i="0"]', 'Markus');
  await page.fill('[data-field=name][data-i="1"]', 'Lukas');
  await page.click('[data-action=starter] >> text=Markus');
  await page.check('[data-field=confirmed]');
  await page.click('[data-action=start]');

  // Mikrofon antippen → native Spracherkennung
  await page.evaluate(() => window.__speechQueue.push(['17 2 Triple 13', '17 2 trippel 13']));
  await page.click('#mic');
  await page.waitForFunction(() => window.dartBuddy.session.state.byId[window.dartBuddy.session.state.players[0].id].remaining === 243, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const calls = await page.evaluate(() => window.__calls);
  console.log('Native Aufrufe:', [...new Set(calls)].join(', '));
  assert.ok(calls.includes('SpeechRecognition.requestPermissions'), 'Mikrofon-Erlaubnis nativ angefragt');
  assert.ok(calls.includes('SpeechRecognition.start'), 'native Spracherkennung benutzt');
  assert.equal(await page.evaluate(() => window.__lastStartOptions.language), 'de-DE');
  const spoken = await page.evaluate(() => window.__spoken.join(' | '));
  console.log('Native Sprachausgabe:', spoken);
  assert.match(spoken, /58/, 'Punkte werden nativ angesagt');
  assert.match(spoken, /243/);
  assert.equal(await page.evaluate(() => window.__lastSpeakOptions.lang), 'de-DE');
  const toast = await page.textContent('#toast');
  assert.doesNotMatch(toast, /Browser-Einstellungen|verweigert/, toast);
  if (shots) await page.screenshot({ path: path.join(shots, 'android-bridge.png') });
  assert.deepEqual(errors, []);
  console.log('Teil 1 (Mikrofonknopf) bestanden');

  // ---------- Teil 2: Dauerhaft zuhören (Standard) ----------
  const ctx2 = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx2.addInitScript(ANDROID);
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto(`http://localhost:${PORT}/`);
  await p2.click('text=Neues Spiel');
  await p2.fill('[data-field=name][data-i="0"]', 'Markus');
  await p2.fill('[data-field=name][data-i="1"]', 'Lukas');
  await p2.click('[data-action=starter] >> text=Markus');
  await p2.check('[data-field=confirmed]');
  await p2.click('[data-action=start]');
  // Mikrofon startet in der App von selbst und hört dauerhaft zu
  await p2.waitForFunction(() => window.__calls.filter((c) => c === 'SpeechRecognition.start').length >= 3, null, { timeout: 8000 });
  assert.match(await p2.textContent('.mic-text'), /Hört dauerhaft zu/);
  const say = async (t) => {
    await p2.evaluate((x) => window.__speechQueue.push([x]), t);
    await p2.waitForFunction(() => window.__speechQueue.length === 0, null, { timeout: 8000 });
    await p2.waitForTimeout(400);
  };
  const remaining = () => p2.evaluate(() => { const s = window.dartBuddy.session.state; return s.players.map((p) => p.remaining); });
  const spokenBefore = await p2.evaluate(() => window.__spoken.length);
  for (const t of ['Wer will noch ein Bier?', 'Ich hol mir noch zwei Bier', 'acht', 'Um 20 Uhr müssen wir los']) await say(t);
  assert.deepEqual(await remaining(), [301, 301], 'Gerede zählt nicht');
  assert.equal(await p2.evaluate(() => window.__spoken.length), spokenBefore, 'zu Gerede wird nichts gesagt');
  assert.match(await p2.textContent('#ignored'), /Ignoriert/);
  await say('17 2');
  assert.match(await p2.textContent('#bubble'), /dritte Pfeil/);
  await say('Alter, gib mal das Bier');
  await say('4');
  await p2.waitForFunction(() => window.dartBuddy.session.state.players[0].remaining === 278, null, { timeout: 5000 });
  const spoken2 = await p2.evaluate(() => window.__spoken.slice(-6).join(' | '));
  console.log('Dauer-Modus Ansage:', spoken2);
  assert.match(spoken2, /23/);
  // nach der Ansage hört die App weiter zu
  const startsBefore = await p2.evaluate(() => window.__calls.filter((c) => c === 'SpeechRecognition.start').length);
  await p2.waitForTimeout(1500);
  const startsAfter = await p2.evaluate(() => window.__calls.filter((c) => c === 'SpeechRecognition.start').length);
  assert.ok(startsAfter > startsBefore, 'Mikrofon läuft nach der Ansage weiter');
  await say('Doppel 20, 5, 12');
  assert.deepEqual(await remaining(), [278, 244]);
  // Antippen = Pause
  await p2.click('#mic');
  await p2.waitForTimeout(300);
  assert.match(await p2.textContent('.mic-text'), /pausiert/);
  if (shots) await p2.screenshot({ path: path.join(shots, 'dauer-modus.png') });
  assert.deepEqual(errors, []);
  console.log('Teil 2 (Dauerhaft zuhören) bestanden');
  console.log('ANDROID-BRÜCKEN-TEST BESTANDEN');
  await browser.close();
  server.kill();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
