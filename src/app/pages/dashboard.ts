import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { Icon } from '../shared/icon';
import { JobCard } from '../shared/job-card';
@Component({
  imports: [RouterLink, Icon, JobCard],
  template: ` <div class="page-heading">
      <div>
        <span class="section-kicker">הזדמנויות חדשות מחכות לך</span>
        <h1>
          היי{{ store.name() ? ' ' + store.name() : '' }}, טוב לראות אותך
          <span class="wave">✦</span>
        </h1>
        <p>הצעד הבא שלך מתחיל בדיוק כאן.</p>
      </div>
      <button class="button button-outline button-small" (click)="store.togglePause()">
        <niva-icon [name]="store.paused() ? 'play' : 'pause'" />{{
          store.paused() ? 'חידוש הפעילות' : 'השהיית פעילות'
        }}
      </button>
    </div>
    <section class="welcome-panel">
      <div>
        <span class="section-kicker">עושים מקום לדבר הבא</span>
        <h2>חיפוש עבודה, עם קצת יותר שקט.</h2>
        <p>מגלים הזדמנויות, בודקים את הפרטים ומתקדמים כשזה מרגיש נכון.</p>
        <a routerLink="/app/jobs" class="button button-small"
          >למשרות שמחכות לך <niva-icon name="arrow"
        /></a>
      </div>
      <img src="assets/niva-hero.webp" width="320" height="180" alt="" />
    </section>
    <section class="stats-grid" aria-label="סיכום הפעילות">
      <a routerLink="/app/jobs" class="stat-card"
        ><span class="round-icon blue"><niva-icon name="search" /></span
        ><span>משרות לפי ההעדפות</span><strong>{{ store.eligibleJobs().length }}</strong
        ><small>מתוך מאגר ההדגמה</small></a
      ><a routerLink="/app/jobs" [queryParams]="{ saved: 'true' }" class="stat-card"
        ><span class="round-icon lavender"><niva-icon name="heart" /></span><span>משרות ששמרת</span
        ><strong>{{ store.saved().length }}</strong
        ><small>כדי לחזור אליהן בזמן שלך</small></a
      ><a routerLink="/app/applications" class="stat-card"
        ><span class="round-icon green"><niva-icon name="check" /></span><span>אושרו בהדגמה</span
        ><strong>{{ store.applications().length }}</strong
        ><small>לא נשלחו למעסיקים</small></a
      >
    </section>
    <div class="section-row">
      <div>
        <h2>אולי כאן מתחיל הפרק הבא</h2>
        <p>משרות לדוגמה לפי ההעדפות שבחרת</p>
      </div>
      <a routerLink="/app/jobs" class="text-link">לכל המשרות <niva-icon name="arrow" /></a>
    </div>
    <div class="jobs-grid">
      @for (job of recommended(); track job.id) {
        <niva-job-card [job]="job" />
      } @empty {
        <div class="empty-state">
          <niva-icon name="search" />
          <h3>נרחיב קצת את האופק?</h3>
          <p>אין משרות לדוגמה שמתאימות לכל ההעדפות הנוכחיות.</p>
          <a routerLink="/app/preferences" class="button button-small">עדכון העדפות</a>
        </div>
      }
    </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  readonly store = inject(DemoStore);
  readonly recommended = computed(() => this.store.eligibleJobs().slice(0, 2));
}
