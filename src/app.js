// DART BUDDY – Oberfläche
// ------------------------------------------------------------
// Dünne UI-Schicht: alle Regeln stecken in engine.js, alle Eingabe-
// Entscheidungen in turnInput.js / session.js, alle Sprüche in commentator.js.

import {
  OUT_MODES, createGame, computeState, validateConfig, effectiveOrder, dartLabel, dartValue,
  isValidDart, checkoutSuggestion, makeId,
} from './engine.js';
import { parseThrowInput } from './parser.js';
import { GameSession } from './session.js';
import { Commentator, HUMOR_LEVELS, HUMOR_LABELS, formatRoute } from './commentator.js';
import { createSpeechOut, createSpeechIn, VOICE_STYLES, isNativeApp } from './speech.js';
import { continuousScore } from './listenFilter.js';
import { describeTurn } from './turnDisplay.js';
import { createStore, ensureProfile, aggregateStats } from './storage.js';
import { createJokesScreen } from './jokesScreen.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $modalForm = document.getElementById('modal-form');
const $toast = document.getElementById('toast');

const store = createStore();
let settings = store.loadSettings();
let profiles = store.loadProfiles();
const commentator = new Commentator({ humor: settings.humor });
const speechOut = createSpeechOut();
let session = null;
let screen = 'home';
let statsTab = 'ranking';
let setup = null;

const ui = {
  mult: 1,
  message: '',
  messageKind: '',
  messageActions: null, // 'confirm' | 'review' | 'missing'
  interim: '',
  micState: 'idle',
  flash: '',
  lastResult: null,
  lastHeard: null,
  pendingHeard: '',
};

// ------------------------------------------------------------ Hilfen
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, ms = 2600) {
  if (!msg) return;
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), ms);
}

/** Kurzschreibweise, die der Parser eindeutig zurücklesen kann. */
function shorthand(d) {
  if (d.mult === 0) return '0';
  if (d.value === 25) return d.mult === 2 ? '50' : '25';
  return d.mult === 3 ? `T${d.value}` : d.mult === 2 ? `D${d.value}` : String(d.value);
}

function modal(html, { onOpen } = {}) {
  return new Promise((resolve) => {
    $modalForm.innerHTML = html;
    const onClose = () => {
      $modal.removeEventListener('close', onClose);
      resolve($modal.returnValue);
    };
    $modal.addEventListener('close', onClose);
    $modal.returnValue = '';
    $modal.showModal();
    onOpen?.($modalForm);
  });
}

async function confirmDialog(title, text, { ok = 'Ja', cancel = 'Abbrechen', danger = false } = {}) {
  const r = await modal(`
    <h2>${esc(title)}</h2>
    ${text ? `<p class="muted" style="white-space:pre-line">${esc(text)}</p>` : ''}
    <div class="modal-actions">
      <button class="btn" value="cancel">${esc(cancel)}</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${esc(ok)}</button>
    </div>`);
  return r === 'ok';
}

function saveSettings() {
  store.saveSettings(settings);
  applySettings();
}

function applySettings() {
  commentator.setHumor(settings.humor);
  commentator.maleWordingOk = !!settings.maleWordingOk;
  speechOut.enabled = settings.speechOn;
  speechOut.volume = settings.volume;
  speechOut.voiceURI = settings.voiceURI;
  speechOut.style = settings.voiceStyle;
  if (session) session.confirmBeforeCommit = settings.confirmBeforeCommit;
  speechIn.setMode(settings.micMode, settings.wakeWord);
}

function persist() {
  if (!session) return;
  store.saveCurrentGame(session.game);
  store.saveCommentMemory(session.exportCommentMemory());
  store.syncGameToHistory(session.game);
}

function speak(parts, energy = 1) {
  return speechOut.speak(parts, { energy });
}

// ------------------------------------------------------------ Sprüche-Bibliothek
const jokesScreen = createJokesScreen({
  store,
  commentator,
  speak: (parts, energy) => speak(parts, energy),
  toast,
  confirmDialog,
  modal,
  esc,
  rerender: () => render(),
  getHumor: () => settings.humor,
});

// ------------------------------------------------------------ Sprache
const speechIn = createSpeechIn({
  onResult: (alts, meta = {}) => {
    ui.interim = '';
    if (!session || screen !== 'game') return;
    if (meta.continuous) {
      // Dauerhaft zuhören: nur reine Wurfansagen zählen, Gespräche werden stumm verworfen
      const max = session.game.config.dartsPerTurn;
      const text = alts.reduce((best, a, i) => (continuousScore(a, { maxDarts: max }) - i * 0.01 > continuousScore(best, { maxDarts: max }) ? a : best), alts[0]);
      handleOutcome(session.inputContinuous(text), { fromVoice: true, heard: text, continuous: true });
      return;
    }
    const text = pickAlternative(alts);
    handleOutcome(session.input(text), { fromVoice: true, heard: text });
  },
  onInterim: (t) => {
    ui.interim = t;
    const el = document.getElementById('interim');
    if (el) el.textContent = `„${t}“`;
  },
  onState: (s) => {
    const was = ui.micState;
    ui.micState = s;
    updateMic();
    // Dauer-Modus: Beschriftung am Mikrofon aktualisieren, wenn es an-/ausgeht
    if (settings.micMode === 'always' && screen === 'game' && (was === 'always') !== (s === 'always')) render();
  },
  onError: (msg) => {
    toast(msg, 4500);
    ui.micState = 'idle';
    updateMic();
  },
  onArmed: () => {
    toast('Ich höre – sag die Pfeile an!');
    updateMic();
  },
  onIgnored: () => {},
});

speechOut.on('start', () => speechIn.pause());
speechOut.on('end', () => speechIn.resume());

/** Wählt aus den Erkennungs-Alternativen die plausibelste Wurfansage. */
function pickAlternative(alts) {
  const max = session.game.config.dartsPerTurn;
  let best = alts[0];
  let bestScore = -Infinity;
  alts.forEach((a, idx) => {
    const p = parseThrowInput(a, { maxDarts: max });
    let sc = 0;
    if (p.kind === 'command') sc = 5;
    else if (p.kind === 'darts') sc = p.needsConfirmation ? 2 : 4;
    sc -= idx * 0.01;
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  });
  return best;
}

// ------------------------------------------------------------ Ergebnisbehandlung
function handleOutcome(r, { fromVoice = false, heard = '', continuous = false } = {}) {
  if (!r) return;
  if (r.silent) {
    // Dauer-Modus: nichts sagen. Ignoriertes nur unauffällig anzeigen.
    if (r.action === 'ignore') {
      ui.ignored = heard ? `Ignoriert: „${heard}“` : '';
      const el = document.getElementById('ignored');
      if (el) el.textContent = ui.ignored;
      return;
    }
    if (r.action === 'wait') {
      if (heard) ui.pendingHeard = [ui.pendingHeard, heard].filter(Boolean).join(' · ');
      ui.ignored = '';
      ui.message = r.message;
      ui.messageKind = 'ask';
      ui.messageActions = 'missing';
      ui.heardHtml = heard ? `<div class="small muted">Gehört: „${esc(heard)}“</div>` : '';
      render();
      return;
    }
  }
  if (continuous) ui.ignored = '';
  ui.messageActions = null;
  const heardHtml = heard ? `<div class="small muted">Gehört: „${esc(heard)}“</div>` : '';
  switch (r.action) {
    case 'committed': {
      const a = r.announcement;
      ui.message = a.text;
      ui.messageKind = 'announce';
      ui.lastResult = r.result;
      const lastEvent = session.game.events.at(-1);
      const rawHeard = [ui.pendingHeard, heard].filter(Boolean).join(' · ');
      ui.lastHeard = rawHeard && lastEvent?.type === 'turn' ? { eventId: lastEvent.id, text: rawHeard } : null;
      ui.pendingHeard = '';
      ui.flash = r.result.checkout ? 'flash-win' : r.result.points === 180 ? 'flash-max' : r.result.bust ? 'flash-bust' : '';
      persist();
      render();
      speak(a.parts, a.energy);
      if (r.finished) speechIn.stop();
      return;
    }
    case 'wait':
    case 'ask':
      if (r.action === 'wait' && heard) ui.pendingHeard = [ui.pendingHeard, heard].filter(Boolean).join(' · ');
      ui.message = (r.quip ? `${r.quip} ` : '') + r.message;
      ui.messageKind = 'ask';
      ui.heardHtml = heardHtml;
      if (r.action === 'wait' && session.pending.length) ui.messageActions = 'missing';
      render();
      if (fromVoice || r.action === 'ask') {
        speak(r.quip ? [r.quip, r.message] : [r.message], r.quip ? 2 : 1).then(() => {
          if (fromVoice && settings.micMode === 'button' && screen === 'game') speechIn.start();
        });
      }
      return;
    case 'confirm':
      if (heard) ui.pendingHeard = [ui.pendingHeard, heard].filter(Boolean).join(' · ');
      ui.message = r.message;
      ui.messageKind = 'ask';
      ui.messageActions = 'confirm';
      ui.heardHtml = heardHtml;
      render();
      speak([r.message]);
      return;
    case 'review':
      ui.message = r.message;
      ui.messageKind = 'ask';
      ui.messageActions = 'review';
      render();
      return;
    case 'undone':
      ui.pendingHeard = '';
      ui.message = r.message;
      ui.messageKind = 'warn';
      persist();
      render();
      speak([r.message]);
      return;
    case 'ignore':
    default:
      if (r.message) toast(r.message);
      ui.heardHtml = '';
      render();
  }
}

// ------------------------------------------------------------ Setup
function newSetup(from) {
  const cfg = from?.config;
  if (cfg) {
    const players = cfg.players.map((p) => ({ id: makeId('p'), name: p.name, nickname: p.nickname || '' }));
    const idMap = Object.fromEntries(cfg.players.map((p, i) => [p.id, players[i].id]));
    const order = cfg.order.map((id) => idMap[id]);
    // Revanche: der nächste in der Reihenfolge beginnt (muss trotzdem bestätigt werden)
    const prevStart = cfg.order.indexOf(cfg.startingPlayerId);
    const starter = order[(prevStart + 1) % order.length];
    return {
      count: players.length,
      players,
      order,
      startingPlayerId: starter,
      startScore: cfg.startScore,
      customScore: [301, 501, 701].includes(cfg.startScore) ? '' : String(cfg.startScore),
      dartsPerTurn: cfg.dartsPerTurn,
      outMode: cfg.outMode,
      confirmed: false,
    };
  }
  const players = [
    { id: makeId('p'), name: '', nickname: '' },
    { id: makeId('p'), name: '', nickname: '' },
  ];
  return {
    count: 2,
    players,
    order: players.map((p) => p.id),
    startingPlayerId: null,
    startScore: 301,
    customScore: '',
    dartsPerTurn: 3,
    outMode: 'double',
    confirmed: false,
  };
}

function setupConfig() {
  const players = setup.players.map((p) => ({ id: p.id, name: p.name.trim(), nickname: p.nickname.trim() }));
  return {
    players,
    order: setup.order.slice(),
    startingPlayerId: setup.startingPlayerId,
    startScore: setup.startScore,
    dartsPerTurn: setup.dartsPerTurn,
    outMode: setup.outMode,
    orderConfirmed: setup.confirmed,
  };
}

function setCount(n) {
  n = Math.max(1, Math.min(8, n));
  while (setup.players.length < n) {
    const p = { id: makeId('p'), name: '', nickname: '' };
    setup.players.push(p);
    setup.order.push(p.id);
  }
  while (setup.players.length > n) {
    const p = setup.players.pop();
    setup.order = setup.order.filter((id) => id !== p.id);
    if (setup.startingPlayerId === p.id) setup.startingPlayerId = null;
  }
  setup.count = n;
  setup.confirmed = false;
}

const nameOf = (id) => {
  const p = setup.players.find((x) => x.id === id);
  const i = setup.players.indexOf(p);
  return p && p.name.trim() ? p.name.trim() : `Spieler ${i + 1}`;
};

function renderSetup() {
  const s = setup;
  const profileOptions = profiles.map((p) => `<option value="${esc(p.name)}"></option>`).join('');
  $app.innerHTML = `
  <h1>Neues Spiel</h1>
  <p class="muted">Erst alles festlegen – gespielt wird erst, wenn Reihenfolge und erster Spieler bestätigt sind.</p>

  <section class="card">
    <div class="step-title"><span class="step-num">1</span>Wie viele Spieler?</div>
    <div class="stepper">
      <button data-action="count" data-d="-1" aria-label="Weniger Spieler">−</button>
      <output id="count">${s.count}</output>
      <button data-action="count" data-d="1" aria-label="Mehr Spieler">+</button>
    </div>
  </section>

  <section class="card">
    <div class="step-title"><span class="step-num">2</span>Wie heißen die Spieler?</div>
    <datalist id="profile-names">${profileOptions}</datalist>
    ${s.players.map((p, i) => `
      <div class="player-input">
        <span class="idx">${i + 1}</span>
        <input class="input" data-field="name" data-i="${i}" value="${esc(p.name)}" placeholder="Name" list="profile-names" autocomplete="off" maxlength="24" aria-label="Name Spieler ${i + 1}" />
        <input class="input" data-field="nickname" data-i="${i}" value="${esc(p.nickname)}" placeholder="Spitzname" maxlength="24" aria-label="Spitzname Spieler ${i + 1}" />
      </div>`).join('')}
  </section>

  <section class="card">
    <div class="step-title"><span class="step-num">3</span>Startwert</div>
    <div class="chips">
      ${[301, 501, 701].map((v) => `<button class="chip" data-action="score" data-v="${v}" aria-pressed="${s.startScore === v && !s.customScore}">${v}</button>`).join('')}
      <input class="input" style="max-width:150px" data-field="custom" inputmode="numeric" placeholder="Eigener" value="${esc(s.customScore)}" aria-label="Eigener Startwert" />
    </div>
  </section>

  <section class="card">
    <div class="step-title"><span class="step-num">4</span>Pfeile pro Aufnahme</div>
    <div class="chips">
      ${[3, 6].map((v) => `<button class="chip" data-action="darts" data-v="${v}" aria-pressed="${s.dartsPerTurn === v}">${v} Pfeile</button>`).join('')}
    </div>
  </section>

  <section class="card">
    <div class="step-title"><span class="step-num">5</span>Reihenfolge</div>
    <ol class="order-list" id="order-list"></ol>
    <button class="btn sm" data-action="shuffle">🎲 Zufällig mischen</button>
  </section>

  <section class="card">
    <div class="step-title"><span class="step-num">6</span>Wer beginnt?</div>
    <div class="chips" id="starter-chips"></div>
  </section>

  <section class="card">
    <div class="step-title"><span class="step-num">7</span>Spielende</div>
    <div class="chips">
      ${Object.entries(OUT_MODES).map(([k, v]) => `<button class="chip" data-action="out" data-v="${k}" aria-pressed="${s.outMode === k}">${v}</button>`).join('')}
    </div>
    <p class="small muted" style="margin:10px 0 0">${
      { single: 'Jedes Feld darf den letzten Punkt machen.', double: 'Der letzte Pfeil muss ein Doppel (oder Bullseye) sein. Rest 1 = überworfen.', master: 'Der letzte Pfeil muss ein Doppel oder Triple sein.' }[s.outMode]
    }</p>
  </section>

  <section class="card summary" id="summary"></section>`;
  refreshSetupDerived();
}

function refreshSetupDerived() {
  const s = setup;
  const ol = document.getElementById('order-list');
  if (!ol) return;
  ol.innerHTML = s.order.map((id, i) => `
    <li>
      <span class="pos">${i + 1}</span>
      <span class="nm">${esc(nameOf(id))}</span>
      <button data-action="move" data-i="${i}" data-d="-1" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button data-action="move" data-i="${i}" data-d="1" aria-label="Nach unten" ${i === s.order.length - 1 ? 'disabled' : ''}>↓</button>
    </li>`).join('');
  document.getElementById('starter-chips').innerHTML =
    s.order.map((id) => `<button class="chip" data-action="starter" data-id="${id}" aria-pressed="${s.startingPlayerId === id}">${esc(nameOf(id))}</button>`).join('') +
    `<button class="chip" data-action="starter-random">🎲 Zufall</button>`;

  const cfg = setupConfig();
  const errs = validateConfig({ ...cfg, orderConfirmed: true });
  const seq = s.startingPlayerId ? effectiveOrder(cfg).map((id) => nameOf(id)) : null;
  document.getElementById('summary').innerHTML = `
    <div class="step-title"><span class="step-num">✓</span>Zusammenfassung</div>
    ${seq ? `<div class="seq">${seq.map(esc).join(' → ')}</div>
      <div class="muted">${esc(seq[0])} beginnt · ${s.startScore} · ${OUT_MODES[s.outMode]} · ${s.dartsPerTurn} Pfeile pro Aufnahme</div>`
      : '<div class="muted">Bitte noch festlegen, wer beginnt.</div>'}
    ${errs.length ? `<ul class="errors">${errs.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    <label class="confirm-line">
      <input type="checkbox" data-field="confirmed" ${s.confirmed ? 'checked' : ''} ${errs.length ? 'disabled' : ''} />
      <span>Reihenfolge und ersten Spieler bestätigt${seq ? ` – <b>${esc(seq[0])}</b> wirft zuerst` : ''}.</span>
    </label>
    <button class="btn primary big" data-action="start" ${errs.length || !s.confirmed ? 'disabled' : ''}>🎯 Spiel starten</button>`;
}

function startGameFromSetup() {
  const cfg = setupConfig();
  cfg.players = cfg.players.map((p) => {
    const prof = ensureProfile(profiles, p.name, p.nickname, makeId);
    return { ...p, profileId: prof.id, nickname: p.nickname || prof.nickname || '' };
  });
  store.saveProfiles(profiles);
  let game;
  try {
    game = createGame(cfg);
  } catch (e) {
    toast(e.message, 5000);
    return;
  }
  session = new GameSession(game, { commentator, confirmBeforeCommit: settings.confirmBeforeCommit });
  persist();
  const first = session.activePlayer.name;
  ui.message = `Los geht's! ${cfg.startScore}, ${OUT_MODES[cfg.outMode]}. ${first}, du beginnst!`;
  ui.messageKind = 'announce';
  ui.lastResult = null;
  ui.lastHeard = null;
  ui.pendingHeard = '';
  screen = 'game';
  render();
  speak([ui.message], 2);
}

// ------------------------------------------------------------ Spielbildschirm
function renderGame() {
  const st = session.state;
  const cfg = session.game.config;
  if (st.finished) return renderWinner(st, cfg);
  const active = st.byId[st.activePlayerId];
  const ev = session.evaluation();
  const leaderIds = st.players.filter((p) => st.standings.ranks[p.id] === 1 && p.remaining < cfg.startScore).map((p) => p.id);
  const route = settings.showCheckout ? checkoutSuggestion(active.remaining, cfg.outMode, cfg.dartsPerTurn >= 3 ? 3 : cfg.dartsPerTurn) : null;

  const slots = [];
  for (let i = 0; i < cfg.dartsPerTurn; i++) {
    const d = session.pending[i];
    const ignored = ev.preview && ev.preview.ignored.includes(i);
    slots.push(`<div class="slot ${d ? 'filled' : ''} ${ignored ? 'ignored' : ''}">${d ? `<div>${esc(dartLabel(d))}<small>${dartValue(d)}</small></div>` : `<small>${i + 1}. Pfeil</small>`}</div>`);
  }
  let previewHtml = '';
  if (ev.preview) {
    const p = ev.preview;
    previewHtml = `<div class="preview"><span>Summe: ${p.thrown}</span>${
      p.bust ? `<span class="bust">ÜBERWORFEN – bleibt ${p.remainingAfter}</span>`
        : p.checkout ? `<span class="win">CHECKOUT!</span>` : `<span>→ Rest ${p.remainingAfter}</span>`
    }</div>`;
  }

  // Sichtbar bleiben auch die Pfeile der soeben automatisch gebuchten Aufnahme.
  const lastTurn = [...st.log].reverse().find((entry) => entry.type === 'turn');
  const pending = session.pending.length > 0;
  const displayDarts = pending ? session.pending : (lastTurn?.darts || []);
  const calculation = describeTurn(displayDarts, pending ? ev.preview : lastTurn);
  const calcWho = pending ? active.name : (lastTurn ? st.byId[lastTurn.playerId]?.name || 'Spieler' : '');
  const calcTitle = pending ? `${calcWho} · laufende Aufnahme` : lastTurn ? `${calcWho} · letzte Aufnahme` : 'Wurfrechnung';
  const calcHeard = pending ? ui.pendingHeard : (ui.lastHeard?.eventId === lastTurn?.id ? ui.lastHeard.text : '');
  const calcHtml = displayDarts.length ? `
    <section class="calc-panel" aria-label="Erkannte Pfeile und Rechnung">
      <div class="calc-title">${esc(calcTitle)}</div>
      ${calcHeard ? `<div class="calc-heard">Gehört: „${esc(calcHeard)}“</div>` : ''}
      <div class="calc-darts">${calculation.darts.map((d, i) => `<div class="calc-dart ${d.ignored ? 'ignored' : ''}"><span>${i + 1}. ${esc(d.label)}</span><strong>${d.value}</strong></div>`).join('')}</div>
      <div class="calc-equation">${esc(calculation.calculation)} = <strong>${calculation.thrown}</strong></div>
      <div class="calc-booked">${calculation.bust ? '<strong class="bust">Bust – 0 Punkte gebucht</strong>' : calculation.checkout ? '<strong class="win">Checkout!</strong>' : pending ? 'Noch nicht gebucht' : `Gebucht: ${calculation.booked} Punkte`}</div>
    </section>` : '<section class="calc-panel calc-empty" aria-label="Wurfrechnung">Erkannte Zahlen und Rechnung erscheinen hier.</section>';
  let actions = '';
  if (ui.messageActions === 'confirm') {
    actions = `<div class="actions"><button class="btn primary" data-action="cand-yes">✔ Ja, stimmt</button><button class="btn" data-action="cand-no">✖ Nein</button></div>`;
  } else if (ui.messageActions === 'review') {
    actions = `<div class="actions"><button class="btn primary" data-action="commit">✔ Buchen</button><button class="btn" data-action="clear-pending">✖ Verwerfen</button></div>`;
  } else if (ui.messageActions === 'missing') {
    actions = `<div class="actions"><button class="btn" data-action="rest-miss">Rest daneben</button></div>`;
  }

  const micLabel = !speechIn.supported
    ? '<b>Spracheingabe nicht verfügbar</b><span class="small muted">Dieser Browser unterstützt keine Spracherkennung – nutze die Tasten.</span>'
    : settings.micMode === 'always'
      ? `<b>${ui.micState === 'always' ? '🎧 Hört dauerhaft zu' : '⏸ Dauer-Mikrofon pausiert'}</b><span class="small muted">${ui.micState === 'always' ? 'Gezählt werden nur Wurfansagen wie „17, 2, Triple 13“ – Gespräche werden ignoriert. Tippen = Pause.' : 'Tippen zum Einschalten.'}</span>`
      : settings.micMode === 'wake'
      ? `<b>Aktivierungswort „${esc(capital(settings.wakeWord))}“</b><span class="small muted">Tippen zum Ein-/Ausschalten. Dann z. B.: „${esc(capital(settings.wakeWord))}, 17, 2, Triple 13“</span>`
      : '<b>Tippen &amp; Würfe ansagen</b><span class="small muted">z. B. „17, 2, Triple 13“ oder „Doppel 20, 5, 12“</span>';

  $app.innerHTML = `
  <div class="game ${ui.flash}">
    <div class="col-main" style="display:grid;gap:14px">
      <div class="meta"><span>Runde ${st.round}</span><span>${cfg.startScore} · ${OUT_MODES[cfg.outMode]} · ${cfg.dartsPerTurn} Pfeile</span></div>
      <section class="hero" aria-label="Aktiver Spieler">
        <div class="label">🎯 Am Wurf</div>
        <div class="name">${esc(active.name)}</div>
        ${active.nickname ? `<div class="nick">„${esc(active.nickname)}“</div>` : ''}
        <div class="hero-row">
          <div class="score" aria-label="Restpunkte">${active.remaining}</div>
          <div class="hero-stats">Ø ${fmt(active.stats.average)}<br>Höchste ${active.stats.highestTurn}</div>
        </div>
        ${route ? `<div class="route">Checkout: ${esc(formatRoute(route))}</div>` : ''}
      </section>

      <section aria-label="Aktuelle Aufnahme">
        <div class="slots" style="--n:${Math.min(cfg.dartsPerTurn, 6)}">${slots.join('')}</div>
        ${previewHtml}
      </section>
      ${calcHtml}

      <div class="bubble ${ui.messageKind}" id="bubble">
        ${ui.message ? esc(ui.message) : '<span class="muted">Bereit. Sag die Pfeile an oder tippe sie ein.</span>'}
        ${ui.messageKind === 'ask' && ui.heardHtml ? ui.heardHtml : ''}
        <div class="interim" id="interim"></div>
        <div class="small muted" id="ignored" style="opacity:.7">${esc(ui.ignored || '')}</div>
        ${actions}
      </div>

      <div class="mic-wrap">
        <button class="mic" id="mic" data-action="mic" aria-label="Mikrofon" ${speechIn.supported ? '' : 'disabled'}>🎤</button>
        <div class="mic-text">${micLabel}</div>
      </div>
    </div>

    <div class="col-side" style="display:grid;gap:14px">
      <section class="keypad card" aria-label="Manuelle Eingabe" style="margin:0">
        <div class="mods">
          <button class="key mod" data-action="mult" data-v="1" aria-pressed="${ui.mult === 1}">Single</button>
          <button class="key mod d" data-action="mult" data-v="2" aria-pressed="${ui.mult === 2}">Doppel</button>
          <button class="key mod t" data-action="mult" data-v="3" aria-pressed="${ui.mult === 3}">Triple</button>
        </div>
        <div class="nums">
          ${Array.from({ length: 20 }, (_, i) => `<button class="key" data-action="num" data-v="${i + 1}">${ui.mult === 3 ? 'T' : ui.mult === 2 ? 'D' : ''}${i + 1}</button>`).join('')}
        </div>
        <div class="extra">
          <button class="key wide" data-action="bull" data-v="1" ${ui.mult === 3 ? 'disabled' : ''}>Bull 25</button>
          <button class="key wide" data-action="bull" data-v="2" ${ui.mult === 3 ? 'disabled' : ''}>Bullseye 50</button>
          <button class="key wide" data-action="miss">Daneben 0</button>
        </div>
        <div class="extra">
          <button class="key wide" data-action="backspace" ${session.pending.length ? '' : 'disabled'}>⌫ Pfeil</button>
          <button class="key wide" data-action="rest-miss">Rest daneben</button>
          <button class="key wide" data-action="undo">↶ Rückgängig</button>
        </div>
      </section>

      <section class="players" aria-label="Spielstand">
        ${effectiveOrder(cfg).map((id) => {
          const p = st.byId[id];
          const isActive = id === st.activePlayerId;
          const last = [...st.log].reverse().find((l) => l.type === 'turn' && l.playerId === id);
          return `<div class="pcard ${isActive ? 'active' : ''}">
            <div class="pname">${esc(p.name)}${isActive ? '<span class="badge">AM WURF</span>' : ''}${leaderIds.includes(id) && leaderIds.length === 1 ? '<span class="badge lead">FÜHRT</span>' : ''}</div>
            <div class="prem">${p.remaining}</div>
            <div class="pstats">Ø ${fmt(p.stats.average)} · Höchste ${p.stats.highestTurn} · Letzte: ${last ? (last.bust ? 'Bust' : last.points) : '–'}${p.nickname ? ` · „${esc(p.nickname)}“` : ''}</div>
          </div>`;
        }).join('')}
      </section>

      <div class="actionbar">
        <button class="btn" data-action="nav" data-screen="history">📜 Verlauf &amp; Korrektur</button>
        <button class="btn" data-action="set-next">👤 Wer ist dran?</button>
        <button class="btn" data-action="repeat">🔊 Wiederholen</button>
        <button class="btn danger" data-action="end-game">⏹ Spiel beenden</button>
      </div>
    </div>
  </div>`;
  ui.flash = '';
  updateMic();
  autoStartContinuous();
}

function renderWinner(st, cfg) {
  const w = st.byId[st.winnerId];
  $app.innerHTML = `
  <div class="game flash-win" style="grid-template-columns:1fr">
    <section class="winner-card hero" style="border-color:var(--gold)">
      <div class="trophy">🏆</div>
      <div class="wname">${esc(w.name)} gewinnt!</div>
      <p>Checkout ${w.stats.checkout} · ${st.round} Runden</p>
      ${ui.message ? `<p class="muted">${esc(ui.message)}</p>` : ''}
    </section>
    <section class="card">
      <h2>Auswertung</h2>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Spieler</th><th>Rest</th><th>Ø/Aufn.</th><th>3-Dart-Ø</th><th>Höchste</th><th>180</th><th>Busts</th></tr></thead>
        <tbody>${st.standings.order.map((id) => {
          const p = st.byId[id];
          return `<tr><td>${id === st.winnerId ? '🏆 ' : ''}${esc(p.name)}</td><td>${p.remaining}</td><td>${fmt(p.stats.average)}</td><td>${fmt(p.stats.threeDartAverage)}</td><td>${p.stats.highestTurn}</td><td>${p.stats.count180}</td><td>${p.stats.busts}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>
    <div class="actionbar">
      <button class="btn primary" data-action="rematch">🔁 Revanche</button>
      <button class="btn" data-action="new-game">➕ Neues Spiel</button>
      <button class="btn" data-action="nav" data-screen="history">📜 Verlauf / Korrektur</button>
      <button class="btn" data-action="undo">↶ Letzten Wurf zurück</button>
    </div>
  </div>`;
}

/** Dauer-Modus: Mikrofon automatisch einschalten (in der App sofort, im Browser nach dem ersten Antippen). */
function autoStartContinuous() {
  if (settings.micMode !== 'always' || !speechIn.supported || !session || screen !== 'game') return;
  if (session.state.finished || ui.micPausedByUser || speechIn.wantListening) return;
  if (!isNativeApp() && !ui.micEverStarted) return; // Browser verlangt das erste Einschalten per Antippen
  speechIn.start();
}

/** Bildschirm wach halten, solange dauerhaft zugehört wird. */
async function updateWakeLock() {
  const want = settings.micMode === 'always' && speechIn.wantListening && screen === 'game';
  try {
    if (want && !ui.wakeLock && navigator.wakeLock) {
      ui.wakeLock = await navigator.wakeLock.request('screen');
      ui.wakeLock.addEventListener?.('release', () => (ui.wakeLock = null));
    } else if (!want && ui.wakeLock) {
      await ui.wakeLock.release();
      ui.wakeLock = null;
    }
  } catch {
    ui.wakeLock = null; // nicht unterstützt – kein Problem
  }
}

function updateMic() {
  updateWakeLock();
  const mic = document.getElementById('mic');
  if (!mic) return;
  mic.classList.toggle('listening', ui.micState === 'listening' || ui.micState === 'always');
  mic.classList.toggle('always', ui.micState === 'always');
  mic.classList.toggle('wake', ui.micState === 'wake');
  mic.classList.toggle('armed', ui.micState === 'armed');
  mic.setAttribute('aria-pressed', ui.micState !== 'idle');
}

const fmt = (x) => (Math.round(x * 10) / 10).toLocaleString('de-DE');
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------ Verlauf & Korrektur
function renderHistory() {
  if (!session) {
    screen = 'home';
    return render();
  }
  const st = session.state;
  const cfg = session.game.config;
  const turns = st.log.filter((l) => l.type === 'turn' || l.type === 'setNext');
  let html = `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <h1>Spielverlauf</h1>
      <button class="btn sm" data-action="nav" data-screen="game">← Zurück zum Spiel</button>
    </div>
    <p class="muted small">Tippe auf eine Aufnahme, um Werte oder Spieler zu korrigieren. Der Spielstand wird danach komplett neu berechnet.</p>`;
  if (!turns.length) html += '<div class="card muted">Noch keine Würfe.</div>';
  let lastRound = 0;
  turns.forEach((l) => {
    if (l.type === 'setNext') {
      html += `<div class="turn"><div class="tmeta">Manuell: ${esc(st.byId[l.playerId].name)} ist als Nächstes dran</div></div>`;
      return;
    }
    if (l.round !== lastRound) {
      html += `<div class="round-h">Runde ${l.round}</div>`;
      lastRound = l.round;
    }
    const p = st.byId[l.playerId];
    html += `<button class="turn ${l.bust ? 'bust' : ''} ${l.checkout ? 'checkout' : ''}" style="width:100%;text-align:left;color:inherit" data-action="edit-turn" data-id="${l.id}">
      <div><b>${esc(p.name)}</b>${l.outOfTurn ? ' <span class="badge gold">außer der Reihe</span>' : ''}</div>
      <div class="tpts">${l.bust ? 'BUST' : l.points}</div>
      <div class="tdarts">${l.darts.map((d, i) => `<span style="${l.ignored.includes(i) ? 'opacity:.4;text-decoration:line-through' : ''}">${esc(dartLabel(d))}</span>`).join(' · ') || '–'}</div>
      <div class="tmeta">${l.remainingBefore} → ${l.remainingAfter}${l.checkout ? ' 🏆' : ''}</div>
    </button>`;
  });
  html += `<p class="small muted">${OUT_MODES[cfg.outMode]} · Start ${cfg.startScore}</p>`;
  $app.innerHTML = html;
}

async function editTurnDialog(eventId) {
  const st = session.state;
  const ev = session.game.events.find((e) => e.id === eventId);
  if (!ev) return;
  const cfg = session.game.config;
  const idx = session.game.events.indexOf(ev);
  const prevTurn = [...session.game.events.slice(0, idx)].reverse().find((e) => e.type === 'turn');
  const res = await modal(`
    <h2>Aufnahme korrigieren</h2>
    <label>Spieler
      <select class="input" name="player">${cfg.order.map((id) => `<option value="${id}" ${id === ev.playerId ? 'selected' : ''}>${esc(st.byId[id].name)}</option>`).join('')}</select>
    </label>
    <label>Pfeile (z. B. „T20 20 D10“, „25“ = Bull, „50“ = Bullseye, „0“ = daneben)
      <input class="input" name="darts" value="${esc(ev.darts.map(shorthand).join(' '))}" autocomplete="off" />
    </label>
    <div id="edit-preview" class="small muted"></div>
    <div class="modal-actions">
      <button class="btn danger" value="delete">🗑 Löschen</button>
      ${prevTurn ? `<button class="btn" value="swap">⇅ Spieler mit vorheriger Aufnahme tauschen</button>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn" value="cancel">Abbrechen</button>
      <button class="btn primary" value="save">Speichern</button>
    </div>`, {
    onOpen: (form) => {
      const inp = form.querySelector('[name=darts]');
      const upd = () => {
        const p = parseThrowInput(inp.value, { maxDarts: cfg.dartsPerTurn });
        const el = form.querySelector('#edit-preview');
        if (p.kind !== 'darts' || p.issues.length) el.textContent = p.issues[0]?.message || 'Nicht erkannt.';
        else el.textContent = `Erkannt: ${p.darts.map(dartLabel).join(', ')} = ${p.darts.reduce((a, d) => a + dartValue(d), 0)} Punkte`;
      };
      inp.addEventListener('input', upd);
      upd();
    },
  });
  if (res === 'cancel' || !res) return;
  if (res === 'delete') {
    if (await confirmDialog('Aufnahme löschen?', 'Der Spielstand wird ohne diese Aufnahme neu berechnet.', { ok: 'Löschen', danger: true })) {
      session.deleteTurn(eventId);
      persist();
      toast('Aufnahme gelöscht – Stand neu berechnet.');
    }
    return render();
  }
  if (res === 'swap') {
    let r = session.swapPlayers(prevTurn.id, eventId);
    if (!r.applied && r.orphaned.length) {
      if (await confirmDialog('Spiel wäre früher beendet', `Durch den Tausch hätte jemand schon früher gewonnen. ${r.orphaned.length} spätere Einträge würden verfallen.`, { ok: 'Trotzdem tauschen', danger: true })) {
        r = session.swapPlayers(prevTurn.id, eventId, { force: true });
      }
    }
    if (r.applied) {
      persist();
      toast('Spieler getauscht – Stand neu berechnet.');
      speak([session.correctionQuip(eventId)], 2);
    }
    return render();
  }
  // speichern
  const form = $modalForm;
  const text = form.querySelector('[name=darts]')?.value ?? '';
  const playerId = form.querySelector('[name=player]')?.value;
  const parsed = parseThrowInput(text, { maxDarts: cfg.dartsPerTurn });
  if (parsed.kind !== 'darts' || parsed.issues.length || !parsed.darts.length) {
    toast(parsed.issues[0]?.message || 'Pfeile nicht erkannt – nichts geändert.', 4000);
    return;
  }
  let r;
  try {
    r = session.correctTurn(eventId, { darts: parsed.darts, playerId });
    if (!r.applied && r.orphaned.length) {
      if (await confirmDialog('Spiel wäre früher beendet', `Mit dieser Korrektur hätte jemand schon früher gewonnen. ${r.orphaned.length} spätere Einträge würden verfallen.`, { ok: 'Trotzdem übernehmen', danger: true })) {
        r = session.correctTurn(eventId, { darts: parsed.darts, playerId }, { force: true });
      }
    }
  } catch (e) {
    toast(e.message, 4000);
    return;
  }
  if (r.applied) {
    persist();
    toast('Korrigiert – Spielstand komplett neu berechnet.');
    speak([session.correctionQuip(eventId)], 2);
  }
  render();
}

// ------------------------------------------------------------ Statistik
function renderStats() {
  const history = store.loadHistory();
  const rows = aggregateStats(history);
  let body = '';
  if (statsTab === 'ranking') {
    body = rows.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Spieler</th><th>Siege</th><th>Spiele</th><th>Quote</th><th>Ø/Aufn.</th><th>Höchste</th><th>Bester Checkout</th><th>180</th></tr></thead>
          <tbody>${rows.map((r, i) => `<tr><td>${i === 0 ? '👑 ' : ''}${esc(r.name)}</td><td>${r.wins}</td><td>${r.games}</td><td>${r.winRate}%</td><td>${fmt(r.average)}</td><td>${r.bestTurn}</td><td>${r.bestCheckout || '–'}</td><td>${r.count180}</td></tr>`).join('')}</tbody>
        </table></div>`
      : '<p class="muted">Noch keine beendeten Spiele.</p>';
  } else if (statsTab === 'games') {
    body = history.length
      ? history.map((g) => {
          const st = computeState(g);
          const w = st.byId[st.winnerId];
          const d = new Date(g.createdAt);
          return `<div class="turn">
            <div><b>🏆 ${esc(w?.name || '?')}</b> <span class="muted small">${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div><button class="btn sm ghost" data-action="del-game" data-id="${g.id}" aria-label="Spiel löschen">🗑</button></div>
            <div class="tmeta" style="grid-column:1/-1">${g.config.startScore} · ${OUT_MODES[g.config.outMode]} · ${st.standings.order.map((id) => `${esc(st.byId[id].name)} (${st.byId[id].remaining}, Ø ${fmt(st.byId[id].stats.average)})`).join(' · ')}</div>
          </div>`;
        }).join('')
      : '<p class="muted">Noch keine Spiele gespeichert.</p>';
  } else {
    body = profiles.length
      ? profiles.map((p, i) => `<div class="player-input" style="grid-template-columns:1fr 1fr auto">
          <b>${esc(p.name)}</b>
          <input class="input" data-field="profile-nick" data-i="${i}" value="${esc(p.nickname)}" placeholder="Spitzname" maxlength="24" />
          <button class="btn sm ghost" data-action="del-profile" data-i="${i}" aria-label="Profil löschen">🗑</button>
        </div>`).join('')
      : '<p class="muted">Profile entstehen automatisch beim ersten Spiel.</p>';
  }
  $app.innerHTML = `
    <h1>Statistik</h1>
    <div class="tabs">
      <button class="chip" data-action="tab" data-v="ranking" aria-pressed="${statsTab === 'ranking'}">Siegerliste & Rekorde</button>
      <button class="chip" data-action="tab" data-v="games" aria-pressed="${statsTab === 'games'}">Alle Spiele</button>
      <button class="chip" data-action="tab" data-v="profiles" aria-pressed="${statsTab === 'profiles'}">Spielerprofile</button>
    </div>
    <section class="card">${body}</section>
    ${statsTab === 'games' && history.length ? '<button class="btn danger sm" data-action="clear-history">Gesamte Historie löschen</button>' : ''}
    <p><button class="btn" data-action="nav" data-screen="${session && !session.state.finished ? 'game' : 'home'}">← Zurück</button></p>`;
}

// ------------------------------------------------------------ Einstellungen
function renderSettings() {
  const voices = speechOut.germanVoices();
  $app.innerHTML = `
    <h1>Einstellungen</h1>
    <section class="card">
      <div class="setting-block"><span class="lbl">Humor-Stufe</span>
        <div class="chips">${HUMOR_LEVELS.map((h) => `<button class="chip" data-action="humor" data-v="${h}" aria-pressed="${settings.humor === h}">${{ freundlich: '😊', frech: '😏', gnadenlos: '😈' }[h]} ${esc(HUMOR_LABELS[h])}</button>`).join('')}</div>
        ${settings.humor === 'gnadenlos' ? '<p class="small muted" style="margin:8px 0 0">FSK 16: derbe Sprüche, Sarkasmus und gelegentlich Schimpfwörter – für den Dartabend unter Kumpels.</p>' : ''}
      </div>
      <div class="setting-block">
        <label class="switch"><span><b>Sprachausgabe</b><br><span class="small muted">Sprüche und Spielstand laut ansagen</span></span><input type="checkbox" data-field="speechOn" ${settings.speechOn ? 'checked' : ''} /></label>
      </div>
      <div class="setting-block"><label for="vol">Lautstärke: <span id="vol-out">${Math.round(settings.volume * 100)}%</span></label>
        <input id="vol" class="range" type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-field="volume" />
      </div>
      <div class="setting-block"><span class="lbl">Kommentator-Stil</span>
        <div class="chips">${Object.entries(VOICE_STYLES).map(([k, v]) => `<button class="chip" data-action="vstyle" data-v="${k}" aria-pressed="${settings.voiceStyle === k}">${v.label}</button>`).join('')}</div>
      </div>
      <div class="setting-block"><label for="voice">Stimme</label>
        <select id="voice" class="input" data-field="voiceURI">
          <option value="">Automatisch (Deutsch)</option>
          ${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === settings.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
        </select>
        ${speechOut.supported ? (voices.length ? '' : '<p class="small muted">Keine deutsche Stimme gefunden – das Gerät nutzt die Standardstimme.</p>') : '<p class="small muted">Sprachausgabe wird von diesem Browser nicht unterstützt.</p>'}
      </div>
      <button class="btn" data-action="test-voice">🔊 Stimme testen</button>
    </section>
    <section class="card">
      <div class="setting-block"><span class="lbl">Spracheingabe</span>
        <div class="chips">
          <button class="chip" data-action="micmode" data-v="button" aria-pressed="${settings.micMode === 'button'}">🎤 Mikrofonknopf</button>
          <button class="chip" data-action="micmode" data-v="always" aria-pressed="${settings.micMode === 'always'}">🎧 Dauerhaft zuhören</button>
          <button class="chip" data-action="micmode" data-v="wake" aria-pressed="${settings.micMode === 'wake'}">🗣 Aktivierungswort</button>
        </div>
        <p class="small muted"><b>Dauerhaft zuhören:</b> Das Mikrofon bleibt während des Spiels an. Gezählt werden nur reine Wurfansagen („17, 2, Triple 13“, „Doppel 20, 5, 12“, „Bullseye“) – jedes Gesprächsstück wird stumm ignoriert. Eine einzelne nackte Zahl („acht“) zählt nur, wenn sie eine angefangene Ansage vervollständigt; Angefangenes verfällt nach 15 Sekunden. Der Bildschirm bleibt dabei an.<br>Knopf: tippen, Würfe ansagen, fertig. Aktivierungswort: die App hört dauerhaft mit, zählt aber nur Sätze, die mit „${esc(capital(settings.wakeWord))}“ beginnen. Beim eigenen Sprechen hört die App nicht zu.</p>
      </div>
      <div class="setting-block"><label for="ww">Aktivierungswort</label>
        <input id="ww" class="input" data-field="wakeWord" value="${esc(settings.wakeWord)}" maxlength="20" />
      </div>
      <label class="switch"><span><b>Vor dem Buchen bestätigen</b><br><span class="small muted">Jede vollständige Aufnahme erst nach Tippen auf „Buchen“ übernehmen</span></span><input type="checkbox" data-field="confirmBeforeCommit" ${settings.confirmBeforeCommit ? 'checked' : ''} /></label>
      <label class="switch"><span><b>Männerrunde</b><br><span class="small muted">Erlaubt Sprüche wie „Der Mann kann tatsächlich Dart spielen!“ (standardmäßig an)</span></span><input type="checkbox" data-field="maleWordingOk" ${settings.maleWordingOk ? 'checked' : ''} /></label>
      <label class="switch"><span><b>Checkout-Wege anzeigen</b></span><input type="checkbox" data-field="showCheckout" ${settings.showCheckout ? 'checked' : ''} /></label>
      ${speechIn.supported ? '' : '<p class="notice">Dieser Browser bietet keine Spracherkennung. Am besten funktioniert Chrome (Android/Desktop) oder Safari (iOS). Die manuelle Eingabe geht immer – auch offline.</p>'}
    </section>
    <section class="card">
      <h2>Sprüche</h2>
      <p class="small muted">Eigene Sprüche hinzufügen, eingebaute ausblenden, alles sichern und mit den Kumpels teilen.</p>
      <button class="btn" data-action="nav" data-screen="jokes">💬 Sprüche-Bibliothek öffnen</button>
    </section>
    <section class="card">
      <h2>Daten</h2>
      <p class="small muted">Alles wird nur lokal auf diesem Gerät gespeichert. Punkteberechnung und manuelle Eingabe funktionieren auch offline.</p>
      <button class="btn danger" data-action="clear-all">Alle Daten löschen</button>
    </section>
    <p><button class="btn" data-action="nav" data-screen="${session && !session.state.finished ? 'game' : 'home'}">← Zurück</button></p>`;
}

// ------------------------------------------------------------ Start
function renderHome() {
  const running = session && !session.state.finished;
  $app.innerHTML = `
    <section class="home-hero">
      <div class="logo">🎯</div>
      <h1>DART<b>BUDDY</b></h1>
      <p class="muted">Rechnet wie ein Profi. Hört zu wie ein Schiedsrichter. Klopft Sprüche wie der frechste Kumpel am Dartabend.</p>
    </section>
    ${running ? `<button class="btn primary big" data-action="nav" data-screen="game">▶ Spiel fortsetzen</button><p></p>` : ''}
    <button class="btn ${running ? '' : 'primary'} big" data-action="new-game">➕ Neues Spiel</button>
    <p></p>
    <div class="actionbar" style="grid-template-columns:1fr 1fr">
      <button class="btn" data-action="nav" data-screen="stats">📊 Statistik</button>
      <button class="btn" data-action="nav" data-screen="jokes">💬 Sprüche</button>
      <button class="btn" data-action="nav" data-screen="settings" style="grid-column:1/-1">⚙️ Einstellungen</button>
    </div>
    ${!speechIn.supported ? '<p class="notice" style="margin-top:14px">Hinweis: Dieser Browser hat keine Spracherkennung. Du kannst trotzdem alles per Tasten eingeben.</p>' : ''}`;
}

function render() {
  if (screen === 'setup' && setup) renderSetup();
  else if (screen === 'game' && session) renderGame();
  else if (screen === 'history') renderHistory();
  else if (screen === 'stats') renderStats();
  else if (screen === 'settings') renderSettings();
  else if (screen === 'jokes') jokesScreen.render($app);
  else {
    screen = 'home';
    renderHome();
  }
  if (screen !== 'game' && settings.micMode !== 'button') speechIn.stop();
}

// ------------------------------------------------------------ Ereignisse
async function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  if (btn.closest('dialog')) return;
  const a = btn.dataset.action;
  const v = btn.dataset.v;
  if (screen === 'jokes' && (await jokesScreen.onClick(a, btn))) return;

  switch (a) {
    case 'nav':
      if (btn.dataset.screen === 'back') screen = session && !session.state.finished ? 'game' : 'home';
      else if (btn.dataset.screen === 'home' && session && !session.state.finished) screen = 'game';
      else screen = btn.dataset.screen;
      if (screen === 'game' && !session) screen = 'home';
      return render();

    // ----- Setup
    case 'new-game': {
      if (session && !session.state.finished) {
        const ok = await confirmDialog('Laufendes Spiel abbrechen?', 'Der aktuelle Spielstand geht verloren.', { ok: 'Ja, neues Spiel', danger: true });
        if (!ok) return;
      }
      setup = newSetup(session?.game);
      if (session) setup.startingPlayerId = null; // bei neuem Spiel neu festlegen
      screen = 'setup';
      return render();
    }
    case 'rematch':
      setup = newSetup(session.game);
      screen = 'setup';
      render();
      toast('Revanche! Bitte Reihenfolge und Startspieler bestätigen.');
      return;
    case 'count':
      setCount(setup.count + Number(btn.dataset.d));
      return renderSetup();
    case 'score':
      setup.startScore = Number(v);
      setup.customScore = '';
      return renderSetup();
    case 'darts':
      setup.dartsPerTurn = Number(v);
      return renderSetup();
    case 'out':
      setup.outMode = v;
      return renderSetup();
    case 'move': {
      const i = Number(btn.dataset.i);
      const j = i + Number(btn.dataset.d);
      [setup.order[i], setup.order[j]] = [setup.order[j], setup.order[i]];
      setup.confirmed = false;
      return refreshSetupDerived();
    }
    case 'shuffle':
      for (let i = setup.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [setup.order[i], setup.order[j]] = [setup.order[j], setup.order[i]];
      }
      setup.confirmed = false;
      return refreshSetupDerived();
    case 'starter':
      setup.startingPlayerId = btn.dataset.id;
      setup.confirmed = false;
      return refreshSetupDerived();
    case 'starter-random':
      setup.startingPlayerId = setup.order[Math.floor(Math.random() * setup.order.length)];
      setup.confirmed = false;
      refreshSetupDerived();
      toast(`${nameOf(setup.startingPlayerId)} beginnt!`);
      return;
    case 'start':
      return startGameFromSetup();

    // ----- Spiel
    case 'mic':
      if (!speechIn.supported) return toast('Spracherkennung nicht verfügbar.');
      speechOut.stop();
      ui.micEverStarted = true;
      if (settings.micMode === 'always') {
        ui.micPausedByUser = speechIn.wantListening; // Antippen = Pause bzw. wieder einschalten
        if (speechIn.wantListening) speechIn.stop();
        else speechIn.start();
        return render();
      }
      speechIn.toggle();
      return;
    case 'mult':
      ui.mult = ui.mult === Number(v) && Number(v) !== 1 ? 1 : Number(v);
      return render();
    case 'num':
      return manualDart(ui.mult, Number(v));
    case 'bull':
      return manualDart(Number(v), 25);
    case 'miss':
      return manualDart(0, 0);
    case 'backspace':
      session.removePendingDart();
      ui.messageActions = null;
      return render();
    case 'clear-pending':
      session.clearPending();
      ui.message = 'Verworfen – bitte neu eingeben.';
      ui.messageKind = 'warn';
      ui.messageActions = null;
      return render();
    case 'rest-miss': {
      const n = session.pending.length;
      const missing = session.game.config.dartsPerTurn - n;
      const ev = session.evaluation();
      if (ev.status === 'complete') return handleOutcome(session.commit());
      const ok = await confirmDialog(
        n ? `Restliche ${missing} Pfeil${missing > 1 ? 'e' : ''} als daneben werten?` : 'Alle Pfeile daneben?',
        `${session.activePlayer.name} – ${n ? session.pending.map(dartLabel).join(', ') + ', ' : ''}Rest 0 Punkte. Jetzt buchen?`,
        { ok: 'Buchen' },
      );
      if (!ok) return;
      return handleOutcome(session.finishWithMisses());
    }
    case 'commit':
      return handleOutcome(session.commit());
    case 'cand-yes':
      return handleOutcome(session.confirmCandidate(true), { fromVoice: true });
    case 'cand-no':
      return handleOutcome(session.confirmCandidate(false), { fromVoice: true });
    case 'undo': {
      if (session.pending.length) {
        return handleOutcome(session.undo());
      }
      const st = session.state;
      const last = [...st.log].reverse().find((l) => l.type === 'turn' || l.type === 'setNext');
      if (!last) return toast('Es gibt nichts rückgängig zu machen.');
      const txt = last.type === 'turn'
        ? `${st.byId[last.playerId].name}: ${last.darts.map(dartLabel).join(', ')} (${last.bust ? 'Bust' : last.points + ' Punkte'})`
        : 'Manueller Spielerwechsel';
      const ok = await confirmDialog('Letzte Aufnahme löschen?', txt, { ok: 'Rückgängig', danger: true });
      if (!ok) return;
      const r = session.undo();
      if (!session.state.finished) screen = 'game';
      return handleOutcome(r);
    }
    case 'repeat':
      if (ui.message) speak([ui.message], 1);
      return;
    case 'set-next': {
      const st = session.state;
      const res = await modal(`
        <h2>Wer ist jetzt dran?</h2>
        <p class="small muted">Nur nutzen, wenn wirklich jemand außer der Reihe wirft. Die App wählt sonst automatisch: Wer die wenigsten Aufnahmen hat, ist dran.</p>
        ${effectiveOrder(session.game.config).map((id) => `<button class="btn ${id === st.activePlayerId ? 'primary' : ''}" value="${id}">${esc(st.byId[id].name)} (${st.byId[id].remaining})</button>`).join('')}
        <div class="modal-actions"><button class="btn" value="cancel">Abbrechen</button></div>`);
      if (!res || res === 'cancel' || res === st.activePlayerId) return;
      session.setNext(res);
      persist();
      ui.message = `${st.byId[res].name}, du bist dran!`;
      ui.messageKind = 'announce';
      render();
      speak([ui.message]);
      return;
    }
    case 'end-game': {
      const ok = await confirmDialog('Spiel wirklich beenden?', 'Der Spielstand wird verworfen und nicht in der Statistik gezählt.', { ok: 'Beenden', danger: true });
      if (!ok) return;
      store.clearCurrentGame();
      speechIn.stop();
      speechOut.stop();
      const prev = session.game;
      session = null;
      setup = newSetup(prev);
      setup.startingPlayerId = null;
      screen = 'home';
      return render();
    }
    case 'edit-turn':
      return editTurnDialog(btn.dataset.id);

    // ----- Statistik
    case 'tab':
      statsTab = v;
      return render();
    case 'del-game':
      if (await confirmDialog('Spiel aus der Historie löschen?', '', { ok: 'Löschen', danger: true })) {
        store.deleteHistoryGame(btn.dataset.id);
        render();
      }
      return;
    case 'clear-history':
      if (await confirmDialog('Gesamte Historie löschen?', 'Alle Statistiken gehen verloren.', { ok: 'Alles löschen', danger: true })) {
        store.clearHistory();
        render();
      }
      return;
    case 'del-profile': {
      const i = Number(btn.dataset.i);
      if (await confirmDialog(`Profil „${profiles[i].name}“ löschen?`, 'Bereits gespielte Spiele bleiben in der Historie.', { ok: 'Löschen', danger: true })) {
        profiles.splice(i, 1);
        store.saveProfiles(profiles);
        render();
      }
      return;
    }

    // ----- Einstellungen
    case 'humor':
      settings.humor = v;
      saveSettings();
      render();
      speak([{ freundlich: 'Freundlich. Ich bin ganz lieb, versprochen.', frech: 'Frech. Ab jetzt wird gestichelt!', gnadenlos: 'Gnadenlos. Taschentücher bereitlegen!' }[v]], 2);
      return;
    case 'vstyle':
      settings.voiceStyle = v;
      saveSettings();
      render();
      speak(['So klinge ich jetzt. Hundertachtzig!'], 3);
      return;
    case 'micmode':
      settings.micMode = v;
      saveSettings();
      return render();
    case 'test-voice':
      speak(['Hundert Punkte, Wowa!', 'Alter, wer hat dir denn heimlich Zielwasser gegeben?', 'Noch 87!'], 3);
      return;
    case 'clear-all':
      if (await confirmDialog('Wirklich ALLE Daten löschen?', 'Laufendes Spiel, Historie, Profile, eigene Sprüche und Einstellungen werden gelöscht.', { ok: 'Alles löschen', danger: true })) {
        store.clearAll();
        settings = store.loadSettings();
        profiles = [];
        session = null;
        jokesScreen.reset();
        applySettings();
        screen = 'home';
        render();
      }
      return;
    default:
  }
}

function manualDart(mult, value) {
  if (!session) return;
  const d = mult === 0 ? { mult: 0, value: 0 } : { mult, value };
  if (!isValidDart(d)) return toast('Dieses Feld gibt es nicht.');
  ui.mult = 1;
  const r = session.addDart(d);
  if (r.action === 'wait') {
    ui.message = r.message;
    ui.messageKind = 'ask';
    ui.messageActions = null;
    ui.heardHtml = '';
    return render();
  }
  handleOutcome(r);
}

function onInput(e) {
  const el = e.target;
  const f = el.dataset.field;
  if (!f) return;
  if (screen === 'jokes' && jokesScreen.onInput(el)) return;
  if (screen === 'setup' && setup) {
    if (f === 'name' || f === 'nickname') {
      const p = setup.players[Number(el.dataset.i)];
      p[f] = el.value;
      if (f === 'name') {
        setup.confirmed = false;
        const prof = profiles.find((x) => x.name.toLowerCase() === el.value.trim().toLowerCase());
        if (prof && !p.nickname && prof.nickname) {
          p.nickname = prof.nickname;
          const nick = document.querySelector(`[data-field=nickname][data-i="${el.dataset.i}"]`);
          if (nick) nick.value = prof.nickname;
        }
      }
      return refreshSetupDerived();
    }
    if (f === 'custom') {
      setup.customScore = el.value.replace(/\D/g, '');
      const n = parseInt(setup.customScore, 10);
      if (n) setup.startScore = n;
      else setup.startScore = 301;
      document.querySelectorAll('[data-action=score]').forEach((b) => b.setAttribute('aria-pressed', String(!setup.customScore && Number(b.dataset.v) === setup.startScore)));
      return refreshSetupDerived();
    }
    if (f === 'confirmed') {
      setup.confirmed = el.checked;
      return refreshSetupDerived();
    }
  }
  if (screen === 'settings') {
    if (f === 'volume') {
      settings.volume = Number(el.value);
      document.getElementById('vol-out').textContent = `${Math.round(settings.volume * 100)}%`;
    } else if (f === 'speechOn' || f === 'confirmBeforeCommit' || f === 'showCheckout' || f === 'maleWordingOk') settings[f] = el.checked;
    else if (f === 'voiceURI') settings.voiceURI = el.value;
    else if (f === 'wakeWord') settings.wakeWord = el.value.trim().toLowerCase() || 'buddy';
    saveSettings();
  }
  if (screen === 'stats' && f === 'profile-nick') {
    profiles[Number(el.dataset.i)].nickname = el.value.trim();
    store.saveProfiles(profiles);
  }
}

document.addEventListener('click', onClick);
document.addEventListener('input', (e) => {
  if (e.target.type !== 'file') onInput(e);
});
document.addEventListener('change', (e) => {
  if (e.target.type === 'checkbox' || e.target.type === 'file') onInput(e);
});

// Tastatur-Kurzbefehle für Tablet/Desktop
document.addEventListener('keydown', (e) => {
  if (screen !== 'game' || !session || $modal.open) return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === ' ' && speechIn.supported) {
    e.preventDefault();
    speechIn.toggle();
  } else if (e.key === 'Backspace') {
    session.removePendingDart();
    render();
  }
});

// ------------------------------------------------------------ Initialisierung
function init() {
  applySettings();
  const saved = store.loadCurrentGame();
  if (saved) {
    try {
      computeState(saved);
      session = new GameSession(saved, { commentator, confirmBeforeCommit: settings.confirmBeforeCommit });
      commentator.importMemory(store.loadCommentMemory());
      const st = session.state;
      if (!st.finished) {
        screen = 'game';
        ui.message = `Weiter geht's! ${st.byId[st.activePlayerId].name} ist dran.`;
        ui.messageKind = 'announce';
      }
    } catch {
      store.clearCurrentGame();
    }
  }
  if (!setup) setup = newSetup(null);
  render();
  loadCommentLibrary();
  if (speechOut.voicesLoaded) speechOut.voicesLoaded.then(() => screen === 'settings' && render());
  else if (speechOut.supported) window.speechSynthesis.onvoiceschanged = () => screen === 'settings' && render();

  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isNativeApp) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Dauer-Modus: angefangene, nicht fortgesetzte Ansagen verfallen lassen
setInterval(() => {
  if (screen === 'game' && session && session.expireFragment()) {
    ui.message = 'Unvollständige Ansage verworfen – nichts gezählt.';
    ui.messageKind = 'warn';
    ui.messageActions = null;
    render();
  }
}, 1000);

// Nach Rückkehr in die App: Bildschirmsperre neu anfordern, Mikrofon ggf. wieder starten
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    ui.wakeLock = null;
    updateWakeLock();
    autoStartContinuous();
  }
});

/** Lädt die maßgebliche Kommentarbibliothek (offline aus dem App-Paket bzw. Service-Worker-Cache). */
async function loadCommentLibrary() {
  try {
    const res = await fetch('data/comments.de.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    jokesScreen.setCommentData(data);
  } catch (e) {
    console.warn('Kommentarbibliothek nicht geladen:', e);
    jokesScreen.setCommentData(null, String(e.message || e));
  }
  if (screen === 'jokes') render();
}

init();

// für Tests / Debugging
window.dartBuddy = { get session() { return session; }, store };
