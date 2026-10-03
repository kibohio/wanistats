/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { accountDbName, openDb, openSessionDb } from './db/schema';
import { backgroundSync } from './sync/sync';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

// Precache list is set by vite.config.ts: app shell and the pack manifest only.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/data\//] }),
);

// Hashed font files; only the subsets a page actually used end up here.
registerRoute(
  ({ request, url }) => request.destination === 'font' && url.origin === self.location.origin,
  new CacheFirst({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 300 })] }),
);

// Nothing is registered for api.wanikani.com, so those requests always go to the network.

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Registered by the page only when installed and logged in. Reads the token and the active
// account from IndexedDB; a failure (offline, 401) just waits for the next run or app start.
self.addEventListener('periodicsync', ((event: PeriodicSyncEvent) => {
  if (event.tag !== 'snapshot') return;
  const session = openSessionDb();
  const run = async () => {
    const id = (await session.meta.get('activeUserId'))?.value as string | undefined;
    if (!id) return;
    const db = openDb(accountDbName(id));
    await backgroundSync(session, db).finally(() => db.close());
  };
  event.waitUntil(
    run()
      .catch(() => {})
      .finally(() => session.close()),
  );
}) as EventListener);
