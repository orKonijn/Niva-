import '@angular/compiler';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, it, expect, vi } from 'vitest';
import { CareerStore } from './career-store';
import { AccountSession } from './account-session';
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
});
it('immediately clears private state and refuses delayed responses from the previous generation', async () => {
  const userId = signal<string | null>('alice');
  TestBed.configureTestingModule({
    providers: [{ provide: AccountSession, useValue: { userId } }],
  });
  let release!: (r: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((r) => (release = r))),
  );
  const store = TestBed.inject(CareerStore);
  const pending = store.request('resumes');
  store.resumes.set([{ id: 'private' } as never]);
  store.clear(false);
  expect(store.resumes()).toEqual([]);
  release(Response.json([{ id: 'stale-private' }], { headers: { 'X-Niva-Lifecycle': 'old' } }));
  await expect(pending).rejects.toThrow('החשבון השתנה');
  expect(store.resumes()).toEqual([]);
});

it('refreshes authoritative selection and expiry without firing privacy erasure', async () => {
  const userId = signal<string | null>('alice');
  TestBed.configureTestingModule({
    providers: [{ provide: AccountSession, useValue: { userId } }],
  });
  let selected = 'a';
  let expired = false;
  const versions = () =>
    ['a', 'b'].map((id) => ({
      id,
      name: id,
      text: id + ' Python SQL',
      confirmed: true,
      active: id === selected,
      kind: 'original',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (expired ? -1000 : 86400000)).toISOString(),
    }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        epoch: 'e',
        erasure: 'account0',
        revision: selected,
        resumes: versions(),
        config: {
          ai: false,
          uploads: false,
          processor: '',
          retentionDays: 30,
          maxUploadBytes: 750000,
        },
        operations: null,
      }),
    ),
  );
  const store = TestBed.inject(CareerStore);
  await store.load();
  const generation = store.generation();
  expect(store.active()?.id).toBe('a');
  selected = 'b';
  await store.refresh();
  expect(store.active()?.id).toBe('b');
  expect(store.generation()).toBe(generation);
  expired = true;
  await store.refresh();
  expect(store.active()).toBeUndefined();
});
it('scoped deletion prunes only its item and rejects delayed pre-delete responses', async () => {
  const userId = signal<string | null>('alice');
  TestBed.configureTestingModule({
    providers: [{ provide: AccountSession, useValue: { userId } }],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { ok: true },
        { headers: { 'X-Niva-Lifecycle': 'scoped', 'X-Niva-Erasure': 'account0' } },
      ),
    ),
  );
  const store = TestBed.inject(CareerStore);
  store.resumes.set([{ id: 'a' }, { id: 'b' }] as never);
  const generation = store.generation();
  await store.request('resumes/b/delete', {});
  expect(store.resumes().map((r) => r.id)).toEqual(['a']);
  expect(store.generation()).toBe(generation);
  expect(store.changes()?.kind).toBe('resume');
});
