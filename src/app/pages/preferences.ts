import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStore, Preferences } from '../core/app-store';
import { PreferenceFields } from '../shared/preference-fields';
import { Icon } from '../shared/icon';
import { FormStatus } from '../shared/form-status';
import { protectUnsaved } from '../core/unsaved';
@Component({
  imports: [PageHeading, FormsModule, PreferenceFields, Icon, FormStatus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences.html',
})
export class PreferencesPage {
  readonly store = inject(AppStore);
  readonly draftGeneration = this.store.resetGeneration;
  private draftRevision = this.store.account().revision;
  draft: Preferences = { ...this.store.preferences() };
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  private baseline = JSON.stringify(this.draft);
  hasUnsavedChanges(): boolean {
    return JSON.stringify(this.draft) !== this.baseline;
  }
  constructor() {
    protectUnsaved(() => this.hasUnsavedChanges());
  }
  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);
    this.saved.set(
      await this.store.savePreferences(this.draft, this.draftGeneration, this.draftRevision),
    );
    if (this.saved()) {
      this.draftRevision = this.store.account().revision;
      this.baseline = JSON.stringify(this.draft);
    } else this.error.set('ההעדפות לא נשמרו. העריכה נשארה כאן; בדקו את החיבור ונסו לשמור שוב.');
    this.saving.set(false);
  }
}
