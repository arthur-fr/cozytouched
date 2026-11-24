// État de l'app et logique « ViewModel » (port de data/CozyViewModel.kt, partie Magellan).
// Écritures optimistes : l'écran montre tout de suite le résultat attendu, la valeur est maintenue
// jusqu'à confirmation par une lecture lancée APRÈS l'exécution, et annulée avec un message si
// l'appareil refuse la commande.

import * as api from './api.js';
import { seal, unseal, forget } from './secret.js';
import { demoSetup } from './demo.js';
import {
  Caps, MgWrites, OFF, buildDhws, buildRooms, cap, displayName, gatewayLabel, service,
} from './model.js';

// ---------------------------------------------------------------------------------------------
// Rendu : les écrans s'abonnent, le store prévient à chaque changement.
// ---------------------------------------------------------------------------------------------

const listeners = new Set();
export const subscribe = f => listeners.add(f);
export function invalidate() { for (const f of listeners) f(); }

// ---------------------------------------------------------------------------------------------
// Stockage local
// ---------------------------------------------------------------------------------------------

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
  json(k, d) { try { const v = JSON.parse(LS.get(k)); return v ?? d; } catch { return d; } },
};
const DEROG_CHOICES = [1, 2, 4, 8, 12, 24];
const store = {
  get email() { return LS.get('cz.email'); }, set email(v) { LS.set('cz.email', v); },
  get token() { return LS.json('cz.token', null); }, set token(t) { LS.set('cz.token', t ? JSON.stringify(t) : null); },
  get sealed() { return LS.get('cz.pwd'); }, set sealed(v) { LS.set('cz.pwd', v); },
  get roomOrder() { const v = LS.json('cz.order', []); return Array.isArray(v) ? v : []; },
  set roomOrder(v) { LS.set('cz.order', JSON.stringify(v)); },
  get derogationHours() { const n = parseInt(LS.get('cz.derog'), 10); return DEROG_CHOICES.includes(n) ? n : 2; },
  set derogationHours(h) { LS.set('cz.derog', String(h)); },
  get hasSession() { return !!(this.token || this.sealed); },
  clear() { this.token = null; this.sealed = null; forget(); },
};

// ---------------------------------------------------------------------------------------------
// État affiché
// ---------------------------------------------------------------------------------------------

const emptyHome = () => ({ magellan: [], rooms: [], dhws: [], gateways: [] });

export const S = {
  phase: 'starting', // starting | loggedOut | loading | ready
  demo: false,
  email: store.email,
  loggingIn: false,
  loginError: null,
  message: null,
  refreshing: false,
  lastUpdate: 0,
  derogationHours: store.derogationHours,
  failures: {}, // deviceId → message
  pending: new Set(), // deviceId avec une commande en cours
  home: emptyHome(),
  connected: false,
};

let token = store.token;
let magellanEnabled = false;
let mgSetups = [];

/** Numéro de la dernière lecture lancée, et de celle actuellement affichée. */
let fetchStarted = 0;
let fetchApplied = 0;
/** Lecture la plus récente appliquée à chaque appareil par le rafraîchissement rapide. */
const deviceGen = new Map();
const appliedGen = id => Math.max(fetchApplied, deviceGen.get(id) || 0);
let lastFetchAt = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------------------------

let authChain = Promise.resolve();
function locked(fn) {
  const p = authChain.then(fn, fn);
  authChain = p.catch(() => {});
  return p;
}

async function storedPassword() {
  const s = store.sealed;
  if (!s) return null;
  try { return await unseal(s); } catch { return null; }
}

function validToken(force = false) {
  return locked(async () => {
    const cur = token;
    if (!force && cur && !api.tokenExpired(cur)) return cur.access_token;
    let t = null;
    if (cur?.refresh_token) {
      try { t = await api.refresh(cur.refresh_token); } catch { t = null; }
      if (t && !t.refresh_token) t.refresh_token = cur.refresh_token;
    }
    if (!t) {
      const email = store.email;
      const pwd = await storedPassword();
      if (!email || !pwd) {
        if (cur && !force) return cur.access_token;
        throw new api.BadCredentials('Session expirée, reconnectez-vous');
      }
      t = await api.login(email, pwd);
    }
    token = t;
    store.token = t;
    return t.access_token;
  });
}

async function magellan(fn) {
  try {
    return await fn(await validToken());
  } catch (e) {
    if (e instanceof api.Unauthorized) return fn(await validToken(true));
    throw e;
  }
}

export async function init() {
  document.addEventListener('visibilitychange', onVisibility);
  if (store.hasSession) {
    S.phase = 'loading';
    invalidate();
    try {
      await connectAndLoad();
    } catch (e) {
      if (e instanceof api.BadCredentials) {
        store.clear(); token = null;
        S.phase = 'loggedOut'; S.loginError = e.message;
      } else {
        // Pas de réseau, serveur indisponible… on reste sur l'écran principal avec un message.
        S.phase = 'ready'; S.message = humanize(e);
      }
      invalidate();
    }
  } else {
    S.phase = 'loggedOut';
    invalidate();
  }
}

export async function login(email, password) {
  if (!email.trim() || !password) {
    S.loginError = 'Renseignez votre e-mail et votre mot de passe';
    invalidate();
    return;
  }
  S.loggingIn = true; S.loginError = null;
  invalidate();
  try {
    const t = await api.login(email, password);
    token = t;
    store.email = email.trim();
    store.token = t;
    try { store.sealed = await seal(password); } catch { store.sealed = null; }
    S.email = email.trim(); S.phase = 'loading'; S.demo = false;
    invalidate();
    await connectAndLoad();
  } catch (e) {
    S.phase = 'loggedOut'; S.loginError = humanize(e);
  } finally {
    S.loggingIn = false;
    invalidate();
  }
}

export function startDemo() {
  stopPolling();
  mgSetups = [demoSetup()];
  magellanEnabled = false;
  Object.assign(S, { phase: 'ready', demo: true, loginError: null, failures: {}, message: null });
  publish();
}

export function logout() {
  stopPolling();
  token = null; magellanEnabled = false; mgSetups = [];
  overrides.clear(); failed.clear(); deviceGen.clear(); lastService.clear();
  store.clear();
  Object.assign(S, {
    phase: 'loggedOut', demo: false, email: store.email, loggingIn: false, loginError: null, message: null,
    refreshing: false, lastUpdate: 0, failures: {}, pending: new Set(), home: emptyHome(), connected: false,
  });
  invalidate();
}

// ---------------------------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------------------------

/** Relit la configuration ; une réponse plus ancienne que celle déjà affichée est ignorée. */
async function loadMagellan() {
  const gen = ++fetchStarted;
  const setups = await magellan(t => api.setups(t));
  lastFetchAt = Date.now();
  if (gen > fetchApplied) {
    fetchApplied = gen;
    const current = new Map(mgSetups.flatMap(s => s.devices).map(d => [d.deviceId, d]));
    mgSetups = setups.map(st => ({
      ...st,
      devices: st.devices.map(d => ((deviceGen.get(d.deviceId) || 0) > gen ? current.get(d.deviceId) || d : d)),
    }));
  }
}

/** Rafraîchissement rapide des pièces (comme l'app officielle, qui relit chaque appareil affiché). */
async function pollRoomCapabilities() {
  const ids = S.home.rooms.map(r => r.id);
  if (!ids.length) return;
  const results = await Promise.all(ids.map(async id => {
    const gen = ++fetchStarted;
    try { return [id, gen, await magellan(t => api.capabilities(t, id))]; } catch { return [id, gen, null]; }
  }));
  lastFetchAt = Date.now();
  let changed = false;
  for (const [id, gen, caps] of results) {
    if (!caps || !caps.length || gen <= appliedGen(id)) continue;
    deviceGen.set(id, gen);
    const byId = new Map(caps.map(c => [c.capabilityId, c]));
    mgSetups = mgSetups.map(st => ({
      ...st,
      devices: st.devices.map(d => {
        if (d.deviceId !== id) return d;
        const known = new Set(d.capabilities.map(c => c.capabilityId));
        return { ...d, capabilities: [...d.capabilities.map(c => byId.get(c.capabilityId) || c), ...caps.filter(n => !known.has(n.capabilityId))] };
      }),
    }));
    changed = true;
  }
  if (changed) publish();
}

async function connectAndLoad() {
  await validToken();
  try {
    await loadMagellan();
    magellanEnabled = true;
  } catch (e) {
    if (e instanceof api.Unauthorized || (e instanceof api.HttpError && e.status === 401)) {
      throw new api.BadCredentials('Session expirée, reconnectez-vous');
    }
    throw e;
  }
  S.phase = 'ready'; S.connected = true;
  publish();
  startPolling();
}

export async function refresh() {
  if (S.demo) {
    S.refreshing = true; invalidate();
    await sleep(600);
    S.refreshing = false; invalidate();
    return;
  }
  S.refreshing = true; invalidate();
  try {
    if (!magellanEnabled) await connectAndLoad();
    else { await loadMagellan(); publish(); }
  } catch (e) {
    if (e instanceof api.BadCredentials) { logout(); return; }
    S.message = humanize(e);
  } finally {
    S.refreshing = false;
    invalidate();
  }
}

// ---------------------------------------------------------------------------------------------
// Mise à jour continue (app au premier plan)
// ---------------------------------------------------------------------------------------------

let polling = false;
let pollTimer = null;
let ticks = 0;

function startPolling() {
  if (S.demo || polling || !magellanEnabled) return;
  polling = true;
  schedule();
}

function stopPolling() {
  polling = false;
  clearTimeout(pollTimer);
  pollTimer = null;
}

function schedule() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(tick, S.pending.size ? 1500 : 3000);
}

async function tick() {
  if (!polling) return;
  if (document.visibilityState === 'visible') {
    ticks++;
    try {
      if (ticks % 20 === 0) { await loadMagellan(); publish(); }
      else if (ticks % 3 === 0) await pollRoomCapabilities();
    } catch { /* réseau : on réessaiera au prochain tour */ }
  }
  if (polling) schedule();
}

function onVisibility() {
  if (document.visibilityState !== 'visible' || S.demo || !magellanEnabled) return;
  // Retour dans l'app : relecture immédiate si les valeurs ont plus de 15 s.
  if (Date.now() - lastFetchAt > 15_000) {
    loadMagellan().then(publish).catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------------------------

const inFlight = new Map();
function setInFlight(id, delta) {
  const n = Math.max(0, (inFlight.get(id) || 0) + delta);
  inFlight.set(id, n);
  S.pending = new Set([...inFlight].filter(([, v]) => v > 0).map(([k]) => k));
  invalidate();
}

export function setDerogationHours(h) {
  store.derogationHours = h;
  S.derogationHours = h;
  invalidate();
}

/** Dernier service (chaud/froid…) vu par appareil, pour rallumer un split dans le même mode. */
const lastService = new Map();
export const lastServiceFor = id => lastService.get(id) || null;

const overrides = new Map(); // deviceId → Map(cap → {value, at, executedGen, executedAt})
const failed = new Map(); // deviceId → {device, writes, local}
const writeChains = new Map();

function serialized(id, fn) {
  const prev = writeChains.get(id) || Promise.resolve();
  const p = prev.then(fn, fn);
  writeChains.set(id, p.catch(() => {}));
  return p;
}

/**
 * Écrit une séquence de capabilities dans l'ordre, en attendant la fin de chaque exécution
 * (GET /executions/{id} toutes les 2 s, état 3 = terminé, 4 = erreur), comme l'app officielle.
 * [local] : valeurs affichées en attendant que le serveur les recalcule (jamais envoyées).
 */
export function writeCapabilities(device, writes, local = []) {
  if (!writes.length) return;
  const derived = MgWrites.derived(writes).filter(([c]) => !writes.some(w => w[0] === c) && !local.some(l => l[0] === c));
  local = [...local, ...derived];
  const id = device.deviceId;
  const stamp = Date.now();
  failed.delete(id);
  if (id in S.failures) { const f = { ...S.failures }; delete f[id]; S.failures = f; }

  if (S.demo) {
    // Démo : le résultat devient la nouvelle réalité, sans serveur.
    mgSetups = mgSetups.map(st => ({ ...st, devices: st.devices.map(d => (d.deviceId === id ? withValues(d, [...writes, ...local], stamp) : d)) }));
    publish();
    return;
  }

  let ov = overrides.get(id);
  if (!ov) { ov = new Map(); overrides.set(id, ov); }
  if (writes.some(w => w[0] === Caps.SERVICE_REQUESTED)) {
    // Ex. éteindre puis rallumer : l'état « au repos » déduit de l'arrêt ne vaut plus.
    ov.delete(Caps.HEATING_STATUS); ov.delete(Caps.SERVICE_IN_PROGRESS);
  }
  for (const [c, v] of [...writes, ...local]) ov.set(c, { value: v, at: stamp, executedGen: null, executedAt: 0 });
  publish();

  (async () => {
    setInFlight(id, +1);
    try {
      await serialized(id, async () => {
        for (const [c, v] of writes) {
          const execId = await magellan(t => api.writeCapability(t, id, c, v));
          if (execId != null) await waitExecution(execId);
        }
      });
      // Commande exécutée : seules les lectures lancées à partir de maintenant peuvent la confirmer.
      const done = Date.now();
      const m = overrides.get(id);
      if (m) for (const [c] of [...writes, ...local]) {
        const o = m.get(c);
        if (o && o.at === stamp) m.set(c, { ...o, executedGen: fetchStarted, executedAt: done });
      }
      // Relecture pour confirmer (un échec réseau ici n'annule rien), puis une seconde si besoin.
      try {
        await sleep(1500);
        await loadMagellan(); publish();
        if ([...(overrides.get(id)?.values() || [])].some(o => o.at === stamp)) {
          await sleep(4000);
          await loadMagellan(); publish();
        }
      } catch { /* la prochaine relecture confirmera */ }
    } catch (e) {
      const m = overrides.get(id);
      if (m) for (const [c] of [...writes, ...local]) if (m.get(c)?.at === stamp) m.delete(c);
      failed.set(id, { device, writes, local });
      const name = displayName(mgSetups.flatMap(s => s.devices).find(d => d.deviceId === id) || device);
      S.failures = { ...S.failures, [id]: humanize(e) };
      S.message = `${name} : la commande n'a pas abouti`;
      try { await loadMagellan(); } catch { /* hors ligne */ }
      publish();
    } finally {
      setInFlight(id, -1);
    }
  })();
}

export function retryFailed(id) {
  const f = failed.get(id);
  if (f) writeCapabilities(f.device, f.writes, f.local);
}

export function dismissFailure(id) {
  failed.delete(id);
  const f = { ...S.failures }; delete f[id]; S.failures = f;
  invalidate();
}

async function waitExecution(execId) {
  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    let ex = null;
    try { ex = await magellan(t => api.execution(t, execId)); } catch { ex = null; }
    if (!ex) continue;
    if (Number(ex.state) === 3) return;
    if (Number(ex.state) === 4) throw new Error("L'appareil a refusé la commande" + (ex.details ? ` (${ex.details})` : ''));
  }
}

function withValues(d, values, stamp) {
  let caps = d.capabilities;
  for (const [c, v] of values) {
    caps = caps.some(x => x.capabilityId === c)
      ? caps.map(x => (x.capabilityId === c ? { ...x, value: v } : x))
      : [...caps, { capabilityId: c, value: v, modificationDate: Math.floor(stamp / 1000) }];
  }
  return { ...d, capabilities: caps };
}

function sameValue(a, b) {
  if (a == null) return false;
  const x = String(a).replace(/ /g, ''), y = String(b).replace(/ /g, '');
  if (x === y) return true;
  const dx = Number(x), dy = Number(y);
  return x !== '' && y !== '' && Number.isFinite(dx) && Number.isFinite(dy) && Math.abs(dx - dy) < 0.01;
}

/** Appareils tels qu'affichés : valeurs du serveur + commandes en attente de confirmation. */
function effectiveMagellan() {
  const now = Date.now();
  return mgSetups.flatMap(s => s.devices).map(d => {
    const ov = overrides.get(d.deviceId);
    if (!ov) return d;
    for (const [c, o] of [...ov]) {
      const server = d.capabilities.find(x => x.capabilityId === c)?.value;
      const confirmed = o.executedGen != null && appliedGen(d.deviceId) > o.executedGen && sameValue(server, o.value);
      const expired = (o.executedGen != null && now - o.executedAt > 60_000) || now - o.at > 180_000;
      if (confirmed || expired) ov.delete(c);
    }
    return ov.size ? withValues(d, [...ov].map(([c, o]) => [c, o.value]), now) : d;
  });
}

/** Nouvel ordre des pièces sur l'accueil (enregistré sur l'appareil). */
export function setRoomOrder(ids) {
  const known = new Set(ids);
  store.roomOrder = [...ids, ...store.roomOrder.filter(i => !known.has(i))];
  publish();
}

export const roomOrder = () => store.roomOrder;

function publish() {
  const devices = effectiveMagellan();
  for (const d of devices) {
    const s = service(cap(d, Caps.SERVICE_REQUESTED));
    if (s && s !== OFF) lastService.set(d.deviceId, s);
  }
  const seen = new Set();
  const gateways = mgSetups.flatMap(s => s.gateways).filter(g => (seen.has(g.id) ? false : seen.add(g.id))).map(g => ({
    id: String(g.id), serial: g.serialNumber || null, alive: g.isAlive !== false, typeLabel: gatewayLabel(g.type || 0),
  }));
  let rooms = buildRooms(devices);
  const order = store.roomOrder;
  if (order.length) {
    const rank = r => { const i = order.indexOf(r.id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
    rooms = rooms.slice().sort((a, b) => rank(a) - rank(b) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }
  S.home = { magellan: devices, rooms, dhws: buildDhws(devices), gateways };
  S.lastUpdate = Date.now();
  invalidate();
}

export function consumeMessage() {
  S.message = null;
  invalidate();
}

export function humanize(e) {
  if (e instanceof api.BadCredentials) return e.message || 'Identifiants refusés';
  if (e instanceof api.NetworkError) return e.message;
  if (e instanceof api.HttpError) {
    if (e.status >= 500) return `Les serveurs Atlantic ne répondent pas (${e.status}). Réessayez plus tard.`;
    if (e.status === 429) return 'Trop de requêtes, patientez quelques instants';
    return `Erreur serveur ${e.status}`;
  }
  return e?.message || String(e);
}
