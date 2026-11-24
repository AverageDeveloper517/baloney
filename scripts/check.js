import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Boot check without a token: import every module so a missing file, a typo in
 * an import path or a syntax error fails here instead of at game time.
 *
 * src/index.js is skipped because importing it would start the bot. Command
 * modules are imported too, so the registry and the command list stay honest.
 */
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

const files = (await walk('src')).filter((file) => !file.endsWith(`${join('src', 'index.js')}`));

for (const file of files) {
  await import(pathToFileURL(file).href);
}

console.log(`ok · ${files.length} modules import cleanly`);
