"""Records the app's Hebrew read-aloud with Phonikud's "Shaul" voice, ahead of time.

    node scripts/speech/phrases.mjs > phrases.json
    python record.py MODELS_DIR phrases.json public/audio/he [--log vocalized.txt]

MODELS_DIR holds phonikud-1.0.int8.onnx and shaul.onnx + model.config.json (see README.md
next to this file). Writes one MP3 per phrase, named by a hash of its text, and index.json
(text -> file) for src/ui/recorded.ts. Phrases recorded before are kept; clips no phrase
uses any more are removed.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from phonikud import phonemize
from phonikud_onnx import Phonikud
from piper_onnx import Piper

VOICE = "shaul"
# A little slower than the voice's own pace, for a young listener.
LENGTH_SCALE = 1.1

# How to say abbreviations and other spellings the diacritizer would guess wrong.
SAY_AS = {
    "ד״ר": "דוקטור",
    "התע״ש": "התעש",
    "אז״ר": "אזר",
    "החי״ש": "החיש",
    "החי״ל": "החיל",
    "אח״י": "אחי",
    "יל״ג": "ילג",
    "רמח״ל": "רמחל",
    "שד״ל": "שדל",
    "רש״י": "רשי",
    "הגר״א": "הגרא",
    "האר״י": "הארי",
    "שב״ד": "שבד",
    "צה״ל": "צהל",
    "אצ״ג": "אצג",
    "שח״ל": "שחל",
    "ניל״י": "נילי",
    "ל״ג": "לג",
    "פלמ״ח": "פלמח",
    "חב״ד": "חבד",
    "הל״ה": "הלמד הא",
    "ש״י": "שי",
    "רמב״ם": "רמבם",
    "רמטכ״ל": "רמטכל",
    "תנ״ך": "תנך",
    "ב־1917": "בשנת אלף תשע מאות ושבע עשרה",
    "ב־1492": "בשנת אלף ארבע מאות תשעים ושתיים",
    "מ־800": "משמונה מאות",
    "300 לוחמים": "שלוש מאות לוחמים",
    "1,900 שנה": "אלף ותשע מאות שנה",
}

UNITS = ["", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה", "שמונה", "תשעה"]
TEENS = ["עשרה", "אחד עשר", "שנים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר",
         "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר"]
TENS = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים", "שישים", "שבעים", "שמונים", "תשעים"]
HUNDREDS = ["", "מאה", "מאתיים", "שלוש מאות", "ארבע מאות", "חמש מאות", "שש מאות",
            "שבע מאות", "שמונה מאות", "תשע מאות"]
THOUSANDS = ["", "אלף", "אלפיים", "שלושת אלפים", "ארבעת אלפים", "חמשת אלפים", "ששת אלפים",
             "שבעת אלפים", "שמונת אלפים", "תשעת אלפים", "עשרת אלפים"]
# Counting form, for "3.5": שלוש נקודה חמש.
COUNT = ["אפס", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר",
         "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה",
         "שבע עשרה", "שמונה עשרה", "תשע עשרה", "עשרים"]


def below_thousand(n):
    parts = []
    if n >= 100:
        parts.append(HUNDREDS[n // 100])
        n %= 100
    if 10 <= n < 20:
        parts.append(TEENS[n - 10])
    else:
        if n >= 20:
            parts.append(TENS[n // 10])
        if n % 10:
            parts.append(UNITS[n % 10])
    return parts


def masculine(n):
    """A whole number in words, as said before a masculine noun (מטר, צעדים, פי)."""
    if n == 0:
        return "אפס"
    parts = []
    if n >= 1000:
        k = n // 1000
        parts.append(THOUSANDS[k] if k <= 10 else " ".join(join_and(below_thousand(k))) + " אלף")
        n %= 1000
    parts += below_thousand(n)
    return " ".join(join_and(parts))


def join_and(parts):
    """"ו" before the last part: מאה וחמישים, עשרים ושלושה."""
    if len(parts) > 1:
        parts = parts[:-1] + ["ו" + parts[-1]]
    return parts


def kilometers(m):
    whole, _, tenth = m.group(1).partition(".")
    whole = int(whole)
    if tenth:
        return f"{COUNT[whole]} נקודה {COUNT[int(tenth)]} קילומטר"
    if whole == 1:
        return "קילומטר אחד"
    if whole == 2:
        return "שני קילומטר"
    return f"{masculine(whole)} קילומטר"


def say_as(text):
    """The phrase as it should be read: abbreviations spelled out, numbers in words."""
    for written, said in SAY_AS.items():
        text = text.replace(written, said)
    text = re.sub(r"\s*\(\d+\)$", "", text)  # "כנרת (1)": two streets by one name
    text = re.sub(r"(\d+(?:\.\d)?) קילומטר", kilometers, text)
    text = re.sub(r"\d+", lambda m: masculine(int(m.group())), text)
    text = text.replace("-", " ").replace("־", " ")
    return text


def clip_id(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def trim(samples, sr, threshold=0.01, pad_s=0.04):
    """Cuts the silence at both ends, leaving a short pad."""
    loud = np.flatnonzero(np.abs(samples) > threshold)
    if not len(loud):
        return samples
    pad = int(pad_s * sr)
    return samples[max(0, loud[0] - pad): loud[-1] + pad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("models")
    ap.add_argument("phrases")
    ap.add_argument("out")
    ap.add_argument("--log", help="write each phrase as it was vocalized, for checking")
    args = ap.parse_args()

    phrases = json.load(open(args.phrases, encoding="utf-8"))
    os.makedirs(args.out, exist_ok=True)
    nikud = Phonikud(os.path.join(args.models, "phonikud-1.0.int8.onnx"))
    piper = Piper(os.path.join(args.models, f"{VOICE}.onnx"),
                  os.path.join(args.models, "model.config.json"))
    log = open(args.log, "w", encoding="utf-8") if args.log else None

    clips = {}
    made = 0
    for i, text in enumerate(phrases):
        cid = clip_id(text)
        clips[text] = cid
        path = os.path.join(args.out, f"{cid}.mp3")
        vocal = nikud.add_diacritics(say_as(text))
        if log:
            log.write(f"{cid}\t{text}\t{vocal}\n")
        if os.path.exists(path):
            continue
        samples, sr = piper.create(phonemize(vocal), is_phonemes=True, length_scale=LENGTH_SCALE)
        samples = trim(np.asarray(samples, dtype=np.float32), sr)
        samples *= 0.9 / max(1e-6, float(np.abs(samples).max()))
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, samples, sr)
            subprocess.run(["lame", "--quiet", "-m", "m", "-b", "40", wav.name, path], check=True)
        made += 1
        if made % 50 == 0:
            print(f"{i + 1}/{len(phrases)}", file=sys.stderr)

    used = {f"{cid}.mp3" for cid in clips.values()}
    removed = 0
    for name in os.listdir(args.out):
        if name.endswith(".mp3") and name not in used:
            os.remove(os.path.join(args.out, name))
            removed += 1
    with open(os.path.join(args.out, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"voice": VOICE, "clips": dict(sorted(clips.items()))}, f,
                  ensure_ascii=False, separators=(",", ":"))
    print(f"{len(clips)} phrases: {made} recorded, {removed} removed", file=sys.stderr)


if __name__ == "__main__":
    main()
