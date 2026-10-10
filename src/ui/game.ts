import { GAME_RECENT_ROUNDS } from '../config';
import type { Street } from '../geo/streets';
import { gameCandidates, minRatioFor, pickPair, type Pair } from '../kids/pair';
import { t } from '../i18n';
import { formatRatio, say as sayText, sayName, type SpeechPart } from '../kids/units';
import { confetti } from './celebrate';
import { bdi } from './dom';
import { formatLength } from './format';
import { streetName } from './names';
import { PAIR_COLORS, type MapView } from './map';
import { speak, stopSpeaking } from './speech';
import type { Store } from './store';

type Side = 'red' | 'blue';
const RACE_MS = 2_500; // the longer bar's run; the shorter one stops early at the same speed
const VOICE_KEY = 'street-explorer:game-voice';

/** Minimum number of fair streets for the game to make sense in a city. */
export const GAME_MIN_STREETS = 4;

export function canPlay(streets: Street[]): boolean {
  return gameCandidates(streets).length >= GAME_MIN_STREETS;
}

/**
 * "Which is longer?": two streets light up in red and blue, the kid taps one (a button or
 * the line on the map), the two lengths race as bars, and the winner gets a trophy.
 */
export function mountGame(panel: HTMLElement, store: Store, mapView: MapView) {
  let pair: Pair | null = null;
  let answered = false;
  let score = 0;
  let round = 0;
  let streak = 0;
  let recent: string[] = [];
  let raceTimer: number | undefined;
  let voice = readVoicePref();
  // Set once the race is over; the verdict is re-rendered from it when the language changes.
  let outcome: { right: boolean; winnerSide: Side; streak: number } | null = null;

  // --- Static skeleton ---
  panel.replaceChildren();
  const top = el('div', 'game-top');
  const scoreEl = el('span', 'game-score');
  const roundEl = el('span', 'game-round');
  const voiceBtn = button('game-voice', '');
  const exitBtn = button('game-exit', '');
  top.append(scoreEl, roundEl, voiceBtn, exitBtn);

  const title = el('h2', 'game-title');
  const hint = el('p', 'game-hint');
  const choices = el('div', 'choices');
  const choiceBtn = { red: button('choice red', ''), blue: button('choice blue', '') };
  choices.append(choiceBtn.red, choiceBtn.blue);

  const race = el('div', 'race');
  const bar = { red: raceRow('red'), blue: raceRow('blue') };
  race.append(bar.red.row, bar.blue.row);
  const verdict = el('p', 'verdict');
  verdict.setAttribute('aria-live', 'polite');
  const praise = el('p', 'praise');
  const next = button('game-next', '');
  panel.append(top, title, hint, choices, race, verdict, praise, next);

  for (const side of ['red', 'blue'] as const) {
    choiceBtn[side].addEventListener('click', () => pair && answer(pair[side].id));
  }
  next.addEventListener('click', newRound);
  exitBtn.addEventListener('click', () => store.set({ gameOn: false }));
  voiceBtn.addEventListener('click', () => {
    voice = !voice;
    writeVoicePref(voice);
    if (!voice) stopSpeaking();
    renderVoice();
  });

  function renderVoice() {
    const { canSpeak } = store.get();
    voiceBtn.hidden = !canSpeak;
    voiceBtn.textContent = voice ? t().readAloud : t().readAloudOff;
    voiceBtn.setAttribute('aria-pressed', String(voice));
  }

  function renderScore() {
    scoreEl.textContent = `⭐ ${score}`;
    scoreEl.setAttribute('aria-label', t().gameScoreLabel(score));
    roundEl.textContent = t().gameRound(round);
  }

  /** All language-dependent text of the current round. */
  function renderText() {
    const s = t();
    exitBtn.textContent = s.gameExit;
    title.textContent = s.gameTitle;
    hint.textContent = s.gameHint;
    next.textContent = s.gameNext;
    renderVoice();
    renderScore();
    if (!pair) return;
    const { home, shownCity } = store.get();
    const homeId = home && shownCity && home.cityId === shownCity.id ? home.streetId : null;
    for (const side of ['red', 'blue'] as const) {
      const street = pair[side];
      const b = choiceBtn[side];
      b.replaceChildren(el('span', 'swatch'), bdi(streetName(street)));
      if (street.id === homeId) b.append(' ⭐');
      b.setAttribute('aria-label', s.choiceLabel(s.sideWord[side], streetName(street)));
      bar[side].label(street);
    }
    if (!outcome) {
      verdict.textContent = '';
      praise.textContent = '';
      return;
    }
    const winner = pair[outcome.winnerSide];
    const loser = pair[outcome.winnerSide === 'red' ? 'blue' : 'red'];
    verdict.replaceChildren(
      `${outcome.right ? s.right : s.almost(s.sideWord[outcome.winnerSide])} `,
      bdi(streetName(winner)),
      ` ${formatRatio(winner.lengthM, loser.lengthM)}.`,
    );
    praise.textContent = outcome.right ? (s.praise[outcome.streak] ?? '') : '';
  }

  function say(parts: SpeechPart[]) {
    if (voice && store.get().canSpeak) speak(parts);
  }

  function newRound() {
    const { result, home, shownCity } = store.get();
    if (!result) return;
    window.clearTimeout(raceTimer);
    const homeId = home && shownCity && home.cityId === shownCity.id ? home.streetId : null;
    const p = pickPair(gameCandidates(result.streets), {
      minRatio: minRatioFor(streak),
      recent: new Set(recent),
      homeId,
    });
    if (!p) {
      store.set({ gameOn: false });
      return;
    }
    pair = p;
    answered = false;
    outcome = null;
    round++;
    recent = [p.red.id, p.blue.id, ...recent].slice(0, GAME_RECENT_ROUNDS * 2);

    for (const side of ['red', 'blue'] as const) {
      const b = choiceBtn[side];
      b.disabled = false;
      b.classList.remove('right', 'wrong');
      bar[side].reset(p[side]);
    }
    race.hidden = true;
    next.hidden = true;
    hint.hidden = false;
    renderText();
    mapView.showPair(p.red.id, p.blue.id);
    choiceBtn.red.focus({ preventScroll: true });
    const [ask, or] = t().spokenQuestion;
    say([sayText(ask), sayName(streetName(p.red)), sayText(or), sayName(streetName(p.blue))]);
  }

  function answer(id: string) {
    if (!pair || answered) return;
    answered = true;
    const p = pair;
    const winnerSide: Side = p.red.lengthM >= p.blue.lengthM ? 'red' : 'blue';
    const winner = p[winnerSide];
    const loser = p[winnerSide === 'red' ? 'blue' : 'red'];
    const right = id === winner.id;
    const chosenSide: Side = id === p.red.id ? 'red' : 'blue';

    if (right) {
      score++;
      streak++;
    } else streak = 0;
    for (const side of ['red', 'blue'] as const) choiceBtn[side].disabled = true;
    choiceBtn[chosenSide].classList.add(right ? 'right' : 'wrong');
    hint.hidden = true;

    // The race: same speed for both bars, so the longer street visibly keeps going.
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const max = winner.lengthM;
    race.hidden = false;
    for (const side of ['red', 'blue'] as const) {
      bar[side].run(p[side].lengthM / max, reduce ? 0 : (RACE_MS * p[side].lengthM) / max);
    }
    raceTimer = window.setTimeout(
      () => {
        mapView.revealPair(winner.id);
        outcome = { right, winnerSide, streak };
        renderText();
        next.hidden = false;
        next.focus({ preventScroll: true });
        if (right && !reduce) confetti();
        const s = t();
        say([
          sayText(right ? s.spokenRight : s.almost(s.sideWord[winnerSide])),
          sayName(streetName(winner)),
          sayText(`${formatRatio(winner.lengthM, loser.lengthM)}.`),
        ]);
      },
      reduce ? 0 : RACE_MS + 150,
    );
  }

  function start() {
    score = 0;
    round = 0;
    streak = 0;
    recent = [];
    renderVoice();
    newRound();
  }

  function stop() {
    window.clearTimeout(raceTimer);
    pair = null;
    stopSpeaking();
    mapView.endPair();
  }

  store.subscribe((s, prev) => {
    if (s.gameOn !== prev.gameOn) {
      if (s.gameOn) start();
      else stop();
    }
    // A different city ends the game.
    if (s.gameOn && s.result !== prev.result) store.set({ gameOn: false });
    if (s.canSpeak !== prev.canSpeak) renderVoice();
    if (s.lang !== prev.lang && s.gameOn) renderText();
  });

  return { answer };
}

function raceRow(side: Side) {
  const row = el('div', `race-row ${side}`);
  const label = el('span', 'race-label');
  const track = el('div', 'race-track');
  const fill = el('div', 'race-fill');
  fill.style.background = PAIR_COLORS[side];
  const len = el('span', 'race-length');
  track.append(fill);
  row.append(label, track, len);
  return {
    row,
    reset(street: Street) {
      len.textContent = '';
      fill.style.transition = 'none';
      fill.style.width = '0';
      this.label(street);
    },
    label(street: Street) {
      label.replaceChildren(bdi(streetName(street)));
      len.dataset.text = formatLength(street.lengthM);
      if (len.textContent) len.textContent = len.dataset.text;
    },
    run(fraction: number, ms: number) {
      // Force a layout so the transition starts from 0.
      void fill.offsetWidth;
      fill.style.transition = `width ${ms}ms linear`;
      fill.style.width = `${(fraction * 100).toFixed(1)}%`;
      window.setTimeout(() => (len.textContent = len.dataset.text ?? ''), ms);
    },
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function button(className: string, text: string) {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

function readVoicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeVoicePref(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
}
