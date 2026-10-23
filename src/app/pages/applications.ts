import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { Icon } from '../shared/icon';
@Component({
  imports: [DatePipe, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="page-heading">
      <div>
        <span class="section-kicker">מסתכלים על הדרך</span>
        <h1>ההגשות שלי</h1>
        <p>כל מה שבחרת לאשר בהדגמה, במקום אחד. לא נשלחו מועמדויות בפועל.</p>
      </div>
      <span class="count-pill">{{ records().length }} רישומים</span>
    </div>
    @if (records().length) {
      <div class="application-list">
        @for (record of records(); track record.jobId) {
          <article class="application-row">
            <span class="company-avatar" [style.background]="record.job?.color">{{
              record.job?.initials
            }}</span>
            <div class="application-title">
              <h2>
                <a [routerLink]="['/app/jobs', record.jobId]"
                  ><bdi>{{ record.job?.title }}</bdi></a
                >
              </h2>
              <span
                ><bdi>{{ record.job?.company }}</bdi></span
              >
            </div>
            <span class="status-badge"><niva-icon name="check" /> אושר בהדגמה</span
            ><time [attr.datetime]="record.approvedAt">{{
              record.approvedAt | date: 'dd/MM/yyyy HH:mm'
            }}</time>
          </article>
        }
      </div>
      <p class="form-hint">הרישומים נשמרים בדפדפן בלבד. מחיקת נתוני הדפדפן תמחק אותם.</p>
    } @else {
      <section class="empty-state panel">
        <span class="round-icon blue"><niva-icon name="briefcase" /></span>
        <h2>כאן תתחיל הדרך שלך</h2>
        <p>אחרי בדיקה ואישור של משרה לדוגמה, היא תופיע כאן.</p>
        <a routerLink="/app/jobs" class="button">מגלים משרות <niva-icon name="arrow" /></a>
      </section>
    }`,
})
export class Applications {
  readonly store = inject(DemoStore);
  readonly records = computed(() =>
    this.store
      .applications()
      .map((a) => ({ ...a, job: this.store.jobs.find((j) => j.id === a.jobId) })),
  );
}
