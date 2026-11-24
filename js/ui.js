// Composants de l'interface « Épure » (port de ui/components/Epure.kt).
import { h } from './vdom.js';
import { invalidate } from './store.js';

// ---------------------------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------------------------

export const fmtC = v => (v == null ? '--' : v.toFixed(1).replace('.', ',') + '°');
export const pad2 = n => String(n).padStart(2, '0');
export const hhmm = m => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
export function fmtDuration(min) {
  if (min < 60) return `${min} min`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${Math.floor(min / 60)} h ${pad2(min % 60)}`;
}
export function relativeAgo(ms, now = Date.now()) {
  if (!ms || ms <= 0) return '—';
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  const d = new Date(ms);
  if (s < 20 * 3600) return `à ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `le ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDay = ms => DAY_FMT.format(new Date(ms));
export const fmtDayTime = ms => { const d = new Date(ms); return `${fmtDay(ms)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const fmtTime = ms => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

const stop = e => e.stopPropagation();

// ---------------------------------------------------------------------------------------------
// Éléments de base
// ---------------------------------------------------------------------------------------------

export const Icon = (name, opts = {}) => h('span', {
  class: 'ms' + (opts.fill ? ' f' : '') + (opts.cls ? ' ' + opts.cls : ''),
  'aria-hidden': 'true',
  style: opts.size ? { fontSize: opts.size + 'px' } : null,
}, name);

/** Points animés « • • • » : information encore attendue du serveur. */
export const Dots = (big = false) => h('span', { class: 'dots' + (big ? ' big' : ''), role: 'status', 'aria-label': 'Chargement' },
  h('i'), h('i'), h('i'));

export function TopBar({ title, subtitle, nav = 'menu', onNav, actions }) {
  const navIcon = nav === 'back' ? 'arrow_back' : nav === 'close' ? 'close' : 'menu';
  const navLabel = nav === 'back' ? 'Retour' : nav === 'close' ? 'Annuler' : 'Menu';
  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar-in' },
      h('button', { class: 'ibtn', 'aria-label': navLabel, onClick: onNav }, Icon(navIcon)),
      h('div', { class: 'tt' },
        h('h1', null, title),
        subtitle ? h('div', { class: 'sub' }, subtitle) : null),
      actions || null));
}

export const Content = (...kids) => h('main', { class: 'content' }, ...kids);

/** Carte ; appui long optionnel (réorganisation des pièces). */
export function Card({ onClick, longPressId, onLongPress, cls, children }) {
  const props = { class: 'card' + (cls ? ' ' + cls : '') };
  if (onClick) {
    props.onClick = e => { if (lp.fired) { lp.fired = false; e.preventDefault(); return; } onClick(e); };
    props.role = 'button';
    props.tabindex = '0';
  }
  if (onLongPress) Object.assign(props, longPress(longPressId, onLongPress));
  return h('article', props, ...children);
}

// Appui long : état global (survit aux rendus pendant l'appui).
const lp = { timer: null, fired: false, x: 0, y: 0, id: null };
function longPress(id, fn) {
  const cancel = () => { clearTimeout(lp.timer); lp.timer = null; };
  return {
    onPointerdown: e => {
      if (e.target.closest('button, input, .no-lp')) return;
      cancel(); lp.fired = false; lp.x = e.clientX; lp.y = e.clientY; lp.id = id;
      lp.timer = setTimeout(() => { lp.timer = null; lp.fired = true; navigator.vibrate?.(15); fn(); }, 550);
    },
    onPointermove: e => { if (lp.timer && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancel(); },
    onPointerup: cancel,
    onPointercancel: cancel,
    onContextmenu: e => e.preventDefault(),
  };
}

export function Section({ title, cls, children }) {
  return h('section', { class: 'sec' + (cls ? ' ' + cls : '') },
    title ? h('h2', { class: 'label' }, title) : null, ...children);
}

export const SectionLabel = text => h('h2', { class: 'label' }, text);

export function Pill(label, icon, modeKey) {
  return h('span', { class: `pill m-${modeKey || 'off'}` }, icon ? Icon(icon, { fill: true }) : null, label);
}

/** Interrupteur : couleur du mode quand il est actif (modeKey), sinon couleur principale. */
export function Switch({ checked, onChange, modeKey, disabled, label }) {
  return h('button', {
    class: 'sw' + (checked ? ' on' : '') + (modeKey ? ` m-${modeKey}` : ' plain'),
    role: 'switch', 'aria-checked': checked ? 'true' : 'false', 'aria-label': label || null,
    disabled: !!disabled,
    onClick: e => { stop(e); if (!disabled) onChange(!checked); },
  }, h('i'));
}

// ---------------------------------------------------------------------------------------------
// Réglage de consigne −/+ (valeur « brouillon » envoyée 1,3 s après la dernière pression)
// ---------------------------------------------------------------------------------------------

const drafts = new Map(); // id → { value, timer }

function bump(id, base, delta, o) {
  const d = drafts.get(id);
  const cur = d ? d.value : base ?? (o.min + o.max) / 2;
  const next = Math.min(o.max, Math.max(o.min, Math.round((cur + delta) / o.step) * o.step));
  if (d) clearTimeout(d.timer);
  if (!o.delay) {
    drafts.delete(id);
    o.onCommit(next);
    invalidate();
    return;
  }
  const entry = { value: next, timer: null };
  entry.timer = setTimeout(() => { drafts.delete(id); o.onCommit(next); invalidate(); }, o.delay);
  drafts.set(id, entry);
  navigator.vibrate?.(5);
  invalidate();
}

export function Stepper({ id, value, min, max, step = 0.5, delay = 1300, onCommit, modeKey, big = false, label }) {
  const d = drafts.get(id);
  const shown = d ? d.value : value;
  const o = { min, max, step, delay, onCommit };
  const btn = (icon, aria, delta, enabled) => h('button', {
    class: 'b', 'aria-label': aria, disabled: !enabled,
    onClick: e => { stop(e); if (enabled) bump(id, value, delta, o); },
  }, Icon(icon));
  const canDown = (shown ?? max) > min, canUp = (shown ?? min) < max;
  if (big) {
    return h('div', { class: `bigstep m-${modeKey || 'off'}` },
      btn('remove', 'Baisser la consigne', -step, canDown),
      h('div', { class: 'v' }, fmtC(shown), h('small', null, label)),
      btn('add', 'Monter la consigne', step, canUp));
  }
  return h('div', { class: 'step' + (d ? ' drafting' : '') + (modeKey ? ` m-${modeKey}` : ''), onClick: stop },
    btn('remove', 'Baisser', -step, canDown),
    h('span', { class: 'v' }, fmtC(shown)),
    btn('add', 'Augmenter', step, canUp));
}

// ---------------------------------------------------------------------------------------------
// Sélecteurs
// ---------------------------------------------------------------------------------------------

/** Barre de choix segmentée ; options : {value, label, icon?, modeKey?}. */
export function Segmented({ options, selected, onSelect, disabled }) {
  const tall = options.some(o => o.icon);
  return h('div', { class: 'seg' + (tall ? ' tall' : '') + (disabled ? ' dis' : ''), role: 'radiogroup' },
    options.map(o => {
      const sel = o.value === selected;
      return h('button', {
        key: String(o.value),
        class: 'o' + (sel ? ' sel' : '') + (o.modeKey ? ` m-${o.modeKey}` : ''),
        role: 'radio', 'aria-checked': sel ? 'true' : 'false', disabled: !!disabled,
        onClick: e => { stop(e); if (!disabled && !sel) onSelect(o.value); },
      }, o.icon ? Icon(o.icon, { fill: sel }) : null, h('span', null, o.label));
    }));
}

export function Chip({ label, selected, onClick, icon, disabled }) {
  return h('button', {
    class: 'chip' + (selected ? ' sel' : ''), disabled: !!disabled, 'aria-pressed': selected ? 'true' : 'false',
    onClick: e => { stop(e); if (!disabled) onClick(); },
  }, icon ? Icon(icon) : null, label);
}

export const Chips = (kids, scroll = false) => h('div', { class: 'chips' + (scroll ? ' scroll' : '') }, ...kids);

// ---------------------------------------------------------------------------------------------
// Lignes, bandeaux, boutons
// ---------------------------------------------------------------------------------------------

export const IconTile = (icon, opts = {}) => h('span', {
  class: 'tile' + (opts.modeKey ? ` m-${opts.modeKey} tinted` : '') + (opts.tone ? ` t-${opts.tone}` : '') + (opts.large ? ' lg' : ''),
}, Icon(icon));

export function OptionRow({ icon, title, subtitle, checked, disabled, onChange, modeKey }) {
  return h('div', { class: 'row' },
    IconTile(icon),
    h('div', { class: 'tx' }, h('b', null, title), subtitle ? h('span', null, subtitle) : null),
    Switch({ checked, onChange, modeKey: checked ? modeKey : null, disabled, label: title }));
}

export const KeyValue = (label, value, trailing) => h('div', { class: 'kv' },
  h('span', { class: 'k' }, label), trailing || null, h('span', { class: 'v' }, value));

export function Banner({ icon, title, text, tone = 'info', onClick }) {
  const inner = [
    Icon(icon),
    h('div', { class: 'tx' }, h('b', null, title), text ? h('span', null, text) : null),
    onClick ? Icon('chevron_right') : null,
  ];
  return onClick
    ? h('button', { class: `banner t-${tone}`, onClick }, ...inner)
    : h('div', { class: `banner t-${tone}` }, ...inner);
}

export const Hint = (text, icon = 'info') => h('p', { class: 'hint' }, Icon(icon), h('span', null, text));

/** kind : fill | out | ghost | danger. */
export function Button({ text, onClick, icon, kind = 'fill', disabled, trailing, chevron, small, cls }) {
  return h('button', {
    class: `btn ${kind}` + (small ? ' sm' : '') + (trailing || chevron ? ' wide' : '') + (cls ? ' ' + cls : ''),
    disabled: !!disabled,
    onClick: e => { stop(e); if (!disabled) onClick(); },
  },
  icon ? Icon(icon) : null,
  h('span', { class: trailing || chevron ? 'grow' : null }, text),
  trailing ? h('span', { class: 'trail' }, trailing) : null,
  chevron ? Icon('chevron_right') : null);
}

/** Logo de l'app (icône A). */
export const Logo = (size = 48) => h('img', {
  class: 'logo', src: 'icons/icon.svg', alt: '', width: size, height: size,
  style: { width: size + 'px', height: size + 'px', borderRadius: Math.round(size * 0.28) + 'px' },
});

// ---------------------------------------------------------------------------------------------
// Feuilles et boîtes de dialogue
// ---------------------------------------------------------------------------------------------

export function Sheet({ onClose, children, label }) {
  return h('div', { class: 'overlay sheet-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': label || null },
    h('div', { class: 'scrim', onClick: onClose }),
    h('div', { class: 'sheet' }, h('div', { class: 'grab' }), ...children));
}

export function Dialog({ title, children, actions, onClose }) {
  return h('div', { class: 'overlay dialog-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'scrim', onClick: onClose }),
    h('div', { class: 'dialog' },
      h('h2', null, title),
      h('div', { class: 'dialog-body' }, ...children),
      h('div', { class: 'dialog-actions' }, ...actions)));
}

export const TextButton = (text, onClick, cls) => h('button', { class: 'tbtn' + (cls ? ' ' + cls : ''), onClick }, text);

// Couleurs d'un mode Magellan (clé CSS).
export const modeKeyOf = s => (s ? s.key : 'off');
