// Minimal .env reader. No dependency, no surprises: values are only used when
// the real environment does not already define them.
import { existsSync, readFileSync } from 'node:fs';

export function loadEnv(path = '.env') {
  if (!existsSync(path)) return false;

  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rest] = match;
    let value = rest.trim();

    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash >= 0) value = value.slice(0, hash).trim();
    }

    if (!(key in process.env)) process.env[key] = value;
  }

  return true;
}
