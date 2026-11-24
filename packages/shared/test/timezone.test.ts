import { describe, expect, it } from 'vitest';
import { createEntitySchema, timeZoneSchema } from '../src/auth/schemas';
import { canonicalTimeZone } from '../src/time/timezone';

describe('canonicalTimeZone', () => {
  it('accepts supported IANA zones and canonicalises case', () => {
    expect(canonicalTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(canonicalTimeZone('america/new_york')).toBe('America/New_York');
    expect(canonicalTimeZone(' Asia/Tokyo ')).toBe('Asia/Tokyo');
  });

  it('maps UTC aliases to one spelling', () => {
    expect(canonicalTimeZone('UTC')).toBe('UTC');
    expect(canonicalTimeZone('utc')).toBe('UTC');
    expect(canonicalTimeZone('Etc/UTC')).toBe('UTC');
  });

  it.each([
    'Mars/Olympus',
    '',
    'Europe/../../etc/passwd',
    'x'.repeat(80),
    'Europe/Berlin; DROP TABLE',
    '+05:00',
  ])('rejects %j', (value) => {
    expect(canonicalTimeZone(value)).toBeNull();
  });

  it('two spellings of one zone produce one cache key', () => {
    const keys = new Set(
      ['Europe/London', 'europe/london', 'EUROPE/LONDON'].map(canonicalTimeZone),
    );
    expect(keys.size).toBe(1);
  });
});

describe('timezone schemas', () => {
  it('outputs canonical names and defaults entities to UTC', () => {
    expect(timeZoneSchema.parse('europe/paris')).toBe('Europe/Paris');
    expect(timeZoneSchema.safeParse('Nowhere/Land').success).toBe(false);
    const entity = createEntitySchema.parse({
      code: 'AC-1',
      name: 'Acme',
      functionalCurrency: 'USD',
    });
    expect(entity.timezone).toBe('UTC');
    expect(
      createEntitySchema.parse({
        code: 'AC-1',
        name: 'Acme',
        functionalCurrency: 'USD',
        timezone: 'asia/singapore',
      }).timezone,
    ).toBe('Asia/Singapore');
  });
});
