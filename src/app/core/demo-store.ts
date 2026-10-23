import { Job } from './models/job';
import { DemoApplication } from './models/demo-application';
import { JOBS } from './data/sample-jobs';
export type { Job } from './models/job';
export { JOBS } from './data/sample-jobs';
import { Injectable, computed, signal } from '@angular/core';
import {
  Preferences,
  defaultPreferences,
  migratePreferences,
  validPreferences,
  matchesPreferences,
} from './preferences';
export type { Preferences } from './preferences';

const defaults = defaultPreferences();
@Injectable({ providedIn: 'root' })
export class DemoStore {
  readonly jobs = JOBS;
  readonly name = signal('');
  readonly resumeName = signal('');
  readonly preferences = signal<Preferences>({ ...defaults });
  readonly applications = signal<DemoApplication[]>([]);
  readonly saved = signal<string[]>([]);
  readonly paused = signal(false);
  readonly notice = signal('');
  readonly eligibleJobs = computed(() =>
    this.jobs.filter((job) => matchesPreferences(job, this.preferences())),
  );
  get resetGeneration(): string {
    return this.generation;
  }
  private generation = '';
  readonly visibleSavedJobs = computed(() =>
    this.jobs.filter((j) => this.saved().includes(j.id) && !this.excluded(j)),
  );
  readonly suppressedSavedCount = computed(
    () => this.saved().length - this.visibleSavedJobs().length,
  );
  private excluded(job: Job): boolean {
    return this.preferences()
      .exclusions.split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .some((x) => job.company.toLowerCase().includes(x));
  }
  constructor() {
    this.synchronize();
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('focus', this.onFocus);
  }
  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('focus', this.onFocus);
  }
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === 'niva.demo.v1' || event.key === 'niva.demo.generation')
      this.synchronize();
  };
  private readonly onFocus = (): void => {
    this.synchronize();
  };
  private clearMemory(): void {
    this.preferences.set({ ...defaults });
    this.saved.set([]);
    this.applications.set([]);
    this.paused.set(false);
  }
  private synchronize(): boolean {
    try {
      const generation = localStorage.getItem('niva.demo.generation') ?? '';
      if (generation !== this.generation) {
        this.name.set('');
        this.resumeName.set('');
      }
      this.generation = generation;
      const raw = localStorage.getItem('niva.demo.v1');
      this.clearMemory();
      this.restore(raw);
      return true;
    } catch {
      this.notice.set('האחסון המקומי אינו זמין. שינויים ואישורים חסומים.');
      return false;
    }
  }
  private restore(raw: string | null): void {
    try {
      const value: unknown = JSON.parse(raw ?? 'null');
      if (!value || typeof value !== 'object') return;
      const v = value as Record<string, unknown>;
      if (Array.isArray(v['saved']))
        this.saved.set([
          ...new Set(
            v['saved'].filter(
              (x): x is string => typeof x === 'string' && JOBS.some((j) => j.id === x),
            ),
          ),
        ]);
      if (Array.isArray(v['applications']))
        this.applications.set(
          v['applications']
            .filter(
              (x): x is DemoApplication =>
                !!x &&
                typeof x === 'object' &&
                JOBS.some((j) => j.id === x.jobId) &&
                typeof x.approvedAt === 'string' &&
                Number.isFinite(Date.parse(x.approvedAt)),
            )
            .filter((x, i, all) => all.findIndex((a) => a.jobId === x.jobId) === i),
        );
      if (typeof v['paused'] === 'boolean') this.paused.set(v['paused']);
      this.preferences.set(migratePreferences(v['preferences']));
    } catch {
      /* Invalid or unavailable storage does not prevent using the demo. */
    }
  }
  /** All participating tabs serialize read/modify/write under the same origin lock. */
  private async mutate(
    action: () => boolean,
    expectedGeneration = this.generation,
  ): Promise<boolean> {
    const generation = expectedGeneration;
    if (!navigator.locks) {
      this.notice.set('הדפדפן אינו תומך בתיאום בטוח בין לשוניות. שינויים ואישורים חסומים.');
      return false;
    }
    try {
      return await navigator.locks.request('niva.demo.mutation', () => {
        const current = localStorage.getItem('niva.demo.generation') ?? '';
        if (!this.synchronize()) return false;
        if (current !== generation) {
          this.notice.set('הנתונים אופסו בלשונית אחרת. יש לבדוק ולנסות שוב.');
          return false;
        }
        if (!action()) return false;
        localStorage.setItem(
          'niva.demo.v1',
          JSON.stringify({
            version: 2,
            preferences: this.preferences(),
            applications: this.applications(),
            saved: this.saved(),
            paused: this.paused(),
          }),
        );
        this.notice.set('');
        return true;
      });
    } catch {
      this.synchronize();
      this.notice.set('השינוי לא נשמר. האחסון או תיאום הלשוניות אינם זמינים; לא נרשם אישור.');
      return false;
    }
  }
  savePreferences(value: Preferences, expectedGeneration = this.generation): Promise<boolean> {
    if (!validPreferences(value)) return Promise.resolve(false);
    const copy = { ...value, workStyles: [...value.workStyles] };
    return this.mutate(() => {
      if (!validPreferences(copy)) return false;
      this.preferences.set({
        ...copy,
        workStyles: [...new Set(copy.workStyles)],
        exclusions: copy.exclusions.slice(0, 500),
      });
      return true;
    }, expectedGeneration);
  }

  toggleSaved(id: string): Promise<boolean> {
    return this.mutate(() => {
      if (!this.jobs.some((j) => j.id === id)) return false;
      this.saved.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
      return true;
    });
  }
  togglePause(): Promise<boolean> {
    const paused = !this.paused();
    return this.mutate(() => {
      this.paused.set(paused);
      return true;
    });
  }
  approved(id: string): boolean {
    return this.applications().some((a) => a.jobId === id);
  }
  approve(id: string): Promise<boolean> {
    return this.mutate(() => {
      if (this.paused() || this.approved(id) || !this.eligibleJobs().some((j) => j.id === id))
        return false;
      this.applications.update((a) => [{ jobId: id, approvedAt: new Date().toISOString() }, ...a]);
      return true;
    });
  }
  async reset(): Promise<'cleared' | 'session-only'> {
    this.name.set('');
    this.resumeName.set('');
    this.clearMemory();
    try {
      if (!navigator.locks) throw new Error('Coordination unavailable');
      await navigator.locks.request('niva.demo.mutation', () => {
        // Commit a reset barrier first. A failed deletion must never report durable success.
        const generation = crypto.randomUUID();
        localStorage.setItem('niva.demo.generation', generation);
        this.generation = generation;
        localStorage.removeItem('niva.demo.v1');
        this.clearMemory();
        this.name.set('');
        this.resumeName.set('');
      });
      this.notice.set('');
      return 'cleared';
    } catch {
      this.clearMemory();
      this.name.set('');
      this.resumeName.set('');
      this.notice.set('נוקה הביקור הנוכחי בלבד. המחיקה מהאחסון נכשלה; נתונים קודמים עשויים לחזור.');
      return 'session-only';
    }
  }
}
