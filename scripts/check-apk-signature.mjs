// Prüft, ob eine APK mit dem festen Projekt-Schlüssel (android/app/dartbuddy-debug.keystore) signiert ist.
// Sonst würde Android das Update ablehnen („Paket steht in Konflikt mit einem bestehenden Paket“).
//   node scripts/check-apk-signature.mjs <pfad/zur.apk>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const apkPath = process.argv[2];
if (!apkPath) {
  console.error('Aufruf: node scripts/check-apk-signature.mjs <apk>');
  process.exit(2);
}
const keystore = fileURLToPath(new URL('../android/app/dartbuddy-debug.keystore', import.meta.url));
const cert = execFileSync('keytool', ['-exportcert', '-keystore', keystore, '-alias', 'androiddebugkey', '-storepass', 'android'], {
  stdio: ['ignore', 'pipe', 'ignore'],
});
const apk = readFileSync(apkPath);
if (cert.length < 100 || apk.indexOf(cert) < 0) {
  console.error('FEHLER: Die APK ist NICHT mit dem Projekt-Schlüssel signiert – Updates würden scheitern.');
  process.exit(1);
}
console.log(`OK: APK ist mit dem festen DART-BUDDY-Schlüssel signiert (${cert.length} Byte Zertifikat gefunden).`);
