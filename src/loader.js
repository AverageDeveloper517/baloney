import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Load every command module once and fail loudly on duplicates. A broken
 * command file should stop the boot, not disappear silently.
 */
export async function loadCommands(dir) {
  const files = (await readdir(dir)).filter((file) => file.endsWith('.js')).sort();
  const commands = new Map();

  for (const file of files) {
    const module = await import(pathToFileURL(join(dir, file)).href);
    const command = module.default;

    if (!command?.data?.name) throw new Error(`${file} does not export a command with data.name`);
    if (typeof command.run !== 'function') throw new Error(`${file} has no run() function`);
    if (commands.has(command.data.name)) throw new Error(`duplicate command name: ${command.data.name}`);

    commands.set(command.data.name, command);
  }

  return commands;
}
