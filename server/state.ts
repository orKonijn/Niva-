import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { emptyAccountState, type AccountState } from '../src/app/core/models/account-state';
import { JOBS } from '../src/app/core/data/sample-jobs';
import {
  matchesPreferences,
  migratePreferences,
  validPreferences,
} from '../src/app/core/preferences';
export class StateError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new StateError(400, 'INVALID_INPUT');
  return v as Record<string, unknown>;
};
const string = (v: unknown, max = 100): string => {
  if (typeof v !== 'string' || v.length > max) throw new StateError(400, 'INVALID_INPUT');
  return v.trim();
};
const job = (id: unknown) => {
  const found = JOBS.find((j) => j.id === id);
  if (!found) throw new StateError(400, 'UNKNOWN_JOB');
  return found;
};
export function normalizeImport(input: unknown) {
  const raw = object(input);
  const saved = Array.isArray(raw['saved'])
    ? [
        ...new Set(
          raw['saved'].filter(
            (id): id is string => typeof id === 'string' && JOBS.some((j) => j.id === id),
          ),
        ),
      ].slice(0, JOBS.length)
    : [];
  const applications: AccountState['applications'] = [];
  if (Array.isArray(raw['applications']))
    for (const value of raw['applications'].slice(0, 100)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      if (
        typeof row['jobId'] !== 'string' ||
        !JOBS.some((j) => j.id === row['jobId']) ||
        typeof row['approvedAt'] !== 'string' ||
        !Number.isFinite(Date.parse(row['approvedAt'])) ||
        applications.some((a) => a.jobId === row['jobId'])
      )
        continue;
      applications.push({
        jobId: row['jobId'],
        approvedAt: new Date(row['approvedAt']).toISOString(),
        kind: 'local-demo',
      });
    }
  return {
    preferences: migratePreferences(raw['preferences']),
    saved,
    applications,
    paused: raw['paused'] === true,
  };
}
export function stateRepository(db: DatabaseSync, secret: string) {
  function read(userId: string): AccountState {
    const row = db
      .prepare('SELECT revision, data, imported_at FROM niva_account_state WHERE user_id = ?')
      .get(userId);
    if (!row) return emptyAccountState();
    return {
      ...JSON.parse(String(row['data'])),
      revision: Number(row['revision']),
      importedAt: row['imported_at'] ? String(row['imported_at']) : null,
    } as AccountState;
  }
  function receipt(userId: string, data: unknown, revision: number) {
    return createHmac('sha256', secret)
      .update(JSON.stringify({ userId, data, revision }))
      .digest('hex');
  }
  function preview(userId: string, input: unknown) {
    const state = read(userId);
    if (state.importedAt) throw new StateError(409, 'ALREADY_IMPORTED');
    const data = normalizeImport(input);
    return {
      data,
      revision: state.revision,
      receipt: receipt(userId, data, state.revision),
      counts: { saved: data.saved.length, demoApprovals: data.applications.length },
    };
  }
  function mutate(userId: string, input: unknown): AccountState {
    const body = object(input);
    const revision = body['revision'];
    const op = object(body['operation']);
    if (
      !Number.isSafeInteger(revision) ||
      Number(revision) < 0 ||
      'userId' in body ||
      'userId' in op
    )
      throw new StateError(400, 'INVALID_INPUT');
    db.exec('BEGIN IMMEDIATE');
    try {
      const state = read(userId);
      if (state.revision !== revision) throw new StateError(409, 'CONFLICT');
      switch (op['type']) {
        case 'preferences': {
          const value = object(op['value']);
          if (
            !validPreferences(value as unknown as AccountState['preferences']) ||
            String(value['exclusions']).length > 500
          )
            throw new StateError(400, 'INVALID_PREFERENCES');
          state.preferences = migratePreferences(value);
          break;
        }
        case 'saved': {
          const id = job(op['jobId']).id;
          if (typeof op['value'] !== 'boolean') throw new StateError(400, 'INVALID_INPUT');
          state.saved = op['value']
            ? [...new Set([...state.saved, id])]
            : state.saved.filter((x) => x !== id);
          break;
        }
        case 'pause':
          if (typeof op['value'] !== 'boolean') throw new StateError(400, 'INVALID_INPUT');
          state.paused = op['value'];
          break;
        case 'approve': {
          const value = job(op['jobId']);
          if (state.paused || !matchesPreferences(value, state.preferences))
            throw new StateError(409, 'APPROVAL_BLOCKED');
          if (!state.applications.some((a) => a.jobId === value.id))
            state.applications.push({
              jobId: value.id,
              approvedAt: new Date().toISOString(),
              kind: 'local-demo',
            });
          break;
        }
        case 'profile': {
          const value = object(op['value']);
          state.profile = {
            name: string(value['name'], 50),
            headline: string(value['headline'], 140),
          };
          break;
        }
        case 'theme':
          if (!['system', 'light', 'dark'].includes(String(op['value'])))
            throw new StateError(400, 'INVALID_THEME');
          state.theme = op['value'] as AccountState['theme'];
          break;
        case 'import': {
          if (state.importedAt) throw new StateError(409, 'ALREADY_IMPORTED');
          const data = normalizeImport(op['data']);
          const supplied = string(op['receipt'], 64);
          const expected = receipt(userId, data, state.revision);
          if (
            supplied.length !== expected.length ||
            !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
          )
            throw new StateError(400, 'INVALID_PREVIEW');
          state.preferences = data.preferences;
          state.saved = [...new Set([...state.saved, ...data.saved])];
          state.applications.push(
            ...data.applications.filter(
              (a) => !state.applications.some((x) => x.jobId === a.jobId),
            ),
          );
          state.paused ||= data.paused;
          state.importedAt = new Date().toISOString();
          break;
        }
        case 'delete-data': {
          const cleared = emptyAccountState();
          Object.assign(state, cleared, {
            revision: Number(revision),
            importedAt: state.importedAt,
          });
          break;
        }
        default:
          throw new StateError(400, 'UNKNOWN_OPERATION');
      }
      state.revision++;
      db.prepare(
        'INSERT INTO niva_account_state (user_id, revision, data, imported_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision, data=excluded.data, imported_at=excluded.imported_at, updated_at=excluded.updated_at',
      ).run(
        userId,
        state.revision,
        JSON.stringify(state),
        state.importedAt,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
      return state;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return { read, preview, mutate };
}
