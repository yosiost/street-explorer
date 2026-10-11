import type { Street } from '../geo/streets';
import { getLang, t } from '../i18n';
import { findCandidates, isTarget, pickTarget } from '../kids/find';
import { walkedIn } from '../kids/walked';
import { findNamesake } from '../kids/namesakes';
import { say as sayText, sayName, spokenNamesake, type SpeechPart } from '../kids/units';
import { confetti } from './celebrate';
import { bdi } from './dom';
import { button, el, readVoicePref, writeVoicePref } from './game';
import type { MapView } from './map';
import { streetName } from './names';
import { speak, stopSpeaking } from './speech';
import type { Store } from './store';

const RECENT_ROUNDS = 8;

/**
 * "Find it!": the app says a street's name, and the kid finds it on the map and taps it.
 * A wrong tap shows which street that was; the second one zooms in as a clue, and the
 * third shows where it is.
 */
export function mountFind(panel: HTMLElement, store: Store, mapView: MapView) {
  let target: Street | null = null;
  let wrongTaps = 0;
  let done = false;
  let score = 0;
  let round = 0;
  let streak = 0;
  let recent: string[] = [];
  let voice = readVoicePref();
  // What the feedback line says; re-rendered from it when the language changes.
  let feedback: { kind: 'wrong'; tapped: Street } | { kind: 'clue' | 'found' | 'reveal' } | null =
    null;

  // --- Static skeleton ---
  panel.replaceChildren();
  const top = el('div', 'game-top');
  const scoreEl = el('span', 'game-score');
  const roundEl = el('span', 'game-round');
  const voiceBtn = button('game-voice', '');
  const exitBtn = button('game-exit', '');
  top.append(scoreEl, roundEl, voiceBtn, exitBtn);

  const title = el('h2', 'game-title');
  const card = el('div', 'find-target');
  const nameEl = el('span', 'find-name');
  const again = button('find-again', '');
  card.append(nameEl, again);
  const hint = el('p', 'game-hint');
  const verdict = el('p', 'verdict');
  verdict.setAttribute('aria-live', 'polite');
  const fact = el('p', 'find-fact');
  const next = button('game-next', '');
  panel.append(top, title, card, hint, verdict, fact, next);

  exitBtn.addEventListener('click', () => store.set({ game: null }));
  next.addEventListener('click', newRound);
  again.addEventListener('click', () => target && speak(question(target)));
  voiceBtn.addEventListener('click', () => {
    voice = !voice;
    writeVoicePref(voice);
    if (!voice) stopSpeaking();
    renderVoice();
  });

  function renderVoice() {
    const { canSpeak } = store.get();
    voiceBtn.hidden = !canSpeak;
    again.hidden = !canSpeak;
    voiceBtn.textContent = voice ? t().readAloud : t().readAloudOff;
    voiceBtn.setAttribute('aria-pressed', String(voice));
  }

  function renderText() {
    const s = t();
    exitBtn.textContent = s.gameExit;
    title.textContent = s.findTitle;
    hint.textContent = s.findHint;
    next.textContent = s.gameNext;
    again.textContent = s.findSayAgain;
    scoreEl.textContent = `⭐ ${score}`;
    scoreEl.setAttribute('aria-label', s.gameScoreLabel(score));
    roundEl.textContent = s.gameRound(round);
    renderVoice();
    if (!target) return;
    nameEl.replaceChildren('🔎 ', bdi(streetName(target)));
    verdict.className = `verdict${feedback?.kind === 'wrong' ? ' wrong' : ''}`;
    if (!feedback) verdict.textContent = '';
    else if (feedback.kind === 'wrong') {
      const [before, after] = s.findWrong;
      verdict.replaceChildren(`${before} `, bdi(streetName(feedback.tapped)), after);
    } else {
      verdict.textContent = {
        clue: s.findClue,
        found: s.findRight,
        reveal: s.findReveal,
      }[feedback.kind];
    }
    const person = done ? findNamesake(target) : null;
    fact.hidden = !person;
    if (person) {
      const p = person[getLang()];
      const strong = el('strong', '', s.namedAfter(p.name));
      fact.replaceChildren(`${person.emoji} `, strong, ` ${p.about}`);
    }
  }

  function say(parts: SpeechPart[]) {
    if (voice && store.get().canSpeak) speak(parts);
  }

  function question(street: Street): SpeechPart[] {
    const [before, after] = t().spokenFind;
    return [sayText(before), sayName(streetName(street)), ...(after ? [sayText(after)] : [])];
  }

  /** Every piece of the target street (a street can be drawn in a few pieces). */
  function targetIds(): string[] {
    const { result } = store.get();
    if (!result || !target) return [];
    return result.streets.filter((s) => isTarget(s, target!)).map((s) => s.id);
  }

  function newRound() {
    const { result, home, shownCity, walked } = store.get();
    if (!result || !shownCity) return;
    const byId = new Map(result.streets.map((s) => [s.id, s]));
    const favorites = new Set<string>();
    for (const id of Object.keys(walkedIn(walked, shownCity.id))) {
      const s = byId.get(id);
      if (s) favorites.add(s.name);
    }
    if (home && home.cityId === shownCity.id) {
      const s = byId.get(home.streetId);
      if (s) favorites.add(s.name);
    }
    const next_ = pickTarget(findCandidates(result.streets), {
      streak,
      recent: new Set(recent),
      favorites,
    });
    if (!next_) {
      store.set({ game: null });
      return;
    }
    target = next_;
    recent = [next_.name, ...recent].slice(0, RECENT_ROUNDS);
    round++;
    wrongTaps = 0;
    done = false;
    feedback = null;
    next.hidden = true;
    hint.hidden = false;
    mapView.startFind(targetIds());
    renderText();
    say(question(next_));
  }

  function tap(id: string) {
    const { result } = store.get();
    const tapped = result?.streets.find((s) => s.id === id);
    if (!target || done || !tapped) return;
    const s = t();
    if (isTarget(tapped, target)) {
      score++;
      streak++;
      finish('found');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) confetti();
      say([sayText(s.spokenFound), ...namesakeSpeech()]);
      return;
    }
    wrongTaps++;
    mapView.markWrong(id);
    if (wrongTaps >= 3) {
      streak = 0;
      finish('reveal');
      say([sayText(s.spokenReveal), sayName(streetName(target)), ...namesakeSpeech()]);
      return;
    }
    if (wrongTaps === 2) {
      feedback = { kind: 'clue' };
      mapView.clue(targetIds());
      say([sayText(s.spokenClue)]);
    } else {
      feedback = { kind: 'wrong', tapped };
      const [before, after] = s.spokenWrong;
      say([sayText(before), sayName(streetName(tapped)), sayText(after)]);
    }
    renderText();
  }

  function finish(kind: 'found' | 'reveal') {
    done = true;
    feedback = { kind };
    mapView.revealFind(targetIds(), kind === 'found');
    hint.hidden = true;
    next.hidden = false;
    renderText();
    next.focus({ preventScroll: true });
  }

  function namesakeSpeech(): SpeechPart[] {
    const person = target && findNamesake(target);
    return person ? [spokenNamesake(person)] : [];
  }

  function start() {
    score = 0;
    round = 0;
    streak = 0;
    recent = [];
    voice = readVoicePref();
    newRound();
  }

  function stop() {
    target = null;
    stopSpeaking();
    mapView.endFind();
  }

  store.subscribe((s, prev) => {
    const on = s.game === 'find';
    if (on !== (prev.game === 'find')) {
      if (on) start();
      else stop();
    }
    if (on && s.result !== prev.result) store.set({ game: null });
    if (s.canSpeak !== prev.canSpeak) renderVoice();
    if (s.lang !== prev.lang && on) renderText();
  });

  return { tap };
}
