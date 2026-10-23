import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoStore, Job } from '../core/demo-store';
import { Icon } from './icon';
@Component({
  selector: 'niva-job-card',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <article class="job-card">
    <div class="job-card-top">
      <span class="company-avatar" [style.background]="job().color">{{ job().initials }}</span>
      <div class="job-title">
        <h3>
          <a [routerLink]="['/app/jobs', job().id]"
            ><bdi>{{ job().title }}</bdi></a
          >
        </h3>
        <span
          ><bdi>{{ job().company }}</bdi> <span class="muted">· חברת הדגמה</span></span
        >
      </div>
      <button
        class="icon-button save-button"
        [class.saved]="store.saved().includes(job().id)"
        [attr.aria-label]="store.saved().includes(job().id) ? 'הסרת המשרה מהשמורות' : 'שמירת המשרה'"
        [attr.aria-pressed]="store.saved().includes(job().id)"
        (click)="store.toggleSaved(job().id)"
      >
        <niva-icon name="heart" />
      </button>
    </div>
    <div class="job-meta">
      <span><niva-icon name="pin" />{{ job().location }}</span
      ><span><niva-icon name="briefcase" />{{ job().model }}</span
      ><span><niva-icon name="clock" />{{ job().posted }}</span>
    </div>
    <p class="job-reason"><niva-icon name="sparkles" />{{ job().reason }}</p>
    <div class="job-card-bottom">
      <span class="status-badge" [class.blue-badge]="!store.approved(job().id)">{{
        store.approved(job().id) ? 'אושר בהדגמה' : 'משרה לדוגמה'
      }}</span
      ><a [routerLink]="['/app/jobs', job().id]" class="text-link"
        >לבדיקת המשרה <niva-icon name="arrow"
      /></a>
    </div>
  </article>`,
})
export class JobCard {
  readonly job = input.required<Job>();
  readonly store = inject(DemoStore);
}
