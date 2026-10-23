import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoStore } from '../core/demo-store';
import { Icon } from '../shared/icon';
@Component({
  imports: [FormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <a routerLink="/app/jobs" class="text-link back-link"
      >בחזרה לכל המשרות <niva-icon name="arrow"
    /></a>
    @if (job(); as job) {
      <div class="page-heading">
        <div class="detail-job-title">
          <span class="company-avatar large" [style.background]="job.color">{{
            job.initials
          }}</span>
          <div>
            <span class="section-kicker">משרה לדוגמה</span>
            <h1>
              <bdi>{{ job.title }}</bdi>
            </h1>
            <p>
              <bdi>{{ job.company }}</bdi> · {{ job.location }} · {{ job.model }}
            </p>
          </div>
        </div>
        <button class="button button-outline button-small" (click)="store.toggleSaved(job.id)">
          <niva-icon name="heart" />{{
            store.saved().includes(job.id) ? 'הסרה מהשמורות' : 'שמירת משרה'
          }}
        </button>
      </div>
      <div class="detail-grid">
        <section class="panel">
          <h2>קצת על התפקיד</h2>
          <p>{{ job.description }}</p>
          <h3>מה מביאים לתפקיד?</h3>
          <div class="skills">
            @for (skill of job.skills; track skill) {
              <span dir="ltr">{{ skill }}</span>
            }
          </div>
          <div class="info-box">
            <niva-icon name="sparkles" />
            <div>
              <strong>כיוון שכדאי לבדוק</strong>
              <p>
                {{ job.reason }}. הסבר זה הוא חלק מנתוני ההדגמה, ולא ניתוח AI של קורות החיים שלך.
              </p>
            </div>
          </div>
          <h3>במילים שלך</h3>
          <label
            >הערה לבדיקת המועמדות <span class="muted">(לא חובה, להדגמה בלבד)</span
            ><textarea
              [(ngModel)]="note"
              maxlength="1500"
              rows="4"
              placeholder="מה חשוב לך לבדוק לגבי התפקיד? לא נשמר ולא נשלח."
            ></textarea>
          </label>
        </section>
        <section class="panel review-panel">
          <span class="section-kicker">עוצרים לרגע ובודקים</span>
          <h2>לפני שמאשרים</h2>
          <dl class="review-list">
            <div>
              <dt>חברה</dt>
              <dd>
                <bdi>{{ job.company }}</bdi> · לדוגמה
              </dd>
            </div>
            <div>
              <dt>קורות חיים</dt>
              <dd>
                <bdi>{{ store.resumeName() || 'פרופיל לדוגמה — ללא קובץ' }}</bdi>
              </dd>
            </div>
            <div>
              <dt>יעד השליחה</dt>
              <dd>אין חיבור חיצוני בהדגמה</dd>
            </div>
            <div>
              <dt>מה יקרה באישור?</dt>
              <dd>יישמר רישום מקומי בלבד</dd>
            </div>
          </dl>
          @if (store.approved(job.id)) {
            <div class="success-box" role="status">
              <niva-icon name="check" /><strong>המשרה אושרה בהדגמה</strong>
              <p>לא נשלח מידע לחברה. אפשר למצוא את הרישום בהיסטוריה שלך.</p>
            </div>
            <a routerLink="/app/applications" class="button full-width"
              >לרישומי ההדגמה <niva-icon name="arrow"
            /></a>
          } @else {
            <label class="checkbox-label"
              ><input type="checkbox" [(ngModel)]="acknowledged" /><span
                >בדקתי את הפרטים והבנתי שלא תישלח מועמדות אמיתית.</span
              ></label
            >
            @if (!eligible()) {
              <p class="form-error" role="alert">
                המשרה אינה תואמת להעדפות הנוכחיות, ולכן לא ניתן לאשר אותה. אפשר לעדכן את ההעדפות.
              </p>
            }
            @if (store.paused()) {
              <p class="form-error" role="status">
                האישורים מושהים. יש לחדש פעילות בסקירה לפני האישור.
              </p>
            }
            <button
              class="button full-width"
              [disabled]="!acknowledged || store.paused() || !eligible()"
              (click)="approve()"
            >
              אישור בהדגמה <niva-icon name="check" />
            </button>
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            <p class="form-hint">כל בחירה בשליטה שלך. תמיד.</p>
          }
        </section>
      </div>
    } @else {
      <section class="empty-state">
        <h1>המשרה לא נמצאה</h1>
        <p>אפשר לחזור לרשימה ולגלות הזדמנויות אחרות.</p>
        <a routerLink="/app/jobs" class="button">לכל המשרות</a>
      </section>
    }`,
})
export class JobDetail {
  readonly store = inject(DemoStore);
  readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly job = computed(() => this.store.jobs.find((j) => j.id === this.params()?.get('id')));
  readonly eligible = computed(() =>
    this.store.eligibleJobs().some((j) => j.id === this.job()?.id),
  );
  acknowledged = false;
  note = '';
  readonly error = signal('');
  approve(): void {
    const job = this.job();
    if (!job || !this.acknowledged) return;
    if (!this.store.approve(job.id))
      this.error.set('לא ניתן לאשר כעת. יש לבדוק את מצב הפעילות וההעדפות.');
  }
}
