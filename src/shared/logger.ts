/**
 * Minimal, privacy-safe logger.
 *
 * Rule: never log persona values, page data or URLs with query
 * parameters. Only counters, message types and static labels.
 */
function debug(...parts: unknown[]): void {
  if (parts.length > 0) console.debug('[ProfilePack]', ...parts);
}

function warn(...parts: unknown[]): void {
  if (parts.length > 0) console.warn('[ProfilePack]', ...parts);
}

function error(...parts: unknown[]): void {
  if (parts.length > 0) console.error('[ProfilePack]', ...parts);
}

export const logger = { debug, warn, error };
