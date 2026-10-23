import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { Icon } from '../shared/icon';
import { JobCard } from '../shared/job-card';
@Component({
  imports: [RouterLink, Icon, JobCard],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  readonly store = inject(DemoStore);
  readonly recommended = computed(() => this.store.eligibleJobs().slice(0, 2));
}
