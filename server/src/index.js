import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  try {
    await connectDb();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error('Is MongoDB running? Try `docker compose up -d` or start your local mongod.');
    process.exit(1);
  }

  const server = createApp().listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => () => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

start();
