# Recursion — 8-Week Project Plan

A Duolingo-style English↔Myanmar language learning app, built as a portfolio piece to demonstrate full-stack ability (React, Node/Express, MongoDB) for junior developer applications across Southeast Asia.

**Stack:** React + Vite + Tailwind (client) · Node.js + Express (server) · MongoDB + Mongoose · JWT auth · npm workspaces monorepo

**Assumptions:** part-time work alongside job hunting, no existing lesson content (seed/placeholder data planned in), solo developer using Claude Code as a pairing tool.

---

## Week 1 — Foundation

- Set up the npm workspaces monorepo (`client/`, `server/`, `shared/`) — see `02-monorepo-scaffold.md`
- Initialize Express server: base app, environment config, health-check route, error-handling middleware, logging
- Initialize Vite + React + Tailwind client, routing skeleton (React Router), base layout components
- Set up MongoDB (local via Docker, and an Atlas free-tier cluster for later deployment)
- Connect server to MongoDB via Mongoose, confirm connection on boot
- Set up ESLint + Prettier across workspaces; initialize git repo with a sane `.gitignore`

**Deliverable:** empty app skeleton that runs end-to-end (client talks to server, server talks to DB).

## Week 2 — Data Model & Auth

- Implement Mongoose schemas: `User`, `Unit`, `Lesson`, `VocabItem`, `UserProgress` — see `03-mongodb-schema.md`
- Write and run a seed script with 2–3 sample units of English↔Myanmar content (placeholder vocab/sentences)
- Implement JWT auth end-to-end: register, login, refresh, logout — see `04-auth-scaffolding.md`
- Build client auth pages (Sign up / Log in) and an auth context/hook that stores the access token in memory and silently refreshes it
- Add protected-route wrapper on the client and `requireAuth` middleware on the server

**Deliverable:** a user can register, log in, and hit a protected "me" endpoint.

## Week 3 — Core Lesson Flow

- Build API endpoints: list units/lessons, get a single lesson's exercises, submit an exercise attempt
- Design 2–3 exercise types to start: multiple choice (translate word), fill-in-the-blank, and match-pairs
- Build the client lesson-player UI: question card, answer input per exercise type, immediate right/wrong feedback, progress bar within a lesson
- Track raw attempt results (not yet spaced repetition — just correctness + timestamp)

**Deliverable:** a user can pick a lesson and complete it start to finish.

## Week 4 — Spaced Repetition (SM-2)

- Implement the SM-2 algorithm server-side as a pure, unit-testable function (ease factor, interval, repetitions → next review date)
- Extend `UserProgress` to store per-item SM-2 state (see schema doc)
- Add a "Review" endpoint that returns items due today, ordered by urgency
- Add a "Review" mode on the client, visually distinct from new lessons (e.g. a dedicated tab with a due-count badge)
- Write unit tests for the SM-2 function covering the standard cases (again/hard/good/easy-equivalent grading)

**Deliverable:** completing lessons schedules future reviews, and a due-reviews queue actually works.

## Week 5 — Progress, Streaks & Gamification

- Add daily streak tracking (server computes streak from activity dates; handle timezones sensibly)
- Add XP/points per completed exercise and a simple level curve
- Build a Dashboard/Profile page: streak, total XP, units completed, accuracy over time
- Add a lightweight "unit map" screen (Duolingo-style path) showing locked/unlocked/completed units

**Deliverable:** the app feels like a product, not just a quiz — visible progress and motivation loops.

## Week 6 — Content Expansion & Polish

- Expand seed content to a fuller first course (aim for ~8–10 units, enough to demo a real learning arc)
- Add audio support for pronunciation if time allows (pre-recorded clips or a TTS API — flag as stretch goal)
- Mobile-responsive pass across every screen (this is a mobile-first product category)
- Accessibility pass: keyboard navigation for exercises, sufficient color contrast, aria labels
- Error states and loading states everywhere (empty lesson list, network failure, expired session)

**Deliverable:** the app looks and feels finished, not like a prototype.

## Week 7 — Testing & Hardening

- Backend: unit tests for auth, SM-2, and progress endpoints (Jest or Vitest + Supertest)
- Frontend: component tests for the lesson player and auth flows (Vitest + React Testing Library)
- Security pass: rate limiting on auth routes, input validation (e.g. Zod/Joi), helmet, CORS config, password policy
- Fix bugs found during a full manual run-through as a new user

**Deliverable:** a codebase you'd be comfortable showing in a technical interview.

## Week 8 — Deployment & Portfolio Packaging

- Deploy server (Render/Railway) and client (Vercel/Netlify); MongoDB Atlas for production DB
- Set up environment variables and secrets properly for production
- Write the project README: problem statement, architecture diagram, tech decisions, screenshots/GIF of the app in use
- Add the project to your portfolio site (see `/areas/portfolio-website.md`) with a link to the live demo and repo
- Record a short walkthrough (screen capture) for use in applications/interviews

**Deliverable:** a live, linkable, demo-able product plus a README that reads well to a hiring manager.

---

## Stretch goals (only if weeks 1–8 finish early)

- Google OAuth login
- Audio pronunciation via TTS
- Leaderboards / friends
- Admin panel for content editing (instead of hand-written seed data)
- React Native mobile wrapper

## Out of scope for v1

- Multiple language pairs beyond English↔Myanmar
- Payments/subscriptions
- Native mobile apps
- Offline mode
