/**
 * Text in its own direction: a Latin or mixed name ("Walkway (1)") stays readable inside
 * the RTL page without changing the surrounding layout.
 */
export function bdi(text: string): HTMLElement {
  const el = document.createElement('bdi');
  el.textContent = text;
  return el;
}
