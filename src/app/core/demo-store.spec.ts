import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoStore } from './demo-store';
describe('Demo application boundaries', () => {
  beforeEach(() => localStorage.clear());
  it('records a demo approval once and refuses unknown jobs', () => {
    const store = new DemoStore();
    expect(store.approve('product-designer')).toBe(true);
    expect(store.approve('product-designer')).toBe(false);
    expect(store.approve('unknown')).toBe(false);
    expect(store.applications()).toHaveLength(1);
  });
  it('blocks approval while paused and restores the pause after reload', () => {
    const store = new DemoStore();
    store.togglePause();
    expect(store.approve('product-designer')).toBe(false);
    expect(new DemoStore().paused()).toBe(true);
    store.togglePause();
    expect(store.approve('product-designer')).toBe(true);
  });
  it('applies company exclusions before approval, case insensitively', () => {
    const store = new DemoStore();
    store.savePreferences({
      role: 'all',
      location: 'all',
      model: 'all',
      exclusions: ' FORMA , orbit ',
    });
    expect(store.eligibleJobs().some((j) => j.id === 'product-designer')).toBe(false);
    expect(store.approve('frontend-engineer')).toBe(false);
  });
  it('combines role, location and work-model filters', () => {
    const store = new DemoStore();
    store.savePreferences({
      role: 'design',
      location: 'תל אביב',
      model: 'היברידי',
      exclusions: '',
    });
    expect(store.eligibleJobs().map((j) => j.id)).toEqual(['product-designer']);
  });
  it('restores preferences and approvals but never persists candidate names or CV names', () => {
    const store = new DemoStore();
    store.name.set('Private name');
    store.resumeName.set('private-cv.pdf');
    store.toggleSaved('ux-designer');
    store.approve('product-designer');
    const raw = localStorage.getItem('niva.demo.v1');
    expect(raw).not.toContain('Private name');
    expect(raw).not.toContain('private-cv.pdf');
    const restored = new DemoStore();
    expect(restored.saved()).toEqual(['ux-designer']);
    expect(restored.approved('product-designer')).toBe(true);
    expect(restored.name()).toBe('');
  });
  it('ignores malformed storage and unsupported preference values', () => {
    localStorage.setItem('niva.demo.v1', 'invalid');
    expect(() => new DemoStore()).not.toThrow();
    localStorage.setItem(
      'niva.demo.v1',
      JSON.stringify({
        preferences: { role: 'invalid' },
        applications: [null, { jobId: 'unknown', approvedAt: 'wrong' }],
        saved: ['unknown', 1],
      }),
    );
    const store = new DemoStore();
    expect(store.applications()).toEqual([]);
    expect(store.saved()).toEqual([]);
    expect(store.preferences().role).toBe('all');
  });
  it('keeps working if persistence is unavailable', () => {
    const store = new DemoStore();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(store.approve('product-designer')).toBe(true);
    expect(store.notice()).toBeTruthy();
    spy.mockRestore();
  });
  it('reset clears all demo data and persisted choices', () => {
    const store = new DemoStore();
    store.approve('product-designer');
    store.toggleSaved('ux-designer');
    store.togglePause();
    store.reset();
    const restored = new DemoStore();
    expect(restored.applications()).toEqual([]);
    expect(restored.saved()).toEqual([]);
    expect(restored.paused()).toBe(false);
  });
});
