import Dexie from 'dexie';
import { afterEach, expect, test } from 'vitest';
import { getPref, setPref } from './prefs';
import { openDb } from './schema';

afterEach(() => Dexie.delete('wanistats-prefs-test'));

test('reads old whole-hour times as minutes until the new key is set', async () => {
  const db = openDb('wanistats-prefs-test');
  expect(await getPref(db, 'wakeMin')).toBe(420);
  await db.prefs.put({ key: 'wakeHour', value: 6 });
  expect(await getPref(db, 'wakeMin')).toBe(360);
  await setPref(db, 'wakeMin', 390);
  expect(await getPref(db, 'wakeMin')).toBe(390);
});
