import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  ACCOUNT_DB,
  login,
  loginToToday,
  mockApi,
  openAccountMenu,
  readTable,
  TOKEN,
} from './fixtures';

const SAMPLE = 'Sample data. None of this is yours yet.';
const todayKey = () => new Date().toLocaleDateString('sv');

test.beforeEach(async ({ context }) => {
  await mockApi(context);
});

test('logged out, every tab shows sample data and the footer', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const tabs: [string, RegExp][] = [
    ['/', /^(Today|Level \d+.*)$/],
    ['/timeline', /^Timeline$/],
    ['/pace', /^Pace$/],
    ['/coverage', /^Coverage$/],
    ['/items', /^Items$/],
    ['/settings', /^Settings$/],
    ['/about', /^About$/],
    ['/privacy', /^Privacy$/],
    ['/terms', /^Terms$/],
  ];
  for (const [path, heading] of tabs) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(SAMPLE)).toBeVisible();
    await expect(
      page.getByRole('contentinfo').getByText('Built and maintained by Kiboh Inc.'),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('login runs the first sync, onboards, lands on Today and writes a snapshot', async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(SAMPLE)).toBeHidden();

  const today = await page.evaluate(todayKey);
  const snapshots = await readTable<{ date: string }>(page, 'snapshots');
  expect(snapshots.map((s) => s.date)).toEqual([today]);
});

test('a rejected token shows the 401 message', async ({ page }) => {
  await login(page, 'not-the-fixture-token');
  await expect(page.getByRole('alert')).toHaveText(
    'WaniKani rejected that token. Check that you copied all of it.',
  );
  expect(await readTable(page, 'auth', 'wanistats-session')).toEqual([]);
});

test('Refresh data updates the sync time and merges a 3-day gap into one delta set', async ({
  page,
}) => {
  await loginToToday(page);
  // Pretend the last snapshot was 3 days ago, with every counter at zero then.
  const { today, gapStart } = await page.evaluate(
    (name) =>
      new Promise<{ today: string; gapStart: string }>((resolve, reject) => {
        const key = (d: Date) => d.toLocaleDateString('sv');
        const today = key(new Date());
        const gapStart = key(new Date(Date.now() - 3 * 86_400_000));
        const open = indexedDB.open(name);
        open.onsuccess = () => {
          const tx = open.result.transaction(['snapshots', 'meta'], 'readwrite');
          const snapshots = tx.objectStore('snapshots');
          const get = snapshots.get(today);
          get.onsuccess = () => {
            snapshots.delete(today);
            snapshots.put({ ...get.result, date: gapStart });
            tx.objectStore('meta').put({ key: 'snapshotBaseline', value: {} });
          };
          tx.oncomplete = () => {
            open.result.close();
            resolve({ today, gapStart });
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ACCOUNT_DB,
  );

  const menu = await openAccountMenu(page);
  await menu.getByRole('button', { name: 'Refresh data' }).click();
  await expect(menu.getByText('Synced just now')).toBeVisible();
  await expect(menu.getByText(/^Last synced /)).toBeVisible();

  const snapshots = await readTable<{ date: string }>(page, 'snapshots');
  expect(snapshots.map((s) => s.date)).toEqual([gapStart, today]);
  const deltas = await readTable<{ date: string }>(page, 'snapshotDeltas');
  // One row per fixture subject with reviews, all on today's date.
  expect(deltas).toHaveLength(4);
  expect(new Set(deltas.map((d) => d.date))).toEqual(new Set([today]));
});

test('logout removes only the token; Delete local data removes the rest', async ({ page }) => {
  await loginToToday(page);
  const menu = await openAccountMenu(page);
  await menu.getByRole('button', { name: 'Log out' }).click();
  await page
    .getByRole('dialog', { name: 'Log out' })
    .getByRole('button', { name: 'Log out' })
    .click();
  await expect(page.getByText(SAMPLE)).toBeVisible();
  const auth = await readTable(page, 'auth', 'wanistats-session');
  expect(auth).not.toContain(TOKEN);
  expect(auth).toEqual([]);
  expect((await readTable(page, 'subjects')).length).toBeGreaterThan(0);
  expect(await readTable(page, 'snapshots')).toHaveLength(1);

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete local data' }).click();
  await page
    .getByRole('dialog', { name: 'Delete local data' })
    .getByRole('button', { name: 'Delete local data' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(SAMPLE)).toBeVisible();
  expect(await readTable(page, 'subjects')).toEqual([]);
  expect(await readTable(page, 'accounts', 'wanistats-session')).toEqual([]);
});

test.describe('with the service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('offline reload still shows synced data', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await loginToToday(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(/^Offline\. Showing data from /)).toBeVisible();
    await expect(page.getByText(SAMPLE)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Account and settings' })).toHaveText('T');
  });
});

test('the old Kanji address opens Coverage', async ({ page }) => {
  await page.goto('/kanji');
  await expect(page).toHaveURL(/\/coverage$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Coverage' })).toBeVisible();
});

test('packs download nothing until Download is pressed', async ({ page }) => {
  const manifest = JSON.parse(readFileSync('public/data/packs/manifest.json', 'utf8')) as {
    packs: { id: string; label: string; bytes: number }[];
  };
  const kanji = manifest.packs.find((p) => p.id === 'kanji')!;
  const packRequests: string[] = [];
  page.on('request', (r) => /\/data\/packs\/.*\.gz$/.test(r.url()) && packRequests.push(r.url()));

  await page.goto('/coverage');
  await page.goto('/settings');
  await page.getByRole('button', { name: `Download ${kanji.label}` }).click();
  const sheet = page.getByRole('dialog', { name: 'Download coverage data' });
  // formatBytes for a size in the KB range.
  const download = sheet.getByRole('button', {
    name: `Download ${Math.round(kanji.bytes / 1000)} KB`,
  });
  await expect(download).toBeVisible();
  expect(packRequests).toEqual([]);

  const request = page.waitForRequest(/\/data\/packs\/kanji\..*\.gz$/);
  await download.click();
  await request;
});

test('waking hours and lesson time move in half hours', async ({ page }) => {
  await page.goto('/settings');
  const clock = page.getByRole('group', { name: 'Clock' });
  await clock.getByRole('button', { name: '24-hour' }).click();
  const wake = page.getByRole('slider', { name: 'Wake up' });
  await wake.focus();
  await page.keyboard.press('ArrowRight');
  await expect(wake).toHaveAttribute('aria-valuetext', '07:30');
  await expect(page.getByText('07:30 to 23:00')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(wake).toHaveAttribute('aria-valuetext', '06:30');

  const sleep = page.getByRole('slider', { name: 'Go to sleep' });
  await sleep.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(sleep).toHaveAttribute('aria-valuetext', '22:30');

  await page.getByRole('button', { name: 'Increase lesson time' }).click();
  await expect(page.getByRole('status', { name: 'Lesson time' })).toHaveText('09:30');

  await clock.getByRole('button', { name: '12-hour' }).click();
  await expect(page.getByRole('status', { name: 'Lesson time' })).toHaveText(/^9:30\sAM$/i);
  await expect(wake).toHaveAttribute('aria-valuetext', /^6:30\sAM$/i);
});

test('settings links land on their section once it has loaded', async ({ page }) => {
  await loginToToday(page);
  await page.goto('/settings#history');
  const top = () => page.locator('#history').evaluate((el) => el.getBoundingClientRect().top);
  await expect.poll(top).toBeGreaterThanOrEqual(0);
  await expect.poll(top).toBeLessThan(40);
});
