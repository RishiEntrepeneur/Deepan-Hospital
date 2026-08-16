# Reading pages aloud

The app can read text to a patient instead of making them read it. This matters
more here than in most software: a hospital's users include people who are
elderly, unwell, worried, reading in their second language, or who cannot read
comfortably at all.

**It already works. You do not have to set anything up.**

---

## How it decides what to use

Two backends, tried in that order:

| | When it is used | Cost | Quality |
| --- | --- | --- | --- |
| **The browser's own speech** | Always, unless the one below is configured | ₹0 | Fine. Genuinely fine |
| **ElevenLabs** | Only when `ELEVENLABS_API_KEY` is set on the server | Per character | Better, especially Tamil and Hindi |

If ElevenLabs is configured but unreachable, out of quota, or misconfigured,
the app silently falls back to browser speech. The patient hears a voice either
way. Nothing about that failure reaches them.

### Should you pay for ElevenLabs?

**If the voices sound robotic to you, yes.** That is the whole difference, and
no amount of configuration fixes it on the free path: browser speech sounds
like a satnav, ElevenLabs sounds like a person.

The machine this was built on has exactly one voice per language, all of them
the compact system ones:

```
Tamil    Vani  / ta-IN
Hindi    Lekha / hi-IN
English  Rishi / en-IN
```

There is no better one to switch to. Some devices carry higher-quality
"enhanced" or "premium" variants that sound considerably better, but they are
an operating-system download on each patient's own device — not something this
app can install for them, and not something you can rely on.

So the choice is honest and binary: accept the satnav, or pay for the key. For
a hospital where a good part of the point is patients who cannot comfortably
read, the voice is the feature, and it is worth the ₹9,000–₹22,000/year.

Note the one case where browser speech genuinely fails: a device with no Tamil
or Hindi voice installed. The button hides itself there rather than reading
Tamil text with an English engine, which produces confident nonsense. If a lot
of your patients are on such devices, ElevenLabs fixes it for all of them at
once, because the server does the speaking.

---

## Turning ElevenLabs on

1. Create an account at elevenlabs.io and generate an API key.
2. Put it in `server/.env`:

```
ELEVENLABS_API_KEY=your_key_here
```

3. Restart the API.

**That is the whole setup.** There is nothing else to configure: on first use
the server asks ElevenLabs which models exist, which languages each one covers,
and which voices your account holds — then picks the best multilingual model
and a voice per language by itself.

Check what it chose:

```bash
cd server && npm run voices
```

and hear it:

```bash
cd server && npm run voices -- --try
```

That writes one sample per language to a temporary folder and prints the path.
Listen to the Tamil and Hindi before deciding you are happy.

### Choosing different voices

If you prefer another voice, `npm run voices` lists every voice in your account
with its ID. Put the one you want in `server/.env`:

```
ELEVENLABS_VOICE_HI=<id>
```

Anything you set here overrides the automatic choice; anything you leave unset
stays automatic. **Delete the cached audio afterwards** or the old voice keeps
being served until each clip is evicted:

```bash
rm -rf server/data/speech
```

### A note on the model

`ELEVENLABS_MODEL` is also chosen automatically, and it is picked by asking
ElevenLabs which languages each model actually covers rather than by assuming.
That matters for Tamil in particular — not every multilingual model speaks it,
and one that does not will read Tamil script as confident nonsense. If no
available model covers all three languages, the server says so in its log at
startup rather than quietly mispronouncing one.

---

## What it costs, and why it is less than you think

ElevenLabs bills per character. The obvious fear is that reading pages aloud to
every patient runs up a bill.

It does not, because **generated audio is cached on disk by content hash**. The
app reads a small, fixed set of strings — department names, doctor summaries,
assistant replies. The hundredth patient to hear "हृदय रोग" costs nothing; the
first one paid for it.

What is *not* cached is genuinely new text, which in practice means assistant
answers that interpolate live numbers. Still a small set.

Guardrails, all in `server/.env`:

| Setting | Default | What it does |
| --- | --- | --- |
| `SPEECH_MAX_CHARS` | 800 | Longest passage read in one request. Refuses longer |
| `SPEECH_CACHE_MAX` | 2000 | Clips kept on disk. Oldest are dropped past this |
| — | 40/min per IP | Rate limit, so nobody can run up a bill by holding the button |

The cache lives in `server/data/speech/`. It is safe to delete at any time; it
refills itself. Delete it after changing a voice, or the old voice is served
from cache until each clip is evicted.

---

## Where the button appears

Attached to specific passages, not to the page:

- **Each assistant reply** — the most useful one by far
- **Each doctor's profile** — reads a composed summary (name, speciality,
  department, consulting days, room, fee) rather than reciting the layout

It deliberately does not read whole pages. A control that starts reciting the
navigation, the footer and the emergency banner is one people press once.

---

## The key never reaches the browser

The front end posts text to `POST /api/speech` and gets audio back. It never
sees the key, the voice IDs, or the model.

This is not incidental. A TTS key in front-end code is printed in the page
source, and anybody who opens developer tools can read it and spend the
hospital's balance. There is no way to put a key in a browser safely — the
server proxy is the only correct shape for this.

---

## If it stops working

**Nobody hears anything, on any device**
Browser speech needs a user gesture to start. Every trigger here is a button
press, so this should not happen — but a browser extension blocking audio will
do it. Test in a private window.

**Works in English, silent in Tamil or Hindi**
That device has no voice for the language, and the button hides itself. Check
in the browser console:

```js
speechSynthesis.getVoices().filter(v => v.lang.startsWith('ta'))
```

Empty means the language pack is not installed. On iOS: Settings → Accessibility
→ Spoken Content → Voices. Or configure ElevenLabs, which sidesteps the
device entirely.

**Configured ElevenLabs but it still sounds like the browser**
Check the server log for a line like:

```
[speech] ElevenLabs returned 401 for hi
```

401 is a bad key, 429 is quota. The app is falling back on purpose. Patients are
unaffected; you are simply not getting what you are paying for.

**Check which backend answered a request**

```bash
curl -s -D- -o /dev/null -X POST localhost:4000/api/speech \
  -H 'Content-Type: application/json' \
  -d '{"text":"test","lang":"en"}'
```

`503` means browser speech is doing the work. `200` with `X-Speech-Cache: hit`
or `miss` means ElevenLabs is live — and `hit` means that clip cost nothing.
