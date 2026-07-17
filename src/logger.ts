/**
 * Minimal leveled logger. Keeps a single, greppable log format and lets
 * LOG_LEVEL gate verbosity without pulling in a logging framework.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const threshold: number = LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? LEVELS.info;

function emit(level: LogLevel, message: string, ...args: unknown[]): void {
  if (LEVELS[level] < threshold) return;
  const line = `[${level.toUpperCase()}] ${message}`;
  if (level === 'error') console.error(line, ...args);
  else if (level === 'warn') console.warn(line, ...args);
  else console.log(line, ...args);
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => emit('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => emit('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => emit('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => emit('error', message, ...args)
};
