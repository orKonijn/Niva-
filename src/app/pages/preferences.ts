import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore, Preferences } from '../core/demo-store';
import { PreferenceFields } from '../shared/preference-fields';
import { Icon } from '../shared/icon';
@Component({
  imports: [FormsModule, PreferenceFields, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="page-heading">
      <div>
        <span class="section-kicker">לפי מה שחשוב לך</span>
        <h1>מדייקים את הכיוון</h1>
        <p>העדפות טובות עוזרות לגלות הזדמנויות נכונות יותר.</p>
      </div>
    </div>
    <form class="panel narrow-panel" (ngSubmit)="save()">
      <div class="panel-heading">
        <span class="round-icon blue"><niva-icon name="settings" /></span>
        <div>
          <h2>העדפות החיפוש שלך</h2>
          <p>הבחירות נשמרות רק בדפדפן הזה.</p>
        </div>
      </div>
      <niva-preference-fields [value]="draft" (valueChange)="draft = $event; saved.set(false)" />
      <div class="form-actions">
        <button class="button" type="submit">שמירת ההעדפות <niva-icon name="check" /></button>
        @if (saved()) {
          <span class="success-text" role="status"
            >ההעדפות נשמרו. {{ store.eligibleJobs().length }} משרות לדוגמה מתאימות כעת.</span
          >
        }
      </div>
    </form>`,
})
export class PreferencesPage {
  readonly store = inject(DemoStore);
  draft: Preferences = { ...this.store.preferences() };
  readonly saved = signal(false);
  save(): void {
    this.store.savePreferences(this.draft);
    this.saved.set(true);
  }
}
