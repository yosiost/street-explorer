import { t } from '../i18n';
import type { ErrorReason, LoadingStep, State, Store } from './store';

const STEPS: { key: LoadingStep; label: () => string }[] = [
  { key: 'download', label: () => t().stepDownload },
  { key: 'compute', label: () => t().stepCompute },
];

const ERROR_TEXT: Record<ErrorReason, () => string> = {
  network: () => t().errorNetwork,
  'network-large': () => t().errorNetworkLarge,
  processing: () => t().errorProcessing,
  'too-big': () => t().errorTooBig,
};

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

    if (st.kind === 'error') errorText.textContent = ERROR_TEXT[st.reason]();
    if (st.kind !== 'loading') return;

    const current = STEPS.findIndex((x) => x.key === st.step);
    stepsEl.replaceChildren(
      ...STEPS.map((step, i) => {
        const li = document.createElement('li');
        li.className = i < current ? 'done' : i === current ? 'active' : 'pending';
        li.textContent = step.label();
        return li;
      }),
    );
    const tick = () => {
      const secs = Math.round((Date.now() - st.startedAt) / 1000);
      note.textContent = st.retrying
        ? t().busyRetrying(secs)
        : st.large
          ? t().waitLarge(secs)
          : t().waitNormal(secs);
    };
    tick();
    timer = window.setInterval(tick, 1000);
  }

  store.subscribe((s, prev) => {
    if (s.status !== prev.status || s.lang !== prev.lang) render(s);
  });
}
