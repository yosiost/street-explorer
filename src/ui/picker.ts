import { matchesCity, type City } from '../data/cities';
import type { Store } from './store';

/**
 * City type-ahead (ARIA combobox) plus the "Map it" button. Regional councils are hidden
 * unless the toggle is on.
 */
export function mountPicker(root: HTMLElement, store: Store, onMapIt: (city: City) => void) {
  const input = root.querySelector<HTMLInputElement>('#city-input')!;
  const listbox = root.querySelector<HTMLUListElement>('#city-listbox')!;
  const button = root.querySelector<HTMLButtonElement>('#map-it')!;
  const regionalToggle = root.querySelector<HTMLInputElement>('#show-regional')!;

  let options: City[] = [];
  let active = -1;

  const isOpen = () => !listbox.hidden;

  function visibleCities(query: string): City[] {
    const { cities } = store.get();
    return cities.filter((c) => (regionalToggle.checked || !c.regional) && matchesCity(c, query));
  }

  function render(query: string) {
    options = visibleCities(query);
    listbox.replaceChildren(
      ...options.map((city, i) => {
        const li = document.createElement('li');
        li.id = `city-opt-${city.id}`;
        li.role = 'option';
        li.textContent = city.name;
        li.setAttribute('aria-selected', String(i === active));
        if (i === active) li.classList.add('active');
        // mousedown, not click, so it fires before the input's blur closes the list.
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          choose(city);
        });
        return li;
      }),
    );
    if (options.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'לא נמצאה עיר';
      listbox.append(li);
    }
    const activeCity = options[active];
    input.setAttribute('aria-activedescendant', activeCity ? `city-opt-${activeCity.id}` : '');
  }

  function open() {
    active = -1;
    render(input.value === store.get().pickedCity?.name ? '' : input.value);
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function choose(city: City) {
    store.set({ pickedCity: city });
    input.value = city.name;
    close();
  }

  function moveActive(delta: number) {
    if (!options.length) return;
    active = (active + delta + options.length) % options.length;
    render(input.value === store.get().pickedCity?.name ? '' : input.value);
    listbox.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => {
    input.select();
    open();
  });
  input.addEventListener('input', () => {
    // Typing makes the best match active, so Enter picks it.
    active = 0;
    render(input.value);
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
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
      const activeCity = options[active];
      if (isOpen() && activeCity) choose(activeCity);
      else if (!isOpen()) button.click();
    } else if (e.key === 'Escape' && isOpen()) {
      e.stopPropagation();
      close();
    }
  });

  regionalToggle.addEventListener('change', () => {
    if (isOpen()) render(input.value);
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
