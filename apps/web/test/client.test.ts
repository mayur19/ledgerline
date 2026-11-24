import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, errorMessage, readCsrfCookie } from '../src/api/client';

afterEach(() => vi.restoreAllMocks());

describe('api client', () => {
  it('reads the csrf cookie', () => {
    expect(readCsrfCookie('a=1; ll_csrf=abc%2D1; b=2')).toBe('abc-1');
    expect(readCsrfCookie('a=1')).toBeNull();
  });

  it('sends the csrf header on unsafe requests and unwraps data', async () => {
    document.cookie = 'll_csrf=token123';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: { ok: 1 }, error: null })));
    expect(await api.post('/x', { a: 1 })).toEqual({ ok: 1 });
    const headers = fetchMock.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('token123');
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/x');
  });

  it('raises ApiError with engine messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          error: {
            code: 'JOURNAL_INVALID',
            message: 'invalid',
            details: { errors: [{ message: 'Line 1: bad' }] },
          },
        }),
        { status: 422 },
      ),
    );
    const error = await api.get('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(errorMessage(error)).toBe('Line 1: bad');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('x')).toBe('Something went wrong');
  });

  it('handles non-JSON responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 502 });
  });
});
