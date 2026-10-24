import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppStore } from '../core/app-store';
import { districtLabel, workStyleLabel } from '../core/preferences';
import { Icon } from '../shared/icon';
import { directionsUrl, locationText } from '../core/job-locations';
@Component({
  imports: [FormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-detail.html',
})
export class JobDetail {
  readonly directionsUrl = directionsUrl;
  readonly locationText = locationText;
  readonly districtLabel = districtLabel;
  readonly workStyleLabel = workStyleLabel;
  readonly store = inject(AppStore);
  readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly job = computed(() => this.store.findJob(this.params()?.get('id') ?? ''));
  constructor() {
    if (inject(ActivatedRoute).snapshot.paramMap.get('id')?.startsWith('greenhouse-'))
      this.store.useCatalog('real');
  }
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
