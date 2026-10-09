import { citySize, matchesCity, searchKey, type City } from '../data/cities';
import { searchWorld, SearchError } from '../data/search';
import { bdi } from './dom';
import type { Store } from './store';

type Option =
  | { kind: 'city'; city: City }
  | { kind: 'search'; query: string }
  | { kind: 'note'; text: string; heading?: boolean };

const SIZE_NOTE = {
  large: 'עיר גדולה מאוד, ההורדה תיקח כמה דקות',
  'too-big': 'גדולה מדי. חפשו רובע או שכונה שלה',
} as const;

/**
 * City picker (ARIA combobox) plus the "Map it" button. Typing filters the Israeli list
 * instantly. Any other place is one explicit world search away: the last option, or Enter
 * when nothing local matches. Regional councils are hidden unless the toggle is on.
 */
export function mountPicker(root: HTMLElement, store: Store, onMapIt: (city: City) => void) {
  const input = root.querySelector<HTMLInputElement>('#city-input')!;
  const listbox = root.querySelector<HTMLUListElement>('#city-listbox')!;
  const button = root.querySelector<HTMLButtonElement>('#map-it')!;
  const regionalToggle = root.querySelector<HTMLInputElement>('#show-regional')!;

  let options: Option[] = [];
  let active = -1;
  // The last world search; its results show while the input still says the same thing.
  let world: {
    query: string;
    status: 'loading' | 'done' | 'error';
    cities: City[];
    abort: AbortController;
  } | null = null;

  const isOpen = () => !listbox.hidden;
  const selectable = (o: Option | undefined) =>
    (o?.kind === 'city' && citySize(o.city) !== 'too-big') || o?.kind === 'search';
  /** The text to filter by: empty while the input just shows the picked city. */
  // The text to filter by. Opening the list on the picked city's name shows everything;
  // anything typed (even that same name) filters.
  let query = '';

  function buildOptions(query: string): Option[] {
    const { cities, recentCities } = store.get();
    const local = cities.filter(
      (c) => (regionalToggle.checked || !c.regional) && matchesCity(c, query),
    );
    const localIds = new Set(local.map((c) => c.id));
    const recent = recentCities.filter((c) => !localIds.has(c.id) && matchesCity(c, query));
    const out: Option[] = [...local, ...recent].map((city) => ({ kind: 'city', city }));

    const q = query.trim();
    if (!searchKey(q)) return out;
    if (world && world.query === q) {
      out.push({ kind: 'note', text: 'בעולם', heading: true });
      if (world.status === 'loading') out.push({ kind: 'note', text: 'מחפשים…' });
      else if (world.status === 'error') {
        out.push({ kind: 'note', text: 'החיפוש לא הצליח. נסו שוב בעוד רגע.' });
        out.push({ kind: 'search', query: q });
      } else {
        const shown = new Set(out.map((o) => (o.kind === 'city' ? o.city.id : -1)));
        const found = world.cities.filter((c) => !shown.has(c.id));
        if (!found.length) out.push({ kind: 'note', text: 'לא נמצא מקום בשם הזה' });
        for (const city of found) out.push({ kind: 'city', city });
      }
    } else {
      out.push({ kind: 'search', query: q });
    }
    return out;
  }

  function optionElement(o: Option, i: number): HTMLLIElement {
    const li = document.createElement('li');
    if (o.kind === 'note') {
      li.className = o.heading ? 'heading' : 'empty';
      li.role = 'presentation';
      li.textContent = o.text;
      return li;
    }
    li.id = `city-opt-${i}`;
    li.role = 'option';
    li.setAttribute('aria-selected', String(i === active));
    if (i === active) li.classList.add('active');

    if (o.kind === 'search') {
      li.className += ' search';
      li.textContent = `חיפוש ״${o.query}״ בכל העולם`;
    } else {
      const { city } = o;
      li.append(bdi(city.name));
      if (city.context) {
        const ctx = document.createElement('span');
        ctx.className = 'context';
        ctx.textContent = city.context;
        li.append(ctx);
      }
      const size = citySize(city);
      if (size !== 'normal') {
        const note = document.createElement('span');
        note.className = `size-note ${size}`;
        note.textContent = SIZE_NOTE[size];
        li.append(note);
      }
      if (size === 'too-big') li.setAttribute('aria-disabled', 'true');
    }
    // mousedown, not click, so it fires before the input's blur closes the list.
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      activate(o);
    });
    return li;
  }

  function render() {
    options = buildOptions(query);
    listbox.replaceChildren(...options.map(optionElement));
    if (options.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'לא נמצאה עיר';
      listbox.append(li);
    }
    input.setAttribute(
      'aria-activedescendant',
      selectable(options[active]) ? `city-opt-${active}` : '',
    );
  }

  function show() {
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function open() {
    query = input.value === store.get().pickedCity?.name ? '' : input.value;
    active = -1;
    render();
    show();
  }

  function close() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function activate(o: Option) {
    if (o.kind === 'search') void runSearch(o.query);
    else if (o.kind === 'city' && citySize(o.city) !== 'too-big') choose(o.city);
  }

  function choose(city: City) {
    store.set({ pickedCity: city });
    input.value = city.name;
    close();
  }

  async function runSearch(query: string) {
    world?.abort.abort();
    const current = { query, status: 'loading' as const, cities: [], abort: new AbortController() };
    world = current;
    active = -1;
    render();
    try {
      const cities = await searchWorld(query, { signal: current.abort.signal });
      if (world !== current) return;
      world = { ...current, status: 'done', cities };
      console.info(`[search] "${query}": ${cities.length} places`);
    } catch (err) {
      if (world !== current || (err instanceof SearchError && err.aborted)) return;
      console.warn('[search] failed', err);
      world = { ...current, status: 'error' };
    }
    // Make the first result active, so Enter picks it.
    const first = buildOptions(query).findIndex(
      (o, i, all) => selectable(o) && all.slice(0, i).some((x) => x.kind === 'note' && x.heading),
    );
    active = first;
    if (isOpen()) render();
  }

  function moveActive(delta: number) {
    const n = options.length;
    if (!options.some(selectable)) return;
    let i = active;
    do i = (i + delta + n) % n;
    while (!selectable(options[i]));
    active = i;
    render();
    listbox.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => {
    input.select();
    open();
  });
  input.addEventListener('input', () => {
    // Typing makes the best match active, so Enter picks it; with no local match that is
    // the world search.
    query = input.value;
    options = buildOptions(query);
    active = options.findIndex(selectable);
    render();
    show();
  });
  input.addEventListener('blur', () => {
    close();
    // Leaving the field without choosing restores the picked city's name.
    input.value = store.get().pickedCity?.name ?? '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen()) open();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[active];
      if (isOpen() && o && selectable(o)) activate(o);
      else if (!isOpen()) button.click();
    } else if (e.key === 'Escape' && isOpen()) {
      e.stopPropagation();
      close();
    }
  });

  regionalToggle.addEventListener('change', () => {
    if (isOpen()) render();
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = store.get().pickedCity;
    if (city) onMapIt(city);
  });

  store.subscribe((s, prev) => {
    if (s.pickedCity !== prev.pickedCity && document.activeElement !== input) {
      input.value = s.pickedCity?.name ?? '';
    }
    const loading = s.status.kind === 'loading';
    input.disabled = s.cities.length === 0;
    button.disabled = !s.pickedCity || loading;
  });
}
