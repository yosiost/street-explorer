import { getLang, type Lang } from '../i18n';
import type { SpeechPart } from '../kids/units';

/**
 * Read-aloud with the browser's built-in voices. Each piece is read by a voice chosen
 * explicitly for its language (never the browser default, which is usually English), and
 * read-aloud is only offered when the UI language has a voice.
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
  return !!voiceFor(getLang());
}

/** Speaks the parts in order, cutting off anything still being read. */
export function speak(parts: SpeechPart[]): void {
  if (!synth || !canSpeak()) return;
  synth.cancel();
  for (const part of parts) {
    const u = new SpeechSynthesisUtterance(part.text);
    const voice = part.voice === 'other' ? undefined : voiceFor(part.voice);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = 0.9; // a little slower, for a young listener
    if (new URLSearchParams(location.search).has('debug')) {
      console.info(
        `[speech] ${voice?.name ?? 'default voice'} (${voice?.lang ?? '?'}): ${part.text}`,
      );
    }
    synth.speak(u);
  }
}

export function stopSpeaking(): void {
  synth?.cancel();
}
