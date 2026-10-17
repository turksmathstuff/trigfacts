// A horizontal "drum" picker: values sit on a loop, the centered one is selected.
// Turn it with the arrow buttons, the keyboard arrows, a swipe, or by tapping a neighbor.

const VISIBLE = 2; // items shown on each side of the center

// items: [{ key, render: () => Node }], onChange(index) fires whenever the centered item changes.
export function createWheel(items, { label = 'Answer', onChange = () => {} } = {}) {
  const n = items.length;
  let index = 0;
  let disabled = false;

  const root = document.createElement('div');
  root.className = 'wheel';
  root.tabIndex = 0;
  root.setAttribute('role', 'spinbutton');
  root.setAttribute('aria-label', `${label}. Use left and right arrows to turn, Enter to lock in.`);

  const arrow = (dir, text, name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `wheel-arrow wheel-${name}`;
    b.tabIndex = -1;
    b.setAttribute('aria-label', name === 'prev' ? 'Turn left' : 'Turn right');
    b.textContent = text;
    b.addEventListener('click', () => step(dir));
    return b;
  };

  const windowEl = document.createElement('div');
  windowEl.className = 'wheel-window';
  const nodes = items.map((item, i) => {
    const node = document.createElement('div');
    node.className = 'wheel-item';
    node.append(item.render());
    node.addEventListener('click', () => {
      if (!dragMoved) step(offset(i));
    });
    windowEl.append(node);
    return node;
  });
  root.append(arrow(-1, '‹', 'prev'), windowEl, arrow(1, '›', 'next'));

  // Signed distance from the center to item i, going the short way around the loop.
  function offset(i) {
    let o = (i - index) % n;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  }

  function layout() {
    nodes.forEach((node, i) => {
      const o = offset(i);
      const d = Math.abs(o);
      node.style.transform = `translateX(${o * 100}%) scale(${Math.max(0.55, 1 - d * 0.2)})`;
      node.style.opacity = d > VISIBLE ? 0 : 1 - d * 0.3;
      node.classList.toggle('is-center', o === 0);
      node.setAttribute('aria-hidden', String(o !== 0));
    });
    root.setAttribute('aria-valuetext', nodes[index].textContent);
  }

  function setIndex(i, { notify = true } = {}) {
    index = ((i % n) + n) % n;
    layout();
    if (notify) onChange(index);
  }

  function step(d) {
    if (disabled || d === 0) return;
    setIndex(index + d);
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); step(1); }
  });

  // Swipe: drag left/right moves one item per item-width dragged.
  let startX = null;
  let dragMoved = false;
  windowEl.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    dragMoved = false;
    windowEl.setPointerCapture?.(e.pointerId);
  });
  windowEl.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 10) return;
    dragMoved = true;
    const width = nodes[0].getBoundingClientRect().width || 60;
    step(-Math.round(dx / width) || -Math.sign(dx));
  });
  windowEl.addEventListener('pointercancel', () => { startX = null; });

  layout();

  return {
    el: root,
    step,
    setIndex,
    get index() { return index; },
    indexOf: (key) => items.findIndex((it) => it.key === key),
    setDisabled(on) {
      disabled = on;
      root.classList.toggle('is-disabled', on);
      root.querySelectorAll('button').forEach((b) => { b.disabled = on; });
    },
  };
}
