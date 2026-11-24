// Accueil (proposition A) : une carte par pièce, bandeaux seulement quand il y a quelque chose à signaler.
import { h } from '../vdom.js';
import {
  S, invalidate, lastServiceFor, refresh, retryFailed, setRoomOrder, writeCapabilities,
} from '../store.js';
import { Caps, FAN, COOL, MgWrites, absenceHubs, absencePeriod, cap, displayName, has } from '../model.js';
import { nav, open, go, setDrawer } from '../nav.js';
import { InstallCard } from './shell.js';
import {
  Banner, Button, Card, Content, Dots, Hint, Icon, IconTile, OptionRow, Pill, Segmented, Stepper, Switch, TextButton,
  TopBar, fmtC, fmtDay, fmtDuration, fmtTime, modeKeyOf, plural, relativeAgo,
} from '../ui.js';

const keyed = (v, k) => { v.key = k; return v; };

export function absenceSummary(hub) {
  const p = absencePeriod(hub);
  if (!p) return null;
  const [s, e] = p;
  return e == null ? `Depuis le ${fmtDay(s)}` : `Du ${fmtDay(s)} au ${fmtDay(e)}`;
}

function banners() {
  const out = [];
  if (S.demo) out.push({ key: 'demo', icon: 'info', title: 'Mode démo', text: 'Les commandes sont simulées.', tone: 'neutral' });
  const roomIds = new Set(S.home.rooms.map(r => r.id));
  for (const [id, msg] of Object.entries(S.failures)) {
    if (roomIds.has(Number(id))) continue;
    const d = S.home.magellan.find(x => x.deviceId === Number(id));
    out.push({
      key: 'fail' + id, icon: 'warning', title: `Commande non aboutie · ${d ? displayName(d) : 'Appareil'}`,
      text: `${msg} · toucher pour réessayer`, tone: 'danger', onClick: () => retryFailed(Number(id)),
    });
  }
  for (const r of S.home.rooms.filter(x => x.windowOpen)) {
    out.push({
      key: 'win' + r.id, icon: 'window', title: `Fenêtre ouverte · ${r.name}`,
      text: r.windowSince ? `Détectée à ${fmtTime(r.windowSince)}` : 'Détectée par le split', tone: 'warn',
      onClick: () => open('room', r.id),
    });
  }
  for (const r of S.home.rooms.filter(x => x.errors.length)) {
    out.push({
      key: 'err' + r.id, icon: 'warning', title: `Défaut · ${r.name}`, text: 'Code ' + r.errors.join(', '), tone: 'danger',
      onClick: () => open('room', r.id),
    });
  }
  for (const hub of absenceHubs(S.home.magellan)) {
    const st = cap(hub, Caps.ABSENCE_HOME_STATE)?.trim();
    if (st === '1' || st === '2') {
      out.push({
        key: 'abs' + hub.deviceId, icon: 'luggage', title: st === '1' ? 'Absence en cours' : 'Absence prévue',
        text: absenceSummary(hub), tone: 'info', onClick: () => go('absence'),
      });
    }
  }
  if (S.home.gateways.some(g => !g.alive)) {
    out.push({
      key: 'offline', icon: 'cloud_off', title: 'Passerelle hors ligne', text: 'Les valeurs affichées peuvent être anciennes.',
      tone: 'warn', onClick: () => go('devices'),
    });
  }
  return out;
}

function homeSubtitle(now) {
  if (S.demo) return 'Logement de démonstration';
  if (!S.lastUpdate) return 'Chargement…';
  const updated = 'à jour ' + relativeAgo(S.lastUpdate, now);
  const rooms = S.home.rooms;
  if (!rooms.length) return updated[0].toUpperCase() + updated.slice(1);
  const on = rooms.filter(r => r.on).length;
  const splits = rooms.every(r => r.kind === 'Split');
  const noun = splits ? (on > 1 ? 'splits' : 'split') : (on > 1 ? 'pièces' : 'pièce');
  return on === 0 ? `Tout est à l'arrêt · ${updated}` : `${on} ${noun} en marche · ${updated}`;
}

function fanLabel(r) {
  return { quiet: 'Ventilation silence', 5: 'Ventilation auto', 1: 'Ventilation basse', 2: 'Ventilation moyenne', 3: 'Ventilation haute' }[r.fanChoice] || null;
}

function footer(r) {
  if (r.windowOpen) return 'Fenêtre ouverte';
  if (r.errors.length) return 'Défaut ' + r.errors.join(', ');
  if (!r.on) { const s = lastServiceFor(r.id); return s ? `Dernier mode : ${s.long}` : `${r.kind} à l'arrêt`; }
  if (r.derogationOn) return 'Forcé' + (r.derogationRemainingMin > 0 ? ` · encore ${fmtDuration(r.derogationRemainingMin)}` : '');
  const parts = [fanLabel(r), r.swing === true ? 'Balayage' : null, r.isProg ? 'Planning' : null, r.powerful === true ? 'Powerful' : null].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  if (r.runningNow) return r.inProgress === COOL ? 'Refroidit en ce moment' : 'Chauffe en ce moment';
  return 'En veille';
}

export const write = (device, writes) => writeCapabilities(device, writes);

function startReorder() {
  nav.reorder = S.home.rooms.map(r => r.id);
  invalidate();
}

function RoomCard(r) {
  const id = r.id;
  const failure = S.failures[id];
  const loading = S.refreshing || !S.lastUpdate;
  const mk = r.on ? modeKeyOf(r.requested) : 'off';
  const card = Card({
    cls: 'room' + (r.on ? '' : ' off'),
    onClick: () => open('room', id),
    longPressId: id,
    onLongPress: S.home.rooms.length > 1 ? startReorder : null,
    children: [
      h('div', { class: 'room-h' },
        h('h3', null, r.name),
        r.on ? Pill(r.requested.long, r.requested.icon, mk) : Pill('Arrêt', 'power_settings_new', 'off'),
        has(r.device, Caps.SERVICE_REQUESTED)
          ? Switch({ checked: r.on, modeKey: r.on ? mk : null, label: `${r.name} : marche / arrêt`, onChange: on => write(r.device, MgWrites.power(r, on, lastServiceFor(id))) })
          : null),
      h('div', { class: 'room-b' },
        h('div', { class: 'temp' },
          r.ambient == null && loading ? Dots(true) : fmtC(r.ambient),
          h('small', null, r.ambient == null && !loading ? 'température non remontée' : 'dans la pièce')),
        r.on && r.canEditTarget
          ? h('div', { class: 'stepw' },
            h('span', { class: 'lbl' }, r.isProg && !r.derogationOn ? 'Forcer à' : 'Consigne'),
            Stepper({
              id: 'card' + id, value: r.target, min: r.minTarget, max: r.maxTarget, modeKey: mk,
              onCommit: t => write(r.device, MgWrites.target(r, t, S.derogationHours * 60)),
            }))
          : r.on && r.requested === FAN ? h('span', { class: 'fan-only' }, 'Ventilation seule') : null),
      h('button', {
        class: 'room-f' + (failure ? ' fail' : r.windowOpen ? ' warn' : ''),
        onClick: e => { e.stopPropagation(); if (failure) retryFailed(id); else open('room', id); },
      },
      failure ? Icon('error') : null,
      h('span', { class: 'ft' }, failure ? 'Commande non aboutie · Réessayer' : footer(r)),
      h('span', { class: 'go' }, 'Détails', Icon('chevron_right'))),
    ],
  });
  return keyed(card, 'room' + id);
}

function DhwCard(d) {
  const busy = S.pending.has(d.id);
  const status = (busy ? 'Envoi en cours…' : d.on === false ? 'Arrêté' : d.boost ? 'Boost en cours' : d.heating ? 'En chauffe' : 'En service')
    + (d.setpoint != null ? ` · consigne ${Math.round(d.setpoint)}°` : '');
  const card = Card({
    cls: 'dhw',
    children: [
      h('div', { class: 'row first' },
        IconTile('shower', { modeKey: d.on === false ? null : 'cool' }),
        h('div', { class: 'tx' }, h('b', null, d.name), h('span', null, status)),
        d.on != null ? Switch({ checked: d.on, modeKey: d.on ? 'cool' : null, label: `${d.name} : marche / arrêt`, onChange: on => write(d.device, MgWrites.dhwPower(on)) }) : null),
      d.stateOfCharge != null ? h('div', { class: 'soc' },
        h('div', { class: 'soc-h' }, h('span', null, 'Eau chaude disponible'), h('b', null, `${d.stateOfCharge} %`)),
        h('div', { class: 'soc-bar' }, h('i', { style: { width: d.stateOfCharge + '%' } }))) : null,
      d.setpoint != null ? h('div', { class: 'row' },
        h('div', { class: 'tx' }, h('b', null, "Température de l'eau")),
        Stepper({ id: 'dhw' + d.id, value: d.setpoint, min: d.min, max: d.max, step: d.step, modeKey: 'cool', onCommit: t => write(d.device, MgWrites.dhwSetpoint(t)) })) : null,
      d.modes.length > 1 ? h('div', { class: 'dhw-modes' }, Segmented({
        options: d.modes.map(([raw, label]) => ({ value: raw, label })), selected: d.mode, disabled: d.on === false,
        onSelect: m => write(d.device, MgWrites.dhwMode(m)),
      })) : null,
      has(d.device, Caps.DHW_BOOST) ? OptionRow({
        icon: 'bolt', title: 'Boost 1 h', subtitle: 'Chauffe immédiate du ballon', checked: d.boost, modeKey: 'heat',
        onChange: on => write(d.device, MgWrites.dhwBoost(on)),
      }) : null,
      h('div', { class: 'card-foot' }, Button({ text: 'Toutes les données', kind: 'out', small: true, chevron: true, onClick: () => open('adv', d.id) })),
    ],
  });
  return keyed(card, 'dhw' + d.id);
}

export function HomeSkeleton() {
  const ghost = i => h('article', { key: 'sk' + i, class: 'card room skeleton' },
    h('div', { class: 'room-h' }, h('i', { class: 'ghost w120' }), h('i', { class: 'ghost sw-ghost' })),
    h('div', { class: 'room-b' }, h('div', { class: 'temp' }, Dots(true), h('small', null, 'dans la pièce'))));
  return h('div', { class: 'screen' },
    TopBar({ title: 'Mon logement', subtitle: 'Chargement…', nav: 'menu', onNav: () => {} }),
    Content(ghost(0), ghost(1), ghost(2)));
}

export function HomeScreen(now) {
  if (nav.reorder) return ReorderScreen();
  const rooms = S.home.rooms;
  const empty = !S.home.magellan.length && !S.refreshing;
  return h('div', { class: 'screen' },
    TopBar({
      title: 'Mon logement', subtitle: homeSubtitle(now), nav: 'menu', onNav: () => setDrawer(true),
      actions: h('button', { class: 'ibtn' + (S.refreshing ? ' spin' : ''), 'aria-label': 'Actualiser', onClick: () => refresh() }, Icon('refresh')),
    }),
    Content(
      ...banners().map(b => keyed(Banner(b), b.key)),
      InstallCard(),
      ...rooms.map(RoomCard),
      rooms.length > 1 ? keyed(h('button', { class: 'order-hint', onClick: startReorder }, Icon('swap_vert'), "Appui long sur une carte pour changer l'ordre"), 'order-hint') : null,
      ...S.home.dhws.map(DhwCard),
      empty ? keyed(h('div', { class: 'empty' },
        Icon('router', { size: 56 }),
        h('b', null, 'Aucun équipement trouvé'),
        h('span', null, S.connected ? 'Le compte ne contient pas d\'appareil Wi-Fi / Bridge V2.' : 'Les serveurs Atlantic sont injoignables pour le moment.'),
        Button({ text: 'Réessayer', icon: 'refresh', kind: 'out', onClick: () => refresh() })), 'empty') : null,
    ));
}

// ---------------------------------------------------------------------------------------------
// Ordre des pièces : glisser la poignée ≡ ou utiliser les flèches
// ---------------------------------------------------------------------------------------------

const drag = { id: null, from: 0, to: 0, startY: 0, dy: 0, h: 0 };

function moveItem(list, from, to) {
  const a = list.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

function ReorderScreen() {
  const ids = nav.reorder;
  const byId = new Map(S.home.rooms.map(r => [r.id, r]));
  const n = ids.length;
  const offset = i => {
    if (drag.id == null) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.h;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.h;
    return 0;
  };
  const handle = (id, i) => ({
    onPointerdown: e => {
      e.preventDefault();
      const row = e.currentTarget.closest('.rrow');
      Object.assign(drag, { id, from: i, to: i, startY: e.clientY, dy: 0, h: row.offsetHeight + 8 });
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
      invalidate();
    },
    onPointermove: e => {
      if (drag.id !== id) return;
      drag.dy = e.clientY - drag.startY;
      drag.to = Math.max(0, Math.min(n - 1, drag.from + Math.round(drag.dy / drag.h)));
      invalidate();
    },
    onPointerup: () => {
      if (drag.id !== id) return;
      if (drag.to !== drag.from) nav.reorder = moveItem(ids, drag.from, drag.to);
      drag.id = null;
      invalidate();
    },
    onPointercancel: () => { drag.id = null; invalidate(); },
  });
  const done = () => { setRoomOrder(nav.reorder); nav.reorder = null; invalidate(); };
  return h('div', { class: 'screen' },
    TopBar({
      title: 'Ordre des pièces', subtitle: 'Glissez ≡ ou utilisez les flèches', nav: 'close',
      onNav: () => { nav.reorder = null; invalidate(); },
      actions: TextButton('Terminé', done, 'strong'),
    }),
    Content(
      h('div', { class: 'reorder' }, ids.map((id, i) => {
        const r = byId.get(id);
        if (!r) return null;
        const dragging = drag.id === id;
        return h('div', {
          key: 'r' + id, class: 'rrow card' + (dragging ? ' dragging' : ''),
          style: { transform: `translateY(${offset(i)}px)` },
        },
        h('span', { class: 'handle', 'aria-label': `Déplacer ${r.name}`, ...handle(id, i) }, Icon('drag_handle')),
        h('div', { class: 'tx' }, h('b', null, r.name), h('span', null, r.on ? `${r.requested.long} · ${fmtC(r.ambient)}` : `Arrêt · ${fmtC(r.ambient)}`)),
        h('button', { class: 'ibtn sm', 'aria-label': `Monter ${r.name}`, disabled: i === 0, onClick: () => { nav.reorder = moveItem(ids, i, i - 1); invalidate(); } }, Icon('arrow_upward')),
        h('button', { class: 'ibtn sm', 'aria-label': `Descendre ${r.name}`, disabled: i === n - 1, onClick: () => { nav.reorder = moveItem(ids, i, i + 1); invalidate(); } }, Icon('arrow_downward')));
      })),
      Hint("L'ordre est enregistré sur cet appareil et repris dans toute l'app (Programmer, Appareils)."),
    ));
}
