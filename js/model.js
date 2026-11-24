// Logique Magellan (splits, pièces, plannings, écritures), portée de l'app Android
// (model/Magellan.kt, ui/screens/MagellanCatalog.kt).

export const Caps = {
  SERVICE_REQUESTED: 7, HEATING_TARGET: 40, AMBIENT: 117, ERROR_HOME: 150, ABSENCE_HOME_STATE: 152,
  HEATING_STATUS: 153, ROOM_NAME: 154, DEROG_ACTIVE: 157, DEROG_DURATION: 158, DEROG_REMAINING: 159,
  HEAT_MIN: 160, HEAT_MAX: 161, COOL_MIN: 162, COOL_MAX: 163, SERVICES_AVAILABLE: 166, COOLING_TARGET: 177,
  SERVICE_IN_PROGRESS: 181, MODE: 184, MODES_AVAILABLE: 217, ABSENCE_HOME_DATE: 222, ERROR_ROOM: 303,
  THERMAL_ZONE_NUMBER: 100000, SERVICES_SUPPORTED: 100022, MODES_SUPPORTED: 100023,
  FAN_SPEED_SET: 100800, FAN_SPEED: 100801, FAN_QUIET: 100802, FLAP_POSITION: 100803, SWING: 100804,
  POWERFUL: 100505, ENERGY_SAVING: 100507, ROOM_BOOST: 104044, WINDOW_DETECTION: 104050, WINDOW_OPEN: 104051,
  VENT_OPTIONS_SUPPORTED: 100002, VENT_OPTIONS_AVAILABLE: 100024, ABSENCE_COOL_TARGET: 171, ABSENCE_HEAT_TARGET: 172,
  WIFI_RSSI: 179, WIFI_CONNECTED: 218, MILESTONE_STEP: 295, MAX_MILESTONES_PER_DAY: 306,
  PROG_HEAT_MONDAY: 100320, PROG_COOL_MONDAY: 100327,
  DHW_ON: 86, DHW_MODE: 87, DHW_HEATING: 99, DHW_BOOST: 165, DHW_MODES_AVAILABLE: 168, DHW_SETPOINT: 231,
  DHW_BOOST_MINUTES: 232, DHW_MAX: 252, DHW_MIN: 253, DHW_SOC: 271, DHW_STEP: 340, DHW_MODES_SUPPORTED: 105011,
  AMBIENT_RELIABLE: 103150,
};

// Services (marche / mode) : raw = valeur de la capability 7, mask = bit dans 166/100022.
export const SERVICES = [
  { raw: '0', mask: 1, label: 'Arrêt', long: 'Arrêt', key: 'off', icon: 'power_settings_new' },
  { raw: '4', mask: 16, label: 'Chaud', long: 'Chaud', key: 'heat', icon: 'local_fire_department' },
  { raw: '3', mask: 8, label: 'Froid', long: 'Froid', key: 'cool', icon: 'ac_unit' },
  { raw: '1', mask: 6, label: 'Auto', long: 'Auto', key: 'auto', icon: 'autorenew' },
  { raw: '7', mask: 128, label: 'Ventil.', long: 'Ventilation', key: 'fan', icon: 'air' },
  { raw: '8', mask: 256, label: 'Déshum.', long: 'Déshumidif.', key: 'dry', icon: 'water_drop' },
];
export const service = raw => (raw == null ? null : SERVICES.find(s => s.raw === String(raw).trim()) || null);
export const OFF = SERVICES[0], HEAT = SERVICES[1], COOL = SERVICES[2], AUTO = SERVICES[3], FAN = SERVICES[4];

export function productType(productId) {
  const p = productId;
  if (p == null) return 'UNKNOWN';
  if (p === 1) return 'PASS_APC_BOILER'; if (p === 2) return 'PASS_APC_HEAT_PUMP'; if (p === 3) return 'PASS_APC_HYBRID';
  if (p === 4) return 'DARWIN_BOILER'; if (p === 7) return 'HDG2'; if (p === 25) return 'AIR_CONDITIONER';
  if ((p >= 26 && p <= 30) || (p >= 97 && p <= 111)) return 'ROOM';
  if (p >= 31 && p <= 40) return 'AIR_CONDITIONER_UI';
  if (p === 41) return 'BD0'; if ([6, 44, 112, 113].includes(p)) return 'DISCOVER_MASTER';
  if (p === 47 || p === 62) return 'DHW'; if (p === 53) return 'TD1'; if (p === 54) return 'CESA_V2_MAIN_COMPONENT';
  if (p >= 58 && p <= 61) return 'CESA_V2_GENERATOR'; if (p === 63) return 'NAVI_HUB'; if (p === 64) return 'HE3Z';
  if (p >= 65 && p <= 94) return 'TH_ZONE'; if (p === 95) return 'SPLIT_3S_HUB'; if (p === 96) return 'ZONI_CLIM_HUB';
  if (p === 121) return 'UNDERFLOOR_HEATER'; if (p === 122) return 'CONSOLE'; if (p === 123) return 'WALL_AIR_CONDITIONER';
  if (p === 124) return 'REMOTE_CONTROL';
  return 'UNKNOWN';
}
export const HUBS = new Set(['AIR_CONDITIONER', 'SPLIT_3S_HUB', 'ZONI_CLIM_HUB', 'NAVI_HUB', 'CESA_V2_MAIN_COMPONENT', 'DISCOVER_MASTER']);
export const UI_ONLY = new Set(['TH_ZONE', 'AIR_CONDITIONER_UI', 'CESA_V2_GENERATOR']);

// ---------------------------------------------------------------------------------------------
// Lecture des capabilities d'un appareil
// ---------------------------------------------------------------------------------------------

const capCache = new WeakMap();
function capMap(d) {
  let m = capCache.get(d);
  if (!m) {
    m = new Map();
    for (const c of d.capabilities || []) if (!m.has(c.capabilityId)) m.set(c.capabilityId, c);
    capCache.set(d, m);
  }
  return m;
}
export const capEntry = (d, id) => capMap(d).get(id) || null;
export const cap = (d, id) => { const c = capMap(d).get(id); return c && c.value != null ? String(c.value) : null; };
export const has = (d, id) => capMap(d).has(id);
export function capNum(d, id) {
  const v = cap(d, id);
  if (v == null) return null;
  const n = Number(v.replace(',', '.').trim());
  return v.trim() !== '' && Number.isFinite(n) && Math.abs(n) < 1e6 ? n : null;
}
export function capInt(d, id) {
  const v = cap(d, id);
  if (v == null) return null;
  const s = v.trim();
  if (/^[-+]?\d+$/.test(s)) return parseInt(s, 10);
  const n = Number(s);
  return s !== '' && Number.isFinite(n) ? Math.trunc(n) : null;
}
export function capBool(d, id) {
  const v = cap(d, id);
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'enabled' || s === 'true';
}
export const typeOf = d => productType(d.productId);

/** modificationDate est en secondes côté serveur (parfois en ms) : renvoie des millisecondes. */
export function modifiedAt(c) {
  const m = Number(c?.modificationDate) || 0;
  return m >= 1 && m <= 99_999_999_999 ? m * 1000 : m;
}

/** Nom affiché : capability 154 (nom de la pièce) en priorité, comme l'app officielle. */
export function displayName(d) {
  const n = cap(d, Caps.ROOM_NAME)?.trim();
  if (n && n.toLowerCase() !== 'unknown') return n;
  if (d.customName && d.customName.trim()) return d.customName;
  return d.name || d.longName || `Appareil ${d.deviceId}`;
}

/** Liste d'erreurs Magellan `[[system, major, minor, level], …]` → codes "major.minor". */
export function parseErrors(raw) {
  if (!raw || !raw.trim().startsWith('[')) return [];
  const out = [];
  for (const m of raw.matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*]/g)) {
    if (m[1] !== '0') out.push(`${m[2]}.${m[3]}`);
  }
  return out;
}

export const fmtSetpoint = t => t.toFixed(1);

// ---------------------------------------------------------------------------------------------
// Plannings (100320–100333) : triplets [minutes, température, mode] (0 normal, 1 arrêt, 2 boost)
// ---------------------------------------------------------------------------------------------

export const Schedules = {
  SLOTS: 10,
  parse(raw) {
    if (!raw || !raw.trim()) return [];
    const out = [];
    for (const m of raw.matchAll(/\[([^\[\]]*)]/g)) {
      const a = m[1].split(',').map(s => s.trim()).filter(s => s !== '').map(Number).filter(Number.isFinite);
      if (a.length < 2) continue;
      const minute = a[0];
      let temp = a[1];
      const mode = a.length > 2 ? Math.trunc(a[2]) : 0;
      if (minute === 0 && temp === 0 && mode === 0) continue;
      if (temp > 40) temp /= 100;
      out.push({ minute: Math.min(1439, Math.max(0, Math.trunc(minute))), temp, mode });
    }
    return out.sort((x, y) => x.minute - y.minute);
  },
  format(slots) {
    const num = d => (Number.isInteger(d) ? String(d) : d.toFixed(1));
    const rows = [...slots].sort((a, b) => a.minute - b.minute).slice(0, this.SLOTS)
      .map(s => [s.minute, s.mode === 1 ? 0 : s.temp, s.mode]);
    while (rows.length < this.SLOTS) rows.push([0, 0, 0]);
    return '[' + rows.map(r => '[' + r.map(num).join(', ') + ']').join(', ') + ']';
  },
  activeAt(week, day, minute) {
    const today = (week[day] || []).filter(s => s.minute <= minute);
    if (today.length) return today[today.length - 1];
    for (let back = 1; back <= 7; back++) {
      const d = week[(day - back + 7) % 7] || [];
      if (d.length) return d[d.length - 1];
    }
    return null;
  },
  nextAfter(week, day, minute) {
    const s = (week[day] || []).find(x => x.minute > minute);
    if (s) return [0, s];
    for (let ahead = 1; ahead <= 7; ahead++) {
      const d = week[(day + ahead) % 7] || [];
      if (d.length) return [ahead, d[0]];
    }
    return null;
  },
};
export const slotOff = s => s.mode === 1;

// ---------------------------------------------------------------------------------------------
// Pièces (splits, zones…) et ballons d'eau chaude
// ---------------------------------------------------------------------------------------------

const ROOM_TYPES = new Set(['ROOM', 'DARWIN_BOILER', 'TD1', 'BD0']);

export function isRoom(d) {
  const t = typeOf(d);
  return ROOM_TYPES.has(t) || (!HUBS.has(t) && !UI_ONLY.has(t) && t !== 'DHW' &&
    has(d, Caps.AMBIENT) && (has(d, Caps.HEATING_TARGET) || has(d, Caps.SERVICE_REQUESTED)));
}
export const isDhw = d => { const t = typeOf(d); return t === 'DHW' || t === 'HDG2' || (has(d, Caps.DHW_SETPOINT) && !isRoom(d)); };

function bits(d, primary, fallback) {
  const a = capInt(d, primary);
  if (a != null && a > 0) return a;
  const b = capInt(d, fallback);
  return b != null && b > 0 ? b : null;
}

export function buildRooms(devices) {
  const byId = new Map(devices.map(d => [d.deviceId, d]));
  return devices.filter(isRoom).map(d => room(d, d.masterDeviceId != null ? byId.get(d.masterDeviceId) || null : null))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

function room(d, hub) {
  const requested = service(cap(d, Caps.SERVICE_REQUESTED));
  const inProgress = service(cap(d, Caps.SERVICE_IN_PROGRESS));
  const serviceBits = bits(d, Caps.SERVICES_AVAILABLE, Caps.SERVICES_SUPPORTED);
  let services;
  if (serviceBits != null) services = SERVICES.filter(s => s !== OFF && (s.mask & serviceBits) !== 0);
  else services = requested && requested !== OFF ? [requested] : [HEAT, COOL];
  let heating;
  if (requested === HEAT || requested === FAN) heating = true;
  else if (requested === COOL || requested?.key === 'dry') heating = false;
  else heating = inProgress !== COOL;
  const hubType = hub ? typeOf(hub) : null;
  const type2 = hubType === 'CESA_V2_MAIN_COMPONENT' && cap(d, Caps.THERMAL_ZONE_NUMBER) === '0';
  let targetCap = null;
  if (type2) targetCap = null;
  else if (heating && has(d, Caps.HEATING_TARGET)) targetCap = Caps.HEATING_TARGET;
  else if (!heating && has(d, Caps.COOLING_TARGET)) targetCap = Caps.COOLING_TARGET;
  else if (has(d, Caps.HEATING_TARGET)) targetCap = Caps.HEATING_TARGET;
  else if (has(d, Caps.COOLING_TARGET)) targetCap = Caps.COOLING_TARGET;
  const min = heating ? capNum(d, Caps.HEAT_MIN) ?? 10 : capNum(d, Caps.COOL_MIN) ?? 17.5;
  const max = Math.max(min + 1, heating ? capNum(d, Caps.HEAT_MAX) ?? 30 : capNum(d, Caps.COOL_MAX) ?? 34.5);
  const modeBits = bits(d, Caps.MODES_SUPPORTED, Caps.MODES_AVAILABLE) ?? 0b11;
  const modes = [];
  if (modeBits & 1) modes.push(['0', 'Manuel']);
  if (modeBits & 2) modes.push(['1', 'Prog.']);
  if (modeBits & 32) modes.push(['2', 'Auto']);
  const fanSet = capInt(d, Caps.FAN_SPEED_SET);
  let speeds = [];
  if (has(d, Caps.FAN_SPEED)) {
    if (fanSet === 0) speeds = [['1', 'Basse'], ['2', 'Moy.'], ['3', 'Haute']];
    else if (fanSet === 1) speeds = [['1', 'Basse'], ['3', 'Haute']];
    else if (fanSet === 3) speeds = [['5', 'Auto'], ['1', 'Basse'], ['3', 'Haute']];
    else if (fanSet === 4) speeds = [['5', 'Auto']];
    else speeds = [['5', 'Auto'], ['1', 'Basse'], ['2', 'Moy.'], ['3', 'Haute']];
  }
  const fans = speeds.length && has(d, Caps.FAN_QUIET)
    ? [...speeds.filter(s => s[0] === '5'), ['quiet', 'Silence'], ...speeds.filter(s => s[0] !== '5')]
    : speeds;
  let kind;
  if (['AIR_CONDITIONER', 'SPLIT_3S_HUB', 'NAVI_HUB'].includes(hubType)) kind = 'Split';
  else if (hubType === 'ZONI_CLIM_HUB') kind = 'Climatisation';
  else if (hubType === 'CESA_V2_MAIN_COMPONENT') kind = 'PAC';
  else kind = typeOf(d) === 'DARWIN_BOILER' ? 'Thermostat' : 'Émetteur';
  const ventBits = (capInt(d, Caps.VENT_OPTIONS_AVAILABLE) || 0) | (capInt(d, Caps.VENT_OPTIONS_SUPPORTED) || 0);
  const windowCap = capEntry(d, Caps.WINDOW_OPEN);
  const anyDay = b => [0, 1, 2, 3, 4, 5, 6].some(i => has(d, b + i));
  const heatBase = anyDay(Caps.PROG_HEAT_MONDAY) ? Caps.PROG_HEAT_MONDAY : null;
  const coolBase = anyDay(Caps.PROG_COOL_MONDAY) ? Caps.PROG_COOL_MONDAY : null;
  const scheduleBase = heating ? heatBase ?? coolBase : coolBase ?? heatBase;
  const schedule = {};
  if (scheduleBase != null) for (let i = 0; i < 7; i++) schedule[i] = Schedules.parse(cap(d, scheduleBase + i));
  const opt = id => (has(d, id) ? capBool(d, id) === true : null);
  const ambient = capNum(d, Caps.AMBIENT);
  const target = targetCap != null ? capNum(d, targetCap) : null;
  const mode = cap(d, Caps.MODE)?.trim() ?? null;
  const on = requested != null && requested !== OFF;
  const status = cap(d, Caps.HEATING_STATUS)?.trim();
  const maxSlots = capInt(d, Caps.MAX_MILESTONES_PER_DAY);
  const step = capInt(d, Caps.MILESTONE_STEP);
  let lastUpdate = 0;
  for (const c of d.capabilities) lastUpdate = Math.max(lastUpdate, modifiedAt(c));
  const r = {
    device: d, id: d.deviceId, hub, name: displayName(d), kind,
    ambient: ambient != null && ambient > -40 && ambient < 70 ? ambient : null,
    requested, inProgress, services, heatingContext: heating,
    target: target != null && target >= 0 && target <= 60 ? target : null,
    targetCap, minTarget: min, maxTarget: max, mode, modes,
    derogationOn: capBool(d, Caps.DEROG_ACTIVE) === true && mode === '1' && requested !== OFF,
    derogationRemainingMin: capInt(d, Caps.DEROG_REMAINING),
    runningNow: status === '1' || status === '2',
    fan: cap(d, Caps.FAN_SPEED)?.trim() ?? null, fans,
    errors: (() => { const e = parseErrors(cap(d, Caps.ERROR_ROOM)); return e.length ? e : parseErrors(cap(d, Caps.ERROR_HOME)); })(),
    windowOpen: capBool(d, Caps.WINDOW_OPEN) === true,
    windowSince: windowCap && modifiedAt(windowCap) > 0 ? modifiedAt(windowCap) : null,
    windowDetection: has(d, Caps.WINDOW_DETECTION) || (ventBits & 2) !== 0 ? capBool(d, Caps.WINDOW_DETECTION) === true : null,
    powerful: opt(Caps.POWERFUL), energySaving: opt(Caps.ENERGY_SAVING), swing: opt(Caps.SWING),
    flap: (() => { const f = capInt(d, Caps.FLAP_POSITION); return f != null && f >= 1 && f <= 4 ? f : null; })(),
    hasFlaps: has(d, Caps.FLAP_POSITION), quiet: opt(Caps.FAN_QUIET), roomBoost: opt(Caps.ROOM_BOOST),
    derogationSupported: has(d, Caps.DEROG_ACTIVE),
    scheduleBase, schedule,
    maxSlotsPerDay: maxSlots != null && maxSlots >= 1 && maxSlots <= Schedules.SLOTS ? maxSlots : Schedules.SLOTS,
    slotStepMinutes: step != null && step >= 1 && step <= 120 ? step : 15,
    lastUpdate,
    ambientReliable: has(d, Caps.AMBIENT_RELIABLE) ? capBool(d, Caps.AMBIENT_RELIABLE) === true : null,
    on,
  };
  r.isProg = mode === '1';
  r.canEditTarget = targetCap != null && on && requested !== FAN;
  r.canProgram = modes.some(m => m[0] === '1') || scheduleBase != null;
  r.fanChoice = r.quiet === true ? 'quiet' : r.fan;
  return r;
}

export function buildDhws(devices) {
  return devices.filter(isDhw).map(d => {
    const modeBits = bits(d, Caps.DHW_MODES_SUPPORTED, Caps.DHW_MODES_AVAILABLE) ?? (1 | 4 | 8);
    const modes = [];
    if (modeBits & 8) modes.push(['4', 'Prog.']);
    if (modeBits & 2) modes.push(['2', 'Planning']);
    if (modeBits & 4) modes.push(['3', 'Éco']);
    if (modeBits & 1) modes.push(['0', 'Manuel']);
    const soc = capInt(d, Caps.DHW_SOC);
    const step = capNum(d, Caps.DHW_STEP);
    return {
      device: d, id: d.deviceId,
      name: has(d, Caps.ROOM_NAME) || (d.customName && d.customName.trim()) ? displayName(d) : 'Eau chaude',
      on: has(d, Caps.DHW_ON) ? cap(d, Caps.DHW_ON)?.trim() === '1' : null,
      heating: cap(d, Caps.DHW_HEATING)?.trim() === '1',
      mode: cap(d, Caps.DHW_MODE)?.trim() ?? null, modes,
      setpoint: capNum(d, Caps.DHW_SETPOINT),
      min: capNum(d, Caps.DHW_MIN) ?? 50, max: capNum(d, Caps.DHW_MAX) ?? 65,
      step: step != null && step > 0 ? step : 1,
      boost: capBool(d, Caps.DHW_BOOST) === true,
      stateOfCharge: soc != null && soc >= 1 && soc <= 100 ? soc : null,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Écritures (séquences exactes de l'app officielle). Chaque paire = [capability, valeur].
// ---------------------------------------------------------------------------------------------

export const MgWrites = {
  power(r, on, lastService) {
    if (!on) return [[Caps.SERVICE_REQUESTED, OFF.raw]];
    const s = (lastService && r.services.includes(lastService) && lastService)
      || (r.services.includes(HEAT) && HEAT) || r.services[0] || HEAT;
    return [[Caps.SERVICE_REQUESTED, s.raw]];
  },
  service: s => [[Caps.SERVICE_REQUESTED, s.raw]],
  mode: m => [[Caps.MODE, m]],
  target(r, t, derogationMinutes) {
    if (r.targetCap == null) return [];
    return r.isProg && r.on
      ? [[Caps.DEROG_DURATION, String(derogationMinutes)], [Caps.DEROG_ACTIVE, '1'], [r.targetCap, fmtSetpoint(t)]]
      : [[r.targetCap, fmtSetpoint(t)]];
  },
  cancelDerogation: () => [[Caps.DEROG_ACTIVE, '0']],
  fanChoice(r, v) {
    if (v === 'quiet') return [[Caps.FAN_QUIET, '1']];
    if (r.quiet === true) return [[Caps.FAN_SPEED, v], [Caps.FAN_QUIET, '0']];
    return [[Caps.FAN_SPEED, v]];
  },
  flag: (c, on) => [[c, on ? '1' : '0']],
  flap: (r, p) => [[Caps.FLAP_POSITION, String(p)], ...(r.swing === true ? [[Caps.SWING, '0']] : [])],
  derogation(r, t, minutes) {
    if (r.targetCap == null) return [];
    return [[Caps.DEROG_DURATION, String(minutes)], [Caps.DEROG_ACTIVE, '1'], [r.targetCap, fmtSetpoint(t)]];
  },
  schedule: (base, days, slots) => {
    const v = Schedules.format(slots);
    return [...days].sort((a, b) => a - b).map(d => [base + d, v]);
  },
  absenceHeatTarget: t => [[Caps.ABSENCE_HEAT_TARGET, fmtSetpoint(t)]],
  /** Valeurs que le serveur recalculera : affichées tout de suite (jamais envoyées). */
  derived(writes) {
    const m = new Map(writes);
    const out = [];
    const s = m.get(Caps.SERVICE_REQUESTED);
    if (s != null) {
      if (s !== AUTO.raw) out.push([Caps.SERVICE_IN_PROGRESS, s]);
      if (s === OFF.raw) out.push([Caps.HEATING_STATUS, '0']);
    }
    if (m.get(Caps.DEROG_ACTIVE) === '1' && m.has(Caps.DEROG_DURATION)) out.push([Caps.DEROG_REMAINING, m.get(Caps.DEROG_DURATION)]);
    const abs = m.get(Caps.ABSENCE_HOME_DATE);
    if (abs != null) {
      const nums = (abs.match(/-?\d+/g) || []).map(Number);
      const start = nums[0] || 0, end = nums[1] || 0;
      out.push([Caps.ABSENCE_HOME_STATE, end === 0 ? '0' : start * 1000 <= Date.now() ? '1' : '2']);
    }
    return out;
  },
  dhwSetpoint: t => [[Caps.DHW_SETPOINT, String(Math.round(t))]],
  dhwBoost: (on, minutes = 60) => on
    ? [[Caps.DHW_BOOST, '1'], [Caps.DHW_BOOST_MINUTES, String(minutes)]]
    : [[Caps.DHW_BOOST_MINUTES, '0'], [Caps.DHW_BOOST, '0']],
  dhwMode: m => [[Caps.DHW_MODE, m]],
  dhwPower: on => [[Caps.DHW_ON, on ? '1' : '0']],
  absence: (startMs, endMs) => [[Caps.ABSENCE_HOME_DATE, `[${Math.floor(startMs / 1000)},${Math.floor(endMs / 1000)}]`]],
  stopAbsence(hub) {
    const m = (cap(hub, Caps.ABSENCE_HOME_DATE) || '').match(/-?\d+/);
    return [[Caps.ABSENCE_HOME_DATE, `[${m ? m[0] : Math.floor(Date.now() / 1000)},0]`]];
  },
};

// ---------------------------------------------------------------------------------------------
// Absence (capability 222 du hub : "[débutSec,finSec]")
// ---------------------------------------------------------------------------------------------

export const absenceHubs = devices => devices.filter(d => has(d, Caps.ABSENCE_HOME_DATE));

export function absencePeriod(hub) {
  const nums = (cap(hub, Caps.ABSENCE_HOME_DATE) || '').match(/-?\d+(\.\d+)?(E\d+)?/g)?.map(Number) || [];
  const start = nums[0] > 0 ? nums[0] : null;
  if (start == null) return null;
  const end = nums[1] > 0 && nums[1] < 4e9 ? nums[1] : null;
  return [Math.round(start * 1000), end != null ? Math.round(end * 1000) : null];
}

// ---------------------------------------------------------------------------------------------
// Catalogue des capabilities (Mode avancé)
// ---------------------------------------------------------------------------------------------

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const SERVICE_ENUM = { ...Object.fromEntries(SERVICES.map(s => [s.raw, s.label])), 5: "Chauffage d'urgence", 6: 'Pré-refroidissement', 9: 'Sommeil' };
const BOOL = { 0: 'non', 1: 'oui' };
const I = (label, unit = '', decimals = 1, en = null) => ({ label, unit, decimals, enum: en });
const E = (label, en) => I(label, '', 1, en);

const INFO = {
  7: E('Service demandé (marche/mode)', SERVICE_ENUM), 40: I('Consigne chauffage', '°C'), 22: I('Consigne ECS (curseur)', '°C'),
  73: E('Modes thermiques possibles', { 0: 'froid seul', 1: 'froid + appoint', 2: 'chaud seul', 3: 'chaud + appoint', 4: 'chaud et froid', 5: 'chaud et froid + appoint' }),
  86: E('ECS en marche', BOOL), 87: E('Mode ECS', { 0: 'manuel', 2: 'planning éco/confort', 3: 'auto/éco', 4: 'programmation' }),
  93: I('Nombre de zones'), 99: E('ECS en chauffe', BOOL), 106: I('Puissance'), 117: I('Température de la pièce', '°C'),
  120: E('Type de générateur', { 2: 'chaudière', 5: 'PAC', 7: 'PAC' }), 150: I('Défauts (logement)'),
  152: E('Absence logement', { 0: 'inactive', 1: 'active', 2: 'programmée' }),
  153: E('Fonctionnement', { 0: 'au repos', 1: 'chauffe', 2: 'refroidit' }), 154: I('Nom de la pièce'),
  157: E('Forçage actif', BOOL), 158: I('Durée du forçage', ' min', 0), 159: I('Forçage restant', ' min', 0),
  160: I('Consigne chaud min', '°C'), 161: I('Consigne chaud max', '°C'), 162: I('Consigne froid min', '°C'), 163: I('Consigne froid max', '°C'),
  165: E('Boost ECS', BOOL), 166: I('Services disponibles (bits)'), 168: I('Modes ECS disponibles (bits)'),
  171: I('Consigne absence froid', '°C'), 172: I('Consigne absence chaud', '°C'), 177: I('Consigne rafraîchissement', '°C'),
  179: I('Signal Wi-Fi', ' dBm', 0), 181: E('Service en cours', SERVICE_ENUM),
  184: E('Mode de pilotage', { 0: 'manuel', 1: 'programmation', 2: 'auto' }), 188: I('Services du logement (bits)'),
  217: I('Modes disponibles (bits)'), 218: E('Wi-Fi connecté', { 0: 'oui' }), 222: I("Période d'absence [début,fin] (s)"),
  230: E('Type de chauffe ECS', { 0: 'permanent', 1: 'programmé', 2: 'heures creuses', '-1': 'autoconsommation' }),
  231: I('Consigne ECS', '°C', 0), 232: I('Durée boost ECS', ' min', 0), 252: I('Consigne ECS max', '°C', 0), 253: I('Consigne ECS min', '°C', 0),
  258: I('Capacité ballon', ' L', 0), 271: I('Eau chaude disponible', ' %', 0), 280: I('Température eau froide', '°C'),
  294: I('Pas de consigne', '°C'), 303: I('Défauts (pièce)'), 344: I('Nombre de pièces'), 100000: I('Numéro de zone thermique'),
  100014: I('Type de pièce'), 100022: I('Services supportés (bits)'), 100023: I('Modes supportés (bits)'),
  100800: E('Vitesses proposées', { 0: 'B/M/H', 1: 'B/H', 2: 'B/M/H/Auto', 3: 'B/H/Auto', 4: 'Auto' }),
  100801: E('Vitesse de ventilation', { 1: 'basse', 2: 'moyenne', 3: 'haute', 5: 'auto' }), 100802: E('Mode silence', BOOL),
  100803: E('Position des volets', { 1: '1', 2: '2', 3: '3', 4: '4' }), 100804: E('Balayage (swing)', BOOL),
  100505: E('Mode puissance', BOOL), 100507: E("Économie d'énergie", BOOL), 103150: E('Température ambiante disponible', BOOL),
  104044: E('Boost pièce', BOOL), 104051: E('Fenêtre ouverte', BOOL), 104050: E('Détection fenêtre ouverte', BOOL),
  100002: I('Options de ventilation supportées (bits)'), 100024: I('Options de ventilation disponibles (bits)'),
  100021: I('Contrôles supportés (bits)'), 100004: I('Contrôles disponibles (bits)'),
  100506: E('Détection de présence', { 0: 'confort', 1: 'présence' }), 103114: E('Ventilation pendant le boost', BOOL),
  103115: I('Durée du boost', ' min', 0), 295: I('Pas des créneaux', ' min', 0), 296: I('Écart mini entre créneaux', ' min', 0),
  306: I('Créneaux max par jour'), 100300: I('Premier jour du planning'), 100301: I('Créneaux max par semaine'),
};
DAYS.forEach((day, i) => {
  INFO[Caps.PROG_HEAT_MONDAY + i] = I('Planning chaud · ' + day);
  INFO[Caps.PROG_COOL_MONDAY + i] = I('Planning froid · ' + day);
});

export function capInfo(id) { return INFO[id] || null; }

export function formatCap(info, raw) {
  if (raw == null) return '—';
  if (!info) return raw;
  const e = info.enum && info.enum[raw.trim()];
  if (e != null) return `${e} (${raw})`;
  if (!info.unit) return raw;
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || raw.trim() === '') return raw;
  const s = info.decimals === 0 ? String(Math.round(n)) : n.toFixed(info.decimals).replace('.', ',');
  return s + info.unit;
}

export const WRITABLE = new Set([
  7, 40, 177, 184, 157, 158, 154, 100801, 100802, 100803, 100804, 100505, 100507, 104044, 104050, 100506, 103114, 103115,
  222, 172, 86, 87, 231, 165, 232, 230, 226, 105636,
]);
for (let id = Caps.PROG_HEAT_MONDAY; id <= Caps.PROG_COOL_MONDAY + 6; id++) WRITABLE.add(id);

export const GROUPS = ['Température', 'Fonctionnement', 'Ventilation et options', 'Programmation', 'Eau chaude', 'Système', 'Autres'];

export function capGroup(id) {
  const inR = (a, b) => id >= a && id <= b;
  if ([117, 40, 177, 160, 161, 162, 163, 171, 172, 103150].includes(id)) return 'Température';
  if ([7, 181, 153, 184, 157, 158, 159, 166, 100022, 217, 100023, 73].includes(id)) return 'Fonctionnement';
  if (inR(100800, 100804) || [100505, 100507, 100506, 104044, 104050, 104051, 100002, 100024, 100021, 100004, 103114, 103115].includes(id)) return 'Ventilation et options';
  if (inR(100300, 100341) || inR(196, 209) || [295, 296, 306].includes(id)) return 'Programmation';
  if ([154, 303, 150, 179, 218, 344, 100000, 100014, 152, 222].includes(id)) return 'Système';
  if (inR(86, 99) || inR(165, 168) || inR(226, 232) || inR(252, 258) || [271, 280, 340, 105011, 105636].includes(id)) return 'Eau chaude';
  return 'Autres';
}

export function familyLabel(d) {
  const f = {
    Radiator: 'Radiateur', Towel_Dryer: 'Sèche-serviettes', Water_Heater: 'Chauffe-eau',
    Thermodynamic_Water_Heater: 'Chauffe-eau thermodynamique', Boiler: 'Chaudière', Air_Conditioning: 'Climatisation',
    Heat_Pump: 'Pompe à chaleur', Hybrid_Heat_Pump: 'PAC hybride', Connectivity_Box: 'Passerelle', Thermostat: 'Thermostat',
    Underfloor_Heater: 'Plancher chauffant', Heat_Interface_Unit: 'Module thermique', Double_Flow_Ventilation: 'VMC double flux',
  }[d.modelFamily];
  if (f) return f;
  return {
    SPLIT_3S_HUB: 'Hub Split 3S', AIR_CONDITIONER: 'Climatiseur', ZONI_CLIM_HUB: 'Hub Zoniclim', NAVI_HUB: 'Hub Navilink',
    CESA_V2_MAIN_COMPONENT: 'Pompe à chaleur', DISCOVER_MASTER: 'Chauffe-eau',
  }[typeOf(d)] || null;
}

export function gatewayLabel(type) {
  if (type === 83) return 'Passerelle Wi-Fi';
  if (type === 105) return 'Bridge V2';
  if (type === 1000) return 'IoT Hub';
  if (type === 26 || type === 32) return 'Cozytouch bridge';
  return `Passerelle (type ${type})`;
}
