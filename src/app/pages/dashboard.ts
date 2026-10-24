import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
    if (this.store.session.config().discovery && this.store.catalogMode() === 'real')
      this.store.setFeedQuery(
        {},
        JSON.stringify([this.store.session.userId(), this.store.preferences()]),
      );
  }
  readonly recommended = computed(() => this.store.eligibleJobs().slice(0, 2));
}
