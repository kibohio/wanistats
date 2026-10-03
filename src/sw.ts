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

self.addEventListener('periodicsync', ((event: PeriodicSyncEvent) => {
  // ponytail: no-op until the sync engine exists; it will sync and write the day's snapshot.
  if (event.tag === 'snapshot') event.waitUntil(Promise.resolve());
}) as EventListener);
