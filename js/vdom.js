// Mini moteur de rendu (DOM virtuel) sans dépendance : h() décrit l'écran, render() met à jour la page
// en ne touchant qu'aux nœuds qui changent (les champs gardent le focus, les listes gardent leurs éléments).

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(type, props, ...kids) {
  props = props || {};
  const children = [];
  flatten(kids, children);
  if (typeof type === 'function') return type({ ...props, children });
  return { type, props, key: props.key, children, el: null };
}

function flatten(arr, out) {
  for (const c of arr) {
    if (c == null || c === false || c === true || c === '') continue;
    if (Array.isArray(c)) flatten(c, out);
    else if (typeof c === 'object') out.push(c);
    else out.push({ type: '#text', text: String(c), props: {}, children: [], el: null });
  }
}

export function render(vnode, container) {
  const old = container._vnode;
  if (!old) {
    container.textContent = '';
    container.appendChild(create(vnode, false));
  } else if (old.type !== vnode.type) {
    container.replaceChild(create(vnode, false), old.el);
  } else {
    update(old, vnode, false);
  }
  container._vnode = vnode;
}

function create(v, svg) {
  if (v.type === '#text') return (v.el = document.createTextNode(v.text));
  const isSvg = svg || v.type === 'svg';
  const el = isSvg ? document.createElementNS(SVG_NS, v.type) : document.createElement(v.type);
  v.el = el;
  for (const k in v.props) setProp(el, k, v.props[k], undefined, isSvg);
  if (v.props.html != null) el.innerHTML = v.props.html;
  else for (const c of v.children) el.appendChild(create(c, isSvg && v.type !== 'foreignObject'));
  if (typeof v.props.ref === 'function') v.props.ref(el);
  return el;
}

function update(o, n, svg) {
  const el = (n.el = o.el);
  if (n.type === '#text') {
    if (o.text !== n.text) el.nodeValue = n.text;
    return;
  }
  const isSvg = svg || n.type === 'svg';
  const op = o.props, np = n.props;
  for (const k in op) if (!(k in np)) setProp(el, k, undefined, op[k], isSvg);
  for (const k in np) if (np[k] !== op[k] || k === 'value' || k === 'checked') setProp(el, k, np[k], op[k], isSvg);
  if (np.html != null) {
    if (np.html !== op.html) el.innerHTML = np.html;
  } else {
    if (op.html != null) { el.innerHTML = ''; o.children = []; }
    patchChildren(el, o.children, n.children, isSvg && n.type !== 'foreignObject');
  }
}

const keyOf = (c, i) => (c.key != null ? 'k:' + c.key : 'i:' + i + ':' + c.type);

function patchChildren(el, oldCh, newCh, svg) {
  const oldMap = new Map();
  oldCh.forEach((c, i) => { const k = keyOf(c, i); if (!oldMap.has(k)) oldMap.set(k, c); });
  const kept = new Set();
  newCh.forEach((c, i) => {
    const o = oldMap.get(keyOf(c, i));
    if (o && o.type === c.type && !kept.has(o.el)) { update(o, c, svg); kept.add(o.el); }
    else create(c, svg);
  });
  for (const c of oldCh) if (!kept.has(c.el) && c.el && c.el.parentNode === el) el.removeChild(c.el);
  newCh.forEach((c, i) => {
    const cur = el.childNodes[i];
    if (cur !== c.el) el.insertBefore(c.el, cur || null);
  });
}

function setProp(el, name, val, old, svg) {
  if (name === 'key' || name === 'children' || name === 'ref' || name === 'html') return;
  if (name[0] === 'o' && name[1] === 'n') {
    const ev = name.slice(2).toLowerCase();
    const store = el._h || (el._h = {});
    if (!(ev in store)) {
      const opts = ev === 'touchstart' || ev === 'touchmove' ? { passive: false } : undefined;
      el.addEventListener(ev, e => { const f = store[ev]; if (f) f(e); }, opts);
    }
    store[ev] = val || null;
    return;
  }
  if (name === 'style') {
    if (typeof val === 'string' || val == null) { el.style.cssText = val || ''; return; }
    if (typeof old === 'string') el.style.cssText = '';
    const prev = old && typeof old === 'object' ? old : {};
    for (const k in prev) if (!(k in val)) el.style.removeProperty(cssName(k));
    for (const k in val) {
      const v = val[k];
      if (v == null || v === false) el.style.removeProperty(cssName(k));
      else el.style.setProperty(cssName(k), String(v));
    }
    return;
  }
  if (name === 'class' || name === 'className') {
    if (val) el.setAttribute('class', val); else el.removeAttribute('class');
    return;
  }
  if (!svg && (name === 'value' || name === 'checked' || name === 'selected')) {
    const v = name === 'value' ? (val == null ? '' : String(val)) : !!val;
    if (el[name] !== v) el[name] = v;
    return;
  }
  if (val == null || val === false) el.removeAttribute(name);
  else el.setAttribute(name, val === true ? '' : val);
}

const cssName = k => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
