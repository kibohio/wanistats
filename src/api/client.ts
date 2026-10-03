import { WK_API, WK_REVISION } from '../config';
import type { Collection, UserReport } from './types';

export type WkErrorKind = 'unauthorized' | 'network' | 'http';

/** Carries no request details, so the token can never end up in a log or error report. */
export class WkError extends Error {
  readonly kind: WkErrorKind;
  readonly status?: number;

  constructor(kind: WkErrorKind, status?: number) {
    super(
      kind === 'http' ? `WaniKani responded with ${status}` : `WaniKani request failed: ${kind}`,
    );
    this.name = 'WkError';
    this.kind = kind;
    this.status = status;
  }
}

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

// One queue for every request in the app: WaniKani allows 60 a minute per token.
let started: number[] = [];
let pausedUntil = 0;
let tail: Promise<void> = Promise.resolve();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function takeSlot(): Promise<void> {
  tail = tail.then(async () => {
    for (;;) {
      const now = Date.now();
      started = started.filter((t) => t > now - WINDOW_MS);
      const full = started.length >= MAX_PER_WINDOW ? started[0]! + WINDOW_MS - now : 0;
      const wait = Math.max(pausedUntil - now, full);
      if (wait <= 0) break;
      await sleep(wait);
    }
    started.push(Date.now());
  });
  return tail;
}

/** RateLimit-Reset is epoch seconds. Clamped so clock skew can neither spin nor stall. */
function retryAt(res: Response): number {
  const now = Date.now();
  const reset = Number(res.headers.get('RateLimit-Reset')) * 1000;
  const after = Number(res.headers.get('Retry-After')) * 1000;
  const at = reset || (after ? now + after : now + WINDOW_MS);
  return Math.min(Math.max(at, now + 1000), now + WINDOW_MS);
}

interface Conditional {
  etag?: string;
  lastModified?: string;
}

type Got<T> =
  { notModified: true } | { notModified: false; body: T; etag?: string; lastModified?: string };

async function get<T>(token: string, url: string, cond: Conditional = {}): Promise<Got<T>> {
  // The token goes in a header only; refuse to send it anywhere but the API.
  if (!url.startsWith(`${WK_API}/`)) throw new WkError('http');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Wanikani-Revision': WK_REVISION,
  };
  if (cond.etag) headers['If-None-Match'] = cond.etag;
  if (cond.lastModified) headers['If-Modified-Since'] = cond.lastModified;

  for (;;) {
    await takeSlot();
    let res: Response;
    try {
      // no-store: we do our own conditional requests and keep responses out of every cache.
      res = await fetch(url, { headers, cache: 'no-store' });
    } catch {
      throw new WkError('network');
    }
    if (res.status === 429) {
      pausedUntil = Math.max(pausedUntil, retryAt(res));
      continue;
    }
    if (res.status === 304) return { notModified: true };
    if (res.status === 401) throw new WkError('unauthorized', 401);
    if (!res.ok) throw new WkError('http', res.status);
    let body: T;
    try {
      body = (await res.json()) as T;
    } catch {
      throw new WkError('network');
    }
    return {
      notModified: false,
      body,
      etag: res.headers.get('ETag') ?? undefined,
      lastModified: res.headers.get('Last-Modified') ?? undefined,
    };
  }
}

export async function getUser(token: string): Promise<UserReport> {
  const res = await get<UserReport>(token, `${WK_API}/user`);
  if (res.notModified) throw new WkError('http', 304);
  return res.body;
}

/** Conditional /user fetch for sync; null when unchanged. */
export async function getUserIfChanged(
  token: string,
  cond: Conditional,
): Promise<{ report: UserReport; etag?: string; lastModified?: string } | null> {
  const res = await get<UserReport>(token, `${WK_API}/user`, cond);
  return res.notModified
    ? null
    : { report: res.body, etag: res.etag, lastModified: res.lastModified };
}

export interface CollectionOptions<R> extends Conditional {
  updatedAfter?: string | null;
  onPage: (items: R[], loaded: number, total: number) => void | Promise<void>;
}

export type CollectionResult =
  | { notModified: true }
  | { notModified: false; dataUpdatedAt: string | null; etag?: string; lastModified?: string };

/** Fetches every page of a collection, handing each to onPage before requesting the next. */
export async function fetchCollection<R>(
  token: string,
  path: string,
  { updatedAfter, etag, lastModified, onPage }: CollectionOptions<R>,
): Promise<CollectionResult> {
  const query = updatedAfter ? `?${new URLSearchParams({ updated_after: updatedAfter })}` : '';
  const first = await get<Collection<R>>(token, `${WK_API}/${path}${query}`, {
    etag,
    lastModified,
  });
  if (first.notModified) return { notModified: true };

  let body = first.body;
  let loaded = 0;
  for (;;) {
    loaded += body.data.length;
    await onPage(body.data, loaded, body.total_count);
    if (!body.pages.next_url) break;
    const next = await get<Collection<R>>(token, body.pages.next_url);
    if (next.notModified) break;
    body = next.body;
  }
  return {
    notModified: false,
    dataUpdatedAt: first.body.data_updated_at,
    etag: first.etag,
    lastModified: first.lastModified,
  };
}
