import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../core/app-store';
import { emptyCriteria } from '../core/models/discovery';
@Component({
  selector: 'niva-candidate-profile',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './candidate-profile.html',
  styleUrl: './candidate-profile.css',
})
export class CandidateProfile {
  readonly store = inject(AppStore);
  value = { ...emptyCriteria(), ...structuredClone(this.store.account().profile.criteria ?? {}) };
  skills = this.value.skills.join(', ');
  languages = this.value.languages.join(', ');
  qualifications = this.value.qualifications.join(', ');
  licenses = this.value.licenses.join(', ');
  employmentTypes = this.value.employmentTypes.join(', ');
  confirmed = false;
  readonly notice = signal('');
  async save() {
    const list = (v: string) =>
      v
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    const value = {
      ...this.value,
      confirmed: this.confirmed,
      skills: list(this.skills),
      languages: list(this.languages),
      qualifications: list(this.qualifications),
      licenses: list(this.licenses),
      employmentTypes: list(this.employmentTypes),
      currentCountry: this.value.currentCountry?.trim().toUpperCase() || null,
      authorizationCountry: this.value.authorizationCountry?.trim().toUpperCase() || null,
      citizenshipCountry: this.value.citizenshipCountry?.trim().toUpperCase() || null,
      currency: this.value.currency?.trim().toUpperCase() || null,
      timezone: this.value.timezone?.trim() || null,
    };
    this.notice.set(
      (await this.store.saveCriteria(value))
        ? 'הפרטים נשמרו. ההתאמות חושבו מחדש.'
        : 'לא נשמר. יש לבדוק קודי מדינה, ערכים ואישור הפרטים.',
    );
  }
}
