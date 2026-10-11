# Hebrew recordings

The app's Hebrew read-aloud is played from recordings in `public/audio/he/`, made with
the open-source [Phonikud](https://phonikud.github.io) Hebrew diacritizer and its Piper
voice "Shaul". Device Hebrew voices guess the vowels and get many street names wrong;
Phonikud adds them first.

Re-record after changing anything the read-aloud says (`test/phrases.test.ts` fails until
you do) or after refreshing the bundled city data. Clips already recorded are kept, so
only new phrases take time.

## Setup (once)

```sh
uv venv --python 3.12 .venv-speech
uv pip install --python .venv-speech phonikud phonikud-onnx piper-onnx soundfile numpy
brew install lame
```

Models, into a folder outside the repo (about 400 MB):

- `phonikud-1.0.int8.onnx` from <https://huggingface.co/Phonikud/phonikud-onnx>
- `shaul.onnx` and `model.config.json` from
  <https://huggingface.co/Phonikud/phonikud-tts-checkpoints>

The voice models are licensed for **non-commercial use only**, and so are the recordings.

## Recording

```sh
node scripts/speech/phrases.mjs > /tmp/phrases.json
.venv-speech/bin/python scripts/speech/record.py MODELS /tmp/phrases.json public/audio/he \
  --log /tmp/vocalized.txt
```

`--log` lists each phrase with the vowels Phonikud gave it, to check by eye. Abbreviations
(ד״ר, רמב״ם) and numbers are spelled out by `SAY_AS` and the number words in `record.py`;
add a `SAY_AS` entry when a name comes out wrong, delete its clip, and run again.
