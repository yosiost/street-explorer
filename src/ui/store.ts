import type { City } from '../data/cities';
import type { CityResult } from '../geo/pipeline';

export type LoadingStep = 'download' | 'compute';

export type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; step: LoadingStep; startedAt: number; retrying?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

export interface State {
  cities: City[];
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
