import { describe, expect, it } from 'vitest';
import { hasPermission, permissionsFor, PERMISSIONS, ROLES } from '../src/auth/roles';
import {
  createEntitySchema,
  createFxRateSchema,
  loginSchema,
  registerSchema,
  updateEntitySettingsSchema,
} from '../src/auth/schemas';

describe('role permissions', () => {
  it('gives owners everything', () => {
    expect(permissionsFor('owner')).toEqual(PERMISSIONS);
  });

  it('enforces segregation of duties', () => {
    expect(hasPermission('accountant', 'journal.post')).toBe(true);
    expect(hasPermission('accountant', 'journal.post_soft_closed')).toBe(false);
    expect(hasPermission('controller', 'journal.post_soft_closed')).toBe(true);
    expect(hasPermission('approver', 'journal.create')).toBe(false);
    expect(hasPermission('auditor', 'journal.create')).toBe(false);
    expect(hasPermission('admin', 'journal.post')).toBe(false);
  });

  it('lets every role read reports', () => {
    for (const role of ROLES) expect(hasPermission(role, 'report.view')).toBe(true);
  });
});

describe('boundary schemas', () => {
  it('normalizes emails and enforces password length', () => {
    expect(loginSchema.parse({ email: ' Ana@Example.COM ', password: 'x' }).email).toBe(
      'ana@example.com',
    );
    expect(
      registerSchema.safeParse({
        organizationName: 'Acme',
        displayName: 'A',
        email: 'a@b.co',
        password: 'short',
      }).success,
    ).toBe(false);
  });

  it('validates entities and fx rates', () => {
    expect(
      createEntitySchema.safeParse({ code: 'US-01', name: 'Acme US', functionalCurrency: 'USD' })
        .success,
    ).toBe(true);
    expect(
      createEntitySchema.safeParse({ code: 'us', name: 'Acme', functionalCurrency: 'USD' }).success,
    ).toBe(false);
    expect(
      createFxRateSchema.safeParse({
        fromCurrency: 'EUR',
        toCurrency: 'EUR',
        rateDate: '2026-01-01',
        rate: '1',
      }).success,
    ).toBe(false);
    expect(
      createFxRateSchema.parse({
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        rateDate: '2026-01-01',
        rate: '1.08',
      }).rateType,
    ).toBe('spot');
    expect(updateEntitySettingsSchema.safeParse({}).success).toBe(false);
  });
});
