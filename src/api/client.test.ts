import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WK_API } from '../config';
import { fetchCollection, getUser, WkError } from './client';

const fetchMock = vi.fn<typeof fetch>();
// The queue is module state, so each test starts on a fresh minute after the last one.
let clock = Date.now();

beforeEach(() => {
  vi.useFakeTimers({ now: clock });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  clock = Date.now() + 120_000;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), init);
}

function page(ids: number[], next: string | null, dataUpdatedAt = '2026-10-01T00:00:00Z') {
  return {
    object: 'collection',
    url: '',
    pages: { per_page: 2, next_url: next, previous_url: null },
    total_count: 3,
    data_updated_at: dataUpdatedAt,
    data: ids.map((id) => ({ id, object: 'assignment', url: '', data_updated_at: null, data: {} })),
  };
}

function headersOf(call: number) {
  return new Headers(fetchMock.mock.calls[call]![1]!.headers);
}

test('sends auth and revision headers, never the token in the URL', async () => {
  fetchMock.mockResolvedValueOnce(json({ object: 'user', data: { username: 'a' } }));
  await getUser('secret-token');
  const [url] = fetchMock.mock.calls[0]!;
  expect(url).toBe(`${WK_API}/user`);
  expect(String(url)).not.toContain('secret-token');
  expect(headersOf(0).get('Authorization')).toBe('Bearer secret-token');
  expect(headersOf(0).get('Wanikani-Revision')).toBe('20170710');
});

test('follows next_url, passes updated_after and reports each page', async () => {
  const next = `${WK_API}/assignments?page_after_id=2`;
  fetchMock
    .mockResolvedValueOnce(json(page([1, 2], next), { headers: { ETag: 'W/"abc"' } }))
    .mockResolvedValueOnce(json(page([3], null)));
  const seen: number[][] = [];
  const res = await fetchCollection('t', 'assignments', {
    updatedAfter: '2026-09-01T00:00:00.000Z',
    onPage: (items, loaded, total) => {
      seen.push([...items.map((i) => i.id), loaded, total]);
    },
  });
  expect(fetchMock.mock.calls[0]![0]).toBe(
    `${WK_API}/assignments?updated_after=2026-09-01T00%3A00%3A00.000Z`,
  );
  expect(fetchMock.mock.calls[1]![0]).toBe(next);
  expect(seen).toEqual([
    [1, 2, 2, 3],
    [3, 3, 3],
  ]);
  expect(res).toEqual({
    notModified: false,
    dataUpdatedAt: '2026-10-01T00:00:00Z',
    etag: 'W/"abc"',
    lastModified: undefined,
  });
});

test('sends conditional headers and reports 304 as not modified', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
  const onPage = vi.fn();
  const res = await fetchCollection('t', 'subjects', {
    etag: 'W/"abc"',
    lastModified: 'Wed, 01 Oct 2026 00:00:00 GMT',
    onPage,
  });
  expect(res).toEqual({ notModified: true });
  expect(onPage).not.toHaveBeenCalled();
  expect(headersOf(0).get('If-None-Match')).toBe('W/"abc"');
  expect(headersOf(0).get('If-Modified-Since')).toBe('Wed, 01 Oct 2026 00:00:00 GMT');
});

test('on 429 waits for RateLimit-Reset, then retries', async () => {
  const reset = Math.floor(Date.now() / 1000) + 5;
  fetchMock
    .mockResolvedValueOnce(json({}, { status: 429, headers: { 'RateLimit-Reset': String(reset) } }))
    .mockResolvedValueOnce(json({ object: 'user', data: { username: 'a' } }));
  const p = getUser('t');
  await vi.advanceTimersByTimeAsync(4000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2000);
  await expect(p).resolves.toMatchObject({ data: { username: 'a' } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('on 429 falls back to Retry-After', async () => {
  fetchMock
    .mockResolvedValueOnce(json({}, { status: 429, headers: { 'Retry-After': '3' } }))
    .mockResolvedValueOnce(json({ object: 'user', data: {} }));
  const p = getUser('t');
  await vi.advanceTimersByTimeAsync(2900);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(200);
  await p;
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('maps 401, other statuses and network failures to typed errors', async () => {
  fetchMock.mockResolvedValueOnce(json({ error: 'Unauthorized', code: 401 }, { status: 401 }));
  await expect(getUser('bad')).rejects.toMatchObject({ kind: 'unauthorized' });

  fetchMock.mockResolvedValueOnce(json({}, { status: 503 }));
  await expect(getUser('t')).rejects.toMatchObject({ kind: 'http', status: 503 });

  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const err = await getUser('t').catch((e: unknown) => e);
  expect(err).toBeInstanceOf(WkError);
  expect(err).toMatchObject({ kind: 'network' });
});

test('starts at most 60 requests in any minute', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(json({ object: 'user', data: {} })));
  const all = Array.from({ length: 61 }, () => getUser('t'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetchMock).toHaveBeenCalledTimes(60);
  await vi.advanceTimersByTimeAsync(60_000);
  await Promise.all(all);
  expect(fetchMock).toHaveBeenCalledTimes(61);
});
