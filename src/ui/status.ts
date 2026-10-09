import type { LoadingStep, State, Store } from './store';

const STEPS: { key: LoadingStep; label: string }[] = [
  { key: 'download', label: 'מורידים את גבול העיר והרחובות' },
  { key: 'compute', label: 'מחשבים אורכים וכיוונים' },
];

/** Progress panel with named steps and Cancel; error panel with Retry. */
export function mountStatus(
  root: HTMLElement,
  store: Store,
  actions: { cancel(): void; retry(): void },
) {
  const loading = root.querySelector<HTMLElement>('#loading-panel')!;
  const stepsEl = root.querySelector<HTMLOListElement>('#loading-steps')!;
  const note = root.querySelector<HTMLElement>('#loading-note')!;
  const errorPanel = root.querySelector<HTMLElement>('#error-panel')!;
  const errorText = root.querySelector<HTMLElement>('#error-text')!;
  root.querySelector('#cancel-load')!.addEventListener('click', actions.cancel);
  root.querySelector('#retry-load')!.addEventListener('click', actions.retry);

  let timer: number | undefined;

  function render(s: State) {
    const st = s.status;
    loading.hidden = st.kind !== 'loading';
    errorPanel.hidden = st.kind !== 'error';
    window.clearInterval(timer);
    timer = undefined;

    if (st.kind === 'error') errorText.textContent = st.message;
    if (st.kind !== 'loading') return;

    const current = STEPS.findIndex((x) => x.key === st.step);
    stepsEl.replaceChildren(
      ...STEPS.map((step, i) => {
        const li = document.createElement('li');
        li.className = i < current ? 'done' : i === current ? 'active' : 'pending';
        li.textContent = step.label;
        return li;
      }),
    );
    const tick = () => {
      const secs = Math.round((Date.now() - st.startedAt) / 1000);
      note.textContent = st.retrying
        ? `השרת עמוס, מנסים שוב… (${secs} שניות)`
        : `${secs} שניות. בעיר גדולה זה יכול לקחת עד חצי דקה.`;
    };
    tick();
    timer = window.setInterval(tick, 1000);
  }

  store.subscribe((s, prev) => {
    if (s.status !== prev.status) render(s);
  });
}
