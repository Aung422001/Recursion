# Recursion — Monorepo Scaffold (npm workspaces)

## Folder structure

```
recursion/
├── package.json                 # root — defines workspaces
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── README.md
├── docker-compose.yml           # local MongoDB for dev
├── client/                      # React + Vite + Tailwind
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/                 # fetch wrappers per resource (auth.js, lessons.js, progress.js)
│       ├── context/              # AuthContext.jsx
│       ├── hooks/                 # useAuth.js, useLessons.js
│       ├── components/            # shared UI: Button, Card, ProgressBar, ExerciseCard...
│       ├── pages/                  # Login.jsx, Signup.jsx, Dashboard.jsx, Lesson.jsx, Review.jsx
│       └── routes/                 # ProtectedRoute.jsx, router.jsx
├── server/                      # Node + Express
│   ├── package.json
│   ├── src/
│   │   ├── index.js               # entrypoint — starts server
│   │   ├── app.js                 # express app + middleware wiring
│   │   ├── config/
│   │   │   ├── env.js              # validated env vars
│   │   │   └── db.js               # mongoose connection
│   │   ├── models/                 # User.js, Unit.js, Lesson.js, VocabItem.js, UserProgress.js
│   │   ├── routes/                  # auth.routes.js, lessons.routes.js, progress.routes.js
│   │   ├── controllers/              # auth.controller.js, lessons.controller.js, progress.controller.js
│   │   ├── middleware/                # requireAuth.js, errorHandler.js, rateLimiter.js
│   │   ├── services/                   # sm2.service.js, streak.service.js
│   │   ├── utils/                       # jwt.js, password.js
│   │   └── seed/                         # seed.js + sample content JSON
│   └── tests/                     # auth.test.js, sm2.test.js, progress.test.js
└── shared/                       # code/types shared by client & server
    └── constants.js              # exercise types, SM2 grade enum, etc.
```

## Root `package.json`

```json
{
  "name": "recursion",
  "private": true,
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev": "concurrently -k -n CLIENT,SERVER -c blue,green \"npm run dev -w client\" \"npm run dev -w server\"",
    "dev:client": "npm run dev -w client",
    "dev:server": "npm run dev -w server",
    "seed": "npm run seed -w server",
    "test": "npm run test -w server && npm run test -w client",
    "lint": "eslint .",
    "build:client": "npm run build -w client"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0"
  }
}
```

`npm install` at the repo root installs and links all three workspaces in one step — no separate installs needed inside `client/` or `server/`.

## `server/package.json`

```json
{
  "name": "server",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "seed": "node src/seed/seed.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.19.0",
    "mongoose": "^8.5.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.4.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "supertest": "^7.0.0"
  }
}
```

## `client/package.json`

```json
{
  "name": "client",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

## `docker-compose.yml` (local dev database)

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
volumes:
  mongo_data:
```

Run `docker compose up -d` once, then `server/.env` points `MONGO_URI` at `mongodb://localhost:27017/recursion`.

## `server/src/config/env.js` — validated environment variables

```js
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = schema.parse(process.env);
```

Fail fast on boot if a required env var is missing or too short — better than a cryptic runtime error later.

## `.gitignore` (root)

```
node_modules/
.env
.env.*
!.env.example
dist/
coverage/
.DS_Store
```

## Getting started (once scaffolded)

```bash
git clone <repo> recursion && cd recursion
npm install
docker compose up -d
cp server/.env.example server/.env   # fill in secrets
npm run seed
npm run dev                          # starts client (5173) + server (4000)
```

---

**Open question for you:** do you want the seed script and sample content committed to the repo (simplest, but "content" lives in code), or as JSON/CSV files under `server/src/seed/data/` that the script reads (cleaner separation, easier to hand off to a non-technical content editor later)? The schema doc assumes the latter — say if you'd rather inline it.
