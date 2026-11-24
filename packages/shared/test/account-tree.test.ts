import { describe, expect, it } from 'vitest';
import {
  accountDepths,
  ancestorChains,
  validateParentAssignment,
} from '../src/ledger/account-tree';
import {
  createAccountSchema,
  isBalanceSheetType,
  NORMAL_SIDE,
  updateAccountSchema,
} from '../src/ledger/account';
import { account } from './fixtures';

const assets = account('1000', 'asset', { isPostable: false });
const current = account('1100', 'asset', { isPostable: false, parentId: assets.id });
const cash = account('1110', 'asset', { parentId: current.id });
const liabilities = account('2000', 'liability', { isPostable: false });
const map = new Map([assets, current, cash, liabilities].map((a) => [a.id, a] as const));

describe('validateParentAssignment', () => {
  it('accepts a valid header parent of the same type', () => {
    expect(validateParentAssignment(map, { id: 'new', type: 'asset' }, current.id)).toBeNull();
    expect(validateParentAssignment(map, { id: 'new', type: 'asset' }, null)).toBeNull();
  });

  it.each([
    ['SELF_PARENT', { id: assets.id, type: 'asset' as const }, assets.id],
    ['PARENT_NOT_FOUND', { id: 'new', type: 'asset' as const }, 'missing'],
    ['PARENT_NOT_HEADER', { id: 'new', type: 'asset' as const }, cash.id],
    ['PARENT_TYPE_MISMATCH', { id: 'new', type: 'asset' as const }, liabilities.id],
    ['CYCLE', { id: assets.id, type: 'asset' as const }, current.id],
  ])('rejects %s', (code, child, parentId) => {
    expect(validateParentAssignment(map, child, parentId)?.code).toBe(code);
  });

  it('detects pre-existing corrupt cycles without looping forever', () => {
    const a = account('3000', 'equity', { isPostable: false });
    const b = account('3100', 'equity', { isPostable: false, parentId: a.id });
    const corrupt = new Map([
      [a.id, { ...a, parentId: b.id }],
      [b.id, b],
    ]);
    expect(validateParentAssignment(corrupt, { id: 'new', type: 'equity' }, b.id)?.code).toBe(
      'CYCLE',
    );
  });
});

describe('ancestorChains', () => {
  it('lists ancestors nearest first and computes depths', () => {
    const chains = ancestorChains([assets, current, cash]);
    expect(chains.get(cash.id)).toEqual([current.id, assets.id]);
    expect(accountDepths([assets, current, cash]).get(cash.id)).toBe(2);
  });

  it('stops at parents outside the list', () => {
    expect(ancestorChains([cash]).get(cash.id)).toEqual([]);
  });

  it('throws on cycles', () => {
    const a = { id: 'a', parentId: 'b' };
    const b = { id: 'b', parentId: 'a' };
    expect(() => ancestorChains([a, b])).toThrow(/cycle/);
  });
});

describe('account schema helpers', () => {
  it('derives normal sides and statement classes', () => {
    expect(NORMAL_SIDE.asset).toBe('debit');
    expect(NORMAL_SIDE.revenue).toBe('credit');
    expect(isBalanceSheetType('equity')).toBe(true);
    expect(isBalanceSheetType('expense')).toBe(false);
  });

  it('validates account codes and applies defaults', () => {
    const parsed = createAccountSchema.parse({ code: '4000-10', name: ' Sales ', type: 'revenue' });
    expect(parsed).toMatchObject({
      name: 'Sales',
      parentId: null,
      isPostable: true,
      currency: null,
    });
    expect(createAccountSchema.safeParse({ code: '12', name: 'x', type: 'asset' }).success).toBe(
      false,
    );
    expect(
      createAccountSchema.safeParse({ code: '1000', name: 'x', type: 'asset', currency: 'XYZ' })
        .success,
    ).toBe(false);
    expect(updateAccountSchema.safeParse({}).success).toBe(false);
    expect(updateAccountSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('standard chart template', () => {
  it('lists parents before children with matching types and header parents', async () => {
    const { STANDARD_CHART, STANDARD_ROUNDING_CODE, STANDARD_RETAINED_EARNINGS_CODE } =
      await import('../src/ledger/chart-template');
    const seen = new Map<string, (typeof STANDARD_CHART)[number]>();
    for (const entry of STANDARD_CHART) {
      if (entry.parentCode !== null) {
        const parent = seen.get(entry.parentCode);
        expect(parent?.isPostable).toBe(false);
        expect(parent?.type).toBe(entry.type);
      }
      seen.set(entry.code, entry);
    }
    expect(seen.get(STANDARD_ROUNDING_CODE)?.isPostable).toBe(true);
    expect(seen.get(STANDARD_RETAINED_EARNINGS_CODE)?.type).toBe('equity');
  });
});
