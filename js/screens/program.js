// Programmer : planning de la semaine (modifiable jour par jour) et consigne temporaire.
import { h } from '../vdom.js';
import { S, invalidate, retryFailed, writeCapabilities } from '../store.js';
import { Caps, MgWrites, Schedules, slotOff } from '../model.js';
import { closeOverlay, nav, setDrawer, setOverlay } from '../nav.js';
import {
  Banner, Button, Chip, Chips, Content, Hint, Icon, IconTile, Section, SectionLabel, Sheet, Stepper, Switch, TopBar,
  fmtC, fmtDuration, hhmm,
} from '../ui.js';

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const todayIndex = now => (new Date(now).getDay() + 6) % 7;
const minuteOfDay = now => { const d = new Date(now); return d.getHours() * 60 + d.getMinutes(); };
const slotLabel = s => (slotOff(s) ? 'Arrêt' : fmtC(s.temp) + (s.mode === 2 ? ' (boost)' : ''));

const prog = { selected: null, temp: {}, minutes: null };

export function ProgramScreen(now) {
  const rooms = S.home.rooms.filter(r => r.canProgram || r.derogationSupported);
  const r = rooms.find(x => x.id === prog.selected) || rooms[0];
  const w = writes => writeCapabilities(r.device, writes);
  return h('div', { class: 'screen' },
    TopBar({ title: 'Programmer', nav: 'menu', onNav: () => setDrawer(true) }),
    Content(
      !r ? Section({ children: [h('p', { class: 'muted' }, 'Aucune pièce ne propose de planning.')] }) : null,
      r ? Chips(rooms.map(x => Chip({ label: x.name, selected: x.id === r.id, onClick: () => { prog.selected = x.id; invalidate(); } })), true) : null,
      r && S.failures[r.id] ? Banner({
        icon: 'calendar_month', title: "La dernière modification n'a pas abouti", text: `${S.failures[r.id]} · toucher pour réessayer`,
        tone: 'danger', onClick: () => retryFailed(r.id),
      }) : null,
      r ? PlanningCard(r, now, w) : null,
      r && r.scheduleBase != null ? WeekCard(r, now) : null,
      r && r.scheduleBase == null && r.canProgram ? Section({ children: [Hint("Ce split ne transmet pas le détail de son planning : il se modifie depuis l'app officielle. Ici, vous pouvez l'activer, le désactiver et forcer une consigne.")] }) : null,
      r && r.derogationSupported && r.targetCap != null ? TemporaryCard(r, w) : null,
    ));
}

function PlanningCard(r, now, w) {
  let subtitle;
  if (!r.isProg) subtitle = 'Désactivé : la pièce garde sa consigne';
  else if (Object.values(r.schedule).every(s => !s.length)) subtitle = 'Actif';
  else {
    const next = Schedules.nextAfter(r.schedule, todayIndex(now), minuteOfDay(now));
    if (next) {
      const [ahead, s] = next;
      const when = ahead === 0 ? '' : ahead === 1 ? 'demain ' : DAY_LONG[(todayIndex(now) + ahead) % 7] + ' ';
      subtitle = `Prochain changement ${when}${hhmm(s.minute)} → ${slotLabel(s)}`;
    } else subtitle = 'Actif';
  }
  return h('section', { class: 'sec rows' },
    h('div', { class: 'row' },
      IconTile('calendar_month'),
      h('div', { class: 'tx' }, h('b', null, 'Planning actif'), h('span', null, subtitle)),
      r.modes.some(m => m[0] === '1') ? Switch({ checked: r.isProg, label: 'Planning actif', onChange: on => w(MgWrites.mode(on ? '1' : '0')) }) : null));
}

function slotStyle(s, tMin, tMax) {
  if (slotOff(s)) return null;
  const f = tMax > tMin ? (s.temp - tMin) / (tMax - tMin) : 1;
  return { '--p': Math.round(32 + 68 * f) + '%' };
}

function WeekCard(r, now) {
  const today = todayIndex(now);
  const heating = r.scheduleBase === Caps.PROG_HEAT_MONDAY;
  const all = Object.values(r.schedule).flat();
  const temps = [...new Set(all.filter(s => !slotOff(s)).map(s => s.temp))].sort((a, b) => b - a);
  const tMax = temps.length ? Math.max(...temps) : 20;
  const tMin = temps.length ? Math.min(...temps) : tMax;
  const nowMin = minuteOfDay(now);
  const dayRow = d => {
    const slots = r.schedule[d] || [];
    const carry = Schedules.activeAt(r.schedule, (d + 6) % 7, 1439);
    const segs = [];
    const first = slots.length ? slots[0].minute : 1440;
    if (first > 0 && carry) segs.push([0, first, carry]);
    slots.forEach((s, i) => segs.push([s.minute, i + 1 < slots.length ? slots[i + 1].minute : 1440, s]));
    return h('button', { key: 'd' + d, class: 'day' + (d === today ? ' today' : ''), onClick: () => editDay(r, d), 'aria-label': `Modifier le ${DAY_LONG[d]}` },
      h('b', null, DAY_SHORT[d]),
      h('span', { class: 'bar' },
        segs.map(([from, to, s], i) => h('i', {
          key: 's' + i,
          class: slotOff(s) ? 'off' : 'on',
          style: { left: (from / 14.4).toFixed(3) + '%', width: ((to - from) / 14.4).toFixed(3) + '%', ...(slotStyle(s, tMin, tMax) || {}) },
        })),
        d === today ? h('i', { class: 'nowline', style: { left: (nowMin / 14.4).toFixed(3) + '%' } }) : null));
  };
  return h('section', { class: `sec week-card m-${heating ? 'heat' : 'cool'}` },
    SectionLabel('Semaine · ' + (heating ? 'chauffage' : 'refroidissement')),
    h('div', { class: 'week' }, [0, 1, 2, 3, 4, 5, 6].map(dayRow)),
    h('div', { class: 'hours' }, ['0 h', '6 h', '12 h', '18 h', '24 h'].map(t => h('span', null, t))),
    h('div', { class: 'legend' },
      temps.slice(0, 3).map(t => h('span', { key: 't' + t }, h('i', { class: 'on', style: slotStyle({ temp: t, mode: 0 }, tMin, tMax) }), fmtC(t))),
      all.some(slotOff) ? h('span', { key: 'off' }, h('i', { class: 'off' }), 'Arrêt') : null),
    Hint('Touchez un jour pour le modifier.'),
    Button({ text: "Modifier aujourd'hui", icon: 'edit', kind: 'out', small: true, cls: 'mt', onClick: () => editDay(r, today) }));
}

function TemporaryCard(r, w) {
  const mk = r.heatingContext ? 'heat' : 'cool';
  if (r.derogationOn) {
    return Section({
      title: 'Consigne temporaire',
      children: [
        h('p', { class: `derog-now m-${mk}` }, `En cours : ${fmtC(r.target)}` + (r.derogationRemainingMin > 0 ? ` · encore ${fmtDuration(r.derogationRemainingMin)}` : '')),
        Hint('Le planning reprend ensuite automatiquement.'),
        Button({ text: 'Arrêter la consigne temporaire', kind: 'out', cls: 'mt', onClick: () => w(MgWrites.cancelDerogation()) }),
      ],
    });
  }
  const temp = prog.temp[r.id] ?? r.target ?? 20;
  const minutes = prog.minutes ?? S.derogationHours * 60;
  const can = r.isProg && r.on;
  return Section({
    title: 'Consigne temporaire',
    children: [
      h('div', { class: 'between' },
        h('span', { class: 'muted small' }, 'Forcer une température, puis revenir au planning.'),
        Stepper({ id: 'temp' + r.id, value: temp, min: r.minTarget, max: r.maxTarget, delay: 0, onCommit: t => { prog.temp[r.id] = t; } })),
      h('div', { class: 'gap14' }, Chips([30, 60, 120, 240, 480].map(m => Chip({ label: fmtDuration(m), selected: minutes === m, onClick: () => { prog.minutes = m; invalidate(); } })), true)),
      Button({ text: `Forcer ${fmtC(temp)} pendant ${fmtDuration(minutes)}`, icon: 'timer', disabled: !can, onClick: () => w(MgWrites.derogation(r, temp, minutes)) }),
      can ? null : Hint(!r.on ? 'Allumez le split pour forcer une température.' : 'Activez le planning pour utiliser la consigne temporaire.'),
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Édition d'un jour
// ---------------------------------------------------------------------------------------------

function editDay(r, day) {
  setOverlay({ type: 'day', roomId: r.id, day, slots: (r.schedule[day] || []).map(s => ({ ...s })), also: [] });
}

export function DaySheet() {
  const o = nav.overlay;
  const r = S.home.rooms.find(x => x.id === o.roomId);
  if (!r || r.scheduleBase == null) return null;
  const slots = o.slots;
  const sort = () => slots.sort((a, b) => a.minute - b.minute);
  const step = r.slotStepMinutes;
  const save = () => {
    const seen = new Set();
    const clean = [...slots].sort((a, b) => a.minute - b.minute).filter(s => (seen.has(s.minute) ? false : seen.add(s.minute)));
    writeCapabilities(r.device, MgWrites.schedule(r.scheduleBase, [o.day, ...o.also], clean));
    closeOverlay();
  };
  const add = () => {
    const last = slots.length ? Math.max(...slots.map(s => s.minute)) : null;
    let m = last == null ? 6 * 60 : Math.min(last + 60, 23 * 60 + 45);
    while (slots.some(s => s.minute === m) && m < 1439) m += step;
    const lastOn = [...slots].reverse().find(s => !slotOff(s));
    slots.push({ minute: Math.min(m, 1439), temp: lastOn?.temp ?? r.target ?? 20, mode: 0 });
    sort(); invalidate();
  };
  return Sheet({
    label: `Planning du ${DAY_LONG[o.day]}`,
    onClose: closeOverlay,
    children: [
      h('h2', { class: 'sheet-title' }, `Planning du ${DAY_LONG[o.day]}`),
      h('p', { class: 'muted small' }, `${r.name} · chaque créneau dure jusqu'au suivant.`),
      slots.length ? null : h('p', { class: 'muted' }, 'Aucun créneau : ajoutez-en un.'),
      h('div', { class: 'slots' }, slots.map((s, i) => h('div', { key: 'slot' + i, class: 'slot' },
        h('label', { class: 'time' },
          h('span', null, hhmm(s.minute)),
          h('input', {
            type: 'time', class: 'native', value: hhmm(s.minute), step: String(step * 60), 'aria-label': 'Début du créneau',
            onChange: e => {
              const [hh, mm] = e.target.value.split(':').map(Number);
              if (Number.isFinite(hh) && Number.isFinite(mm)) { s.minute = hh * 60 + Math.floor(mm / step) * step; sort(); invalidate(); }
            },
          })),
        h('span', { class: 'grow' }),
        slotOff(s) ? h('span', { class: 'off-label' }, 'Arrêt')
          : Stepper({ id: `slot${o.day}-${i}-${s.minute}`, value: s.temp, min: r.minTarget, max: r.maxTarget, delay: 0, onCommit: t => { s.temp = t; } }),
        h('button', {
          class: 'ibtn sm' + (slotOff(s) ? ' heat' : ''), 'aria-label': slotOff(s) ? 'Remettre une température' : "Mettre à l'arrêt",
          onClick: () => { if (slotOff(s)) { s.mode = 0; s.temp = r.target ?? 20; } else s.mode = 1; invalidate(); },
        }, Icon('power_settings_new')),
        h('button', { class: 'ibtn sm', 'aria-label': 'Supprimer', onClick: () => { slots.splice(i, 1); invalidate(); } }, Icon('delete'))))),
      Button({ text: 'Ajouter un créneau', icon: 'add', kind: 'out', small: true, disabled: slots.length >= r.maxSlotsPerDay, onClick: add }),
      SectionLabel('Appliquer aussi à'),
      h('div', { class: 'days' }, DAY_LETTER.map((l, d) => Chip({
        label: l, selected: d === o.day || o.also.includes(d), disabled: d === o.day,
        onClick: () => { o.also = o.also.includes(d) ? o.also.filter(x => x !== d) : [...o.also, d]; invalidate(); },
      }))),
      h('div', { class: 'two' },
        Button({ text: 'Annuler', kind: 'out', onClick: closeOverlay }),
        Button({ text: 'Enregistrer', onClick: save })),
    ],
  });
}
