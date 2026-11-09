// Kopiert die Web-App nach www/ – das ist der Ordner, den Capacitor in die APK packt.
import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'www');
const files = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'icons', 'src', 'data'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of files) await cp(join(root, f), join(out, f), { recursive: true });
console.log('Web-App nach www/ kopiert.');
