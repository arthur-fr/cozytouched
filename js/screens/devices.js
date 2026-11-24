// Appareils Wi-Fi / Bridge : passerelles, hubs (signal, connexion, défauts) et pièces rattachées.
import { h } from '../vdom.js';
import { S, refresh } from '../store.js';
import { Caps, HUBS, UI_ONLY, cap, capInt, displayName, familyLabel, parseErrors, typeOf } from '../model.js';
import { open, setDrawer } from '../nav.js';
import { Button, Content, Hint, IconTile, KeyValue, SectionLabel, TopBar, plural, relativeAgo } from '../ui.js';

const masked = serial => {
  const s = (serial || '').replace(/[^0-9A-Za-z]/g, '');
  return s ? '•••• ' + s.slice(-4) : '—';
};

function wifiQuality(rssi) {
  if (rssi > -50) return ['excellent', 4];
  if (rssi > -60) return ['bon', 3];
  if (rssi > -70) return ['faible', 2];
  return ['très faible', 1];
}

const StateDot = (ok, label) => h('span', { class: 'state' + (ok ? '' : ' bad') }, h('i', { class: 'dot' }), label);
const Bars = level => h('span', { class: 'bars' }, [1, 2, 3, 4].map(i => h('i', { class: i <= level ? '' : 'no', style: { height: 2 + i * 3 + 'px' } })));

export function DevicesScreen(now) {
  const shown = new Set([...S.home.rooms.map(r => r.id), ...S.home.dhws.map(d => d.id)]);
  const others = S.home.magellan.filter(d => !shown.has(d.deviceId) && !UI_ONLY.has(typeOf(d)));
  const hubs = others.filter(d => HUBS.has(typeOf(d)));
  const rest = others.filter(d => !HUBS.has(typeOf(d)));
  return h('div', { class: 'screen' },
    TopBar({ title: 'Appareils Wi-Fi / Bridge', subtitle: 'Mis à jour ' + relativeAgo(S.lastUpdate, now), nav: 'menu', onNav: () => setDrawer(true) }),
    Content(
      ...S.home.gateways.map(g => h('section', { key: 'gw' + g.id, class: 'sec rows' },
        h('div', { class: 'row' },
          IconTile('router'),
          h('div', { class: 'tx' }, h('b', null, 'Passerelle Cozytouch'), h('span', null, g.typeLabel)),
          StateDot(g.alive, g.alive ? 'En ligne' : 'Hors ligne')),
        KeyValue('Numéro de série', masked(g.serial)),
        KeyValue('Service', 'Atlantic (Magellan)'))),
      ...hubs.map(hub => HubCard(hub)),
      ...rest.map(d => h('section', { key: 'o' + d.deviceId, class: 'sec rows' },
        h('div', { class: 'row' },
          IconTile('data_object'),
          h('div', { class: 'tx' }, h('b', null, displayName(d)), h('span', null, familyLabel(d) || 'Appareil'))),
        h('div', { class: 'card-foot' }, Button({ text: 'Toutes les données', kind: 'out', small: true, chevron: true, onClick: () => open('adv', d.deviceId) })))),
      !S.home.gateways.length && !hubs.length && !rest.length ? h('section', { class: 'sec' }, h('p', { class: 'muted' }, 'Aucune passerelle trouvée.')) : null,
      Hint("L'ajout d'un nouvel appareil se fait encore depuis l'app officielle Cozytouch."),
      Button({ text: S.refreshing ? 'Actualisation…' : 'Actualiser', icon: 'refresh', kind: 'out', disabled: S.refreshing, onClick: () => refresh() }),
    ));
}

function HubCard(hub) {
  const rooms = S.home.rooms.filter(r => r.hub?.deviceId === hub.deviceId);
  const errors = parseErrors(cap(hub, Caps.ERROR_HOME));
  const rssiRaw = capInt(hub, Caps.WIFI_RSSI);
  const rssi = rssiRaw != null && rssiRaw < 0 ? rssiRaw : null;
  const connected = cap(hub, Caps.WIFI_CONNECTED)?.trim() ?? null;
  return h('section', { key: 'hub' + hub.deviceId, class: 'sec rows' },
    h('div', { class: 'row' },
      IconTile('hub'),
      h('div', { class: 'tx' },
        h('b', null, familyLabel(hub) || displayName(hub)),
        h('span', null, 'Unité extérieure' + (rooms.length ? ' · ' + plural(rooms.length, 'pièce') : ''))),
      StateDot(!errors.length && connected !== '1', errors.length ? 'Défaut' : 'OK')),
    rssi != null ? (() => { const [q, level] = wifiQuality(rssi); return KeyValue('Signal Wi-Fi', `${rssi} dBm · ${q}`, Bars(level)); })() : null,
    connected != null ? KeyValue('Connexion Wi-Fi', connected === '0' ? 'Connecté' : 'Déconnecté') : null,
    KeyValue('Défauts', errors.length ? errors.join(', ') : 'Aucun'),
    rooms.length ? h('div', { class: 'attached' },
      SectionLabel('Pièces rattachées'),
      rooms.map(r => h('div', { key: 'm' + r.id, class: 'mini' },
        h('i', { class: 'dot' + (r.errors.length ? ' bad' : '') }), h('span', { class: 'n' }, r.name), h('span', { class: 's' }, r.kind)))) : null,
    h('div', { class: 'card-foot' }, Button({ text: 'Toutes les données', kind: 'out', small: true, chevron: true, onClick: () => open('adv', hub.deviceId) })));
}
