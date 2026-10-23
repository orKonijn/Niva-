import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { districtLabel, workStyleLabel } from '../core/preferences';
import { Icon } from '../shared/icon';
@Component({
  imports: [FormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-detail.html',
})
export class JobDetail {
  readonly districtLabel = districtLabel;
  readonly workStyleLabel = workStyleLabel;
  readonly store = inject(DemoStore);
  readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly job = computed(() => this.store.jobs.find((j) => j.id === this.params()?.get('id')));
  readonly eligible = computed(() =>
    this.store.eligibleJobs().some((j) => j.id === this.job()?.id),
  );
  acknowledged = false;
  note = '';
  readonly error = signal('');
  async approve(): Promise<void> {
    const job = this.job();
    if (!job || !this.acknowledged) return;
    if (!(await this.store.approve(job.id)))
      this.error.set('לא ניתן לאשר כעת. יש לבדוק את מצב הפעילות וההעדפות.');
  }
}
