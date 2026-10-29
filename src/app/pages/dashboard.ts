import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStore } from '../core/app-store';
import { Icon } from '../shared/icon';
import { JobCard } from '../shared/job-card';
@Component({
  imports: [RouterLink, Icon, JobCard],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  readonly store = inject(AppStore);
  constructor() {
    effect(() => {
      if (this.store.session.config().discovery && this.store.catalogMode() === 'real') {
        const query = {
          scope: 'personal',
          unknownStyle: 'true',
          sort: this.store.preferences().role !== 'all' ? 'relevance' : 'source',
        };
        const key = JSON.stringify([
          this.store.session.userId(),
          this.store.preferences(),
          this.store.account().profile.criteria,
        ]);
        untracked(() => this.store.setFeedQuery(query, key));
      }
    });
  }
  readonly recommended = computed(() => this.store.eligibleJobs().slice(0, 2));
  readonly personalCount = computed(() =>
    this.store.catalogMode() === 'real' && this.store.session.config().discovery
      ? this.store.jobsLoading()
        ? '…'
        : this.store.jobsError()
          ? '—'
          : this.store.feedTotal()
      : this.store.eligibleJobs().length,
  );
}
