import { searchKey } from '../data/cities';
import { ORIENTATION_LABELS } from '../geo/orientation';
import type { Street } from '../geo/streets';
import { formatLength } from './format';
import type { State, Store } from './store';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A small line rotated to the street's axis, readable before reading the label. */
export function orientationIcon(street: Pick<Street, 'orientation' | 'bearingDeg'>): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-10 -10 20 20');
  svg.setAttribute('class', 'orient-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  if (street.orientation === 'WINDING') {
    path.setAttribute('d', 'M-8 4 C-5 -6, -1 -6, 0 0 S 5 6, 8 -4');
  } else {
    // Compass bearing is clockwise from north, same as CSS/SVG rotate from "up".
    path.setAttribute('d', 'M0 -8 L0 8');
    path.setAttribute('transform', `rotate(${street.bearingDeg.toFixed(0)})`);
  }
  svg.append(path);
  return svg;
}

export function sortStreets(streets: Street[], dir: State['sortDir']): Street[] {
  const collator = new Intl.Collator('he');
  const sign = dir === 'desc' ? -1 : 1;
  return [...streets].sort(
    (a, b) => sign * (a.lengthM - b.lengthM) || collator.compare(a.name, b.name),
  );
}

export function mountList(root: HTMLElement, store: Store, onRowClick: (id: string) => void) {
  const title = root.querySelector<HTMLElement>('#city-name')!;
  const summary = root.querySelector<HTMLElement>('#list-summary')!;
  const list = root.querySelector<HTMLOListElement>('#street-list')!;
  const filter = root.querySelector<HTMLInputElement>('#street-filter')!;
  const sortButtons = root.querySelectorAll<HTMLButtonElement>('[data-sort]');
  const controls = root.querySelector<HTMLElement>('.list-controls')!;
  const debug = new URLSearchParams(location.search).has('debug');

  const rows = new Map<string, HTMLLIElement>();

  filter.addEventListener('input', () => store.set({ filterText: filter.value }));
  sortButtons.forEach((b) =>
    b.addEventListener('click', () => store.set({ sortDir: b.dataset.sort as State['sortDir'] })),
  );
  list.addEventListener('click', (e) => {
    const row = (e.target as Element).closest<HTMLElement>('[data-id]');
    if (row?.dataset.id) onRowClick(row.dataset.id);
  });

  function renderRows(s: State) {
    rows.clear();
    const streets = s.result ? sortStreets(s.result.streets, s.sortDir) : [];
    const q = searchKey(s.filterText);
    const items: HTMLLIElement[] = [];
    streets.forEach((street, i) => {
      if (q && !searchKey(street.name).includes(q)) return;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'street-row';
      btn.dataset.id = street.id;

      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(i + 1);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = street.name;
      if (street.flags.includes('tiny')) {
        const tiny = document.createElement('span');
        tiny.className = 'tiny-mark';
        tiny.textContent = '•';
        tiny.title = 'קטע קצר מאוד, ייתכן שזו שארית מיפוי ולא רחוב שלם';
        name.append(tiny);
      }

      const len = document.createElement('span');
      len.className = 'length';
      len.textContent = formatLength(street.lengthM);

      const orient = document.createElement('span');
      orient.className = 'orient';
      orient.append(orientationIcon(street));
      const label = document.createElement('span');
      label.className = 'orient-label';
      label.textContent = ORIENTATION_LABELS[street.orientation];
      orient.append(label);

      btn.append(rank, name, len, orient);
      if (debug) btn.append(debugLine(street));
      li.append(btn);
      rows.set(street.id, li);
      items.push(li);
    });
    list.replaceChildren(...items);
    if (s.result && items.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'אין רחוב בשם הזה';
      list.append(li);
    }
    markSelected(s.selectedStreetId, false);
  }

  function markSelected(id: string | null, scroll: boolean) {
    list.querySelector('.selected')?.classList.remove('selected');
    list.querySelector('[aria-current]')?.removeAttribute('aria-current');
    if (!id) return;
    const li = rows.get(id);
    if (!li) return;
    li.classList.add('selected');
    li.firstElementChild?.setAttribute('aria-current', 'true');
    // Wait a frame: other subscribers (e.g. the debug panel) may still resize the list,
    // and a layout change cancels an in-flight smooth scroll.
    if (scroll) {
      requestAnimationFrame(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }

  function renderHeader(s: State) {
    controls.hidden = !s.result;
    if (!s.result || !s.shownCity) {
      title.textContent = s.pickedCity?.name ?? '';
      summary.textContent = 'בחרו עיר ולחצו „הצג במפה״';
      return;
    }
    const total = s.result.streets.reduce((sum, x) => sum + x.lengthM, 0);
    title.textContent = s.shownCity.name;
    summary.textContent = `${s.result.streets.length.toLocaleString('he')} רחובות · ${(total / 1000).toFixed(1)} ק״מ בסך הכול`;
    sortButtons.forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.sort === s.sortDir)),
    );
  }

  store.subscribe((s, prev) => {
    if (s.result !== prev.result || s.shownCity !== prev.shownCity) {
      filter.value = s.filterText;
    }
    if (
      s.result !== prev.result ||
      s.sortDir !== prev.sortDir ||
      s.filterText !== prev.filterText
    ) {
      renderHeader(s);
      renderRows(s);
    } else if (s.pickedCity !== prev.pickedCity) {
      renderHeader(s);
    }
    if (s.selectedStreetId !== prev.selectedStreetId) markSelected(s.selectedStreetId, true);
  });
  renderHeader(store.get());
}

function debugLine(street: Street): HTMLElement {
  const el = document.createElement('span');
  el.className = 'debug-line';
  el.dir = 'ltr';
  el.textContent = `raw ${Math.round(street.rawLengthM)} m · paired ${Math.round(street.pairedShare * 100)}%${street.flags.length ? ` · ${street.flags.join(', ')}` : ''}`;
  return el;
}
