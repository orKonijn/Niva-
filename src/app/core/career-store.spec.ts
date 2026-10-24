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
