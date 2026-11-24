// Mode avancé : toutes les capabilities de l'appareil, groupées, avec recherche et filtre.
import { h } from '../vdom.js';
import { S, invalidate, writeCapabilities } from '../store.js';
import { GROUPS, WRITABLE, capGroup, capInfo, displayName, formatCap, modifiedAt } from '../model.js';
import { back, closeOverlay, nav, setOverlay } from '../nav.js';
import { Chip, Chips, Content, Dialog, Icon, TextButton, TopBar, relativeAgo } from '../ui.js';

const adv = { deviceId: null, query: '', filter: 'all', collapsed: {} };
const DEFAULT_COLLAPSED = { Programmation: true, Système: true, Autres: true, 'Eau chaude': true };

export function AdvancedScreen(id, now) {
  const d = S.home.magellan.find(x => x.deviceId === id);
  if (!d) {
    return h('div', { class: 'screen' }, TopBar({ title: 'Mode avancé', nav: 'back', onNav: back }),
      Content(h('p', { class: 'muted center' }, "Cet appareil n'est plus disponible.")));
  }
  if (adv.deviceId !== id) Object.assign(adv, { deviceId: id, query: '', filter: 'all', collapsed: { ...DEFAULT_COLLAPSED } });
  const q = adv.query.trim().toLowerCase();
  const caps = [...d.capabilities].sort((a, b) => a.capabilityId - b.capabilityId).filter(c => {
    const label = (capInfo(c.capabilityId)?.label || '').toLowerCase();
    const wr = WRITABLE.has(c.capabilityId);
    const match = !q || String(c.capabilityId).includes(q) || label.includes(q);
    return match && (adv.filter === 'all' || (adv.filter === 'w' ? wr : !wr));
  });
  const groups = new Map();
  for (const c of caps) {
    const g = capGroup(c.capabilityId);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const setF = f => () => { adv.filter = f; invalidate(); };

  return h('div', { class: 'screen' },
    TopBar({ title: 'Mode avancé', subtitle: `${displayName(d)} · ${d.capabilities.length} commandes`, nav: 'back', onNav: back }),
    Content(
      h('label', { class: 'search' }, Icon('search'),
        h('input', {
          type: 'search', value: adv.query, placeholder: 'Rechercher (nom ou n°)', autocomplete: 'off', enterkeyhint: 'search',
          onInput: e => { adv.query = e.target.value; invalidate(); },
        })),
      Chips([
        Chip({ label: 'Toutes', selected: adv.filter === 'all', onClick: setF('all') }),
        Chip({ label: 'Modifiables', icon: 'edit', selected: adv.filter === 'w', onClick: setF('w') }),
        Chip({ label: 'Lecture seule', selected: adv.filter === 'r', onClick: setF('r') }),
      ]),
      h('div', { class: 'caution' }, Icon('warning'),
        h('span', null, "Les valeurs sont écrites telles quelles sur l'appareil. À utiliser en connaissance de cause.")),
      ...GROUPS.filter(g => groups.has(g)).map(g => {
        const rows = groups.get(g);
        const collapsed = !q && adv.collapsed[g] === true;
        const v = h('section', { class: 'card capgroup' },
          h('button', { class: 'cap-head', 'aria-expanded': collapsed ? 'false' : 'true', onClick: () => { adv.collapsed[g] = !adv.collapsed[g]; invalidate(); } },
            h('span', { class: 'label' }, g), h('span', { class: 'n' }, String(rows.length)), Icon(collapsed ? 'expand_more' : 'expand_less')),
          collapsed ? null : rows.map(c => capRow(d, c, now)));
        v.key = 'g:' + g;
        return v;
      }),
      caps.length ? null : h('p', { class: 'muted center' }, 'Aucune commande ne correspond.'),
      h('p', { class: 'mono' }, `deviceId ${d.deviceId} · productId ${d.productId ?? '?'} · modelId ${d.modelId ?? '?'}`),
    ));
}

function capRow(d, c, now) {
  const info = capInfo(c.capabilityId);
  const writable = WRITABLE.has(c.capabilityId);
  return h('button', {
    key: 'c' + c.capabilityId, class: 'cap',
    onClick: () => setOverlay({ type: 'cap', deviceId: d.deviceId, capId: c.capabilityId, value: c.value ?? '' }),
  },
  h('span', { class: 'id' }, '#' + c.capabilityId),
  h('span', { class: 'tx' },
    h('b', null, info?.label || `Capability ${c.capabilityId}`),
    c.modificationDate > 0 ? h('span', null, relativeAgo(modifiedAt(c), now)) : null),
  h('span', { class: 'val' }, info ? formatCap(info, c.value) : c.value ?? '—'),
  h('span', { class: 'ed' }, writable ? Icon('edit') : null));
}

/** Dialogue d'écriture d'une valeur brute. */
export function CapDialog() {
  const o = nav.overlay;
  const d = S.home.magellan.find(x => x.deviceId === o.deviceId);
  if (!d) return null;
  const c = d.capabilities.find(x => x.capabilityId === o.capId);
  const info = capInfo(o.capId);
  const en = info?.enum ? Object.entries(info.enum).slice(0, 4) : [];
  const submit = () => { writeCapabilities(d, [[o.capId, String(o.value).trim()]]); closeOverlay(); };
  return Dialog({
    title: info?.label || `Capability ${o.capId}`,
    onClose: closeOverlay,
    children: [
      h('p', { class: 'muted small' }, `#${o.capId} · valeur actuelle : ${info ? formatCap(info, c?.value ?? null) : c?.value ?? '—'}`),
      en.length ? Chips(en.map(([raw, label]) => Chip({ label, selected: String(o.value) === raw, onClick: () => { o.value = raw; invalidate(); } }))) : null,
      h('label', { class: 'field-input' },
        h('span', null, 'Valeur brute'),
        h('input', {
          type: 'text', value: o.value, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
          onInput: e => { o.value = e.target.value; },
          onKeydown: e => { if (e.key === 'Enter') submit(); },
        })),
      WRITABLE.has(o.capId) ? null : h('p', { class: 'danger small' }, "L'app officielle n'écrit jamais cette valeur : l'appareil risque de la refuser."),
    ],
    actions: [TextButton('Annuler', closeOverlay), TextButton('Écrire', submit, 'strong')],
  });
}
