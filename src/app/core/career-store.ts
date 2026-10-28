import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountSession } from './account-session';
import type { CareerConfig, ResumeVersion } from './models/career';
export const careerError = (code: string) =>
  (
    ({
      GUIDE_UNAVAILABLE: 'המדריך אינו זמין כרגע. ההודעה נשמרה בשדה; אפשר לנסות שוב.',
      CONVERSATION_MODE_CHANGED: 'סוג השיחה השתנה. יש להתחיל שיחה חדשה.',
      CONSENT_REQUIRED: 'יש לאשר עיבוד נתונים לפני שליחה לשירות AI.',
      AI_NOT_CONFIGURED:
        'שירות הבינה המלאכותית טרם הוגדר. אין תשובה מדומה; אפשר להשתמש בחיפוש ובכלי קורות החיים.',
      AI_REJECTED:
        'התשובה נדחתה כי הכילה הפניות לא תקינות. היא אינה מוצגת או נשמרת. אפשר לנסות שוב.',
      AI_UNAVAILABLE: 'שירות הבינה המלאכותית אינו זמין כרגע. אפשר לנסות שוב.',
      SCANNER_NOT_CONFIGURED: 'העלאת קבצים מושבתת עד להגדרת שירות סריקה ופענוח. אפשר להדביק טקסט.',
      UNSAFE_FILE: 'הקובץ לא עבר בדיקת בטיחות ולא נשמר.',
      UNPARSEABLE_FILE: 'לא ניתן לקרוא בבטחה את הקובץ. יש להשתמש במסמך טקסט עד 20 עמודים.',
      PROCESSOR_UNAVAILABLE: 'שירות הסריקה אינו זמין. הקובץ לא נשמר.',
      INVALID_FILE_TYPE: 'אפשר להעלות PDF או DOCX תקינים בלבד.',
      UPLOAD_TOO_LARGE: 'הקובץ גדול מדי. הגודל המרבי הוא 750KB.',
      BODY_TOO_LARGE: 'הבקשה גדולה מדי.',
      REVIEW_REQUIRED: 'יש לבדוק ולאשר את העובדות בקורות החיים תחילה.',
      INVALID_RESUME_TEXT: 'יש להזין בין 20 ל־30,000 תווים.',
      RATE_LIMITED: 'הגעת למכסה. יש להמתין לפני ניסיון נוסף.',
      CONVERSATION_LIMIT: 'השיחה הגיעה למגבלה. אפשר להתחיל שיחה חדשה.',
      VERSION_LIMIT: 'אפשר לשמור עד 20 גרסאות. יש למחוק גרסה שאינה נחוצה.',
      LIFECYCLE_CHANGED: 'הנתונים נמחקו או השתנו. הפעולה בוטלה; יש לטעון מחדש.',
      RECORD_CHANGED: 'הגרסה השתנתה. יש לטעון מחדש.',
      JOB_UNAVAILABLE: 'המשרה אינה זמינה במאגר הנוכחי.',
      NOT_FOUND: 'הפריט לא נמצא או שתוקף השמירה הסתיים.',
      UNAUTHORIZED: 'יש להתחבר מחדש לחשבון.',
    }) as Record<string, string>
  )[code] ?? 'לא ניתן להשלים את הבקשה. יש לנסות שוב.';
type CareerChange = { kind: 'resume' | 'conversation' | 'reconcile'; id: string; serial: number };
interface CareerSnapshot {
  epoch: string;
  erasure: string;
  revision: string;
  resumes: ResumeVersion[];
  config: CareerConfig;
  operations: CareerOperations | null;
}
interface CareerOperations {
  scheduledObserved: boolean;
  schedulerOverdue: boolean;
  ingestionOverdue?: boolean;
  cleanupOverdue: boolean;
  cleanupBoundMinutes: number;
  rows?: {
    id: string;
    started_at: number | null;
    succeeded_at: number | null;
    error: string | null;
  }[];
  alerts?: { configured: boolean; operator: string | null };
}
@Injectable({ providedIn: 'root' })
export class CareerStore {
  readonly session = inject(AccountSession);
  /** Privacy erasure only. Scoped changes use changes/writeGeneration instead. */
  readonly generation = signal(0);
  readonly changes = signal<CareerChange | null>(null);
  private writeGeneration = 0;
  private serial = 0;
  private epoch = '';
  private erasure = '';
  private sequence = 0;
  private pending: Promise<void> | null = null;
  private readonly clock = signal(Date.now());
  readonly refreshIntervalMs = 30000;
  readonly revision = signal('');
  readonly syncedAt = signal<number | null>(null);
  readonly config = signal<CareerConfig>({
    ai: false,
    uploads: false,
    processor: '',
    retentionDays: 30,
    maxUploadBytes: 750000,
  });
  readonly resumes = signal<ResumeVersion[]>([]);
  readonly active = computed(() =>
    this.resumes().find((r) => r.active && r.confirmed && Date.parse(r.expiresAt) > this.clock()),
  );
  readonly operations = signal<CareerOperations | null>(null);
  readonly ready = signal(false);
  readonly error = signal('');
  private readonly channel =
    typeof BroadcastChannel === 'function' ? new BroadcastChannel('niva.career.lifecycle') : null;
  private readonly timer = setInterval(() => {
    this.clock.set(Date.now());
    if (document.visibilityState === 'visible') void this.refresh();
  }, this.refreshIntervalMs);
  private readonly onFocus = () => {
    void this.refresh();
  };
  constructor() {
    if (this.channel)
      this.channel.onmessage = (e) => {
        const message = e.data;
        if (message?.owner !== this.session.userId()) return;
        if (message.type === 'account-erasure') this.clear(false);
        else if (
          message.type === 'scope' &&
          (message.kind === 'resume' || message.kind === 'conversation') &&
          typeof message.id === 'string'
        ) {
          if (this.erasure && message.erasure && message.erasure !== this.erasure) {
            void this.load(true);
            return;
          }
          this.scope(message.kind, message.id, message.epoch, message.erasure, false);
          void this.load(true);
        } else if (message.type === 'refresh') void this.load(true);
      };
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onFocus);
    effect(() => {
      const owner = this.session.userId();
      untracked(() => this.clear(false));
      if (owner) untracked(() => void this.load());
    });
  }
  clear(broadcast = true) {
    this.generation.update((n) => n + 1);
    this.writeGeneration++;
    this.sequence++;
    this.pending = null;
    this.epoch = '';
    this.erasure = '';
    this.revision.set('');
    this.resumes.set([]);
    this.ready.set(false);
    this.error.set('');
    this.operations.set(null);
    this.syncedAt.set(null);
    if (broadcast)
      this.channel?.postMessage({ type: 'account-erasure', owner: this.session.userId() });
  }
  private scope(
    kind: 'resume' | 'conversation',
    id: string,
    epoch: string,
    erasure: string,
    broadcast = true,
  ) {
    this.writeGeneration++;
    this.sequence++;
    this.pending = null;
    this.epoch = epoch || this.epoch;
    this.erasure = erasure || this.erasure;
    if (kind === 'resume') this.resumes.update((list) => list.filter((r) => r.id !== id));
    this.changes.set({ kind, id, serial: ++this.serial });
    if (broadcast)
      this.channel?.postMessage({
        type: 'scope',
        owner: this.session.userId(),
        kind,
        id,
        epoch: this.epoch,
        erasure: this.erasure,
      });
  }
  async request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const owner = this.session.userId(),
      generation = this.generation(),
      writes = this.writeGeneration;
    const response = await fetch('/api/career/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: signal ?? AbortSignal.timeout(30000),
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json', 'X-Niva-CSRF': '1' },
            body: JSON.stringify(body),
          }),
    });
    const data = await response.json();
    if (
      owner !== this.session.userId() ||
      generation !== this.generation() ||
      writes !== this.writeGeneration
    )
      throw new Error('החשבון השתנה. יש לטעון מחדש את הנתונים.');
    const epoch = response.headers.get('x-niva-lifecycle') ?? '';
    const erasure = response.headers.get('x-niva-erasure') ?? '';
    if (erasure && this.erasure && erasure !== this.erasure) {
      this.clear(false);
      throw new Error('נתוני החשבון נמחקו. הפעולה בוטלה.');
    }
    if (!response.ok)
      throw new Error(
        response.status === 404 && path === 'snapshot'
          ? 'SNAPSHOT_UNAVAILABLE'
          : careerError(data.error),
      );
    const deletion = /^(resumes|conversations)\/([^/]+)\/delete$/.exec(path);
    if (deletion) {
      this.scope(
        deletion[1] === 'resumes' ? 'resume' : 'conversation',
        deletion[2],
        epoch,
        erasure,
      );
      return data as T;
    }
    if (body !== undefined) this.channel?.postMessage({ type: 'refresh', owner });
    return data as T;
  }
  async refresh() {
    this.clock.set(Date.now());
    if (this.session.userId()) await this.load();
  }
  load(force = false): Promise<void> {
    if (this.pending && !force) return this.pending;
    const owner = this.session.userId(),
      generation = this.generation(),
      writes = this.writeGeneration,
      sequence = ++this.sequence;
    const work = (async () => {
      try {
        let snapshot: CareerSnapshot;
        try {
          snapshot = await this.request<CareerSnapshot>('snapshot');
        } catch (e) {
          if (!(e instanceof Error) || e.message !== 'SNAPSHOT_UNAVAILABLE') throw e;
          const [config, resumes, operations] = await Promise.all([
            this.request<CareerConfig>('config'),
            this.request<ResumeVersion[]>('resumes'),
            this.request<CareerOperations>('operations').catch(() => null),
          ]);
          snapshot = {
            epoch: this.epoch,
            erasure: this.erasure,
            revision: 'legacy',
            config,
            resumes,
            operations,
          };
        }
        if (!Array.isArray(snapshot.resumes)) throw new Error('לא התקבלה תמונת נתונים תקינה.');
        if (
          sequence !== this.sequence ||
          owner !== this.session.userId() ||
          generation !== this.generation() ||
          writes !== this.writeGeneration
        )
          return;
        if (this.erasure && snapshot.erasure && snapshot.erasure !== this.erasure) {
          this.clear(false);
          return;
        }
        const removed = this.resumes().filter((r) => !snapshot.resumes.some((n) => n.id === r.id));
        if (this.epoch && snapshot.epoch && snapshot.epoch !== this.epoch) {
          this.writeGeneration++;
          this.changes.set({ kind: 'reconcile', id: '', serial: ++this.serial });
        }
        this.epoch = snapshot.epoch;
        this.erasure = snapshot.erasure;
        this.config.set(snapshot.config);
        this.operations.set(snapshot.operations);
        this.clock.set(Date.now());
        this.resumes.set(snapshot.resumes);
        this.revision.set(snapshot.revision);
        this.ready.set(true);
        this.error.set('');
        this.syncedAt.set(Date.now());
        for (const r of removed)
          this.changes.set({ kind: 'resume', id: r.id, serial: ++this.serial });
      } catch (e) {
        if (sequence === this.sequence && owner === this.session.userId())
          this.error.set(e instanceof Error ? e.message : 'לא ניתן לטעון קורות חיים.');
      } finally {
        if (sequence === this.sequence) this.pending = null;
      }
    })();
    this.pending = work;
    return work;
  }
  ngOnDestroy() {
    clearInterval(this.timer);
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onFocus);
    this.channel?.close();
  }
}
