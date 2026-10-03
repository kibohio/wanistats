import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import Dexie from 'dexie';
import { expect, test } from 'vitest';
import type { User } from '../api/types';
import { openPacksDb } from '../db/schema';
import { liveDb, useAppMode } from '../db/useAppMode';
import { logout, saveLogin } from './session';

function Mode() {
  return <p>{useAppMode()}</p>;
}

const user = (id: string) => ({ id, username: 'kibo', level: 3 }) as User;

test('login and logout flip the app mode without a reload; packs survive logout', async () => {
  const packs = openPacksDb();
  await packs.packs.put({ id: 'kanji', version: '1', data: {}, bytes: 1, installedAt: 'x' });
  const qc = new QueryClient();
  qc.setQueryData(['x'], 1);
  render(<Mode />);
  expect(await screen.findByText('sample')).toBeInTheDocument();

  await saveLogin('tok', user('a'));
  expect(await screen.findByText('live')).toBeInTheDocument();
  await liveDb.snapshots.put({ date: '2026-10-01' } as never);

  await logout(qc);
  expect(await screen.findByText('sample')).toBeInTheDocument();
  expect(await liveDb.snapshots.count()).toBe(0);
  expect(qc.getQueryData(['x'])).toBeUndefined();
  expect(await packs.packs.count()).toBe(1);

  await saveLogin('tok', user('a'));
  expect(await screen.findByText('live')).toBeInTheDocument();
  await logout(qc);
  packs.close();
  await Dexie.delete('wanistats-packs');
});

test('logging in as someone else wipes the previous account first', async () => {
  await saveLogin('tok', user('a'));
  await liveDb.subjects.put({ id: 1 } as never);
  await saveLogin('tok', user('a'));
  expect(await liveDb.subjects.count()).toBe(1);
  await saveLogin('tok2', user('b'));
  expect(await liveDb.subjects.count()).toBe(0);
  expect(await liveDb.auth.get('token')).toBe('tok2');
  await liveDb.delete({ disableAutoOpen: false });
});
