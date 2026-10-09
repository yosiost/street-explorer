import './style.css';
import { DEFAULT_CITY_ID, OVERPASS_LARGE_TIMEOUT_MS, PIPELINE_VERSION } from './config';
import { cacheGet, cacheKeys, cacheSet } from './data/cache';
import { citySize, isIsraeli, type City } from './data/cities';
import { loadCityList, loadCityRaw, type CityRaw } from './data/loader';
import { OverpassError } from './data/overpass';
import { loadHome, saveHome } from './data/home';
import { loadRecent, rememberRecent } from './data/recent';
import type { CityResult } from './geo/pipeline';
import type { Street } from './geo/streets';
import { applyStaticText, getLang, setLang } from './i18n';
import { spokenStreet } from './kids/units';
import { mountDebug } from './ui/debug';
import { canPlay, mountGame } from './ui/game';
import { mountList } from './ui/list';
import { MapView } from './ui/map';
import { mountPicker } from './ui/picker';
import { popupContent } from './ui/popup';
import { streetName } from './ui/names';
import { canSpeak, speak, whenVoicesReady } from './ui/speech';
import { mountStatus } from './ui/status';
import { createStore, type LoadingStep, type State } from './ui/store';
import type { WorkerRequest, WorkerResponse } from './worker';

const $ = <T extends HTMLElement>(sel: string) => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`${sel} missing`);
  return el;
};

applyStaticText();

const store = createStore({
  lang: getLang(),
  cities: [],
  recentCities: loadRecent(),
  pickedCity: null,
  shownCity: null,
  result: null,
  resultSource: null,
  status: { kind: 'idle' },
  selectedStreetId: null,
  sortDir: 'desc',
  filterText: '',
  home: loadHome(),
  canSpeak: false,
  gameOn: false,
});

// --- Selection: list and map both write selectedStreetId; the map follows it. ---

let focusOnSelect = false;

const mapView = new MapView($('#map'), {
  onStreetClick: (id) => store.set({ selectedStreetId: id }),
  onEmptyClick: () => store.set({ selectedStreetId: null }),
  onPairClick: (id) => game.answer(id),
  renderPopup: (street) =>
    popupContent(street, {
      home: store.get().home,
      canSpeak: store.get().canSpeak,
      onToggleHome: toggleHome,
      onSpeak: (s) => speak(spokenStreet({ ...s, name: streetName(s) }, store.get().home)),
    }),
});

// --- "Our street" and read-aloud ---

function toggleHome(street: Street) {
  const { home, shownCity } = store.get();
  if (!shownCity) return;
  const next =
    home?.streetId === street.id && home.cityId === shownCity.id
      ? null
      : {
          cityId: shownCity.id,
          streetId: street.id,
          name: streetName(street),
          lengthM: street.lengthM,
        };
  saveHome(next);
  store.set({ home: next });
}

store.subscribe((s, prev) => {
  if (s.home !== prev.home || s.result !== prev.result || s.shownCity !== prev.shownCity) {
    const here = s.home && s.shownCity && s.home.cityId === s.shownCity.id;
    mapView.setHome(here ? s.home!.streetId : null);
  }
  if (s.home !== prev.home || s.canSpeak !== prev.canSpeak || s.lang !== prev.lang) {
    mapView.refreshPopup();
  }
});

void whenVoicesReady().then(() => store.set({ canSpeak: canSpeak() }));

// --- Language: עברית / English ---

const langToggle = $<HTMLButtonElement>('#lang-toggle');
const renderLangToggle = () => {
  // The button is labelled in the language it switches to.
  langToggle.querySelector('.lang-label')!.setAttribute('lang', getLang() === 'he' ? 'en' : 'he');
};
renderLangToggle();
langToggle.addEventListener('click', () => {
  setLang(getLang() === 'he' ? 'en' : 'he');
  renderLangToggle();
  store.set({ lang: getLang(), canSpeak: canSpeak() });
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

// --- "Which is longer?" game: replaces the list while it runs. ---

const game = mountGame($('#game-panel'), store, mapView);
const startGame = $<HTMLButtonElement>('#start-game');
startGame.addEventListener('click', () => store.set({ gameOn: true, selectedStreetId: null }));
store.subscribe((s, prev) => {
  if (s.result !== prev.result) startGame.disabled = !s.result || !canPlay(s.result.streets);
  if (s.gameOn !== prev.gameOn) {
    $('.list-pane').classList.toggle('game-on', s.gameOn);
    $('#game-panel').hidden = !s.gameOn;
    if (!s.gameOn) startGame.focus({ preventScroll: true });
  }
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

function runWorker(raw: CityRaw, hebrewNames: boolean, j: Job): Promise<CityResult> {
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
    worker.postMessage({ type: 'process', raw, hebrewNames } satisfies WorkerRequest);
  });
}

async function loadCity(city: City) {
  cancel();
  lastRequested = city;
  const j: Job = { abort: new AbortController() };
  job = j;
  const startedAt = Date.now();
  const size = citySize(city);
  if (size === 'too-big') {
    // The picker does not offer these; this guards other ways in.
    job = null;
    store.set({ status: { kind: 'error', reason: 'too-big' } });
    return;
  }
  const large = size === 'large';
  const setStep = (step: LoadingStep, retrying?: string) => {
    if (job === j) store.set({ status: { kind: 'loading', step, startedAt, retrying, large } });
  };
  setStep('download');

  try {
    const processedKey = cacheKeys.processed(city.id, PIPELINE_VERSION);
    let result = await cacheGet<CityResult>(processedKey);
    let source: State['resultSource'] = 'processed-cache';
    if (!result) {
      const raw = await loadCityRaw(city.id, {
        signal: j.abort.signal,
        timeoutMs: large ? OVERPASS_LARGE_TIMEOUT_MS : undefined,
        onRetry: ({ endpoint, reason }) => {
          console.info(`[overpass] ${new URL(endpoint).host}: ${reason}; trying again`);
          setStep('download', reason);
        },
      });
      setStep('compute');
      result = await runWorker(raw, isIsraeli(city), j);
      source = raw.fromCache ? 'raw-cache' : 'network';
      void cacheSet(processedKey, result);
    }
    if (job !== j) return;
    job = null;
    mapView.showCity(result);
    store.set({
      // Only search results are remembered; the Israeli list is always there.
      recentCities: city.context
        ? rememberRecent(city, store.get().recentCities)
        : store.get().recentCities,
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
        reason: network ? (large ? 'network-large' : 'network') : 'processing',
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
