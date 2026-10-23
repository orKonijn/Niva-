import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { Icon } from '../shared/icon';
@Component({
  imports: [PageHeading, DatePipe, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './applications.html',
})
export class Applications {
  readonly store = inject(DemoStore);
  readonly records = computed(() =>
    this.store
      .applications()
      .map((a) => ({ ...a, job: this.store.jobs.find((j) => j.id === a.jobId) })),
  );
}
