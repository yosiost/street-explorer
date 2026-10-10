import { locale, t } from '../i18n';
import type { Street } from '../geo/streets';
import { compareToHome, formatSteps, type HomeStreet } from '../kids/units';
import { bdi } from './dom';
import { formatLength, formatPitches } from './format';
import { streetName } from './names';

export interface PopupContext {
  home: HomeStreet | null;
  /** The day we marked this street as walked, or null. */
  walkedOn: string | null;
  canSpeak: boolean;
  onToggleHome(street: Street): void;
  onToggleWalked(street: Street): void;
  onSpeak(street: Street): void;
}

/** Street popup: facts, kid comparisons, read-aloud and the "our street" toggle. */
export function popupContent(street: Street, ctx: PopupContext): HTMLElement {
  const isHome = ctx.home?.streetId === street.id;
  const s = t();
  const el = document.createElement('div');
  el.className = 'street-popup';
  el.dir = document.documentElement.dir;

  const h = document.createElement('h3');
  h.append(bdi(streetName(street)));
  if (isHome) h.append(' ⭐');

  const dl = document.createElement('dl');
  const rows: [string, string][] = [
    [s.length, formatLength(street.lengthM)],
    [s.direction, s.orientation[street.orientation]],
    [s.segments, String(street.wayIds.length)],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }

  const fun = document.createElement('ul');
  fun.className = 'fun';
  const line = (icon: string, text: string, title?: string) => {
    const li = document.createElement('li');
    li.textContent = `${icon} ${text}`;
    if (title) li.title = title;
    fun.append(li);
  };
  if (isHome) line('⭐', s.isOurStreet);
  else if (ctx.home) {
    line('⭐', compareToHome(street.lengthM, ctx.home, street.id)!, s.ourStreetIs(ctx.home.name));
  }
  line('👣', formatSteps(street.lengthM));
  line('⚽', formatPitches(street.lengthM));

  const actions = document.createElement('div');
  actions.className = 'popup-actions';
  if (ctx.canSpeak) {
    const say = document.createElement('button');
    say.type = 'button';
    say.className = 'speak';
    say.textContent = s.readAloud;
    say.addEventListener('click', () => ctx.onSpeak(street));
    actions.append(say);
  }
  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'set-home';
  homeBtn.setAttribute('aria-pressed', String(isHome));
  homeBtn.textContent = isHome ? s.unsetHome : s.setHome;
  homeBtn.title = isHome ? s.unsetHomeTitle : s.setHomeTitle;
  homeBtn.addEventListener('click', () => ctx.onToggleHome(street));
  actions.append(homeBtn);

  const walkBtn = document.createElement('button');
  walkBtn.type = 'button';
  walkBtn.className = 'set-walked';
  walkBtn.setAttribute('aria-pressed', String(!!ctx.walkedOn));
  walkBtn.textContent = ctx.walkedOn ? s.walkedDone(formatDay(ctx.walkedOn)) : s.walkedMark;
  walkBtn.title = ctx.walkedOn ? s.unsetHomeTitle : s.walkedMarkTitle;
  walkBtn.addEventListener('click', () => ctx.onToggleWalked(street));
  actions.append(walkBtn);

  el.append(h, dl, fun, actions);
  // A button re-renders the popup mid-click; by the time the click reaches the map its
  // target is detached, and Leaflet would take it for a click on empty map.
  el.addEventListener('click', (e) => e.stopPropagation());
  return el;
}

/** "10.10.2026" / "10/10/2026" for a stored YYYY-MM-DD day. */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(locale());
}
