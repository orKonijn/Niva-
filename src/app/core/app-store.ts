import {
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { DemoStore } from './demo-store';
import { AccountSession } from './account-session';
import { Theme } from './theme';
import { emptyAccountState, type AccountState } from './models/account-state';
import { matchesPreferences, type Preferences } from './preferences';
import type { Job } from './models/job';
export type { Preferences } from './preferences';
export type { Job } from './models/job';
export interface ImportPreview {
  data: Pick<AccountState, 'preferences' | 'saved' | 'applications' | 'paused'>;
  revision: number;
  receipt: string;
  counts: { saved: number; demoApprovals: number };
}
@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly demo = inject(DemoStore);
  readonly session = inject(AccountSession);
  private readonly theme = inject(Theme);
  readonly account = signal<AccountState>(emptyAccountState());
  readonly accountLoading = signal(false);
  readonly accountReady = signal(false);
  readonly busy = signal(false);
  readonly accountNotice = signal('');
  readonly isAccount = computed(() => !!this.session.user());
  private readonly selectedCatalog = signal<'real' | 'demo' | null>(null);
  readonly catalogMode = computed(
    () => this.selectedCatalog() ?? (this.session.config().realJobs ? 'real' : 'demo'),
  );
  readonly realJobs = signal<Job[]>([]);
  readonly archivedJobs = signal<Job[]>([]);
  readonly jobsLoading = signal(false);
  readonly jobsError = signal('');
  readonly feedCheckedAt = signal('');
  readonly feedStale = signal(false);
  get jobs(): readonly Job[] {
    return this.catalogMode() === 'real'
      ? [...this.realJobs(), ...this.archivedJobs()]
      : this.demo.jobs;
  }
  findJob(id: string) {
    return [...this.jobs, ...this.demo.jobs].find((j) => j.id === id);
  }
  useCatalog(mode: 'real' | 'demo'): void {
    this.selectedCatalog.set(mode);
    if (mode === 'real') void this.loadJobs();
  }
  async loadJobs(): Promise<void> {
    if (this.jobsLoading()) return;
    const owner = this.session.userId();
    this.jobsLoading.set(true);
    this.jobsError.set('');
    try {
      const response = await fetch('/api/jobs', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error();
      const feed = (await response.json()) as {
        jobs: Job[];
        archived?: Job[];
        fetchedAt: string;
        stale: boolean;
      };
      if (
        !Array.isArray(feed.jobs) ||
        !feed.jobs.every(
          (j) =>
            j.source?.kind === 'real' &&
            /^greenhouse-appsflyer-\d+$/.test(j.id) &&
            new URL(j.source.applicationUrl).hostname === 'careers.appsflyer.com' &&
            j.source.applicationUrl.startsWith('https://'),
        )
      )
        throw new Error();
      this.realJobs.set(feed.jobs);
      if (owner === this.session.userId()) this.archivedJobs.set(feed.archived ?? []);
      this.feedCheckedAt.set(feed.fetchedAt);
      this.feedStale.set(feed.stale);
    } catch {
      this.jobsError.set(
        'לא ניתן לרענן משרות מהמקור. אפשר לנסות שוב; משרות שכבר נטענו נשארות מוצגות.',
      );
    } finally {
      this.jobsLoading.set(false);
    }
  }
  readonly preferences = computed(() =>
    this.isAccount() ? this.account().preferences : this.demo.preferences(),
  );
  readonly applications = computed(() =>
    this.isAccount() ? this.account().applications : this.demo.applications(),
  );
  readonly saved = computed(() => (this.isAccount() ? this.account().saved : this.demo.saved()));
  readonly paused = computed(() => (this.isAccount() ? this.account().paused : this.demo.paused()));
  readonly name = linkedSignal(() =>
    this.isAccount() ? this.account().profile.name : this.demo.name(),
  );
  readonly resumeName = this.demo.resumeName;
  readonly notice = computed(
    () => this.accountNotice() || (this.isAccount() ? '' : this.demo.notice()),
  );
  readonly eligibleJobs = computed(() =>
    this.jobs.filter(
      (job) => job.source?.active !== false && matchesPreferences(job, this.preferences()),
    ),
  );
  readonly visibleSavedJobs = computed(() =>
    this.jobs.filter((job) => this.saved().includes(job.id) && !this.excluded(job)),
  );
  readonly suppressedSavedCount = computed(
    () =>
      this.jobs.filter((j) => this.saved().includes(j.id)).length - this.visibleSavedJobs().length,
  );
  private accountGeneration = crypto.randomUUID();
  get resetGeneration(): string {
    return this.isAccount()
      ? `account:${this.session.userId()}:${this.accountGeneration}`
      : this.demo.resetGeneration;
  }
  private queue: Promise<unknown> = Promise.resolve();
  private readonly refreshTimer: ReturnType<typeof setInterval>;
  constructor() {
    effect(() => {
      this.session.userId();
      if (!this.session.loading() && this.session.config().realJobs)
        untracked(() => void this.loadJobs());
    });
    effect(() => {
      if (this.session.loading()) return;
      const userId = this.session.userId();
      untracked(() => {
        this.accountGeneration = crypto.randomUUID();
        this.account.set(emptyAccountState());
        this.archivedJobs.set([]);
        this.accountReady.set(false);
        this.accountNotice.set('');
        this.resumeName.set('');
        if (userId) {
          this.theme.accountSelection = (value) => {
            void this.change({ type: 'theme', value });
          };
          void this.reload(userId);
        } else {
          this.theme.accountSelection = null;
          this.theme.restoreGuest();
        }
      });
    });
    this.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.refresh();
    }, 30000);
    window.addEventListener('focus', this.onFocus);
  }
  private readonly onFocus = (): void => {
    void this.refresh();
  };
  async refresh(): Promise<void> {
    await this.session.refresh();
    const id = this.session.user()?.id;
    if (id && !this.busy()) await this.reload(id);
  }
  private excluded(job: Job): boolean {
    return !matchesPreferences(job, {
      role: 'all',
      district: 'all',
      workStyles: [],
      exclusions: this.preferences().exclusions,
    });
  }
  approved(id: string): boolean {
    return this.applications().some((a) => a.jobId === id);
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api/account/${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Niva-CSRF': '1' },
            body: JSON.stringify(body),
          }),
    });
    if (response.status === 401) {
      this.session.clear();
      throw new Error('SESSION_EXPIRED');
    }
    if (!response.ok) throw new Error(response.status === 409 ? 'CONFLICT' : 'SAVE_FAILED');
    return (await response.json()) as T;
  }
  private async reload(userId: string): Promise<void> {
    this.accountLoading.set(true);
    try {
      const state = await this.request<AccountState>('state');
      if (this.session.user()?.id !== userId || state.revision < this.account().revision) return;
      this.account.set(state);
      this.accountReady.set(true);
      this.theme.applyAccount(state.theme);
    } catch {
      if (this.session.user()?.id === userId)
        this.accountNotice.set('לא ניתן לטעון את נתוני החשבון. שינויים חסומים עד חיבור מחדש.');
    } finally {
      this.accountLoading.set(false);
    }
  }
  private change(
    operation: Record<string, unknown>,
    expected = this.resetGeneration,
    revision?: number,
  ): Promise<boolean> {
    const userId = this.session.user()?.id;
    const run = async (): Promise<boolean> => {
      if (
        !userId ||
        this.session.user()?.id !== userId ||
        expected !== this.resetGeneration ||
        !this.accountReady()
      )
        return false;
      this.busy.set(true);
      try {
        const state = await this.request<AccountState>('state', {
          revision: revision ?? this.account().revision,
          operation,
        });
        if (this.session.user()?.id !== userId || expected !== this.resetGeneration) return false;
        this.account.set(state);
        this.theme.applyAccount(state.theme);
        this.accountNotice.set('');
        if (operation['type'] === 'theme') this.theme.notice.set('');
        return true;
      } catch (error) {
        if (this.session.user()?.id === userId) {
          this.accountNotice.set(
            error instanceof Error && error.message === 'CONFLICT'
              ? 'הנתונים השתנו במכשיר אחר. יש לרענן, לבדוק ולנסות שוב. השינוי שלך לא נשמר.'
              : 'השינוי לא נשמר בחשבון. יש לבדוק את החיבור ולנסות שוב.',
          );
          this.theme.applyAccount(this.account().theme);
          if (operation['type'] === 'theme')
            this.theme.notice.set('ערכת הנושא לא נשמרה בחשבון. יש לרענן ולנסות שוב.');
        }
        return false;
      } finally {
        this.busy.set(false);
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result;
    return result;
  }
  savePreferences(
    value: Preferences,
    expected = this.resetGeneration,
    revision?: number,
  ): Promise<boolean> {
    return this.isAccount()
      ? this.change({ type: 'preferences', value }, expected, revision)
      : this.demo.savePreferences(value, expected);
  }
  toggleSaved(jobId: string): Promise<boolean> {
    if (jobId.startsWith('greenhouse-') && !this.isAccount()) {
      this.accountNotice.set('לשמירת משרות אמיתיות יש להתחבר לחשבון.');
      return Promise.resolve(false);
    }
    return this.isAccount()
      ? this.change({ type: 'saved', jobId, value: !this.saved().includes(jobId) })
      : this.demo.toggleSaved(jobId);
  }
  togglePause(): Promise<boolean> {
    return this.isAccount()
      ? this.change({ type: 'pause', value: !this.paused() })
      : this.demo.togglePause();
  }
  approve(jobId: string): Promise<boolean> {
    return this.isAccount() ? this.change({ type: 'approve', jobId }) : this.demo.approve(jobId);
  }
  async saveProfile(
    name: string,
    headline = this.account().profile.headline,
    revision?: number,
  ): Promise<boolean> {
    if (this.isAccount())
      return this.change(
        { type: 'profile', value: { name, headline } },
        this.resetGeneration,
        revision,
      );
    this.demo.name.set(name);
    this.name.set(name);
    return true;
  }
  async reset(): Promise<'cleared' | 'session-only'> {
    return this.demo.reset();
  }
  async deleteAccountData(): Promise<boolean> {
    return this.change({ type: 'delete-data' });
  }
  async previewImport(): Promise<ImportPreview> {
    return this.request<ImportPreview>('import-preview', {
      preferences: this.demo.preferences(),
      saved: this.demo.saved(),
      applications: this.demo.applications(),
      paused: this.demo.paused(),
    });
  }
  async import(preview: ImportPreview): Promise<boolean> {
    return this.change({ type: 'import', data: preview.data, receipt: preview.receipt });
  }
  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    window.removeEventListener('focus', this.onFocus);
  }
}
