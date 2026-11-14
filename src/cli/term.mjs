/**
 * Console text for terminals that are not UTF-8. On Windows, Node writes Unicode right to a
 * console window, but when its output goes through a pipe (a script, a remote shell, Windows
 * PowerShell 5.1 capturing it) the reader decodes it with the console code page: "→" becomes
 * "â†’". There the ewcms command writes ASCII instead (its own lines and Vite's).
 *
 *   EWCMS_ASCII=1   always ASCII     EWCMS_ASCII=0   never
 */
const ASCII = {
  '→': '->',
  '←': '<-',
  '➜': '>',
  '·': '-',
  '•': '*',
  '…': '...',
  '✓': 'ok',
  '✔': 'ok',
  '✗': 'x',
  '✖': 'x',
  '│': '|',
  '─': '-',
  '—': '-',
  '–': '-',
  '⚠': '!',
};
const NON_ASCII = /[^\p{ASCII}]/gu;

/** Text with ASCII stand-ins for the symbols above (other non-ASCII characters: "?"). */
export const toAscii = (text) => String(text).replace(NON_ASCII, (c) => ASCII[c] ?? '?');

/** Whether to write ASCII: EWCMS_ASCII, else Windows with output that is not a console. */
export function wantsAscii(
  env = process.env,
  platform = process.platform,
  stream = process.stdout,
) {
  if (env.EWCMS_ASCII === '1') return true;
  if (env.EWCMS_ASCII === '0') return false;
  return platform === 'win32' && !stream.isTTY;
}

/** From now on, stdout and stderr write ASCII (string chunks; bytes pass as they are). */
export function asciiOutput() {
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream);
    stream.write = (chunk, ...rest) =>
      write(typeof chunk === 'string' ? toAscii(chunk) : chunk, ...rest);
  }
}
