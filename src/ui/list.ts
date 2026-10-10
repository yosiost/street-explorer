import { searchKey } from '../data/cities';
import { locale, t } from '../i18n';
import type { Street } from '../geo/streets';
import { bdi } from './dom';
import { formatLength } from './format';
import { cityName, streetName } from './names';
import { STICKERS, earnedStickers, walkProgress, walkedIn } from '../kids/walked';
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
  } else if (street.orientation === 'BRANCHED') {
    path.setAttribute('d', 'M0 8 L0 0 M0 0 L-7 -7 M0 0 L7 -7');
  } else {
    // Compass bearing is clockwise from north, same as CSS/SVG rotate from "up".
    path.setAttribute('d', 'M0 -8 L0 8');
    path.setAttribute('transform', `rotate(${street.bearingDeg.toFixed(0)})`);
  }
  svg.append(path);
  return svg;
}

export function sortStreets(streets: Street[], dir: State['sortDir']): Street[] {
  const collator = new Intl.Collator(locale());
  const sign = dir === 'desc' ? -1 : 1;
  return [...streets].sort(
    (a, b) => sign * (a.lengthM - b.lengthM) || collator.compare(streetName(a), streetName(b)),
  );
}

export function mountList(root: HTMLElement, store: Store, onRowClick: (id: string) => void) {
  const title = root.querySelector<HTMLElement>('#city-name')!;
  const summary = root.querySelector<HTMLElement>('#list-summary')!;
  const list = root.querySelector<HTMLOListElement>('#street-list')!;
  const filter = root.querySelector<HTMLInputElement>('#street-filter')!;
  const sortButtons = root.querySelectorAll<HTMLButtonElement>('[data-sort]');
  const controls = root.querySelector<HTMLElement>('.list-controls')!;
  const walkCard = root.querySelector<HTMLDetailsElement>('#walk-progress')!;
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
    const homeId = s.home && s.home.cityId === s.shownCity?.id ? s.home.streetId : null;
    const walked = s.shownCity ? walkedIn(s.walked, s.shownCity.id) : {};
    const items: HTMLLIElement[] = [];
    streets.forEach((street, i) => {
      const shown = streetName(street);
      // The filter finds a street by either of its names.
      if (q && !searchKey(shown).includes(q) && !searchKey(street.name).includes(q)) return;
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
      name.append(bdi(shown));
      if (street.id === homeId) {
        const star = document.createElement('span');
        star.className = 'home-mark';
        star.textContent = '⭐';
        star.title = t().ourStreet;
        name.append(star);
      }
      if (walked[street.id]) {
        const mark = document.createElement('span');
        mark.className = 'walked-mark';
        mark.textContent = '✅';
        mark.title = t().walkedListTitle;
        name.append(mark);
      }
      if (street.flags.includes('tiny')) {
        const tiny = document.createElement('span');
        tiny.className = 'tiny-mark';
        tiny.textContent = '•';
        tiny.title = t().tinyTitle;
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
      label.textContent = t().orientation[street.orientation];
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
      li.textContent = s.result.streets.length ? t().noStreetByName : t().noNamedStreets;
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

  /** Progress bar, summary and the sticker collection for the shown city. */
  function renderWalk(s: State) {
    walkCard.hidden = !s.result || !s.shownCity;
    if (!s.result || !s.shownCity) return;
    const tr = t();
    const walked = walkedIn(s.walked, s.shownCity.id);
    const progress = walkProgress(s.result.streets, walked);
    const homeId = s.home && s.home.cityId === s.shownCity.id ? s.home.streetId : null;
    const earned = earnedStickers(s.result.streets, walked, homeId);

    const title = el('span', 'walk-title', tr.walkTitle);
    const pct = progress.share * 100;
    const pctText = pct === 0 ? '0' : pct < 1 ? pct.toFixed(1) : String(Math.round(pct));
    const line = el(
      'span',
      'walk-summary',
      progress.count
        ? tr.walkSummary(progress.count, formatLength(progress.lengthM), pctText)
        : tr.walkNone,
    );
    const bar = el('span', 'walk-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', pctText);
    const fill = el('span', 'walk-fill');
    // A sliver stays visible from the first street, so progress can be seen at all.
    fill.style.width = progress.count ? `${Math.max(2, Math.min(100, pct))}%` : '0';
    bar.append(fill);
    const count = el(
      'span',
      'sticker-count',
      `🏅 ${tr.stickersLabel(earned.size, STICKERS.length)}`,
    );
    walkCard.querySelector('summary')!.replaceChildren(title, line, bar, count);

    walkCard.querySelector('.sticker-grid')!.replaceChildren(
      ...STICKERS.map((st) => {
        const li = el('li', `sticker${earned.has(st.id) ? ' earned' : ''}`);
        li.append(el('span', 'sticker-emoji', st.emoji), el('span', 'sticker-label', st.label(tr)));
        li.setAttribute('aria-label', `${st.label(tr)}${earned.has(st.id) ? ' ✓' : ''}`);
        return li;
      }),
    );
  }

  function renderHeader(s: State) {
    controls.hidden = !s.result;
    if (!s.result || !s.shownCity) {
      title.replaceChildren(bdi(s.pickedCity ? cityName(s.pickedCity) : ''));
      summary.textContent = t().pickPrompt;
      return;
    }
    const total = s.result.streets.reduce((sum, x) => sum + x.lengthM, 0);
    title.replaceChildren(bdi(cityName(s.shownCity)));
    summary.textContent = t().summary(
      s.result.streets.length.toLocaleString(locale()),
      (total / 1000).toFixed(1),
    );
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
      s.filterText !== prev.filterText ||
      s.home !== prev.home ||
      s.walked !== prev.walked ||
      s.lang !== prev.lang
    ) {
      renderHeader(s);
      renderWalk(s);
      renderRows(s);
      if (s.result !== prev.result)
        list.scrollTop = 0; // a new city starts at the top
      else if (s.home !== prev.home || s.walked !== prev.walked) {
        markSelected(s.selectedStreetId, false);
      }
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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const e = document.createElement(tag);
  e.className = className;
  if (text) e.textContent = text;
  return e;
}
