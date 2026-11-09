// Kopiert die Web-App nach www/ – das ist der Ordner, den Capacitor in die APK packt.
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'www');
const files = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'icons', 'src', 'data', 'vendor'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of files) await cp(join(root, f), join(out, f), { recursive: true });

// Capacitor-Laufzeit immer passend zur installierten Version mitliefern
try {
  const src = await readFile(join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), 'utf8');
  await writeFile(join(out, 'vendor/capacitor.js'), src.replace(/^\/\/# sourceMappingURL=.*$/m, ''));
} catch {
  console.warn('Hinweis: @capacitor/core nicht installiert – nutze vendor/capacitor.js aus dem Projekt.');
}
console.log('Web-App nach www/ kopiert.');
