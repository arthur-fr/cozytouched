// Détail d'une pièce : toutes les commandes du split en sections, Mode avancé en bas de page.
import { h } from '../vdom.js';
import { S, lastServiceFor, retryFailed, writeCapabilities } from '../store.js';
import { Caps, COOL, FAN, MgWrites, familyLabel, has, displayName } from '../model.js';
import { back, open } from '../nav.js';
import {
  Banner, Button, Content, Dots, Hint, IconTile, OptionRow, Section, Segmented, Stepper, Switch, TextButton, TopBar,
  fmtC, fmtDuration, fmtTime, modeKeyOf, relativeAgo,
} from '../ui.js';

function statusText(r) {
  if (!r.on) return "Le split est à l'arrêt";
  if (r.requested === FAN) return 'Ventilation seule';
  if (!r.runningNow) return 'En veille · consigne atteinte';
  if (r.inProgress === COOL || (r.inProgress == null && !r.heatingContext)) return 'Refroidit en ce moment';
  return 'Chauffe en ce moment';
}

export function RoomScreen(id, now) {
  const r = S.home.rooms.find(x => x.id === id);
  if (!r) {
    return h('div', { class: 'screen' }, TopBar({ title: 'Pièce', nav: 'back', onNav: back }),
      Content(Section({ children: [h('p', { class: 'muted' }, "Cette pièce n'est plus disponible.")] })));
  }
  const w = writes => writeCapabilities(r.device, writes);
  const busy = S.pending.has(id);
  const mk = r.on ? modeKeyOf(r.requested) : 'off';
  const hubLabel = r.hub ? familyLabel(r.hub) || displayName(r.hub) : null;
  const derogMinutes = S.derogationHours * 60;
  const failure = S.failures[id];
  const hasOptions = [r.powerful, r.energySaving, r.swing, r.roomBoost, r.windowDetection].some(v => v != null);

  return h('div', { class: 'screen' },
    TopBar({
      title: r.name, nav: 'back', onNav: back,
      subtitle: [r.kind, hubLabel ? hubLabel[0].toLowerCase() + hubLabel.slice(1) : null].filter(Boolean).join(' · '),
    }),
    Content(
      failure ? Banner({ icon: 'error', title: "La dernière commande n'a pas abouti", text: `${failure} · toucher pour réessayer`, tone: 'danger', onClick: () => retryFailed(id) }) : null,
      r.windowOpen ? Banner({ icon: 'window', title: 'Fenêtre ouverte détectée', text: r.windowSince ? `Dans cette pièce depuis ${fmtTime(r.windowSince)}` : 'Dans cette pièce', tone: 'warn' }) : null,
      r.errors.length ? Banner({ icon: 'warning', title: 'Défaut ' + r.errors.join(', '), text: "Signalé par l'équipement", tone: 'danger' }) : null,

      // --- Marche, température de la pièce, consigne
      h('section', { class: 'sec hero' },
        h('div', { class: 'row first' },
          IconTile('power_settings_new', { modeKey: mk }),
          h('div', { class: 'tx' },
            h('b', null, r.on ? 'Allumé' : 'Éteint'),
            busy && r.on ? Dots() : h('span', null, statusText(r))),
          has(r.device, Caps.SERVICE_REQUESTED)
            ? Switch({ checked: r.on, modeKey: r.on ? mk : null, label: 'Marche / arrêt', onChange: on => w(MgWrites.power(r, on, lastServiceFor(id))) })
            : null),
        h('div', { class: 'now' },
          h('span', { class: 'temp' }, fmtC(r.ambient)),
          h('span', { class: 'sub' }, r.ambient == null ? 'température non remontée' : 'dans la pièce')),
        r.ambientReliable === false ? Hint("Mesurée par l'unité intérieure du split : elle peut monter vite quand il souffle de l'air chaud.") : null,
        r.on && r.canEditTarget ? h('div', { class: 'hero-target' },
          Stepper({
            id: 'detail' + id, big: true, value: r.target, min: r.minTarget, max: r.maxTarget, modeKey: mk,
            label: r.isProg && !r.derogationOn ? `Forcer pendant ${fmtDuration(derogMinutes)}` : r.heatingContext ? 'Consigne chauffage' : 'Consigne refroidissement',
            onCommit: t => w(MgWrites.target(r, t, derogMinutes)),
          }),
          r.derogationOn ? h('div', { class: `derog m-${mk}` },
            h('span', null, 'Consigne forcée' + (r.derogationRemainingMin > 0 ? ` · encore ${fmtDuration(r.derogationRemainingMin)}` : '')),
            TextButton('Reprendre le planning', () => w(MgWrites.cancelDerogation()))) : null) : null),

      // --- Mode
      r.services.length > 1 ? Section({
        title: 'Mode',
        children: [
          Segmented({
            options: r.services.slice(0, 5).map(s => ({ value: s.raw, label: s.label, icon: s.icon, modeKey: s.key })),
            selected: r.on ? r.requested.raw : null,
            onSelect: raw => w(MgWrites.service(r.services.find(s => s.raw === raw))),
          }),
          !r.on ? Hint('Choisir un mode allume le split.') : null,
        ],
      }) : null,

      // --- Pilotage
      r.modes.length > 1 ? Section({
        title: 'Pilotage',
        children: [
          Segmented({
            options: r.modes.map(([raw, label]) => ({ value: raw, label: raw === '1' ? 'Planning' : label })),
            selected: r.mode, onSelect: m => w(MgWrites.mode(m)),
          }),
          Hint(`En planning, changer la consigne la force pendant ${fmtDuration(derogMinutes)} (réglable dans Paramètres).`),
        ],
      }) : null,

      // --- Ventilation
      r.fans.length ? Section({
        title: 'Ventilation',
        children: [Segmented({
          options: r.fans.map(([raw, label]) => ({ value: raw, label })), selected: r.fanChoice, disabled: !r.on,
          onSelect: v => w(MgWrites.fanChoice(r, v)),
        })],
      }) : null,

      // --- Options
      hasOptions ? h('section', { class: 'sec rows' },
        r.powerful != null ? OptionRow({ icon: 'bolt', title: 'Powerful', subtitle: 'Puissance maximale pour atteindre vite la consigne', checked: r.powerful, disabled: !r.on, modeKey: mk, onChange: v => w(MgWrites.flag(Caps.POWERFUL, v)) }) : null,
        r.energySaving != null ? OptionRow({ icon: 'energy_savings_leaf', title: 'Éco', subtitle: 'Réduit la consommation', checked: r.energySaving, disabled: !r.on, onChange: v => w(MgWrites.flag(Caps.ENERGY_SAVING, v)) }) : null,
        r.swing != null ? OptionRow({ icon: 'swap_vert', title: 'Balayage', subtitle: 'Les volets oscillent en continu', checked: r.swing, onChange: v => w(MgWrites.flag(Caps.SWING, v)) }) : null,
        r.roomBoost != null ? OptionRow({ icon: 'rocket_launch', title: 'Boost', subtitle: 'Relance la pièce pendant un moment', checked: r.roomBoost, disabled: !r.on, onChange: v => w(MgWrites.flag(Caps.ROOM_BOOST, v)) }) : null,
        r.windowDetection != null ? OptionRow({ icon: 'window', title: 'Détection fenêtre ouverte', subtitle: 'Le split signale une fenêtre restée ouverte', checked: r.windowDetection, onChange: v => w(MgWrites.flag(Caps.WINDOW_DETECTION, v)) }) : null) : null,

      // --- Volets
      r.hasFlaps ? Section({
        title: 'Position des volets',
        children: [
          Segmented({
            options: [1, 2, 3, 4].map(p => ({ value: p, label: String(p) })),
            selected: r.swing === true ? null : r.flap, onSelect: p => w(MgWrites.flap(r, p)),
          }),
          r.swing === true ? Hint('Choisir une position arrête le balayage.') : null,
        ],
      }) : null,

      Button({ text: 'Mode avancé', icon: 'tune', kind: 'out', trailing: `${r.device.capabilities.length} commandes`, chevron: true, onClick: () => open('adv', id) }),
      h('p', { class: 'updated' }, 'Mis à jour ' + relativeAgo(S.lastUpdate, now)),
    ));
}
