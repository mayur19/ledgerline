/**
 * IANA time-zone validation. Input is canonicalised (case and aliases resolved
 * by Intl) and then checked against the runtime's supported list, so anything
 * stored or used as a cache key is one exact spelling per zone: "america/new_york"
 * and "America/New_York" can never become two entries.
 */
let supported: ReadonlySet<string> | null = null;

function supportedZones(): ReadonlySet<string> {
  if (supported === null) {
    supported = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
  }
  return supported;
}

const SHAPE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

/** Canonical IANA name for `input`, or null when it is not a supported zone. */
export function canonicalTimeZone(input: string): string | null {
  const trimmed = input.trim();
  if (!SHAPE.test(trimmed)) return null;
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  if (resolved === 'Etc/UTC' || resolved === 'Etc/GMT') resolved = 'UTC';
  return supportedZones().has(resolved) ? resolved : null;
}
