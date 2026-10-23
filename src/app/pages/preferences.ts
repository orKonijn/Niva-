import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore, Preferences } from '../core/demo-store';
import { PreferenceFields } from '../shared/preference-fields';
import { Icon } from '../shared/icon';
@Component({
  imports: [PageHeading, FormsModule, PreferenceFields, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences.html',
})
export class PreferencesPage {
  readonly store = inject(DemoStore);
  readonly draftGeneration = this.store.resetGeneration;
  draft: Preferences = { ...this.store.preferences() };
  readonly saved = signal(false);
  async save(): Promise<void> {
    this.saved.set(await this.store.savePreferences(this.draft, this.draftGeneration));
  }
}
