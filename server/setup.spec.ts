import { afterEach, expect, it } from 'vitest';
import { repairHarness } from './repair-harness';
import { stateRepository } from './state';
import { defaultPreferences } from '../src/app/core/preferences';
const active: ReturnType<typeof repairHarness>[] = [];
afterEach(() => {
  for (const harness of active.splice(0)) harness.sqlite.close();
});
for (const adapter of ['node', 'd1'] as const) {
  it(`${adapter} requires a confirmed active CV before completing setup, persists choices and resets setup on erasure`, async () => {
    const h = repairHarness(adapter);
    active.push(h);
    const repository = stateRepository(h.sqlite, 'synthetic');
    const complete = async (revision: number) => {
      const input = {
        revision,
        operation: {
          type: 'complete-setup',
          value: { ...defaultPreferences(), role: 'qa-automation' },
        },
      };
      if (adapter === 'd1') return h.req('account/state', input);
      try {
        return Response.json(repository.mutate(h.owner, input));
      } catch (error) {
        return Response.json({}, { status: (error as { status: number }).status });
      }
    };
    expect((await complete(0)).status).toBe(409);
    const resume = await (
      await h.req('career/resumes', {
        name: 'Synthetic',
        text: 'Synthetic candidate: Python and SQL experience 2020–2026.',
      })
    ).json();
    expect((await complete(0)).status).toBe(409);
    expect(
      (await h.req(`career/resumes/${resume.id}/review`, { text: resume.text, confirmed: true }))
        .status,
    ).toBe(200);
    expect((await complete(0)).status).toBe(409);
    expect((await h.req(`career/resumes/${resume.id}/activate`, { confirmed: true })).status).toBe(
      200,
    );
    const response = await complete(0);
    expect(response.status).toBe(200);
    const state = await response.json();
    expect(state.setupCompleted).toBe(true);
    expect(state.preferences.role).toBe('qa-automation');
    h.sqlite.prepare("UPDATE niva_documents SET expires_at=0 WHERE kind='resume'").run();
    expect((await complete(state.revision)).status).toBe(409);
    if (adapter === 'd1') {
      const erased = await (
        await h.req('account/state', {
          revision: state.revision,
          operation: { type: 'delete-data' },
        })
      ).json();
      expect(erased.setupCompleted).toBe(false);
    } else
      expect(
        repository.mutate(h.owner, { revision: state.revision, operation: { type: 'delete-data' } })
          .setupCompleted,
      ).toBe(false);
  });
}
