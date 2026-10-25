import { CandidateProfile } from '../shared/candidate-profile';
import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../core/app-store';
import { CookiePreferences } from '../core/cookie-preferences';
import { Theme } from '../core/theme';
import { Icon } from '../shared/icon';
import { validateResume } from '../core/resume-validation';
import { protectUnsaved } from '../core/unsaved';
import { FormStatus } from '../shared/form-status';
@Component({
  imports: [CandidateProfile, PageHeading, FormsModule, Icon, FormStatus, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class Profile {
  readonly store = inject(AppStore);
  readonly cookies = inject(CookiePreferences);
  readonly theme = inject(Theme);
  name = this.store.name();
  headline = this.store.account().profile.headline;
  private profileRevision = this.store.account().revision;
  readonly saved = signal(false);
  readonly error = signal('');
  readonly confirmReset = signal(false);
  readonly resetDone = signal('');
  readonly resetCleared = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal('');
  private baseline = JSON.stringify([this.name, this.headline]);
  hasUnsavedChanges(): boolean {
    return JSON.stringify([this.name, this.headline]) !== this.baseline;
  }
  constructor() {
    effect(() => {
      const state = this.store.account();
      if (JSON.stringify([state.profile.name, state.profile.headline]) === this.baseline)
        this.profileRevision = state.revision;
    });
    protectUnsaved(() => this.hasUnsavedChanges());
  }
  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');
    this.saved.set(
      await this.store.saveProfile(this.name.trim(), this.headline.trim(), this.profileRevision),
    );
    if (this.saved()) {
      this.profileRevision = this.store.account().revision;
      this.baseline = JSON.stringify([this.name, this.headline]);
    } else this.saveError.set('הפרופיל לא נשמר. הפרטים שהקלדת נשארו כאן; אפשר לנסות שוב.');
    this.saving.set(false);
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
  async reset(): Promise<void> {
    const result = await this.store.reset();
    this.resetCleared.set(result === 'cleared');
    this.name = '';
    this.baseline = JSON.stringify([this.name, this.headline]);
    this.saved.set(false);
    this.confirmReset.set(false);
    this.resetDone.set(
      result === 'cleared'
        ? 'נתוני ההדגמה נמחקו מהאחסון המקומי. בחירת העוגיות וערכת הנושא נשמרו.'
        : 'הביקור הנוכחי נוקה בלבד. המחיקה מהאחסון נכשלה; נתונים ישנים עשויים לחזור ברענון. ניתן למחוק נתוני אתר בהגדרות הדפדפן.',
    );
  }
  export(): void {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 2,
            mode: this.store.catalogMode() === 'real' ? 'pilot' : 'local-demo',
            storageScope: this.store.isAccount() ? 'account' : 'device',
            profile: this.store.isAccount() ? this.store.account().profile : undefined,
            appearance: { theme: this.theme.preference() },
            preferences: this.store.preferences(),
            savedJobIds: this.store.saved(),
            savedJobs: this.store.jobs
              .filter((j) => this.store.saved().includes(j.id))
              .map((j) => ({
                id: j.id,
                kind: j.source ? 'real' : 'demo',
                source: j.source?.name,
                applicationUrl: j.source?.applicationUrl,
              })),
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
    a.download =
      this.store.catalogMode() === 'real' ? 'niva-account-data.json' : 'niva-demo-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
