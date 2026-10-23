import { Injectable, computed, signal } from '@angular/core';
export interface Job {
  id: string;
  title: string;
  company: string;
  initials: string;
  color: string;
  location: string;
  model: string;
  category: string;
  posted: string;
  description: string;
  skills: string[];
  reason: string;
}
export interface Preferences {
  role: string;
  location: string;
  model: string;
  exclusions: string;
}
export interface DemoApplication {
  jobId: string;
  approvedAt: string;
}
export const JOBS: readonly Job[] = [
  {
    id: 'product-designer',
    title: 'Product Designer',
    company: 'Forma Studio',
    initials: 'f',
    color: '#7758bf',
    location: 'תל אביב',
    model: 'היברידי',
    category: 'design',
    posted: 'לפני שעתיים',
    description:
      'עיצוב חוויות דיגיטליות משלב המחקר ועד למוצר. עבודה בצוות קטן שמאמין בפרטים גדולים, יחד עם אנשי פיתוח ומוצר.',
    skills: ['Figma', 'UX research', 'Design systems'],
    reason: 'עיצוב מוצר, עבודה היברידית וצוות רב תחומי',
  },
  {
    id: 'frontend-engineer',
    title: 'Frontend Engineer',
    company: 'Orbit',
    initials: 'o',
    color: '#256b59',
    location: 'תל אביב',
    model: 'היברידי',
    category: 'engineering',
    posted: 'לפני 4 שעות',
    description:
      'פיתוח ממשקים נגישים ומהירים למוצר שעוזר לצוותים לעבוד טוב יותר. אחריות על רכיבים, בדיקות ושיתוף פעולה עם צוות העיצוב.',
    skills: ['Angular', 'TypeScript', 'Accessibility'],
    reason: 'פיתוח ממשקים, TypeScript ומודל עבודה היברידי',
  },
  {
    id: 'ux-designer',
    title: 'UX/UI Designer',
    company: 'Monday Lane',
    initials: 'm',
    color: '#c46b39',
    location: 'מרחוק',
    model: 'מרחוק',
    category: 'design',
    posted: 'היום',
    description:
      'הובלת מחקר ועיצוב עבור חוויית עבודה פשוטה וברורה. יצירת מסעות משתמש, אב טיפוס וממשקים רספונסיביים.',
    skills: ['Prototyping', 'User research', 'Figma'],
    reason: 'מחקר משתמשים, עיצוב חוויות ועבודה מרחוק',
  },
  {
    id: 'product-manager',
    title: 'Product Manager',
    company: 'Bloom',
    initials: 'b',
    color: '#3978ad',
    location: 'הרצליה',
    model: 'במשרד',
    category: 'product',
    posted: 'היום',
    description:
      'עבודה קרובה עם לקוחות וצוותי פיתוח, זיהוי הזדמנויות והובלת מוצרים מאפיון ועד השקה.',
    skills: ['Discovery', 'Analytics', 'Roadmaps'],
    reason: 'ניהול מוצר ועבודה קרובה לצוותי פיתוח',
  },
  {
    id: 'fullstack-developer',
    title: 'Full Stack Developer',
    company: 'Northstar',
    initials: 'n',
    color: '#6c70b5',
    location: 'חיפה',
    model: 'היברידי',
    category: 'engineering',
    posted: 'אתמול',
    description:
      'בניית שירותי ווב ויישומים אמינים. תרומה לארכיטקטורה, סקירות קוד ופיתוח יכולות חדשות מקצה לקצה.',
    skills: ['TypeScript', 'Node.js', 'SQL'],
    reason: 'פיתוח ווב, שירותי צד שרת ושיתוף פעולה בצוות',
  },
];
const defaults: Preferences = { role: 'all', location: 'all', model: 'all', exclusions: '' };
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
  readonly eligibleJobs = computed(() => {
    const p = this.preferences();
    const excluded = p.exclusions
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return this.jobs.filter(
      (j) =>
        (p.role === 'all' || j.category === p.role) &&
        (p.location === 'all' || j.location === p.location) &&
        (p.model === 'all' || j.model === p.model) &&
        !excluded.some((e) => j.company.toLowerCase().includes(e)),
    );
  });
  constructor() {
    this.restore();
  }
  private restore(): void {
    try {
      const value: unknown = JSON.parse(localStorage.getItem('niva.demo.v1') ?? 'null');
      if (!value || typeof value !== 'object') return;
      const v = value as Record<string, unknown>;
      if (Array.isArray(v['saved']))
        this.saved.set(
          v['saved'].filter(
            (x): x is string => typeof x === 'string' && JOBS.some((j) => j.id === x),
          ),
        );
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
      const p = v['preferences'];
      if (p && typeof p === 'object') {
        const raw = p as Record<string, unknown>;
        this.preferences.set({
          role: ['all', 'design', 'engineering', 'product'].includes(String(raw['role']))
            ? String(raw['role'])
            : 'all',
          location: ['all', 'תל אביב', 'הרצליה', 'חיפה', 'מרחוק'].includes(String(raw['location']))
            ? String(raw['location'])
            : 'all',
          model: ['all', 'היברידי', 'מרחוק', 'במשרד'].includes(String(raw['model']))
            ? String(raw['model'])
            : 'all',
          exclusions: typeof raw['exclusions'] === 'string' ? raw['exclusions'].slice(0, 500) : '',
        });
      }
    } catch {
      /* Invalid or unavailable storage does not prevent using the demo. */
    }
  }
  private persist(): void {
    try {
      localStorage.setItem(
        'niva.demo.v1',
        JSON.stringify({
          preferences: this.preferences(),
          applications: this.applications(),
          saved: this.saved(),
          paused: this.paused(),
        }),
      );
    } catch {
      this.notice.set('השינויים זמינים לביקור הזה בלבד. האחסון המקומי אינו זמין.');
    }
  }
  savePreferences(value: Preferences): void {
    this.preferences.set({ ...value });
    this.persist();
  }
  toggleSaved(id: string): void {
    if (!this.jobs.some((j) => j.id === id)) return;
    this.saved.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    this.persist();
  }
  togglePause(): void {
    this.paused.update((x) => !x);
    this.persist();
  }
  approved(id: string): boolean {
    return this.applications().some((a) => a.jobId === id);
  }
  approve(id: string): boolean {
    if (this.paused() || this.approved(id) || !this.eligibleJobs().some((j) => j.id === id))
      return false;
    this.applications.update((a) => [{ jobId: id, approvedAt: new Date().toISOString() }, ...a]);
    this.persist();
    return true;
  }
  reset(): void {
    this.applications.set([]);
    this.saved.set([]);
    this.preferences.set({ ...defaults });
    this.paused.set(false);
    this.name.set('');
    this.resumeName.set('');
    this.notice.set('');
    this.persist();
  }
}
