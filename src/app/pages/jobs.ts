import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { Icon } from '../shared/icon';
import { JobCard } from '../shared/job-card';
@Component({
  imports: [FormsModule, RouterLink, Icon, JobCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="page-heading">
      <div>
        <span class="section-kicker">מוצאים את החיבור</span>
        <h1>ההזדמנויות שלך</h1>
        <p>כל משרה היא אפשרות להתחלה חדשה. בודקים מה מתאים לך.</p>
      </div>
      <a routerLink="/app/preferences" class="button button-outline button-small"
        ><niva-icon name="settings" /> העדפות חיפוש</a
      >
    </div>
    <div class="filter-panel">
      <div class="search-input">
        <niva-icon name="search" /><input
          aria-label="חיפוש תפקיד או חברה"
          placeholder="איזה תפקיד או חברה מעניינים אותך?"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
        />
      </div>
      <label class="filter-label"
        >סגנון עבודה<select [ngModel]="model()" (ngModelChange)="model.set($event)">
          <option value="all">כל הסגנונות</option>
          <option>היברידי</option>
          <option>מרחוק</option>
          <option>במשרד</option>
        </select></label
      >
    </div>
    <div class="section-row">
      <div class="segmented" aria-label="תצוגת משרות">
        <button
          [class.selected]="!savedOnly()"
          [attr.aria-pressed]="!savedOnly()"
          (click)="savedOnly.set(false)"
        >
          כל המשרות</button
        ><button
          [class.selected]="savedOnly()"
          [attr.aria-pressed]="savedOnly()"
          (click)="savedOnly.set(true)"
        >
          השמורות שלי <span>{{ store.saved().length }}</span>
        </button>
      </div>
      <span class="muted" role="status">{{ filtered().length }} משרות לדוגמה</span>
    </div>
    <div class="jobs-grid">
      @for (job of filtered(); track job.id) {
        <niva-job-card [job]="job" />
      } @empty {
        <section class="empty-state">
          <niva-icon name="search" />
          <h2>עדיין לא מצאנו כאן התאמה</h2>
          <p>אפשר לנסות מילות חיפוש אחרות או לשנות את ההעדפות.</p>
          <button class="button button-small" (click)="clear()">ניקוי הסינון במסך</button
          ><a routerLink="/app/preferences" class="text-link">עדכון העדפות קבועות</a>
        </section>
      }
    </div>`,
})
export class Jobs {
  readonly store = inject(DemoStore);
  readonly route = inject(ActivatedRoute);
  readonly query = signal('');
  readonly model = signal('all');
  readonly savedOnly = signal(this.route.snapshot.queryParamMap.get('saved') === 'true');
  readonly filtered = computed(() =>
    this.store
      .eligibleJobs()
      .filter(
        (j) =>
          (!this.savedOnly() || this.store.saved().includes(j.id)) &&
          (this.model() === 'all' || this.model() === j.model) &&
          `${j.title} ${j.company}`.toLowerCase().includes(this.query().trim().toLowerCase()),
      ),
  );
  clear(): void {
    this.query.set('');
    this.model.set('all');
    this.savedOnly.set(false);
  }
}
