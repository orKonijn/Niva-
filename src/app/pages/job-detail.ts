import { isSupportedListingId } from '../core/source-registry';
import { localDate } from '../core/local-date';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatchIndicator } from '../shared/match-indicator';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppStore } from '../core/app-store';
import { districtLabel, workStyleLabel } from '../core/preferences';
import { Icon } from '../shared/icon';
import { directionsUrl, locationText } from '../core/job-locations';
@Component({
  imports: [FormsModule, RouterLink, Icon, MatchIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-detail.html',
})
export class JobDetail {
  readonly localDate = localDate;
  sourceAttribution(job: import('../core/models/job').Job) {
    return job.source?.attribution ?? [];
  }
  readonly directionsUrl = directionsUrl;
  readonly locationText = locationText;
  readonly districtLabel = districtLabel;
  readonly workStyleLabel = workStyleLabel;
  readonly store = inject(AppStore);
  readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly job = computed(() => this.store.findJob(this.params()?.get('id') ?? ''));
  readonly listingState = computed(
    () => this.store.listingStates()[this.params()?.get('id') ?? ''] ?? { status: 'idle' as const },
  );
  readonly listingError = computed(() => {
    const state = this.listingState();
    return state.status === 'error' ? state : null;
  });
  retry() {
    void this.store.ensureJob(this.params()?.get('id') ?? '', true);
  }
  constructor() {
    effect(() => {
      const id = this.params()?.get('id') ?? '';
      const discovery = this.store.session.config().discovery;
      this.store.session.userId();
      untracked(() => {
        if (isSupportedListingId(id)) {
          this.store.useCatalog('real');
          if (discovery) void this.store.ensureJob(id);
        }
      });
    });
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
