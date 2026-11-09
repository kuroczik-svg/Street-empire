// Rendert App-Icons und Splash-Screens aus icons/icon.svg in die Android-Ressourcen.
// Aufruf: NODE_PATH=$(npm root -g) node scripts/android-icons.cjs .   (braucht Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.argv[2];
const res = path.join(root, 'android/app/src/main/res');
const svg = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="512" height="512" rx="96" fill="#0d1117"\/>/, '');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  const b = await chromium.launch();
  const render = async (file, w, h, html) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true });
    await p.close();
  };
  for (const [d, f] of Object.entries(dens)) {
    const dir = path.join(res, `mipmap-${d}`);
    const L = Math.round(48 * f), F = Math.round(108 * f);
    const full = svg.replace('<svg ', `<svg width="${L}" height="${L}" `);
    await render(path.join(dir, 'ic_launcher.png'), L, L, full);
    await render(path.join(dir, 'ic_launcher_round.png'), L, L, `<div style="width:${L}px;height:${L}px;border-radius:50%;overflow:hidden;background:#0d1117">${svg.replace('<svg ', `<svg width="${L}" height="${L}" `).replace('rx="96"', 'rx="0"')}</div>`);
    // Adaptives Icon: Motiv in der sicheren Zone (66 % der Fläche)
    const s = Math.round(F * 0.66), o = Math.round((F - s) / 2);
    await render(path.join(dir, 'ic_launcher_foreground.png'), F, F, `<svg width="${F}" height="${F}" viewBox="0 0 ${F} ${F}"><svg x="${o}" y="${o}" width="${s}" height="${s}" viewBox="0 0 512 512">${inner}</svg></svg>`);
  }
  // Splash-Screens: dunkler Hintergrund, Icon mittig
  const splashes = execSync(`find ${res} -name 'splash.png'`).toString().trim().split('\n');
  for (const file of splashes) {
    const m = execSync(`file "${file}"`).toString().match(/(\d+) x (\d+)/);
    const w = +m[1], h = +m[2], s = Math.round(Math.min(w, h) * 0.4);
    await render(file, w, h, `<div style="width:${w}px;height:${h}px;background:#0d1117;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`);
  }
  await b.close();
  console.log(`Icons + ${splashes.length} Splash-Screens erzeugt`);
})();
