// Browser-Abnahmetest (optional, braucht Playwright + Chromium):
//   NODE_PATH=$(npm root -g) node tests/e2e/browser-acceptance.cjs [screenshot-dir]
// Startet den lokalen Server, simuliert Spracherkennung und Sprachausgabe und
// spielt eine Partie Lukas / Wowa / Markus auf einem Handy-Viewport durch.
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const shots = process.argv[2];
const PORT = 8765;

const FAKE = `
  window.__spoken = [];
  class FakeRec {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; window.__rec = this; }
    start() { window.__recActive = true; setTimeout(() => this.onstart && this.onstart(), 0); }
    abort() { this.stop(); }
    stop() { if (!window.__recActive) return; window.__recActive = false; setTimeout(() => this.onend && this.onend(), 0); }
  }
  window.SpeechRecognition = FakeRec;
  window.__say = (text) => {
    const r = window.__rec; if (!r || !window.__recActive) throw new Error('Mikrofon ist nicht aktiv');
    const alt = { transcript: text, confidence: 0.9 };
    const res = [alt]; res.isFinal = true;
    r.onresult({ resultIndex: 0, results: [res] });
    if (!r.continuous) r.stop();
  };
  const synth = {
    speaking: false,
    getVoices: () => [],
    cancel() {},
    speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
`;

(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) } });
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (name) => shots && page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
  const rest = async () => page.evaluate(() => {
    const s = window.dartBuddy.session.state;
    return Object.fromEntries(s.players.map((p) => [p.name, p.remaining]));
  });
  const active = () => page.evaluate(() => { const s = window.dartBuddy.session.state; return s.activePlayerId ? s.byId[s.activePlayerId].name : null; });
  const say = async (text) => {
    await page.click('#mic');
    await page.waitForFunction(() => window.__recActive === true);
    await page.evaluate((t) => window.__say(t), text);
    await page.waitForTimeout(80);
  };
  const lastSpoken = () => page.evaluate(() => window.__spoken.slice(-6).join(' | '));

  await page.goto(`http://localhost:${PORT}/`);
  await page.click('text=Neues Spiel');
  // Setup
  await page.click('[data-action=count][data-d="1"]');
  const names = ['Lukas', 'Wowa', 'Markus'];
  for (let i = 0; i < 3; i++) await page.fill(`[data-field=name][data-i="${i}"]`, names[i]);
  await page.fill('[data-field=nickname][data-i="1"]', 'Die Maschine');
  assert.ok(await page.isDisabled('[data-action=start]'), 'Start ohne Startspieler/Bestätigung gesperrt');
  await page.click('[data-action=starter] >> text=Lukas');
  assert.ok(await page.isDisabled('[data-action=start]'), 'Start ohne Bestätigung gesperrt');
  await page.check('[data-field=confirmed]');
  await shot('01-setup');
  await page.click('[data-action=start]');
  assert.equal(await active(), 'Lukas');
  await shot('02-start');

  // Runde 1 – Sprache
  await say('Triple 20, 20, 19');
  assert.deepEqual(await rest(), { Lukas: 202, Wowa: 301, Markus: 301 });
  console.log('Ansage 1:', await lastSpoken());
  await say('Wer will noch ein Bier? Ich nehm zwei');
  assert.deepEqual(await rest(), { Lukas: 202, Wowa: 301, Markus: 301 });
  assert.equal(await active(), 'Wowa');
  await say('Doppel 20, 5, 12');
  assert.equal((await rest()).Wowa, 244);
  await say('17, 2');
  assert.match(await page.textContent('#bubble'), /dritte Pfeil/);
  await shot('03-nachfrage');
  await page.waitForFunction(() => window.__recActive === true); // Mikro geht nach Rückfrage automatisch wieder an
  await page.evaluate(() => window.__say('4'));
  await page.waitForTimeout(80);
  assert.equal((await rest()).Markus, 278);
  console.log('Ansage Markus:', await lastSpoken());

  // Runde 2 – manuelle Eingabe: Lukas T20 T20 Bullseye
  await page.click('[data-action=mult][data-v="3"]');
  await page.click('[data-action=num][data-v="20"]');
  await page.click('[data-action=mult][data-v="3"]');
  await page.click('[data-action=num][data-v="20"]');
  await page.click('[data-action=bull][data-v="2"]');
  assert.equal((await rest()).Lukas, 32);
  // vertauschte Spieler: Markus' Wurf als Wowa gebucht, Wowas als Markus
  await say('18, 18, 20');
  await say('Triple 19, 19, 1');
  assert.deepEqual(await rest(), { Lukas: 32, Wowa: 188, Markus: 201 });
  await page.click('[data-screen=history]');
  await shot('04-verlauf');
  await page.locator('[data-action=edit-turn]').last().click();
  await page.click('dialog button[value=swap]');
  await page.waitForTimeout(50);
  assert.deepEqual(await rest(), { Lukas: 32, Wowa: 167, Markus: 222 });
  await page.click('[data-screen=game]');
  assert.equal(await active(), 'Lukas');

  // Runde 3 – Bust
  await say('20, 10, 2');
  assert.equal((await rest()).Lukas, 32);
  assert.match(await page.textContent('#bubble'), /alter Stand bleibt: 32/);
  await shot('05-bust');
  // Falsch erkannt (7 statt 17) → später korrigieren
  await say('Triple 20, 20, 7');
  assert.equal((await rest()).Wowa, 80);
  await say('Hundertachtzig');
  assert.equal((await rest()).Markus, 42);
  await page.click('[data-screen=history]');
  await page.locator('[data-action=edit-turn]', { hasText: 'Wowa' }).last().click();
  await page.fill('dialog [name=darts]', 'T20 20 17');
  await page.click('dialog button[value=save]');
  await page.waitForTimeout(50);
  assert.deepEqual(await rest(), { Lukas: 32, Wowa: 70, Markus: 42 });
  await page.click('[data-screen=game]');

  // Runde 4 – unvollständig + „Rest daneben“, dann Undo-Test, dann Sieg
  await say('16, 8');
  await page.click('.bubble [data-action=rest-miss]');
  await page.click('dialog button[value=ok]');
  await page.waitForTimeout(50);
  assert.equal((await rest()).Lukas, 8);
  // Rückgängig-Taste mit Bestätigung
  await page.click('[data-action=undo]');
  await page.click('dialog button[value=ok]');
  await page.waitForTimeout(50);
  assert.equal((await rest()).Lukas, 32);
  assert.equal(await active(), 'Lukas');
  await page.click('[data-action=num][data-v="16"]');
  await page.click('[data-action=num][data-v="8"]');
  await page.click('[data-action=miss]');
  assert.equal((await rest()).Lukas, 8);
  await shot('06-spiel');
  // Wowa checkt 70: T10, D20
  await say('Triple 10, Doppel 20');
  const st = await page.evaluate(() => window.dartBuddy.session.state);
  assert.equal(st.finished, true);
  assert.equal(st.byId[st.winnerId].name, 'Wowa');
  console.log('Siegansage:', await lastSpoken());
  await page.waitForSelector('.winner-card');
  await shot('07-sieg');

  const spoken = await page.evaluate(() => window.__spoken.join('\n'));
  assert.doesNotMatch(spoken, /ich rechne|einen moment|ich prüfe|berechne/i);

  // Persistenz: Reload → Siegerbildschirm, Statistik enthält das Spiel
  await page.reload();
  await page.click('[data-screen=stats]');
  const table = await page.textContent('.table');
  assert.match(table, /Wowa/);
  await shot('08-statistik');

  assert.deepEqual(errors, []);
  console.log('\nAlle gesprochenen Ansagen:\n' + spoken);
  console.log('\nBROWSER-ABNAHMETEST BESTANDEN');
  await browser.close();
  server.kill();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
