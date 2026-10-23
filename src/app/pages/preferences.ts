import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStore, Preferences } from '../core/app-store';
import { PreferenceFields } from '../shared/preference-fields';
import { Icon } from '../shared/icon';
@Component({
  imports: [PageHeading, FormsModule, PreferenceFields, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences.html',
})
export class PreferencesPage {
  readonly store = inject(AppStore);
  readonly draftGeneration = this.store.resetGeneration;
  private draftRevision = this.store.account().revision;
  draft: Preferences = { ...this.store.preferences() };
  readonly saved = signal(false);
  async save(): Promise<void> {
    this.saved.set(
      await this.store.savePreferences(this.draft, this.draftGeneration, this.draftRevision),
    );
    if (this.saved()) this.draftRevision = this.store.account().revision;
  }
}
