import type { City } from '../data/cities';
import type { CityResult } from '../geo/pipeline';
import type { Lang } from '../i18n';
import type { HomeStreet } from '../kids/units';
import type { WalkedLog } from '../kids/walked';

export type LoadingStep = 'download' | 'compute';

export type Status =
  | { kind: 'idle' }
  | {
      kind: 'loading';
      step: LoadingStep;
      startedAt: number;
      retrying?: string;
      /** A city big enough to take minutes. */
      large?: boolean;
    }
  | { kind: 'error'; reason: ErrorReason }
  | { kind: 'ready' };

export type ErrorReason = 'network' | 'network-large' | 'processing' | 'too-big';

export interface State {
  /** UI language; components re-render their text when it changes. */
  lang: Lang;
  /** Israeli cities (bundled list or Overpass). */
  cities: City[];
  /** World cities opened before, newest first. */
  recentCities: City[];
  /** City the picker currently points at. */
  pickedCity: City | null;
  /** City whose result is shown. */
  shownCity: City | null;
  result: CityResult | null;
  /** Where the shown result came from (debug). */
  resultSource: 'processed-cache' | 'raw-cache' | 'network' | null;
  status: Status;
  selectedStreetId: string | null;
  sortDir: 'desc' | 'asc';
  filterText: string;
  /** "Our street", the yardstick for kid comparisons. */
  home: HomeStreet | null;
  /** Streets we walked, in every city. */
  walked: WalkedLog;
  /** A Hebrew voice exists, so read-aloud buttons are shown. */
  canSpeak: boolean;
  /** The "which is longer?" game is open instead of the list. */
  gameOn: boolean;
}

type Listener = (state: State, prev: State) => void;

export interface Store {
  get(): State;
  set(patch: Partial<State>): void;
  subscribe(fn: Listener): () => void;
}

export function createStore(initial: State): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
