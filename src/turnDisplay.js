// Anzeigehilfe: errechnete Pfeilwerte und gebuchte Punkte getrennt darstellen.
// Die Punktelogik bleibt ausschließlich in engine.js.
import { dartLabel, dartValue } from './engine.js';

export function describeTurn(darts, result = null) {
  const list = Array.isArray(darts) ? darts : [];
  const ignored = new Set(result?.ignored || []);
  const values = list.filter((_, i) => !ignored.has(i)).map(dartValue);
  const total = values.reduce((sum, n) => sum + n, 0);
  return {
    darts: list.map((d, i) => ({ label: dartLabel(d), value: dartValue(d), ignored: ignored.has(i) })),
    calculation: values.join(' + ') || '0',
    thrown: result?.thrown ?? total,
    booked: result?.points ?? total,
    bust: !!result?.bust,
    checkout: !!result?.checkout,
  };
}
