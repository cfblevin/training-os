// Minimal DOM helpers, bottom sheets, menus and toasts.

export function el(tag, props = null, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  add(node, kids);
  return node;
}

function add(node, kids) {
  for (const k of kids.flat(4)) {
    if (k == null || k === false) continue;
    node.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function svg(inner, attrs = {}) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', attrs.viewBox || '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', attrs.sw || '1.6');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  if (attrs.class) s.setAttribute('class', attrs.class);
  s.innerHTML = inner;
  return s;
}

export function mount(root, ...nodes) {
  root.replaceChildren();
  add(root, nodes);
  return root;
}

export function clear(root) { root.replaceChildren(); }

// ------------------------------------------------------------------- sheets
const sheetRoot = () => document.getElementById('sheet-root');
const stack = [];

export function openSheet({ title, sub, build, onClose, dismissable = true }) {
  const scrim = el('div', { class: 'scrim', role: 'dialog', 'aria-modal': 'true' });
  const sheet = el('div', { class: 'sheet' });
  const close = (result) => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    scrim.remove();
    if (onClose) onClose(result);
  };
  const entry = { scrim, close };
  stack.push(entry);

  sheet.appendChild(el('div', { class: 'sheet-grip' }));
  if (title) sheet.appendChild(el('h3', { text: title }));
  if (sub) sheet.appendChild(el('p', { class: 'sheet-sub', text: sub }));
  const body = el('div');
  sheet.appendChild(body);
  scrim.appendChild(sheet);
  scrim.addEventListener('click', (e) => { if (dismissable && e.target === scrim) close(null); });
  sheetRoot().appendChild(scrim);
  const rerender = () => { body.replaceChildren(); add(body, [build({ close, rerender })]); };
  rerender();
  sheet.querySelector('input, button, select, textarea')?.focus({ preventScroll: true });
  return close;
}

export function closeTopSheet() {
  const top = stack[stack.length - 1];
  if (top) { top.close(null); return true; }
  return false;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTopSheet();
});

export function menuSheet(title, items, sub) {
  return openSheet({
    title, sub,
    build: ({ close }) => el('div', { class: 'menu' },
      items.filter(Boolean).map((it) => el('button', {
        class: it.danger ? 'danger' : '',
        onclick: () => { close(); setTimeout(() => it.onClick && it.onClick(), 0); },
      }, el('div', { text: it.label }), it.note ? el('div', { class: 'menu-note', text: it.note }) : null))),
  });
}

export function confirmSheet({ title, message, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet({
      title, sub: message,
      onClose: () => { if (!done) resolve(false); },
      build: () => el('div', { class: 'btn-row' },
        el('button', { class: 'btn btn-quiet', onclick: () => { done = true; close(); resolve(false); } }, 'Cancel'),
        el('button', {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          onclick: () => { done = true; close(); resolve(true); },
        }, confirm)),
    });
  });
}

/** Today-only versus the future plan. Always asked, never assumed. */
export function scopeSheet({ title, todayLabel = 'Today only', futureLabel = 'All future workouts', note }) {
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet({
      title,
      sub: note || 'Apply this to that date only, or to this workout every week from now on?',
      onClose: () => { if (!done) resolve(null); },
      build: () => el('div', { class: 'menu' },
        el('button', { onclick: () => { done = true; close(); resolve('today'); } },
          el('div', { text: todayLabel }),
          el('div', { class: 'menu-note', text: 'That date only — the weekly plan is untouched.' })),
        el('button', { onclick: () => { done = true; close(); resolve('future'); } },
          el('div', { text: futureLabel }),
          el('div', { class: 'menu-note', text: 'Changes this day in the weekly program from now on.' }))),
    });
  });
}

export function toast(message, ms = 2100) {
  const root = document.getElementById('toast-root');
  const node = el('div', { class: 'toast', text: message });
  root.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

export function fmtLoad(v, convention) {
  if (v == null) return '—';
  const n = Number(v);
  if (convention === 'bodyweight') return 'BW';
  if (!n) return convention === 'bodyweight-plus' ? 'BW' : '0';
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return convention === 'bodyweight-plus' ? `BW+${s}` : s;
}

export function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.abs(sec % 60);
  return `${sec < 0 && m === 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}
