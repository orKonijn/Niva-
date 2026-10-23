import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoStore } from './demo-store';
describe('Demo application boundaries', () => {
  const stores: DemoStore[] = [];
  const makeStore = () => {
    const store = new DemoStore();
    stores.push(store);
    return store;
  };
  beforeEach(() => {
    localStorage.clear();
    let queue = Promise.resolve();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_name: string, task: () => unknown) => {
          const result = queue.then(task);
          queue = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        },
      },
    });
  });
  afterEach(() => {
    stores.forEach((s) => s.ngOnDestroy());
    stores.length = 0;
    vi.restoreAllMocks();
  });
  it('records a demo approval once and refuses unknown jobs', async () => {
    const store = makeStore();
    expect(await store.approve('product-designer')).toBe(true);
    expect(await store.approve('product-designer')).toBe(false);
    expect(await store.approve('unknown')).toBe(false);
    expect(store.applications()).toHaveLength(1);
  });
  it('blocks approval while paused and restores the pause after reload', async () => {
    const store = makeStore();
    await store.togglePause();
    expect(await store.approve('product-designer')).toBe(false);
    expect(makeStore().paused()).toBe(true);
    await store.togglePause();
    expect(await store.approve('product-designer')).toBe(true);
  });
  it('applies company exclusions before approval, case insensitively', async () => {
    const store = makeStore();
    await store.savePreferences({
      role: 'all',
      district: 'all',
      workStyles: [],
      exclusions: ' FORMA , orbit ',
    });
    expect(store.eligibleJobs().some((j) => j.id === 'product-designer')).toBe(false);
    expect(await store.approve('frontend-engineer')).toBe(false);
  });
  it('combines role, location and work-model filters', async () => {
    const store = makeStore();
    await store.savePreferences({
      role: 'design',
      district: 'tel-aviv',
      workStyles: ['hybrid'],
      exclusions: '',
    });
    expect(store.eligibleJobs().map((j) => j.id)).toEqual(['product-designer']);
  });
  it('restores preferences and approvals but never persists candidate names or CV names', async () => {
    const store = makeStore();
    store.name.set('Private name');
    store.resumeName.set('private-cv.pdf');
    await store.toggleSaved('ux-designer');
    await store.approve('product-designer');
    const raw = localStorage.getItem('niva.demo.v1');
    expect(raw).not.toContain('Private name');
    expect(raw).not.toContain('private-cv.pdf');
    const restored = makeStore();
    expect(restored.saved()).toEqual(['ux-designer']);
    expect(restored.approved('product-designer')).toBe(true);
    expect(restored.name()).toBe('');
  });
  it('ignores malformed storage and unsupported preference values', async () => {
    localStorage.setItem('niva.demo.v1', 'invalid');
    expect(() => makeStore()).not.toThrow();
    localStorage.setItem(
      'niva.demo.v1',
      JSON.stringify({
        preferences: { role: 'invalid' },
        applications: [null, { jobId: 'unknown', approvedAt: 'wrong' }],
        saved: ['unknown', 1],
      }),
    );
    const store = makeStore();
    expect(store.applications()).toEqual([]);
    expect(store.saved()).toEqual([]);
    expect(store.preferences().role).toBe('all');
  });
  it('keeps working if persistence is unavailable', async () => {
    const store = makeStore();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(await store.approve('product-designer')).toBe(false);
    expect(store.applications()).toEqual([]);
    expect(store.notice()).toBeTruthy();
    spy.mockRestore();
  });
  it('reset clears all demo data and persisted choices', async () => {
    const store = makeStore();
    await store.approve('product-designer');
    await store.toggleSaved('ux-designer');
    await store.togglePause();
    await store.reset();
    const restored = makeStore();
    expect(restored.applications()).toEqual([]);
    expect(restored.saved()).toEqual([]);
    expect(restored.paused()).toBe(false);
  });
});

describe('serialized storage regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    let queue = Promise.resolve();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_: string, task: () => unknown) => {
          const result = queue.then(task);
          queue = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        },
      },
    });
  });
  afterEach(() => vi.restoreAllMocks());
  it('a queued reset clears earlier pending mutations in memory as well as storage', async () => {
    const store = new DemoStore();
    const pending = store.toggleSaved('ux-designer');
    const reset = store.reset();
    await pending;
    expect(await reset).toBe('cleared');
    expect(store.saved()).toEqual([]);
    expect(localStorage.getItem('niva.demo.v1')).toBeNull();
    store.ngOnDestroy();
  });
  it('a stale pause action cannot accidentally resume a completed pause', async () => {
    const a = new DemoStore(),
      b = new DemoStore();
    await a.togglePause();
    await b.togglePause();
    expect(b.paused()).toBe(true);
    expect(await b.approve('ux-designer')).toBe(false);
    a.ngOnDestroy();
    b.ngOnDestroy();
  });
  it('does not write when the state cannot be read or lock access is denied', async () => {
    const store = new DemoStore();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(await store.approve('ux-designer')).toBe(false);
    expect(write).not.toHaveBeenCalled();
    read.mockRestore();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: () => Promise.reject(new Error('denied')) },
    });
    expect(await store.approve('ux-designer')).toBe(false);
    expect(write).not.toHaveBeenCalled();
    store.ngOnDestroy();
  });
  it('validates synchronized values without string coercion and deduplicates saved IDs', () => {
    localStorage.setItem(
      'niva.demo.v1',
      JSON.stringify({
        preferences: { role: ['design'], model: ['היברידי'] },
        saved: ['ux-designer', 'ux-designer', 'unknown'],
      }),
    );
    const store = new DemoStore();
    expect(store.preferences().role).toBe('all');
    expect(store.preferences().workStyles).toEqual([]);
    expect(store.saved()).toEqual(['ux-designer']);
    store.ngOnDestroy();
  });
  it('merges independent saves and rejects approval after a completed pause', async () => {
    const a = new DemoStore(),
      b = new DemoStore();
    await Promise.all([a.toggleSaved('ux-designer'), b.toggleSaved('frontend-engineer')]);
    expect(b.saved()).toEqual(['ux-designer', 'frontend-engineer']);
    await a.togglePause();
    expect(await b.approve('product-designer')).toBe(false);
    a.ngOnDestroy();
    b.ngOnDestroy();
  });
  it('serializes duplicate approvals and same-job toggles deterministically', async () => {
    const a = new DemoStore(),
      b = new DemoStore();
    expect(await Promise.all([a.approve('ux-designer'), b.approve('ux-designer')])).toEqual([
      true,
      false,
    ]);
    await Promise.all([a.toggleSaved('ux-designer'), b.toggleSaved('ux-designer')]);
    expect(b.saved()).toEqual([]);
    a.ngOnDestroy();
    b.ngOnDestroy();
  });
  it('rejects stale queued edits and drafts after reset, preserving cookies', async () => {
    const a = new DemoStore(),
      b = new DemoStore();
    localStorage.setItem('cookie-choice', 'necessary');
    const generation = b.resetGeneration;
    const draft = { ...b.preferences(), exclusions: 'Orbit' };
    const reset = a.reset(),
      stale = b.toggleSaved('ux-designer');
    expect(await reset).toBe('cleared');
    expect(await stale).toBe(false);
    expect(await b.savePreferences(draft, generation)).toBe(false);
    expect(localStorage.getItem('niva.demo.v1')).toBeNull();
    expect(localStorage.getItem('cookie-choice')).toBe('necessary');
    a.ngOnDestroy();
    b.ngOnDestroy();
  });
  it('reports actual deletion failure and clears only session memory', async () => {
    const a = new DemoStore();
    await a.toggleSaved('ux-designer');
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(await a.reset()).toBe('session-only');
    expect(a.saved()).toEqual([]);
    expect(localStorage.getItem('niva.demo.v1')).toContain('ux-designer');
    spy.mockRestore();
    const b = new DemoStore();
    expect(b.saved()).toEqual(['ux-designer']);
    a.ngOnDestroy();
    b.ngOnDestroy();
  });
  it('fails closed without coordination or readable storage', async () => {
    const a = new DemoStore();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    expect(await a.approve('ux-designer')).toBe(false);
    expect(await a.toggleSaved('ux-designer')).toBe(false);
    expect(await a.reset()).toBe('session-only');
    a.ngOnDestroy();
  });
});
