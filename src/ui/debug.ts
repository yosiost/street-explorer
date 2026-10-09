import type { Store } from './store';

/** `?debug=1`: per-street raw vs deduplicated length, flags and OSM way links. */
export function mountDebug(panel: HTMLElement, store: Store) {
  panel.hidden = false;
  const render = () => {
    const s = store.get();
    panel.replaceChildren();
    if (!s.result) {
      panel.textContent = 'debug: no data yet';
      return;
    }
    const { stats } = s.result;
    const head = document.createElement('p');
    head.dir = 'ltr';
    head.textContent = `ways in: ${stats.waysIn} · streets: ${s.result.streets.length} · pipeline: ${stats.timeMs.toFixed(0)} ms · source: ${s.resultSource} · OSM: ${stats.osmTimestamp ?? '?'}`;
    panel.append(head);

    const street = s.result.streets.find((x) => x.id === s.selectedStreetId);
    if (!street) {
      const p = document.createElement('p');
      p.textContent = 'Pick a street to see its details.';
      panel.append(p);
      return;
    }
    const table = document.createElement('dl');
    table.dir = 'ltr';
    const add = (k: string, v: string | Node) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.append(v);
      table.append(dt, dd);
    };
    add('id', street.id);
    add('length (dedup)', `${street.lengthM.toFixed(1)} m`);
    add('raw length', `${street.rawLengthM.toFixed(1)} m`);
    add('paired share', `${(street.pairedShare * 100).toFixed(0)}%`);
    add('bearing', `${street.bearingDeg.toFixed(1)}° → ${street.orientation}`);
    add('flags', street.flags.join(', ') || '—');
    const ways = document.createElement('span');
    street.wayIds.forEach((id, i) => {
      if (i) ways.append(' ');
      const a = document.createElement('a');
      a.href = `https://www.openstreetmap.org/way/${id}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = String(id);
      ways.append(a);
    });
    add(`ways (${street.wayIds.length})`, ways);
    panel.append(table);
  };
  store.subscribe((s, prev) => {
    if (s.result !== prev.result || s.selectedStreetId !== prev.selectedStreetId) render();
  });
  render();
}
