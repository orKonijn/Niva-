import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
  constructor() {
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
  readonly filtered = computed(() =>
    (this.savedOnly() ? this.store.visibleSavedJobs() : this.store.eligibleJobs()).filter(
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
  setFilter(queryParams: Record<string, string | null>, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
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
