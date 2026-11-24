import pino, { type Logger } from 'pino';

/** Structured JSON logger. Credentials, cookies and CSRF tokens are always redacted. */
export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
      ],
      censor: '[redacted]',
    },
  });
}
