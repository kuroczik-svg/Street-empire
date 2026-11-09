// DART BUDDY – Bildschirm „Sprüche-Bibliothek“
// ------------------------------------------------------------
// Eigene Sprüche anlegen, bearbeiten, pausieren, löschen, mehrere auf einmal
// einfügen, eingebaute Sprüche ausblenden, alles sichern und teilen.
// Die Logik steckt in library.js – hier nur Oberfläche.

import {
  SITUATIONS, PLACEHOLDERS, validateCustomJoke, buildLibrary, parsePastedJokes,
  exportLibrary, importLibrary, toDisplay, builtInOverview,
} from './library.js';
import { HUMOR_LEVELS } from './commentator.js';

const LEVEL_ICON = { freundlich: '😊 Freundlich', frech: '😏 Frech', gnadenlos: '😈 Gnadenlos (FSK 16)' };
const SAMPLE_POINTS = { katastrophe: 18, mittel: 38, gut: 85, stark: 120, max180: 180, bust: 0, sieg: 40, finish: 60, fuehrung: 95, naechster: 60, korrektur: 0 };

/** Beispielwerte für die Vorschau. */
function sample(situation) {
  const pts = SAMPLE_POINTS[situation] ?? 40;
  return { name: 'Markus', NAME: 'MARKUS', SHOUT: 'MAAARKUUS', pts, rest: 160, next: 'Lukas', leader: 'Lukas', prev: 'Wowa', leaderRest: 40, rival: 'Lukas', rivalRest: 40, prevBest: 120, nextBest: 100, route: 'Doppel 20' };
}
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m));

export function createJokesScreen({ store, commentator, speak, toast, confirmDialog, modal, esc, rerender, getHumor }) {
  let custom = store.loadCustomJokes();
  let hidden = store.loadHiddenJokes();
  const form = { id: null, text: '', situation: 'katastrophe', level: null, players: 0, createdAt: null, enabled: true };
  const bulk = { text: '', situation: 'katastrophe', level: null };
  let builtinFlat = [];

  function apply() {
    commentator.setLibrary(buildLibrary(custom, hidden));
  }
  function persist() {
    store.saveCustomJokes(custom);
    store.saveHiddenJokes(hidden);
    apply();
  }
  apply();

  const level = () => form.level || getHumor();
  const bulkLevel = () => bulk.level || getHumor();

  function situationOptions(selected) {
    return Object.entries(SITUATIONS).map(([k, s]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(s.label)}</option>`).join('');
  }
  function levelChips(action, selected) {
    return HUMOR_LEVELS.map((h) => `<button class="chip" data-action="${action}" data-v="${h}" aria-pressed="${selected === h}">${LEVEL_ICON[h]}</button>`).join('');
  }

  function previewHtml() {
    if (!form.text.trim()) return '<span class="muted">Vorschau erscheint hier …</span>';
    const r = validateCustomJoke({ ...form, level: level() });
    if (!r.ok) return `<div style="color:#fca5a5">${r.errors.map(esc).join('<br>')}</div>`;
    return `<div>„${esc(fill(r.joke.text, sample(form.situation)))}“</div>
      <div class="small muted" style="margin-top:6px">Beispiel mit Markus${form.situation === 'naechster' ? ' → nächster: Lukas' : ''}${r.joke.players ? ` · nur bei ${r.joke.players} Spielern` : ''}</div>
      ${r.warnings.length ? `<div class="small" style="color:#fde68a;margin-top:6px">${r.warnings.map(esc).join('<br>')}</div>` : ''}`;
  }

  function updatePreview() {
    const el = document.getElementById('joke-preview');
    if (el) el.innerHTML = previewHtml();
  }

  function render(container) {
    const builtin = builtInOverview();
    builtinFlat = [];
    const builtinCount = builtin.reduce((n, g) => n + g.items.length, 0);
    const active = custom.filter((j) => j.enabled !== false).length;
    const bySituation = Object.keys(SITUATIONS)
      .map((k) => ({ k, list: custom.filter((j) => j.situation === k) }))
      .filter((g) => g.list.length);

    container.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <h1>Sprüche-Bibliothek</h1>
    </div>
    <p class="muted small">Eingebaut: ${builtinCount} · Eigene: ${custom.length} (${active} aktiv)${hidden.length ? ` · ausgeblendet: ${hidden.length}` : ''}. Eigene Sprüche bleiben bei App-Updates erhalten und kommen etwas häufiger dran.</p>

    <section class="card" id="joke-form">
      <h2>${form.id ? '✏️ Spruch bearbeiten' : '➕ Neuer Spruch'}</h2>
      <textarea class="input" rows="3" data-field="joke-text" placeholder="z. B.: Meine Fresse, [Name]! [Punkte] Punkte! Die Scheibe dreht sich gleich aus Langeweile um!" maxlength="300">${esc(toDisplay(form.text))}</textarea>
      <div class="chips" style="margin:8px 0">
        ${PLACEHOLDERS.map((p) => `<button class="chip" style="min-height:36px;padding:4px 10px;font-size:.85rem" data-action="joke-token" data-v="${esc(p.token)}" title="${esc(p.hint)}">${esc(p.token)}</button>`).join('')}
      </div>
      <p class="small muted" style="margin:0 0 10px">Zahlen bitte nicht fest reinschreiben – [Punkte] und [Rest] setzt die App immer richtig ein.</p>
      <div class="setting-block"><label>Wann soll der Spruch kommen?
        <select class="input" data-field="joke-situation">${situationOptions(form.situation)}</select></label>
      </div>
      <div class="setting-block"><span class="lbl">Humor-Stufe</span><div class="chips">${levelChips('joke-level', level())}</div>
        <p class="small muted" style="margin:6px 0 0">Freundliche Sprüche kommen bei „freundlich“ und „frech“, freche bei „frech“ und „gnadenlos“, FSK-16-Sprüche nur bei „gnadenlos“.</p>
      </div>
      <div class="setting-block"><label>Spielerzahl
        <select class="input" data-field="joke-players">
          ${[[0, 'immer'], [2, 'nur bei 2 Spielern'], [3, 'nur bei 3 Spielern'], [4, 'nur bei 4 Spielern']].map(([v, l]) => `<option value="${v}" ${Number(form.players) === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <div class="bubble" id="joke-preview" style="margin-bottom:10px">${previewHtml()}</div>
      <div class="row">
        <button class="btn" data-action="joke-try">🔊 Probe hören</button>
        <button class="btn primary" data-action="joke-save">💾 ${form.id ? 'Änderung speichern' : 'Spruch speichern'}</button>
        ${form.id ? '<button class="btn ghost" data-action="joke-cancel">Abbrechen</button>' : ''}
      </div>
    </section>

    <section class="card">
      <h2>📋 Mehrere auf einmal einfügen</h2>
      <p class="small muted">Eine Zeile = ein Spruch. Tabellen, Nummern und Anführungszeichen werden automatisch entfernt; fehlende Namen („Meine Fresse, !“) werden zu [Name].</p>
      <textarea class="input" rows="5" data-field="joke-bulk" placeholder="Sprüche hier einfügen …">${esc(bulk.text)}</textarea>
      <div class="setting-block" style="margin-top:10px"><label>Alle eingefügten Sprüche gelten für
        <select class="input" data-field="bulk-situation">${situationOptions(bulk.situation)}</select></label>
      </div>
      <div class="setting-block"><div class="chips">${levelChips('bulk-level', bulkLevel())}</div></div>
      <button class="btn primary" data-action="joke-bulk">Übernehmen …</button>
    </section>

    <section class="card">
      <h2>⭐ Eigene Sprüche (${custom.length})</h2>
      ${custom.length ? bySituation.map((g) => `
        <div class="round-h">${esc(SITUATIONS[g.k].label)}</div>
        ${g.list.map((j) => `
          <div class="turn" style="${j.enabled === false ? 'opacity:.5' : ''}">
            <div>${esc(toDisplay(j.text))}
              <div class="tmeta">${LEVEL_ICON[j.level] || j.level}${j.players ? ` · nur ${j.players} Spieler` : ''}${j.enabled === false ? ' · pausiert' : ''}</div>
            </div>
            <div class="row" style="flex-wrap:nowrap;align-self:start">
              <button class="btn sm ghost" data-action="joke-toggle" data-id="${j.id}" aria-label="${j.enabled === false ? 'Aktivieren' : 'Pausieren'}">${j.enabled === false ? '▶' : '⏸'}</button>
              <button class="btn sm ghost" data-action="joke-edit" data-id="${j.id}" aria-label="Bearbeiten">✏️</button>
              <button class="btn sm ghost" data-action="joke-delete" data-id="${j.id}" aria-label="Löschen">🗑</button>
            </div>
          </div>`).join('')}`).join('') : '<p class="muted">Noch keine eigenen Sprüche – leg oben los!</p>'}
    </section>

    <section class="card">
      <h2>💾 Sichern &amp; Teilen</h2>
      <p class="small muted">Eigene Sprüche als Datei sichern oder an die Kumpels schicken – beim Import werden doppelte übersprungen.</p>
      <div class="row">
        <button class="btn" data-action="joke-export" ${custom.length || hidden.length ? '' : 'disabled'}>⬇ Als Datei sichern</button>
        <button class="btn" data-action="joke-copy" ${custom.length || hidden.length ? '' : 'disabled'}>📋 Kopieren</button>
        <label class="btn">⬆ Datei importieren<input type="file" accept=".json,application/json" data-field="joke-import-file" hidden /></label>
        <button class="btn" data-action="joke-import-text">📥 Aus Text importieren</button>
      </div>
    </section>

    <section class="card">
      <h2>📚 Eingebaute Sprüche (${builtinCount})</h2>
      <p class="small muted">Was euch nicht gefällt, könnt ihr ausblenden – es kommt dann im Spiel nicht mehr.</p>
      ${builtin.map((g) => `
        <details style="margin-bottom:8px">
          <summary style="cursor:pointer;font-weight:700;padding:8px 0">${esc(g.label)} (${g.items.length})</summary>
          ${g.items.map((it) => {
            const idx = builtinFlat.push(it.text) - 1;
            const off = hidden.includes(it.text);
            return `<div class="turn" style="${off ? 'opacity:.45' : ''}">
              <div>${esc(toDisplay(it.text))}<div class="tmeta">${esc(it.level)}${off ? ' · ausgeblendet' : ''}</div></div>
              <div><button class="btn sm ghost" data-action="builtin-toggle" data-i="${idx}">${off ? 'Einblenden' : 'Ausblenden'}</button></div>
            </div>`;
          }).join('')}
        </details>`).join('')}
    </section>
    <p><button class="btn" data-action="nav" data-screen="back">← Zurück</button></p>`;
  }

  function resetForm() {
    Object.assign(form, { id: null, text: '', players: 0, createdAt: null, enabled: true });
  }

  function addJokes(list) {
    const key = (j) => `${j.situation}|${j.text}`;
    const have = new Set(custom.map(key));
    let added = 0;
    for (const j of list) {
      if (have.has(key(j))) continue;
      have.add(key(j));
      custom.push(j);
      added++;
    }
    return added;
  }

  function download(name, content) {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
      return true;
    } catch {
      return false;
    }
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      toast('In die Zwischenablage kopiert – z. B. per WhatsApp an die Kumpels schicken.');
    } catch {
      await modal(`<h2>Zum Kopieren</h2><textarea class="input" rows="10" readonly>${esc(t)}</textarea>
        <div class="modal-actions"><button class="btn primary" value="ok">Fertig</button></div>`);
    }
  }

  function doImport(json) {
    const r = importLibrary(json, custom, hidden);
    if (r.errors.length && !r.added) {
      toast(r.errors[0], 5000);
      return;
    }
    custom = r.custom;
    hidden = r.hidden;
    persist();
    toast(`${r.added} Sprüche importiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, 4000);
    rerender();
  }

  /** @returns {boolean} ob die Aktion hier behandelt wurde */
  async function onClick(action, btn) {
    switch (action) {
      case 'joke-token': {
        const ta = document.querySelector('[data-field="joke-text"]');
        if (!ta) return true;
        const pos = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, pos) + btn.dataset.v + ta.value.slice(ta.selectionEnd ?? pos);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = pos + btn.dataset.v.length;
        form.text = ta.value;
        updatePreview();
        return true;
      }
      case 'joke-level':
        form.level = btn.dataset.v;
        document.querySelectorAll('[data-action="joke-level"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === form.level)));
        updatePreview();
        return true;
      case 'bulk-level':
        bulk.level = btn.dataset.v;
        document.querySelectorAll('[data-action="bulk-level"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === bulk.level)));
        return true;
      case 'joke-try': {
        const r = validateCustomJoke({ ...form, level: level() });
        if (!r.ok) return toast(r.errors[0], 4000), true;
        speak([fill(r.joke.text, sample(form.situation))], 3);
        return true;
      }
      case 'joke-save': {
        const r = validateCustomJoke({ ...form, level: level() });
        if (!r.ok) return toast(r.errors[0], 4000), true;
        if (form.id) {
          const i = custom.findIndex((j) => j.id === form.id);
          if (i >= 0) custom[i] = r.joke;
        } else if (!addJokes([r.joke])) {
          toast('Diesen Spruch gibt es schon.');
          return true;
        }
        persist();
        toast(form.id ? 'Geändert!' : 'Gespeichert – kommt ab sofort im Spiel!');
        resetForm();
        rerender();
        return true;
      }
      case 'joke-cancel':
        resetForm();
        rerender();
        return true;
      case 'joke-edit': {
        const j = custom.find((x) => x.id === btn.dataset.id);
        if (!j) return true;
        Object.assign(form, { id: j.id, text: j.text, situation: j.situation, level: j.level, players: j.players || 0, createdAt: j.createdAt, enabled: j.enabled });
        rerender();
        document.getElementById('joke-form')?.scrollIntoView({ behavior: 'smooth' });
        return true;
      }
      case 'joke-toggle': {
        const j = custom.find((x) => x.id === btn.dataset.id);
        if (j) j.enabled = j.enabled === false;
        persist();
        rerender();
        return true;
      }
      case 'joke-delete': {
        const j = custom.find((x) => x.id === btn.dataset.id);
        if (j && (await confirmDialog('Spruch löschen?', toDisplay(j.text), { ok: 'Löschen', danger: true }))) {
          custom = custom.filter((x) => x.id !== j.id);
          if (form.id === j.id) resetForm();
          persist();
          rerender();
        }
        return true;
      }
      case 'joke-bulk': {
        const lines = parsePastedJokes(bulk.text);
        if (!lines.length) return toast('Keine Sprüche gefunden – eine Zeile pro Spruch.'), true;
        const results = lines.map((t) => ({ t, r: validateCustomJoke({ text: t, situation: bulk.situation, level: bulkLevel() }) }));
        const ok = results.filter((x) => x.r.ok);
        const bad = results.filter((x) => !x.r.ok);
        const go = await confirmDialog(
          `${ok.length} Sprüche übernehmen?`,
          `Situation: ${SITUATIONS[bulk.situation].label} · ${LEVEL_ICON[bulkLevel()]}\n\n${ok.slice(0, 5).map((x) => '• ' + toDisplay(x.r.joke.text)).join('\n')}${ok.length > 5 ? `\n… und ${ok.length - 5} weitere` : ''}${bad.length ? `\n\n${bad.length} Zeilen nicht übernommen: ${bad[0].r.errors[0]}` : ''}`,
          { ok: 'Übernehmen' },
        );
        if (!go || !ok.length) return true;
        const added = addJokes(ok.map((x) => x.r.joke));
        persist();
        bulk.text = '';
        toast(`${added} Sprüche hinzugefügt${ok.length - added ? ` (${ok.length - added} gab es schon)` : ''}.`, 4000);
        rerender();
        return true;
      }
      case 'joke-export': {
        const ok = download(`dartbuddy-sprueche-${new Date().toISOString().slice(0, 10)}.json`, exportLibrary(custom, hidden));
        if (!ok) await copyText(exportLibrary(custom, hidden));
        else toast('Datei gespeichert.');
        return true;
      }
      case 'joke-copy':
        await copyText(exportLibrary(custom, hidden));
        return true;
      case 'joke-import-text': {
        const res = await modal(`<h2>Sprüche importieren</h2>
          <p class="small muted">Hier den Text einer DART-BUDDY-Sprüchedatei einfügen.</p>
          <textarea class="input" rows="8" name="json"></textarea>
          <div class="modal-actions"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary" value="ok">Importieren</button></div>`);
        if (res === 'ok') doImport(document.querySelector('#modal-form [name=json]').value);
        return true;
      }
      case 'builtin-toggle': {
        const t = builtinFlat[Number(btn.dataset.i)];
        if (t === undefined) return true;
        hidden = hidden.includes(t) ? hidden.filter((x) => x !== t) : hidden.concat([t]);
        persist();
        // offene Abschnitte merken
        const open = [...document.querySelectorAll('details')].map((d) => d.open);
        const y = window.scrollY;
        rerender();
        document.querySelectorAll('details').forEach((d, i) => (d.open = !!open[i]));
        window.scrollTo(0, y);
        return true;
      }
      default:
        return false;
    }
  }

  /** @returns {boolean} ob die Eingabe hier behandelt wurde */
  function onInput(el) {
    const f = el.dataset.field;
    if (f === 'joke-text') {
      form.text = el.value;
      updatePreview();
    } else if (f === 'joke-situation') {
      form.situation = el.value;
      updatePreview();
    } else if (f === 'joke-players') {
      form.players = Number(el.value);
      updatePreview();
    } else if (f === 'joke-bulk') bulk.text = el.value;
    else if (f === 'bulk-situation') bulk.situation = el.value;
    else if (f === 'joke-import-file') {
      const file = el.files && el.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => doImport(String(reader.result));
        reader.readAsText(file);
      }
      el.value = '';
    } else return false;
    return true;
  }

  function reset() {
    custom = [];
    hidden = [];
    resetForm();
    apply();
  }

  return { render, onClick, onInput, reset, counts: () => ({ custom: custom.length, hidden: hidden.length }) };
}
