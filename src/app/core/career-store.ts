import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountSession } from './account-session';
import type { CareerConfig, ResumeVersion } from './models/career';
export const careerError = (code: string) =>
  (
    ({
      AI_NOT_CONFIGURED:
        'שירות הבינה המלאכותית טרם הוגדר. אין תשובה מדומה; אפשר להשתמש בחיפוש ובכלי קורות החיים.',
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
@Injectable({ providedIn: 'root' })
export class CareerStore {
  readonly session = inject(AccountSession);
  readonly generation = signal(0);
  private epoch = '';
  private readonly channel =
    typeof BroadcastChannel === 'function' ? new BroadcastChannel('niva.career.lifecycle') : null;
  clear(broadcast = true) {
    this.generation.update((n) => n + 1);
    this.epoch = '';
    this.resumes.set([]);
    this.ready.set(false);
    this.error.set('');
    this.operations.set(null);
    if (broadcast) this.channel?.postMessage('clear');
  }
  ngOnDestroy() {
    this.channel?.close();
  }
  readonly config = signal<CareerConfig>({
    ai: false,
    uploads: false,
    processor: '',
    retentionDays: 30,
    maxUploadBytes: 750000,
  });
  readonly resumes = signal<ResumeVersion[]>([]);
  readonly active = computed(() => this.resumes().find((r) => r.active && r.confirmed));
  readonly operations = signal<{
    scheduledObserved: boolean;
    schedulerOverdue: boolean;
    cleanupOverdue: boolean;
    cleanupBoundMinutes: number;
  } | null>(null);
  readonly ready = signal(false);
  readonly error = signal('');
  constructor() {
    if (this.channel) this.channel.onmessage = () => this.clear(false);
    effect(() => {
      const owner = this.session.userId();
      untracked(() => this.clear(false));
      if (owner) untracked(() => void this.load());
    });
  }
  async request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const owner = this.session.userId();
    const generation = this.generation();
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
    if (generation !== this.generation() || owner !== this.session.userId())
      throw new Error('החשבון השתנה. יש לטעון מחדש את הנתונים.');
    const epoch = response.headers.get('x-niva-lifecycle');
    if (response.ok && path.endsWith('/delete')) {
      this.clear();
      if (epoch) this.epoch = epoch;
      return data as T;
    }
    if (epoch && this.epoch && epoch !== this.epoch) {
      this.clear(false);
      throw new Error('נתוני החשבון השתנו. יש לטעון מחדש.');
    }
    if (epoch) this.epoch = epoch;
    if (!response.ok) throw new Error(careerError(data.error));
    return data as T;
  }
  async load(): Promise<void> {
    const owner = this.session.userId();
    const generation = this.generation();
    try {
      const [config, resumes, operations] = await Promise.all([
        this.request<CareerConfig>('config'),
        this.request<ResumeVersion[]>('resumes'),
        this.request<NonNullable<ReturnType<typeof this.operations>>>('operations').catch(
          () => null,
        ),
      ]);
      if (generation === this.generation() && owner === this.session.userId()) {
        this.operations.set(operations);
        this.config.set(config);
        this.resumes.set(resumes);
        this.ready.set(true);
        this.error.set('');
      }
    } catch (e) {
      if (owner === this.session.userId())
        this.error.set(e instanceof Error ? e.message : 'לא ניתן לטעון את קורות החיים.');
    }
  }
}
