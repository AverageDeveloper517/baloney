import { loadEnv } from './env.js';

loadEnv();

const { start } = await import('./app.js');

try {
  await start();
} catch (err) {
  const { log } = await import('./log.js');
  log.error(err.message);
  process.exitCode = 1;
}
