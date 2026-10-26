import { isSupportedListingId } from './source-registry';
import { trustedJobUrl } from './source-registry';
import type { CandidateCriteria } from './models/discovery';
import { uniqueJobs } from './job-identity';
import { CareerStore } from './career-store';
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
export type ListingState =
  | { status: 'idle' | 'loading' | 'ready' | 'missing' }
  | {
      status: 'error';
      code: 'auth' | 'rate' | 'server' | 'timeout' | 'invalid' | 'network';
      message: string;
    };
@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly demo = inject(DemoStore);
  private readonly career = inject(CareerStore);
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
  readonly listingStates = signal<Record<string, ListingState>>({});
  private readonly listingRequests = new Map<string, Promise<void>>();
  private listingEpoch = 0;
  private markListingsInitialized!: () => void;
  private readonly listingsInitialized = new Promise<void>((resolve) => {
    this.markListingsInitialized = resolve;
  });
  readonly feedCheckedAt = signal('');
  readonly feedStale = signal(false);
  readonly coverage = signal<{ category: string; district: string; style: string; n: number }[]>(
    [],
  );
  readonly feedTotal = signal(0);
  readonly nextCursor = signal<string | null>(null);
  readonly feedChanged = signal(false);
  readonly sourceHealth = signal<
    {
      id: string;
      name?: string;
      checked_at: string | null;
      error: string | null;
      next_at: number;
      partial?: boolean;
    }[]
  >([]);
  private feedQuery: Record<string, string> = {};
  private feedPreferenceKey = '';
  private feedGeneration = 0;
  private feedAbort: AbortController | null = null;
  private feedSnapshot = '';
  private sourceRefresh: Promise<void> | null = null;
  async refreshJobs(): Promise<void> {
    if (this.sourceRefresh) {
      await this.sourceRefresh;
      return this.loadJobs();
    }
    const work = this.loadJobs(false, true);
    this.sourceRefresh = work;
    try {
      await work;
    } finally {
      this.sourceRefresh = null;
    }
  }
  setFeedQuery(query: Record<string, string>, preferenceKey = ''): void {
    if (
      JSON.stringify(query) === JSON.stringify(this.feedQuery) &&
      preferenceKey === this.feedPreferenceKey
    )
      return;
    this.feedPreferenceKey = preferenceKey;
    this.feedQuery = query;
    void this.loadJobs();
  }
  async checkFeed(): Promise<void> {
    if (!this.session.config().discovery || this.jobsLoading() || this.catalogMode() !== 'real')
      return;
    const generation = this.feedGeneration;
    try {
      const response = await fetch(
        '/api/feed?' + new URLSearchParams({ ...this.feedQuery, limit: '1' }),
        { signal: AbortSignal.timeout(10000), cache: 'no-store' },
      );
      if (response.ok) {
        const result = await response.json();
        if (
          generation === this.feedGeneration &&
          this.feedSnapshot &&
          result.snapshot !== this.feedSnapshot
        )
          this.feedChanged.set(true);
      }
    } catch {
      /* Polling is best-effort; explicit refresh provides actionable errors. */
    }
  }
  async loadMore(): Promise<void> {
    if (this.nextCursor() && !this.jobsLoading()) await this.loadJobs(true);
  }

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
  async loadJobs(more = false, refreshSources = false): Promise<void> {
    // Filter/account changes wait for the visit's source check, then use current filters.
    if (!refreshSources && this.sourceRefresh) await this.sourceRefresh;
    if (more && this.jobsLoading()) return;
    this.feedAbort?.abort();
    const controller = new AbortController();
    this.feedAbort = controller;
    const generation = ++this.feedGeneration;
    const owner = this.session.userId();
    this.jobsLoading.set(true);
    this.jobsError.set('');
    try {
      const discovery = this.session.config().discovery;
      const pageSize = this.feedQuery['scope'] === 'all' ? 50 : 12;
      const query = new URLSearchParams({
        ...this.feedQuery,
        limit: String(more ? pageSize : Math.min(50, Math.max(pageSize, this.realJobs().length))),
        ...(more && this.nextCursor() ? { cursor: this.nextCursor()! } : {}),
        ...(refreshSources ? { refresh: '1' } : {}),
      });
      const queryKey = JSON.stringify(this.feedQuery);
      const response = await fetch(discovery ? '/api/feed?' + query : '/api/jobs', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(refreshSources ? 75000 : 30000),
        ]),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'CURSOR_EXPIRED'
            : response.status === 429
              ? 'RATE_LIMITED'
              : 'FEED_UNAVAILABLE',
        );
      const feed = (await response.json()) as {
        jobs: Job[];
        archived?: Job[];
        fetchedAt: string;
        stale: boolean;
        total?: number;
        coverage?: { category: string; district: string; style: string; n: number }[];
        nextCursor?: string | null;
        snapshot?: string;
        health?: {
          id: string;
          name?: string;
          checked_at: string | null;
          error: string | null;
          next_at: number;
          partial?: boolean;
        }[];
      };
      if (
        !Array.isArray(feed.jobs) ||
        !feed.jobs.every((j) => {
          if (j.source?.kind !== 'real' || !j.source.applicationUrl.startsWith('https://'))
            return false;
          return trustedJobUrl(j.id, j.source.applicationUrl);
        })
      )
        throw new Error();
      if (generation !== this.feedGeneration || owner !== this.session.userId()) return;
      if (queryKey !== JSON.stringify(this.feedQuery)) return;
      this.realJobs.set([
        ...new Map([...(more ? this.realJobs() : []), ...feed.jobs].map((j) => [j.id, j])).values(),
      ]);
      this.archivedJobs.set(feed.archived ?? []);
      this.feedCheckedAt.set(feed.fetchedAt);
      this.feedStale.set(feed.stale);
      this.feedTotal.set(feed.total ?? feed.jobs.length);
      this.coverage.set(feed.coverage ?? []);
      this.nextCursor.set(feed.nextCursor ?? null);
      this.feedSnapshot = feed.snapshot ?? '';
      this.sourceHealth.set(feed.health ?? []);
      this.feedChanged.set(false);
    } catch (error) {
      if (generation === this.feedGeneration && !controller.signal.aborted)
        this.jobsError.set(
          error instanceof Error && error.message === 'CURSOR_EXPIRED'
            ? 'המאגר השתנה. יש לרענן את התוצאות לפני טעינת עמוד נוסף.'
            : error instanceof Error && error.message === 'RATE_LIMITED'
              ? 'הגעת למגבלת הבקשות. אפשר לנסות שוב בעוד דקה.'
              : 'לא ניתן לרענן משרות מהמקור. אפשר לנסות שוב; משרות שכבר נטענו נשארות מוצגות.',
        );
    } finally {
      if (generation === this.feedGeneration) this.jobsLoading.set(false);
    }
  }
  async ensureJob(id: string, retry = false): Promise<void> {
    // Initial account reconciliation clears listing state/epochs. Start only
    // after it can run, including when callers already see discovery config.
    await this.listingsInitialized;
    if (!this.session.config().discovery || !isSupportedListingId(id)) return;
    const pending = this.listingRequests.get(id);
    if (pending) return pending;
    const owner = this.session.userId();
    const update = (state: ListingState) => {
      if (owner === this.session.userId() && epoch === this.listingEpoch)
        this.listingStates.update((states) => ({ ...states, [id]: state }));
    };
    const epoch = this.listingEpoch;
    update({ status: 'loading' });
    const request = (async () => {
      const timeoutSignal = AbortSignal.timeout(10000);
      try {
        const response = await fetch('/api/listings/' + encodeURIComponent(id), {
          signal: timeoutSignal,
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (response.status === 404) {
          update({ status: 'missing' });
          return;
        }
        if (!response.ok) {
          const code =
            response.status === 401 || response.status === 403
              ? 'auth'
              : response.status === 429
                ? 'rate'
                : 'server';
          update({
            status: 'error',
            code,
            message:
              code === 'auth'
                ? 'החיבור לחשבון פג או שאין גישה למשרה. יש להתחבר מחדש ולנסות שוב.'
                : code === 'rate'
                  ? 'בוצעו בקשות רבות. יש להמתין מעט ולנסות שוב.'
                  : 'שירות המשרות אינו זמין כרגע. אפשר לנסות שוב.',
          });
          return;
        }
        let job: Job;
        try {
          job = await response.json();
          if (
            !job ||
            job.id !== id ||
            typeof job.title !== 'string' ||
            typeof job.company !== 'string' ||
            !Array.isArray(job.offices) ||
            !Array.isArray(job.skills) ||
            job.source?.kind !== 'real'
          )
            throw Error();
          if (!trustedJobUrl(id, job.source.applicationUrl)) throw Error();
        } catch (error) {
          if (timeoutSignal.aborted || (error instanceof Error && error.name === 'TimeoutError'))
            throw error;
          update({
            status: 'error',
            code: 'invalid',
            message: 'התקבלה תשובה לא תקינה לשאילתת המשרה. אפשר לנסות שוב.',
          });
          return;
        }
        if (owner === this.session.userId() && epoch === this.listingEpoch) {
          this.archivedJobs.update((jobs) => [...jobs.filter((j) => j.id !== id), job]);
          update({ status: 'ready' });
        }
      } catch (error) {
        const timeout =
          timeoutSignal.aborted || (error instanceof Error && error.name === 'TimeoutError');
        update({
          status: 'error',
          code: timeout ? 'timeout' : 'network',
          message: timeout
            ? 'טעינת המשרה ארכה יותר מדי זמן. אפשר לנסות שוב.'
            : 'החיבור לשירות המשרות נכשל. יש לבדוק את החיבור ולנסות שוב.',
        });
      }
    })();
    this.listingRequests.set(id, request);
    try {
      await request;
    } finally {
      if (this.listingRequests.get(id) === request) this.listingRequests.delete(id);
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
  readonly displayName = computed(
    () => this.name().trim() || this.session.user()?.name.trim() || '',
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
    uniqueJobs(this.jobs.filter((job) => this.saved().includes(job.id) && !this.excluded(job))),
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
      if (this.session.loading()) return;
      const userId = this.session.userId();
      untracked(() => {
        this.accountGeneration = crypto.randomUUID();
        this.account.set(emptyAccountState());
        this.archivedJobs.set([]);
        this.listingStates.set({});
        this.listingEpoch++;
        this.listingRequests.clear();
        this.feedGeneration++;
        this.feedAbort?.abort();
        this.realJobs.set([]);
        this.nextCursor.set(null);
        this.feedTotal.set(0);
        this.feedPreferenceKey = '';
        this.jobsLoading.set(false);
        this.accountReady.set(false);
        this.accountNotice.set('');
        this.resumeName.set('');
        if (this.session.config().realJobs) void this.refreshJobs();
        if (userId) {
          this.theme.accountSelection = (value) => {
            void this.change({ type: 'theme', value });
          };
          void this.reload(userId);
        } else {
          this.theme.accountSelection = null;
          this.theme.restoreGuest();
        }
        this.markListingsInitialized();
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
  completeSetup(value: Preferences): Promise<boolean> {
    return this.change({ type: 'complete-setup', value });
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
  saveCriteria(value: CandidateCriteria): Promise<boolean> {
    return this.change({ type: 'criteria', value });
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
    this.career.clear();
    const result = await this.change({ type: 'delete-data' });
    if (result) await this.career.load();
    return result;
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
    this.feedAbort?.abort();
    clearInterval(this.refreshTimer);
    window.removeEventListener('focus', this.onFocus);
  }
}
