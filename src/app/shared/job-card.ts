import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoStore, Job } from '../core/demo-store';
import { districtLabel, workStyleLabel } from '../core/preferences';
import { Icon } from './icon';
@Component({
  selector: 'niva-job-card',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-card.html',
  styleUrl: './job-card.css',
})
export class JobCard {
  readonly job = input.required<Job>();
  readonly districtLabel = districtLabel;
  readonly workStyleLabel = workStyleLabel;
  readonly store = inject(DemoStore);
}
