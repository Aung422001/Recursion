# Recursion

A Duolingo-style language learning app covering **10 languages in 90 course
pairs**, in both directions. Short lessons, immediate feedback, and an SM-2
spaced-repetition scheduler that brings each word back on the day you are about
to forget it.

**Languages:** English · Burmese · Thai · Japanese · Korean · Vietnamese ·
Indonesian · Malay · Hindi · Arabic

Each course covers the writing system as well as the words — vowels, consonants
and tone marks with their sounds and example words — and every word can be
played aloud.

**Stack:** React + Vite + Tailwind · Node.js + Express · MongoDB + Mongoose · JWT auth · npm workspaces

---

## Quick start

```bash
npm install                     # installs all three workspaces at once

# Start MongoDB — either one:
docker compose up -d            # if you have Docker
# ...or use a local MongoDB service listening on 27017

cp server/.env.example server/.env   # then fill in the two JWT secrets
npm run seed                    # 8 units / 80 concepts / 800 translations / 10 alphabets
npm run dev                     # client on :5173, server on :4000
```

Generate the JWT secrets with `openssl rand -hex 32` (or
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
Both must be at least 32 characters, and the server refuses to boot without them
rather than failing later with a confusing token error.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Client and server together, with reload |
| `npm run seed` | Load/refresh course content (idempotent) |
| `npm test` | Server suite then client suite |
| `npm run lint` | ESLint across all workspaces |
| `npm run build:client` | Production client build |

---

## Architecture

```
recursion/
├── client/     React SPA — pages, exercise components, API wrappers
├── server/     Express API — models, routes, controllers, services, seed
└── shared/     Constants used by both (exercise types, SM-2 grades, XP values)
```

The client dev server proxies `/api` to `localhost:4000`, so in development the
browser treats the app as same-origin and the httpOnly refresh cookie needs no
CORS negotiation.

### Data model

- **User** — credentials, the active course (`sourceLang` → `targetLang`), XP,
  streak counters, `refreshTokenVersion`
- **Unit** → **Lesson** — language-neutral templates; a lesson is an ordered
  list of concepts, not of exercises
- **Concept** — one meaning with its translation in every language
- **Alphabet** — one document per language holding its whole writing system
- **UserProgress** — one row per (user, concept, **language**) holding SM-2 state
- **LessonCompletion** — one row per lesson attempt, scoped to the course it was
  taken in

### Why concepts instead of word pairs

Ten languages make ninety ordered pairs. Authoring content per pair would mean
writing "thank you" ninety times and maintaining ninety copies of every fix.

Instead a concept holds one meaning in all ten languages, and a course is a
projection of that single set through two language codes. 80 concepts × 10
languages = 800 translations gives all 90 courses, and adding an eleventh
language is one more key per concept — it opens 20 new courses at once.

Exercises follow the same logic: they are **generated per course on request**
from a PRNG seeded on `lesson + source + target`, rather than stored. Storing
them would mean 16 lessons × 90 courses = 1,440 near-identical documents to
regenerate on every content change. Because generation is deterministic, the
server can rebuild a lesson to grade an answer without remembering what it sent.

### Notable decisions

**Grading happens on the server.** Lessons are sent to the client with
`correctAnswer` stripped, and each answer is posted back to be graded. This keeps
the answers out of the page source and makes every answer a natural place to
update the spaced-repetition schedule.

**Distractors come from the same unit** as the answer, so the wrong options are
plausible rather than absurd.

**The script is content, not decoration.** Each language has an alphabet of its
own — 44 Thai consonants, 33 Devanagari consonants and 11 vowels, 46 hiragana,
28 Arabic letters — with a name, a sound, and usually an example word for each.
Unlike vocabulary this is *not* fed into spaced repetition: learning a script is
a short one-off hurdle, and once the letters are known every lesson reinforces
them. Japanese is the exception that proves the model — hiragana is a syllabary,
so it has vowels and syllables but no standalone consonants, and the data says so
rather than forcing it into the wrong shape.

**Progress is tracked per language, not per course.** Knowing こんにちは is the
same knowledge whether you reached Japanese from English or from Malay, so the
SM-2 schedule is keyed on (concept, language). Lesson completions *are* per
course, since finishing a lesson in Thai says nothing about Korean.

**Typed answers are only asked in a language the learner can type.** Nobody has
a Burmese keyboard on a laptop, so the typed direction flips to whichever side
uses a Latin script; when neither does (Thai → Japanese), typing is skipped and
the lesson leans on multiple choice and matching.

**Scripts are handled explicitly.** Each language declares its script, writing
direction and whether it needs romanization. Text is rendered with a font that
covers it and the right `dir`, or Burmese, Thai and Devanagari come out as boxes
and Arabic runs backwards. Flag emoji are deliberately *not* used: Windows ships
no glyphs for them, and a language is not a country.

**A failed word comes back in ten minutes, not tomorrow.** Textbook SM-2 puts a
lapsed item at a one-day interval; getting a word wrong and not seeing it again
for 24 hours is how learners lose words, so a lapse schedules a same-session
retry and resets the repetition ladder.

**Streaks roll over at the learner's local midnight**, not UTC. Someone studying
at 11pm in Yangon should not lose a streak to a server clock. The client reports
its UTC offset at signup; read paths also zero out a streak that has silently
expired, so the dashboard never shows a streak the learner has already lost.

**The access token lives in memory only** — never `localStorage` — and is
re-issued on load from the httpOnly refresh cookie. `refreshTokenVersion` on the
user gives "log out everywhere" without maintaining a token blocklist.

### Auth flow

```
register/login ─→ access token (15 min, in memory)
                └→ refresh token (30 days, httpOnly cookie)

any 401 ─→ one silent POST /api/auth/refresh ─→ retry the original request
```

Concurrent requests share a single in-flight refresh rather than racing each
other, so an access token expiring mid-lesson is invisible to the learner.

---

## API

All routes are under `/api`. Everything except health and the auth endpoints
requires `Authorization: Bearer <accessToken>`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness + database connectivity |
| POST | `/auth/register` · `/auth/login` | Create a session |
| POST | `/auth/refresh` · `/auth/logout` | Rotate / end a session |
| POST | `/auth/logout-everywhere` | Revoke every refresh token |
| GET | `/auth/me` | Current user + due-review count |
| GET | `/languages` | The language catalogue (public) |
| GET | `/courses` | All 90 pairs with per-course progress |
| PUT | `/courses/active` | Switch the learner to another pair |
| GET | `/units` | Unit map for the active course |
| GET | `/lessons/:idOrSlug` | One lesson generated for the course, answers stripped |
| POST | `/lessons/:idOrSlug/attempt` | Grade one answer, update SM-2, award XP |
| POST | `/lessons/:idOrSlug/complete` | Record the attempt, roll the streak |
| GET | `/review/due?limit=` | Due words as generated questions |
| POST | `/review/attempt` | Grade a review, reschedule the word |
| GET | `/progress/summary` | Dashboard: level, totals, accuracy over time |
| GET | `/progress/vocab` | Every tracked word with its schedule |
| GET | `/tts/status` | Whether server audio is on, and for which languages (public) |
| GET | `/tts?text=&lang=` | One word as MP3, cached |
| GET | `/alphabet` | The writing system, grouped into vowels, consonants, tones |
| GET | `/alphabet/drill` | A round of "which sound is this letter?" |
| POST | `/alphabet/attempt` | Grade one letter, award XP |

---

## Testing

```bash
npm test              # 218 tests
npm run test:server   # 163 — unit + integration against a throwaway database
npm run test:client   # 55 — component tests with React Testing Library
```

The TTS tests stub `fetch`, so the suite never touches the network.

Server tests run against `recursion_test` on the same MongoDB instance and clean
up after themselves; they do not touch the development database. The SM-2 and
streak services are pure functions with an injectable clock, so their edge cases
(lapses, ease-factor floors, timezone boundaries, missed days) are tested without
any database at all.

---

## Security

- bcrypt at 12 rounds; login returns an identical error for a wrong password and
  an unknown email, so accounts cannot be enumerated
- Zod validation on every request body and query string
- Rate limiting: 20 attempts / 15 min / IP on credential routes
- `helmet`, CORS pinned to `CLIENT_ORIGIN` with credentials
- Client-reported lesson scores are clamped to the real lesson length

---

## Content

Course content lives in `server/src/seed/data/*.json`, one file per unit — 8
units, 80 concepts, 16 lessons, 800 translations. Writing systems live alongside
them in `server/src/seed/data/alphabets/<lang>.json` — 10 scripts, 398 letters.
Adding content means editing JSON, not code.

Adding a language means adding its code to `LANGUAGES` in `shared/constants.js`
(with its script, direction and whether it is typeable) and one more key in each
concept's `translations`. No other code changes.

> **The seeded vocabulary needs a native-speaker pass in every language.** It is
> drawn from common everyday words and is intended as demo content. Multi-word
> phrases are where it is most likely to be off: Japanese and Korean encode
> politeness in the verb, Arabic changes form with the gender of who is being
> addressed, and several of the "greetings" have no single register-neutral
> equivalent. Romanizations follow common conventions rather than one strict
> standard per language.

---

## Status

Weeks 1–5 of the plan are implemented and working end to end: monorepo, auth,
data model, the full lesson flow, SM-2 review, and streaks/XP/dashboard — now
generalised from a single English↔Myanmar course to 90 course pairs.

Multiple language pairs were listed as out of scope for v1 in the original plan;
that scope was changed deliberately. Weeks 6–8 (content expansion, audio,
deployment, portfolio packaging) remain.

## Audio

Every word, in every language, can be played aloud. Audio comes from two places
and the app picks per word:

1. **A voice installed on the device**, via the browser's `speechSynthesis` —
   instant, offline, free. But those voices belong to the operating system: a
   stock Windows install has two English voices and nothing else, which leaves
   nine of our ten languages silent.
2. **The server**, via `GET /api/tts?text=…&lang=…`, for everything the device
   cannot say. This is what makes Thai, Burmese, Japanese and the rest audible
   on an ordinary machine.

`Play words automatically` speaks each word as it appears in a lesson, review or
script drill. Speech defaults to 0.85× because conversational pace is too fast to
learn from. Both are per-browser preferences.

### About the default TTS provider

`TTS_PROVIDER=google-translate` needs no API key and covers all ten languages,
which is why it is the default — but it is an **undocumented endpoint, not a
supported API**. It can rate-limit or change without notice, and Google's terms
do not cover this use. That is fine for development and a portfolio demo, and
not something to run a real product on.

The provider is one `switch` in `server/src/services/tts.service.js`. Swapping in
Google Cloud TTS, Azure or ElevenLabs is a single case, and `TTS_PROVIDER=none`
turns server audio off entirely, falling back to whatever the device offers.

The endpoint is deliberately behind auth — an unauthenticated text-to-speech
proxy is an open proxy — with a 200-character cap, a per-minute rate limit, an
in-process LRU cache (a word is replayed far more often than it is new), and a
check that the provider actually returned MP3 rather than a captcha page.

Letters and words also carry an unused `audioUrl` field, so real recordings can
replace synthesis later without a schema change.

### Known gaps

- **The interface itself is English-only.** A learner studying Thai from
  Japanese reads Japanese words but an English UI. Interface translation is a
  separate piece of work from course content.
- Unit and lesson titles are English for the same reason.
- **The default audio provider is an unofficial endpoint** (see above). It works
  today and needs no key, but a real deployment should point `TTS_PROVIDER` at a
  paid TTS service.
- Letter names and romanizations follow common conventions rather than one
  strict standard per language, and need a native-speaker pass like the
  vocabulary does. The Japanese chart covers hiragana only — not katakana or
  kanji.
