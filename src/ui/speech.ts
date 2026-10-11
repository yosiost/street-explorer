import { getLang, type Lang } from '../i18n';
import type { SpeechPart } from '../kids/units';
import { hasRecordings, playRecorded, recordingsFor, stopRecorded } from './recorded';

/**
 * Read-aloud. In Hebrew, from recordings when every part has one (./recorded.ts);
 * otherwise with the browser's built-in voices, each piece read by a voice chosen
 * explicitly for its language (never the browser default, which is usually English).
 * One sentence is never split between a recording and a device voice. Read-aloud is
 * only offered when the UI language has a voice or recordings.
 */
const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

// Android reports Hebrew with the legacy code "iw".
const LANG_CODES: Record<Lang, string[]> = { he: ['he', 'iw'], en: ['en'] };

/**
 * How good a voice sounds, from its name: neural voices (Edge's "Microsoft Hila Online
 * (Natural)") far above Apple's "Premium" and "Enhanced", and those above the basic ones.
 */
export function voiceQuality(v: Pick<SpeechSynthesisVoice, 'name'>): number {
  if (/natural|neural/i.test(v.name)) return 3;
  if (/premium/i.test(v.name)) return 2;
  if (/enhanced/i.test(v.name)) return 1;
  return 0;
}

/** The best voice for a language: the best-sounding, then the main region, then local. */
export function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = synth?.getVoices() ?? [];
  const matching = voices.filter((v) =>
    LANG_CODES[lang].some((code) => v.lang.toLowerCase().replace('_', '-').startsWith(code)),
  );
  const preferredRegion = lang === 'he' ? /-(il)$/i : /-(us|gb)$/i;
  const score = (v: SpeechSynthesisVoice) =>
    voiceQuality(v) * 4 + (preferredRegion.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0);
  // Stable: among equals, the browser's order (its default first) is kept.
  return [...matching].sort((a, b) => score(b) - score(a))[0];
}

/** Resolves once voices are known (Chrome loads them asynchronously). */
export function whenVoicesReady(): Promise<void> {
  if (!synth || synth.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    synth.addEventListener('voiceschanged', () => resolve(), { once: true });
    // Some browsers never fire the event when there are no voices at all.
    setTimeout(resolve, 2_000);
  });
}

/** Read-aloud is available in the current UI language. */
export function canSpeak(): boolean {
  return !!voiceFor(getLang()) || (getLang() === 'he' && hasRecordings());
}

const debug = () => new URLSearchParams(location.search).has('debug');

/** Speaks the parts in order, cutting off anything still being read. */
export function speak(parts: SpeechPart[]): void {
  if (!canSpeak()) return;
  stopSpeaking();
  const recorded = getLang() === 'he' ? recordingsFor(parts) : null;
  if (recorded) {
    if (debug()) console.info(`[speech] recorded: ${parts.map((p) => p.text).join(' | ')}`);
    // Offline and never played before: the device voice, if there is one.
    void playRecorded(recorded, parts).then((ok) => ok || speakWithVoice(parts));
    return;
  }
  speakWithVoice(parts);
}

function speakWithVoice(parts: SpeechPart[]): void {
  if (!synth || !voiceFor(getLang())) return;
  for (const part of parts) {
    const u = new SpeechSynthesisUtterance(part.text);
    const voice = part.voice === 'other' ? undefined : voiceFor(part.voice);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = 0.9; // a little slower, for a young listener
    if (debug()) {
      console.info(
        `[speech] ${voice?.name ?? 'default voice'} (${voice?.lang ?? '?'}): ${part.text}`,
      );
    }
    synth.speak(u);
  }
}

export function stopSpeaking(): void {
  synth?.cancel();
  stopRecorded();
}
