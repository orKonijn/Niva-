import { PageHeading } from '../shared/page-heading';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoStore } from '../core/demo-store';
import { CookiePreferences } from '../core/cookie-preferences';
import { Theme } from '../core/theme';
import { Icon } from '../shared/icon';
import { validateResume } from '../core/resume-validation';
@Component({
  imports: [PageHeading, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.html',
})
export class Profile {
  readonly store = inject(DemoStore);
  readonly cookies = inject(CookiePreferences);
  readonly theme = inject(Theme);
  name = this.store.name();
  readonly saved = signal(false);
  readonly error = signal('');
  readonly confirmReset = signal(false);
  readonly resetDone = signal('');
  readonly resetCleared = signal(false);
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
  async reset(): Promise<void> {
    const result = await this.store.reset();
    this.resetCleared.set(result === 'cleared');
    this.name = '';
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
            mode: 'local-demo',
            appearance: { theme: this.theme.preference() },
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
