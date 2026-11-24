// Mode absence : dates de départ et de retour, consigne pendant l'absence (capabilities du hub).
import { h } from '../vdom.js';
import { S, invalidate, retryFailed, writeCapabilities } from '../store.js';
import { Caps, MgWrites, absenceHubs, absencePeriod, cap, capNum, displayName, has } from '../model.js';
import { setDrawer } from '../nav.js';
import {
  Banner, Button, Chip, Chips, Content, Dots, Hint, Icon, IconTile, Section, Stepper, TopBar, fmtDayTime, pad2, plural,
} from '../ui.js';

function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Vendredi 18 h → dimanche 18 h du prochain week-end. */
function nextWeekend() {
  const d = (5 - new Date().getDay() + 7) % 7;
  const start = Math.max(at(d, 18), Date.now() + 60_000);
  return [start, at(d + 2, 18)];
}

const localValue = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const parseLocal = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : null;
};

const drafts = {}; // hubId → { key, start, end }

export function AbsenceScreen() {
  const hubs = absenceHubs(S.home.magellan);
  return h('div', { class: 'screen' },
    TopBar({ title: 'Mode absence', nav: 'menu', onNav: () => setDrawer(true) }),
    Content(
      ...hubs.flatMap(hub => HubAbsence(hub, hubs.length > 1)),
      hubs.length ? null : Section({ children: [h('p', { class: 'muted' }, 'Aucun équipement ne gère le mode absence.')] }),
    ));
}

function HubAbsence(hub, showTitle) {
  const id = hub.deviceId;
  const st = cap(hub, Caps.ABSENCE_HOME_STATE)?.trim();
  const period = absencePeriod(hub);
  const planned = st === '1' || st === '2';
  const key = JSON.stringify([period, planned]);
  let dr = drafts[id];
  if (!dr || dr.key !== key) {
    dr = drafts[id] = {
      key,
      start: planned && period ? period[0] : at(1, 9),
      end: planned && period && period[1] ? period[1] : at(8, 18),
    };
  }
  const roomsOfHub = S.home.rooms.filter(r => r.hub?.deviceId === id).length;
  const rooms = roomsOfHub || S.home.rooms.length;
  const busy = S.pending.has(id);
  const days = Math.floor((dr.start - Date.now()) / 86_400_000);
  let sub;
  if (st === '2' && days >= 1) sub = `Commence dans ${plural(days, 'jour')} · ${plural(rooms, 'pièce')}`;
  else if (st === '1') sub = period?.[1] ? `Retour le ${fmtDayTime(period[1])}` : 'Sans date de retour';
  else if (st === '2') sub = `Commence bientôt · ${plural(rooms, 'pièce')}`;
  else sub = 'Choisissez vos dates ci-dessous';
  const w = writes => writeCapabilities(hub, writes);
  const set = (k, v) => { dr[k] = v; invalidate(); };
  const minValue = localValue(Date.now());

  return [
    S.failures[id] ? Banner({ icon: 'luggage', title: "La dernière modification n'a pas abouti", text: `${S.failures[id]} · toucher pour réessayer`, tone: 'danger', onClick: () => retryFailed(id) }) : null,
    showTitle ? h('h2', { class: 'group-title' }, displayName(hub)) : null,
    h('section', { class: 'card status' },
      IconTile('luggage', { tone: planned ? 'info' : null, large: true }),
      h('div', { class: 'tx' },
        h('b', null, st === '1' ? 'Absence en cours' : st === '2' ? 'Absence programmée' : 'Aucune absence prévue'),
        busy ? Dots() : null,
        h('span', null, sub))),
    Section({
      title: 'Dates',
      children: [
        h('div', { class: 'stack' },
          DateField('flight_takeoff', 'Départ', dr.start, minValue, v => set('start', v)),
          DateField('flight_land', 'Retour', dr.end, minValue, v => set('end', v))),
        Chips([
          Chip({ label: 'Partir maintenant', icon: 'bolt', onClick: () => { dr.start = Date.now() + 60_000; if (dr.end <= dr.start) dr.end = at(2, 18); invalidate(); } }),
          Chip({ label: 'Ce week-end', onClick: () => { [dr.start, dr.end] = nextWeekend(); invalidate(); } }),
          Chip({ label: '1 semaine', onClick: () => { dr.start = Date.now() + 60_000; dr.end = dr.start + 7 * 86_400_000; invalidate(); } }),
        ], true),
        dr.end <= dr.start ? Hint('Le retour doit être après le départ.') : null,
      ],
    }),
    has(hub, Caps.ABSENCE_HEAT_TARGET) ? Section({
      title: "Pendant l'absence",
      children: [
        h('div', { class: 'between' },
          h('div', null, h('b', { class: 'title' }, 'Consigne chauffage'), h('span', { class: 'muted small block' }, `Appliquée aux ${plural(rooms, 'pièce')}`)),
          Stepper({ id: 'abs' + id, value: capNum(hub, Caps.ABSENCE_HEAT_TARGET), min: 7, max: 20, onCommit: t => w(MgWrites.absenceHeatTarget(t)) })),
        Hint('Les splits reprennent leurs réglages au retour.'),
      ],
    }) : null,
    Button({ text: planned ? 'Enregistrer les nouvelles dates' : "Programmer l'absence", disabled: dr.end <= dr.start, onClick: () => w(MgWrites.absence(dr.start, dr.end)) }),
    planned ? Button({ text: "Annuler l'absence", kind: 'danger', onClick: () => w(MgWrites.stopAbsence(hub)) }) : null,
  ];
}

function DateField(icon, label, ms, min, onPick) {
  return h('label', { class: 'field' },
    Icon(icon),
    h('span', { class: 'tx' }, h('span', null, label), h('b', null, fmtDayTime(ms))),
    Icon('edit'),
    h('input', {
      type: 'datetime-local', class: 'native', value: localValue(ms), min, 'aria-label': label,
      onChange: e => { const v = parseLocal(e.target.value); if (v) onPick(v); },
    }));
}
