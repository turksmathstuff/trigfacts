// A decoder-ring dial: values sit around a rotating ring, and the one under the fixed window
// at the top is selected. Turn it by dragging around the ring, with the arrow buttons or keys,
// or by tapping a value. Only the top of the ring shows, so labels are never upside down.

// items: [{ key, text, render: () => Node }] (text is what screen readers announce), onChange(index) fires whenever the selected item changes.
// verticalKeys: false leaves the up/down arrows free for the page to use.
export function createWheel(items, { label = 'Answer', onChange = () => {}, verticalKeys = true } = {}) {
  const n = items.length;
  const slice = 360 / n;
  let index = 0;
  let rotation = 0; // degrees, unbounded so turning never jumps the long way around
  let disabled = false;

  const root = document.createElement('div');
  root.className = 'dial';
  root.tabIndex = 0;
  root.setAttribute('role', 'spinbutton');
  root.setAttribute('aria-label', `${label}. Use left and right arrows to turn, Enter to lock in.`);

  const ring = document.createElement('div');
  ring.className = 'dial-ring';
  const nodes = items.map((item, i) => {
    const node = document.createElement('div');
    node.className = 'dial-item';
    node.style.setProperty('--a', `${i * slice}deg`);
    node.append(item.render());
    node.addEventListener('click', () => {
      if (!dragged) step(offset(i));
    });
    ring.append(node);
    return node;
  });

  // Divider notches halfway between neighboring values.
  for (let i = 0; i < n; i++) {
    const tick = document.createElement('div');
    tick.className = 'dial-tick';
    tick.style.setProperty('--a', `${(i + 0.5) * slice}deg`);
    ring.append(tick);
  }

  const hub = document.createElement('div');
  hub.className = 'dial-hub';
  const windowEl = document.createElement('div');
  windowEl.className = 'dial-window';

  const arrow = (dir, text, name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dial-arrow dial-${name}`;
    b.tabIndex = -1;
    b.setAttribute('aria-label', name === 'prev' ? 'Turn left' : 'Turn right');
    b.textContent = text;
    b.addEventListener('click', () => step(dir));
    return b;
  };
  const arrows = document.createElement('div');
  arrows.className = 'dial-arrows';
  arrows.append(arrow(-1, '‹', 'prev'), arrow(1, '›', 'next'));

  root.append(ring, hub, windowEl, arrows);

  // Signed distance from the selected item to item i, going the short way around.
  function offset(i) {
    let o = (i - index) % n;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  }

  function render() {
    ring.style.transform = `rotate(${rotation}deg)`;
    nodes.forEach((node, i) => node.classList.toggle('is-selected', i === index));
    root.setAttribute('aria-valuetext', items[index].text ?? nodes[index].textContent);
  }

  function setIndex(i, { notify = true } = {}) {
    const target = ((i % n) + n) % n;
    rotation -= offset(target) * slice;
    index = target;
    render();
    if (notify) onChange(index);
  }

  function step(d) {
    if (disabled || d === 0) return;
    setIndex(index + d);
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || (verticalKeys && e.key === 'ArrowDown')) { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight' || (verticalKeys && e.key === 'ArrowUp')) { e.preventDefault(); step(1); }
  });

  // Drag: the ring follows the pointer's angle around the hub, then snaps to the nearest value.
  let drag = null;
  let dragged = false;
  const angleAt = (e) => {
    const r = ring.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return (Math.atan2(dx, -dy) * 180) / Math.PI; // 0° at the top, clockwise positive
  };
  ring.addEventListener('pointerdown', (e) => {
    if (disabled) return;
    drag = { start: angleAt(e), from: rotation, last: angleAt(e), total: 0 };
    dragged = false;
  });
  ring.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = angleAt(e);
    let delta = a - drag.last;
    if (delta > 180) delta -= 360;   // crossing the ±180° seam
    if (delta < -180) delta += 360;
    drag.last = a;
    drag.total += delta;
    if (Math.abs(drag.total) > 4) {
      // Capture only once it's really a drag, so a plain tap still reaches the value tapped.
      if (!dragged) ring.setPointerCapture?.(e.pointerId);
      dragged = true;
      ring.classList.add('is-dragging');
      ring.style.transform = `rotate(${drag.from + drag.total}deg)`;
    }
  });
  const endDrag = () => {
    if (!drag) return;
    ring.classList.remove('is-dragging');
    if (dragged) {
      const turned = -Math.round(drag.total / slice); // turning the ring left brings later values up
      rotation = drag.from;
      if (turned) setIndex(index + turned);
      else render();
    }
    drag = null;
  };
  ring.addEventListener('pointerup', endDrag);
  ring.addEventListener('pointercancel', endDrag);

  render();

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
