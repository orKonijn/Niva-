import { localDate } from '../core/local-date';
import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppStore } from '../core/app-store';
import {
  CATEGORIES,
  DISTRICTS,
  isCategory,
  isDistrict,
  normalizeWorkStyles,
  isWorkStyle,
  WorkStyle,
} from '../core/preferences';
import { CareerStore } from '../core/career-store';
import { resumeMatch } from '../core/matching';
import { WorkStyleFields } from '../shared/work-style-fields';
import { Icon } from '../shared/icon';
import { JobCard } from '../shared/job-card';
import { JobMap } from '../shared/job-map';
@Component({
  imports: [PageHeading, FormsModule, RouterLink, Icon, JobCard, WorkStyleFields, JobMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jobs.html',
})
export class Jobs {
  readonly localDate = localDate;
  readonly store = inject(AppStore);
  readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly query = computed(() => this.params().get('q') ?? '');
  readonly categories = CATEGORIES;
  readonly districts = DISTRICTS;
  readonly workStyles = computed(() =>
    normalizeWorkStyles(this.params().get('styles') ?? this.params().get('model')),
  );
  readonly district = computed(() => {
    const value = this.params().get('district');
    return isDistrict(value) ? value : 'all';
  });
  readonly category = computed(() => {
    const value = this.params().get('category');
    return isCategory(value) ? value : 'all';
  });
  readonly career = inject(CareerStore);
  private readonly feedPoll = setInterval(() => void this.store.checkFeed(), 60000);
  ngOnDestroy() {
    clearInterval(this.feedPoll);
  }
  constructor() {
    effect(() => {
      const discovery = this.store.session.config().discovery;
      this.store.preferences();
      this.store.saved();
      if (discovery && this.store.catalogMode() === 'real')
        this.store.setFeedQuery(
          {
            q: this.query(),
            category: this.category(),
            district: this.district(),
            styles: this.workStyles().join(','),
            saved: String(this.savedOnly()),
          },
          JSON.stringify([
            this.store.session.userId(),
            this.store.preferences(),
            this.savedOnly() ? this.store.saved() : [],
          ]),
        );
    });

    const params = this.route.snapshot.queryParamMap;
    if (this.store.session.config().realJobs && params.get('source') !== 'demo')
      this.store.useCatalog('real');
    if (params.get('source') === 'real' || params.get('source') === 'demo')
      this.store.useCatalog(params.get('source') as 'real' | 'demo');
    if (params.has('model'))
      this.setFilter(
        {
          model: null,
          styles:
            normalizeWorkStyles(params.get('styles') ?? params.get('model')).join(',') || null,
        },
        true,
      );
  }
  setStyles(styles: WorkStyle[]): void {
    this.setFilter({ styles: styles.join(',') || null, model: null });
  }
  readonly savedOnly = computed(() => this.params().get('saved') === 'true');
  readonly mapView = computed(() => this.params().get('view') === 'map');
  readonly matching = computed(() =>
    (this.store.catalogMode() === 'real' && this.store.session.config().discovery
      ? this.store.realJobs()
      : this.savedOnly()
        ? this.store.visibleSavedJobs()
        : this.store.eligibleJobs()
    ).filter(
      (j) =>
        (!this.savedOnly() || this.store.saved().includes(j.id)) &&
        (!this.workStyles().length ||
          (isWorkStyle(j.workStyle) && this.workStyles().includes(j.workStyle))) &&
        (this.district() === 'all' || this.district() === j.district) &&
        (this.category() === 'all' || this.category() === j.category) &&
        `${j.title} ${j.company} ${j.skills.join(' ')}`
          .toLowerCase()
          .includes(this.query().trim().toLowerCase()),
    ),
  );
  readonly filtered = computed(() => {
    const jobs = this.matching();
    if (this.params().get('sort') !== 'relevance') return jobs;
    const resume = this.career.active();
    if (!resume) return jobs;
    return [...jobs].sort((a, b) => {
      const x = resumeMatch(a, resume.text, true),
        y = resumeMatch(b, resume.text, true);
      return (y.coverage ?? -1) - (x.coverage ?? -1);
    });
  });
  setFilter(queryParams: Record<string, string | null>, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
  readonly emptyExplanation = computed(() => {
    if (this.store.catalogMode() !== 'real')
      return 'אלה נתוני הדגמה במכשיר. אפשר לשנות את הסינון במסך.';
    if (this.store.jobsError() || this.store.sourceHealth().some((s) => s.error))
      return 'חלק מהמקורות אינם זמינים. אפס תוצאות אינו מוכיח שאין משרות; אפשר לרענן ולבדוק את אתר המקור.';
    const coverage = this.store.coverage();
    const p = this.store.preferences();
    const category = this.category() === 'all' ? p.role : this.category();
    const district = this.district() === 'all' ? p.district : this.district();
    if (category !== 'all' && !coverage.some((c) => c.category === category))
      return 'בכיסוי המצומצם הנוכחי, אחרי החרגות החברות, לא נמצאו משרות בתחום המבוקש. זה אינו חיפוש בכלל שוק העבודה.';
    if (district !== 'all' && !coverage.some((c) => c.district === district))
      return 'במקורות הנוכחיים, אחרי החרגות החברות, אין כרגע משרות במחוז המבוקש.';
    if (
      (this.workStyles().length || p.workStyles.length) &&
      coverage.some((c) => c.style === 'unknown')
    )
      return 'הסינון מסתיר גם משרות שסגנון העבודה שלהן לא נמסר במקור. אפשר לבדוק את ההעדפות במפורש.';
    return 'הכיסוי מוגבל לשני לוחות מעסיקים. שילוב הסינון במסך, ההעדפות וההחרגות לא הניב תוצאות. ניתן לנקות רק את הסינון במסך; ההעדפות נשמרות.';
  });
  clear(): void {
    this.setFilter({
      q: null,
      model: null,
      styles: null,
      district: null,
      category: null,
      saved: null,
    });
  }
}
