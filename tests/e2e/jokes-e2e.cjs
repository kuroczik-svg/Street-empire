// Browsertest Sprüche-Bibliothek:
//   NODE_PATH=$(npm root -g) node tests/e2e/jokes-e2e.cjs [screenshot-ordner]
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..', '..');
const shots = process.argv[2];
const PORT = 8766;
const INIT = `
  try { if (!localStorage.getItem('dartbuddy.settings.v1')) localStorage.setItem('dartbuddy.settings.v1', JSON.stringify({ micMode: 'button', settingsVersion: 3 })); } catch (e) {}
  window.__spoken = [];
  let s = 12345; Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 2); } } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
`;

(async () => {
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) } });
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => shots && page.screenshot({ path: path.join(shots, `${n}.png`), fullPage: true });
  await page.goto(`http://localhost:${PORT}/`);

  // Einstellungen: gnadenlos
  await page.click('.topnav [data-screen=settings]');
  await page.click('[data-action=humor][data-v=gnadenlos]');
  await page.click('text=Sprüche-Bibliothek öffnen');

  // 1) Einzelner Spruch mit Platzhaltern
  await page.fill('[data-field=joke-text]', 'Meine Fresse, ');
  await page.click('[data-action=joke-token][data-v="[Name]"]');
  await page.type('[data-field=joke-text]', '! [Punkte] Punkte! Die Scheibe überlegt schon, ob sie sich aus Langeweile umdreht!');
  await page.selectOption('[data-field=joke-situation]', 'katastrophe');
  const preview = await page.textContent('#joke-preview');
  assert.match(preview, /Meine Fresse, Markus! 18 Punkte!/);
  await shot('j1-neuer-spruch');
  await page.click('[data-action=joke-save]');
  assert.match(await page.textContent('main'), /Eigene: 1/);

  // Fehlerfall: 180 im falschen Topf
  await page.fill('[data-field=joke-text]', 'Hundertachtzig, [Name]!');
  assert.match(await page.textContent('#joke-preview'), /Die 180/);

  // 2) Tabelle einfügen
  await page.fill('[data-field=joke-text]', '');
  await page.fill('[data-field=joke-bulk]', `| Nr. | Spruch |
| --- | --- |
| 1 | „, du Bagger mit plattem Reifen!“ |
| 2 | „Junge, das war ein Warnschuss für die Tapete!“ |`);
  await page.selectOption('[data-field=bulk-situation]', 'mittel');
  await page.click('[data-action=joke-bulk]');
  assert.match(await page.textContent('dialog'), /2 Sprüche übernehmen/);
  await page.click('dialog button[value=ok]');
  await page.waitForFunction(() => /Eigene: 3/.test(document.querySelector('main').textContent));
  assert.match(await page.textContent('main'), /\[Name\], du Bagger mit plattem Reifen!/);

  // 3) Eingebauten Spruch ausblenden
  await page.click('details >> nth=0');
  await page.locator('[data-action=builtin-toggle]').first().click();
  assert.match(await page.textContent('main'), /ausgeblendet: 1/);
  await shot('j2-bibliothek');

  // 4) Bleibt nach Neustart erhalten
  await page.reload();
  await page.click('.topnav [data-screen=jokes]');
  assert.match(await page.textContent('main'), /Eigene: 3 \(3 aktiv\) · ausgeblendet: 1/);

  // 5) Im Spiel: eigener Spruch wird gesagt (mit echten Werten)
  await page.click('.brand');
  await page.click('text=Neues Spiel');
  await page.fill('[data-field=name][data-i="0"]', 'Markus');
  await page.fill('[data-field=name][data-i="1"]', 'Lukas');
  await page.click('[data-action=starter] >> text=Markus');
  await page.check('[data-field=confirmed]');
  await page.click('[data-action=start]');
  let heard = null;
  for (let i = 0; i < 20 && !heard; i++) {
    for (const v of [5, 6, 7]) await page.click(`[data-action=num][data-v="${v}"]`); // 18 Punkte
    const spoken = await page.evaluate(() => window.__spoken.join(' '));
    const m = spoken.match(/Meine Fresse, (\w+)! 18 Punkte! Die Scheibe überlegt/);
    if (m) heard = m[0];
  }
  assert.ok(heard, 'eigener Spruch wurde im Spiel gesagt');
  console.log('Gehört:', heard);
  assert.deepEqual(errors, []);
  console.log('SPRÜCHE-BIBLIOTHEK-TEST BESTANDEN');
  await browser.close();
  server.kill();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
