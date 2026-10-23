import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore } from '../core/demo-store';
import { CookiePreferences } from '../core/cookie-preferences';
import { Icon } from '../shared/icon';
import { validateResume } from '../core/resume-validation';
@Component({
  imports: [FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="page-heading">
      <div>
        <span class="section-kicker">הסיפור שלך</span>
        <h1>הפרופיל שלי</h1>
        <p>פרטים לביקור הנוכחי, ובחירות שנשארות בשליטתך.</p>
      </div>
    </div>
    <div class="profile-grid">
      <form class="panel" (ngSubmit)="save()">
        <h2>נעים להכיר</h2>
        <label
          >איך לקרוא לך?<input
            name="name"
            [(ngModel)]="name"
            maxlength="50"
            autocomplete="given-name"
            placeholder="השם שלך"
        /></label>
        <p class="form-hint">השם נשמר בזיכרון בלבד עד רענון הדף.</p>
        <label class="upload-zone compact"
          ><niva-icon name="document" /><strong
            ><bdi>{{ store.resumeName() || 'בחירת קובץ קורות חיים' }}</bdi></strong
          ><small>PDF או DOCX, עד 10MB. התוכן לא נקרא או מועלה.</small
          ><input
            type="file"
            accept=".pdf,.docx"
            (change)="select($event)"
            aria-label="בחירת קובץ קורות חיים"
        /></label>
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <button class="button button-small" type="submit">שמירת שם לביקור הנוכחי</button>
        @if (saved()) {
          <p class="success-text" role="status">הפרטים עודכנו לביקור הנוכחי.</p>
        }
      </form>
      <section class="panel">
        <h2>הנתונים המקומיים שלך</h2>
        <p>
          העדפות חיפוש, משרות שמורות ואישורי הדגמה נשמרים בדפדפן הזה. אין חשבון משתמש או שרת מחובר.
        </p>
        <div class="stack-actions">
          <button class="button button-outline" (click)="export()">
            <niva-icon name="document" /> הורדת נתוני ההדגמה</button
          ><button class="button button-outline" (click)="cookies.reopen()">
            <niva-icon name="settings" /> העדפות עוגיות
          </button>
        </div>
        <div class="danger-zone">
          <h3>מתחילים מחדש</h3>
          <p>האיפוס מוחק את ההעדפות ורישומי ההדגמה מהמכשיר.</p>
          @if (confirmReset()) {
            <p role="alert">לאפס את נתוני ההדגמה? לא ניתן לשחזר את הבחירות.</p>
            <div class="form-actions">
              <button class="button danger-button button-small" (click)="reset()">
                כן, איפוס הנתונים</button
              ><button class="plain-button" (click)="confirmReset.set(false)">ביטול</button>
            </div>
          } @else {
            <button class="plain-button danger-text" (click)="confirmReset.set(true)">
              איפוס נתוני ההדגמה
            </button>
          }
        </div>
        @if (resetDone()) {
          <p class="success-text" role="status">נתוני ההדגמה אופסו.</p>
        }
      </section>
    </div>`,
})
export class Profile {
  readonly store = inject(DemoStore);
  readonly cookies = inject(CookiePreferences);
  name = this.store.name();
  readonly saved = signal(false);
  readonly error = signal('');
  readonly confirmReset = signal(false);
  readonly resetDone = signal(false);
  save(): void {
    this.store.name.set(this.name.trim());
    this.saved.set(true);
  }
  select(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const error = validateResume(file);
      this.error.set(error ?? '');
      if (!error) this.store.resumeName.set(file.name);
    }
    input.value = '';
  }
  reset(): void {
    this.store.reset();
    this.name = '';
    this.saved.set(false);
    this.confirmReset.set(false);
    this.resetDone.set(true);
  }
  export(): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            mode: 'local-demo',
            preferences: this.store.preferences(),
            savedJobIds: this.store.saved(),
            demoApprovals: this.store.applications(),
            paused: this.store.paused(),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'niva-demo-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
