/** Confetti over the whole page; skipped when the user prefers reduced motion. */
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#e03131', '#1c7ed6', '#f2b705', '#2f9e44', '#e8590c', '#ae3ec9'];
  for (let i = 0; i < 60; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length]!;
    bit.style.animationDelay = `${Math.random() * 0.4}s`;
    bit.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    bit.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    bit.style.setProperty('--spin', `${Math.random() * 720}deg`);
    layer.append(bit);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 3_000);
}

/**
 * A big pop-up for new stickers: their emojis, a title and their names, all in one card so
 * several at once don't queue up. A tap or a few seconds closes it.
 */
export function celebrate(title: string, stickers: { emoji: string; label: string }[]) {
  if (!stickers.length) return;
  document.querySelector('.sticker-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'sticker-toast';
  toast.setAttribute('role', 'status');
  const big = document.createElement('span');
  big.className = 'sticker-emoji';
  big.textContent = stickers.map((s) => s.emoji).join(' ');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const names = document.createElement('span');
  names.className = 'sticker-names';
  names.textContent = stickers.map((s) => s.label).join(' · ');
  toast.append(big, heading, names);
  document.body.append(toast);
  confetti();
  const close = () => toast.remove();
  toast.addEventListener('click', close);
  window.setTimeout(close, 3_500);
}
