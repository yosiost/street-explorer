import type { SpeechPart } from '../kids/units';

/**
 * Hebrew read-aloud from recordings made ahead of time with the open-source Phonikud
 * "Shaul" voice (scripts/speech): every sentence the app says, and the street names of the
 * bundled cities. Device Hebrew voices mispronounce many names; these were vocalized first.
 *
 * Clips are fetched when first needed and played back to back through Web Audio, so there
 * is no gap while the next one loads.
 */
const BASE = `${import.meta.env.BASE_URL}audio/he/`;
// Pause between parts; a little longer after the end of a sentence.
const GAP_S = 0.12;
const SENTENCE_GAP_S = 0.3;

let clips: Record<string, string> | null = null;
let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let playing: AudioBufferSourceNode[] = [];
let generation = 0;

/** Loads the list of recordings; resolves either way. */
export async function loadRecordings(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (clips || typeof AudioContext === 'undefined') return;
  try {
    const res = await fetchImpl(`${BASE}index.json`);
    if (res.ok) clips = ((await res.json()) as { clips: Record<string, string> }).clips;
  } catch {
    // Offline before the first visit, or no recordings: the device voice it is.
  }
}

export const hasRecordings = (): boolean => clips !== null;

/** The recording of each part, or null when any part has none. */
export function recordingsFor(parts: SpeechPart[]): string[] | null {
  if (!clips) return null;
  const ids: string[] = [];
  for (const part of parts) {
    const id = clips[part.text];
    if (!id) return null;
    ids.push(id);
  }
  return ids;
}

/**
 * Plays the recordings of these parts. Call it while handling a tap: browsers only let
 * sound start from one. Resolves false if they could not be played (offline, say).
 */
export function playRecorded(ids: string[], parts: SpeechPart[]): Promise<boolean> {
  stopRecorded();
  const gen = generation;
  ctx ??= new AudioContext();
  // iOS: play even when the ring switch is on silent, like the device voice does.
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  void ctx.resume();
  const audio = ctx;
  return Promise.all(ids.map((id) => load(audio, id)))
    .then((decoded) => {
      if (gen !== generation) return true;
      let at = audio.currentTime + 0.05;
      decoded.forEach((buffer, i) => {
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.start(at);
        playing.push(source);
        at += buffer.duration + (/[.!?]$/.test(parts[i]!.text) ? SENTENCE_GAP_S : GAP_S);
      });
      return true;
    })
    .catch(() => false);
}

function load(audio: AudioContext, id: string): Promise<AudioBuffer> {
  let buffer = buffers.get(id);
  if (!buffer) {
    buffer = fetch(`${BASE}${id}.mp3`)
      .then((res) => {
        if (!res.ok) throw new Error(`recording ${id}: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => audio.decodeAudioData(data));
    // A failed load is tried again next time.
    buffer.catch(() => buffers.delete(id));
    buffers.set(id, buffer);
  }
  return buffer;
}

export function stopRecorded(): void {
  generation++;
  for (const source of playing) {
    try {
      source.stop();
    } catch {
      // Not started yet.
    }
  }
  playing = [];
}
