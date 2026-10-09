import './style.css';
import { DEFAULT_CITY_ID, PIPELINE_VERSION } from './config';
import { cacheGet, cacheKeys, cacheSet } from './data/cache';
import type { City } from './data/cities';
import { loadCityList, loadCityRaw, type CityRaw } from './data/loader';
import { OverpassError } from './data/overpass';
import type { CityResult } from './geo/pipeline';
import { mountDebug } from './ui/debug';
import { mountList } from './ui/list';
import { MapView } from './ui/map';
import { mountPicker } from './ui/picker';
import { mountStatus } from './ui/status';
import { createStore, type LoadingStep, type State } from './ui/store';
import type { WorkerRequest, WorkerResponse } from './worker';

const $ = <T extends HTMLElement>(sel: string) => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`${sel} missing`);
  return el;
};

const store = createStore({
  cities: [],
  pickedCity: null,
  shownCity: null,
  result: null,
  resultSource: null,
  status: { kind: 'idle' },
  selectedStreetId: null,
  sortDir: 'desc',
  filterText: '',
});

// --- Selection: list and map both write selectedStreetId; the map follows it. ---

let focusOnSelect = false;

const mapView = new MapView($('#map'), {
  onStreetClick: (id) => store.set({ selectedStreetId: id }),
  onEmptyClick: () => store.set({ selectedStreetId: null }),
});

store.subscribe((s, prev) => {
  if (s.selectedStreetId !== prev.selectedStreetId || focusOnSelect) {
    mapView.select(s.selectedStreetId, focusOnSelect);
    focusOnSelect = false;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') store.set({ selectedStreetId: null });
});

mountList($('.list-pane'), store, (id) => {
  focusOnSelect = true;
  store.set({ selectedStreetId: id });
});

// --- Loading a city ---

interface Job {
  abort: AbortController;
  worker?: Worker;
  rejectWorker?: (err: Error) => void;
}
let job: Job | null = null;
let lastRequested: City | null = null;

function settledStatus(s: State): State['status'] {
  return s.result ? { kind: 'ready' } : { kind: 'idle' };
}

function cancel() {
  if (!job) return;
  job.abort.abort();
  job.worker?.terminate();
  job.rejectWorker?.(new OverpassError('aborted', true));
  job = null;
  store.set({ status: settledStatus(store.get()) });
}

function runWorker(raw: CityRaw, j: Job): Promise<CityResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    j.worker = worker;
    j.rejectWorker = reject;
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'done') resolve(msg.result);
      else if (msg.type === 'error') reject(new Error(msg.message));
      if (msg.type !== 'progress') worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || 'worker failed'));
      worker.terminate();
    };
    worker.postMessage({ type: 'process', raw } satisfies WorkerRequest);
  });
}

async function loadCity(city: City) {
  cancel();
  lastRequested = city;
  const j: Job = { abort: new AbortController() };
  job = j;
  const startedAt = Date.now();
  const setStep = (step: LoadingStep, retrying?: string) => {
    if (job === j) store.set({ status: { kind: 'loading', step, startedAt, retrying } });
  };
  setStep('download');

  try {
    const processedKey = cacheKeys.processed(city.id, PIPELINE_VERSION);
    let result = await cacheGet<CityResult>(processedKey);
    let source: State['resultSource'] = 'processed-cache';
    if (!result) {
      const raw = await loadCityRaw(city.id, {
        signal: j.abort.signal,
        onRetry: ({ endpoint, reason }) => {
          console.info(`[overpass] ${new URL(endpoint).host}: ${reason}; trying again`);
          setStep('download', reason);
        },
      });
      setStep('compute');
      result = await runWorker(raw, j);
      source = raw.fromCache ? 'raw-cache' : 'network';
      void cacheSet(processedKey, result);
    }
    if (job !== j) return;
    job = null;
    mapView.showCity(result);
    store.set({
      result,
      shownCity: city,
      resultSource: source,
      selectedStreetId: null,
      filterText: '',
      status: { kind: 'ready' },
    });
    console.info(
      `[city] ${city.name}: ${result.streets.length} streets, pipeline ${result.stats.timeMs.toFixed(0)} ms, ` +
        `total ${Date.now() - startedAt} ms (${source})`,
    );
  } catch (err) {
    if (job !== j) return; // cancelled or superseded
    job = null;
    console.error(err);
    const network = err instanceof OverpassError;
    store.set({
      status: {
        kind: 'error',
        message: network
          ? 'לא הצלחנו להוריד את הנתונים מ־OpenStreetMap. ייתכן שהשרתים עמוסים כרגע. נסו שוב בעוד דקה.'
          : 'משהו השתבש בעיבוד הנתונים של העיר הזו.',
      },
    });
  }
}

mountStatus($('.map-pane'), store, {
  cancel,
  retry: () => {
    const city = lastRequested ?? store.get().pickedCity;
    if (city) void loadCity(city);
  },
});

mountPicker($('#picker'), store, (city) => void loadCity(city));

if (new URLSearchParams(location.search).has('debug')) {
  mountDebug($('#debug-panel'), store);
  // Handle for manual inspection in the console and for the e2e smoke test.
  Object.assign(window, { __app: { store, mapView } });
}

// --- Startup ---

void loadCityList().then(({ cities, source }) => {
  const picked = cities.find((c) => c.id === DEFAULT_CITY_ID) ?? cities[0] ?? null;
  store.set({ cities, pickedCity: picked });
  if (source === 'snapshot') console.info('[cities] using bundled list');
});
