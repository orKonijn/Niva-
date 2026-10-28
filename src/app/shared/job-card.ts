import { payLabel } from '../core/pay-label';
import { localDate } from '../core/local-date';
import { jobOpportunity } from '../core/job-opportunity';
import { discoveryRank } from '../core/discovery-ranking';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatchIndicator } from './match-indicator';
import { RouterLink } from '@angular/router';
import { AppStore, Job } from '../core/app-store';
import { districtLabel, workStyleLabel } from '../core/preferences';
import { Icon } from './icon';
@Component({
  selector: 'niva-job-card',
  imports: [RouterLink, Icon, MatchIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-card.html',
  styleUrl: './job-card.css',
})
export class JobCard {
  readonly localDate = localDate;
  readonly jobOpportunity = jobOpportunity;
  readonly rankingReasons = computed(
    () =>
      discoveryRank(this.job(), '', this.store.preferences(), this.store.account().profile.criteria)
        .reasons,
  );
  readonly job = input.required<Job>();
  readonly districtLabel = districtLabel;
  readonly workStyleLabel = workStyleLabel;
  readonly payLabel = payLabel;
  readonly store = inject(AppStore);
}
