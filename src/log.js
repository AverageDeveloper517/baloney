const stamp = () => new Date().toISOString().slice(11, 19);

const paint = (code, text) => `\u001b[${code}m${text}\u001b[0m`;

export const log = {
  info: (msg) => console.log(`${paint('90', stamp())} ${paint('36', 'info')} ${msg}`),
  ok: (msg) => console.log(`${paint('90', stamp())} ${paint('32', 'ok  ')} ${msg}`),
  warn: (msg) => console.warn(`${paint('90', stamp())} ${paint('33', 'warn')} ${msg}`),
  error: (msg) => console.error(`${paint('90', stamp())} ${paint('31', 'err ')} ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG) console.log(`${paint('90', stamp())} ${paint('35', 'dbg ')} ${msg}`);
  }
};
